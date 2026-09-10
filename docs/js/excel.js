const Excel = (function () {
  function init() {
    document.getElementById('sheet-link-save').addEventListener('click', onSaveLink);
    document.getElementById('excel-configurar-full-btn').addEventListener('click', onConfigurarFullNou);

    const input = document.getElementById('sheet-link-input');
    const existing = State.getSheetIdOficial();
    if (existing) input.value = 'https://docs.google.com/spreadsheets/d/' + existing;

    State.on('sheetIdOficial', function () { refreshGate(); });
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

  async function loadActiveTab() {
    if (!State.getSheetIdOficial()) return;
    try {
      const data = await Api.call('getSheetData', { sheetId: State.getSheetIdOficial() });
      renderGrid(data);
    } catch (err) {
      Util.showToast('Excel oficial: ' + err.message, 'error');
    }
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

  function renderGrid(data) {
    document.getElementById('excel-empty-notice').classList.toggle('hidden', data.rows.length !== 0);
    const table = document.getElementById('excel-table');
    const theadCells = '<th class="add-row-col"></th>' + data.headers.map(function (h, idx) {
      return '<th' + (idx === 0 ? ' class="sticky-col"' : '') + '>' + Util.escapeHtml(h) + '</th>';
    }).join('');
    const bodyRows = data.rows.map(function (rowObj) {
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
      const options = ['<option value=""></option>'].concat(columnType.opcions.map(function (opt) {
        return '<option value="' + Util.escapeHtml(opt) + '"' + (opt === value ? ' selected' : '') + '>' + Util.escapeHtml(opt) + '</option>';
      })).join('');
      return '<td' + claseTd + '><select ' + attrs + '>' + options + '</select></td>';
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
    const cell = el.tagName === 'TD' ? el : el.closest('td');
    try {
      await Api.call('updateCell', { sheetId: State.getSheetIdOficial(), row: row, col: col, value: value });
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
