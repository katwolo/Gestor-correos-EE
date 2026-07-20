const Auth = (function () {
  function init() {
    document.getElementById('login-form').addEventListener('submit', onSubmit);
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const pass = document.getElementById('login-password').value;
    if (!pass) return;

    State.setPassword(pass);
    try {
      await Api.call('login', {});
      showLoginError('');
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app-shell').classList.remove('hidden');
      App.onAuthenticated();
    } catch (err) {
      State.clearPassword();
      if (err.code === 'UNAUTHORIZED') {
        showLoginError('Contrasenya incorrecta.');
      } else {
        showLoginError('No s\'ha pogut iniciar sessió: ' + err.message);
      }
    }
  }

  function showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
    else { el.textContent = ''; el.classList.add('hidden'); }
  }

  function logout() {
    State.clearPassword();
    const input = document.getElementById('login-password');
    if (input) input.value = '';
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
  }

  return { init: init, logout: logout };
})();
