const Excel = (function () {
  let activeTab = 'Enviament';

  function init() {
    document.getElementById('sheet-link-save').addEventListener('click', onSaveLink);
    document.getElementById('configurar-full-btn').addEventListener('click', onConfigurar);
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn[data-tab]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        loadActiveTab();
      });
    });

    const input = document.getElementById('sheet-link-input');
    const existing = State.getSheetId();
    if (existing) input.value = 'https://docs.google.com/spreadsheets/d/' + existing;

    State.on('sheetId', function () { refreshGate(); });
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
    State.setSheetId(id);
    status.textContent = 'Enllaç desat.';
    refreshGate();
  }

  function refreshGate() {
    const has = !!State.getSheetId();
    document.getElementById('excel-no-sheet').classList.toggle('hidden', has);
    document.getElementById('excel-grid-wrap').classList.toggle('hidden', !has);
    if (has) loadActiveTab();
  }

  async function onConfigurar() {
    if (!State.getSheetId()) return;
    if (!confirm('Això prepara el full "Enviament" (columnes Q-U, desplegable de plantilles) i "Registre". Es pot executar diverses vegades sense problema. Continuar?')) return;
    try {
      const data = await Api.call('configurarFull', {});
      Util.showToast('Full configurat: ' + data.canvis.length + ' canvi(s) aplicat(s).');
      loadActiveTab();
    } catch (err) {
      Util.showToast('No s\'ha pogut configurar: ' + err.message, 'error');
    }
  }

  async function loadActiveTab() {
    if (!State.getSheetId()) return;
    try {
      const data = await Api.call('getSheetData', { sheetName: activeTab });
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
        return renderCell(value, rowObj.row, colIdx, data.columnTypes[colIdx] || 'text', data.editable);
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');

    table.innerHTML = '<thead><tr>' + theadCells + '</tr></thead><tbody>' + bodyRows + '</tbody>';

    if (data.editable) wireCellEvents(table);
  }

  function renderCell(value, row, colIdx, tipus, editable) {
    const attrs = 'data-row="' + row + '" data-col="' + (colIdx + 1) + '"';
    if (!editable) {
      const text = tipus === 'checkbox' ? (value ? '✅' : '') : Util.escapeHtml(value);
      return '<td>' + text + '</td>';
    }
    if (tipus === 'checkbox') {
      return '<td><input type="checkbox" ' + attrs + ' ' + (value ? 'checked' : '') + '></td>';
    }
    if (tipus === 'data') {
      const dateVal = value ? String(value).slice(0, 10) : '';
      return '<td><input type="date" ' + attrs + ' value="' + dateVal + '"></td>';
    }
    if (tipus === 'html') {
      return '<td><textarea rows="3" ' + attrs + '>' + Util.escapeHtml(value) + '</textarea></td>';
    }
    return '<td contenteditable="true" ' + attrs + '>' + Util.escapeHtml(value) + '</td>';
  }

  function wireCellEvents(table) {
    table.querySelectorAll('input[type="checkbox"]').forEach(function (el) {
      el.addEventListener('change', function () { saveCell(el, el.checked); });
    });
    table.querySelectorAll('input[type="date"]').forEach(function (el) {
      el.addEventListener('change', function () { saveCell(el, el.value); });
    });
    table.querySelectorAll('textarea').forEach(function (el) {
      el.addEventListener('blur', function () { saveCell(el, el.value); });
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
      await Api.call('updateCell', { sheetName: activeTab, row: row, col: col, value: value });
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
