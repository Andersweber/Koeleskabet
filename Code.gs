/**
 * Køleskabet – kiosk-system til salg fra fælleskøleskab, med lagerstyring.
 * Backend: Google Apps Script bundet til et Google Sheet.
 *
 * Faner der oprettes automatisk:
 *   Personer, Produkter, Køb, Lagerbevægelser, Afregninger, Indstillinger
 */

const SHEET_PERSONER      = 'Personer';
const SHEET_PRODUKTER     = 'Produkter';
const SHEET_KOEB          = 'Køb';
const SHEET_LAGER         = 'Lagerbevægelser';
const SHEET_SPIL          = 'Spil';
const SHEET_TILSTANDE     = 'Tilstande';
const SHEET_BILLEDER      = 'Billeder';
const SHEET_AFREGNING     = 'Afregninger';
const SHEET_INDSTILLINGER = 'Indstillinger';

const HEADERS = {};
HEADERS[SHEET_PERSONER]      = ['ID', 'Navn', 'Gruppe', 'Farve', 'Aktiv', 'Oprettet'];
HEADERS[SHEET_PRODUKTER]     = ['ID', 'Navn', 'Pris', 'Emoji', 'Kategori', 'Lager',
                                'MinLager', 'Kostpris', 'Pant', 'Aktiv', 'Oprettet'];
HEADERS[SHEET_KOEB]          = ['KøbID', 'Tidspunkt', 'Måned', 'PersonID', 'PersonNavn',
                                'ProduktID', 'ProduktNavn', 'Antal', 'StykPris', 'Total',
                                'Annulleret', 'Ref', 'Tilstand', 'PantAntal', 'PantBeløb'];
HEADERS[SHEET_LAGER]         = ['ID', 'Tidspunkt', 'ProduktID', 'ProduktNavn', 'Type',
                                'Ændring', 'Lager før', 'Lager efter', 'Note', 'Af'];
HEADERS[SHEET_SPIL]          = ['ID', 'Tidspunkt', 'Måned', 'PersonID', 'PersonNavn',
                                'Spil', 'Valgt hest', 'Vinderhest', 'Resultat'];
HEADERS[SHEET_TILSTANDE]     = ['ID', 'Navn', 'Emoji', 'Farve', 'Gælder for', 'Type',
                                'Værdi', 'Aktiv', 'Slutter', 'Oprettet'];
HEADERS[SHEET_BILLEDER]      = ['ID', 'Billede', 'Opdateret'];
HEADERS[SHEET_AFREGNING]     = ['Måned', 'Afregnet', 'Dato', 'Af'];
HEADERS[SHEET_INDSTILLINGER] = ['Nøgle', 'Værdi'];

const STANDARD_INDSTILLINGER = [
  ['AdminPin', '1234'],
  ['Valuta', 'kr'],
  ['Titel', 'Køleskabet'],
  ['FortrydSekunder', '8'],
  ['InaktivSekunder', '60'],
  ['TilladSalgUdenLager', 'ja'],
  ['StandardMinLager', '3'],
  ['PantBeløb', '1'],
  ['KnapStørrelse', '100'],
  ['SpilHest', 'nej'],
  ['SpilHestChance', '20'],
  ['SpilHestGælder', 'Øl'],
  ['SpilHestAntal', '4'],
  ['StandardGruppe', 'Beboere'],
  ['Grupper', 'Beboere, Ex\'ere']
];

/* Hæves når fanerne eller kolonnerne ændrer sig. Så længe versionen står
 * uændret, springer ensureSheets_ hele opsætningen over – ellers ville hver
 * eneste sideindlæsning bruge et par sekunder på at tjekke og formatere ark. */
const SKEMA_VERSION = '2026-09-10';

const FARVER = ['#7c3aed', '#9333ea', '#a21caf', '#c026d3', '#db2777',
                '#e11d48', '#f43f5e', '#ea580c', '#c2410c', '#b45309'];

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

function doGet() {
  ensureSheets_();
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate()
    .setTitle(hentIndstilling_('Titel') || 'Køleskabet')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filnavn) {
  return HtmlService.createHtmlOutputFromFile(filnavn).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Køleskabet')
    .addItem('Opret/reparer faner', 'reparerFaner')
    .addItem('Vis kiosk-URL', 'visUrl_')
    .addToUi();
}

function visUrl_() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('Kiosk-URL',
    url ? url : 'Web-app\'en er ikke udrullet endnu. Kør Udrul → Ny udrulning → Webapp.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ------------------------------------------------------------------ */
/* Ark-hjælpere                                                        */
/* ------------------------------------------------------------------ */

function getSs_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function getSheet_(navn) {
  var ss = getSs_();
  var sh = ss.getSheetByName(navn);
  if (!sh) {
    sh = ss.insertSheet(navn);
    sh.appendRow(HEADERS[navn]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS[navn].length).setFontWeight('bold');
  } else {
    // Tilføj kolonner der er kommet til i en nyere version
    var bredde = sh.getLastColumn();
    var nuvaerende = bredde ? sh.getRange(1, 1, 1, bredde).getValues()[0] : [];
    var oensket = HEADERS[navn];
    var mangler = oensket.filter(function (h) { return nuvaerende.indexOf(h) === -1; });
    if (mangler.length) {
      sh.getRange(1, nuvaerende.length + 1, 1, mangler.length)
        .setValues([mangler]).setFontWeight('bold');
    }
  }
  return sh;
}

/**
 * Opretter og reparerer faner. Tungt arbejde, så det køres kun når skemaet
 * er nyt eller ændret — ikke ved hver sideindlæsning.
 * @param {boolean=} tving Kør uanset gemt version (menupunktet bruger denne).
 */
function ensureSheets_(tving) {
  var props = PropertiesService.getScriptProperties();
  if (!tving && props.getProperty('SkemaVersion') === SKEMA_VERSION) return 'OK';

  var ss = getSs_();
  [SHEET_PERSONER, SHEET_PRODUKTER, SHEET_KOEB, SHEET_LAGER, SHEET_SPIL, SHEET_TILSTANDE,
   SHEET_BILLEDER, SHEET_AFREGNING, SHEET_INDSTILLINGER].forEach(function (n) { getSheet_(n); });

  var ind = getSheet_(SHEET_INDSTILLINGER);
  var kendte = ind.getLastRow() > 1
    ? ind.getRange(2, 1, ind.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); })
    : [];
  STANDARD_INDSTILLINGER.forEach(function (par) {
    if (kendte.indexOf(par[0]) === -1) ind.appendRow(par);
  });

  var prod = getSheet_(SHEET_PRODUKTER);
  if (prod.getLastRow() < 2) {
    var nu = new Date();
    [['Øl', 8, '🍺', 'Øl', 0, 6, 5, true],
     ['Classic', 9, '🍻', 'Øl', 0, 6, 6, true],
     ['Sodavand', 6, '🥤', 'Sodavand', 0, 6, 4, true],
     ['Cola Zero', 6, '🥤', 'Sodavand', 0, 6, 4, true],
     ['Cider', 10, '🍏', 'Cider', 0, 4, 7, true],
     ['Energidrik', 12, '⚡', 'Energi', 0, 4, 8, true],
     ['Vand', 4, '💧', 'Vand', 0, 6, 2, true]
    ].forEach(function (p, i) {
      prod.appendRow(['V' + (i + 1), p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], true, nu]);
    });
  }

  var tils = getSheet_(SHEET_TILSTANDE);
  if (tils.getLastRow() < 2) {
    tils.appendRow(['T1', 'Festival', '🎉', '#8b3fd6', 'ALLE', 'procent', 50, false, '', new Date()]);
    tils.appendRow(['T2', 'Happy hour', '🍻', '#ff8a3d', 'Øl', 'procent', -25, false, '', new Date()]);
  }

  prod.getRange(2, 3, Math.max(prod.getMaxRows() - 1, 1), 1).setNumberFormat('0.00');
  prod.getRange(2, 8, Math.max(prod.getMaxRows() - 1, 1), 1).setNumberFormat('0.00');
  var koeb = getSheet_(SHEET_KOEB);
  koeb.getRange(2, 9, Math.max(koeb.getMaxRows() - 1, 1), 2).setNumberFormat('0.00');

  props.setProperty('SkemaVersion', SKEMA_VERSION);
  return 'OK';
}

/** Menupunktet skal altid køre det hele igennem. */
function reparerFaner() {
  ensureSheets_(true);
  SpreadsheetApp.getUi().alert('Faner er tjekket og repareret.');
}

function readObjects_(navn) {
  var sh = getSheet_(navn);
  var sidste = sh.getLastRow();
  if (sidste < 2) return [];
  var bredde = Math.max(sh.getLastColumn(), HEADERS[navn].length);
  var values = sh.getRange(1, 1, sidste, bredde).getValues();
  var headers = values[0];
  var ud = [];
  for (var i = 1; i < values.length; i++) {
    var o = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) if (headers[j]) o[headers[j]] = values[i][j];
    ud.push(o);
  }
  return ud;
}

