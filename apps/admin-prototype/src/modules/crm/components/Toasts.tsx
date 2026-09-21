import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Alert, type AlertTone } from '@/ui'

export interface ToastMessage {
  id: string
  tone: AlertTone
  title: string
  body?: string
  link?: { label: string; to: string }
}

let toasts: ToastMessage[] = []
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): ToastMessage[] {
  return toasts
}

export function toast(message: Omit<ToastMessage, 'id'>): void {
  const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  toasts = [...toasts, { ...message, id }]
  emit()
  window.setTimeout(() => dismissToast(id), 6000)
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function ToastHost() {
  const items = useSyncExternalStore(subscribe, snapshot, snapshot)
  if (!items.length) return null

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto animate-slide-up">
          <Alert
            tone={item.tone}
            title={item.title}
            onDismiss={() => dismissToast(item.id)}
            dismissLabel="Dismiss notification"
            action={
              item.link ? (
                <Link
                  to={item.link.to}
                  className="text-body-13 font-semibold text-accent underline-offset-2 hover:underline"
                >
                  {item.link.label}
                </Link>
              ) : undefined
            }
            className="shadow-md"
          >
            {item.body}
          </Alert>
        </div>
      ))}
    </div>
  )
}
