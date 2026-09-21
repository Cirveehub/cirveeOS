import { AlertCircle } from 'lucide-react'

import {
  branchesCollection,
  departmentsCollection,
  peopleCollection,
  unitsCollection,
  useCollection,
  TODAY,
} from '@/mocks'
import { formatDate, formatNumber, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValue,
  KeyValueList,
  StatusBadge,
} from '@/ui'

import { MyPageHeader, NoEmploymentRecord, Page, leaveLabel, useMe } from './shared'
import { managerOf } from './writes'

function yearsSince(date: string): number {
  return (Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / (365.25 * 86_400_000)
}

export default function MyProfile() {
  const me = useMe()
  const departments = useCollection(departmentsCollection)
  const branches = useCollection(branchesCollection)
  const units = useCollection(unitsCollection)
  useCollection(peopleCollection)

  const employee = me.employee
  const person = me.personId ? peopleCollection.find(me.personId) : undefined

  if (!employee) {
    return (
      <Page>
        <MyPageHeader title="My profile" description="What the organisation holds about you." />
        <NoEmploymentRecord what="Your employment profile" />
      </Page>
    )
  }

  const department = departments.find((d) => d.id === employee.departmentId)?.name ?? '—'
  const branch = branches.find((b) => b.id === employee.branchId)?.name ?? '—'
  const unit = units.find((u) => u.id === employee.unitId)?.name ?? '—'

  return (
    <Page>
      <MyPageHeader
        title="My profile"
        description="What the organisation holds about you. If something here is wrong, HR is who corrects it."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Employment" description="Your record as payroll and HR see it." />
          <CardBody>
            <KeyValueList columns={2}>
              <KeyValue label="Employee ID">
                <span className="font-mono text-body-13">{employee.employeeId}</span>
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge status={employee.status} />
              </KeyValue>
              <KeyValue label="Job title">{employee.jobTitle}</KeyValue>
              <KeyValue label="Employment type">{humanize(employee.employmentType)}</KeyValue>
              <KeyValue label="Department">{department}</KeyValue>
              <KeyValue label="Business unit">{unit}</KeyValue>
              <KeyValue label="Branch">{branch}</KeyValue>
              <KeyValue label="Manager">{managerOf(employee)}</KeyValue>
              <KeyValue label="Started" hint={`${yearsSince(employee.startDate).toFixed(1)} years ago`}>
                {formatDate(employee.startDate)}
              </KeyValue>
              <KeyValue label="Probation">
                {employee.probationEndsAt
                  ? `${formatDate(employee.probationEndsAt)}${employee.probationOutcome ? ` · ${humanize(employee.probationOutcome)}` : ' · no outcome recorded'}`
                  : 'Not on probation'}
              </KeyValue>
            </KeyValueList>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Contact" description="How the organisation reaches you." />
          <CardBody>
            <KeyValueList>
              <KeyValue label="Name">{me.displayName}</KeyValue>
              <KeyValue label="Email">{person?.email ?? 'Not on file'}</KeyValue>
              <KeyValue label="Phone">{person?.phone ?? 'Not on file'}</KeyValue>
              <KeyValue label="Location">
                {person ? `${person.city}, ${person.state}` : 'Not on file'}
              </KeyValue>
            </KeyValueList>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Leave entitlement" description="What you are allocated, and what is left." />
          <CardBody>
            {employee.leaveBalances.length === 0 ? (
              <EmptyState size="sm" bordered title="No entitlement on record" message="HR allocates this." />
            ) : (
              <KeyValueList columns={2}>
                {employee.leaveBalances.map((balance) => (
                  <KeyValue
                    key={balance.type}
                    label={leaveLabel(balance.type)}
                    hint={`${formatNumber(balance.taken)} of ${formatNumber(balance.entitled)} taken`}
                  >
                    {`${formatNumber(balance.remaining)} days left`}
                  </KeyValue>
                ))}
              </KeyValueList>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pay and bank"
            description="Where your salary is sent. Only the last four digits are ever stored."
          />
          <CardBody>
            {employee.bankDetails ? (
              <KeyValueList columns={2}>
                <KeyValue label="Bank">{employee.bankDetails.bankName}</KeyValue>
                <KeyValue label="Account">{`•••• ${employee.bankDetails.accountLast4}`}</KeyValue>
              </KeyValueList>
            ) : (
              <Alert tone="warning" icon={AlertCircle} title="No bank details on file">
                Payroll cannot pay an account it does not have. Give HR your details before the next
                period closes.
              </Alert>
            )}
          </CardBody>
        </Card>
      </div>

      {employee.disciplinaryRecords.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="On your record"
            description="Formal notes held against your employment. You can see what was written about you."
          />
          <CardBody>
            <ul className="flex flex-col gap-2">
              {employee.disciplinaryRecords.map((record) => (
                <li key={record.id} className="rounded-xl border border-border px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-body-13 font-medium text-text">{record.category}</span>
                    <Badge tone="neutral" size="sm">
                      {formatDate(record.date)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-body-13 text-text-secondary">{record.summary}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </Page>
  )
}
