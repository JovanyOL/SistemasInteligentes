/* main.js — conecta todo y contiene loop principal */
let state = {};

// =================== CONFIGURACIÓN PRINCIPAL ===================
const GRID = 19;
const CELL = 25;

let EPSILON = 0.2;
const MIN_EPSILON = 0.01;
const EPSILON_DECAY = 0.9995;

// Recompensas
const R_EXITO = +100;
const R_FRACASO = -100;
const R_PASO = -1;

// ================================================================
let TRAIN_ABORT = false;

/* ================================================================
   INICIALIZACIÓN DEL ESTADO
=================================================================*/
function initState(startPosOption) {
    let posNum;

    if (startPosOption === 'rand') {
        const opts = Object.keys(POS_MAP);
        posNum = Number(opts[Math.floor(Math.random() * opts.length)]);
    } else {
        posNum = Number(startPosOption);
    }

    state = {
        lion: { 
            pos: { ...POS_MAP[posNum] }, 
            hidden: false, 
            attacking: false, 
            posNum: posNum 
        },

        impala: { 
            pos: { ...IMPALA_START }, 
            fleeing: false, 
            fleeDir: null, 
            fleeVel: 1 
        },

        time: 1,
        lastImpala: null,
        lastLion: null,
        running: false,

        terminated: false   // ← NUEVO: marca fin de la cacería
    };

    document.getElementById('turn').textContent = state.time;
    document.getElementById('status').textContent = 'Listo';
    document.getElementById('lastImpala').textContent = '-';
    document.getElementById('lastLion').textContent = '-';
    document.getElementById('log').innerHTML = '';

    drawGrid(state);
}

/* ================================================================
   EJECUTAR UN T
=================================================================*/
function stepOnce() {

    // No avanzar si está corriendo automático
    if (state.running) return false;

    // 🚫 Bloquear si la cacería ya terminó
    if (state.terminated) {
        pushLog("⚠️ La cacería ya terminó. Reinicia para continuar.");
        return false;
    }

    /* ---------------- IMPALA MUEVE PRIMERO ---------------- */

    const impalaMode = document.getElementById('impalaMode').value;
    let impAction;

    if (state.impala.fleeing) {
        impAction = 'huir';
    } else if (impalaMode === 'aleatorio') {
        impAction = IMPALA_ACTIONS[Math.floor(Math.random() * IMPALA_ACTIONS.length)];
    } else {
        const seq = document.getElementById('progSeq').value
            .split(',')
            .map(s => s.trim())
            .filter(s => s);
        impAction = seq.length === 0 ? 'ver_frente' : seq[(state.time - 1) % seq.length];
    }

    const impalaWasFleeing = state.impala.fleeing;

    impalaStep(state, impAction);
    state.lastImpala = impAction;

    pushLog(`T=${state.time}: Impala → ${impAction}`);

    /* ---------------- OBSERVACIÓN DEL LEÓN ---------------- */

    const lp = state.lion.pos;
    const d = euclid(lp, state.impala.pos);

    const obs = {
        posNum: getPosNumFromCoords(lp),
        impalaAction: state.impala.fleeing ? 'huir' : impAction,
        distBucket: distBucket(d),
        hidden: state.lion.hidden
    };

    /* ---------------- LEÓN ELIGE ACCIÓN ---------------- */

    const lionAction = chooseActionQ(obs);
    state.lastLion = lionAction;

    pushLog(`T=${state.time}: León → ${lionAction}`);

    /* ---------------- LEÓN ACTÚA ---------------- */

    if (lionAction === 'avanzar') {
        lionAdvanceTowardsImpala(state);
        state.lion.hidden = false;
    } 
    else if (lionAction === 'esconder') {
        state.lion.hidden = true;
    } 
    else if (lionAction === 'atacar') {
        state.lion.attacking = true;
        lionAdvanceTowardsImpala(state);
        lionAdvanceTowardsImpala(state); // velocidad = 2
    }

    /* ---------------- DETECTAR HUIDA DETONADA POR EL LEÓN ---------------- */

    let fleeTriggeredByLion = false;

    if (!state.impala.fleeing) {
        const sees = impalaSees(state, state.lion.pos, impAction);
        if (sees || lionAction === 'atacar' || d < 3) {
            state.impala.fleeing = true;
            state.impala.fleeDir = (state.impala.pos.x <= state.lion.pos.x) ? 'E' : 'W';
            state.impala.fleeVel = 1;
            fleeTriggeredByLion = true;
        }
    }

    /* ---------------- CONDICIONES DE TERMINACIÓN ---------------- */

    // 1) ÉXITO: león alcanza al impala
    if (lp.x === state.impala.pos.x && lp.y === state.impala.pos.y) {
        updateQ(obs, lionAction, R_EXITO, null);
        state.terminated = true;

        pushLog(`T=${state.time}: 🦁 ÉXITO → el león atrapó al impala.`);
        document.getElementById('status').textContent = 'Éxito';
        renderQView();
        drawGrid(state);

        return true;
    }

    // 2) FRACASO: impala entra en huida por culpa del león
    if (state.impala.fleeing && !impalaWasFleeing) {

        // Si huida fue detonada por el león → fracaso real
        if (fleeTriggeredByLion) {
            updateQ(obs, lionAction, R_FRACASO, null);
            state.terminated = true;

            pushLog(`T=${state.time}: ❌ FRACASO → el impala huyó por culpa del león.`);
            document.getElementById('status').textContent = 'Fracaso';
            renderQView();
            drawGrid(state);

            return true;
        }
    }

    // 3) FRACASO por escapar del tablero (borde)
    if (state.impala.pos.x <= 0 || state.impala.pos.x >= GRID - 1) {
        updateQ(obs, lionAction, R_FRACASO, null);
        state.terminated = true;

        pushLog(`T=${state.time}: ❌ FRACASO → el impala escapó del tablero.`);
        document.getElementById('status').textContent = 'Fracaso (escape)';
        renderQView();
        drawGrid(state);

        return true;
    }

    /* ---------------- APRENDIZAJE EN ESTADO NO TERMINAL ---------------- */

    const lp2 = state.lion.pos;
    const d2 = euclid(lp2, state.impala.pos);

    const nextObs = {
        posNum: getPosNumFromCoords(lp2),
        impalaAction: state.impala.fleeing ? 'huir' : impAction,
        distBucket: distBucket(d2),
        hidden: state.lion.hidden
    };

    updateQ(obs, lionAction, R_PASO, nextObs);

    /* ---------------- ACTUALIZACIÓN DEL T ---------------- */
    state.time += 1;
    document.getElementById('turn').textContent = state.time;
    document.getElementById('status').textContent = 'En curso';
    renderQView();
    drawGrid(state);

    return false;
}

