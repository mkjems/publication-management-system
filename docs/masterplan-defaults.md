# Masterplanen som data: foreslåede standardværdier

Status: forslag til gennemgang med forlaget · 2026-11-26
Data: [packages/domain/src/templates/masterplan-v1.ts](../packages/domain/src/templates/masterplan-v1.ts)
Kan ses i appen under **Masterplan**.

## Hvorfor dette dokument

Masterplanen (PDF) beskriver faser, spor, aktiviteter, ansvar og milepæle. Det er overført 1:1:
11 faser, 22 spor, 165 aktiviteter og 14 milepæle.

For at systemet kan beregne en plan og vise konsekvenserne af en forsinkelse, skal hver aktivitet
desuden have tre ting, som PDF'en ikke angiver:

1. **Varighed**: hvor mange arbejdsdage aktiviteten tager.
2. **Standard-deadline**: hvor aktiviteten normalt ligger i forhold til udgivelsesdatoen.
3. **Afhængigheder**: hvilke aktiviteter der skal være færdige, før den kan begynde.

Vi har lavet et forslag, der passer ind i PDF'ens tidsvinduer. Forslaget skal gennemgås, fordi det
er det, der afgør, hvor tidligt systemet advarer, når noget skrider.

## Grundantagelser

- Alt regnes i **arbejdsdage**. 1 måned ≈ 21 arbejdsdage, 1 uge = 5. Weekender og helligdage
  springes over, når planen lægges ud i kalenderen.
- **Udgivelsesdagen er dag 0**. "−105" betyder 105 arbejdsdage (ca. 5 måneder) før udgivelse.
- **Fase 1–2 planlægges fremad fra startmødet. Fase 3–11 planlægges baglæns fra
  udgivelsesdatoen.** Det svarer til PDF'ens "Hele produktionsplanen beregnes baglæns". Er der
  for lidt tid mellem startmøde og udgivelse, viser systemet, hvor meget planen er presset.
- **Tre slags aktiviteter**, svarende til PDF'ens regel om kun at udfylde Start for aktiviteter
  med et reelt arbejdsforløb:
  - _Opgave_: har et forløb med start og deadline. Vises som en bjælke.
  - _Deadline_: et tidspunkt uden forløb, fx en aflevering eller en beslutning. Vises som en streg.
  - _Milepæl_: fasens MILEPÆL. Vises som en rombe.
- **Afhængigheder** er næsten alle "slut → start": B kan begynde, når A er færdig. Enkelte er
  "start → start" med forskydning, fx at _Repræsentative prøveopslag_ kan begynde 5 dage efter, at
  _Principlayout udvikles_ er gået i gang.

## Faseplacering

| Fase                     | PDF              | Forslag (arbejdsdage) | Milepæl(e)                                                                    |
| ------------------------ | ---------------- | --------------------- | ----------------------------------------------------------------------------- |
| 1 Startmøde              | 10–11 mdr. før   | −231 → −213           | GO / HOLD / NO-GO (−213)                                                      |
| 2 Grundlaget lægges      | ca. 10 mdr. før  | −213 → −188           | Finansiering tilstrækkelig / risiko godkendt (−193) · Produktionsstart (−188) |
| 3 Indholdet udvikles     | 9–6½ mdr. før    | −188 → −137           | Revideret og gennemredigeret manus (−137)                                     |
| 4 Materialet færdiggøres | 6½–5 mdr. før    | −137 → −111           | Manus låst til layout (−112) · Billedmateriale komplet (−111)                 |
| 5 Bogen tager form       | 5–3½ mdr. før    | −105 → −71            | Principlayout godkendt (−83) · 1. ombrud klar (−71)                           |
| 6 Bogen gennemarbejdes   | 3½–2½ mdr. før   | −71 → −54             | 2. ombrud klar (−54)                                                          |
| 7 Bogen lukkes           | 11–8 uger før    | −54 → −40             | Bogen lukket (−41)                                                            |
| 8 Bogen går i trykken    | 8–3 uger før     | −41 → −15             | Trykgodkendelse (−30)                                                         |
| 9 Bogen udkommer         | ca. 3 uger før   | −15 → −1              | Færdige bøger godkendt og på lager (−10)                                      |
| 10 Udgivelse             | uge 0            | 0 → +5                | Udgivelse (0)                                                                 |
| 11 Opfølgning            | efter udgivelsen | +5 → +62              | Projekt afsluttet og evalueret (+45)                                          |

## Den længste kæde frem mod udgivelse

Kæden af aktiviteter uden luft bestemmer, om udgivelsesdatoen holder. Med forslaget går den
gennem:

> Startmøde → GO → Detaljeret budget → Salgsøkonomi → Finansieringsplan → **Finansiering
> tilstrækkelig** → Bindende udgivelsesdato → Produktionsstart → Redaktionelt startmøde → Endelig
> disposition → **Billedsporet** (illustrationsliste, research, udvælgelse, rekvirering,
> rettigheder, kreditlinjer) → Billedmateriale komplet → Principlayout → 1. ombrud → korrektur → 2. ombrud → Bogen lukket → prepress og blåkopi → Trykgodkendelse → Tryk og indbinding (12 dage)
> → Levering → Fysisk kvalitetskontrol → På lager → Udgivelse

