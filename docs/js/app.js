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
    document.getElementById('change-password-btn').addEventListener('click', changePassword);

    Auth.init();
  }

  function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
  function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }

  // Canvia l'APP_PASSWORD des de la mateixa web. El servidor ja exigeix la
  // contrasenya actual (es manda sola a cada crida via Api.call), així que
  // aquí només cal demanar-ne una de nova; en confirmar-se, s'actualitza
  // l'State perquè la sessió actual segueixi funcionant sense haver de
  // tornar a entrar.
  async function changePassword() {
    const input = document.getElementById('new-password-input');
    const confirmInput = document.getElementById('new-password-confirm');
    const status = document.getElementById('change-password-status');
    const nova = input.value.trim();
    const repetida = confirmInput.value.trim();

    if (nova.length < 4) {
      status.textContent = 'La contrasenya ha de tenir com a mínim 4 caràcters.';
      return;
    }
    if (nova !== repetida) {
      status.textContent = 'Les dues contrasenyes no coincideixen.';
      return;
    }

    const btn = document.getElementById('change-password-btn');
    btn.disabled = true;
    status.textContent = 'Canviant...';
    try {
      await Api.call('canviarContrasenya', { novaContrasenya: nova });
      State.setPassword(nova);
      input.value = '';
      confirmInput.value = '';
      status.textContent = 'Contrasenya actualitzada.';
      Util.showToast('Contrasenya canviada correctament.');
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      Util.showToast('No s\'ha pogut canviar la contrasenya: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

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
