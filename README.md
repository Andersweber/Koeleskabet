# Køleskabet

Kiosk-system til fælleskøleskabet: hvem køber hvad, hvad koster det, hvor meget
er der tilbage — og en månedsopgørelse til den der sender regninger ud.
Bygget til drikkevarer, med pant og festivalpriser.

Bygget som en **Google Apps Script web app oven på ét Google Sheet**. Der er
ingen server at drifte, intet at installere og intet program at starte: Google
hoster app'en sammen med regnearket, og Chromebooken åbner bare én URL.

---

## Farver
Farveskemaet er taget fra kollegietrøjerne: gradienten **lilla → magenta → pink
→ orange**. Den bruges i topbjælken, på købsknappen, den valgte filterknap og
kvitteringsskærmen; priser står i pink, og personernes farvebobler er en varm
skala i samme spektrum. Vil I justere den, ligger alle farver som variabler
øverst i `Styles.html` — `--grad` er selve gradienten.

## Filer

| Fil | Skal hedde i Apps Script | Hvad det er |
|---|---|---|
| `Code.gs` | `Code.gs` | Backend: læser/skriver regnearket |
| `Index.html` | `Index` | HTML-skallen |
| `Styles.html` | `Styles` | Al CSS |
| `JavaScript.html` | `JavaScript` | Hele brugerfladen |
| `appsscript.json` | manifest | Tidszone og udrulningsindstillinger |
| `test/` | — | Lokal testudgave med opdigtede data (bruges ikke i drift) |

Navnene skal matche præcist — `Index.html` henter `Styles` og `JavaScript` ind.

---

## Opsætning (ca. 10 minutter, én gang)

1. **Opret et Google Sheet.** Kald det fx `Køleskabet`. Fanerne oprettes selv.
2. **Udvidelser → Apps Script.** Et scriptprojekt åbner.
3. **Indsæt koden.**
   - Slet indholdet af `Code.gs`, indsæt hele `Code.gs` herfra.
   - `Filer → +` → `HTML` → navngiv `Index` → indsæt `Index.html`.
   - Samme for `Styles` og `JavaScript`.
4. **Manifest (valgfrit, men anbefalet).** `Projektindstillinger` → sæt flueben ved
   *Vis appsscript.json*, gå tilbage til editoren og indsæt indholdet af
   `appsscript.json`.
5. **Kør `ensureSheets_` én gang** (vælg funktionen i editoren, tryk *Kør*).
   Google beder om tilladelse — godkend. Fanerne oprettes med det samme.
6. **Udrul:** `Udrul → Ny udrulning → Webapp`
   - *Kør som:* **Mig**
   - *Hvem har adgang:* **Alle** (så kiosken virker uden login)
   - Kopiér URL'en.

> **Om adgang:** "Alle" betyder at alle med linket kan bruge kiosken. Linket er
> ikke til at gætte, og alt administrativt ligger bag PIN-koden. Vil I hellere
> kræve login, vælg *Alle med en Google-konto* — så skal Chromebooken bare være
> logget ind.

Efter ændringer i koden: `Udrul → Administrer udrulninger → blyanten → Version:
Ny version → Udrul`. URL'en er den samme.

---

## Chromebooken

**Der er ikke noget program at køre, og ingen kommandolinje involveret.**
Kiosken er en almindelig webside på en URL. Chromebooken skal bare åbne den —
resten er engangsopsætning, som gøres med musen.

1. **Åbn URL'en** i Chrome (den I fik ved udrulningen).
2. **Gør den til en app.** `⋮ → Cast, gem og del → Installer side som app`.
   Så får den sit eget ikon i skuffen, åbner i sit eget vindue uden adresselinje
   og uden faneblade — det er dét man vil have på en kiosk.
3. **Sæt den på hylden.** Højreklik ikonet → *Fastgør til hylde*. Ét klik, så er
   den oppe.
4. **Start den automatisk ved opstart.** `Indstillinger → Ved opstart → Åbn en
   bestemt side eller nogle sider` → indsæt URL'en. Så er kiosken klar af sig
   selv, også efter en strømafbrydelse.
