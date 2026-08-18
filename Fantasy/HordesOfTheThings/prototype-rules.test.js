const test = require('node:test');
const assert = require('node:assert/strict');

const rules = require('./prototype-rules.js');
const geometry = require('./prototype-geometry.js');
const data = require('./prototype-data.js');

function cloneUnit(unit) {
    return JSON.parse(JSON.stringify(unit));
}

function createUnit(type, playerId, x, y, rotation) {
    const template = data.UNIT_TYPES[type];
    return {
        id: `${type}-${playerId}-${x}-${y}`,
        type,
        playerId,
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
        ranged: data.convertRangedToMm(template.ranged)
    };
}

test('movement allowance uses the worst terrain rather than always min-by-value', () => {
    const rider = {
        moves: { road: 125, good: 125, bad: 50, water: 25 }
    };

    assert.equal(rules.movementAllowanceForSeverity(rider, rules.TERRAIN_SEVERITY.road), 125);
    assert.equal(rules.movementAllowanceForSeverity(rider, rules.TERRAIN_SEVERITY.good), 125);
    assert.equal(rules.movementAllowanceForSeverity(rider, rules.TERRAIN_SEVERITY.swamp), 50);
});

test('road presence overrides water and impassable terrain for movement speed sampling', () => {
    const terrainTypes = new Set(['road', 'water', 'impassable']);
    const rider = {
        moves: { road: 125, good: 80, bad: 50, water: 25 }
    };

    const severity = rules.severityFromTerrain(terrainTypes);

    assert.equal(severity, rules.TERRAIN_SEVERITY.road);
    assert.equal(rules.movementAllowanceForSeverity(rider, severity), 125);
});

test('road contact at any sampled point keeps road speed for the whole move', () => {
    const shooters = {
        id: 'u1',
        type: 'Shooter',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 260,
        y: 520,
        rotation: 0,
        moves: { road: 100, good: 75, bad: 75, water: 25 }
    };
    const riders = {
        id: 'u2',
        type: 'Riders',
        side: 'blue',
        width: 40,
        depth: 30,
        x: 300,
        y: 520,
        rotation: 0,
        moves: { road: 125, good: 125, bad: 50, water: 25 }
    };
    const origin = {
        u1: cloneUnit(shooters),
        u2: cloneUnit(riders)
    };

    shooters.y -= 85;
    riders.y -= 85;

    const result = rules.validateDraftState({ unitIds: ['u1', 'u2'], origin, history: [] }, [shooters, riders], data.createDefaultTerrain());

    assert.equal(result.invalidIds.size, 0);
});

test('rotation distance validation uses traveled corner path, not straight-line displacement', () => {
    const unit = {
        id: 'u1',
        type: 'Test',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 100,
        y: 120,
        rotation: 0,
        moves: { road: 10, good: 7.5, bad: 5, water: 2.5 }
    };
    const origin = { u1: cloneUnit(unit) };
    const center = geometry.getUnitCenter(unit);
    Object.assign(unit, geometry.buildUnitFromCenter(unit, center, Math.PI / 2));

    const result = rules.validateDraftState({ unitIds: ['u1'], origin, history: [] }, [unit], data.createDefaultTerrain());
    assert.equal(result.invalidIds.has('u1'), true);
    assert.equal(result.reasonById.get('u1'), 'A corner moved farther than the terrain-limited allowance.');
});

test('reversing in place does not consume corner travel when left-right corners are interchangeable', () => {
    const unit = {
        id: 'u1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 100,
        y: 120,
        rotation: 0,
        moves: { road: 5, good: 5, bad: 5, water: 5 }
    };
    const reversed = geometry.reverseUnitFacing(unit);
    const origin = { u1: cloneUnit(unit) };

    const result = rules.validateDraftState({ unitIds: ['u1'], origin, history: [] }, [reversed], data.createDefaultTerrain());
    assert.equal(result.invalidIds.size, 0);
});

test('single-unit rotation can pass through starting formation contact when the final position is legal', () => {
    const unit = {
        id: 'u1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 100,
        y: 120,
        rotation: 0,
        moves: { road: 100, good: 100, bad: 100, water: 100 }
    };
    const neighbor = {
        id: 'u2',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 140,
        y: 120,
        rotation: 0,
        moves: { road: 100, good: 100, bad: 100, water: 100 }
    };
    const origin = { u1: cloneUnit(unit) };
    const center = geometry.getUnitCenter(unit);
    Object.assign(unit, geometry.buildUnitFromCenter(unit, center, Math.PI / 2));

    const blocked = rules.validateDraftState({ unitIds: ['u1'], origin, history: [] }, [unit, neighbor], data.createDefaultTerrain());
    const allowed = rules.validateDraftState({
        unitIds: ['u1'],
        origin,
        history: [],
        allowSingleRotationFormationEscape: true
    }, [unit, neighbor], data.createDefaultTerrain());

    assert.equal(blocked.invalidIds.has('u1'), true);
    assert.equal(allowed.invalidIds.size, 0);
});

test('single-unit rotation escape still rejects an illegal final collision', () => {
    const unit = {
        id: 'u1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 100,
        y: 120,
        rotation: 0,
        moves: { road: 100, good: 100, bad: 100, water: 100 }
    };
    const neighbor = {
        id: 'u2',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 125,
        y: 120,
        rotation: 0,
        moves: { road: 100, good: 100, bad: 100, water: 100 }
    };
    const origin = { u1: cloneUnit(unit) };
    const center = geometry.getUnitCenter(unit);
    Object.assign(unit, geometry.buildUnitFromCenter(unit, center, Math.PI / 2));

    const result = rules.validateDraftState({
        unitIds: ['u1'],
        origin,
        history: [],
        allowSingleRotationFormationEscape: true
    }, [unit, neighbor], data.createDefaultTerrain());

    assert.equal(result.invalidIds.has('u1'), true);
    assert.equal(result.reasonById.get('u1'), 'Move collides with another unit.');
});

