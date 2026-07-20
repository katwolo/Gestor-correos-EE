/**
 * Gestor de correus EE — backend unificat.
 * Substitueix Benvinguda.gs, Enviament.gs i Trigger.gs.
 *
 * Conté dos camins d'execució que comparteixen la mateixa lògica d'enviament:
 *  - El trigger diari / menú del propi Google Sheet (onOpen, enviament).
 *  - L'API web (doGet/doPost) que fa servir la web externa (GitHub Pages) via fetch.
 */

// ==== CONSTANTS ====

const SHEETS = { ENVIAMENT: 'Enviament', PLANTILLES: 'Plantilles', REGISTRE: 'Registre' };

// Índexs 0-based dins la fila A:U llegida d'"Enviament".
const BLOCS = [
  { casella: 4, plantilla: 5, adjunt: 6, data: 7 },    // Bloc 1 "Contacte inicial" (E-H)
  { casella: 8, plantilla: 9, adjunt: 10, data: 11 },  // Bloc 2 "Seguiment" (I-L)
  { casella: 12, plantilla: 13, adjunt: 14, data: 15 } // Bloc 3 "Valoració final" (M-P)
];

// Les 8 fases del procés, en ordre. "bool" = checkbox Q-U; "data" = columna de data H/L/P.
const FASES_DEFS = [
  { idx: 16, tipus: 'bool', etiqueta: "Sol·licitud de dades rebuda" },
  { idx: 17, tipus: 'bool', etiqueta: "Creació REF05/REF06" },
  { idx: 18, tipus: 'bool', etiqueta: "Devolució firmada" },
  { idx: 7, tipus: 'data', etiqueta: "Contacte inicial fet" },
  { idx: 11, tipus: 'data', etiqueta: "Seguiment fet" },
  { idx: 15, tipus: 'data', etiqueta: "Valoració final feta" },
  { idx: 19, tipus: 'bool', etiqueta: "Conveni tancat" },
  { idx: 20, tipus: 'bool', etiqueta: "Quadern complet tancat" }
];

const WHITELISTED_SHEETS = ['Enviament', 'Plantilles']; // Registre és només lectura des de la web
const ACCIONS_MUTABLES = ['updateCell', 'enviarCorreu', 'configurarFull'];

const TIPUS_COLUMNES = {
  Enviament: (function () {
    const t = {};
    for (let c = 0; c < 21; c++) t[c] = 'text';
    [4, 8, 12, 16, 17, 18, 19, 20].forEach(function (c) { t[c] = 'checkbox'; });
    [7, 11, 15].forEach(function (c) { t[c] = 'data'; });
    return t;
  })(),
  Plantilles: { 0: 'text', 1: 'html', 2: 'text' },
  Registre: { 0: 'data', 1: 'text', 2: 'text', 3: 'text', 4: 'text', 5: 'text' }
};

// ==== MENÚ / ONOPEN (full lligat) ====

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const userProps = PropertiesService.getUserProperties();
  const scriptProps = PropertiesService.getScriptProperties();

  ui.createMenu('Enviaments')
    .addItem('Enviar ara', 'enviament')
    .addItem('Tutorial', 'mostrarTutorial')
    .addItem('Esborrar historial', 'esborrarHistorial')
    .addSeparator()
    .addItem('Configuració inicial (columnes Q-U)', 'configurarFullEnviament')
    .addItem("Copiar URL de l'aplicació web", 'mostrarUrlAplicacio')
    .addToUi();

  const jaMostrat = userProps.getProperty('benvingudaMostrada');
  if (!jaMostrat) {
    ui.alert(
      'Benvingut/da!',
      'Abans de començar, et recomanem llegir el tutorial que trobaràs al menú "Enviaments".\n\n' +
      'Si tens qualsevol dubte, pots escriure a ibustos@ieb.cat.\n\n' +
      'Espero que us sigui útil aquesta eina!',
      ui.ButtonSet.OK
    );
    userProps.setProperty('benvingudaMostrada', 'sí');
  }

  const triggerJaCreat = scriptProps.getProperty('triggerEnviamentCreat');
  if (!triggerJaCreat) {
    crearTriggerCadaDia_8h();
    scriptProps.setProperty('triggerEnviamentCreat', 'sí');
  }
}

