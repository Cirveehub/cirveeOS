/**
 * Foundation: the organisation, its three branches, its six business units,
 * the departments and teams inside them, the role/permission matrix, the user
 * accounts, and the effective-dated PolicyVersions the rest of the system
 * reads instead of hard-coding thresholds.
 */

import {
  ngn,
  orgId,
  roleId as asRoleId,
  type Branch,
  type Department,
  type Organisation,
  type PermissionAction,
  type PermissionScope,
  type PolicyVersion,
  type Role,
  type Team,
  type Unit,
  type User,
  type AttendancePolicyConfig,
  type EmployeeId,
} from '@/mocks/types'
import { BR, DEPT, E, P, ROLE, STAFF_PERSON_SLOTS, TEAM, U, UNIT, user } from '@/mocks/seed/ids'
import { audit, dtAgo, SYSTEM_USER } from '@/mocks/seed/_helpers'

const founded = '2021-02-01'
const born = audit('2021-02-01T09:00:00+01:00', SYSTEM_USER)

/* -------------------------------------------------------------------------- */
/* Organisation                                                               */
/* -------------------------------------------------------------------------- */

export const organisations: Organisation[] = [
  {
    id: orgId('org-cirvee'),
    legalName: 'Cirvee Technologies Limited',
    tradingName: 'Cirvee',
    rcNumber: 'RC 1748203',
    tin: '20481937-0001',
    address: '14 Awolowo Avenue, Bodija, Ibadan, Oyo State',
    logoUrl: '/brand/cirvee-mark.svg',
    brandPrimary: '#6d00e7',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    financialYearStartMonth: 1,
    ...born,
  },
]

/* -------------------------------------------------------------------------- */
/* Branches                                                                   */
/* -------------------------------------------------------------------------- */

export const branches: Branch[] = [
  {
    id: BR.ibadan,
    code: 'IBADAN_HQ',
    name: 'Ibadan HQ',
    type: 'hq',
    address: '14 Awolowo Avenue, Bodija',
    city: 'Ibadan',
    state: 'Oyo',
    phone: '+234 803 221 9040',
    managerId: E.emeka as EmployeeId,
    capacity: 220,
    activeFrom: founded,
    status: 'active',
    ...born,
  },
  {
    id: BR.lagos,
    code: 'LAGOS',
    name: 'Lagos — Yaba',
    type: 'campus',
    address: '7 Herbert Macaulay Way, Yaba',
    city: 'Lagos',
    state: 'Lagos',
    phone: '+234 806 554 1188',
    managerId: E.chukwuemeka as EmployeeId,
    capacity: 140,
    activeFrom: '2023-05-02',
    status: 'active',
    ...audit('2023-05-02T09:00:00+01:00', SYSTEM_USER),
  },
  {
    id: BR.virtual,
    code: 'VIRTUAL',
    name: 'Virtual campus',
    type: 'virtual',
    address: 'Online — Cirvee Learn',
    city: 'Ibadan',
    state: 'Oyo',
    phone: '+234 810 447 2205',
    managerId: E.folake as EmployeeId,
    capacity: 600,
    activeFrom: '2022-01-10',
    status: 'active',
    ...audit('2022-01-10T09:00:00+01:00', SYSTEM_USER),
  },
]

/* -------------------------------------------------------------------------- */
/* Units — the six the P&L is cut by                                          */
/* -------------------------------------------------------------------------- */