5. **Lad skærmen blive tændt.** `Indstillinger → Enhed → Strøm → Hold skærmen
   tændt, når enheden er tilsluttet`. App'en beder derudover selv om *wake lock*,
   så skærmen ikke dæmpes.

**Fuld skærm** behøver I ikke gøre noget for: har I installeret den som app,
fylder den allerede vinduet. Ellers er der en **⛶-knap** øverst til højre i
kiosken — den vises kun når den er nødvendig og forsvinder af sig selv bagefter.
`F11` virker naturligvis også.

Mister Chromebooken nettet, bliver køb lagt i kø lokalt og sendt automatisk, når
forbindelsen er tilbage. Det står i en blå bjælke i toppen imens.

> **Rigtig kiosktilstand** — hvor Chromebooken booter direkte ind i app'en og
> ikke kan lukkes ned — kræver at maskinen er meldt ind i en Google Workspace
> med enhedsstyring. Det er ikke muligt på en privat Chromebook, og de fem trin
> ovenfor kommer i praksis tæt nok på.

## Sådan bruges den

### Ved køleskabet
Tryk på dit navn → tryk på varerne (tryk flere gange for flere) → **Køb**.

Skal noget med ud af huset, trykker man **🚪 Med ud af huset** i den nederste
bjælke, og der lægges pant på alle de varer i kurven, der har pant slået til.
Skal kun nogle af dem med ud, åbner man kurven og trykker på linjens
**Pant**-knap — hvert tryk tæller én op og starter forfra, så `Pant 1/3` betyder
én af tre flasker med ud.
Kvitteringen står med **Fortryd** i 8 sekunder, hvis man ramte forkert.
Efter 60 sekunder uden aktivitet springer skærmen selv tilbage til navnelisten.

Personer er delt i **Beboere** og **Ex'ere** — beboere vises som standard,
ex'ere er ét tryk væk. Grupperne kan omdøbes eller udvides under Indstillinger.

### Administration (⚙️ øverst til højre, PIN)
Standard-PIN er **1234** — skift den under *Indstillinger* med det samme.

- **Lager** — beholdning pr. vare, indkøbsliste over det der er ved at slippe op,
  `−`/`+` til hurtige rettelser, *Påfyld* efter en indkøbstur, *Optæl* når I
  tæller efter. *Registrér indkøb* tager hele indkøbsposen på én gang.
- **Produkter** — priser rettes ved at trykke direkte på prisen (stort taltastatur).
  Nye varer, ikoner, billeder, kategorier og lagergrænser sættes her. Hver vare
  har et flueben for, om **pant-knappen** skal vises i kiosken — slå den fra på
  fx fadøl, kaffe og andet uden emballage.

  Varer kan både **skjules** (fjern fluebenet *Vis i kiosken* — den bliver i
  listerne) og **slettes helt**. Sletning viser først hvad der sker: hvor meget
  der er solgt, hvor meget der står på lager, og hvilke tilstande eller spil der
  peger på varen. **Købshistorikken bliver stående** — hver købslinje husker selv
  varenavn og pris, så gamle opgørelser er uændrede. Lagerbevægelser bevares også
  som revisionsspor, mens varens billede og dens plads i tilstande og spil ryddes.
- **Tilstande** — festivalpriser og hestevæddeløb, se nedenfor.
- **Personer** — tilføj og redigér. Billedet kan **tages direkte med Chromebookens
  webcam**. Skal en person ud, så fjern fluebenet *Vis i kiosken* eller flyt dem
  til *Ex'ere* — så bevares hele deres købshistorik.
- **Månedsopgørelse** — se nedenfor.
- **Indstillinger** — PIN, titel, valuta, grupper, timeouts, lagerregler.

### Pant
Pant er et fast beløb pr. stk. — som standard **1 kr** — der lægges oveni, når
varen tages med ud af huset. Beløbet sættes under *Indstillinger*; sætter du det
til 0, forsvinder pant-knappen helt.

Pant bogføres for sig: i månedsopgørelsen står den som sin egen linje
(`🚪 Pant 12 × 1 kr`) adskilt fra varerne, nøgletallet **Heraf pant** viser
månedens samlede pant, og CSV'en og fanen i regnearket har den som egne linjer.
Så kan I se præcis hvor meget der er pant, hvis I betaler den tilbage.