function kolonne_(navn, header) {
  var sh = getSheet_(navn);
  var raekke = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = raekke.indexOf(header);
  if (idx === -1) throw new Error('Kolonnen "' + header + '" mangler i fanen ' + navn);
  return idx + 1;
}

function nytId_(praefiks, eksisterende) {
  var maks = 0;
  eksisterende.forEach(function (r) {
    var m = String(r.ID || '').match(/(\d+)$/);
    if (m) maks = Math.max(maks, parseInt(m[1], 10));
  });
  return praefiks + (maks + 1);
}

function hentIndstilling_(noegle) {
  var rk = readObjects_(SHEET_INDSTILLINGER);
  for (var i = 0; i < rk.length; i++) {
    if (String(rk[i]['Nøgle']) === noegle) return String(rk[i]['Værdi']);
  }
  return '';
}

function tz_() { return getSs_().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); }

function maanedAf_(dato) { return Utilities.formatDate(dato, tz_(), 'yyyy-MM'); }

function sandt_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'sand' || s === 'ja' || s === '1' || s === 'x';
}

function bruger_() {
  try { return Session.getActiveUser().getEmail() || 'kiosk'; } catch (e) { return 'kiosk'; }
}

/* ------------------------------------------------------------------ */
/* Læsning til klienten                                                */
/* ------------------------------------------------------------------ */

function hentStartdata() {
  ensureSheets_();
  return {
    personer: hentPersoner_(),
    produkter: hentProdukter_(),
    tilstand: aktivTilstand_(),
    spil: spilIndstillinger_(),
    indstillinger: {
      valuta: hentIndstilling_('Valuta') || 'kr',
      titel: hentIndstilling_('Titel') || 'Køleskabet',
      fortrydSekunder: parseInt(hentIndstilling_('FortrydSekunder') || '8', 10),
      inaktivSekunder: parseInt(hentIndstilling_('InaktivSekunder') || '60', 10),
      tilladSalgUdenLager: sandt_(hentIndstilling_('TilladSalgUdenLager') || 'ja'),
      standardMinLager: parseInt(hentIndstilling_('StandardMinLager') || '3', 10),
      pantBeloeb: Number(hentIndstilling_('PantBeløb') || 1) || 0,
      knapStoerrelse: Math.max(70, Math.min(200,
        Number(hentIndstilling_('KnapStørrelse') || 100) || 100)),
      standardGruppe: hentIndstilling_('StandardGruppe') || 'Beboere',
      gaesteGruppe: hentIndstilling_('GæsteGruppe') || 'Gæster',
      tilladGaester: sandt_(hentIndstilling_('TilladGæster') || 'ja'),
      grupper: (hentIndstilling_('Grupper') || 'Beboere, Ex\'ere, Gæster')
        .split(',').map(function (g) { return g.trim(); }).filter(String)
    },
    serverTid: new Date().toISOString()
  };
}

function hentPersoner_() {
  return readObjects_(SHEET_PERSONER).map(function (p, i) {
    return {
      id: String(p.ID),
      navn: String(p.Navn),
      gruppe: String(p.Gruppe || '').trim() || 'Beboere',
      farve: String(p.Farve || FARVER[i % FARVER.length]),
      aktiv: sandt_(p.Aktiv)
    };
  });
}

function hentProdukter_() {
  return readObjects_(SHEET_PRODUKTER).map(function (p) {
    var lager = Math.round(Number(p.Lager) || 0);
    var min = Math.round(Number(p.MinLager) || 0);
    return {
      id: String(p.ID),
      navn: String(p.Navn),
      pris: Number(p.Pris) || 0,
      kostpris: Number(p.Kostpris) || 0,
      emoji: String(p.Emoji || '📦'),
      kategori: String(p.Kategori || ''),
      pant: sandt_(p.Pant),
      lager: lager,
      minLager: min,
      status: lager <= 0 ? 'udsolgt' : (lager <= min ? 'lav' : 'ok'),
      aktiv: sandt_(p.Aktiv)
    };
  });
}

/** Bruges til at opdatere lagertal og aktiv tilstand uden at hente alt. */
function hentProdukter() {
  return { produkter: hentProdukter_(), tilstand: aktivTilstand_(), spil: spilIndstillinger_() };
}

/* ------------------------------------------------------------------ */
/* Spil                                                                */
/* ------------------------------------------------------------------ */

/* Hestevæddeløbet er uafhængigt af prestilstandene, så I kan have
 * festivalpriser og væddeløb kørende på samme tid.                    */

function spilIndstillinger_() {
  return {
    hest: {
      aktiv: sandt_(hentIndstilling_('SpilHest') || 'nej'),
      chance: Math.max(0, Math.min(100, Number(hentIndstilling_('SpilHestChance') || 20) || 0)),
      gaelderFor: String(hentIndstilling_('SpilHestGælder') || 'Øl'),
      antalHeste: Math.max(2, Math.min(6, Number(hentIndstilling_('SpilHestAntal') || 4) || 4))
    }
  };
}

function hentSpil() { return spilIndstillinger_(); }

/* ------------------------------------------------------------------ */
/* Prestilstande                                                       */
/* ------------------------------------------------------------------ */

/* En tilstand ("Festival", "Happy hour") ændrer prisen på en gruppe varer,
 * mens den er slået til. Kun én kan være aktiv ad gangen, og den kan have
 * et sluttidspunkt, så festivalpriser ikke bliver hængende i ugevis.     */

function normaliserType_(t) {
  var v = String(t || '').trim().toLowerCase();
  if (v.indexOf('fast') === 0) return 'fastpris';
  if (v.indexOf('till') === 0 || v.indexOf('bel') === 0 || v === '+') return 'tillaeg';
  return 'procent';
}

function hentTilstande_() {
  return readObjects_(SHEET_TILSTANDE).map(function (t) {
    return {
      id: String(t.ID),
      navn: String(t.Navn || ''),
      emoji: String(t.Emoji || '🎉'),
      farve: String(t.Farve || '#8b3fd6'),
      gaelderFor: String(t['Gælder for'] || 'ALLE'),
      type: normaliserType_(t.Type),
      vaerdi: Number(t['Værdi']) || 0,
      aktiv: sandt_(t.Aktiv),
      slutter: (t.Slutter instanceof Date) ? t.Slutter.getTime() : 0
    };
  });
}

function hentTilstande() { return hentTilstande_(); }

/** Slår en tilstand fra i regnearket (bruges også ved automatisk udløb). */
function sluk_(id) {
  var sh = getSheet_(SHEET_TILSTANDE);
  var alle = readObjects_(SHEET_TILSTANDE);
  var aktivKol = kolonne_(SHEET_TILSTANDE, 'Aktiv');
  var slutKol = kolonne_(SHEET_TILSTANDE, 'Slutter');
  alle.forEach(function (t) {
    if (!id || String(t.ID) === String(id)) {
      sh.getRange(t._row, aktivKol).setValue(false);
      sh.getRange(t._row, slutKol).setValue('');
    }
  });
}

/** Den aktive tilstand, eller null. Udløbne tilstande slukkes undervejs. */
function aktivTilstand_() {
  var alle = hentTilstande_();
  var nu = Date.now();
  for (var i = 0; i < alle.length; i++) {
    if (!alle[i].aktiv) continue;
    if (alle[i].slutter && alle[i].slutter <= nu) { sluk_(alle[i].id); continue; }
    return alle[i];
  }
  return null;
}

/** Om tilstanden rammer et bestemt produkt. */
function daekker_(t, p) {
  var g = String(t.gaelderFor || '').trim();
  // INGEN sættes automatisk hvis den sidste vare på listen bliver slettet.
  // Så gælder tilstanden ingenting, indtil nogen vælger nye varer – bedre
  // end at den stiltiende begynder at gælde alt.
  if (g.toUpperCase() === 'INGEN') return false;
  if (!g || g.toUpperCase() === 'ALLE') return true;
  var dele = g.split(',').map(function (x) { return x.trim().toLowerCase(); })
    .filter(function (x) { return x; });
  return dele.indexOf(String(p.kategori || '').toLowerCase()) !== -1 ||
         dele.indexOf(String(p.id || '').toLowerCase()) !== -1 ||
         dele.indexOf(String(p.navn || '').toLowerCase()) !== -1;
}

/**
 * Prisen på et produkt lige nu. Samme regnestykke findes i klienten, så
 * det viste og det bogførte beløb altid er ens.
 */
function prisMedTilstand_(p, t) {
  var pris = Number(p.pris) || 0;
  if (!t || !daekker_(t, p)) return Math.round(pris * 100) / 100;
  var v = Number(t.vaerdi) || 0;
  if (t.type === 'fastpris') pris = v;
  else if (t.type === 'tillaeg') pris = pris + v;
  else pris = pris * (1 + v / 100);
  return Math.max(0, Math.round(pris * 100) / 100);
}

