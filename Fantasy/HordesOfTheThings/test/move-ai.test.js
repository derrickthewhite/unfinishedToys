const test = require('node:test');
const assert = require('node:assert/strict');

const moveAi = require('../src/ai/move.js');
const {
    data,
    rules,
    createBlade,
    createAppHarness
} = require('./harness.js');

function getPlayerId(unit) {
    return unit.playerId;
}

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
    app.getSelectedUnits = function getSelectedUnits() {
        return this.state.selectedIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
    };
}

function createSpear(id, x, y, playerId = 'player-1') {
    return {
        id,
        type: 'Spear',
        playerId,
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
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
}

function createKnights(id, x, y, playerId = 'player-1') {
    return {
        id,
        type: 'Knights',
        playerId,
        width: 40,
        depth: 20,
        x,
        y,
        rotation: 0,
        movedThisTurn: false,
        troopClass: 'mounted',
        moves: { road: 150, good: 100, bad: 50, water: 25 },
        ranged: null,
        value: 3,
        strength: { infantry: 3, mounted: 5 },
        combat: { ignoresBadGoingPenalty: false }
    };
}

test('scoreFightQuality rewards stacked support and matchup on a new contact', () => {
    const terrain = createEmptyTerrain();
    const knights = {
        ...createKnights('r1', 140, 220, 'player-2'),
        rotation: Math.PI
    };
    const lead = createSpear('s1', 80, 220);
    const support = createSpear('s2', 40, 220);
    const before = [lead, support, knights];
    const after = [
        { ...lead, x: 100, y: 220 },
        { ...support, x: 60, y: 220 },
        knights
    ];
    const quality = moveAi.scoreFightQuality(before, after, 'player-1', terrain, ['s1', 's2']);
    assert.ok(quality.modifiers > 0);
    assert.ok(quality.matchup > 0);
    assert.ok(quality.newContact > 0);
});

test('scoreFormationSupport rewards dressing a straggler into an existing rank', () => {
    const terrain = createEmptyTerrain();
    const line = [
        createBlade('u1', 100, 400),
        createBlade('u2', 140, 400)
    ];
    const straggler = createBlade('u3', 100, 520);
    const before = [...line, straggler];
    const after = [
        ...line,
        { ...straggler, x: 180, y: 400 }
    ];
    const support = moveAi.scoreFormationSupport(
        before,
        after,
        'player-1',
        getPlayerId,
        ['u3'],
        terrain
    );
    assert.ok(support.dress > 0);
});

test('scoreFormationSupport penalizes breaking an existing stacked combat', () => {
    const terrain = createEmptyTerrain();
    const blade = {
        ...createBlade('r1', 140, 220),
        playerId: 'player-2',
        rotation: Math.PI
    };
    const front = createSpear('s1', 100, 220);
    const support = createSpear('s2', 60, 220);
    const before = [front, support, blade];
    const after = [
        { ...front, x: 100, y: 220 },
        { ...support, x: 20, y: 220 },
        blade
    ];
    const scored = moveAi.scoreFormationSupport(
        before,
        after,
        'player-1',
        getPlayerId,
        ['s2'],
        terrain
    );
    assert.ok(scored.stackBreak < 0);
});

test('scoreFightQuality penalizes shuffling an existing melee without improvement', () => {
    const terrain = createEmptyTerrain();
    const blade = {
        ...createBlade('r1', 140, 220),
        playerId: 'player-2',
        rotation: Math.PI
    };
    const spear = createSpear('s1', 100, 220);
    const before = [spear, blade];
    const after = [{ ...spear, x: 102, y: 220 }, blade];
    const quality = moveAi.scoreFightQuality(before, after, 'player-1', terrain, ['s1']);
    assert.ok(quality.newContact < 0);
});

test('collectMoveCandidateGroups includes singles and rank subsets, not only the largest rank', () => {
    const units = [
        createBlade('u1', 100, 400),
        createBlade('u2', 140, 400),
        createBlade('u3', 180, 400)
    ];
    const groups = moveAi.collectMoveCandidateGroups(units, 'player-1', getPlayerId);
    const keys = groups.map((group) => [...group.unitIds].sort().join(',')).sort();
    assert.ok(keys.includes('u1'));
    assert.ok(keys.includes('u2'));
    assert.ok(keys.includes('u3'));
    assert.ok(keys.includes('u1,u2'));
    assert.ok(keys.includes('u2,u3'));
    assert.ok(keys.includes('u1,u2,u3'));
    assert.equal(keys.filter((key) => key.includes('u1') && key.includes('u2') && !key.includes('u3')).length, 1);
});

function createEmptyTerrain() {
    return { roads: [], features: [] };
}

function createStragglerScenario() {
    return {
        terrain: createEmptyTerrain(),
        units: [
            createBlade('u1', 100, 130),
            createBlade('u2', 140, 130),
            createBlade('u3', 400, 580),
            { ...createBlade('r1', 400, 100, 'player-2') }
        ]
    };
}

test('scoreAdvance sums material moved toward the enemy instead of averaging move length', () => {
    const enemy = { ...createBlade('r1', 400, 100), playerId: 'player-2', rotation: Math.PI };
    const left = createBlade('u1', 100, 400);
    const middle = createBlade('u2', 140, 400);
    const right = createBlade('u3', 180, 400);
    const before = [left, middle, right, enemy];
    const afterSingle = [{ ...middle, y: 350 }, left, right, enemy];
    const afterRank = [
        { ...left, y: 350 },
        { ...middle, y: 350 },
        { ...right, y: 350 },
        enemy
    ];
    const single = moveAi.scoreAdvance(before, afterSingle, ['u2'], 'player-1', 'player-2', getPlayerId);
    const rank = moveAi.scoreAdvance(before, afterRank, ['u1', 'u2', 'u3'], 'player-1', 'player-2', getPlayerId);
    assert.ok(single > 0);
    assert.ok(Math.abs(rank - (single * 3)) < 0.05);
});

test('findBestAutoMove prefers moving a whole rank over peeling one unit from the middle', () => {
    const units = [
        createBlade('u1', 100, 400),
        createBlade('u2', 140, 400),
        createBlade('u3', 180, 400),
        { ...createBlade('r1', 140, 80), playerId: 'player-2', rotation: Math.PI }
    ];
    const suggestion = moveAi.findBestAutoMove({
        units,
        terrain: createEmptyTerrain(),
        activePlayerId: 'player-1',
        remainingMoves: 4,
        getPlayerId
    });
    assert.ok(suggestion);
    assert.deepEqual([...suggestion.unitIds].sort(), ['u1', 'u2', 'u3']);
});

test('findBestAutoMove can prefer a straggler single over a larger formation', () => {
    const { units, terrain } = createStragglerScenario();
    const suggestion = moveAi.findBestAutoMove({
        units,
        terrain,
        activePlayerId: 'player-1',
        remainingMoves: 4,
        getPlayerId
    });
    assert.ok(suggestion);
    assert.deepEqual(suggestion.unitIds, ['u3']);
    assert.ok(suggestion.distance > 0);
});

test('scoreRecoilRisk penalizes moving into a recoil death pinch', () => {
    const terrain = {
        roads: [],
        features: [{ kind: 'water', cx: 100, cy: 250, rx: 30, ry: 30, wobble: 0 }]
    };
    const enemy = {
        ...createBlade('e1', 140, 220),
        playerId: 'player-2',
        rotation: Math.PI
    };
    const before = [createBlade('u1', 100, 320), enemy];
    const after = [createBlade('u1', 100, 220), enemy];
    const risk = moveAi.scoreRecoilRisk(before, after, 'player-1', getPlayerId, ['u1'], terrain);
    assert.ok(risk.recoilDeath < 0);
});

test('collectExtendedMoveCandidates includes wheel and reserve redeploy options', () => {
    const units = [
        createBlade('u1', 100, 400),
        createBlade('u2', 140, 400)
    ];
    const reserveUnits = [{
        id: 'h1',
        type: 'Horde',
        playerId: 'player-1',
        width: 40,
        depth: 40,
        inReserve: true,
        troopClass: 'infantry',
        moves: { road: 400, good: 200, bad: 200, water: 100 },
        strength: { infantry: 2, mounted: 2 },
        combat: { ignoresBadGoingPenalty: false }
    }];
    const candidates = moveAi.collectExtendedMoveCandidates({
        units,
        terrain: createEmptyTerrain(),
        activePlayerId: 'player-1',
        remainingMoves: 2,
        getPlayerId,
        reserveUnits
    });
    assert.ok(candidates.some((candidate) => candidate.moveKind === 'wheel-left'));
    assert.ok(candidates.some((candidate) => candidate.moveKind === 'reserve-deploy'));
});

test('findBestAutoMove can prefer reserve redeploy when a Horde lot is available', () => {
    const units = [{ ...createBlade('r1', 50, 50), playerId: 'player-2', rotation: Math.PI }];
    const reserveUnits = [{
        id: 'h1',
        type: 'Horde',
        playerId: 'player-1',
        width: 40,
        depth: 40,
        inReserve: true,
        troopClass: 'infantry',
        moves: { road: 400, good: 200, bad: 200, water: 100 },
        strength: { infantry: 2, mounted: 2 },
        combat: { ignoresBadGoingPenalty: false }
    }];
    const suggestion = moveAi.findBestAutoMove({
        units,
        terrain: createEmptyTerrain(),
        activePlayerId: 'player-1',
        remainingMoves: 2,
        getPlayerId,
        reserveUnits,
        getHomeEdge: () => 'bottom'
    });
    assert.ok(suggestion);
    assert.equal(suggestion.moveKind, 'reserve-deploy');
});

test('findBestAutoMove evaluates rank subsets rather than only the full rank', () => {
    const units = [
        createBlade('u1', 100, 400),
        createBlade('u2', 140, 400),
        createBlade('u3', 180, 400)
    ];
    const suggestion = moveAi.findBestAutoMove({
        units,
        terrain: data.createDefaultTerrain(),
        activePlayerId: 'player-1',
        remainingMoves: 4,
        getPlayerId
    });
    assert.ok(suggestion);
    assert.ok(suggestion.unitIds.length <= 3);
    assert.ok(suggestion.distance > 0);
});

test('findBestAutoMove skips groups that cost more PIPs than remain', () => {
    const magician = {
        id: 'm1',
        type: 'Magician',
        playerId: 'player-1',
        width: 40,
        depth: 20,
        x: 200,
        y: 400,
        rotation: 0,
        movedThisTurn: false,
        troopClass: 'infantry',
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        ranged: { phase: 'shooting', range: 125, width: 120, requiresOwnTurn: true, requiresStationary: false },
        value: 4,
        strength: { infantry: 3, mounted: 3 },
        combat: { moveCost: 2, attackDeclareCost: 2, ignoresBadGoingPenalty: false }
    };
    const suggestion = moveAi.findBestAutoMove({
        units: [magician],
        terrain: data.createDefaultTerrain(),
        activePlayerId: 'player-1',
        remainingMoves: 1,
        getPlayerId
    });
    assert.equal(suggestion, null);
});

test('autoMove executes the chosen forward move and spends a PIP', async () => {
    const { units, terrain } = createStragglerScenario();
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            remainingMoves: 3,
            terrain,
            units,
            selectedIds: []
        }
    });
    wireDraftValidation(app);
    const startY = units[2].y;
    await app.autoMove();
    assert.ok(app.state.status.startsWith('Auto Move:'));
    assert.equal(app.state.draft, null);
    assert.equal(app.state.remainingMoves, 2);
    assert.equal(units[2].movedThisTurn, true);
    assert.ok(units[2].y < startY);
    assert.equal(units[0].movedThisTurn, false);
    assert.equal(units[1].movedThisTurn, false);
    assert.ok(app.state.autoMoveGhost);
});

