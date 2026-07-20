const Dashboard = (function () {
  const TILE_LABELS = {
    actius: 'Actius',
    finalitzats: 'Finalitzats',
    pendentsDocumentacio: 'Pendents de documentació',
    senseTutorEmail: 'Sense correu de tutor/a',
    senseContacte: 'Sense cap contacte encara',
    correusSetmanaOk: 'Correus enviats (7 dies)',
    correusSetmanaError: 'Errors d\'enviament (7 dies)'
  };

  async function load() {
    const wrap = document.getElementById('dashboard-no-sheet');
    const tiles = document.getElementById('dashboard-tiles');
    const students = document.getElementById('dashboard-students');

    if (!State.getSheetId()) {
      wrap.classList.remove('hidden');
      tiles.innerHTML = '';
      students.innerHTML = '';
      return;
    }
    wrap.classList.add('hidden');

    try {
      const data = await Api.call('getDashboard', {});
      renderTiles(tiles, data.tiles);
      renderStudents(students, data.alumnes, data.faseLabels);
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

  function renderStudents(container, alumnes, faseLabels) {
    if (!alumnes.length) {
      container.innerHTML = '<p class="hint-text">Encara no hi ha alumnes al full "Enviament".</p>';
      return;
    }
    container.innerHTML = alumnes.map(function (a) {
      const dots = a.completades.map(function (done, i) {
        const isCurrent = !a.finalitzat && !done && a.completades.slice(0, i).every(Boolean);
        const cls = done ? 'done' : (isCurrent ? 'current' : '');
        return '<span class="fase-dot ' + cls + '" title="' + Util.escapeHtml(faseLabels[i]) + '"></span>';
      }).join('');
      return '<div class="student-card">' +
        '<div class="student-name">' + Util.escapeHtml(a.nomAlumne) + '</div>' +
        '<div class="student-fase">' + Util.escapeHtml(a.etiqueta) + '</div>' +
        '<div class="fase-track">' + dots + '</div>' +
        '</div>';
    }).join('');
  }

  return { load: load };
})();