function gemTilstand(pin, t) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_TILSTANDE);
    var alle = readObjects_(SHEET_TILSTANDE);
    var navn = String(t.navn || '').trim();
    if (!navn) throw new Error('Tilstanden skal have et navn.');
    var raekke = [null, navn, String(t.emoji || '🎉'), String(t.farve || '#8b3fd6'),
                  String(t.gaelderFor || 'ALLE'), normaliserType_(t.type),
                  Number(t.vaerdi) || 0, false, '', new Date()];

    if (t.id) {
      for (var i = 0; i < alle.length; i++) {
        if (String(alle[i].ID) === String(t.id)) {
          raekke[0] = String(t.id);
          raekke[7] = sandt_(alle[i].Aktiv);
          raekke[8] = alle[i].Slutter || '';
          raekke[9] = alle[i].Oprettet || new Date();
          sh.getRange(alle[i]._row, 1, 1, raekke.length).setValues([raekke]);
          return { id: String(t.id), tilstande: hentTilstande_(), aktiv: aktivTilstand_() };
        }
      }
      throw new Error('Tilstanden findes ikke længere.');
    }
    raekke[0] = nytId_('T', alle);
    sh.appendRow(raekke);
    return { id: raekke[0], tilstande: hentTilstande_(), aktiv: aktivTilstand_() };
  } finally { laas.releaseLock(); }
}

function sletTilstand(pin, id) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_TILSTANDE);
    var alle = readObjects_(SHEET_TILSTANDE);
    for (var i = alle.length - 1; i >= 0; i--) {
      if (String(alle[i].ID) === String(id)) sh.deleteRow(alle[i]._row);
    }
    return { tilstande: hentTilstande_(), aktiv: aktivTilstand_() };
  } finally { laas.releaseLock(); }
}

/**
 * Slår en tilstand til. Alle andre slukkes.
 * @param {number} timer  Antal timer den skal vare. 0 = til den slås fra manuelt.
 */
function aktiverTilstand(pin, id, timer) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    sluk_(null);
    var sh = getSheet_(SHEET_TILSTANDE);
    var alle = readObjects_(SHEET_TILSTANDE);
    var aktivKol = kolonne_(SHEET_TILSTANDE, 'Aktiv');
    var slutKol = kolonne_(SHEET_TILSTANDE, 'Slutter');
    for (var i = 0; i < alle.length; i++) {
      if (String(alle[i].ID) === String(id)) {
        sh.getRange(alle[i]._row, aktivKol).setValue(true);
        var t = Number(timer) || 0;
        sh.getRange(alle[i]._row, slutKol)
          .setValue(t > 0 ? new Date(Date.now() + t * 3600 * 1000) : '');
        return { tilstande: hentTilstande_(), aktiv: aktivTilstand_() };
      }
    }
    throw new Error('Tilstanden findes ikke.');
  } finally { laas.releaseLock(); }
}

function deaktiverTilstande(pin) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    sluk_(null);
    return { tilstande: hentTilstande_(), aktiv: null };
  } finally { laas.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* Køb – trækker automatisk fra lageret                                */
/* ------------------------------------------------------------------ */

/**
 * @param {string} personId
 * @param {Array<{produktId:string, antal:number}>} linjer
 * @param {string} ref  Klient-genereret id, gør gentagne forsøg idempotente.
 */
function registrerKoeb(personId, linjer, ref) {
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_KOEB);

    if (ref) {
      var fundet = findRefRaekker_(sh, ref);
      if (fundet.length) {
        return { ok: true, dublet: true, koebIds: fundet, total: 0,
                 tilstand: aktivTilstand_(), produkter: hentProdukter_() };
      }
    }

    var personer = hentPersoner_();
    var person = null;
    for (var i = 0; i < personer.length; i++) if (personer[i].id === personId) person = personer[i];
    if (!person) throw new Error('Ukendt person: ' + personId);

    var prodRaekker = readObjects_(SHEET_PRODUKTER);
    var prodMap = {};
    prodRaekker.forEach(function (p) { prodMap[String(p.ID)] = p; });

    var tilladUdenLager = sandt_(hentIndstilling_('TilladSalgUdenLager') || 'ja');
    var tilstand = aktivTilstand_();
    var pantBeloeb = Number(hentIndstilling_('PantBeløb') || 1) || 0;

    var nu = new Date();
    var maaned = maanedAf_(nu);
    var alleKoeb = readObjects_(SHEET_KOEB);
    var maks = 0;
    alleKoeb.forEach(function (k) {
      var m = String(k['KøbID'] || '').match(/(\d+)$/);
      if (m) maks = Math.max(maks, parseInt(m[1], 10));
    });

    var raekker = [];
    var ids = [];
    var total = 0;
    var lagerOpdateringer = [];
    var advarsler = [];

    linjer.forEach(function (l) {
      var p = prodMap[String(l.produktId)];
      if (!p) throw new Error('Ukendt produkt: ' + l.produktId);
      var antal = Math.max(1, Math.round(Number(l.antal) || 1));
      var pris = prisMedTilstand_({
        id: String(p.ID), navn: String(p.Navn),
        kategori: String(p.Kategori || ''), pris: Number(p.Pris) || 0
      }, tilstand);
      var lagerFoer = Math.round(Number(p.Lager) || 0);

      if (lagerFoer < antal && !tilladUdenLager) {
        throw new Error(p.Navn + ' er udsolgt (' + lagerFoer + ' tilbage).');
      }
      var lagerEfter = lagerFoer - antal;
      if (lagerEfter < 0) advarsler.push(p.Navn + ' står nu til ' + lagerEfter + ' – tæl efter.');

      // Pant lægges oveni, når varen tages med ud af huset
      var pantAntal = 0;
      if (sandt_(p.Pant) && pantBeloeb > 0) {
        pantAntal = Math.max(0, Math.min(antal, Math.round(Number(l.pant) || 0)));
      }
      var linjeTotal = Math.round((pris * antal + pantAntal * pantBeloeb) * 100) / 100;
      maks++;
      var id = 'K' + maks;
      ids.push(id);
      total += linjeTotal;
      raekker.push([id, nu, maaned, person.id, person.navn, String(p.ID), String(p.Navn),
                    antal, pris, linjeTotal, false, ref || '',
                    tilstand ? tilstand.navn : '', pantAntal,
                    pantAntal ? pantBeloeb : '']);
      lagerOpdateringer.push({ row: p._row, vaerdi: lagerEfter });
      p.Lager = lagerEfter; // hvis samme produkt optræder flere gange i samme kurv
    });

    if (raekker.length) {
      sh.getRange(sh.getLastRow() + 1, 1, raekker.length, HEADERS[SHEET_KOEB].length)
        .setValues(raekker);
    }

    var lagerKol = kolonne_(SHEET_PRODUKTER, 'Lager');
    var prodSh = getSheet_(SHEET_PRODUKTER);
    lagerOpdateringer.forEach(function (o) {
      prodSh.getRange(o.row, lagerKol).setValue(o.vaerdi);
    });

    return {
      ok: true,
      koebIds: ids,
      total: Math.round(total * 100) / 100,
      person: person.navn,
      advarsler: advarsler,
      tilstand: tilstand,
      produkter: hentProdukter_()
    };
  } finally {
    laas.releaseLock();
  }
}

function findRefRaekker_(sh, ref) {
  var sidste = sh.getLastRow();
  if (sidste < 2) return [];
  var refKol = kolonne_(SHEET_KOEB, 'Ref');
  var start = Math.max(2, sidste - 400);
  var antal = sidste - start + 1;
  var refs = sh.getRange(start, refKol, antal, 1).getValues();
  var ids = sh.getRange(start, 1, antal, 1).getValues();
  var fundet = [];
  for (var i = 0; i < refs.length; i++) {
    if (String(refs[i][0]) === String(ref)) fundet.push(String(ids[i][0]));
  }
  return fundet;
}

