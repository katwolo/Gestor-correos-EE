const Auth = (function () {
  // Diàleg de contrasenya. demanar() retorna una promesa amb la contrasenya
  // nova (ja desada) o null si l'usuari cancel·la. Si ja hi ha un diàleg
  // obert, totes les crides comparteixen la mateixa promesa.
  let pendent = null;
  let resoldre = null;

  function init() {
    document.getElementById('password-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      const input = document.getElementById('password-input');
      const valor = input.value;
      if (!valor) { input.focus(); return; }
      State.setPassword(valor);
      tancar(valor);
    });
    document.getElementById('password-cancel').addEventListener('click', function () { tancar(null); });

    document.getElementById('password-change-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      const input = document.getElementById('password-change-input');
      const status = document.getElementById('password-change-status');
      if (!input.value) { status.textContent = 'Escriu la contrasenya.'; return; }
      State.setPassword(input.value);
      input.value = '';
      status.textContent = 'Contrasenya desada en aquest dispositiu.';
    });
  }

  function demanar(incorrecta) {
    if (pendent) return pendent;
    const modal = document.getElementById('password-modal');
    const input = document.getElementById('password-input');
    document.getElementById('password-error').classList.toggle('hidden', !incorrecta);
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(function () { input.focus(); }, 30);
    pendent = new Promise(function (res) { resoldre = res; });
    return pendent;
  }

  function tancar(valor) {
    document.getElementById('password-modal').classList.add('hidden');
    const r = resoldre;
    pendent = null;
    resoldre = null;
    if (r) r(valor);
  }

  return { init: init, demanar: demanar };
})();
