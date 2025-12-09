/* main.js — conecta todo y contiene loop principal (actualizado con reglas) */

/* ========== CONFIG / RECOMPENSAS ========== */
const R_EXITO = +100;
const R_FRACASO = -100;
const R_PASO = -1;
const R_ACERCARSE = +0.5;
const MAX_STEPS_PER_EPISODE = 1000;

/* ========== ESTADO GLOBAL ========== */
let state = {};
let TRAIN_ABORT = false;
let training = false;

/* UTIL */
function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/* INICIALIZAR ESTADO
   Guardamos startPosNum para reglas de visión del impala y la elección de hasAdvanced=false */
function initState(startPosOption) {
  let posNum;
  if (startPosOption === 'rand') {
    const opts = Object.keys(POS_MAP);
    posNum = Number(opts[Math.floor(Math.random() * opts.length)]);
  } else {
    posNum = Number(startPosOption);
  }

  state = {
    lion: {
      pos: { ...POS_MAP[posNum] },
      hidden: false,
      attacking: false,
      mode: 'normal', // 'normal' o 'attacking'
      hasAdvanced: false,
      startPosNum: posNum
    },
    impala: {
      pos: { ...IMPALA_START },
      fleeing: false,
      fleeDir: null,
      fleeVel: 0,
      fleeCount: 0,
      lastAction: null
    },
    time: 1,
    lastImpala: null,
    lastLion: null,
    running: false,
    fastMode: false
  };

  // UI
  document.getElementById('turn').textContent = state.time;
  document.getElementById('status').textContent = 'Listo';
  document.getElementById('lastImpala').textContent = '-';
  document.getElementById('lastLion').textContent = '-';
  document.getElementById('log').innerHTML = '';

  drawGrid(state);
  renderQView();
}

/* OBTENER ACCION DEL IMPALA (impala actúa primero en cada T) */
function getImpalaAction() {
  if (state.impala.fleeing) return 'huir';

  const mode = document.getElementById('impalaMode').value;
  if (mode === 'aleatorio') return IMPALA_ACTIONS[Math.floor(Math.random() * IMPALA_ACTIONS.length)];
  const seq = document.getElementById('progSeq').value.split(',').map(s => s.trim()).filter(s => s);
  return seq.length === 0 ? 'ver_frente' : seq[(state.time - 1) % seq.length];
}

/* APLICAR ACCION DEL LEON (respetando persistencia de atacar) */
function applyLionAction(lionAction, distBefore) {
  // si ya está en modo attacking, forzamos attack steps
  if (state.lion.mode === 'attacking') {
    lionAttackStep(state); // mueve 2 pasos
    return;
  }

  // si elige atacar, cambiar a modo attacking irrevocable
  if (lionAction === 'atacar') {
    // set mode and perform attack step (2 pasos)
    state.lion.mode = 'attacking';
    lionAttackStep(state);
    return;
  }

  // acción avanzar
  if (lionAction === 'avanzar') {
    lionAdvanceTowardsImpala(state);
    state.lion.hidden = false;
    // registrar si empezó en pos 5 y avanzó (para regla especial)
    if (state.lion.startPosNum === 5) state.lion.hasAdvanced = true;
    return;
  }

  // esconder
  if (lionAction === 'esconder') {
    state.lion.hidden = true;
    return;
  }

  // esperar (noop)
  if (lionAction === 'esperar') return;
}

/* COMPROBAR SI IMPALA DISPARA HUIDA
   Reglas: huye si león ataca, o distancia < 3, o lo ve (impalaSees).
   Cuando huye, no puede dejar de hacerlo; huye en E/W y sigue aceleración 1,1,2,...
*/
function checkAndTriggerImpalaFlee(lionAction, impAction, distBefore) {
  // impalaSees ya considera hidden y otras reglas
  const sees = impalaSees(state, state.lion.pos, impAction);
  const attackTriggered = (lionAction === 'atacar' || state.lion.mode === 'attacking');
  const close = (distBefore < 3);

  if (!state.impala.fleeing && (attackTriggered || close || sees)) {
    // iniciar huida
    startImpalaFlee(state);

    // regla: si al iniciarse huida la velocidad del impala (primer toMove = 1) >= velocidad del león,
    // y según la regla del enunciado, si el impala "comienza a correr a velocidad >= león" => fracaso inmediato.
    const lionSpeedAtStart = (state.lion.mode === 'attacking') ? 2 : 1;
    const impalaFirstVel = state.impala.fleeVel || 1;
    if (impalaFirstVel >= lionSpeedAtStart) {
      // marcar como fracaso inmediato (el león no puede alcanzarlo según la regla)
      return { fled: true, causedByLion: attackTriggered || close || sees, immediateFailure: true };
    }
    return { fled: true, causedByLion: attackTriggered || close || sees, immediateFailure: false };
  }
  return { fled: false, causedByLion: false, immediateFailure: false };
}