test('autoMove waits for acknowledgement when no beneficial move exists', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            autoMoveModalOpen: true,
            autoMoveInProgress: true
        }
    });
    app.showAutoMoveNoMovesAcknowledgement();
    assert.equal(app.state.autoMoveAwaitingAck, true);
    assert.equal(app.state.autoMoveInProgress, false);
    assert.equal(app.state.autoMoveModalOpen, true);
    app.acknowledgeAutoMoveModal();
    assert.equal(app.state.autoMoveModalOpen, false);
    assert.equal(app.state.autoMoveAwaitingAck, false);
    assert.match(app.state.status, /no beneficial forward move found/i);
});

test('undoFinishedMove restores a completed move this turn', () => {
    const { units, terrain } = createStragglerScenario();
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            remainingMoves: 3,
            terrain,
            units,
            selectedIds: ['u3']
        }
    });
    wireDraftValidation(app);
    app.updateSelectionAnalysis();
    app.ensureDraft(['u3']);
    app.applyForwardMove(50);
    app.finishDraft();
    const movedY = units[2].y;
    assert.equal(app.state.remainingMoves, 2);
    app.undoFinishedMove();
    assert.equal(app.state.remainingMoves, 3);
    assert.equal(units[2].movedThisTurn, false);
    assert.ok(units[2].y > movedY);
    assert.equal(app.state.moveHistory.length, 0);
});
