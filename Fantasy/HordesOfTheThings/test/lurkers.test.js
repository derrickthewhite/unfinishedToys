const test = require('node:test');
const assert = require('node:assert/strict');

const {
    HordesPrototype,
    data,
    geometry,
    rules,
    createAppHarness
} = require('./harness.js');

function createUnit(type, playerId, x, y, rotation = 0) {
    const template = data.UNIT_TYPES[type];
    return {
        id: `${type}-${playerId}-${x}-${y}`,
        type,
        playerId,
        faction: playerId === 'player-1' ? 'Dinosaurs' : 'Panda',
        width: data.UNIT_WIDTH,
        depth: template.depth,
        x,
        y,
        rotation,
        troopClass: template.troopClass,
        moves: data.convertMovesToMm(template.moves),
        strength: { ...template.strength },
        movement: { ...(template.movement || {}) },
        combat: { ...(template.combat || {}) },
        value: template.value,
        lurkerDeployments: data.isLurkerType(type) ? 0 : undefined
    };
}

function swampTerrain() {
    return {
        roads: [],
        features: [{ kind: 'swamp', cx: 120, cy: 120, rx: 90, ry: 90, wobble: 0 }]
    };
}

test('Lurkers are 1 AP infantry that ignore bad going and start in reserve', () => {
    const template = data.UNIT_TYPES.Lurkers;
    assert.equal(template.value, 1);
    assert.equal(template.depth, 20);
    assert.equal(template.troopClass, 'infantry');
    assert.deepEqual(template.moves, { road: 200, good: 200, bad: 200, water: 100 });
    assert.deepEqual(template.strength, { infantry: 2, mounted: 2 });
    assert.equal(template.combat.ignoresBadGoingPenalty, true);
    assert.equal(template.movement.startsInReserve, true);
    assert.equal(data.FACTION_ROSTERS.Dinosaurs.includes('Lurkers'), true);
    assert.equal(data.getLurkerDeployCost({ lurkerDeployments: 0 }), 1);
    assert.equal(data.getLurkerDeployCost({ lurkerDeployments: 2 }), 3);
});

test('Dinosaurs Lurkers use faction art', () => {
    const app = createAppHarness();
    assert.equal(app.getUnitAssetPath({ type: 'Lurkers', faction: 'Dinosaurs' }), 'assets/dinosaurs/Lurkers.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Lurkers', faction: 'Panda' }), 'assets/dinosaurs/Lurkers.svg');
});

function frontToFront(lurkerPlayer, enemyType, enemyPlayer) {
    const lurker = createUnit('Lurkers', lurkerPlayer, 100, 220, 0);
    const enemy = createUnit(enemyType, enemyPlayer, 140, 220, Math.PI);
    return [lurker, enemy];
}

function lurkerCombatRoll(info, lurkerRoll, otherRoll) {
    const lurkerIsLeft = String(info.leftPrimaryId).startsWith('Lurkers');
    if (lurkerIsLeft) {
        return info.role === 'left' ? lurkerRoll : otherRoll;
    }
    return info.role === 'left' ? otherRoll : lurkerRoll;
}

test('a minor loss sends Lurkers to reserve instead of recoiling, and a double destroys them', () => {
    const [lurker, blade] = frontToFront('player-1', 'Blade', 'player-2');
    const terrain = { roads: [], features: [] };
    assert.equal(rules.getMinorLossResolution(blade, lurker, 'melee', terrain).outcome, 'lurk-return');
    assert.equal(rules.resolveCombatLoss(blade, lurker, 'melee', terrain, true).outcome, 'destroy');

    const minor = rules.resolveMelee([lurker, blade], terrain, (info) => lurkerCombatRoll(info, 4, 2));
    assert.equal(minor.results[0].outcome, 'lurk-return');
    assert.equal(minor.destroyedUnits.length, 0);
    assert.equal(minor.lurkerReturnedUnits.length, 1);
    assert.equal(minor.lurkerReturnedUnits[0].id, lurker.id);
    assert.equal(minor.units.some((unit) => unit.id === lurker.id), false);

    const doubledPair = frontToFront('player-1', 'Blade', 'player-2');
    const doubled = rules.resolveMelee(doubledPair, terrain, (info) => lurkerCombatRoll(info, 1, 6));
    assert.equal(doubled.destroyedUnits.some((unit) => unit.type === 'Lurkers'), true);
    assert.equal((doubled.lurkerReturnedUnits || []).length, 0);
});

