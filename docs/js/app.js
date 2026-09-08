const App = (function () {
  let modulesInitialized = false;

  function init() {
    document.getElementById('logout-btn').addEventListener('click', Auth.logout);

    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { showSection(btn.dataset.section); });
    });

    document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
    document.getElementById('settings-close-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal').addEventListener('click', function (ev) {
      if (ev.target.id === 'settings-modal') closeSettingsModal();
    });
    document.getElementById('reset-web-btn').addEventListener('click', resetWeb);

    Auth.init();
  }

  function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
  function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

  // Neteja només el navegador (els dos sheetId desats i tot el que es
  // mostra): no toca res dels Google Sheets reals ni tanca la sessió.
  function resetWeb() {
    const ok = confirm('Segur que vols reiniciar la web? S\'esborraran els dos enllaços desats en aquest navegador i deixaràs de veure les dades carregades. Els teus Google Sheets no es toquen.');
    if (!ok) return;

    State.setSheetIdOficial(null);
    State.setSheetIdCorreus(null);

    document.getElementById('sheet-link-input').value = '';
    document.getElementById('sheet-link-status').textContent = '';
    document.getElementById('correus-sheet-link-input').value = '';
    document.getElementById('correus-sheet-link-status').textContent = '';

    Dashboard.load();
    closeSettingsModal();
    Util.showToast('Web reiniciada: enllaços esborrats.');
  }

  function showSection(name) {
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.section === name);
    });
    document.querySelectorAll('.app-section').forEach(function (s) {
      s.classList.toggle('active', s.id === 'section-' + name);
    });
    if (name === 'dashboard') Dashboard.load();
    if (name === 'excel') Excel.loadActiveTab();
    if (name === 'correus' && State.getSheetIdCorreus()) Correus.reload();
  }

  function onAuthenticated() {
    if (!modulesInitialized) {
      Dashboard.init();
      Excel.init();
      Correus.init();
      modulesInitialized = true;
    }
    Dashboard.load();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { onAuthenticated: onAuthenticated, showSection: showSection };
})();
