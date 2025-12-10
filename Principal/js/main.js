/* main.js — Versión final sin createInitialState (reemplaza todo el archivo) */

const MAX_STEPS_PER_EPISODE = 1000;

/* Estado global */
let state = null;
let TRAIN_ABORT = false;
let training = false;
let HUNT_OVER = false;

/* Utilidad: Manhattan */
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

/* Fallback: obtener acción del impala si no existe en otros módulos */
function getImpalaAction() {
  if (!state) return 'ver_frente';
  if (state.impala && state.impala.fleeing) return 'huir';

  const modeEl = document.getElementById('impalaMode');
  const mode = modeEl ? modeEl.value : 'aleatorio';
  if (mode === 'aleatorio') {
    if (typeof IMPALA_ACTIONS !== 'undefined') return IMPALA_ACTIONS[Math.floor(Math.random()*IMPALA_ACTIONS.length)];
    return 'ver_frente';
  }
  const seqEl = document.getElementById('progSeq');
  const seq = seqEl ? seqEl.value.split(',').map(s=>s.trim()).filter(s=>s) : [];
  return seq.length === 0 ? 'ver_frente' : seq[(state.time-1) % seq.length];
}

/* safeInitState: usa initState si existe (tu versión recomendada), si no construye un state básico */
function safeInitState(startPos) {
  if (typeof initState === 'function') {
    // usa la initState definida en tu proyecto
    try {
      initState(startPos);
      // si initState crea una variable global 'state' distinta, deja que esa sea
      if (typeof window.state !== 'undefined' && !state) state = window.state;
      return;
    } catch (e) {
      console.warn('initState() lanzó error, creando estado por fallback:', e);
    }
  }

  // fallback seguro (solo si no tienes initState)
  const posNum = (startPos === 'rand') ? 1 : Number(startPos || 1);
  const startPosCoords = (typeof POS_MAP !== 'undefined' && POS_MAP[posNum]) ? POS_MAP[posNum] : { x: 0, y: 0 };
  const impStart = (typeof IMPALA_START !== 'undefined') ? IMPALA_START : { x: 9, y: 9 };

  state = {
    lion: { pos: { ...startPosCoords }, hidden:false, mode:'normal', startPosNum: posNum },
    impala: { pos: { ...impStart }, fleeing:false, fleeDir:null, fleeVel:0 },
    time: 1,
    lastImpala: null,
    lastLion: null,
    running: false,
    fastMode: false,
    pathLion: [{ ...startPosCoords }],
    pathImpala: [{ ...impStart }]
  };
}

/* endHunt: centraliza finalización */
function endHunt(reason) {
  HUNT_OVER = true;
  if (typeof pushLog === 'function') pushLog('Cacería finalizada: ' + reason);
  if (document.getElementById('status')) document.getElementById('status').textContent = reason;
  if (typeof renderQView === 'function') renderQView();
  if (typeof drawGrid === 'function') drawGrid(state);
  const btn = document.getElementById('btnStep');
  if (btn) btn.disabled = true;
}

/* applyLionActionFallback: si falta applyLionAction, usamos esto */
function applyLionActionFallback(action) {
  if (!state || !state.lion) return;
  if (action === 'avanzar' && typeof lionAdvanceTowardsImpala === 'function') {
    lionAdvanceTowardsImpala(state);
    state.lion.hidden = false;
  } else if (action === 'esconder') {
    state.lion.hidden = true;
  } else if (action === 'atacar') {
    if (typeof lionAttackStep === 'function') lionAttackStep(state);
    else {
      if (typeof lionAdvanceTowardsImpala === 'function') {
        lionAdvanceTowardsImpala(state);
        lionAdvanceTowardsImpala(state);
      }
      state.lion.mode = 'attacking';
    }
  }
}

