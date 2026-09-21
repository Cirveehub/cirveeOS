import { HandCoins, Percent, Share2, Users } from 'lucide-react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { defineModule } from '@/app/module-registry'

import Referrers from './Referrers'
import ReferrerProfile from './ReferrerProfile'
import Rates from './Rates'
import RuleVersion from './RuleVersion'
import Ledger from './Ledger'
import Payouts, { NewPayout, PayoutBatches, PayoutDetail } from './Payouts'
import Disputes from './Disputes'
import Attribution from './Attribution'

function RedirectKeepingSearch({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

function RuleEditRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/referral/rates?edit=${id ?? ''}`} replace />
}

export default defineModule({
  id: 'referral',
  label: 'Referrals',
  icon: Share2,
  base: '/referral',
  group: 'growth',
  depth: 'deep',
  summary: 'Who has a referral link, who is owed money, and the rates that decide how much.',
  permission: 'referral.commission.view.team',
  routes: [
    { path: '', element: <Navigate to="/referral/referrers" replace /> },

    { path: 'referrers', element: <Referrers /> },
    { path: 'referrers/:id', element: <ReferrerProfile /> },

    { path: 'payouts', element: <Payouts /> },
    { path: 'payouts/history', element: <Ledger /> },
    { path: 'payouts/batches', element: <PayoutBatches /> },
    { path: 'payouts/new', element: <NewPayout /> },
    { path: 'payouts/:id', element: <PayoutDetail /> },
    { path: 'commissions', element: <RedirectKeepingSearch to="/referral/payouts/history" /> },

    { path: 'rates', element: <Rates /> },
    { path: 'rules', element: <RedirectKeepingSearch to="/referral/rates" /> },
    { path: 'rules/new', element: <Navigate to="/referral/rates?new=1" replace /> },
    { path: 'rules/:id/edit', element: <RuleEditRedirect /> },
    { path: 'rules/:id', element: <RuleVersion /> },

    { path: 'disputes', element: <Disputes /> },
    { path: 'attribution', element: <Attribution /> },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Referrers', to: 'referrers', icon: Users },
    { label: 'Payouts', to: 'payouts', icon: HandCoins },
    { label: 'Rates', to: 'rates', icon: Percent },
  ],
})
