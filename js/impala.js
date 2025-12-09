/* impala.js — comportamiento del impala actualizado con las reglas solicitadas */

// Acciones válidas del impala (coincide con env.js)
const IMPALA_ACTIONS = ['ver_izq','ver_der','ver_frente','beber','huir'];

/* Inicia huida: decide dirección E o W que maximiza separación o al azar si empate.
   A partir de aquí impala.fleeing = true y no puede dejar de huir.
   Primera fase: los dos primeros T => 1 cuadro/T; luego incremento 1 por T adicional.
*/
function startImpalaFlee(state) {
  const imp = state.impala;
  const lionPos = state.lion.pos;

  imp.fleeing = true;
  imp.fleeCount = 1; // primer T de huida (contará 1, 2, 3...)
  imp.fleeVel = 1;   // 1 cuadro en T1 (y en T2), luego aumentará
  // elegir dirección E/W para alejarse del león
  const distIfE = Math.abs((imp.pos.x + 1) - lionPos.x); // if moves one east (rough heuristic)
  const distIfW = Math.abs((imp.pos.x - 1) - lionPos.x);

  if (distIfE > distIfW) imp.fleeDir = 'E';
  else if (distIfW > distIfE) imp.fleeDir = 'W';
  else imp.fleeDir = (Math.random() < 0.5) ? 'E' : 'W';

  // primer movimiento: 1 cuadro
  if (imp.fleeDir === 'E') imp.pos.x = Math.min(GRID - 1, imp.pos.x + 1);
  else imp.pos.x = Math.max(0, imp.pos.x - 1);

  // clamp
  imp.pos.x = Math.max(0, Math.min(GRID - 1, imp.pos.x));
}

function impalaStep(state, action) {
  const imp = state.impala;

  // si ya está huyendo: ejecutar el patrón de aceleración (irresistible)
  if (imp.fleeing) {
    // En el primer y segundo T de huida se mueve 1 cuadro cada uno.
    // A partir del tercer T, cada T se incrementa la distancia en +1 respecto al anterior.
    // Es decir: T1=1, T2=1, T3=2, T4=3, T5=4, ...
    imp.fleeCount = (imp.fleeCount || 1);
    let toMove;
    if (imp.fleeCount <= 2) toMove = 1;
    else toMove = imp.fleeCount - 1; // T3 -> 2, T4 -> 3, ...

    // mover toMove pasos en la dirección imp.fleeDir (E o W)
    if (imp.fleeDir === 'E') imp.pos.x = Math.min(GRID - 1, imp.pos.x + toMove);
    else imp.pos.x = Math.max(0, imp.pos.x - toMove);

    // incrementar velocidad para el próximo turno
    imp.fleeCount += 1;
    imp.fleeVel = toMove; // velocidad actual (pasos por T)
    // clamp
    imp.pos.x = Math.max(0, Math.min(GRID - 1, imp.pos.x));
    return;
  }

  // si acción explícita de huida (programada o aleatoria)
  if (action === 'huir') {
    startImpalaFlee(state);
    return;
  }

  // ver_izq, ver_der, ver_frente, beber -> no cambian posición, solo afectan visión
  // beber no mueve
  return;
}

/* impalaSees: el impala puede ver al león sólo si (A) el león NO está escondido
   y (B) la acción de visión coincide con la posición inicial del león según tus reglas.
   Además excepción: si león empezó en pos 5 y luego avanzó, el impala NO puede verlo (salvo ataque o distancia<3).
*/
function impalaSees(state, lionPos, impalaAction) {
  // si el león está escondido -> no ve
  if (state.lion.hidden) return false;

  // si el león está en modo ataque -> impala huirá (pero verificación puede ser usada por lógica)
  // La regla: impala ve según la posición INICIAL del león (startPosNum)
  const startPos = state.lion.startPosNum; // debe haberse guardado en initState
  // Regla especial: si león empezó en pos 5 y HA avanzado, entonces impala no puede verlo (salvo ataque o distancia<3)
  if (startPos === 5 && state.lion.hasAdvanced) {
    return false;
  }

  // mapping:
  // ver_frente (arriba) -> ve si lion inicio en 8,1,2
  // ver_izq -> ve si lion inicio en 6,7,8
  // ver_der -> ve si lion inicio en 2,3,4
  if (impalaAction === 'ver_frente') {
    return (startPos === 8 || startPos === 1 || startPos === 2);
  }
  if (impalaAction === 'ver_izq') {
    return (startPos === 6 || startPos === 7 || startPos === 8);
  }
  if (impalaAction === 'ver_der') {
    return (startPos === 2 || startPos === 3 || startPos === 4);
  }
  // beber -> no ve
  return false;
}