test('step checkpoints restart collision sampling without resetting total move distance', () => {
    const unit = {
        id: 'u1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 145,
        y: 520,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const original = { ...cloneUnit(unit), x: 100 };
    const stepped = { ...cloneUnit(unit), x: 140 };
    const blocker = {
        id: 'u2',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 95,
        y: 520,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.validateDraftState({
        unitIds: ['u1'],
        initialOrigin: { u1: original },
        validationOrigin: { u1: original },
        origin: { u1: stepped },
        history: []
    }, [unit, blocker], data.createDefaultTerrain());

    assert.equal(result.invalidIds.size, 0);
});

test('step checkpoints do not reset total movement allowance', () => {
    const unit = {
        id: 'u1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 160,
        y: 520,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const original = { ...cloneUnit(unit), x: 100 };
    const stepped = { ...cloneUnit(unit), x: 140 };

    const result = rules.validateDraftState({
        unitIds: ['u1'],
        initialOrigin: { u1: original },
        validationOrigin: { u1: original },
        origin: { u1: stepped },
        history: []
    }, [unit], data.createDefaultTerrain());

    assert.equal(result.invalidIds.has('u1'), true);
    assert.equal(result.reasonById.get('u1'), 'A corner moved farther than the terrain-limited allowance.');
});

test('default unit movement values are converted from paces to mm', () => {
    const units = data.createDefaultUnits(() => 'unit');
    const blade = units[0];
    const artillery = units.find((unit) => unit.type === 'Artillery');
    const hero = data.UNIT_TYPES.Hero;
    const riders = data.UNIT_TYPES.Riders;
    const terrain = data.createDefaultTerrain();

    assert.equal(blade.moves.road, 100);
    assert.equal(blade.moves.good, 50);
    assert.equal(blade.moves.water, 25);
    assert.ok(artillery);
    assert.equal(artillery.value, 3);
    assert.equal(artillery.depth, 40);
    assert.deepEqual(artillery.moves, { road: 75, good: 50, bad: 0, water: 25 });
    assert.deepEqual(artillery.strength, { infantry: 4, mounted: 4 });
    assert.deepEqual(artillery.ranged, { phase: 'shooting', range: 125, width: 120, requiresOwnTurn: true, requiresStationary: true });
    assert.equal(hero.depth, 40);
    assert.equal(hero.troopClass, 'mounted');
    assert.equal(riders.troopClass, 'mounted');
    assert.equal(data.UNIT_TYPES.Blade.troopClass, 'infantry');
    assert.equal(data.MM_GRID, 40);
    assert.equal(terrain.roads.length, 1);
    assert.equal(terrain.roads[0].orientation, 'vertical');
    assert.equal(terrain.roads[0].width, 20);
});

test('default seeded units include player one riders and do not overlap with updated depths', () => {
    const units = data.createDefaultUnits((() => {
        let id = 0;
        return () => `unit-${id += 1}`;
    })());
    const playerOneRiders = units.find((unit) => unit.playerId === 'player-1' && unit.type === 'Riders');

    assert.ok(playerOneRiders);

    for (let index = 0; index < units.length; index += 1) {
        for (let inner = index + 1; inner < units.length; inner += 1) {
            assert.equal(
                geometry.polygonsOverlap(geometry.getUnitCorners(units[index]), geometry.getUnitCorners(units[inner])),
                false,
                `${units[index].type} overlaps ${units[inner].type}`
            );
        }
    }
});

test('file movement does not report self-overlap when units remain in legal contact', () => {
    const lead = {
        id: 'u1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 120,
        y: 260,
        rotation: 0,
        moves: { road: 400, good: 200, bad: 200, water: 100 }
    };
    const follower = {
        id: 'u2',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 120,
        y: 240,
        rotation: 0,
        moves: { road: 400, good: 200, bad: 200, water: 100 }
    };
    const origin = {
        u1: cloneUnit(lead),
        u2: cloneUnit(follower)
    };

    lead.y -= 30;
    follower.x = geometry.getUnitCorners(lead).backLeft.x;
    follower.y = geometry.getUnitCorners(lead).backLeft.y;

    const result = rules.validateDraftState({ unitIds: ['u1', 'u2'], origin, history: [] }, [lead, follower], data.createDefaultTerrain());
    assert.equal(result.invalidIds.size, 0);
});

test('movement-time angled rank contact shifts the still-moving element orthogonally to clear blockers', () => {
    const originUnits = [
        {
            id: 'b1',
            type: 'Blade',
            side: 'blue',
            width: 40,
            depth: 20,
            x: 80,
            y: 140,
            rotation: 0,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        },
        {
            id: 'b2',
            type: 'Blade',
            side: 'blue',
            width: 40,
            depth: 20,
            x: 120,
            y: 140,
            rotation: 0,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        }
    ];
    const projectedUnits = [
        { ...originUnits[0], x: 80, y: 260 },
        { ...originUnits[1], x: 120, y: 260 }
    ];
    const enemyUnits = [
        {
            id: 'r1',
            type: 'Blade',
            side: 'red',
            width: 40,
            depth: 20,
            x: 100,
            y: 220,
            rotation: Math.PI / 4,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        },
        {
            id: 'r2',
            type: 'Blade',
            side: 'red',
            width: 40,
            depth: 20,
            x: 128.2842712474619,
            y: 248.2842712474619,
            rotation: Math.PI / 4,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        }
    ];

    const result = rules.resolveAngledRankMoveContact(
        originUnits,
        projectedUnits,
        [...projectedUnits, ...enemyUnits],
        'blue',
        { roads: [], features: [] }
    );
    const movingBlue = result.units.find((unit) => unit.id === 'b1');
    const formedBlue = result.units.find((unit) => unit.id === 'b2');
    const shift = geometry.subtract({ x: movingBlue.x, y: movingBlue.y }, { x: projectedUnits[0].x, y: projectedUnits[0].y });
    const forward = geometry.getForwardVector(projectedUnits[0].rotation);
    const right = geometry.getRightVector(projectedUnits[0].rotation);

    assert.deepEqual(result.unitIds, ['b2']);
    assert.ok(Math.abs(geometry.dot(shift, forward)) < 0.01);
    assert.ok(Math.abs(geometry.dot(shift, right)) > 0.01);
    assert.equal(geometry.polygonsOverlap(geometry.getUnitCorners(movingBlue), geometry.getUnitCorners(formedBlue)), false);
    enemyUnits.forEach((enemyUnit) => {
        assert.equal(geometry.polygonsOverlap(geometry.getUnitCorners(movingBlue), geometry.getUnitCorners(enemyUnit)), false);
    });
});

test('movement-time angled rank contact can shove a chain of neighboring units away from the formed unit', () => {
    const originUnits = [
        {
            id: 'b1',
            type: 'Blade',
            side: 'blue',
            width: 40,
            depth: 20,
            x: 80,
            y: 120,
            rotation: 0,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        },
        {
            id: 'b2',
            type: 'Blade',
            side: 'blue',
            width: 40,
            depth: 20,
            x: 120,
            y: 120,
            rotation: 0,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        },
        {
            id: 'b3',
            type: 'Blade',
            side: 'blue',
            width: 40,
            depth: 20,
            x: 160,
            y: 120,
            rotation: 0,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        }
    ];
    const projectedUnits = [
        { ...originUnits[0], x: 80, y: 240 },
        { ...originUnits[1], x: 120, y: 240 },
        { ...originUnits[2], x: 160, y: 240 }
    ];
    const enemyUnits = [
        {
            id: 'r1',
            type: 'Blade',
            side: 'red',
            width: 40,
            depth: 20,
            x: 140,
            y: 200,
            rotation: Math.PI / 4,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        },
        {
            id: 'r2',
            type: 'Blade',
            side: 'red',
            width: 40,
            depth: 20,
            x: 168.2842712474619,
            y: 228.2842712474619,
            rotation: Math.PI / 4,
            moves: { road: 100, good: 50, bad: 50, water: 25 }
        }
    ];

    const result = rules.resolveAngledRankMoveContact(
        originUnits,
        projectedUnits,
        [...projectedUnits, ...enemyUnits],
        'blue',
        { roads: [], features: [] }
    );
    const firstBlue = result.units.find((unit) => unit.id === 'b1');
    const secondBlue = result.units.find((unit) => unit.id === 'b2');
    const formedBlue = result.units.find((unit) => unit.id === 'b3');

    assert.deepEqual(result.unitIds, ['b3']);
    assert.ok(firstBlue.x < projectedUnits[0].x);
    assert.ok(secondBlue.x < projectedUnits[1].x);
    assert.equal(geometry.polygonsOverlap(geometry.getUnitCorners(firstBlue), geometry.getUnitCorners(secondBlue)), false);
    assert.equal(geometry.polygonsOverlap(geometry.getUnitCorners(secondBlue), geometry.getUnitCorners(formedBlue)), false);
});

test('rank wheel pivot stays on the outermost unit even if that unit is slightly skewed', () => {
    const blade = {
        id: 'unit-1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 168.41269204324092,
        y: 473.39485855648417,
        rotation: 0.3090206246232226
    };
    const spear = {
        id: 'unit-2',
        type: 'Spear',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 206.5179672443281,
        y: 485.5598904861342,
        rotation: 0.3090206246232226
    };
    const shooter = {
        id: 'unit-3',
        type: 'Shooter',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 244.6232424454153,
        y: 497.72492241578425,
        rotation: 0.3090206246232226
    };
    const riders = {
        id: 'unit-4',
        type: 'Riders',
        side: 'blue',
        width: 40,
        depth: 30,
        x: 282.72851764650255,
        y: 509.88995434543426,
        rotation: 0.3090206246232226
    };
    const warband = {
        id: 'unit-5',
        type: 'Warband',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 129.27548535577557,
        y: 462.32462409557576,
        rotation: 0.2753778126723025
    };

    const analysis = rules.analyzeSelection([blade, spear, shooter, riders, warband]);
    const warbandCorners = geometry.cornersToPoints(geometry.getUnitCorners(warband)).map((point) => ({
        point,
        u: geometry.dot(point, analysis.right),
        v: geometry.dot(point, analysis.forward)
    }));
    const warbandFront = Math.max(...warbandCorners.map((entry) => entry.v));
    const expectedPivot = warbandCorners
        .filter((entry) => Math.abs(entry.v - warbandFront) <= 1.5)
        .reduce((best, current) => (current.u < best.u ? current : best)).point;

    assert.equal(analysis.type, 'rank');
    assert.equal(analysis.orderedIds[0], 'unit-5');
    assert.ok(geometry.distance(analysis.leftPivot, expectedPivot) < 0.001);
});

test('automatic form up translates a unit to enemy corner contact within the configured distance', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 100,
        y: 240,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blue, red], 'blue', data.createDefaultTerrain());
    const formedBlue = result.units.find((unit) => unit.id === 'b1');
    const blueCorners = geometry.getUnitCorners(formedBlue);
    const redCorners = geometry.getUnitCorners(red);

    assert.deepEqual(result.movedUnitIds, ['b1']);
    assert.equal(blueCorners.frontLeft.y, redCorners.frontLeft.y);
});

