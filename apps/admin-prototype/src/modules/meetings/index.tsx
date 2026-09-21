import { CalendarDays } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Meetings from './Meetings'
import ActionRegister from './ActionRegister'
import DecisionLog from './DecisionLog'
import MeetingDetail from './MeetingDetail'

export default defineModule({
  id: 'meetings',
  label: 'Meetings',
  icon: CalendarDays,
  base: '/meetings',
  group: 'operations',
  depth: 'shallow',
  summary: 'The operating rhythm: agendas, the action register and a searchable decision log.',
  permission: 'work.task.view.department',
  routes: [
    { path: '', element: <Meetings /> },

    // The literals precede `:id` so they are matched as paths, not as meeting ids.
    { path: 'actions', element: <ActionRegister /> },
    { path: 'decisions', element: <DecisionLog /> },

    { path: ':id', element: <MeetingDetail /> },
  ],
  subnav: [
    { label: 'Meetings', to: '' },
    { label: 'Action register', to: 'actions' },
    { label: 'Decision log', to: 'decisions' },
  ],
})
