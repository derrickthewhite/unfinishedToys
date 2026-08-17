const test = require('node:test');
const assert = require('node:assert/strict');

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

test('new games begin with empty 24 AP army drafts instead of a seeded battle', () => {
    const app = Object.create(HordesPrototype.prototype);
    app.nextUnitId = 1;
    app.state = app.createInitialState();

    assert.equal(app.state.setupStage, 'army-builder');
    assert.deepEqual(app.state.units, []);
    assert.deepEqual(app.state.terrain, { roads: [], features: [] });
    assert.deepEqual(app.getArmyDraft('player-1').counts, {});
    assert.deepEqual(app.getArmyDraft('player-2').counts, {});
});

test('army drafts require exactly 24 AP for both players before terrain placement', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'army-builder',
            setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null }
        }
    });

    app.adjustArmyUnit('player-1', 'Blade', 12);
    assert.equal(app.getArmyValue('player-1'), data.ARMY_POINT_TARGET);
    assert.equal(app.canAcceptArmies(), false);

    app.adjustArmyUnit('player-2', 'Blade', 12);
    assert.equal(app.canAcceptArmies(), true);
    app.openArmyConfirmation();
    assert.equal(app.state.setup.confirmation, 'armies');

    app.confirmSetupStage();
    assert.equal(app.state.setupStage, 'terrain-placement');
    assert.equal(app.state.setup.confirmation, null);
});

test('army builder updates player color and faction without changing player identity', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'army-builder',
            setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null }
        }
    });

    app.updateArmyPlayer('player-1', 'colorId', 'green');
    app.updateArmyPlayer('player-1', 'faction', 'Undead');

    assert.equal(app.state.players['player-1'].id, 'player-1');
    assert.equal(app.state.players['player-1'].colorId, 'green');
    assert.equal(app.state.players['player-1'].faction, 'Undead');
});

test('army builder random actions create an exact army and can clear it', () => {
    const app = createAppHarness({
        state: { setupStage: 'army-builder', setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null } }
    });

    app.chooseRandomArmy('player-1', () => 0);
    assert.equal(app.getArmyValue('player-1'), data.ARMY_POINT_TARGET);

    app.randomizeArmyPresentation('player-1', () => 0.99);
    assert.equal(app.state.players['player-1'].colorId, 'gold');
    assert.equal(app.state.players['player-1'].faction, 'Undead');

    app.clearArmy('player-1');
    assert.equal(app.getArmyValue('player-1'), 0);
});

test('terrain offer descriptions include shape and size labels, with a road exception', () => {
    const app = createAppHarness();

    assert.equal(app.getTerrainOfferDescription({ kind: 'forest', shape: 'oval', sizeMultiplier: 1.5 }), 'Oval · Large');
    assert.equal(app.getTerrainOfferDescription({ kind: 'road' }), 'Road · full board');
});

test('unit asset lookup includes generic artwork for the remaining unit types', () => {
    const app = createAppHarness();

    ['Heavy-Spear', 'Heavy-Warband', 'Beasts', 'Flyers', 'Behemoth'].forEach((type) => {
        assert.equal(app.getUnitAssetPath({ type, faction: 'Panda' }), `assets/${type}.svg`);
    });
    assert.equal(app.getUnitAssetPath({ type: 'Artillery', faction: 'Undead' }), 'assets/Artillery.svg');
});

test('terrain setup rolls a defender and creates a bounded editable terrain target', () => {
    const app = createAppHarness({
        state: { setup: { armies: {}, confirmation: null } }
    });

    const terrain = app.initializeTerrainPlacement(() => 0.99);
    assert.equal(terrain.defenderPlayerId, 'player-2');
    assert.equal(terrain.terrainCount, 8);
    assert.equal(terrain.offers.length, 3);

    app.setTerrainCount(99);
    assert.equal(terrain.terrainCount, data.TERRAIN_COUNT_MAX);
});

test('placing terrain refreshes offers and confirmation transitions to unit deployment', () => {
    const app = createAppHarness({
        state: { setupStage: 'terrain-placement', setup: { armies: {}, confirmation: null } }
    });
    const terrain = app.initializeTerrainPlacement(() => 0);
    terrain.terrainCount = 1;
    terrain.offers = [data.createTerrainOffer('forest', 'forest-1', () => 0)];

    app.placeTerrainOffer('forest-1');
    assert.equal(app.state.terrain.features.length, 1);
    assert.equal(terrain.offers.length, 3);
    assert.equal(app.isTerrainReady(), true);

    app.openTerrainConfirmation();
    assert.equal(app.state.setup.confirmation, 'terrain');
    app.confirmSetupStage();
    assert.equal(app.state.setupStage, 'unit-deployment');
});

test('terrain offers include a named shape and one of the prescribed size tiers', () => {
    const offer = data.createTerrainOffer('forest', 'forest-1', () => 0.99);

    assert.equal(data.TERRAIN_SHAPES.includes(offer.shape), true);
    assert.equal(data.TERRAIN_SIZE_MULTIPLIERS.includes(offer.sizeMultiplier), true);
    assert.equal(offer.sizeMultiplier, 1.5);
});

test('terrain movement allows a feature center to rest on the board edge', () => {
    const app = createAppHarness({
        state: { setupStage: 'terrain-placement', setup: { armies: {}, confirmation: null } }
    });
    const terrain = app.initializeTerrainPlacement(() => 0);
    const feature = data.createTerrainOffer('forest', 'forest-1', () => 0);
    app.state.terrain.features.push(feature);
    terrain.selectedTerrainId = feature.id;

    app.state.terrainInteraction = {
        pointerId: 1,
        pieceId: feature.id,
        start: { x: 300, y: 300 },
        base: { ...feature }
    };
    app.terrainScreenToWorld = () => ({ x: 0, y: 0 });
    app.renderTerrainPlacement = () => {};
    app.onTerrainPointerMove({ pointerId: 1 });

    assert.equal(feature.cx, 0);
    assert.equal(feature.cy, 0);
});

test('random terrain placement retries overlaps and fills the requested terrain count', () => {
    const app = createAppHarness({
        state: { setupStage: 'terrain-placement', setup: { armies: {}, confirmation: null } }
    });
    const terrain = app.initializeTerrainPlacement(() => 0.5);
    terrain.terrainCount = 2;
    const candidates = [
        { id: 'one', kind: 'forest', shape: 'circle', cx: 100, cy: 100, rx: 30, ry: 30, wobble: 0, rotation: 0 },
        { id: 'overlap', kind: 'forest', shape: 'circle', cx: 100, cy: 100, rx: 30, ry: 30, wobble: 0, rotation: 0 },
        { id: 'two', kind: 'forest', shape: 'circle', cx: 400, cy: 400, rx: 30, ry: 30, wobble: 0, rotation: 0 }
    ];
    app.createRandomTerrainPiece = () => candidates.shift();

    app.autoPlaceTerrain();

    assert.equal(app.state.terrain.features.length, 2);
    assert.equal(app.terrainPiecesOverlap(app.state.terrain.features[0], app.state.terrain.features[1]), false);
    assert.equal(app.isTerrainReady(), true);
});

