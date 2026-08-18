const test = require('node:test');
const assert = require('node:assert/strict');

const data = require('../src/data.js');
const geometry = require('../src/geometry.js');
const rules = require('../src/rules/index.js');
const { createAppHarness } = require('./harness.js');

function withLiveDraftValidation(app) {
    delete app.evaluateDraft;
    return app;
}

function createUnit(type, playerId, x, y, rotation = 0, id) {
    return data.createUnit(type, playerId, 'Panda', { x, y, rotation }, () => id || `${type}-${playerId}`);
}

test('magician is available for undead army builder but not other factions', () => {
    const app = createAppHarness();
    app.updateArmyPlayer('player-1', 'faction', 'Undead');
    assert.ok(app.getAllowedUnitTypes('player-1').includes('Magician'));
    app.updateArmyPlayer('player-1', 'faction', 'Panda');
    assert.ok(!app.getAllowedUnitTypes('player-1').includes('Magician'));
    assert.equal(app.getUnitAssetPath({ type: 'Magician', faction: 'Undead' }), 'assets/undead/Magician.svg');
});

test('magician move and attack declare costs are 2', () => {
    const magician = createUnit('Magician', 'player-1', 200, 520);
    assert.equal(rules.getMoveCost(magician), 2);
    assert.equal(rules.getAttackDeclareCost(magician), 2);
    assert.equal(rules.getDraftMoveCost([magician.id], [magician]), 2);
});

test('magician minor win ensorcels hero in shooting and melee', () => {
    const hero = createUnit('Hero', 'player-2', 280, 80, Math.PI, 'hero');
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    assert.equal(
        rules.getMinorLossResolution(magician, hero, 'shooting', data.createDefaultTerrain()).outcome,
        'ensorcel'
    );
    assert.equal(
        rules.getMinorLossResolution(magician, hero, 'melee', data.createDefaultTerrain()).outcome,
        'ensorcel'
    );
});

test('hero destroys magician on minor melee win', () => {
    const hero = createUnit('Hero', 'player-1', 280, 520, 0, 'hero');
    const magician = createUnit('Magician', 'player-2', 280, 80, Math.PI, 'mag');
    assert.equal(
        rules.getMinorLossResolution(hero, magician, 'melee', data.createDefaultTerrain()).outcome,
        'destroy'
    );
});

test('resolveShooting ensorcels hero on magician minor win', () => {
    const hero = createUnit('Hero', 'player-2', 280, 400, Math.PI, 'hero');
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const rolls = [6, 1];
    const result = rules.resolveShooting(
        [magician, hero],
        { mag: 'hero' },
        data.createDefaultTerrain(),
        () => rolls.shift(),
        'player-1'
    );

    assert.equal(result.results[0].outcome, 'ensorcel');
    assert.equal(result.ensorcelledUnits.length, 1);
    assert.equal(result.ensorcelledUnits[0].id, 'hero');
    assert.equal(result.ensorcelledUnits[0].ensorcelledByUnitId, 'mag');
    assert.equal(result.units.some((unit) => unit.id === 'hero'), false);
    assert.equal(result.units.some((unit) => unit.id === 'mag'), true);
});

test('magician rolling 1 while shooting still resolves the shot and self-ensorcels', () => {
    const hero = createUnit('Hero', 'player-2', 280, 400, Math.PI, 'hero');
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const rolls = [1, 6];
    const result = rules.resolveShooting(
        [magician, hero],
        { mag: 'hero' },
        data.createDefaultTerrain(),
        () => rolls.shift(),
        'player-1'
    );

    assert.equal(result.results[0].outcome, 'no-effect');
    assert.equal(result.results[0].loserId, null);
    assert.equal(result.ensorcelledUnits.some((unit) => unit.id === 'mag'), true);
    assert.equal(result.ensorcelledUnits.find((unit) => unit.id === 'mag').ensorcelledByUnitId, null);
    assert.equal(result.units.some((unit) => unit.id === 'mag'), false);
});

test('magician rolling 1 goes to reserve immediately after shooting resolves', () => {
    const hero = createUnit('Hero', 'player-2', 280, 400, Math.PI, 'hero');
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            remainingMoves: 2,
            units: [magician, hero]
        }
    });
    app.state.shooting = {
        focusedAttackerId: null,
        validTargetIds: [],
        attacksByAttacker: { mag: 'hero' }
    };
    let rollIndex = 0;
    app.rollDie = () => (rollIndex++ === 0 ? 1 : 6);

    app.resolveShootingPhase();

    assert.equal(app.isUnitInReserve('mag'), true);
    assert.equal(app.getReserveUnits().find((unit) => unit.id === 'mag').ensorcelledByUnitId, null);
    assert.equal(app.state.units.some((unit) => unit.id === 'mag'), false);
    assert.equal(app.getLossSummary('player-1').points, 4);
});

