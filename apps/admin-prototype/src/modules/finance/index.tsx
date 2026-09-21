import { Banknote } from 'lucide-react'
import { defineModule } from '@/app/module-registry'
import { bankTransactionsCollection } from '@/mocks'

import Accounts from './Accounts'
import BankTransactions from './BankTransactions'
import Dashboard from './Dashboard'
import Expenses from './Expenses'
import InvoiceDetail from './InvoiceDetail'
import Invoices from './Invoices'
import Payments from './Payments'
import Reconciliation from './Reconciliation'
import Refunds from './Refunds'
import UnitPnl from './UnitPnl'

export default defineModule({
  id: 'finance',
  label: 'Finance',
  icon: Banknote,
  base: '/finance',
  group: 'money',
  depth: 'shallow',
  summary: 'Money in, money out, and which unit it belonged to. Ledgers, invoices, reconciliation, unit P&L.',
  permission: 'finance.invoice.view.branch',
  routes: [
    { path: '', element: <Dashboard /> },
    { path: 'unit-pl', element: <UnitPnl /> },
    { path: 'reconciliation', element: <Reconciliation /> },
    { path: 'accounts', element: <Accounts /> },
    { path: 'invoices', element: <Invoices /> },
    { path: 'invoices/:id', element: <InvoiceDetail /> },
    { path: 'payments', element: <Payments /> },
    { path: 'bank-transactions', element: <BankTransactions /> },
    { path: 'expenses', element: <Expenses /> },
    { path: 'refunds', element: <Refunds /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Unit P&L', to: 'unit-pl' },
    {
      label: 'Reconciliation',
      to: 'reconciliation',
      badge: () =>
        bankTransactionsCollection.count(
          (t) => t.credit !== null && (t.matchStatus === 'unmatched' || t.matchStatus === 'possible_match'),
        ) || undefined,
    },
    { label: 'Student accounts', to: 'accounts' },
    { label: 'Invoices', to: 'invoices' },
    { label: 'Payments', to: 'payments' },
    { label: 'Bank feed', to: 'bank-transactions' },
    { label: 'Expenses', to: 'expenses' },
    { label: 'Refunds', to: 'refunds' },
  ],
})
