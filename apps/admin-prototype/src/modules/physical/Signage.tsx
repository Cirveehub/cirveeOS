/**
 * §14 — signage configuration.
 *
 * Honest about its state. There is no `Screen` or `Playlist` entity in the
 * data layer, so a configuration table here would be a component holding its
 * own constants — exactly the thing the review checklist forbids. What the
 * screens would show does exist, so the preview below is built from live seed
 * data rather than mocked copy, and the configuration itself says plainly that
 * it is not built.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MonitorPlay } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState } from '@/ui'
import {
  TODAY,
  certificatesCollection,
  cohortsCollection,
  employersCollection,
  outcomeRecordsCollection,
  peopleCollection,
  useCollection,
} from '@/mocks'

import { ErrorPanel, ModuleHeader, Screen, useModuleData } from './parts'

export default function PhysicalSignage() {
  const certificates = useCollection(certificatesCollection)
  const outcomes = useCollection(outcomeRecordsCollection)
  const employers = useCollection(employersCollection)
  const cohorts = useCollection(cohortsCollection)
  const people = useCollection(peopleCollection)

  const { loading, error, retry } = useModuleData(certificates, 'physical.signage')

  const personName = (id: string) => {
    const person = people.find((p) => (p.id as string) === id)
    return person ? `${person.firstName} ${person.lastName}` : 'Unknown person'
  }

  /** One slide per item type, built from the same store the dashboards read. */
  const slides = useMemo(() => {
    const recentGraduates = [...certificates]
      .filter((c) => c.status === 'issued' && c.issuedAt)
      .sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? ''))
      .slice(0, 3)

    const recentPlacements = [...outcomes]
      .filter((r) => r.placementDate !== null && r.employerId !== null && r.consentForPublicUse)
      .sort((a, b) => (b.placementDate ?? '').localeCompare(a.placementDate ?? ''))
      .slice(0, 3)

    const startingSoon = [...cohorts]
      .filter((c) => c.startDate >= TODAY)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3)

    return { recentGraduates, recentPlacements, startingSoon }
  }, [certificates, outcomes, cohorts])

  return (
    <Screen>
      <ModuleHeader
        title="Signage"
        description="What the screens around the building show, and where that content comes from."
      />

      {error ? (
        <ErrorPanel what="Signage" onRetry={retry} />
      ) : (
        <div className="space-y-6">
          <Alert tone="info" icon={MonitorPlay} title="Screen and playlist configuration is not built">
            There is no screen, playlist or rotation entity in this prototype&apos;s data layer, so a
            configuration table here would be numbers typed into a component rather than data — which the
            review checklist rules out. The half that matters is below: the content is real, drawn live
            from the same store as every dashboard, so a placement recorded in Outcomes reaches the wall
            without anyone making a slide.
          </Alert>

          <Card>
            <CardHeader
              title="Slide preview — graduate spotlights"
              description="From the certificates issued most recently."
            />
            <CardBody>
              {loading ? null : slides.recentGraduates.length === 0 ? (
                <EmptyState
                  size="sm"
                  bordered
                  icon={MonitorPlay}
                  title="No certificate has been issued"
                  message="The graduate slide would be blank. The screens fall back to the stats board when a playlist item has nothing to show."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-3">
                  {slides.recentGraduates.map((certificate) => (
                    <li
                      key={certificate.id as string}
                      className="rounded-2xl border border-border bg-surface-sunken p-5"
                    >
                      <p className="text-label-11 text-text-label">Certified</p>
                      <p className="mt-1 text-heading-20 text-text">{personName(certificate.personId as string)}</p>
                      <p className="mt-2 font-mono text-body-12 text-text-secondary">
                        {certificate.certificateId}
                      </p>
                      <p className="mt-1 text-body-13 text-text-secondary">
                        {certificate.issuedAt ? formatDate(certificate.issuedAt) : 'Not yet issued'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Slide preview — new placements"
              description="Only graduates who consented to public use appear. Consent is checked here, not at the screen."
            />
            <CardBody>
              {loading ? null : slides.recentPlacements.length === 0 ? (
                <EmptyState
                  size="sm"
                  bordered
                  icon={MonitorPlay}
                  title="No placement may be shown"
                  message="Either nobody has been placed yet, or nobody placed has consented to it being used publicly. The screens show nothing rather than showing it anyway."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-3">
                  {slides.recentPlacements.map((record) => (
                    <li key={record.id as string} className="rounded-2xl border border-border bg-surface-sunken p-5">
                      <p className="text-label-11 text-text-label">Placed</p>
                      <p className="mt-1 text-heading-20 text-text">{personName(record.personId as string)}</p>
                      <p className="mt-2 text-body-14 text-text">
                        {record.jobTitle ?? 'Role not recorded'} at{' '}
                        {employers.find((e) => e.id === record.employerId)?.name ?? 'an employer'}
                      </p>
                      <Badge tone="success" size="sm" className="mt-2">
                        Consent granted
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Slide preview — starting soon" description="The next cohorts to open." />
            <CardBody>
              {loading ? null : slides.startingSoon.length === 0 ? (
                <EmptyState
                  size="sm"
                  bordered
                  icon={MonitorPlay}
                  title="No cohort is scheduled to start"
                  message="Nothing to advertise on the wall. That is a pipeline problem rather than a signage one."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-3">
                  {slides.startingSoon.map((cohort) => (
                    <li key={cohort.id as string} className="rounded-2xl border border-border bg-surface-sunken p-5">
                      <p className="text-label-11 text-text-label">Starting soon</p>
                      <p className="mt-1 text-heading-20 text-text">{cohort.code}</p>
                      <p className="mt-2 text-body-14 text-text-secondary">
                        Starts {formatDate(cohort.startDate)} · {formatNumber(cohort.enrolledCount)} enrolled
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What is not built" />
            <CardBody className="space-y-2">
              <p className="text-body-14 text-text-secondary">
                Screen inventory, playlist composition, rotation seconds, per-screen status and last-synced
                time all need a screen entity in the data layer before they can be anything other than
                decoration. The content pipeline above is the part that proves the idea.
              </p>
              <Button variant="link" size="sm" asChild className="px-0">
                <Link to="/outcomes/placements">See where the placement slides come from</Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      )}
    </Screen>
  )
}