/** Annullerer køb og lægger varerne tilbage på lageret. */
function fortrydKoeb(koebIds) {
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_KOEB);
    var alle = readObjects_(SHEET_KOEB);
    var saet = {};
    koebIds.forEach(function (id) { saet[String(id)] = true; });

    var annKol = kolonne_(SHEET_KOEB, 'Annulleret');
    var prodSh = getSheet_(SHEET_PRODUKTER);
    var prodRaekker = readObjects_(SHEET_PRODUKTER);
    var prodMap = {};
    prodRaekker.forEach(function (p) { prodMap[String(p.ID)] = p; });
    var lagerKol = kolonne_(SHEET_PRODUKTER, 'Lager');

    var antal = 0;
    alle.forEach(function (k) {
      if (!saet[String(k['KøbID'])] || sandt_(k.Annulleret)) return;
      sh.getRange(k._row, annKol).setValue(true);
      antal++;
      var p = prodMap[String(k.ProduktID)];
      if (p) {
        p.Lager = Math.round(Number(p.Lager) || 0) + (Number(k.Antal) || 0);
        prodSh.getRange(p._row, lagerKol).setValue(p.Lager);
      }
    });
    return { ok: true, antal: antal, tilstand: aktivTilstand_(),
             produkter: hentProdukter_() };
  } finally {
    laas.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Lager                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ændrer lagerbeholdningen og skriver en linje i Lagerbevægelser.
 * @param {string} type  'Påfyld' | 'Optælling' | 'Spild' | 'Justering'
 * @param {number} antal Positiv = tilgang, negativ = afgang (ignoreres ved Optælling)
 * @param {number=} saetTil  Ved Optælling: den optalte beholdning
 */
function aendrLager_(produktId, type, antal, saetTil, note) {
  var prodSh = getSheet_(SHEET_PRODUKTER);
  var prodRaekker = readObjects_(SHEET_PRODUKTER);
  var p = null;
  for (var i = 0; i < prodRaekker.length; i++) {
    if (String(prodRaekker[i].ID) === String(produktId)) p = prodRaekker[i];
  }
  if (!p) throw new Error('Ukendt produkt: ' + produktId);

  var foer = Math.round(Number(p.Lager) || 0);
  var efter;
  if (type === 'Optælling') {
    efter = Math.round(Number(saetTil) || 0);
    antal = efter - foer;
  } else {
    antal = Math.round(Number(antal) || 0);
    efter = foer + antal;
  }
  if (antal === 0 && type !== 'Optælling') return { foer: foer, efter: efter };

  prodSh.getRange(p._row, kolonne_(SHEET_PRODUKTER, 'Lager')).setValue(efter);

  var lagerSh = getSheet_(SHEET_LAGER);
  var alle = readObjects_(SHEET_LAGER);
  lagerSh.appendRow([nytId_('L', alle), new Date(), String(p.ID), String(p.Navn),
                     type, antal, foer, efter, String(note || ''), bruger_()]);
  return { foer: foer, efter: efter, aendring: antal };
}

function paafyldLager(pin, produktId, antal, note) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var a = Math.abs(Math.round(Number(antal) || 0));
    if (!a) throw new Error('Angiv et antal større end 0.');
    aendrLager_(produktId, 'Påfyld', a, null, note);
    return hentProdukter_();
  } finally { laas.releaseLock(); }
}

function optaelLager(pin, produktId, optaltAntal, note) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    aendrLager_(produktId, 'Optælling', 0, Math.round(Number(optaltAntal) || 0), note);
    return hentProdukter_();
  } finally { laas.releaseLock(); }
}

function registrerSpild(pin, produktId, antal, note) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var a = Math.abs(Math.round(Number(antal) || 0));
    if (!a) throw new Error('Angiv et antal større end 0.');
    aendrLager_(produktId, 'Spild', -a, null, note);
    return hentProdukter_();
  } finally { laas.releaseLock(); }
}

/** Hurtig +1/-1 fra lagerfanen. */
function justerLager(pin, produktId, delta, note) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var d = Math.round(Number(delta) || 0);
    if (!d) return hentProdukter_();
    aendrLager_(produktId, 'Justering', d, null, note || 'Justering');
    return hentProdukter_();
  } finally { laas.releaseLock(); }
}

/** Påfyldning af flere varer på én gang (indkøbstur). */
function bulkPaafyld(pin, linjer, note) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    linjer.forEach(function (l) {
      var a = Math.round(Number(l.antal) || 0);
      if (a) aendrLager_(l.produktId, 'Påfyld', a, null, note || 'Indkøb');
    });
    return hentProdukter_();
  } finally { laas.releaseLock(); }
}

/** Samlet lageroverblik: beholdning, værdi og hvad der skal købes ind. */
function hentLagerstatus() {
  var produkter = hentProdukter_().filter(function (p) { return p.aktiv; });
  var vaerdiSalg = 0, vaerdiKost = 0, antalVarer = 0;
  var lav = [], udsolgt = [];

  produkter.forEach(function (p) {
    var l = Math.max(p.lager, 0);
    antalVarer += l;
    vaerdiSalg += l * p.pris;
    vaerdiKost += l * p.kostpris;
    if (p.lager <= 0) udsolgt.push(p);
    else if (p.lager <= p.minLager) lav.push(p);
  });

  return {
    produkter: produkter.sort(function (a, b) { return a.lager - b.lager; }),
    antalVarer: antalVarer,
    vaerdiSalg: Math.round(vaerdiSalg * 100) / 100,
    vaerdiKost: Math.round(vaerdiKost * 100) / 100,
    udsolgt: udsolgt,
    lav: lav,
    valuta: hentIndstilling_('Valuta') || 'kr'
  };
}

/** De seneste lagerbevægelser (påfyld, optælling, spild). */
function hentLagerlog(antal) {
  var alle = readObjects_(SHEET_LAGER);
  var n = antal || 50;
  return alle.slice(Math.max(0, alle.length - n)).reverse().map(function (r) {
    return {
      id: String(r.ID),
      tid: r.Tidspunkt instanceof Date
        ? Utilities.formatDate(r.Tidspunkt, tz_(), 'dd-MM HH:mm') : String(r.Tidspunkt),
      produkt: String(r['ProduktNavn']),
      type: String(r.Type),
      aendring: Number(r['Ændring']) || 0,
      efter: Number(r['Lager efter']) || 0,
      note: String(r.Note || '')
    };
  });
}

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

function tjekPin(pin) {
  return String(pin) === String(hentIndstilling_('AdminPin') || '1234');
}

function kraevAdmin_(pin) {
  if (!tjekPin(pin)) throw new Error('Forkert PIN-kode.');
}

function gemProdukt(pin, p) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_PRODUKTER);
    var alle = readObjects_(SHEET_PRODUKTER);
    var navn = String(p.navn || '').trim();
    if (!navn) throw new Error('Produktet skal have et navn.');
    var pris = Math.round((Number(p.pris) || 0) * 100) / 100;
    var kostpris = Math.round((Number(p.kostpris) || 0) * 100) / 100;
    var minLager = Math.round(Number(p.minLager !== undefined && p.minLager !== ''
      ? p.minLager : (hentIndstilling_('StandardMinLager') || 3)));

    if (p.id) {
      for (var i = 0; i < alle.length; i++) {
        if (String(alle[i].ID) === String(p.id)) {
          var r = alle[i];
          var raekke = [String(p.id), navn, pris, String(p.emoji || '📦'),
                        String(p.kategori || ''), Math.round(Number(r.Lager) || 0),
                        minLager, kostpris, p.pant !== false,
                        p.aktiv !== false, r.Oprettet || new Date()];
          sh.getRange(r._row, 1, 1, raekke.length).setValues([raekke]);
          sh.getRange(r._row, 3).setNumberFormat('0.00');
          sh.getRange(r._row, 8).setNumberFormat('0.00');
          return { id: String(p.id), produkter: hentProdukter_() };
        }
      }
      throw new Error('Produktet findes ikke længere.');
    }

    var startLager = Math.round(Number(p.lager) || 0);
    var nyId = nytId_('V', alle);
    sh.appendRow([nyId, navn, pris, String(p.emoji || '📦'), String(p.kategori || ''),
                  0, minLager, kostpris, p.pant !== false, p.aktiv !== false, new Date()]);
    sh.getRange(sh.getLastRow(), 3).setNumberFormat('0.00');
    sh.getRange(sh.getLastRow(), 8).setNumberFormat('0.00');
    if (startLager) aendrLager_(nyId, 'Påfyld', startLager, null, 'Startbeholdning');
    return { id: nyId, produkter: hentProdukter_() };
  } finally {
    laas.releaseLock();
  }
}

/**
 * Hvad der bliver berørt hvis en vare slettes. Bruges til at vise
 * administratoren konsekvenserne, før der trykkes.
 */
function hentProduktBrug(pin, produktId) {
  kraevAdmin_(pin);
  var id = String(produktId);
  var p = null;
  hentProdukter_().forEach(function (x) { if (x.id === id) p = x; });
  if (!p) throw new Error('Produktet findes ikke.');

  var linjer = 0, solgt = 0, maaneder = {};
  readObjects_(SHEET_KOEB).forEach(function (k) {
    if (String(k.ProduktID) !== id || sandt_(k.Annulleret)) return;
    linjer++;
    solgt += Number(k.Antal) || 0;
    var m = String(k['Måned'] || '');
    if (m) maaneder[m] = true;
  });

  var iTilstande = [];
  hentTilstande_().forEach(function (t) {
    var g = String(t.gaelderFor || '');
    if (g.toUpperCase() === 'ALLE') return;
    var dele = g.split(',').map(function (x) { return x.trim().toLowerCase(); });
    if (dele.indexOf(p.navn.toLowerCase()) !== -1 || dele.indexOf(id.toLowerCase()) !== -1) {
      iTilstande.push(t.navn);
    }
  });

  var spilG = String(hentIndstilling_('SpilHestGælder') || '');
  var iSpil = spilG.split(',').map(function (x) { return x.trim().toLowerCase(); })
    .indexOf(p.navn.toLowerCase()) !== -1;

  return {
    navn: p.navn, lager: p.lager,
    koebLinjer: linjer, solgt: solgt, maaneder: Object.keys(maaneder).length,
    tilstande: iTilstande, iSpil: iSpil
  };
}

/** Fjerner navnet fra en kommasepareret liste. */
function fjernFraListe_(liste, navn) {
  return String(liste || '').split(',')
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x && x.toLowerCase() !== String(navn).toLowerCase(); })
    .join(', ');
}

