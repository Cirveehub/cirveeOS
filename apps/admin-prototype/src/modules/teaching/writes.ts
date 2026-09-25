import {
  CURRENT_USER_ID,
  TODAY,
  assignmentsCollection,
  auditEventsCollection,
  classSessionsCollection,
  cohortDiscussionPostsCollection,
  cohortsCollection,
  contentAssetsCollection,
  courseModulesCollection,
  coursesCollection,
  lessonsCollection,
  peopleCollection,
  policyVersionsCollection,
  rolesCollection,
  submissionsCollection,
  usersCollection,
} from '@/mocks'
import {
  assetId as asAssetId,
  assignmentId as asAssignmentId,
  auditId as asAuditId,
  discussionPostId as asDiscussionPostId,
  lessonId as asLessonId,
  type Assignment,
  type AssignmentId,
  type AttendanceConsequence,
  type AuditEvent,
  type AuditSource,
  type ClassSession,
  type ClassSessionId,
  type CohortId,
  type ContentAsset,
  type ContentFormat,
  type CourseId,
  type CourseModuleId,
  type ISODate,
  type Lesson,
  type LessonId,
  type PersonId,
  type RubricRow,
  type Submission,
  type SubmissionId,
  type UserId,
} from '@/mocks/types'

export {
  recordAttendance,
  overrideAttendance,
  refreshAttendanceCounts,
  type AttendanceEntry,
  type AttendanceResult,
} from '@/modules/academy/writes'

export function nowIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${TODAY}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+01:00`
}

function auditable(actorUserId: UserId, at: string = nowIso()) {
  return { createdAt: at, createdBy: actorUserId, updatedAt: at, updatedBy: actorUserId }
}

function displayName(personId: string | null | undefined): string {
  if (!personId) return '—'
  const person = peopleCollection.find(personId)
  return person ? `${person.firstName} ${person.lastName}` : '—'
}

let auditSequence = 0

export interface AuditInput {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
  source?: AuditSource
  actorUserId?: UserId
}

export function emitAudit(input: AuditInput): AuditEvent {
  auditSequence += 1
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const user = usersCollection.find(actorUserId)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff') : 'Staff'

  return auditEventsCollection.insert({
    id: asAuditId(`aud-teaching-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: nowIso(),
    actorUserId,
    actorName: displayName(user?.personId),
    actorRole: roleName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: input.source ?? 'ui',
    ip: '102.89.34.17',
  })
}

export interface AttendancePolicy {
  version: number
  graceMinutes: number
  lateAfterMinutes: number
  absentAfterMinutes: number
  financialConsequenceEnabled: boolean
  consequences: AttendanceConsequence[]
  disputeWindowDays: number
  notes: string
}

const POLICY_FALLBACK: AttendancePolicy = {
  version: 0,
  graceMinutes: 0,
  lateAfterMinutes: 0,
  absentAfterMinutes: 0,
  financialConsequenceEnabled: false,
  consequences: ['none'],
  disputeWindowDays: 0,
  notes: 'No attendance policy is in force.',
}

function readNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key]
  return typeof value === 'number' ? value : fallback
}

export function activeAttendancePolicy(): AttendancePolicy {
  const version = policyVersionsCollection
    .where((p) => p.kind === 'attendance' && p.status === 'active')
    .sort((a, b) => b.version - a.version)[0]
  if (!version) return POLICY_FALLBACK

  const config = version.config
  const consequences = Array.isArray(config.consequences)
    ? (config.consequences as AttendanceConsequence[])
    : ['none' as AttendanceConsequence]

  return {
    version: version.version,
    graceMinutes: readNumber(config, 'graceMinutes', 0),
    lateAfterMinutes: readNumber(config, 'lateAfterMinutes', 0),
    absentAfterMinutes: readNumber(config, 'absentAfterMinutes', 0),
    financialConsequenceEnabled: config.financialConsequenceEnabled === true,
    consequences,
    disputeWindowDays: readNumber(config, 'disputeWindowDays', 0),
    notes: version.notes,
  }
}

export interface NewAssignmentInput {
  courseId: CourseId
  cohortId: CohortId | null
  lessonId: LessonId
  title: string
  brief: string
  dueDate: ISODate
  maxScore: number
  acceptedFormats: string[]
  maxFileSizeMb: number
  latePolicy: Assignment['latePolicy']
  latePenaltyPercent: number | null
  attachmentFileName?: string | null
  actorUserId?: UserId
}

