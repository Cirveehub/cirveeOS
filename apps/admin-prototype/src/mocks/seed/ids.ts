/**
 * Well-known ids.
 *
 * The cast of the demo is named here once, so seed files can reference each
 * other without importing each other (and without import cycles). Everything
 * in here is a branded id — `P.ngozi` is a `PersonId`, not a string, so you
 * cannot accidentally put it in a `UserId` field.
 *
 * Ids are readable on purpose. Ops staff say them out loud.
 */

import {
  pid,
  uid,
  branchId,
  unitId,
  deptId,
  teamId,
  roleId,
  employeeId,
  courseId,
  cohortId,
  policyId,
  routeId,
  templateId,
  periodId,
  ruleId,
  referrerId,
  admissionId,
  invoiceId,
  commissionId,
  approvalId,
  enrollmentId,
  accountId,
  clientOrgId,
  segmentId,
  msgTemplateId,
  automationId,
} from '@/mocks/types'
import { pad } from '@/mocks/seed/_helpers'

/* -------------------------------------------------------------------------- */
/* Organisation, branches, units                                              */
/* -------------------------------------------------------------------------- */

export const ORG = { cirvee: 'org-cirvee' } as const

export const BR = {
  ibadan: branchId('br-ibadan-hq'),
  lagos: branchId('br-lagos'),
  virtual: branchId('br-virtual'),
} as const

export const UNIT = {
  academy: unitId('unit-academy'),
  teens: unitId('unit-teens'),
  corporate: unitId('unit-corporate'),
  dexurb: unitId('unit-dexurb'),
  africa: unitId('unit-africa'),
  tcf: unitId('unit-tcf'),
} as const

/**
 * Cirvee's nine core departments, as the business actually runs them.
 *
 * `academy`, `corporate` and `marketing` are kept as aliases because seed
 * rows and generated staff still reference them; they resolve onto the real
 * departments that absorbed them — Education, Growth and Growth.
 */
const DEPT_CORE = {
  management: deptId('dept-management'),
  hrPeople: deptId('dept-hr-people'),
  financeLegal: deptId('dept-finance-legal'),
  growth: deptId('dept-growth'),
  customerExperience: deptId('dept-customer-experience'),
  education: deptId('dept-education'),
  programsDelivery: deptId('dept-programs-delivery'),
  media: deptId('dept-media'),
  technology: deptId('dept-technology'),
} as const

/**
 * The nine real departments, plus the superseded names as aliases so existing
 * seed rows keep resolving. `DEPT.finance` and `DEPT.financeLegal` are the
 * same id — only the nine in `departments` are rendered anywhere.
 */
export const DEPT = {
  ...DEPT_CORE,
  exec: DEPT_CORE.management,
  finance: DEPT_CORE.financeLegal,
  academy: DEPT_CORE.education,
  people: DEPT_CORE.hrPeople,
  tech: DEPT_CORE.technology,
  corporate: DEPT_CORE.growth,
  marketing: DEPT_CORE.media,
} as const

/** The nine, in the order the business lists them. */
export const DEPARTMENT_ORDER = [
  DEPT_CORE.management,
  DEPT_CORE.hrPeople,
  DEPT_CORE.financeLegal,
  DEPT_CORE.growth,
  DEPT_CORE.customerExperience,
  DEPT_CORE.education,
  DEPT_CORE.programsDelivery,
  DEPT_CORE.media,
  DEPT_CORE.technology,
] as const

export const TEAM = {
  ibadanSales: teamId('team-ibadan-sales'),
  lagosSales: teamId('team-lagos-sales'),
  virtualSales: teamId('team-virtual-sales'),
  reconciliation: teamId('team-reconciliation'),
  dataTutors: teamId('team-data-tutors'),
} as const

