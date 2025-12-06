/* main.js — conecta todo y contiene loop principal (OPTIMIZADO) */

/* ========== CONFIG / RECOMPENSAS ========== */
/* Nota: EPSILON y su decaimiento se manejan dentro de qlearning.js (updateQ) */
const R_EXITO = +100;
const R_FRACASO = -100;
const R_PASO = -1;
const R_ACERCARSE = +0.5;
const MAX_STEPS_PER_EPISODE = 500; // seguridad para bucles infinitos

/* ========== ESTADO GLOBAL ========== */
let state = {};
let TRAIN_ABORT = false;
let training = false;

/* ========== UTILIDADES DE DISTANCIA ========== */
function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/* ========== INICIALIZAR ESTADO ========== */
function initState(startPosOption) {
  let posNum;
  if (startPosOption === 'rand') {
    const opts = Object.keys(POS_MAP);
    posNum = Number(opts[Math.floor(Math.random() * opts.length)]);
  } else {
    posNum = Number(startPosOption);
  }

  state = {
    lion: { pos: { ...POS_MAP[posNum] }, hidden: false, attacking: false, posNum: posNum },
    impala: { pos: { ...IMPALA_START }, fleeing: false, fleeDir: null, fleeVel: 1, lastAction: null },
    time: 1,
    lastImpala: null,
    lastLion: null,
    running: false,
    // flag para no renderizar durante entrenamiento masivo
    fastMode: false
  };

  // Solo actualizar UI si no estamos en modo rápido (entrenamiento)
  if (!state.fastMode) {
    document.getElementById('turn').textContent = state.time;
    document.getElementById('status').textContent = 'Listo';
    document.getElementById('lastImpala').textContent = '-';
    document.getElementById('lastLion').textContent = '-';
    document.getElementById('log').innerHTML = '';
    drawGrid(state);
    renderQView();
  }
}

/* ========== OBTENER ACCION DEL IMPALA ========== */
function getImpalaAction() {
  const impalaMode = document.getElementById('impalaMode').value;
  let action;
  if (state.impala.fleeing) {
    action = 'huir';
  } else if (impalaMode === 'aleatorio') {
    action = IMPALA_ACTIONS[Math.floor(Math.random() * IMPALA_ACTIONS.length)];
  } else {
    const seq = document.getElementById('progSeq').value.split(',').map(s => s.trim()).filter(s => s);
    action = seq.length === 0 ? 'ver_frente' : seq[(state.time - 1) % seq.length];
  }
  return action;
}

/* ========== APLICAR ACCION DEL LEON ========== */
function applyLionAction(lionAction, currentDist) {
  // currentDist: distancia antes de la acción
  if (lionAction === 'avanzar') {
    lionAdvanceTowardsImpala(state);
    state.lion.hidden = false;
  } else if (lionAction === 'esconder') {
    // esconder no mueve al león, solo cambia su estado visible
    state.lion.hidden = true;
  } else if (lionAction === 'atacar') {
    // atacar solo tiene sentido si estamos cerca
    if (currentDist <= 1) {
      state.lion.attacking = true;
      // atacar puede mover 1 casilla (ajusta si quieres 2)
      lionAdvanceTowardsImpala(state);
    } else {
      // atacar desde lejos no debería mover al león; se considera intento fallido
      // dejamos hidden = false porque un ataque implica exposición
      state.lion.hidden = false;
    }
  } else if (lionAction === 'esperar') {
    // acción noop — no mover
  } else {
    // por si la Q devuelve algo inesperado
  }
}

/* ========== COMPROBAR SI EL IMPALA VE / HUIE ========== */
function checkAndTriggerImpalaFlee(lionAction, impAction, distBefore) {
  // impalaSees ya considera si el león está hidden
  const sees = impalaSees(state, state.lion.pos, impAction);

  // reglas de huida: solo si ve al león, o si la distancia es muy pequeña, o si atacan cerca
  const closeThreshold = 2;
  let fleeTriggeredByLion = false;

  if (!state.impala.fleeing) {
    if (sees || (lionAction === 'atacar' && distBefore <= closeThreshold) || distBefore <= closeThreshold) {
      state.impala.fleeing = true;
      state.impala.fleeDir = (state.impala.pos.x <= state.lion.pos.x) ? 'E' : 'W';
      state.impala.fleeVel = 1;
      fleeTriggeredByLion = true;
    }
  }
  return fleeTriggeredByLion;
}