test('left wheeling bubble stays outside the rank and mirrors the right bubble rotation', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const analysis = app.state.selectionAnalysis;
    const handles = app.getSelectionHandles();
    const leftHandle = handles.find((handle) => handle.kind === 'rank-left');
    const rightHandle = handles.find((handle) => handle.kind === 'rank-right');
    const leftOffset = geometry.subtract(leftHandle.position, analysis.leftHandle);

    assert.equal(analysis.type, 'rank');
    assert.ok(geometry.dot(leftOffset, analysis.leftOutward) > 15);
    assert.ok(Math.abs(geometry.normalizeAngle(leftHandle.rotation - rightHandle.rotation)) < 0.001);
});

test('convert bubble sits behind the formation', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const analysis = app.state.selectionAnalysis;
    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'formation-convert');
    const info = app.getFormationCenterInfo(analysis);
    const offset = geometry.subtract(handle.position, info.formationCenter);

    assert.ok(geometry.dot(offset, analysis.forward) < -15);
});

test('rank wheeling only allows forward rotation', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'rank-left');
    const baseSnapshot = geometry.snapshotPositions(app.state.selectedIds, app.state.units);
    const baseRotation = units[0].rotation;
    const allowedDelta = handle.forwardRotationSign > 0 ? 0.3 : -0.3;
    const blockedDelta = -allowedDelta;

    app.state.interaction = {
        type: 'rotate-rank',
        pointerId: 1,
        startClientX: 0,
        startClientY: 0,
        moved: false,
        dragBase: baseSnapshot,
        pivot: handle.pivot,
        anchorAngle: geometry.angleBetween(handle.pivot, handle.position),
        draftIds: [...app.state.selectedIds],
        forwardRotationSign: handle.forwardRotationSign
    };

    const backwardWorld = geometry.rotatePoint(handle.position, handle.pivot, blockedDelta);
    app.onPointerMove({ pointerId: 1, clientX: backwardWorld.x, clientY: backwardWorld.y });
    assert.ok(Math.abs(app.state.units[0].rotation - baseRotation) < 0.0001);

    geometry.restoreSnapshot(baseSnapshot, app.state.units);
    app.state.interaction.anchorAngle = geometry.angleBetween(handle.pivot, handle.position);
    const forwardWorld = geometry.rotatePoint(handle.position, handle.pivot, allowedDelta);
    app.onPointerMove({ pointerId: 1, clientX: forwardWorld.x, clientY: forwardWorld.y });
    assert.ok(Math.abs(app.state.units[0].rotation - baseRotation) > 0.05);
});

test('move-rank keeps an angled contact element formed up while the other element keeps moving forward', () => {
    const blueUnits = createRankPair('b1', 'b2', 100, 200, 0);
    const redUnits = createRankPair('r1', 'r2', 100, 100, Math.PI / 4, 'red');
    const app = createAppHarness({
        state: {
            units: [...blueUnits, ...redUnits],
            terrain: { roads: [], features: [] },
            selectedIds: ['b1', 'b2'],
            snapEnabled: false
        }
    });
    app.updateSelectionAnalysis();

    app.state.draft = {
        unitIds: ['b1', 'b2'],
        initialOrigin: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        validationOrigin: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        origin: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        history: [],
        invalidIds: new Set(),
        reasonById: new Map(),
        allowSingleRotationFormationEscape: false
    };

    const analysis = app.state.selectionAnalysis;
    app.state.interaction = {
        type: 'move-rank',
        pointerId: 1,
        startClientX: 0,
        startClientY: 0,
        moved: false,
        dragBase: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        draftIds: ['b1', 'b2'],
        anchorWorld: { x: 0, y: 0 },
        rankAnalysis: analysis
    };

    const firstWorld = geometry.scaleVector(analysis.forward, 100);
    app.onPointerMove({ pointerId: 1, clientX: firstWorld.x, clientY: firstWorld.y });
    const firstSnapshot = geometry.snapshotPositions(['b1', 'b2'], app.state.units);

    assert.ok(Math.abs(app.getUnitById('b1').rotation + (3 * Math.PI / 4)) < 0.01);
    assert.ok(Math.abs(app.getUnitById('b2').rotation) < 0.01);
    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(app.state.selectionAnalysis.invalid, false);

    const secondWorld = geometry.scaleVector(analysis.forward, 140);
    app.onPointerMove({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });

    assert.equal(geometry.sameFootprint(firstSnapshot.b1, app.getUnitById('b1')), true);
    assert.equal(geometry.sameFootprint(firstSnapshot.b2, app.getUnitById('b2')), false);

    app.onPointerUp({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });
    assert.equal(app.state.selectionAnalysis.type, 'invalid');
    assert.equal(app.state.selectionAnalysis.invalid, true);
});

test('rotate-rank keeps an angled contact element formed up while the other element keeps wheeling', () => {
    const blueUnits = createRankPair('u1', 'u2', 240, 260, 0);
    const redUnits = createRankPair('e1', 'e2', 220, 200, Math.PI / 4, 'red');
    const app = createAppHarness({
        state: {
            units: [...blueUnits, ...redUnits],
            terrain: { roads: [], features: [] },
            selectedIds: ['u1', 'u2'],
            snapEnabled: false
        }
    });
    app.updateSelectionAnalysis();

    app.state.draft = {
        unitIds: ['u1', 'u2'],
        initialOrigin: geometry.snapshotPositions(['u1', 'u2'], app.state.units),
        validationOrigin: geometry.snapshotPositions(['u1', 'u2'], app.state.units),
        origin: geometry.snapshotPositions(['u1', 'u2'], app.state.units),
        history: [],
        invalidIds: new Set(),
        reasonById: new Map(),
        allowSingleRotationFormationEscape: false
    };

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'rank-left');
    const initialSnapshot = geometry.snapshotPositions(['u1', 'u2'], app.state.units);
    app.state.interaction = {
        type: 'rotate-rank',
        pointerId: 1,
        startClientX: 0,
        startClientY: 0,
        moved: false,
        dragBase: initialSnapshot,
        pivot: handle.pivot,
        anchorAngle: geometry.angleBetween(handle.pivot, handle.position),
        draftIds: ['u1', 'u2'],
        forwardRotationSign: handle.forwardRotationSign,
        rankAnalysis: app.state.selectionAnalysis
    };

    const firstWorld = geometry.rotatePoint(handle.position, handle.pivot, handle.forwardRotationSign > 0 ? 0.75 : -0.75);
    app.onPointerMove({ pointerId: 1, clientX: firstWorld.x, clientY: firstWorld.y });
    const firstSnapshot = geometry.snapshotPositions(['u1', 'u2'], app.state.units);

    assert.ok(Math.abs(app.getUnitById('u1').rotation + (Math.PI / 4)) < 0.01);
    assert.ok(Math.abs(app.getUnitById('u2').rotation - 0.75) < 0.01);
    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(app.state.selectionAnalysis.invalid, false);

    const secondWorld = geometry.rotatePoint(handle.position, handle.pivot, handle.forwardRotationSign > 0 ? 0.95 : -0.95);
    app.onPointerMove({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });

    assert.equal(geometry.sameFootprint(firstSnapshot.u1, app.getUnitById('u1')), true);
    assert.equal(geometry.sameFootprint(firstSnapshot.u2, app.getUnitById('u2')), false);

    app.onPointerUp({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });
    assert.equal(app.state.selectionAnalysis.type, 'invalid');
    assert.equal(app.state.selectionAnalysis.invalid, true);
});

