const test = require('node:test');
const assert = require('node:assert/strict');
const { carregarCode, filaRoster } = require('./carrega-code');

const C = carregarCode();
const I = C.ROSTER_IDX;

// ---- Hores i exempcions ----

test('parseHores_ entén comes, unitats i cel·les buides', function () {
  assert.equal(C.parseHores_(''), 0);
  assert.equal(C.parseHores_(null), 0);
  assert.equal(C.parseHores_(120), 120);
  assert.equal(C.parseHores_('12,5'), 12.5);
  assert.equal(C.parseHores_('40 h'), 40);
  assert.equal(C.parseHores_('cap'), 0);
});

test('teExempcio_: "No aplica" i buit no són exempció', function () {
  assert.equal(C.teExempcio_(''), false);
  assert.equal(C.teExempcio_('No aplica'), false);
  assert.equal(C.teExempcio_('25%'), true);
  assert.equal(C.teExempcio_('Sol.licitud enviada'), true);
});

test('parseExempcioPercent_ només compta percentatges concrets', function () {
  assert.equal(C.parseExempcioPercent_('25%'), 25);
  assert.equal(C.parseExempcioPercent_('100 %'), 100);
  assert.equal(C.parseExempcioPercent_(0.5), 50); // Sheets guarda 50% com 0.5
  assert.equal(C.parseExempcioPercent_('Sol.licitud enviada'), 0);
  assert.equal(C.parseExempcioPercent_('Negativa'), 0);
  assert.equal(C.parseExempcioPercent_(''), 0);
});

// ---- Fases de l'acord ----

test("calcularFaseAcord_ segueix l'ordre de FASES_ACORD", function () {
  assert.deepEqual(C.calcularFaseAcord_(''), { etiqueta: '(Pendent)', index: 0, total: 4 });
  assert.equal(C.calcularFaseAcord_('He enviat el circuit').index, 2);
  assert.equal(C.calcularFaseAcord_('Signat per tothom').index, 3);
  // Un valor desconegut compta com a pendent però es mostra tal qual.
  assert.deepEqual(C.calcularFaseAcord_('Altre'), { etiqueta: 'Altre', index: 0, total: 4 });
});

test('les fases i les opcions de la columna Acord no es desquadren', function () {
  const columna = C.ROSTER_COLUMNS[I.ACORD];
  assert.equal(columna.header, 'Acord (ref05) i pla activitats (ref06)');
  assert.deepEqual(C.FASES_ACORD.slice(1), columna.opcions);
});

test('ROSTER_IDX apunta a les columnes que diu el seu nom', function () {
  const h = function (idx) { return C.ROSTER_COLUMNS[idx].header; };
  assert.match(h(I.NOM), /Nom i cognoms/);
  assert.match(h(I.MAIL), /Mail/);
  assert.match(h(I.PRACTIQUES), /Ha començat/);
  assert.match(h(I.EXEMPCIO), /Exempció/);
  assert.match(h(I.QUADERN), /R22/);
  assert.match(h(I.NOTA_FINAL), /^Nota final$/);
  assert.match(h(I.HORES), /Hores realitzades/);
  assert.equal(C.ROSTER_COLUMNS.length, 30);
});

// ---- Agrupar files en alumnes ----

test('agruparAlumnesRoster_: files sense nom són convenis del mateix alumne', function () {
  const files = [
    filaRoster({ [I.NOM]: 'Marta Puig', [I.HORES]: 100 }),
    filaRoster({ 6: 'Segona empresa', [I.HORES]: '50' }), // continuació
    filaRoster({}), // fila buida: tanca el grup
    filaRoster({ 6: 'Òrfena' }), // sense grup obert: s'ignora
    filaRoster({ [I.NOM]: 'Jan Soler', [I.EXEMPCIO]: '25%' })
  ];
  const grups = C.agruparAlumnesRoster_(files, 3);
  assert.equal(grups.length, 2);
  assert.deepEqual(grups[0].files, [3, 4]);
  assert.equal(grups[0].totalHores, 150);
  assert.equal(grups[0].ultimaFila, 4);
  assert.equal(grups[0].estat[6], 'Segona empresa'); // l'estat és el de l'última fila
  assert.equal(grups[1].primeraFila, 7);
  assert.equal(grups[1].exempcio, '25%');
});

test('agruparAlumnesRoster_: el nom repetit (sense majúscules) continua el mateix grup', function () {
  const files = [
    filaRoster({ [I.NOM]: 'Marta Puig', [I.HORES]: 10 }),
    filaRoster({ [I.NOM]: 'Jan Soler' }),
    filaRoster({ [I.NOM]: 'MARTA PUIG ', [I.HORES]: 5 })
  ];
  const grups = C.agruparAlumnesRoster_(files, 3);
  assert.equal(grups.length, 2);
  assert.deepEqual(grups[0].files, [3, 5]);
  assert.equal(grups[0].totalHores, 15);
});

