const App = (function () {
  let modulesInitialized = false;

  function init() {
    document.getElementById('logout-btn').addEventListener('click', Auth.logout);

    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { showSection(btn.dataset.section); });
    });

    Auth.init();
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
  }

  function onAuthenticated() {
    if (!modulesInitialized) {
      Excel.init();
      Correus.init();
      modulesInitialized = true;
    }
    Dashboard.load();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { onAuthenticated: onAuthenticated, showSection: showSection };
})();
