/* env.js — constantes globales y utilidades UI básicas */

const GRID = 19;             // tablero 19x19
const CELL = 26;             // tamaño visual por celda (ajustable)
const POS_MAP = {
  1: { x: 0,  y: 9  }, // (1,10)
  2: { x: 0,  y: 18 }, // (1,19)
  3: { x: 9,  y: 18 }, // (10,19)
  4: { x: 18, y: 18 }, // (19,19)
  5: { x: 18, y: 9  }, // (19,10)
  6: { x: 18, y: 0  }, // (19,1)
  7: { x: 9,  y: 0  }, // (10,1)
  8: { x: 0,  y: 0  }  // (1,1)
};
const IMPALA_START = { x: 9, y: 9 }; // (10,10) -> 0-based

// actions (kept also in qlearning.js but handy here)
const LION_ACTIONS = ['avanzar','esconder','atacar','esperar'];
const IMPALA_ACTIONS = ['ver_frente','ver_izq','ver_der','beber','huir'];

// small helper: distance buckets for state abstraction
function distBucket(d) {
  if (d <= 1) return 'd0-1';
  if (d <= 3) return 'd2-3';
  if (d <= 6) return 'd4-6';
  return 'd7+';
}

/* Logging UI helpers (simple) */
function initLogElement() {
  // ensure log exists
  if (!document.getElementById('log')) return;
  document.getElementById('log').innerHTML = '';
}
function pushLog(msg) {
  const el = document.getElementById('log');
  if (!el) return;
  const d = document.createElement('div');
  const t = new Date().toLocaleTimeString();
  d.textContent = `[${t}] ${msg}`;
  el.prepend(d);
}
