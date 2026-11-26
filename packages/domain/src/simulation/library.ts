/**
 * The scenario library (PLAN §4.3). Names and descriptions are Danish: they are shown to the
 * client in the demo workspace.
 */
import type { Scenario } from './scenario'

export const SCENARIOS: Scenario[] = [
  {
    id: 'on-plan',
    name: 'Alt går efter planen',
    description: 'Alle aktiviteter bliver færdige til deres deadline.',
    seed: 1,
    policy: { kind: 'on_plan' },
    events: [],
  },
  {
    id: 'author-3-weeks-late',
    name: 'Forfatteren er 3 uger forsinket',
    description:
      'Første komplette manuskript kommer 15 arbejdsdage for sent. Bufferen før produktionen tager forsinkelsen, og udgivelsen holder.',
    seed: 1,
    policy: { kind: 'custom', delays: { 'first-draft': 15 } },
    events: [],
  },
  {
    id: 'funding-hold-6-weeks',
    name: 'Fondssvar udebliver → HOLD i 6 uger',
    description:
      'Fondssvaret trækker ud, og projektet sættes på HOLD i 6 uger lige før finansieringsmilepælen. Ved genoptagelse flyttes resten af planen, og udgivelsen rykker tilsvarende.',
    seed: 1,
    policy: { kind: 'on_plan' },
    events: [
      {
        at: { from: 'release', workdays: -196 },
        action: { kind: 'pause', reason: 'Fondssvar udebliver', reasonCategory: 'funding' },
      },
      {
        at: { from: 'release', workdays: -166 },
        action: { kind: 'resume', mode: { kind: 'shift' } },
      },
    ],
  },
  {
    id: 'printer-1-week-late',
    name: 'Trykkeriet forsinker 1 uge',
    description:
      'Tryk og indbinding tager 5 arbejdsdage længere end planlagt. Bufferen mellem lager og udgivelse tager forsinkelsen.',
    seed: 1,
    policy: { kind: 'custom', delays: { printing: 5 } },
    events: [],
  },
  {
    id: 'realistic',
    name: 'Et realistisk forløb',
    description:
      'Tilfældige, men realistiske forsinkelser: især lange opgaver og opgaver hos forfatter, billeder og trykkeri skrider.',
    seed: 7,
    policy: { kind: 'realistic' },
    events: [],
  },
]
