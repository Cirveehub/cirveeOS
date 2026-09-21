import { Construction } from 'lucide-react'

/**
 * Temporary module index, replaced as each module is built.
 * Present so the shell and navigation are fully walkable from day one.
 */
export default function Placeholder({
  module,
  summary,
  depth,
}: {
  module: string
  summary: string
  depth: 'deep' | 'shallow'
}) {
  return (
    <div className="mx-auto max-w-2xl px-8 py-20">
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-12 text-center">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-surface-sunken text-text-muted">
          <Construction size={20} />
        </div>
        <h1 className="text-heading-24">{module}</h1>
        <p className="mx-auto mt-2 max-w-md text-body-14 text-text-secondary">{summary}</p>
        <p className="mt-6 text-label-10 text-text-muted">
          Not built yet &middot; planned depth: {depth}
        </p>
      </div>
    </div>
  )
}
