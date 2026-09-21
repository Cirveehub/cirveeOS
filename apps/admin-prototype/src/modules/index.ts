import type { ModuleDef } from '@/app/module-registry'

import CommandCentre from './command-centre'
import Reports from './reports'
import Crm from './crm'
import Referral from './referral'
import Engage from './engage'
import Corporate from './corporate'
import Academy from './academy'
import Learn from './learn'
import Teaching from './teaching'
import MyLearning from './my-learning'
import MyWorkspace from './my-workspace'
import MyReferral from './my-referral'
import Outcomes from './outcomes'
import People from './people'
import Payroll from './payroll'
import Finance from './finance'
import Approvals from './approvals'
import Automation from './automation'
import Support from './support'
import Physical from './physical'
import Meetings from './meetings'
import Settings from './settings'
import KitchenSink from './_kitchen-sink'

export const modules: ModuleDef[] = [
  CommandCentre,
  Reports,
  Crm,
  Referral,
  Engage,
  Corporate,
  Academy,
  Learn,
  Teaching,
  MyLearning,
  MyWorkspace,
  MyReferral,
  Outcomes,
  People,
  Payroll,
  Finance,
  Approvals,
  Automation,
  Support,
  Physical,
  Meetings,
  Settings,
  KitchenSink,
]

export const moduleById = Object.fromEntries(modules.map((m) => [m.id, m]))
