/* main.js — conecta todo y contiene loop principal */
// estado global
let state = {};
let TRAIN_ABORT = false;

function initState(startPosOption){
  let posNum;
  if(startPosOption === 'rand'){ const opts = Object.keys(POS_MAP); posNum = Number(opts[Math.floor(Math.random()*opts.length)]); }
  else posNum = Number(startPosOption);
  state = {
    lion: { pos: {...POS_MAP[posNum]}, hidden:false, attacking:false, posNum: posNum },
    impala: { pos: {...IMPALA_START}, fleeing:false, fleeDir:null, fleeVel:1 },
    time: 1,
    lastImpala: null,
    lastLion: null,
    running:false
  };
  document.getElementById('turn').textContent = state.time;
  document.getElementById('status').textContent = 'Listo';
  document.getElementById('lastImpala').textContent = '-';
  document.getElementById('lastLion').textContent = '-';
  document.getElementById('log').innerHTML = '';
  drawGrid(state);
}

// stepOnce reusando lógica robusta (actualiza Q sólo en terminales)
function stepOnce(){
  if(state.running) return false;
  const impalaMode = document.getElementById('impalaMode').value;
  let impAction;
  if(state.impala.fleeing) impAction = 'huir';
  else if(impalaMode === 'aleatorio') impAction = IMPALA_ACTIONS[Math.floor(Math.random()*IMPALA_ACTIONS.length)];
  else{
    const seq = document.getElementById('progSeq').value.split(',').map(s=>s.trim()).filter(s=>s);
    impAction = seq.length===0 ? 'ver_frente' : seq[(state.time-1) % seq.length];
  }

  const impalaWasFleeing = state.impala.fleeing;
  impalaStep(state, impAction);
  state.lastImpala = impAction;

  // obs antes de accionar
  const lp = state.lion.pos; const d = euclid(lp, state.impala.pos);
  const obs = { posNum: getPosNumFromCoords(lp), impalaAction: state.impala.fleeing? 'huir': impAction, distBucket: distBucket(d), hidden: state.lion.hidden };

  // elegir acción por Q
  const lionAction = chooseActionQ(obs);
  state.lastLion = lionAction;

  // aplicar acción
  if(lionAction === 'avanzar'){ lionAdvanceTowardsImpala(state); state.lion.hidden = false; }
  else if(lionAction === 'esconder'){ state.lion.hidden = true; }
  else if(lionAction === 'atacar'){ state.lion.attacking = true; lionAdvanceTowardsImpala(state); lionAdvanceTowardsImpala(state); }

  // detectar huida causada por león
  let fleeTriggeredByLion = false;
  if(!state.impala.fleeing){
    const sees = impalaSees(state, state.lion.pos, impAction);
    if(sees || lionAction === 'atacar' || euclid(state.lion.pos, state.impala.pos) < 3){
      state.impala.fleeing = true; state.impala.fleeDir = (state.impala.pos.x <= state.lion.pos.x)?'E':'W'; state.impala.fleeVel = 1; fleeTriggeredByLion = true;
    }
  }

  // terminal checks
  const reached = (state.lion.pos.x === state.impala.pos.x && state.lion.pos.y === state.impala.pos.y);
  if(reached){
    // reward positive
    updateQ(obs, lionAction, 1, null);
    pushLog(`T=${state.time}: ÉXITO -> impala alcanzado.`);
    document.getElementById('status').textContent = 'Éxito'; renderQView(); drawGrid(state);
    return true;
  }

  if(state.impala.fleeing && !impalaWasFleeing){
    if(fleeTriggeredByLion){ updateQ(obs, lionAction, -1, null); pushLog(`T=${state.time}: Fracaso -> impala huyó por culpa del león.`); document.getElementById('status').textContent='Fracaso'; renderQView(); drawGrid(state); return true; }
    else { pushLog(`T=${state.time}: Impala huyó por decisión propia (no penalizado).`); document.getElementById('status').textContent='Huida espontánea (no penalizada)'; renderQView(); drawGrid(state); return true; }
  }

  // no terminal: actualizar Q con recompensa pequeña por paso y next state
  const lp2 = state.lion.pos; const d2 = euclid(lp2, state.impala.pos);
  const nextObs = { posNum: getPosNumFromCoords(lp2), impalaAction: state.impala.fleeing? 'huir': impAction, distBucket: distBucket(d2), hidden: state.lion.hidden };
  updateQ(obs, lionAction, -0.01, nextObs);

  state.time += 1; document.getElementById('turn').textContent = state.time; document.getElementById('status').textContent = 'En curso'; renderQView(); drawGrid(state);
  return false;
}