export const units: Unit[] = [
  {
    id: UNIT.academy,
    code: 'ACADEMY',
    name: 'Cirvee Academy',
    description: 'Adult technology training — the core tuition business.',
    headId: E.emeka as EmployeeId,
    activeFrom: founded,
    status: 'active',
    ...born,
  },
  {
    id: UNIT.teens,
    code: 'TEENS',
    name: 'Cirvee Teens',
    description: 'Saturday and holiday programmes for 8–17 year-olds. Billed per term.',
    headId: E.folake as EmployeeId,
    activeFrom: '2022-09-05',
    status: 'active',
    ...audit('2022-09-05T09:00:00+01:00', SYSTEM_USER),
  },
  {
    id: UNIT.corporate,
    code: 'CORPORATE',
    name: 'Cirvee Corporate',
    description: 'B2B training contracts, invoiced to the organisation, not the participant.',
    headId: E.chukwuemeka as EmployeeId,
    activeFrom: '2022-03-14',
    status: 'active',
    ...audit('2022-03-14T09:00:00+01:00', SYSTEM_USER),
  },
  {
    id: UNIT.dexurb,
    code: 'DEXURB',
    name: 'Dexurb',
    description: 'Product and engineering studio. Builds Cirvee OS and client work.',
    headId: E.damilola as EmployeeId,
    activeFrom: '2021-08-01',
    status: 'active',
    ...audit('2021-08-01T09:00:00+01:00', SYSTEM_USER),
  },
  {
    id: UNIT.africa,
    code: 'AFRICA',
    name: 'Cirvee Africa',
    description: 'Pan-African virtual cohorts — Ghana, Kenya, Rwanda.',
    headId: E.aisha as EmployeeId,
    activeFrom: '2024-02-01',
    status: 'active',
    ...audit('2024-02-01T09:00:00+01:00', SYSTEM_USER),
  },
  {
    id: UNIT.tcf,
    code: 'TCF',
    name: 'The Cirvee Foundation',
    description: 'Scholarship and outreach arm. Runs the annual TCF conference.',
    headId: E.yetunde as EmployeeId,
    activeFrom: '2023-01-16',
    status: 'active',
    ...audit('2023-01-16T09:00:00+01:00', SYSTEM_USER),
  },
]

/* -------------------------------------------------------------------------- */
/* Departments and teams                                                      */
/* -------------------------------------------------------------------------- */

export const departments: Department[] = [
  { id: DEPT.management, name: 'Management', branchId: BR.ibadan, headId: E.musa, ...born },
  { id: DEPT.hrPeople, name: 'HR & People', branchId: BR.ibadan, headId: E.yetunde, ...born },
  { id: DEPT.financeLegal, name: 'Finance & Legal', branchId: BR.ibadan, headId: E.oluwaseun, ...born },
  { id: DEPT.growth, name: 'Growth', branchId: BR.ibadan, headId: E.ifeoma, ...born },
  {
    id: DEPT.customerExperience,
    name: 'Customer Experience',
    branchId: BR.ibadan,
    headId: E.folake,
    ...born,
  },
  { id: DEPT.education, name: 'Education', branchId: BR.ibadan, headId: E.tundeBakare, ...born },
  {
    id: DEPT.programsDelivery,
    name: 'Programs & Delivery',
    branchId: BR.ibadan,
    headId: E.emeka,
    ...born,
  },
  {
    id: DEPT.media,
    name: 'Media',
    branchId: BR.lagos,
    headId: E.amarachi,
    ...audit('2023-05-02T09:00:00+01:00', SYSTEM_USER),
  },
  { id: DEPT.technology, name: 'Technology & Systems', branchId: BR.ibadan, headId: E.damilola, ...born },
]

export const teams: Team[] = [
  {
    id: TEAM.ibadanSales,
    name: 'Ibadan sales team',
    departmentId: DEPT.growth,
    leadId: E.ifeoma,
    // Round-robin lead assignment draws from this list — Flow 1 step 5.
    memberIds: [E.chidinma, E.folake],
    ...born,
  },
  {
    id: TEAM.lagosSales,
    name: 'Lagos sales team',
    departmentId: DEPT.corporate,
    leadId: E.chukwuemeka,
    memberIds: [E.blessing],
    ...audit('2023-05-02T09:00:00+01:00', SYSTEM_USER),
  },
  {
    id: TEAM.virtualSales,
    name: 'Virtual & Africa sales team',
    departmentId: DEPT.growth,
    leadId: E.aisha,
    memberIds: [E.aisha],
    ...audit('2024-02-01T09:00:00+01:00', SYSTEM_USER),
  },
  {
    id: TEAM.reconciliation,
    name: 'Reconciliation desk',
    departmentId: DEPT.finance,
    leadId: E.fatima,
    memberIds: [E.fatima, E.ibrahim],
    ...born,
  },
  {
    id: TEAM.dataTutors,
    name: 'Data faculty',
    departmentId: DEPT.academy,
    leadId: E.tundeBakare,
    memberIds: [E.tundeBakare, E.kabiru],
    ...born,
  },
]

/* -------------------------------------------------------------------------- */
/* Roles & permissions                                                        */
/* -------------------------------------------------------------------------- */