test('reverseSelection keeps a rank front-aligned even with mixed depths', () => {
    const units = [
        createBlade('u1', 100, 220),
        { ...createBlade('u2', 140, 220), type: 'Riders', depth: 30 },
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    const originalCenter = app.getFormationCenterInfo(rules.analyzeSelection(units)).formationCenter;
    app.updateSelectionAnalysis();

    app.applyReverseSelection();

    assert.equal(app.state.selectionAnalysis.type, 'rank');
    const frontCenters = app.state.selectedIds.map((unitId) => app.getUnitFrontCenter(app.getUnitById(unitId)));
    const forward = app.state.selectionAnalysis.forward;
    const projections = frontCenters.map((point) => geometry.dot(point, forward));
    projections.forEach((projection) => {
        assert.ok(Math.abs(projection - projections[0]) < 0.001);
    });
    const reversedCenter = app.getFormationCenterInfo(app.state.selectionAnalysis).formationCenter;
    assert.ok(geometry.distance(reversedCenter, originalCenter) < 0.001);
});

test('edit mode click selects a single unit without requiring a drag', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units
        }
    });
    const center = geometry.getUnitCenter(units[0]);

    app.onPointerDown({ pointerId: 1, button: 0, clientX: center.x, clientY: center.y, shiftKey: false });
    app.onPointerUp({ pointerId: 1, clientX: center.x, clientY: center.y });

    assert.deepEqual(app.state.selectedIds, ['u1']);
    assert.equal(app.state.selectionAnalysis.type, 'single');
});

test('edit mode single-unit rotation handle still rotates the unit', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: ['u1']
        }
    });
    app.updateSelectionAnalysis();

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'single-rotate');
    const center = geometry.getUnitCenter(units[0]);
    app.onPointerDown({ pointerId: 1, button: 0, clientX: handle.position.x, clientY: handle.position.y, shiftKey: false });
    const rotatedWorld = geometry.rotatePoint(handle.position, center, 0.35);
    app.onPointerMove({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });
    app.onPointerUp({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });

    assert.ok(Math.abs(app.getUnitById('u1').rotation) > 0.1);
});

test('single-unit corner rotation keeps the front corner fixed for forward rotation', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: ['u1'],
            singleRotationMode: 'front-corner'
        }
    });
    app.updateSelectionAnalysis();

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'single-rotate');
    const center = geometry.getUnitCenter(units[0]);
    const before = geometry.getUnitCorners(units[0]);
    app.onPointerDown({ pointerId: 1, button: 0, clientX: handle.position.x, clientY: handle.position.y, shiftKey: false });
    const rotatedWorld = geometry.rotatePoint(handle.position, center, 0.35);
    app.onPointerMove({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });
    app.onPointerUp({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });

    const after = geometry.getUnitCorners(app.getUnitById('u1'));
    assert.ok(Math.abs(after.frontRight.x - before.frontRight.x) < 0.001);
    assert.ok(Math.abs(after.frontRight.y - before.frontRight.y) < 0.001);
    assert.ok(after.frontLeft.y < before.frontLeft.y);
});

test('snapSelection can snap a unit against an enemy frontage', () => {
    const mover = createBlade('u1', 100, 220);
    const enemy = { ...createBlade('u2', 145, 220), side: 'red' };
    const app = createAppHarness({
        state: {
            units: [mover, enemy],
            selectedIds: ['u1']
        }
    });

    app.snapSelection(['u1']);

    assert.equal(app.getUnitById('u1').x, 105);
    assert.equal(app.getUnitById('u1').y, 220);
});

test('snapSelection leaves positions alone when snapping is disabled', () => {
    const mover = createBlade('u1', 100, 220);
    const enemy = { ...createBlade('u2', 145, 220), side: 'red' };
    const app = createAppHarness({
        state: {
            units: [mover, enemy],
            selectedIds: ['u1'],
            snapEnabled: false
        }
    });

    app.snapSelection(['u1']);

    assert.equal(app.getUnitById('u1').x, 100);
    assert.equal(app.getUnitById('u1').y, 220);
});

test('keyboard shortcuts toggle snap and rotation modes and step a single draft', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            units: [createBlade('u1', 100, 220)],
            selectedIds: ['u1'],
            selectionAnalysis: { type: 'single', invalid: false, reason: '' },
            draft: {
                unitIds: ['u1'],
                invalidIds: new Set(),
                history: [],
                initialOrigin: {},
                origin: {},
                validationOrigin: {}
            }
        }
    });
    let stepCount = 0;
    app.stepSingleDraft = () => {
        stepCount += 1;
    };

    const firstEvent = { key: 'n', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null };
    const secondEvent = { key: 'r', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null };
    const thirdEvent = { key: 's', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null };

    app.onKeyDown(firstEvent);
    app.onKeyDown(secondEvent);
    app.onKeyDown(thirdEvent);

    assert.equal(app.state.snapEnabled, false);
    assert.equal(app.state.singleRotationMode, 'front-corner');
    assert.equal(stepCount, 1);
});

test('collectGhostUnits includes future form-up positions when preview is enabled in move phase', () => {
    const blue = createBlade('b1', 140, 280);
    blue.playerId = 'player-1';
    blue.rotation = Math.PI / 2;
    const red = { ...createBlade('r1', 190, 310), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            showFormUpPreview: true,
            units: [blue, red]
        }
    });
    app.getFormUpPreview = HordesPrototype.prototype.getFormUpPreview;
    app.collectGhostUnits = HordesPrototype.prototype.collectGhostUnits;

    const ghosts = app.collectGhostUnits();

    assert.equal(ghosts.length, 1);
    assert.equal(ghosts[0].id, 'b1');
    assert.notEqual(ghosts[0].x, blue.x);
    assert.notEqual(ghosts[0].rotation, blue.rotation);
});

test('collectGhostUnits omits future form-up positions when preview is disabled', () => {
    const blue = createBlade('b1', 140, 280);
    blue.side = 'blue';
    blue.rotation = Math.PI / 2;
    const red = { ...createBlade('r1', 190, 310), side: 'red', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activeSide: 'blue',
            showFormUpPreview: false,
            units: [blue, red]
        }
    });
    app.getFormUpPreview = HordesPrototype.prototype.getFormUpPreview;
    app.collectGhostUnits = HordesPrototype.prototype.collectGhostUnits;

    const ghosts = app.collectGhostUnits();

    assert.equal(ghosts.length, 0);
});

