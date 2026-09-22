class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const Api = (function () {
  // IMPORTANT: cal Content-Type: text/plain per evitar que el navegador faci un
  // preflight OPTIONS que Apps Script no pot respondre (trencaria totes les crides).
  // `payload` ha d'incloure explícitament `sheetId` (Dashboard/Excel oficial i
  // Enviar correus fan servir Sheets diferents, no hi ha cap valor per defecte).
  async function call(action, payload) {
    const body = {
      action: action,
      password: State.getPassword(),
      payload: payload || {}
    };

    let res;
    try {
      res = await fetch(CONFIG.EXEC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new ApiError('NETWORK_ERROR', 'No s\'ha pogut contactar amb l\'aplicació web.');
    }

    let json;
    try {
      json = await res.json();
    } catch (err) {
      throw new ApiError('BAD_RESPONSE', 'Resposta inesperada del servidor.');
    }

    // Apps Script Web Apps sempre retornen HTTP 200; l'èxit/error només es
    // senyalitza amb el camp "ok" del cos JSON.
    if (!json.ok) {
      const err = json.error || {};
      // Qualsevol acció (excepte el propi login, que ja gestiona el seu error
      // a la pantalla d'entrada) que rebi UNAUTHORIZED vol dir que la
      // contrasenya d'aquesta sessió ja no és vàlida — es torna a la
      // pantalla d'entrada amb una explicació, en lloc de deixar que cada
      // acció falli per separat amb un missatge confús.
      if (err.code === 'UNAUTHORIZED' && action !== 'login') {
        Auth.sessionExpired();
      }
      throw new ApiError(err.code || 'SERVER_ERROR', err.message || 'Error desconegut');
    }
    return json.data;
  }

  return { call: call };
})();
