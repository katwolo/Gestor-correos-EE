const State = (function () {
  const listeners = {};
  const data = {
    password: null, // només en memòria, mai a localStorage
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
    getSheetId: getSheetId, setSheetId: setSheetId,
    setPassword: setPassword, clearPassword: clearPassword, getPassword: getPassword
  };
})();
