const State = (function () {
  const listeners = {};
  const data = {
    sheetIdOficial: localStorage.getItem('eeSheetIdOficial') || null, // Dashboard / Excel oficial (roster)
    sheetIdCorreus: localStorage.getItem('eeSheetIdCorreus') || null  // Enviar correus (Enviament/Plantilles/Registre)
  };

  function on(event, cb) {
    (listeners[event] = listeners[event] || []).push(cb);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(function (cb) { cb(payload); });
  }

  function getSheetIdOficial() { return data.sheetIdOficial; }

  function setSheetIdOficial(id) {
    data.sheetIdOficial = id;
    if (id) localStorage.setItem('eeSheetIdOficial', id);
    else localStorage.removeItem('eeSheetIdOficial');
    emit('sheetIdOficial', id);
  }

  // Contrasenya de la web: es desa en aquest dispositiu sense caducitat, i
  // només es torna a demanar si el servidor diu que falta o és incorrecta.
  function getPassword() {
    try { return localStorage.getItem('eePassword') || ''; } catch (err) { return ''; }
  }
  function setPassword(pw) {
    try {
      if (pw) localStorage.setItem('eePassword', pw);
      else localStorage.removeItem('eePassword');
    } catch (err) { /* navegador sense localStorage: es tornarà a demanar */ }
  }

  function getSheetIdCorreus() { return data.sheetIdCorreus; }

  function setSheetIdCorreus(id) {
    data.sheetIdCorreus = id;
    if (id) localStorage.setItem('eeSheetIdCorreus', id);
    else localStorage.removeItem('eeSheetIdCorreus');
    emit('sheetIdCorreus', id);
  }

  return {
    on: on, emit: emit,
    getSheetIdOficial: getSheetIdOficial, setSheetIdOficial: setSheetIdOficial,
    getSheetIdCorreus: getSheetIdCorreus, setSheetIdCorreus: setSheetIdCorreus,
    getPassword: getPassword, setPassword: setPassword
  };
})();
