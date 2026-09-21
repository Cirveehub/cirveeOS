import { useParams } from 'react-router-dom'
import { CheckCircle2, ShieldAlert, ShieldQuestion } from 'lucide-react'

import { formatDate } from '@/lib/format'
import { Badge, Card, CardBody } from '@/ui'
import { branchesCollection, certificatesCollection, coursesCollection, peopleCollection } from '@/mocks'

export default function PublicVerify() {
  const { certificateId } = useParams<{ certificateId: string }>()
  const certificate = certificatesCollection
    .all()
    .find((c) => c.certificateId === certificateId && (c.status === 'issued' || c.status === 'revoked'))

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto w-full max-w-lg px-6 py-12">
        <header className="mb-8 text-center">
          <p className="text-label-11 text-text-label">Cirvee Academy</p>
          <h1 className="mt-1 text-heading-24 text-text">Certificate verification</h1>
        </header>

        {!certificate ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
              <ShieldQuestion size={40} className="text-text-muted" />
              <p className="text-body-15 font-bold text-text">No certificate found</p>
              <p className="text-body-13 text-text-secondary">
                {certificateId} does not match any certificate on record. Check the id and try again.
              </p>
            </CardBody>
          </Card>
        ) : (
          <VerifiedResult certificateId={certificate.certificateId} personId={certificate.personId} courseId={certificate.courseId} issuingBranchId={certificate.issuingBranchId} issuedAt={certificate.issuedAt} status={certificate.status} />
        )}
      </div>
    </div>
  )
}

function VerifiedResult({
  certificateId,
  personId,
  courseId,
  issuingBranchId,
  issuedAt,
  status,
}: {
  certificateId: string
  personId: string
  courseId: string
  issuingBranchId: string
  issuedAt: string | null
  status: string
}) {
  const person = peopleCollection.find(personId)
  const course = coursesCollection.find(courseId)
  const branch = branchesCollection.find(issuingBranchId)
  const revoked = status === 'revoked'

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-6 py-8 text-center">
        <div
          className={
            revoked
              ? 'grid size-14 place-items-center rounded-full bg-danger-fill text-danger-ink'
              : 'grid size-14 place-items-center rounded-full bg-success-fill text-success-ink'
          }
        >
          {revoked ? <ShieldAlert size={26} /> : <CheckCircle2 size={26} />}
        </div>

        <div>
          <Badge tone={revoked ? 'danger' : 'success'} variant="subtle">
            {revoked ? 'Revoked' : 'Valid certificate'}
          </Badge>
          <p className="mt-3 text-heading-20 text-text">
            {person ? `${person.firstName} ${person.lastName}` : 'Unknown holder'}
          </p>
          <p className="text-body-14 text-text-secondary">{course?.title ?? 'Unknown course'}</p>
        </div>

        <dl className="grid w-full grid-cols-2 gap-4 border-t border-border pt-6 text-left">
          <div>
            <dt className="text-label-10 text-text-label">Certificate ID</dt>
            <dd className="mt-1 font-mono text-body-13 text-text">{certificateId}</dd>
          </div>
          <div>
            <dt className="text-label-10 text-text-label">Issued</dt>
            <dd className="mt-1 text-body-13 text-text">{issuedAt ? formatDate(issuedAt) : '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-label-10 text-text-label">Issuing branch</dt>
            <dd className="mt-1 text-body-13 text-text">{branch?.name ?? '—'}</dd>
          </div>
        </dl>

        <QrPattern payload={`/public/verify/${certificateId}`} />

        <p className="text-body-12 text-text-secondary">
          This page confirms only that Cirvee Academy issued this certificate to this person for this course. No
          other detail about the holder's record is shown here.
        </p>
      </CardBody>
    </Card>
  )
}

function QrPattern({ payload }: { payload: string }) {
  const size = 21
  let hash = 2166136261
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7
    return inBox(0, 0) || inBox(0, size - 7) || inBox(size - 7, 0)
  }
  const finderOn = (r: number, c: number) => {
    const lr = r < 7 ? r : r - (size - 7)
    const lc = c < 7 ? c : c - (size - 7)
    const ring = Math.max(Math.abs(lr - 3), Math.abs(lc - 3))
    return ring === 3 || ring <= 1
  }
  const cells: boolean[] = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c)) cells.push(finderOn(r, c))
      else cells.push(((Math.imul(hash ^ (r * 31 + c * 17), 2654435761) >>> 0) & 0x40) !== 0)
    }
  }
  return (
    <div
      role="img"
      aria-label={`QR pattern encoding ${payload}`}
      className="grid gap-px rounded-xl border border-border bg-surface p-3"
      style={{ gridTemplateColumns: `repeat(${size}, 8px)` }}
    >
      {cells.map((on, i) => (
        <span key={i} className={on ? 'size-2 bg-text' : 'size-2 bg-surface'} />
      ))}
    </div>
  )
}