test('keyboard shortcut toggles form-up preview and persists the checkbox state through sync', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            showFormUpPreview: false
        },
        ui: {
            editModeButton: { classList: { toggle() {} } },
            gameModeButton: { classList: { toggle() {} } },
            editGroup: { hidden: false },
            actionGroup: { hidden: false },
            activeSideSelect: { value: '' },
            remainingMovesInput: { value: '' },
            phaseSelect: { value: '' },
            newUnitTypeSelect: { value: '' },
            placementSideSelect: { value: '' },
            placeUnitButton: { textContent: '', disabled: false },
            finishMoveButton: { hidden: false, disabled: false },
            endMovePhaseButton: { hidden: false, disabled: false },
            stepMoveButton: { hidden: false, disabled: false },
            snapLabel: { hidden: false },
            snapCheckbox: { checked: false },
            formUpPreviewLabel: { hidden: false },
            formUpPreviewCheckbox: { checked: false },
            cornerRotationLabel: { hidden: false },
            cornerRotationCheckbox: { checked: false },
            rangedAreaLabel: { hidden: false },
            rangedAreaCheckbox: { checked: false },
            resolveShootingButton: { hidden: false, textContent: '', disabled: false },
            cancelMoveButton: { hidden: false, disabled: false },
            undoMoveButton: { hidden: false, disabled: false },
            acknowledgedButton: { hidden: false, disabled: false },
            storageModal: { hidden: true },
            blueLosses: { textContent: '', title: '' },
            redLosses: { textContent: '', title: '' },
            statusText: { textContent: '' },
            selectionText: { textContent: '' }
        }
    });
    app.syncUiFromState = HordesPrototype.prototype.syncUiFromState;
    app.renderSelectionInfo = () => {};
    app.getMeleeState = () => ({ combats: [] });
    app.getLossSummary = () => ({ points: 0, title: 'No losses.' });

    app.onKeyDown({ key: 'p', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null });

    assert.equal(app.state.showFormUpPreview, true);
    assert.equal(app.ui.formUpPreviewCheckbox.checked, true);
});

test('zoomAt can reach the increased maximum zoom level', () => {
    const app = createAppHarness();
    app.zoomAt = HordesPrototype.prototype.zoomAt;
    app.screenToWorld = HordesPrototype.prototype.screenToWorld;
    app.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 600 });
    app.state.camera = { x: 300, y: 300, scale: 5.5, minScale: 0.6, maxScale: 6 };

    app.zoomAt(300, 300, 1.5);

    assert.equal(app.state.camera.scale, 6);
});

test('setup cameras preserve the cursor world point through zoom and pan independently', () => {
    const app = createAppHarness({ state: { setupCameras: {} } });
    const canvas = {
        getBoundingClientRect() { return { left: 20, top: 40, width: 600, height: 600 }; }
    };
    const event = { clientX: 470, clientY: 340, deltaY: -1 };
    const before = app.setupScreenToWorld(event, 'deployment', canvas);

    app.zoomSetupAt(event, 'deployment', canvas);
    const after = app.setupScreenToWorld(event, 'deployment', canvas);

    assert.ok(Math.abs(before.x - after.x) < 0.001);
    assert.ok(Math.abs(before.y - after.y) < 0.001);
    assert.equal(app.getSetupCamera('terrain').scale, 1);

    const camera = app.getSetupCamera('deployment');
    app.panSetupCamera({ cameraStartX: camera.x, cameraStartY: camera.y, startClientX: 470, startClientY: 340 }, { clientX: 580, clientY: 340 }, 'deployment');
    assert.ok(camera.x < before.x);
});

test('renderSelectionInfo shows single-unit details in the side panel', () => {
    const unit = createBlade('u1', 100, 220);
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units: [unit],
            selectedIds: ['u1'],
            status: 'Ready'
        },
        ui: {
            selectionText: { textContent: '' },
            selectionPanel: {
                toggled: [],
                classList: {
                    toggle(name, value) {
                        this.owner.toggled.push([name, value]);
                    },
                    owner: null
                }
            },
            selectionPanelEyebrow: { textContent: '' },
            selectionPanelTitle: { textContent: '' },
            selectionPanelHint: { textContent: '' },
            selectionPanelStats: { hidden: true, innerHTML: '' }
        }
    });
    app.ui.selectionPanel.classList.owner = app.ui.selectionPanel;
    app.updateSelectionAnalysis = HordesPrototype.prototype.updateSelectionAnalysis;
    app.getSelectedUnitDetails = HordesPrototype.prototype.getSelectedUnitDetails;
    app.formatPaces = HordesPrototype.prototype.formatPaces;
    app.renderSelectionInfo = HordesPrototype.prototype.renderSelectionInfo;

    app.updateSelectionAnalysis();
    app.renderSelectionInfo();

    assert.equal(app.ui.selectionText.textContent, '1 selected, Blade.');
    assert.equal(app.ui.selectionPanelTitle.textContent, 'Blade');
    assert.equal(app.ui.selectionPanelHint.textContent, '40mm frontage, 20mm depth.');
    assert.equal(app.ui.selectionPanelStats.hidden, false);
    assert.match(app.ui.selectionPanelStats.innerHTML, /<dt>Strength<\/dt>/);
    assert.match(app.ui.selectionPanelStats.innerHTML, /Infantry 5, Mounted 3/);
    assert.deepEqual(app.ui.selectionPanel.toggled, [['is-empty', false]]);
});

test('handle clicks do not collapse a formation selection to one underlying unit', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const reverseHandle = app.getSelectionHandles().find((entry) => entry.kind === 'formation-reverse');
    app.onPointerDown({ pointerId: 1, button: 0, clientX: reverseHandle.position.x, clientY: reverseHandle.position.y, shiftKey: false });
    app.onPointerUp({ pointerId: 1, clientX: reverseHandle.position.x, clientY: reverseHandle.position.y });

    assert.deepEqual(app.state.selectedIds, ['u1', 'u2', 'u3']);
    assert.equal(app.state.selectionAnalysis.type, 'rank');
});

