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

  async function load() {
    const wrap = document.getElementById('dashboard-no-sheet');
    const tiles = document.getElementById('dashboard-tiles');
    const students = document.getElementById('dashboard-students');

    if (!State.getSheetIdOficial()) {
      wrap.classList.remove('hidden');
      tiles.innerHTML = '';
      students.innerHTML = '';
      return;
    }
    wrap.classList.add('hidden');

    try {
      const data = await Api.call('getDashboard', { sheetId: State.getSheetIdOficial() });
      renderTiles(tiles, data.tiles);
      renderStudents(students, data.alumnes);
    } catch (err) {
      Util.showToast('Dashboard: ' + err.message, 'error');
    }
  }

  function renderTiles(container, tileData) {
    container.innerHTML = Object.keys(tileData).map(function (key) {
      const label = TILE_LABELS[key] || key;
      return '<div class="tile"><div class="tile-value">' + tileData[key] +
        '</div><div class="tile-label">' + Util.escapeHtml(label) + '</div></div>';
    }).join('');
  }

  function renderStudents(container, alumnes) {
    if (!alumnes.length) {
      container.innerHTML = '<p class="hint-text">Encara no hi ha alumnes al full oficial.</p>';
      return;
    }
    container.innerHTML = alumnes.map(function (a) {
      const estatKey = a.finalitzat ? 'finalitzat' : (a.actiu ? 'actiu' : 'inactiu');
      const badgeClass = a.finalitzat ? 'done' : (a.faltaDocument ? '' : 'current');
      return '<div class="student-card">' +
        '<div class="student-name">' + Util.escapeHtml(a.nom) + '</div>' +
        '<div class="student-fase">' + Util.escapeHtml(a.empresa || 'Sense empresa assignada') + '</div>' +
        '<div class="fase-track">' +
        '<span class="fase-dot ' + badgeClass + '" title="' + Util.escapeHtml(ESTAT_LABELS[estatKey]) + '"></span>' +
        '</div>' +
        '<div class="hint-text">' + Util.escapeHtml(ESTAT_LABELS[estatKey]) +
        (a.faltaDocument && !a.finalitzat ? ' · falta documentació' : '') + '</div>' +
        '</div>';
    }).join('');
  }

  return { load: load };
})();