test('describeSelection uses the unit type for a single selection', () => {
    const blade = {
        id: 'u1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 100,
        y: 100,
        rotation: 0
    };

    const description = rules.describeSelection({ type: 'single', invalid: false, reason: '' }, [blade], null);

    assert.equal(description, '1 selected, Blade.');
});

test('automatic form up can rotate to face the enemy within the configured distance', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 140,
        y: 280,
        rotation: Math.PI / 2,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 190,
        y: 310,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blue, red], 'blue', data.createDefaultTerrain());
    const formedBlue = result.units.find((unit) => unit.id === 'b1');

    assert.equal(formedBlue.rotation, 0);
    assert.deepEqual(result.movedUnitIds, ['b1']);
});

test('automatic form up can finish with its front facing an enemy side when it starts behind the enemy front line', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 60,
        y: 240,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blue, red], 'blue', data.createDefaultTerrain());
    const formedBlue = result.units.find((unit) => unit.id === 'b1');
    const formedCorners = geometry.getUnitCorners(formedBlue);
    const redCorners = geometry.getUnitCorners(red);

    assert.deepEqual(result.movedUnitIds, ['b1']);
    assert.equal(formedBlue.rotation, Math.PI / 2);
    assert.equal(formedCorners.frontLeft.x, redCorners.backLeft.x);
    assert.equal(formedCorners.frontRight.x, redCorners.frontLeft.x);
});

