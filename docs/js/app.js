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

    Auth.init();
  }

  function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
  function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

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
