const Auth = (function () {
  function init() {
    if (!window.google || !google.accounts || !google.accounts.id) {
      // La llibreria de Google encara no ha carregat; ho reintentem un moment després.
      setTimeout(init, 300);
      return;
    }
    if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID === 'PENDENT_DE_CONFIGURAR') {
      showLoginError('Falta configurar GOOGLE_CLIENT_ID a docs/js/config.js.');
      return;
    }
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { theme: 'outline', size: 'large', text: 'signin_with' }
    );
  }

  async function handleCredentialResponse(response) {
    const idToken = response.credential;
    State.setAuth(idToken, null); // provisional, perquè Api.call llegeix el token de State
    try {
      const data = await Api.call('whoami', {});
      State.setAuth(idToken, data.email);
      showLoginError('');
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app-shell').classList.remove('hidden');
      document.getElementById('user-email').textContent = data.email;
      App.onAuthenticated();
    } catch (err) {
      State.clearAuth();
      if (err.code === 'FORBIDDEN') {
        showLoginError('Aquest compte no té accés a l\'aplicació.');
      } else {
        showLoginError('No s\'ha pogut iniciar sessió: ' + err.message);
      }
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
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
    State.clearAuth();
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
  }

  return { init: init, logout: logout };
})();