// ---- Dashboard complet (amb un full fals) ----

function fullFals(files) {
  return {
    getSheets: function () {
      return [{
        getLastRow: function () { return files.length + 2; },
        getRange: function () { return { getValues: function () { return files; } }; }
      }];
    }
  };
}

test('obtenirDashboardRoster_ compta bé els indicadors', function () {
  const passat = new Date(Date.now() - 86400000 * 30);
  const files = [
    filaRoster({ [I.NOM]: 'Actiu sense acord', [I.PRACTIQUES]: 'SI', [I.ACORD]: 'He enviat el circuit', [I.HORES]: 100 }),
    filaRoster({ [I.NOM]: 'Actiu amb acord', [I.PRACTIQUES]: 'SI', [I.ACORD]: 'Signat per tothom' }),
    filaRoster({ [I.NOM]: 'Finalitzat', [I.PRACTIQUES]: 'SI', [I.NOTA_FINAL]: 'BONA', 11: passat }),
    filaRoster({ [I.NOM]: 'Sense començar', [I.PRACTIQUES]: 'NO', [I.EXEMPCIO]: '50%' })
  ];
  const r = C.obtenirDashboardRoster_(fullFals(files));
  assert.deepEqual(r.tiles, { actius: 2, finalitzats: 1, pendentsDocumentacio: 1, total: 4 });

  const perNom = Object.fromEntries(r.alumnes.map(function (a) { return [a.nom, a]; }));
  assert.equal(perNom['Actiu sense acord'].faltaDocument, true);
  assert.equal(perNom['Actiu sense acord'].horesPendents, 415);
  assert.equal(perNom['Actiu amb acord'].faltaDocument, false);
  assert.equal(perNom['Finalitzat'].finalitzat, true);
  assert.equal(perNom['Finalitzat'].conveniActualFinalitzat, true);
  // L'exempció del 50% compta com a hores fetes, no redueix l'objectiu.
  assert.equal(perNom['Sense començar'].horesObjectiu, 515);
  assert.equal(perNom['Sense començar'].horesFetes, 257.5);
  assert.equal(perNom['Sense començar'].actiu, false);
});

test('obtenirDashboardRoster_ amb un full sense dades', function () {
  const r = C.obtenirDashboardRoster_(fullFals([]));
  assert.deepEqual(r, { tiles: { actius: 0, finalitzats: 0, pendentsDocumentacio: 0, total: 0 }, alumnes: [] });
});

// ---- Correus ----

test('substituirPlaceholders_ omple totes les dades i ignora espais i majúscules', function () {
  const text = 'Hola {{nombreTutor}}, sobre {{ nombreAlumno }} ({{correoAlumno}}) — curs {{ANYACADEMIC}} — {{correoTutor}}';
  const r = C.substituirPlaceholders_(text, { nomAlumne: 'Marta', correuAlumne: 'm@a.cat', nomTutor: 'Joan', correuTutor: 'j@e.cat' });
  assert.match(r, /^Hola Joan, sobre Marta \(m@a\.cat\) — curs \d\d-\d\d — j@e\.cat$/);
});

test('anyAcademicActual canvia de curs l\'1 de setembre', function () {
  const DataReal = Date;
  function amb(dataIso, fn) {
    global.Date = class extends DataReal { constructor(...a) { super(...(a.length ? a : [dataIso])); } };
    try { return fn(); } finally { global.Date = DataReal; }
  }
  // Code.gs es carrega amb new Function, que fa servir el Date global.
  assert.equal(amb('2026-08-31T12:00:00', function () { return carregarCode().anyAcademicActual(); }), '25-26');
  assert.equal(amb('2026-09-01T12:00:00', function () { return carregarCode().anyAcademicActual(); }), '26-27');
  assert.equal(amb('2027-01-15T12:00:00', function () { return carregarCode().anyAcademicActual(); }), '26-27');
});

test('resoldreDestinataris_ segons el tipus de plantilla', function () {
  const dades = { correuAlumne: 'a@x.cat', correuTutor: 't@x.cat' };
  assert.deepEqual(C.resoldreDestinataris_(dades, 'tutor/a'), ['t@x.cat']);
  assert.deepEqual(C.resoldreDestinataris_(dades, 'alumnat'), ['a@x.cat']);
  assert.deepEqual(C.resoldreDestinataris_(dades, 'ambdós'), ['a@x.cat', 't@x.cat']);
  assert.deepEqual(C.resoldreDestinataris_(dades, 'desconegut'), ['t@x.cat']);
  assert.deepEqual(C.resoldreDestinataris_({ correuTutor: '' }, 'tutor/a'), []);
});

