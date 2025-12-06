/* qlearning.js — Q-table y algoritmo ε-greedy (persistente) */
const Q_ACTIONS = ['avanzar','esconder','atacar'];
let QTABLE = {}; // key -> { action: value }

// parámetros
let EPS = 0.12; // exploración
let ALPHA = 0.25; // learning rate
let GAMMA = 0.8; // discount

function qKeyFromObs(obs){ return `${obs.posNum}|${obs.impalaAction}|${obs.distBucket}|${obs.hidden?1:0}`; }

function ensureQ(key){ if(!QTABLE[key]){ QTABLE[key] = {}; Q_ACTIONS.forEach(a=>QTABLE[key][a]=0); } }

function chooseActionQ(obs){
  const key = qKeyFromObs(obs);
  ensureQ(key);
  if(Math.random() < EPS) return Q_ACTIONS[Math.floor(Math.random()*Q_ACTIONS.length)];
  // elegir acción con mayor Q
  let best=null, bestV=-Infinity;
  for(const a of Q_ACTIONS){ if(QTABLE[key][a] > bestV){ bestV = QTABLE[key][a]; best=a; } }
  return best;
}

function updateQ(obs, action, reward, nextObs){
  const k = qKeyFromObs(obs); ensureQ(k);
  const kn = nextObs ? qKeyFromObs(nextObs) : null;
  if(kn) ensureQ(kn);
  const maxNext = kn ? Math.max(...Object.values(QTABLE[kn])) : 0;
  QTABLE[k][action] = QTABLE[k][action] + ALPHA * (reward + GAMMA * maxNext - QTABLE[k][action]);
}

function saveQToLocal(){ localStorage.setItem('qtable', JSON.stringify(QTABLE)); }
function loadQFromLocal(){ const s = localStorage.getItem('qtable'); if(s) QTABLE = JSON.parse(s) || {}; }
function downloadQ(){ const data = JSON.stringify(QTABLE, null, 2); const blob = new Blob([data],{type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='qtable.json'; a.click(); URL.revokeObjectURL(url); }
function loadQFromFile(json){ QTABLE = json || {}; }
