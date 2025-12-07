/* leon.js — acciones del león (MEJORADO) */

// Acciones consistentes con el Q-learning
const LION_ACTIONS = ['avanzar','esconder','atacar','esperar'];

/* ============================================================
   MOVER AL LEÓN HACIA EL IMPALA (convalidación de límites)
   ============================================================ */
function lionAdvanceTowardsImpala(state) {
  const lp = state.lion.pos;
  const ip = state.impala.pos;

  // si ya está en la casilla → no mover
  if (lp.x === ip.x && lp.y === ip.y) return;

  const dx = ip.x - lp.x;
  const dy = ip.y - lp.y;

  // decidir eje primario de movimiento
  let moveX = 0, moveY = 0;

  if (Math.abs(dx) > Math.abs(dy)) {
    moveX = dx > 0 ? 1 : -1;
  } else if (Math.abs(dy) > Math.abs(dx)) {
    moveY = dy > 0 ? 1 : -1;
  } else {
    // empate: elegir eje aleatorio
    if (Math.random() < 0.5) moveX = dx > 0 ? 1 : -1;
    else moveY = dy > 0 ? 1 : -1;
  }

  lp.x += moveX;
  lp.y += moveY;

  // validar límites (por seguridad)
  lp.x = Math.max(0, Math.min(GRID - 1, lp.x));
  lp.y = Math.max(0, Math.min(GRID - 1, lp.y));
}

/* ============================================================
   MAPEAR COORD A POS_NUM (optimizado si deseas)
   ============================================================ */
function getPosNumFromCoords(coord){
  for (const k in POS_MAP) {
    const p = POS_MAP[k];
    if (p.x === coord.x && p.y === coord.y) return Number(k);
  }
  return '*';
}
