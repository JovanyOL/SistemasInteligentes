/* ======================================================
   main.js — versión A + descripción PRO del movimiento
   ====================================================== */

let state = null;
let HUNT_OVER = false;

// ======================================================
// Crear estado inicial
// ======================================================
function createInitialState(startPosOption) {

    const posList = Object.keys(POS_MAP);
    const posNum = (startPosOption === "rand")
        ? Number(posList[Math.floor(Math.random() * posList.length)])
        : Number(startPosOption);

    return {
        lion: {
            pos: { ...POS_MAP[posNum] },
            startPosNum: posNum,
            hidden: false,
            path: [{ ...POS_MAP[posNum] }]
        },

        impala: {
            pos: { ...IMPALA_START },
            fleeing: false,
            fleeDir: null,
            fleeVel: 0,
            path: [{ ...IMPALA_START }]
        },

        lastImpalaAction: "-",
        lastLionAction: "-",
        time: 1
    };
}

// ======================================================
// RESET
// ======================================================
function reset() {
    HUNT_OVER = false;
    const startPos = document.getElementById("startPos").value;
    state = createInitialState(startPos);

    document.getElementById("turn").textContent = "1";
    document.getElementById("status").textContent = "Listo";
    document.getElementById("lastImpala").textContent = "-";
    document.getElementById("lastLion").textContent = "-";

    pushLog("== Nuevo intento de cacería ==");

    draw(state);
}

// ======================================================
// Descripción PRO del movimiento del león
// ======================================================
function describeLionAction(action, state) {

    if (state.lion.hidden) return "Esconderse (círculo verde)";

    switch (action) {
        case "avanzar":
            return "Avanzar hacia el impala (círculo amarillo)";
        case "esconder":
            return "Esconderse (círculo verde)";
        case "atacar":
            return "Ataque — 2 pasos por T (círculo rojo)";
        default:
            return action;
    }
}

// ======================================================
// Un paso T
// ======================================================
function stepOnce() {

    if (HUNT_OVER) {
        pushLog("La cacería ya terminó.");
        return;
    }

    // --- Acción del Impala ---
    const impAction = getImpalaAction(state);
    impalaStep(state, impAction);

    state.lastImpalaAction = impAction;
    document.getElementById("lastImpala").textContent = impAction;

    // Guardar trayectoria
    state.impala.path.push({ ...state.impala.pos });

    // ¿Escapa por borde?
    if (state.impala.pos.x <= 0 || state.impala.pos.x >= GRID - 1) {
        pushLog("❌ Fracaso — El impala alcanzó el borde del tablero.");
        document.getElementById("status").textContent = "Fracaso";
        HUNT_OVER = true;
        draw(state);
        return;
    }

    // --- Acción del León ---
    const obs = {
        posNum: state.lion.startPosNum,
        impalaAction: state.impala.fleeing ? "huir" : impAction,
        distBucket: distBucket(
            Math.abs(state.lion.pos.x - state.impala.pos.x) +
            Math.abs(state.lion.pos.y - state.impala.pos.y)
        ),
        hidden: state.lion.hidden
    };

    const lionAct = chooseActionQ(obs);
    state.lastLionAction = lionAct;

    // Descripción PRO del movimiento
    const pretty = describeLionAction(lionAct, state);

    document.getElementById("lastLion").textContent = pretty;
    pushLog("León: " + pretty);

    // Ejecutar
    if (lionAct === "avanzar") {
        lionAdvanceTowardsImpala(state);
        state.lion.hidden = false;
    }
    else if (lionAct === "esconder") {
        state.lion.hidden = true;
    }
    else if (lionAct === "atacar") {
        lionAdvanceTowardsImpala(state);
        lionAdvanceTowardsImpala(state); // doble velocidad
        state.lion.hidden = false;
    }

    // Guardar trayectoria
    state.lion.path.push({ ...state.lion.pos });

    // Captura
    if (
        state.lion.pos.x === state.impala.pos.x &&
        state.lion.pos.y === state.impala.pos.y
    ) {
        pushLog("🎯 ÉXITO — El león atrapó al impala.");
        document.getElementById("status").textContent = "Éxito";
        HUNT_OVER = true;
        draw(state);
        return;
    }

    // Avanzar tiempo
    state.time++;
    document.getElementById("turn").textContent = state.time;

    draw(state);
}

// ======================================================
// Hooks botones
// ======================================================
document.getElementById("btnStep").addEventListener("click", stepOnce);
document.getElementById("btnReset").addEventListener("click", reset);

// ======================================================
// Inicio
// ======================================================
reset();