/* COMPUTAR RECOMPENSA Y ACTUALIZAR Q (reward shaping incluido) */
function computeRewardAndUpdateQ(obs, lionAction, nextObs, dBefore, dAfter, terminal, terminalReason) {
  if (terminal) {
    if (terminalReason === 'exito') updateQ(obs, lionAction, R_EXITO, null);
    else updateQ(obs, lionAction, R_FRACASO, null);
    return;
  }
  let r = R_PASO;
  if (dAfter < dBefore) r += R_ACERCARSE;
  else if (dAfter > dBefore) r -= Math.abs(R_ACERCARSE);
  updateQ(obs, lionAction, r, nextObs);
}

/* STEP (un turno) — impala primero, león reacciona en el mismo T */
function stepOnce() {
  if (state.running) return false;

  // 1) impala decide
  const impAction = getImpalaAction();
  state.impala.lastAction = impAction;
  const impWasFleeing = state.impala.fleeing;

  // ejecutar impala step (mueve si huye)
  impalaStep(state, impAction);
  state.lastImpala = impAction;

  // 2) observación antes de la acción del león
  const lp = state.lion.pos;
  const d = manhattan(lp, state.impala.pos);
  const obs = {
    posNum: state.lion.startPosNum || getPosNumFromCoords(lp),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: distBucket(d),
    hidden: state.lion.hidden
  };

  // 3) león elige acción (Q)
  const lionAction = chooseActionQ(obs);
  state.lastLion = lionAction;

  // 4) aplicar acción del león (tiene en cuenta modo 'attacking' persistente)
  applyLionAction(lionAction, d);

  // 5) comprobar huida provocada
  const fleeInfo = checkAndTriggerImpalaFlee(lionAction, impAction, d);

  // si huida inició y fue inmediato fracaso según regla -> marcar y terminar
  if (fleeInfo.fled && fleeInfo.immediateFailure) {
    // actualizar Q con fracaso
    computeRewardAndUpdateQ(obs, lionAction, null, d, manhattan(state.lion.pos, state.impala.pos), true, 'fracaso');
    pushLog(`T=${state.time}: Fracaso inmediato — impala inicia huida a velocidad >= león.`);
    document.getElementById('status').textContent = 'Fracaso (immediate)';
    drawGrid(state); renderQView();
    return true;
  }

  // 6) terminal: llegó (éxito)
  const reached = (state.lion.pos.x === state.impala.pos.x && state.lion.pos.y === state.impala.pos.y);
  if (reached) {
    computeRewardAndUpdateQ(obs, lionAction, null, d, 0, true, 'exito');
    pushLog(`T=${state.time}: ÉXITO — impala alcanzado.`);
    document.getElementById('status').textContent = 'Éxito';
    drawGrid(state); renderQView();
    return true;
  }

  // 7) si impala empezó a huir en este T y no fue immediate failure, determinamos si termina (llega borde) o continúa
  if (state.impala.fleeing && !impWasFleeing) {
    // si huida por el león -> fracaso, si huida espontanea -> termina sin penalizar? (siguiendo reglas previas)
    // El enunciado dice: "La cacería termina ... fracaso si el impala comienza a correr a una velocidad igual o mayor al león"
    // ya manejado arriba. Aquí continuamos la incursión hasta que el impala llegue al borde o león capture.
    pushLog(`T=${state.time}: Impala inicia huida (no immediate failure).`);
    document.getElementById('status').textContent = 'Huida iniciada';
    // no actualizamos Q con terminal aquí — la finalización se detecta cuando impala alcanza borde o león captura
  }

  // 8) No terminal por ahora — actualizar Q con reward shaping por paso
  const lp2 = state.lion.pos;
  const d2 = manhattan(lp2, state.impala.pos);
  const nextObs = {
    posNum: state.lion.startPosNum || getPosNumFromCoords(lp2),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: distBucket(d2),
    hidden: state.lion.hidden
  };
  computeRewardAndUpdateQ(obs, lionAction, nextObs, d, d2, false, null);

  // 9) Si impala está huyendo, comprobar si llegó al borde -> fracaso (impala escape)
  if (state.impala.fleeing) {
    if (state.impala.pos.x === 0 || state.impala.pos.x === GRID - 1) {
      // impala ha llegado a extremo, marcar fracaso
      computeRewardAndUpdateQ(obs, lionAction, null, d, d2, true, 'fracaso');
      pushLog(`T=${state.time}: Fracaso — impala llegó al borde (escape).`);
      document.getElementById('status').textContent = 'Fracaso (escape)';
      drawGrid(state); renderQView();
      return true;
    }
  }

  // 10) incrementar tiempo y UI
  state.time += 1;
  document.getElementById('turn').textContent = state.time;
  document.getElementById('status').textContent = 'En curso';
  drawGrid(state); renderQView();

  return false;
}

