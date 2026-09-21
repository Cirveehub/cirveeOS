import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { GitBranch, Plus } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  StatusBadge,
  type Column,
} from '@/ui'
import { CURRENT_USER_ID, branchesCollection, useCollection } from '@/mocks'
import type { Branch } from '@/mocks'

import {
  DashboardSkeleton,
  ErrorPanel,
  ModuleHeader,
  Screen,
  useEmployeeName,
  useModuleData,
} from './parts'

interface FormState {
  name: string
  code: string
  type: Branch['type']
  address: string
  city: string
  state: string
  phone: string
  capacity: string
}

const BLANK: FormState = {
  name: '',
  code: '',
  type: 'campus',
  address: '',
  city: '',
  state: '',
  phone: '',
  capacity: '',
}

type Errors = Partial<Record<keyof FormState, string>>

function validate(form: FormState, existing: Branch[]): Errors {
  const errors: Errors = {}
  if (!form.name.trim()) errors.name = 'A branch needs a name — it appears on every invoice raised from it.'
  const code = form.code.trim().toUpperCase()
  if (!code) errors.code = 'A short code is required. References and exports use it.'
  else if (!/^[A-Z0-9_]{2,16}$/.test(code)) errors.code = 'Use two to sixteen capitals, digits or underscores.'
  else if (existing.some((b) => b.code === code)) errors.code = 'That code is already in use by another branch.'
  if (!form.city.trim()) errors.city = 'City is required.'
  const capacity = Number(form.capacity)
  if (!form.capacity.trim()) errors.capacity = 'Capacity is required — room planning reads it.'
  else if (!Number.isFinite(capacity) || capacity < 0) errors.capacity = 'Capacity must be zero or more.'
  return errors
}

export default function Branches() {
  const branches = useCollection(branchesCollection)
  const employeeName = useEmployeeName()
  const state = useModuleData(branches, 'settings.branches')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Errors>({})

  const rows = useMemo(
    () => [...state.rows].sort((a, b) => a.name.localeCompare(b.name)),
    [state.rows],
  )

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const submit = () => {
    const found = validate(form, branches)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const at = new Date().toISOString()
    branchesCollection.insert({
      /* The seed's `BranchCode` union is a seed convenience; the real column is a string. */
      id: `branch-${form.code.trim().toLowerCase()}` as Branch['id'],
      code: form.code.trim().toUpperCase() as Branch['code'],
      name: form.name.trim(),
      type: form.type,
      address: form.address.trim() || form.city.trim(),
      city: form.city.trim(),
      state: form.state.trim() || form.city.trim(),
      phone: form.phone.trim() || 'Not set',
      managerId: null,
      capacity: Number(form.capacity),
      activeFrom: at.slice(0, 10),
      status: 'active',
      createdAt: at,
      createdBy: CURRENT_USER_ID,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
    toast.success(`${form.name.trim()} added. It is selectable everywhere a branch is chosen.`)
    setForm(BLANK)
    setOpen(false)
  }

  const columns: Array<Column<Branch>> = [
    {
      key: 'name',
      header: 'Branch',
      pinned: true,
      minWidth: 200,
      accessor: (branch) => branch.name,
      sortValue: (branch) => branch.name,
      sortable: true,
    },
    {
      key: 'code',
      header: 'Code',
      width: 128,
      accessor: (branch) => <span className="font-mono text-body-13">{branch.code}</span>,
      sortValue: (branch) => branch.code,
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 116,
      cell: (branch) => (
        <Badge tone={branch.type === 'hq' ? 'accent' : branch.type === 'virtual' ? 'info' : 'neutral'} size="sm">
          {branch.type === 'hq' ? 'HQ' : branch.type === 'virtual' ? 'Virtual' : 'Campus'}
        </Badge>
      ),
      sortValue: (branch) => branch.type,
      sortable: true,
    },
    {
      key: 'address',
      header: 'Address',
      minWidth: 260,
      accessor: (branch) => branch.address,
      sortValue: (branch) => branch.address,
    },
    { key: 'city', header: 'City', width: 130, accessor: (branch) => branch.city, sortValue: (branch) => branch.city, sortable: true },
    { key: 'state', header: 'State', width: 130, accessor: (branch) => branch.state, sortValue: (branch) => branch.state, sortable: true },
    {
      key: 'phone',
      header: 'Phone',
      width: 160,
      accessor: (branch) => <span className="font-mono text-body-13">{branch.phone}</span>,
      sortValue: (branch) => branch.phone,
    },
    {
      key: 'manager',
      header: 'Manager',
      minWidth: 180,
      accessor: (branch) => employeeName(branch.managerId),
      sortValue: (branch) => employeeName(branch.managerId),
      sortable: true,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      align: 'right',
      width: 116,
      accessor: (branch) => <span className="tabular-nums">{formatNumber(branch.capacity)}</span>,
      sortValue: (branch) => branch.capacity,
      sortable: true,
    },
    {
      key: 'activeFrom',
      header: 'Active from',
      width: 132,
      accessor: (branch) => formatDate(branch.activeFrom),
      sortValue: (branch) => branch.activeFrom,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 116,
      cell: (branch) => <StatusBadge status={branch.status} />,
      sortValue: (branch) => branch.status,
      sortable: true,
    },
  ]

  const header = (
    <ModuleHeader
      title="Branches"
      description="Campuses, physical and virtual. A branch is a permission scope, a cost centre and a line on every certificate issued from it."
      actions={
        <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
          Add branch
        </Button>
      }
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="Branches" onRetry={state.retry} />
      </Screen>
    )
  }

  if (state.loading) {
    return (
      <Screen>
        {header}
        <DashboardSkeleton />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}

      <Card>
        <CardBody padding="none">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(branch) => branch.id}
            density="compact"
            bordered={false}
            minWidth={1560}
            caption="Branches with code, type, address, manager, capacity and status"
            empty={
              <EmptyState
                icon={GitBranch}
                title="No branches yet"
                message="Nothing can be scheduled, staffed or invoiced until at least one branch exists — every record in the system carries one."
                action={
                  <Button size="sm" onClick={() => setOpen(true)}>
                    Add the first branch
                  </Button>
                }
              />
            }
          />
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Add a branch"
        description="A branch can be added without a code change. That is the point of this screen."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Add branch</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Branch name" required error={errors.name} className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} invalid={Boolean(errors.name)} placeholder="Abeokuta campus" />
          </Field>
          <Field label="Short code" required error={errors.code} hint="Capitals, digits and underscores. Used in references and exports.">
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} invalid={Boolean(errors.code)} placeholder="ABEOKUTA" />
          </Field>
          <Field label="Type" required>
            <Select
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              options={[
                { value: 'hq', label: 'HQ' },
                { value: 'campus', label: 'Campus' },
                { value: 'virtual', label: 'Virtual' },
              ]}
            />
          </Field>
          <Field label="City" required error={errors.city}>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} invalid={Boolean(errors.city)} placeholder="Abeokuta" />
          </Field>
          <Field label="State" error={errors.state}>
            <Input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Ogun" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="14 Kuto Road, Abeokuta" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+234 802 000 0000" />
          </Field>
          <Field label="Capacity" required error={errors.capacity} hint="Seats available for scheduling.">
            <Input
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
              invalid={Boolean(errors.capacity)}
              inputMode="numeric"
              placeholder="60"
            />
          </Field>
        </div>
      </Modal>
    </Screen>
  )
}
