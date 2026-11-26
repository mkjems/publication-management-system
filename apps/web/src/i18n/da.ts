/**
 * Danish UI strings. Everything user-facing goes through this dictionary so an
 * English version can be added later without hunting through components.
 */
export const da = {
  appName: 'Produktionsplan',
  appTagline: 'Bogudgivelser',
  nav: {
    overview: 'Oversigt',
    publications: 'Udgivelser',
    myWork: 'Mine opgaver',
    masterplan: 'Masterplan',
  },
  comingSoon: 'Kommer snart',
  masterplan: {
    title: 'Masterplan',
    phases: 'faser',
    activities: 'aktiviteter',
    milestones: 'milepæle',
    defaultsNotice:
      'Varigheder, deadlines og afhængigheder er et forslag. De står ikke i den oprindelige masterplan og skal gennemgås med forlaget.',
    timelineTitle: 'Faseoverblik',
    timelineHint:
      'Nominel placering i forhold til udgivelsesdatoen (arbejdsdage, 1 md. ≈ 21 dage).',
    search: 'Søg i aktiviteter…',
    allRoles: 'Alle ansvarlige',
    expandAll: 'Fold alle ud',
    collapseAll: 'Fold alle sammen',
    noMatches: 'Ingen aktiviteter matcher filteret.',
    optional: 'Valgfri',
    columns: {
      activity: 'Aktivitet',
      responsible: 'Ansvarlig',
      duration: 'Varighed',
      deadline: 'Deadline',
      dependsOn: 'Afhænger af',
    },
    milestone: 'Milepæl',
    release: 'Udgivelse',
  },

  workspace: {
    demo: 'Demo',
    real: 'Rigtige data',
    switchLabel: 'Datasæt',
    demoHint: 'Demodata med fem eksempelbøger. Ændringer her påvirker ikke de rigtige data.',
    realHint: 'Dine egne udgivelser, gemt lokalt i denne browser.',
    loading: 'Indlæser…',
    error: 'Der opstod en fejl',
  },

  timeMachine: {
    title: 'Tidsmaskine',
    simulated: 'Simuleret dato',
    today: 'I dag',
    backWeek: '1 uge tilbage',
    forwardDay: '+1 dag',
    forwardWeek: '+1 uge',
    forwardMonth: '+1 md.',
    play: 'Afspil',
    pause: 'Stop',
    reset: 'Nulstil demo',
    backConfirmTitle: 'Gå tilbage i tiden?',
    backConfirmBody:
      'Demodata bygges op igen frem til den valgte dato. Dine egne ændringer i demoen går tabt.',
    backConfirm: 'Gå tilbage',
    resetConfirmTitle: 'Nulstil demoen?',
    resetConfirmBody:
      'Demodata bygges op igen frem til i dag. Dine egne ændringer i demoen går tabt.',
    resetConfirm: 'Nulstil',
    cancel: 'Annullér',
  },

  publications: {
    title: 'Udgivelser',
    description: 'Alle bøger i produktion, sorteret efter udgivelsesdato.',
    new: 'Ny udgivelse',
    empty: 'Ingen udgivelser endnu',
    emptyBody: 'Opret den første udgivelse ud fra masterplanen og en ønsket udgivelsesdato.',
    export: 'Eksportér',
    import: 'Importér',
    importConfirmTitle: 'Importér datasæt?',
    importConfirmBody: (count: number, kind: string) =>
      `Filen indeholder ${count} ${count === 1 ? 'udgivelse' : 'udgivelser'}. De erstatter alt i "${kind}".`,
    importConfirm: 'Erstat og importér',
    importError: 'Filen kunne ikke læses',
    columns: {
      title: 'Udgivelse',
      state: 'Status',
      release: 'Udgivelse',
      forecast: 'Prognose',
      progress: 'Fremdrift',
      health: 'Sundhed',
      next: 'Næste milepæl',
    },
    projectLead: 'Projektansvarlig',
  },

  wizard: {
    title: 'Ny udgivelse',
    description: 'Planen beregnes baglæns fra den ønskede udgivelsesdato ud fra masterplanen.',
    workingTitle: 'Arbejdstitel',
    workingTitlePlaceholder: 'Fx Havens historie',
    releaseDate: 'Ønsket udgivelsesdato',
    kickoffDate: 'Startmøde',
    kickoffHint:
      'Fase 1–2 planlægges fremad fra startmødet. Standard: ca. 11 måneder før udgivelse.',
    projectLead: 'Projektansvarlig',
    noLead: 'Ingen endnu',
    newPerson: 'Ny person…',
    newPersonName: 'Navn',
    optional: 'Valgfrie aktiviteter',
    optionalHint: 'Fravalgte aktiviteter bliver i planen som "fravalgt" og holder intet tilbage.',
    preview: 'Forhåndsvisning',
    previewMilestones: 'Milepæle',
    compressed: (days: number) =>
      `Planen er presset: der mangler ${days} arbejdsdage mellem startmødet og produktionen. Flyt udgivelsesdatoen eller startmødet.`,
    pastKickoff:
      'Startmødet ligger før dags dato. Allerede overskredne aktiviteter vises som forsinkede.',
    create: 'Opret udgivelse',
    cancel: 'Annullér',
  },

  publication: {
    notFound: 'Udgivelsen findes ikke',
    back: 'Alle udgivelser',
    tabs: { table: 'Tabel', gantt: 'Gantt', history: 'Historik' },
    target: 'Udgivelsesdato',
    desired: 'ønsket',
    binding: 'bindende',
    forecast: 'Prognose',
    onTime: 'til tiden',
    progress: 'Fremdrift',
    undo: 'Fortryd',
    redo: 'Gentag',
    delete: 'Slet',
    deleteConfirmTitle: 'Slet udgivelsen?',
    deleteConfirmBody: 'Udgivelsen og hele dens historik slettes. Det kan ikke fortrydes.',
    deleteConfirm: 'Slet udgivelse',
    paused: (from: string) => `Sat på pause siden ${from}`,
    search: 'Søg i aktiviteter…',
    filter: {
      all: 'Alle aktiviteter',
      problems: 'Kun problemer',
      open: 'Kun åbne',
    },
    allRoles: 'Alle ansvarlige',
    expandAll: 'Fold alle ud',
    collapseAll: 'Fold alle sammen',
    noMatches: 'Ingen aktiviteter matcher filteret.',
    columns: {
      activity: 'Aktivitet',
      responsible: 'Ansvarlig',
      start: 'Start',
      baseline: 'Oprindelig deadline',
      deadline: 'Aktuel deadline',
      status: 'Status',
      note: 'Bemærkning',
    },
    forecastShort: 'Prognose',
    vsBaseline: 'Arbejdsdage i forhold til den oprindelige deadline',
    doneVsBaseline: 'Færdig i forhold til den oprindelige deadline (arbejdsdage)',
    milestones: 'Milepæle',
    phaseDone: 'færdig',
    notePlaceholder: 'Tilføj bemærkning…',
  },

  gantt: {
    today: 'I dag',
    release: 'Udgivelse',
    pause: 'Pause',
    deadline: 'deadline',
    baseline: 'Oprindelig plan',
    linkHint: 'Træk til en anden aktivitet for at tilføje en afhængighed',
    zoom: { week: 'Uge', month: 'Måned', quarter: 'Kvartal' },
    zoomLabel: 'Zoom',
    critical: 'Kritisk vej',
    allDependencies: 'Alle afhængigheder',
    help: 'Træk en bjælke for at flytte den, træk i højre kant for at ændre varighed, og træk fra prikken for enden til en anden aktivitet for at tilføje en afhængighed. Med tastaturet: vælg med Tab, flyt med ← → (Shift: en uge), bekræft med Enter, fortryd med Esc.',
    legend: {
      task: 'Opgave',
      deadline: 'Deadline',
      milestone: 'Milepæl',
      baseline: 'Oprindelig plan',
      forecast: 'Prognose',
      slack: 'Buffer',
      preliminary: 'Foreløbig plan',
    },
    dependencyAdded: (from: string, to: string) => `"${to}" afhænger nu af "${from}"`,
  },

  waiting: {
    title: 'Hvad venter aktiviteten på?',
    text: 'Venter på',
    textPlaceholder: 'Fx Svar fra fonden',
    expected: 'Forventet afklaret',
    save: 'Gem',
    cancel: 'Annullér',
  },

  impact: {
    title: 'Flyt deadline',
    titleDuration: 'Ændr varighed',
    newDuration: 'Ny varighed',
    workdays: 'arbejdsdage',
    description: (name: string) => `Hvad sker der, hvis "${name}" flyttes?`,
    newDeadline: 'Ny deadline',
    strategy: 'Sådan håndteres forsinkelsen',
    release: 'Udgivelse',
    releaseUnchanged: 'Påvirker ikke udgivelsen',
    releaseSlips: (days: number) => `Udgivelsen rykker ${days} arbejdsdage`,
    behindTarget: (days: number, target: string) =>
      `Planen ligger derefter ${days} arbejdsdage efter udgivelsesdatoen ${target}.`,
    releaseMoves: (date: string) => `Udgivelsesdatoen flyttes til ${date}`,
    moved: (n: number) => `${n} ${n === 1 ? 'aktivitet flyttes' : 'aktiviteter flyttes'}`,
    andMore: (n: number) => `og ${n} flere`,
    compressed: 'Forkortes',
    pinnedConflicts: 'Konflikt med fastlåste datoer',
    reasonCategory: 'Årsag',
    reason: 'Begrundelse',
    reasonPlaceholder: 'Fx Forfatteren er syg i to uger',
    reasonRequired: 'En begrundelse er påkrævet, når en bindende udgivelsesdato flyttes.',
    acceptConflicts: 'Flyt alligevel (fastlåste datoer bliver stående)',
    apply: 'Flyt',
    cancel: 'Annullér',
  },

  panel: {
    status: 'Status',
    dates: 'Datoer',
    start: 'Start',
    baseline: 'Oprindelig deadline',
    deadline: 'Aktuel deadline',
    forecast: 'Prognose',
    latest: 'Seneste deadline',
    slack: 'Buffer',
    critical: 'På den kritiske vej',
    actualStart: 'Faktisk start',
    actualFinish: 'Faktisk færdig',
    duration: 'Varighed',
    pinned: 'Fastlåst dato',
    pinnedHint: 'Flyttes aldrig automatisk, fx et arrangement eller en trykkeritid.',
    waitingFor: 'Venter på',
    expected: 'forventet',
    predecessors: 'Afhænger af',
    successors: 'Efterfølgende',
    note: 'Bemærkning',
    history: 'Historik',
    noHistory: 'Ingen ændringer endnu.',
    move: 'Flyt deadline…',
    reasons: 'Hvorfor',
  },

  history: {
    empty: 'Ingen ændringer endnu.',
    by: { simulation: 'simulering', scenario: 'scenarie', user: 'dig' },
    moved: (n: number) => `${n} ${n === 1 ? 'aktivitet' : 'aktiviteter'} flyttet`,
    showMore: (n: number) => `Vis flere (${n})`,
  },
} as const