test('convertSelection turns a rank into a legal file without recentering the whole formation', () => {
    const units = [
        createBlade('u1', 100, 520),
        createBlade('u2', 140, 520),
        createBlade('u3', 180, 520)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.ensureDraft = () => {
        app.state.draft = {
            unitIds: [...app.state.selectedIds],
            initialOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            validationOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            origin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            history: [],
            invalidIds: new Set(),
            reasonById: new Map()
        };
        return true;
    };
    app.evaluateDraft = function evaluateDraft() {
        const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
        this.state.draft.invalidIds = result.invalidIds;
        this.state.draft.reasonById = result.reasonById;
    };
    app.commitDraftStep = function commitDraftStep() {
        this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
    };
    const formationFrontBefore = geometry.midpoint(app.getUnitFrontCenter(units[0]), app.getUnitFrontCenter(units[2]));
    const originalForward = geometry.getForwardVector(units[0].rotation);
    app.updateSelectionAnalysis();

    app.applyConvertSelection();

    assert.equal(app.state.selectionAnalysis.type, 'file');
    assert.equal(app.state.draft.history.length, 1);
    assert.equal(app.lastStatus, 'Rank converted to file.');
    const leftSideCenters = app.state.selectedIds.map((unitId) => app.getUnitSideCenter(app.getUnitById(unitId), -1));
    const rightSideCenters = app.state.selectedIds.map((unitId) => app.getUnitSideCenter(app.getUnitById(unitId), 1));
    const oldFrontProjection = geometry.dot(formationFrontBefore, app.state.selectionAnalysis.right);
    const leftAligned = leftSideCenters.every((point) => Math.abs(geometry.dot(point, app.state.selectionAnalysis.right) - oldFrontProjection) < 0.001);
    const rightAligned = rightSideCenters.every((point) => Math.abs(geometry.dot(point, app.state.selectionAnalysis.right) - oldFrontProjection) < 0.001);
    assert.ok(leftAligned || rightAligned);
    const convertedCenters = app.state.selectedIds.map((unitId) => geometry.getUnitCenter(app.getUnitById(unitId)));
    convertedCenters.forEach((center) => {
        assert.ok(geometry.dot(geometry.subtract(center, formationFrontBefore), originalForward) <= 0.001);
    });
});

test('convertSelection lines up fronts when turning a file into a rank', () => {
    const units = [
        createBlade('u1', 220, 520),
        createBlade('u2', 220, 500),
        createBlade('u3', 220, 480)
    ].map((unit) => ({
        ...unit,
        moves: { road: 400, good: 400, bad: 400, water: 400 }
    }));
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.ensureDraft = () => {
        app.state.draft = {
            unitIds: [...app.state.selectedIds],
            initialOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            validationOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            origin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            history: [],
            invalidIds: new Set(),
            reasonById: new Map(),
            allowSingleRotationFormationEscape: false
        };
        return true;
    };
    app.evaluateDraft = function evaluateDraft() {
        const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
        this.state.draft.invalidIds = result.invalidIds;
        this.state.draft.reasonById = result.reasonById;
    };
    app.commitDraftStep = function commitDraftStep() {
        this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
    };
    const leftSideAnchor = geometry.midpoint(app.getUnitSideCenter(units[0], -1), app.getUnitSideCenter(units[2], -1));
    const rightSideAnchor = geometry.midpoint(app.getUnitSideCenter(units[0], 1), app.getUnitSideCenter(units[2], 1));
    app.updateSelectionAnalysis();

    app.applyConvertSelection();

    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(app.state.draft.history.length, 1);
    const frontCenters = app.state.selectedIds.map((unitId) => app.getUnitFrontCenter(app.getUnitById(unitId)));
    const averageFront = {
        x: frontCenters.reduce((sum, point) => sum + point.x, 0) / frontCenters.length,
        y: frontCenters.reduce((sum, point) => sum + point.y, 0) / frontCenters.length
    };
    const forward = app.state.selectionAnalysis.forward;
    const projections = frontCenters.map((point) => geometry.dot(point, forward));
    projections.forEach((projection) => {
        assert.ok(Math.abs(projection - projections[0]) < 0.001);
    });
    const leftDistance = geometry.distance(leftSideAnchor, { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 });
    const rightDistance = geometry.distance(rightSideAnchor, { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 });
    const preferredAnchor = leftDistance <= rightDistance ? leftSideAnchor : rightSideAnchor;
    assert.ok(geometry.distance(averageFront, preferredAnchor) < 0.001);
    const toBoardCenter = geometry.subtract({ x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 }, averageFront);
    assert.ok(geometry.dot(forward, toBoardCenter) > 0);
});

test('convertSelection rejects illegal final formations', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220),
        { ...createBlade('blocker', 140, 240), side: 'red' }
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: ['u1', 'u2', 'u3']
        }
    });
    app.ensureDraft = () => {
        app.state.draft = {
            unitIds: [...app.state.selectedIds],
            initialOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            validationOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            origin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            history: [],
            invalidIds: new Set(),
            reasonById: new Map()
        };
        return true;
    };
    app.evaluateDraft = function evaluateDraft() {
        const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
        this.state.draft.invalidIds = result.invalidIds;
        this.state.draft.reasonById = result.reasonById;
    };
    app.commitDraftStep = function commitDraftStep() {
        this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
    };
    const before = geometry.snapshotPositions(app.state.selectedIds, app.state.units);
    app.updateSelectionAnalysis();

    app.applyConvertSelection();

    assert.equal(app.lastStatus, 'That rank/file conversion would be illegal.');
    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(geometry.sameFootprint(before.u1, app.getUnitById('u1')), true);
    assert.equal(app.state.draft.history.length, 0);
});

test('saveCurrentGame stores named snapshots in local storage', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({
            state: {
                phase: 'shooting',
                units: [createBlade('unit-1', 100, 220)],
                losses: { blue: [{ id: 'dead-1', type: 'Blade', value: 2 }], red: [] },
                snapEnabled: false,
                showFormUpPreview: true,
                singleRotationMode: 'front-corner',
                showRangedArea: true
            },
            nextUnitId: 12,
            ui: {
                storageNameInput: { value: 'slot one' }
            }
        });

        app.saveCurrentGame();

        const records = JSON.parse(storage.getItem('hordes-of-the-things-saves'));
        assert.equal(records.length, 1);
        assert.equal(records[0].name, 'slot one');
        assert.equal(records[0].snapshot.phase, 'shooting');
        assert.equal(records[0].snapshot.losses.blue[0].type, 'Blade');
        assert.equal(records[0].snapshot.snapEnabled, false);
        assert.equal(records[0].snapshot.showFormUpPreview, true);
        assert.equal(records[0].snapshot.singleRotationMode, 'front-corner');
        assert.equal(records[0].snapshot.nextUnitId, 12);
    } finally {
        global.window = previousWindow;
    }
});

test('saveCurrentGame does not save while guided setup is active', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({
            state: { setupStage: 'army-builder' },
            ui: { storageNameInput: { value: 'setup slot' } }
        });

        app.saveCurrentGame();

        assert.equal(storage.getItem('hordes-of-the-things-saves'), null);
        assert.equal(app.lastStatus, 'Saving is available once deployment has begun the game.');
    } finally {
        global.window = previousWindow;
    }
});

test('loadGame restores saved state from local storage', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    const record = {
        id: 'save-1',
        name: 'loaded slot',
        savedAt: '2026-05-29T15:30:00.000Z',
        snapshot: {
            mode: 'game',
            activeSide: 'red',
            remainingMoves: 3,
            phase: 'shooting',
            units: [createBlade('unit-4', 240, 260)],
            terrain: data.createDefaultTerrain(),
            losses: { blue: [], red: [{ id: 'dead-2', type: 'Horde', value: 1 }] },
            snapEnabled: false,
            showFormUpPreview: true,
            singleRotationMode: 'front-corner',
            showRangedArea: true,
            nextUnitId: 9
        }
    };
    storage.setItem('hordes-of-the-things-saves', JSON.stringify([record]));
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({ state: { setupStage: 'terrain-placement' } });
        app.loadGame('save-1');

        assert.equal(app.state.setupStage, 'game');
        assert.equal(app.state.activePlayerId, 'player-2');
        assert.equal(app.state.phase, 'shooting');
        assert.equal(app.state.units[0].id, 'unit-4');
        assert.equal(app.state.losses['player-2'][0].type, 'Horde');
        assert.equal(app.state.snapEnabled, false);
        assert.equal(app.state.showFormUpPreview, true);
        assert.equal(app.state.singleRotationMode, 'front-corner');
        assert.equal(app.state.showRangedArea, true);
        assert.equal(app.nextUnitId, 9);
        assert.ok(app.state.shooting);
        assert.equal(app.state.storageModalOpen, false);
        assert.equal(app.lastStatus, 'Loaded saved game loaded slot.');
    } finally {
        global.window = previousWindow;
    }
});

