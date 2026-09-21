import { Gift } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Page from './Page'

export default defineModule({
  id: 'my-referral',
  label: 'My referral',
  icon: Gift,
  base: '/my-referral',
  group: 'personal',
  depth: 'deep',
  summary: 'Your referral link, who signed up with it, and what you have earned.',
  routes: [{ path: '', element: <Page /> }],
})
