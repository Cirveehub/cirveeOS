import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Baby,
  Briefcase,
  Building2,
  CalendarCheck,
  Camera,
  GraduationCap,
  HeartHandshake,
  Handshake,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Receipt,
  Scale,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  Server,
  ClipboardList,
  BookMarked,
} from 'lucide-react'

import {
  DEPT,
  P,
  ROLE,
  U,
  peopleCollection,
  relationshipsCollection,
  usersCollection,
  type DepartmentId,
  type PersonId,
  type RoleId,
  type UserId,
} from '@/mocks'

export type HomeShape = 'configurator' | 'executive' | 'ops' | 'frontline' | 'consumer'

export const DEPARTMENTS: Array<{ id: DepartmentId | 'external'; label: string; covers: string }> = [
  { id: DEPT.management, label: 'Management', covers: 'Strategic oversight and the operating rhythm' },
  { id: DEPT.hrPeople, label: 'HR & People', covers: 'Recruitment, welfare, performance, culture' },
  { id: DEPT.financeLegal, label: 'Finance & Legal', covers: 'Accounting, budgeting, compliance, contracts' },
  { id: DEPT.growth, label: 'Growth', covers: 'Sales, partnerships and business development' },
  { id: DEPT.customerExperience, label: 'Customer Experience', covers: 'Community, student support, customer success' },
  { id: DEPT.education, label: 'Education', covers: 'Curriculum, tutors, learning quality, assessments' },
  { id: DEPT.programsDelivery, label: 'Programs & Delivery', covers: 'Programme coordination, cohorts, training operations' },
  { id: DEPT.media, label: 'Media', covers: 'Content, design, photography, videography, social' },
  { id: DEPT.technology, label: 'Technology & Systems', covers: 'Website, LMS, internal systems, IT support, automation' },
  { id: 'external', label: 'Learners, parents & clients', covers: 'Everyone who is not staff' },
]

export interface Persona {
  id: string
  label: string
  blurb: string
  roleId: RoleId
  departmentId: DepartmentId | 'external'
  icon: LucideIcon
  shape: HomeShape
  personId?: PersonId
  userId?: UserId
  resolvePersonId?: () => PersonId | undefined
}

function firstPersonWith(type: string): () => PersonId | undefined {
  return () =>
    relationshipsCollection.all().find((r) => r.type === type && r.status === 'active')?.personId
}

function firstStaffIn(departmentId: DepartmentId): () => PersonId | undefined {
  return () => usersCollection.all().find((u) => u.departmentId === departmentId)?.personId
}

