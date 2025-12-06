/* leon.js — acciones del león y utilidades */
const LION_ACTIONS = ['avanzar','esconder','atacar'];

function lionAdvanceTowardsImpala(state){
  const lp = state.lion.pos; const ip = state.impala.pos;
  const dx = ip.x - lp.x; const dy = ip.y - lp.y;
  if(Math.abs(dx) >= Math.abs(dy)) lp.x += (dx>0?1:(dx<0?-1:0));
  else lp.y += (dy>0?1:(dy<0?-1:0));
}

function getPosNumFromCoords(coord){
  for(const k in POS_MAP){ const p = POS_MAP[k]; if(p.x===coord.x && p.y===coord.y) return Number(k); }
  return '*';
}
