const test = require('node:test');
const assert = require('node:assert/strict');
const { HordesPrototype, createAppHarness, createBlade, createStorage } = require('./harness.js');

const CHECKPOINT_KEY = 'hordes-of-the-things-checkpoints';

function withStorage(run) {
    const previousWindow = global.window;
    const storage = createStorage();
    global.window = { localStorage: storage };
    try {
        run(storage);
    } finally {
        global.window = previousWindow;
    }
}

function checkpointButtons() {
    return {
        checkpointGameStartButton: { disabled: true },
        checkpointGameStartHint: { textContent: '' },
        checkpointLastTurnButton: { disabled: true },
        checkpointLastTurnHint: { textContent: '' },
        checkpointEndMoveButton: { disabled: true },
        checkpointEndMoveHint: { textContent: '' },
        gameSettingsModal: { hidden: false }
    };
}

function battleApp(extraState = {}, extraUi = {}) {
    const app = createAppHarness({
        state: {
            mode: 'game',
            setupStage: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            remainingMoves: 4,
            ...extraState
        },
        ui: {
            ...checkpointButtons(),
            ...extraUi
        }
    });
    app.scheduleControllerAction = () => {
        app.controllerScheduled = true;
    };
    app.rollDie = () => 3;
    return app;
}

function readCheckpoints(storage) {
    return JSON.parse(storage.getItem(CHECKPOINT_KEY));
}

function deployOne(app, playerId, pointerId, clientY) {
    const trayEntry = app.getDeploymentSetup().tray.find((entry) => entry.playerId === playerId);
    app.selectDeploymentTrayUnit(trayEntry.draftId);
    app.onDeploymentPointerDown({ pointerId, clientX: 260, clientY });
    app.onDeploymentPointerUp({ pointerId, clientX: 260, clientY });
}

test('deployment stores the game start and the first local turn', () => {
    withStorage((storage) => {
        const app = battleApp({
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            },
            terrain: { roads: [], features: [] }
        });
        app.state.players['player-1'].controller = 'local';
        app.state.players['player-2'].controller = 'local';
        app.rollDie = () => 5;
        app.adjustArmyUnit('player-1', 'Blade', 1);
        app.adjustArmyUnit('player-2', 'Spear', 1);
        app.initializeUnitDeployment();
        deployOne(app, 'player-1', 1, 550);
        app.finishDeploymentTurn();
        deployOne(app, 'player-2', 2, 80);
        app.finishDeploymentTurn();

        const checkpoints = readCheckpoints(storage);
        assert.equal(checkpoints.gameStart.snapshot.setupStage, 'game');
        assert.equal(checkpoints.gameStart.snapshot.phase, 'move');
        assert.equal(checkpoints.gameStart.snapshot.activePlayerId, 'player-1');
        assert.equal(checkpoints.gameStart.snapshot.remainingMoves, 5);
        assert.equal(checkpoints.gameStart.snapshot.units.length, 2);
        assert.equal(checkpoints.lastTurn.snapshot.remainingMoves, 5);
        assert.equal(checkpoints.lastTurn.snapshot.activePlayerId, 'player-1');
        assert.equal(checkpoints.endMove, null);
        assert.equal(storage.getItem('hordes-of-the-things-saves'), null);
    });
});

test('a computer opening turn does not fill the last-turn checkpoint', () => {
    withStorage((storage) => {
        const app = battleApp({
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            },
            terrain: { roads: [], features: [] }
        });
        app.state.players['player-1'].controller = 'local';
        app.state.players['player-2'].controller = 'local';
        app.adjustArmyUnit('player-1', 'Blade', 1);
        app.adjustArmyUnit('player-2', 'Spear', 1);
        app.initializeUnitDeployment();
        deployOne(app, 'player-1', 1, 550);
        app.finishDeploymentTurn();
        deployOne(app, 'player-2', 2, 80);
        app.state.players['player-1'].controller = 'computer';
        app.state.controllerPaused = true;
        app.finishDeploymentTurn();

        const checkpoints = readCheckpoints(storage);
        assert.equal(checkpoints.gameStart.snapshot.activePlayerId, 'player-1');
        assert.equal(checkpoints.lastTurn, null);
    });
});

