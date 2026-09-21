import { useEffect, useMemo, useState } from 'react'
import { FileText, Link2, Upload } from 'lucide-react'

import { Alert, Badge, Button, Field, Input, Modal, Select, Textarea } from '@/ui'
import {
  courseModulesCollection,
  lessonsCollection,
  useCollection,
  type ContentFormat,
  type Course,
  type CourseModuleId,
  type LessonId,
  type UserId,
} from '@/mocks'

import { uploadMaterial, type UploadMaterialResult } from './writes'

const FORMAT_OPTIONS: Array<{ value: ContentFormat; label: string }> = [
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'pdf', label: 'Slides / PDF' },
  { value: 'transcript', label: 'Transcript' },
]

const NEW_LESSON = '__new__'

export default function MaterialModal({
  open,
  onClose,
  course,
  initialLessonId,
  initialFormat,
  actorUserId,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  course: Course
  initialLessonId: LessonId | null
  initialFormat: ContentFormat | null
  actorUserId: UserId
  onUploaded: (result: UploadMaterialResult) => void
}) {
  const lessons = useCollection(lessonsCollection)
  const modules = useCollection(courseModulesCollection)

  const courseModules = useMemo(
    () => modules.filter((m) => m.courseId === course.id).sort((a, b) => a.sequence - b.sequence),
    [modules, course.id],
  )
  const courseLessons = useMemo(
    () => lessons.filter((l) => l.courseId === course.id).sort((a, b) => a.sequence - b.sequence),
    [lessons, course.id],
  )

  const [step, setStep] = useState<1 | 2>(1)
  const [lessonChoice, setLessonChoice] = useState<string>('')
  const [moduleId, setModuleId] = useState<string>('')
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [format, setFormat] = useState<ContentFormat>('video')
  const [durationMinutes, setDurationMinutes] = useState('18')
  const [fileName, setFileName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [transcriptBody, setTranscriptBody] = useState('')
  const [touched, setTouched] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setLessonChoice(initialLessonId ?? courseLessons[0]?.id ?? NEW_LESSON)
    setModuleId(courseModules[0]?.id ?? '')
    setNewLessonTitle('')
    setFormat(initialFormat ?? 'video')
    setDurationMinutes('18')
    setFileName('')
    setSourceUrl('')
    setTranscriptBody('')
    setTouched(false)
    setFailure(null)
  }, [open, initialLessonId, initialFormat, courseLessons, courseModules])

  const creatingLesson = lessonChoice === NEW_LESSON
  const chosenLesson = creatingLesson ? undefined : courseLessons.find((l) => l.id === lessonChoice)
  const alreadyHasFormat = chosenLesson ? chosenLesson.formats[format] !== undefined : false

  const lessonTitleError =
    touched && creatingLesson && !newLessonTitle.trim() ? 'A new lesson needs a title.' : undefined
  const moduleError = touched && creatingLesson && !moduleId ? 'Pick the module it belongs to.' : undefined
  const step1Valid = creatingLesson ? Boolean(newLessonTitle.trim() && moduleId) : Boolean(chosenLesson)

  const sourceError =
    touched && step === 2 && !fileName.trim() && !sourceUrl.trim()
      ? 'Give a file name or paste a URL.'
      : undefined

  function next() {
    setTouched(true)
    if (!step1Valid) return
    setTouched(false)
    setStep(2)
  }

  function upload() {
    setTouched(true)
    setFailure(null)
    if (!fileName.trim() && !sourceUrl.trim()) return

    try {
      const result = uploadMaterial({
        courseId: course.id,
        lessonId: creatingLesson ? null : (lessonChoice as LessonId),
        moduleId: creatingLesson ? (moduleId as CourseModuleId) : null,
        newLessonTitle: creatingLesson ? newLessonTitle : undefined,
        format,
        fileName: fileName.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        durationMinutes: Number(durationMinutes) || 1,
        transcriptBody: format === 'transcript' ? transcriptBody : undefined,
        actorUserId,
      })
      onUploaded(result)
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The material was not uploaded.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={step === 1 ? 'Upload material' : 'File or URL'}
      description={
        step === 1
          ? `Where in ${course.title} this belongs, and which format it is.`
          : 'No files are stored in this prototype — the name, size and duration are recorded.'
      }
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={next}>Continue</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={upload}>Attach material</Button>
          </>
        )
      }
    >
      {failure && (
        <Alert tone="danger" title="Not uploaded" className="mb-4">
          {failure}
        </Alert>
      )}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <Field label="Lesson" required id="mat-lesson">
            <Select
              id="mat-lesson"
              value={lessonChoice}
              onChange={(e) => setLessonChoice(e.target.value)}
              options={[
                ...courseLessons.map((l) => ({
                  value: l.id,
                  label: `${l.sequence}. ${l.title}`,
                })),
                { value: NEW_LESSON, label: 'Create a new lesson…' },
              ]}
            />
          </Field>

          {creatingLesson && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Module" required error={moduleError} id="mat-module">
                <Select
                  id="mat-module"
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  placeholder="Pick a module"
                  options={courseModules.map((m) => ({ value: m.id, label: `${m.sequence}. ${m.title}` }))}
                />
              </Field>
              <Field label="Lesson title" required error={lessonTitleError} id="mat-title">
                <Input
                  id="mat-title"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="Cleaning the Lagos sales extract"
                />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Format"
              required
              hint="One asset per format. A lesson carrying all five is what the coverage table is measuring."
              id="mat-format"
            >
              <Select
                id="mat-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as ContentFormat)}
                options={FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Field>
            <Field label="Length" required hint="Drives the stored duration and size." id="mat-duration">
              <Input
                id="mat-duration"
                type="number"
                min={1}
                max={300}
                value={durationMinutes}
                suffix="min"
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </Field>
          </div>

          {alreadyHasFormat && chosenLesson && (
            <Alert tone="warning" title="This lesson already carries that format">
              Uploading replaces the pointer. The existing asset is kept and marked superseded — nothing
              is deleted.
            </Alert>
          )}

          {chosenLesson && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-sunken p-3">
              <span className="text-body-12 text-text-muted">Currently on this lesson:</span>
              {FORMAT_OPTIONS.filter((o) => chosenLesson.formats[o.value] !== undefined).length === 0 ? (
                <span className="text-body-12 text-text-secondary">nothing yet</span>
              ) : (
                FORMAT_OPTIONS.filter((o) => chosenLesson.formats[o.value] !== undefined).map((o) => (
                  <Badge key={o.value} tone="success" variant="subtle" size="sm">
                    {o.label}
                  </Badge>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="File name" error={sourceError} id="mat-file">
            <Input
              id="mat-file"
              value={fileName}
              leftIcon={<FileText size={14} />}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="regression-walkthrough.mp4"
            />
          </Field>

          <Field
            label="…or a URL"
            optional
            hint="Recorded as a lesson resource alongside the asset."
            id="mat-url"
          >
            <Input
              id="mat-url"
              value={sourceUrl}
              leftIcon={<Link2 size={14} />}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://cdn.cirvee.com/da/regression.mp4"
            />
          </Field>

          {format === 'transcript' && (
            <Field
              label="Transcript text"
              hint="Stored as real text — the content library searches it."
              id="mat-transcript"
            >
              <Textarea
                id="mat-transcript"
                rows={5}
                value={transcriptBody}
                onChange={(e) => setTranscriptBody(e.target.value)}
                placeholder="Right, so the first thing we do with a regression is look at the residuals…"
              />
            </Field>
          )}

          <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-sunken p-3 text-body-12 text-text-secondary">
            <Upload size={14} className="mt-0.5 shrink-0" />
            A video upload generates four quality variants including a 240p low-data one, because a
            student on a metered connection is the case this model exists for.
          </p>
        </div>
      )}
    </Modal>
  )
}