### Prestilstande (festivalpriser)
En tilstand ændrer prisen på en gruppe varer, så længe den er slået til. Der
følger to eksempler med, som I kan rette i: **Festival** (+50% på alt) og
**Happy hour** (−25% på drikkevarer).

En tilstand kan lægge en **procent** oveni, et **fast tillæg** i kroner, eller
sætte en **fast pris**. Negative tal giver rabat. Den kan gælde alle varer,
udvalgte kategorier eller enkelte varer — du vælger med store knapper, og
dialogen viser løbende hvad fx en vare til 10 kr så kommer til at koste.

Når en tilstand er slået til:

- en farvet bjælke står øverst på begge kioskskærme med navn og hvad den gør,
- hver vare viser den nye pris med den normale pris streget over,
- **prisen gemmes på hvert køb**, så månedsopgørelsen viser `Øl (Festival) 2 ×
  12 kr` på en linje for sig, adskilt fra `Øl 3 × 8 kr`. Både CSV'en og fanen i
  regnearket har en Tilstand-kolonne.

Kun én tilstand kan være aktiv ad gangen. Når du slår den til, vælger du hvor
længe — 4 timer, et døgn, hele weekenden, eller "til jeg slår den fra".
**Vælg en varighed når I kan**: så slukker den sig selv, og ingen risikerer at
betale festivalpriser resten af måneden, fordi nogen glemte at slå den fra.

Priserne du redigerer under *Produkter* er altid normalpriserne. Tilstanden
lægges ovenpå og rører dem ikke.

### Hestevæddeløb
Et spil, ikke en pris. Slås til under *Tilstande → Spil* og kører uafhængigt af
prestilstandene, så I godt kan have festivalpriser og væddeløb på samme tid.

Når nogen køber en vare der er med i spillet — som standard **Øl** — er der en
valgfri procent chance for at et væddeløb overtager hele skærmen. Det starter
med en **alarm**: skærmen blinker grønt og rødt, en klaxon lyder, og der står
*ÅH NEJ! HESTEVÆDDELØB* — så hele rummet opdager det. Blinket skifter 2,5 gange
i sekundet, bevidst under grænsen på tre blink i sekundet hvor fuldskærmsblink
begynder at kunne udløse anfald hos lysfølsomme.

Derefter vælger man sin hest og løbet kører — omkring **ni sekunder** i to
halvdele:

- **Første tredjedel** svinger hver hest op og ned i sin egen takt, og dem der
  er bagud får lidt hjælp. Feltet bytter plads igen og igen, så man ikke kan se
  hvem der vinder.
- **Fra en tredjedel inde** slipper hjælpen, bølgerne flader ud, og hver hest
  går over i sin egen slutspurt. Nogle har krudt tilbage, andre ikke — og dét
  afgør løbet med en synlig længde i stedet for et fotofinish.

Simuleret over 2000 løb: syv føringsskift undervejs, den der fører ved kvartvejs
vinder kun i knap en tredjedel af løbene, og forspringet er allerede oppe på en
hestelængde når føreren når 90 %. Alle baner vinder lige ofte.

Og så:

- **vinder din hest**, slipper du — ingen ordning,
- **rammer du forkert**, spiller jeres egen ORDNING.mp3, konfetti falder over
  hele skærmen, og der står at du laver en ordning. Lydfilen ligger indbygget i
  app'en — se `lyd/LÆSMIG.md` hvis I vil skifte den ud.

Terningen kastes én gang pr. køb, ikke pr. øl. Bagefter kommer den normale
kvittering med Fortryd, så et fejlkøb stadig kan rulles tilbage.

Hestene løber på **én sammenhængende bane** der fylder hele skærmen, adskilt af
hvide hegn. Hver hest fylder omkring en femtedel af skærmhøjden, og banerne
deler højden mellem sig, så feltet er lige stort uanset om der er to eller seks
heste. Hegnet ruller forbi langsommere end selve banen — det giver dybde og gør
farten tydelig.

Banen ruller med feltet, så målstregen først dukker op på opløbet; man ser kun
et udsnit ad gangen. Oversigtsstriben nederst viser hvor alle heste er på den
samlede distance, og jeres eget publikumsklip looper under løbet og skrues op
mod målstregen.

