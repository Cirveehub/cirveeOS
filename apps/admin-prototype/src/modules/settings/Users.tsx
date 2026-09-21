import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { KeyRound, ShieldOff, UserPlus } from 'lucide-react'

import { formatDateTime, formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterBar,
  StatusBadge,
  TableToolbar,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  branchesCollection,
  departmentsCollection,
  rolesCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import type { PermissionScope, Role, User } from '@/mocks'

import {
  DashboardSkeleton,
  ErrorPanel,
  ModuleHeader,
  Screen,
  useModuleData,
  usePersonName,
} from './parts'

const SCOPE_RANK: Record<PermissionScope, number> = {
  none: 0,
  own: 1,
  team: 2,
  department: 3,
  branch: 4,
  organisation: 5,
}

const SCOPE_LABEL: Record<PermissionScope, string> = {
  none: 'No access',
  own: 'Own',
  team: 'Team',
  department: 'Department',
  branch: 'Branch',
  organisation: 'Organisation',
}

/**
 * Eleven columns is more than anyone reads at once. The eight shown by default
 * answer the question this screen exists for — who is this account, what can it
 * reach, and is it safe — and the three that describe where someone sits in the
 * org chart are one click away rather than permanently in the way.
 */
const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Name', defaultVisible: true, locked: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'roles', label: 'Roles', defaultVisible: true },
  { key: 'scope', label: 'Widest view scope', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'department', label: 'Department', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'mfa', label: 'MFA', defaultVisible: true },
  { key: 'lastLogin', label: 'Last login', defaultVisible: true },
  { key: 'created', label: 'Created', defaultVisible: false },
  { key: 'actions', label: 'Actions', defaultVisible: true, locked: true },
]

/** The widest view scope any of a user's roles grants — their effective reach. */
function widestScope(user: User, roles: Role[]): PermissionScope {
  let widest: PermissionScope = 'none'
  for (const roleId of user.roleIds) {
    const role = roles.find((r) => r.id === roleId)
    if (!role) continue
    for (const actions of Object.values(role.permissions)) {
      if (SCOPE_RANK[actions.view] > SCOPE_RANK[widest]) widest = actions.view
    }
  }
  return widest
}