export const STATUS_LABELS = {
  not_started: 'Ikke startet',
  in_progress: 'I gang',
  waiting: 'Afventer',
  done: 'Færdig',
  skipped: 'Fravalgt',
} as const

export const HEALTH_LABELS = {
  late: 'Forsinket',
  waiting: 'Afventer',
  at_risk: 'I risiko',
  on_track: 'Planmæssig',
  done: 'Færdig',
  skipped: 'Fravalgt',
} as const

export const HEALTH_REASON_LABELS = {
  overdue: 'Deadline overskredet',
  waiting: 'Afventer',
  forecast_slip: 'Prognosen ligger efter deadline',
  low_slack: 'Bufferen er brugt op',
  pinned_conflict: 'Konflikt med fastlåst dato',
} as const

export const LIFECYCLE_LABELS = {
  idea: 'Idé',
  go: 'GO',
  hold: 'HOLD',
  no_go: 'NO-GO',
  active: 'I produktion',
  paused: 'På pause',
  released: 'Udgivet',
  closed: 'Afsluttet',
} as const

export const PLAN_STATE_LABELS = {
  preliminary: 'Foreløbig plan',
  binding: 'Bindende plan',
} as const

export const REASON_CATEGORY_LABELS = {
  author: 'Forfatter',
  editorial: 'Redaktion',
  images_rights: 'Billeder og rettigheder',
  design: 'Grafisk arbejde',
  printer: 'Tryk og levering',
  funding: 'Finansiering',
  external: 'Eksterne forhold',
  other: 'Andet',
} as const