test('handleShootingClick does not select a shooter with enemy front contact', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 328.2549045788197,
        y: 311.5331540840229,
        rotation: 0,
        movedThisTurn: false,
        troopClass: 'infantry',
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        ranged: { phase: 'shooting', range: 50, width: 120 },
        value: 2,
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const enemyInMelee = {
        id: 'e1',
        type: 'Riders',
        side: 'red',
        width: 40,
        depth: 30,
        x: 328.2549045788197,
        y: 311.5331540840229,
        rotation: Math.PI,
        movedThisTurn: false,
        troopClass: 'mounted',
        moves: { road: 125, good: 125, bad: 50, water: 25 },
        ranged: null,
        value: 2,
        strength: { infantry: 3, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [shooter, enemyInMelee]
        }
    });

    app.handleShootingClick(shooter);

    assert.equal(app.state.shooting.focusedAttackerId, null);
    assert.deepEqual(app.state.shooting.validTargetIds, []);
    assert.deepEqual(app.state.selectedIds, []);
    assert.equal(app.lastStatus, 'Shooter cannot shoot while engaged in melee.');
});

test('movement flags persist through shooting and reset for the incoming side', () => {
    const blueArtillery = createArtillery('blue-artillery', 100, 220);
    const redArtillery = createArtillery('red-artillery', 160, 220, 'red');
    blueArtillery.movedThisTurn = true;
    redArtillery.movedThisTurn = true;
    const app = createAppHarness({
        state: {
            phase: 'form-up',
            units: [blueArtillery, redArtillery]
        }
    });
    app.rollDie = () => 4;

    app.setPhase('shooting');

    assert.equal(blueArtillery.movedThisTurn, true);
    assert.equal(redArtillery.movedThisTurn, true);

    app.advanceToNextTurn();

    assert.equal(app.state.activePlayerId, 'player-2');
    assert.equal(blueArtillery.movedThisTurn, true);
    assert.equal(redArtillery.movedThisTurn, false);
});

test('handleShootingClick rejects moved and inactive artillery', () => {
    const artillery = createArtillery('a1', 100, 220);
    const target = { ...createBlade('t1', 100, 100), side: 'red', rotation: Math.PI };
    artillery.movedThisTurn = true;
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [artillery, target],
            terrain: { roads: [], features: [] }
        }
    });

    app.handleShootingClick(artillery);

    assert.equal(app.state.shooting.focusedAttackerId, null);
    assert.equal(app.lastStatus, 'Artillery cannot shoot after moving this turn.');

    artillery.movedThisTurn = false;
    artillery.side = 'red';
    app.handleShootingClick(artillery);

    assert.equal(app.state.shooting.focusedAttackerId, null);
    assert.equal(app.lastStatus, 'Only the active side can declare shooting attacks.');
});

test('handleShootingClick selects stationary artillery on its own turn', () => {
    const artillery = createArtillery('a1', 100, 220);
    const target = { ...createBlade('t1', 100, 100), side: 'red', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [artillery, target],
            terrain: { roads: [], features: [] }
        }
    });

    app.handleShootingClick(artillery);

    assert.equal(app.state.shooting.focusedAttackerId, 'a1');
    assert.deepEqual(app.state.shooting.validTargetIds, ['t1']);
    assert.equal(app.lastStatus, 'Artillery selected for shooting.');
});

test('handleShootingClick allows shooters to fire on the opposing side turn', () => {
    const shooter = {
        ...createBlade('s1', 100, 220),
        type: 'Shooter',
        depth: 20,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = { ...createBlade('t1', 100, 170), side: 'red', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            activeSide: 'red',
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] }
        }
    });

    app.handleShootingClick(shooter);

    assert.equal(app.state.shooting.focusedAttackerId, 's1');
    assert.deepEqual(app.state.shooting.validTargetIds, ['t1']);
    assert.equal(app.lastStatus, 'Shooter selected for shooting.');
});

test('needsShootingDeclaration identifies eligible undeclared shooters', () => {
    const shooter = {
        ...createBlade('s1', 100, 220),
        type: 'Shooter',
        ranged: { phase: 'shooting', range: 50, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = { ...createBlade('t1', 100, 170), side: 'red', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] },
            shooting: { focusedAttackerId: null, validTargetIds: [], attacksByAttacker: {} }
        }
    });

    assert.equal(app.needsShootingDeclaration(shooter), true);

    app.state.shooting.attacksByAttacker.s1 = 't1';

    assert.equal(app.needsShootingDeclaration(shooter), false);
    assert.equal(app.needsShootingDeclaration(target), false);
});

test('buildCombatResolution keeps destroyed units as ghosts for aftermath display', () => {
    const attacker = createBlade('u1', 100, 220);
    const defender = createBlade('u2', 140, 220);
    const app = createAppHarness({
        state: {
            units: [attacker]
        }
    });
    const snapshot = {
        u1: { ...attacker },
        u2: { ...defender }
    };
    const result = {
        units: [{ ...attacker }],
        destroyedUnits: [{ ...defender }],
        results: [{
            primaryAttackerId: 'u1',
            defenderId: 'u2',
            attackerIds: ['u1'],
            attackerTotal: 5,
            defenderTotal: 2
        }]
    };

    const resolution = app.buildCombatResolution(snapshot, result, 'shooting');
    app.state.combatResolution = resolution;

    assert.ok(resolution.ghostSnapshot.u2);
    assert.ok(resolution.destroyedIds.has('u2'));
    const ghosts = app.collectGhostUnits();
    assert.ok(ghosts.some((unit) => unit.id === 'u2'));
});

test('drawCombatResolutionOverlays still renders summaries for destroyed participants', () => {
    const attacker = createBlade('u1', 100, 220);
    const defender = createBlade('u2', 140, 220);
    const app = createAppHarness({
        state: {
            units: [attacker],
            combatResolution: {
                phase: 'shooting',
                participantIds: new Set(['u1', 'u2']),
                destroyedIds: new Set(['u2']),
                ghostSnapshot: {
                    u2: { ...defender }
                },
                movedUnitIds: ['u2'],
                results: [{
                    primaryAttackerId: 'u1',
                    defenderId: 'u2',
                    attackerIds: ['u1'],
                    attackerTotal: 5,
                    defenderTotal: 2
                }]
            }
        }
    });
    const labels = [];
    const ctx = {
        save() {},
        restore() {},
        beginPath() {},
        roundRect() {},
        fill() {},
        stroke() {},
        fillText(text, x, y) {
            labels.push({ text, x, y });
        },
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    };

    app.drawCombatResolutionOverlays(ctx);

    assert.equal(labels.length, 1);
    assert.equal(labels[0].text, '5 vs 2');
});

