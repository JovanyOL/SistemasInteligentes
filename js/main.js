/* main.js — versión robusta: bloqueo Siguiente T, HUNT_OVER, compatibilidad */
/* Reemplaza todo el contenido de tu js/main.js por este bloque. */

const MAX_STEPS_PER_EPISODE = 1000;

/* Estado global */
let state = {};
let TRAIN_ABORT = false;
let training = false;
let HUNT_OVER = false; // controla si la cacería terminó

/* --------- Utilidades locales (compatibilidad) ---------- */
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

/* --------- Inicializar estado (guarda startPosNum y rutas) --------- */
function initState(startPosOption) {
  // validar existencia de POS_MAP e IMPALA_START
  if (typeof POS_MAP === 'undefined' || typeof IMPALA_START === 'undefined') {
    console.error('initState: POS_MAP o IMPALA_START no definidos (ver env.js)');
    return;
  }

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
      mode: 'normal',
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
    fastMode: false,
    pathLion: [{ ...POS_MAP[posNum] }],
    pathImpala: [{ ...IMPALA_START }]
  };

  HUNT_OVER = false; // desbloquear Siguiente T
  // Si UI tiene resetTrails, llamarla; si no, protegemos la llamada
  if (typeof resetTrails === 'function') resetTrails();

  // actualizar UI
  if (document.getElementById('turn')) document.getElementById('turn').textContent = state.time;
  if (document.getElementById('status')) document.getElementById('status').textContent = 'Listo';
  if (document.getElementById('lastImpala')) document.getElementById('lastImpala').textContent = '-';
  if (document.getElementById('lastLion')) document.getElementById('lastLion').textContent = '-';
  if (document.getElementById('log')) document.getElementById('log').innerHTML = '';

  // dibujar estado inicial (si drawGrid existe)
  if (typeof drawGrid === 'function') drawGrid(state);
  if (typeof renderQView === 'function') renderQView();
}

/* --------- Obtener acción del impala (impala actúa primero) --------- */
function getImpalaAction() {
  if (state.impala.fleeing) return 'huir';
  const modeEl = document.getElementById('impalaMode');
  const mode = modeEl ? modeEl.value : 'aleatorio';
  if (mode === 'aleatorio') {
    if (typeof IMPALA_ACTIONS === 'undefined') return 'ver_frente';
    return IMPALA_ACTIONS[Math.floor(Math.random() * IMPALA_ACTIONS.length)];
  }
  // programado
  const seqEl = document.getElementById('progSeq');
  const seq = seqEl ? seqEl.value.split(',').map(s => s.trim()).filter(s => s) : [];
  return seq.length === 0 ? 'ver_frente' : seq[(state.time - 1) % seq.length];
}

/* --------- Aplicar acción del león (usa funciones de leon.js) --------- */
function applyLionAction(action, distBefore) {
  // si ya en modo atacando, forzamos attack step
  if (state.lion.mode === 'attacking') {
    if (typeof lionAttackStep === 'function') {
      lionAttackStep(state);
      return;
    }
  }

  if (action === 'atacar') {
    state.lion.mode = 'attacking';
    if (typeof lionAttackStep === 'function') { lionAttackStep(state); return; }
    // fallback: dos avances
    if (typeof lionAdvanceTowardsImpala === 'function') { lionAdvanceTowardsImpala(state); lionAdvanceTowardsImpala(state); return; }
  }

  if (action === 'avanzar') {
    if (typeof lionAdvanceTowardsImpala === 'function') lionAdvanceTowardsImpala(state);
    state.lion.hidden = false;
    if (state.lion.startPosNum === 5) state.lion.hasAdvanced = true;
    return;
  }

  if (action === 'esconder') {
    state.lion.hidden = true;
    return;
  }

  // esperar / noop
  return;
}