test('magician ranged helper is a range-offset base with flat sides and corner arcs', () => {
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const area = rules.getRangedArea(magician);
    const range = magician.ranged.range;
    const corners = geometry.getUnitCorners(magician);

    assert.equal(area.kind, 'offset-rect');
    assert.equal(area.range, range);
    assert.equal(area.corners.length, 4);
    assert.deepEqual(area.corners[0].vertex, corners.frontLeft);
    assert.deepEqual(area.corners[0].arcStart, { x: corners.frontLeft.x - range, y: corners.frontLeft.y });
    assert.deepEqual(area.corners[0].arcEnd, { x: corners.frontLeft.x, y: corners.frontLeft.y - range });
    assert.deepEqual(area.corners[1].arcEnd, { x: corners.frontRight.x + range, y: corners.frontRight.y });
    const frontFlatMid = geometry.midpoint(area.corners[0].arcEnd, area.corners[1].arcStart);
    assert.equal(frontFlatMid.y, corners.frontLeft.y - range);
    assert.equal(frontFlatMid.x, (corners.frontLeft.x + corners.frontRight.x) / 2);
});

test('magician can shoot any enemy in range, not only heroes', () => {
    const knights = createUnit('Knights', 'player-2', 280, 400, Math.PI, 'knights');
    const shooter = createUnit('Shooter', 'player-2', 200, 400, Math.PI, 'shooter');
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const targets = rules.getValidShootingTargets(
        magician,
        [magician, knights, shooter],
        data.createDefaultTerrain(),
        'player-1'
    );
    assert.ok(targets.includes('knights'));
    assert.ok(targets.includes('shooter'));
});

test('magician minor win against knights recoils instead of ensorcelling', () => {
    const knights = createUnit('Knights', 'player-2', 280, 400, Math.PI, 'knights');
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    assert.equal(
        rules.getMinorLossResolution(magician, knights, 'shooting', data.createDefaultTerrain()).outcome,
        'recoil'
    );
});

test('ensorcelled hero goes to reserve after acknowledge and counts as a loss', () => {
    const hero = createUnit('Hero', 'player-1', 280, 520, 0, 'hero');
    hero.ensorcelledByUnitId = 'mag';
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            combatResolution: {
                ensorcelledUnits: [hero],
                destroyedIds: new Set(),
                recycledUnits: []
            }
        }
    }));
    app.acknowledgePhase();

    assert.equal(app.isUnitInReserve('hero'), true);
    assert.equal(app.getReserveUnits().find((unit) => unit.id === 'hero').ensorcelledByUnitId, 'mag');
    assert.equal(app.getLossSummary('player-1').points, 4);
});

test('ensorcelled return costs 6 when ensorceller is still on board', () => {
    const magician = createUnit('Magician', 'player-2', 280, 80, Math.PI, 'mag');
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 6,
            units: [magician]
        }
    }));
    const reserved = app.sendUnitToReserve(createUnit('Hero', 'player-1', 280, 520, 0, 'hero'), {
        ensorcelledByUnitId: 'mag'
    });
    assert.equal(app.getEnsorcelledReturnCost(reserved), 6);

    const started = app.beginReserveDeploy(reserved, 300);
    assert.equal(started, true);
    assert.equal(app.state.draft.kind, 'ensorcelled-return');

    const live = app.getUnitById('hero');
    assert.equal(live.y, live.depth);
    assert.equal(app.state.draft.invalidIds.size, 0);

    app.finishDraft();
    assert.equal(app.state.remainingMoves, 0);
    assert.equal(app.getUnitById('hero').ensorcelledByUnitId, undefined);
    assert.equal(app.getLossSummary('player-1').points, 0);
});

test('ensorcelled return costs 0 when ensorceller is gone', () => {
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 1,
            units: []
        }
    }));
    const reserved = app.sendUnitToReserve(createUnit('Hero', 'player-1', 280, 520, 0, 'hero'), {
        ensorcelledByUnitId: 'mag'
    });
    assert.equal(app.getEnsorcelledReturnCost(reserved), 0);

    app.beginReserveDeploy(reserved, 300);
    app.finishDraft();
    assert.equal(app.state.remainingMoves, 1);
});