/* checkAndTriggerImpalaFlee fallback (if not provided) */
function checkAndTriggerImpalaFleeFallback(lionAction, impalaAction, distBefore) {
  if (!state) return { fled:false, causedByLion:false, immediateFailure:false };
  // Simplified rules: if attack or dist < 3 -> flee
  if (!state.impala.fleeing && (lionAction === 'atacar' || distBefore < 3)) {
    if (typeof startImpalaFlee === 'function') startImpalaFlee(state);
    else {
      state.impala.fleeing = true;
      state.impala.fleeDir = (state.impala.pos.x <= state.lion.pos.x) ? 'E' : 'W';
      state.impala.fleeVel = 1;
    }
    const lionSpeed = (state.lion.mode === 'attacking') ? 2 : 1;
    const impFirst = state.impala.fleeVel || 1;
    return { fled:true, causedByLion:true, immediateFailure: impFirst >= lionSpeed };
  }
  return { fled:false, causedByLion:false, immediateFailure:false };
}

/* stepOnce: un paso de simulación */
function stepOnce() {
  if (!state) {
    safeInitState(document.getElementById && document.getElementById('startPos') ? document.getElementById('startPos').value : 'rand');
  }
  if (HUNT_OVER) { if (typeof pushLog === 'function') pushLog('La cacería ya terminó. Usa RESET.'); return false; }

  // 1) Impala decide y actúa
  const impAction = (typeof getImpalaAction === 'function') ? getImpalaAction() : 'ver_frente';
  if (typeof impalaStep === 'function') impalaStep(state, impAction);
  state.lastImpala = impAction;
  if (state.pathImpala) state.pathImpala.push({ x: state.impala.pos.x, y: state.impala.pos.y });

  // si impala llegó al borde -> fracaso
  if (state.impala.pos.x <= 0 || state.impala.pos.x >= GRID - 1) {
    endHunt('Fracaso (impala escapó al borde)');
    return true;
  }

  // 2) Observación
  const lp = state.lion.pos;
  const dBefore = manhattan(lp, state.impala.pos);

  const obs = {
    posNum: state.lion.startPosNum || (typeof getPosNumFromCoords === 'function' ? getPosNumFromCoords(lp) : '*'),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: (typeof distBucket === 'function' ? distBucket(dBefore) : ('d' + dBefore)),
    hidden: state.lion.hidden,
    attacking: state.lion.mode === 'attacking'
  };

  // 3) León elige acción
  let lionAction = 'avanzar';
  if (typeof chooseActionQ === 'function') lionAction = chooseActionQ(obs);
  state.lastLion = lionAction;

  // 4) Aplicar acción del león
  if (typeof applyLionAction === 'function') applyLionAction(lionAction, dBefore);
  else applyLionActionFallback(lionAction);
  if (state.pathLion) state.pathLion.push({ x: state.lion.pos.x, y: state.lion.pos.y });

  // 5) check flee
  let fleeInfo = { fled:false, causedByLion:false, immediateFailure:false };
  if (typeof checkAndTriggerImpalaFlee === 'function') fleeInfo = checkAndTriggerImpalaFlee(lionAction, impAction, dBefore);
  else fleeInfo = checkAndTriggerImpalaFleeFallback(lionAction, impAction, dBefore);

  if (fleeInfo.fled && fleeInfo.immediateFailure) {
    if (typeof updateQ === 'function') updateQ(obs, lionAction, -100, null);
    endHunt('Fracaso inmediato (impala alcanza velocidad >= león)');
    return true;
  }

  // 6) comprobar captura
  const reached = (state.lion.pos.x === state.impala.pos.x && state.lion.pos.y === state.impala.pos.y);
  if (reached) {
    if (typeof updateQ === 'function') updateQ(obs, lionAction, +100, null);
    endHunt('Éxito (impala atrapado)');
    return true;
  }

  // 7) si impala empezó a huir en este T y fue por el león => fracaso
  // Intentamos detectar si huye y la causa fue el león
  if (state.impala.fleeing && !state._impalaWasFleeingBeforeStep) {
    if (fleeInfo.causedByLion) {
      if (typeof updateQ === 'function') updateQ(obs, lionAction, -100, null);
      endHunt('Fracaso (impala huyó por culpa del león)');
      return true;
    } else {
      endHunt('Huida espontánea (no penalizada)');
      return true;
    }
  }

  // 8) no terminal -> update Q
  const dAfter = manhattan(state.lion.pos, state.impala.pos);
  const nextObs = {
    posNum: state.lion.startPosNum || (typeof getPosNumFromCoords === 'function' ? getPosNumFromCoords(state.lion.pos) : '*'),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: (typeof distBucket === 'function' ? distBucket(dAfter) : ('d' + dAfter)),
    hidden: state.lion.hidden,
    attacking: state.lion.mode === 'attacking'
  };
  let rw = -1;
  if (dAfter < dBefore) rw += 0.5;
  if (typeof updateQ === 'function') updateQ(obs, lionAction, rw, nextObs);

  // 9) incrementar tiempo y UI
  state.time = (state.time || 0) + 1;
  if (typeof renderQView === 'function') renderQView();
  if (typeof drawGrid === 'function') drawGrid(state);
  if (document.getElementById('turn')) document.getElementById('turn').textContent = state.time;

  return false;
}