export const ROLE = {
  superAdmin: roleId('role-super-admin'),
  ceo: roleId('role-ceo'),
  cfo: roleId('role-cfo'),
  financeManager: roleId('role-finance-manager'),
  financeOfficer: roleId('role-finance-officer'),
  headOfGrowth: roleId('role-head-growth'),
  salesExec: roleId('role-sales-exec'),
  hrManager: roleId('role-hr-manager'),
  recruiter: roleId('role-recruiter'),
  academyManager: roleId('role-academy-manager'),
  tutor: roleId('role-tutor'),
  itAdmin: roleId('role-it-admin'),
  marketing: roleId('role-marketing'),
  corporateAm: roleId('role-corporate-am'),
  advisor: roleId('role-advisor'),
  unitHead: roleId('role-unit-head'),
  employee: roleId('role-employee'),
  student: roleId('role-student'),
  parent: roleId('role-parent'),
  corporateClient: roleId('role-corporate-client'),
  sponsor: roleId('role-sponsor'),
  execAssistant: roleId('role-exec-assistant'),
  legalCompliance: roleId('role-legal-compliance'),
  communityManager: roleId('role-community-manager'),
  curriculumLead: roleId('role-curriculum-lead'),
  programmeCoordinator: roleId('role-programme-coordinator'),
  mediaLead: roleId('role-media-lead'),
} as const

/* -------------------------------------------------------------------------- */
/* The cast — persons                                                         */
/* -------------------------------------------------------------------------- */

/** `per-0001` … `per-0640`. The first 52 slots are the named cast and staff. */
export const person = (n: number) => pid(`per-${pad(n)}`)

export const P = {
  /** Super Admin — the signed-in user. Closer on the Flow 1 deal. */
  adebayo: person(1),
  /** Sales Executive, Ibadan. Lead owner on the Flow 1 deal. */
  chidinma: person(2),
  /** Alumna, referrer REF-0142, code NGOZI15. */
  ngozi: person(3),
  /** The learner at the centre of Flows 1, 3 and 5. */
  chiamaka: person(4),
  /** Lead tutor, Data Analysis. */
  tundeBakare: person(5),
  /** Finance Manager — step 1 approver on refunds. */
  fatima: person(6),
  /** CFO — step 2 approver above ₦150,000. */
  oluwaseun: person(7),
  /** Head of Growth — discount approver 15–30%. */
  ifeoma: person(8),
  /** CEO — final escalation. */
  musa: person(9),
  yetunde: person(10),
  emeka: person(11),
  blessing: person(12),
  kabiru: person(13),
  damilola: person(14),
  aisha: person(15),
  chukwuemeka: person(16),
  folake: person(17),
  ibrahim: person(18),
  temitope: person(19),
  amarachi: person(20),
  /** Student with a ₦120,000 balance — certificate blocked on clearance. */
  tundeAdeyemi: person(21),
  /** The open duplicate of Chiamaka: same name, same phone, different email. */
  chiamakaDupe: person(22),
} as const

/** Person slots reserved for staff who are not part of the named cast. */
export const STAFF_BLOCK = { from: 23, to: 52 } as const
/** Everything above this is a student, lead, parent, candidate or contact. */
export const PUBLIC_BLOCK = { from: 53, to: 640 } as const

/* -------------------------------------------------------------------------- */
/* Users and employees — 1:1 with the 48 staff persons                        */
/* -------------------------------------------------------------------------- */

export const user = (n: number) => uid(`usr-${pad(n)}`)
export const employee = (n: number) => employeeId(`emp-${pad(n)}`)

/**
 * Staff index → person slot. Index 0 is Adebayo, who is `usr-0001`/`emp-0001`.
 * The named cast is interleaved with three non-staff (Ngozi, Chiamaka, the
 * duplicate), so this list is explicit rather than arithmetic.
 */
export const STAFF_PERSON_SLOTS: readonly number[] = [
  1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
  43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
]

export const U = {
  adebayo: user(1),
  chidinma: user(2),
  tundeBakare: user(3),
  fatima: user(4),
  oluwaseun: user(5),
  ifeoma: user(6),
  musa: user(7),
  yetunde: user(8),
  emeka: user(9),
  blessing: user(10),
  kabiru: user(11),
  damilola: user(12),
  aisha: user(13),
  chukwuemeka: user(14),
  folake: user(15),
  ibrahim: user(16),
  temitope: user(17),
  amarachi: user(18),
} as const

