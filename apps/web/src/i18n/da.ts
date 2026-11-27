/**
 * Danish UI strings. Everything user-facing goes through this dictionary so an
 * English version can be added later without hunting through components.
 */
export const da = {
  appName: 'Produktionsplan',
  appTagline: 'Bogudgivelser',
  skipToContent: 'Spring til indholdet',
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
    version: 'Version',
    versionOf: (n: number) => `Version ${n}`,
    builtIn: 'Indbygget',
    publishedOn: (date: string) => `Udgivet ${date}`,
    usedBy: (n: number) => (n === 1 ? '1 udgivelse' : `${n} udgivelser`),
    edit: 'Redigér masterplanen',
    continueDraft: (n: number) => `Fortsæt kladden til version ${n}`,
    versions: 'Versioner',
    versionsHint:
      'Nye udgivelser oprettes fra den nyeste version. Eksisterende udgivelser beholder den version, de blev oprettet fra.',
    compare: 'Ændringer',
    compareTitle: (from: number, to: number) => `Ændringer fra version ${from} til ${to}`,
    latest: 'Nyeste',
    draft: 'Kladde',
  },

  templateEditor: {
    title: (n: number) => `Masterplan · kladde til version ${n}`,
    description: (base: number) =>
      `Ændringerne gælder kun nye udgivelser, når kladden er udgivet. Baseret på version ${base}.`,
    noDraft: 'Der er ingen kladde af masterplanen.',
    back: 'Tilbage til masterplanen',
    undo: 'Fortryd',
    discard: 'Kassér kladde',
    discardTitle: 'Kassér kladden?',
    discardBody: 'Alle ændringer i kladden går tabt. De udgivne versioner påvirkes ikke.',
    publish: (n: number) => `Udgiv version ${n}`,
    publishTitle: (n: number) => `Udgiv version ${n}`,
    publishBody:
      'Nye udgivelser oprettes herefter fra denne version. Eksisterende udgivelser beholder deres version.',
    changeNote: 'Hvad er ændret?',
    changeNotePlaceholder: 'Fx Billedresearch forlænget efter erfaringer fra forårets bøger',
    noChanges: 'Kladden er magen til den version, den bygger på.',
    blocked: 'Ret fejlene, før kladden kan udgives.',
    issues: 'Problemer',
    errors: (n: number) => (n === 1 ? '1 fejl' : `${n} fejl`),
    warnings: (n: number) => (n === 1 ? '1 advarsel' : `${n} advarsler`),
    noIssues: 'Ingen problemer: netværket hænger sammen.',
    moved: (n: number) =>
      n === 1
        ? '1 anden aktivitet blev flyttet, så afhængighederne holder.'
        : `${n} andre aktiviteter blev flyttet, så afhængighederne holder.`,
    hint: 'Klik på en aktivitet for at redigere den. Varighed og deadline kan rettes direkte i tabellen; afhængige aktiviteter flyttes med.',
    actual: 'Faktisk',
    actualHint: (count: number, min: number, max: number) =>
      `Median af ${count} færdige ${count === 1 ? 'opgave' : 'opgaver'} i dette datasæt (${min}–${max} arbejdsdage)`,
    workdays: 'arbejdsdage',
    durationLabel: 'Varighed (arbejdsdage)',
    deadlineLabel: 'Deadline (arbejdsdage fra udgivelse)',
    deadlineHint: 'Negativ = før udgivelse. Udgivelsen er dag 0.',
    addActivity: 'Aktivitet',
    addMilestone: 'Milepæl',
    addTrack: 'Spor',
    newActivity: 'Ny aktivitet',
    newMilestone: 'Ny milepæl',
    newTrack: 'Nyt spor',
    trackName: 'Sporets navn',
    editPhase: 'Redigér fase',
    phaseName: 'Navn',
    phasePeriod: 'Periode (tekst)',
    phaseDescription: 'Beskrivelse',
    phaseWindow: 'Nominelt vindue (arbejdsdage fra udgivelse)',
    windowFrom: 'Fra',
    windowTo: 'Til',
    moveUp: 'Flyt op',
    moveDown: 'Flyt ned',
    moveToTrack: 'Flyt til spor',
    fixedDuration: 'Fast varighed',
    movedSummary: (n: number) =>
      n === 1
        ? '1 aktivitet flyttet, så afhængighederne holder'
        : `${n} aktiviteter flyttet, så afhængighederne holder`,
    error: 'Fejl',
    warning: 'Advarsel',
    phaseOf: (n: number, name: string) => `Fase ${n} · ${name}`,
    change: { added: 'Tilføjet', removed: 'Fjernet', changed: 'Ændret' },
    entity: { phase: 'Fase', track: 'Spor', activity: '' },
    editActivity: 'Redigér',
    moreActions: (name: string) => `${name}: flere handlinger`,
    rename: 'Omdøb',
    remove: 'Slet',
    removeTrackTitle: (name: string) => `Slet sporet "${name}"?`,
    removeTrackBody: (n: number) =>
      n === 0
        ? 'Sporet er tomt.'
        : `Sporets ${n === 1 ? 'aktivitet' : `${n} aktiviteter`} slettes også. Efterfølgende aktiviteter mister afhængigheden, men beholder deres placering.`,
    removeActivityTitle: (name: string) => `Slet "${name}"?`,
    removeActivityBody:
      'Efterfølgende aktiviteter mister afhængigheden, men beholder deres placering.',
    cancel: 'Annullér',
    save: 'Gem',
    close: 'Luk',
    panel: {
      name: 'Aktivitet',
      kind: 'Type',
      responsible: 'Ansvarlig',
      mode: 'Ansvar',
      joint: 'I fællesskab (+)',
      either: 'En af dem (/)',
      optional: 'Valgfri',
      optionalHint: 'Kan fravælges, når en bog oprettes ("Eventuel…").',
      compressible: 'Kan komprimeres',
      compressibleHint:
        'Fjern fluebenet for leverandørtider (tryk, transport), som ikke kan forkortes for at holde udgivelsen.',
      note: 'Note',
      gate: 'Beslutningsport: kan ikke slettes, og typen ligger fast.',
      releaseLocked: 'Udgivelsen er altid dag 0.',
      predecessors: 'Afhænger af',
      noPredecessors: 'Ingen. Aktiviteten starter netværket.',
      successors: 'Efterfølgere',
      addDependency: 'Tilføj afhængighed…',
      lag: 'Forskydning',
      removeDependency: 'Fjern afhængighed',
      depTypes: {
        FS: 'Starter efter slut',
        SS: 'Starter efter start',
        FF: 'Slutter efter slut',
      },
      track: 'Spor',
      placement: (start: string, end: string) => `${start} → ${end}`,
    },
  },

  onboarding: {
    title: 'Kom godt i gang',
    realBody:
      'Her ligger dine egne udgivelser, gemt i denne browser. Start med at se masterplanen igennem, og opret så den første bog.',
    demoBody: 'Demoen er tom. Nulstil den for at få eksempelbøgerne tilbage.',
    masterplan: 'Gennemgå masterplanen',
    masterplanBody:
      'Alle planer bygger på masterplanen. Ret varigheder og afhængigheder, så de passer til forlaget.',
    masterplanAction: 'Åbn masterplanen',
    create: 'Opret en udgivelse',
    createBody: 'Angiv titel og ønsket udgivelsesdato. Planen beregnes baglæns fra udgivelsen.',
    demo: 'Prøv demoen',
    demoStepBody:
      'Fem eksempelbøger med forsinkelser og en tidsmaskine. Ændringer i demoen rører ikke dine data.',
    demoAction: 'Skift til demo',
    reset: 'Nulstil demoen',
    resetBody: 'Bygger eksempelbøgerne op igen frem til i dag.',
    dismiss: 'Skjul tip',
    hints: {
      demo: 'Du kigger på demoen. Brug Tidsmaskinen øverst til at spole tiden frem og se, hvordan planerne skrider, og skift til "Rigtige data" i menuen for dine egne bøger.',
      publication:
        'Tabellen svarer til masterplanens skema; Gantt viser det samme som tidslinje. Skift status direkte i tabellen, og brug "Flyt" eller træk i Gantt for at se, hvad en forsinkelse betyder, før den gemmes.',
      masterplan:
        'Masterplanen er skabelonen for nye udgivelser. Redigér den i en kladde og udgiv den som en ny version; eksisterende bøger beholder deres version.',
    },
  },

  errorPage: {
    title: 'Siden kunne ikke vises',
    body: 'Der opstod en fejl, mens siden blev tegnet. Dine data er ikke ændret.',
    retry: 'Prøv igen',
    home: 'Gå til oversigten',
  },

  errors: {
    unexpected: 'Der opstod en uventet fejl',
    conflict:
      'Ændringen kan ikke fortrydes, fordi planen er ændret siden. Fortryd de senere ændringer først.',
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
    templateVersion: 'Masterplan',
    templateVersionOption: (n: number, latest: boolean) =>
      latest ? `Version ${n} (nyeste)` : `Version ${n}`,
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
    otherActivities: 'Øvrige aktiviteter',
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

  print: {
    action: 'Udskriv',
    actionHint: 'Udskriv eller gem planen som PDF (A3 liggende)',
    back: 'Tilbage til udgivelsen',
    title: 'Produktionsplan',
    print: 'Udskriv / gem som PDF',
    hint: 'Vælg "Gem som PDF" som printer for at få en PDF. Papirformatet sættes automatisk.',
    gantt: 'Gantt',
    table: 'Tabel',
    paper: 'Papir',
    asOfLabel: 'Status pr.',
    simulated: 'simuleret dato',
    kickoff: 'Startmøde',
    release: 'Udgivelse',
    forecast: 'Prognose',
    projectLead: 'Projektansvarlig',
    template: (version: number) => `Masterplan version ${version}`,
    noteColumn: 'Bemærkning / afhængighed',
    after: 'Efter',
    waitingFor: 'Afventer',
    forecastShort: 'Prognose',
    legend: {
      planned: 'Planlagt opgave',
      inProgress: 'I gang',
      done: 'Færdig',
      waiting: 'Afventer',
      forecast: 'Prognose efter deadline',
      baseline: 'Oprindelig plan',
      deadline: 'Deadline',
      milestone: 'Milepæl',
      today: 'Statusdato',
      release: 'Udgivelse',
      late: 'Forsinket',
    },
    nothing: 'Vælg Gantt, tabel eller begge.',
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

/** Danish text for template validator issues (see `validateTemplate`). */
export const TEMPLATE_ISSUE_TEXT = {
  'duplicate-id': () => 'To elementer har samme id.',
  'unknown-phase': () => 'Henviser til en fase, der ikke findes.',
  'unknown-track': () => 'Henviser til et spor, der ikke findes.',
  'track-phase-mismatch': () => 'Sporet ligger i en anden fase.',
  'unknown-predecessor': () => 'Afhænger af en aktivitet, der ikke findes.',
  'self-dependency': () => 'Afhænger af sig selv.',
  cycle: (names: string) => `Afhængighederne går i ring: ${names}.`,
  'dependency-violated': (pred: string, days: number) =>
    `Ligger ${days} ${days === 1 ? 'arbejdsdag' : 'arbejdsdage'} for tidligt i forhold til "${pred}".`,
  'duplicate-gate': () => 'Beslutningsporten findes på mere end én milepæl.',
  'release-not-at-zero': () => 'Udgivelsen skal ligge på dag 0.',
  'milestone-outside-window': () => 'Milepælen ligger uden for fasens nominelle vindue.',
  'before-kickoff': (days: number) =>
    `Starter ${days} ${days === 1 ? 'arbejdsdag' : 'arbejdsdage'} før startmødet.`,
  'empty-track': () => 'Sporet har ingen aktiviteter.',
  orphan: () => 'Har ingen forgængere og hænger ikke sammen med resten af planen.',
} as const

export const TEMPLATE_FIELD_LABELS = {
  name: 'navn',
  period: 'periode',
  description: 'beskrivelse',
  window: 'vindue',
  phase: 'fase',
  track: 'spor',
  kind: 'type',
  responsible: 'ansvarlig',
  duration: 'varighed',
  deadline: 'deadline',
  predecessors: 'afhængigheder',
  optional: 'valgfri',
  compressible: 'kan komprimeres',
  note: 'note',
} as const

/** Danish text for refused template edits (see `TemplateEditError`). */
export const TEMPLATE_EDIT_ERROR_TEXT = {
  unknown: 'Elementet findes ikke længere.',
  'duplicate-id': 'Id findes allerede.',
  'gate-locked': 'Beslutningsporte kan ikke slettes: planlægningen bygger på dem.',
  'release-locked': 'Udgivelsen ligger altid på dag 0.',
  'kind-locked': 'Milepæle beholder deres type.',
  'invalid-duration': 'Varigheden skal være et helt antal arbejdsdage, mindst 1.',
  'invalid-window': 'Vinduet kan ikke slutte, før det starter.',
  'self-dependency': 'En aktivitet kan ikke afhænge af sig selv.',
  'duplicate-dependency': 'Afhængigheden findes allerede.',
  cycle: 'Det ville få afhængighederne til at gå i ring.',
  'milestone-track': 'Milepæle ligger på fasen, ikke i et spor.',
} as const

/** Danish text for refused commands (see `CommandError`). */
export const COMMAND_ERROR_TEXT = {
  unknown: 'Elementet findes ikke længere.',
  'reason-required': 'Angiv en begrundelse.',
  'no-release': 'Planen har ingen udgivelsesmilepæl.',
  'pinned-conflict':
    'Ændringen ville flytte fastlåste aktiviteter. Godkend konflikten eller vælg en anden løsning.',
  'waiting-needs-text': 'Skriv, hvad aktiviteten afventer.',
  'finish-before-start': 'En aktivitet kan ikke blive færdig, før den er startet.',
  'funding-insufficient':
    'Finansieringen er ikke tilstrækkelig. Registrér bevillinger op til minimum, eller godkend risikoen under Finansiering.',
  'not-optional': 'Kun valgfrie aktiviteter kan fravælges.',
  'not-a-gate': 'Aktiviteten er ikke en GO / HOLD / NO-GO-beslutning.',
  'already-decided': 'Beslutningen er allerede truffet.',
  'publication-finished': 'Udgivelsen er afsluttet eller stoppet og kan ikke ændres sådan.',
  'already-binding': 'Planen er allerede bindende.',
  'not-binding': 'Kun en bindende plan har baselines.',
  'already-paused': 'Udgivelsen er allerede sat på pause.',
  'not-paused': 'Udgivelsen er ikke sat på pause.',
  'resume-before-pause': 'Genoptagelsen kan ikke ligge før pausens start.',
  'self-dependency': 'En aktivitet kan ikke afhænge af sig selv.',
  'duplicate-dependency': 'Afhængigheden findes allerede.',
  cycle: 'Det ville få afhængighederne til at gå i ring.',
  'negative-amount': 'Beløbet skal være 0 eller mere.',
  'funder-required': 'Angiv, hvem der er søgt.',
  'decision-before-submission': 'Svaret kan ikke ligge før ansøgningen blev sendt.',
} as const
