
/* knowledge.js — funciones de generalización y utils (simple) */
function abstractQtable(){
  // Ejemplo simple: reemplaza ver_izq/ver_der -> ver_lateral
  const newQ = {};
  for(const key in QTABLE){
    const parts = key.split('|'); // pos|imp|dist|hidden
    let imp = parts[1];
    if(imp === 'ver_izq' || imp === 'ver_der') imp = 'ver_lateral';
    const newKey = `${parts[0]}|${imp}|${parts[2]}|${parts[3]}`;
    if(!newQ[newKey]) newQ[newKey] = {avanzar:0,esconder:0,atacar:0};
    for(const a in QTABLE[key]){
      newQ[newKey][a] = (newQ[newKey][a] || 0) + (QTABLE[key][a] || 0);
    }
  }
  QTABLE = newQ;
  saveQToLocal(); renderQView();
}
