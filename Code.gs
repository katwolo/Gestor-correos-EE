/**
 * Gestor de correus EE — backend unificat.
 * Substitueix Benvinguda.gs, Enviament.gs i Trigger.gs.
 *
 * Fa servir DOS Google Sheets diferents, cadascun amb el seu propi sheetId
 * enviat des del frontend:
 *  - "Excel oficial" (Dashboard): el full de seguiment real de l'alumnat
 *    (una sola pestanya vàlida, la primera — la resta, com INSTRUCCIONS,
 *    EMPRESES, etc., s'ignoren). Estructura definida a ROSTER_COLUMNS.
 *  - "Enviar correus": el full "Enviament"/"Plantilles"/"Registre" per
 *    disparar correus amb plantilles (trigger diari + enviament manual).
 *
 * Conté dos camins d'execució que comparteixen la mateixa lògica d'enviament:
 *  - El trigger diari / menú del propi Google Sheet (onOpen, enviament) — actua
 *    sobre el full "Enviar correus" al qual estigui lligat el projecte.
 *  - L'API web (doGet/doPost) que fa servir la web externa (GitHub Pages) via fetch.
 */

// ==== CONSTANTS ====

const SHEETS = { ENVIAMENT: 'Enviament', PLANTILLES: 'Plantilles', REGISTRE: 'Registre', PROGRAMATS: 'Programats' };

// Índexs 0-based dins la fila A:P llegida d'"Enviament".
const BLOCS = [
  { casella: 4, plantilla: 5, adjunt: 6, data: 7 },    // Bloc 1 "Contacte inicial" (E-H)
  { casella: 8, plantilla: 9, adjunt: 10, data: 11 },  // Bloc 2 "Seguiment" (I-L)
  { casella: 12, plantilla: 13, adjunt: 14, data: 15 } // Bloc 3 "Valoració final" (M-P)
];

const ACCIONS_MUTABLES = ['updateCell', 'enviarCorreu', 'configurarFull', 'configurarFullOficial', 'insertRow', 'updatePlantilla', 'updateAlumneTutor', 'programarEnviaments', 'updateProgramat', 'deleteProgramat', 'processarEnviamentsAra'];

// Mapa de visualització (Plantilles!C fa servir aquest text amb majúscules/accents;
// cargarPlantilles_ ho normalitza tot a minúscules per fer-hi coincidències).
const DESTINATARI_DISPLAY = { 'tutor/a': 'Tutor/a', alumnat: 'Alumnat', 'ambdós': 'Ambdós' };

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
    .addItem('Configuració inicial', 'configurarFullEnviament')
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

