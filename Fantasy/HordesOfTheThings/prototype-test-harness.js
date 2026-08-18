const { HordesPrototype } = require('./prototype-app.js');
const data = require('./prototype-data.js');
const geometry = require('./prototype-geometry.js');
const rules = require('./prototype-rules.js');

function createBlade(id, x, y) {
    return {
        id,
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x,
        y,
        rotation: 0,
        movedThisTurn: false,
        troopClass: 'infantry',
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        ranged: null,
        value: 2,
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
}

function createArtillery(id, x, y, side = 'blue') {
    return {
        id,
        type: 'Artillery',
        side,
        width: 40,
        depth: 40,
        x,
        y,
        rotation: 0,
        movedThisTurn: false,
        troopClass: 'infantry',
        moves: { road: 75, good: 50, bad: 0, water: 25 },
        ranged: { phase: 'shooting', range: 125, width: 120, requiresOwnTurn: true, requiresStationary: true },
        value: 3,
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
}

function createRankPair(leftId, rightId, x, y, rotation, side) {
    const right = geometry.getRightVector(rotation);
    return [
        { ...createBlade(leftId, x, y), rotation, side: side || 'blue' },
        { ...createBlade(rightId, x + (right.x * 40), y + (right.y * 40)), rotation, side: side || 'blue' }
    ];
}

function createStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        }
    };
}

function createAppHarness(overrides) {
    const app = Object.create(HordesPrototype.prototype);
    const capturedPointers = new Set();
    app.state = {
        mode: 'game',
        players: {
            'player-1': { ...data.DEFAULT_PLAYERS['player-1'] },
            'player-2': { ...data.DEFAULT_PLAYERS['player-2'] }
        },
        activePlayerId: 'player-1',
        remainingMoves: 1,
        phase: 'move',
        units: [],
        terrain: data.createDefaultTerrain(),
        selectedIds: [],
        selectionAnalysis: { type: 'none', invalid: false, reason: '' },
        draft: null,
        formUp: null,
        shooting: null,
        melee: null,
        combatResolution: null,
        storageModalOpen: true,
        snapEnabled: true,
        showFormUpPreview: false,
        singleRotationMode: 'center',
        showRangedArea: false,
        losses: { 'player-1': [], 'player-2': [] },
        reserveUnits: [],
        homeEdgeByPlayerId: { 'player-1': 'bottom', 'player-2': 'top' },
        editHistory: [],
        marquee: null,
        interaction: null,
        camera: { x: 0, y: 0, scale: 1, minScale: 0.6, maxScale: 6 },
        status: ''
    };
    Object.assign(app.state, overrides?.state || {});
    app.ui = {
        storageNameInput: { value: '' },
        deploymentCanvas: {
            setPointerCapture() {},
            hasPointerCapture() { return false; },
            releasePointerCapture() {},
            getBoundingClientRect() {
                return { left: 0, top: 0, width: 600, height: 600 };
            },
            clientWidth: 600,
            clientHeight: 600,
            width: 600,
            height: 600
        },
        deploymentTray: { innerHTML: '', querySelectorAll: () => [] },
        deploymentActivePlayer: { textContent: '' },
        deploymentProgress: { textContent: '' },
        deploymentStatus: { textContent: '' },
        finishDeploymentButton: { disabled: false },
        returnToTrayButton: { disabled: true },
        autoDeployButton: { disabled: false },
        ...overrides?.ui
    };
    app.canvas = {
        setPointerCapture(pointerId) {
            capturedPointers.add(pointerId);
        },
        hasPointerCapture(pointerId) {
            return capturedPointers.has(pointerId);
        },
        releasePointerCapture(pointerId) {
            capturedPointers.delete(pointerId);
        }
    };
    app.nextUnitId = overrides?.nextUnitId || 1;
    app.requestRender = () => {
        app.renderRequested = true;
    };
    app.syncUiFromState = () => {
        app.synced = true;
    };
    app.updateStatus = (message) => {
        app.state.status = message;
        app.lastStatus = message;
    };
    app.evaluateDraft = () => {};
    app.renderUnitDeployment = () => {};
    app.renderStorageList = () => {
        app.storageRendered = true;
    };
    app.closeStorageModal = (restoreFocus = true) => {
        app.state.storageModalOpen = false;
        app.closedWithFocus = restoreFocus;
    };
    app.maybeAutoAdvanceCombatPhase = () => false;
    app.initializeShootingPhase = () => {
        app.state.shooting = { focusedAttackerId: null, validTargetIds: [], attacksByAttacker: {} };
    };
    app.initializeMeleePhase = () => {
        app.state.melee = { combats: [], combatants: [], participantIds: new Set() };
    };
    app.screenToWorld = (x, y) => ({ x, y });
    app.updateSelectionAnalysis = function updateSelectionAnalysis() {
        this.state.selectionAnalysis = rules.analyzeSelection(this.getSelectedUnits());
    };
    return app;
}

module.exports = {
    HordesPrototype,
    data,
    geometry,
    rules,
    createBlade,
    createArtillery,
    createRankPair,
    createStorage,
    createAppHarness
};
