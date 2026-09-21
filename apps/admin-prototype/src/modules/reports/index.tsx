import { BarChart3 } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import ReportsIndex from './ReportsIndex'
import ReportDetail from './ReportDetail'

export default defineModule({
  id: 'reports',
  label: 'Reports',
  icon: BarChart3,
  base: '/reports',
  group: 'overview',
  depth: 'shallow',
  summary:
    'The four executive questions: are we making money, are we growing, are students succeeding, is the organisation functioning.',
  permission: 'finance.invoice.view.branch',
  routes: [
    { path: '', element: <ReportsIndex /> },
    { path: ':key', element: <ReportDetail /> },
  ],
})