test('isolated Lurkers return to reserve after melee and that return heightens deploy cost', () => {
    const lurker = createUnit('Lurkers', 'player-1', 80, 80, 0);
    lurker.lurkerDeployments = 1;
    const farEnemy = createUnit('Blade', 'player-2', 500, 500, 0);
    const result = rules.resolveMelee([lurker, farEnemy], swampTerrain(), () => 3);
    assert.equal(result.lurkerReturnedUnits.length, 1);
    assert.equal(result.lurkerReturnedUnits[0].lurkerReturnReason, 'isolation');

    const app = createAppHarness({
        state: {
            units: [lurker, farEnemy],
            terrain: swampTerrain(),
            reserveUnits: []
        }
    });
    app.settleLurkerReturns(result.lurkerReturnedUnits);
    const reserved = app.getReserveUnits().find((unit) => unit.id === lurker.id);
    assert.ok(reserved);
    assert.equal(reserved.lurkerDeployments, 2);
    assert.equal(app.state.losses['player-1'].length, 0);
    assert.equal(data.getLurkerDeployCost(reserved), 3);
});

test('Lurkers may not leave bad going and must approach it if they start outside', () => {
    const inSwamp = createUnit('Lurkers', 'player-1', 100, 100, 0);
    const origin = { [inSwamp.id]: { ...inSwamp } };
    const left = { ...inSwamp, x: 400, y: 400 };
    const leave = rules.validateDraftState({
        unitIds: [inSwamp.id],
        initialOrigin: origin,
        validationOrigin: origin,
        origin,
        history: []
    }, [left], swampTerrain());
    assert.equal(leave.invalidIds.has(inSwamp.id), true);

    const outside = createUnit('Lurkers', 'player-1', 400, 400, 0);
    const outsideOrigin = { [outside.id]: { ...outside } };
    const farther = { ...outside, x: 520, y: 520 };
    const away = rules.validateDraftState({
        unitIds: [outside.id],
        initialOrigin: outsideOrigin,
        validationOrigin: outsideOrigin,
        origin: outsideOrigin,
        history: []
    }, [farther], swampTerrain());
    assert.equal(away.invalidIds.has(outside.id), true);

    const closer = { ...outside, x: 370, y: 370 };
    const toward = rules.validateDraftState({
        unitIds: [outside.id],
        initialOrigin: outsideOrigin,
        validationOrigin: outsideOrigin,
        origin: outsideOrigin,
        history: []
    }, [closer], swampTerrain());
    assert.equal(toward.invalidIds.has(outside.id), false);
});

test('Lurkers skip the deployment tray, start in reserve, and count toward starting AP', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: {
                    'player-1': { counts: { Blade: 2, Lurkers: 2 }, random: false },
                    'player-2': { counts: { Blade: 3 }, random: false }
                }
            },
            players: {
                'player-1': { ...data.DEFAULT_PLAYERS['player-1'], faction: 'Dinosaurs' },
                'player-2': { ...data.DEFAULT_PLAYERS['player-2'] }
            }
        }
    });
    app.state.setup.terrain = {
        defenderPlayerId: 'player-1',
        attackerPlayerId: 'player-2',
        base: null
    };
    app.initializeUnitDeployment();
    assert.equal(app.getDeploymentSetup().tray.some((entry) => entry.type === 'Lurkers'), false);
    assert.equal(app.getDeploymentPlayerTotal('player-1'), 2);

    app.state.homeEdgeByPlayerId = { 'player-1': 'bottom', 'player-2': 'top' };
    app.state.reserveUnits = [];
    app.state.units = [
        createUnit('Blade', 'player-1', 80, 500, 0),
        createUnit('Blade', 'player-1', 130, 500, 0)
    ];
    app.spawnStartingLurkersToReserve();
    app.captureStartingArmyValues();
    assert.equal(app.getReserveUnits().filter((unit) => unit.type === 'Lurkers').length, 2);
    assert.equal(app.state.startingArmyValueByPlayerId['player-1'], 6);
});