export function createAssignment(input: NewAssignmentInput): Assignment {
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const at = nowIso()
  const title = input.title.trim()

  if (!title) throw new Error('An assignment needs a title.')
  if (!input.dueDate) throw new Error('An assignment needs a due date.')
  if (!Number.isFinite(input.maxScore) || input.maxScore <= 0) {
    throw new Error('Total marks must be a number above zero.')
  }
  const lesson = lessonsCollection.find(input.lessonId)
  if (!lesson) throw new Error('That lesson is no longer in the course outline.')

  const assignment = assignmentsCollection.insert({
    id: asAssignmentId(`asg-ui-${Date.now().toString(36)}`),
    lessonId: input.lessonId,
    courseId: input.courseId,
    cohortId: input.cohortId,
    title,
    brief: input.brief.trim(),
    acceptedFormats: input.acceptedFormats.map((f) => f.trim().toLowerCase()).filter(Boolean),
    maxFileSizeMb: input.maxFileSizeMb,
    dueOffsetDays: null,
    dueDate: input.dueDate,
    maxScore: input.maxScore,
    rubric: [],
    latePolicy: input.latePolicy,
    latePenaltyPercent: input.latePolicy === 'accept_with_penalty' ? (input.latePenaltyPercent ?? 10) : null,
    tutorGuidance: input.attachmentFileName
      ? `Brief attachment: ${input.attachmentFileName}`
      : '',
    ...auditable(actorUserId, at),
  })

  if (lesson.assignmentId === null) {
    lessonsCollection.update(lesson.id, {
      assignmentId: assignment.id,
      updatedAt: at,
      updatedBy: actorUserId,
    })
  }

  const cohort = input.cohortId ? cohortsCollection.find(input.cohortId) : undefined
  const course = coursesCollection.find(input.courseId)

  emitAudit({
    action: 'assignment.create',
    entityType: 'Assignment',
    entityId: assignment.id,
    entityRef: `${title} · ${cohort?.code ?? course?.code ?? input.courseId}`,
    field: 'dueDate',
    before: null,
    after: `due ${input.dueDate}, ${input.maxScore} marks`,
    actorUserId,
  })

  return assignment
}

export const DEFAULT_PASS_PERCENT = 60

export function passPercentFor(courseId: string | null | undefined): number {
  const rules = courseId ? coursesCollection.find(courseId)?.certificateRules : undefined
  return rules?.projectMinimumGrade ?? rules?.finalAssessmentPassMark ?? DEFAULT_PASS_PERCENT
}

export interface GradeInput {
  submissionId: SubmissionId
  totalScore: number
  feedback: string
  rubricScores?: Array<{ criterion: string; score: number; comment: string }>
  voiceNote?: Submission['voiceNote']
  graderPersonId: PersonId | null
  actorUserId?: UserId
}

export function gradeSubmission(input: GradeInput): Submission {
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const at = nowIso()

  const submission = submissionsCollection.find(input.submissionId)
  if (!submission) throw new Error('Submission not found')

  const assignment = assignmentsCollection.find(submission.assignmentId)
  const maxScore = assignment?.maxScore ?? 100

  if (!Number.isFinite(input.totalScore) || input.totalScore < 0) {
    throw new Error('A score must be zero or more.')
  }
  if (input.totalScore > maxScore) {
    throw new Error(`The maximum for this assignment is ${maxScore}.`)
  }

  const passMark = passPercentFor(assignment?.courseId)
  const passed = (input.totalScore / maxScore) * 100 >= passMark

  const updated = submissionsCollection.update(submission.id, {
    status: 'graded',
    rubricScores: input.rubricScores ?? submission.rubricScores,
    totalScore: input.totalScore,
    passed,
    feedback: input.feedback.trim() || null,
    voiceNote: input.voiceNote !== undefined ? input.voiceNote : submission.voiceNote,
    gradedByPersonId: input.graderPersonId,
    gradedAt: at,
    daysWaiting: 0,
    updatedAt: at,
    updatedBy: actorUserId,
  })

  emitAudit({
    action: submission.status === 'graded' ? 'submission.regrade' : 'submission.grade',
    entityType: 'Submission',
    entityId: submission.id,
    entityRef: `${displayName(submission.personId)} · ${assignment?.title ?? submission.assignmentId}`,
    field: 'totalScore',
    before: submission.totalScore === null ? submission.status : String(submission.totalScore),
    after: `${input.totalScore}/${maxScore} — ${passed ? 'passed' : `below the ${passMark}% pass mark`}`,
    actorUserId,
  })

  return updated ?? submission
}

export interface ReturnForRevisionInput {
  submissionId: SubmissionId
  reason: string
  actorUserId?: UserId
}

