# Klienttest af produktionsplanen

Vejledning til testmøderne med forlaget (fase 6). Målet er at afprøve prototypen på **rigtige,
kommende titler** og samle det, der skal rettes, før systemet får database, login og flere
brugere (fase B).

Et møde tager ca. 1½ time. Planlæg gerne to møder: et med den projektansvarlige og redaktøren, et
med forlæggeren.

## Før mødet

- **Vælg 2–3 kommende titler** med en ønsket udgivelsesdato, gerne én der allerede er forsinket
  eller venter på fondssvar. Hav titel, ønsket udgivelse, startmøde og projektansvarlig klar.
- **Brug en ren browserprofil.** Data gemmes i browseren. Skift til **Rigtige data** i menuen
  nederst til venstre; demoen bruges kun til punkt 4.
- **Nulstil demoen** (↺ i Tidsmaskinen), så eksempelbøgerne passer til dags dato.
- Hav **den trykte masterplan (PDF)** ved hånden til sammenligning.
- Den, der styrer mødet, **hjælper ikke undervejs**. Bed deltagerne tænke højt, og skriv ned, hvor
  de tøver, klikker forkert eller spørger.

## Program

### 1. Masterplanen (20 min)

1. Åbn **Masterplan**. Gå faserne igennem og sammenlign med PDF'en.
2. Vælg **Redigér masterplanen**. Lad deltagerne rette de varigheder, de er uenige i (se
   spørgsmålene i [masterplan-defaults.md](masterplan-defaults.md)). Læg mærke til, at afhængige
   aktiviteter flytter med, og at problemlisten øverst forklarer, hvad der ikke hænger sammen.
3. Tjek de aktiviteter, der er markeret **Fast varighed** (tryk og indbinding, produktion,
   transport, levering). De forkortes aldrig, når en forsinkelse skal indhentes. Mangler der
   nogen?
4. **Udgiv version 2** med en kort note om, hvad der er ændret.

_Notér:_ hvilke varigheder og afhængigheder der blev ændret, og hvorfor.

### 2. Opret de rigtige titler (15 min)

1. **Udgivelser → Ny udgivelse** for hver titel. Brug version 2 af masterplanen.
2. Sammenlign milepælene i forhåndsvisningen med forlagets egen forventning.
3. Åbn bogen. Ligner **Tabel** det skema, forlaget bruger i dag? Giver **Gantt** et bedre overblik?
4. Tildel personer til rollerne (**Planlægning → Roller og personer**).

_Notér:_ datoer, der virker forkerte; kolonner, der mangler.

### 3. En forsinkelse (20 min)

1. Vælg en titel og en aktivitet, som ofte skrider (fx første komplette manuskript eller
   billedrettigheder). Flyt dens deadline 3 uger, i tabellen eller ved at trække i Gantt.
2. Gennemgå forhåndsvisningen: hvad flytter, hvad sker der med udgivelsen? Prøv alle fire måder at
   håndtere forsinkelsen på. Hvilken ville forlaget vælge?
3. Prøv det samme i et **scenarie** (Planlægning → Afprøv i et scenarie), og kassér det bagefter.
4. Kig på **Historik**: er udviklingen i milepælene til at forstå?

_Notér:_ om forhåndsvisningen er troværdig, og om ordene i dialogen giver mening.

### 4. Mandagsoverblikket (15 min)

1. Skift til **Demo**. Spol 4–6 uger frem i **Tidsmaskinen**.
2. Åbn **Oversigt** og **Mine opgaver**. Kan deltagerne svare på: Hvad er forsinket? Hvad skal ske
   i denne uge? Hvilke udgivelser er i fare?
3. Hvad mangler for at kunne bruge overblikket på mandagsmødet?

### 5. Udskrift (10 min)

1. Åbn en af de rigtige titler og vælg **Udskriv**. Gem som PDF i A3 (prøv også A4).
2. Kan udskriften bruges på et møde eller sendes til en forfatter eller et trykkeri?

### 6. Afslutning (10 min)

Gennemgå de åbne spørgsmål herunder. Eksportér datasættet (**Udgivelser → Eksportér**) og gem
filen sammen med noterne.

## Åbne spørgsmål til forlaget

Fra udviklingsplanen ([PLAN.md](PLAN.md) §8) og fra arbejdet med prototypen:

1. **Omfang:** Hvor mange bøger er i gang samtidig? Hvor mange brugere? Arbejder de samme personer
   på flere bøger, så der er brug for at se belastning pr. person?
2. **Bogtyper:** Er der bogtyper, der skal have deres egen masterplan (billedtung kunstbog,
   oversættelse, ren tekst, genoptryk)? Editoren kan i dag lave nye versioner af én masterplan.
3. **Baseline:** Skal den oprindelige plan gemmes, når planen bliver bindende? Hvem må flytte en
   bindende udgivelsesdato, og skal hver flytning gemme en ny baseline? (I dag gør den.)
4. **Godkendelse:** Skal datoændringer godkendes (fx foreslår den projektansvarlige, forlæggeren
   godkender), eller gælder de med det samme?
5. **Kalender:** Hvilke lukkeperioder skal planen tage hensyn til (trykkeriets sommerferie, jul)?
   Skal trykkeritider bookes i systemet?
6. **Finansiering:** Er "sikret i forhold til minimum" nok, eller skal ansøgninger følges i
   detaljer med beløb og afrapporteringsfrister?
7. **"I risiko":** Overblikket tæller kun aktiviteter med deadline inden for to uger som "i
   risiko". Er det den rigtige grænse?
8. **Integrationer:** Outlook/Google-kalender, påmindelser på mail, Bogportalen, Excel/PDF?
9. **Eksterne:** Skal forfattere, grafikere og trykkerier have adgang til deres egne opgaver?
10. **Sprog:** Kun dansk, eller også engelsk?

## Notatskema

Én linje pr. iagttagelse. Udfyldes under mødet og samles bagefter i backloggen herunder.

| #   | Hvor (side/funktion) | Hvad skete der / hvad blev sagt | Hvem | Alvor (stopper / generer / ønske) |
| --- | -------------------- | ------------------------------- | ---- | --------------------------------- |
|     |                      |                                 |      |                                   |

## Backlog efter testene

Hvert punkt får en fase: **A** (rettes i prototypen inden næste møde) eller **B** (kræver database,
login eller flere brugere).

| #   | Ønske eller fejl | Fra møde | Fase | Begrundelse |
| --- | ---------------- | -------- | ---- | ----------- |
|     |                  |          |      |             |
