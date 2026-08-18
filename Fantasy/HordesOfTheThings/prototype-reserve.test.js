const test = require('node:test');
const assert = require('node:assert/strict');

const data = require('./prototype-data.js');
const geometry = require('./prototype-geometry.js');
const { createAppHarness, createStorage } = require('./prototype-test-harness.js');

function withLiveDraftValidation(app) {
    delete app.evaluateDraft;
    return app;
}

function createHorde(id, playerId, x, y, rotation = 0) {
    return data.createUnit('Horde', playerId, 'Undead', { x, y, rotation }, () => id);
}

test('reserve lots sit beside the board and can hold 24 hordes', () => {
    const app = createAppHarness();
    const size = app.getReserveRectSize();
    const bottom = app.getReserveRect('player-1');
    const top = app.getReserveRect('player-2');

    assert.equal(data.RESERVE_COLUMNS * data.RESERVE_ROWS, 24);
    assert.ok(size.width >= 240);
    assert.ok(size.height >= 160);
    assert.ok(bottom.left + bottom.width <= 0);
    assert.equal(bottom.top + bottom.height, data.BOARD_SIZE);
    assert.equal(top.top, 0);
    assert.equal(app.getHomeEdge('player-1'), 'bottom');
    assert.equal(app.getHomeEdge('player-2'), 'top');
});

test('destroyed hordes go to reserve after acknowledge and count as losses until they return', () => {
    const horde = createHorde('h1', 'player-1', 120, 560);
    const destroyedBlade = data.createUnit('Blade', 'player-1', 'Undead', { x: 200, y: 560, rotation: 0 }, () => 'b1');
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'melee',
            remainingMoves: 3,
            units: [],
            combatResolution: {
                recycledUnits: [horde],
                destroyedIds: new Set(['h1', 'b1'])
            }
        }
    }));
    app.recordLosses([horde, destroyedBlade]);
    app.acknowledgePhase();

    assert.equal(app.state.units.some((unit) => unit.id === 'h1'), false);
    assert.equal(app.isUnitInReserve('h1'), true);
    assert.equal(app.getLossSummary('player-1').points, 3);
    assert.match(app.getLossSummary('player-1').title, /Horde \(1\) in reserve/);
    assert.equal(app.state.combatResolution, null);
});

test('blades stay destroyed instead of entering reserve', () => {
    const blade = data.createUnit('Blade', 'player-1', 'Undead', { x: 200, y: 560, rotation: 0 }, () => 'b1');
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'melee',
            combatResolution: {
                recycledUnits: [],
                destroyedIds: new Set(['b1'])
            }
        }
    }));
    app.recordLosses([blade]);
    app.acknowledgePhase();

    assert.equal(app.isUnitInReserve('b1'), false);
    assert.equal(app.getLossSummary('player-1').points, 2);
});

test('reserve deploy spends a move, locks to the home edge, and clears the loss', () => {
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 2,
            units: [],
            losses: { 'player-1': [{ id: 'h1', type: 'Horde', value: 1 }], 'player-2': [] }
        }
    }));
    const reserved = app.sendUnitToReserve(createHorde('h1', 'player-1', 120, 560));
    assert.ok(reserved.inReserve);

    const started = app.beginReserveDeploy(reserved, 300);
    assert.equal(started, true);
    assert.equal(app.isReserveDeployDraft(), true);
    assert.equal(app.isUnitInReserve('h1'), false);

    const live = app.getUnitById('h1');
    assert.equal(live.rotation, 0);
    assert.equal(live.y, data.BOARD_SIZE - live.depth);
    assert.equal(app.state.draft.invalidIds.size, 0);

    app.finishDraft();
    const deployed = app.getUnitById('h1');
    assert.equal(app.state.remainingMoves, 1);
    assert.equal(deployed.movedThisTurn, true);
    assert.equal(app.isUnitInReserve('h1'), false);
    assert.equal(app.getLossSummary('player-1').points, 0);
    assert.equal(app.state.draft, null);
});

test('reserve deploy is illegal within 200 paces of an enemy', () => {
    const enemy = data.createUnit('Blade', 'player-2', 'Panda', { x: 330, y: data.BOARD_SIZE - 20, rotation: 0 }, () => 'e1');
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 2,
            units: [enemy]
        }
    }));
    const reserved = app.sendUnitToReserve(createHorde('h1', 'player-1', 120, 560));
    app.beginReserveDeploy(reserved, 300);

    assert.equal(app.state.draft.invalidIds.has('h1'), true);
    assert.match(app.state.draft.reasonById.get('h1'), /200 paces/);

    app.applyReserveDeployPose(app.getUnitById('h1'), 'player-1', 40);
    app.evaluateDraft();
    assert.equal(app.state.draft.invalidIds.size, 0);
});

test('cancelling reserve deploy returns the horde to the lot instead of sliding it there', () => {
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 2,
            units: []
        }
    }));
    const reserved = app.sendUnitToReserve(createHorde('h1', 'player-1', 120, 560));
    const slot = { x: reserved.x, y: reserved.y, rotation: reserved.rotation };
    app.beginReserveDeploy(reserved, 220);
    app.cancelDraft(true);

    assert.equal(app.isUnitInReserve('h1'), true);
    assert.equal(app.state.units.some((unit) => unit.id === 'h1'), false);
    const restored = app.getUnitById('h1');
    assert.equal(restored.x, slot.x);
    assert.equal(restored.y, slot.y);
    assert.equal(app.state.draft, null);
});

test('reserve units are not dragged around the lot', () => {
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 2,
            units: []
        }
    }));
    const reserved = app.sendUnitToReserve(createHorde('h1', 'player-1', 120, 560));
    const world = geometry.getUnitCenter(reserved);
    app.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 600 });
    app.screenToWorld = () => world;

    app.onPointerDown({
        pointerId: 1,
        button: 0,
        clientX: 0,
        clientY: 0,
        shiftKey: false
    });

    assert.equal(app.isReserveDeployDraft(), true);
    assert.equal(app.isUnitInReserve('h1'), false);
    const live = app.getUnitById('h1');
    assert.ok(live.y >= data.BOARD_SIZE - live.depth - 0.5);
    assert.ok(live.x >= 0);
});

test('saved games restore reserve units and home edges', () => {
    const app = createAppHarness();
    app.settingsStorage = createStorage();
    app.storage = createStorage();
    app.getStorageRecords = function () {
        return this._records || [];
    };
    app.writeStorageRecords = function (records) {
        this._records = records;
        return true;
    };
    app.renderStorageList = () => {};
    app.closeStorageModal = () => {};
    app.ui.storageNameInput.value = 'reserve-save';

    const reserved = app.sendUnitToReserve(createHorde('h1', 'player-1', 120, 560));
    app.state.homeEdgeByPlayerId = { 'player-1': 'bottom', 'player-2': 'top' };
    app.state.setupStage = 'game';
    app.saveCurrentGame();

    app.state.reserveUnits = [];
    app.state.homeEdgeByPlayerId = { 'player-1': 'top', 'player-2': 'bottom' };
    const recordId = app.getStorageRecords()[0].id;
    app.loadGame(recordId);

    assert.equal(app.isUnitInReserve('h1'), true);
    assert.equal(app.getUnitById('h1').type, 'Horde');
    assert.equal(app.state.homeEdgeByPlayerId['player-1'], 'bottom');
    assert.equal(app.getUnitById('h1').reserveSlot, reserved.reserveSlot);
});
