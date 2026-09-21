/**
 * The loading state, shaped like the screen it stands in for: four bands of
 * stat cards, then the brief and the rail, then the charts. Never a centred
 * spinner on a blank page.
 */

import { Card, Skeleton, SkeletonCard, SkeletonText } from '@/ui'

function Band() {
  return (
    <div className="space-y-3">
      <Skeleton width={190} height={18} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} variant="stat" />
        ))}
      </div>
    </div>
  )
}

export function ExecutiveHomeSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="Loading the command centre">
      <Band />
      <Band />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padding="default">
          <Skeleton width={220} height={16} />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 7 }, (_, index) => (
              <SkeletonText key={index} lines={2} />
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} padding="default">
              <Skeleton width={160} height={14} />
              <div className="mt-4 space-y-3">
                <SkeletonText lines={4} />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padding="default">
          <Skeleton width={180} height={16} />
          <Skeleton height={220} className="mt-5" rounded="lg" />
        </Card>
        <Card padding="default">
          <Skeleton width={140} height={16} />
          <Skeleton height={220} className="mt-5" rounded="lg" />
        </Card>
      </div>
    </div>
  )
}

export function EmployeeHomeSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" role="status" aria-busy="true" aria-label="Loading your home">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} padding="default">
          <Skeleton width={150} height={14} />
          <div className="mt-4">
            <SkeletonText lines={5} />
          </div>
        </Card>
      ))}
    </div>
  )
}
