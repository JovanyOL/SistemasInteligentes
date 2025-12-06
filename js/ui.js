/* ui.js — render del canvas y UI mejorada */
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

function renderQView(){
  document.getElementById('kbView').textContent =
    JSON.stringify(QTABLE, null, 2);
}

/* ===========================================================
   RENDER PRINCIPAL
   =========================================================== */
function drawGrid(state){
  drawBackground();
  drawGridLines();
  drawVisionCone(state);
  drawImpala(state);
  drawLion(state);
  drawDebugInfo(state);
}

/* ===========================================================
   ELEMENTOS
   =========================================================== */
function drawBackground(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function drawGridLines(){
  ctx.strokeStyle='rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 1;

  for(let r=0;r<GRID;r++){
    for(let c=0;c<GRID;c++){
      ctx.strokeRect(c*CELL+10, r*CELL+10, CELL, CELL);
    }
  }
}

function drawImpala(state){
  const imp = state.impala.pos;
  const x = imp.x * CELL + 10 + CELL/2;
  const y = imp.y * CELL + 10 + CELL/2;

  ctx.font = `${CELL*0.7}px serif`;
  ctx.fillText("🦓", x - CELL*0.35, y + CELL*0.25);
}

function drawLion(state){
  const lion = state.lion.pos;
  const x = lion.x * CELL + 10 + CELL/2;
  const y = lion.y * CELL + 10 + CELL/2;

  ctx.font = `${CELL*0.7}px serif`;
  ctx.fillText(state.lion.hidden ? "🌿" : "🦁", x - CELL*0.35, y + CELL*0.25);
}

/* ===========================================================
   VISIÓN DEL IMPALA — CONO VISUAL
   =========================================================== */
function drawVisionCone(state){
  const imp = state.impala.pos;
  const centerX = imp.x * CELL + 10 + CELL/2;
  const centerY = imp.y * CELL + 10 + CELL/2;
  const dir = state.impala.action;

  const cones = {
    'ver_frente': { start:-45, end:45 },
    'ver_izq':    { start:45,  end:135 },
    'ver_der':    { start:225, end:315 }
  };

  if(!cones[dir]) return;

  const cone = cones[dir];

  ctx.fillStyle = 'rgba(255, 225, 150, 0.25)';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(
    centerX, centerY,
    CELL * 2.2,
    (cone.start - 90) * Math.PI/180,
    (cone.end   - 90) * Math.PI/180
  );
  ctx.closePath();
  ctx.fill();
}

/* ===========================================================
   DEBUG INFO
   =========================================================== */
function drawDebugInfo(state){
  ctx.fillStyle = '#1e293b';
  ctx.font = '11px monospace';

  ctx.fillText(`EPS: ${EPS.toFixed(3)}`, 10, canvas.height - 30);
  ctx.fillText(`Dist: ${state.dist.toFixed(2)}`, 10, canvas.height - 15);
}
