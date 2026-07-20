const Excel = (function () {
  function init() {
    document.getElementById('sheet-link-save').addEventListener('click', onSaveLink);

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

  function renderGrid(data) {
    const table = document.getElementById('excel-table');
    const theadCells = data.headers.map(function (h) { return '<th>' + Util.escapeHtml(h) + '</th>'; }).join('');
    const bodyRows = data.rows.map(function (rowObj) {
      const cells = rowObj.values.map(function (value, colIdx) {
        return renderCell(value, rowObj.row, colIdx, data.columnTypes[colIdx] || { tipus: 'text' });
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');

    table.innerHTML = '<thead><tr>' + theadCells + '</tr></thead><tbody>' + bodyRows + '</tbody>';
    wireCellEvents(table);
  }

  function renderCell(value, row, colIdx, columnType) {
    const attrs = 'data-row="' + row + '" data-col="' + (colIdx + 1) + '"';
    if (columnType.tipus === 'select' && columnType.opcions) {
      const options = ['<option value=""></option>'].concat(columnType.opcions.map(function (opt) {
        return '<option value="' + Util.escapeHtml(opt) + '"' + (opt === value ? ' selected' : '') + '>' + Util.escapeHtml(opt) + '</option>';
      })).join('');
      return '<td><select ' + attrs + '>' + options + '</select></td>';
    }
    if (columnType.tipus === 'data') {
      const dateVal = value ? String(value).slice(0, 10) : '';
      return '<td><input type="date" ' + attrs + ' value="' + dateVal + '"></td>';
    }
    return '<td contenteditable="true" ' + attrs + '>' + Util.escapeHtml(value) + '</td>';
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