/** Compact permission builder: `perm('branch', 'own', 'own')`. */
function perm(
  view: PermissionScope,
  create: PermissionScope = 'none',
  edit: PermissionScope = 'none',
  approve: PermissionScope = 'none',
  assign: PermissionScope = 'none',
  exportScope: PermissionScope = 'none',
  manage: PermissionScope = 'none',
): Record<PermissionAction, PermissionScope> {
  return { view, create, edit, approve, assign, export: exportScope, manage }
}

const ALL = perm(
  'organisation',
  'organisation',
  'organisation',
  'organisation',
  'organisation',
  'organisation',
  'organisation',
)

/** The resource keys the matrix editor renders as rows. */
export const PERMISSION_RESOURCES = [
  'crm.lead',
  'crm.admission',
  'crm.person',
  'referral.rule',
  'referral.commission',
  'referral.payout',
  'learn.course',
  'learn.submission',
  'learn.certificate',
  'academy.cohort',
  'academy.attendance',
  'finance.invoice',
  'finance.payment',
  'finance.refund',
  'finance.expense',
  'work.approval',
  'work.task',
  'work.document',
  'people.employee',
  'people.candidate',
  'people.compensation',
  'payroll.period',
  'automation.workflow',
  'engage.campaign',
  'settings.role',
] as const

function fullMatrix(): Record<string, Record<PermissionAction, PermissionScope>> {
  return Object.fromEntries(PERMISSION_RESOURCES.map((k) => [k, ALL]))
}

function matrix(
  entries: Record<string, Record<PermissionAction, PermissionScope>>,
): Record<string, Record<PermissionAction, PermissionScope>> {
  const base = Object.fromEntries(PERMISSION_RESOURCES.map((k) => [k, perm('none')]))
  return { ...base, ...entries }
}