Det er værd at drøfte:

- **Billedsporet, ikke manuskriptet, er den længste kæde i fase 3–4** med de foreslåede
  varigheder. Manuskriptet har ca. 7 dages luft frem til aflevering til grafiker, billederne ca. 6.
  Er det også forlagets erfaring?
- Der er indbygget **to buffere**: ca. 6 arbejdsdage mellem "Manus låst / Billedmateriale
  komplet" og "Samlet materiale afleveres til grafiker", og **10 arbejdsdage (2 uger) mellem "På
  lager" og udgivelsen**. Uden for disse buffere har hovedkæden kun 1–3 dages luft.

## Bevidste valg, som afviger fra eller fortolker PDF'en

1. **Trykgodkendelse ligger før "Tryk og indbinding".** I PDF'en står milepælen sidst i fase 8,
   men trykningen kan først begynde, når blåkopien er godkendt.
2. **"Bindende udgivelsesdato fastlægges" kommer efter milepælen "Finansiering tilstrækkelig /
   risiko godkendt"**, jf. finansieringsforbeholdet. Når milepælen nås, bliver planen bindende, og
   den oprindelige plan gemmes som _Oprindelig deadline_.
3. **Drøftelserne på startmødet** (idé, målgruppe, indhold, roller …) er deadlines på selve
   mødedagen, ikke selvstændige forløb.
4. **Papir bestilles eller reserveres** skal være sket før tryk, og **Salgsmateriale udsendes**
   skal være sket før bogen frigives til salg.
5. **15 aktiviteter er markeret som valgfrie**, fordi PDF'en kalder dem "eventuel" eller "om
   nødvendigt". De kan fravælges for den enkelte bog:
   tidlige prøveopslag · nyfotografering (planlægning og gennemførelse) · scanning/affotografering ·
   supplerende finansiering · konsekvensvurdering ved ændret finansiering · revision af budget og
   tidsplan · sidste forfatterrevision · register (udarbejdelse og indførelse) · tekniske fejl
   efter blåkopi · farveprøve · digitale læseeksemplarer · reklamationer · genoptryk.
6. **Parallelle spor holder ikke udgivelsen tilbage.** Presse, lanceringsplanlægning og
   finansieringsopfølgning løber ved siden af hovedkæden. Systemet advarer, hvis de skrider, men
   de flytter ikke udgivelsesdatoen af sig selv.
7. **Lanceringsarrangementet ligger dagen efter udgivelsen** (+1) som standard.
8. **Leverandørtider har fast varighed.** Tryk og indbinding, produktion, transport og levering
   er markeret "fast varighed": når en forsinkelse skal indhentes ved at komprimere planen,
   forkortes de aldrig. Andre opgaver forkortes højst til det halve.

## Spørgsmål til forlaget

1. **Skrivetid:** "Første komplette manuskript" har 22 arbejdsdage (ca. 1 måned) efter
   manuskriptplanen. Er forfatteren typisk i gang før startmødet, eller skal der afsættes mere tid?
2. **Billedarbejdet:** Holder 20 arbejdsdage til billedresearch og 10 til rettighedsclearing?
3. **Tryk og levering:** Er 12 arbejdsdage til tryk og indbinding plus 3 til transport
   realistisk, eller afhænger det af trykkeri, oplag og indbinding?
4. **Ombrydning:** Holder 8 dage til fuld ombrydning og 8 dage til gennemgang af 1. ombrud?
5. **Finansiering:** Hvor lang tid går der typisk fra fondsansøgning til svar? Skal systemet
   regne med det, eller er "risiko godkendt" det normale?
6. **Buffere:** Er 2 uger mellem "på lager" og udgivelse den rigtige buffer? Ønskes en buffer
   andre steder, fx før trykgodkendelse?
7. **Afhængigheder:** Er der afhængigheder, vi har overset eller sat forkert? Gennemgå især
   kolonnen "Afhænger af" i appen.

## Næste skridt

Masterplanen kan nu redigeres direkte i appen (**Masterplan → Redigér masterplanen**). Ændringerne
samles i en kladde og udgives som en ny version; eksisterende bøger beholder den version, de blev
oprettet fra. Editoren flytter afhængige aktiviteter med, når en varighed eller deadline ændres,
og viser løbende, hvad der ikke hænger sammen (cirkulære afhængigheder, aktiviteter der starter
før deres forgængere, milepæle uden for faservinduet). Kolonnen **Faktisk** viser, hvor lang tid
færdige opgaver reelt har taget i datasættet, så erfaringerne kan føres tilbage i masterplanen.

Gennemgangen med forlaget er beskrevet i [klienttest.md](klienttest.md).
