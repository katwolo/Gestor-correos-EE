const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR_JS = path.join(__dirname, '..', 'docs', 'js');
const INDEX = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');

test('cap fitxer JS de la web té errors de sintaxi', function () {
  fs.readdirSync(DIR_JS).filter(function (f) { return f.endsWith('.js'); }).forEach(function (f) {
    const codi = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    assert.doesNotThrow(function () { new Function(codi); }, f);
  });
});

test("index.html carrega tots els fitxers JS i en l'ordre que cal", function () {
  const carregats = Array.from(INDEX.matchAll(/<script src="js\/([\w.-]+)"><\/script>/g), function (m) { return m[1]; });
  const existents = fs.readdirSync(DIR_JS).filter(function (f) { return f.endsWith('.js'); });
  assert.deepEqual(carregats.slice().sort(), existents.slice().sort());
  // config i util primer; app.js (que arrenca tot) l'últim.
  assert.equal(carregats[0], 'config.js');
  assert.equal(carregats[carregats.length - 1], 'app.js');
});

test('els id que fa servir el JS existeixen a index.html', function () {
  // Els id que es creen dinàmicament dins del JS (prefix "w-" de l'assistent,
  // "dashboard-clear-filter"...) no són a index.html i no es comproven.
  const dinamics = /^(w-|dashboard-clear-filter$)/;
  fs.readdirSync(DIR_JS).filter(function (f) { return f.endsWith('.js'); }).forEach(function (f) {
    const codi = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
    Array.from(codi.matchAll(/getElementById\('([\w-]+)'\)/g), function (m) { return m[1]; })
      .filter(function (id) { return !dinamics.test(id); })
      .forEach(function (id) {
        assert.ok(INDEX.indexOf('id="' + id + '"') !== -1, f + ' fa servir #' + id + ', que no és a index.html');
      });
  });
});