export const roles: Role[] = [
  {
    id: ROLE.superAdmin,
    name: 'Super Admin',
    description: 'Sees and does everything. One holder — this is the prototype persona.',
    type: 'system',
    permissions: fullMatrix(),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.ceo,
    name: 'Chief Executive',
    description: 'Organisation-wide visibility, final approver above every threshold.',
    type: 'system',
    permissions: fullMatrix(),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.cfo,
    name: 'Chief Financial Officer',
    description: 'Owns money. Second approver on refunds above ₦150,000.',
    type: 'system',
    permissions: matrix({
      'finance.invoice': ALL,
      'finance.payment': ALL,
      'finance.refund': ALL,
      'finance.expense': ALL,
      'payroll.period': ALL,
      'referral.payout': ALL,
      'referral.commission': perm('organisation', 'none', 'none', 'organisation', 'none', 'organisation'),
      'work.approval': perm('organisation', 'organisation', 'own', 'organisation', 'none', 'organisation'),
      'crm.admission': perm('organisation', 'none', 'none', 'none', 'none', 'organisation'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.financeManager,
    name: 'Finance Manager',
    description: 'First approver on refunds and expenses. Runs reconciliation.',
    type: 'system',
    permissions: matrix({
      'finance.invoice': perm('organisation', 'organisation', 'organisation', 'none', 'none', 'organisation'),
      'finance.payment': perm('organisation', 'organisation', 'organisation', 'organisation', 'none', 'organisation'),
      'finance.refund': perm('organisation', 'organisation', 'organisation', 'organisation'),
      'finance.expense': perm('organisation', 'organisation', 'organisation', 'organisation'),
      'referral.payout': perm('organisation', 'organisation', 'organisation'),
      'referral.commission': perm('organisation', 'none', 'none', 'organisation'),
      'work.approval': perm('organisation', 'organisation', 'own', 'organisation'),
      // Finance runs the payroll cycle; HR supplies its inputs. PRD §19 is
      // explicit that processing payroll and altering salary terms are
      // different permissions, so there is no `people.compensation` here.
      'payroll.period': perm('organisation', 'organisation', 'organisation', 'organisation'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.financeOfficer,
    name: 'Finance Officer',
    description: 'Raises invoices, matches payments. No approval rights.',
    type: 'system',
    permissions: matrix({
      'finance.invoice': perm('organisation', 'organisation', 'own'),
      'finance.payment': perm('organisation', 'organisation', 'own'),
      'finance.expense': perm('organisation', 'own', 'own'),
      'work.approval': perm('own', 'own', 'own'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.headOfGrowth,
    name: 'Head of Growth',
    description: 'Owns the pipeline. Approves discounts between 15% and 30%.',
    type: 'system',
    permissions: matrix({
      'crm.lead': perm('organisation', 'organisation', 'organisation', 'none', 'organisation', 'organisation'),
      'crm.admission': perm('organisation', 'organisation', 'organisation', 'organisation'),
      'crm.person': perm('organisation', 'organisation', 'organisation'),
      'referral.commission': perm('organisation'),
      'engage.campaign': perm('organisation', 'organisation', 'organisation', 'organisation'),
      'work.approval': perm('department', 'own', 'own', 'department'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.salesExec,
    name: 'Sales Executive',
    description: 'Works leads in their own branch. Cannot approve a discount.',
    type: 'system',
    permissions: matrix({
      'crm.lead': perm('branch', 'own', 'own', 'none', 'own'),
      'crm.admission': perm('branch', 'own', 'own'),
      'crm.person': perm('branch', 'own', 'own'),
      'referral.commission': perm('own'),
      'work.task': perm('own', 'own', 'own'),
      'work.approval': perm('own', 'own', 'own'),
    }),
    userCount: 4,
    ...born,
  },
  {
    id: ROLE.hrManager,
    name: 'HR Manager',
    description: 'People records, leave, exits. Compensation is view-only without CFO sign-off.',
    type: 'system',
    permissions: matrix({
      'people.employee': ALL,
      'people.candidate': ALL,
      'people.compensation': perm('organisation', 'organisation', 'none', 'none', 'none', 'organisation'),
      'work.approval': perm('organisation', 'organisation', 'own', 'department'),
      'work.document': perm('organisation', 'organisation', 'organisation'),
      'payroll.period': perm('organisation'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.recruiter,
    name: 'Talent Acquisition',
    description: 'Openings, candidates, interviews. No access to employee records.',
    type: 'custom',
    permissions: matrix({
      'people.employee': perm('none'),
      'people.candidate': perm('organisation', 'organisation', 'organisation'),
      'work.task': perm('own', 'own', 'own'),
      'crm.person': perm('organisation', 'organisation', 'own'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.academyManager,
    name: 'Academy Operations Manager',
    description: 'Cohorts, timetable, tutors, attendance.',
    type: 'system',
    permissions: matrix({
      'academy.cohort': ALL,
      'academy.attendance': ALL,
      'learn.course': perm('organisation', 'organisation', 'organisation'),
      'learn.certificate': perm('organisation', 'organisation', 'none', 'organisation'),
      'crm.person': perm('organisation'),
      'work.task': perm('department', 'department', 'department'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.tutor,
    name: 'Tutor',
    description: 'Their own cohorts, their own grading queue. Nothing financial.',
    type: 'system',
    permissions: matrix({
      'academy.cohort': perm('own'),
      'academy.attendance': perm('own', 'own', 'own'),
      'learn.course': perm('own', 'none', 'own'),
      'learn.submission': perm('own', 'none', 'own'),
      'work.task': perm('own', 'own', 'own'),
    }),
    userCount: 11,
    ...born,
  },
  {
    id: ROLE.itAdmin,
    name: 'Technology Lead',
    description: 'Automations, integrations, readers and cards.',
    type: 'system',
    permissions: matrix({
      'automation.workflow': ALL,
      'settings.role': perm('organisation', 'none', 'none', 'none', 'none', 'organisation'),
      'work.task': perm('department', 'department', 'department'),
      // They own the readers, the cards and the kiosk, which is the physical
      // layer's whole job — attendance is what that hardware produces.
      'academy.attendance': perm('organisation', 'organisation', 'organisation', 'none', 'none', 'organisation'),
      // Raises and tracks IT asset and procurement requests through the same
      // engine as everyone else; approves nothing.
      'work.approval': perm('department', 'department', 'own'),
    }),
    userCount: 2,
    ...born,
  },
  {
    id: ROLE.marketing,
    name: 'Marketing Manager',
    description: 'Campaigns, segments, templates, reputation assets.',
    type: 'system',
    permissions: matrix({
      'engage.campaign': ALL,
      'crm.lead': perm('organisation', 'organisation', 'none', 'none', 'none', 'organisation'),
      'crm.person': perm('organisation'),
    }),
    userCount: 2,
    ...born,
  },
  {
    id: ROLE.corporateAm,
    name: 'Corporate Account Manager',
    description: 'B2B deals and contracts. Invoices go to the organisation, not the participant.',
    type: 'system',
    permissions: matrix({
      'crm.lead': perm('branch', 'own', 'own'),
      'crm.admission': perm('branch', 'own', 'own'),
      'finance.invoice': perm('branch', 'own', 'own'),
      'work.approval': perm('own', 'own', 'own'),
    }),
    userCount: 2,
    ...born,
  },
  {
    id: ROLE.advisor,
    name: 'Student Success Advisor',
    description: 'Watches attention flags and progress. Advisory only — no money.',
    type: 'custom',
    permissions: matrix({
      'academy.cohort': perm('organisation'),
      'academy.attendance': perm('organisation'),
      'learn.submission': perm('organisation'),
      'crm.person': perm('organisation', 'none', 'own'),
      'work.task': perm('own', 'own', 'own'),
    }),
    userCount: 3,
    ...born,
  },

  /* ---- The roles PRD §2.2 names that are not staff desks ------------------ */

  {
    id: ROLE.unitHead,
    name: 'Unit Head',
    description: 'Their own business unit in full. Organisation-wide numbers as summary only.',
    type: 'system',
    permissions: matrix({
      'crm.lead': perm('branch', 'branch', 'branch'),
      'crm.admission': perm('branch'),
      'academy.cohort': perm('branch', 'branch', 'branch'),
      'academy.attendance': perm('branch'),
      'finance.invoice': perm('branch', 'none', 'none', 'none', 'none', 'branch'),
      'finance.expense': perm('branch', 'branch', 'branch', 'branch'),
      'people.employee': perm('department'),
      'people.candidate': perm('department'),
      'work.approval': perm('department', 'department', 'none', 'department'),
      'work.task': perm('department', 'department', 'department'),
    }),
    userCount: 6,
    ...born,
  },
  {
    id: ROLE.employee,
    name: 'Employee',
    description: 'Any member of staff, in their own right: profile, attendance, leave, payslips, tasks.',
    type: 'system',
    permissions: matrix({
      'people.employee': perm('own', 'none', 'own'),
      'academy.attendance': perm('own'),
      'payroll.period': perm('own'),
      'work.task': perm('own', 'own', 'own'),
      'work.approval': perm('own', 'own'),
      'work.document': perm('own'),
    }),
    userCount: 49,
    ...born,
  },
  {
    id: ROLE.student,
    name: 'Student',
    description: 'Their own record only. Their courses, their grades, their balance.',
    type: 'system',
    permissions: matrix({
      'learn.course': perm('own'),
      'learn.submission': perm('own', 'own', 'own'),
      'learn.certificate': perm('own'),
      'academy.cohort': perm('own'),
      'academy.attendance': perm('own'),
      'finance.invoice': perm('own'),
      'finance.payment': perm('own', 'own'),
    }),
    userCount: 284,
    ...born,
  },
  {
    id: ROLE.parent,
    name: 'Parent / Guardian',
    description: "Their own child's record only. The paying customer in Cirvee Teens.",
    type: 'system',
    permissions: matrix({
      'crm.person': perm('own'),
      'learn.course': perm('own'),
      'academy.attendance': perm('own'),
      'finance.invoice': perm('own'),
      'finance.payment': perm('own', 'own'),
    }),
    userCount: 96,
    ...born,
  },
  {
    id: ROLE.corporateClient,
    name: 'Corporate Client',
    description: "Their own organisation's participants only. Attendance, progress and assessment.",
    type: 'system',
    permissions: matrix({
      'academy.cohort': perm('own'),
      'academy.attendance': perm('own'),
      'learn.submission': perm('own'),
      'learn.certificate': perm('own'),
      'finance.invoice': perm('own', 'none', 'none', 'none', 'none', 'own'),
    }),
    userCount: 14,
    ...born,
  },
  {
    id: ROLE.sponsor,
    name: 'Sponsor',
    description: 'Their own funded programme and its beneficiaries. Read-only throughout.',
    type: 'system',
    permissions: matrix({
      'academy.cohort': perm('own'),
      'academy.attendance': perm('own'),
      'learn.certificate': perm('own'),
      'finance.invoice': perm('own', 'none', 'none', 'none', 'none', 'own'),
    }),
    userCount: 4,
    ...born,
  },

  /* ---- One role per department that the desks above leave unrepresented --- */

  {
    id: ROLE.execAssistant,
    name: 'Executive Assistant',
    description: 'Runs the operating rhythm: agendas, action register, decisions, the exec diary.',
    type: 'custom',
    permissions: matrix({
      'work.task': perm('organisation', 'organisation', 'organisation'),
      'work.document': perm('organisation', 'organisation', 'organisation'),
      'work.approval': perm('organisation'),
      'crm.person': perm('organisation'),
    }),
    userCount: 1,
    ...born,
  },
  {
    id: ROLE.legalCompliance,
    name: 'Legal & Compliance',
    description: 'Contracts, data protection and the paperwork behind every approval.',
    type: 'custom',
    permissions: matrix({
      'work.document': perm('organisation', 'organisation', 'organisation', 'organisation'),
      'work.approval': perm('organisation', 'none', 'none', 'organisation'),
      'finance.invoice': perm('organisation'),
      'people.employee': perm('organisation'),
    }),
    userCount: 2,
    ...born,
  },
  {
    id: ROLE.communityManager,
    name: 'Community Manager',
    description: 'The student community, the channels and the tone. Customer Experience.',
    type: 'custom',
    permissions: matrix({
      'crm.person': perm('organisation', 'none', 'own'),
      'engage.campaign': perm('branch', 'branch', 'branch'),
      'academy.cohort': perm('branch'),
      'work.task': perm('own', 'own', 'own'),
    }),
    userCount: 3,
    ...born,
  },
  {
    id: ROLE.curriculumLead,
    name: 'Curriculum Lead',
    description: 'Course design, learning quality and assessment standards. Education.',
    type: 'custom',
    permissions: matrix({
      'learn.course': perm('organisation', 'organisation', 'organisation', 'organisation'),
      'learn.submission': perm('organisation', 'none', 'organisation'),
      'learn.certificate': perm('organisation', 'none', 'none', 'organisation'),
      'academy.cohort': perm('organisation'),
      'work.task': perm('department', 'department', 'department'),
    }),
    userCount: 4,
    ...born,
  },
  {
    id: ROLE.programmeCoordinator,
    name: 'Programme Coordinator',
    description: 'Cohort scheduling, training operations and delivery on the day.',
    type: 'custom',
    permissions: matrix({
      'academy.cohort': perm('branch', 'branch', 'branch', 'none', 'branch'),
      'academy.attendance': perm('branch', 'branch', 'branch'),
      'learn.course': perm('branch'),
      'crm.person': perm('branch'),
      'work.task': perm('department', 'department', 'department'),
    }),
    userCount: 5,
    ...born,
  },
  {
    id: ROLE.mediaLead,
    name: 'Media Lead',
    description: 'Content, design and social. Owns the proof queue and the brand.',
    type: 'custom',
    permissions: matrix({
      'engage.campaign': perm('organisation', 'organisation', 'organisation'),
      'learn.certificate': perm('branch'),
      'work.document': perm('department', 'department', 'department'),
      'work.task': perm('department', 'department', 'department'),
      // Read-only on courses, for the Content Library — they cut the video,
      // audio and podcast versions of lessons somebody else wrote.
      'learn.course': perm('branch'),
    }),
    userCount: 6,
    ...born,
  },
]

/* -------------------------------------------------------------------------- */
/* Users — one per staff member                                               */
/* -------------------------------------------------------------------------- */

/** Role assignment for the named cast; everyone generated is a Tutor or Advisor. */
const NAMED_USER_ROLES: ReadonlyArray<readonly [number, (typeof ROLE)[keyof typeof ROLE], string, number]> = [
  // [person slot, role, email handle, department index]
  [1, ROLE.superAdmin, 'adebayo.ogunlana', 0],        // Management
  [2, ROLE.salesExec, 'chidinma.eze', 3],             // Growth
  [3, ROLE.tutor, 'tunde.bakare', 5],                 // Education
  [4, ROLE.financeManager, 'fatima.abdullahi', 2],    // Finance & Legal
  [5, ROLE.cfo, 'oluwaseun.adeleke', 2],              // Finance & Legal
  [6, ROLE.headOfGrowth, 'ifeoma.nwosu', 3],          // Growth
  [7, ROLE.ceo, 'musa.danjuma', 0],                   // Management
  [8, ROLE.hrManager, 'yetunde.salami', 1],           // HR & People
  [9, ROLE.academyManager, 'emeka.okafor', 6],        // Programs & Delivery
  [10, ROLE.salesExec, 'blessing.uche', 3],           // Growth
  [11, ROLE.tutor, 'kabiru.lawal', 5],                // Education
  [12, ROLE.itAdmin, 'damilola.adeyinka', 8],         // Technology & Systems
  [13, ROLE.salesExec, 'aisha.bello', 3],             // Growth
  [14, ROLE.corporateAm, 'chukwuemeka.obi', 3],       // Growth — partnerships & BD
  [15, ROLE.advisor, 'folake.adesina', 4],            // Customer Experience
  [16, ROLE.financeOfficer, 'ibrahim.sani', 2],       // Finance & Legal
  [17, ROLE.recruiter, 'temitope.alabi', 1],          // HR & People
  [18, ROLE.marketing, 'amarachi.eze', 7],            // Media
]

/** Index into the nine departments, as used by NAMED_USER_ROLES. */
const DEPT_BY_INDEX = [
  DEPT.management,
  DEPT.hrPeople,
  DEPT.financeLegal,
  DEPT.growth,
  DEPT.customerExperience,
  DEPT.education,
  DEPT.programsDelivery,
  DEPT.media,
  DEPT.technology,
] as const

/**
 * 48 accounts — 18 named, 30 generated. The generated tail is deliberately
 * boring: tutors and advisors, so the interesting screens stay driven by the
 * named cast.
 */
export const users: User[] = STAFF_PERSON_SLOTS.map((personSlot, i) => {
  const n = i + 1
  const named = NAMED_USER_ROLES.find(([idx]) => idx === n)
  const branch = n <= 18 ? (n === 10 || n === 14 ? BR.lagos : n === 13 ? BR.virtual : BR.ibadan) : i % 5 === 0 ? BR.lagos : i % 7 === 0 ? BR.virtual : BR.ibadan
  const dept = named
    ? DEPT_BY_INDEX[named[3]]
    : i % 4 === 0
      ? DEPT.education
      : i % 4 === 1
        ? DEPT.programsDelivery
        : i % 4 === 2
          ? DEPT.customerExperience
          : DEPT.media
  const role = named ? named[1] : i % 3 === 0 ? ROLE.tutor : ROLE.advisor
  const handle = named ? named[2] : `staff${personSlot}`
  return {
    id: user(n),
    personId: `per-${String(personSlot).padStart(4, '0')}` as User['personId'],
    email: `${handle}@cirvee.com`,
    roleIds: [role],
    primaryBranchId: branch,
    departmentId: dept,
    status: 'active',
    mfaEnabled: n <= 9,
    lastLoginAt: dtAgo(n % 5, 7 + (n % 4), (n * 7) % 60),
    ...audit(`2023-0${(n % 9) + 1}-1${n % 9}T09:00:00+01:00`, SYSTEM_USER),
  } satisfies User
})

/* -------------------------------------------------------------------------- */
/* Policy versions — thresholds live here, not in code                        */
/* -------------------------------------------------------------------------- */

/** SEEDED FALSE. The deduction engine exists and ships switched off. */
const attendanceConfigV2 = {
  graceMinutes: 15,
  lateAfterMinutes: 15,
  absentAfterMinutes: 240,
  financialConsequenceEnabled: false,
  consequences: ['none', 'notify_employee', 'notify_manager'],
  adjustmentFormula: 'dailyRate * 0.5',
  adjustmentCapPerPeriod: ngn(25_000),
  disputeWindowDays: 7,
} satisfies AttendancePolicyConfig

export const policyVersions: PolicyVersion[] = [
  {
    id: 'pol-attendance-v1' as PolicyVersion['id'],
    kind: 'attendance',
    version: 1,
    effectiveFrom: '2025-01-01',
    effectiveTo: '2026-05-31',
    status: 'superseded',
    scope: {},
    config: { ...attendanceConfigV2, graceMinutes: 10, disputeWindowDays: 5 },
    setByUserId: U.yetunde,
    notes: 'Original policy. 10-minute grace. No financial consequence, ever.',
    ...audit('2024-12-18T11:00:00+01:00', U.yetunde),
  },
  {
    id: 'pol-attendance-v2' as PolicyVersion['id'],
    kind: 'attendance',
    version: 2,
    effectiveFrom: '2026-06-01',
    effectiveTo: null,
    status: 'active',
    scope: {},
    config: attendanceConfigV2,
    setByUserId: U.yetunde,
    notes:
      'Grace raised to 15 minutes after the Bodija traffic review. financialConsequenceEnabled stays false — leadership decision DEC-0009.',
    ...audit('2026-05-20T15:30:00+01:00', U.yetunde),
  },
  {
    id: 'pol-discount-v1' as PolicyVersion['id'],
    kind: 'discount_threshold',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'active',
    scope: {},
    config: {
      bands: [
        { fromPercent: 0, toPercent: 15, approverRoleId: null, label: 'No approval needed' },
        { fromPercent: 15, toPercent: 30, approverRoleId: ROLE.headOfGrowth, label: 'Head of Growth' },
        { fromPercent: 30, toPercent: null, approverRoleId: ROLE.ceo, label: 'Chief Executive' },
      ],
    },
    setByUserId: U.musa,
    notes: 'Provisional band. PRD open decision #1 — the founder has not confirmed these numbers.',
    ...audit('2025-12-14T10:00:00+01:00', U.musa),
  },
  {
    id: 'pol-approval-v2' as PolicyVersion['id'],
    kind: 'approval_threshold',
    version: 2,
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
    status: 'active',
    scope: {},
    config: {
      refundCfoAbove: ngn(150_000),
      expenseManagerAbove: ngn(100_000),
      expenseCfoAbove: ngn(750_000),
      payoutCfoAbove: ngn(1_000_000),
    },
    setByUserId: U.oluwaseun,
    notes: 'Raised from ₦100,000 to ₦150,000 on refunds after the Q1 review.',
    ...audit('2026-03-22T16:10:00+01:00', U.oluwaseun),
  },
  {
    id: 'pol-sla-lead-response-v1' as PolicyVersion['id'],
    kind: 'sla',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'active',
    scope: {},
    config: { leadFirstResponseMinutes: 120, ticketFirstResponseHours: 4, approvalDefaultHours: 48 },
    setByUserId: U.ifeoma,
    notes:
      'The PRD requires the response clock but never states a target. 120 minutes is a placeholder — open question #6.',
    ...audit('2025-12-29T09:20:00+01:00', U.ifeoma),
  },
  {
    id: 'pol-cert-default-v1' as PolicyVersion['id'],
    kind: 'certificate_default',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'active',
    scope: {},
    config: {
      attendanceThreshold: 75,
      contentCompletionThreshold: 100,
      financialClearanceRequired: true,
      autoIssue: false,
    },
    setByUserId: U.emeka,
    notes: 'Course-level rules override these. Financial clearance is on by default.',
    ...audit('2025-12-29T09:40:00+01:00', U.emeka),
  },
  {
    id: 'pol-commission-payout-v1' as PolicyVersion['id'],
    kind: 'commission_payout',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'active',
    scope: {},
    config: { targetDaysEarnedToPaid: 14, batchCadence: 'monthly', minimumPayout: ngn(5_000) },
    setByUserId: U.oluwaseun,
    notes: '"A referral programme that pays late dies within one cohort." Target is 14 days.',
    ...audit('2025-12-29T10:00:00+01:00', U.oluwaseun),
  },
  {
    id: 'pol-leave-v1' as PolicyVersion['id'],
    kind: 'leave_entitlement',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'active',
    scope: { employmentType: 'full_time' },
    config: { annual: 20, sick: 7, compassionate: 3, maternity: 120, paternity: 10, study: 5 },
    setByUserId: U.yetunde,
    notes: 'Full-time entitlement. Contract staff accrue pro rata.',
    ...audit('2025-12-29T10:20:00+01:00', U.yetunde),
  },
]

/* -------------------------------------------------------------------------- */
/* Demo scaffolding                                                           */
/* -------------------------------------------------------------------------- */

/** The signed-in user for the whole prototype. Flow 3 switches this by hand. */
export const CURRENT_USER_ID = U.adebayo
export const CURRENT_PERSON_ID = P.adebayo
export const CURRENT_ROLE_ID = asRoleId('role-super-admin')
