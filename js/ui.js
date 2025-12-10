/* ui.js — render canvas, trayectorias y vista de Q-table */

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

function renderQView() {
  const el = document.getElementById('kbView');
  if (!el) return;
  el.textContent = JSON.stringify(QTABLE, null, 2);
}

/* drawGrid draws cells, trajectories, impala and lion */
function drawGrid(state) {
  if (!canvas || !ctx) return;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background
  ctx.fillStyle = '#222';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // grid
  ctx.strokeStyle = '#444';
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      ctx.strokeRect(c*CELL+10, r*CELL+10, CELL, CELL);
    }
  }

  // draw trajectories (if exist)
  if (state.pathImpala && state.pathImpala.length) {
    ctx.strokeStyle = 'rgba(0,200,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < state.pathImpala.length; i++) {
      const p = state.pathImpala[i];
      const x = p.x*CELL + 10 + CELL/2;
      const y = p.y*CELL + 10 + CELL/2;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  if (state.pathLion && state.pathLion.length) {
    ctx.strokeStyle = 'rgba(255,180,0,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < state.pathLion.length; i++) {
      const p = state.pathLion[i];
      const x = p.x*CELL + 10 + CELL/2;
      const y = p.y*CELL + 10 + CELL/2;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  // impala
  const imp = state.impala.pos;
  const ix = imp.x*CELL + 10 + CELL/2;
  const iy = imp.y*CELL + 10 + CELL/2;
  ctx.beginPath();
  ctx.fillStyle = state.impala.fleeing ? '#55ddff' : '#ffeeaa';
  ctx.arc(ix, iy, CELL*0.28, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();

  // lion
  const lion = state.lion.pos;
  const lx = lion.x*CELL + 10 + CELL/2;
  const ly = lion.y*CELL + 10 + CELL/2;
  ctx.beginPath();
  ctx.fillStyle = state.lion.hidden ? '#6c8c59' : '#cc5533';
  ctx.arc(lx, ly, CELL*0.28, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();

  // optionally mark start points
  // draw impala start
  const s = IMPALA_START;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(s.x*CELL+10, s.y*CELL+10, CELL, CELL);
}
