import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  type Column,
} from '@/ui'
import {
  branchesCollection,
  departmentsCollection,
  employeesCollection,
  teamsCollection,
  useCollection,
} from '@/mocks'
import type { Department, Team } from '@/mocks'

import {
  DashboardSkeleton,
  ErrorPanel,
  ModuleHeader,
  Screen,
  useEmployeeName,
  useModuleData,
} from './parts'

export default function Departments() {
  const departments = useCollection(departmentsCollection)
  const teams = useCollection(teamsCollection)
  const employees = useCollection(employeesCollection)
  const branches = useCollection(branchesCollection)
  const employeeName = useEmployeeName()
  const state = useModuleData(departments, 'settings.departments')

  const [expanded, setExpanded] = useState<string[]>([])

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? 'Unassigned'

  const headcount = useMemo(() => {
    const map = new Map<string, number>()
    for (const employee of employees) {
      if (employee.status === 'exited') continue
      map.set(employee.departmentId, (map.get(employee.departmentId) ?? 0) + 1)
    }
    return map
  }, [employees])

  const teamsByDepartment = useMemo(() => {
    const map = new Map<string, Team[]>()
    for (const team of teams) {
      map.set(team.departmentId, [...(map.get(team.departmentId) ?? []), team])
    }
    return map
  }, [teams])

  const toggle = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]))

  const teamColumns: Array<Column<Team>> = [
    { key: 'name', header: 'Team', minWidth: 220, accessor: (team) => team.name, sortValue: (team) => team.name, sortable: true },
    {
      key: 'lead',
      header: 'Lead',
      minWidth: 200,
      accessor: (team) => employeeName(team.leadId),
      sortValue: (team) => employeeName(team.leadId),
      sortable: true,
    },
    {
      key: 'members',
      header: 'Members',
      align: 'right',
      width: 116,
      accessor: (team) => <span className="tabular-nums">{formatNumber(team.memberIds.length)}</span>,
      sortValue: (team) => team.memberIds.length,
      sortable: true,
    },
    {
      key: 'roster',
      header: 'Roster',
      minWidth: 380,
      accessor: (team) =>
        team.memberIds.length === 0 ? (
          <span className="text-text-secondary">Nobody assigned</span>
        ) : (
          team.memberIds.map((id) => employeeName(id)).join(' · ')
        ),
      sortValue: (team) => team.memberIds.length,
    },
  ]

  const columns: Array<Column<Department>> = [
    {
      key: 'expand',
      header: '',
      width: 48,
      cell: (department) => {
        const count = teamsByDepartment.get(department.id)?.length ?? 0
        const isOpen = expanded.includes(department.id)
        return (
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            disabled={count === 0}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Hide teams in ${department.name}` : `Show teams in ${department.name}`}
            onClick={(event) => {
              event.stopPropagation()
              toggle(department.id)
            }}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </Button>
        )
      },
    },
    {
      key: 'name',
      header: 'Department',
      pinned: true,
      minWidth: 220,
      accessor: (department) => department.name,
      sortValue: (department) => department.name,
      sortable: true,
    },
    {
      key: 'head',
      header: 'Head',
      minWidth: 200,
      accessor: (department) => employeeName(department.headId),
      sortValue: (department) => employeeName(department.headId),
      sortable: true,
    },
    {
      key: 'branch',
      header: 'Branch',
      width: 160,
      accessor: (department) => branchName(department.branchId),
      sortValue: (department) => branchName(department.branchId),
      sortable: true,
    },
    {
      key: 'headcount',
      header: 'Headcount',
      align: 'right',
      width: 120,
      accessor: (department) => <span className="tabular-nums">{formatNumber(headcount.get(department.id) ?? 0)}</span>,
      sortValue: (department) => headcount.get(department.id) ?? 0,
      sortable: true,
    },
    {
      key: 'teams',
      header: 'Teams',
      minWidth: 260,
      cell: (department) => {
        const list = teamsByDepartment.get(department.id) ?? []
        if (list.length === 0) return <span className="text-body-13 text-text-secondary">No teams</span>
        return (
          <div className="flex flex-wrap gap-1">
            {list.map((team) => (
              <Badge key={team.id} tone="neutral" size="sm">
                {team.name}
              </Badge>
            ))}
          </div>
        )
      },
      sortValue: (department) => teamsByDepartment.get(department.id)?.length ?? 0,
      sortable: true,
    },
  ]

  const header = (
    <ModuleHeader
      title="Departments and teams"
      description="The structure the team and department permission scopes resolve against. Expand a department to see its teams and who is on them."
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="Departments" onRetry={state.retry} />
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

  if (state.rows.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={Users}
          title="No departments yet"
          message="Permission scopes of department and team have nothing to resolve against until a structure exists, so those scopes behave as no access."
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}

      <div className="space-y-3">
        {state.rows.map((department) => {
          const isOpen = expanded.includes(department.id)
          const list = teamsByDepartment.get(department.id) ?? []
          return (
            <Card key={department.id} padding="none">
              <CardBody padding="none">
                <DataTable
                  data={[department]}
                  columns={columns}
                  rowKey={(row) => row.id}
                  density="compact"
                  bordered={false}
                  minWidth={1080}
                  onRowClick={() => list.length > 0 && toggle(department.id)}
                  caption={`${department.name} — head, branch, headcount and teams`}
                />
                {isOpen && list.length > 0 && (
                  <div className="border-t border-border bg-surface-sunken px-4 py-3">
                    <p className="mb-2 text-label-11 text-text-label">
                      Teams in {department.name} · {formatNumber(list.length)}
                    </p>
                    <DataTable
                      data={list}
                      columns={teamColumns}
                      rowKey={(team) => team.id}
                      density="compact"
                      bordered={false}
                      minWidth={940}
                      caption={`Teams in ${department.name} with lead and roster`}
                      empty={
                        <EmptyState
                          size="sm"
                          title="No teams in this department"
                          message="A team scope resolves to nothing here, so a team-scoped permission grants no access."
                        />
                      }
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>
    </Screen>
  )
}
