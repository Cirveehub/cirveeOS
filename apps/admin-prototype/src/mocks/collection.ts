import { useSyncExternalStore } from 'react'

/**
 * The prototype's data layer.
 *
 * There is no backend. Each domain entity lives in a `Collection<T>` — an
 * in-memory array with a subscription, so a mutation anywhere re-renders every
 * screen reading it. That is what makes the prototype feel like a real system:
 * approve a commission on one screen and the payroll preview on another
 * reflects it immediately.
 *
 * State persists to sessionStorage, so it survives navigation and reload but
 * resets when the tab closes. A demo should start from a known seed.
 *
 * When the real API arrives, `useCollection` is replaced by a react-query
 * hook with the same shape and screens barely change.
 */

const PERSIST_PREFIX = 'cirvee-os:'
let persistEnabled = true

export interface Entity {
  id: string
}

export class Collection<T extends Entity> {
  private items: T[]
  private listeners = new Set<() => void>()
  private snapshot: T[]

  constructor(
    readonly name: string,
    seed: T[],
  ) {
    this.items = restore<T>(name) ?? seed
    this.snapshot = this.items
  }

  /* ---- reads ---------------------------------------------------------- */

  all(): T[] {
    return this.snapshot
  }

  find(id: string): T | undefined {
    return this.items.find((i) => i.id === id)
  }

  where(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate)
  }

  count(predicate?: (item: T) => boolean): number {
    return predicate ? this.items.filter(predicate).length : this.items.length
  }

  sum(selector: (item: T) => number, predicate?: (item: T) => boolean): number {
    return (predicate ? this.items.filter(predicate) : this.items).reduce(
      (acc, i) => acc + selector(i),
      0,
    )
  }

  /* ---- writes --------------------------------------------------------- */

  insert(item: T): T {
    this.items = [item, ...this.items]
    this.commit()
    return item
  }

  insertMany(items: T[]): T[] {
    this.items = [...items, ...this.items]
    this.commit()
    return items
  }

  update(id: string, patch: Partial<T> | ((item: T) => Partial<T>)): T | undefined {
    let updated: T | undefined
    this.items = this.items.map((item) => {
      if (item.id !== id) return item
      const delta = typeof patch === 'function' ? patch(item) : patch
      updated = { ...item, ...delta }
      return updated
    })
    if (updated) this.commit()
    return updated
  }

  updateWhere(predicate: (item: T) => boolean, patch: Partial<T>): number {
    let n = 0
    this.items = this.items.map((item) => {
      if (!predicate(item)) return item
      n++
      return { ...item, ...patch }
    })
    if (n) this.commit()
    return n
  }

  /**
   * Hard removal. Use sparingly — the PRD forbids destroying financial,
   * payroll, attendance and approval records. Prefer a status change to
   * `voided` / `reversed` / `archived`.
   */
  remove(id: string): void {
    const next = this.items.filter((i) => i.id !== id)
    if (next.length !== this.items.length) {
      this.items = next
      this.commit()
    }
  }

  replaceAll(items: T[]): void {
    this.items = items
    this.commit()
  }

  /* ---- subscription --------------------------------------------------- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  private commit() {
    this.snapshot = this.items
    persist(this.name, this.items)
    this.listeners.forEach((l) => l())
  }
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

/** Subscribe a component to a whole collection. */
export function useCollection<T extends Entity>(collection: Collection<T>): T[] {
  return useSyncExternalStore(collection.subscribe, collection.getSnapshot, collection.getSnapshot)
}

/** Subscribe to one record. Re-renders when that record changes. */
export function useRecord<T extends Entity>(
  collection: Collection<T>,
  id: string | undefined,
): T | undefined {
  const all = useCollection(collection)
  return id ? all.find((i) => i.id === id) : undefined
}

/**
 * Subscribe to a derived value. `selector` runs on every collection change,
 * so keep it cheap.
 */
export function useQuery<T extends Entity, R>(
  collection: Collection<T>,
  selector: (items: T[]) => R,
): R {
  const all = useCollection(collection)
  return selector(all)
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

function persist<T>(name: string, items: T[]) {
  if (!persistEnabled) return
  try {
    sessionStorage.setItem(PERSIST_PREFIX + name, JSON.stringify(items))
  } catch {
    // Quota exceeded or storage blocked — the prototype still works in memory.
    persistEnabled = false
  }
}

function restore<T>(name: string): T[] | null {
  try {
    const raw = sessionStorage.getItem(PERSIST_PREFIX + name)
    return raw ? (JSON.parse(raw) as T[]) : null
  } catch {
    return null
  }
}

/** Wipe all persisted state and reload — the demo reset button. */
export function resetAllData() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PERSIST_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  window.location.reload()
}

/* -------------------------------------------------------------------------- */
/* Id generation                                                              */
/* -------------------------------------------------------------------------- */

const counters: Record<string, number> = {}

/**
 * Human-readable sequential ids, as the PRD's examples use: `INV-932`,
 * `PAY-1243`. Readable ids matter in an ops tool — staff say them out loud.
 */
export function nextId(prefix: string, start = 1000): string {
  counters[prefix] = (counters[prefix] ?? start) + 1
  return `${prefix}-${counters[prefix]}`
}

/** Opaque internal id, for entities that don't need a readable one. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
