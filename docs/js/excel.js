const Excel = (function () {
  function init() {
    document.getElementById('sheet-link-save').addEventListener('click', onSaveLink);
    document.getElementById('excel-configurar-full-btn').addEventListener('click', onConfigurarFullNou);

    const input = document.getElementById('sheet-link-input');
    const existing = State.getSheetIdOficial();
    if (existing) input.value = 'https://docs.google.com/spreadsheets/d/' + existing;

    document.getElementById('excel-cerca').addEventListener('input', Util.debounce(function (ev) {
      cerca = ev.target.value;
      if (dades) render_();
    }, 150));
    document.querySelectorAll('#section-excel .segmented-btn').forEach(function (b) {
      b.addEventListener('click', function () { canviarVista_(b.dataset.vista); });
    });
    const cards = document.getElementById('excel-cards');
    cards.addEventListener('click', onCardsClick_);
    cards.addEventListener('change', onCardsChange_);

    State.on('sheetIdOficial', function () { dades = null; fitxesObertes.clear(); refreshGate(); });
    refreshGate();
  }

  function onSaveLink() {
    const raw = document.getElementById('sheet-link-input').value.trim();
    const id = Util.extractSheetId(raw);
    const status = document.getElementById('sheet-link-status');
    if (!id) {
      status.textContent = 'No s\'ha reconegut cap ID de Google Sheets en aquest enllaç.';
      return;
    }
    State.setSheetIdOficial(id);
    status.textContent = 'Enllaç desat.';
    refreshGate();
  }

  function refreshGate() {
    const has = !!State.getSheetIdOficial();
    document.getElementById('excel-no-sheet').classList.toggle('hidden', has);
    document.getElementById('excel-grid-wrap').classList.toggle('hidden', !has);
    if (has) loadActiveTab();
  }

  // Dades de l'última càrrega, per poder canviar de vista o cercar sense
  // tornar a demanar res al servidor.
  let dades = null;
  let cerca = '';
  let vista = vistaInicial_();
  const fitxesObertes = new Set();

  // Grups de camps a la vista de fitxes (índexs 0-based de ROSTER_COLUMNS a
  // Code.gs). Les columnes que no surtin aquí van a "Altres".
  const GRUPS = [
    { titol: 'Alumne/a', cols: [0, 1, 2, 3, 4] },
    { titol: 'Empresa i conveni', cols: [5, 6, 29, 7, 8, 9, 10, 11, 28] },
    { titol: 'Documentació', cols: [12, 13, 14, 20] },
    { titol: 'Seguiment', cols: [15, 16, 17, 18, 19, 27] },
    { titol: 'Avaluació i tancament', cols: [21, 22, 23, 24, 25, 26] }
  ];
  const COL_NOM = 0;
  const COL_EMPRESA = 6;
  const COL_OBSERVACIONS = 27;

  function vistaInicial_() {
    try {
      const desada = localStorage.getItem('eeExcelVista');
      if (desada === 'fitxes' || desada === 'taula') return desada;
    } catch (err) { /* sense localStorage: es tria per l'amplada */ }
    return window.innerWidth < 700 ? 'fitxes' : 'taula';
  }

  function canviarVista_(nova) {
    vista = nova;
    try { localStorage.setItem('eeExcelVista', nova); } catch (err) { /* res */ }
    if (dades) render_();
  }

  async function loadActiveTab() {
    if (!State.getSheetIdOficial()) return;
    if (!dades) {
      document.getElementById('excel-cards').innerHTML = Util.skeletonCards(5);
      document.getElementById('excel-cards').classList.remove('hidden');
      document.getElementById('excel-table-wrap').classList.add('hidden');
    }
    try {
      dades = await Api.call('getSheetData', { sheetId: State.getSheetIdOficial() });
      render_();
    } catch (err) {
      if (!dades) document.getElementById('excel-cards').innerHTML = '';
      Util.showToast('Excel oficial: ' + err.message, 'error');
    }
  }

  function normalitzar_(text) {
    return String(text == null ? '' : text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  // Cada fila amb el nom de l'alumne/a al qual pertany: les files sense nom
  // (convenis addicionals) són de l'últim alumne/a de més amunt, igual que
  // ho entén el Dashboard; una fila buida talla el grup.
  function filesAmbAlumne_() {
    let nomActual = '';
    return dades.rows.map(function (r) {
      const nom = String(r.values[COL_NOM] || '').trim();
      const teContingut = r.values.some(function (v) { return v !== '' && v !== null; });
      if (nom) nomActual = nom;
      else if (!teContingut) nomActual = '';
      return { fila: r, alumne: nom || nomActual, esContinuacio: !nom && teContingut && !!nomActual, buida: !teContingut };
    });
  }

  function filesFiltrades_() {
    const q = normalitzar_(cerca);
    return filesAmbAlumne_().filter(function (x) {
      if (!q) return true;
      return normalitzar_(x.alumne).indexOf(q) !== -1 || normalitzar_(x.fila.values[COL_EMPRESA]).indexOf(q) !== -1;
    });
  }

  function render_() {
    document.getElementById('excel-empty-notice').classList.toggle('hidden', dades.rows.length !== 0);
    document.querySelectorAll('#section-excel .segmented-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.vista === vista);
      b.setAttribute('aria-pressed', String(b.dataset.vista === vista));
    });

    const llista = filesFiltrades_();
    const resultat = document.getElementById('excel-resultat');
    resultat.textContent = cerca.trim() ? (llista.length + (llista.length === 1 ? ' fila trobada' : ' files trobades')) : '';

    const cards = document.getElementById('excel-cards');
    const tableWrap = document.getElementById('excel-table-wrap');
    cards.classList.toggle('hidden', vista !== 'fitxes');
    tableWrap.classList.toggle('hidden', vista !== 'taula');
    if (vista === 'fitxes') {
      cards.innerHTML = llista.length ? llista.map(renderFitxa_).join('') : '<p class="empty-text">Cap fila coincideix amb la cerca.</p>';
    } else {
      renderGrid(llista);
    }
  }

  // ---- Vista de fitxes ----

  function renderFitxa_(x) {
    const r = x.fila;
    const oberta = fitxesObertes.has(r.row);
    const titol = x.buida ? '(fila buida)' : x.esContinuacio ? '↳ Un altre conveni de ' + x.alumne : x.alumne;
    const empresa = String(r.values[COL_EMPRESA] || '').trim();
    const sub = (empresa || 'Sense empresa') + ' · fila ' + r.row;
    return '<article class="excel-card' + (oberta ? ' excel-card-open' : '') + (x.esContinuacio ? ' excel-card-cont' : '') + '" data-row="' + r.row + '">' +
      '<button type="button" class="excel-card-head" aria-expanded="' + oberta + '">' +
      '<span class="excel-card-id"><span class="excel-card-title">' + Util.escapeHtml(titol) + '</span>' +
      '<span class="excel-card-sub">' + Util.escapeHtml(sub) + '</span></span>' +
      '<span class="excel-card-chevron" aria-hidden="true">›</span>' +
      '</button>' +
      (oberta ? renderCosFitxa_(r) : '') +
      '</article>';
  }

  function renderCosFitxa_(r) {
    const usades = {};
    const grups = GRUPS.map(function (g) {
      const cols = g.cols.filter(function (c) { return c < dades.headers.length; });
      cols.forEach(function (c) { usades[c] = true; });
      return { titol: g.titol, cols: cols };
    });
    const altres = dades.headers.map(function (h, i) { return i; }).filter(function (i) { return !usades[i]; });
    if (altres.length) grups.push({ titol: 'Altres', cols: altres });

    return '<div class="excel-card-body">' +
      grups.map(function (g) {
        return '<section class="excel-group"><h3 class="section-label">' + Util.escapeHtml(g.titol) + '</h3>' +
          '<div class="excel-fields">' + g.cols.map(function (c) { return renderCamp_(r, c); }).join('') + '</div></section>';
      }).join('') +
      '<button type="button" class="btn-secondary btn-sm add-row-btn-card" data-after-row="' + r.row + '">＋ Afegir un conveni a sota</button>' +
      '</div>';
  }

  function renderCamp_(r, colIdx) {
    const id = 'ex-' + r.row + '-' + (colIdx + 1);
    const tipus = dades.columnTypes[colIdx] || { tipus: 'text' };
    const value = r.values[colIdx];
    const attrs = 'id="' + id + '" data-row="' + r.row + '" data-col="' + (colIdx + 1) + '"';
    let control;
    if (tipus.tipus === 'select' && tipus.opcions) {
      control = '<select ' + attrs + '>' + opcionsHtml_(tipus.opcions, value) + '</select>';
    } else if (tipus.tipus === 'data') {
      control = '<input type="date" ' + attrs + ' value="' + (value ? String(value).slice(0, 10) : '') + '">';
    } else if (colIdx === COL_OBSERVACIONS) {
      control = '<textarea rows="3" ' + attrs + '>' + Util.escapeHtml(value) + '</textarea>';
    } else {
      control = '<input type="text" ' + attrs + ' value="' + Util.escapeHtml(value) + '">';
    }
    const ample = colIdx === COL_OBSERVACIONS || colIdx === COL_NOM || colIdx === COL_EMPRESA ? ' excel-field-wide' : '';
    return '<div class="excel-field' + ample + '"><label for="' + id + '">' + Util.escapeHtml(dades.headers[colIdx]) + '</label>' + control + '</div>';
  }

  function opcionsHtml_(opcions, value) {
    // Si la cel·la té un valor que ja no és a la llista, es manté visible
    // perquè no es perdi en desar un altre camp.
    const totes = value && opcions.indexOf(value) === -1 ? opcions.concat([value]) : opcions;
    return ['<option value=""></option>'].concat(totes.map(function (opt) {
      return '<option value="' + Util.escapeHtml(opt) + '"' + (opt === value ? ' selected' : '') + '>' + Util.escapeHtml(opt) + '</option>';
    })).join('');
  }

  function onCardsClick_(ev) {
    const afegir = ev.target.closest('.add-row-btn-card');
    if (afegir) { onAddRow(afegir); return; }
    const head = ev.target.closest('.excel-card-head');
    if (!head) return;
    const row = Number(head.closest('.excel-card').dataset.row);
    if (fitxesObertes.has(row)) fitxesObertes.delete(row); else fitxesObertes.add(row);
    render_();
  }

  function onCardsChange_(ev) {
    const el = ev.target;
    if (!el.dataset || !el.dataset.col) return;
    saveCell(el, el.value);
  }

  async function onConfigurarFullNou() {
    const btn = document.getElementById('excel-configurar-full-btn');
    btn.disabled = true;
    try {
      const data = await Api.call('configurarFullOficial', { sheetId: State.getSheetIdOficial() });
      Util.showToast((data.canvis || []).join(' · ') || 'Full preparat.');
      loadActiveTab();
    } catch (err) {
      Util.showToast('No s\'ha pogut preparar el full: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // ---- Vista de taula ----

  function renderGrid(llista) {
    const data = dades;
    const table = document.getElementById('excel-table');
    const theadCells = '<th class="add-row-col"></th>' + data.headers.map(function (h, idx) {
      return '<th' + (idx === 0 ? ' class="sticky-col"' : '') + '>' + Util.escapeHtml(h) + '</th>';
    }).join('');
    const bodyRows = llista.map(function (x) {
      const rowObj = x.fila;
      const addRowBtn = '<td class="add-row-col"><button class="add-row-btn" data-after-row="' + rowObj.row +
        '" title="Insereix una fila nova (nou conveni) just després d\'aquesta">+</button></td>';
      const cells = rowObj.values.map(function (value, colIdx) {
        return renderCell(value, rowObj.row, colIdx, data.columnTypes[colIdx] || { tipus: 'text' });
      }).join('');
      return '<tr>' + addRowBtn + cells + '</tr>';
    }).join('');

    table.innerHTML = '<thead><tr>' + theadCells + '</tr></thead><tbody>' + bodyRows + '</tbody>';
    wireCellEvents(table);
  }

  function renderCell(value, row, colIdx, columnType) {
    const attrs = 'data-row="' + row + '" data-col="' + (colIdx + 1) + '"';
    const claseTd = colIdx === 0 ? ' class="sticky-col"' : '';
    if (columnType.tipus === 'select' && columnType.opcions) {
      return '<td' + claseTd + '><select ' + attrs + '>' + opcionsHtml_(columnType.opcions, value) + '</select></td>';
    }
    if (columnType.tipus === 'data') {
      const dateVal = value ? String(value).slice(0, 10) : '';
      return '<td' + claseTd + '><input type="date" ' + attrs + ' value="' + dateVal + '"></td>';
    }
    return '<td' + claseTd + ' contenteditable="true" ' + attrs + '>' + Util.escapeHtml(value) + '</td>';
  }

  function wireCellEvents(table) {
    table.querySelectorAll('select').forEach(function (el) {
      el.addEventListener('change', function () { saveCell(el, el.value); });
    });
    table.querySelectorAll('input[type="date"]').forEach(function (el) {
      el.addEventListener('change', function () { saveCell(el, el.value); });
    });
    table.querySelectorAll('td[contenteditable="true"]').forEach(function (el) {
      el.addEventListener('blur', function () { saveCell(el, el.textContent); });
    });
    table.querySelectorAll('.add-row-btn').forEach(function (el) {
      el.addEventListener('click', function () { onAddRow(el); });
    });
  }

  async function onAddRow(btn) {
    const afterRow = Number(btn.dataset.afterRow);
    btn.disabled = true;
    try {
      await Api.call('insertRow', { sheetId: State.getSheetIdOficial(), afterRow: afterRow });
      Util.showToast('Fila afegida.');
      loadActiveTab();
    } catch (err) {
      Util.showToast('No s\'ha pogut afegir la fila: ' + err.message, 'error');
      btn.disabled = false;
    }
  }

  async function saveCell(el, value) {
    const row = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    const cell = el.tagName === 'TD' ? el : el.closest('td, .excel-field');
    try {
      await Api.call('updateCell', { sheetId: State.getSheetIdOficial(), row: row, col: col, value: value });
      const fila = dades && dades.rows.find(function (r) { return r.row === row; });
      if (fila) fila.values[col - 1] = value;
      flashCell(cell, 'saved');
    } catch (err) {
      flashCell(cell, 'save-error');
      Util.showToast('No s\'ha pogut desar: ' + err.message, 'error');
    }
  }

  function flashCell(cell, cls) {
    cell.classList.add(cls);
    setTimeout(function () { cell.classList.remove(cls); }, 1200);
  }

  return { init: init, loadActiveTab: loadActiveTab };
})();