// El trigger diari no ha de dependre de "a quin Sheet està físicament lligat
// el projecte" (SpreadsheetApp.getActiveSpreadsheet()) — si el projecte
// s'hagués lligat a una còpia diferent del full d'"Enviar correus" del que
// fas servir realment a la web, el trigger s'executaria sense error però
// mirant un full equivocat, sense enviar res i sense que es noti enlloc.
// Per evitar-ho, es fa servir explícitament l'Script Property
// ENVIAMENT_SHEET_ID (el mateix sheetId que tens enganxat a la web); si no
// està configurada, es manté el comportament antic com a compatibilitat.
function obtenirSpreadsheetEnviament_() {
  const id = PropertiesService.getScriptProperties().getProperty('ENVIAMENT_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function enviament() {
  try {
    processarEnviaments_(obtenirSpreadsheetEnviament_());
  } catch (err) {
    notificarProblemes_(['El trigger diari ha fallat abans de poder processar res: ' + err.message]);
    throw err;
  }
}

// El full "Enviament" pot no tenir encara físicament columnes fins la P (p.ex.
// abans d'executar configurarFullEnviament per primer cop): les operacions de
// lectura/escriptura amb getRange fallarien ("exceeds grid limits") si el full
// és més petit del que esperem. Aquesta funció l'eixampla si cal.
function assegurarColumnes_(hoja, num) {
  const actuals = hoja.getMaxColumns();
  if (actuals < num) hoja.insertColumnsAfter(actuals, num - actuals);
}

// Columna Q (17a) opcional amb el cognom de l'alumne/a; es combina amb la
// columna A ("Nom alumne/a") perquè el picker i els correus mostrin nom i
// cognoms sense haver de canviar cap dels marcadors existents.
function construirInfoAlumne_(fila) {
  const nom = fila[0] ? String(fila[0]).trim() : '';
  const cognoms = fila[16] ? String(fila[16]).trim() : '';
  return {
    nomAlumne: cognoms ? (nom + ' ' + cognoms) : nom,
    correuAlumne: fila[1],
    nomTutor: fila[2],
    correuTutor: fila[3]
  };
}

function processarEnviaments_(ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  assegurarColumnes_(hoja, 17);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  const hojaRegistro = prepararHojaRegistro_(ss);
  const assumpteBase = obtenirAssumpteBase_(hojaPlantilles);
  const plantilles = cargarPlantilles_(hojaPlantilles);

  const last = hoja.getLastRow();
  if (last < 2) return;
  const dades = hoja.getRange(2, 1, last - 1, 17).getValues();
  const ara = new Date();
  const problemes = [];

  for (let i = 0; i < dades.length; i++) {
    const fila = dades[i];
    const infoAlumne = construirInfoAlumne_(fila);

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

  const problemesProgramats = processarProgramats_(ss, hoja, hojaPlantilles, hojaRegistro, plantilles);
  problemes.push.apply(problemes, problemesProgramats);

  if (problemes.length) notificarProblemes_(problemes);
  return { problemes: problemes };
}

// Acció manual des de la web: força ara mateix el mateix processament que fa
// el trigger diari (blocs clàssics "Enviament" + cua "Programats"), però
// sobre el sheetId exacte que hi ha enganxat al navegador. Útil per no haver
// d'esperar a les 8:00, i també com a "xarxa de seguretat" si el projecte
// d'Apps Script no estigués lligat exactament a aquest mateix full (el
// trigger fa servir SpreadsheetApp.getActiveSpreadsheet(), que és sempre el
// full on està lligat el projecte, no el sheetId triat a la web).
function accioProcessarEnviamentsAra_(ss) {
  return processarEnviaments_(ss);
}

// Envia una plantilla a un alumne (assumpte/cos generats a partir dels
// marcadors, sense overrides) i, si la plantilla coincideix amb un dels 3
// blocs clàssics, en marca la casella/data com si s'hagués enviat des del
// full. Compartit entre l'enviament manual des de la web i la cua de
// "Programats".
function enviarPlantillaPerAlumne_(hoja, hojaPlantilles, hojaRegistro, plantilles, alumneRow, dades, plantillaNom, adjuntsStr) {
  const plantillaObj = plantilles[String(plantillaNom || '').trim().toLowerCase()];
  if (!plantillaObj) { const e = new Error('Plantilla no trobada: ' + plantillaNom); e.code = 'NOT_FOUND'; throw e; }

  const assumpte = substituirPlaceholders_(obtenirAssumpteBase_(hojaPlantilles), dades);
  const cos = substituirPlaceholders_(plantillaObj.cos, dades);

  const resultat = enviarCorreuCore_({
    dades: dades, plantillaObj: plantillaObj, assumpte: assumpte, cos: cos,
    adjuntsStr: adjuntsStr || '', hojaRegistro: hojaRegistro, plantillaNom: String(plantillaNom).trim()
  });

  if (resultat.errors.length === 0 && alumneRow) {
    const blocIdx = detectarBlocPerPlantilla_(plantillaNom);
    if (blocIdx !== -1) {
      const bloc = BLOCS[blocIdx];
      hoja.getRange(alumneRow, bloc.casella + 1).setValue(false);
      hoja.getRange(alumneRow, bloc.data + 1).setValue(new Date());
    }
  }
  return resultat;
}

// ==== COLA D'ENVIAMENTS PROGRAMATS ("Programats") ====
// Permet triar diverses plantilles per a un alumne, cadascuna amb la seva
// pròpia data. Les que ja toquen (data buida o passada) s'envien a l'instant;
// la resta queden pendents i el trigger diari (8:00) les processa quan arriba
// el dia. Evita dependre de triggers individuals (límit de 20 per projecte).

function prepararHojaProgramats_(ss) {
  let hoja = ss.getSheetByName(SHEETS.PROGRAMATS);
  if (!hoja) {
    hoja = ss.insertSheet(SHEETS.PROGRAMATS);
    hoja.appendRow(['Fila alumne', 'Nom alumne', 'Plantilla', 'Data programada', 'Adjunts', 'Estat', 'Data creació']);
  }
  return hoja;
}

// Llista tots els correus programats (per a la vista "Veure programats" de la web).
function obtenirProgramats_(ss) {
  const hoja = prepararHojaProgramats_(ss);
  const last = hoja.getLastRow();
  if (last < 2) return { items: [] };
  const dades = hoja.getRange(2, 1, last - 1, 7).getValues();
  const items = dades.map(function (fila, i) {
    const data = fila[3];
    const dataCreacio = fila[6];
    return {
      row: i + 2,
      alumneRow: fila[0],
      nomAlumne: fila[1],
      plantillaNom: fila[2],
      data: data instanceof Date ? Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      adjunts: fila[4],
      estat: fila[5],
      dataCreacio: dataCreacio instanceof Date ? Utilities.formatDate(dataCreacio, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : ''
    };
  });
  return { items: items };
}

// Edita la data (i opcionalment els adjunts) d'un correu programat encara
// pendent. No es permet editar-ne un que ja s'hagi enviat o hagi fallat.
function actualitzarProgramat_(ss, payload) {
  const hoja = prepararHojaProgramats_(ss);
  const row = Number(payload.row);
  if (!row || row < 2 || row > hoja.getLastRow()) { const e = new Error('Fila no vàlida'); e.code = 'BAD_REQUEST'; throw e; }
  const estatActual = hoja.getRange(row, 6).getValue();
  if (estatActual !== 'Pendent') { const e = new Error('Només es poden editar correus programats que encara estan pendents'); e.code = 'BAD_REQUEST'; throw e; }

  if (payload.data !== undefined) hoja.getRange(row, 4).setValue(payload.data ? new Date(payload.data + 'T00:00:00') : '');
  if (payload.adjunts !== undefined) hoja.getRange(row, 5).setValue(payload.adjunts);
  return { ok: true };
}

// Elimina una fila de "Programats" (cancel·la un enviament programat).
function eliminarProgramat_(ss, payload) {
  const hoja = prepararHojaProgramats_(ss);
  const row = Number(payload.row);
  if (!row || row < 2 || row > hoja.getLastRow()) { const e = new Error('Fila no vàlida'); e.code = 'BAD_REQUEST'; throw e; }
  hoja.deleteRow(row);
  return { ok: true };
}

function processarProgramats_(ss, hoja, hojaPlantilles, hojaRegistro, plantilles) {
  const hojaProgramats = prepararHojaProgramats_(ss);
  const last = hojaProgramats.getLastRow();
  const problemes = [];
  if (last < 2) return problemes;

  const files = hojaProgramats.getRange(2, 1, last - 1, 7).getValues();
  const ara = new Date();

  files.forEach(function (fila, i) {
    const filaNum = i + 2;
    if (fila[5] !== 'Pendent') return;
    const dataProgramada = fila[3];
    if (dataProgramada instanceof Date && dataProgramada > ara) return;

    const alumneRow = fila[0];
    const plantillaNom = fila[2];
    const adjuntsStr = fila[4];

    try {
      const filaAlumne = hoja.getRange(alumneRow, 1, 1, 17).getValues()[0];
      const dades = construirInfoAlumne_(filaAlumne);
      const resultat = enviarPlantillaPerAlumne_(hoja, hojaPlantilles, hojaRegistro, plantilles, alumneRow, dades, plantillaNom, adjuntsStr);
      if (resultat.errors.length === 0) {
        hojaProgramats.getRange(filaNum, 6).setValue('Enviat');
      } else {
        const missatge = resultat.errors.map(function (e) { return e.error; }).join('; ');
        hojaProgramats.getRange(filaNum, 6).setValue('Error: ' + missatge);
        problemes.push('Programat fila ' + filaNum + ': ' + missatge);
      }
    } catch (err) {
      hojaProgramats.getRange(filaNum, 6).setValue('Error: ' + err.message);
      problemes.push('Programat fila ' + filaNum + ': ' + err.message);
    }
  });

  return problemes;
}

// Acció web: rep diverses {plantillaNom, data} per a un mateix alumne. Les
// que toquen ja (sense data o data <= avui) s'envien a l'instant; la resta
// es desen a "Programats" per al trigger diari.
function accioProgramarEnviaments_(payload, ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  const hojaRegistro = prepararHojaRegistro_(ss);
  const hojaProgramats = prepararHojaProgramats_(ss);

  assegurarColumnes_(hoja, 17);
  const fila = hoja.getRange(payload.alumneRow, 1, 1, 17).getValues()[0];
  const dades = construirInfoAlumne_(fila);
  const plantilles = cargarPlantilles_(hojaPlantilles);

  const ara = new Date();
  const enviatsAra = [];
  const programats = [];
  const errors = [];

  (payload.items || []).forEach(function (item) {
    const plantillaNom = item.plantillaNom;
    if (!plantillaNom) return;
    const dataStr = item.data;
    const dataObj = dataStr ? new Date(dataStr + 'T00:00:00') : null;

    if (dataObj && dataObj > ara) {
      hojaProgramats.appendRow([payload.alumneRow, dades.nomAlumne, plantillaNom, dataObj, payload.adjunts || '', 'Pendent', new Date()]);
      programats.push({ plantillaNom: plantillaNom, data: dataStr });
      return;
    }

    try {
      const resultat = enviarPlantillaPerAlumne_(hoja, hojaPlantilles, hojaRegistro, plantilles, payload.alumneRow, dades, plantillaNom, payload.adjunts || '');
      if (resultat.errors.length === 0) {
        enviatsAra.push(plantillaNom);
      } else {
        resultat.errors.forEach(function (er) { errors.push({ plantillaNom: plantillaNom, error: er.error }); });
      }
    } catch (err) {
      errors.push({ plantillaNom: plantillaNom, error: err.message });
    }
  });

  return { enviatsAra: enviatsAra, programats: programats, errors: errors };
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

function resoldreDestinataris_(dades, tipusDestinatari) {
  const destinataris = [];
  switch (tipusDestinatari) {
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
  return destinataris;
}

function enviarCorreuCore_(params) {
  const dades = params.dades;
  const plantillaObj = params.plantillaObj;
  const destinataris = resoldreDestinataris_(dades, plantillaObj.destinatari);

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

// ==== CONFIGURACIÓ / MIGRACIÓ del full "Enviar correus" (dropdown, any acadèmic) ====

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
// La Q (17) és opcional: si s'omple, es combina amb la A per mostrar/enviar "Nom Cognoms".
const CAPÇALERES_BASE_ENVIAMENT = [
  [1, 'Nom alumne/a'], [2, 'Correu alumnat'], [3, "Nom tutor/a d'empresa"], [4, 'Correu tutor/a'],
  [5, '✅'], [6, 'Plantilla'], [7, 'Adjunt (opcional)'], [8, 'Data Contacte inicial'],
  [9, '✅'], [10, 'Plantilla'], [11, 'Adjunt (opcional)'], [12, 'Data Seguiment'],
  [13, '✅'], [14, 'Plantilla'], [15, 'Adjunt (opcional)'], [16, 'Data Valoració Final'],
  [17, 'Cognoms (opcional)']
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
  assegurarColumnes_(hoja, 17);

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
  if (last > 1) {
    hoja.getRange(2, 5, last - 1, 1).insertCheckboxes();
    hoja.getRange(2, 9, last - 1, 1).insertCheckboxes();
    hoja.getRange(2, 13, last - 1, 1).insertCheckboxes();
    canvis.push('Caselles dels 3 blocs (E, I, M) activades per a ' + (last - 1) + ' files.');
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

// ==== FULL "EXCEL OFICIAL" (roster real de seguiment de l'alumnat) ====
//
// Sempre és la PRIMERA pestanya del spreadsheet, sigui quin sigui el seu nom
// (canvia cada curs, p.ex. "2n EAS A 24-25"). Capçaleres a la fila 2, dades
// a partir de la fila 3. Alguns alumnes ocupen diverses files consecutives
// (un conveni/acord per fila): la primera fila del grup porta el nom i el
// mail; les següents (nom en blanc) són convenis addicionals del mateix
// alumne — per al dashboard es fa servir sempre la ÚLTIMA fila del grup.

const ROSTER_COLUMNS = [
  { header: "Nom i cognoms de l'alumne/a", tipus: 'text' },
  { header: "Mail de l'alumne/a", tipus: 'text' },
  { header: 'Ha començat pràctiques', tipus: 'select', opcions: ['SI', 'NO'] },
  { header: 'Fa dual?', tipus: 'select', opcions: ['SI', 'NO'] },
  { header: 'Delictes sexuals', tipus: 'select', opcions: ['SI', 'NO', 'NO CAL'] },
  { header: 'NIF empresa', tipus: 'text' },
  { header: "Nom de l'empresa", tipus: 'text' },
  { header: 'R02', tipus: 'select', opcions: ['SI', 'NO'] },
  { header: 'R03', tipus: 'select', opcions: ['SI', 'NO'] },
  { header: 'Número acord', tipus: 'text' },
  { header: 'Data inici', tipus: 'data' },
  { header: 'Data final', tipus: 'data' },
  { header: 'Acord (ref05) i pla activitats (ref06)', tipus: 'select', opcions: ['He enviat el circuit', 'Signat per tothom'] },
  { header: 'Renúncia', tipus: 'select', opcions: ['FCT', 'Signat', 'Enviat a coordinació FCT'] },
  { header: 'Exempció (%)', tipus: 'select', opcions: ['No aplica', 'Sol.licitud enviada', '25%', '50%', '100%', 'Negativa'] },
  { header: "Contactes amb l'empresa", tipus: 'select', opcions: ['No he fet', 'Inicial', 'Seguiment', 'Valoració'] },
  { header: 'Seguiment alumne/a', tipus: 'select', opcions: ['Inici', 'Seguiment', 'Final'] },
  { header: 'Agenda SBID (1r T)', tipus: 'select', opcions: ['No fet', 'En procés', 'Fet'] },
  { header: 'Agenda SBID (2n T)', tipus: 'select', opcions: ['No fet', 'En procés', 'Fet'] },
  { header: 'Agenda SBID (3r T)', tipus: 'select', opcions: ['No fet', 'En procés', 'Fet'] },
  { header: 'R22 (Quadern FCT)', tipus: 'select', opcions: ['No esta fet', 'Falta signar alumne/a i tutors/es', 'Enviat a coordinació FCT', 'Rebut definitiu', 'Enviat definitiu'] },
  { header: 'Nota final', tipus: 'select', opcions: ['MOLT BONA', 'BONA', 'SUFICIENT', 'NO APTE'] },
  { header: 'Nota numèrica', tipus: 'text' },
  { header: 'Notes posades esfera', tipus: 'select', opcions: ['SI'] },
  { header: 'Erasmus+', tipus: 'select', opcions: ['SI'] },
  { header: 'Excel inserció laboral', tipus: 'select', opcions: ['Fet'] },
  { header: 'Enquesta inserció laboral', tipus: 'select', opcions: ['Fet'] },
  { header: 'Observacions', tipus: 'text' },
  { header: 'Hores realitzades', tipus: 'text' },
  { header: 'Mòbil tutor/a empresa', tipus: 'text' }
];
// Índexs 0-based per llegibilitat al codi de sota. Columna AC (índex 28) es
// fa servir per a les hores realitzades de cada conveni (abans "Mail
// tutor/a empresa", reaprofitada).
const ROSTER_IDX = { NOM: 0, MAIL: 1, PRACTIQUES: 2, ACORD: 12, EXEMPCIO: 14, QUADERN: 20, NOTA_FINAL: 21, HORES: 28 };

// Hores totals de quadern que ha de fer un alumne sense cap exempció.
const HORES_QUADERN_TOTAL = 515;

// Fases de la barra "Acord (ref05) i pla activitats (ref06)" (columna ACORD),
// en l'ordre en què avança el tràmit. Una cel·la buida es tracta com a fase 0.
const FASES_ACORD = ['(Pendent)', 'He enviat el circuit', 'Signat per tothom'];

function obtenirFullRoster_(ss) {
  const fulls = ss.getSheets();
  if (!fulls.length) { const e = new Error('El full oficial no té cap pestanya'); e.code = 'NOT_FOUND'; throw e; }
  return fulls[0];
}

// Prepara un Google Sheets COMPLETAMENT NOU i buit perquè es pugui fer servir
// com a "Excel oficial": hi escriu les capçaleres de ROSTER_COLUMNS a la fila
// 2 i, quan és possible, els desplegables natius de Sheets per a les
// columnes de tipus 'select' (només per comoditat si algú obre el full
// directament — la web sempre fa servir el seu propi <select>, no en depèn).
// És idempotent i no toca res si el full ja té capçaleres: pensada perquè mai
// interfereixi amb un full real ja en ús.
function configurarFullOficial_(ss) {
  const hoja = obtenirFullRoster_(ss);
  const numCols = ROSTER_COLUMNS.length;
  const canvis = [];

  assegurarColumnes_(hoja, numCols);

  const capçaleraActual = hoja.getLastRow() >= 2 ? hoja.getRange(2, 1, 1, numCols).getValues()[0] : [];
  const jaTeCapçaleres = capçaleraActual.some(function (v) { return v !== '' && v !== null; });

  if (jaTeCapçaleres) {
    canvis.push('Aquest full ja tenia capçaleres a la fila 2: no s\'ha tocat res.');
    return canvis;
  }

  hoja.getRange(2, 1, 1, numCols).setValues([ROSTER_COLUMNS.map(function (c) { return c.header; })]);
  hoja.getRange(2, 1, 1, numCols).setFontWeight('bold');
  canvis.push('Capçaleres escrites a la fila 2 (' + numCols + ' columnes).');

  if (hoja.getLastRow() < 3) {
    hoja.insertRowAfter(2);
    canvis.push('Afegida una primera fila buida (fila 3) per començar a introduir alumnat.');
  }

  const FILES_VALIDACIO = 200;
  let desplegablesOk = 0;
  ROSTER_COLUMNS.forEach(function (col, idx) {
    if (col.tipus !== 'select' || !col.opcions) return;
    try {
      const rang = hoja.getRange(3, idx + 1, FILES_VALIDACIO, 1);
      const regla = SpreadsheetApp.newDataValidation().requireValueInList(col.opcions, true).setAllowInvalid(true).build();
      rang.setDataValidation(regla);
      desplegablesOk++;
    } catch (err) {
      canvis.push('No s\'ha pogut posar el desplegable natiu de "' + col.header + '": ' + err.message);
    }
  });
  if (desplegablesOk) canvis.push('Desplegables natius de Sheets aplicats a ' + desplegablesOk + ' columnes (files 3-' + (2 + FILES_VALIDACIO) + ').');

  return canvis;
}

// Si la columna té una Validació de dades de tipus "llista" configurada
// directament al Google Sheets (Dades > Validació de dades), es fan servir
// EIXES opcions en lloc de les fixades a ROSTER_COLUMNS — així, si algú
// canvia el desplegable directament al full (afegir/treure/renombrar
// opcions), la graella de la web ho reflecteix sense haver de tocar
// Code.gs ni tornar a desplegar. Si la columna no té cap validació pròpia
// (o no es pot llegir per qualsevol motiu), es manté el comportament antic:
// les opcions fixades al codi.
function obtenirOpcionsValidacio_(hoja, col, filaMostra) {
  try {
    const regla = hoja.getRange(filaMostra, col).getDataValidation();
    if (!regla) return null;
    const criteri = regla.getCriteriaType();
    const valors = regla.getCriteriaValues();
    if (criteri === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      const llista = valors[0];
      return (llista && llista.length) ? llista : null;
    }
    if (criteri === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
      const plans = valors[0].getValues().reduce(function (acc, fila) { return acc.concat(fila); }, []);
      const unics = plans.filter(function (v, i) { return v !== '' && v !== null && plans.indexOf(v) === i; });
      return unics.length ? unics : null;
    }
    return null;
  } catch (err) {
    return null;
  }
}

function obtenirDadesRoster_(ss) {
  const hoja = obtenirFullRoster_(ss);
  const last = hoja.getLastRow();
  const numCols = ROSTER_COLUMNS.length;
  const headers = last >= 2 ? hoja.getRange(2, 1, 1, numCols).getValues()[0] : ROSTER_COLUMNS.map(function (c) { return c.header; });
  const numFilesDades = Math.max(0, last - 2);
  const rows = numFilesDades > 0
    ? hoja.getRange(3, 1, numFilesDades, numCols).getValues().map(function (fila, i) {
      return { row: i + 3, values: fila };
    })
    : [];

  const filaMostra = last >= 3 ? 3 : null;
  const columnTypes = ROSTER_COLUMNS.map(function (c, idx) {
    if (c.tipus !== 'select') return { tipus: c.tipus, opcions: null };
    const opcionsSheet = filaMostra ? obtenirOpcionsValidacio_(hoja, idx + 1, filaMostra) : null;
    return { tipus: 'select', opcions: opcionsSheet || c.opcions || null };
  });

  return { headers: headers, rows: rows, columnTypes: columnTypes };
}

function actualitzarCellaRoster_(ss, payload) {
  const hoja = obtenirFullRoster_(ss);
  const definicio = ROSTER_COLUMNS[payload.col - 1];
  let valor = payload.value;
  if (definicio && definicio.tipus === 'data') valor = valor ? new Date(valor) : '';
  hoja.getRange(payload.row, payload.col).setValue(valor);
  return { row: payload.row, col: payload.col, value: valor };
}

// Insereix una fila buida just després de `afterRow` (Sheets copia el format i
// les validacions de la fila anterior automàticament). Serveis per afegir un
// nou conveni/acord consecutiu per a un alumne (deixant el nom en blanc, com
// la resta de convenis addicionals del mateix grup).
function inserirFilaRoster_(ss, payload) {
  const hoja = obtenirFullRoster_(ss);
  const afterRow = Number(payload.afterRow);
  if (!afterRow || afterRow < 2) { const e = new Error('Fila no vàlida'); e.code = 'BAD_REQUEST'; throw e; }
  hoja.insertRowAfter(afterRow);
  return { insertedRow: afterRow + 1 };
}

// Agrupa totes les files d'un mateix alumne (diversos convenis) en un sol grup,
// tant si les files addicionals deixen el nom en blanc (continuació) com si hi
// repeteixen el nom (p.ex. en afegir manualment una fila nova). El grup sempre
// fa servir la fila més avall (l'última introduïda) com a "estat" actual, de
// manera que només el conveni més recent compta com a actiu/finalitzat.
function parseHores_(valor) {
  if (valor === '' || valor === null || valor === undefined) return 0;
  const net = String(valor).replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(net);
  return isNaN(n) ? 0 : n;
}

function agruparAlumnesRoster_(files, primeraFilaNum) {
  const grups = [];
  const indexPerNom = {};
  let grupActual = null;

  function afegirFilaAlGrup_(g, row, filaNum) {
    g.ultimaFila = filaNum;
    g.estat = row;
    g.totalHores += parseHores_(row[ROSTER_IDX.HORES]);
    if (teExempcio_(row[ROSTER_IDX.EXEMPCIO])) g.exempcio = row[ROSTER_IDX.EXEMPCIO];
  }

  files.forEach(function (row, i) {
    const filaNum = primeraFilaNum + i;
    const teContingut = row.some(function (v) { return v !== '' && v !== null; });
    const nomFila = row[ROSTER_IDX.NOM] ? String(row[ROSTER_IDX.NOM]).trim() : '';

    if (nomFila) {
      const clau = nomFila.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(indexPerNom, clau)) {
        grupActual = grups[indexPerNom[clau]];
        afegirFilaAlGrup_(grupActual, row, filaNum);
      } else {
        grupActual = {
          primeraFila: filaNum, ultimaFila: filaNum, nom: row[ROSTER_IDX.NOM], mail: row[ROSTER_IDX.MAIL],
          estat: row, totalHores: parseHores_(row[ROSTER_IDX.HORES]), exempcio: row[ROSTER_IDX.EXEMPCIO]
        };
        indexPerNom[clau] = grups.length;
        grups.push(grupActual);
      }
    } else if (grupActual && teContingut) {
      afegirFilaAlGrup_(grupActual, row, filaNum);
    } else if (!teContingut) {
      grupActual = null;
    }
  });

  return grups;
}

// Exempció "en curs" (a comptar al dashboard): qualsevol valor real diferent
// de "No aplica" (sol·licitud enviada, un percentatge concedit o denegada).
function teExempcio_(valor) {
  return !!valor && valor !== 'No aplica';
}

// Només "25%"/"50%"/"100%" redueixen l'objectiu d'hores; "Sol.licitud enviada"
// i "Negativa" es tracten com a 0% (l'objectiu es manté a 515h) fins que
// quedi confirmat un percentatge concret. Admet tant text amb "%" (p. ex. la
// nostra pròpia graella) com un número cru: si la cel·la de l'Excel oficial
// té format de percentatge de Google Sheets, getValues() en retorna el valor
// subjacent (0.25) i no el text mostrat ("25%"), així que cal interpretar-lo
// igualment.
function parseExempcioPercent_(valor) {
  if (valor === '' || valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return valor <= 1 ? valor * 100 : valor;
  const text = String(valor).trim();
  const ambPercent = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (ambPercent) return Number(ambPercent[1].replace(',', '.'));
  const num = Number(text.replace(',', '.'));
  if (text !== '' && !isNaN(num)) return num <= 1 ? num * 100 : num;
  return 0;
}

// Fase de la barra "Acord (ref05) i pla activitats (ref06)" a partir del
// valor de la columna ACORD (buit = fase 0, "(Pendent)").
function calcularFaseAcord_(valor) {
  const idx = FASES_ACORD.indexOf(valor);
  return {
    etiqueta: idx === -1 ? (valor || FASES_ACORD[0]) : valor,
    index: idx === -1 ? 0 : idx,
    total: FASES_ACORD.length
  };
}

function obtenirDashboardRoster_(ss) {
  const hoja = obtenirFullRoster_(ss);
  const last = hoja.getLastRow();
  if (last < 3) {
    return { tiles: { actius: 0, finalitzats: 0, pendentsDocumentacio: 0, ambExempcio: 0, total: 0 }, alumnes: [] };
  }

  const files = hoja.getRange(3, 1, last - 2, ROSTER_COLUMNS.length).getValues();
  const grups = agruparAlumnesRoster_(files, 3);

  let actius = 0, finalitzats = 0, pendentsDocumentacio = 0, ambExempcio = 0;
  const alumnes = grups.map(function (g) {
    const row = g.estat;
    const practiques = row[ROSTER_IDX.PRACTIQUES];
    const notaFinal = row[ROSTER_IDX.NOTA_FINAL];
    const acord = row[ROSTER_IDX.ACORD];
    const quadern = row[ROSTER_IDX.QUADERN];
    const exempcio = g.exempcio;
    const teExempcioActiva = teExempcio_(exempcio);

    const finalitzat = !!notaFinal;
    const actiu = !finalitzat && practiques === 'SI';
    const faltaDocument = !finalitzat && (acord !== 'Signat per tothom' || quadern !== 'Enviat definitiu');

    if (finalitzat) finalitzats++;
    else if (actiu) actius++;
    if (actiu && faltaDocument) pendentsDocumentacio++;
    if (teExempcioActiva) ambExempcio++;

    const percentExempcio = parseExempcioPercent_(exempcio);
    const horesObjectiu = HORES_QUADERN_TOTAL * (1 - percentExempcio / 100);
    const horesFetes = g.totalHores;
    const horesPendents = Math.max(0, horesObjectiu - horesFetes);
    const fase = calcularFaseAcord_(acord);

    return {
      primeraFila: g.primeraFila,
      ultimaFila: g.ultimaFila,
      nom: g.nom,
      mail: g.mail,
      empresa: row[6],
      practiques: practiques,
      acord: acord,
      quadern: quadern,
      notaFinal: notaFinal,
      exempcio: exempcio,
      teExempcio: teExempcioActiva,
      finalitzat: finalitzat,
      actiu: actiu,
      faltaDocument: faltaDocument,
      horesFetes: horesFetes,
      horesObjectiu: horesObjectiu,
      horesPendents: horesPendents,
      faseConveni: fase.etiqueta,
      faseConveniIndex: fase.index,
      faseConveniTotal: fase.total
    };
  });

  return {
    tiles: {
      actius: actius,
      finalitzats: finalitzats,
      pendentsDocumentacio: pendentsDocumentacio,
      ambExempcio: ambExempcio,
      total: grups.length
    },
    alumnes: alumnes
  };
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
    case 'getDashboard': return obtenirDashboardRoster_(ss);
    case 'getSheetData': return obtenirDadesRoster_(ss);
    case 'configurarFullOficial': return { canvis: configurarFullOficial_(ss) };
    case 'updateCell': return actualitzarCellaRoster_(ss, payload);
    case 'insertRow': return inserirFilaRoster_(ss, payload);
    case 'getPlantilles': return obtenirPlantillesApi_(ss);
    case 'updatePlantilla': return actualitzarPlantilla_(ss, payload);
    case 'getStudents': return obtenirAlumnes_(ss);
    case 'updateAlumneTutor': return actualitzarTutorAlumne_(ss, payload);
    case 'previewCorreu': return generarAssumpteICos_(ss, payload.alumneRow, payload.plantillaNom);
    case 'enviarCorreu': return accioEnviarCorreu_(payload, ss);
    case 'programarEnviaments': return accioProgramarEnviaments_(payload, ss);
    case 'getProgramats': return obtenirProgramats_(ss);
    case 'updateProgramat': return actualitzarProgramat_(ss, payload);
    case 'deleteProgramat': return eliminarProgramat_(ss, payload);
    case 'processarEnviamentsAra': return accioProcessarEnviamentsAra_(ss);
    case 'configurarFull': return { canvis: configurarFullEnviament_(ss) };
    case 'getRegistre': return obtenirRegistre_(ss, payload.limit);
    default: { const e = new Error('Acció desconeguda: ' + accio); e.code = 'UNKNOWN_ACTION'; throw e; }
  }
}

// ==== HANDLERS DE L'API — "Enviar correus" (full Enviament/Plantilles) ====

function obtenirPlantillesApi_(ss) {
  const hoja = ss.getSheetByName(SHEETS.PLANTILLES);
  if (!hoja) return { assumpteBase: 'Missatge IEB', plantilles: [] };
  const mapa = cargarPlantilles_(hoja);
  const llista = Object.keys(mapa).map(function (key) {
    return { nom: mapa[key].nom, cos: mapa[key].cos, destinatari: mapa[key].destinatari };
  });
  return { assumpteBase: obtenirAssumpteBase_(hoja), plantilles: llista };
}

// Desa canvis d'una plantilla existent (cos i/o destinatari) directament al full
// "Plantilles", perquè es puguin editar les plantilles des de la mateixa web.
function actualitzarPlantilla_(ss, payload) {
  const hoja = ss.getSheetByName(SHEETS.PLANTILLES);
  const last = hoja.getLastRow();
  if (last < 5) { const e = new Error('No hi ha plantilles'); e.code = 'NOT_FOUND'; throw e; }

  const noms = hoja.getRange(5, 1, last - 4, 1).getValues();
  const buscada = String(payload.plantillaNom || '').trim().toLowerCase();
  const idx = noms.findIndex(function (fila) { return String(fila[0]).trim().toLowerCase() === buscada; });
  if (idx === -1) { const e = new Error('Plantilla no trobada: ' + payload.plantillaNom); e.code = 'NOT_FOUND'; throw e; }

  const fila = 5 + idx;
  if (payload.cos !== undefined) hoja.getRange(fila, 2).setValue(payload.cos);
  if (payload.destinatari) {
    const valorMostrat = DESTINATARI_DISPLAY[String(payload.destinatari).trim().toLowerCase()] || payload.destinatari;
    hoja.getRange(fila, 3).setValue(valorMostrat);
  }
  return { ok: true };
}

// Permet editar el nom i el correu del tutor/a d'empresa (columnes C/D) d'un
// alumne des de la mateixa web, sense haver d'obrir el Sheet directament.
function actualitzarTutorAlumne_(ss, payload) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  if (payload.nomTutor !== undefined) hoja.getRange(payload.alumneRow, 3).setValue(payload.nomTutor);
  if (payload.correuTutor !== undefined) hoja.getRange(payload.alumneRow, 4).setValue(payload.correuTutor);
  return { ok: true };
}

function obtenirAlumnes_(ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  if (!hoja) return { alumnes: [] };
  const last = hoja.getLastRow();
  if (last < 2) return { alumnes: [] };
  assegurarColumnes_(hoja, 17);
  const dades = hoja.getRange(2, 1, last - 1, 17).getValues();
  const alumnes = dades
    .map(function (fila, i) {
      const info = construirInfoAlumne_(fila);
      info.row = i + 2;
      return info;
    })
    .filter(function (a) { return a.nomAlumne; });
  return { alumnes: alumnes };
}

function generarAssumpteICos_(ss, alumneRow, plantillaNom) {
  const hojaEnviament = ss.getSheetByName(SHEETS.ENVIAMENT);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  assegurarColumnes_(hojaEnviament, 17);
  const fila = hojaEnviament.getRange(alumneRow, 1, 1, 17).getValues()[0];
  const dades = construirInfoAlumne_(fila);

  const plantilles = cargarPlantilles_(hojaPlantilles);
  const plantillaObj = plantilles[String(plantillaNom || '').trim().toLowerCase()];
  if (!plantillaObj) { const e = new Error('Plantilla no trobada: ' + plantillaNom); e.code = 'NOT_FOUND'; throw e; }

  return {
    assumpte: substituirPlaceholders_(obtenirAssumpteBase_(hojaPlantilles), dades),
    cos: substituirPlaceholders_(plantillaObj.cos, dades),
    destinatari: plantillaObj.destinatari,
    destinataris: resoldreDestinataris_(dades, plantillaObj.destinatari)
  };
}

function accioEnviarCorreu_(payload, ss) {
  const hoja = ss.getSheetByName(SHEETS.ENVIAMENT);
  const hojaPlantilles = ss.getSheetByName(SHEETS.PLANTILLES);
  const hojaRegistro = prepararHojaRegistro_(ss);

  assegurarColumnes_(hoja, 17);
  const fila = hoja.getRange(payload.alumneRow, 1, 1, 17).getValues()[0];
  const dades = construirInfoAlumne_(fila);

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
