const Dashboard = (function () {
  const TILE_LABELS = {
    actius: 'Actius',
    finalitzats: 'Finalitzats',
    pendentsDocumentacio: 'Pendents de documentació',
    ambExempcio: 'Amb exempció de pràctiques',
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
    pendentsDocumentacio: function (a) { return a.actiu && a.faltaDocument; },
    ambExempcio: function (a) { return a.teExempcio; }
  };

  let alumnesActuals = [];
  let filtreActiu = null;
  let cercaText = '';

  function init() {
    const input = document.getElementById('dashboard-cerca-alumne');
    input.addEventListener('input', Util.debounce(function (ev) {
      cercaText = ev.target.value;
      renderStudents(document.getElementById('dashboard-students'));
    }, 150));
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
      return;
    }
    wrap.classList.add('hidden');
    cerca.classList.remove('hidden');

    try {
      const data = await Api.call('getDashboard', { sheetId: State.getSheetIdOficial() });
      alumnesActuals = data.alumnes;
      filtreActiu = null;
      cercaText = '';
      cerca.value = '';
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

    const clearBtn = document.getElementById('dashboard-clear-filter');
    if (clearBtn) clearBtn.addEventListener('click', function () { onTileClick(filtreActiu); });
  }

  function renderStudentCard(a) {
    const estatKey = a.finalitzat ? 'finalitzat' : (a.actiu ? 'actiu' : 'inactiu');
    return '<div class="student-card">' +
      '<div class="student-name">' + Util.escapeHtml(a.nom) + '</div>' +
      '<div class="student-fase">' + Util.escapeHtml(a.empresa || 'Sense empresa assignada') + '</div>' +
      renderHoresBar(a) +
      renderFaseBar(a) +
      '<div class="hint-text">' + Util.escapeHtml(ESTAT_LABELS[estatKey]) +
      (a.faltaDocument && !a.finalitzat ? ' · falta documentació' : '') +
      (a.teExempcio ? ' · <strong>Exempció: ' + Util.escapeHtml(a.exempcio) + '</strong>' : '') + '</div>' +
      '</div>';
  }

  function renderProgressBar(percent, colorClass, label) {
    const pct = Math.max(0, Math.min(100, percent));
    return '<div class="progress-bar-wrap">' +
      '<div class="progress-bar-label">' + label + '</div>' +
      '<div class="progress-bar"><div class="progress-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }

  // Barra 1: hores fetes del quadern (515h en total, menys l'exempció) sumant
  // les hores de TOTS els convenis de l'alumne.
  function renderHoresBar(a) {
    if (a.horesObjectiu <= 0) {
      return renderProgressBar(100, 'progress-exempt', 'Quadern: exempt/a de pràctiques (100%)');
    }
    const pct = (a.horesFetes / a.horesObjectiu) * 100;
    const fetes = Math.round(a.horesFetes * 10) / 10;
    const objectiu = Math.round(a.horesObjectiu * 10) / 10;
    const pendents = Math.round(a.horesPendents * 10) / 10;
    const label = 'Quadern: ' + fetes + 'h / ' + objectiu + 'h' + (pendents > 0 ? ' · falten ' + pendents + 'h' : ' · complet');
    return renderProgressBar(pct, pct >= 100 ? 'progress-done' : 'progress-hores', Util.escapeHtml(label));
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

  return { init: init, load: load };
})();
