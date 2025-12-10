/* ============================================================
   main.js — Control principal del simulador
   ============================================================ */

let state = null;
let running = false;
let training = false;
let lastLionAction = null;
let lastImpalaAction = null;

// ============================================================
// Funciones auxiliares
// ============================================================

// Compatibilidad: generar acción del impala
function getImpalaAction() {
    if (state.impala.fleeing) return "huir";

    const modeEl = document.getElementById("impalaMode");
    const mode = modeEl ? modeEl.value : "aleatorio";

    if (mode === "aleatorio") {
        return ["ver_arriba", "ver_izquierda", "ver_derecha"][Math.floor(Math.random() * 3)];
    }

    // Modo programado
    const seqInput = document.getElementById("progSeq");
    if (!seqInput) return "ver_arriba";

    const seq = seqInput.value
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (seq.length === 0) return "ver_arriba";

    return seq[(state.time - 1) % seq.length];
}

// Determinar si la simulación debe finalizar
function checkEndCondition() {
    const lion = state.lion.pos;
    const imp = state.impala.pos;

    const dx = lion.x - imp.x;
    const dy = lion.y - imp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // ÉXITO: León alcanza
    if (dist === 0) {
        state.finished = true;
        state.result = "ÉXITO: El león atrapó al impala";
        pushLog("🦁✔ ÉXITO: El león atrapó al impala");
        return true;
    }

    // FRACASO: Impala huye fuera del tablero
    if (imp.x <= 0 || imp.x >= GRID - 1) {
        state.finished = true;
        state.result = "❌ FRACASO: El impala escapó del tablero";
        pushLog("❌ FRACASO: El impala escapó del tablero");
        return true;
    }

    return false;
}

// ============================================================
// Lógica principal de un paso T
// ============================================================
function stepOnce() {
    if (!state || state.finished) return;

    state.time++;

    // 1. Acciones del impala
    lastImpalaAction = getImpalaAction();
    impalaStep(state, lastImpalaAction);

    // Registrar trayectoria
    state.impala.path.push({ x: state.impala.pos.x, y: state.impala.pos.y });

    // 2. Acción del león (Q-learning decide)
    const lionAction = chooseLionAction(state);
    lastLionAction = lionAction;

    applyLionAction(state, lionAction);

    // Registrar trayectoria
    state.lion.path.push({ x: state.lion.pos.x, y: state.lion.pos.y });

    // 3. Evaluar fin del episodio
    if (checkEndCondition()) {
        updateUI();
        disableStepButton();
        return;
    }

    updateUI();
}

// ============================================================
// Botones y UI
// ============================================================

function disableStepButton() {
    const btn = document.getElementById("btnStep");
    if (btn) btn.disabled = true;
}

function enableStepButton() {
    const btn = document.getElementById("btnStep");
    if (btn) btn.disabled = false;
}

// Reset
function reset() {
    state = createInitialState();
    state.time = 0;
    state.finished = false;
    state.result = null;

    enableStepButton();

    updateUI();
}

// Ejecutar siguiente T (manual)
function initButtons() {
    const stepBtn = document.getElementById("btnStep");
    if (stepBtn) {
        stepBtn.addEventListener("click", () => {
            if (!state || state.finished) return disableStepButton();
            stepOnce();
        });
    }

    const resetBtn = document.getElementById("btnReset");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            reset();
        });
    }
}

// ============================================================
// Actualizar la interfaz
// ============================================================
function updateUI() {
    const turnEl = document.getElementById("turn");
    const statusEl = document.getElementById("status");
    const lastImpEl = document.getElementById("lastImpala");
    const lastLionEl = document.getElementById("lastLion");

    if (turnEl) turnEl.textContent = state.time;
    if (lastImpEl) lastImpEl.textContent = lastImpalaAction || "--";
    if (lastLionEl) lastLionEl.textContent = lastLionAction || "--";

    if (state.finished) {
        if (statusEl) statusEl.textContent = state.result;
        disableStepButton();
    } else {
        if (statusEl) statusEl.textContent = "En curso...";
    }

    draw(state);
}

// ============================================================
// Inicialización
// ============================================================
window.addEventListener("load", () => {
    reset();
    initButtons();
    loadQFromLocal();
    updateUI();
});
