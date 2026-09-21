import type { ModuleDef } from '@/app/module-registry'

import CommandCentre from './command-centre'
import Reports from './reports'
import Crm from './crm'
import Referral from './referral'
import Engage from './engage'
import Corporate from './corporate'
import Reputation from './reputation'
import Academy from './academy'
import Learn from './learn'
import Teaching from './teaching'
import MyLearning from './my-learning'
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

/**
 * The module registry.
 *
 * Order here is the order modules appear within their nav group.
 * To add a module: create `src/modules/<id>/index.tsx` default-exporting a
 * `defineModule({...})`, then add it to this array. Nothing else changes.
 */
export const modules: ModuleDef[] = [
  CommandCentre,
  Reports,
  Crm,
  Referral,
  Engage,
  Corporate,
  Reputation,
  Academy,
  Learn,
  Teaching,
  MyLearning,
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
