/* impala.js — comportamiento del impala: visión discreta, huida irreversible E/W con aceleración */

/* start huida: decide E/W to maximize distance; sets fleeCount and first move =1 */
function startImpalaFlee(state) {
  const imp = state.impala;
  const lionPos = state.lion.pos;

  imp.fleeing = true;
  imp.fleeCount = 1;
  imp.fleeVel = 1;

  const distIfE = Math.abs((imp.pos.x + 1) - lionPos.x);
  const distIfW = Math.abs((imp.pos.x - 1) - lionPos.x);

  if (distIfE > distIfW) imp.fleeDir = 'E';
  else if (distIfW > distIfE) imp.fleeDir = 'W';
  else imp.fleeDir = Math.random() < 0.5 ? 'E' : 'W';

  // first move (1)
  if (imp.fleeDir === 'E') imp.pos.x = Math.min(GRID - 1, imp.pos.x + 1);
  else imp.pos.x = Math.max(0, imp.pos.x - 1);

  imp.fleeVel = 1; // current speed
}

function impalaStep(state, action) {
  const imp = state.impala;

  if (imp.fleeing) {
    // T1=1, T2=1, T3=2, T4=3, ...
    let toMove = (imp.fleeCount <= 2) ? 1 : (imp.fleeCount - 1);
    if (imp.fleeDir === 'E') imp.pos.x = Math.min(GRID - 1, imp.pos.x + toMove);
    else imp.pos.x = Math.max(0, imp.pos.x - toMove);

    imp.fleeCount += 1;
    imp.fleeVel = toMove;
    return;
  }

  if (action === 'huir') {
    startImpalaFlee(state);
    return;
  }

  // other actions (ver_*, beber) do not change position here
  return;
}

/* impalaSees: uses start position of lion (startPosNum) per spec.
   - if lion hidden => false
   - if lion started pos5 and hasAdvanced => cannot be seen (unless attack or dist<3)
   - ver_frente -> sees if start in [8,1,2]
   - ver_izq -> sees if start in [6,7,8]
   - ver_der -> sees if start in [2,3,4]
*/
function impalaSees(state, lionPos, impalaAction) {
  if (state.lion.hidden) return false;

  const startPos = state.lion.startPosNum;

  if (startPos === 5 && state.lion.hasAdvanced) {
    // rule: cannot see lion that advanced from pos5 (except forced cases handled elsewhere)
    return false;
  }

  if (impalaAction === 'ver_frente') {
    return (startPos === 8 || startPos === 1 || startPos === 2);
  }
  if (impalaAction === 'ver_izq') {
    return (startPos === 6 || startPos === 7 || startPos === 8);
  }
  if (impalaAction === 'ver_der') {
    return (startPos === 2 || startPos === 3 || startPos === 4);
  }
  return false;
}
