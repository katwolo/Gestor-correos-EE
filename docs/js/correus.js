const Correus = (function () {
  let alumnes = [];
  let plantilles = [];

  function init() {
    document.getElementById('correus-alumne').addEventListener('change', onSeleccio);
    document.getElementById('correus-plantilla').addEventListener('change', onSeleccio);
    document.getElementById('correus-enviar').addEventListener('click', onEnviar);
    State.on('sheetId', refreshGate);
    refreshGate();
  }

  function refreshGate() {
    const has = !!State.getSheetId();
    document.getElementById('correus-no-sheet').classList.toggle('hidden', has);
    document.getElementById('correus-form').classList.toggle('hidden', !has);
    if (has) loadOptions();
  }

  async function loadOptions() {
    try {
      const [alumnesData, plantillesData] = await Promise.all([
        Api.call('getStudents', {}),
        Api.call('getPlantilles', {})
      ]);
      alumnes = alumnesData.alumnes;
      plantilles = plantillesData.plantilles;

      const selAlumne = document.getElementById('correus-alumne');
      selAlumne.innerHTML = '<option value="">-- Selecciona --</option>' + alumnes.map(function (a) {
        return '<option value="' + a.row + '">' + Util.escapeHtml(a.nomAlumne) + '</option>';
      }).join('');

      const selPlantilla = document.getElementById('correus-plantilla');
      selPlantilla.innerHTML = '<option value="">-- Selecciona --</option>' + plantilles.map(function (p) {
        return '<option value="' + Util.escapeHtml(p.nom) + '">' + Util.escapeHtml(p.nom) + '</option>';
      }).join('');
    } catch (err) {
      Util.showToast('Enviar correus: ' + err.message, 'error');
    }
  }

  async function onSeleccio() {
    const alumneRow = document.getElementById('correus-alumne').value;
    const plantillaNom = document.getElementById('correus-plantilla').value;
    if (!alumneRow || !plantillaNom) return;

    try {
      const data = await Api.call('previewCorreu', { alumneRow: Number(alumneRow), plantillaNom: plantillaNom });
      document.getElementById('correus-assumpte').value = data.assumpte;
      document.getElementById('correus-cos').innerHTML = data.cos;
    } catch (err) {
      Util.showToast('No s\'ha pogut generar la previsualització: ' + err.message, 'error');
    }
  }

  async function onEnviar() {
    const alumneRow = document.getElementById('correus-alumne').value;
    const plantillaNom = document.getElementById('correus-plantilla').value;
    const assumpte = document.getElementById('correus-assumpte').value;
    const cos = document.getElementById('correus-cos').innerHTML;
    const adjunts = document.getElementById('correus-adjunts').value;
    const resultatEl = document.getElementById('correus-resultat');

    if (!alumneRow || !plantillaNom) {
      Util.showToast('Selecciona alumne/a i plantilla.', 'error');
      return;
    }
    if (!confirm('Segur que vols enviar aquest correu?')) return;

    const btn = document.getElementById('correus-enviar');
    btn.disabled = true;
    resultatEl.textContent = 'Enviant...';

    try {
      const data = await Api.call('enviarCorreu', {
        alumneRow: Number(alumneRow), plantillaNom: plantillaNom,
        assumpte: assumpte, cos: cos, adjunts: adjunts
      });
      const enviatsTxt = data.enviats.length ? 'Enviat a: ' + data.enviats.join(', ') : 'Cap enviament realitzat.';
      const errorsTxt = data.errors.length ? ' | Errors: ' + data.errors.map(function (e) { return e.destinatari + ' (' + e.error + ')'; }).join(', ') : '';
      const avisosTxt = data.avisos.length ? ' | Avisos: ' + data.avisos.join(', ') : '';
      resultatEl.textContent = enviatsTxt + errorsTxt + avisosTxt;
      Util.showToast(data.errors.length ? 'Enviat amb errors' : 'Correu enviat', data.errors.length ? 'error' : undefined);
    } catch (err) {
      resultatEl.textContent = 'Error: ' + err.message;
      Util.showToast('No s\'ha pogut enviar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  return { init: init };
})();
