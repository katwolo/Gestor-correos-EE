const Correus = (function () {
  let alumnes = [];
  let plantilles = [];
  let cercaAlumne = '';
  let wizard = { step: 'alumne', alumneRow: null, items: [], adjunts: '', preview: [] };

  const STEP_ORDER = ['alumne', 'tutor', 'plantilla', 'adjunts', 'confirmar'];
  const STEP_LABELS = { alumne: 'Alumne/a', tutor: 'Tutor/a', plantilla: 'Plantilles', adjunts: 'Adjunts', confirmar: 'Confirmar' };
  const STEP_ICONS = { alumne: '👤', tutor: '🏢', plantilla: '📄', adjunts: '📎', confirmar: '✅' };
  const DESTINATARI_LABELS = { 'tutor/a': 'Tutor/a', alumnat: 'Alumnat', 'ambdós': 'Ambdós' };

  function init() {
    document.getElementById('correus-sheet-link-save').addEventListener('click', onSaveLink);

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
    wizard = { step: 'alumne', alumneRow: null, items: [], adjunts: '', preview: [] };
    cercaAlumne = '';
    render();
  }

  function reload() { loadOptions(); }

  // ==== RENDER ====

  function render() {
    const root = document.getElementById('correus-wizard');
    root.innerHTML = '<div class="wizard-card">' + renderStepper() + renderStepBody() + '</div>';
    wireStepEvents();
  }

  function renderStepper() {
    return '<div class="wizard-stepper">' + STEP_ORDER.map(function (s, i) {
      const done = STEP_ORDER.indexOf(wizard.step) > i;
      const active = wizard.step === s;
      const cls = active ? 'active' : (done ? 'done' : '');
      return '<span class="wizard-step-badge ' + cls + '"><span class="wizard-step-icon">' + STEP_ICONS[s] + '</span>' + STEP_LABELS[s] + '</span>';
    }).join('<span class="wizard-step-arrow">›</span>') + '</div>';
  }

  function renderStepBody() {
    if (wizard.step === 'alumne') return renderAlumneStep();
    if (wizard.step === 'tutor') return renderTutorStep();
    if (wizard.step === 'plantilla') return renderPlantillaStep();
    if (wizard.step === 'adjunts') return renderAdjuntsStep();
    return renderConfirmarStep();
  }

  function renderAlumneStep() {
    if (!alumnes.length) {
      return '<p class="hint-text">Encara no hi ha alumnes al full "Enviament".</p>';
    }
    const filtrats = alumnes.filter(function (a) {
      return !cercaAlumne || a.nomAlumne.toLowerCase().indexOf(cercaAlumne.toLowerCase()) !== -1;
    });
    return '<div class="wizard-step">' +
      '<h3>Selecciona l\'alumne/a</h3>' +
      '<input id="w-cerca-alumne" type="text" class="wizard-search" placeholder="🔎 Cerca per nom..." value="' + Util.escapeHtml(cercaAlumne) + '">' +
      '<div class="wizard-list">' +
      (filtrats.length ? filtrats.map(function (a) {
        const tutorTxt = a.nomTutor ? ('Tutor/a: ' + a.nomTutor + (a.correuTutor ? ' (' + a.correuTutor + ')' : '')) : 'Sense tutor/a assignat';
        return '<div class="list-item" data-row="' + a.row + '">' +
          '<div class="list-item-title">' + Util.escapeHtml(a.nomAlumne) + '</div>' +
          '<div class="list-item-sub">' + Util.escapeHtml(tutorTxt) + '</div>' +
          '</div>';
      }).join('') : '<p class="hint-text">Cap alumne coincideix amb la cerca.</p>') +
      '</div>' +
      '</div>';
  }

  function renderTutorStep() {
    const alumne = alumnes.find(function (a) { return a.row === wizard.alumneRow; });
    if (!alumne) return '<p class="hint-text">Selecciona primer un alumne/a.</p>';
    return '<div class="wizard-step">' +
      '<button class="btn-link wizard-back" data-goto="alumne">← Canvia d\'alumne/a</button>' +
      '<h3>Dades del tutor/a d\'empresa</h3>' +
      '<p class="hint-text">Alumne/a: <strong>' + Util.escapeHtml(alumne.nomAlumne) + '</strong></p>' +
      '<div class="form-row"><label for="w-tutor-nom">Nom del tutor/a</label>' +
      '<input id="w-tutor-nom" type="text" value="' + Util.escapeHtml(alumne.nomTutor || '') + '"></div>' +
      '<div class="form-row"><label for="w-tutor-correu">Correu del tutor/a</label>' +
      '<input id="w-tutor-correu" type="email" value="' + Util.escapeHtml(alumne.correuTutor || '') + '"></div>' +
      '<button id="w-desar-tutor" class="btn-link">💾 Desa les dades del tutor/a</button> ' +
      '<button id="w-continuar-tutor" class="btn-primary">Continuar →</button>' +
      '<p id="w-tutor-resultat" class="hint-text"></p>' +
      '</div>';
  }

  function renderPlantillaStep() {
    const alumne = alumnes.find(function (a) { return a.row === wizard.alumneRow; });
    return '<div class="wizard-step">' +
      '<button class="btn-link wizard-back" data-goto="tutor">← Canvia el tutor/a</button>' +
      '<h3>Selecciona una o més plantilles</h3>' +
      '<p class="hint-text">Alumne/a: <strong>' + Util.escapeHtml(alumne ? alumne.nomAlumne : '') + '</strong>. ' +
      'Marca les plantilles que vulguis enviar; per a cadascuna pots triar quan (deixa la data buida per enviar-la ara mateix).</p>' +
      '<div class="wizard-list">' +
      plantilles.map(renderPlantillaItem).join('') +
      '</div>' +
      '<div id="w-editor-plantilla"></div>' +
      (wizard.items.length ? '<button id="w-continuar-plantilla" class="btn-primary">Continuar →</button>' : '') +
      '</div>';
  }

  function renderPlantillaItem(p) {
    const item = wizard.items.find(function (it) { return it.plantillaNom === p.nom; });
    const seleccionada = !!item;
    return '<div class="list-item plantilla-item' + (seleccionada ? ' list-item-selected' : '') + '">' +
      '<label class="plantilla-item-main">' +
      '<input type="checkbox" class="plantilla-check" data-plantilla="' + Util.escapeHtml(p.nom) + '"' + (seleccionada ? ' checked' : '') + '>' +
      '<span class="list-item-title">' + Util.escapeHtml(p.nom) + '</span>' +
      '<span class="destinatari-badge destinatari-' + destinatariClasse(p.destinatari) + '">' + Util.escapeHtml(DESTINATARI_LABELS[p.destinatari] || p.destinatari) + '</span>' +
      '<button type="button" class="btn-link plantilla-edit-btn" data-plantilla="' + Util.escapeHtml(p.nom) + '">✏️</button>' +
      '</label>' +
      (seleccionada
        ? '<div class="plantilla-item-date"><label>Quan? </label><input type="date" class="plantilla-date" data-plantilla="' + Util.escapeHtml(p.nom) + '" value="' + Util.escapeHtml(item.data || '') + '"><span class="hint-text"> (buit = ara mateix)</span></div>'
        : '') +
      '</div>';
  }

  function destinatariClasse(d) {
    if (d === 'alumnat') return 'alumnat';
    if (d === 'ambdós') return 'ambdos';
    return 'tutor';
  }

  function renderEditorPlantilla(p) {
    const destinatariMostrat = DESTINATARI_LABELS[p.destinatari] || 'Tutor/a';
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
      '<button class="btn-link wizard-back" data-goto="plantilla">← Canvia de plantilles</button>' +
      '<h3>Adjunts (opcional)</h3>' +
      '<div class="form-row">' +
      '<label for="w-adjunts">Enllaços de Drive (separats per comes) — s\'adjuntaran a totes les plantilles seleccionades</label>' +
      '<input id="w-adjunts" type="text" placeholder="https://drive.google.com/..." value="' + Util.escapeHtml(wizard.adjunts) + '">' +
      '</div>' +
      '<button id="w-continuar-adjunts" class="btn-primary">Continuar →</button>' +
      '</div>';
  }

  function renderConfirmarStep() {
    const files = wizard.preview.map(function (p) {
      const chips = p.destinataris.length
        ? p.destinataris.map(function (d) { return '<span class="chip">' + Util.escapeHtml(d) + '</span>'; }).join('')
        : '<span class="chip chip-warning">cap destinatari vàlid</span>';
      const quan = p.data ? ('📅 ' + p.data) : '⚡ Ara mateix';
      return '<div class="confirmar-item">' +
        '<div class="confirmar-item-header"><strong>' + Util.escapeHtml(p.plantillaNom) + '</strong><span class="hint-text">' + quan + '</span></div>' +
        '<div class="chip-row">' + chips + '</div>' +
        '</div>';
    }).join('');

    return '<div class="wizard-step">' +
      '<button class="btn-link wizard-back" data-goto="adjunts">← Canvia adjunts</button>' +
      '<h3>Confirma i envia</h3>' +
      files +
      '<button id="w-enviar" class="btn-primary">Confirma els enviaments</button> ' +
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
      const cercaInput = document.getElementById('w-cerca-alumne');
      cercaInput.addEventListener('input', Util.debounce(function (ev) {
        cercaAlumne = ev.target.value;
        render();
        document.getElementById('w-cerca-alumne').focus();
        const val = document.getElementById('w-cerca-alumne').value;
        document.getElementById('w-cerca-alumne').setSelectionRange(val.length, val.length);
      }, 150));
      document.querySelectorAll('#correus-wizard .wizard-list .list-item').forEach(function (el) {
        el.addEventListener('click', function () {
          wizard.alumneRow = Number(el.dataset.row);
          wizard.step = 'tutor';
          render();
        });
      });
    }

    if (wizard.step === 'tutor') {
      const continuarBtn = document.getElementById('w-continuar-tutor');
      if (continuarBtn) continuarBtn.addEventListener('click', function () { wizard.step = 'plantilla'; render(); });
      const desarBtn = document.getElementById('w-desar-tutor');
      if (desarBtn) desarBtn.addEventListener('click', onDesarTutor);
    }

    if (wizard.step === 'plantilla') {
      document.querySelectorAll('.plantilla-check').forEach(function (el) {
        el.addEventListener('change', function () { onTogglePlantilla(el.dataset.plantilla, el.checked); });
      });
      document.querySelectorAll('.plantilla-date').forEach(function (el) {
        el.addEventListener('change', function () { onCanviarDataPlantilla(el.dataset.plantilla, el.value); });
      });
      document.querySelectorAll('.plantilla-edit-btn').forEach(function (el) {
        el.addEventListener('click', function (ev) {
          ev.preventDefault();
          onEditarPlantilla(el.dataset.plantilla);
        });
      });
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

  function onTogglePlantilla(nom, marcada) {
    if (marcada) {
      if (!wizard.items.some(function (it) { return it.plantillaNom === nom; })) {
        wizard.items.push({ plantillaNom: nom, data: '' });
      }
    } else {
      wizard.items = wizard.items.filter(function (it) { return it.plantillaNom !== nom; });
    }
    render();
  }

  function onCanviarDataPlantilla(nom, data) {
    const item = wizard.items.find(function (it) { return it.plantillaNom === nom; });
    if (item) item.data = data;
  }

  async function onDesarTutor() {
    const nomTutor = document.getElementById('w-tutor-nom').value.trim();
    const correuTutor = document.getElementById('w-tutor-correu').value.trim();
    const resultatEl = document.getElementById('w-tutor-resultat');
    try {
      await Api.call('updateAlumneTutor', {
        sheetId: State.getSheetIdCorreus(), alumneRow: wizard.alumneRow, nomTutor: nomTutor, correuTutor: correuTutor
      });
      const alumne = alumnes.find(function (a) { return a.row === wizard.alumneRow; });
      if (alumne) { alumne.nomTutor = nomTutor; alumne.correuTutor = correuTutor; }
      resultatEl.textContent = 'Dades del tutor/a desades.';
      Util.showToast('Dades del tutor/a desades.');
    } catch (err) {
      resultatEl.textContent = 'Error: ' + err.message;
      Util.showToast('No s\'han pogut desar les dades del tutor/a: ' + err.message, 'error');
    }
  }

  function onEditarPlantilla(nom) {
    const p = plantilles.find(function (pl) { return pl.nom === nom; });
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
      const previews = await Promise.all(wizard.items.map(function (item) {
        return Api.call('previewCorreu', {
          sheetId: State.getSheetIdCorreus(), alumneRow: wizard.alumneRow, plantillaNom: item.plantillaNom
        }).then(function (data) {
          return { plantillaNom: item.plantillaNom, data: item.data, destinataris: data.destinataris || [] };
        });
      }));
      wizard.preview = previews;
      wizard.step = 'confirmar';
      render();
    } catch (err) {
      Util.showToast('No s\'ha pogut generar la previsualització: ' + err.message, 'error');
    }
  }

  async function onEnviar() {
    const resultatEl = document.getElementById('w-resultat');
    if (!confirm('Segur que vols confirmar aquests enviaments (' + wizard.items.length + ')?')) return;

    const btn = document.getElementById('w-enviar');
    btn.disabled = true;
    resultatEl.textContent = 'Processant...';

    try {
      const data = await Api.call('programarEnviaments', {
        sheetId: State.getSheetIdCorreus(),
        alumneRow: wizard.alumneRow,
        items: wizard.items,
        adjunts: wizard.adjunts
      });
      const parts = [];
      if (data.enviatsAra.length) parts.push('Enviats ara: ' + data.enviatsAra.join(', '));
      if (data.programats.length) parts.push('Programats: ' + data.programats.map(function (p) { return p.plantillaNom + ' (' + p.data + ')'; }).join(', '));
      if (data.errors.length) parts.push('Errors: ' + data.errors.map(function (e) { return e.plantillaNom + ' (' + e.error + ')'; }).join(', '));
      resultatEl.textContent = parts.join(' | ') || 'Cap acció realitzada.';
      Util.showToast(data.errors.length ? 'Fet amb errors' : 'Enviaments confirmats', data.errors.length ? 'error' : undefined);
    } catch (err) {
      resultatEl.textContent = 'Error: ' + err.message;
      Util.showToast('No s\'han pogut confirmar els enviaments: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  return { init: init, reload: reload };
})();
