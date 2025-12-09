/* ui.js — render del canvas + trayectorias */

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

function renderQView() {
    document.getElementById("kbView").textContent =
        JSON.stringify(QTABLE, null, 2);
}

/* ================================================================
   TRAJECTORY BUFFERS
=================================================================*/

let lionTrail = [];
let impalaTrail = [];

/* Llamado por initState() */
function resetTrails() {
    lionTrail = [];
    impalaTrail = [];
}

/* ================================================================
   DIBUJAR LA GRILLA
=================================================================*/
function drawGrid(state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = "#333";
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
        }
    }

    /* ============================================================
       TRAIL RECORDING
    ============================================================ */

    // registrar punto del león
    lionTrail.push({
        x: state.lion.pos.x * CELL + CELL / 2,
        y: state.lion.pos.y * CELL + CELL / 2
    });

    // registrar punto del impala
    impalaTrail.push({
        x: state.impala.pos.x * CELL + CELL / 2,
        y: state.impala.pos.y * CELL + CELL / 2
    });

    drawTrails();

    /* ============================================================
       DIBUJAR AGENTES
    ============================================================ */

    // León
    drawAgent(
        state.lion.pos.x,
        state.lion.pos.y,
        state.lion.hidden ? "#777" : "#ff4444"
    );

    // Impala
    drawAgent(state.impala.pos.x, state.impala.pos.y, "#00ffff");
}

/* ================================================================
   DIBUJA LAS TRAYECTORIAS
=================================================================*/
function drawTrails() {
    // Impala trail (cyan)
    if (impalaTrail.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#00ffff";
        ctx.moveTo(impalaTrail[0].x, impalaTrail[0].y);
        for (let i = 1; i < impalaTrail.length; i++) {
            ctx.lineTo(impalaTrail[i].x, impalaTrail[i].y);
        }
        ctx.stroke();
    }

    // León trail (roja)
    if (lionTrail.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ff4444";
        ctx.moveTo(lionTrail[0].x, lionTrail[0].y);
        for (let i = 1; i < lionTrail.length; i++) {
            ctx.lineTo(lionTrail[i].x, lionTrail[i].y);
        }
        ctx.stroke();
    }
}

/* ================================================================
   DIBUJA UN AGENTE EN EL TABLERO
=================================================================*/
function drawAgent(x, y, color) {
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

/* ================================================================
   LOG SYSTEM
=================================================================*/

let LOG = null;

function initLogElement() {
    LOG = document.getElementById("log");
}

function pushLog(msg) {
    const div = document.createElement("div");
    div.textContent = msg;
    LOG.prepend(div);
}
