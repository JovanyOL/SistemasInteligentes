/* main.js — conecta todo y contiene loop principal (LIMPIO Y OPTIMIZADO) */

/* ========== CONFIG / RECOMPENSAS ========== */
const R_EXITO = +100;
const R_FRACASO = -100;
const R_PASO = -1;
const R_ACERCARSE = +0.5;
const MAX_STEPS_PER_EPISODE = 500;

/* ========== ESTADO GLOBAL ========== */
let state = {};
let TRAIN_ABORT = false;
let training = false;

/* Utilidad */
function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/* ========== INICIALIZAR ESTADO ========== */
function initState(startPosOption) {
    let posNum;
    if (startPosOption === 'rand') {
        const opts = Object.keys(POS_MAP);
        posNum = Number(opts[Math.floor(Math.random() * opts.length)]);
    } else {
        posNum = Number(startPosOption);
    }

    state = {
        lion: { pos: { ...POS_MAP[posNum] }, hidden: false, attacking: false },
        impala: { pos: { ...IMPALA_START }, fleeing: false, fleeDir: null, fleeVel: 1, lastAction: null },
        time: 1,
        lastImpala: null,
        lastLion: null,
        running: false,
        fastMode: false
    };

    document.getElementById('turn').textContent = state.time;
    document.getElementById('status').textContent = 'Listo';
    document.getElementById('lastImpala').textContent = '-';
    document.getElementById('lastLion').textContent = '-';
    document.getElementById('log').innerHTML = '';

    drawGrid(state);
    renderQView();
}

/* ========== IMPALA ACTION ========== */
function getImpalaAction() {
    const impalaMode = document.getElementById('impalaMode').value;

    if (state.impala.fleeing) return 'huir';

    if (impalaMode === 'aleatorio') {
        return IMPALA_ACTIONS[Math.floor(Math.random() * IMPALA_ACTIONS.length)];
    }

    const seq = document.getElementById('progSeq').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

    return seq.length === 0 ? 'ver_frente' : seq[(state.time - 1) % seq.length];
}

/* ========== ACCIÓN DEL LEÓN ========== */
function applyLionAction(action, distBefore) {
    if (action === 'avanzar') {
        lionAdvanceTowardsImpala(state);
        state.lion.hidden = false;
    }
    else if (action === 'esconder') {
        state.lion.hidden = true;
    }
    else if (action === 'atacar') {
        if (distBefore <= 1) {
            state.lion.attacking = true;
            lionAdvanceTowardsImpala(state);
        } else {
            state.lion.hidden = false;
        }
    }
}

/* ========== CHECK DE HUIDA ========== */
function checkAndTriggerImpalaFlee(lionAction, impAction, distBefore) {
    const sees = impalaSees(state, state.lion.pos, impAction);
    const close = distBefore <= 2;

    let caused = false;

    if (!state.impala.fleeing && (sees || lionAction === 'atacar' || close)) {
        state.impala.fleeing = true;
        state.impala.fleeDir = (state.impala.pos.x <= state.lion.pos.x) ? 'E' : 'W';
        state.impala.fleeVel = 1;
        caused = true;
    }
    return caused;
}

/* ========== RECOMPENSA Y ACTUALIZACIÓN Q ========== */
function computeRewardAndUpdateQ(obs, action, nextObs, d1, d2, terminal, reason) {

    if (terminal) {
        if (reason === 'exito') updateQ(obs, action, R_EXITO, null);
        else if (reason === 'fracaso') updateQ(obs, action, R_FRACASO, null);
        return;
    }

    let r = R_PASO;
    if (d2 < d1) r += R_ACERCARSE;
    else if (d2 > d1) r -= Math.abs(R_ACERCARSE);

    updateQ(obs, action, r, nextObs);
}