Når vinderen krydser stregen, **løber den videre alene** mens de øvrige bremser
op og falder tilbage ud af billedet. Vinderens bane lyser gyldent op, den får et
🏆-mærkat, og navnet står øverst på skærmen — så der er ingen tvivl om hvem der
vandt, før resultatet vises.

Under *Indstil* sætter du chancen i procent, antal heste (2–6) og hvilke varer
der udløser løbet — og der er en **Prøv et løb**-knap, så I kan teste uden at
købe noget. Spillet rører hverken priser, lager eller regnskab.

**Hestebilleder.** Der er seks rigtige fotostillinger af en galoperende
væddeløbshest bygget ind i app'en. De er fritlagt med gennemsigtig baggrund og
ordnet efter hvor benene er i galopcyklussen, så der klippes mellem dem som en
filmstrip — benene bevæger sig altså rigtigt. Kildematerialet ligger i mappen
`heste/`.

Vil I hellere have jeres egne, kan I lægge 2–8 billeder ind under
*Indstil → Hestebilleder*; de får forrang over de indbyggede. Billederne
skaleres og komprimeres automatisk og gemmes i fanen Billeder ligesom vare- og
personbilleder.

- **Flere billeder** af den samme hest i forskellige stillinger giver rigtig
  benbevægelse. **Ét enkelt billede** virker også, men så hakker hesten kun
  afsted i faste spring med stillestående ben.
- Fritlagte **PNG'er med gennemsigtig baggrund** ser klart bedst ud i banen —
  gennemsigtigheden bevares. Beskær tæt om hesten; et helt landskabsfoto fylder
  det meste af banen med græs og hegn.
- Er der lagt egne billeder ind, kan de fjernes igen med ✕ på hvert billede;
  så vender de indbyggede tilbage.

### Min side — uden PIN
Trykker man på sit eget navn øverst på vareskærmen, åbner ens egen side. Der kan
man **skifte sit profilbillede** (webcam eller fil) og **se sine egne køb for
måneden** — beløb, varer, pant og hele listen med tidspunkter.

Den er bevidst kun til at læse i: der er ingen vej derfra til at rette i
historikken, og siden kan kun røre ved ens eget billede. Serveren tjekker at
id'et hører til en person, så selvbetjeningen ikke kan bruges til at ændre
billeder på varer eller andet.

Som alt andet i kiosken er der ingen adgangskode — den der står ved skærmen kan
vælge hvem som helst. Det er samme tillid som at man selv trykker på sit navn
når man tager en øl.

### Årsshow — kun for administratorer
Fanen **Årsshow** ligger bag PIN-koden, og det gør tallene også: serveren
afviser at udlevere årsstatistikken uden gyldig kode, så den kan ikke hentes
ved at kalde udenom skærmen. Fanen samler alt hvad der kan tælles om et år,
regnet ud fra købshistorikken og løbsresultaterne. Der ligger ikke dobbelt bogholderi nogen
steder — tallene udledes af det der allerede er registreret.

Pr. person: brugt i alt og andel af huset, antal varer og handler, største
handel, favoritvare, dage med køb og længste stime i træk, travleste dag,
foretrukne ugedag og tidspunkt, køb mellem midnat og fem, betalt pant, fortrudte
køb, væddeløb med sejre og ordninger, foretrukne hest, samt første og sidste køb.

For huset: omsætning, varer, handler, pant, mest drukne varer, travleste dato,
ugedag og klokkeslæt, måned for måned, og antal løb og ordninger.

**▶ Start showet** kører det som en fuldskærmspræsentation — tretten slides der
skifter af sig selv hvert syvende sekund, eller når man trykker. Årets tørstigste
med podie, natteravnen, stamgæsten, pantsamleren, den uheldigste og den
heldigste ved væddeløbene. Lavet til at sætte op på skærmen til julefrokosten.

Tallene kan også gemmes som en fane i regnearket.

**Administrationen lukker sig selv** efter tre minutter uden aktivitet og
kræver PIN igen — ellers ville priser, tal og indstillinger stå åbne på en
skærm der er gået fra midt i en fest. Et kørende show tæller som aktivitet, så
det ikke afbrydes.

