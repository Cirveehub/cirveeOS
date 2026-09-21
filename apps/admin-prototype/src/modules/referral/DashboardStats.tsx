/**
 * The referral dashboard's numbers, one component per theme.
 *
 * `Dashboard.tsx` used to render eight `StatCard`s in a single flat grid and
 * then four more panels below them, all computed on every render. The page is
 * now tabbed and this file is split to match, so a tab nobody opens costs
 * nothing to derive. Each band also states its own one-sentence answer in
 * plain English, because eight numbers in a grid is a wall and the same eight
 * under a question is a briefing.
 *
 * Every figure is still a selector call against the live ledger. Approve a
 * commission and the payable card moves without a reload.
 */

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Clock, Coins, Percent, TrendingUp, Users, Wallet } from 'lucide-react'

import {
  LAST_90D,
  MTD,
  averageDaysEarnedToPaid,
  commissionCountsByState,
  commissionTotalsByState,
  payoutBatchesCollection,
  referralConversionComparison,
  referralsCollection,
  referrerProfilesCollection,
  useCollection,
} from '@/mocks'
import { StatCard } from '@/ui'
import { formatNaira, formatNumber, formatPercent } from '@/lib/format'

/* -------------------------------------------------------------------------- */
/* The band shell                                                             */
/* -------------------------------------------------------------------------- */

