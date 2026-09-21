import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, FileStack, Plus, Save } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  Textarea,
  type Column,
} from '@/ui'
import {
  documentTemplatesCollection,
  generatedDocumentsCollection,
  peopleCollection,
  useCollection,
  useRecord,
} from '@/mocks'
import type { DocumentTemplate } from '@/mocks'
import { templateId as asTemplateId } from '@/mocks/types'
import { formatDate, humanize } from '@/lib/format'
import { useActingUser, useScreenState, userName, WorkGroupTabs } from './shared'
import { writeAudit } from './engine'

interface MergeField {
  path: string
  label: string
  group: string
}

const MERGE_FIELDS: MergeField[] = [
  { path: 'person.firstName', label: 'First name', group: 'Person' },
  { path: 'person.lastName', label: 'Last name', group: 'Person' },
  { path: 'person.fullName', label: 'Full name', group: 'Person' },
  { path: 'person.email', label: 'Email', group: 'Person' },
  { path: 'person.phone', label: 'Phone', group: 'Person' },
  { path: 'admission.ref', label: 'Admission ref', group: 'Admission' },
  { path: 'admission.netFee | naira', label: 'Net fee (naira)', group: 'Admission' },
  { path: 'admission.quotedFee | naira', label: 'Quoted fee (naira)', group: 'Admission' },
  { path: 'course.title', label: 'Course title', group: 'Course' },
  { path: 'cohort.code', label: 'Cohort code', group: 'Course' },
  { path: 'cohort.startDate | date', label: 'Cohort start date', group: 'Course' },
  { path: 'employee.jobTitle', label: 'Job title', group: 'Employee' },
  { path: 'employee.startDate | date', label: 'Start date', group: 'Employee' },
  { path: 'offer.gross | naira', label: 'Gross salary', group: 'Employee' },
  { path: 'organisation.name', label: 'Organisation name', group: 'Organisation' },
  { path: 'invoice.ref', label: 'Invoice ref', group: 'Invoice' },
  { path: 'invoice.total | naira', label: 'Invoice total', group: 'Invoice' },
  { path: 'invoice.dueDate | date', label: 'Invoice due date', group: 'Invoice' },
  { path: 'certificate.id', label: 'Certificate id', group: 'Certificate' },
  { path: 'certificate.issuedAt | date', label: 'Issued at', group: 'Certificate' },
  { path: 'branch.name', label: 'Branch name', group: 'Branch' },
]

function sampleValues(personLabel: string, personFirst: string, personLast: string): Record<string, string> {
  return {
    'person.firstName': personFirst,
    'person.lastName': personLast,
    'person.fullName': personLabel,
    'course.title': 'Data Analysis',
    'cohort.code': 'DA-C13',
    'cohort.startDate': '5 October 2026',
    'certificate.issuedAt': '20 September 2026',
    'certificate.id': 'CIR-CERT-2026-0419',
    'branch.name': 'Ibadan HQ',
    'invoice.ref': 'INV-2026-0933',
    'invoice.total': '₦405,000.00',
    'invoice.dueDate': '30 September 2026',
    'payment.ref': 'PAY-2026-1243',
    'payment.amount': '₦205,000.00',
    'payment.payerName': personLabel,
    'invoice.balance': '₦0.00',
    'admission.ref': 'ADM-2026-0187',
    'admission.netFee': '₦405,000.00',
  }
}

const TOKEN = /\{\{\s*([a-zA-Z.]+)(\s*\|\s*[a-z]+)?\s*\}\}/g

function renderPreview(body: string, values: Record<string, string>): { html: string; unresolved: string[] } {
  const unresolved: string[] = []
  const html = body.replace(TOKEN, (_match, path: string) => {
    const value = values[path]
    if (value === undefined) {
      unresolved.push(path)
      return `<span class="rounded-sm bg-danger-fill px-1 text-danger-ink">{{${path}}}</span>`
    }
    return `<span class="rounded-sm bg-accent-subtle px-1 text-accent">${value}</span>`
  })
  return { html, unresolved }
}