export const STRATEGY_LABELS = {
  absorb: {
    label: 'Lad bufferen tage det',
    hint: 'Kun det, der skal flyttes, flyttes. Luften i planen bruges først.',
  },
  push: {
    label: 'Skub alt efterfølgende',
    hint: 'Alle efterfølgende aktiviteter flyttes lige meget, så afstanden mellem dem bevares.',
  },
  compress: {
    label: 'Komprimér for at holde udgivelsen',
    hint: 'Efterfølgende opgaver på den kritiske vej forkortes (højst til det halve).',
  },
  move_release: {
    label: 'Flyt udgivelsesdatoen',
    hint: 'Udgivelsesdatoen rykker med. En bindende plan får en ny baseline.',
  },
} as const

export const EVENT_LABELS = {
  activity_rescheduled: 'Flyttet',
  status_changed: 'Status ændret',
  release_date_changed: 'Udgivelsesdato ændret',
  plan_made_binding: 'Planen er bindende',
  rebaselined: 'Ny baseline',
  paused: 'Sat på pause',
  resumed: 'Genoptaget',
  pinned_changed: 'Fastlåsning ændret',
  dependency_added: 'Afhængighed tilføjet',
  dependency_removed: 'Afhængighed fjernet',
  activity_updated: 'Redigeret',
  undone: 'Fortrudt',
  redone: 'Gentaget',
} as const

export const PUSH_REASON_LABELS = {
  predecessor: 'Venter på',
  today: 'Ikke nået i tide',
  waiting: 'Afventer',
  started_late: 'Startede senere end planlagt',
} as const