test('automatic form up keeps side-facing unavailable when the unit starts ahead of the enemy front line', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 60,
        y: 200,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blue, red], 'blue', data.createDefaultTerrain());
    const formedBlue = result.units.find((unit) => unit.id === 'b1');

    assert.deepEqual(result.movedUnitIds, ['b1']);
    assert.equal(formedBlue.rotation, Math.PI);
});

test('automatic form up allows side-facing when the unit is only slightly ahead of the enemy front line', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 60,
        y: 218,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blue, red], 'blue', data.createDefaultTerrain());
    const formedBlue = result.units.find((unit) => unit.id === 'b1');

    assert.deepEqual(result.movedUnitIds, ['b1']);
    assert.equal(formedBlue.rotation, Math.PI / 2);
});

test('automatic form up prefers the enemy flank when the unit is approaching from the side at an angle', () => {
    const blue = {
        id: 'b1',
        type: 'Riders',
        side: 'blue',
        width: 40,
        depth: 30,
        x: 376.63328577160837,
        y: 300.60389499905415,
        rotation: -0.5578416234032971,
        moves: { road: 125, good: 125, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Horde',
        side: 'red',
        width: 40,
        depth: 40,
        x: 467.45549051227385,
        y: 270.75161027310935,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blue, red], 'red', data.createDefaultTerrain());
    const formedRed = result.units.find((unit) => unit.id === 'r1');

    assert.deepEqual(result.movedUnitIds, ['r1']);
    assert.notEqual(formedRed.rotation, geometry.normalizeAngle(blue.rotation + Math.PI));
    assert.ok(Math.abs(formedRed.rotation - geometry.normalizeAngle(blue.rotation - (Math.PI / 2))) < 1e-9);
});

test('automatic form up triggers from a single close front corner even when the lines begin at different angles', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 120,
        y: 180,
        rotation: -3 * Math.PI / 4,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 180,
        y: 200,
        rotation: -Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blue, red], 'blue', data.createDefaultTerrain());
    const formedBlue = result.units.find((unit) => unit.id === 'b1');

    assert.deepEqual(result.movedUnitIds, ['b1']);
    assert.equal(formedBlue.rotation, Math.PI / 2);
});

test('automatic form up only moves the angled elements that can individually reach contact', () => {
    const blueLead = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 120,
        y: 180,
        rotation: -3 * Math.PI / 4,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const blueWing = {
        id: 'b2',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 148.2842712474619,
        y: 151.7157287525381,
        rotation: -3 * Math.PI / 4,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 180,
        y: 200,
        rotation: -Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blueLead, blueWing, red], 'blue', data.createDefaultTerrain());
    const formedLead = result.units.find((unit) => unit.id === 'b1');
    const formedWing = result.units.find((unit) => unit.id === 'b2');

    assert.deepEqual(result.movedUnitIds, ['b1']);
    assert.equal(formedLead.rotation, Math.PI / 2);
    assert.equal(geometry.sameFootprint(formedWing, blueWing), true);
});

