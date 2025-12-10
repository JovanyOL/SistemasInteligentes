/* main.js — Versión corregida y coherente (usa initState, no createInitialState) */

const MAX_STEPS_PER_EPISODE = 1000;

/* Estado global */
let state = null;
let TRAIN_ABORT = false;
let training = false;
let HUNT_OVER = false;

/* -------------------------
   Util: distancia Manhattan
   ------------------------- */
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

/* -------------------------
   Compat: obtener acción del impala
   (si ya la tienes en otro archivo, está bien; esto es fallback)
   ------------------------- */
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

/* -------------------------
   Inicializar estado (usa tu initState si existe; este es seguro)
   ------------------------- */
function safeInitState(startPos) {
  if (typeof initState === 'function') {
    // usa la initState que ya tienes implementada (recomendado)
    initState(startPos);
    // recupera la variable global 'state' si initState la creó
    if (!state && typeof window.state !== 'undefined') state = window.state;
    return;
  }

  // Fallback: crear un state simple (no recomendado, solo por seguridad)
  const posNum = (startPos === 'rand') ? 1 : Number(startPos || 1);
  state = {
    lion: { pos: (typeof POS_MAP !== 'undefined' && POS_MAP[posNum]) ? { ...POS_MAP[posNum] } : {x:0,y:0}, hidden:false, mode:'normal', startPosNum: posNum },
    impala: { pos: (typeof IMPALA_START !== 'undefined') ? {...IMPALA_START} : {x:9,y:9}, fleeing:false, fleeDir:null, fleeVel:0 },
    time: 1,
    lastImpala: null,
    lastLion: null,
    running: false,
    fastMode: false,
    pathLion: [{ ...( (typeof POS_MAP !== 'undefined' && POS_MAP[posNum]) ? POS_MAP[posNum] : {x:0,y:0} ) }],
    pathImpala: [{ ...(typeof IMPALA_START !== 'undefined' ? IMPALA_START : {x:9,y:9}) }]
  };
}

/* -------------------------
   End hunt helper (centraliza finalizar)
   ------------------------- */
function endHunt(reason) {
  HUNT_OVER = true;
  if (typeof pushLog === 'function') pushLog('Cacería finalizada: ' + reason);
  if (document.getElementById('status')) document.getElementById('status').textContent = reason;
  if (typeof renderQView === 'function') renderQView();
  if (typeof drawGrid === 'function') drawGrid(state);
  // deshabilitar botón
  const btn = document.getElementById('btnStep');
  if (btn) btn.disabled = true;
}

/* -------------------------
   Aplicar acción del león (fallback seguro)
   ------------------------- */
function applyLionActionFallback(action) {
  if (!state || !state.lion) return;
  if (action === 'avanzar' && typeof lionAdvanceTowardsImpala === 'function') {
    lionAdvanceTowardsImpala(state);
    state.lion.hidden = false;
  } else if (action === 'esconder') {
    state.lion.hidden = true;
  } else if (action === 'atacar') {
    // prefer lionAttackStep if existe
    if (typeof lionAttackStep === 'function') lionAttackStep(state);
    else {
      if (typeof lionAdvanceTowardsImpala === 'function') { lionAdvanceTowardsImpala(state); lionAdvanceTowardsImpala(state); }
      state.lion.mode = 'attacking';
    }
  } // esperar -> noop
}

/* -------------------------
   Paso único de simulación (T)
   ------------------------- */
