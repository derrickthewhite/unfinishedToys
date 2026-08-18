const test = require('node:test');
const assert = require('node:assert/strict');

const {
    HordesPrototype,
    data,
    geometry,
    rules,
    createBlade,
    createArtillery,
    createRankPair,
    createStorage,
    createAppHarness
} = require('./harness.js');

test('auto deploy groups leftover singles with similar-movement troops', () => {
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
    const mixed = app.buildAutoDeployFormations([
        { draftId: 'p1-Blade-1', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Spear-1', playerId: 'player-1', type: 'Spear', faction: 'Panda' },
        { draftId: 'p1-Horde-1', playerId: 'player-1', type: 'Horde', faction: 'Panda' }
    ]);
    assert.equal(mixed.length, 1);
    assert.equal(mixed[0].entries.length, 3);

    const leftover = app.buildAutoDeployFormations([
        { draftId: 'p1-Blade-1', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Blade-2', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Blade-3', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Blade-4', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Blade-5', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Spear-1', playerId: 'player-1', type: 'Spear', faction: 'Panda' }
    ]);
    assert.equal(leftover.length, 2);
    const leftoverSizes = leftover.map((formation) => formation.entries.length).sort((left, right) => left - right);
    assert.deepEqual(leftoverSizes, [2, 4]);
    const mixedRemainder = leftover.find((formation) => formation.entries.length === 2);
    assert.ok(mixedRemainder.entries.some((entry) => entry.type === 'Blade'));
    assert.ok(mixedRemainder.entries.some((entry) => entry.type === 'Spear'));

    const differentMove = app.buildAutoDeployFormations([
        { draftId: 'p1-Blade-1', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Hero-1', playerId: 'player-1', type: 'Hero', faction: 'Panda' }
    ]);
    assert.equal(differentMove.length, 2);

    const closeMove = app.buildAutoDeployFormations([
        { draftId: 'p1-Blade-1', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Shooter-1', playerId: 'player-1', type: 'Shooter', faction: 'Panda' }
    ]);
    assert.equal(closeMove.length, 1);
    assert.equal(closeMove[0].entries.length, 2);

    const leftoverPartials = app.buildAutoDeployFormations([
        { draftId: 'p1-Blade-1', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Blade-2', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Blade-3', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
        { draftId: 'p1-Spear-1', playerId: 'player-1', type: 'Spear', faction: 'Panda' },
        { draftId: 'p1-Horde-1', playerId: 'player-1', type: 'Horde', faction: 'Panda' }
    ]);
    assert.equal(leftoverPartials.length, 2);
    const leftoverPartialSizes = leftoverPartials.map((formation) => formation.entries.length).sort((left, right) => left - right);
    assert.deepEqual(leftoverPartialSizes, [2, 3]);
    const bladePartial = leftoverPartials.find((formation) => formation.entries.length === 3);
    assert.ok(bladePartial.entries.every((entry) => entry.type === 'Blade'));

    const strike = app.buildAutoDeployFormations([
        { draftId: 'p1-Warband-1', playerId: 'player-1', type: 'Warband', faction: 'Undead' },
        { draftId: 'p1-Horde-1', playerId: 'player-1', type: 'Horde', faction: 'Undead' },
        { draftId: 'p1-Behemoth-1', playerId: 'player-1', type: 'Behemoth', faction: 'Undead' },
        { draftId: 'p1-Hero-1', playerId: 'player-1', type: 'Hero', faction: 'Undead' }
    ]);
    assert.equal(strike.length, 2);
    const heroAlone = strike.find((formation) => formation.entries.length === 1);
    assert.equal(heroAlone.entries[0].type, 'Hero');
    const mixedStrike = strike.find((formation) => formation.entries.length === 3);
    assert.deepEqual(mixedStrike.entries.map((entry) => entry.type).sort(), ['Behemoth', 'Horde', 'Warband']);
});

test('auto deploy roles put artillery in front, shooters in bad-going, and behemoths with fast troops', () => {
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
    assert.equal(app.getAutoDeployRole('Artillery'), 'front');
    assert.equal(app.getAutoDeployRole('Shooter'), 'bad-going');
    assert.equal(app.getAutoDeployRole('Behemoth'), 'fast');
    assert.equal(app.getAutoDeployRole('Beasts'), 'bad-going');
    assert.equal(app.getAutoDeployRole('Hero'), 'fast');
    assert.equal(app.getAutoDeployRole('Warband'), 'bad-going');
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
    assert.equal(app.ui.autoDeployButton.disabled, false);

    app.autoDeployActiveArmy();
    const redeployed = app.state.units.filter((unit) => unit.playerId === 'player-1');
    assert.equal(redeployed.length, 9);
    assert.equal(app.getDeploymentSetup().tray.filter((entry) => entry.playerId === 'player-1').length, 0);
    assert.equal(app.ui.autoDeployButton.disabled, false);
    assert.equal(app.canFinishDeploymentTurn(), true);
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
