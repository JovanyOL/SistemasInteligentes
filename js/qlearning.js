/* qlearning.js — Q-table y algoritmo ε-greedy optimizado */
const Q_ACTIONS = ['avanzar','esconder','atacar','esperar'];
let QTABLE = {}; // key -> { action: value }

// parámetros
let EPS = 0.3;
const MIN_EPS = 0.01;
const EPS_DECAY = 0.999;

const ALPHA = 0.25;
const GAMMA = 0.8;

// normaliza posición para reducir estados (MEJORA GRANDE)
function normalizePos(p){
  if(p==1 || p==5) return 'vert';
  if(p==3 || p==7) return 'horiz';
  return 'diag';
}

// normaliza acción del impala
function normalizeImpalaAction(a){
  if(a === 'ver_izq' || a==='ver_der') return 'ver_lateral';
  if(a === 'ver_frente') return 'ver_frente';
  if(a === 'beber') return 'beber';
  if(a.startsWith('huir')) return 'huir';
  return 'otro';
}

function qKeyFromObs(obs){
  const pos = normalizePos(obs.posNum);
  const imp = normalizeImpalaAction(obs.impalaAction);
  const d   = obs.distBucket;
  const h   = obs.hidden ? 1 : 0;
  return `${pos}|${imp}|${d}|${h}`;
}

function ensureQ(key){
  if(!QTABLE[key]){
    QTABLE[key] = {};
    Q_ACTIONS.forEach(a=>QTABLE[key][a] = 0);
  }
}

function chooseActionQ(obs){
  const key = qKeyFromObs(obs);
  ensureQ(key);

  // epsilon-greedy
  if(Math.random() < EPS){
    return Q_ACTIONS[Math.floor(Math.random()*Q_ACTIONS.length)];
  }

  // max Q
  let best = null, bestV = -Infinity;
  for(const a of Q_ACTIONS){
    if(QTABLE[key][a] > bestV){
      bestV = QTABLE[key][a];
      best = a;
    }
  }
  return best;
}

function updateQ(obs, action, reward, nextObs){
  const k = qKeyFromObs(obs);
  ensureQ(k);

  let maxNext = 0;
  if(nextObs){
    const kn = qKeyFromObs(nextObs);
    ensureQ(kn);
    maxNext = Math.max(...Object.values(QTABLE[kn]));
  }

  // update
  const old = QTABLE[k][action];
  const target = reward + GAMMA * maxNext;
  let updated = old + ALPHA * (target - old);

  // clamping para estabilidad
  updated = Math.max(-500, Math.min(500, updated));

  QTABLE[k][action] = updated;

  // decaimiento epsilon
  EPS = Math.max(MIN_EPS, EPS * EPS_DECAY);
}

function saveQToLocal(){ localStorage.setItem('qtable', JSON.stringify(QTABLE)); }
function loadQFromLocal(){ const s = localStorage.getItem('qtable'); if(s) QTABLE = JSON.parse(s) || {}; }
function downloadQ(){ const blob = new Blob([JSON.stringify(QTABLE,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='qtable.json'; a.click(); URL.revokeObjectURL(url); }
function loadQFromFile(json){ QTABLE = json || {}; }
