/* main.js — integración completa + descripción de movimiento del león + bloqueo de botón Step */

const R_EXITO = +100;
const R_FRACASO = -100;
const R_PASO = -1;
const R_ACERCARSE = +0.5;
const MAX_STEPS_PER_EPISODE = 1000;

let state = {};
let TRAIN_ABORT = false;
let training = false;

/* helper */
function manhattan(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }

/* ============================================
   NUEVO: descripción legible para el usuario
============================================ */
function describeLionAction(action, state) {
  if (state.lion.mode === "attacking") return "Ataca (velocidad 2 celdas/T)";
  if (action === "avanzar") return "Avanza hacia el impala";
  if (action === "esconder") return "Se esconde";
  if (action === "esperar") return "Espera";
  return action;
}

/* initState builds the full state including path arrays and stores startPosNum */
function initState(startPosOption) {
  let posNum;
  if (startPosOption === 'rand') {
    const opts = Object.keys(POS_MAP);
    posNum = Number(opts[Math.floor(Math.random()*opts.length)]);
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

  document.getElementById('turn').textContent = state.time;
  document.getElementById('status').textContent = 'Listo';
  document.getElementById('lastImpala').textContent = '-';
  document.getElementById('lastLion').textContent = '-';
  document.getElementById('log').innerHTML = '';

  // habilitamos nuevamente el botón Step
  document.getElementById('btnStep').disabled = false;

  drawGrid(state);
  renderQView();
}

/* impala decides first */
function getImpalaAction() {
  if (state.impala.fleeing) return 'huir';
  const mode = document.getElementById('impalaMode').value;
  if (mode === 'aleatorio') return IMPALA_ACTIONS[Math.floor(Math.random()*IMPALA_ACTIONS.length)];
  const seq = document.getElementById('progSeq').value.split(',').map(s=>s.trim()).filter(s=>s);
  return seq.length===0 ? 'ver_frente' : seq[(state.time-1) % seq.length];
}

/* compute observation for Q */
function makeObs() {
  const lp = state.lion.pos;
  const posNum = state.lion.startPosNum || getPosNumFromCoords(lp);
  const impAct = state.impala.fleeing ? 'huir' : (state.impala.lastAction || 'ver_frente');
  const d = manhattan(state.lion.pos, state.impala.pos);
  return { posNum: posNum, impalaAction: impAct, distBucket: distBucket(d), hidden: state.lion.hidden, attacking: state.lion.mode==='attacking' };
}

/* ============================================
   NUEVO: finaliza episodio + bloquea botón Step
============================================ */
function endEpisode(message, statusText) {
  pushLog(message);
  document.getElementById('status').textContent = statusText;
  renderQView();
  drawGrid(state);
  document.getElementById('btnStep').disabled = true;   // ← BLOQUEO
}

/* step once: impala acts, then lion reacts (Q), update Q accordingly */
function stepOnce() {
  if (state.running) return false;

  // 1) impala action
  const impAction = getImpalaAction();
  state.impala.lastAction = impAction;
  impalaStep(state, impAction);
  state.pathImpala.push({ x: state.impala.pos.x, y: state.impala.pos.y });
  state.lastImpala = impAction;

  // observe BEFORE lion acts
  const obs = makeObs();
  const dBefore = manhattan(state.lion.pos, state.impala.pos);

  // lion chooses via Q
  const lionAction = chooseActionQ(obs);
  state.lastLion = lionAction;

  // ============================================
  // NUEVO: mostrar texto bonito para el usuario
  // ============================================
  const pretty = describeLionAction(lionAction, state);
  document.getElementById('lastLion').textContent = pretty;
  pushLog(`León: ${pretty}`);

  // apply lion action
  if (state.lion.mode === 'attacking') {
    lionAttackStep(state);
  } else {
    if (lionAction === 'atacar') {
      state.lion.mode = 'attacking';
      lionAttackStep(state);
    } else if (lionAction === 'avanzar') {
      lionAdvanceTowardsImpala(state);
      state.lion.hidden = false;
      if (state.lion.startPosNum === 5) state.lion.hasAdvanced = true;
    } else if (lionAction === 'esconder') {
      state.lion.hidden = true;
    }
  }
  state.pathLion.push({ x: state.lion.pos.x, y: state.lion.pos.y });

  // flee triggers
  const sees = impalaSees(state, state.lion.pos, state.impala.lastAction);
  const attackTriggered = (lionAction==='atacar' || state.lion.mode==='attacking');
  const close = dBefore < 3;

  if (!state.impala.fleeing && (attackTriggered || close || sees)) {
    startImpalaFlee(state);
    const lionSpeed = (state.lion.mode === 'attacking') ? 2 : 1;
    const impFirstSpeed = state.impala.fleeVel || 1;

    if (impFirstSpeed >= lionSpeed) {
      updateQ(obs, lionAction, R_FRACASO, null);
      endEpisode(`T=${state.time}: Fracaso inmediato (Impala más rápido).`, "Fracaso inmediato");
      return true;
    }
    pushLog(`T=${state.time}: Impala inicia huida.`);
  }

  // capture
  const reached = (state.lion.pos.x === state.impala.pos.x && state.lion.pos.y === state.impala.pos.y);
  if (reached) {
    updateQ(obs, lionAction, R_EXITO, null);
    endEpisode(`T=${state.time}: Éxito — impala capturado.`, "Éxito");
    return true;
  }

  // update Q normal
  const dAfter = manhattan(state.lion.pos, state.impala.pos);
  const nextObs = makeObs();
  updateQ(obs, lionAction, (dAfter<dBefore? R_PASO+R_ACERCARSE: R_PASO - (dAfter>dBefore? Math.abs(R_ACERCARSE):0)), nextObs);

  // impala escapes by reaching edge
  if (state.impala.fleeing && (state.impala.pos.x === 0 || state.impala.pos.x === GRID-1)) {
    updateQ(obs, lionAction, R_FRACASO, null);
    endEpisode(`T=${state.time}: Fracaso — impala escapó al borde.`, "Fracaso (escape)");
    return true;
  }

  // normal step
  state.time += 1;
  document.getElementById('turn').textContent = state.time;
  document.getElementById('status').textContent = 'En curso';
  drawGrid(state);
  renderQView();
  return false;
}

/* training loop */
async function trainN(n, positions_initial = [1,2,3,4,6,7,8]) {
  TRAIN_ABORT = false;
  training = true;
  state.fastMode = true;
  document.getElementById('btnStopTrain').style.display = 'inline-block';
  pushLog(`Entrenamiento ${n} episodios...`);

  for (let i = 0; i < n; i++) {
    if (TRAIN_ABORT) break;
    const pos = positions_initial[Math.floor(Math.random()*positions_initial.length)];
    initState(String(pos));
    let iter = 0;
    while (iter < MAX_STEPS_PER_EPISODE) {
      iter++;
      if (stepOnce()) break;
    }
    decayEpsilon();
    if (i % 200 === 0) await new Promise(r=>setTimeout(r,0));
  }

  training = false;
  state.fastMode = false;
  document.getElementById('btnStopTrain').style.display = 'none';
  saveQToLocal();
  pushLog('Entrenamiento finalizado.');
  drawGrid(state);
  renderQView();
}

/* UI hooks */
document.getElementById('btnReset').addEventListener('click', ()=>{ initState(document.getElementById('startPos').value); pushLog('Estado reiniciado.'); });
document.getElementById('btnStep').addEventListener('click', ()=>{ stepOnce(); });
document.getElementById('btnTrain').addEventListener('click', ()=>{ trainN(1000); });
document.getElementById('btnStopTrain').addEventListener('click', ()=>{ TRAIN_ABORT = true; pushLog('Solicitud detención recibida.'); });

document.getElementById('btnShowKB').addEventListener('click', ()=>{ renderQView(); pushLog('Q-table mostrada.'); });
document.getElementById('btnExplain').addEventListener('click', ()=>{ 
  const obs = makeObs();
  const key = qKeyFromObs(obs);
  ensureQ(key);
  let s = `Clave: ${key}\n`;
  for (const a in QTABLE[key]) s += `${a}: ${QTABLE[key][a].toFixed(3)}\n`;
  pushLog(s);
});

document.getElementById('btnSaveKB').addEventListener('click', ()=>{ downloadQ(); });
document.getElementById('btnLoadKB').addEventListener('click', ()=>{ document.getElementById('kbFile').click(); });
document.getElementById('kbFile').addEventListener('change', (e)=>{ 
  const f=e.target.files[0]; 
  if(!f) return; 
  const r=new FileReader(); 
  r.onload=()=>{ 
    try{ 
      loadQFromFile(JSON.parse(r.result)); 
      renderQView(); 
      pushLog('Q-table cargada.'); 
    }catch(err){ pushLog('Error: '+err.message);} 
  }; 
  r.readAsText(f); 
});

/* init */
loadQFromLocal();
initLogElement();
initState('rand');
renderQView();
drawGrid(state);