export const E = {
  adebayo: employee(1),
  chidinma: employee(2),
  tundeBakare: employee(3),
  fatima: employee(4),
  oluwaseun: employee(5),
  ifeoma: employee(6),
  musa: employee(7),
  yetunde: employee(8),
  emeka: employee(9),
  blessing: employee(10),
  kabiru: employee(11),
  damilola: employee(12),
  aisha: employee(13),
  chukwuemeka: employee(14),
  folake: employee(15),
  ibrahim: employee(16),
  temitope: employee(17),
  amarachi: employee(18),
} as const

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export const C = {
  dataAnalysis: courseId('da-101'),
  productDesign: courseId('pd-101'),
  frontend: courseId('fe-101'),
  backend: courseId('be-101'),
  digitalMarketing: courseId('dm-101'),
  cyber: courseId('cs-101'),
  productManagement: courseId('pm-101'),
  dataScience: courseId('ds-201'),
  cloud: courseId('cl-201'),
  graphics: courseId('gd-101'),
  videoEditing: courseId('ve-101'),
  mobile: courseId('md-201'),
  teensCoding: courseId('tc-101'),
  teensRobotics: courseId('tr-101'),
  corporateExcel: courseId('ex-101'),
} as const

export const cohort = (code: string) => cohortId(`coh-${code.toLowerCase()}`)

export const CO = {
  /** Completing. Chiamaka's cohort in Flow 5. */
  daC12: cohort('DA-C12'),
  /** Starts 5 Oct 2026, 18 of 25 seats taken. The Flow 1 destination. */
  daC13: cohort('DA-C13'),
} as const

/* -------------------------------------------------------------------------- */
/* Policy, routes, templates, periods                                         */
/* -------------------------------------------------------------------------- */

export const POLICY = {
  attendanceV1: policyId('pol-attendance-v1'),
  attendanceV2: policyId('pol-attendance-v2'),
  discountThreshold: policyId('pol-discount-v1'),
  approvalThreshold: policyId('pol-approval-v2'),
  leadResponseSla: policyId('pol-sla-lead-response-v1'),
  certificateDefault: policyId('pol-cert-default-v1'),
  commissionPayout: policyId('pol-commission-payout-v1'),
  leaveEntitlement: policyId('pol-leave-v1'),
} as const

export const ROUTE = {
  expense: routeId('rt-expense-v2'),
  refund: routeId('rt-refund-v3'),
  discount: routeId('rt-discount-v2'),
  leave: routeId('rt-leave-v1'),
  hire: routeId('rt-hire-v1'),
  salaryChange: routeId('rt-salary-v1'),
  procurement: routeId('rt-procurement-v1'),
  contractSignature: routeId('rt-contract-v1'),
  commissionDispute: routeId('rt-commdispute-v1'),
  commissionApproval: routeId('rt-commapproval-v1'),
  payout: routeId('rt-payout-v1'),
} as const

export const TPL = {
  certificate: templateId('tpl-certificate'),
  offerLetter: templateId('tpl-offer-letter'),
  invoicePdf: templateId('tpl-invoice'),
  receipt: templateId('tpl-receipt'),
  corporateContract: templateId('tpl-corporate-contract'),
  confirmationLetter: templateId('tpl-confirmation'),
  exitClearance: templateId('tpl-exit-clearance'),
  payslip: templateId('tpl-payslip'),
} as const

export const PERIOD = {
  jul2026: periodId('per-2026-07'),
  aug2026: periodId('per-2026-08'),
  sep2026: periodId('per-2026-09'),
} as const

/* -------------------------------------------------------------------------- */
/* Referral & commission anchors                                              */
/* -------------------------------------------------------------------------- */