test('render draws combat summaries after units', () => {
    const app = createAppHarness({
        state: {
            combatResolution: {
                phase: 'shooting',
                participantIds: new Set(),
                destroyedIds: new Set(),
                ghostSnapshot: {},
                movedUnitIds: [],
                results: []
            }
        }
    });
    const order = [];
    app.canvas.getBoundingClientRect = () => ({ width: 800, height: 600 });
    app.ctx = {
        clearRect() {},
        save() {},
        restore() {},
        translate() {},
        scale() {}
    };
    app.syncCanvasResolution = () => {};
    app.drawBoard = () => order.push('board');
    app.drawTerrain = () => order.push('terrain');
    app.drawGhostUnits = () => order.push('ghosts');
    app.drawShootingOverlays = () => order.push('shooting');
    app.drawUnits = () => order.push('units');
    app.drawSelectionHandles = () => order.push('handles');
    app.drawCombatResolutionOverlays = () => order.push('combat');

    app.render();

    assert.ok(order.indexOf('combat') > order.indexOf('units'));
});

test('logCombatResults includes modifiers, rolls, and outcome details', () => {
    const app = createAppHarness();
    const previousConsole = global.console;
    const calls = [];
    global.console = {
        ...previousConsole,
        groupCollapsed(message) {
            calls.push(['group', message]);
        },
        log(message) {
            calls.push(['log', message]);
        },
        groupEnd() {
            calls.push(['end']);
        },
        info(message) {
            calls.push(['info', message]);
        }
    };

    try {
        app.logCombatResults({
            units: [{ id: 'u1', side: 'blue', type: 'Shooter' }, { id: 'u3', side: 'blue', type: 'Shooter' }],
            destroyedUnits: [{ id: 'u2', side: 'red', type: 'Blade' }],
            recoilDestructions: [{ unitId: 'u2', reason: 'recoil path enters water' }],
            results: [{
                primaryAttackerId: 'u1',
                defenderId: 'u2',
                attackerIds: ['u1', 'u3'],
                attackerRoll: 4,
                defenderRoll: 2,
                attackerModifiers: [{ id: 'multiple-shooters', value: -1 }],
                defenderModifiers: [{ id: 'bad-going', value: -2 }],
                attackerTotal: 7,
                defenderTotal: 3,
                loserId: 'u2',
                outcome: 'destroy',
                destructionRule: 'Double total destroys the loser.'
            }]
        }, 'shooting');
    } finally {
        global.console = previousConsole;
    }

    const detailLog = calls.find((entry) => entry[0] === 'log')[1];
    assert.ok(detailLog.includes('Blue Shooter u1, Blue Shooter u3 vs Red Blade u2'));
    assert.ok(detailLog.includes('Blue roll 4'));
    assert.ok(detailLog.includes('Blue modifiers multiple-shooters -1'));
    assert.ok(detailLog.includes('Red roll 2'));
    assert.ok(detailLog.includes('Red modifiers bad-going -2'));
    assert.ok(detailLog.includes('totals 7 vs 3'));
    assert.ok(detailLog.includes('result destroy (Red Blade u2)'));
    assert.ok(detailLog.includes('rule Double total destroys the loser.'));
    const recoilLog = calls.filter((entry) => entry[0] === 'log').map((entry) => entry[1]).find((entry) => entry.includes('recoil destruction:'));
    assert.ok(recoilLog.includes('Red Blade u2'));
    assert.ok(recoilLog.includes('reason recoil path enters water'));
});

test('unit deployment initialization uses defender-first order and quarter assignments', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'terrain-placement',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.adjustArmyUnit('player-2', 'Spear', 2);
    const terrain = app.initializeTerrainPlacement(() => 0);
    app.initializeUnitDeployment();

    const deployment = app.getDeploymentSetup();
    assert.equal(deployment.activePlayerId, terrain.defenderPlayerId);
    assert.equal(deployment.zoneByPlayerId[terrain.defenderPlayerId], 'bottom');
    assert.equal(deployment.zoneByPlayerId[app.getOpponentPlayerId(terrain.defenderPlayerId)], 'top');
});

test('deployment creates units from tray drafts and enforces defender then attacker order', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 1);
    app.adjustArmyUnit('player-2', 'Spear', 1);
    const deployment = app.initializeUnitDeployment();

    const defenderDraftId = deployment.tray.find((entry) => entry.playerId === 'player-1').draftId;
    app.selectDeploymentTrayUnit(defenderDraftId);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 300, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 300, clientY: 550 });

    assert.equal(app.state.units.length, 1);
    assert.equal(app.state.units[0].playerId, 'player-1');
    assert.equal(app.state.units[0].type, 'Blade');
    assert.equal(app.canFinishDeploymentTurn(), true);

    app.finishDeploymentTurn();
    assert.equal(deployment.activePlayerId, 'player-2');
    assert.equal(app.canFinishDeploymentTurn(), false);
});

test('deployment rejects invalid zone placement and rotated footprint outside quarter', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 1);
    app.initializeUnitDeployment();
    const draftId = app.getDeploymentSetup().tray[0].draftId;

    app.selectDeploymentTrayUnit(draftId);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 300, clientY: 300 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 300, clientY: 300 });
    assert.equal(app.state.units.length, 0);

    const rotated = data.createUnit('Blade', 'player-1', 'Panda', {
        x: 280,
        y: 430,
        rotation: Math.PI / 2
    }, () => 'rotated-1');
    assert.equal(app.isUnitPlacementInZone(rotated, 'player-1'), false);
});

test('deployment rejects overlap and restores moved unit position on invalid move', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.initializeUnitDeployment();
    const trayIds = app.getDeploymentSetup().tray.map((entry) => entry.draftId);

    app.selectDeploymentTrayUnit(trayIds[0]);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 260, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 260, clientY: 550 });
    app.selectDeploymentTrayUnit(trayIds[1]);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 340, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 340, clientY: 550 });

    const [first, second] = app.state.units;
    const originalSecond = { x: second.x, y: second.y };
    app.onDeploymentPointerDown({ pointerId: 3, clientX: second.x, clientY: second.y });
    app.onDeploymentPointerMove({ pointerId: 3, clientX: first.x, clientY: first.y });
    app.onDeploymentPointerUp({ pointerId: 3, clientX: first.x, clientY: first.y });

    assert.equal(Math.round(second.x), Math.round(originalSecond.x));
    assert.equal(Math.round(second.y), Math.round(originalSecond.y));
});

test('deployment snaps tray units and releases capture after blank canvas clicks', () => {
    const capturedPointers = new Set();
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            }
        },
        ui: {
            deploymentCanvas: {
                setPointerCapture(pointerId) { capturedPointers.add(pointerId); },
                hasPointerCapture(pointerId) { return capturedPointers.has(pointerId); },
                releasePointerCapture(pointerId) { capturedPointers.delete(pointerId); },
                getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 600 }; },
                clientWidth: 600,
                clientHeight: 600,
                width: 600,
                height: 600
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.initializeUnitDeployment();
    const [firstDraftId, secondDraftId] = app.getDeploymentSetup().tray.map((entry) => entry.draftId);

    app.onDeploymentPointerDown({ pointerId: 1, clientX: 100, clientY: 400 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 100, clientY: 400 });
    assert.equal(capturedPointers.size, 0);

    app.selectDeploymentTrayUnit(firstDraftId);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 260, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 260, clientY: 550 });
    app.selectDeploymentTrayUnit(secondDraftId);
    app.onDeploymentPointerDown({ pointerId: 3, clientX: 304, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 3, clientX: 304, clientY: 550 });

    assert.equal(app.state.units.length, 2);
    assert.equal(Math.round(app.state.units[1].x), Math.round(app.state.units[0].x + app.state.units[0].width));
});