test('later computer turns leave the local last-turn checkpoint in place', () => {
    withStorage((storage) => {
        const app = battleApp({ activePlayerId: 'player-2', phase: 'melee' });
        app.state.players['player-2'].controller = 'computer';
        app.advanceToNextTurn();

        let checkpoints = readCheckpoints(storage);
        assert.equal(checkpoints.lastTurn.snapshot.activePlayerId, 'player-1');
        assert.equal(checkpoints.lastTurn.snapshot.remainingMoves, 3);
        assert.equal(checkpoints.lastTurn.snapshot.phase, 'move');
        const savedAt = checkpoints.lastTurn.savedAt;

        app.rollDie = () => 6;
        app.advanceToNextTurn();
        checkpoints = readCheckpoints(storage);
        assert.equal(app.state.activePlayerId, 'player-2');
        assert.equal(checkpoints.lastTurn.snapshot.activePlayerId, 'player-1');
        assert.equal(checkpoints.lastTurn.snapshot.remainingMoves, 3);
        assert.equal(checkpoints.lastTurn.savedAt, savedAt);
    });
});

test('ending the move phase snapshots positions before form-up', () => {
    withStorage((storage) => {
        const app = battleApp();
        const blue = createBlade('b1', 100, 240);
        const red = createBlade('r1', 100, 220, 'player-2');
        red.rotation = Math.PI;
        app.state.units = [blue, red];
        app.endMovePhase();

        const checkpoints = readCheckpoints(storage);
        const savedBlue = checkpoints.endMove.snapshot.units.find((unit) => unit.id === 'b1');
        const liveBlue = app.state.units.find((unit) => unit.id === 'b1');
        assert.equal(checkpoints.endMove.snapshot.phase, 'move');
        assert.equal(savedBlue.y, 240);
        assert.notEqual(liveBlue.y, 240);
        assert.equal(checkpoints.endMove.id, 'checkpoint-end-move');

        app.state.phase = 'move';
        app.state.activePlayerId = 'player-2';
        app.state.players['player-2'].controller = 'computer';
        app.state.units = [createBlade('later', 20, 20, 'player-2')];
        app.beginFormUpPhase();
        const overwritten = readCheckpoints(storage);
        assert.equal(overwritten.endMove.snapshot.units[0].id, 'later');
        assert.equal(overwritten.lastTurn, null);
    });
});

test('checkpoint buttons load that snapshot and stay out of the save list', () => {
    withStorage((storage) => {
        const app = battleApp({ units: [createBlade('unit-1', 80, 80)], remainingMoves: 2 });
        app.state.gameSettingsModalOpen = true;
        app.captureGameStartCheckpoint();
        app.captureLocalTurnCheckpoint();
        app.renderCheckpointSettings();

        assert.equal(app.ui.checkpointGameStartButton.disabled, false);
        assert.equal(app.ui.checkpointLastTurnButton.disabled, false);
        assert.equal(app.ui.checkpointEndMoveButton.disabled, true);
        assert.match(app.ui.checkpointGameStartHint.textContent, /Blue/);
        assert.match(app.ui.checkpointGameStartHint.textContent, /2 moves/);
        assert.equal(app.ui.checkpointEndMoveHint.textContent, 'Not saved yet.');

        const savedAt = readCheckpoints(storage).gameStart.savedAt;
        app.state.units[0].x = 400;
        app.state.remainingMoves = 0;
        app.loadCheckpoint('gameStart');

        assert.equal(app.state.units[0].x, 80);
        assert.equal(app.state.remainingMoves, 2);
        assert.equal(app.state.gameSettingsModalOpen, false);
        assert.equal(app.ui.gameSettingsModal.hidden, true);
        assert.equal(app.state.storageModalOpen, false);
        assert.equal(app.state.controllerPaused, false);
        assert.equal(app.lastStatus, 'Returned to Start of game.');
        assert.equal(readCheckpoints(storage).gameStart.savedAt, savedAt);
        assert.equal(storage.getItem('hordes-of-the-things-saves'), null);
        assert.equal(app.getStorageRecords().length, 0);

        app.loadCheckpoint('endMove');
        assert.equal(app.lastStatus, 'That checkpoint has not been saved yet.');
        assert.equal(app.state.units[0].x, 80);
    });
});

test('loading a computer checkpoint pauses the computer on that position', () => {
    withStorage(() => {
        const app = battleApp({
            activePlayerId: 'player-2',
            units: [createBlade('cpu', 30, 30, 'player-2')]
        });
        app.state.players['player-2'].controller = 'computer';
        app.captureEndMoveCheckpoint();
        app.state.units = [];
        app.loadCheckpoint('endMove');

        assert.equal(app.state.units[0].id, 'cpu');
        assert.equal(app.state.activePlayerId, 'player-2');
        assert.equal(app.state.controllerPaused, true);
        assert.equal(app.lastStatus, 'Returned to End of move. Computer paused.');
    });
});
