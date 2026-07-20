// TEMPORAL — botó d'accés ràpid mentre s'acaba de muntar l'eina.
// Fa servir la MATEIXA contrasenya real (Script Property APP_PASSWORD), només
// evita haver-la d'escriure cada vegada. Quan l'eina estigui acabada:
//  1. Esborra aquest fitxer.
//  2. Treu el <script src="js/dev-access.js"> i el botó #dev-access-btn d'index.html.
//  3. Posa una contrasenya real i privada a APP_PASSWORD (si encara tens aquesta de prova).
const DEV_PASSWORD = 'CANVIA_AQUESTA_CONTRASENYA_TEMPORAL';

document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('dev-access-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    document.getElementById('login-password').value = DEV_PASSWORD;
    document.getElementById('login-form').requestSubmit();
  });
});
