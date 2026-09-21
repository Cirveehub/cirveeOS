import { Nfc } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import PhysicalDashboard from './Dashboard'
import PhysicalCards from './Cards'
import PhysicalReaders from './Readers'
import PhysicalTaps from './Taps'
import PhysicalVisitors from './Visitors'
import PhysicalSignage from './Signage'
import PhysicalKiosk from './Kiosk'

/**
 * The spec puts the walk-in kiosk at `/public/kiosk`, outside the shell. Only
 * `src/app/App.tsx` can mount a route outside a module base, and this module
 * does not own that file — so the kiosk lives at `/physical/kiosk` and renders
 * its own full-bleed, chrome-free surface instead.
 */
export default defineModule({
  id: 'physical',
  label: 'Physical layer',
  icon: Nfc,
  base: '/physical',
  group: 'operations',
  depth: 'shallow',
  summary: 'The campus. NFC cards, readers, tap logs, the visitor log and kiosk configuration.',
  permission: 'academy.attendance.view.branch',
  routes: [
    { path: '', element: <PhysicalDashboard /> },
    { path: 'cards', element: <PhysicalCards /> },
    { path: 'readers', element: <PhysicalReaders /> },
    { path: 'taps', element: <PhysicalTaps /> },
    { path: 'visitors', element: <PhysicalVisitors /> },
    { path: 'signage', element: <PhysicalSignage /> },
    { path: 'kiosk', element: <PhysicalKiosk /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Cards', to: 'cards' },
    { label: 'Readers', to: 'readers' },
    { label: 'Tap log', to: 'taps' },
    { label: 'Visitors', to: 'visitors' },
    { label: 'Signage', to: 'signage' },
    { label: 'Kiosk', to: 'kiosk' },
  ],
})
