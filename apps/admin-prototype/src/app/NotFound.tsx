import { Link } from 'react-router-dom'
import { MapPinOff } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="grid min-h-full place-items-center px-8 py-24">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-surface-sunken text-text-muted">
          <MapPinOff size={20} />
        </div>
        <h1 className="text-heading-20">Screen not found</h1>
        <p className="mt-1.5 text-body-14 text-text-secondary">
          This route isn&rsquo;t part of the prototype yet.
        </p>
        <Link
          to="/home"
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-body-13 font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          Back to command centre
        </Link>
      </div>
    </div>
  )
}