export function TemplateList() {
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')
  const navigate = useNavigate()
  const templates = useCollection(documentTemplatesCollection)
  const q = params.get('q') ?? ''

  const filtered = templates.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()))

  const columns: Array<Column<DocumentTemplate>> = [
    { key: 'name', header: 'Template', minWidth: 240, accessor: (t) => t.name, sortable: true },
    { key: 'type', header: 'Type', width: 150, accessor: (t) => humanize(t.type), sortable: true },
    { key: 'version', header: 'Version', width: 90, accessor: (t) => `v${t.version}`, sortValue: (t) => t.version, sortable: true },
    { key: 'fields', header: 'Merge fields', width: 130, align: 'right', accessor: (t) => t.mergeFields.length, sortable: true },
    { key: 'editedBy', header: 'Last edited by', width: 170, accessor: (t) => userName(t.updatedBy), sortable: true },
    { key: 'edited', header: 'Last edited', width: 130, accessor: (t) => formatDate(t.updatedAt), sortValue: (t) => t.updatedAt, sortable: true },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      cell: (t) => <StatusBadge status={t.status} size="sm" />,
      sortValue: (t) => t.status,
      sortable: true,
    },
    {
      key: 'generated',
      header: 'Documents generated',
      width: 170,
      align: 'right',
      accessor: (t) => t.documentsGenerated,
      sortable: true,
    },
  ]

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Document templates"
        description="Merge fields, versions and a live preview. Editing a template that has generated documents creates a new version rather than rewriting history."
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'Templates' }]}
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => toast('Not built in this prototype — this would start a blank template.')}>
            New template
          </Button>
        }
      />

      <WorkGroupTabs group="documents" active="templates" />

      <div className="mt-6 max-w-xs">
        <SearchInput
          value={q}
          onChange={(v) => {
            const next = new URLSearchParams(params)
            if (v) next.set('q', v)
            else next.delete('q')
            setParams(next, { replace: true })
          }}
          placeholder="Search templates"
        />
      </div>

      {loading ? (
        <Card className="mt-4">
          <CardBody className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={40} rounded="lg" />
            ))}
          </CardBody>
        </Card>
      ) : error ? (
        <Card className="mt-4">
          <CardBody>
            <EmptyState variant="error" title="Could not load templates" message={error} action={<Button onClick={retry}>Retry</Button>} />
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardBody padding="none">
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(t) => t.id as string}
              caption="Document templates with version and usage"
              onRowClick={(t) => navigate(`/work/templates/${t.id}`)}
              emptyTitle="No templates yet."
              emptyMessage="Nothing can be generated until a template exists — no offer letters, no certificates, no receipts."
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}

