/* leon.js — acciones del león: avanzar, atacar (persistente), esconder, esperar */

/* mover hacia impala: siempre acercarse 1 cuadro (diagonal permitido)
   si atacar -> attack step uses lionAttackStep (2 moves) and sets mode 'attacking'
*/
function lionAdvanceTowardsImpala(state) {
  const lp = state.lion.pos;
  const ip = state.impala.pos;

  if (lp.x === ip.x && lp.y === ip.y) return;

  const dx = ip.x - lp.x;
  const dy = ip.y - lp.y;

  const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
  const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

  // move one step towards impala (diagonal allowed)
  lp.x += stepX;
  lp.y += stepY;

  // clamp
  lp.x = Math.max(0, Math.min(GRID - 1, lp.x));
  lp.y = Math.max(0, Math.min(GRID - 1, lp.y));

  state.lion.hasAdvanced = true;
}

function lionAttackStep(state) {
  // set persistent attack mode
  state.lion.mode = 'attacking';
  state.lion.attacking = true;
  // two advance steps
  lionAdvanceTowardsImpala(state);
  lionAdvanceTowardsImpala(state);
}

/* get pos number from coords (O(8) only) */
function getPosNumFromCoords(coord) {
  for (const k in POS_MAP) {
    const p = POS_MAP[k];
    if (p.x === coord.x && p.y === coord.y) return Number(k);
  }
  return '*';
}
