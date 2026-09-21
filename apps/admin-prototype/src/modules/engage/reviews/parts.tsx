import { useMemo } from 'react'

import type { BadgeTone } from '@/ui'
import { TODAY, branchesCollection, cohortsCollection, coursesCollection, useCollection } from '@/mocks'
import type { ProofAsset, ProofAssetType, ReviewTriggerMoment, Testimonial } from '@/mocks'

export { CHANNEL_LABEL, ErrorPanel, useModuleData, usePersonName, useUserName } from '../parts'

export const MOMENT_LABEL: Record<ReviewTriggerMoment, string> = {
  certificate_issued: 'Certificate issued',
  strong_grade: 'Strong grade',
  placement_confirmed: 'Placement confirmed',
  corporate_engagement_completed: 'Corporate training completed',
  exit_kiosk_tap: 'Tapped the exit kiosk',
}

export const MOMENTS: ReviewTriggerMoment[] = [
  'certificate_issued',
  'strong_grade',
  'placement_confirmed',
  'corporate_engagement_completed',
]

export const TESTIMONIAL_STATUS_LABEL: Record<Testimonial['status'], string> = {
  new: 'New',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
}

export const TESTIMONIAL_STATUS_TONE: Record<Testimonial['status'], BadgeTone> = {
  new: 'info',
  approved: 'accent',
  published: 'success',
  archived: 'neutral',
}

export const STORY_TYPE_LABEL: Record<ProofAssetType, string> = {
  graduation: 'Graduation',
  placement: 'Placement',
  standout_project: 'Standout project',
  cohort_milestone: 'Cohort milestone',
}

export const STORY_STATUS_LABEL: Record<ProofAsset['status'], string> = {
  drafted: 'To make',
  in_production: 'Being made',
  approved: 'Approved',
  published: 'Published',
  discarded: 'Discarded',
}

export const STORY_STATUS_TONE: Record<ProofAsset['status'], BadgeTone> = {
  drafted: 'neutral',
  in_production: 'warning',
  approved: 'accent',
  published: 'success',
  discarded: 'neutral',
}

export const CONSENT_LABEL: Record<ProofAsset['consentStatus'], string> = {
  granted: 'Granted',
  pending: 'Pending',
  declined: 'Declined',
}

export const CONSENT_TONE: Record<ProofAsset['consentStatus'], BadgeTone> = {
  granted: 'success',
  pending: 'warning',
  declined: 'danger',
}

export function useCourseTitle(): (id: string | null | undefined) => string {
  const courses = useCollection(coursesCollection)
  const byId = useMemo(() => new Map(courses.map((c) => [c.id as string, c.title])), [courses])
  return (id) => (id ? (byId.get(id) ?? 'Unknown course') : '—')
}

export function useCohortCode(): (id: string | null | undefined) => string {
  const cohorts = useCollection(cohortsCollection)
  const byId = useMemo(() => new Map(cohorts.map((c) => [c.id as string, c.code])), [cohorts])
  return (id) => (id ? (byId.get(id) ?? 'Unknown cohort') : 'No cohort')
}

export function useBranchName(): (id: string | null | undefined) => string {
  const branches = useCollection(branchesCollection)
  const byId = useMemo(() => new Map(branches.map((b) => [b.id as string, b.name])), [branches])
  return (id) => (id ? (byId.get(id) ?? 'Unknown branch') : '—')
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000,
  )
}

export function daysAgo(isoDateTime: string): number {
  return Math.max(0, daysBetween(isoDateTime, TODAY))
}

export function agoLabel(isoDateTime: string): string {
  const days = daysAgo(isoDateTime)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  const years = Math.round(days / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}

export function isWithin30Days(isoDateTime: string): boolean {
  const days = daysBetween(isoDateTime, TODAY)
  return days >= 0 && days <= 30
}

export function isThisMonth(isoDateTime: string): boolean {
  return isoDateTime.slice(0, 7) === TODAY.slice(0, 7)
}

export function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((acc, v) => acc + v, 0) / values.length
}
