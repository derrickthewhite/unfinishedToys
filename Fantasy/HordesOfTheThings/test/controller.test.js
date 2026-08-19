const test = require('node:test');
const assert = require('node:assert/strict');

const {
    HordesPrototype,
    data,
    createBlade,
    createAppHarness,
    rules
} = require('./harness.js');
const shootingAi = require('../src/ai/shooting.js');

function wireDraftValidation(app) {
    app.evaluateDraft = function evaluateDraft() {
        const draft = this.state.draft;
        if (!draft) {
            return;
        }
        const result = rules.validateDraftState(draft, this.state.units, this.state.terrain);
        draft.invalidIds = result.invalidIds;
        draft.reasonById = result.reasonById;
        draft.cornerViolations = result.cornerViolations;
    };
}

function createShooter(id, x, y, playerId = 'player-1') {
    return {
        ...createBlade(id, x, y, playerId),
        type: 'Shooter',
        ranged: { phase: 'shooting', range: 50, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
}

test('controller helpers distinguish local, computer, and remote players', () => {
    const app = createAppHarness();
    app.state.players['player-1'].controller = 'local';
    app.state.players['player-2'].controller = 'computer';

    assert.equal(app.getController('player-1'), 'local');
    assert.equal(app.isLocalPlayer('player-1'), true);
    assert.equal(app.canLocallyControl('player-1'), true);
    assert.equal(app.isComputerPlayer('player-2'), true);
    assert.equal(app.canLocallyControl('player-2'), false);
    assert.equal(app.hasLocalHuman(), true);
    assert.equal(app.isComputerMatch(), false);

    app.state.players['player-1'].controller = 'computer';
    assert.equal(app.hasLocalHuman(), false);
    assert.equal(app.isComputerMatch(), true);

    app.state.players['player-2'].controller = 'remote';
    assert.equal(app.isRemotePlayer('player-2'), true);
    assert.equal(data.normalizeController('nope'), 'local');
});

test('getPendingControllerDecision is idle for local play and paused computers', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'game',
            mode: 'game',
            phase: 'move',
            controllerPaused: false
        }
    });

    assert.equal(app.getPendingControllerDecision(), null);

    app.state.players['player-1'].controller = 'computer';
    assert.deepEqual(app.getPendingControllerDecision(), { kind: 'move', playerId: 'player-1' });

    app.state.controllerPaused = true;
    assert.equal(app.getPendingControllerDecision(), null);
});

test('computer vs computer auto-acks combat aftermath; mixed matches still wait', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'game',
            mode: 'game',
            phase: 'shooting',
            combatResolution: { phase: 'shooting', participantIds: new Set() }
        }
    });
    app.state.players['player-1'].controller = 'computer';
    app.state.players['player-2'].controller = 'local';
    assert.equal(app.getPendingControllerDecision(), null);

    app.state.players['player-2'].controller = 'computer';
    assert.deepEqual(app.getPendingControllerDecision(), { kind: 'ack-combat', playerId: 'player-1' });
});

test('random army identity resolves without color or faction clashes', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'army-builder',
            setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null }
        }
    });
    app.state.players['player-1'].colorId = data.RANDOM_IDENTITY;
    app.state.players['player-1'].faction = data.RANDOM_IDENTITY;
    app.state.players['player-2'].colorId = data.RANDOM_IDENTITY;
    app.state.players['player-2'].faction = data.RANDOM_IDENTITY;
    app.setArmyRandom('player-1', true);
    app.setArmyRandom('player-2', true);

    assert.equal(app.getArmyIdentityConflict(), null);
    assert.equal(app.canAcceptArmies(), true);

    app.resolveRandomArmySetup(() => 0);

    assert.notEqual(app.state.players['player-1'].colorId, data.RANDOM_IDENTITY);
    assert.notEqual(app.state.players['player-2'].colorId, data.RANDOM_IDENTITY);
    assert.notEqual(app.state.players['player-1'].colorId, app.state.players['player-2'].colorId);
    assert.notEqual(app.state.players['player-1'].faction, app.state.players['player-2'].faction);
    assert.equal(app.getArmyValue('player-1'), data.ARMY_POINT_TARGET);
    assert.equal(app.getArmyValue('player-2'), data.ARMY_POINT_TARGET);
    assert.equal(app.isArmyRandom('player-1'), false);
    assert.equal(app.getArmyIdentityConflict(), null);
});

