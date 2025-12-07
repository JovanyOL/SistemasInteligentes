/* ============================================================
   impala.js — comportamiento del impala (OPTIMIZADO)
   ============================================================ */

// Acciones válidas del impala
const IMPALA_ACTIONS = ['ver_izq','ver_der','ver_frente','beber','huir'];

/* ============================================================
   MOVIMIENTO DEL IMPALA — “modo normal” y “modo huida”
   ============================================================ */
function impalaStep(state, action) {

  const imp = state.impala;

  /* ---- 1) Si ya está huyendo, ignorar acción externa ---- */
  if (imp.fleeing) {
    const v = imp.fleeVel;

    // dirección E/W definida por fleeDir
    if (imp.fleeDir === 'E') imp.pos.x += v;
    else                     imp.pos.x -= v;

    // aumentar velocidad hasta un límite (seguridad)
    imp.fleeVel = Math.min(imp.fleeVel + 1, 3);

    clampImpalaToGrid(imp);
    return;
  }

  /* ---- 2) Si acción explícita de huida ---- */
  if (action === 'huir') {
    startImpalaFlee(state);
    clampImpalaToGrid(imp);
    return;
  }

  /* ---- 3) Acciones normales ---- */
  // ver_izq, ver_der, ver_frente, beber
  // → no mueve, solo afectan impalaSees()
  return;
}


/* ============================================================
   INICIAR HUIDA
   ============================================================ */
function startImpalaFlee(state) {
  const imp = state.impala;
  const lion = state.lion.pos;

  imp.fleeing = true;

  // huir hacia donde esté "más lejos" del león
  imp.fleeDir = (imp.pos.x <= lion.x) ? 'E' : 'W';
  imp.fleeVel = 1;

  // primer movimiento
  if (imp.fleeDir === 'E') imp.pos.x += 1;
  else                     imp.pos.x -= 1;
}


/* ============================================================
   LIMITAR AL IMPALA AL GRID
   ============================================================ */
function clampImpalaToGrid(imp) {
  imp.pos.x = Math.max(0, Math.min(GRID - 1, imp.pos.x));
  imp.pos.y = Math.max(0, Math.min(GRID - 1, imp.pos.y));
}


/* ============================================================
   VISIÓN DEL IMPALA — CONO DE 90° delante
   ============================================================ */
function impalaSees(state, lionPos, impalaAction) {

  // Si el león está escondido → no lo puede ver
  if (state.lion.hidden) return false;

  const impPos = state.impala.pos;

  // Ángulo absoluto desde impala hacia el león (0° = +x)
  const ang = angleDeg(impPos, lionPos);

  /* Queremos orientación relativa:
       0° = frente (norte en la cuadrícula)
    Convertimos:
       angleDeg = 0° (+x) → 90° relativo
       angleDeg = 90° (+y) → 0° relativo
       etc.
  */
  let rel = (ang - 90 + 360) % 360;

  switch (impalaAction) {

    case 'ver_frente':
      // ±45° en frente: [315, 360] U [0, 45]
      return (rel >= 315 || rel <= 45);

    case 'ver_izq':
      // izquierda: 45°–135°
      return (rel > 45 && rel < 135);

    case 'ver_der':
      // derecha: 225°–315°
      return (rel > 225 && rel < 315);

    default:
      // beber u otras acciones → no ve
      return false;
  }
}
