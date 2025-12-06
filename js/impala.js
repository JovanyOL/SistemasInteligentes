
/* impala.js — comportamiento del impala */
const IMPALA_ACTIONS = ['ver_izq','ver_der','ver_frente','beber','huir_e','huir_o'];

function impalaStep(state, action){
  // state.impala: {pos, fleeing, fleeDir, fleeVel}
  if(state.impala.fleeing){
    const v = state.impala.fleeVel;
    if(state.impala.fleeDir === 'E') state.impala.pos.x += v;
    else state.impala.pos.x -= v;
    state.impala.fleeVel += 1;
    return;
  }
  if(action === 'huir_e' || action === 'huir_o'){
    state.impala.fleeing = true;
    state.impala.fleeDir = action === 'huir_e' ? 'E' : 'W';
    state.impala.fleeVel = 1;
    if(state.impala.fleeDir === 'E') state.impala.pos.x += 1; else state.impala.pos.x -= 1;
  }
}

function impalaSees(state, lionPos, impalaAction){
  if(state.lion.hidden) return false;
  // compute relative angle
  const ang = angleDeg(state.impala.pos, lionPos); // deg from +x
  let rel = (ang - 90 + 360) % 360;
  if(impalaAction === 'ver_frente') return (rel <= 45 || rel >= 315);
  if(impalaAction === 'ver_izq') return (rel > 45 && rel <= 135);
  if(impalaAction === 'ver_der') return (rel >= 225 && rel < 315);
  return false;
}