test('ensorcelled magician returns within 250 paces of the original spot', () => {
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 6,
            units: []
        }
    }));
    const reserved = app.sendUnitToReserve(magician, { ensorcelledByUnitId: null });
    assert.ok(reserved.ensorcelledFrom);
    assert.equal(app.beginReserveDeploy(reserved), true);

    const live = app.getUnitById('mag');
    assert.equal(live.x, magician.x);
    assert.equal(live.y, magician.y);
    assert.equal(live.rotation, magician.rotation);
    assert.equal(app.state.draft.invalidIds.size, 0);

    live.x += 80;
    app.evaluateDraft();
    assert.equal(app.state.draft.invalidIds.has('mag'), true);

    live.x = magician.x + 20;
    app.evaluateDraft();
    assert.equal(app.state.draft.invalidIds.size, 0);

    app.finishDraft();
    assert.equal(app.getUnitById('mag').ensorcelledFrom, undefined);
});

test('ending the move phase keeps leftover PIPs for magician shooting', () => {
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const hero = createUnit('Hero', 'player-2', 280, 400, Math.PI, 'hero');
    const app = withLiveDraftValidation(createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 2,
            units: [magician, hero]
        }
    }));
    app.endMovePhase();

    assert.equal(app.state.phase, 'shooting');
    assert.equal(app.state.remainingMoves, 2);
    assert.equal(app.needsShootingDeclaration(magician), true);

    app.handleShootingClick(magician);
    app.handleShootingClick(hero);
    assert.equal(app.state.shooting.attacksByAttacker.mag, 'hero');
    assert.equal(app.state.remainingMoves, 0);
    assert.equal(app.getUnitById('mag').attackedThisTurn, true);

    const rolls = [6, 1];
    app.rollDie = () => rolls.shift();
    app.resolveShootingPhase();
    assert.equal(app.state.combatResolution.results[0].outcome, 'ensorcel');
    assert.equal(app.state.combatResolution.ensorcelledUnits[0].id, 'hero');
});

test('magician draft requires 2 remaining moves', () => {
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            remainingMoves: 1,
            units: [magician],
            selectedIds: [magician.id]
        }
    });
    assert.equal(app.ensureDraft([magician.id]), false);
    assert.match(app.state.status, /requires 2 moves/);
});

test('shooting auto-advances when a magician cannot afford to declare', () => {
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const hero = createUnit('Hero', 'player-2', 280, 400, Math.PI, 'hero');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'form-up',
            remainingMoves: 1,
            units: [magician, hero]
        }
    });
    delete app.maybeAutoAdvanceCombatPhase;

    assert.equal(app.hasAnyShootingAttacks(), false);
    assert.equal(app.needsShootingDeclaration(magician), false);
    app.acknowledgePhase();
    assert.notEqual(app.state.phase, 'shooting');
});

test('resolving shooting with one leftover magician PIP skips without a warning', () => {
    const magician = createUnit('Magician', 'player-1', 280, 520, 0, 'mag');
    const hero = createUnit('Hero', 'player-2', 280, 400, Math.PI, 'hero');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            remainingMoves: 1,
            units: [magician, hero]
        }
    });
    delete app.maybeAutoAdvanceCombatPhase;
    app.state.shooting = {
        focusedAttackerId: null,
        validTargetIds: [],
        attacksByAttacker: {}
    };

    app.resolveShootingPhase();
    assert.equal(app.state.confirmation, null);
    assert.notEqual(app.state.phase, 'shooting');
});

test('resolving shooting asks for confirmation when undeclared shooters remain', () => {
    const shooter = createUnit('Shooter', 'player-1', 280, 520, 0, 's1');
    const target = createUnit('Blade', 'player-2', 280, 490, Math.PI, 't1');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            remainingMoves: 1,
            units: [shooter, target],
            terrain: { roads: [], features: [] }
        }
    });
    delete app.maybeAutoAdvanceCombatPhase;
    app.state.shooting = {
        focusedAttackerId: null,
        validTargetIds: [],
        attacksByAttacker: {}
    };

    assert.equal(app.needsShootingDeclaration(shooter), true);
    app.resolveShootingPhase();
    assert.equal(app.state.phase, 'shooting');
    assert.equal(app.state.confirmation, 'skip-shooting');

    app.confirmSetupStage();
    assert.equal(app.state.confirmation, null);
    assert.notEqual(app.state.phase, 'shooting');
});