/* ================================================================
   ENTRENAMIENTO AUTOMÁTICO
=================================================================*/
let training = false;

async function trainN(n) {
    TRAIN_ABORT = false;
    training = true;

    document.getElementById('btnStopTrain').style.display = 'inline-block';
    pushLog(`Entrenamiento: ${n} episodios.`);

    for (let i = 0; i < n; i++) {
        if (TRAIN_ABORT) break;
        initState(document.getElementById('startPos').value);

        let iter = 0;
        while (iter < 500) {
            iter++;
            const done = stepOnce();
            if (done) break;
        }

        if (i % 50 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }

    training = false;
    document.getElementById('btnStopTrain').style.display = 'none';
    saveQToLocal();
    pushLog('Entrenamiento finalizado.');
    renderQView();
}

/* ================================================================
   UI HOOKS
=================================================================*/
document.getElementById('btnReset').addEventListener('click', () => {
    initState(document.getElementById('startPos').value);
    pushLog('Estado reiniciado.');
});

document.getElementById('btnTrain').addEventListener('click', () => {
    trainN(1000);
});

document.getElementById('btnStopTrain').addEventListener('click', () => {
    TRAIN_ABORT = true;
    pushLog('Solicitud de detención recibida.');
});

document.getElementById('btnStep').addEventListener('click', () => {
    stepOnce();
});

document.getElementById('btnShowKB').addEventListener('click', () => {
    renderQView();
    pushLog('Mostrando Q-table.');
});

document.getElementById('btnSaveKB').addEventListener('click', () => {
    downloadQ();
    pushLog('Descargando Q-table...');
});

document.getElementById('btnLoadKB').addEventListener('click', () => {
    document.getElementById('kbFile').click();
});

document.getElementById('kbFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;

    const r = new FileReader();
    r.onload = () => {
        try {
            const j = JSON.parse(r.result);
            loadQFromFile(j);
            renderQView();
            pushLog('Q-table cargada desde archivo.');
        } catch (err) {
            pushLog('Error cargando Q-table: ' + err.message);
        }
    };
    r.readAsText(f);
});

document.getElementById('impalaMode').addEventListener('change', e => {
    document.getElementById('progLabel').style.display =
        e.target.value === 'programado' ? 'block' : 'none';
});

/* ================================================================
   INICIO AUTOMÁTICO
=================================================================*/
loadQFromLocal();
initLogElement();
initState('rand');
renderQView();
