/**
 * Onboarding — `/people/onboarding` (screen-spec §9).
 *
 * Everyone who has resumed recently, and how far through the twelve-step
 * checklist they are. The checklist only exists for people with an employment
 * record, which is the point: an accepted offer does not put anybody on this
 * screen, because until somebody resumes there is nothing to issue a card for,
 * allocate an asset to, or grant access on.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ListChecks, UserCheck } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  PageHeader,
  ProgressBar,
  StatusBadge,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { TODAY, addDays, cardsCollection, employeesCollection, tasksCollection, useCollection } from '@/mocks'
import type { Employee, Task } from '@/mocks'

import { issueCard, suggestUid } from '@/modules/physical/writes'

import {
  EMPLOYMENT_TYPE_LABEL,
  PeopleGroupTabs,
  Page,
  ScreenError,
  branchName,
  departmentName,
  personName,
  useScreenState,
  userName,
} from './shared'
import { createOnboardingChecklist, onboardingTasksFor, setTaskStatus, taskGroup } from './writes'

/** How long somebody counts as onboarding when no checklist exists yet. */
const RECENT_DAYS = 60

interface Row {
  employee: Employee
  tasks: Task[]
  done: number
  total: number
  daysSinceStart: number
}

export default function Onboarding() {
  const state = useScreenState()

  const employees = useCollection(employeesCollection)
  const tasks = useCollection(tasksCollection)
  const cards = useCollection(cardsCollection)

  const [filters, setFilters] = useState<FilterValues>({})
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo<Row[]>(() => {
    const cutoff = addDays(TODAY, -RECENT_DAYS)
    return employees
      .filter((employee) => {
        if (employee.status === 'exited') return false
        const own = tasks.filter((t) => t.relatedEntityType === 'Employee' && t.relatedEntityId === employee.id)
        return own.length > 0 || employee.startDate >= cutoff
      })
      .map((employee) => {
        const own = tasks
          .filter((t) => t.relatedEntityType === 'Employee' && t.relatedEntityId === employee.id)
          .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
        return {
          employee,
          tasks: own,
          done: own.filter((t) => t.status === 'done').length,
          total: own.length,
          daysSinceStart: Math.round(
            (Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${employee.startDate}T00:00:00Z`)) / 86_400_000,
          ),
        }
      })
      .filter((row) => {
        if (filters.progress === 'outstanding' && row.total > 0 && row.done === row.total) return false
        if (filters.progress === 'complete' && !(row.total > 0 && row.done === row.total)) return false
        if (filters.progress === 'none' && row.total > 0) return false
        const term = search.trim().toLowerCase()
        if (!term) return true
        return (
          personName(row.employee.personId).toLowerCase().includes(term) ||
          row.employee.jobTitle.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => a.daysSinceStart - b.daysSinceStart)
  }, [employees, tasks, filters, search])

  const open = openId ? (rows.find((r) => r.employee.id === openId) ?? null) : null
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const hasTask = (row: Row, fragment: string) =>
    row.tasks.find((t) => t.title.toLowerCase().includes(fragment))?.status === 'done'

  /** The real thing "Card issued" should mean — not a task title, a live Physical-module record. */
  const activeCardFor = (employee: Employee) =>
    cards.find((c) => c.personId === employee.personId && c.holderType === 'employee' && c.status === 'active')

  const columns: Array<Column<Row>> = [
    {
      key: 'employee',
      header: 'Employee',
      pinned: true,
      minWidth: 190,
      accessor: (row) => personName(row.employee.personId),
      sortValue: (row) => personName(row.employee.personId),
      sortable: true,
    },
    { key: 'role', header: 'Role', minWidth: 190, accessor: (row) => row.employee.jobTitle, sortValue: (row) => row.employee.jobTitle, sortable: true },
    { key: 'start', header: 'Start date', width: 126, accessor: (row) => formatDate(row.employee.startDate), sortValue: (row) => row.employee.startDate, sortable: true },
    {
      key: 'days',
      header: 'Days since start',
      align: 'right',
      width: 148,
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.daysSinceStart)}</span>,
      sortValue: (row) => row.daysSinceStart,
      sortable: true,
    },
    {
      key: 'progress',
      header: 'Checklist',
      minWidth: 220,
      cell: (row) =>
        row.total === 0 ? (
          <Badge tone="warning" size="sm">
            Not raised
          </Badge>
        ) : (
          <ProgressBar
            value={row.done}
            max={row.total}
            tone={row.done === row.total ? 'success' : 'accent'}
            size="sm"
            valueLabel={`${formatNumber(row.done)} of ${formatNumber(row.total)}`}
            aria-label={`Onboarding progress for ${personName(row.employee.personId)}`}
          />
        ),
      sortValue: (row) => (row.total === 0 ? -1 : row.done / row.total),
      sortable: true,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      width: 126,
      accessor: (row) => {
        const left = row.total - row.done
        return <span className={`tabular-nums ${left > 0 && row.daysSinceStart > 14 ? 'text-warning-text' : ''}`}>{formatNumber(left)}</span>
      },
      sortValue: (row) => row.total - row.done,
      sortable: true,
    },
    { key: 'manager', header: 'Manager', minWidth: 170, accessor: (row) => userName(row.employee.managerUserId), sortValue: (row) => userName(row.employee.managerUserId) },
    {
      key: 'card',
      header: 'Card issued',
      width: 126,
      cell: (row) =>
        activeCardFor(row.employee) ? (
          <Badge tone="success" size="sm">Issued</Badge>
        ) : (
          <Badge tone="neutral" size="sm">Not yet</Badge>
        ),
      sortValue: (row) => (activeCardFor(row.employee) ? 1 : 0),
      sortable: true,
    },
    {
      key: 'assets',
      header: 'Assets allocated',
      width: 156,
      cell: (row) => (hasTask(row, 'laptop') ? <Badge tone="success" size="sm">Allocated</Badge> : <Badge tone="neutral" size="sm">Not yet</Badge>),
      sortValue: (row) => (hasTask(row, 'laptop') ? 1 : 0),
      sortable: true,
    },
    {
      key: 'access',
      header: 'System access',
      width: 150,
      cell: (row) => (hasTask(row, 'system access') ? <Badge tone="success" size="sm">Granted</Badge> : <Badge tone="neutral" size="sm">Not yet</Badge>),
      sortValue: (row) => (hasTask(row, 'system access') ? 1 : 0),
      sortable: true,
    },
    { key: 'status', header: 'Employment status', width: 156, cell: (row) => <StatusBadge status={row.employee.status} />, sortValue: (row) => row.employee.status, sortable: true },
  ]

  const grouped = useMemo(() => {
    if (!open) return []
    const map = new Map<string, Task[]>()
    for (const task of open.tasks) {
      const group = taskGroup(task)
      map.set(group, [...(map.get(group) ?? []), task])
    }
    return [...map.entries()]
  }, [open])

  return (
    <Page>
      <PageHeader
        title="Onboarding"
        description="Everyone who has actually resumed in the last two months, and the twelve things that have to happen before they can do the job."
      />

      <PeopleGroupTabs group="workforce" active="onboarding" />

      <ScreenError state={state} />

      <Alert tone="info" className="mb-6" title="Only people who resumed appear here">
        An accepted offer does not start onboarding. A card, a mailbox and a laptop are all allocated against an employment
        record, and that record is only created when somebody actually walks in.
      </Alert>

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name or role"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                {
                  key: 'progress',
                  label: 'Checklist',
                  options: [
                    { value: 'outstanding', label: 'Still outstanding' },
                    { value: 'complete', label: 'Complete' },
                    { value: 'none', label: 'Not raised' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.employee.id}
            loading={state.loading}
            onRowClick={(row) => setOpenId(row.employee.id)}
            activeRowKey={open?.employee.id}
            density="compact"
            minWidth={1700}
            bordered={false}
            caption="Onboarding progress with checklist completion, card, assets and access"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="Nobody matches these filters"
                  message="Try another checklist state, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UserCheck}
                  title="Nobody is onboarding"
                  message="Nobody has resumed in the last two months and no checklist is outstanding. Somebody appears here the moment a resumption is recorded against an accepted offer."
                  action={
                    <Button size="sm" variant="secondary" asChild>
                      <Link to="/people/offers">Open offers</Link>
                    </Button>
                  }
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? personName(open.employee.personId) : 'Onboarding'}
        description={open ? `${open.employee.jobTitle} · started ${formatDate(open.employee.startDate)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Employee ID">
                <span className="font-mono text-body-13">{open.employee.employeeId}</span>
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge status={open.employee.status} />
              </KeyValue>
              <KeyValue label="Department">{departmentName(open.employee.departmentId)}</KeyValue>
              <KeyValue label="Branch">{branchName(open.employee.branchId)}</KeyValue>
              <KeyValue label="Manager">{userName(open.employee.managerUserId)}</KeyValue>
              <KeyValue label="Employment type">{EMPLOYMENT_TYPE_LABEL[open.employee.employmentType] ?? open.employee.employmentType}</KeyValue>
              <KeyValue label="Probation">
                {open.employee.probationEndsAt ? `Ends ${formatDate(open.employee.probationEndsAt)}` : 'Not on probation'}
              </KeyValue>
              <KeyValue label="Days since start">{formatNumber(open.daysSinceStart)}</KeyValue>
            </KeyValueList>

            {open.total === 0 ? (
              <EmptyState
                icon={ListChecks}
                bordered
                title="No onboarding checklist has been raised"
                message="Twelve tasks across documentation, access, role assignment, the NFC card, assets, orientation, SOPs and the first week. Without them there is no record of what was actually done."
                action={
                  <Button size="sm" onClick={() => createOnboardingChecklist(open.employee.id)}>
                    Raise the checklist
                  </Button>
                }
              />
            ) : (
              <>
                <div className="rounded-xl bg-surface-sunken px-4 py-3">
                  <ProgressBar
                    value={open.done}
                    max={open.total}
                    tone={open.done === open.total ? 'success' : 'accent'}
                    label="Checklist progress"
                    valueLabel={`${formatNumber(open.done)} of ${formatNumber(open.total)}`}
                  />
                </div>

                {grouped.map(([group, groupTasks]) => (
                  <div key={group}>
                    <h3 className="mb-2 text-heading-18">{group}</h3>
                    <ul className="flex flex-col gap-2">
                      {groupTasks.map((task) => (
                        <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border px-3 py-2">
                          <Checkbox
                            checked={task.status === 'done'}
                            onChange={(e) => {
                              const checkedOn = e.target.checked
                              setTaskStatus(task.id as string, checkedOn ? 'done' : 'open')
                              // The NFC task's real completion is a Card record, not just a
                              // status flip — issue one for real if this employee has none.
                              if (checkedOn && taskGroup(task) === 'NFC card' && !activeCardFor(open.employee)) {
                                issueCard({
                                  personId: open.employee.personId,
                                  holderType: 'employee',
                                  branchId: open.employee.branchId,
                                  accessProfile: 'Staff — all areas',
                                  uid: suggestUid(open.employee.employeeId),
                                  replacesCardId: null,
                                })
                              }
                            }}
                            label={task.title}
                            description={`${userName(task.ownerUserId)}${task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ''}`}
                          />
                          {task.status === 'done' && (
                            <Badge tone="success" size="sm" icon={<CheckCircle2 size={12} aria-hidden="true" />}>
                              Done
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Drawer>
    </Page>
  )
}