test('detectarBlocPerPlantilla_ reconeix els 3 blocs clàssics', function () {
  assert.equal(C.detectarBlocPerPlantilla_('Contacte inicial'), 0);
  assert.equal(C.detectarBlocPerPlantilla_('contacteinicial'), 0);
  assert.equal(C.detectarBlocPerPlantilla_(' SEGUIMENT '), 1);
  assert.equal(C.detectarBlocPerPlantilla_('Valoració final'), 2);
  assert.equal(C.detectarBlocPerPlantilla_('Ref 05 i Ref 06'), -1);
});

test('extraerIdDeDrive_ treu l\'ID d\'un enllaç de Drive', function () {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz_012345';
  assert.equal(C.extraerIdDeDrive_('https://drive.google.com/file/d/' + id + '/view?usp=sharing'), id);
  assert.equal(C.extraerIdDeDrive_('no és cap enllaç'), null);
});

// ---- Seguretat de l'API ----

function codiError(fn) {
  try { fn(); return 'OK'; } catch (e) { return e.code; }
}

test('comprovarAcces_: sense APP_PASSWORD l\'API no funciona', function () {
  const S = carregarCode({ props: {} });
  assert.equal(codiError(function () { S.comprovarAcces_({ password: 'x' }); }), 'SERVER_NOT_CONFIGURED');
});

test('comprovarAcces_: contrasenya absent, incorrecta i correcta', function () {
  const S = carregarCode({ props: { APP_PASSWORD: 'gat pluja taronja' } });
  assert.equal(codiError(function () { S.comprovarAcces_({}); }), 'AUTH_REQUIRED');
  assert.equal(codiError(function () { S.comprovarAcces_({ password: 'gat pluja' }); }), 'WRONG_PASSWORD');
  assert.equal(codiError(function () { S.comprovarAcces_({ password: 'gat pluja taronja' }); }), 'OK');
});

test('comprovarAcces_: ALLOWED_SHEET_IDS limita els Sheets', function () {
  const S = carregarCode({ props: { APP_PASSWORD: 'p', ALLOWED_SHEET_IDS: ' AAA , BBB' } });
  assert.equal(codiError(function () { S.comprovarAcces_({ password: 'p', payload: { sheetId: 'BBB' } }); }), 'OK');
  assert.equal(codiError(function () { S.comprovarAcces_({ password: 'p', payload: { sheetId: 'CCC' } }); }), 'SHEET_NOT_ALLOWED');
});

test('contrasenyesIguals_ compara tot el text', function () {
  assert.equal(C.contrasenyesIguals_('abc', 'abc'), true);
  assert.equal(C.contrasenyesIguals_('abc', 'abd'), false);
  assert.equal(C.contrasenyesIguals_('abc', 'abcd'), false);
  assert.equal(C.contrasenyesIguals_('', 'a'), false);
});

// ---- La web i el servidor fan servir les mateixes columnes ----

test('les constants COL_* del Dashboard apunten a la columna correcta', function () {
  const fs = require('fs');
  const path = require('path');
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'docs', 'js', 'dashboard.js'), 'utf8');
  const esperat = {
    COL_PRACTIQUES: /Ha començat/,
    COL_NIF_EMPRESA: /NIF empresa/,
    COL_NOM_EMPRESA: /Nom de l'empresa/,
    COL_R02: /^R02$/,
    COL_R03: /^R03$/,
    COL_NUMERO_ACORD: /Número acord/,
    COL_DATA_INICI: /Data inici/,
    COL_DATA_FINAL: /Data final/,
    COL_ACORD: /^Acord \(ref05\)/,
    COL_HORES: /Hores realitzades/,
    COL_OBSERVACIONS: /Observacions/
  };
  Object.keys(esperat).forEach(function (nom) {
    const m = dashboard.match(new RegExp('const ' + nom + ' = (\\d+);'));
    assert.ok(m, 'falta ' + nom + ' a dashboard.js');
    const header = C.ROSTER_COLUMNS[Number(m[1]) - 1].header; // COL_* és 1-based
    assert.match(header, esperat[nom], nom + ' = ' + m[1] + ' apunta a "' + header + '"');
  });
});

test("les opcions d'Acord del Dashboard són les del servidor", function () {
  const fs = require('fs');
  const path = require('path');
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'docs', 'js', 'dashboard.js'), 'utf8');
  const m = dashboard.match(/const ACORD_OPTIONS = (\[[^\]]*\]);/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), C.ROSTER_COLUMNS[I.ACORD].opcions);
});