/** `cr-004` is the alumni-referral rule key; its versions are `cr-004-v1`… */
export const RULE = {
  alumniV1: ruleId('cr-004-v1'),
  alumniV2: ruleId('cr-004-v2'),
  /** Active from 1 Jul 2026. 38 commissions computed under it. */
  alumniV3: ruleId('cr-004-v3'),
  studentV1: ruleId('cr-001-v1'),
  studentV2: ruleId('cr-001-v2'),
  closerV1: ruleId('cr-002-v1'),
  staffV1: ruleId('cr-003-v1'),
  staffV2: ruleId('cr-003-v2'),
  corporateV1: ruleId('cr-005-v1'),
  corporateV2: ruleId('cr-005-v2'),
  influencerV1: ruleId('cr-006-v1'),
} as const

/** Ngozi Adeyemi's referrer profile — REF-0142, code NGOZI15. */
export const NGOZI_REFERRER = referrerId('ref-0142')

/* -------------------------------------------------------------------------- */
/* Flow anchors — the records the five scripted flows start from              */
/* -------------------------------------------------------------------------- */

/**
 * Chiamaka's DA-C12 admission: ₦450,000 less 10% = ₦405,000, two instalments
 * of ₦202,500, both paid, balance ₦0. It is the starting state for Flow 3
 * (refund → proportional reversal of an **already-paid** commission) and for
 * Flow 5 (financial clearance satisfied, so the certificate can issue).
 */
export const FLOW = {
  chiamakaAdmission: admissionId('adm-0151'),
  chiamakaInvoice: invoiceId('inv-0851'),
  chiamakaAccount: accountId('acct-0151'),
  chiamakaEnrollment: enrollmentId('enr-0151'),

  /** Tunde Adeyemi — eligible on merit, blocked on a ₦120,000 balance. */
  tundeAdmission: admissionId('adm-0149'),
  tundeInvoice: invoiceId('inv-0849'),
  tundeAccount: accountId('acct-0149'),
  tundeEnrollment: enrollmentId('enr-0149'),

  /** Ngozi's ₦40,500 referral commission on that admission. Already Paid. */
  refundReadyCommission: commissionId('com-0441'),
  refundReadyInvoice: invoiceId('inv-0851'),
  refundReadyAdmission: admissionId('adm-0151'),

  /** Pending approval raised by the signed-in user — self-approval must block. */
  selfRaisedApproval: approvalId('apr-0311'),
} as const

/* -------------------------------------------------------------------------- */
/* Corporate, engage, automation anchors                                      */
/* -------------------------------------------------------------------------- */

export const ORGS = {
  sterling: clientOrgId('cli-sterling'),
  interswitch: clientOrgId('cli-interswitch'),
  flutterwave: clientOrgId('cli-flutterwave'),
  oando: clientOrgId('cli-oando'),
  mtn: clientOrgId('cli-mtn'),
  dangote: clientOrgId('cli-dangote'),
  ibedc: clientOrgId('cli-ibedc'),
  sycamore: clientOrgId('cli-sycamore'),
} as const

export const SEG = {
  alumni: segmentId('seg-alumni'),
  stalledLeads: segmentId('seg-stalled-leads'),
  overdueBalance: segmentId('seg-overdue-balance'),
  teensParents: segmentId('seg-teens-parents'),
  corporateContacts: segmentId('seg-corporate-contacts'),
  lowActivityLearners: segmentId('seg-low-activity'),
} as const

export const MSGT = {
  paymentReceipt: msgTemplateId('mt-payment-receipt'),
  welcomeEnrolment: msgTemplateId('mt-welcome-enrolment'),
  overdueReminder: msgTemplateId('mt-overdue-reminder'),
  leadFirstTouch: msgTemplateId('mt-lead-first-touch'),
  certificateIssued: msgTemplateId('mt-certificate-issued'),
  referrerEarned: msgTemplateId('mt-referrer-earned'),
  classReminder: msgTemplateId('mt-class-reminder'),
  reviewRequest: msgTemplateId('mt-review-request'),
} as const

export const AUTO = {
  /** The PRD's reference journey, built live in Flow 4. Seeded at v1. */
  tuitionPaid: automationId('auto-tuition-paid-v1'),
  leadFirstTouch: automationId('auto-lead-first-touch-v2'),
  overdueChase: automationId('auto-overdue-chase-v1'),
  certificateCascade: automationId('auto-certificate-cascade-v1'),
} as const