export default function Users() {
  const users = useCollection(usersCollection)
  const roles = useCollection(rolesCollection)
  const branches = useCollection(branchesCollection)
  const departments = useCollection(departmentsCollection)
  const personName = usePersonName()
  const state = useModuleData(users, 'settings.users')

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [suspendId, setSuspendId] = useState<string | null>(null)
  const { visible: visibleColumns, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? 'Unknown role'
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? 'Unassigned'
  const departmentName = (id: string | null) =>
    id ? (departments.find((d) => d.id === id)?.name ?? 'Unknown department') : 'None'

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return state.rows
      .filter((user) => {
        if (filters.status && user.status !== filters.status) return false
        if (filters.branch && user.primaryBranchId !== filters.branch) return false
        if (filters.role && !user.roleIds.includes(filters.role as Role['id'])) return false
        if (filters.mfa === 'on' && !user.mfaEnabled) return false
        if (filters.mfa === 'off' && user.mfaEnabled) return false
        if (!term) return true
        return personName(user.personId).toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
      })
      .sort((a, b) => personName(a.personId).localeCompare(personName(b.personId)))
  }, [state.rows, filters, search, personName])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const suspendTarget = suspendId ? users.find((u) => u.id === suspendId) ?? null : null

  const suspend = () => {
    if (!suspendTarget) return
    usersCollection.update(suspendTarget.id, { status: 'suspended', updatedAt: new Date().toISOString() })
    toast.success(`${personName(suspendTarget.personId)} suspended. The account is kept, not deleted.`)
    setSuspendId(null)
  }

  const allColumns: Record<string, Column<User>> = {
    name: {
      key: 'name',
      header: 'Name',
      pinned: true,
      minWidth: 200,
      accessor: (user) => personName(user.personId),
      sortValue: (user) => personName(user.personId),
      sortable: true,
    },
    email: {
      key: 'email',
      header: 'Email',
      minWidth: 240,
      accessor: (user) => <span className="font-mono text-body-12">{user.email}</span>,
      sortValue: (user) => user.email,
      sortable: true,
    },
    roles: {
      key: 'roles',
      header: 'Roles',
      minWidth: 260,
      cell: (user) =>
        user.roleIds.length === 0 ? (
          <span className="text-body-13 text-text-secondary">None — cannot sign in usefully</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {user.roleIds.map((roleId) => (
              <Link key={roleId} to={`/settings/roles/${roleId}`} onClick={(event) => event.stopPropagation()}>
                <Badge tone="accent" size="sm">
                  {roleName(roleId)}
                </Badge>
              </Link>
            ))}
          </div>
        ),
      sortValue: (user) => user.roleIds.map((id) => roleName(id)).join(' '),
      sortable: true,
    },
    scope: {
      key: 'scope',
      header: 'Widest view scope',
      width: 172,
      cell: (user) => {
        const scope = widestScope(user, roles)
        return (
          <Badge tone={scope === 'organisation' ? 'warning' : scope === 'none' ? 'neutral' : 'info'} size="sm">
            {SCOPE_LABEL[scope]}
          </Badge>
        )
      },
      sortValue: (user) => SCOPE_RANK[widestScope(user, roles)],
      sortable: true,
    },
    branch: {
      key: 'branch',
      header: 'Branch',
      width: 160,
      accessor: (user) => branchName(user.primaryBranchId),
      sortValue: (user) => branchName(user.primaryBranchId),
      sortable: true,
    },
    department: {
      key: 'department',
      header: 'Department',
      minWidth: 180,
      accessor: (user) => departmentName(user.departmentId),
      sortValue: (user) => departmentName(user.departmentId),
      sortable: true,
    },
    status: {
      key: 'status',
      header: 'Status',
      width: 126,
      cell: (user) => <StatusBadge status={user.status} />,
      sortValue: (user) => user.status,
      sortable: true,
    },
    mfa: {
      key: 'mfa',
      header: 'MFA',
      width: 110,
      cell: (user) =>
        user.mfaEnabled ? (
          <Badge tone="success" size="sm" icon={<KeyRound size={12} />}>
            Enabled
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            Off
          </Badge>
        ),
      sortValue: (user) => (user.mfaEnabled ? 1 : 0),
      sortable: true,
    },
    lastLogin: {
      key: 'lastLogin',
      header: 'Last login',
      width: 176,
      accessor: (user) =>
        user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="text-text-secondary">Never</span>,
      sortValue: (user) => user.lastLoginAt ?? '',
      sortable: true,
    },
    created: {
      key: 'created',
      header: 'Created',
      width: 176,
      accessor: (user) => formatDateTime(user.createdAt),
      sortValue: (user) => user.createdAt,
      sortable: true,
    },
    actions: {
      key: 'actions',
      header: 'Actions',
      width: 132,
      cell: (user) => (
        <Button
          size="sm"
          variant="ghost"
          disabled={user.status === 'suspended' || user.status === 'deactivated'}
          leftIcon={<ShieldOff size={16} />}
          onClick={(event) => {
            event.stopPropagation()
            setSuspendId(user.id)
          }}
        >
          Suspend
        </Button>
      ),
    },
  }

  const columns = visibleColumns.map((key) => allColumns[key]).filter(Boolean)
  /** Scroll only when the visible columns genuinely need it, not always. */
  const tableWidth = columns.reduce<number>((sum, column) => {
    const declared = [column.width, column.minWidth].find((value) => typeof value === 'number')
    return sum + (declared ?? 160)
  }, 0)

  const header = (
    <ModuleHeader
      title="Users"
      description={`${formatNumber(users.length)} accounts. Widest view scope is derived from the roles each account holds — it is the fastest way to find someone who can see more than they should.`}
      actions={
        <Button
          size="sm"
          leftIcon={<UserPlus size={16} />}
          onClick={() =>
            toast(
              'Not built — an invitation is an email, and this prototype has no backend to send one. A fake "invitation sent" would claim a capability that does not exist.',
            )
          }
        >
          Invite user
        </Button>
      }
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="Users" onRetry={state.retry} />
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
          <TableToolbar
            actions={
              <ColumnPicker
                catalogue={COLUMN_CATALOGUE}
                visible={visibleColumns}
                defaultKeys={defaultKeys}
                onChange={setVisible}
              />
            }
          >
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name or email"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: ['active', 'invited', 'suspended', 'deactivated'].map((s) => ({ value: s, label: s })),
                },
                { key: 'role', label: 'Role', options: roles.map((r) => ({ value: r.id, label: r.name })) },
                { key: 'branch', label: 'Branch', options: branches.map((b) => ({ value: b.id, label: b.name })) },
                {
                  key: 'mfa',
                  label: 'MFA',
                  options: [
                    { value: 'on', label: 'Enabled' },
                    { value: 'off', label: 'Not enabled' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(user) => user.id}
            density="compact"
            bordered={false}
            minWidth={tableWidth}
            caption="User accounts, with the roles they hold and the widest view scope those roles grant"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No users match these filters"
                  message="Try another status, role or branch, or clear the search."
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
                  icon={UserPlus}
                  title="No user accounts"
                  message="Nobody can sign in. A user account links a person record to the roles that decide what they can reach."
                />
              )
            }
          />
        </CardBody>
      </Card>

      <ConfirmDialog
        open={suspendTarget !== null}
        onClose={() => setSuspendId(null)}
        onConfirm={suspend}
        destructive
        title={suspendTarget ? `Suspend ${personName(suspendTarget.personId)}?` : 'Suspend user'}
        confirmLabel="Suspend the account"
        message="Suspending blocks sign-in immediately. The account is not deleted: the row stays here marked suspended, every record they created keeps their name on it, and the suspension is written to the audit log."
      />
    </Screen>
  )
}