/* --------- Comprobar si el impala debe iniciar huida por el león --------- */
function checkAndTriggerImpalaFlee(lionAction, impalaAction, distBefore) {
  // asegúrate de que impalaSees y startImpalaFlee existan
  const canSee = (typeof impalaSees === 'function') ? impalaSees(state, state.lion.pos, impalaAction) : false;
  const attackTriggered = (lionAction === 'atacar' || state.lion.mode === 'attacking');
  const close = distBefore < 3;

  if (!state.impala.fleeing && (canSee || attackTriggered || close)) {
    // iniciar huida
    if (typeof startImpalaFlee === 'function') startImpalaFlee(state);
    else if (typeof impalaStep === 'function') impalaStep(state, 'huir'); // fallback
    // determinar if immediate failure: impala first speed >= lion speed
    const lionSpeed = (state.lion.mode === 'attacking') ? 2 : 1;
    const impFirstVel = state.impala.fleeVel || 1;
    const immediateFailure = impFirstVel >= lionSpeed;
    return { fled: true, causedByLion: (canSee || attackTriggered || close), immediateFailure };
  }
  return { fled: false, causedByLion: false, immediateFailure: false };
}

/* --------- Función para terminar la cacería de forma central --------- */
function endHunt(reason, obs=null, lionAction=null) {
  HUNT_OVER = true;
  if (obs && lionAction && typeof updateQ === 'function') {
    // actualizar Q con fracaso o éxito según reason
    if (reason.toLowerCase().includes('exito')) updateQ(obs, lionAction, +100, null);
    else updateQ(obs, lionAction, -100, null);
  }
  if (typeof pushLog === 'function') pushLog('Cacería finalizada: ' + reason);
  if (document.getElementById('status')) document.getElementById('status').textContent = reason;
  if (typeof renderQView === 'function') renderQView();
  if (typeof drawGrid === 'function') drawGrid(state);
}

/* --------- Un paso de simulación (T) --------- */
function stepOnce() {
  if (state.running) return false;
  if (HUNT_OVER) { if (typeof pushLog === 'function') pushLog('La cacería ya terminó. Presiona RESET.'); return false; }

  // 1) Impala decide y se mueve si huye
  const impAction = getImpalaAction();
  const impalaWasFleeing = state.impala.fleeing;

  // ejecutar impalaStep (debe manejar huida incremental)
  if (typeof impalaStep === 'function') impalaStep(state, impAction);
  state.lastImpala = impAction;
  // guardar trayectoria si existe path arrays
  if (state.pathImpala) state.pathImpala.push({ x: state.impala.pos.x, y: state.impala.pos.y });

  // si impala llegó al borde -> fracaso y terminar
  if (state.impala.pos.x <= 0 || state.impala.pos.x >= GRID - 1) {
    endHunt('Fracaso (impala escapó al borde)');
    return true;
  }

  // 2) Observación para Q (antes de que el león actúe)
  const lp = state.lion.pos;
  const dBefore = manhattan(lp, state.impala.pos);

  const obs = {
    posNum: state.lion.startPosNum || getPosNumFromCoords(lp),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: (typeof distBucket === 'function') ? distBucket(dBefore) : ('d'+dBefore),
    hidden: state.lion.hidden,
    attacking: state.lion.mode === 'attacking'
  };

  // 3) León elige
  let lionAction = null;
  if (typeof chooseActionQ === 'function') lionAction = chooseActionQ(obs);
  else lionAction = 'avanzar'; // fallback

  state.lastLion = lionAction;

  // 4) León actúa
  applyLionAction(lionAction, dBefore);
  if (state.pathLion) state.pathLion.push({ x: state.lion.pos.x, y: state.lion.pos.y });

  // 5) comprobar si el impala huye por el león (visión/ataque/distancia)
  const fleeInfo = checkAndTriggerImpalaFlee(lionAction, impAction, dBefore);
  if (fleeInfo.fled && fleeInfo.immediateFailure) {
    // fracaso inmediato según regla
    if (typeof updateQ === 'function') updateQ(obs, lionAction, -100, null);
    endHunt('Fracaso inmediato (impala alcanza velocidad >= león)', obs, lionAction);
    return true;
  }

  // 6) comprobar captura
  const reached = (state.lion.pos.x === state.impala.pos.x && state.lion.pos.y === state.impala.pos.y);
  if (reached) {
    if (typeof updateQ === 'function') updateQ(obs, lionAction, +100, null);
    endHunt('Éxito', obs, lionAction);
    return true;
  }

  // 7) si impala empezó a huir en este T y fue por el león -> fracaso
  if (state.impala.fleeing && !impalaWasFleeing) {
    if (fleeInfo.causedByLion) {
      if (typeof updateQ === 'function') updateQ(obs, lionAction, -100, null);
      endHunt('Fracaso (impala huyó por culpa del león)', obs, lionAction);
      return true;
    } else {
      endHunt('Huida espontánea (no penalizada)'); // según tu spec se puede terminar
      return true;
    }
  }

  // 8) caso no-terminal: actualizar Q con reward shaping
  const dAfter = manhattan(state.lion.pos, state.impala.pos);
  const nextObs = {
    posNum: state.lion.startPosNum || getPosNumFromCoords(state.lion.pos),
    impalaAction: state.impala.fleeing ? 'huir' : impAction,
    distBucket: (typeof distBucket === 'function') ? distBucket(dAfter) : ('d'+dAfter),
    hidden: state.lion.hidden,
    attacking: state.lion.mode === 'attacking'
  };

  // reward shaping simple: -1 por paso, +0.5 si se acerca
  let stepReward = -1;
  if (dAfter < dBefore) stepReward += 0.5;
  if (typeof updateQ === 'function') updateQ(obs, lionAction, stepReward, nextObs);

  // 9) incrementar tiempo y UI
  state.time++;
  if (!state.fastMode) {
    if (document.getElementById('turn')) document.getElementById('turn').textContent = state.time;
    if (typeof drawGrid === 'function') drawGrid(state);
    if (typeof renderQView === 'function') renderQView();
  }

  return false;
}