/* ========== UN PASO DE SIMULACIÓN ========== */
function stepOnce() {
    if (state.running) return false;

    /* Acción del Impala */
    const impAction = getImpalaAction();
    const wasFleeing = state.impala.fleeing;
    impalaStep(state, impAction);
    state.lastImpala = impAction;

    /* Observación actual */
    const lp = state.lion.pos;
    const d = manhattan(lp, state.impala.pos);
    const obs = {
        posNum: getPosNumFromCoords(lp),
        impalaAction: state.impala.fleeing ? 'huir' : impAction,
        distBucket: distBucket(d),
        hidden: state.lion.hidden
    };

    /* Acción del león */
    const lionAction = chooseActionQ(obs);
    state.lastLion = lionAction;

    /* Aplicar acción */
    applyLionAction(lionAction, d);

    /* Huida */
    const triggered = checkAndTriggerImpalaFlee(lionAction, impAction, d);

    /* Terminal — éxito */
    const reached = (state.lion.pos.x === state.impala.pos.x && state.lion.pos.y === state.impala.pos.y);
    if (reached) {
        computeRewardAndUpdateQ(obs, lionAction, null, d, 0, true, 'exito');
        pushLog(`T=${state.time}: ÉXITO — impala alcanzado.`);
        document.getElementById('status').textContent = 'Éxito';
        drawGrid(state); renderQView();
        return true;
    }

    /* Terminal — impala huye */
    if (state.impala.fleeing && !wasFleeing) {
        if (triggered) {
            computeRewardAndUpdateQ(obs, lionAction, null, d, manhattan(state.lion.pos, state.impala.pos), true, 'fracaso');
            pushLog(`T=${state.time}: Fracaso — impala huyó por culpa del león.`);
            document.getElementById('status').textContent = 'Fracaso';
        } else {
            pushLog(`T=${state.time}: Impala huyó espontáneamente (no penalizado).`);
            document.getElementById('status').textContent = 'Huida espontánea';
        }
        drawGrid(state); renderQView();
        return true;
    }

    /* No terminal — actualizar Q */
    const lp2 = state.lion.pos;
    const d2 = manhattan(lp2, state.impala.pos);

    const nextObs = {
        posNum: getPosNumFromCoords(lp2),
        impalaAction: state.impala.fleeing ? 'huir' : impAction,
        distBucket: distBucket(d2),
        hidden: state.lion.hidden
    };

    computeRewardAndUpdateQ(obs, lionAction, nextObs, d, d2, false, null);

    /* UI */
    state.time += 1;
    document.getElementById('turn').textContent = state.time;
    document.getElementById('status').textContent = 'En curso';
    drawGrid(state);
    renderQView();

    return false;
}

/* ========== ENTRENAR N EPISODIOS ========== */
async function trainN(n, positions = [1,2,3,4,5,6,7,8]) {
    TRAIN_ABORT = false;
    training = true;
    state.fastMode = true;

    document.getElementById('btnStopTrain').style.display = 'inline-block';
    pushLog(`Entrenando ${n} episodios...`);

    for (let i = 0; i < n; i++) {
        if (TRAIN_ABORT) break;

        const p = positions[Math.floor(Math.random() * positions.length)];
        initState(String(p));

        let steps = 0;
        while (steps < MAX_STEPS_PER_EPISODE) {
            steps++;
            if (stepOnce()) break;
        }

        if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));
    }

    training = false;
    state.fastMode = false;
    document.getElementById('btnStopTrain').style.display = 'none';
    saveQToLocal();
    pushLog('Entrenamiento terminado.');

    drawGrid(state);
    renderQView();
}

/* ========== HOOKS UI ========== */
document.getElementById('btnReset').addEventListener('click', () => {
    initState(document.getElementById('startPos').value);
    pushLog('Estado reiniciado.');
});

document.getElementById('btnStep').addEventListener('click', stepOnce);

document.getElementById('btnTrain').addEventListener('click', () => {
    trainN(1000);
});
document.getElementById('btnStopTrain').addEventListener('click', () => {
    TRAIN_ABORT = true;
    pushLog('Deteniendo entrenamiento...');
});

document.getElementById('btnShowKB').addEventListener('click', () => {
    renderQView();
    pushLog('Mostrando Q-table.');
});

document.getElementById('btnExplain').addEventListener('click', () => {
    const lp = state.lion.pos;
    const d = manhattan(lp, state.impala.pos);
    const obs = {
        posNum: getPosNumFromCoords(lp),
        impalaAction: state.impala.fleeing ? 'huir' : state.lastImpala,
        distBucket: distBucket(d),
        hidden: state.lion.hidden
    };
    const key = qKeyFromObs(obs);
    ensureQ(key);

    let txt = `Clave: ${key}\n`;
    for (const a in QTABLE[key]) {
        txt += `${a}: ${QTABLE[key][a].toFixed(3)}\n`;
    }
    pushLog(txt);
});

document.getElementById('btnSaveKB').addEventListener('click', downloadQ);
document.getElementById('btnLoadKB').addEventListener('click', () => {
    document.getElementById('kbFile').click();
});

document.getElementById('kbFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;

    const r = new FileReader();
    r.onload = () => {
        try {
            loadQFromFile(JSON.parse(r.result));
            renderQView();
            pushLog('Q-table cargada.');
        } catch (err) {
            pushLog('Error al cargar: ' + err.message);
        }
    };
    r.readAsText(f);
});

/* Inicio */
loadQFromLocal();
initLogElement();
initState('rand');
renderQView();
drawGrid(state);
