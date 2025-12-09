/* ================================
   main.js – Simulador Q-Learning
   con terminación correcta
   ================================ */

/* CONFIGURACIÓN */
const MAX_STEPS_PER_EPISODE = 500;

/* ESTADO GLOBAL */
let state = {};
let TRAIN_ABORT = false;
let training = false;
let HUNT_OVER = false;   // <— NUEVO: controla fin de cacería

/* ================================
   INICIALIZAR ESTADO
   ================================ */
function initState(startPosOption) {
    let posNum;

    if (startPosOption === 'rand') {
        const opts = Object.keys(POS_MAP);
        posNum = Number(opts[Math.floor(Math.random() * opts.length)]);
    } else {
        posNum = Number(startPosOption);
    }

    state = {
        lion: { pos: { ...POS_MAP[posNum] }, hidden: false, attacking: false, attackLocked: false },
        impala: { pos: { ...IMPALA_START }, fleeing: false, fleeDir: null, fleeVel: 1, fleeSteps: 0 },
        time: 1,
        lastImpala: null,
        lastLion: null,
        running: false,
        fastMode: false
    };

    HUNT_OVER = false;   // <— reinicia finalización
    resetTrails();       // <— reinicia trazos

    /* UI */
    document.getElementById("turn").textContent = state.time;
    document.getElementById("status").textContent = "Listo";
    document.getElementById("lastImpala").textContent = "-";
    document.getElementById("lastLion").textContent = "-";
    document.getElementById("log").innerHTML = "";

    drawGrid(state);
    renderQView();
}


/* ================================
   DETECCIÓN DE FIN DE CACERÍA
   ================================ */

function endHunt(reason) {
    HUNT_OVER = true;
    document.getElementById("status").textContent = reason;
    pushLog("🏁 Cacería finalizada: " + reason);
    renderQView();
    drawGrid(state);
}


/* ================================
   LÓGICA DE UN PASO (T)
   ================================ */
function stepOnce() {
    if (state.running) return false;
    if (HUNT_OVER) {
        pushLog("⚠️ La cacería ya terminó. Usa RESET para iniciar otra.");
        return false;
    }

    /* ————————————————
       1) Acción del Impala
       ———————————————— */
    const impAction = getImpalaAction();
    const impalaWasFleeing = state.impala.fleeing;

    impalaStep(state, impAction);
    state.lastImpala = impAction;

    /* ————————————————
       Detectar si llega al borde → fracaso
       ———————————————— */
    if (state.impala.pos.x <= 0 || state.impala.pos.x >= GRID - 1) {
        endHunt("Fracaso (el impala escapó del tablero)");
        return true;
    }

    /* ————————————————
       Observar estado actual
       ———————————————— */
    const lp = state.lion.pos;
    const d = manhattan(lp, state.impala.pos);

    const obs = {
        posNum: getPosNumFromCoords(lp),
        impalaAction: state.impala.fleeing ? "huir" : impAction,
        distBucket: distBucket(d),
        hidden: state.lion.hidden
    };

    /* ————————————————
       2) Elegir acción del León
       ———————————————— */
    const lionAction = chooseActionQ(obs);
    state.lastLion = lionAction;

    /* ————————————————
       3) Aplicar acción del león
       ———————————————— */
    applyLionAction(lionAction, d);

    /* ————————————————
       4) Impala huye si detecta peligro
       ———————————————— */
    const fleeTriggeredByLion = checkAndTriggerImpalaFlee(lionAction, impAction, d);

    /* ————————————————
       5) Éxito total (león captura)
       ———————————————— */
    const reached = (
        state.lion.pos.x === state.impala.pos.x &&
        state.lion.pos.y === state.impala.pos.y
    );

    if (reached) {
        computeRewardAndUpdateQ(obs, lionAction, null, d, 0, true, "exito");
        endHunt("Éxito");
        return true;
    }

    /* ————————————————
       6) HUÍDA del impala → fracaso
       ———————————————— */
    if (state.impala.fleeing && !impalaWasFleeing) {
        if (fleeTriggeredByLion) {
            computeRewardAndUpdateQ(obs, lionAction, null, d, d, true, "fracaso");
            endHunt("Fracaso (impala huyó por culpa del león)");
            return true;
        } else {
            endHunt("Huida espontánea (no penalizada)");
            return true;
        }
    }

    /* ————————————————
       7) Reward shaping normal
       ———————————————— */
    const lp2 = state.lion.pos;
    const d2 = manhattan(lp2, state.impala.pos);

    const nextObs = {
        posNum: getPosNumFromCoords(lp2),
        impalaAction: state.impala.fleeing ? "huir" : impAction,
        distBucket: distBucket(d2),
        hidden: state.lion.hidden
    };

    computeRewardAndUpdateQ(obs, lionAction, nextObs, d, d2, false, null);

    /* ————————————————
       8) Tiempo y dibujo
       ———————————————— */
    state.time++;
    if (!state.fastMode) {
        document.getElementById("turn").textContent = state.time;
        drawGrid(state);
        renderQView();
    }

    return false;
}


/* ================================
   ENTRENAMIENTO MASIVO
   ================================ */
async function trainN(n, starts = [1,2,3,4,6,7,8]) {
    TRAIN_ABORT = false;
    state.fastMode = true;

    pushLog(`Entrenando ${n} episodios…`);

    for (let i = 0; i < n; i++) {
        if (TRAIN_ABORT) break;

        initState(starts[Math.floor(Math.random() * starts.length)]);

        let iter = 0;
        while (iter < MAX_STEPS_PER_EPISODE && !HUNT_OVER) {
            iter++;
            stepOnce();
        }

        if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));
    }

    state.fastMode = false;
    saveQToLocal();
    renderQView();
    drawGrid(state);

    pushLog("Entrenamiento finalizado.");
}


/* ================================
   EVENTOS UI
   ================================ */

document.getElementById("btnReset").addEventListener("click", () => {
    HUNT_OVER = false;
    initState(document.getElementById("startPos").value);
    pushLog("🔄 Estado reiniciado.");
});

document.getElementById("btnStep").addEventListener("click", () => {
    if (HUNT_OVER) {
        pushLog("⚠️ La cacería ya terminó. Usa RESET para comenzar otra.");
        return;
    }
    stepOnce();
});

document.getElementById("btnTrain").addEventListener("click", () => {
    trainN(1000, [1,2,3,4,6,7,8]);
});

document.getElementById("btnStopTrain").addEventListener("click", () => {
    TRAIN_ABORT = true;
    pushLog("Detención solicitada.");
});

document.getElementById("btnShowKB").addEventListener("click", () => {
    renderQView();
    pushLog("Mostrando Q-table.");
});

document.getElementById("btnSaveKB").addEventListener("click", () => {
    downloadQ();
    pushLog("Q-table guardada.");
});

document.getElementById("btnLoadKB").addEventListener("click", () => {
    document.getElementById("kbFile").click();
});

document.getElementById("kbFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        try {
            const j = JSON.parse(r.result);
            loadQFromFile(j);
            renderQView();
            pushLog("Q-table cargada.");
        } catch (err) {
            pushLog("Error cargando Q-table: " + err.message);
        }
    };
    r.readAsText(f);
});

/* ================================
   INICIO
   ================================ */
loadQFromLocal();
initLogElement();
initState("rand");
renderQView();
drawGrid(state);

