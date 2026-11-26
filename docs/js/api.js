class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const Api = (function () {
  // Accions de només lectura: es poden reintentar automàticament si falla
  // per xarxa/timeout, perquè repetir-les no té cap efecte secundari.
  const ACCIONS_LECTURA = ['ping', 'getDashboard', 'getSheetData', 'getPlantilles', 'getStudents', 'getProgramats', 'getRegistre', 'previewCorreu', 'getConveniComplet'];
  const TIMEOUT_MS = 20000;

  // IMPORTANT: cal Content-Type: text/plain per evitar que el navegador faci un
  // preflight OPTIONS que Apps Script no pot respondre (trencaria totes les crides).
  // `payload` ha d'incloure explícitament `sheetId` (Dashboard/Excel oficial i
  // Enviar correus fan servir Sheets diferents, no hi ha cap valor per defecte).
  // Si el servidor contesta que falta la contrasenya o que és incorrecta, es
  // demana a l'usuari (un sol diàleg encara que hi hagi diverses crides en
  // curs) i es repeteix la crida. Si l'usuari cancel·la, es propaga l'error.
  async function call(action, payload) {
    for (;;) {
      try {
        return await callAmbReintents_(action, payload);
      } catch (err) {
        if (err.code !== 'AUTH_REQUIRED' && err.code !== 'WRONG_PASSWORD') throw err;
        const novaContrasenya = await Auth.demanar(err.code === 'WRONG_PASSWORD');
        if (!novaContrasenya) throw err;
      }
    }
  }

  async function callAmbReintents_(action, payload) {
    const esLectura = ACCIONS_LECTURA.indexOf(action) !== -1;
    const maxIntents = esLectura ? 2 : 1;

    let ultimError;
    for (let intent = 1; intent <= maxIntents; intent++) {
      try {
        return await ferCrida_(action, payload);
      } catch (err) {
        ultimError = err;
        // Només es reintenta un cop, i només si el problema ha estat de
        // connexió/timeout (el servidor no ha arribat a contestar): mai si
        // ja ha respost amb un error propi, i mai en escriptures/enviaments.
        const reintentable = esLectura && intent < maxIntents && (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT');
        if (!reintentable) throw err;
      }
    }
    throw ultimError;
  }

  async function ferCrida_(action, payload) {
    const body = { action: action, payload: payload || {}, password: State.getPassword() };
    const controller = new AbortController();
    const timeoutId = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

    let res;
    try {
      res = await fetch(CONFIG.EXEC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'El servidor triga massa a respondre. Torna-ho a provar.');
      }
      throw new ApiError('NETWORK_ERROR', 'No s\'ha pogut contactar amb l\'aplicació web.');
    } finally {
      clearTimeout(timeoutId);
    }

    // Es llegeix com a text (en lloc de res.json() directament) perquè, si
    // Google no ha tornat JSON vàlid (p.ex. una pàgina d'error d'autorització),
    // es pugui incloure un resum del que ha arribat en lloc d'un missatge genèric.
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      const resum = text ? text.slice(0, 200).replace(/\s+/g, ' ').trim() : '(resposta buida)';
      throw new ApiError('BAD_RESPONSE', 'Resposta inesperada del servidor: ' + resum);
    }

    // Apps Script Web Apps sempre retornen HTTP 200; l'èxit/error només es
    // senyalitza amb el camp "ok" del cos JSON.
    if (!json.ok) {
      const err = json.error || {};
      throw new ApiError(err.code || 'SERVER_ERROR', err.message || 'Error desconegut');
    }
    return json.data;
  }

  return { call: call };
})();
