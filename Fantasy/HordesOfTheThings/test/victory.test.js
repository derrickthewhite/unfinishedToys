const test = require('node:test');
const assert = require('node:assert/strict');
const { HordesPrototype } = require('../src/app.js');
const { createAppHarness } = require('./harness.js');

function createUnit(type, playerId, value, id) {
    return {
        id: id || `${type}-${playerId}`,
        type,
        playerId,
        value,
        width: 40,
        depth: 20,
        x: 100,
        y: 100,
        rotation: 0,
        movedThisTurn: false,
        troopClass: 'infantry',
        moves: { road: 400, good: 200, bad: 200, water: 100 },
        strength: { infantry: 5, mounted: 3 },
        combat: {}
    };
}

function recordLoss(app, playerId, type, value, id) {
    app.state.losses[playerId].push({ id: id || `${type}-loss`, type, value });
}

function endTurn(app) {
    app.advanceToNextTurn();
}

test('victory triggers at turn end when a side loses half its army and more than the opponent', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            startingArmyValueByPlayerId: { 'player-1': 24, 'player-2': 24 }
        }
    });
    recordLoss(app, 'player-2', 'Blade', 2, 'b1');
    recordLoss(app, 'player-2', 'Blade', 2, 'b2');
    recordLoss(app, 'player-1', 'Hero', 4, 'h1');
    recordLoss(app, 'player-1', 'Hero', 4, 'h2');
    recordLoss(app, 'player-1', 'Blade', 2, 'b3');
    assert.ok(!app.state.victory);
    recordLoss(app, 'player-1', 'Blade', 2, 'b4');
    assert.ok(!app.state.victory);
    endTurn(app);
    assert.ok(app.state.victory);
    assert.equal(app.state.victory.winnerPlayerId, 'player-2');
    assert.equal(app.state.victory.loserPlayerId, 'player-1');
    assert.equal(app.state.victory.reasonId, 'casualty-lead');
    assert.match(app.describeVictoryReason(app.state.victory), /more than half its army \(12 of 24 AP\)/);
    assert.match(app.describeVictoryReason(app.state.victory), /more than Red Undead \(4 AP lost\)/);
});

test('victory does not trigger when both sides have equal losses at the half threshold', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            startingArmyValueByPlayerId: { 'player-1': 24, 'player-2': 24 }
        }
    });
    app.state.losses['player-1'] = Array.from({ length: 6 }, (_, index) => ({
        id: `p1-${index}`,
        type: 'Blade',
        value: 2
    }));
    app.state.losses['player-2'] = Array.from({ length: 6 }, (_, index) => ({
        id: `p2-${index}`,
        type: 'Blade',
        value: 2
    }));
    endTurn(app);
    assert.ok(!app.state.victory);
});

test('equal cross-half losses from shooting and melee in one turn do not end the game', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            activePlayerId: 'player-1',
            startingArmyValueByPlayerId: { 'player-1': 24, 'player-2': 24 },
            losses: {
                'player-1': Array.from({ length: 5 }, (_, index) => ({
                    id: `p1-${index}`,
                    type: 'Blade',
                    value: 2
                })),
                'player-2': Array.from({ length: 5 }, (_, index) => ({
                    id: `p2-${index}`,
                    type: 'Blade',
                    value: 2
                }))
            }
        }
    });
    recordLoss(app, 'player-1', 'Blade', 2, 'shooting-loss');
    assert.ok(!app.state.victory);
    recordLoss(app, 'player-2', 'Blade', 2, 'melee-loss');
    assert.ok(!app.state.victory);
    endTurn(app);
    assert.ok(!app.state.victory);
    assert.equal(app.getLossSummary('player-1').points, 12);
    assert.equal(app.getLossSummary('player-2').points, 12);
});

