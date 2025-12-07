/* ============================================================
   ui.js — Render del Canvas, Controles y Heatmap Q-Learning
   ============================================================ */

/* ==== Canvas Setup ==== */
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

/* ==== Mostrar Q-Table ==== */
function renderQView() {
    const kb = document.getElementById('kbView');
    kb.textContent = JSON.stringify(QTABLE, null, 2);
}

/* ============================================================
   DIBUJO PRINCIPAL DEL GRID Y ENTIDADES
   ============================================================ */

function drawGrid(state) {

    // limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // cuadrícula
    ctx.strokeStyle = '#404040';
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            ctx.strokeRect(c * CELL + 10, r * CELL + 10, CELL, CELL);
        }
    }

    drawImpala(state);
    drawLion(state);

    // 🔥🔥 Heatmap Q-Learning
    drawHeatmapOverlay(state);
}

/* ============================================================
   DIBUJO DEL IMPALA
   ============================================================ */

function drawImpala(state) {
    const p = state.impala.pos;
    const x = p.x * CELL + 10 + CELL / 2;
    const y = p.y * CELL + 10 + CELL / 2;

    ctx.beginPath();
    ctx.fillStyle = state.impala.fleeing ? '#55ddff' : '#ffeeaa';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.arc(x, y, CELL * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

/* ============================================================
   DIBUJO DEL LEÓN
   ============================================================ */

function drawLion(state) {
    const p = state.lion.pos;
    const x = p.x * CELL + 10 + CELL / 2;
    const y = p.y * CELL + 10 + CELL / 2;

    ctx.beginPath();
    ctx.fillStyle = state.lion.hidden ? '#6c8c59' : '#cc5533';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.arc(x, y, CELL * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

/* ============================================================
   🔥 HEATMAP Q-LEARNING (PRO)
   - Normaliza valores entre −1 y +1
   - Dibuja gradientes radiales por POS_MAP
   ============================================================ */

let HEATMAP_ON = false;
let HEATMAP_ACTION = "__max__";

/* Color según valor normalizado [-1..1] */
function heatColor(norm) {
    const v = Math.max(-1, Math.min(1, norm));

    if (v >= 0) {
        const r = Math.floor(220 * v + 40);
        const g = Math.floor(150 * v + 60);
        const b = Math.floor(20);
        const a = 0.6 * v;
        return `rgba(${r},${g},${b},${a})`;
    } else {
        const t = -v;
        const r = 20;
        const g = Math.floor(120 + 80 * t);
        const b = Math.floor(180 + 60 * t);
        const a = 0.5 * t;
        return `rgba(${r},${g},${b},${a})`;
    }
}

/* Promedio de valores Q -> por posición */
function computeHeatPerPos(actionName = "__max__") {
    const accum = {};
    for (const p in POS_MAP) accum[p] = { sum: 0, count: 0 };

    for (const key in QTABLE) {
        const [pos] = key.split('|');
        if (!(pos in accum)) continue;

        const entry = QTABLE[key];
        let val;

        if (actionName === "__max__") {
            val = Math.max(...Object.values(entry));
        } else {
            val = entry[actionName] ?? 0;
        }

        accum[pos].sum += val;
        accum[pos].count += 1;
    }

    const result = {};
    let min = Infinity, max = -Infinity;

    for (const pos in accum) {
        const a = accum[pos];
        const avg = a.count ? a.sum / a.count : 0;
        result[pos] = avg;
        min = Math.min(min, avg);
        max = Math.max(max, avg);
    }

    const absMax = Math.max(Math.abs(min), Math.abs(max)) || 1;

    for (const pos in result) {
        result[pos] = result[pos] / absMax;
    }

    return result;
}

/* Dibuja heatmap */
function drawHeatmapOverlay(state) {
    if (!HEATMAP_ON) return;

    const heat = computeHeatPerPos(HEATMAP_ACTION);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const posNum in POS_MAP) {
        const p = POS_MAP[posNum];
        const cx = p.x * CELL + 10 + CELL / 2;
        const cy = p.y * CELL + 10 + CELL / 2;

        const val = heat[posNum];
        if (Math.abs(val) < 0.05) continue;

        const r = CELL * (1.0 + Math.abs(val) * 1.5);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const c = heatColor(val);

        grad.addColorStop(0, c);
        grad.addColorStop(0.5, c.replace(/[\d\.]+\)$/,"0.25)"));
        grad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/* ============================================================
   CONTROLES: HEATMAP Y Q-TABLE
   ============================================================ */

(function wireHeatmapControls() {
    const btn = document.getElementById('btnToggleHeatmap');
    const sel = document.getElementById('heatmapAction');

    if (!btn || !sel) return;

    btn.addEventListener('click', () => {
        HEATMAP_ON = !HEATMAP_ON;
        btn.textContent = HEATMAP_ON ? "Ocultar Heatmap" : "Mostrar Heatmap";
        drawGrid(state);
    });

    sel.addEventListener('change', (e) => {
        HEATMAP_ACTION = e.target.value;
        drawGrid(state);
    });
})();

/* ============================================================
   LOG (ya existía en tu versión original)
   ============================================================ */

function pushLog(msg) {
    const log = document.getElementById('log');
    const d = document.createElement('div');
    d.textContent = msg;
    log.prepend(d);
}

/* ============================================================
   Actualización de stats en UI
   ============================================================ */

function updateStatsUI(state) {
    document.getElementById('turn').textContent = state.turn;
    document.getElementById('status').textContent = state.status;
    document.getElementById('lastImpala').textContent = state.lastImpala || '--';
    document.getElementById('lastLion').textContent = state.lastLion || '--';
}

/* ============================================================
   EXPLICAR DECISIÓN DEL LEÓN (opcional, mantenido)
   ============================================================ */
function explainLastDecision(obs, action) {
    alert(
        "Estado observado:\n" +
        JSON.stringify(obs, null, 2) +
        "\n\nAcción elegida: " + action +
        "\n\nValores Q:\n" +
        JSON.stringify(QTABLE[qKeyFromObs(obs)], null, 2)
    );
}
