import { Wallet } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Periods from './Periods'
import PeriodDetail from './PeriodDetail'
import Compensation from './Compensation'
import Adjustments from './Adjustments'
import Payslips from './Payslips'
import PayslipDetail from './PayslipDetail'

export default defineModule({
  id: 'payroll',
  label: 'Payroll',
  icon: Wallet,
  base: '/payroll',
  group: 'people',
  depth: 'shallow',
  summary: 'Assemble, review, approve and pay. Periods, adjustments and payslips.',
  permission: 'payroll.period.view.department',
  routes: [
    { path: '', element: <Dashboard /> },

    { path: 'periods', element: <Periods /> },
    { path: 'periods/:id', element: <PeriodDetail /> },

    { path: 'compensation', element: <Compensation /> },
    { path: 'adjustments', element: <Adjustments /> },

    { path: 'payslips', element: <Payslips /> },
    { path: 'payslips/:id', element: <PayslipDetail /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Periods', to: 'periods' },
    { label: 'Compensation', to: 'compensation' },
    { label: 'Adjustment review', to: 'adjustments' },
    { label: 'Payslips', to: 'payslips' },
  ],
})
