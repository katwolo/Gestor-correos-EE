function crearTriggerCadaDia_8h() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let t of triggers) {
    if (t.getHandlerFunction() === 'enviament') {
      ScriptApp.deleteTrigger(t);
    }
  }

  ScriptApp.newTrigger('enviament')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();

  Logger.log('✅ Trigger diari a les 8:00 creat automàticament.');
}
