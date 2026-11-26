/**
 * The scenario library (PLAN §4.3). Names and descriptions are Danish: they are shown to the
 * client in the demo workspace.
 */
import type { Scenario, ScenarioFunding } from './scenario'

const rel = (workdays: number) => ({ from: 'release' as const, workdays })

/**
 * The usual funding story: two grants decided a little before the funding milestone (release
 * −193 working days) cover the minimum; a third application is turned down later.
 */
const STANDARD_FUNDING: ScenarioFunding = {
  minimumRequired: 250_000,
  applications: [
    {
      funder: 'Augustinus Fonden',
      amount: 150_000,
      submit: rel(-203),
      decision: rel(-197),
      outcome: 'granted',
    },
    {
      funder: 'Statens Kunstfond',
      amount: 100_000,
      submit: rel(-203),
      decision: rel(-196),
      outcome: 'granted',
    },
    {
      funder: 'Beckett-Fonden',
      amount: 75_000,
      submit: rel(-200),
      decision: rel(-160),
      outcome: 'rejected',
    },
  ],
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'on-plan',
    name: 'Alt går efter planen',
    description: 'Alle aktiviteter bliver færdige til deres deadline.',
    seed: 1,
    policy: { kind: 'on_plan' },
    funding: STANDARD_FUNDING,
    events: [],
  },
  {
    id: 'author-3-weeks-late',
    name: 'Forfatteren er 3 uger forsinket',
    description:
      'Første komplette manuskript kommer 15 arbejdsdage for sent. Bufferen før produktionen tager forsinkelsen, og udgivelsen holder.',
    seed: 1,
    policy: { kind: 'custom', delays: { 'first-draft': 15 } },
    funding: STANDARD_FUNDING,
    events: [],
  },
  {
    id: 'funding-hold-6-weeks',
    name: 'Fondssvar udebliver → HOLD i 6 uger',
    description:
      'Fondssvaret trækker ud, og projektet sættes på HOLD i 6 uger lige før finansieringsmilepælen. Ved genoptagelse flyttes resten af planen, og udgivelsen rykker tilsvarende.',
    seed: 1,
    policy: { kind: 'on_plan' },
    // The Augustinus answer comes 30 working days late; the funding milestone waits for it.
    funding: {
      ...STANDARD_FUNDING,
      applications: STANDARD_FUNDING.applications.map((a, i) =>
        i === 0 ? { ...a, expectedDecision: rel(-197), decision: rel(-167) } : a,
      ),
    },
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
    funding: STANDARD_FUNDING,
    events: [],
  },
  {
    id: 'realistic',
    name: 'Et realistisk forløb',
    description:
      'Tilfældige, men realistiske forsinkelser: især lange opgaver og opgaver hos forfatter, billeder og trykkeri skrider.',
    seed: 7,
    policy: { kind: 'realistic' },
    funding: STANDARD_FUNDING,
    events: [],
  },
  {
    id: 'stress',
    name: 'Alt skrider',
    description:
      'Stresstest: de fleste opgaver tager længere tid end planlagt, milepæle glider, og arbejde går i stå, mens der ventes på eksterne parter. Til at se, om overblikket holder, når meget går galt på én gang.',
    seed: 13,
    policy: { kind: 'stress' },
    funding: STANDARD_FUNDING,
    events: [],
  },
]