/* ENTRENAMIENTO (se conserva tu trainN) */
async function trainN(n, posiciones_iniciales = [1,2,3,4,6,7,8]) {
  TRAIN_ABORT = false;
  training = true;
  state.fastMode = true;
  document.getElementById('btnStopTrain').style.display = 'inline-block';
  pushLog(`Entrenamiento ${n} episodios iniciando... (modo rápido)`);

  for (let i = 0; i < n; i++) {
    if (TRAIN_ABORT) break;
    initState(String(posiciones_iniciales[Math.floor(Math.random() * posiciones_iniciales.length)]));
    let iter = 0;
    while (iter < MAX_STEPS_PER_EPISODE) {
      iter++;
      const done = stepOnce();
      if (done) break;
    }
    if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));
  }

  training = false;
  state.fastMode = false;
  document.getElementById('btnStopTrain').style.display = 'none';
  saveQToLocal();
  pushLog('Entrenamiento terminado.');
  drawGrid(state); renderQView();
}

/* HOOKS UI: (idem a tus versiones limpias) */
document.getElementById('btnReset').addEventListener('click', ()=>{ initState(document.getElementById('startPos').value); pushLog('Estado reiniciado.'); });
document.getElementById('btnStep').addEventListener('click', ()=>{ stepOnce(); });
document.getElementById('btnTrain').addEventListener('click', ()=>{ trainN(1000); });
document.getElementById('btnStopTrain').addEventListener('click', ()=>{ TRAIN_ABORT=true; pushLog('Solicitud de detención recibida.'); });

document.getElementById('btnShowKB').addEventListener('click', ()=>{ renderQView(); pushLog('Mostrando Q-table.'); });
document.getElementById('btnExplain').addEventListener('click', ()=>{ 
  const lp = state.lion.pos; 
  const d = manhattan(lp, state.impala.pos);
  const obs = { posNum: state.lion.startPosNum || getPosNumFromCoords(lp), impalaAction: state.impala.fleeing? 'huir': state.lastImpala, distBucket: distBucket(d), hidden: state.lion.hidden };
  const key = qKeyFromObs(obs); ensureQ(key);
  let s = `Clave usada: ${key}\n`;
  for(const a in QTABLE[key]) s += `${a}: ${QTABLE[key][a].toFixed(3)}\n`;
  pushLog(s);
});

/* Guardar / Cargar Q */
document.getElementById('btnSaveKB').addEventListener('click', ()=>{ downloadQ(); pushLog('Descargando Q-table...'); });
document.getElementById('btnLoadKB').addEventListener('click', ()=>{ document.getElementById('kbFile').click(); });
document.getElementById('kbFile').addEventListener('change', (e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ loadQFromFile(JSON.parse(r.result)); renderQView(); pushLog('Q-table cargada.'); }catch(err){ pushLog('Error cargando Q-table: '+err.message);} }; r.readAsText(f); });

/* INICIO */
loadQFromLocal();
initLogElement();
initState('rand');
renderQView();
drawGrid(state);
