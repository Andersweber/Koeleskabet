/* Lokal mock af Google Apps Script-backenden – kun til test i browser. */
(function () {
  var BEBOERE = ['Anders Christensen','Bertil Holm','Camilla Vestergaard','Daniel Iversen',
    'Emma Sørensen','Frederik Dahl','Gustav Lind','Hanne Kjær','Ida Lundqvist',
    'Jonas Bak','Karoline Ravn','Lasse Thomsen','Mikkel Brandt','Nadia El-Amin'];
  var EXERE = ['Oliver Storm','Pernille Hvid','Rasmus Krogh','Sofie Ørsted',
    'Tobias Ærø','Ulrik Åberg'];
  var FARVER = ['#7c3aed','#9333ea','#a21caf','#c026d3','#db2777',
                '#e11d48','#f43f5e','#ea580c','#c2410c','#b45309'];
  // Alt i køleskabet er drikkevarer. [navn, pris, ikon, kategori, lager, pant]
  var VARER = [
    ['Øl',8,'🍺','Øl',24,true],            ['Classic',9,'🍻','Øl',12,true],
    ['Tuborg',9,'🍺','Øl',18,true],        ['IPA',14,'🍺','Øl',6,true],
    ['Stout',15,'🍺','Øl',3,true],
    ['Sodavand',6,'🥤','Sodavand',18,true],['Cola Zero',6,'🥤','Sodavand',2,true],
    ['Fanta',6,'🍊','Sodavand',9,true],    ['Squash',6,'🥤','Sodavand',11,true],
    ['Cider',10,'🍏','Cider',7,true],      ['Rosé cider',12,'🍑','Cider',4,true],
    ['Energidrik',12,'⚡','Energi',5,true],['Booster',10,'⚡','Energi',0,true],
    ['Vand',4,'💧','Vand',30,true],        ['Danskvand',5,'🫧','Vand',14,true],
    ['Rødvin',35,'🍷','Vin',3,true],       ['Bobler',45,'🥂','Vin',0,true],
    ['Kaffe',5,'☕','Varme drikke',40,false],
    ['Te',3,'🧋','Varme drikke',25,false],
    ['Shot',15,'🥃','Spiritus',8,false]
  ];

  var alleNavne = BEBOERE.map(function (n) { return [n, 'Beboere']; })
    .concat(EXERE.map(function (n) { return [n, "Ex'ere"]; }));

  var db = {
    personer: alleNavne.map(function (x, i) {
      return { id:'P'+(i+1), navn:x[0], gruppe:x[1], farve:FARVER[i%FARVER.length], aktiv:true };
    }),
    produkter: VARER.map(function (v, i) {
      return { id:'V'+(i+1), navn:v[0], pris:v[1], kostpris:Math.round(v[1]*0.6),
               emoji:v[2], kategori:v[3], lager:v[4], minLager:4, pant:v[5],
               status:v[4]<=0?'udsolgt':(v[4]<=4?'lav':'ok'), aktiv:true };
    }),
    billeder: {},
    tilstande: [
      { id:'T1', navn:'Festival', emoji:'🎉', farve:'#8b3fd6', gaelderFor:'ALLE',
        type:'procent', vaerdi:50, aktiv:false, slutter:0 },
      { id:'T2', navn:'Happy hour', emoji:'🍻', farve:'#ff8a3d', gaelderFor:'Øl',
        type:'procent', vaerdi:-25, aktiv:false, slutter:0 }
    ],
    koeb: [], lagerlog: [], afregnet: {}, spil: [],
    indst: { valuta:'kr', titel:'Køleskabet', fortrydSekunder:8, inaktivSekunder:60,
             tilladSalgUdenLager:true, standardMinLager:3, pantBeloeb:1,
             knapStoerrelse:100,
             standardGruppe:'Beboere', gaesteGruppe:'Gæster', tilladGaester:true,
             grupper:['Beboere',"Ex'ere",'Gæster'] },
    spilOpsaet: { hest: { aktiv:true, chance:100, gaelderFor:'Øl', antalHeste:4 } },
    pin: '1234',
    naesteKoeb: 1
  };

  (function () {
    var maaned = new Date().toISOString().substring(0,7);
    for (var i = 0; i < 260; i++) {
      var p = db.personer[Math.floor(Math.random()*db.personer.length)];
      var v = db.produkter[Math.floor(Math.random()*db.produkter.length)];
      var antal = Math.random() < 0.8 ? 1 : 2;
      var pa = (v.pant && Math.random() < 0.22) ? antal : 0;
      db.koeb.push({ id:'K'+(db.naesteKoeb++), maaned:maaned, personId:p.id, personNavn:p.navn,
        produktId:v.id, produktNavn:v.navn, antal:antal, stykPris:v.pris,
        pantAntal:pa, pantBeloeb:1,
        total:v.pris*antal + pa, annulleret:false,
        tid: String(1+Math.floor(Math.random()*28)).padStart(2,'0')+'-'+maaned.substring(5)+
             ' '+String(Math.floor(Math.random()*24)).padStart(2,'0')+':'+
             String(Math.floor(Math.random()*60)).padStart(2,'0') });
    }
  })();

  function opdaterStatus() {
    db.produkter.forEach(function (p) {
      p.status = p.lager <= 0 ? 'udsolgt' : (p.lager <= p.minLager ? 'lav' : 'ok');
    });
    return JSON.parse(JSON.stringify(db.produkter));
  }
  function findP(id) {
    for (var i=0;i<db.produkter.length;i++) if (db.produkter[i].id===id) return db.produkter[i];
    return null;
  }
  function tjek(pin) { if (String(pin)!==db.pin) throw new Error('Forkert PIN-kode.'); }

  function aktivTilstand() {
    var nu = Date.now();
    for (var i=0;i<db.tilstande.length;i++){
      var t = db.tilstande[i];
      if (!t.aktiv) continue;
      if (t.slutter && t.slutter <= nu) { t.aktiv=false; t.slutter=0; continue; }
      return JSON.parse(JSON.stringify(t));
    }
    return null;
  }
  function daekker(t,p){
    var g = String(t.gaelderFor||'').trim();
    if (g.toUpperCase()==='INGEN') return false;
    if (!g || g.toUpperCase()==='ALLE') return true;
    var dele = g.split(',').map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
    return dele.indexOf(String(p.kategori||'').toLowerCase())!==-1 ||
           dele.indexOf(String(p.id||'').toLowerCase())!==-1 ||
           dele.indexOf(String(p.navn||'').toLowerCase())!==-1;
  }
  function prisMed(p,t){
    var pris = Number(p.pris)||0;
    if (!t || !daekker(t,p)) return Math.round(pris*100)/100;
    var v = Number(t.vaerdi)||0;
    if (t.type==='fastpris') pris = v;
    else if (t.type==='tillaeg') pris = pris + v;
    else pris = pris * (1 + v/100);
    return Math.max(0, Math.round(pris*100)/100);
  }
  function log(p, type, aendring, foer, efter, note) {
    db.lagerlog.push({ id:'L'+(db.lagerlog.length+1),
      tid: new Date().toLocaleString('da-DK',{day:'2-digit',month:'2-digit',
        hour:'2-digit',minute:'2-digit'}),
      produkt:p.navn, type:type, aendring:aendring, efter:efter, note:note||'' });
  }

  var api = {
    hentStartdata: function () {
      return { personer: JSON.parse(JSON.stringify(db.personer)),
               produkter: opdaterStatus(), tilstand: aktivTilstand(),
               spil: JSON.parse(JSON.stringify(db.spilOpsaet)),
               indstillinger: db.indst, serverTid: new Date().toISOString() };
    },
    hentProdukter: function () {
      return { produkter: opdaterStatus(), tilstand: aktivTilstand(),
               spil: JSON.parse(JSON.stringify(db.spilOpsaet)) };
    },
    hentSpil: function () { return JSON.parse(JSON.stringify(db.indst.spilOpsaet || db.spilOpsaet)); },
    hentTilstande: function () { return JSON.parse(JSON.stringify(db.tilstande)); },
    gemTilstand: function (pin, t) {
      tjek(pin);
      var id = t.id;
      var data = { navn:t.navn, emoji:t.emoji, farve:t.farve, gaelderFor:t.gaelderFor,
                   type:t.type, vaerdi:Number(t.vaerdi)||0 };
      if (id) {
        db.tilstande.forEach(function(x){ if(x.id===id){
          x.navn=data.navn; x.emoji=data.emoji; x.farve=data.farve;
          x.gaelderFor=data.gaelderFor; x.type=data.type; x.vaerdi=data.vaerdi; } });
      } else {
        id = 'T'+(db.tilstande.length+1);
        data.id=id; data.aktiv=false; data.slutter=0;
        db.tilstande.push(data);
      }
      return { id:id, tilstande: JSON.parse(JSON.stringify(db.tilstande)), aktiv: aktivTilstand() };
    },
    sletTilstand: function (pin, id) {
      tjek(pin);
      db.tilstande = db.tilstande.filter(function(x){ return x.id!==id; });
      return { tilstande: JSON.parse(JSON.stringify(db.tilstande)), aktiv: aktivTilstand() };
    },
    aktiverTilstand: function (pin, id, timer) {
      tjek(pin);
      db.tilstande.forEach(function(x){ x.aktiv=false; x.slutter=0; });
      db.tilstande.forEach(function(x){
        if (x.id===id){ x.aktiv=true; x.slutter = timer>0 ? Date.now()+timer*3600*1000 : 0; }
      });
      return { tilstande: JSON.parse(JSON.stringify(db.tilstande)), aktiv: aktivTilstand() };
    },
    deaktiverTilstande: function (pin) {
      tjek(pin);
      db.tilstande.forEach(function(x){ x.aktiv=false; x.slutter=0; });
      return { tilstande: JSON.parse(JSON.stringify(db.tilstande)), aktiv: null };
    },
    hentBilleder: function () { return JSON.parse(JSON.stringify(db.billeder)); },
    hentBilledStempel: function () {
      return Object.keys(db.billeder).length + '|' + (db.billedTid || 0);
    },
    gemBillede: function (pin, id, d) {
      tjek(pin);
      if (String(d).indexOf('data:image/') !== 0) throw new Error('Ugyldigt billedformat.');
      if (String(d).length > 45000) throw new Error('Billedet fylder for meget.');
      db.billeder[id] = d; db.billedTid = Date.now(); return true;
    },
    sletBillede: function (pin, id) { tjek(pin); delete db.billeder[id]; return true; },
    tjekPin: function (pin) { return String(pin) === db.pin; },
    registrerKoeb: function (personId, linjer) {
      var person = db.personer.filter(function(p){return p.id===personId;})[0];
      var ids = [], total = 0, advarsler = [];
      var maaned = new Date().toISOString().substring(0,7);
      var t = aktivTilstand();
      var pantBeloeb = db.indst.pantBeloeb || 0;
      linjer.forEach(function (l) {
        var p = findP(l.produktId);
        var pris = prisMed(p, t);
        var pantAntal = (p.pant && pantBeloeb > 0)
          ? Math.max(0, Math.min(l.antal, Math.round(Number(l.pant)||0))) : 0;
        var linjeTotal = pris*l.antal + pantAntal*pantBeloeb;
        var id = 'K'+(db.naesteKoeb++);
        ids.push(id); total += linjeTotal; p.lager -= l.antal;
        if (p.lager < 0) advarsler.push(p.navn+' står nu til '+p.lager+' – tæl efter.');
        db.koeb.push({ id:id, maaned:maaned, personId:person.id, personNavn:person.navn,
          produktId:p.id, produktNavn:p.navn, antal:l.antal, stykPris:pris,
          pantAntal:pantAntal, pantBeloeb:pantBeloeb,
          total:linjeTotal, annulleret:false, tilstand: t ? t.navn : '',
          tid:new Date().toLocaleString('da-DK',{day:'2-digit',month:'2-digit',
            hour:'2-digit',minute:'2-digit'}) });
      });
      return { ok:true, koebIds:ids, total:total, person:person.navn,
               advarsler:advarsler, tilstand:t, produkter:opdaterStatus() };
    },
    fortrydKoeb: function (ids) {
      var n = 0;
      db.koeb.forEach(function (k) {
        if (ids.indexOf(k.id) !== -1 && !k.annulleret) {
          k.annulleret = true; n++;
          var p = findP(k.produktId); if (p) p.lager += k.antal;
        }
      });
      return { ok:true, antal:n, tilstand:aktivTilstand(), produkter:opdaterStatus() };
    },
    gemProdukt: function (pin, d) {
      tjek(pin);
      var id = d.id;
      if (id) {
        var p = findP(id);
        p.navn=d.navn; p.pris=parseFloat(String(d.pris).replace(',','.'))||0;
        p.kostpris=parseFloat(String(d.kostpris).replace(',','.'))||0;
        p.kategori=d.kategori; p.minLager=parseInt(d.minLager,10)||0;
        p.emoji=d.emoji; p.pant=d.pant!==false; p.aktiv=d.aktiv!==false;
      } else {
        id = 'V'+(db.produkter.length+1);
        db.produkter.push({ id:id, navn:d.navn,
          pris:parseFloat(String(d.pris).replace(',','.'))||0,
          kostpris:parseFloat(String(d.kostpris).replace(',','.'))||0,
          emoji:d.emoji, kategori:d.kategori, lager:parseInt(d.lager,10)||0,
          minLager:parseInt(d.minLager,10)||0, pant:d.pant!==false,
          aktiv:d.aktiv!==false });
      }
      return { id:id, produkter:opdaterStatus() };
    },
    hentProduktBrug: function (pin, id) {
      tjek(pin);
      var p = findP(id);
      if (!p) throw new Error('Produktet findes ikke.');
      var linjer=0, solgt=0, md={};
      db.koeb.forEach(function(k){
        if (k.produktId!==id || k.annulleret) return;
        linjer++; solgt+=k.antal; md[k.maaned]=true;
      });
      var iT=[];
      db.tilstande.forEach(function(t){
        var g=String(t.gaelderFor||''); if(g.toUpperCase()==='ALLE') return;
        var d2=g.split(',').map(function(x){return x.trim().toLowerCase();});
        if(d2.indexOf(p.navn.toLowerCase())!==-1) iT.push(t.navn);
      });
      var sg=String(db.spilOpsaet.hest.gaelderFor||'');
      var iSpil = sg.split(',').map(function(x){return x.trim().toLowerCase();})
        .indexOf(p.navn.toLowerCase())!==-1;
      return { navn:p.navn, lager:p.lager, koebLinjer:linjer, solgt:solgt,
               maaneder:Object.keys(md).length, tilstande:iT, iSpil:iSpil };
    },

    sletProdukt: function (pin, id) {
      tjek(pin);
      var p = findP(id);
      if (!p) throw new Error('Produktet findes ikke længere.');
      var navn = p.navn;
      db.produkter = db.produkter.filter(function(x){ return x.id !== id; });
      delete db.billeder[id];
      function fjern(liste){
        return String(liste||'').split(',').map(function(x){return x.trim();})
          .filter(function(x){ return x && x.toLowerCase()!==navn.toLowerCase(); }).join(', ');
      }
      db.tilstande.forEach(function(t){
        if (String(t.gaelderFor||'').toUpperCase()==='ALLE') return;
        t.gaelderFor = fjern(t.gaelderFor) || 'INGEN';
      });
      if (String(db.spilOpsaet.hest.gaelderFor||'').toUpperCase()!=='ALLE') {
        db.spilOpsaet.hest.gaelderFor = fjern(db.spilOpsaet.hest.gaelderFor) || 'INGEN';
      }
      return { ok:true, navn:navn, produkter:opdaterStatus(),
               tilstande:JSON.parse(JSON.stringify(db.tilstande)) };
    },

    gemPerson: function (pin, d) {
      tjek(pin);
      var id = d.id;
      if (id) {
        db.personer.forEach(function (p) {
          if (p.id===id) { p.navn=d.navn; p.gruppe=d.gruppe; p.farve=d.farve;
                           p.aktiv=d.aktiv!==false; }
        });
      } else {
        id = 'P'+(db.personer.length+1);
        db.personer.push({ id:id, navn:d.navn, gruppe:d.gruppe||'Beboere',
                           farve:d.farve, aktiv:d.aktiv!==false });
      }
      return { id:id, personer: JSON.parse(JSON.stringify(db.personer)) };
    },
    justerLager: function (pin, id, delta, note) {
      tjek(pin); var p=findP(id); var f=p.lager; p.lager+=delta;
      log(p,'Justering',delta,f,p.lager,note); return opdaterStatus();
    },
    paafyldLager: function (pin, id, antal, note) {
      tjek(pin); var p=findP(id); var f=p.lager; p.lager+=antal;
      log(p,'Påfyld',antal,f,p.lager,note); return opdaterStatus();
    },
    optaelLager: function (pin, id, antal, note) {
      tjek(pin); var p=findP(id); var f=p.lager; p.lager=antal;
      log(p,'Optælling',antal-f,f,p.lager,note); return opdaterStatus();
    },
    bulkPaafyld: function (pin, linjer, note) {
      tjek(pin);
      linjer.forEach(function (l) { var p=findP(l.produktId); var f=p.lager;
        p.lager+=l.antal; log(p,'Påfyld',l.antal,f,p.lager,note||'Indkøb'); });
      return opdaterStatus();
    },
    hentLagerlog: function (n) { return db.lagerlog.slice(-(n||50)).reverse(); },
    hentMaaneder: function () {
      var s={}; db.koeb.forEach(function(k){s[k.maaned]=true;});
      s[new Date().toISOString().substring(0,7)]=true;
      return Object.keys(s).sort().reverse();
    },
    hentRapport: function (maaned) {
      var perPerson={}, perProdukt={}, total=0, antalVarer=0;
      db.koeb.forEach(function (k) {
        if (k.annulleret || k.maaned!==maaned) return;
        var pp = db.personer.filter(function(x){return x.id===k.personId;})[0]||{};
        if (!perPerson[k.personId]) perPerson[k.personId]={id:k.personId,navn:k.personNavn,
          gruppe:pp.gruppe||'',farve:pp.farve||'#64748b',total:0,antal:0,
          pantAntal:0,pantTotal:0,linjer:{},koeb:[]};
        var p=perPerson[k.personId];
        var pa = k.pantAntal||0, pb = k.pantBeloeb||0;
        p.total+=k.total; p.antal+=k.antal; p.pantAntal+=pa; p.pantTotal+=pa*pb;
        var n=k.produktNavn+'|'+k.stykPris+'|'+(k.tilstand||'');
        if(!p.linjer[n]) p.linjer[n]={produkt:k.produktNavn,stykPris:k.stykPris,
                                      tilstand:k.tilstand||'',antal:0,total:0};
        p.linjer[n].antal+=k.antal; p.linjer[n].total+=k.total-pa*pb;
        if (pa>0) {
          var pn2='Pant|'+pb;
          if(!p.linjer[pn2]) p.linjer[pn2]={produkt:'Pant',stykPris:pb,tilstand:'',
                                            erPant:true,antal:0,total:0};
          p.linjer[pn2].antal+=pa; p.linjer[pn2].total+=pa*pb;
          if(!perProdukt['Pant']) perProdukt['Pant']={navn:'Pant',antal:0,total:0};
          perProdukt['Pant'].antal+=pa; perProdukt['Pant'].total+=pa*pb;
        }
        p.koeb.push({id:k.id,tid:k.tid,produkt:k.produktNavn,antal:k.antal,
                     stykPris:k.stykPris,tilstand:k.tilstand||'',total:k.total});
        if(!perProdukt[k.produktNavn]) perProdukt[k.produktNavn]={navn:k.produktNavn,antal:0,total:0};
        perProdukt[k.produktNavn].antal+=k.antal;
        perProdukt[k.produktNavn].total+=k.total-pa*pb;
        total+=k.total; antalVarer+=k.antal;
      });
      var liste=Object.keys(perPerson).map(function(id){
        var p=perPerson[id];
        p.linjer=Object.keys(p.linjer).map(function(n){return p.linjer[n];})
          .sort(function(a,b){return b.total-a.total;});
        return p;
      }).sort(function(a,b){return b.total-a.total;});
      var pantIAlt=0; liste.forEach(function(p){ pantIAlt+=p.pantTotal; });
      return { maaned:maaned, total:total, antalVarer:antalVarer, pantTotal:pantIAlt,
               personer:liste,
        produkter:Object.keys(perProdukt).map(function(n){return perProdukt[n];})
          .sort(function(a,b){return b.total-a.total;}),
        afregnet:!!db.afregnet[maaned], valuta:db.indst.valuta };
    },
    hentCsv: function (m) {
      var r=api.hentRapport(m);
      var l=['Måned;Person;Gruppe;Produkt;Tilstand;Antal;Stykpris;Beløb'];
      r.personer.forEach(function(p){p.linjer.forEach(function(x){
        l.push([m,p.navn,p.gruppe,x.produkt,x.tilstand||'',x.antal,
                x.stykPris,x.total].join(';'));});});
      return l.join('\n');
    },
    eksporterTilFane: function (pin,m) { tjek(pin); return {navn:'Opgørelse '+m,url:'#'}; },
    eksporterAarTilFane: function (pin,a) { tjek(pin); return {navn:'År '+a,url:'#'}; },

    registrerSpil: function (personId, valgt, vinder, vandt) {
      var p = db.personer.filter(function(x){return x.id===personId;})[0]||{};
      db.spil.push({ id:'S'+(db.spil.length+1), tid:new Date(),
        maaned:new Date().toISOString().substring(0,7), personId:personId,
        personNavn:p.navn||personId, valgt:valgt, vinder:vinder,
        resultat: vandt ? 'Slap' : 'Ordning' });
      return { ok:true };
    },

    opretGaest: function (navn) {
      if (!db.indst.tilladGaester) throw new Error('Gæster er slået fra lige nu.');
      var rent = String(navn||'').replace(/\s+/g,' ').trim();
      if (rent.length < 2) throw new Error('Skriv et navn med mindst to bogstaver.');
      if (rent.length > 40) throw new Error('Navnet er for langt.');
      var gruppe = db.indst.gaesteGruppe || 'Gæster';
      var antal = 0;
      for (var i=0;i<db.personer.length;i++){
        var p = db.personer[i];
        if (!p.aktiv) continue;
        if (p.navn.toLowerCase() === rent.toLowerCase())
          throw new Error('Der findes allerede en "'+p.navn+'". Vælg et andet navn.');
        if (p.gruppe === gruppe) antal++;
      }
      if (antal >= 200) throw new Error('Der er ikke plads til flere gæster lige nu.');
      var id = 'P'+(db.personer.length+1);
      db.personer.push({ id:id, navn:rent, gruppe:gruppe,
        farve:FARVER[db.personer.length % FARVER.length], aktiv:true });
      return { id:id, gruppe:gruppe, personer:JSON.parse(JSON.stringify(db.personer)) };
    },

    gemEgetBillede: function (personId, d) {
      if (!db.personer.some(function(p){return p.id===personId && p.aktiv;}))
        throw new Error('Ukendt person.');
      if (String(d).indexOf('data:image/') !== 0) throw new Error('Ugyldigt billedformat.');
      db.billeder[personId] = d; db.billedTid = Date.now();
      return { ok:true, id:personId, billede:d };
    },
    sletEgetBillede: function (personId) {
      if (!db.personer.some(function(p){return p.id===personId && p.aktiv;}))
        throw new Error('Ukendt person.');
      delete db.billeder[personId];
      return { ok:true, id:personId };
    },

    hentEgneKoeb: function (personId, maaned) {
      maaned = maaned || new Date().toISOString().substring(0,7);
      var linjer={}, koeb=[], total=0, antal=0, pa=0, pt=0;
      db.koeb.forEach(function(k){
        if (k.personId!==personId || k.annulleret || k.maaned!==maaned) return;
        var p1=k.pantAntal||0, p2=k.pantBeloeb||0;
        total+=k.total; antal+=k.antal; pa+=p1; pt+=p1*p2;
        var n=k.produktNavn+'|'+k.stykPris+'|'+(k.tilstand||'');
        if(!linjer[n]) linjer[n]={produkt:k.produktNavn,stykPris:k.stykPris,
                                  tilstand:k.tilstand||'',antal:0,total:0};
        linjer[n].antal+=k.antal; linjer[n].total+=k.total-p1*p2;
        koeb.push({tid:k.tid,produkt:k.produktNavn,antal:k.antal,stykPris:k.stykPris,
                   pantAntal:p1,tilstand:k.tilstand||'',total:k.total});
      });
      var liste=Object.keys(linjer).map(function(n){return linjer[n];})
        .sort(function(a,b){return b.total-a.total;});
      if (pa>0) liste.push({produkt:'Pant',stykPris:pt/pa,erPant:true,tilstand:'',
                            antal:pa,total:pt});
      return { maaned:maaned, total:total, antal:antal, pantAntal:pa, pantTotal:pt,
               linjer:liste, koeb:koeb.reverse(), valuta:db.indst.valuta };
    },

    hentAar: function (pin) {
      tjek(pin);
      var s={}; db.koeb.forEach(function(k){ s[k.maaned.substring(0,4)]=true; });
      s[new Date().getFullYear()]=true;
      return Object.keys(s).sort().reverse();
    },

    hentAarsstatistik: function (pin, aar) {
      tjek(pin);
      aar = String(aar);
      var pr={}, varer={}, maaneder={}, datoer={}, kurve={};
      var ugedage=[0,0,0,0,0,0,0], timer=new Array(24).fill(0);
      var total=0, antalVarer=0, pant=0, annullerede=0;
      function P(id, navn){
        if(!pr[id]){
          var pp=db.personer.filter(function(x){return x.id===id;})[0]||{};
          pr[id]={id:id,navn:navn||pp.navn||id,gruppe:pp.gruppe||'',farve:pp.farve||'#8b3fd6',
            total:0,antal:0,pantAntal:0,pantTotal:0,varer:{},dage:{},
            timer:new Array(24).fill(0),ugedage:[0,0,0,0,0,0,0],natteKoeb:0,
            annullerede:0,koeb:0,stoersteKoeb:0,foerste:null,sidste:null,
            loeb:0,sejre:0,ordninger:0,heste:{}};
        }
        return pr[id];
      }
      db.koeb.forEach(function(k){
        if (k.maaned.substring(0,4)!==aar) return;
        var p=P(k.personId,k.personNavn);
        if (k.annulleret){ p.annullerede++; annullerede++; return; }
        var p1=k.pantAntal||0, p2=k.pantBeloeb||0;
        // mocken har kun tid som "dd-MM HH:mm" – lav en syntetisk dato
        var dele=String(k.tid).split(/[- :]/);
        var dag=parseInt(dele[0],10)||1, md=parseInt(dele[1],10)||1;
        var time=parseInt(dele[2],10)||12;
        var dato=aar+'-'+String(md).padStart(2,'0')+'-'+String(dag).padStart(2,'0');
        var ud=new Date(dato).getDay();
        p.total+=k.total; p.antal+=k.antal; p.pantAntal+=p1; p.pantTotal+=p1*p2;
        p.varer[k.produktNavn]=(p.varer[k.produktNavn]||0)+k.antal;
        p.dage[dato]=(p.dage[dato]||0)+k.total;
        p.timer[time]+=k.antal; p.ugedage[ud]+=k.antal;
        if(time<5) p.natteKoeb+=k.antal;
        if(!p.foerste||dato<p.foerste) p.foerste=dato;
        if(!p.sidste||dato>p.sidste) p.sidste=dato;
        varer[k.produktNavn]=varer[k.produktNavn]||{navn:k.produktNavn,antal:0,total:0};
        varer[k.produktNavn].antal+=k.antal; varer[k.produktNavn].total+=k.total-p1*p2;
        maaneder[k.maaned]=(maaneder[k.maaned]||0)+k.total;
        datoer[dato]=(datoer[dato]||0)+k.total;
        ugedage[ud]+=k.antal; timer[time]+=k.antal;
        var ref=k.id;
        if(!kurve[ref]) kurve[ref]={person:k.personId,total:0};
        kurve[ref].total+=k.total;
        total+=k.total; antalVarer+=k.antal; pant+=p1*p2;
      });
      Object.keys(kurve).forEach(function(r){
        var p=pr[kurve[r].person]; if(!p) return;
        p.koeb++; if(kurve[r].total>p.stoersteKoeb) p.stoersteKoeb=kurve[r].total;
      });
      var loeb=0, ordninger=0;
      db.spil.forEach(function(r){
        if(String(r.maaned).substring(0,4)!==aar) return;
        var p=P(r.personId,r.personNavn);
        p.loeb++; loeb++;
        if(r.resultat==='Slap') p.sejre++; else { p.ordninger++; ordninger++; }
        if(r.valgt) p.heste[r.valgt]=(p.heste[r.valgt]||0)+1;
      });
      var dagN=['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag'];
      var liste=Object.keys(pr).map(function(id){
        var p=pr[id];
        var fav=null; Object.keys(p.varer).forEach(function(v){
          if(!fav||p.varer[v]>p.varer[fav]) fav=v; });
        p.favoritvare=fav?{navn:fav,antal:p.varer[fav]}:null;
        var dage=Object.keys(p.dage).sort();
        p.antalDage=dage.length;
        p.travlesteDag=null;
        dage.forEach(function(d){ if(!p.travlesteDag||p.dage[d]>p.dage[p.travlesteDag]) p.travlesteDag=d; });
        p.travlesteDagBeloeb=p.travlesteDag?p.dage[p.travlesteDag]:0;
        var st=0,bedst=0,forrige=null;
        dage.forEach(function(d){
          if(forrige && (new Date(d)-new Date(forrige))===86400000) st++; else st=1;
          if(st>bedst) bedst=st; forrige=d; });
        p.laengsteStime=bedst;
        var tT=0; for(var h=1;h<24;h++) if(p.timer[h]>p.timer[tT]) tT=h;
        p.yndlingstime=p.antal?tT:null;
        var uT=0; for(var u=1;u<7;u++) if(p.ugedage[u]>p.ugedage[uT]) uT=u;
        p.yndlingsdag=p.antal?dagN[uT]:null;
        var hT=null; Object.keys(p.heste).forEach(function(x){ if(!hT||p.heste[x]>p.heste[hT]) hT=x; });
        p.yndlingshest=hT;
        p.andel= total? Math.round(p.total/total*1000)/10 : 0;
        delete p.varer; delete p.dage; delete p.heste;
        return p;
      }).sort(function(a,b){return b.total-a.total;});
      var topD=null; Object.keys(datoer).forEach(function(d){
        if(!topD||datoer[d]>datoer[topD]) topD=d; });
      var uT=0; for(var u=1;u<7;u++) if(ugedage[u]>ugedage[uT]) uT=u;
      var tT=0; for(var h=1;h<24;h++) if(timer[h]>timer[tT]) tT=h;
      return { aar:aar, valuta:db.indst.valuta, total:total, antalVarer:antalVarer,
        antalKoeb:Object.keys(kurve).length, pantTotal:pant, annullerede:annullerede,
        personer:liste,
        varer:Object.keys(varer).map(function(v){return varer[v];})
          .sort(function(a,b){return b.antal-a.antal;}),
        maaneder:Object.keys(maaneder).sort().map(function(m){
          return {maaned:m,total:maaneder[m]}; }),
        travlesteDato: topD?{dato:topD,total:datoer[topD]}:null,
        travlesteUgedag:dagN[uT], travlesteTime:tT, loeb:loeb, ordninger:ordninger };
    },
    saetAfregnet: function (pin,m,v) { tjek(pin); db.afregnet[m]=v; return v; },
    hentAdresser: function (pin) {
      tjek(pin);
      return { regneark:'https://docs.google.com/spreadsheets/d/EKSEMPEL/edit',
               kiosk:'https://script.google.com/macros/s/EKSEMPEL/exec' };
    },
    saetIndstilling: function (pin,n,v) {
      tjek(pin);
      var map={Titel:'titel',Valuta:'valuta',FortrydSekunder:'fortrydSekunder',
               InaktivSekunder:'inaktivSekunder',StandardMinLager:'standardMinLager',
               StandardGruppe:'standardGruppe','PantBeløb':'pantBeloeb',
               'KnapStørrelse':'knapStoerrelse'};
      if(n==='AdminPin') db.pin=String(v);
      else if(n==='TilladSalgUdenLager') db.indst.tilladSalgUdenLager = (v==='ja');
      else if(n==='TilladGæster') db.indst.tilladGaester = (v==='ja');
      else if(n==='SpilHest') db.spilOpsaet.hest.aktiv = (String(v)==='ja');
      else if(n==='SpilHestChance') db.spilOpsaet.hest.chance = parseInt(v,10)||0;
      else if(n==='SpilHestAntal') db.spilOpsaet.hest.antalHeste = parseInt(v,10)||4;
      else if(n==='SpilHestGælder') db.spilOpsaet.hest.gaelderFor = String(v);
      else if(n==='Grupper') db.indst.grupper = String(v).split(',')
        .map(function(g){return g.trim();}).filter(Boolean);
      else if(map[n]) db.indst[map[n]] = (typeof db.indst[map[n]]==='number')
        ? parseInt(v,10) : v;
      return true;
    }
  };

  window.google = { script: { run: {} } };
  function lavRunner(success, failure) {
    var runner = {
      withSuccessHandler: function (f) { return lavRunner(f, failure); },
      withFailureHandler: function (f) { return lavRunner(success, f); }
    };
    Object.keys(api).forEach(function (navn) {
      runner[navn] = function () {
        var args = Array.prototype.slice.call(arguments);
        setTimeout(function () {
          try { var r = api[navn].apply(null, args); if (success) success(r); }
          catch (e) { if (failure) failure(e); }
        }, 100);
      };
    });
    return runner;
  }
  var base = lavRunner(null, null);
  Object.keys(base).forEach(function (k) { window.google.script.run[k] = base[k]; });
})();
