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
      slip: 'Afvigelse',
      funding: 'Finansiering',
    },
    slipHint: 'Udgivelsesdatoen i forhold til den oprindelige plan (arbejdsdage)',
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
    tabs: { table: 'Tabel', gantt: 'Gantt', funding: 'Finansiering', history: 'Historik' },
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
    desiredRelease: 'Ønsket udgivelse',
    bindingRelease: 'Bindende udgivelse',
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
      pause: 'Pause',
      sandbox: 'Rigtig plan (scenarie)',
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
    orWorkdays: 'eller',
    workdaysLater: 'arbejdsdage senere',
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
    move: 'Udskyd…',
    reasons: 'Hvorfor',
  },

  history: {
    empty: 'Ingen ændringer endnu.',
    by: { simulation: 'simulering', scenario: 'scenarie', user: 'dig' },
    moved: (n: number) => `${n} ${n === 1 ? 'aktivitet' : 'aktiviteter'} flyttet`,
    showMore: (n: number) => `Vis flere (${n})`,
    log: 'Ændringslog',
    noMatches: 'Ingen ændringer matcher filteret.',
    filter: {
      all: 'Alle ændringer',
      planning: 'Planændringer',
      status: 'Statusændringer',
      other: 'Øvrige',
    },
    allCategories: 'Alle årsager',
    allAuthors: 'Alle',
    authors: { user: 'Kun mine', simulation: 'Kun simulering' },
    baselines: 'Baselines',
    baselineName: (n: number) => (n === 0 ? 'Oprindelig plan' : `Baseline ${n}`),
    baselineRelease: 'Udgivelse',
    noBaselines:
      'Planen er foreløbig. Den oprindelige plan gemmes, når planen bliver bindende (milepælen "Finansiering tilstrækkelig").',
  },

  trend: {
    title: 'Milepælenes udvikling',
    description:
      'Prognosen for hver milepæl, sådan som den så ud uge for uge. En vandret linje er en milepæl, der holder; en linje, der stiger, er en milepæl, der skrider. Milepælen er nået, når linjen rammer diagonalen.',
    xAxis: 'Dato for prognosen',
    yAxis: 'Forventet dato',
    target: 'Udgivelsesdato (mål)',
    diagonal: 'Dags dato',
    showAll: 'Vis alle milepæle',
    showKey: 'Vis vigtigste',
    empty:
      'Endnu ingen historik at vise. Grafen fyldes op, efterhånden som planen ændres og tiden går.',
    incomplete: 'Ændringsloggen kunne ikke afspilles helt tilbage; grafen viser den seneste del.',
    slipped: (days: number) => `skredet ${days} arbejdsdage`,
    held: 'holder',
    done: 'nået',
  },

  planActions: {
    menu: 'Planlægning',
    release: 'Flyt udgivelsesdato…',
    pause: 'Sæt på pause…',
    resume: 'Genoptag…',
    makeBinding: 'Gør planen bindende…',
    rebaseline: 'Gem ny baseline…',
    scenario: 'Afprøv i et scenarie',
    roles: 'Roller og personer…',
  },

  overview: {
    description:
      'Mandagsoverblikket: hvad er forsinket, hvad er i risiko, og hvad skal ske i denne uge.',
    allPublications: 'Se alle udgivelser',
    tiles: {
      active: 'Bøger i gang',
      late: 'Forsinkede aktiviteter',
      atRisk: 'I risiko',
      waiting: 'Afventer',
      dueThisWeek: 'Deadline denne uge',
      slipping: 'Udgivelser der skrider',
    },
    tileHint: {
      active: (paused: number) => (paused ? `${paused} på pause` : 'ingen på pause'),
      slipping: 'prognosen ligger efter udgivelsesdatoen',
      atRisk: 'med deadline de næste 2 uger',
    },
    gantt: 'Porteføljen',
    ganttHint:
      'Én linje pr. bog med faserne, milepælene og udgivelsen. Samme farve i samme uge betyder, at flere bøger er i samme fase på én gang.',
    attention: 'Kræver opmærksomhed',
    attentionHint: 'Forsinkede og ventende aktiviteter på tværs af bøgerne.',
    thisWeek: 'Denne uge',
    thisWeekHint: 'Deadlines og opstarter frem til søndag.',
    nothingAttention: 'Intet er forsinket eller venter. 🎉',
    nothingThisWeek: 'Ingen deadlines eller opstarter i denne uge.',
    showAll: (n: number) => `Vis alle (${n})`,
    empty: 'Ingen udgivelser endnu.',
  },

  portfolioGantt: {
    phase: (n: number, name: string) => `Fase ${n}: ${name}`,
    phases: 'Faser 1 → 11',
    release: 'Udgivelse',
    forecast: 'Prognose for udgivelsen',
    milestone: 'Milepæl',
    today: 'I dag',
    pause: 'Pause',
    stopped: 'Stoppet',
  },

  myWork: {
    description:
      'Det, der er forsinket, venter eller skal ske i denne og næste uge, på tværs af alle bøger.',
    who: 'Vis for',
    everyone: 'Alle',
    people: 'Personer',
    roles: 'Roller',
    nothing: 'Intet at gøre lige nu.',
    noPeople:
      'Personer tilknyttes en bog under Planlægning → Roller og personer. Indtil da kan du vælge en rolle.',
    columns: {
      activity: 'Aktivitet',
      publication: 'Udgivelse',
      responsible: 'Ansvarlig',
      deadline: 'Deadline',
      forecast: 'Prognose',
      status: 'Status',
    },
  },

  funding: {
    title: 'Finansiering',
    minimum: 'Minimum',
    minimumHint: 'Det beløb, der skal være sikret, før udgivelsesdatoen kan blive bindende.',
    secured: 'Sikret',
    pending: 'Afventer svar',
    planned: 'Planlagt',
    gap: 'Mangler',
    sufficient: 'Finansieringen er tilstrækkelig',
    riskAcceptedState: 'Forlaget har godkendt risikoen',
    insufficient: (gap: string) => `Mangler ${gap} for at nå minimum`,
    gateDone: 'Milepælen "Finansiering tilstrækkelig" er nået; planen er bindende.',
    gateOpen: 'Milepælen "Finansiering tilstrækkelig" kan godkendes.',
    gateBlocked: 'Milepælen "Finansiering tilstrækkelig" kan ikke godkendes endnu.',
    riskAccepted: 'Forlaget godkender risikoen',
    riskAcceptedHint: 'Planen kan blive bindende, selv om minimum ikke er nået.',
    riskReason: 'Hvorfor godkendes risikoen?',
    applications: 'Ansøgninger',
    noApplications: 'Ingen ansøgninger endnu.',
    add: 'Tilføj ansøgning',
    edit: 'Redigér ansøgning',
    remove: 'Fjern',
    removeConfirm: (funder: string) => `Fjern ansøgningen til ${funder}?`,
    overdue: 'Svaret er udeblevet',
    nextDecision: (funder: string, date: string) => `Næste svar: ${funder}, forventet ${date}`,
    pause: 'Sæt projektet på pause…',
    columns: {
      funder: 'Fond',
      amount: 'Beløb',
      status: 'Status',
      submitted: 'Indsendt',
      expected: 'Forventet svar',
      decided: 'Svar',
      conditions: 'Vilkår',
    },
    fields: {
      funder: 'Fond eller bidragyder',
      amount: 'Beløb (kr.)',
      status: 'Status',
      submitted: 'Indsendt',
      expected: 'Forventet svar',
      decided: 'Svar modtaget',
      conditions: 'Vilkår og bemærkninger',
    },
    save: 'Gem',
    gateNotSufficient:
      'Finansieringen er ikke på plads: minimum er ikke nået, og risikoen er ikke godkendt. Se fanen Finansiering.',
  },

  gate: {
    title: 'GO / HOLD / NO-GO',
    description:
      'Beslutningen om, hvorvidt projektet går videre. GO sætter produktionsforberedelsen i gang; HOLD sætter projektet på pause, til der kan træffes en beslutning; NO-GO stopper projektet.',
    go: { label: 'GO', hint: 'Projektet går videre.' },
    hold: {
      label: 'HOLD',
      hint: 'Projektet sættes på pause. Når der siden besluttes GO, flyttes resten af planen med pausens længde.',
    },
    no_go: {
      label: 'NO-GO',
      hint: 'Projektet stoppes. Planen bevares, men intet planlægges videre.',
    },
    reasonPlaceholder: 'Fx Afventer svar fra fonden',
    reasonRequired: 'HOLD og NO-GO kræver en begrundelse.',
    apply: 'Træf beslutning',
    decide: 'Træf beslutning…',
  },

  roles: {
    title: 'Roller og personer',
    description:
      'Hvem varetager hvilke roller på denne bog? Det bruges i Mine opgaver. Projektansvarlig sættes også her.',
    nobody: 'Ingen',
    addPerson: 'Ny person',
    addPersonPlaceholder: 'Navn',
    add: 'Tilføj',
    done: 'Luk',
  },

  comparison: {
    release: 'Udgivelse',
    target: 'Udgivelsesdato',
    forecast: 'Prognose',
    unchanged: 'uændret',
    moved: (n: number) => `${n} ${n === 1 ? 'aktivitet flyttes' : 'aktiviteter flyttes'}`,
    milestones: 'Milepæle',
    noMilestoneChanges: 'Ingen milepæle flytter sig.',
    nothing: 'Ingen datoer ændres.',
    statusChanged: (n: number) => `${n} ${n === 1 ? 'statusændring' : 'statusændringer'}`,
    andMore: (n: number) => `og ${n} flere`,
    pinnedConflicts: 'Konflikt med fastlåste datoer',
    acceptConflicts: 'Fortsæt alligevel (fastlåste datoer bliver stående)',
  },

  releaseDialog: {
    title: 'Flyt udgivelsesdatoen',
    description:
      'Al resterende arbejde flyttes med, så afstanden til udgivelsen bevares. Overskredne aktiviteter bliver stående, så forsinkelsen stadig kan ses.',
    current: 'Nuværende',
    newDate: 'Ny udgivelsesdato',
    workdays: 'arbejdsdage',
    rebaseline: (n: number) =>
      `Planen er bindende: den nye plan gemmes som baseline ${n}. Den oprindelige plan bevares.`,
    apply: 'Flyt udgivelsen',
  },

  pauseDialog: {
    title: 'Sæt udgivelsen på pause',
    description:
      'Fx HOLD mens et fondssvar afventes. Intet flyttes nu; prognosen viser, hvad pausen koster, efterhånden som tiden går. Når projektet genoptages, vælger du, hvordan resten af planen flyttes.',
    from: 'Pause fra',
    reasonPlaceholder: 'Fx Afventer svar fra Augustinus Fonden',
    reasonRequired: 'Skriv en begrundelse.',
    apply: 'Sæt på pause',
  },

  resumeDialog: {
    title: 'Genoptag udgivelsen',
    description: (from: string, days: number) =>
      `På pause siden ${from} (${days} ${days === 1 ? 'arbejdsdag' : 'arbejdsdage'}).`,
    on: 'Genoptages',
    mode: 'Resten af planen',
    shift: {
      label: 'Flyt med pausens længde',
      hint: 'Alt uafsluttet arbejde rykker lige så mange arbejdsdage, som pausen varede. Udgivelsen rykker med.',
    },
    newRelease: {
      label: 'Planlæg mod en ny udgivelsesdato',
      hint: 'Resten af planen lægges baglæns fra den dato, du vælger.',
    },
    releaseDate: 'Ny udgivelsesdato',
    notBefore: 'Intet, der ikke er startet, kan starte før genoptagelsen.',
    apply: 'Genoptag',
  },

  bindingDialog: {
    makeBinding: {
      title: 'Gør planen bindende',
      description:
        'Udgivelsesdatoen bliver bindende, og den nuværende plan gemmes som den oprindelige plan (baseline 0). Normalt sker det, når milepælen "Finansiering tilstrækkelig" er nået.',
      apply: 'Gør bindende',
    },
    rebaseline: {
      title: 'Gem ny baseline',
      description: (n: number) =>
        `Den nuværende plan gemmes som baseline ${n}. Den oprindelige plan bevares, og afvigelser måles fortsat mod den.`,
      apply: 'Gem baseline',
    },
    release: 'Udgivelsesdato',
    reasonPlaceholder: 'Fx Fondsmidler bevilget',
  },

  sandbox: {
    title: 'Scenarie',
    body: 'Du afprøver ændringer i en kopi af planen. Den rigtige plan er uændret, indtil du anvender ændringerne. Scenariet gemmes ikke, hvis du lukker siden.',
    compare: 'Sammenlign med den rigtige plan',
    hideCompare: 'Skjul sammenligning',
    apply: 'Anvend ændringerne',
    discard: 'Kassér scenariet',
    noChanges: 'Ingen ændringer endnu.',
    changes: (n: number) => `${n} ${n === 1 ? 'ændring' : 'ændringer'} i scenariet`,
    discardConfirmTitle: 'Kassér scenariet?',
    discardConfirmBody: 'Ændringerne i scenariet går tabt. Den rigtige plan er uændret.',
    applied: 'Ændringerne er anvendt på den rigtige plan.',
    conflict:
      'Den rigtige plan er ændret, siden scenariet blev åbnet. Kassér scenariet og prøv igen.',
    timeStopped: 'Tiden står stille, mens et scenarie er åbent.',
    ghost: 'Rigtig plan',
  },

  scenarioBook: {
    open: 'Fra scenarie…',
    title: 'Ny eksempelbog fra et scenarie',
    description:
      'Bogen følger et navngivet forløb fra scenariebiblioteket. Den spilles frem til den simulerede dato og fortsætter historien, når du går frem i tiden.',
    scenario: 'Scenarie',
    workingTitle: 'Arbejdstitel',
    releaseDate: 'Ønsket udgivelsesdato',
    releaseHint: 'Ligger udgivelsen tæt på, er bogen allerede godt i gang.',
    create: 'Opret bog',
    count: 'Antal bøger',
    countHint: 'Flere bøger får hver sin udgivelsesdato med 3 ugers mellemrum.',
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
  funding_changed: 'Finansiering',
  gate_decided: 'Beslutning',
  roles_assigned: 'Roller',
  undone: 'Fortrudt',
  redone: 'Gentaget',
} as const

export const FUNDING_STATUS_LABELS = {
  planned: 'Planlagt',
  submitted: 'Indsendt',
  granted: 'Bevilget',
  rejected: 'Afslået',
} as const

export const GATE_DECISION_LABELS = { go: 'GO', hold: 'HOLD', no_go: 'NO-GO' } as const

export const WORK_BUCKET_LABELS = {
  overdue: 'Forsinket',
  waiting: 'Afventer',
  due_this_week: 'Deadline denne uge',
  starting_this_week: 'Starter denne uge',
  due_next_week: 'Deadline næste uge',
  in_progress: 'I gang',
} as const

export const PUSH_REASON_LABELS = {
  predecessor: 'Venter på',
  today: 'Ikke nået i tide',
  waiting: 'Afventer',
  started_late: 'Startede senere end planlagt',
} as const