### Månedsopgørelsen
Vælg måned. Du får omsætning i alt, delsummer pr. gruppe, og hver person med
beløb — tryk på en person for at se præcis hvilke varer, hvor mange og til
hvilken stykpris. *Vis alle køb med tidspunkt* giver den fulde liste, hvis nogen
spørger.

Tre knapper:
- **Gem som fane i regnearket** — laver fanen `Opgørelse ÅÅÅÅ-MM` med samlet
  oversigt, detaljer pr. person og lagerstatus. Det er den, regnskabet arbejder i.
- **Kopiér som CSV** — semikolon-adskilt, klar til Excel.
- **Markér som afregnet** — så kan man se, hvilke måneder der er sendt ud.

---

## Sådan ligger data i regnearket

| Fane | Indhold |
|---|---|
| `Personer` | ID, navn, gruppe, farve, aktiv |
| `Produkter` | ID, navn, pris, ikon, kategori, lager, min. lager, kostpris, pant, aktiv |
| `Køb` | Én linje pr. vare pr. køb, med tidspunkt, navn, **prisen på købstidspunktet**, aktiv tilstand og pant |
| `Spil` | Hvert hestevæddeløb: hvem, hvilken hest de valgte, hvem der vandt, og om det blev en ordning |
| `Tilstande` | Prestilstande: navn, hvad de gælder for, type, værdi, om de er aktive og hvornår de slutter |
| `Lagerbevægelser` | Påfyldning, optælling, spild og justeringer |
| `Billeder` | Person- og produktbilleder som komprimerede data-URI'er |
| `Afregninger` | Hvilke måneder der er markeret som afregnet |
| `Indstillinger` | PIN, valuta, titel, grupper m.m. |

To ting det er værd at kende:

- **Prisen gemmes på hvert køb.** Hæver I prisen på øl midt i måneden — eller
  slår festivalpriser til — ændrer det ikke det, folk allerede har købt.
- **Køb slettes aldrig.** Et fortrudt køb får `Annulleret = TRUE` og lægges
  tilbage på lageret, men linjen bliver stående. Så kan man altid regne baglæns.

I kan trygt rette direkte i regnearket — app'en læser det, der står der.

---

## Lagerstyringen

Lageret trækkes automatisk ved hvert køb og lægges tilbage ved fortryd.
Beholdningen kan gå i minus, hvis nogen køber noget, systemet troede var
udsolgt — det er med vilje: ingen skal afvises ved køleskabet, fordi tællingen
er skredet. Det vises som en advarsel, og *Optæl* retter det op.
Vil I hellere blokere salg af udsolgte varer, så slå det fra under Indstillinger.

Varer under deres grænse vises i en gul/rød bjælke på forsiden og i
indkøbslisten under *Lager*.

---

## Billeder

Billeder tages med webcam eller vælges som fil, beskæres automatisk til en
firkant og komprimeres til under 45.000 tegn, så de kan ligge i en celle i
regnearket. Der er ingen ekstern billed-hosting og ingen Drive-rettigheder
involveret. De caches lokalt på Chromebooken, så kiosken starter hurtigt.

Har en person eller vare intet billede, bruges initialer på farvet baggrund
henholdsvis et emoji-ikon.

**Bemærk:** webcam-optagelsen er ikke afprøvet på jeres Chromebook — Chrome vil
spørge om lov til kameraet første gang. Bliver den afvist eller er der intet
kamera, siger app'en det og falder tilbage til *Vælg fil*.

---

## Test uden Google — kun til udvikling

> Dette afsnit har **intet med Chromebooken eller driften at gøre.** Kiosken
> kører uden nogen server. Det følgende er kun til brug på en udviklermaskine.

`test/index.html` er hele brugerfladen bygget sammen med en opdigtet backend
(20 personer, 20 varer, et par hundrede køb), så man kan klikke rundt uden at
røre det rigtige regneark. Den skal serveres over http for at browseren tillader
kamera og lyd:

```bash
python3 -m http.server 8712 --directory test
```

Åbn derefter `http://localhost:8712`.

Filen er en sammenbygget kopi af `Styles.html` og `JavaScript.html`. Retter du i
de rigtige filer, skal den bygges om, før ændringerne kan ses i testudgaven.
