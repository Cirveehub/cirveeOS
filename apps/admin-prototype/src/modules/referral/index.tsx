import { Share2 } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Referrers from './Referrers'
import ReferrerProfile from './ReferrerProfile'
import Rules from './Rules'
import RuleBuilder from './RuleBuilder'
import RuleVersion from './RuleVersion'
import Ledger from './Ledger'
import Payouts, { NewPayout, PayoutDetail } from './Payouts'
import Disputes from './Disputes'
import Attribution from './Attribution'

export default defineModule({
  id: 'referral',
  label: 'Referral & commission',
  icon: Share2,
  base: '/referral',
  group: 'growth',
  depth: 'deep',
  summary: 'Referrers, the commission rule builder, the commission ledger and payouts.',
  permission: 'referral.commission.view.team',
  routes: [
    { path: '', element: <Dashboard /> },

    { path: 'referrers', element: <Referrers /> },
    { path: 'referrers/:id', element: <ReferrerProfile /> },

    { path: 'rules', element: <Rules /> },
    // `new` precedes `:id` so it is matched as a literal, not as an id.
    { path: 'rules/new', element: <RuleBuilder /> },
    { path: 'rules/:id/edit', element: <RuleBuilder /> },
    { path: 'rules/:id', element: <RuleVersion /> },

    { path: 'commissions', element: <Ledger /> },

    { path: 'payouts', element: <Payouts /> },
    // `NewPayout` and `PayoutDetail` were written but never routed — both of
    // these fell through to the batch list, so "Run payout" and every batch
    // row landed back where they started. `new` precedes `:id` so it is
    // matched as a literal.
    { path: 'payouts/new', element: <NewPayout /> },
    { path: 'payouts/:id', element: <PayoutDetail /> },

    { path: 'disputes', element: <Disputes /> },

    { path: 'attribution', element: <Attribution /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Referrers', to: 'referrers' },
    { label: 'Commission rules', to: 'rules' },
    { label: 'Ledger', to: 'commissions' },
    { label: 'Payouts', to: 'payouts' },
    { label: 'Disputes', to: 'disputes' },
    { label: 'Attribution', to: 'attribution' },
  ],
})
