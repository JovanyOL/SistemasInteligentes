/* leon.js — acciones del león (actualizado con reglas solicitadas) */

/* Acciones consistentes */
const LION_ACTIONS = ['avanzar','esconder','atacar','esperar'];

/* Avanzar: siempre se acerca al impala 1 cuadro por T (nunca retrocede).
   Si hay dx y dy no nulos, permite mover diagonal (camino más corto).
*/
function lionAdvanceTowardsImpala(state) {
  const lp = state.lion.pos;
  const ip = state.impala.pos;

  // si ya está en la misma casilla => no mover
  if (lp.x === ip.x && lp.y === ip.y) return;

  const dx = ip.x - lp.x;
  const dy = ip.y - lp.y;

  // decide movimiento: acercarse (signo de dx, dy) — diagonal permitido
  let stepX = 0, stepY = 0;
  if (dx > 0) stepX = 1;
  else if (dx < 0) stepX = -1;

  if (dy > 0) stepY = 1;
  else if (dy < 0) stepY = -1;

  // mover 1 cuadro hacia el impala (diagonal si ambos no cero)
  lp.x += stepX;
  lp.y += stepY;

  // clamping a límites del grid
  lp.x = Math.max(0, Math.min(GRID - 1, lp.x));
  lp.y = Math.max(0, Math.min(GRID - 1, lp.y));

  // marcar que el león avanzó (importante para regla especial de la posición 5)
  state.lion.hasAdvanced = true;
}

/* Atacar: movimiento especial con velocidad 2. 
   Una vez que el león pasa a modo 'attacking', no puede volver atrás dentro de la misma incursión.
   Implementamos la flag state.lion.mode = 'attacking' para bloquear cambios.
*/
function lionAttackStep(state) {
  // mover 2 pasos hacia el impala, siguiendo la misma regla de acercamiento (dos veces)
  // si ya está atacando, mantenemos mode='attacking'
  state.lion.mode = 'attacking';
  state.lion.attacking = true;

  // repetimos dos pasos de avance (cada uno con diagonal posible)
  for (let i = 0; i < 2; i++) {
    lionAdvanceTowardsImpala(state);
  }
}

/* Obtener posNum desde coords (si coincide con POS_MAP)
   Se deja versión simple O(n) — POS_MAP tiene solo 8 entradas.
*/
function getPosNumFromCoords(coord){
  for (const k in POS_MAP) {
    const p = POS_MAP[k];
    if (p.x === coord.x && p.y === coord.y) return Number(k);
  }
  return '*';
}
