/**
 * Masterproduktionsplan for bogudgivelser, version 1.
 *
 * Source: Research/Masterproduktionsplan_bogudgivelser.pdf
 *
 * Activity names, phases, tracks, responsibilities and milestones are taken
 * directly from the PDF. Durations, default deadlines and dependencies are NOT in
 * the PDF. They are our proposal, fitted into the PDF's phase windows, and must be
 * validated with the client (see docs/masterplan-defaults.md).
 *
 * Units: working days. Offsets are relative to the release date (Udgivelse = 0).
 * Rule of thumb used: 1 month ≈ 21 working days, 1 week = 5 working days.
 *
 *   task(id, name, responsible, duration, deadline, predecessors?, opts?)
 *   point(id, name, responsible, deadline, predecessors?, opts?)      deadline only
 *   milestone(id, name, responsible, deadline, predecessors, opts?)   phase gate
 *
 * A predecessor given as a plain id is finish-to-start with no lag.
 */
import { buildTemplate, milestone, phase, point, task, track } from './builder'

export const MASTERPLAN_V1 = buildTemplate(
  {
    id: 'masterplan',
    version: 1,
    name: 'Masterproduktionsplan for bogudgivelser',
    description:
      'Arbejdsdokument for planlægning, styring og opfølgning fra startmøde til evaluering.',
    nominalKickoffOffset: -231,
  },
  [
    // ── 1 Startmøde ───────────────────────────────────────────────────────────
    phase(
      {
        id: 'p01',
        number: 1,
        name: 'Startmøde',
        period: 'Ca. 10–11 måneder før ønsket udgivelse',
        window: [-231, -210],
        anchor: 'kickoff',
        description:
          'Projektets idé, formål, målgruppe og rammer · roller og centrale medvirkende · foreløbig økonomi og finansiering',
      },
      [
        track('p01-project', 'Projekt og beslutning', [
          task('kickoff-meeting', 'Startmøde indkaldes og gennemføres', 'Projektansvarlig', 5, -226),
          point('kickoff-idea', 'Bogens idé, formål og forlagets begrundelse drøftes', 'Forlægger/redaktør', -226, ['kickoff-meeting']),
          point('kickoff-market', 'Målgruppe, marked og position drøftes', 'Forlægger', -226, ['kickoff-meeting']),
          point('kickoff-content', 'Foreløbigt indhold og struktur drøftes', 'Redaktør', -226, ['kickoff-meeting']),
          point('kickoff-contributors', 'Centrale medvirkende identificeres', 'Redaktør', -226, ['kickoff-meeting']),
          point('kickoff-roles', 'Projektorganisation og roller fastlægges: projektansvarlig, redaktør, grafiker og øvrige medvirkende', 'Forlaget', -226, ['kickoff-meeting']),
          point('kickoff-format', 'Format, omfang og billedniveau drøftes', 'Redaktør + grafiker', -226, ['kickoff-meeting']),
          point('kickoff-finance', 'Foreløbig økonomi og finansieringsmuligheder drøftes', 'Projektansvarlig', -226, ['kickoff-meeting']),
          point('kickoff-release-time', 'Ønsket udgivelsestidspunkt fastlægges foreløbigt', 'Projektansvarlig', -226, ['kickoff-meeting']),
          point('kickoff-risks', 'Muligheder, bindinger og risici identificeres', 'Projektansvarlig', -226, ['kickoff-meeting']),
          task('project-description', 'Kort projektbeskrivelse udarbejdes', 'Redaktør', 5, -218, ['kickoff-idea', 'kickoff-content']),
          task('preliminary-economy', 'Foreløbig udgivelsesøkonomi udarbejdes', 'Projektansvarlig', 5, -218, ['kickoff-finance', 'kickoff-format']),
          task('funding-needs', 'Finansieringsbehov og muligheder undersøges', 'Projektansvarlig', 8, -215, ['kickoff-finance']),
          task('rights-contracts', 'Rettigheds- og kontraktforhold afdækkes', 'Projektansvarlig', 8, -215, ['kickoff-contributors']),
        ]),
      ],
      [
        milestone('m-go', 'GO / HOLD / NO-GO', 'Forlaget', -213,
          ['project-description', 'preliminary-economy', 'funding-needs', 'rights-contracts', 'kickoff-market', 'kickoff-roles', 'kickoff-release-time', 'kickoff-risks'],
          { gate: 'go_hold_nogo' }),
      ],
    ),

    // ── 2 Grundlaget lægges ───────────────────────────────────────────────────
    phase(
      {
        id: 'p02',
        number: 2,
        name: 'Grundlaget lægges',
        period: 'Ca. 10 måneder før ønsket udgivelse',
        window: [-213, -189],
        anchor: 'kickoff',
        description:
          'Økonomi, finansiering og aftaler · bogens rammer og tidlige visuelle princip · bindende tidsplan. Styrende betingelse: Ønsket udgivelsesdato bliver først bindende, når finansieringen er tilstrækkelig, eller forlaget har godkendt risikoen.',
      },
      [
        track('p02-finance', 'Økonomi, finansiering og aftaler', [
          task('detailed-budget', 'Detaljeret produktionsbudget', 'Projektansvarlig', 8, -203, ['m-go']),
          task('sales-economics', 'Salgsøkonomi, oplag, pris og break-even', 'Forlægger + projektansvarlig', 5, -198, ['detailed-budget']),
          task('funding-plan', 'Finansieringsplan', 'Projektansvarlig', 5, -193, ['sales-economics']),
          task('fund-strategy', 'Fondsstrategi og ansøgningsplan', 'Projektansvarlig', 5, -205, ['m-go']),
          task('fund-applications', 'Fondsansøgninger', 'Projektansvarlig/redaktør', 10, -193, ['fund-strategy', 'detailed-budget']),
          task('funding-status', 'Finansieringsstatus registreres og følges', 'Projektansvarlig', 8, -193, [{ id: 'fund-applications', type: 'SS' }]),
          task('author-agreement', 'Forfatteraftale', 'Forlægger', 10, -200, ['m-go']),
          task('contributor-agreements', 'Aftaler med øvrige bidragydere', 'Projektansvarlig', 10, -195, ['m-go']),
          task('designer-agreement', 'Grafikeraftale', 'Projektansvarlig', 5, -203, ['m-go']),
          task('other-agreements', 'Aftaler med fotograf, oversætter, korrekturlæser mv.', 'Projektansvarlig', 10, -192, ['m-go']),
        ]),
        track('p02-frame', 'Bogens rammer', [
          task('preliminary-format', 'Foreløbigt format og omfang', 'Redaktør + grafiker', 5, -205, ['m-go']),
          task('image-level', 'Billedniveau og særlige produktionsønsker', 'Redaktør + grafiker', 5, -205, ['m-go']),
          task('overall-structure', 'Overordnet struktur', 'Redaktør + forfatter', 8, -200, ['m-go']),
          task('early-visual', 'Tidligt visuelt princip', 'Grafiker + redaktør', 8, -195, ['preliminary-format', 'image-level', 'designer-agreement']),
          task('early-sketches', 'Eventuelle tidlige prøveopslag eller skitser', 'Grafiker', 5, -190, ['early-visual'], { optional: true }),
        ]),
        track('p02-schedule', 'Tidsplan', [
          task('printer-lead-time', 'Trykkeriets produktionstid indhentes', 'Projektansvarlig', 5, -200, ['m-go']),
          task('delivery-date', 'Planlagt leveringsdato aftales', 'Projektansvarlig', 3, -196, ['printer-lead-time']),
          point('binding-release-date', 'Bindende udgivelsesdato fastlægges', 'Forlaget', -193, ['delivery-date', 'm-funding'],
            { note: 'Kan først fastlægges, når finansieringen er tilstrækkelig eller risikoen godkendt.' }),
          task('backward-plan', 'Hele produktionsplanen beregnes baglæns', 'Projektansvarlig', 2, -191, ['binding-release-date']),
          task('deadlines-set', 'Start og deadlines fastlægges for alle aktiviteter', 'Projektansvarlig', 1, -190, ['backward-plan']),
          task('responsibilities-confirmed', 'Ansvar for alle aktiviteter fordeles og bekræftes', 'Projektansvarlig', 2, -188, ['deadlines-set']),
        ]),
      ],
      [
        milestone('m-funding', 'Finansiering tilstrækkelig / risiko godkendt', 'Forlaget', -193,
          ['funding-plan', 'fund-applications', 'funding-status'],
          { gate: 'funding_secured', note: 'Når milepælen er nået, bliver planen bindende og den oprindelige plan (baseline) gemmes.' }),
        milestone('m-production-start', 'Produktionsstart', 'Projektansvarlig', -188,
          ['responsibilities-confirmed', 'author-agreement', 'designer-agreement', 'contributor-agreements', 'other-agreements', 'overall-structure', 'early-visual'],
          { gate: 'production_start' }),
      ],
    ),

    // ── 3 Indholdet udvikles ──────────────────────────────────────────────────
    phase(
      {
        id: 'p03',
        number: 3,
        name: 'Indholdet udvikles',
        period: 'Ca. 9–6½ måned før udgivelse',
        window: [-189, -137],
        anchor: 'release',
        description: 'Manus og redaktion · billedresearch og rettigheder · løbende finansieringsopfølgning',
      },
      [
        track('p03-manuscript', 'Manus og redaktion', [
          task('editorial-kickoff', 'Redaktionelt startmøde', 'Redaktør', 1, -186, ['m-production-start']),
          task('final-outline', 'Endelig disposition', 'Redaktør + forfatter', 5, -181, ['editorial-kickoff']),
          task('manuscript-plan', 'Manuskriptplan og delleverancer', 'Redaktør', 3, -178, ['final-outline']),
          task('first-draft', 'Første komplette manuskript', 'Forfatter', 22, -156, ['manuscript-plan']),
          task('editorial-review', 'Overordnet redaktionel gennemgang', 'Redaktør', 5, -151, ['first-draft']),
          task('editorial-feedback', 'Redaktionel tilbagemelding', 'Redaktør', 1, -150, ['editorial-review']),
          task('revision', 'Revision', 'Forfatter', 8, -142, ['editorial-feedback']),
          point('revised-manuscript', 'Revideret manuskript', 'Forfatter', -142, ['revision']),
          task('detailed-editing', 'Detaljeret tekstredaktion', 'Redaktør', 5, -137, ['revised-manuscript']),
        ]),
        track('p03-images', 'Billeder', [
          task('illustration-list', 'Illustrationsliste oprettes', 'Billedansvarlig', 5, -176, ['final-outline']),
          task('image-research', 'Billedresearch', 'Billedansvarlig + redaktør', 20, -156, ['illustration-list']),
          task('image-selection', 'Billedudvælgelse', 'Redaktør', 5, -151, ['image-research']),
          task('missing-material', 'Manglende materiale identificeres', 'Billedansvarlig', 3, -148, ['image-selection']),
          task('image-requests', 'Billeder rekvireres', 'Billedansvarlig', 10, -138, ['missing-material']),
          task('photo-planning', 'Nyfotografering planlægges', 'Billedansvarlig', 3, -145, ['missing-material'], { optional: true }),
          task('photo-shoot', 'Nyfotografering gennemføres', 'Fotograf', 5, -140, ['photo-planning'], { optional: true }),
          task('scanning', 'Scanning eller affotografering', 'Billedansvarlig', 5, -140, ['missing-material'], { optional: true }),
          task('rights-research', 'Rettigheder undersøges', 'Billedansvarlig', 10, -141, ['image-selection']),
          task('visda-permissions', 'VISDA og øvrige tilladelser undersøges', 'Billedansvarlig', 5, -138, [{ id: 'rights-research', type: 'SS', lag: 5 }]),
        ]),
        track('p03-funding', 'Finansiering løbende spor', [
          task('fund-follow-up', 'Fondsansøgninger følges', 'Projektansvarlig', 45, -140, ['m-production-start']),
          task('grants-registered', 'Bevillinger, afslag og vilkår registreres', 'Projektansvarlig', 40, -140, [{ id: 'fund-follow-up', type: 'SS', lag: 5 }]),
          task('supplementary-funding', 'Supplerende finansiering søges om nødvendigt', 'Projektansvarlig', 20, -150, ['m-production-start'], { optional: true }),
          task('funding-impact', 'Konsekvenser for produktionen vurderes ved ændret finansiering', 'Forlaget', 3, -140, ['supplementary-funding'], { optional: true }),
          task('budget-revision', 'Budget og tidsplan revideres om nødvendigt', 'Projektansvarlig', 3, -137, ['funding-impact'], { optional: true }),
        ], 'Løber parallelt gennem hele fasen.'),
      ],
      [
        milestone('m-revised-manuscript', 'Revideret og gennemredigeret manus', 'Redaktør', -137, ['detailed-editing']),
      ],
    ),

    // ── 4 Materialet færdiggøres ──────────────────────────────────────────────
    phase(
      {
        id: 'p04',
        number: 4,
        name: 'Materialet færdiggøres',
        period: 'Ca. 6½–5 måneder før udgivelse',
        window: [-137, -105],
        anchor: 'release',
        description: 'Slutredaktion og Word-korrektur · billedudvælgelse, kreditering og filkontrol',
      },
      [
        track('p04-manuscript', 'Manus', [
          task('final-author-revision', 'Eventuel sidste forfatterrevision', 'Forfatter', 5, -132, ['m-revised-manuscript'], { optional: true }),
          task('final-editorial-review', 'Redaktionel slutgennemgang', 'Redaktør', 5, -127, ['final-author-revision']),
          task('foreword', 'Forord og øvrige tekster', 'Redaktør/forfatter', 10, -127, ['m-revised-manuscript']),
          task('notes-bibliography', 'Noter og litteraturliste', 'Redaktør/forfatter', 10, -127, ['m-revised-manuscript']),
          task('author-bios', 'Forfatterbiografier', 'Redaktør', 3, -130, ['m-revised-manuscript']),
          task('captions', 'Billedtekster', 'Redaktør', 5, -125, ['m-revised-manuscript', 'image-selection']),
          task('colophon', 'Kolofon', 'Redaktør/projektansvarlig', 2, -125, ['m-revised-manuscript']),
          task('isbn', 'ISBN indhentes og indsættes', 'Projektansvarlig', 2, -125, ['m-revised-manuscript']),
          point('manuscript-approved', 'Manus godkendes redaktionelt', 'Redaktør', -125,
            ['final-editorial-review', 'foreword', 'notes-bibliography', 'author-bios', 'captions', 'colophon', 'isbn']),
          task('word-proofreading', 'Grundig korrektur af Word-manuskript', 'Korrekturlæser', 8, -117, ['manuscript-approved']),
          task('word-corrections-entered', 'Rettelser indføres', 'Redaktør', 3, -114, ['word-proofreading']),
          task('word-corrections-checked', 'Rettet manus kontrolleres', 'Redaktør', 2, -112, ['word-corrections-entered']),
        ]),
        track('p04-images', 'Billeder', [
          task('final-image-selection', 'Endelig billedudvælgelse', 'Redaktør', 5, -130, ['image-requests', 'photo-shoot', 'scanning']),
          task('hires-files', 'Manglende højopløselige filer indhentes', 'Billedansvarlig', 10, -120, ['final-image-selection']),
          task('image-tech-check', 'Teknisk kontrol af billedfiler', 'Billedansvarlig/grafiker', 5, -115, ['hires-files']),
          task('rights-cleared', 'Rettigheder færdigcleares', 'Billedansvarlig', 10, -120, ['final-image-selection', 'visda-permissions']),
          task('credit-lines', 'Kreditlinjer færdiggøres', 'Billedansvarlig', 3, -117, ['rights-cleared']),
          task('images-captions-matched', 'Billeder og billedtekster sammenholdes', 'Redaktør + billedansvarlig', 2, -115, ['captions', 'credit-lines']),
          task('final-illustration-list', 'Endelig illustrationsliste', 'Billedansvarlig', 2, -113, ['images-captions-matched', 'image-tech-check']),
          task('files-organised', 'Filer navngives og organiseres', 'Billedansvarlig', 2, -111, ['final-illustration-list']),
        ]),
      ],
      [
        milestone('m-manuscript-locked', 'Manus låst til layout', 'Redaktør', -112, ['word-corrections-checked']),
        milestone('m-images-complete', 'Billedmateriale komplet til layout', 'Billedansvarlig', -111, ['files-organised']),
      ],
    ),

    // ── 5 Bogen tager form ────────────────────────────────────────────────────
    phase(
      {
        id: 'p05',
        number: 5,
        name: 'Bogen tager form',
        period: 'Ca. 5–3½ måned før udgivelse',
        window: [-105, -74],
        anchor: 'release',
        description: 'Principlayout · produktionsvalg og budgetkontrol · fuld ombrydning',
      },
      [
        track('p05-design', 'Design', [
          point('handover-to-designer', 'Samlet materiale afleveres til grafiker', 'Projektansvarlig', -105, ['m-manuscript-locked', 'm-images-complete']),
          task('principle-layout', 'Principlayout udvikles', 'Grafiker', 10, -95, ['handover-to-designer']),
          task('sample-spreads', 'Repræsentative prøveopslag', 'Grafiker', 5, -92, [{ id: 'principle-layout', type: 'SS', lag: 5 }]),
          task('layout-review', 'Principlayout gennemgås', 'Redaktør + grafiker', 2, -90, ['principle-layout', 'sample-spreads']),
          task('layout-adjustments', 'Justeringer', 'Grafiker', 5, -85, ['layout-review']),
          task('layout-approval', 'Principlayout godkendes', 'Redaktør + forlægger + opdragsgiver', 2, -83, ['layout-adjustments']),
        ]),
        track('p05-production', 'Produktion', [
          task('final-format', 'Endeligt format og sidetal', 'Grafiker + projektansvarlig', 3, -92, ['principle-layout']),
          task('paper-binding', 'Papir og indbinding', 'Grafiker + forlægger', 5, -90, ['handover-to-designer']),
          task('print-price', 'Trykpris bekræftes', 'Projektansvarlig', 5, -85, ['final-format', 'paper-binding']),
          task('print-run-price', 'Oplag og udsalgspris bekræftes', 'Forlægger', 3, -82, ['print-price']),
          task('budget-check', 'Budgetkontrol', 'Projektansvarlig', 2, -80, ['print-run-price']),
          task('paper-ordered', 'Papir bestilles eller reserveres', 'Projektansvarlig/trykker', 2, -78, ['budget-check']),
        ]),
        track('p05-typesetting', 'Ombrydning', [
          task('full-typesetting', 'Fuld ombrydning', 'Grafiker', 8, -75, ['m-layout-approved']),
          task('typesetting-review', 'Overordnet gennemgang', 'Redaktør + grafiker', 2, -73, ['full-typesetting']),
          task('typesetting-adjustments', 'Layoutjusteringer', 'Grafiker', 2, -71, ['typesetting-review']),
        ]),
      ],
      [
        milestone('m-layout-approved', 'Principlayout godkendt', 'Redaktør + forlægger + opdragsgiver', -83, ['layout-approval']),
        milestone('m-first-proof', '1. ombrud klar', 'Grafiker', -71, ['typesetting-adjustments']),
      ],
    ),

    // ── 6 Bogen gennemarbejdes ────────────────────────────────────────────────
    phase(
      {
        id: 'p06',
        number: 6,
        name: 'Bogen gennemarbejdes',
        period: 'Ca. 3½–2½ måned før udgivelse',
        window: [-74, -53],
        anchor: 'release',
        description: 'Ombrudskorrektur og repro · kommunikation og lancering · omslag og bagsidetekst',
      },
      [
        track('p06-proof', 'Ombrydning, korrektur og billeder', [
          task('first-proof-review', 'Samlet gennemgang af 1. ombrud', 'Redaktør + korrekturlæser', 8, -63, ['m-first-proof']),
          task('corrections-collected', 'Alle rettelser samles i ét dokument', 'Redaktør', 2, -61, ['first-proof-review']),
          task('first-proof-corrections', 'Rettelser indføres', 'Grafiker', 4, -57, ['corrections-collected']),
          task('repro', 'Endelig billedbehandling og repro', 'Repro/grafiker', 10, -60, ['m-first-proof']),
          task('crops-colours', 'Billedbeskæringer og farver kontrolleres', 'Grafiker + redaktør', 3, -57, ['repro']),
          task('second-proof-made', '2. ombrud fremstilles', 'Grafiker', 3, -54, ['first-proof-corrections', 'crops-colours']),
        ]),
        track('p06-launch', 'Kommunikation, lancering og omslag', [
          task('sales-copy', 'Salgstekst', 'Redaktør', 5, -64, ['m-first-proof']),
          task('comms-plan', 'Kommunikations- og presseplan', 'Presse/kommunikationsansvarlig', 5, -64, ['m-first-proof']),
          task('press-list-started', 'Presse- og anmelderliste påbegyndes', 'Presseansvarlig', 3, -60, ['comms-plan']),
          task('launch-planning', 'Lancering planlægges', 'Projektansvarlig', 5, -62, ['m-first-proof']),
          task('launch-venue', 'Sted, dato og samarbejdspartnere sikres', 'Projektansvarlig', 5, -57, ['launch-planning']),
          task('cover-development', 'Omslaget udvikles og drøftes', 'Grafiker + redaktør + opdragsgiver', 10, -60, ['m-first-proof']),
          task('back-cover-text', 'Bagsidetekst udvikles i samspil med omslagets layout og plads', 'Redaktør + grafiker + opdragsgiver', 5, -55, ['cover-development', 'sales-copy']),
        ]),
      ],
      [milestone('m-second-proof', '2. ombrud klar', 'Grafiker', -54, ['second-proof-made'])],
    ),

    // ── 7 Bogen lukkes ────────────────────────────────────────────────────────
    phase(
      {
        id: 'p07',
        number: 7,
        name: 'Bogen lukkes',
        period: 'Ca. 11–8 uger før udgivelse',
        window: [-55, -40],
        anchor: 'release',
        description: 'Korrektur og kvalitetssikring · endelig omslagsgodkendelse · salg, metadata og presse',
      },
      [
        track('p07-qa', 'Korrektur og kvalitetssikring', [
          task('second-proof-review', '2. ombrud gennemgås', 'Redaktør + korrekturlæser', 5, -49, ['m-second-proof']),
          task('previous-corrections-checked', 'Tidligere rettelser kontrolleres', 'Redaktør', 2, -49, ['m-second-proof']),
          task('final-image-check', 'Billeder og beskæringer slutkontrolleres', 'Redaktør + grafiker', 2, -50, ['m-second-proof']),
          task('final-captions-check', 'Billedtekster og credits slutkontrolleres', 'Redaktør + billedansvarlig', 2, -50, ['m-second-proof']),
          task('final-rights-check', 'Rettigheder slutkontrolleres', 'Billedansvarlig', 2, -50, ['m-second-proof']),
          task('index-preparation', 'Eventuelt register udarbejdes', 'Registerredaktør/redaktør', 5, -49, ['m-second-proof'], { optional: true }),
          task('index-entered', 'Register indføres og kontrolleres', 'Grafiker + redaktør', 3, -46, ['index-preparation'], { optional: true }),
          task('final-corrections', 'Sidste korrekturrettelser', 'Grafiker', 3, -43,
            ['second-proof-review', 'previous-corrections-checked', 'final-image-check', 'final-captions-check', 'index-entered']),
          task('cover-approval', 'Omslag og bagsidetekst godkendes samlet', 'Redaktør + grafiker + forlægger + opdragsgiver', 2, -50, ['back-cover-text']),
          task('publisher-qa', 'Samlet forlags-KS', 'Redaktør', 2, -41, ['final-corrections', 'cover-approval', 'final-rights-check']),
        ]),
        track('p07-sales', 'Salg og metadata', [
          task('bogportalen', 'Bogportalen og distributør', 'Salgs-/projektansvarlig', 3, -50, ['isbn', 'sales-copy']),
          task('metadata', 'Metadata', 'Salgs-/projektansvarlig', 3, -47, ['bogportalen']),
          task('sales-cover', 'Endeligt cover til salg', 'Grafiker', 2, -48, ['cover-approval']),
          task('sales-material-ready', 'Salgsmateriale færdiggøres', 'Salg/kommunikation', 4, -43, ['sales-cover', 'metadata']),
          point('sales-material-sent', 'Salgsmateriale udsendes', 'Salg/kommunikation', -42, ['sales-material-ready']),
        ]),
        track('p07-press', 'Presse', [
          task('press-release', 'Pressemeddelelse', 'Presseansvarlig/redaktør', 5, -45, ['comms-plan', 'cover-approval']),
          task('press-kit', 'Pressekit', 'Presseansvarlig', 3, -42, ['press-release', 'sales-cover']),
          task('final-press-list', 'Endelig presse- og anmelderliste', 'Presseansvarlig', 3, -45, ['press-list-started']),
          task('first-press-contact', 'Første pressekontakt', 'Presseansvarlig', 1, -40, ['press-kit', 'final-press-list']),
          task('own-channels', 'Website, nyhedsbrev og egne kanaler klargøres', 'Kommunikation', 5, -40, ['sales-cover']),
        ]),
      ],
      [milestone('m-book-closed', 'Bogen lukket', 'Redaktør', -41, ['publisher-qa'])],
    ),

    // ── 8 Bogen går i trykken ─────────────────────────────────────────────────
    phase(
      {
        id: 'p08',
        number: 8,
        name: 'Bogen går i trykken',
        period: 'Ca. 8–3 uger før udgivelse',
        window: [-40, -15],
        anchor: 'release',
        description:
          'Prepress, blåkopi, tryk og transport · presse- og lanceringsarbejde fortsætter parallelt',
      },
      [
        track('p08-print', 'Prepress og tryk', [
          task('specs-final-check', 'Produktionsspecifikationer slutkontrolleres', 'Grafiker + projektansvarlig', 1, -40, ['m-book-closed']),
          task('print-files', 'Trykfiler fremstilles', 'Grafiker', 2, -38, ['specs-final-check']),
          task('preflight', 'Preflight', 'Grafiker', 1, -37, ['print-files']),
          point('files-uploaded', 'Filer uploades', 'Grafiker', -37, ['preflight']),
          task('proof-review', 'Blåkopi eller digital proof gennemgås', 'Grafiker + redaktør', 3, -33, [{ id: 'files-uploaded', lag: 1 }]),
          task('technical-fixes', 'Eventuelle tekniske fejl rettes', 'Grafiker', 2, -31, ['proof-review'], { optional: true }),
          point('proof-approved', 'Blåkopi godkendes', 'Redaktør/forlægger', -31, ['technical-fixes']),
          task('colour-proof', 'Eventuel farveprøve godkendes', 'Grafiker + redaktør', 3, -31, [{ id: 'files-uploaded', lag: 1 }], { optional: true }),
          task('printing', 'Tryk og indbinding', 'Trykker', 12, -18, ['m-print-approval', 'paper-ordered']),
          task('production-follow-up', 'Produktion følges', 'Projektansvarlig', 12, -18, [{ id: 'printing', type: 'SS' }]),
          task('transport-follow-up', 'Transport følges', 'Projektansvarlig', 3, -15, ['printing']),
        ]),
        track('p08-press', 'Presse og lancering fortsætter parallelt', [
          task('media-contact', 'Pressearbejde og mediekontakt fortsætter', 'Presseansvarlig', 20, -15, ['first-press-contact']),
          task('digital-review-copies', 'Digitale læseeksemplarer udsendes efter behov', 'Presseansvarlig', 5, -25, ['m-book-closed', 'first-press-contact'], { optional: true }),
          task('launch-final-planning', 'Lancering færdigplanlægges', 'Projektansvarlig', 10, -20, ['launch-venue']),
          task('mailing-lists', 'Udsendelseslister gøres klar', 'Projektansvarlig + presseansvarlig', 3, -18, ['final-press-list']),
          task('launch-comms-prep', 'Lanceringskommunikation forberedes', 'Kommunikation', 5, -15, ['launch-final-planning', 'own-channels']),
        ]),
      ],
      [
        milestone('m-print-approval', 'Trykgodkendelse', 'Redaktør/forlægger', -30, ['proof-approved', 'colour-proof'],
          { note: 'Placeret før tryk og indbinding: trykket kan først starte, når blåkopien er godkendt.' }),
      ],
    ),

    // ── 9 Bogen udkommer ──────────────────────────────────────────────────────
    phase(
      {
        id: 'p09',
        number: 9,
        name: 'Bogen udkommer',
        period: 'Ca. 3 uger før udgivelse',
        window: [-15, -1],
        anchor: 'release',
        description: 'Modtagelse og fysisk kvalitetskontrol · presse-, anmelder- og frieksemplarer',
      },
      [
        track('p09-delivery', 'Levering, kvalitet og udsendelse', [
          task('delivery-follow-up', 'Levering følges', 'Projektansvarlig', 2, -13, ['transport-follow-up']),
          point('books-received', 'Bøger modtages', 'Projektansvarlig/lager', -13, ['delivery-follow-up']),
          task('physical-qc', 'Fysisk kvalitetskontrol', 'Redaktør + grafiker/projektansvarlig', 2, -11, ['books-received']),
          task('complaints', 'Eventuelle reklamationer', 'Projektansvarlig', 5, -6, ['physical-qc'], { optional: true }),
          task('review-copies', 'Anmeldereksemplarer udsendes', 'Presseansvarlig', 2, -8, ['m-books-in-stock', 'mailing-lists']),
          task('free-copies', 'Frieksemplarer udsendes', 'Projektansvarlig', 2, -8, ['m-books-in-stock']),
          task('funder-copies', 'Fondseksemplarer og samarbejdspartnere', 'Projektansvarlig', 2, -8, ['m-books-in-stock']),
          task('press-follow-up', 'Presseopfølgning', 'Presseansvarlig', 7, -1, ['review-copies']),
          task('launch-comms', 'Lanceringskommunikation', 'Kommunikationsansvarlig', 8, -1, ['launch-comms-prep']),
        ]),
      ],
      [milestone('m-books-in-stock', 'Færdige bøger godkendt og på lager', 'Projektansvarlig', -10, ['physical-qc'])],
    ),

    // ── 10 Udgivelse ──────────────────────────────────────────────────────────
    phase(
      {
        id: 'p10',
        number: 10,
        name: 'Udgivelse',
        period: 'Uge 0',
        window: [0, 5],
        anchor: 'release',
        description: 'Frigivelse til salg og distributionskontrol · presse · lancering eller reception',
      },
      [
        track('p10-release', 'Udgivelse og lancering', [
          point('released-for-sale', 'Bogen frigives til salg', 'Salgs-/projektansvarlig', 0, ['m-books-in-stock', 'metadata', 'sales-material-sent']),
          task('distribution-check', 'Distribution kontrolleres', 'Projektansvarlig', 3, 3, ['m-release']),
          task('channels-updated', 'Website og øvrige kanaler opdateres', 'Kommunikation', 1, 1, ['m-release']),
          task('press-work', 'Pressearbejde', 'Presseansvarlig', 5, 5, ['m-release']),
          task('launch-event', 'Lancering, reception eller event', 'Projektansvarlig', 1, 1, ['m-release', 'launch-final-planning']),
        ]),
      ],
      [milestone('m-release', 'Udgivelse', 'Forlaget', 0, ['released-for-sale'], { gate: 'release' })],
    ),

    // ── 11 Opfølgning ─────────────────────────────────────────────────────────
    phase(
      {
        id: 'p11',
        number: 11,
        name: 'Opfølgning',
        period: 'Efter udgivelsen',
        window: [5, 60],
        anchor: 'release',
        description: 'Pligteksemplarer og fondsafrapportering · økonomi · salg og lager · evaluering',
      },
      [
        track('p11-closing', 'Afslutning og læring', [
          task('legal-deposit', 'Pligteksemplarer', 'Projektansvarlig', 5, 10, ['m-release']),
          task('funder-reporting', 'Fondsafrapportering', 'Projektansvarlig', 10, 40, ['m-release']),
          task('invoices-closed', 'Produktionsfakturaer afsluttes', 'Projektansvarlig', 10, 25, ['m-release']),
          task('actuals-vs-budget', 'Faktisk økonomi sammenholdes med budget', 'Forlægger/projektansvarlig', 5, 30, ['invoices-closed']),
          task('sales-and-stock', 'Salg og lager følges', 'Forlægger', 60, 60, ['m-release']),
          task('reprint-assessment', 'Eventuelt genoptryk vurderes', 'Forlægger', 2, 62, ['sales-and-stock'], { optional: true }),
          task('project-evaluation', 'Projektevaluering', 'Projektteam', 2, 35, ['actuals-vs-budget']),
          task('lessons-to-masterplan', 'Erfaringer føres tilbage i masterplanen', 'Projektansvarlig', 3, 40, ['project-evaluation']),
        ]),
      ],
      [
        milestone('m-project-closed', 'Projekt afsluttet og evalueret', 'Projektansvarlig', 45,
          ['lessons-to-masterplan', 'funder-reporting', 'legal-deposit']),
      ],
    ),
  ],
)