function stepOnce() {
  if (!state) {
    // intentar inicializar si no existe
    safeInitState(document.getElementById && document.getElementById('startPos') ? document.getElementById('startPos').value : 'rand');
  }
  if (HUNT_OVER) {
    if (typeof pushLog === 'function') pushLog('La cacería ya terminó. Presiona RESET.');
    return false;
  }

  // 1) Impala decide y actúa
  const impAction = (typeof getImpalaAction === 'function') ? getImpalaAction() : 'ver_frente';
  if (typeof impalaStep === 'function') impalaStep(state, impAction);
  state.lastImpala = impAction;
  if (state.pathImpala) state.pathImpala.push({ x: state.impala.pos.x, y: state.impala.pos.y });

  // si impala alcanzó borde => termina con fracaso
  if (state.impala.pos.x <= 0 || state.impala.pos.x >= GRID - 1) {
    endHunt('Fracaso (impala escapó al borde)');
    return true;
  }

  // 2) Observación antes del león
  const lp = state.lion.pos;
  const dBefore = manhattan(lp, state.impala.pos);

  const obs = {
    posNum: state.lion.startPosNum || (typeof getPosNumFromCoords === 'function' ? getPosNumFromCoords(lp) : '*'),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: (typeof distBucket === 'function' ? distBucket(dBefore) : ('d' + dBefore)),
    hidden: state.lion.hidden,
    attacking: state.lion.mode === 'attacking'
  };

  // 3) León elige acción por Q (o fallback)
  let lionAction = 'avanzar';
  if (typeof chooseActionQ === 'function') lionAction = chooseActionQ(obs);
  state.lastLion = lionAction;

  // 4) Aplicar acción del león (usar applyLionAction si existe)
  if (typeof applyLionAction === 'function') applyLionAction(lionAction, dBefore);
  else applyLionActionFallback(lionAction);

  if (state.pathLion) state.pathLion.push({ x: state.lion.pos.x, y: state.lion.pos.y });

  // 5) comprobar si impala huye por visión/ataque/dist
  let fleeInfo = { fled:false, causedByLion:false, immediateFailure:false };
  if (typeof checkAndTriggerImpalaFlee === 'function') fleeInfo = checkAndTriggerImpalaFlee(lionAction, impAction, dBefore);
  else {
    // fallback: si distancia <3 o ataque -> huir
    if (!state.impala.fleeing && (lionAction === 'atacar' || dBefore < 3)) {
      if (typeof startImpalaFlee === 'function') startImpalaFlee(state);
      state.impala.fleeing = true;
      fleeInfo = { fled:true, causedByLion:true, immediateFailure: (state.impala.fleeVel >= (state.lion.mode === 'attacking' ? 2 : 1)) };
    }
  }

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

  // 7) si impala empezó a huir en este T y fue por león => fracaso
  if (state.impala.fleeing && !state.impala._wasFleeingAtStartOfStep) {
    // note: we didn't store previous per-step flag, so check if it just became true:
    // if fleeInfo.causedByLion consider fracaso
    if (fleeInfo.causedByLion) {
      if (typeof updateQ === 'function') updateQ(obs, lionAction, -100, null);
      endHunt('Fracaso (impala huyó por culpa del león)');
      return true;
    } else {
      endHunt('Huida espontánea (no penalizada)');
      return true;
    }
  }

  // 8) no terminal: update Q with shaping reward
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

/* -------------------------
   Entrenamiento básico (usa trainN provisto si existe)
   ------------------------- */
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

/* -------------------------
   UI Hooks
   ------------------------- */
function setupUIHooks() {
  const btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.addEventListener('click', () => {
    HUNT_OVER = false;
    const s = document.getElementById('startPos') ? document.getElementById('startPos').value : 'rand';
    safeInitState(s);
    if (typeof pushLog === 'function') pushLog('Estado reiniciado.');
  });

  const btnStep = document.getElementById('btnStep');
  if (btnStep) {
    btnStep.addEventListener('click', () => {
      if (HUNT_OVER) {
        if (typeof pushLog === 'function') pushLog('La cacería ya terminó. Usa RESET.');
        return;
      }
      stepOnce();
    });
  }

  const btnTrain = document.getElementById('btnTrain');
  if (btnTrain) btnTrain.addEventListener('click', () => trainN(1000));

  const btnStopTrain = document.getElementById('btnStopTrain');
  if (btnStopTrain) btnStopTrain.addEventListener('click', () => { TRAIN_ABORT = true; if (typeof pushLog === 'function') pushLog('Detención solicitada.'); });

  const btnSave = document.getElementById('btnSaveKB');
  if (btnSave) btnSave.addEventListener('click', () => { if (typeof downloadQ === 'function') downloadQ(); if (typeof pushLog === 'function') pushLog('Q-table guardada.'); });

  const btnLoad = document.getElementById('btnLoadKB');
  if (btnLoad) btnLoad.addEventListener('click', () => { const kb = document.getElementById('kbFile'); if (kb) kb.click(); });

  const kbFile = document.getElementById('kbFile');
  if (kbFile) kbFile.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
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

/* -------------------------
   Inicialización al cargar la página
   ------------------------- */
window.addEventListener('load', () => {
  // intentar cargar Q local si existe
  if (typeof loadQFromLocal === 'function') loadQFromLocal();
  // inicializar estado (intenta usar initState si existe)
  safeInitState(document.getElementById && document.getElementById('startPos') ? document.getElementById('startPos').value : 'rand');
  // hooks UI
  setupUIHooks();
  // dibujar y mostrar
  if (typeof renderQView === 'function') renderQView();
  if (typeof drawGrid === 'function') drawGrid(state);
});
