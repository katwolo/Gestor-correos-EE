const Correus = (function () {
  let alumnes = [];
  let plantilles = [];
  let wizard = { step: 'alumne', alumneRow: null, plantillaNom: null, adjunts: '', assumpte: '', cos: '', destinataris: [] };

  const STEP_ORDER = ['alumne', 'plantilla', 'adjunts', 'confirmar'];
  const STEP_LABELS = { alumne: 'Alumne/a', plantilla: 'Plantilla', adjunts: 'Adjunts', confirmar: 'Confirmar' };

  function init() {
    document.getElementById('correus-sheet-link-save').addEventListener('click', onSaveLink);
    document.getElementById('configurar-full-btn').addEventListener('click', onConfigurar);

    const input = document.getElementById('correus-sheet-link-input');
    const existing = State.getSheetIdCorreus();
    if (existing) input.value = 'https://docs.google.com/spreadsheets/d/' + existing;

    State.on('sheetIdCorreus', function () { refreshGate(); });
    refreshGate();
  }

  function onSaveLink() {
    const raw = document.getElementById('correus-sheet-link-input').value.trim();
    const id = Util.extractSheetId(raw);
    const status = document.getElementById('correus-sheet-link-status');
    if (!id) {
      status.textContent = 'No s\'ha reconegut cap ID de Google Sheets en aquest enllaç.';
      return;
    }
    State.setSheetIdCorreus(id);
    status.textContent = 'Enllaç desat.';
    refreshGate();
  }

  function refreshGate() {
    const has = !!State.getSheetIdCorreus();
    document.getElementById('correus-no-sheet').classList.toggle('hidden', has);
    document.getElementById('correus-wizard').classList.toggle('hidden', !has);
    if (has) loadOptions();
  }

  async function onConfigurar() {
    if (!State.getSheetIdCorreus()) return;
    if (!confirm('Això prepara el full "Enviament" (capçaleres, caselles) i "Plantilles" (plantilles d\'exemple si cal). Es pot executar diverses vegades sense problema. Continuar?')) return;
    try {
      const data = await Api.call('configurarFull', { sheetId: State.getSheetIdCorreus() });
      Util.showToast('Full configurat: ' + data.canvis.length + ' canvi(s) aplicat(s).');
      loadOptions();
    } catch (err) {
      Util.showToast('No s\'ha pogut configurar: ' + err.message, 'error');
    }
  }

  async function loadOptions() {
    const sheetId = State.getSheetIdCorreus();
    if (!sheetId) return;
    try {
      const [alumnesData, plantillesData] = await Promise.all([
        Api.call('getStudents', { sheetId: sheetId }),
        Api.call('getPlantilles', { sheetId: sheetId })
      ]);
      alumnes = alumnesData.alumnes;
      plantilles = plantillesData.plantilles;
      resetWizard();
    } catch (err) {
      Util.showToast('Enviar correus: ' + err.message, 'error');
    }
  }

  function resetWizard() {
    wizard = { step: 'alumne', alumneRow: null, plantillaNom: null, adjunts: '', assumpte: '', cos: '', destinataris: [] };
    render();
  }

  function reload() { loadOptions(); }

  // ==== RENDER ====

  function render() {
    const root = document.getElementById('correus-wizard');
    root.innerHTML = renderStepper() + renderStepBody();
    wireStepEvents();
  }

  function renderStepper() {
    return '<div class="wizard-stepper">' + STEP_ORDER.map(function (s, i) {
      const done = STEP_ORDER.indexOf(wizard.step) > i;
      const active = wizard.step === s;
      const cls = active ? 'active' : (done ? 'done' : '');
      return '<span class="wizard-step-badge ' + cls + '">' + (i + 1) + '. ' + STEP_LABELS[s] + '</span>';
    }).join('<span class="wizard-step-arrow">→</span>') + '</div>';
  }

  function renderStepBody() {
    if (wizard.step === 'alumne') return renderAlumneStep();
    if (wizard.step === 'plantilla') return renderPlantillaStep();
    if (wizard.step === 'adjunts') return renderAdjuntsStep();
    return renderConfirmarStep();
  }

  function renderAlumneStep() {
    if (!alumnes.length) {
      return '<p class="hint-text">Encara no hi ha alumnes al full "Enviament".</p>';
    }
    return '<div class="wizard-step">' +
      '<h3>Selecciona l\'alumne/a</h3>' +
      '<select id="w-alumne" size="8">' +
      '<option value="">-- Selecciona --</option>' +
      alumnes.map(function (a) {
        return '<option value="' + a.row + '">' + Util.escapeHtml(a.nomAlumne) +
          (a.nomTutor ? ' — tutor/a: ' + Util.escapeHtml(a.nomTutor) : '') + '</option>';
      }).join('') +
      '</select>' +
      '</div>';
  }

  function renderPlantillaStep() {
    const alumne = alumnes.find(function (a) { return a.row === wizard.alumneRow; });
    const plantillaActual = plantilles.find(function (p) { return p.nom === wizard.plantillaNom; });
    return '<div class="wizard-step">' +
      '<button class="btn-link wizard-back" data-goto="alumne">← Canvia d\'alumne/a</button>' +
      '<h3>Selecciona la plantilla</h3>' +
      '<p class="hint-text">Alumne/a: <strong>' + Util.escapeHtml(alumne ? alumne.nomAlumne : '') + '</strong></p>' +
      '<select id="w-plantilla" size="6">' +
      '<option value="">-- Selecciona --</option>' +
      plantilles.map(function (p) {
        return '<option value="' + Util.escapeHtml(p.nom) + '"' + (p.nom === wizard.plantillaNom ? ' selected' : '') + '>' + Util.escapeHtml(p.nom) + '</option>';
      }).join('') +
      '</select>' +
      (plantillaActual ? '<button id="w-editar-plantilla" class="btn-link">✏️ Editar aquesta plantilla</button>' : '') +
      '<div id="w-editor-plantilla"></div>' +
      (wizard.plantillaNom ? '<button id="w-continuar-plantilla" class="btn-primary">Continuar →</button>' : '') +
      '</div>';
  }

  function renderEditorPlantilla(p) {
    const destinatariMostrat = { 'tutor/a': 'Tutor/a', alumnat: 'Alumnat', 'ambdós': 'Ambdós' }[p.destinatari] || 'Tutor/a';
    return '<div class="plantilla-editor">' +
      '<div class="form-row"><label>Destinatari</label>' +
      '<select id="w-editar-destinatari">' +
      ['Tutor/a', 'Alumnat', 'Ambdós'].map(function (opt) {
        return '<option value="' + opt + '"' + (opt === destinatariMostrat ? ' selected' : '') + '>' + opt + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="form-row"><label>Cos del correu</label>' +
      '<div id="w-editar-cos" class="cos-editable" contenteditable="true">' + p.cos + '</div></div>' +
      '<button id="w-desar-plantilla" class="btn-primary">Desa la plantilla</button> ' +
      '<button id="w-cancelar-editar" class="btn-link">Cancel·la</button>' +
      '</div>';
  }

  function renderAdjuntsStep() {
    return '<div class="wizard-step">' +
      '<button class="btn-link wizard-back" data-goto="plantilla">← Canvia de plantilla</button>' +
      '<h3>Adjunts (opcional)</h3>' +
      '<div class="form-row">' +
      '<label for="w-adjunts">Enllaços de Drive (separats per comes)</label>' +
      '<input id="w-adjunts" type="text" placeholder="https://drive.google.com/..." value="' + Util.escapeHtml(wizard.adjunts) + '">' +
      '</div>' +
      '<button id="w-continuar-adjunts" class="btn-primary">Continuar →</button>' +
      '</div>';
  }

  function renderConfirmarStep() {
    return '<div class="wizard-step">' +
      '<button class="btn-link wizard-back" data-goto="adjunts">← Canvia adjunts</button>' +
      '<h3>Confirma i envia</h3>' +
      '<p class="hint-text">Es enviarà a: <strong>' + (wizard.destinataris.length ? wizard.destinataris.map(Util.escapeHtml).join(', ') : 'cap destinatari vàlid') + '</strong></p>' +
      '<div class="form-row"><label>Assumpte</label><div class="hint-text">' + Util.escapeHtml(wizard.assumpte) + '</div></div>' +
      '<div class="form-row"><label>Cos del correu</label><div id="w-cos" class="cos-editable" contenteditable="true">' + wizard.cos + '</div></div>' +
      '<button id="w-enviar" class="btn-primary">Enviar correu</button> ' +
      '<button id="w-cancelar" class="btn-link">Cancel·la i torna a l\'inici</button>' +
      '<p id="w-resultat" class="hint-text"></p>' +
      '</div>';
  }

  // ==== EVENTS ====

  function wireStepEvents() {
    document.querySelectorAll('.wizard-back').forEach(function (btn) {
      btn.addEventListener('click', function () { wizard.step = btn.dataset.goto; render(); });
    });

    if (wizard.step === 'alumne') {
      document.getElementById('w-alumne').addEventListener('change', function (ev) {
        wizard.alumneRow = Number(ev.target.value) || null;
        if (wizard.alumneRow) { wizard.step = 'plantilla'; render(); }
      });
    }

    if (wizard.step === 'plantilla') {
      document.getElementById('w-plantilla').addEventListener('change', function (ev) {
        wizard.plantillaNom = ev.target.value || null;
        render();
      });
      const editarBtn = document.getElementById('w-editar-plantilla');
      if (editarBtn) editarBtn.addEventListener('click', onEditarPlantilla);
      const continuarBtn = document.getElementById('w-continuar-plantilla');
      if (continuarBtn) continuarBtn.addEventListener('click', function () { wizard.step = 'adjunts'; render(); });
    }

    if (wizard.step === 'adjunts') {
      document.getElementById('w-continuar-adjunts').addEventListener('click', onContinuarAdjunts);
    }

    if (wizard.step === 'confirmar') {
      document.getElementById('w-enviar').addEventListener('click', onEnviar);
      document.getElementById('w-cancelar').addEventListener('click', resetWizard);
    }
  }

  function onEditarPlantilla() {
    const p = plantilles.find(function (pl) { return pl.nom === wizard.plantillaNom; });
    if (!p) return;
    const wrap = document.getElementById('w-editor-plantilla');
    wrap.innerHTML = renderEditorPlantilla(p);
    document.getElementById('w-desar-plantilla').addEventListener('click', function () { onDesarPlantilla(p); });
    document.getElementById('w-cancelar-editar').addEventListener('click', function () { wrap.innerHTML = ''; });
  }

  async function onDesarPlantilla(p) {
    const cos = document.getElementById('w-editar-cos').innerHTML;
    const destinatari = document.getElementById('w-editar-destinatari').value;
    try {
      await Api.call('updatePlantilla', { sheetId: State.getSheetIdCorreus(), plantillaNom: p.nom, cos: cos, destinatari: destinatari });
      Util.showToast('Plantilla desada.');
      const plantillesData = await Api.call('getPlantilles', { sheetId: State.getSheetIdCorreus() });
      plantilles = plantillesData.plantilles;
      render();
    } catch (err) {
      Util.showToast('No s\'ha pogut desar la plantilla: ' + err.message, 'error');
    }
  }

  async function onContinuarAdjunts() {
    wizard.adjunts = document.getElementById('w-adjunts').value.trim();
    try {
      const data = await Api.call('previewCorreu', {
        sheetId: State.getSheetIdCorreus(), alumneRow: wizard.alumneRow, plantillaNom: wizard.plantillaNom
      });
      wizard.assumpte = data.assumpte;
      wizard.cos = data.cos;
      wizard.destinataris = data.destinataris || [];
      wizard.step = 'confirmar';
      render();
    } catch (err) {
      Util.showToast('No s\'ha pogut generar la previsualització: ' + err.message, 'error');
    }
  }

  async function onEnviar() {
    const cos = document.getElementById('w-cos').innerHTML;
    const resultatEl = document.getElementById('w-resultat');
    if (!confirm('Segur que vols enviar aquest correu?')) return;

    const btn = document.getElementById('w-enviar');
    btn.disabled = true;
    resultatEl.textContent = 'Enviant...';

    try {
      const data = await Api.call('enviarCorreu', {
        sheetId: State.getSheetIdCorreus(),
        alumneRow: wizard.alumneRow, plantillaNom: wizard.plantillaNom,
        assumpte: wizard.assumpte, cos: cos, adjunts: wizard.adjunts
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

  return { init: init, reload: reload };
})();
