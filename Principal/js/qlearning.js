/* qlearning.js — Q-table, ε-greedy, persistencia y utilidades */

const Q_ACTIONS = ['avanzar','esconder','atacar','esperar'];
let QTABLE = {}; // key -> { action: value }

// hyperparams (ajustables)
let EPS = 0.25;     // exploración inicial
const MIN_EPS = 0.01;
const EPS_DECAY = 0.9998;
const ALPHA = 0.25;
const GAMMA = 0.85;

function qKeyFromObs(obs) {
  // obs: { posNum, impalaAction, distBucket, hidden, attacking }
  return `${obs.posNum}|${obs.impalaAction}|${obs.distBucket}|${obs.hidden?1:0}|${obs.attacking?1:0}`;
}

function ensureQ(key) {
  if (!QTABLE[key]) {
    QTABLE[key] = {};
    Q_ACTIONS.forEach(a => QTABLE[key][a] = 0);
  }
}

function chooseActionQ(obs) {
  const key = qKeyFromObs(obs);
  ensureQ(key);
  if (Math.random() < EPS) {
    // explorar (aleatorio)
    return Q_ACTIONS[Math.floor(Math.random() * Q_ACTIONS.length)];
  }
  // explotar (mejor acción; si empate, aleatorio entre mejores)
  let bestV = -Infinity;
  let bestActs = [];
  for (const a of Q_ACTIONS) {
    const v = QTABLE[key][a];
    if (v > bestV) { bestV = v; bestActs = [a]; }
    else if (v === bestV) bestActs.push(a);
  }
  return bestActs[Math.floor(Math.random() * bestActs.length)];
}

function updateQ(obs, action, reward, nextObs) {
  const k = qKeyFromObs(obs);
  ensureQ(k);
  const q = QTABLE[k][action];
  let maxNext = 0;
  if (nextObs) {
    const kn = qKeyFromObs(nextObs);
    ensureQ(kn);
    maxNext = Math.max(...Object.values(QTABLE[kn]));
  }
  const newQ = q + ALPHA * (reward + GAMMA * maxNext - q);
  QTABLE[k][action] = newQ;
}

function decayEpsilon() {
  EPS = Math.max(MIN_EPS, EPS * EPS_DECAY);
}

/* persistence */
function saveQToLocal() {
  try { localStorage.setItem('qtable', JSON.stringify(QTABLE)); pushLog('Q-table guardada en local.'); }
  catch (e) { pushLog('Error guardando Q-table: ' + e.message); }
}
function loadQFromLocal() {
  try {
    const s = localStorage.getItem('qtable');
    if (s) QTABLE = JSON.parse(s) || {};
    else QTABLE = {};
    pushLog('Q-table cargada desde local (si existía).');
  } catch (e) { QTABLE = {}; pushLog('Error cargando Q-table: '+e.message); }
}
function downloadQ() {
  const data = JSON.stringify(QTABLE, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'qtable.json'; a.click();
  URL.revokeObjectURL(url);
}
function loadQFromFile(json) {
  QTABLE = json || {};
  pushLog('Q-table cargada desde archivo.');
}
