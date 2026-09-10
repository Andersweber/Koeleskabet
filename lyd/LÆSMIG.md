# Lyd

Begge klip ligger indbygget i `JavaScript.html` som data-URI'er, så der ikke
skal hostes lydfiler ved siden af app'en.

## `ordning.mp3` — når man vælger forkert hest
Jeres egen ORDNING.mp3, bearbejdet:

- **Komprimeret** (acompressor 4:1) så den opfattes højere. Originalen havde
  skarp transient og lavt gennemsnit; gennemsnittet er løftet fra −19,3 dB til
  −13,8 dB med toppen på −0,6 dB, altså uden at klippe.
- **Mono, 128 kbit/s**: 76 kB → 39 kB.

Ligger i koden som `ORDNING_LYD` (52 kB).

## `publikum.mp3` — hujeriet under løbet
Et udsnit af jeres jubelklip. Originalen er 45 sekunder og svinger meget i
niveau, med en stille periode fra 24 til 35 sekunder. Jeg målte niveauet
sekund for sekund og valgte **38,6–44,1 s**, som er det mest konstante stræk.

- **Sømløst loop**: de sidste 0,6 sekunder er krydsfadet med lyden lige efter
  udsnittets slutning, så samlingen ikke kan høres. Springet ved loop-punktet
  faldt fra 0,32 til 0,11.
- **Mono, 96 kbit/s**, normaliseret til −0,9 dB top.

Ligger i koden som `PUBLIKUM_LYD` (87 kB). Den looper under løbet og skrues op
undervejs: starter på 34 % lydstyrke, stiger til fuld op mod målstregen, og
fader ud over knap et sekund når løbet er afgjort.

## Hvis I vil skifte dem ud
Læg nye filer ind, kør samme behandling, og erstat `ORDNING_LYD` eller
`PUBLIKUM_LYD`. Kan browseren ikke afspille en fil, falder app'en tilbage til
syntetiseret lyd — et horn for ordningen, filtreret støj for publikum — så der
kommer altid lyd.
