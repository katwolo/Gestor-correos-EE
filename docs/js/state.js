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
    getSheetIdCorreus: getSheetIdCorreus, setSheetIdCorreus: setSheetIdCorreus
  };
})();
