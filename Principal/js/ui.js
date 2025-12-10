/* ============================================================
   ui.js — Render PRO con trayectoria y colores por acción
   ============================================================ */

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

// ============================================================
// Colores PRO por acción
// ============================================================

const LION_COLORS = {
    avanzar: "#ffcc66",
    esconder: "#7b9d6f",
    atacar: "#c04a2a",
    default: "#ffcc66"
};

const IMPALA_COLORS = {
    ver_arriba: "#66c8ff",
    ver_izquierda: "#66c8ff",
    ver_derecha: "#66c8ff",
    beber: "#999999",
    huir: "#ff5577",
    default: "#66c8ff"
};

// para trayectorias
const PATH_COLORS = {
    lion: "rgba(255,200,100,0.45)",
    impala: "rgba(120,210,255,0.45)"
};

// ============================================================
// pushLog seguro (no falla si no existe #log)
// ============================================================
function pushLog(msg) {
    const log = document.getElementById("log");
    if (!log) return; // evitar errores

    const line = document.createElement("div");
    line.textContent = msg;
    log.prepend(line);
}

// ============================================================
// Dibujo principal
// ============================================================
function draw(state) {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawPaths(state);
    drawImpala(state);
    drawLion(state);
}

// ============================================================
// Dibujar cuadrícula 19×19
// ============================================================
function drawGrid() {
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#444";
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            ctx.strokeRect(c * CELL + 10, r * CELL + 10, CELL, CELL);
        }
    }
}

// ============================================================
// Dibuja trayectorias del impala y león
// ============================================================
function drawPaths(state) {
    ctx.lineWidth = 2;

    // trayectoria impala
    ctx.strokeStyle = PATH_COLORS.impala;
    ctx.beginPath();
    state.impala.path.forEach((p, i) => {
        const x = p.x * CELL + 10 + CELL / 2;
        const y = p.y * CELL + 10 + CELL / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // trayectoria león
    ctx.strokeStyle = PATH_COLORS.lion;
    ctx.beginPath();
    state.lion.path.forEach((p, i) => {
        const x = p.x * CELL + 10 + CELL / 2;
        const y = p.y * CELL + 10 + CELL / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// ============================================================
// Dibujar Impala
// ============================================================
function drawImpala(state) {
    const imp = state.impala.pos;

    const x = imp.x * CELL + 10 + CELL / 2;
    const y = imp.y * CELL + 10 + CELL / 2;

    const action = state.impala.fleeing ? "huir" : (state.lastImpalaAction || "default");
    const color = IMPALA_COLORS[action] || IMPALA_COLORS.default;

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, CELL * 0.30, 0, Math.PI * 2);
    ctx.fill();

    // Etiqueta
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.fillText("Imp", x - 10, y - 12);
}

// ============================================================
// Dibujar León
// ============================================================
function drawLion(state) {
    const leon = state.lion.pos;

    const x = leon.x * CELL + 10 + CELL / 2;
    const y = leon.y * CELL + 10 + CELL / 2;

    let action = state.lastLionAction || "default";
    if (state.lion.hidden) action = "esconder";

    const color = LION_COLORS[action] || LION_COLORS.default;

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, CELL * 0.30, 0, Math.PI * 2);
    ctx.fill();

    // Etiqueta
    ctx.fillStyle = "#000";
    ctx.font = "12px monospace";
    ctx.fillText("Leon", x - 15, y - 12);
}