test('losses that would end the game mid-turn wait until acknowledge advances the turn', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            activePlayerId: 'player-1',
            startingArmyValueByPlayerId: { 'player-1': 24, 'player-2': 24 },
            losses: {
                'player-1': Array.from({ length: 5 }, (_, index) => ({
                    id: `p1-${index}`,
                    type: 'Blade',
                    value: 2
                })),
                'player-2': [{ id: 'p2-0', type: 'Blade', value: 2 }]
            }
        }
    });
    recordLoss(app, 'player-1', 'Blade', 2, 'shooting-loss');
    assert.ok(!app.state.victory);
    endTurn(app);
    assert.ok(app.state.victory);
    assert.equal(app.state.victory.loserPlayerId, 'player-1');
    assert.equal(app.state.activePlayerId, 'player-1');
});

test('victory respects non-24 army sizes', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            startingArmyValueByPlayerId: { 'player-1': 20, 'player-2': 18 }
        }
    });
    recordLoss(app, 'player-2', 'Blade', 2, 'b1');
    recordLoss(app, 'player-2', 'Blade', 2, 'b2');
    recordLoss(app, 'player-2', 'Blade', 2, 'b3');
    recordLoss(app, 'player-1', 'Hero', 4, 'h1');
    recordLoss(app, 'player-1', 'Hero', 4, 'h2');
    recordLoss(app, 'player-1', 'Horde', 1, 'h3');
    assert.ok(!app.state.victory);
    recordLoss(app, 'player-1', 'Blade', 2, 'b4');
    assert.ok(!app.state.victory);
    endTurn(app);
    assert.ok(app.state.victory);
    assert.equal(app.state.victory.loserPlayerId, 'player-1');
    assert.equal(app.state.victory.loserStartingValue, 20);
});

test('representative unit is the most expensive unit on each side', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            units: [
                createUnit('Blade', 'player-1', 2, 'blade-1'),
                createUnit('Hero', 'player-1', 4, 'hero-1'),
                createUnit('Magician', 'player-2', 4, 'magician-1')
            ],
            startingArmyValueByPlayerId: { 'player-1': 6, 'player-2': 4 }
        }
    });
    recordLoss(app, 'player-1', 'Blade', 2, 'blade-1');
    recordLoss(app, 'player-1', 'Hero', 4, 'hero-1');
    endTurn(app);
    assert.equal(app.state.victory.winnerPlayerId, 'player-2');
    assert.equal(app.getRepresentativeUnit('player-1').type, 'Hero');
    assert.equal(app.getRepresentativeUnit('player-2').type, 'Magician');
});

test('captureStartingArmyValues sums deployed units per player', () => {
    const app = createAppHarness({
        state: {
            units: [
                createUnit('Hero', 'player-1', 4, 'hero-1'),
                createUnit('Blade', 'player-1', 2, 'blade-1'),
                createUnit('Magician', 'player-2', 4, 'magician-1')
            ]
        }
    });
    app.captureStartingArmyValues();
    assert.deepEqual(app.state.startingArmyValueByPlayerId, {
        'player-1': 6,
        'player-2': 4
    });
});

test('ensureStartingArmyValues reconstructs totals from board, reserve, and losses', () => {
    const app = createAppHarness({
        state: {
            units: [createUnit('Blade', 'player-1', 2, 'blade-live')],
            reserveUnits: [createUnit('Hero', 'player-1', 4, 'hero-reserve')],
            losses: {
                'player-1': [{ id: 'blade-loss', type: 'Blade', value: 2 }],
                'player-2': []
            }
        }
    });
    app.ensureStartingArmyValues();
    assert.equal(app.state.startingArmyValueByPlayerId['player-1'], 8);
});

test('isGameOver blocks further victory checks after the first declaration', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            startingArmyValueByPlayerId: { 'player-1': 10, 'player-2': 10 },
            victory: {
                reasonId: 'casualty-lead',
                winnerPlayerId: 'player-2',
                loserPlayerId: 'player-1'
            }
        }
    });
    assert.equal(app.isGameOver(), true);
    recordLoss(app, 'player-2', 'Hero', 4, 'h1');
    endTurn(app);
    assert.equal(app.state.victory.winnerPlayerId, 'player-2');
});
