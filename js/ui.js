/* ui.js — render del canvas y utilidades UI (LIMPIO) */

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

function renderQView() {
    document.getElementById('kbView').textContent =
        JSON.stringify(QTABLE, null, 2);
}

/* DIBUJAR GRID */
function drawGrid(state) {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    for (let r=0; r<GRID; r++) {
        for (let c=0; c<GRID; c++) {
            ctx.strokeStyle = '#555';
            ctx.strokeRect(c*CELL+10, r*CELL+10, CELL, CELL);
        }
    }

    /* Impala */
    const imp = state.impala.pos;
    const ix = imp.x * CELL + 10 + CELL/2;
    const iy = imp.y * CELL + 10 + CELL/2;

    ctx.beginPath();
    ctx.fillStyle = '#ffcc66';
    ctx.arc(ix, iy, CELL*0.28, 0, Math.PI*2);
    ctx.fill();

    /* León */
    const lion = state.lion.pos;
    const lx = lion.x * CELL + 10 + CELL/2;
    const ly = lion.y * CELL + 10 + CELL/2;

    ctx.beginPath();
    ctx.fillStyle = state.lion.hidden ? '#7b9d6f' : '#c04a2a';
    ctx.arc(lx, ly, CELL*0.28, 0, Math.PI*2);
    ctx.fill();
}
