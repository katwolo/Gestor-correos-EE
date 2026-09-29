const Dashboard = (function () {
  const TILE_LABELS = {
    actius: 'Actius',
    finalitzats: 'Finalitzats',
    pendentsDocumentacio: 'Pendents de documentació',
    total: 'Total alumnat'
  };

  const ESTAT_LABELS = {
    finalitzat: 'Finalitzat',
    actiu: 'Actiu',
    inactiu: 'Sense pràctiques'
  };

  // Cada tile (excepte "total") és clicable i filtra la llista d'alumnes de sota.
  const TILE_FILTERS = {
    actius: function (a) { return a.actiu; },
    finalitzats: function (a) { return a.finalitzat; },
    pendentsDocumentacio: function (a) { return a.actiu && a.faltaDocument; }
  };

  // Opcions dels desplegables del panell d'edició ràpida del Dashboard. És la
  // llista per defecte de l'app (mateixa que ROSTER_COLUMNS a Code.gs), no
  // una consulta en viu del Sheet, perquè obrir el panell sigui immediat.
  const ACORD_OPTIONS = ['Entrega sol·licitud dades', 'He enviat el circuit', 'Signat per tothom'];
  const SI_NO_OPTIONS = ['SI', 'NO'];

  // Columnes (1-based) de "Excel oficial" que toca el panell d'edició ràpida.
  const COL_PRACTIQUES = 3;
  const COL_NIF_EMPRESA = 6;
  const COL_NOM_EMPRESA = 7;
  const COL_R02 = 8;
  const COL_R03 = 9;
  const COL_NUMERO_ACORD = 10;
  const COL_DATA_INICI = 11;
  const COL_DATA_FINAL = 12;
  const COL_ACORD = 13;
  const COL_HORES = 29;
  const COL_OBSERVACIONS = 28;

  const OBSERVACIONS_LIMIT = 70;

  // Si es torna a la pestanya Dashboard abans que passin aquests mil·lisegons
  // des de l'última càrrega reeixida (mateix sheetId), no es torna a demanar
  // res al servidor: ja n'hi ha prou amb el que es té en memòria.
  const CACHE_RECENT_MS = 8000;

  let alumnesActuals = [];
  let tilesActuals = {};
  let sheetIdCarregat = null;
  let ultimaCarrega = 0;
  let filtreActiu = null;
  let cercaText = '';
  let expandedRow = null;
  let panelTab = 'seguiment'; // 'seguiment' | 'crear' | 'tot' — pestanya activa del panell obert
  const obsExpandedRows = new Set();

  // Estat de la pestanya "Tot": quina fila (conveni) concret s'està veient i
  // les seves dades completes, carregades a demanda (getConveniComplet).
  let totFilaSeleccionada = null;
  let totDades = null;
  let totCarregant = false;

  function init() {
    const input = document.getElementById('dashboard-cerca-alumne');
    input.addEventListener('input', Util.debounce(function (ev) {
      cercaText = ev.target.value;
      renderStudents(document.getElementById('dashboard-students'));
    }, 150));

    document.getElementById('dashboard-students').addEventListener('click', onStudentsClick);
  }

  // Desa les dades del dashboard (vinguin de getDashboard, updateCells o
  // crearConveni, que ara també el retornen) i marca quan/de quin sheetId és,
  // perquè load() pugui decidir si cal tornar a demanar-lo al servidor.
  function aplicarDashboardData_(data) {
    alumnesActuals = data.alumnes;
    tilesActuals = data.tiles;
    sheetIdCarregat = State.getSheetIdOficial();
    ultimaCarrega = Date.now();
  }

  async function load() {
    const wrap = document.getElementById('dashboard-no-sheet');
    const tiles = document.getElementById('dashboard-tiles');
    const students = document.getElementById('dashboard-students');
    const cerca = document.getElementById('dashboard-cerca-alumne');

    if (!State.getSheetIdOficial()) {
      wrap.classList.remove('hidden');
      tiles.innerHTML = '';
      students.innerHTML = '';
      cerca.classList.add('hidden');
      sheetIdCarregat = null;
      return;
    }
    wrap.classList.add('hidden');
    cerca.classList.remove('hidden');
    filtreActiu = null;
    cercaText = '';
    cerca.value = '';
    expandedRow = null;
    obsExpandedRows.clear();

    const sheetId = State.getSheetIdOficial();
    const jaTenimDades = sheetIdCarregat === sheetId && alumnesActuals.length > 0;
    if (jaTenimDades) {
      // Es mostra de seguida el que ja hi ha en memòria (encara que sigui
      // d'una càrrega anterior) en lloc de deixar la pantalla buida mentre
      // arriba la resposta del servidor.
      renderTiles(tiles, tilesActuals);
      renderStudents(students);
      if (Date.now() - ultimaCarrega < CACHE_RECENT_MS) return;
    }
    await refresh();
  }

  // Torna a demanar les dades al backend sense tocar el filtre/cerca actuals
  // (es fa servir en carregar/refrescar el Dashboard).
  async function refresh() {
    const tiles = document.getElementById('dashboard-tiles');
    const students = document.getElementById('dashboard-students');
    try {
      const data = await Api.call('getDashboard', { sheetId: State.getSheetIdOficial() });
      aplicarDashboardData_(data);
      renderTiles(tiles, data.tiles);
      renderStudents(students);
    } catch (err) {
      Util.showToast('Dashboard: ' + err.message, 'error');
    }
  }

  function renderTiles(container, tileData) {
    container.innerHTML = Object.keys(tileData).map(function (key) {
      const label = TILE_LABELS[key] || key;
      const clicable = !!TILE_FILTERS[key];
      const activa = filtreActiu === key;
      return '<div class="tile' + (clicable ? ' tile-clickable' : '') + (activa ? ' tile-active' : '') +
        '" data-tile="' + key + '"><div class="tile-value">' + tileData[key] +
        '</div><div class="tile-label">' + Util.escapeHtml(label) + '</div></div>';
    }).join('');

    container.querySelectorAll('.tile-clickable').forEach(function (el) {
      el.addEventListener('click', function () { onTileClick(el.dataset.tile); });
    });
  }

  function onTileClick(key) {
    filtreActiu = filtreActiu === key ? null : key;
    document.querySelectorAll('.tile').forEach(function (el) {
      el.classList.toggle('tile-active', el.dataset.tile === filtreActiu);
    });
    renderStudents(document.getElementById('dashboard-students'));
  }

  // Delegació d'esdeveniments per a tota la llista d'alumnes: evita haver de
  // re-enganxar listeners cada vegada que es torna a pintar la llista.
  function onStudentsClick(ev) {
    const clearBtn = ev.target.closest('#dashboard-clear-filter');
    if (clearBtn) { onTileClick(filtreActiu); return; }

    const obsToggle = ev.target.closest('.observacions-toggle');
    if (obsToggle) {
      const row = Number(obsToggle.closest('.student-card').dataset.row);
      if (obsExpandedRows.has(row)) obsExpandedRows.delete(row); else obsExpandedRows.add(row);
      renderStudents(document.getElementById('dashboard-students'));
      return;
    }

    const saveBtn = ev.target.closest('.edit-save-btn');
    if (saveBtn) { guardarPanell(saveBtn); return; }

    const tabBtn = ev.target.closest('.panel-tab-btn');
    if (tabBtn) {
      panelTab = tabBtn.dataset.tab;
      if (panelTab === 'tot' && totFilaSeleccionada === null) {
        const card = tabBtn.closest('.student-card');
        const a = alumnesActuals.find(function (al) { return al.ultimaFila === Number(card.dataset.row); });
        if (a) { seleccionarFilaTot_(a.ultimaFila); return; }
      }
      renderStudents(document.getElementById('dashboard-students'));
      return;
    }

    const filaBtn = ev.target.closest('.tot-fila-btn');
    if (filaBtn) { seleccionarFilaTot_(Number(filaBtn.dataset.fila)); return; }

    const eliminarBtn = ev.target.closest('.tot-eliminar-btn');
    if (eliminarBtn) { eliminarConveni(eliminarBtn); return; }

    const crearBtn = ev.target.closest('.crear-conveni-btn');
    if (crearBtn) { crearConveni(crearBtn); return; }

    if (ev.target.closest('.student-edit-panel')) return;

    const header = ev.target.closest('.student-card-header');
    if (header) {
      const row = Number(header.closest('.student-card').dataset.row);
      if (expandedRow === row) {
        expandedRow = null;
      } else {
        expandedRow = row;
        panelTab = 'seguiment';
        totFilaSeleccionada = null;
        totDades = null;
        totCarregant = false;
      }
      renderStudents(document.getElementById('dashboard-students'));
    }
  }

  // Carrega (o torna a carregar) les dades completes d'un conveni concret
  // per a la pestanya "Tot". Si l'usuari canvia de fila mentre encara s'està
  // carregant l'anterior, la resposta obsoleta s'ignora.
  async function seleccionarFilaTot_(row) {
    totFilaSeleccionada = row;
    totDades = null;
    totCarregant = true;
    renderStudents(document.getElementById('dashboard-students'));
    try {
      const data = await Api.call('getConveniComplet', { sheetId: State.getSheetIdOficial(), row: row });
      if (totFilaSeleccionada !== row) return;
      totDades = data;
    } catch (err) {
      if (totFilaSeleccionada !== row) return;
      Util.showToast('No s\'ha pogut carregar el conveni: ' + err.message, 'error');
    } finally {
      if (totFilaSeleccionada === row) totCarregant = false;
      renderStudents(document.getElementById('dashboard-students'));
    }
  }

  async function eliminarConveni(btn) {
    const row = totFilaSeleccionada;
    if (!row) return;
    const ok = confirm('Segur que vols eliminar aquesta fila sencera de "Excel oficial"? Aquesta acció no es pot desfer.');
    if (!ok) return;

    const sheetId = State.getSheetIdOficial();
    btn.disabled = true;
    try {
      const data = await Api.call('deleteConveni', { sheetId: sheetId, row: row });
      aplicarDashboardData_(data);
      Util.showToast('Fila eliminada.');
      expandedRow = null;
      totFilaSeleccionada = null;
      totDades = null;
      renderTiles(document.getElementById('dashboard-tiles'), data.tiles);
      renderStudents(document.getElementById('dashboard-students'));
    } catch (err) {
      Util.showToast('No s\'ha pogut eliminar: ' + err.message, 'error');
      btn.disabled = false;
    }
  }

  function renderStudents(container) {
    const predicate = filtreActiu ? TILE_FILTERS[filtreActiu] : null;
    const cerca = cercaText.trim().toLowerCase();
    const llista = alumnesActuals.filter(function (a) {
      if (predicate && !predicate(a)) return false;
      if (cerca && a.nom.toLowerCase().indexOf(cerca) === -1) return false;
      return true;
    });

    let capçalera = '';
    if (filtreActiu) {
      capçalera = '<p class="hint-text">Filtrant per "' + Util.escapeHtml(TILE_LABELS[filtreActiu]) + '" (' + llista.length + ') — ' +
        '<button id="dashboard-clear-filter" class="btn-link">mostra tots</button></p>';
    }

    if (!llista.length) {
      container.innerHTML = capçalera + '<p class="hint-text">Cap alumne coincideix amb aquest filtre.</p>';
    } else {
      container.innerHTML = capçalera + llista.map(renderStudentCard).join('');
    }
  }

  // Cada targeta és clicable (capçalera) per desplegar un panell d'edició
  // ràpida cap a "Excel oficial", sense haver d'anar a la graella sencera.
  function renderStudentCard(a) {
    const isExpanded = expandedRow === a.ultimaFila;
    return '<div class="student-card' + (isExpanded ? ' student-card-expanded' : '') + '" data-row="' + a.ultimaFila + '">' +
      '<div class="student-card-header">' +
      '<div class="student-name">' + Util.escapeHtml(a.nom) + '</div>' +
      '<div class="student-fase">' + Util.escapeHtml(a.empresa || 'Sense empresa assignada') + '</div>' +
      renderHoresBar(a) +
      renderFaseBar(a) +
      renderObservacionsLine(a) +
      '</div>' +
      (isExpanded ? renderEditPanel(a) : '') +
      '</div>';
  }

  function renderProgressBar(percent, colorClass, label) {
    const pct = Math.max(0, Math.min(100, percent));
    return '<div class="progress-bar-wrap">' +
      '<div class="progress-bar-label">' + label + '</div>' +
      '<div class="progress-bar"><div class="progress-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }

  // Barra 1: hores fetes del quadern (sempre sobre 515h) sumant les hores
  // reals de TOTS els convenis de l'alumne més les "hores de regal" de
  // l'exempció (25%/50%/100% de 515h comptades com si ja s'haguessin fet).
  // Les hores que vénen del conveni ACTUAL i que encara no ha arribat a la
  // seva Data final es pinten amb un patró ratllat (blanc/vermell) en lloc
  // del color sòlid, per distingir-les de les ja tancades; en passar la
  // Data final, passen a comptar-se com les altres (color sòlid).
  function renderHoresBar(a) {
    const fetes = Math.round(a.horesFetes * 10) / 10;
    const objectiu = Math.round(a.horesObjectiu * 10) / 10;
    const pendents = Math.round(a.horesPendents * 10) / 10;
    const label = 'Quadern: ' + fetes + 'h / ' + objectiu + 'h' + (pendents > 0 ? ' · falten ' + pendents + 'h' : ' · complet');

    const horesPendentsFinalitzar = a.conveniActualFinalitzat ? 0 : Math.max(0, Math.min(a.horesConveniActual || 0, a.horesFetes));
    const horesSolides = a.horesFetes - horesPendentsFinalitzar;
    const pctSolid = Math.max(0, Math.min(100, (horesSolides / a.horesObjectiu) * 100));
    const pctRatllat = Math.max(0, Math.min(100 - pctSolid, (horesPendentsFinalitzar / a.horesObjectiu) * 100));
    const colorClass = (pctSolid + pctRatllat) >= 100 ? 'progress-done' : 'progress-hores';

    return '<div class="progress-bar-wrap">' +
      '<div class="progress-bar-label">' + Util.escapeHtml(label) + '</div>' +
      '<div class="progress-bar">' +
      '<div class="progress-bar-fill ' + colorClass + '" style="width:' + pctSolid + '%"></div>' +
      (pctRatllat > 0 ? '<div class="progress-bar-fill progress-bar-fill-pending" style="width:' + pctRatllat + '%"></div>' : '') +
      '</div></div>';
  }

  // Barra 2: en quin punt està l'"Acord (ref05) i pla activitats (ref06)"
  // del conveni actual ((Pendent) → He enviat el circuit → Signat per
  // tothom). Les fases venen calculades pel backend (FASES_ACORD a Code.gs).
  function renderFaseBar(a) {
    const total = a.faseConveniTotal;
    const idx = a.faseConveniIndex;
    // Buida a la primera fase ("(Pendent)"), plena i verda a l'última
    // (acord tancat), taronja a les intermèdies (en curs).
    const pct = total > 1 ? (idx / (total - 1)) * 100 : 0;
    const colorClass = idx >= total - 1 ? 'progress-done' : 'progress-fase';
    const label = 'Acord (ref05/06): ' + a.faseConveni;
    return renderProgressBar(pct, colorClass, Util.escapeHtml(label));
  }

  // Línia inferior de la targeta: substitueix l'antic avís fix de "falta
  // documentació" pel contingut real d'Observacions (truncat amb un "+" per
  // ampliar si és llarg). Si l'alumne no té cap observació anotada, no es
  // mostra res en el seu lloc.
  function renderObservacionsLine(a) {
    const estatKey = a.finalitzat ? 'finalitzat' : (a.actiu ? 'actiu' : 'inactiu');
    const obs = (a.observacions || '').trim();
    let obsHtml = '';
    if (obs) {
      const expandit = obsExpandedRows.has(a.ultimaFila);
      const esLlarg = obs.length > OBSERVACIONS_LIMIT;
      const text = expandit || !esLlarg ? obs : obs.slice(0, OBSERVACIONS_LIMIT) + '…';
      obsHtml = ' · ' + Util.escapeHtml(text) +
        (esLlarg ? ' <button type="button" class="btn-link observacions-toggle">' + (expandit ? '−' : '+') + '</button>' : '');
    }
    return '<div class="hint-text">' + Util.escapeHtml(ESTAT_LABELS[estatKey]) + obsHtml +
      (a.teExempcio ? ' · <strong>Exempció: ' + Util.escapeHtml(a.exempcio) + '</strong>' : '') + '</div>';
  }

  function acordOptionsHtml(acordActual) {
    const opcions = [{ value: '', label: '(Pendent)' }].concat(ACORD_OPTIONS.map(function (o) { return { value: o, label: o }; }));
    return opcions.map(function (o) {
      return '<option value="' + Util.escapeHtml(o.value) + '"' + (o.value === acordActual ? ' selected' : '') + '>' + Util.escapeHtml(o.label) + '</option>';
    }).join('');
  }

  function siNoOptionsHtml(actual) {
    const opcions = [{ value: '', label: '' }].concat(SI_NO_OPTIONS.map(function (o) { return { value: o, label: o }; }));
    return opcions.map(function (o) {
      return '<option value="' + Util.escapeHtml(o.value) + '"' + (o.value === actual ? ' selected' : '') + '>' + Util.escapeHtml(o.label) + '</option>';
    }).join('');
  }

  // Panell d'edició ràpida amb tres pestanyes: "Crear conveni" (nova fila
  // per a un conveni addicional), "Seguiment" (editar el conveni actual) i
  // "Tot" (veure/eliminar qualsevol conveni sencer de l'alumne).
  function renderEditPanel(a) {
    return '<div class="student-edit-panel">' +
      '<div class="panel-tabs">' +
      '<button type="button" class="panel-tab-btn' + (panelTab === 'crear' ? ' active' : '') + '" data-tab="crear">Crear conveni</button>' +
      '<button type="button" class="panel-tab-btn' + (panelTab === 'seguiment' ? ' active' : '') + '" data-tab="seguiment">Seguiment</button>' +
      '<button type="button" class="panel-tab-btn' + (panelTab === 'tot' ? ' active' : '') + '" data-tab="tot">Tot</button>' +
      '</div>' +
      (panelTab === 'crear' ? renderCrearConveniForm(a) : panelTab === 'tot' ? renderTotForm(a) : renderSeguimentForm(a)) +
      '</div>';
  }

  // Pestanya "Seguiment": Observacions, Acord, Data inici, Data final i
  // Hores realitzades total del conveni actual (última fila) — en aquest
  // ordre — amb un únic botó "Guardar" per a tot el panell.
  function renderSeguimentForm(a) {
    return '<div class="form-row"><label>Observacions</label>' +
      '<textarea class="edit-observacions" rows="3">' + Util.escapeHtml(a.observacions || '') + '</textarea></div>' +
      '<div class="form-row"><label>Acord (ref05) i pla activitats (ref06)</label>' +
      '<select class="edit-acord">' + acordOptionsHtml(a.acord || '') + '</select></div>' +
      '<div class="edit-dates-row">' +
      '<div class="form-row"><label>Data inici</label><input type="date" class="edit-data-inici" value="' + Util.escapeHtml(a.dataInici || '') + '"></div>' +
      '<div class="form-row"><label>Data final</label><input type="date" class="edit-data-final" value="' + Util.escapeHtml(a.dataFinal || '') + '"></div>' +
      '</div>' +
      '<div class="form-row"><label>Hores realitzades total</label><input type="number" min="0" step="0.5" class="edit-hores" value="' + Util.escapeHtml(a.horesConveniActual || '') + '"></div>' +
      '<button type="button" class="btn-primary edit-save-btn">Guardar</button>';
  }

  // Pestanya "Crear conveni": formulari en blanc per a un conveni addicional
  // de l'alumne. En guardar es crea una fila nova a "Excel oficial" just
  // sota l'última del grup (com el "+ fila" d'Excel oficial) i s'hi escriuen
  // aquests camps en una sola crida al backend.
  function renderCrearConveniForm() {
    return '<p class="hint-text">Es crearà una fila nova per a un conveni addicional d\'aquest alumne.</p>' +
      '<div class="form-row"><label>Ha començat pràctiques aquest curs</label>' +
      '<select class="crear-practiques">' + siNoOptionsHtml('') + '</select></div>' +
      '<div class="form-row"><label>CIF empresa</label><input type="text" class="crear-cif-empresa"></div>' +
      '<div class="form-row"><label>Nom de l\'empresa</label><input type="text" class="crear-nom-empresa"></div>' +
      '<div class="edit-dates-row">' +
      '<div class="form-row"><label>R02</label><select class="crear-r02">' + siNoOptionsHtml('') + '</select></div>' +
      '<div class="form-row"><label>R03</label><select class="crear-r03">' + siNoOptionsHtml('') + '</select></div>' +
      '</div>' +
      '<div class="form-row"><label>Número d\'acord</label><input type="text" class="crear-numero-acord"></div>' +
      '<div class="edit-dates-row">' +
      '<div class="form-row"><label>Data inici</label><input type="date" class="crear-data-inici"></div>' +
      '<div class="form-row"><label>Data final</label><input type="date" class="crear-data-final"></div>' +
      '</div>' +
      '<div class="form-row"><label>Hores realitzades total</label><input type="number" min="0" step="0.5" class="crear-hores"></div>' +
      '<div class="form-row"><label>Acord (ref05) i pla activitats (ref06)</label>' +
      '<select class="crear-acord">' + acordOptionsHtml('') + '</select></div>' +
      '<div class="form-row"><label>Observacions</label><textarea class="crear-observacions" rows="3"></textarea></div>' +
      '<button type="button" class="btn-primary crear-conveni-btn">Crear conveni</button>';
  }

  // Pestanya "Tot": permet triar quin conveni de l'alumne es vol veure (1 =
  // el més antic, el número més alt = el conveni actual) i en mostra totes
  // les columnes tal com estan a "Excel oficial", amb un botó per eliminar
  // sencera aquesta fila al final.
  function renderTotForm(a) {
    const files = (a.filesConveni && a.filesConveni.length) ? a.filesConveni : [a.ultimaFila];
    const botonsFila = files.map(function (fila, idx) {
      const actiu = totFilaSeleccionada === fila;
      return '<button type="button" class="tot-fila-btn' + (actiu ? ' active' : '') + '" data-fila="' + fila + '">' + (idx + 1) + '</button>';
    }).join('');

    let contingutHtml;
    if (totCarregant) {
      contingutHtml = '<p class="hint-text">Carregant…</p>';
    } else if (totDades) {
      contingutHtml = '<div class="tot-camps">' + totDades.camps.map(function (c) {
        return '<div class="tot-camp"><span class="tot-camp-label">' + Util.escapeHtml(c.header) + '</span>' +
          '<span class="tot-camp-valor">' + Util.escapeHtml(c.valor || '—') + '</span></div>';
      }).join('') + '</div>' +
        '<button type="button" class="btn-danger tot-eliminar-btn">🗑️ Eliminar aquesta fila</button>';
    } else {
      contingutHtml = '<p class="hint-text">Selecciona un conveni per veure\'n les dades.</p>';
    }

    return '<div class="tot-selector"><span class="hint-text">Conveni:</span>' + botonsFila + '</div>' + contingutHtml;
  }

  async function crearConveni(btn) {
    const card = btn.closest('.student-card');
    const afterRow = Number(card.dataset.row);
    const sheetId = State.getSheetIdOficial();
    const camps = {};
    camps[COL_PRACTIQUES] = card.querySelector('.crear-practiques').value;
    camps[COL_NIF_EMPRESA] = card.querySelector('.crear-cif-empresa').value;
    camps[COL_NOM_EMPRESA] = card.querySelector('.crear-nom-empresa').value;
    camps[COL_R02] = card.querySelector('.crear-r02').value;
    camps[COL_R03] = card.querySelector('.crear-r03').value;
    camps[COL_NUMERO_ACORD] = card.querySelector('.crear-numero-acord').value;
    camps[COL_DATA_INICI] = card.querySelector('.crear-data-inici').value;
    camps[COL_DATA_FINAL] = card.querySelector('.crear-data-final').value;
    camps[COL_HORES] = card.querySelector('.crear-hores').value;
    camps[COL_ACORD] = card.querySelector('.crear-acord').value;
    camps[COL_OBSERVACIONS] = card.querySelector('.crear-observacions').value;

    btn.disabled = true;
    btn.textContent = 'Creant…';
    try {
      const data = await Api.call('crearConveni', { sheetId: sheetId, afterRow: afterRow, camps: camps });
      aplicarDashboardData_(data);
      Util.showToast('Conveni creat.');
      expandedRow = null;
      renderTiles(document.getElementById('dashboard-tiles'), data.tiles);
      renderStudents(document.getElementById('dashboard-students'));
    } catch (err) {
      Util.showToast('No s\'ha pogut crear el conveni: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Crear conveni';
    }
  }

  async function guardarPanell(btn) {
    const card = btn.closest('.student-card');
    const row = Number(card.dataset.row);
    const observacions = card.querySelector('.edit-observacions').value;
    const acord = card.querySelector('.edit-acord').value;
    const dataInici = card.querySelector('.edit-data-inici').value;
    const dataFinal = card.querySelector('.edit-data-final').value;
    const hores = card.querySelector('.edit-hores').value;
    const sheetId = State.getSheetIdOficial();

    const cells = {};
    cells[COL_OBSERVACIONS] = observacions;
    cells[COL_ACORD] = acord;
    cells[COL_DATA_INICI] = dataInici;
    cells[COL_DATA_FINAL] = dataFinal;
    cells[COL_HORES] = hores;

    btn.disabled = true;
    btn.textContent = 'Desant…';
    try {
      const data = await Api.call('updateCells', { sheetId: sheetId, row: row, cells: cells });
      aplicarDashboardData_(data);
      Util.showToast('Canvis desats.');
      expandedRow = null;
      renderTiles(document.getElementById('dashboard-tiles'), data.tiles);
      renderStudents(document.getElementById('dashboard-students'));
    } catch (err) {
      Util.showToast('No s\'ha pogut desar: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }

  return { init: init, load: load };
})();