/* --------- Entrenamiento (mantener comportamiento) --------- */
async function trainN(n, positions = [1,2,3,4,6,7,8]) {
  TRAIN_ABORT = false;
  training = true;
  state.fastMode = true;
  if (typeof pushLog === 'function') pushLog(`Entrenamiento ${n} episodios...`);

  for (let i = 0; i < n; i++) {
    if (TRAIN_ABORT) break;
    initState(String(positions[Math.floor(Math.random()*positions.length)]));
    let iter = 0;
    while (iter < MAX_STEPS_PER_EPISODE) {
      iter++;
      const done = stepOnce();
      if (done) break;
    }
    // decaimiento epsilon si aplicable
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

/* --------- UI hooks (asegúrate de reemplazar listeners si ya existen) --------- */
document.getElementById('btnReset').addEventListener('click', () => {
  HUNT_OVER = false;
  initState(document.getElementById('startPos').value);
  if (typeof pushLog === 'function') pushLog('Estado reiniciado.');
});

document.getElementById('btnStep').addEventListener('click', () => {
  if (HUNT_OVER) { if (typeof pushLog === 'function') pushLog('La cacería terminó. Usa RESET.'); return; }
  stepOnce();
});

document.getElementById('btnTrain').addEventListener('click', () => trainN(1000));
document.getElementById('btnStopTrain').addEventListener('click', () => { TRAIN_ABORT = true; if (typeof pushLog === 'function') pushLog('Detención solicitada.'); });

document.getElementById('btnShowKB').addEventListener('click', () => { if (typeof renderQView === 'function') renderQView(); if (typeof pushLog === 'function') pushLog('Mostrar Q-table.'); });

document.getElementById('btnSaveKB').addEventListener('click', () => { if (typeof downloadQ === 'function') downloadQ(); if (typeof pushLog === 'function') pushLog('Q-table descargada.'); });

document.getElementById('btnLoadKB').addEventListener('click', () => { document.getElementById('kbFile').click(); });

document.getElementById('kbFile').addEventListener('change', e => {
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

/* init */
if (typeof loadQFromLocal === 'function') loadQFromLocal();
if (typeof initLogElement === 'function') initLogElement();
initState('rand');
if (typeof renderQView === 'function') renderQView();
if (typeof drawGrid === 'function') drawGrid(state);