/**
 * Sletter en vare helt. Købshistorikken rører vi ikke: hver købslinje gemmer
 * selv varenavn og pris, så gamle opgørelser står uændrede. Lagerbevægelser
 * bevares også som revisionsspor. Til gengæld ryddes varens billede og dens
 * navn i de tilstande og i spillet, hvor den var valgt til.
 */
function sletProdukt(pin, produktId) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var id = String(produktId);
    var sh = getSheet_(SHEET_PRODUKTER);
    var alle = readObjects_(SHEET_PRODUKTER);
    var navn = null, raekke = -1;
    for (var i = 0; i < alle.length; i++) {
      if (String(alle[i].ID) === id) { navn = String(alle[i].Navn); raekke = alle[i]._row; }
    }
    if (raekke < 0) throw new Error('Produktet findes ikke længere.');

    sh.deleteRow(raekke);

    // Billedet
    var bsh = getSheet_(SHEET_BILLEDER);
    var braekker = readObjects_(SHEET_BILLEDER);
    for (var b = braekker.length - 1; b >= 0; b--) {
      if (String(braekker[b].ID) === id) bsh.deleteRow(braekker[b]._row);
    }

    // Tilstande der pegede på varen
    var tsh = getSheet_(SHEET_TILSTANDE);
    var traekker = readObjects_(SHEET_TILSTANDE);
    var gKol = kolonne_(SHEET_TILSTANDE, 'Gælder for');
    traekker.forEach(function (t) {
      var g = String(t['Gælder for'] || '');
      if (g.toUpperCase() === 'ALLE') return;
      var ny = fjernFraListe_(g, navn);
      if (ny !== g) tsh.getRange(t._row, gKol).setValue(ny || 'INGEN');
    });

    // Spillets udløsere
    var spilG = String(hentIndstilling_('SpilHestGælder') || '');
    if (spilG.toUpperCase() !== 'ALLE') {
      var nySpil = fjernFraListe_(spilG, navn);
      if (nySpil !== spilG) saetIndstillingUdenPin_('SpilHestGælder', nySpil || 'INGEN');
    }

    return { ok: true, navn: navn, produkter: hentProdukter_(), tilstande: hentTilstande_() };
  } finally { laas.releaseLock(); }
}

/** Intern variant uden PIN-tjek – kaldes kun fra kode der selv har tjekket. */
function saetIndstillingUdenPin_(noegle, vaerdi) {
  var sh = getSheet_(SHEET_INDSTILLINGER);
  var alle = readObjects_(SHEET_INDSTILLINGER);
  for (var i = 0; i < alle.length; i++) {
    if (String(alle[i]['Nøgle']) === String(noegle)) {
      sh.getRange(alle[i]._row, 2).setValue(vaerdi);
      return;
    }
  }
  sh.appendRow([noegle, vaerdi]);
}

function gemPerson(pin, p) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_PERSONER);
    var alle = readObjects_(SHEET_PERSONER);
    var navn = String(p.navn || '').trim();
    if (!navn) throw new Error('Personen skal have et navn.');
    var farve = String(p.farve || FARVER[alle.length % FARVER.length]);
    var gruppe = String(p.gruppe || '').trim() || (hentIndstilling_('StandardGruppe') || 'Beboere');
    var raekke = [null, navn, gruppe, farve, p.aktiv !== false, new Date()];

    if (p.id) {
      for (var i = 0; i < alle.length; i++) {
        if (String(alle[i].ID) === String(p.id)) {
          raekke[0] = String(p.id);
          raekke[5] = alle[i].Oprettet || new Date();
          sh.getRange(alle[i]._row, 1, 1, raekke.length).setValues([raekke]);
          return { id: String(p.id), personer: hentPersoner_() };
        }
      }
      throw new Error('Personen findes ikke længere.');
    }
    raekke[0] = nytId_('P', alle);
    sh.appendRow(raekke);
    return { id: raekke[0], personer: hentPersoner_() };
  } finally {
    laas.releaseLock();
  }
}

/** Adresserne på regnearket og på selve kiosken – så de altid kan findes igen. */
function hentAdresser(pin) {
  kraevAdmin_(pin);
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return { regneark: getSs_().getUrl(), kiosk: url };
}

function saetIndstilling(pin, noegle, vaerdi) {
  kraevAdmin_(pin);
  var sh = getSheet_(SHEET_INDSTILLINGER);
  var alle = readObjects_(SHEET_INDSTILLINGER);
  for (var i = 0; i < alle.length; i++) {
    if (String(alle[i]['Nøgle']) === String(noegle)) {
      sh.getRange(alle[i]._row, 2).setValue(vaerdi);
      return true;
    }
  }
  sh.appendRow([noegle, vaerdi]);
  return true;
}

/* ------------------------------------------------------------------ */
/* Billeder                                                            */
/* ------------------------------------------------------------------ */

/* Billeder gemmes som data-URI'er i fanen Billeder, nøglet på produkt-
 * eller person-ID. Klienten skalerer og komprimerer inden upload, så
 * hver celle holder sig langt under Sheets' grænse på 50.000 tegn.     */

var BILLEDE_MAKS_TEGN = 45000;

/** @return {Object} map fra ID til data-URI */
function hentBilleder() {
  var raekker = readObjects_(SHEET_BILLEDER);
  var ud = {};
  raekker.forEach(function (r) {
    var b = String(r.Billede || '');
    if (r.ID && b) ud[String(r.ID)] = b;
  });
  return ud;
}

/**
 * Et lille fingeraftryk af billedsamlingen: hvor mange og hvornår sidst rettet.
 * Kiosken henter det først og springer de tunge billeddata over, hvis den
 * allerede har dem — ellers ville hver indlæsning trække et par megabyte.
 */
function hentBilledStempel() {
  var sh = getSheet_(SHEET_BILLEDER);
  var sidste = sh.getLastRow();
  if (sidste < 2) return '0|0';
  // Kun ID og Opdateret læses – ikke selve billeddataene
  var ider = sh.getRange(2, 1, sidste - 1, 1).getValues();
  var tider = sh.getRange(2, 3, sidste - 1, 1).getValues();
  var nyeste = 0;
  for (var i = 0; i < tider.length; i++) {
    var t = tider[i][0];
    if (t instanceof Date && t.getTime() > nyeste) nyeste = t.getTime();
  }
  return ider.length + '|' + nyeste;
}

function gemBillede(pin, id, dataUri) {
  kraevAdmin_(pin);
  var s = String(dataUri || '');
  if (s.indexOf('data:image/') !== 0) throw new Error('Ugyldigt billedformat.');
  if (s.length > BILLEDE_MAKS_TEGN) {
    throw new Error('Billedet fylder for meget. Prøv et mindre billede.');
  }
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_BILLEDER);
    var raekker = readObjects_(SHEET_BILLEDER);
    for (var i = 0; i < raekker.length; i++) {
      if (String(raekker[i].ID) === String(id)) {
        sh.getRange(raekker[i]._row, 1, 1, 3).setValues([[String(id), s, new Date()]]);
        return true;
      }
    }
    sh.appendRow([String(id), s, new Date()]);
    return true;
  } finally { laas.releaseLock(); }
}

function sletBillede(pin, id) {
  kraevAdmin_(pin);
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_BILLEDER);
    var raekker = readObjects_(SHEET_BILLEDER);
    for (var i = raekker.length - 1; i >= 0; i--) {
      if (String(raekker[i].ID) === String(id)) sh.deleteRow(raekker[i]._row);
    }
    return true;
  } finally { laas.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* Selvbetjening – uden PIN                                            */
/* ------------------------------------------------------------------ */

/**
 * Opretter en gæst uden administratorkode. Kan kun lave personer i
 * gæstegruppen — gruppen kommer fra indstillingerne, ikke fra kaldet, så
 * selvbetjeningen ikke kan bruges til at oprette beboere.
 */
function opretGaest(navn) {
  if (!sandt_(hentIndstilling_('TilladGæster') || 'ja')) {
    throw new Error('Gæster er slået fra lige nu.');
  }
  var rent = String(navn || '').replace(/\s+/g, ' ').trim();
  if (rent.length < 2) throw new Error('Skriv et navn med mindst to bogstaver.');
  if (rent.length > 40) throw new Error('Navnet er for langt.');

  var gruppe = hentIndstilling_('GæsteGruppe') || 'Gæster';
  var maks = Math.max(1, Number(hentIndstilling_('MaksGæster') || 200) || 200);

  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var alle = readObjects_(SHEET_PERSONER);
    var aktiveGaester = 0;
    for (var i = 0; i < alle.length; i++) {
      var p = alle[i];
      if (!sandt_(p.Aktiv)) continue;
      if (String(p.Navn).toLowerCase() === rent.toLowerCase()) {
        throw new Error('Der findes allerede en "' + p.Navn + '". Vælg et andet navn.');
      }
      if (String(p.Gruppe || '') === gruppe) aktiveGaester++;
    }
    if (aktiveGaester >= maks) {
      throw new Error('Der er ikke plads til flere gæster lige nu.');
    }

    var id = nytId_('P', alle);
    var farve = FARVER[alle.length % FARVER.length];
    getSheet_(SHEET_PERSONER).appendRow([id, rent, gruppe, farve, true, new Date()]);
    return { id: id, gruppe: gruppe, personer: hentPersoner_() };
  } finally { laas.releaseLock(); }
}