test('handleShootingClick rejects computer-owned shooters even on their turn', () => {
    const shooter = createShooter('s1', 100, 220, 'player-2');
    const target = createBlade('t1', 100, 170, 'player-1');
    const app = createAppHarness({
        state: {
            setupStage: 'game',
            activePlayerId: 'player-2',
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] },
            shooting: { focusedAttackerId: null, validTargetIds: [], attacksByAttacker: {} }
        }
    });
    app.state.players['player-2'].controller = 'computer';

    app.handleShootingClick(shooter);

    assert.equal(app.state.shooting.focusedAttackerId, null);
    assert.match(app.lastStatus, /your own units/);
});

test('handleShootingClick still allows a local shooter on the opposing turn', () => {
    const shooter = createShooter('s1', 100, 220, 'player-1');
    const target = { ...createBlade('t1', 100, 170), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            setupStage: 'game',
            activePlayerId: 'player-2',
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] },
            shooting: { focusedAttackerId: null, validTargetIds: [], attacksByAttacker: {} }
        }
    });
    app.state.players['player-2'].controller = 'computer';

    app.handleShootingClick(shooter);

    assert.equal(app.state.shooting.focusedAttackerId, 's1');
    assert.deepEqual(app.state.shooting.validTargetIds, ['t1']);
});

test('computer move applies a draft in an all-computer match', async () => {
    const units = [
        createBlade('u1', 100, 130),
        createBlade('u2', 140, 130),
        createBlade('u3', 400, 580),
        { ...createBlade('r1', 400, 100, 'player-2') }
    ];
    const app = createAppHarness({
        state: {
            setupStage: 'game',
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            remainingMoves: 3,
            units,
            terrain: { roads: [], features: [] },
            homeEdgeByPlayerId: { 'player-1': 'bottom', 'player-2': 'top' }
        }
    });
    app.state.players['player-1'].controller = 'computer';
    app.state.players['player-2'].controller = 'computer';
    app._skipControllerDelay = true;
    app.resetControllerRuntime();
    wireDraftValidation(app);
    const startY = units[2].y;

    const result = await app.playComputerMove();

    assert.equal(result, 'moved');
    assert.equal(units[2].movedThisTurn, true);
    assert.ok(units[2].y < startY);
});

test('computer move with no useful action ends the move phase', async () => {
    const app = createAppHarness({
        state: {
            setupStage: 'game',
            mode: 'game',
            phase: 'move',
            remainingMoves: 3,
            units: [],
            terrain: { roads: [], features: [] }
        }
    });
    app.state.players['player-1'].controller = 'computer';
    app._skipControllerDelay = true;
    app.resetControllerRuntime();

    const result = await app.playComputerMove();
    assert.equal(result, 'end-phase');

    app.endMovePhase();
    assert.notEqual(app.state.phase, 'move');
});

test('driver stays idle when the active side is local', async () => {
    const app = createAppHarness({
        state: {
            setupStage: 'game',
            mode: 'game',
            phase: 'move'
        }
    });
    app._skipControllerDelay = true;
    let acted = false;
    app.performComputerDecision = async () => {
        acted = true;
    };
    await app.runPendingControllerAction();
    assert.equal(acted, false);
});

test('shooting AI picks a valid high-value target', () => {
    const shooter = createShooter('s1', 100, 220, 'player-1');
    const horde = {
        ...createBlade('h1', 100, 170, 'player-2'),
        type: 'Horde',
        value: 1,
        rotation: Math.PI
    };
    const hero = {
        ...createBlade('r1', 80, 170, 'player-2'),
        type: 'Hero',
        value: 4,
        rotation: Math.PI
    };
    const targetId = shootingAi.pickBestShootingTarget(
        shooter,
        [shooter, horde, hero],
        { roads: [], features: [] },
        'player-1'
    );
    assert.equal(targetId, 'r1');
});
