// Carrega Code.gs (Apps Script) dins de Node per poder-ne provar les funcions
// pures. Els serveis de Google (PropertiesService, Utilities...) es
// substitueixen per versions falses que cada prova pot configurar.
const fs = require('fs');
const path = require('path');

const FONT = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
const NOMS = Array.from(FONT.matchAll(/^function\s+([\w$]+)\s*\(/gm), function (m) { return m[1]; });
const CONSTANTS = ['ROSTER_COLUMNS', 'ROSTER_IDX', 'FASES_ACORD', 'HORES_QUADERN_TOTAL'];

function carregarCode(opcions) {
  const props = (opcions && opcions.props) || {};
  const stubs = {
    PropertiesService: {
      getScriptProperties: function () {
        return { getProperty: function (k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; } };
      }
    },
    Utilities: {
      sleep: function () {},
      formatDate: function (d) { return d.toISOString().slice(0, 10); }
    },
    Session: { getScriptTimeZone: function () { return 'Europe/Madrid'; } }
  };
  const exportar = 'return {' + NOMS.concat(CONSTANTS).map(function (n) { return n + ': ' + n; }).join(', ') + '};';
  const fabrica = new Function('PropertiesService', 'Utilities', 'Session', FONT + '\n' + exportar);
  const api = fabrica(stubs.PropertiesService, stubs.Utilities, stubs.Session);
  api.props = props;
  return api;
}

// Fila de l'Excel oficial (30 columnes) a partir d'un objecte amb només els
// camps que interessen a cada prova.
function filaRoster(camps) {
  const fila = new Array(30).fill('');
  Object.keys(camps).forEach(function (k) { fila[Number(k)] = camps[k]; });
  return fila;
}

module.exports = { carregarCode: carregarCode, filaRoster: filaRoster };