/* De to funktioner her kan kaldes uden administratorkode, fordi de hører
 * til den person der står ved skærmen. De kan kun røre ved præcis dét:
 * et profilbillede på en person der findes, og en læsning af egne køb.  */

/** Sætter en persons eget profilbillede. Kan ikke ramme andet end personer. */
function gemEgetBillede(personId, dataUri) {
  var id = String(personId || '');
  var findes = false;
  hentPersoner_().forEach(function (p) { if (p.id === id && p.aktiv) findes = true; });
  if (!findes) throw new Error('Ukendt person.');

  var s = String(dataUri || '');
  if (s.indexOf('data:image/') !== 0) throw new Error('Ugyldigt billedformat.');
  if (s.length > BILLEDE_MAKS_TEGN) {
    throw new Error('Billedet fylder for meget. Prøv et mindre billede.');
  }

  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_BILLEDER);
    var raekker = readObjects_(SHEET_BILLEDER);
    for (var i = 0; i < raekker.length; i++) {
      if (String(raekker[i].ID) === id) {
        sh.getRange(raekker[i]._row, 1, 1, 3).setValues([[id, s, new Date()]]);
        return { ok: true, id: id, billede: s };
      }
    }
    sh.appendRow([id, s, new Date()]);
    return { ok: true, id: id, billede: s };
  } finally { laas.releaseLock(); }
}

/** Fjerner ens eget profilbillede igen. */
function sletEgetBillede(personId) {
  var id = String(personId || '');
  var findes = false;
  hentPersoner_().forEach(function (p) { if (p.id === id && p.aktiv) findes = true; });
  if (!findes) throw new Error('Ukendt person.');

  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_BILLEDER);
    var raekker = readObjects_(SHEET_BILLEDER);
    for (var i = raekker.length - 1; i >= 0; i--) {
      if (String(raekker[i].ID) === id) sh.deleteRow(raekker[i]._row);
    }
    return { ok: true, id: id };
  } finally { laas.releaseLock(); }
}

/**
 * Én persons egne køb i en måned. Kun læsning – der er ingen vej herfra
 * til at rette i historikken.
 */
function hentEgneKoeb(personId, maaned) {
  var id = String(personId || '');
  if (!maaned) maaned = maanedAf_(new Date());

  var linjer = {}, koeb = [];
  var total = 0, antal = 0, pantAntal = 0, pantTotal = 0;

  readObjects_(SHEET_KOEB).forEach(function (k) {
    if (String(k.PersonID) !== id) return;
    if (sandt_(k.Annulleret)) return;
    var m = String(k['Måned'] || '');
    if (!m && k.Tidspunkt instanceof Date) m = maanedAf_(k.Tidspunkt);
    if (m !== maaned) return;

    var a = Number(k.Antal) || 0;
    var t = Number(k.Total) || 0;
    var pa = Number(k.PantAntal) || 0;
    var pb = Number(k['PantBeløb']) || 0;
    var tilstand = String(k.Tilstand || '');

    total += t; antal += a; pantAntal += pa; pantTotal += pa * pb;

    var noegle = String(k.ProduktNavn) + '|' + (Number(k.StykPris) || 0) + '|' + tilstand;
    if (!linjer[noegle]) {
      linjer[noegle] = { produkt: String(k.ProduktNavn), stykPris: Number(k.StykPris) || 0,
                         tilstand: tilstand, antal: 0, total: 0 };
    }
    linjer[noegle].antal += a;
    linjer[noegle].total += t - pa * pb;

    koeb.push({
      tid: k.Tidspunkt instanceof Date
        ? Utilities.formatDate(k.Tidspunkt, tz_(), 'd/M HH:mm') : String(k.Tidspunkt),
      produkt: String(k.ProduktNavn),
      antal: a,
      stykPris: Number(k.StykPris) || 0,
      pantAntal: pa,
      tilstand: tilstand,
      total: t
    });
  });

  var liste = Object.keys(linjer).map(function (n) { return linjer[n]; })
    .sort(function (a, b) { return b.total - a.total; });
  if (pantAntal > 0) {
    liste.push({ produkt: 'Pant', stykPris: pantTotal / pantAntal, erPant: true,
                 tilstand: '', antal: pantAntal, total: pantTotal });
  }

  return {
    maaned: maaned,
    total: Math.round(total * 100) / 100,
    antal: antal,
    pantAntal: pantAntal,
    pantTotal: Math.round(pantTotal * 100) / 100,
    linjer: liste,
    koeb: koeb.reverse(),
    valuta: hentIndstilling_('Valuta') || 'kr'
  };
}

/* ------------------------------------------------------------------ */
/* Spilresultater                                                      */
/* ------------------------------------------------------------------ */

/**
 * Gemmer udfaldet af et hestevæddeløb, så det kan tælles med i årsstatistikken.
 * Kaldes af kiosken uden PIN, ligesom et køb.
 */