/* ========== COMPUTAR RECOMPENSA Y ACTUALIZAR Q ========== */
function computeRewardAndUpdateQ(obs, lionAction, nextObs, distBefore, distAfter, terminal, terminalReason) {
  // terminalReason: 'exito' / 'fracaso' / null
  if (terminal) {
    if (terminalReason === 'exito') {
      updateQ(obs, lionAction, R_EXITO, null);
    } else if (terminalReason === 'fracaso') {
      updateQ(obs, lionAction, R_FRACASO, null);
    }
    return;
  }

  // reward shaping por acercarse
  let stepReward = R_PASO;
  if (distAfter < distBefore) stepReward += R_ACERCARSE;
  else if (distAfter > distBefore) stepReward -= Math.abs(R_ACERCARSE);

  updateQ(obs, lionAction, stepReward, nextObs);
}

/* ========== STEP (1 T) ========== */
function stepOnce() {
  if (state.running) return false;

  // 1) decide acción impala
  const impAction = getImpalaAction();
  const impalaWasFleeing = state.impala.fleeing;

  // ejecutar el paso del impala (move si huye)
  impalaStep(state, impAction);
  state.impala.lastAction = impAction;
  state.lastImpala = impAction;

  // 2) observación actual (antes de la acción del león)
  const lp = state.lion.pos;
  const d = manhattan(lp, state.impala.pos);
  const obs = {
    posNum: getPosNumFromCoords(lp),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: distBucket(d),
    hidden: state.lion.hidden
  };

  // 3) elegir acción del león (Q)
  const lionAction = chooseActionQ(obs);
  state.lastLion = lionAction;

  // 4) aplicar acción del león (usa dist BEFORE)
  applyLionAction(lionAction, d);

  // 5) comprobar si la acción del león provoca huida
  const fleeTriggeredByLion = checkAndTriggerImpalaFlee(lionAction, impAction, d);

  // 6) terminal checks (después de aplicar acción & posible huida)
  const reached = (state.lion.pos.x === state.impala.pos.x && state.lion.pos.y === state.impala.pos.y);
  if (reached) {
    // éxito: actualizar Q, log y terminar
    computeRewardAndUpdateQ(obs, lionAction, null, d, 0, true, 'exito');
    if (!state.fastMode) pushLog(`T=${state.time}: ÉXITO -> impala alcanzado.`);
    if (!state.fastMode) document.getElementById('status').textContent = 'Éxito';
    if (!state.fastMode) { renderQView(); drawGrid(state); }
    return true;
  }

  // si el impala empezó a huir en este paso
  if (state.impala.fleeing && !impalaWasFleeing) {
    if (fleeTriggeredByLion) {
      computeRewardAndUpdateQ(obs, lionAction, null, d, manhattan(state.lion.pos, state.impala.pos), true, 'fracaso');
      if (!state.fastMode) pushLog(`T=${state.time}: Fracaso -> impala huyó por culpa del león.`);
      if (!state.fastMode) document.getElementById('status').textContent = 'Fracaso';
      if (!state.fastMode) { renderQView(); drawGrid(state); }
      return true;
    } else {
      // huida espontánea: no penalizamos (pero terminamos)
      if (!state.fastMode) pushLog(`T=${state.time}: Impala huyó por decisión propia (no penalizado).`);
      if (!state.fastMode) document.getElementById('status').textContent = 'Huida (no penalizada)';
      if (!state.fastMode) { renderQView(); drawGrid(state); }
      return true;
    }
  }

  // 7) no terminal: actualizar Q con reward shaping
  const lp2 = state.lion.pos;
  const d2 = manhattan(lp2, state.impala.pos);
  const nextObs = {
    posNum: getPosNumFromCoords(lp2),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: distBucket(d2),
    hidden: state.lion.hidden
  };

  computeRewardAndUpdateQ(obs, lionAction, nextObs, d, d2, false, null);

  // 8) incrementar tiempo y UI
  state.time += 1;
  if (!state.fastMode) {
    document.getElementById('turn').textContent = state.time;
    document.getElementById('status').textContent = 'En curso';
    renderQView();
    drawGrid(state);
  }
  return false;
}