test('automatic form up slides a non-qualifying angled neighbor sideways to avoid overlap', () => {
    const blueLead = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 100,
        y: 140,
        rotation: -3 * Math.PI / 4,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const blueWing = {
        id: 'b2',
        type: 'Blade',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 71.7157287525381,
        y: 111.7157287525381,
        rotation: -3 * Math.PI / 4,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 120,
        y: 120,
        rotation: Math.PI / 2,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp([blueLead, blueWing, red], 'blue', data.createDefaultTerrain());
    const formedLead = result.units.find((unit) => unit.id === 'b1');
    const formedWing = result.units.find((unit) => unit.id === 'b2');
    const wingDelta = geometry.subtract({ x: formedWing.x, y: formedWing.y }, { x: blueWing.x, y: blueWing.y });
    const wingForward = geometry.getForwardVector(blueWing.rotation);
    const wingRight = geometry.getRightVector(blueWing.rotation);

    assert.deepEqual(result.movedUnitIds.sort(), ['b1', 'b2']);
    assert.equal(formedLead.rotation, Math.PI);
    assert.equal(formedWing.rotation, blueWing.rotation);
    assert.ok(Math.abs(geometry.dot(wingDelta, wingForward)) < 0.1);
    assert.ok(Math.abs(geometry.dot(wingDelta, wingRight)) > 0.1);
    assert.equal(geometry.polygonsOverlap(geometry.getUnitCorners(formedLead), geometry.getUnitCorners(formedWing)), false);
});

test('automatic form up keeps mixed-depth front-aligned units in one formation group', () => {
    const blueRiders = {
        id: 'b4',
        type: 'Riders',
        side: 'blue',
        width: 40,
        depth: 30,
        x: 367.27272727272725,
        y: 320.90909090909093,
        rotation: 0,
        moves: { road: 125, good: 125, bad: 50, water: 25 }
    };
    const blueHorde = {
        id: 'b6',
        type: 'Horde',
        side: 'blue',
        width: 40,
        depth: 40,
        x: 407.27272727272725,
        y: 320.90909090909093,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const blueWarband = {
        id: 'b5',
        type: 'Warband',
        side: 'blue',
        width: 40,
        depth: 20,
        x: 447.27272727272725,
        y: 320.90909090909093,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const redBlade = {
        id: 'r10',
        type: 'Blade',
        side: 'red',
        width: 40,
        depth: 20,
        x: 448.2549045788197,
        y: 311.5331540840229,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };
    const redHorde = {
        id: 'r11',
        type: 'Horde',
        side: 'red',
        width: 40,
        depth: 40,
        x: 408.2549045788197,
        y: 311.5331540840229,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 }
    };

    const result = rules.resolveAutomaticFormUp(
        [blueRiders, blueHorde, blueWarband, redBlade, redHorde],
        'blue',
        data.createDefaultTerrain()
    );

    assert.deepEqual(result.movedUnitIds.sort(), ['b4', 'b5', 'b6']);
    assert.notEqual(result.units.find((unit) => unit.id === 'b4').x, blueRiders.x);
    assert.notEqual(result.units.find((unit) => unit.id === 'b6').x, blueHorde.x);
});

test('shooters can target enemies whose nearest side lies inside the shooting box', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = {
        id: 't1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 170,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    assert.equal(rules.isValidShootingAttack(shooter, target, [shooter, target], data.createDefaultTerrain()), true);
});

test('artillery can shoot while stationary but not after moving', () => {
    const artillery = {
        id: 'a1',
        type: 'Artillery',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 40,
        x: 100,
        y: 220,
        rotation: 0,
        movedThisTurn: false,
        ranged: { phase: 'shooting', range: 125, width: 120, requiresOwnTurn: true, requiresStationary: true },
        moves: { road: 75, good: 50, bad: 0, water: 25 },
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const target = {
        id: 't1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 100,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const units = [artillery, target];
    const terrain = { roads: [], features: [] };

    assert.equal(rules.isValidShootingAttack(artillery, target, units, terrain, 'blue'), true);
    assert.deepEqual(rules.getValidShootingTargets(artillery, units, terrain, 'blue'), ['t1']);

    artillery.movedThisTurn = true;

    assert.equal(rules.canUnitShoot(artillery, 'blue'), false);
    assert.equal(rules.isValidShootingAttack(artillery, target, units, terrain, 'blue'), false);
    assert.deepEqual(rules.getValidShootingTargets(artillery, units, terrain, 'blue'), []);
    assert.equal(rules.resolveShooting(units, { a1: 't1' }, terrain, () => 6, 'blue').results.length, 0);
});

test('shooters can shoot after moving', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        movedThisTurn: true,
        ranged: { phase: 'shooting', range: 50, width: 120, requiresOwnTurn: false, requiresStationary: false },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = {
        id: 't1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 170,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    assert.equal(rules.isValidShootingAttack(shooter, target, [shooter, target], { roads: [], features: [] }, 'blue'), true);
});

test('shooters with enemy front contact cannot make ranged attacks', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 328.2549045788197,
        y: 311.5331540840229,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const enemyInMelee = {
        id: 'e1',
        type: 'Riders',
        side: 'red',
        troopClass: 'mounted',
        width: 40,
        depth: 30,
        x: 328.2549045788197,
        y: 311.5331540840229,
        rotation: Math.PI,
        moves: { road: 125, good: 125, bad: 50, water: 25 },
        strength: { infantry: 3, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const target = {
        id: 't1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 448.2549045788197,
        y: 311.5331540840229,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    assert.equal(rules.detectMeleeCombats([shooter, enemyInMelee]).combats.length, 0);
    assert.equal(rules.isValidShootingAttack(shooter, target, [shooter, enemyInMelee, target], data.createDefaultTerrain()), false);
    assert.deepEqual(rules.getValidShootingTargets(shooter, [shooter, enemyInMelee, target], data.createDefaultTerrain()), []);
});

test('getRangedArea stays attached to the shooter front edge', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };

    const area = rules.getRangedArea(shooter);

    assert.deepEqual(area.nearLeft, { x: 60, y: 220 });
    assert.deepEqual(area.nearRight, { x: 180, y: 220 });
    assert.deepEqual(area.farLeft, { x: 60, y: 170 });
    assert.deepEqual(area.farRight, { x: 180, y: 170 });
});

test('other units block shooting line of sight', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const blocker = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 198,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const target = {
        id: 't1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 170,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    assert.equal(rules.isValidShootingAttack(shooter, target, [shooter, blocker, target], data.createDefaultTerrain()), false);
});

test('rough ground blocks shooting unless it is shallow near an endpoint', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = {
        id: 't1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 170,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const blockedTerrain = {
        roads: [],
        features: [{ kind: 'forest', cx: 100, cy: 194, rx: 12, ry: 12, wobble: 0 }]
    };
    const shallowTerrain = {
        roads: [],
        features: [{ kind: 'forest', cx: 100, cy: 212, rx: 12, ry: 12, wobble: 0 }]
    };

    assert.equal(rules.isValidShootingAttack(shooter, target, [shooter, target], blockedTerrain), false);
    assert.equal(rules.isValidShootingAttack(shooter, target, [shooter, target], shallowTerrain), true);
});

test('resolveShooting applies multiple-shooter defender penalty and bad-going combat penalty', () => {
    const shooterOne = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const shooterTwo = {
        ...cloneUnit(shooterOne),
        id: 's2',
        x: 60
    };
    const defender = {
        id: 'd1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 170,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const terrain = {
        roads: [],
        features: [{ kind: 'swamp', cx: 100, cy: 170, rx: 28, ry: 6, wobble: 0 }]
    };
    const rolls = [2, 2];
    const result = rules.resolveShooting(
        [shooterOne, shooterTwo, defender],
        { s1: 'd1', s2: 'd1' },
        terrain,
        () => rolls.shift()
    );

    assert.equal(result.results.length, 1);
    assert.deepEqual(result.results[0].defenderModifiers.map((modifier) => modifier.id), ['bad-going', 'multiple-shooters']);
    assert.equal(result.results[0].defenderTotal, 2 + 5 - 2 - 1);
});

test('resolveShooting destroys a recoiling defender that would recoil into water', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const defender = {
        id: 'd1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 170,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const terrain = {
        roads: [],
        features: [{ kind: 'water', cx: 100, cy: 146, rx: 18, ry: 18, wobble: 0 }]
    };
    const rolls = [6, 1];
    const result = rules.resolveShooting([shooter, defender], { s1: 'd1' }, terrain, () => rolls.shift());

    assert.equal(result.destroyedUnits.some((unit) => unit.id === 'd1'), true);
    assert.equal(result.units.some((unit) => unit.id === 'd1'), false);
    assert.deepEqual(result.recoilDestructions, [{ unitId: 'd1', reason: 'recoil path enters water' }]);
});

test('resolveRecoil ignores enemy corner contact on the rear edge', () => {
    const recoilingUnit = {
        id: 'b1',
        type: 'Spear',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const enemyCornerTouch = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 60,
        y: 240,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.resolveRecoil('b1', [recoilingUnit, enemyCornerTouch], data.createDefaultTerrain());

    assert.deepEqual(result.destroyedIds, []);
    assert.deepEqual(result.destructionReasons, {});
    assert.equal(result.units.find((unit) => unit.id === 'b1').y, 240);
});

test('resolveRecoil ignores a tiny rear-edge sliver contact', () => {
    const recoilingUnit = {
        id: 'b1',
        type: 'Spear',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const enemySliver = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 60.05,
        y: 240,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.resolveRecoil('b1', [recoilingUnit, enemySliver], data.createDefaultTerrain());

    assert.deepEqual(result.destroyedIds, []);
    assert.deepEqual(result.destructionReasons, {});
    assert.equal(result.units.find((unit) => unit.id === 'b1').y, 240);
});

test('resolveRecoil still destroys on real rear-edge contact', () => {
    const recoilingUnit = {
        id: 'b1',
        type: 'Spear',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const rearEnemy = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 80,
        y: 240,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.resolveRecoil('b1', [recoilingUnit, rearEnemy], data.createDefaultTerrain());

    assert.deepEqual(result.destroyedIds, ['b1']);
    assert.equal(result.destructionReasons.b1, 'recoil is blocked by rear or side enemy contact');
});

test('resolveShooting does not make the shooting attacker lose the exchange', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const defender = {
        id: 'd1',
        type: 'Knights',
        side: 'red',
        troopClass: 'mounted',
        width: 40,
        depth: 30,
        x: 100,
        y: 170,
        rotation: Math.PI,
        moves: { road: 200, good: 100, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const result = rules.resolveShooting([shooter, defender], { s1: 'd1' }, data.createDefaultTerrain(), (() => {
        const rolls = [1, 6];
        return () => rolls.shift();
    })());

    assert.equal(result.results[0].loserId, null);
    assert.equal(result.results[0].outcome, 'no-effect');
    assert.equal(result.results[0].destructionRule, null);
    assert.equal(result.destroyedUnits.some((unit) => unit.id === 's1'), false);
    assert.equal(result.units.some((unit) => unit.id === 's1'), true);
    assert.equal(result.units.find((unit) => unit.id === 's1').y, 220);
});

test('artillery is destroyed on a minor melee loss', () => {
    const winner = {
        type: 'Blade',
        troopClass: 'infantry'
    };
    const artillery = {
        type: 'Artillery',
        troopClass: 'infantry',
        width: 40,
        depth: 40,
        x: 100,
        y: 220,
        rotation: 0
    };

    const resolution = rules.getMinorLossResolution(winner, artillery, 'melee', { roads: [], features: [] });

    assert.deepEqual(resolution, {
        outcome: 'destroy',
        destructionRule: 'Artillery is destroyed when it loses melee.'
    });
});

test('detectMeleeCombats finds front-to-front enemy contacts', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 140,
        y: 220,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.detectMeleeCombats([blue, red]);

    assert.equal(result.combats.length, 1);
    assert.equal(result.combats[0].edgesOnLeft.includes('front'), true);
    assert.equal(result.combats[0].edgesOnRight.includes('front'), true);
});

test('detectMeleeCombats groups stacked spears as one combatant', () => {
    const frontSpear = {
        id: 'b1',
        type: 'Spear',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const sideSpear = {
        ...cloneUnit(frontSpear),
        id: 'b2',
        x: 140,
        y: 220
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 180,
        y: 220,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.detectMeleeCombats([frontSpear, sideSpear, red]);

    assert.equal(result.combatants.some((combatant) => combatant.unitIds.length === 2), true);
    assert.equal(result.combats.length, 1);
});

test('detectMeleeCombats ignores corner-only contact even when the touched unit is already fighting', () => {
    const blueFront = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const blueCorner = {
        ...cloneUnit(blueFront),
        id: 'b2',
        x: 20,
        y: 220
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 140,
        y: 220,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.detectMeleeCombats([blueFront, blueCorner, red]);

    assert.equal(result.combats.length, 1);
    assert.equal(result.combats[0].leftUnitIds.includes('b1') || result.combats[0].rightUnitIds.includes('b1'), true);
    assert.equal(result.participantIds.has('b2'), false);
});

test('detectMeleeCombats pairs idle enemies that are touching side-to-side', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 140,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.detectMeleeCombats([blue, red]);

    assert.equal(result.combats.length, 1);
    assert.equal(result.combats[0].edgesOnLeft.includes('right'), true);
    assert.equal(result.combats[0].edgesOnRight.includes('left'), true);
    assert.equal(result.participantIds.has('b1'), true);
    assert.equal(result.participantIds.has('r1'), true);
});

test('resolveMelee turns a singly engaged side-contact combatant to face the enemy', () => {
    const blue = {
        id: 'b1',
        type: 'Blade',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 140,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const originalSharedMidpoint = { x: 140, y: 230 };

    const result = rules.resolveMelee([blue, red], data.createDefaultTerrain(), () => 3);
    const resolvedBlue = result.units.find((unit) => unit.id === 'b1');
    const resolvedRed = result.units.find((unit) => unit.id === 'r1');
    const resolvedBlueFront = geometry.midpoint(geometry.getUnitCorners(resolvedBlue).frontLeft, geometry.getUnitCorners(resolvedBlue).frontRight);
    const resolvedRedFront = geometry.midpoint(geometry.getUnitCorners(resolvedRed).frontLeft, geometry.getUnitCorners(resolvedRed).frontRight);

    assert.ok(resolvedBlue);
    assert.ok(resolvedRed);
    assert.equal(Math.abs(geometry.normalizeAngle(resolvedBlue.rotation - (Math.PI / 2))) < 0.001, true);
    assert.equal(Math.abs(geometry.normalizeAngle(resolvedRed.rotation + (Math.PI / 2))) < 0.001, true);
    assert.deepEqual(resolvedBlueFront, originalSharedMidpoint);
    assert.deepEqual(resolvedRedFront, originalSharedMidpoint);
    assert.notEqual(geometry.getUnitCenter(resolvedBlue).x, geometry.getUnitCenter(blue).x);
    assert.notEqual(geometry.getUnitCenter(resolvedRed).x, geometry.getUnitCenter(red).x);
    assert.equal(result.combats[0].edgesOnLeft.includes('front'), true);
    assert.equal(result.combats[0].edgesOnRight.includes('front'), true);
});

test('resolveMelee applies stacked and flank modifiers', () => {
    const frontSpear = {
        id: 'b1',
        type: 'Spear',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 100,
        y: 220,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 4, mounted: 4 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const sideSpear = {
        ...cloneUnit(frontSpear),
        id: 'b2',
        x: 60,
        y: 220
    };
    const red = {
        id: 'r1',
        type: 'Blade',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 20,
        x: 140,
        y: 220,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 5, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const redFlanker = {
        ...cloneUnit(red),
        id: 'r2',
        x: 100,
        y: 220,
        rotation: Math.PI / 2
    };

    const result = rules.resolveMelee([frontSpear, sideSpear, red, redFlanker], data.createDefaultTerrain(), () => 3);
    const frontCombat = result.results.find((entry) => entry.rightPrimaryId === 'r1');
    const flankCombat = result.results.find((entry) => entry.rightPrimaryId === 'r2');

    assert.ok(frontCombat);
    assert.ok(flankCombat);
    const frontSpearModifiers = frontCombat.leftPrimaryId === 'b1' ? frontCombat.leftModifiers : frontCombat.rightModifiers;
    const flankSpearModifiers = flankCombat.leftPrimaryId === 'b1' ? flankCombat.leftModifiers : flankCombat.rightModifiers;
    assert.equal(frontSpearModifiers.some((modifier) => modifier.id === 'stacked'), true);
    assert.equal(flankSpearModifiers.some((modifier) => modifier.id === 'flank-attacked'), true);
});

test('resolveMelee applies overlap modifier for an idle enemy on the fighter flank', () => {
    const blue = {
        id: 'b1',
        type: 'Horde',
        side: 'blue',
        troopClass: 'infantry',
        width: 40,
        depth: 40,
        x: 100,
        y: 240,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 2, mounted: 2 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const redFront = {
        id: 'r1',
        type: 'Horde',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 40,
        x: 140,
        y: 240,
        rotation: Math.PI,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 2, mounted: 2 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const redOverlap = {
        id: 'r2',
        type: 'Horde',
        side: 'red',
        troopClass: 'infantry',
        width: 40,
        depth: 40,
        x: 140,
        y: 240,
        rotation: 0,
        moves: { road: 100, good: 50, bad: 50, water: 25 },
        strength: { infantry: 2, mounted: 2 },
        combat: { ignoresBadGoingPenalty: false }
    };

    const result = rules.resolveMelee([blue, redFront, redOverlap], data.createDefaultTerrain(), () => 3);
    const combat = result.results.find((entry) => entry.leftPrimaryId === 'b1' || entry.rightPrimaryId === 'b1');

    assert.ok(combat);
    const blueModifiers = combat.leftPrimaryId === 'b1' ? combat.leftModifiers : combat.rightModifiers;
    assert.equal(blueModifiers.some((modifier) => modifier.id === 'overlapped' && modifier.value === -1), true);
});

test('new unit templates use the requested stats and special profiles', () => {
    assert.deepEqual(data.UNIT_TYPES.Beasts, {
        value: 2,
        depth: 30,
        troopClass: 'mounted',
        moves: { road: 400, good: 400, bad: 400, water: 100 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    });
    assert.equal(data.UNIT_TYPES.Flyers.moves.good, 1200);
    assert.equal(data.UNIT_TYPES.Flyers.depth, 30);
    assert.equal(data.UNIT_TYPES.Flyers.movement.ignoresTerrain, true);
    assert.equal(data.UNIT_TYPES.Behemoth.value, 4);
    assert.deepEqual(data.UNIT_TYPES.Behemoth.strength, { infantry: 4, mounted: 5 });
    assert.deepEqual(data.UNIT_TYPES['Heavy-Spear'].strength, { infantry: 5, mounted: 5 });
    assert.deepEqual(data.UNIT_TYPES['Heavy-Warband'].strength, { infantry: 4, mounted: 4 });
});

test('heavy spear and heavy warband inherit combat loss rules without stacking', () => {
    const heavySpear = createUnit('Heavy-Spear', 'blue', 100, 220, 0);
    const adjacentHeavySpear = createUnit('Heavy-Spear', 'blue', 140, 220, 0);
    const heavyWarband = createUnit('Heavy-Warband', 'red', 180, 220, Math.PI);
    const melee = rules.detectMeleeCombats([heavySpear, adjacentHeavySpear, heavyWarband]);
    const heavySpearCombatants = melee.combatants.filter((combatant) => combatant.type === 'Heavy-Spear');

    assert.equal(heavySpearCombatants.every((combatant) => combatant.unitIds.length === 1), true);
    assert.equal(rules.getMinorLossResolution(heavyWarband, heavySpear, 'melee', { roads: [], features: [] }).outcome, 'destroy');
    assert.equal(rules.getMinorLossResolution(createUnit('Knights', 'red', 0, 0, 0), heavySpear, 'melee', { roads: [], features: [] }).outcome, 'destroy');
});

test('Beasts ignore bad-going combat penalties and lose melee to mounted troops', () => {
    const beasts = createUnit('Beasts', 'blue', 100, 220, 0);
    const terrain = { roads: [], features: [{ kind: 'swamp', cx: 100, cy: 220, rx: 30, ry: 30, wobble: 0 }] };
    const modifiers = rules.getCombatModifiers({ phase: 'melee', role: 'attacker', unit: beasts, opponent: createUnit('Blade', 'red', 140, 220, Math.PI), terrain });

    assert.equal(modifiers.some((modifier) => modifier.id === 'bad-going'), false);
    assert.equal(rules.getMinorLossResolution(createUnit('Knights', 'red', 140, 220, Math.PI), beasts, 'melee', terrain).outcome, 'destroy');
    assert.equal(rules.getMinorLossResolution(createUnit('Knights', 'red', 140, 220, Math.PI), beasts, 'shooting', terrain).outcome, 'recoil');
});

test('unengaged Flyers ignore terrain and all unit collisions during movement', () => {
    const flyer = createUnit('Flyers', 'blue', 100, 220, 0);
    const blocker = createUnit('Blade', 'red', 100, 150, Math.PI);
    const origin = { [flyer.id]: cloneUnit(flyer) };
    flyer.y = 70;
    const terrain = { roads: [], features: [{ kind: 'impassable', cx: 100, cy: 140, rx: 45, ry: 60, wobble: 0 }] };

    const flyerMove = rules.validateDraftState({ unitIds: [flyer.id], origin, history: [] }, [flyer, blocker], terrain);
    const blade = createUnit('Blade', 'blue', 60, 220, 0);
    const stationaryFlyer = createUnit('Flyers', 'red', 100, 220, Math.PI);
    const bladeOrigin = { [blade.id]: cloneUnit(blade) };
    blade.x = 100;
    const bladeMove = rules.validateDraftState({ unitIds: [blade.id], origin: bladeOrigin, history: [] }, [blade, stationaryFlyer], { roads: [], features: [] });

    assert.equal(flyerMove.invalidIds.size, 0);
    assert.equal(bladeMove.invalidIds.size, 0);
});

test('engaged Flyers must withdraw 20 mm before continuing their move', () => {
    const flyer = createUnit('Flyers', 'blue', 100, 220, 0);
    const enemy = createUnit('Blade', 'red', 140, 220, Math.PI);
    const origin = { [flyer.id]: cloneUnit(flyer) };
    flyer.y = 190;
    const forwardMove = rules.validateDraftState({ unitIds: [flyer.id], origin, validationOrigin: origin, history: [] }, [flyer, enemy], { roads: [], features: [] });

    flyer.y = 250;
    const withdrawal = cloneUnit(flyer);
    const backwardMove = rules.validateDraftState({ unitIds: [flyer.id], origin, validationOrigin: origin, history: [] }, [flyer, enemy], { roads: [], features: [] });
    flyer.y = 240;
    const continuedMove = rules.validateDraftState({
        unitIds: [flyer.id],
        origin: { [flyer.id]: withdrawal },
        validationOrigin: origin,
        history: [{ [flyer.id]: withdrawal }]
    }, [flyer, enemy], { roads: [], features: [] });

    assert.equal(forwardMove.reasonById.get(flyer.id), 'An engaged Flyer must first move 20 mm backward.');
    assert.equal(backwardMove.invalidIds.size, 0);
    assert.equal(continuedMove.invalidIds.size, 0);
});

test('Flyers recoil then flee 600 paces after losing shooting or melee', () => {
    const terrain = { roads: [], features: [] };
    const artillery = createUnit('Artillery', 'blue', 100, 220, 0);
    const shootingFlyer = createUnit('Flyers', 'red', 100, 170, Math.PI);
    const shootingRolls = [1, 1];
    const shooting = rules.resolveShooting(
        [artillery, shootingFlyer],
        { [artillery.id]: shootingFlyer.id },
        terrain,
        () => shootingRolls.shift(),
        'blue'
    );
    const meleeFlyer = createUnit('Flyers', 'blue', 100, 220, 0);
    const blade = createUnit('Blade', 'red', 140, 220, Math.PI);
    const meleeRolls = [1, 1];
    const melee = rules.resolveMelee([meleeFlyer, blade], terrain, () => meleeRolls.shift());

    assert.equal(shooting.results[0].outcome, 'flee');
    assert.equal(shooting.units.find((unit) => unit.id === shootingFlyer.id).y, -10);
    assert.equal(melee.results[0].outcome, 'flee');
    assert.equal(melee.units.find((unit) => unit.id === meleeFlyer.id).y, 400);
});

test('Behemoths flee from Artillery by the shallowest legal heading', () => {
    const behemoth = createUnit('Behemoth', 'blue', 100, 220, 0);
    const direct = rules.resolveFlee(behemoth.id, [behemoth], { roads: [], features: [] });
    const detourTerrain = {
        roads: [],
        features: [{ kind: 'water', cx: 100, cy: 330, rx: 25, ry: 25, wobble: 0 }]
    };
    const detour = rules.resolveFlee(behemoth.id, [behemoth], detourTerrain);
    const blockedTerrain = {
        roads: [],
        features: [{ kind: 'water', cx: 100, cy: 300, rx: 1000, ry: 1000, wobble: 0 }]
    };
    const blocked = rules.resolveFlee(behemoth.id, [behemoth], blockedTerrain);

    assert.equal(direct.units[0].y, 370);
    assert.notEqual(detour.units[0].x, 100);
    assert.deepEqual(blocked.destroyedIds, [behemoth.id]);
});

test('Behemoth flee does not treat a road as safe over forbidden terrain', () => {
    const behemoth = createUnit('Behemoth', 'blue', 100, 220, 0);
    const terrain = {
        roads: [{ orientation: 'vertical', position: 100, width: 40 }],
        features: [{ kind: 'water', cx: 100, cy: 330, rx: 25, ry: 25, wobble: 0 }]
    };
    const result = rules.resolveFlee(behemoth.id, [behemoth], terrain);

    assert.notEqual(result.units[0].x, 100);
});

test('Behemoths flee only when Artillery wins the combat', () => {
    const terrain = { roads: [], features: [] };
    const behemoth = createUnit('Behemoth', 'blue', 100, 220, 0);
    const artillery = createUnit('Artillery', 'red', 140, 220, Math.PI);
    const rolls = [1, 2];
    const melee = rules.resolveMelee([behemoth, artillery], terrain, () => rolls.shift());

    assert.equal(melee.results[0].outcome, 'flee');
    assert.equal(melee.units.find((unit) => unit.id === behemoth.id).y, 410);
    assert.equal(rules.getMinorLossResolution(createUnit('Blade', 'red', 140, 220, Math.PI), behemoth, 'melee', terrain).outcome, 'recoil');
});