export function Band({
  question,
  answer,
  children,
}: {
  question: string
  answer: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={question}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-heading-18 text-text">{question}</h2>
        <p className="text-body-13 text-text-secondary">{answer}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Overview — the four-number read                                            */
/* -------------------------------------------------------------------------- */

/**
 * The two figures the PRD insists on — referral conversion against the overall
 * rate (the business case for the module existing) and average days from
 * earned to paid (a scheme that pays late dies within one cohort) — plus what
 * has been earned and what is ready to go out.
 */
export function OverviewHeadlines() {
  const navigate = useNavigate()
  const mtd = commissionTotalsByState({ range: MTD })
  const totals = commissionTotalsByState()
  const counts = commissionCountsByState()
  const conversion = referralConversionComparison(LAST_90D)
  const avgDays = averageDaysEarnedToPaid()

  const earnedMtd = mtd.earned + mtd.approved + mtd.payable + mtd.paid
  const approvedAndPayable = totals.approved + totals.payable

  return (
    <Band
      question="Is the referral scheme working?"
      answer={
        <>
          Referrals convert at {formatPercent(conversion.referral)} against{' '}
          {formatPercent(conversion.overall)} overall, and take {avgDays.toFixed(1)} days to get paid
          once earned.
        </>
      }
    >
      <StatCard
        label="Referral conversion"
        value={formatPercent(conversion.referral)}
        variant={conversion.referral >= conversion.overall ? 'success' : 'warning'}
        delta={{
          value: conversion.referral - conversion.overall,
          tone: conversion.referral >= conversion.overall ? 'positive' : 'negative',
          label: `against ${formatPercent(conversion.overall)} overall`,
        }}
        icon={Percent}
      />
      <StatCard
        label="Average days, earned to paid"
        value={avgDays.toFixed(1)}
        caption="A scheme that pays late dies within one cohort"
        variant={avgDays > 14 ? 'danger' : avgDays > 10 ? 'warning' : 'success'}
        icon={Clock}
        onClick={() => navigate('/referral/payouts')}
      />
      <StatCard
        label="Commission earned, month to date"
        value={formatNaira(earnedMtd)}
        caption="Earned, approved, payable and paid this month"
        icon={Coins}
        onClick={() => navigate('/referral/commissions?state=earned')}
      />
      <StatCard
        label="Approved and payable"
        value={formatNaira(approvedAndPayable)}
        caption={`${formatNumber(counts.approved + counts.payable)} ready for a payout batch`}
        variant="success"
        icon={BadgeCheck}
        onClick={() => navigate('/referral/commissions?state=payable')}
      />
    </Band>
  )
}

/* -------------------------------------------------------------------------- */
/* Referrers                                                                  */
/* -------------------------------------------------------------------------- */

export function ReferrersBand() {
  const navigate = useNavigate()
  const profiles = useCollection(referrerProfilesCollection)
  const referrals = useCollection(referralsCollection)
  const conversion = referralConversionComparison(LAST_90D)

  const active = profiles.filter((p) => p.status === 'active').length
  const suspended = profiles.filter((p) => p.status === 'suspended').length
  const inWindow = referrals.filter(
    (r) => r.capturedAt.slice(0, 10) >= LAST_90D.from && r.capturedAt.slice(0, 10) <= LAST_90D.to,
  )
  const converted = inWindow.filter((r) => r.admissionId !== null).length

  return (
    <Band
      question="Who is bringing people in?"
      answer={
        <>
          {formatNumber(active)} active referrers produced {formatNumber(inWindow.length)} referrals
          in the last ninety days, {formatNumber(converted)} of which became admissions.
        </>
      }
    >
      <StatCard
        label="Active referrers"
        value={formatNumber(active)}
        caption={`${formatNumber(profiles.length)} profiles in total`}
        icon={Users}
        onClick={() => navigate('/referral/referrers?status=active')}
      />
      <StatCard
        label="Referrals, last 90 days"
        value={formatNumber(inWindow.length)}
        caption={`${formatNumber(converted)} converted to an admission`}
        icon={TrendingUp}
        onClick={() => navigate('/referral/referrers')}
      />
      <StatCard
        label="Referral conversion"
        value={formatPercent(conversion.referral)}
        variant={conversion.referral >= conversion.overall ? 'success' : 'warning'}
        caption={`Overall lead conversion is ${formatPercent(conversion.overall)}`}
        icon={Percent}
      />
      <StatCard
        label="Suspended"
        value={formatNumber(suspended)}
        caption="Suspended, never deleted — the history stays"
        variant={suspended > 0 ? 'warning' : 'default'}
        icon={Users}
        onClick={() => navigate('/referral/referrers?status=suspended')}
      />
    </Band>
  )
}

/* -------------------------------------------------------------------------- */
/* Payment health                                                             */
/* -------------------------------------------------------------------------- */

export function PaymentBand() {
  const navigate = useNavigate()
  const batches = useCollection(payoutBatchesCollection)
  const totals = commissionTotalsByState()
  const counts = commissionCountsByState()
  const mtd = commissionTotalsByState({ range: MTD })
  const avgDays = averageDaysEarnedToPaid()

  const draftBatch = batches.find((b) => b.status === 'draft')

  return (
    <Band
      question="Is the money actually going out?"
      answer={
        <>
          {formatNaira(totals.pending)} is held on an eligibility condition and{' '}
          {formatNaira(totals.approved + totals.payable)} is ready to pay. Earned commission takes{' '}
          {avgDays.toFixed(1)} days to reach a bank account.
        </>
      }
    >
      <StatCard
        label="Pending"
        value={formatNaira(totals.pending)}
        caption={`${formatNumber(counts.pending)} held on an eligibility condition`}
        variant="warning"
        icon={Clock}
        onClick={() => navigate('/referral/commissions?state=pending')}
      />
      <StatCard
        label="Approved and payable"
        value={formatNaira(totals.approved + totals.payable)}
        caption={`${formatNumber(counts.approved + counts.payable)} ready for a payout batch`}
        variant="success"
        icon={BadgeCheck}
        onClick={() => navigate('/referral/commissions?state=payable')}
      />
      <StatCard
        label="Paid, month to date"
        value={formatNaira(mtd.paid)}
        caption={draftBatch ? `${draftBatch.ref} is open as a draft batch` : 'No draft batch open'}
        icon={Wallet}
        onClick={() => navigate('/referral/payouts')}
      />
      <StatCard
        label="Average days, earned to paid"
        value={avgDays.toFixed(1)}
        caption="Measured from the date eligibility was met"
        variant={avgDays > 14 ? 'danger' : avgDays > 10 ? 'warning' : 'success'}
        icon={Clock}
      />
    </Band>
  )
}