export function returnForRevision(input: ReturnForRevisionInput): Submission {
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const reason = input.reason.trim()
  if (reason.length < 8) throw new Error('Say what needs revising — eight characters minimum.')

  const submission = submissionsCollection.find(input.submissionId)
  if (!submission) throw new Error('Submission not found')

  const updated = submissionsCollection.update(submission.id, {
    status: 'returned_for_revision',
    feedback: reason,
    updatedAt: nowIso(),
    updatedBy: actorUserId,
  })

  emitAudit({
    action: 'submission.return',
    entityType: 'Submission',
    entityId: submission.id,
    entityRef: displayName(submission.personId),
    field: 'status',
    before: submission.status,
    after: `returned_for_revision — ${reason}`,
    actorUserId,
  })

  return updated ?? submission
}

const EXTENSION: Record<ContentFormat, string> = {
  video: 'mp4',
  audio: 'm4a',
  podcast: 'mp3',
  pdf: 'pdf',
  transcript: 'txt',
}

export interface UploadMaterialInput {
  courseId: CourseId
  lessonId: LessonId | null
  moduleId: CourseModuleId | null
  newLessonTitle?: string
  format: ContentFormat
  fileName: string | null
  sourceUrl: string | null
  durationMinutes: number
  transcriptBody?: string
  actorUserId?: UserId
}

export interface UploadMaterialResult {
  lesson: Lesson
  asset: ContentAsset
  lessonCreated: boolean
}

export function uploadMaterial(input: UploadMaterialInput): UploadMaterialResult {
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const at = nowIso()
  const stamp = Date.now().toString(36)

  if (!input.fileName?.trim() && !input.sourceUrl?.trim()) {
    throw new Error('Choose a file or paste a URL.')
  }

  let lesson = input.lessonId ? lessonsCollection.find(input.lessonId) : undefined
  let lessonCreated = false

  if (!lesson) {
    const moduleId = input.moduleId
    const title = input.newLessonTitle?.trim()
    if (!moduleId) throw new Error('Pick the module this lesson belongs to.')
    if (!title) throw new Error('A new lesson needs a title.')
    if (!courseModulesCollection.find(moduleId)) throw new Error('That module is no longer in the course.')

    const siblings = lessonsCollection.where((l) => l.moduleId === moduleId)
    lesson = lessonsCollection.insert({
      id: asLessonId(`lesson-ui-${stamp}`),
      moduleId,
      courseId: input.courseId,
      sequence: siblings.length + 1,
      title,
      type: 'content',
      durationMinutes: input.durationMinutes,
      status: 'draft',
      formats: {},
      offlineEnabled: false,
      androidCheck: { passes: true, issues: [] },
      resources: [],
      quizId: null,
      assignmentId: null,
      ...auditable(actorUserId, at),
    })
    lessonCreated = true
  }

  const minutes = Math.max(1, input.durationMinutes)
  const slug = lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const asset: ContentAsset = {
    id: asAssetId(`asset-ui-${stamp}-${input.format}`),
    lessonId: lesson.id,
    format: input.format,
    fileName: input.fileName?.trim() || `${slug}.${EXTENSION[input.format]}`,
    fileSizeBytes: 0,
    language: 'en',
    status: 'uploaded',
    downloadCount: 0,
    offlineEnabled: lesson.offlineEnabled,
    ...auditable(actorUserId, at),
  }

  if (input.format === 'video') {
    asset.fileSizeBytes = minutes * 11_500_000
    asset.durationSeconds = minutes * 60
    asset.variants = [
      { label: '1080p', fileSizeBytes: minutes * 11_500_000, bitrateKbps: 4200, status: 'ready' },
      { label: '720p', fileSizeBytes: minutes * 6_200_000, bitrateKbps: 2200, status: 'ready' },
      { label: '480p', fileSizeBytes: minutes * 3_100_000, bitrateKbps: 1100, status: 'processing' },
      { label: '240p_low_data', fileSizeBytes: minutes * 900_000, bitrateKbps: 320, status: 'processing' },
    ]
  } else if (input.format === 'audio') {
    asset.fileSizeBytes = minutes * 900_000
    asset.durationSeconds = minutes * 60
    asset.audioOrigin = 'recorded_separately'
  } else if (input.format === 'podcast') {
    asset.fileSizeBytes = minutes * 950_000
    asset.durationSeconds = minutes * 60
    asset.podcast = {
      feedName: 'Cirvee Data Clinic',
      episodeNumber: contentAssetsCollection.count((a) => a.format === 'podcast') + 1,
      episodeTitle: lesson.title,
      publishedAt: TODAY,
      publicFeedUrl: 'https://feeds.cirvee.com/data-clinic.xml',
    }
  } else if (input.format === 'pdf') {
    asset.fileSizeBytes = 1_800_000
    asset.pageCount = Math.max(6, Math.round(minutes / 2))
  } else {
    asset.fileSizeBytes = Math.max(1_200, (input.transcriptBody?.length ?? 0) * 2)
    asset.transcriptBody = input.transcriptBody ?? ''
    asset.transcriptOrigin = 'human_reviewed'
  }

  const superseded = lesson.formats[input.format]
  if (superseded) {
    contentAssetsCollection.update(superseded, {
      status: 'missing',
      archivedAt: at,
      archivedReason: `Superseded by ${asset.fileName}`,
      updatedAt: at,
      updatedBy: actorUserId,
    })
  }

  contentAssetsCollection.insert(asset)
  const patchedLesson =
    lessonsCollection.update(lesson.id, {
      formats: { ...lesson.formats, [input.format]: asset.id },
      resources: input.sourceUrl?.trim()
        ? [...lesson.resources, { label: asset.fileName, url: input.sourceUrl.trim() }]
        : lesson.resources,
      updatedAt: at,
      updatedBy: actorUserId,
    }) ?? lesson

  emitAudit({
    action: 'content_asset.upload',
    entityType: 'ContentAsset',
    entityId: asset.id,
    entityRef: `${lesson.title} · ${input.format}`,
    field: 'status',
    before: superseded ? 'published' : null,
    after: superseded ? `replaced by ${asset.fileName}` : `uploaded ${asset.fileName}`,
    actorUserId,
  })

  return { lesson: patchedLesson, asset, lessonCreated }
}