export const PERSONAS: Persona[] = [
  {
    id: 'super-admin',
    label: 'Super Admin',
    blurb: 'Configuration, roles and integrations. Sees everything, by design.',
    roleId: ROLE.superAdmin,
    departmentId: DEPT.management,
    icon: ShieldCheck,
    shape: 'configurator',
    personId: P.adebayo,
    userId: U.adebayo,
  },
  {
    id: 'ceo',
    label: 'CEO / Executive',
    blurb: 'The whole organisation as numbers. Approves above the threshold.',
    roleId: ROLE.ceo,
    departmentId: DEPT.management,
    icon: TrendingUp,
    shape: 'executive',
    personId: P.musa,
    userId: U.musa,
  },
  {
    id: 'exec-assistant',
    label: 'Executive Assistant',
    blurb: 'Agendas, the action register and the decision log. Keeps the rhythm.',
    roleId: ROLE.execAssistant,
    departmentId: DEPT.management,
    icon: CalendarCheck,
    shape: 'ops',
    resolvePersonId: firstStaffIn(DEPT.management),
  },
  {
    id: 'unit-head',
    label: 'Unit Head',
    blurb: 'One business unit in full. Organisation-wide figures as summary only.',
    roleId: ROLE.unitHead,
    departmentId: DEPT.management,
    icon: Building2,
    shape: 'executive',
    personId: P.chukwuemeka,
    userId: U.chukwuemeka,
  },

  {
    id: 'hr',
    label: 'HR Manager',
    blurb: 'Onboarding, attendance, leave, performance and the payroll inputs.',
    roleId: ROLE.hrManager,
    departmentId: DEPT.hrPeople,
    icon: UserCog,
    shape: 'ops',
    personId: P.yetunde,
    userId: U.yetunde,
  },
  {
    id: 'recruiter',
    label: 'Talent Acquisition',
    blurb: 'Openings, candidates, interviews and offers.',
    roleId: ROLE.recruiter,
    departmentId: DEPT.hrPeople,
    icon: UserPlus,
    shape: 'ops',
    personId: P.temitope,
    userId: U.temitope,
  },

  {
    id: 'finance',
    label: 'Finance Manager',
    blurb: 'Invoices, payments, reconciliation, expenses and payroll runs.',
    roleId: ROLE.financeManager,
    departmentId: DEPT.financeLegal,
    icon: Banknote,
    shape: 'ops',
    personId: P.fatima,
    userId: U.fatima,
  },
  {
    id: 'finance-officer',
    label: 'Finance Officer',
    blurb: 'The reconciliation desk. Matches payments, chases what is unmatched.',
    roleId: ROLE.financeOfficer,
    departmentId: DEPT.financeLegal,
    icon: Receipt,
    shape: 'ops',
    personId: P.ibrahim,
    userId: U.ibrahim,
  },
  {
    id: 'legal',
    label: 'Legal & Compliance',
    blurb: 'Contracts, data protection and the paperwork behind every approval.',
    roleId: ROLE.legalCompliance,
    departmentId: DEPT.financeLegal,
    icon: Scale,
    shape: 'ops',
    resolvePersonId: firstStaffIn(DEPT.financeLegal),
  },

  {
    id: 'growth-head',
    label: 'Head of Growth',
    blurb: 'The pipeline organisation-wide, campaigns, targets and team commission.',
    roleId: ROLE.headOfGrowth,
    departmentId: DEPT.growth,
    icon: Megaphone,
    shape: 'ops',
    personId: P.ifeoma,
    userId: U.ifeoma,
  },
  {
    id: 'sales-exec',
    label: 'Sales Executive',
    blurb: 'Own leads, own admissions, own commission statement. Nothing else.',
    roleId: ROLE.salesExec,
    departmentId: DEPT.growth,
    icon: Target,
    shape: 'ops',
    personId: P.chidinma,
    userId: U.chidinma,
  },
  {
    id: 'partnerships',
    label: 'Partnerships & BD',
    blurb: 'Corporate accounts, proposals, contracts and renewals.',
    roleId: ROLE.corporateAm,
    departmentId: DEPT.growth,
    icon: Handshake,
    shape: 'ops',
    personId: P.blessing,
    userId: U.blessing,
  },

  {
    id: 'student-support',
    label: 'Student Support',
    blurb: 'Attention flags, tickets and the student data needed to resolve them.',
    roleId: ROLE.advisor,
    departmentId: DEPT.customerExperience,
    icon: LifeBuoy,
    shape: 'ops',
    personId: P.folake,
    userId: U.folake,
  },
  {
    id: 'community-manager',
    label: 'Community Manager',
    blurb: 'The student community, the channels and the tone.',
    roleId: ROLE.communityManager,
    departmentId: DEPT.customerExperience,
    icon: MessagesSquare,
    shape: 'ops',
    resolvePersonId: firstStaffIn(DEPT.customerExperience),
  },

  {
    id: 'curriculum-lead',
    label: 'Curriculum Lead',
    blurb: 'Course design, learning quality and assessment standards.',
    roleId: ROLE.curriculumLead,
    departmentId: DEPT.education,
    icon: BookMarked,
    shape: 'ops',
    resolvePersonId: firstStaffIn(DEPT.education),
  },
  {
    id: 'tutor',
    label: 'Tutor',
    blurb: 'Assigned cohorts only. Deliberately cannot see who owes money.',
    roleId: ROLE.tutor,
    departmentId: DEPT.education,
    icon: GraduationCap,
    shape: 'frontline',
    personId: P.tundeBakare,
    userId: U.tundeBakare,
  },

  {
    id: 'academy-ops',
    label: 'Academy Operations',
    blurb: 'Courses, cohorts, timetables, tutors, students and attendance.',
    roleId: ROLE.academyManager,
    departmentId: DEPT.programsDelivery,
    icon: ClipboardList,
    shape: 'ops',
    personId: P.emeka,
    userId: U.emeka,
  },
  {
    id: 'programme-coordinator',
    label: 'Programme Coordinator',
    blurb: 'Cohort scheduling, training operations and delivery on the day.',
    roleId: ROLE.programmeCoordinator,
    departmentId: DEPT.programsDelivery,
    icon: CalendarCheck,
    shape: 'frontline',
    resolvePersonId: firstStaffIn(DEPT.programsDelivery),
  },

  {
    id: 'media-lead',
    label: 'Media Lead',
    blurb: 'Content, design and social. Owns the proof queue and the brand.',
    roleId: ROLE.mediaLead,
    departmentId: DEPT.media,
    icon: Camera,
    shape: 'ops',
    resolvePersonId: firstStaffIn(DEPT.media),
  },
  {
    id: 'marketing',
    label: 'Marketing',
    blurb: 'Segments, campaigns, templates and attribution. No individual finances.',
    roleId: ROLE.marketing,
    departmentId: DEPT.media,
    icon: Megaphone,
    shape: 'ops',
    personId: P.amarachi,
    userId: U.amarachi,
  },

  {
    id: 'technology-lead',
    label: 'Technology Lead',
    blurb: 'Automations, integrations, card readers and internal systems.',
    roleId: ROLE.itAdmin,
    departmentId: DEPT.technology,
    icon: Server,
    shape: 'ops',
    personId: P.damilola,
    userId: U.damilola,
  },

  {
    id: 'employee',
    label: 'Employee',
    blurb: 'Any staff member in their own right: profile, leave, payslips, tasks.',
    roleId: ROLE.employee,
    departmentId: 'external',
    icon: Briefcase,
    shape: 'frontline',
    personId: P.kabiru,
    userId: U.kabiru,
  },
  {
    id: 'student',
    label: 'Student',
    blurb: 'Their own record only. Their course, their grades, their balance.',
    roleId: ROLE.student,
    departmentId: 'external',
    icon: Users,
    shape: 'consumer',
    personId: P.chiamaka,
  },
  {
    id: 'parent',
    label: 'Parent / Guardian',
    blurb: "Their child's attendance and progress. The paying customer in Teens.",
    roleId: ROLE.parent,
    departmentId: 'external',
    icon: Baby,
    shape: 'consumer',
    resolvePersonId: firstPersonWith('parent_guardian'),
  },
  {
    id: 'corporate-client',
    label: 'Corporate Client',
    blurb: "Their own staff's attendance, progress and assessment results.",
    roleId: ROLE.corporateClient,
    departmentId: 'external',
    icon: Building2,
    shape: 'consumer',
    resolvePersonId: firstPersonWith('corporate_contact'),
  },
  {
    id: 'sponsor',
    label: 'Sponsor',
    blurb: 'Their funded programme and its beneficiaries. Read-only throughout.',
    roleId: ROLE.sponsor,
    departmentId: 'external',
    icon: HeartHandshake,
    shape: 'consumer',
    resolvePersonId: firstPersonWith('sponsor'),
  },
]

export const personaById = Object.fromEntries(PERSONAS.map((p) => [p.id, p])) as Record<
  string,
  Persona | undefined
>

export const DEFAULT_PERSONA_ID = 'super-admin'

export interface ResolvedPersona {
  persona: Persona
  personId: PersonId | undefined
  userId: UserId | undefined
  displayName: string
  departmentLabel: string
}

export function resolvePersona(persona: Persona): ResolvedPersona {
  const personId = persona.personId ?? persona.resolvePersonId?.()
  const person = personId ? peopleCollection.find(personId) : undefined
  const userId =
    persona.userId ??
    (personId ? usersCollection.all().find((u) => u.personId === personId)?.id : undefined)

  return {
    persona,
    personId,
    userId,
    displayName: person ? `${person.firstName} ${person.lastName}` : persona.label,
    departmentLabel:
      DEPARTMENTS.find((d) => d.id === persona.departmentId)?.label ?? 'Cirvee',
  }
}

export const PERSONAS_BY_DEPARTMENT = DEPARTMENTS.map((dept) => ({
  ...dept,
  personas: PERSONAS.filter((p) => p.departmentId === dept.id),
})).filter((d) => d.personas.length > 0)
