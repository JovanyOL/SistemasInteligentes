/* env.js — constantes globales del entorno */

const GRID = 19;        // 19x19
const CELL = 26;        // tamaño visual por celda (ajusta si quieres)
const POS_MAP = {
  // posNum : { x: 0-based, y: 0-based }
  1: { x: 0,  y: 9  }, // (1,10) -> (0,9)
  2: { x: 0,  y: 18 }, // (1,19) -> (0,18)
  3: { x: 9,  y: 18 }, // (10,19) -> (9,18)
  4: { x: 18, y: 18 }, // (19,19) -> (18,18)
  5: { x: 18, y: 9  }, // (19,10) -> (18,9)
  6: { x: 18, y: 0  }, // (19,1) -> (18,0)
  7: { x: 9,  y: 0  }, // (10,1) -> (9,0)
  8: { x: 0,  y: 0  }  // (1,1) -> (0,0)
};

const IMPALA_START = { x: 9, y: 9 }; // (10,10) -> (9,9)

/* Acciones (asegurar coincidencia con qlearning.js) */
const LION_ACTIONS = ['avanzar', 'esconder', 'atacar', 'esperar'];
const IMPALA_ACTIONS = ['ver_frente', 'ver_izq', 'ver_der', 'beber', 'huir']; // huir en impalaStep inicia huida E/W