test('ambush ghosts sit in front of enemies that entered the feature this turn', () => {
    const lurker = createUnit('Lurkers', 'player-1', 0, 0, 0);
    lurker.inReserve = true;
    const entered = createUnit('Blade', 'player-2', 100, 110, Math.PI);
    const stayed = createUnit('Spear', 'player-2', 140, 110, Math.PI);
    const terrain = swampTerrain();
    const app = createAppHarness({
        state: {
            units: [entered, stayed],
            reserveUnits: [lurker],
            terrain,
            selectedIds: [lurker.id],
            lurkerLastOccupancy: {
                [stayed.id]: rules.getUnitLurkFeatureKey(stayed, terrain)
            }
        }
    });
    const targets = app.getEligibleLurkerAmbushTargets(lurker);
    assert.deepEqual(targets.map((unit) => unit.id), [entered.id]);
    const ghosts = app.getLurkerAmbushGhosts();
    assert.equal(ghosts.length, 1);
    assert.ok(rules.isUnitInBadGoing(ghosts[0], terrain));
    assert.ok(app.isLegalLurkerAmbushPose(ghosts[0], entered, [entered, stayed], terrain));
});

test('a reserve lurker with no ambush is unmovable and does not keep the move phase open', () => {
    const lurker = createUnit('Lurkers', 'player-1', 0, 0, 0);
    lurker.inReserve = true;
    const stayed = createUnit('Spear', 'player-2', 100, 110, Math.PI);
    const terrain = swampTerrain();
    const app = createAppHarness({
        state: {
            remainingMoves: 4,
            units: [stayed],
            reserveUnits: [lurker],
            terrain,
            lurkerLastOccupancy: {
                [stayed.id]: rules.getUnitLurkFeatureKey(stayed, terrain)
            }
        }
    });
    app.isLocalPlayer = () => true;
    app.canLocallyControl = () => true;
    assert.equal(app.isLurkerBlockedInReserve(lurker), true);
    assert.equal(app.shouldMarkUnaffordableUnit(lurker), true);
    assert.equal(app.hasLegalMoveRemaining(), false);

    const entered = createUnit('Blade', 'player-2', 140, 110, Math.PI);
    app.state.units = [stayed, entered];
    assert.equal(app.isLurkerBlockedInReserve(lurker), false);
    assert.equal(app.shouldMarkUnaffordableUnit(lurker), false);
    assert.equal(app.hasLegalMoveRemaining(), true);
});

test('the lurker deploy counter is hidden at 0 and shown after a deployment', () => {
    const fresh = createUnit('Lurkers', 'player-1', 100, 100, 0);
    const used = { ...createUnit('Lurkers', 'player-1', 140, 100, 0), lurkerDeployments: 1 };
    const app = createAppHarness({ state: { units: [fresh, used] } });
    assert.equal(fresh.lurkerDeployments || 0, 0);
    assert.equal(used.lurkerDeployments, 1);
    let drewCount = 0;
    const ctx = {
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        beginPath() {},
        rect() {},
        fill() { drewCount += 1; },
        stroke() {},
        fillText(text) { this.lastText = text; }
    };
    app.drawLurkerDeployCount(ctx, fresh);
    assert.equal(drewCount, 0);
    app.drawLurkerDeployCount(ctx, used);
    assert.ok(drewCount > 0);
    assert.equal(ctx.lastText, '1');
});