test('deployment handoff enters game mode with defender as active player and rolled moves', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 1);
    app.adjustArmyUnit('player-2', 'Spear', 1);
    app.initializeUnitDeployment();
    app.rollDie = () => 5;

    let defenderDraftId = app.getDeploymentSetup().tray.find((entry) => entry.playerId === 'player-1').draftId;
    app.selectDeploymentTrayUnit(defenderDraftId);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 300, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 300, clientY: 550 });
    app.finishDeploymentTurn();

    const attackerDraftId = app.getDeploymentSetup().tray.find((entry) => entry.playerId === 'player-2').draftId;
    app.selectDeploymentTrayUnit(attackerDraftId);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 300, clientY: 70 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 300, clientY: 70 });
    app.finishDeploymentTurn();

    assert.equal(app.state.setupStage, 'game');
    assert.equal(app.state.mode, 'game');
    assert.equal(app.state.activePlayerId, 'player-1');
    assert.equal(app.state.phase, 'move');
    assert.equal(app.state.remainingMoves, 5);
    assert.deepEqual(app.state.losses, { 'player-1': [], 'player-2': [] });
});

test('getDeploymentMatchupScore favors likely attacker edges from the scored table', () => {
    assert.ok(data.getDeploymentMatchupScore('Knights', 'Shooter') > data.getDeploymentMatchupScore('Knights', 'Spear'));
    assert.ok(data.getDeploymentMatchupScore('Artillery', 'Behemoth') > 0);
});

test('auto deploy places the active player tray in legal same-type ranks and leaves units editable', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            },
            terrain: {
                roads: [],
                features: [
                    { kind: 'forest', cx: 160, cy: 520, rx: 50, ry: 40, wobble: 0.2 },
                    { kind: 'swamp', cx: 440, cy: 520, rx: 50, ry: 40, wobble: 0.2 }
                ]
            }
        }
    });
    app.ui.autoDeployButton = { disabled: false };
    app.adjustArmyUnit('player-1', 'Blade', 5);
    app.adjustArmyUnit('player-1', 'Warband', 2);
    app.adjustArmyUnit('player-1', 'Shooter', 2);
    app.adjustArmyUnit('player-2', 'Spear', 2);
    app.initializeUnitDeployment();

    app.autoDeployActiveArmy();

    const deployment = app.getDeploymentSetup();
    const playerOneUnits = app.state.units.filter((unit) => unit.playerId === 'player-1');
    assert.equal(playerOneUnits.length, 9);
    assert.equal(deployment.tray.filter((entry) => entry.playerId === 'player-1').length, 0);
    assert.equal(app.canFinishDeploymentTurn(), true);
    playerOneUnits.forEach((unit) => {
        assert.equal(app.isUnitPlacementInZone(unit, 'player-1'), true);
        assert.equal(app.findDeploymentOverlap(unit, unit.id), null);
    });

    const bladeRanks = playerOneUnits.filter((unit) => unit.type === 'Blade');
    assert.equal(bladeRanks.length, 5);
    const forward = geometry.getForwardVector(0);
    const bladeGroups = [];
    bladeRanks.forEach((unit) => {
        const front = app.getUnitFrontCenter(unit);
        const frontDepth = geometry.dot(front, forward);
        let group = bladeGroups.find((entry) => Math.abs(entry.frontDepth - frontDepth) < 0.5);
        if (!group) {
            group = { frontDepth, fronts: [] };
            bladeGroups.push(group);
        }
        group.fronts.push(front);
    });
    assert.ok(bladeGroups.some((group) => group.fronts.length > 1));
    bladeGroups.filter((group) => group.fronts.length > 1).forEach((group) => {
        const baseline = group.frontDepth;
        group.fronts.forEach((front) => {
            assert.ok(Math.abs(geometry.dot(front, forward) - baseline) < 0.01);
        });
    });

    const moved = playerOneUnits[0];
    const originalX = moved.x;
    moved.x += 12;
    assert.notEqual(moved.x, originalX);
});

test('auto deploy spreads line troops laterally instead of stacking files', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            },
            terrain: { roads: [], features: [] }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 8);
    app.adjustArmyUnit('player-2', 'Spear', 2);
    app.initializeUnitDeployment();
    app.autoDeployActiveArmy();

    const blades = app.state.units.filter((unit) => unit.playerId === 'player-1' && unit.type === 'Blade');
    assert.equal(blades.length, 8);
    const fronts = blades.map((unit) => app.getUnitFrontCenter(unit));
    const xs = fronts.map((front) => front.x).sort((left, right) => left - right);
    assert.ok(xs[xs.length - 1] - xs[0] >= 200);

    const forward = geometry.getForwardVector(0);
    const depths = fronts.map((front) => geometry.dot(front, forward));
    const depthSpan = Math.max(...depths) - Math.min(...depths);
    assert.ok(depthSpan < 50);
});

test('auto deploy keeps good-going troops off lanes with bad going, water, or impassable ahead', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            },
            terrain: {
                roads: [],
                features: [
                    { kind: 'forest', cx: 300, cy: 390, rx: 70, ry: 50, wobble: 0.18 },
                    { kind: 'water', cx: 300, cy: 300, rx: 60, ry: 40, wobble: 0.16 },
                    { kind: 'impassable', cx: 80, cy: 390, rx: 40, ry: 36, wobble: 0.14 }
                ]
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 4);
    app.adjustArmyUnit('player-2', 'Spear', 2);
    app.initializeUnitDeployment();
    app.autoDeployActiveArmy();

    const blades = app.state.units.filter((unit) => unit.playerId === 'player-1' && unit.type === 'Blade');
    assert.equal(blades.length, 4);
    blades.forEach((unit) => {
        const hits = app.collectFrontCorridorHits(unit);
        assert.equal(hits.water, 0);
        assert.equal(hits.impassable, 0);
        assert.equal(hits.forest + hits.swamp, 0);
    });
});

test('attacker auto deploy uses the enemy line for matchup-biased placement', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            },
            terrain: { roads: [], features: [] }
        }
    });
    app.adjustArmyUnit('player-1', 'Shooter', 3);
    app.adjustArmyUnit('player-2', 'Knights', 3);
    app.initializeUnitDeployment();
    app.autoDeployActiveArmy();
    app.finishDeploymentTurn();

    assert.equal(app.getDeploymentSetup().activePlayerId, 'player-2');
    app.autoDeployActiveArmy();

    const knights = app.state.units.filter((unit) => unit.playerId === 'player-2' && unit.type === 'Knights');
    const shooters = app.state.units.filter((unit) => unit.playerId === 'player-1' && unit.type === 'Shooter');
    assert.equal(knights.length, 3);
    assert.equal(shooters.length, 3);
    const shooterMean = shooters.reduce((sum, unit) => sum + geometry.getUnitCenter(unit).x, 0) / shooters.length;
    const knightMean = knights.reduce((sum, unit) => sum + geometry.getUnitCenter(unit).x, 0) / knights.length;
    assert.ok(Math.abs(knightMean - shooterMean) < 160);
});