// UI hooks
document.getElementById('btnReset').addEventListener('click', ()=>{ initState(document.getElementById('startPos').value); pushLog('Estado reiniciado.'); });

let training = false;
async function trainN(n){ TRAIN_ABORT=false; training=true; document.getElementById('btnStopTrain').style.display='inline-block'; pushLog(`Entrenamiento ${n} episodios iniciando...`);
  for(let i=0;i<n;i++){
    if(TRAIN_ABORT) break;
    initState(document.getElementById('startPos').value);
    let iter=0; while(true && iter<500){ iter++; const done = stepOnce(); if(done) break; }
    if(i%50===0) await new Promise(r=>setTimeout(r,0));
  }
  training=false; document.getElementById('btnStopTrain').style.display='none'; saveQToLocal(); pushLog('Entrenamiento terminado.'); renderQView();
}

document.getElementById('btnTrain').addEventListener('click', ()=>{ trainN(1000); });
document.getElementById('btnStopTrain').addEventListener('click', ()=>{ TRAIN_ABORT=true; pushLog('Solicitud de detención recibida.'); });

document.getElementById('btnStep').addEventListener('click', ()=>{ stepOnce(); });

document.getElementById('btnRun').addEventListener('click', ()=>{ state.running=true; document.getElementById('status').textContent='Ejecutando...'; let steps=0; function loop(){ if(steps++>400){ state.running=false; document.getElementById('status').textContent='Detenido (límite)'; return; } const done = stepOnce(); if(done){ state.running=false; return; } setTimeout(loop,120); } loop(); });

document.getElementById('btnShowKB').addEventListener('click', ()=>{ renderQView(); pushLog('Mostrando Q-table.'); });

document.getElementById('btnSaveKB').addEventListener('click', ()=>{ downloadQ(); pushLog('Descargando Q-table...'); });

document.getElementById('btnLoadKB').addEventListener('click', ()=>{ document.getElementById('kbFile').click(); });

document.getElementById('kbFile').addEventListener('change', (e)=>{ const f = e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const j=JSON.parse(r.result); loadQFromFile(j); renderQView(); pushLog('Q-table cargada desde archivo.'); }catch(err){ pushLog('Error cargando Q-table: '+err.message); } }; r.readAsText(f); });

document.getElementById('impalaMode').addEventListener('change',(e)=>{ document.getElementById('progLabel').style.display = e.target.value==='programado' ? 'block':'none'; });

document.getElementById('btnExplain').addEventListener('click', ()=>{
  const lp = state.lion.pos; const d = euclid(lp,state.impala.pos); const obs = { posNum:getPosNumFromCoords(lp), impalaAction: state.impala.fleeing? 'huir': state.lastImpala, distBucket:distBucket(d), hidden: state.lion.hidden };
  const key = qKeyFromObs(obs); ensureQ(key);
  let s = `Clave usada: ${key}\n`;
  for(const a in QTABLE[key]) s += `${a}: ${QTABLE[key][a].toFixed(3)}\n`;
  pushLog(s);
});

// inicio automático
loadQFromLocal(); 
initLogElement(); // ¡Importante! Inicializa la referencia al elemento LOG
initState('rand'); 
renderQView();