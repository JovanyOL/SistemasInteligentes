/* ============================================================
   knowledge.js — abstracción / normalización de claves Q-learning
   ============================================================ */

/*
  OBJETIVO:
  - Reducir ruido en la Q-table.
  - Unificar estados equivalentes para que el agente generalice.
  - Agrupar claves con diferencias menores (ej.: ver_izq y ver_der).
*/

/* ACCIONES DEL LEÓN (por si se amplían en el futuro) */
const ALL_LION_ACTIONS = ['avanzar', 'esconder', 'atacar', 'esperar'];

/* ============================================================
   NORMALIZADOR DE CLAVES
   - Corrige variaciones del input
   - Permite agregar nuevos patrones de generalización
   ============================================================ */
function normalizeQKey(key) {
  const parts = key.split('|'); // pos, impAction, dist, hidden

  let pos     = parts[0];
  let impAct  = parts[1];
  let dist    = parts[2];
  let hidden  = parts[3];

  /* --- GENERALIZACIÓN 1: ver_izq / ver_der → ver_lateral --- */
  if (impAct === 'ver_izq' || impAct === 'ver_der') {
    impAct = 'ver_lateral';
  }

  /* --- GENERALIZACIÓN 2: distancia bucket demasiado fina --- */
  // agrupa distancias 0,1,2 → "cerca"
  //           3–4       → "medio"
  //           >=5       → "lejos"
  const d = Number(dist);
  if (!isNaN(d)) {
    if (d <= 2) dist = 'cerca';
    else if (d <= 4) dist = 'medio';
    else dist = 'lejos';
  }

  return `${pos}|${impAct}|${dist}|${hidden}`;
}


/* ============================================================
   ABSTRAER QTABLE (generalización robusta)
   ============================================================ */
function abstractQtable() {
  const newQ = {};

  for (const key in QTABLE) {
    const newKey = normalizeQKey(key);

    /* Crear entrada si no existe */
    if (!newQ[newKey]) {
      newQ[newKey] = {};
      ALL_LION_ACTIONS.forEach(a => newQ[newKey][a] = 0);
      newQ[newKey]._count = 0;  // para promediar
    }

    /* Acumular valores */
    for (const a of ALL_LION_ACTIONS) {
      const v = QTABLE[key][a];
      if (!isNaN(v)) newQ[newKey][a] += v;
    }

    // Llevar conteo de cuántas claves aportaron
    newQ[newKey]._count++;
  }

  /* --- PROMEDIO --- */
  for (const key in newQ) {
    const c = newQ[key]._count;
    if (c > 0) {
      for (const a of ALL_LION_ACTIONS) {
        newQ[key][a] /= c;
      }
    }
    delete newQ[key]._count;
  }

  /* Reemplazar QTABLE */
  QTABLE = newQ;
  saveQToLocal();
  renderQView();
  pushLog("Generalización aplicada a la Q-table.");
}


/* ============================================================
   OPCIONAL — función para imprimir estadísticas de la Q-table
   ============================================================ */
function summarizeQtable() {
  let total = 0;
  let actions = ALL_LION_ACTIONS.reduce((acc, a) => (acc[a] = 0, acc), {});

  for (const key in QTABLE) {
    total++;
    for (const a of ALL_LION_ACTIONS) {
      const v = QTABLE[key][a];
      if (!isNaN(v) && v !== 0) actions[a]++;
    }
  }

  let txt =
    `Estados en la Q-table: ${total}\n` +
    ALL_LION_ACTIONS.map(a => `  ${a}: presente en ${actions[a]} claves`).join("\n");

  pushLog(txt);
}