/* ========== ENTRENAMIENTO MASIVO (sin render para velocidad) ========== */
async function trainN(n, posiciones_iniciales = [1,2,3,4,5,6,7,8]) {
  TRAIN_ABORT = false;
  training = true;
  // Modo rápido: no renderizar ni actualizar DOM para ganar velocidad
  state.fastMode = true;
  document.getElementById('btnStopTrain').style.display = 'inline-block';
  pushLog(`Entrenamiento ${n} episodios iniciando... (modo rápido)`);

  for (let i = 0; i < n; i++) {
    if (TRAIN_ABORT) break;
    initState(String(posiciones_iniciales[Math.floor(Math.random() * posiciones_iniciales.length)]));
    // no render ni dom updates durante la ejecución interna
    let iter = 0;
    while (iter < MAX_STEPS_PER_EPISODE) {
      iter++;
      const done = stepOnce();
      if (done) break;
    }
    // ocasionalmente permitir event loop para no bloquear UI
    if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));
  }

  // finalizar
  training = false;
  state.fastMode = false;
  document.getElementById('btnStopTrain').style.display = 'none';
  saveQToLocal();
  pushLog('Entrenamiento terminado.');
  renderQView();
  drawGrid(state);
}

/* ========== HOOKS UI ========== */
document.getElementById('btnReset').addEventListener('click', ()=>{ initState(document.getElementById('startPos').value); pushLog('Estado reiniciado.'); });

document.getElementById('btnTrain').addEventListener('click', ()=>{ trainN(1000, [1,2,3,4,6,7,8]); });
document.getElementById('btnStopTrain').addEventListener('click', ()=>{ TRAIN_ABORT = true; pushLog('Solicitud de detención recibida.'); });

document.getElementById('btnStep').addEventListener('click', ()=>{ stepOnce(); });

document.getElementById('btnRun').addEventListener('click', ()=>{ 
  state.running = true; 
  document.getElementById('status').textContent = 'Ejecutando...'; 
  let steps = 0; 
  function loop(){ 
    if (steps++ > 400) { state.running = false; document.getElementById('status').textContent = 'Detenido (límite)'; return; } 
    const done = stepOnce(); 
    if (done) { state.running = false; return; } 
    setTimeout(loop, 120); 
  } 
  loop(); 
});

document.getElementById('btnShowKB').addEventListener('click', ()=>{ renderQView(); pushLog('Mostrando Q-table.'); });
document.getElementById('btnSaveKB').addEventListener('click', ()=>{ downloadQ(); pushLog('Descargando Q-table...'); });
document.getElementById('btnLoadKB').addEventListener('click', ()=>{ document.getElementById('kbFile').click(); });

document.getElementById('kbFile').addEventListener('change', (e)=>{ 
  const f = e.target.files[0]; 
  if(!f) return; 
  const r = new FileReader(); 
  r.onload = () => { 
    try { 
      const j = JSON.parse(r.result); 
      loadQFromFile(j); 
      renderQView(); 
      pushLog('Q-table cargada desde archivo.'); 
    } catch(err) { 
      pushLog('Error cargando Q-table: ' + err.message); 
    } 
  }; 
  r.readAsText(f); 
});

/* Explain button (mostrar por qué hizo la decisión) */
document.getElementById('btnExplain').addEventListener('click', ()=> {
  const lp = state.lion.pos; 
  const d = manhattan(lp, state.impala.pos);
  const obs = { posNum: getPosNumFromCoords(lp), impalaAction: state.impala.fleeing ? 'huir' : state.lastImpala, distBucket: distBucket(d), hidden: state.lion.hidden };
  const key = qKeyFromObs(obs); ensureQ(key);
  let s = `Clave usada: ${key}\n`;
  for (const a in QTABLE[key]) s += `${a}: ${QTABLE[key][a].toFixed(3)}\n`;
  pushLog(s);
});

/* ========== INICIO: cargar Q y crear estado inicial ========== */
loadQFromLocal();
initLogElement(); // inicializa LOG (definida en env.js)
initState('rand');
renderQView();
drawGrid(state);
