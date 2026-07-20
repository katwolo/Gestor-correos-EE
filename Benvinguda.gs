function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const userProps = PropertiesService.getUserProperties();
  const scriptProps = PropertiesService.getScriptProperties();

  // ✅ Menú
  ui.createMenu('Enviaments')
    .addItem('Enviar ara', 'enviament')
    .addItem('Tutorial', 'obrirTutorial')
    .addItem('Esborrar historial', 'esborrarHistorial')
    .addToUi();

  // ✅ Missatge de benvinguda (un cop per usuari)
  const jaMostrat = userProps.getProperty('benvingudaMostrada');
  if (!jaMostrat) {
    ui.alert(
      'Benvingut/da!',
      'Abans de començar, et recomanem llegir el tutorial que trobaràs al menú "Enviaments".\n\n' +
      'Si tens qualsevol dubte, pots escriure a ibustos@ieb.cat.\n\n' +
      'Espero que us sigui útil aquesta eina!',
      ui.ButtonSet.OK
    );
    userProps.setProperty('benvingudaMostrada', 'sí');
  }

  // ✅ Crear trigger un cop (per projecte)
  const triggerJaCreat = scriptProps.getProperty('triggerEnviamentCreat');
  if (!triggerJaCreat) {
    crearTriggerCadaDia_8h();
    scriptProps.setProperty('triggerEnviamentCreat', 'sí');
  }
}