/* Entrenamiento simplificado (safe) */
async function trainN(n, positions = [1,2,3,4,6,7,8]) {
  TRAIN_ABORT = false;
  training = true;
  state.fastMode = true;
  if (typeof pushLog === 'function') pushLog(`Entrenamiento ${n} episodios...`);

  for (let i = 0; i < n; i++) {
    if (TRAIN_ABORT) break;
    safeInitState(String(positions[Math.floor(Math.random()*positions.length)]));
    let iter = 0;
    while (iter < MAX_STEPS_PER_EPISODE) {
      iter++;
      const done = stepOnce();
      if (done) break;
    }
    if (typeof decayEpsilon === 'function') decayEpsilon();
    if (i % 200 === 0) await new Promise(r => setTimeout(r, 0));
  }

  training = false;
  state.fastMode = false;
  if (typeof saveQToLocal === 'function') saveQToLocal();
  if (typeof pushLog === 'function') pushLog('Entrenamiento finalizado.');
  if (typeof renderQView === 'function') renderQView();
  if (typeof drawGrid === 'function') drawGrid(state);
}

/* UI hooks */
function setupUIHooks() {
  const btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.addEventListener('click', () => {
    HUNT_OVER = false;
    const s = document.getElementById('startPos') ? document.getElementById('startPos').value : 'rand';
    safeInitState(s);
    if (typeof pushLog === 'function') pushLog('Estado reiniciado.');
    // re-enable step button
    const btn = document.getElementById('btnStep');
    if (btn) btn.disabled = false;
  });

  const btnStep = document.getElementById('btnStep');
  if (btnStep) btnStep.addEventListener('click', () => {
    if (HUNT_OVER) {
      if (typeof pushLog === 'function') pushLog('La cacería ya terminó. Usa RESET.');
      return;
    }
    stepOnce();
  });

  const btnTrain = document.getElementById('btnTrain');
  if (btnTrain) btnTrain.addEventListener('click', () => trainN(1000));

  const btnStop = document.getElementById('btnStopTrain');
  if (btnStop) btnStop.addEventListener('click', () => { TRAIN_ABORT = true; if (typeof pushLog === 'function') pushLog('Detención solicitada.'); });

  const btnSave = document.getElementById('btnSaveKB');
  if (btnSave) btnSave.addEventListener('click', () => { if (typeof downloadQ === 'function') downloadQ(); if (typeof pushLog === 'function') pushLog('Q-table guardada.'); });

  const btnLoad = document.getElementById('btnLoadKB');
  if (btnLoad) btnLoad.addEventListener('click', () => { const kb = document.getElementById('kbFile'); if (kb) kb.click(); });

  const kbFile = document.getElementById('kbFile');
  if (kbFile) kbFile.addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (typeof loadQFromFile === 'function') loadQFromFile(j);
        if (typeof renderQView === 'function') renderQView();
        if (typeof pushLog === 'function') pushLog('Q-table cargada.');
      } catch (err) {
        if (typeof pushLog === 'function') pushLog('Error cargando Q-table: ' + err.message);
        console.error(err);
      }
    };
    r.readAsText(f);
  });
}

/* Init page */
window.addEventListener('load', () => {
  if (typeof loadQFromLocal === 'function') loadQFromLocal();
  safeInitState(document.getElementById && document.getElementById('startPos') ? document.getElementById('startPos').value : 'rand');
  setupUIHooks();
  if (typeof renderQView === 'function') renderQView();
  if (typeof drawGrid === 'function') drawGrid(state);
});
