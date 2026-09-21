import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ClipboardList, Plus } from 'lucide-react'
import {
  Alert,
  Badge,
  BulkActionBar,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  type Column,
} from '@/ui'
import { departmentsCollection, tasksCollection, useCollection, TODAY } from '@/mocks'
import { taskId as asTaskId } from '@/mocks/types'
import type { Task, TaskPriority, TaskStatus } from '@/mocks'
import { formatDate } from '@/lib/format'
import { useActingUser, useScreenState, userName, userOptions } from './shared'
import { writeAudit } from './engine'

const STATUSES: TaskStatus[] = ['open', 'in_progress', 'blocked', 'done', 'cancelled']
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

const PRIORITY_TONE = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
} as const

export default function Tasks() {
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')
  const acting = useActingUser()

  const tasks = useCollection(tasksCollection)
  const departments = useCollection(departmentsCollection)

  const [selected, setSelected] = useState<string[]>([])
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState({ title: '', ownerUserId: '', dueAt: TODAY, priority: 'normal', description: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const owner = params.get('owner') ?? ''
  const department = params.get('department') ?? ''
  const priority = params.get('priority') ?? ''
  const overdueOnly = params.get('overdue') === '1'
  const groupBy = params.get('group') ?? 'none'
  const filtersActive = Boolean(q || status || owner || department || priority || overdueOnly)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return tasks
      .filter((t) => !needle || t.title.toLowerCase().includes(needle))
      .filter((t) => !status || t.status === status)
      .filter((t) => !owner || t.ownerUserId === owner)
      .filter((t) => !department || t.departmentId === department)
      .filter((t) => !priority || t.priority === priority)
      .filter((t) => !overdueOnly || (t.dueAt !== null && t.dueAt.slice(0, 10) < TODAY && t.status !== 'done'))
      .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
  }, [tasks, q, status, owner, department, priority, overdueOnly])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ label: '', rows: filtered }]
    const map = new Map<string, Task[]>()
    for (const task of filtered) {
      const key =
        groupBy === 'owner'
          ? userName(task.ownerUserId)
          : groupBy === 'department'
            ? (departments.find((d) => d.id === task.departmentId)?.name ?? 'No department')
            : task.dueAt
              ? formatDate(task.dueAt)
              : 'No due date'
      map.set(key, [...(map.get(key) ?? []), task])
    }
    return [...map.entries()].map(([label, rows]) => ({ label, rows }))
  }, [filtered, groupBy, departments])

  const patch = (task: Task, delta: Partial<Task>, field: string, before: string, after: string) => {
    tasksCollection.update(task.id, {
      ...delta,
      updatedAt: new Date().toISOString(),
      updatedBy: acting,
    })
    writeAudit({
      actorUserId: acting,
      action: 'task.update',
      entityType: 'Task',
      entityId: task.id as string,
      entityRef: task.title,
      field,
      before,
      after,
    })
  }

  const createTask = () => {
    if (!form.title.trim()) {
      setFormError('A task needs a title.')
      return
    }
    if (!form.ownerUserId) {
      setFormError('A task needs an owner, or nobody picks it up.')
      return
    }
    const now = new Date().toISOString()
    const task: Task = {
      id: asTaskId(`tsk-${Math.random().toString(36).slice(2, 10)}`),
      title: form.title.trim(),
      description: form.description.trim() || null,
      ownerUserId: form.ownerUserId as Task['ownerUserId'],
      departmentId: null,
      relatedEntityType: null,
      relatedEntityId: null,
      relatedEntityRef: null,
      dueAt: `${form.dueAt}T17:00:00+01:00`,
      priority: form.priority as TaskPriority,
      status: 'open',
      completedAt: null,
      createdAt: now,
      createdBy: acting,
      updatedAt: now,
      updatedBy: acting,
    }
    tasksCollection.insert(task)
    writeAudit({
      actorUserId: acting,
      action: 'task.create',
      entityType: 'Task',
      entityId: task.id as string,
      entityRef: task.title,
      field: 'status',
      before: null,
      after: 'Open',
    })
    setNewOpen(false)
    setForm({ title: '', ownerUserId: '', dueAt: TODAY, priority: 'normal', description: '' })
    setFormError(null)
    toast.success('Task created.')
  }

  const columns: Array<Column<Task>> = [
    { key: 'title', header: 'Task', minWidth: 280, accessor: (t) => t.title, sortable: true },
    {
      key: 'owner',
      header: 'Owner',
      width: 190,
      cell: (t) => (
        <Select
          selectSize="sm"
          aria-label={`Owner of ${t.title}`}
          value={t.ownerUserId}
          options={userOptions()}
          onChange={(event) =>
            patch(t, { ownerUserId: event.target.value as Task['ownerUserId'] }, 'ownerUserId', userName(t.ownerUserId), userName(event.target.value))
          }
        />
      ),
      sortValue: (t) => userName(t.ownerUserId),
      sortable: true,
    },
    {
      key: 'department',
      header: 'Department',
      width: 150,
      accessor: (t) => departments.find((d) => d.id === t.departmentId)?.name ?? '—',
      sortable: true,
    },
    {
      key: 'related',
      header: 'Related record',
      width: 160,
      accessor: (t) => (t.relatedEntityRef ? `${t.relatedEntityType} ${t.relatedEntityRef}` : '—'),
      sortable: true,
    },
    {
      key: 'due',
      header: 'Due',
      width: 150,
      cell: (t) => (
        <Input
          inputSize="sm"
          type="date"
          aria-label={`Due date for ${t.title}`}
          value={t.dueAt ? t.dueAt.slice(0, 10) : ''}
          onChange={(event) =>
            patch(t, { dueAt: `${event.target.value}T17:00:00+01:00` }, 'dueAt', t.dueAt ?? '—', event.target.value)
          }
        />
      ),
      sortValue: (t) => t.dueAt ?? '',
      sortable: true,
    },
    {
      key: 'priority',
      header: 'Priority',
      width: 110,
      cell: (t) => (
        <Badge tone={PRIORITY_TONE[t.priority]} size="sm">
          {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
        </Badge>
      ),
      sortValue: (t) => PRIORITIES.indexOf(t.priority),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 150,
      cell: (t) => (
        <Select
          selectSize="sm"
          aria-label={`Status of ${t.title}`}
          value={t.status}
          options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
          onChange={(event) =>
            patch(
              t,
              {
                status: event.target.value as TaskStatus,
                completedAt: event.target.value === 'done' ? new Date().toISOString() : null,
              },
              'status',
              t.status,
              event.target.value,
            )
          }
        />
      ),
      sortValue: (t) => t.status,
      sortable: true,
    },
    { key: 'createdBy', header: 'Created by', width: 150, accessor: (t) => userName(t.createdBy), sortable: true },
    { key: 'created', header: 'Created', width: 120, accessor: (t) => formatDate(t.createdAt), sortValue: (t) => t.createdAt, sortable: true },
  ]

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Tasks"
        description="Deliberately lightweight. No dependencies, no subtasks, no gantt — this is a to-do list attached to real records, not a project manager."
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'Tasks' }]}
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setNewOpen(true)}>
            New task
          </Button>
        }
      />

      {error && (
        <Alert
          tone="danger"
          title="Could not load tasks"
          className="mt-6"
          action={
            <Button size="sm" variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <FilterBar
        className="mt-6"
        search={q}
        onSearchChange={(v) => set('q', v)}
        searchPlaceholder="Search tasks"
        values={{ status, owner, department, priority, group: groupBy === 'none' ? undefined : groupBy }}
        onFilterChange={(key, value) => set(key === 'group' ? 'group' : key, value)}
        onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
        filters={[
          { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
          { key: 'owner', label: 'Owner', options: userOptions() },
          { key: 'department', label: 'Department', options: departments.map((d) => ({ value: d.id as string, label: d.name })) },
          { key: 'priority', label: 'Priority', options: PRIORITIES.map((p) => ({ value: p, label: p })) },
          {
            key: 'group',
            label: 'Group by',
            options: [
              { value: 'owner', label: 'Owner' },
              { value: 'due', label: 'Due date' },
              { value: 'department', label: 'Department' },
            ],
          },
        ]}
      >
        <Button
          size="sm"
          variant={overdueOnly ? 'primary' : 'secondary'}
          onClick={() => set('overdue', overdueOnly ? undefined : '1')}
        >
          Overdue only
        </Button>
      </FilterBar>

      {selected.length > 0 && (
        <BulkActionBar count={selected.length} itemNoun="task" onClearSelection={() => setSelected([])} className="mt-4">
          <Select
            selectSize="sm"
            aria-label="Reassign selected tasks"
            placeholder="Reassign to"
            options={userOptions()}
            onChange={(event) => {
              const to = event.target.value
              if (!to) return
              selected.forEach((id) => {
                const task = tasks.find((t) => t.id === id)
                if (task) patch(task, { ownerUserId: to as Task['ownerUserId'] }, 'ownerUserId', userName(task.ownerUserId), userName(to))
              })
              setSelected([])
              toast.success('Tasks reassigned.')
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              selected.forEach((id) => {
                const task = tasks.find((t) => t.id === id)
                if (task) patch(task, { status: 'done', completedAt: new Date().toISOString() }, 'status', task.status, 'done')
              })
              setSelected([])
              toast.success('Tasks closed.')
            }}
          >
            Close selected
          </Button>
        </BulkActionBar>
      )}

      {loading ? (
        <Card className="mt-4">
          <CardBody className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={40} rounded="lg" />
            ))}
          </CardBody>
        </Card>
      ) : error ? null : filtered.length === 0 ? (
        <Card className="mt-4">
          <CardBody>
            {filtersActive ? (
              <EmptyState
                variant="search"
                title="No tasks match these filters."
                message="Widen the filters, or clear them to see the whole list."
                action={
                  <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No tasks yet."
                message="Tasks are the small things that fall out of approvals, meetings and follow-ups. Nothing is tracked until one exists."
                action={
                  <Button leftIcon={<Plus size={16} />} onClick={() => setNewOpen(true)}>
                    New task
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {grouped.map((group) => (
            <Card key={group.label || 'all'}>
              {group.label && (
                <div className="border-b border-border px-6 py-3">
                  <span className="text-body-14 font-semibold text-text">{group.label}</span>
                  <span className="ml-2 text-body-13 text-text-secondary">{group.rows.length}</span>
                </div>
              )}
              <CardBody padding="none">
                <DataTable
                  data={group.rows}
                  columns={columns}
                  rowKey={(t) => t.id as string}
                  caption="Tasks with owner, due date, priority and status"
                  density="compact"
                  minWidth={1400}
                  selectable
                  selectedKeys={selected}
                  onSelectionChange={setSelected}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-body-12 text-text-secondary">
        Tasks are deliberately flat. If a piece of work needs dependencies or a schedule, it belongs in a meeting
        decision or a project tool, not here.
      </p>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New task"
        description="Short, owned and dated. Everything else is optional."
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTask}>Create task</Button>
          </>
        }
      >
        <Field label="Title" required error={formError && !form.title.trim() ? formError : null}>
          <Input
            value={form.title}
            onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
            placeholder="Chase the Interswitch invoice"
            invalid={Boolean(formError) && !form.title.trim()}
          />
        </Field>
        <Field className="mt-3" label="Owner" required error={formError && !form.ownerUserId ? formError : null}>
          <Select
            placeholder="Pick an owner"
            value={form.ownerUserId}
            onChange={(event) => setForm((f) => ({ ...f, ownerUserId: event.target.value }))}
            options={userOptions()}
            invalid={Boolean(formError) && !form.ownerUserId}
          />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Due">
            <Input type="date" value={form.dueAt} onChange={(event) => setForm((f) => ({ ...f, dueAt: event.target.value }))} />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(event) => setForm((f) => ({ ...f, priority: event.target.value }))}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </Field>
        </div>
        <Field className="mt-3" label="Notes" optional>
          <Textarea rows={2} value={form.description} onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))} />
        </Field>
      </Modal>
    </div>
  )
}