export function TemplateEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const acting = useActingUser()

  const template = useRecord(documentTemplatesCollection, id)
  const people = useCollection(peopleCollection)

  const [body, setBody] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [letterhead, setLetterhead] = useState<boolean | null>(null)
  const [sampleId, setSampleId] = useState('')
  const [fieldQuery, setFieldQuery] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)

  const samples = useMemo(() => people.slice(0, 25), [people])
  const sample = samples.find((p) => p.id === sampleId) ?? samples[0]

  if (!template) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          variant="error"
          title="That template does not exist"
          message="It may have been archived in a different demo session."
          action={
            <Button leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/work/templates')}>
              Back to templates
            </Button>
          }
        />
      </div>
    )
  }

  const currentBody = body ?? template.bodyHtml
  const currentName = name ?? template.name
  const currentLetterhead = letterhead ?? template.letterhead
  const dirty = body !== null || name !== null || letterhead !== null

  const values = sample
    ? sampleValues(`${sample.firstName} ${sample.lastName}`, sample.firstName, sample.lastName)
    : {}
  const preview = renderPreview(currentBody, values)

  const grouped = MERGE_FIELDS.filter(
    (f) => !fieldQuery || f.label.toLowerCase().includes(fieldQuery.toLowerCase()) || f.path.includes(fieldQuery),
  ).reduce<Record<string, MergeField[]>>((acc, field) => {
    acc[field.group] = [...(acc[field.group] ?? []), field]
    return acc
  }, {})

  const insert = (path: string) => {
    setBody(`${currentBody}{{${path}}}`)
  }

  const save = () => {
    const now = new Date().toISOString()
    const usedFields = [...currentBody.matchAll(TOKEN)].map((m) => m[1])

    if (template.documentsGenerated > 0) {
      const version = template.version + 1
      const next: DocumentTemplate = {
        ...template,
        id: asTemplateId(`template-${template.type}-v${version}-${Math.random().toString(36).slice(2, 6)}`),
        version,
        name: currentName,
        bodyHtml: currentBody,
        letterhead: currentLetterhead,
        mergeFields: [...new Set(usedFields)],
        status: 'active',
        documentsGenerated: 0,
        createdAt: now,
        createdBy: acting,
        updatedAt: now,
        updatedBy: acting,
      }
      documentTemplatesCollection.update(template.id, { status: 'archived', updatedAt: now, updatedBy: acting })
      documentTemplatesCollection.insert(next)
      writeAudit({
        actorUserId: acting,
        action: 'template.version',
        entityType: 'DocumentTemplate',
        entityId: next.id as string,
        entityRef: next.name,
        field: 'version',
        before: `v${template.version}`,
        after: `v${version}`,
      })
      toast.success(`Saved as v${version}. The ${template.documentsGenerated} documents already generated keep v${template.version}.`)
      setSaveOpen(false)
      setBody(null)
      setName(null)
      setLetterhead(null)
      navigate(`/work/templates/${next.id}`)
      return
    }

    documentTemplatesCollection.update(template.id, {
      name: currentName,
      bodyHtml: currentBody,
      letterhead: currentLetterhead,
      mergeFields: [...new Set(usedFields)],
      updatedAt: now,
      updatedBy: acting,
    })
    writeAudit({
      actorUserId: acting,
      action: 'template.edit',
      entityType: 'DocumentTemplate',
      entityId: template.id as string,
      entityRef: currentName,
      field: 'bodyHtml',
      before: `${template.bodyHtml.length} characters`,
      after: `${currentBody.length} characters`,
    })
    setBody(null)
    setName(null)
    setLetterhead(null)
    setSaveOpen(false)
    toast.success('Template saved. No documents had been generated under it, so no new version was needed.')
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={currentName}
        description={`${humanize(template.type)} · v${template.version} · ${template.documentsGenerated} documents generated`}
        breadcrumbs={[
          { label: 'Work', to: '/work' },
          { label: 'Templates', to: '/work/templates' },
          { label: template.name },
        ]}
        meta={<StatusBadge status={template.status} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => toast('Not built in this prototype — this would generate a test document from the current draft.')}
            >
              Generate test document
            </Button>
            <Button leftIcon={<Save size={16} />} onClick={() => setSaveOpen(true)} disabled={!dirty}>
              Save
            </Button>
          </div>
        }
      />

      <WorkGroupTabs group="documents" active="templates" />

      {preview.unresolved.length > 0 && (
        <Alert tone="warning" title="Unresolved merge fields" className="mt-6">
          {preview.unresolved.join(', ')} did not resolve against this sample record. They are highlighted in the
          preview.
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Merge fields" bare />
          <CardBody className="space-y-3">
            <SearchInput value={fieldQuery} onChange={setFieldQuery} placeholder="Search fields" inputSize="sm" />
            <div className="max-h-[28rem] space-y-3 overflow-y-auto">
              {Object.entries(grouped).map(([group, fields]) => (
                <div key={group}>
                  <p className="text-label-11 text-text-label">{group}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {fields.map((field) => (
                      <button
                        key={field.path}
                        type="button"
                        onClick={() => insert(field.path)}
                        className="rounded-full border border-border bg-surface-sunken px-2 py-1 text-body-12 text-text-label transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <p className="text-body-13 text-text-secondary">No merge field matches that search.</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Body" description="Merge fields insert as tokens. They resolve in the preview beside this." />
          <CardBody className="space-y-3">
            <Field label="Template name" required>
              <Input value={currentName} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Body">
              <Textarea rows={16} value={currentBody} onChange={(event) => setBody(event.target.value)} />
            </Field>
            <Switch
              checked={currentLetterhead}
              onChange={setLetterhead}
              label="Letterhead"
              description="Prints the Cirvee header block above the body."
            />
            <div>
              <p className="text-label-11 text-text-label">Signature blocks</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {template.signatureBlocks.length === 0 ? (
                  <span className="text-body-13 text-text-secondary">None — this document is not signed.</span>
                ) : (
                  template.signatureBlocks.map((block) => (
                    <Badge key={block.role} tone="neutral" size="sm">
                      {block.label}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardBody>
          <CardFooter align="start">
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setBody(null)
                  setName(null)
                  setLetterhead(null)
                }}
              >
                Discard changes
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader
            title="Preview"
            description="Rendered against a real seeded record. Unresolved fields show in the danger tone."
            actions={<Badge tone="accent" size="sm">Live</Badge>}
          />
          <CardBody className="space-y-3">
            <Field label="Sample record">
              <Select
                selectSize="sm"
                value={sample?.id ?? ''}
                onChange={(event) => setSampleId(event.target.value)}
                options={samples.map((p) => ({ value: p.id as string, label: `${p.firstName} ${p.lastName}` }))}
              />
            </Field>
            <div className="rounded-xl border border-border bg-surface-sunken p-4">
              {currentLetterhead && (
                <p className="mb-3 border-b border-border pb-2 text-label-11 text-text-label">
                  Cirvee Technologies Limited · Ibadan
                </p>
              )}
              <div
                className="space-y-2 text-body-14 text-text [&_h1]:text-heading-20 [&_h2]:text-heading-18 [&_p]:text-body-14"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={template.documentsGenerated > 0 ? 'Save as a new version' : 'Save template'}
        description={
          template.documentsGenerated > 0
            ? `${template.documentsGenerated} documents were generated under v${template.version}. Those documents keep the version they were generated from — this saves a new one instead of rewriting them.`
            : 'No documents have been generated under this template yet, so it can be edited in place.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} leftIcon={<FileStack size={16} />}>
              {template.documentsGenerated > 0 ? `Save as v${template.version + 1}` : 'Save'}
            </Button>
          </>
        }
      >
        <p className="text-body-14 text-text">
          {template.documentsGenerated > 0
            ? `v${template.version} is archived and stays readable. Every existing document still names v${template.version} as the version it was generated under.`
            : 'The template is updated in place and the change is written to the audit log.'}
        </p>
      </Modal>
    </div>
  )
}
