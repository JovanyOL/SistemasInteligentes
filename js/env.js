/* env.js — reglas del mundo y utilidades */
const CELL = 52;               // tamaño del cuadro visual
const GRID = 19;
const CENTER = Math.floor(GRID/2);
const IMPALA_START = {x:CENTER,y:CENTER};
const POS_MAP = {
  1: {x:CENTER, y:CENTER-2},
  2: {x:CENTER+1, y:CENTER-1},
  3: {x:CENTER+2, y:CENTER},
  4: {x:CENTER+1, y:CENTER+1},
  5: {x:CENTER, y:CENTER+2},
  6: {x:CENTER-1, y:CENTER+1},
  7: {x:CENTER-2, y:CENTER},
  8: {x:CENTER-1, y:CENTER-1}
};

function euclid(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
// reemplazar la función distBucket existente por esta
function distBucket(d){
  if(d <= 0) return 0;
  if(d < 1.5) return 1;
  if(d < 3) return 2;
  if(d < 5) return 3;
  return 4; // muy lejos
}


// angulo relativo de impala mirando norte
function angleDeg(from, to){
  const dx = to.x - from.x; const dy = to.y - from.y;
  return Math.atan2(dy, dx) * 180/Math.PI; // degrees from +x
}

function withinGrid(pos){ return pos.x>=0 && pos.x<GRID && pos.y>=0 && pos.y<GRID }


// --- Lógica del Log (Movida aquí para disponibilidad temprana) ---
let LOG; 

/**
 * Inicializa la referencia al elemento LOG del DOM.
 * Debe llamarse desde main.js al inicio.
 */
function initLogElement(){
    LOG = document.getElementById('log');
}

/**
 * Agrega un mensaje al registro (Log).
 */
function pushLog(txt){ 
    if (!LOG) return; // Evita errores si no se ha inicializado
    
    const d = document.createElement('div'); 
    d.textContent = txt; 
    LOG.prepend(d); 
    if(LOG.childElementCount>300) LOG.removeChild(LOG.lastChild); 

}