export function setSessionRecording(
  sessionId: ClassSessionId,
  recordingUrl: string | null,
  actorUserId: UserId = CURRENT_USER_ID,
): ClassSession {
  const at = nowIso()
  const session = classSessionsCollection.find(sessionId)
  if (!session) throw new Error('That session is no longer on the timetable.')
  if (session.status !== 'delivered') throw new Error('A session only gets a recording once it has been delivered.')

  const trimmed = recordingUrl?.trim() || null
  const updated = classSessionsCollection.update(sessionId, {
    recordingUrl: trimmed,
    updatedAt: at,
    updatedBy: actorUserId,
  })
  if (!updated) throw new Error('That session is no longer on the timetable.')

  emitAudit({
    action: trimmed ? 'class_session.recording_added' : 'class_session.recording_removed',
    entityType: 'ClassSession',
    entityId: session.id,
    entityRef: `${session.topic} (session ${session.sequence})`,
    field: 'recordingUrl',
    before: session.recordingUrl,
    after: trimmed,
    actorUserId,
  })

  return updated
}

export interface ProfileInput {
  personId: PersonId
  preferredName: string
  email: string
  phone: string
  city: string
  actorUserId?: UserId
}

export function updateTutorProfile(input: ProfileInput): void {
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const at = nowIso()
  const person = peopleCollection.find(input.personId)
  if (!person) throw new Error('Profile not found')

  peopleCollection.update(person.id, {
    preferredName: input.preferredName.trim() || undefined,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    city: input.city.trim() || person.city,
    updatedAt: at,
    updatedBy: actorUserId,
  })

  emitAudit({
    action: 'person.profile.update',
    entityType: 'Person',
    entityId: person.id,
    entityRef: `${person.firstName} ${person.lastName}`,
    field: 'contact',
    before: `${person.email ?? '—'} / ${person.phone ?? '—'}`,
    after: `${input.email.trim() || '—'} / ${input.phone.trim() || '—'}`,
    actorUserId,
  })
}

export function postToDiscussion(
  cohortId: CohortId,
  authorPersonId: PersonId,
  body: string,
  actorUserId: UserId = CURRENT_USER_ID,
): void {
  const trimmed = body.trim()
  if (!trimmed) return
  const at = nowIso()
  cohortDiscussionPostsCollection.insert({
    id: asDiscussionPostId(`disc-ui-${Date.now().toString(36)}`),
    cohortId,
    authorPersonId,
    authorRole: 'tutor',
    body: trimmed,
    postedAt: at,
    pinned: false,
    ...auditable(actorUserId, at),
  })
}

export function deleteDiscussionPost(postId: string): void {
  cohortDiscussionPostsCollection.remove(postId)
}

export function pinDiscussionPost(postId: string, pinned: boolean, actorUserId: UserId = CURRENT_USER_ID): void {
  cohortDiscussionPostsCollection.update(postId, { pinned, updatedAt: nowIso(), updatedBy: actorUserId })
}

export type { Assignment, AssignmentId, RubricRow }
