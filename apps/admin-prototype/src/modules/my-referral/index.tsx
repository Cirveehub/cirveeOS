import { Gift } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Page from './Page'

/**
 * Every persona's personal referral page — generate a link, see who signed
 * up with it, see what it earned. No `permission`: unlike a job-function
 * module, eligibility to hold a referral code isn't tied to a role, and
 * every query inside this module is scoped to the signed-in `personId`
 * regardless of what the sidebar shows, so there is nothing to permission-gate.
 *
 * This is the self-service half of `referral` (`Referral & commission`),
 * the existing team-scoped admin module that already builds, approves and
 * pays commissions — this module reads and writes the exact same
 * collections, just filtered to one person's own record. See that module's
 * `lib.ts`/`parts.tsx` for the labels and badges reused here.
 */
export default defineModule({
  id: 'my-referral',
  label: 'My referral',
  icon: Gift,
  base: '/my-referral',
  group: 'personal',
  depth: 'deep',
  summary: 'Your referral link, who signed up with it, and what you have earned.',
  routes: [{ path: '', element: <Page /> }],
})
