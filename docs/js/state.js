const State = (function () {
  const listeners = {};
  const data = {
    password: null, // només en memòria, mai a localStorage
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

  function getSheetIdCorreus() { return data.sheetIdCorreus; }

  function setSheetIdCorreus(id) {
    data.sheetIdCorreus = id;
    if (id) localStorage.setItem('eeSheetIdCorreus', id);
    else localStorage.removeItem('eeSheetIdCorreus');
    emit('sheetIdCorreus', id);
  }

  function setPassword(password) {
    data.password = password;
    emit('auth', !!password);
  }

  function clearPassword() {
    data.password = null;
    emit('auth', false);
  }

  function getPassword() { return data.password; }

  return {
    on: on, emit: emit,
    getSheetIdOficial: getSheetIdOficial, setSheetIdOficial: setSheetIdOficial,
    getSheetIdCorreus: getSheetIdCorreus, setSheetIdCorreus: setSheetIdCorreus,
    setPassword: setPassword, clearPassword: clearPassword, getPassword: getPassword
  };
})();