function registrerSpil(personId, valgtHest, vinderHest, vandt) {
  var laas = LockService.getScriptLock();
  laas.waitLock(30000);
  try {
    var sh = getSheet_(SHEET_SPIL);
    var alle = readObjects_(SHEET_SPIL);
    var personer = hentPersoner_();
    var navn = String(personId);
    for (var i = 0; i < personer.length; i++) {
      if (personer[i].id === String(personId)) navn = personer[i].navn;
    }
    var nu = new Date();
    sh.appendRow([nytId_('S', alle), nu, maanedAf_(nu), String(personId), navn,
                  'Hestevæddeløb', String(valgtHest || ''), String(vinderHest || ''),
                  vandt ? 'Slap' : 'Ordning']);
    return { ok: true };
  } finally { laas.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* Årsstatistik                                                        */
/* ------------------------------------------------------------------ */

/** Hvilke år der er data for. Kun for administratorer. */
function hentAar(pin) {
  kraevAdmin_(pin);
  var saet = {};
  readObjects_(SHEET_KOEB).forEach(function (k) {
    var m = String(k['Måned'] || '');
    if (!m && k.Tidspunkt instanceof Date) m = maanedAf_(k.Tidspunkt);
    if (m) saet[m.substring(0, 4)] = true;
  });
  saet[Utilities.formatDate(new Date(), tz_(), 'yyyy')] = true;
  return Object.keys(saet).sort().reverse();
}

function dagNavn_(n) {
  return ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'][n];
}

/**
 * Alt der kan tælles om et år, samlet i ét kald. Regnes ud fra Køb og Spil,
 * så der ikke ligger dobbelt bogholderi nogen steder.
 * Kræver PIN – årets tal er ikke noget alle skal kunne hente ved skærmen.
 */
function hentAarsstatistik(pin, aar) {
  kraevAdmin_(pin);
  aar = String(aar);
  var tz = tz_();
  var personer = hentPersoner_();
  var personMap = {};
  personer.forEach(function (p) { personMap[p.id] = p; });

  var pr = {};            // pr. person
  var varer = {};         // pr. vare
  var maaneder = {};      // yyyy-MM -> beløb
  var ugedage = [0,0,0,0,0,0,0];
  var timer = new Array(24).fill(0);
  var datoer = {};        // yyyy-MM-dd -> beløb
  var kurve = {};         // ref -> { person, total, tid }
  var total = 0, antalVarer = 0, pantIAlt = 0, annullerede = 0;

  function person(id, navn) {
    if (!pr[id]) {
      var p = personMap[id];
      pr[id] = {
        id: id, navn: navn || (p ? p.navn : id),
        gruppe: p ? p.gruppe : '', farve: p ? p.farve : '#8b3fd6',
        total: 0, antal: 0, pantAntal: 0, pantTotal: 0,
        varer: {}, dage: {}, timer: new Array(24).fill(0), ugedage: [0,0,0,0,0,0,0],
        natteKoeb: 0, annullerede: 0, koeb: 0, stoersteKoeb: 0,
        foerste: null, sidste: null,
        loeb: 0, sejre: 0, ordninger: 0, heste: {}
      };
    }
    return pr[id];
  }

  readObjects_(SHEET_KOEB).forEach(function (k) {
    var t = k.Tidspunkt;
    if (!(t instanceof Date)) return;
    if (Utilities.formatDate(t, tz, 'yyyy') !== aar) return;

    var pid = String(k.PersonID);
    var p = person(pid, String(k.PersonNavn || ''));

    if (sandt_(k.Annulleret)) { p.annullerede++; annullerede++; return; }

    var antal = Number(k.Antal) || 0;
    var lTotal = Number(k.Total) || 0;
    var pa = Number(k.PantAntal) || 0;
    var pb = Number(k['PantBeløb']) || 0;
    var varenavn = String(k.ProduktNavn);
    var dato = Utilities.formatDate(t, tz, 'yyyy-MM-dd');
    var maaned = Utilities.formatDate(t, tz, 'yyyy-MM');
    var time = Number(Utilities.formatDate(t, tz, 'H'));
    var ugedag = Number(Utilities.formatDate(t, tz, 'u')) % 7;   // 1=man .. 7=søn -> 0=søn

    p.total += lTotal; p.antal += antal;
    p.pantAntal += pa; p.pantTotal += pa * pb;
    p.varer[varenavn] = (p.varer[varenavn] || 0) + antal;
    p.dage[dato] = (p.dage[dato] || 0) + lTotal;
    p.timer[time] += antal;
    p.ugedage[ugedag] += antal;
    if (time >= 0 && time < 5) p.natteKoeb += antal;
    if (!p.foerste || t < p.foerste) p.foerste = t;
    if (!p.sidste || t > p.sidste) p.sidste = t;

    varer[varenavn] = varer[varenavn] || { navn: varenavn, antal: 0, total: 0 };
    varer[varenavn].antal += antal;
    varer[varenavn].total += lTotal - pa * pb;

    maaneder[maaned] = (maaneder[maaned] || 0) + lTotal;
    datoer[dato] = (datoer[dato] || 0) + lTotal;
    ugedage[ugedag] += antal;
    timer[time] += antal;

    // Én "handel" = én kurv. Ref binder linjerne sammen.
    var ref = String(k.Ref || '') || ('_' + String(k['KøbID']));
    if (!kurve[ref]) kurve[ref] = { person: pid, total: 0 };
    kurve[ref].total += lTotal;

    total += lTotal; antalVarer += antal; pantIAlt += pa * pb;
  });

  Object.keys(kurve).forEach(function (ref) {
    var kv = kurve[ref];
    var p = pr[kv.person];
    if (!p) return;
    p.koeb++;
    if (kv.total > p.stoersteKoeb) p.stoersteKoeb = kv.total;
  });

  // Spilresultater
  var loebIAlt = 0, ordningerIAlt = 0;
  readObjects_(SHEET_SPIL).forEach(function (r) {
    var t = r.Tidspunkt;
    if (!(t instanceof Date)) return;
    if (Utilities.formatDate(t, tz, 'yyyy') !== aar) return;
    var pid = String(r.PersonID);
    var p = person(pid, String(r.PersonNavn || ''));
    p.loeb++;
    loebIAlt++;
    if (String(r.Resultat) === 'Slap') p.sejre++;
    else { p.ordninger++; ordningerIAlt++; }
    var h = String(r['Valgt hest'] || '');
    if (h) p.heste[h] = (p.heste[h] || 0) + 1;
  });

  // Efterbehandling pr. person
  var liste = Object.keys(pr).map(function (id) {
    var p = pr[id];
    p.total = Math.round(p.total * 100) / 100;
    p.pantTotal = Math.round(p.pantTotal * 100) / 100;
    p.stoersteKoeb = Math.round(p.stoersteKoeb * 100) / 100;

    var favorit = null;
    Object.keys(p.varer).forEach(function (v) {
      if (!favorit || p.varer[v] > p.varer[favorit]) favorit = v;
    });
    p.favoritvare = favorit ? { navn: favorit, antal: p.varer[favorit] } : null;

    var dage = Object.keys(p.dage).sort();
    p.antalDage = dage.length;
    p.travlesteDag = null;
    dage.forEach(function (d) {
      if (!p.travlesteDag || p.dage[d] > p.dage[p.travlesteDag]) p.travlesteDag = d;
    });
    p.travlesteDagBeloeb = p.travlesteDag ? Math.round(p.dage[p.travlesteDag] * 100) / 100 : 0;

    // Længste stime af dage i træk
    var stime = 0, bedst = 0, forrige = null;
    dage.forEach(function (d) {
      if (forrige && (new Date(d) - new Date(forrige)) === 86400000) stime++;
      else stime = 1;
      if (stime > bedst) bedst = stime;
      forrige = d;
    });
    p.laengsteStime = bedst;

    var tTop = 0;
    for (var h = 1; h < 24; h++) if (p.timer[h] > p.timer[tTop]) tTop = h;
    p.yndlingstime = p.antal ? tTop : null;
    var uTop = 0;
    for (var u = 1; u < 7; u++) if (p.ugedage[u] > p.ugedage[uTop]) uTop = u;
    p.yndlingsdag = p.antal ? dagNavn_(uTop) : null;

    var hTop = null;
    Object.keys(p.heste).forEach(function (h2) {
      if (!hTop || p.heste[h2] > p.heste[hTop]) hTop = h2;
    });
    p.yndlingshest = hTop;

    p.foerste = p.foerste ? Utilities.formatDate(p.foerste, tz, 'd. MMMM') : null;
    p.sidste = p.sidste ? Utilities.formatDate(p.sidste, tz, 'd. MMMM') : null;
    p.andel = total ? Math.round(p.total / total * 1000) / 10 : 0;
    delete p.varer; delete p.dage; delete p.heste;
    return p;
  }).sort(function (a, b) { return b.total - a.total; });

  var topDato = null;
  Object.keys(datoer).forEach(function (d) {
    if (!topDato || datoer[d] > datoer[topDato]) topDato = d;
  });
  var uTop = 0; for (var u = 1; u < 7; u++) if (ugedage[u] > ugedage[uTop]) uTop = u;
  var tTop = 0; for (var h = 1; h < 24; h++) if (timer[h] > timer[tTop]) tTop = h;

  return {
    aar: aar,
    valuta: hentIndstilling_('Valuta') || 'kr',
    total: Math.round(total * 100) / 100,
    antalVarer: antalVarer,
    antalKoeb: Object.keys(kurve).length,
    pantTotal: Math.round(pantIAlt * 100) / 100,
    annullerede: annullerede,
    personer: liste,
    varer: Object.keys(varer).map(function (v) { return varer[v]; })
      .sort(function (a, b) { return b.antal - a.antal; }),
    maaneder: Object.keys(maaneder).sort().map(function (m) {
      return { maaned: m, total: Math.round(maaneder[m] * 100) / 100 };
    }),
    travlesteDato: topDato ? { dato: topDato, total: Math.round(datoer[topDato] * 100) / 100 } : null,
    travlesteUgedag: dagNavn_(uTop),
    travlesteTime: tTop,
    loeb: loebIAlt,
    ordninger: ordningerIAlt
  };
}

/** Skriver årets tal ind som en fane, så de kan bruges videre i regnearket. */
function eksporterAarTilFane(pin, aar) {
  kraevAdmin_(pin);
  var st = hentAarsstatistik(aar);
  var ss = getSs_();
  var navn = 'År ' + aar;
  var sh = ss.getSheetByName(navn);
  if (sh) sh.clear(); else sh = ss.insertSheet(navn);

  var r = [];
  r.push(['Årsstatistik', aar, '', '', '', '', '', '', '', '', '', '']);
  r.push(['Genereret', Utilities.formatDate(new Date(), tz_(), 'dd-MM-yyyy HH:mm'),
          '', '', '', '', '', '', '', '', '', '']);
  r.push(['Omsat i alt', st.total, 'Varer', st.antalVarer, 'Handler', st.antalKoeb,
          'Pant', st.pantTotal, 'Løb', st.loeb, 'Ordninger', st.ordninger]);
  r.push(new Array(12).fill(''));
  r.push(['Person', 'Gruppe', 'Brugt', 'Andel %', 'Varer', 'Handler', 'Største handel',
          'Dage', 'Længste stime', 'Nattekøb', 'Pant (stk.)', 'Ordninger']);
  st.personer.forEach(function (p) {
    r.push([p.navn, p.gruppe, p.total, p.andel, p.antal, p.koeb, p.stoersteKoeb,
            p.antalDage, p.laengsteStime, p.natteKoeb, p.pantAntal, p.ordninger]);
  });
  r.push(new Array(12).fill(''));
  r.push(['SOLGT PR. VARE', '', '', '', '', '', '', '', '', '', '', '']);
  r.push(['Vare', 'Antal', 'Beløb', '', '', '', '', '', '', '', '', '']);
  st.varer.forEach(function (v) {
    r.push([v.navn, v.antal, v.total, '', '', '', '', '', '', '', '', '']);
  });

  sh.getRange(1, 1, r.length, 12).setValues(r);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setFontSize(14);
  sh.getRange(5, 1, 1, 12).setFontWeight('bold');
  sh.setColumnWidth(1, 190);
  sh.autoResizeColumns(2, 11);
  ss.setActiveSheet(sh);
  return { navn: navn, url: ss.getUrl() + '#gid=' + sh.getSheetId() };
}

/* ------------------------------------------------------------------ */
/* Rapport                                                             */
/* ------------------------------------------------------------------ */

function hentMaaneder() {
  var koeb = readObjects_(SHEET_KOEB);
  var saet = {};
  koeb.forEach(function (k) {
    var m = String(k['Måned'] || '');
    if (!m && k.Tidspunkt instanceof Date) m = maanedAf_(k.Tidspunkt);
    if (m) saet[m] = true;
  });
  saet[maanedAf_(new Date())] = true;
  return Object.keys(saet).sort().reverse();
}

/** Detaljeret månedsopgørelse. Annullerede køb tælles ikke med. */
function hentRapport(maaned) {
  var koeb = readObjects_(SHEET_KOEB);
  var personer = hentPersoner_();
  var personMap = {};
  personer.forEach(function (p) { personMap[p.id] = p; });

  var perPerson = {};
  var perProdukt = {};
  var total = 0;
  var antalVarer = 0;

  koeb.forEach(function (k) {
    if (sandt_(k.Annulleret)) return;
    var m = String(k['Måned'] || '');
    if (!m && k.Tidspunkt instanceof Date) m = maanedAf_(k.Tidspunkt);
    if (m !== maaned) return;

    var pid = String(k.PersonID);
    if (!perPerson[pid]) {
      var pp = personMap[pid];
      perPerson[pid] = {
        id: pid,
        navn: String(k.PersonNavn || (pp ? pp.navn : pid)),
        gruppe: pp ? pp.gruppe : '',
        farve: pp ? pp.farve : '#64748b',
        total: 0, antal: 0, pantAntal: 0, pantTotal: 0, linjer: {}, koeb: []
      };
    }
    var p = perPerson[pid];
    var antal = Number(k.Antal) || 0;
    var lTotal = Number(k.Total) || 0;
    var pantAntal = Number(k.PantAntal) || 0;
    var pantBeloeb = Number(k['PantBeløb']) || 0;
    p.total += lTotal;
    p.antal += antal;
    p.pantAntal += pantAntal;
    p.pantTotal += pantAntal * pantBeloeb;

    var tilstandNavn = String(k.Tilstand || '');
    var noegle = String(k.ProduktNavn) + '|' + (Number(k.StykPris) || 0) + '|' + tilstandNavn;
    if (!p.linjer[noegle]) {
      p.linjer[noegle] = { produkt: String(k.ProduktNavn), stykPris: Number(k.StykPris) || 0,
                           tilstand: tilstandNavn, antal: 0, total: 0 };
    }
    p.linjer[noegle].antal += antal;
    p.linjer[noegle].total += lTotal - pantAntal * pantBeloeb;

    if (pantAntal > 0) {
      var pantNoegle = 'Pant|' + pantBeloeb;
      if (!p.linjer[pantNoegle]) {
        p.linjer[pantNoegle] = { produkt: 'Pant', stykPris: pantBeloeb, tilstand: '',
                                 erPant: true, antal: 0, total: 0 };
      }
      p.linjer[pantNoegle].antal += pantAntal;
      p.linjer[pantNoegle].total += pantAntal * pantBeloeb;
      if (!perProdukt['Pant']) perProdukt['Pant'] = { navn: 'Pant', antal: 0, total: 0 };
      perProdukt['Pant'].antal += pantAntal;
      perProdukt['Pant'].total += pantAntal * pantBeloeb;
    }

    p.koeb.push({
      id: String(k['KøbID']),
      tid: k.Tidspunkt instanceof Date
        ? Utilities.formatDate(k.Tidspunkt, tz_(), 'dd-MM HH:mm') : String(k.Tidspunkt),
      produkt: String(k.ProduktNavn),
      antal: antal,
      stykPris: Number(k.StykPris) || 0,
      tilstand: tilstandNavn,
      pantAntal: pantAntal,
      total: lTotal
    });

    var pn = String(k.ProduktNavn);
    if (!perProdukt[pn]) perProdukt[pn] = { navn: pn, antal: 0, total: 0 };
    perProdukt[pn].antal += antal;
    perProdukt[pn].total += lTotal - pantAntal * pantBeloeb;

    total += lTotal;
    antalVarer += antal;
  });

  var liste = Object.keys(perPerson).map(function (id) {
    var p = perPerson[id];
    p.linjer = Object.keys(p.linjer).map(function (n) { return p.linjer[n]; })
      .sort(function (a, b) { return b.total - a.total; });
    p.koeb.reverse();
    p.total = Math.round(p.total * 100) / 100;
    p.pantTotal = Math.round(p.pantTotal * 100) / 100;
    return p;
  }).sort(function (a, b) { return b.total - a.total; });

  var pantIAlt = 0;
  liste.forEach(function (p) { pantIAlt += p.pantTotal; });

  return {
    maaned: maaned,
    total: Math.round(total * 100) / 100,
    antalVarer: antalVarer,
    pantTotal: Math.round(pantIAlt * 100) / 100,
    personer: liste,
    produkter: Object.keys(perProdukt).map(function (n) { return perProdukt[n]; })
      .sort(function (a, b) { return b.total - a.total; }),
    afregnet: erAfregnet_(maaned),
    valuta: hentIndstilling_('Valuta') || 'kr'
  };
}

function erAfregnet_(maaned) {
  var raekker = readObjects_(SHEET_AFREGNING);
  for (var i = 0; i < raekker.length; i++) {
    if (String(raekker[i]['Måned']) === maaned) return sandt_(raekker[i].Afregnet);
  }
  return false;
}

function saetAfregnet(pin, maaned, afregnet) {
  kraevAdmin_(pin);
  var sh = getSheet_(SHEET_AFREGNING);
  var raekker = readObjects_(SHEET_AFREGNING);
  for (var i = 0; i < raekker.length; i++) {
    if (String(raekker[i]['Måned']) === maaned) {
      sh.getRange(raekker[i]._row, 1, 1, 4).setValues([[maaned, !!afregnet, new Date(), bruger_()]]);
      return !!afregnet;
    }
  }
  sh.appendRow([maaned, !!afregnet, new Date(), bruger_()]);
  return !!afregnet;
}

function hentCsv(maaned) {
  var r = hentRapport(maaned);
  var linjer = [['Måned', 'Person', 'Gruppe', 'Produkt', 'Tilstand', 'Antal',
                 'Stykpris', 'Beløb'].join(';')];
  r.personer.forEach(function (p) {
    p.linjer.forEach(function (l) {
      linjer.push([maaned, p.navn, p.gruppe, l.produkt, l.tilstand || '', l.antal,
                   kr_(l.stykPris), kr_(l.total)].join(';'));
    });
  });
  linjer.push('');
  linjer.push(['', 'I ALT', '', '', '', r.antalVarer, '', kr_(r.total)].join(';'));
  return linjer.join('\n');
}

function kr_(n) { return String((Math.round(n * 100) / 100).toFixed(2)).replace('.', ','); }

/** Skriver månedsopgørelsen ind som en fane i regnearket. */
function eksporterTilFane(pin, maaned) {
  kraevAdmin_(pin);
  var r = hentRapport(maaned);
  var lager = hentLagerstatus();
  var ss = getSs_();
  var navn = 'Opgørelse ' + maaned;
  var sh = ss.getSheetByName(navn);
  if (sh) sh.clear(); else sh = ss.insertSheet(navn);

  var raekker = [];
  raekker.push(['Månedsopgørelse', maaned, '', '', '']);
  raekker.push(['Genereret', Utilities.formatDate(new Date(), tz_(), 'dd-MM-yyyy HH:mm'), '', '', '']);
  raekker.push(['', '', '', '', '']);
  raekker.push(['SAMLET PR. PERSON', '', '', '', '']);
  var hovedStart = raekker.length + 1;
  raekker.push(['Person', 'Gruppe', 'Antal varer', 'Beløb', '']);
  r.personer.forEach(function (p) { raekker.push([p.navn, p.gruppe, p.antal, p.total, '']); });
  var iAltRaekke = raekker.length + 1;
  raekker.push(['I ALT', '', r.antalVarer, r.total, '']);
  raekker.push(['', '', '', '', '']);
  raekker.push(['DETALJER PR. PERSON', '', '', '', '']);
  raekker.push(['Person', 'Produkt / tilstand', 'Antal', 'Stykpris', 'Beløb']);
  r.personer.forEach(function (p) {
    p.linjer.forEach(function (l) {
      raekker.push([p.navn, l.produkt + (l.tilstand ? ' (' + l.tilstand + ')' : ''),
                    l.antal, l.stykPris, l.total]);
    });
  });
  raekker.push(['', '', '', '', '']);
  raekker.push(['LAGER VED OPGØRELSEN', '', '', '', '']);
  raekker.push(['Produkt', 'På lager', 'Min.', 'Salgsværdi', '']);
  lager.produkter.forEach(function (p) {
    raekker.push([p.navn, p.lager, p.minLager, Math.max(p.lager, 0) * p.pris, '']);
  });
  raekker.push(['Lagerværdi i alt', '', '', lager.vaerdiSalg, '']);

  sh.getRange(1, 1, raekker.length, 5).setValues(raekker);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setFontSize(14);
  sh.getRange(4, 1).setFontWeight('bold');
  sh.getRange(hovedStart, 1, 1, 4).setFontWeight('bold');
  sh.getRange(iAltRaekke, 1, 1, 4).setFontWeight('bold');
  // Kolonne 3 er altid antal, kolonne 4 og 5 altid beløb – i alle tre afsnit
  sh.getRange(1, 3, raekker.length, 1).setNumberFormat('#,##0');
  sh.getRange(1, 4, raekker.length, 2).setNumberFormat('#,##0.00');
  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(2, 220);
  sh.autoResizeColumns(3, 3);
  ss.setActiveSheet(sh);
  return { navn: navn, url: ss.getUrl() + '#gid=' + sh.getSheetId() };
}