function mostrarTutorial() {
  SpreadsheetApp.getUi().alert(
    'Tutorial ràpid',
    'Full "Enviament": marca la casella ✅ del bloc que vulguis enviar (Contacte inicial / Seguiment / ' +
    'Valoració final), escriu el nom exacte de la plantilla i, si cal, un o més enllaços de Drive separats per comes.\n\n' +
    'Full "Plantilles": defineix el cos de cada correu amb els marcadors {{nombreAlumno}}, {{correoAlumno}}, ' +
    '{{nombreTutor}}, {{correoTutor}} i {{anyAcademic}}.\n\n' +
    "Cada dia a les 8:00 s'envien automàticament els correus marcats. També pots fer-ho ara des del menú " +
    '"Enviaments > Enviar ara".\n\nDubtes: ibustos@ieb.cat',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function esborrarHistorial() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.alert(
    'Esborrar historial',
    'Això eliminarà totes les files del full "Registre" (es mantindrà la capçalera). Vols continuar?',
    ui.ButtonSet.YES_NO
  );
  if (resposta !== ui.Button.YES) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(SHEETS.REGISTRE);
  if (hoja && hoja.getLastRow() > 1) {
    hoja.deleteRows(2, hoja.getLastRow() - 1);
  }
  ui.alert('Historial esborrat.');
}

function mostrarUrlAplicacio() {
  let url = 'No desplegada encara';
  try { url = ScriptApp.getService().getUrl(); } catch (err) { /* no deployment yet */ }
  SpreadsheetApp.getUi().alert("URL de l'aplicació web", url, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ==== TRIGGER DIARI ====

function crearTriggerCadaDia_8h() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let t of triggers) {
    if (t.getHandlerFunction() === 'enviament') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('enviament')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
  Logger.log('✅ Trigger diari a les 8:00 creat automàticament.');
}

// ==== ENVIAMENT (camí legacy: trigger diari / menú "Enviar ara") ====

function enviament() {
  processarEnviaments_(SpreadsheetApp.getActiveSpreadsheet());
}

// El full "Enviament" pot no tenir encara físicament columnes fins la U (p.ex.
// abans d'executar configurarFullEnviament per primer cop): les operacions de
// lectura/escriptura amb getRange fallarien ("exceeds grid limits") si el full
// és més petit del que esperem. Aquesta funció l'eixampla si cal.
function assegurarColumnes_(hoja, num) {
  const actuals = hoja.getMaxColumns();
  if (actuals < num) hoja.insertColumnsAfter(actuals, num - actuals);
}

function processarEnviaments_(ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  assegurarColumnes_(hoja, 21);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  const hojaRegistro = prepararHojaRegistro_(ss);
  const assumpteBase = obtenirAssumpteBase_(hojaPlantilles);
  const plantilles = cargarPlantilles_(hojaPlantilles);

  const last = hoja.getLastRow();
  if (last < 2) return;
  const dades = hoja.getRange(2, 1, last - 1, 21).getValues();
  const ara = new Date();
  const problemes = [];

  for (let i = 0; i < dades.length; i++) {
    const fila = dades[i];
    const infoAlumne = { nomAlumne: fila[0], correuAlumne: fila[1], nomTutor: fila[2], correuTutor: fila[3] };

    BLOCS.forEach(function (bloc) {
      const casellaMarcada = fila[bloc.casella];
      const plantillaKey = fila[bloc.plantilla];
      const adjuntsStr = fila[bloc.adjunt];
      const dataEnviament = fila[bloc.data];

      if (!casellaMarcada || !plantillaKey) return;
      if (dataEnviament instanceof Date && dataEnviament > ara) return;

      const plantillaObj = plantilles[String(plantillaKey).trim().toLowerCase()];
      if (!plantillaObj || !plantillaObj.cos) {
        Logger.log('Fila ' + (i + 2) + ' plantilla "' + plantillaKey + '" no trobada.');
        problemes.push('Fila ' + (i + 2) + ': plantilla "' + plantillaKey + '" no trobada.');
        return;
      }

      const assumpte = substituirPlaceholders_(assumpteBase, infoAlumne);
      const cos = substituirPlaceholders_(plantillaObj.cos, infoAlumne);

      const resultat = enviarCorreuCore_({
        dades: infoAlumne,
        plantillaObj: plantillaObj,
        assumpte: assumpte,
        cos: cos,
        adjuntsStr: adjuntsStr,
        hojaRegistro: hojaRegistro,
        plantillaNom: String(plantillaKey).trim()
      });

      resultat.avisos.forEach(function (avis) { problemes.push('Fila ' + (i + 2) + ': ' + avis); });

      if (resultat.errors.length === 0) {
        hoja.getRange(i + 2, bloc.casella + 1).setValue(false);
        hoja.getRange(i + 2, bloc.data + 1).setValue(new Date());
      } else {
        resultat.errors.forEach(function (err) {
          problemes.push('Fila ' + (i + 2) + ' (' + (err.destinatari || 'sense destinatari') + '): ' + err.error);
        });
      }
    });
  }

  if (problemes.length) notificarProblemes_(problemes);
}

function notificarProblemes_(llista) {
  const destinatari = PropertiesService.getScriptProperties().getProperty('TEACHER_NOTIFY_EMAIL') ||
    Session.getEffectiveUser().getEmail();
  if (!destinatari) return;
  try {
    GmailApp.sendEmail(
      destinatari,
      "Gestor EE: incidències en l'enviament de correus",
      "S'han detectat les següents incidències:\n\n" + llista.join('\n')
    );
  } catch (err) {
    Logger.log("No s'ha pogut enviar el resum d'incidències: " + err.message);
  }
}

// ==== NUCLI D'ENVIAMENT COMPARTIT (trigger + enviament manual des de la web) ====

function enviarCorreuCore_(params) {
  const dades = params.dades;
  const plantillaObj = params.plantillaObj;

  const destinataris = [];
  switch (plantillaObj.destinatari) {
    case 'alumnat':
      if (dades.correuAlumne) destinataris.push(dades.correuAlumne);
      break;
    case 'ambdós':
      if (dades.correuAlumne) destinataris.push(dades.correuAlumne);
      if (dades.correuTutor) destinataris.push(dades.correuTutor);
      break;
    case 'tutor/a':
    default:
      if (dades.correuTutor) destinataris.push(dades.correuTutor);
      break;
  }

  const enviats = [];
  const errors = [];
  const avisos = [];

  if (destinataris.length === 0) {
    errors.push({ destinatari: null, error: 'Sense destinataris vàlids (falta correu)' });
    return { enviats: enviats, errors: errors, avisos: avisos };
  }

  const adjunts = [];
  if (params.adjuntsStr) {
    String(params.adjuntsStr).split(',').forEach(function (ref) {
      const trimmed = ref.trim();
      if (!trimmed) return;
      try {
        const id = extraerIdDeDrive_(trimmed);
        if (!id) throw new Error('ID de Drive no reconegut');
        adjunts.push(DriveApp.getFileById(id).getBlob());
      } catch (err) {
        avisos.push('Adjunt ignorat (' + trimmed + '): ' + err.message);
      }
    });
  }

  destinataris.forEach(function (destinatari) {
    const opcions = { to: destinatari, subject: params.assumpte, htmlBody: params.cos };
    if (adjunts.length) opcions.attachments = adjunts;
    try {
      GmailApp.sendEmail(opcions.to, opcions.subject, '', opcions);
      registrarEnvio_(params.hojaRegistro, destinatari, params.assumpte, params.plantillaNom, 'OK');
      enviats.push(destinatari);
    } catch (err) {
      registrarEnvio_(params.hojaRegistro, destinatari, params.assumpte, params.plantillaNom, 'ERROR: ' + err.message);
      errors.push({ destinatari: destinatari, error: err.message });
    }
  });

  return { enviats: enviats, errors: errors, avisos: avisos };
}

function prepararHojaRegistro_(ss) {
  let hoja = ss.getSheetByName(SHEETS.REGISTRE);
  if (!hoja) {
    hoja = ss.insertSheet(SHEETS.REGISTRE);
    hoja.appendRow(['Data', 'Hora', 'Destinatari', 'Assumpte', 'Missatge enviat', 'Estat']);
  } else {
    const capçalera = hoja.getRange(1, 1, 1, Math.max(6, hoja.getLastColumn())).getValues()[0];
    if (!capçalera[5]) hoja.getRange(1, 6).setValue('Estat');
  }
  return hoja;
}

function registrarEnvio_(hoja, destinatari, assumpte, plantillaUsada, estat) {
  const fecha = new Date();
  const dataStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const horaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'HH:mm');
  hoja.appendRow([dataStr, horaStr, destinatari, assumpte, plantillaUsada, estat]);
}

function cargarPlantilles_(hoja) {
  if (!hoja) return {};
  const last = hoja.getLastRow();
  if (last < 5) return {};
  const dades = hoja.getRange(5, 1, last - 4, 3).getValues();
  const mapa = {};
  dades.forEach(function (fila) {
    const nom = fila[0], cos = fila[1], destinatari = fila[2];
    if (nom && cos) {
      mapa[String(nom).trim().toLowerCase()] = {
        nom: String(nom).trim(),
        cos: cos,
        destinatari: destinatari ? String(destinatari).trim().toLowerCase() : 'tutor/a'
      };
    }
  });
  return mapa;
}

function obtenirAssumpteBase_(hojaPlantilles) {
  return hojaPlantilles.getRange('B1').getValue() || 'Missatge IEB';
}

function substituirPlaceholders_(text, dades) {
  return String(text || '')
    .replace(/{{\s*nombreAlumno\s*}}/gi, dades.nomAlumne || '')
    .replace(/{{\s*correoAlumno\s*}}/gi, dades.correuAlumne || '')
    .replace(/{{\s*nombreTutor\s*}}/gi, dades.nomTutor || '')
    .replace(/{{\s*correoTutor\s*}}/gi, dades.correuTutor || '')
    .replace(/{{\s*anyAcademic\s*}}/gi, anyAcademicActual());
}

function anyAcademicActual() {
  const ara = new Date();
  const any = ara.getFullYear();
  const mes = ara.getMonth() + 1;
  const inici = mes >= 9 ? any : any - 1;
  return String(inici).slice(-2) + '-' + String(inici + 1).slice(-2);
}

function extraerIdDeDrive_(url) {
  const match = String(url).match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

// ==== FASES DEL PROCÉS / DASHBOARD ====

function calcularFaseAlumne_(row) {
  const completades = FASES_DEFS.map(function (f) {
    const v = row[f.idx];
    return f.tipus === 'data' ? !!v : v === true;
  });
  const primeraPendent = completades.indexOf(false);
  const finalitzat = primeraPendent === -1;
  return {
    faseActual: finalitzat ? 8 : primeraPendent + 1,
    etiqueta: finalitzat ? 'Finalitzat' : FASES_DEFS[primeraPendent].etiqueta,
    finalitzat: finalitzat,
    completades: completades
  };
}

function obtenirDashboard_(ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  assegurarColumnes_(hoja, 21);
  const last = hoja.getLastRow();
  const files = last > 1 ? hoja.getRange(2, 1, last - 1, 21).getValues() : [];

  const alumnes = [];
  let actius = 0, finalitzats = 0, pendentsDocumentacio = 0, senseTutorEmail = 0, senseContacte = 0;

  files.forEach(function (row, i) {
    if (!row[0]) return;
    const fase = calcularFaseAlumne_(row);
    if (fase.finalitzat) finalitzats++; else actius++;
    if (!fase.finalitzat && fase.faseActual <= 3) pendentsDocumentacio++;
    if (!fase.finalitzat && !row[3]) senseTutorEmail++;
    if (!fase.finalitzat && !fase.completades[3] && !fase.completades[4] && !fase.completades[5]) senseContacte++;
    alumnes.push({
      row: i + 2,
      nomAlumne: row[0], correuAlumne: row[1], nomTutor: row[2], correuTutor: row[3],
      faseActual: fase.faseActual, etiqueta: fase.etiqueta, finalitzat: fase.finalitzat, completades: fase.completades
    });
  });

  const registre = obtenirEstadistiquesRegistre_(ss);

  return {
    tiles: {
      actius: actius,
      finalitzats: finalitzats,
      pendentsDocumentacio: pendentsDocumentacio,
      senseTutorEmail: senseTutorEmail,
      senseContacte: senseContacte,
      correusSetmanaOk: registre.ok,
      correusSetmanaError: registre.error
    },
    alumnes: alumnes,
    faseLabels: FASES_DEFS.map(function (f) { return f.etiqueta; })
  };
}

function obtenirEstadistiquesRegistre_(ss) {
  const hoja = ss.getSheetByName(SHEETS.REGISTRE);
  if (!hoja) return { ok: 0, error: 0 };
  const last = hoja.getLastRow();
  if (last < 2) return { ok: 0, error: 0 };
  const dades = hoja.getRange(2, 1, last - 1, 6).getValues();
  const fa7dies = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let ok = 0, error = 0;
  dades.forEach(function (fila) {
    const data = fila[0];
    if (!(data instanceof Date) || data < fa7dies) return;
    const estat = String(fila[5] || 'OK');
    if (estat.indexOf('ERROR') === 0) error++; else ok++;
  });
  return { ok: ok, error: error };
}

// ==== CONFIGURACIÓ / MIGRACIÓ (columnes Q-U, dropdown, any acadèmic) ====

function configurarFullEnviament() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resum = configurarFullEnviament_(ss);
  // getUi() només funciona si es crida des del menú del propi full; si s'executa
  // manualment des de l'editor d'Apps Script (com en la primera configuració),
  // no hi ha UI disponible i llançaria un error — el resum ja queda igualment
  // registrat, així que només mostrem l'alerta quan és possible.
  try {
    SpreadsheetApp.getUi().alert('Configuració completada', resum.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (err) {
    Logger.log('Configuració completada:\n' + resum.join('\n'));
  }
}

// Crea el full si no existeix (permet configurar una spreadsheet totalment en blanc).
function obtenirOCrearFull_(ss, nom) {
  let hoja = ss.getSheetByName(nom);
  if (!hoja) hoja = ss.insertSheet(nom);
  return hoja;
}

// Capçaleres base A:P d'"Enviament" (només s'escriuen les cel·les que estiguin buides).
const CAPÇALERES_BASE_ENVIAMENT = [
  [1, 'Nom alumne/a'], [2, 'Correu alumnat'], [3, "Nom tutor/a d'empresa"], [4, 'Correu tutor/a'],
  [5, '✅'], [6, 'Plantilla'], [7, 'Adjunt (opcional)'], [8, 'Data Contacte inicial'],
  [9, '✅'], [10, 'Plantilla'], [11, 'Adjunt (opcional)'], [12, 'Data Seguiment'],
  [13, '✅'], [14, 'Plantilla'], [15, 'Adjunt (opcional)'], [16, 'Data Valoració Final']
];

// Plantilles d'exemple perquè l'eina funcioni "out of the box" en un full nou.
const PLANTILLES_EXEMPLE = [
  ['contacteinicial',
    "<p>Bon dia, {{nombreTutor}},</p><p>Sóc el tutor/a de {{nombreAlumno}} i em poso en contacte per iniciar el seguiment de les pràctiques.</p><p>Salutacions cordials.</p>",
    'Tutor/a'],
  ['seguiment',
    "<p>Bon dia, {{nombreTutor}},</p><p>Com va {{nombreAlumno}} durant aquest període de pràctiques? Si tens algun comentari que ens pugui ajudar, ens agradaria conèixer-lo.</p><p>Salutacions cordials.</p>",
    'Tutor/a'],
  ['valoració final',
    "<p>Bon dia, {{nombreTutor}},</p><p>Estem arribant al final de les pràctiques de {{nombreAlumno}} i ens agradaria rebre la teva valoració del procés.</p><p>Salutacions cordials.</p>",
    'Tutor/a']
];

function configurarFullEnviament_(ss) {
  const canvis = [];

  const hoja = obtenirOCrearFull_(ss, SHEETS.ENVIAMENT);
  assegurarColumnes_(hoja, 21);

  CAPÇALERES_BASE_ENVIAMENT.forEach(function (parell) {
    const cel = hoja.getRange(1, parell[0]);
    if (!cel.getValue()) {
      cel.setValue(parell[1]);
      canvis.push('Capçalera base "' + parell[1] + '" afegida.');
    }
  });

  const hojaPlantilles = obtenirOCrearFull_(ss, SHEETS.PLANTILLES);
  const assumpteCel = hojaPlantilles.getRange('B1');
  if (!assumpteCel.getValue()) {
    assumpteCel.setValue('EE IEB {{nombreAlumno}} {{anyAcademic}}');
    canvis.push('Assumpte per defecte creat a Plantilles!B1.');
  }
  [[1, 'Nom plantilla'], [2, 'Cos del correu'], [3, 'Destinatari']].forEach(function (parell) {
    const cel = hojaPlantilles.getRange(4, parell[0]);
    if (!cel.getValue()) cel.setValue(parell[1]);
  });
  if (hojaPlantilles.getLastRow() < 5) {
    hojaPlantilles.getRange(5, 1, PLANTILLES_EXEMPLE.length, 3).setValues(PLANTILLES_EXEMPLE);
    canvis.push(PLANTILLES_EXEMPLE.length + ' plantilles d\'exemple afegides (edita-les al teu gust).');
  }
  const validacioDestinatari = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Tutor/a', 'Alumnat', 'Ambdós'], true).setAllowInvalid(true).build();
  hojaPlantilles.getRange(5, 3, Math.max(1, hojaPlantilles.getLastRow() - 4), 1).setDataValidation(validacioDestinatari);

  const last = hoja.getLastRow();
  if (last >= 1) {
    const capçaleresNoves = [
      [17, "Sol·licitud de dades"], [18, 'REF05/REF06'], [19, 'Devolució firmada'],
      [20, 'Conveni tancat'], [21, 'Quadern complet']
    ];
    capçaleresNoves.forEach(function (parell) {
      const cel = hoja.getRange(1, parell[0]);
      if (!cel.getValue()) {
        cel.setValue(parell[1]);
        canvis.push('Capçalera "' + parell[1] + '" afegida.');
      }
    });

    if (last > 1) {
      hoja.getRange(2, 17, last - 1, 5).insertCheckboxes();
      hoja.getRange(2, 5, last - 1, 1).insertCheckboxes();
      hoja.getRange(2, 9, last - 1, 1).insertCheckboxes();
      hoja.getRange(2, 13, last - 1, 1).insertCheckboxes();
      canvis.push('Caselles de tots els blocs (E, I, M, Q:U) activades per a ' + (last - 1) + ' files.');
    }
  }

  const canviValidacio = refrescarValidacioPlantilles_(ss);
  if (canviValidacio) canvis.push(canviValidacio);

  const canviAny = migrarAnyAcademic_(hojaPlantilles);
  if (canviAny) canvis.push(canviAny);

  prepararHojaRegistro_(ss);
  canvis.push('Full "Registre" comprovat/actualitzat (columna Estat).');

  return canvis;
}

function refrescarValidacioPlantilles_(ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  const last = hojaPlantilles.getLastRow();
  if (last < 5) return null;
  const rangNoms = hojaPlantilles.getRange(5, 1, last - 4, 1);
  const validacio = SpreadsheetApp.newDataValidation().requireValueInRange(rangNoms, true).setAllowInvalid(true).build();
  const lastEnviament = hoja.getLastRow();
  if (lastEnviament > 1) {
    [6, 10, 14].forEach(function (col) {
      hoja.getRange(2, col, lastEnviament - 1, 1).setDataValidation(validacio);
    });
  }
  return 'Llista desplegable de plantilles (F/J/N) reconstruïda.';
}

function migrarAnyAcademic_(hojaPlantilles) {
  const cel = hojaPlantilles.getRange('B1');
  const valor = String(cel.getValue() || '');
  if (valor.indexOf('{{anyAcademic}}') !== -1) return null;
  const match = valor.match(/\d{2}-\d{2}/);
  if (!match) return null;
  cel.setValue(valor.replace(match[0], '{{anyAcademic}}'));
  return "Assumpte migrat a l'any acadèmic dinàmic ({{anyAcademic}}).";
}

// ==== API WEB (doGet / doPost) ====

function doGet() {
  return ContentService.createTextOutput('Gestor EE API — utilitza POST.').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: { code: 'BAD_REQUEST', message: 'JSON invàlid' } });
  }

  const accio = body.action;
  const payload = body.payload || {};

  try {
    if (accio === 'ping') {
      return jsonResponse_({ ok: true, data: { time: new Date().toISOString(), version: '1.0' } });
    }

    verificarContrasenya_(body.password);

    if (accio === 'login') {
      return jsonResponse_({ ok: true, data: { ok: true } });
    }

    const ss = payload.sheetId ? SpreadsheetApp.openById(payload.sheetId) : null;

    const necessitaLock = ACCIONS_MUTABLES.indexOf(accio) !== -1;
    const lock = necessitaLock ? LockService.getScriptLock() : null;
    if (lock) lock.waitLock(10000);
    try {
      const resultat = executarAccio_(accio, payload, ss);
      return jsonResponse_({ ok: true, data: resultat });
    } finally {
      if (lock) lock.releaseLock();
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: { code: err.code || 'SERVER_ERROR', message: err.message } });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Autenticació simple per contrasenya compartida (Script Property APP_PASSWORD),
// en lloc de login de Google — evita haver de crear un Client ID d'OAuth.
function verificarContrasenya_(password) {
  const esperada = PropertiesService.getScriptProperties().getProperty('APP_PASSWORD');
  if (!esperada) {
    const e = new Error('Falta configurar la propietat APP_PASSWORD a Script Properties'); e.code = 'SERVER_ERROR'; throw e;
  }
  if (!password || password !== esperada) {
    const e = new Error('Contrasenya incorrecta'); e.code = 'UNAUTHORIZED'; throw e;
  }
}

function executarAccio_(accio, payload, ss) {
  if (!ss) { const e = new Error('Falta sheetId'); e.code = 'MISSING_SHEET'; throw e; }

  switch (accio) {
    case 'getDashboard': return obtenirDashboard_(ss);
    case 'getSheetData': return obtenirDadesFull_(ss, payload.sheetName);
    case 'updateCell': return actualitzarCella_(ss, payload);
    case 'getPlantilles': return obtenirPlantillesApi_(ss);
    case 'getStudents': return obtenirAlumnes_(ss);
    case 'previewCorreu': return generarAssumpteICos_(ss, payload.alumneRow, payload.plantillaNom);
    case 'enviarCorreu': return accioEnviarCorreu_(payload, ss);
    case 'configurarFull': return { canvis: configurarFullEnviament_(ss) };
    case 'getRegistre': return obtenirRegistre_(ss, payload.limit);
    default: { const e = new Error('Acció desconeguda: ' + accio); e.code = 'UNKNOWN_ACTION'; throw e; }
  }
}

// ==== HANDLERS DE L'API ====

function obtenirDadesFull_(ss, nomFull) {
  const hoja = ss.getSheetByName(nomFull);
  if (!hoja) { const e = new Error('Full no trobat: ' + nomFull); e.code = 'NOT_FOUND'; throw e; }

  const primeraFila = nomFull === 'Plantilles' ? 4 : 1;
  const numCols = nomFull === 'Enviament' ? 21 : (nomFull === 'Plantilles' ? 3 : 6);
  if (nomFull === 'Enviament') assegurarColumnes_(hoja, 21);
  const last = hoja.getLastRow();

  if (last < primeraFila) {
    return { headers: [], rows: [], columnTypes: TIPUS_COLUMNES[nomFull] || {}, editable: WHITELISTED_SHEETS.indexOf(nomFull) !== -1 };
  }

  const headers = hoja.getRange(primeraFila, 1, 1, numCols).getValues()[0];
  const numFilesDades = last - primeraFila;
  const rows = numFilesDades > 0
    ? hoja.getRange(primeraFila + 1, 1, numFilesDades, numCols).getValues().map(function (fila, i) {
      return { row: primeraFila + 1 + i, values: fila };
    })
    : [];

  return { headers: headers, rows: rows, columnTypes: TIPUS_COLUMNES[nomFull] || {}, editable: WHITELISTED_SHEETS.indexOf(nomFull) !== -1 };
}

function actualitzarCella_(ss, payload) {
  const nomFull = payload.sheetName;
  if (WHITELISTED_SHEETS.indexOf(nomFull) === -1) {
    const e = new Error('Full no editable: ' + nomFull); e.code = 'FORBIDDEN'; throw e;
  }
  const hoja = ss.getSheetByName(nomFull);
  if (!hoja) { const e = new Error('Full no trobat'); e.code = 'NOT_FOUND'; throw e; }

  const tipus = (TIPUS_COLUMNES[nomFull] || {})[payload.col - 1] || 'text';
  let valor = payload.value;
  if (tipus === 'checkbox') valor = valor === true || valor === 'true';
  else if (tipus === 'data') valor = valor ? new Date(valor) : '';

  hoja.getRange(payload.row, payload.col).setValue(valor);
  return { row: payload.row, col: payload.col, value: valor };
}

function obtenirPlantillesApi_(ss) {
  const hoja = ss.getSheetByName(SHEETS.PLANTILLES);
  const mapa = cargarPlantilles_(hoja);
  const llista = Object.keys(mapa).map(function (key) {
    return { nom: mapa[key].nom, cos: mapa[key].cos, destinatari: mapa[key].destinatari };
  });
  return { assumpteBase: obtenirAssumpteBase_(hoja), plantilles: llista };
}

function obtenirAlumnes_(ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  const last = hoja.getLastRow();
  if (last < 2) return { alumnes: [] };
  const dades = hoja.getRange(2, 1, last - 1, 4).getValues();
  const alumnes = dades
    .map(function (fila, i) {
      return { row: i + 2, nomAlumne: fila[0], correuAlumne: fila[1], nomTutor: fila[2], correuTutor: fila[3] };
    })
    .filter(function (a) { return a.nomAlumne; });
  return { alumnes: alumnes };
}

function generarAssumpteICos_(ss, alumneRow, plantillaNom) {
  const hojaEnviament = ss.getSheetByName(SHEETS.ENVIAMENT);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  const fila = hojaEnviament.getRange(alumneRow, 1, 1, 4).getValues()[0];
  const dades = { nomAlumne: fila[0], correuAlumne: fila[1], nomTutor: fila[2], correuTutor: fila[3] };

  const plantilles = cargarPlantilles_(hojaPlantilles);
  const plantillaObj = plantilles[String(plantillaNom || '').trim().toLowerCase()];
  if (!plantillaObj) { const e = new Error('Plantilla no trobada: ' + plantillaNom); e.code = 'NOT_FOUND'; throw e; }

  return {
    assumpte: substituirPlaceholders_(obtenirAssumpteBase_(hojaPlantilles), dades),
    cos: substituirPlaceholders_(plantillaObj.cos, dades),
    destinatari: plantillaObj.destinatari
  };
}

function accioEnviarCorreu_(payload, ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  const hojaRegistro = prepararHojaRegistro_(ss);

  const fila = hoja.getRange(payload.alumneRow, 1, 1, 4).getValues()[0];
  const dades = { nomAlumne: fila[0], correuAlumne: fila[1], nomTutor: fila[2], correuTutor: fila[3] };

  const plantilles = cargarPlantilles_(hojaPlantilles);
  const plantillaObj = plantilles[String(payload.plantillaNom || '').trim().toLowerCase()];
  if (!plantillaObj) { const e = new Error('Plantilla no trobada: ' + payload.plantillaNom); e.code = 'NOT_FOUND'; throw e; }

  const assumpte = payload.assumpte || substituirPlaceholders_(obtenirAssumpteBase_(hojaPlantilles), dades);
  const cos = payload.cos || substituirPlaceholders_(plantillaObj.cos, dades);

  const resultat = enviarCorreuCore_({
    dades: dades,
    plantillaObj: plantillaObj,
    assumpte: assumpte,
    cos: cos,
    adjuntsStr: payload.adjunts || '',
    hojaRegistro: hojaRegistro,
    plantillaNom: String(payload.plantillaNom).trim()
  });

  if (resultat.errors.length === 0) {
    const blocIdx = detectarBlocPerPlantilla_(payload.plantillaNom);
    if (blocIdx !== -1) {
      const bloc = BLOCS[blocIdx];
      hoja.getRange(payload.alumneRow, bloc.casella + 1).setValue(false);
      hoja.getRange(payload.alumneRow, bloc.data + 1).setValue(new Date());
    }
  }

  return resultat;
}

function detectarBlocPerPlantilla_(nom) {
  const normalitzat = String(nom || '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
  return ['contacteinicial', 'seguiment', 'valoraciofinal'].indexOf(normalitzat);
}

function obtenirRegistre_(ss, limit) {
  const hoja = ss.getSheetByName(SHEETS.REGISTRE);
  if (!hoja) return { files: [] };
  const last = hoja.getLastRow();
  if (last < 2) return { files: [] };
  const n = Math.min(limit || 20, last - 1);
  const inici = last - n + 1;
  const dades = hoja.getRange(inici, 1, n, 6).getValues();
  const files = dades.map(function (fila) {
    return { data: fila[0], hora: fila[1], destinatari: fila[2], assumpte: fila[3], plantilla: fila[4], estat: fila[5] };
  }).reverse();
  return { files: files };
}
