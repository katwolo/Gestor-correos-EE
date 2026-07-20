const State = (function () {
  const listeners = {};
  const data = {
    idToken: null,   // en memòria només, mai a localStorage (token de curta durada)
    email: null,
    sheetId: localStorage.getItem('eeSheetId') || null
  };

  function on(event, cb) {
    (listeners[event] = listeners[event] || []).push(cb);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(function (cb) { cb(payload); });
  }

  function getSheetId() { return data.sheetId; }

  function setSheetId(id) {
    data.sheetId = id;
    if (id) localStorage.setItem('eeSheetId', id);
    else localStorage.removeItem('eeSheetId');
    emit('sheetId', id);
  }

  function setAuth(idToken, email) {
    data.idToken = idToken;
    data.email = email;
    emit('auth', { idToken: idToken, email: email });
  }

  function clearAuth() {
    data.idToken = null;
    data.email = null;
    emit('auth', null);
  }

  function getIdToken() { return data.idToken; }
  function getEmail() { return data.email; }

  return {
    on: on, emit: emit,
    getSheetId: getSheetId, setSheetId: setSheetId,
    setAuth: setAuth, clearAuth: clearAuth,
    getIdToken: getIdToken, getEmail: getEmail
  };
})();
