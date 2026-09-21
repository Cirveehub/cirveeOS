import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  ProgressBar,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { rolesCollection, useCollection, usersCollection } from '@/mocks'
import type { PermissionAction, PermissionScope, Role } from '@/mocks'

import { DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, percent, useModuleData } from './parts'

const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'assign', 'export', 'manage']

const SCOPE_RANK: Record<PermissionScope, number> = {
  none: 0,
  own: 1,
  team: 2,
  department: 3,
  branch: 4,
  organisation: 5,
}

/** How much of the matrix a role actually grants, 0–100. The breadth score. */
function breadth(role: Role): number {
  const cells = Object.values(role.permissions).flatMap((actions) => ACTIONS.map((a) => actions[a]))
  if (cells.length === 0) return 0
  const granted = cells.reduce((acc, scope) => acc + SCOPE_RANK[scope], 0)
  return percent(granted, cells.length * SCOPE_RANK.organisation)
}

function grantedCells(role: Role): number {
  return Object.values(role.permissions)
    .flatMap((actions) => ACTIONS.map((a) => actions[a]))
    .filter((scope) => scope !== 'none').length
}

export default function Roles() {
  const navigate = useNavigate()
  const roles = useCollection(rolesCollection)
  const users = useCollection(usersCollection)
  const state = useModuleData(roles, 'settings.roles')

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const holders = useMemo(() => {
    const map = new Map<string, number>()
    for (const user of users) {
      for (const roleId of user.roleIds) map.set(roleId, (map.get(roleId) ?? 0) + 1)
    }
    return map
  }, [users])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return state.rows
      .filter((role) => {
        if (filters.type && role.type !== filters.type) return false
        if (filters.held === 'held' && (holders.get(role.id) ?? 0) === 0) return false
        if (filters.held === 'vacant' && (holders.get(role.id) ?? 0) > 0) return false
        if (!term) return true
        return role.name.toLowerCase().includes(term) || role.description.toLowerCase().includes(term)
      })
      .sort((a, b) => breadth(b) - breadth(a))
  }, [state.rows, filters, search, holders])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<Role>> = [
    {
      key: 'name',
      header: 'Role',
      pinned: true,
      minWidth: 240,
      cell: (role) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 text-text">{role.name}</div>
          <div className="truncate text-body-12 text-text-secondary">{role.description}</div>
        </div>
      ),
      sortValue: (role) => role.name,
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 120,
      cell: (role) => (
        <Badge tone={role.type === 'system' ? 'neutral' : 'accent'} size="sm">
          {role.type === 'system' ? 'System' : 'Custom'}
        </Badge>
      ),
      sortValue: (role) => role.type,
      sortable: true,
    },
    {
      key: 'holders',
      header: 'Users holding it',
      align: 'right',
      width: 152,
      accessor: (role) => {
        const count = holders.get(role.id) ?? 0
        return count === 0 ? (
          <span className="text-text-secondary">Nobody</span>
        ) : (
          <span className="tabular-nums">{formatNumber(count)}</span>
        )
      },
      sortValue: (role) => holders.get(role.id) ?? 0,
      sortable: true,
    },
    {
      key: 'granted',
      header: 'Cells granted',
      align: 'right',
      width: 136,
      accessor: (role) => <span className="tabular-nums">{formatNumber(grantedCells(role))}</span>,
      sortValue: (role) => grantedCells(role),
      sortable: true,
    },
    {
      key: 'breadth',
      header: 'Breadth',
      minWidth: 200,
      cell: (role) => {
        const score = breadth(role)
        return (
          <ProgressBar
            value={score}
            tone={score > 70 ? 'danger' : score > 40 ? 'warning' : 'accent'}
            size="sm"
            valueLabel={`${score}%`}
            aria-label={`Permission breadth for ${role.name}`}
          />
        )
      },
      sortValue: (role) => breadth(role),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      cell: (role) =>
        role.archivedAt ? (
          <Badge tone="warning" size="sm">
            Archived
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            Active
          </Badge>
        ),
      sortValue: (role) => (role.archivedAt ? 'archived' : 'active'),
      sortable: true,
    },
  ]

  const header = (
    <ModuleHeader
      title="Roles and permissions"
      description={`${formatNumber(roles.length)} roles. Breadth is how much of the matrix a role grants, weighted by scope — the fastest way to spot one that has quietly grown.`}
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="Roles" onRetry={state.retry} />
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
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search roles by name or description"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                {
                  key: 'type',
                  label: 'Type',
                  options: [
                    { value: 'system', label: 'System' },
                    { value: 'custom', label: 'Custom' },
                  ],
                },
                {
                  key: 'held',
                  label: 'Held by',
                  options: [
                    { value: 'held', label: 'At least one user' },
                    { value: 'vacant', label: 'Nobody' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(role) => role.id}
            onRowClick={(role) => navigate(`/settings/roles/${role.id}`)}
            density="compact"
            bordered={false}
            minWidth={1080}
            caption="Roles with type, holder count, granted cells and permission breadth"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No roles match these filters"
                  message="Try another type, or clear the search."
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
                  icon={ShieldCheck}
                  title="No roles defined"
                  message="Without a role nobody can be granted anything, so nobody can use the system. At least one role has to exist before the first user is invited."
                />
              )
            }
          />
        </CardBody>
      </Card>
    </Screen>
  )
}
