const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createAppHarness, data, geometry, rules } = require('./harness.js');

const ASSETS = path.join(__dirname, '..', 'assets');

test('faction base artwork is capitalized and fits the size limit', () => {
    const folders = fs.readdirSync(ASSETS);
    const app = createAppHarness();
    data.FACTIONS.forEach((faction) => {
        assert.ok(folders.includes(faction), `${faction} folder keeps its capital letter`);
        const names = fs.readdirSync(path.join(ASSETS, faction));
        assert.ok(names.includes('Base.svg'), `${faction} base file is Base.svg`);
        const footprint = data.getBaseFootprint(faction);
        assert.ok(footprint.points.length >= 3);
        assert.ok(footprint.width <= data.BASE_MAX_WIDTH);
        assert.ok(footprint.depth <= data.BASE_MAX_DEPTH);
        const unit = data.createUnit('Base', 'player-1', faction, data.baseHomeEdgePose(footprint), () => `${faction}-base`);
        assert.equal(unit.strength.infantry, 6);
        assert.equal(unit.strength.mounted, 6);
        assert.equal(unit.value, 0);
        assert.equal(unit.combat.stationary, true);
        assert.equal(rules.getMoveCost(unit), Infinity);
        assert.equal(app.getUnitAssetPath(unit), `assets/${faction}/Base.svg`);
        assert.ok(geometry.footprintInsideBoard(unit));
    });
    assert.equal(data.UNIT_TYPES.Base.combat.unpurchasable, true);
});

test('a curved base ignores the empty corner of its bounding box', () => {
    const unit = data.createUnit('Base', 'player-1', 'Undead', { x: 40, y: 80, rotation: 0 }, () => 'undead-base');
    const outsideCorner = { x: unit.x + 1, y: unit.y + 1 };
    const center = geometry.getUnitCenter(unit);
    assert.equal(geometry.pointInPolygon(outsideCorner, geometry.getUnitFootprintPoints(unit)), false);
    assert.equal(geometry.pointInPolygon(center, geometry.getUnitFootprintPoints(unit)), true);
    const blade = data.createUnit('Blade', 'player-2', 'Goblin', { x: unit.x + 20, y: unit.y + 20, rotation: 0 }, () => 'inside');
    assert.equal(geometry.unitsOverlap(unit, blade), true);
});

test('contact with a base outline is a conflict, and a loss ends the battle', () => {
    const base = data.createUnit('Base', 'player-1', 'Panda', { x: 100, y: 300, rotation: 0 }, () => 'panda-base');
    const blade = data.createUnit('Blade', 'player-2', 'Undead', { x: 140, y: 300, rotation: Math.PI }, () => 'blade');
    const terrain = { roads: [], features: [] };
    const detected = rules.detectMeleeCombats([base, blade]);
    assert.equal(detected.combats.length, 1);
    const preview = rules.previewMeleeCombats([base, blade], terrain);
    const modifiers = [...preview[0].left.modifiers, ...preview[0].right.modifiers];
    assert.equal(modifiers.some((modifier) => modifier.id === 'flank-attacked'), false);

    const fallen = rules.resolveMelee([base, blade], terrain, (info) => {
        const baseIsLeft = info.leftPrimaryId === base.id;
        if (info.role === 'left') {
            return baseIsLeft ? 1 : 6;
        }
        return baseIsLeft ? 6 : 1;
    });
    assert.equal(fallen.baseFellPlayerId, 'player-1');
    assert.equal(fallen.units.some((unit) => unit.id === base.id), false);
    assert.equal(fallen.results[0].outcome, 'base-fall');

    const held = rules.resolveMelee([base, blade], terrain, (info) => {
        const baseIsLeft = info.leftPrimaryId === base.id;
        if (info.role === 'left') {
            return baseIsLeft ? 6 : 1;
        }
        return baseIsLeft ? 1 : 6;
    });
    assert.equal(held.baseFellPlayerId, null);
    assert.equal(held.units.some((unit) => unit.id === base.id), true);
});

test('the defender places one base during terrain setup and it blocks deployment', () => {
    const app = createAppHarness();
    app.state.setup = {};
    app.state.setupStage = 'terrain-placement';
    app.initializeTerrainPlacement(() => 0);
    const terrain = app.getTerrainSetup();
    assert.equal(terrain.defenderPlayerId, 'player-1');
    assert.equal(terrain.base.playerId, 'player-1');
    assert.equal(terrain.base.faction, 'Panda');
    assert.ok(geometry.footprintInsideBoard(app.basePlacementToUnit(terrain.base)));

    app.state.setup.armies = {
        'player-1': { counts: { Blade: 1 }, random: false },
        'player-2': { counts: { Spear: 1 }, random: false }
    };
    app.initializeUnitDeployment();
    const bases = app.state.units.filter((unit) => unit.type === 'Base');
    assert.equal(bases.length, 1);
    assert.equal(bases[0].playerId, 'player-1');
    assert.equal(app.getDeploymentSetup().tray.some((entry) => entry.type === 'Base'), false);

    const overlapping = data.createUnit('Blade', 'player-1', 'Panda', {
        x: bases[0].x + 10,
        y: bases[0].y + 10,
        rotation: 0
    }, () => 'overlap');
    assert.ok(app.findDeploymentOverlap(overlapping, overlapping.id));
    app.state.selectedIds = [bases[0].id];
    app.state.mode = 'edit';
    assert.equal(app.canManipulateSelection(), false);

    app.state.mode = 'game';
    app.state.phase = 'melee';
    app.state.terrain = { roads: [], features: [] };
    app.state.units = [
        bases[0],
        data.createUnit('Blade', 'player-2', 'Undead', {
            x: bases[0].x + 40,
            y: bases[0].y,
            rotation: Math.PI
        }, () => 'attacker-blade')
    ];
    app.scheduleControllerAction = () => {};
    const rolls = [];
    app.rollDie = () => {
        rolls.push(rolls.length);
        return rolls.length % 2 === 1 ? 1 : 6;
    };
    app.resolveMeleePhase();
    assert.equal(app.state.victory?.reasonId, 'base-lost');
    assert.equal(app.state.victory.loserPlayerId, 'player-1');
    assert.match(app.describeVictoryReason(app.state.victory), /base has fallen/);
});

test('form-up closes on a round base outline instead of its bounding box', () => {
    const base = data.createUnit('Base', 'player-2', 'Undead', { x: 240, y: 400, rotation: 0 }, () => 'undead-base');
    const outline = geometry.getUnitFootprintPoints(base);
    const top = outline.reduce((best, point) => (point.y < best.y ? point : best), outline[0]);
    const blade = data.createUnit('Blade', 'player-1', 'Gunpowder', {
        x: top.x + 20,
        y: top.y - 12,
        rotation: Math.PI
    }, () => 'blade');
    const terrain = { roads: [], features: [] };
    const result = rules.resolveAutomaticFormUp([blade, base], 'player-1', terrain);
    const formed = result.units.find((unit) => unit.id === 'blade');
    const gap = geometry.unitsMinDistance(formed, base);
    const corners = geometry.getUnitCorners(base);
    const formedFront = geometry.getUnitCorners(formed);
    const frontMid = {
        x: (formedFront.frontLeft.x + formedFront.frontRight.x) / 2,
        y: (formedFront.frontLeft.y + formedFront.frontRight.y) / 2
    };

    assert.deepEqual(result.movedUnitIds, ['blade']);
    assert.ok(gap <= data.COLLISION_EPSILON + 0.05);
    assert.equal(rules.detectMeleeCombats(result.units).combats.length, 1);
    assert.ok(geometry.distance(frontMid, top) < 2);
    assert.ok(geometry.distance(frontMid, corners.frontLeft) > 20);
    assert.ok(geometry.distance(frontMid, corners.frontRight) > 20);
});

test('a base takes no flank penalty from side contact', () => {
    const base = data.createUnit('Base', 'player-2', 'Panda', { x: 220, y: 400, rotation: 0 }, () => 'base');
    const blade = data.createUnit('Blade', 'player-1', 'Goblin', {
        x: base.x,
        y: base.y + 30,
        rotation: Math.PI / 2
    }, () => 'blade');
    const terrain = { roads: [], features: [] };
    const preview = rules.previewMeleeCombats([base, blade], terrain);
    assert.equal(preview.length, 1);
    const modifiers = [...preview[0].left.modifiers, ...preview[0].right.modifiers];
    assert.equal(modifiers.some((modifier) => modifier.id === 'flank-attacked'), false);
});

test('flyers beside a base form up square to that side', () => {
    const base = data.createUnit('Base', 'player-2', 'Panda', { x: 219.825, y: 500.32, rotation: 0 }, () => 'base');
    const flyers = [
        { id: 'f1', x: 218.6, y: 478.9 },
        { id: 'f2', x: 218.3, y: 518.8 },
        { id: 'f3', x: 217.9, y: 558.8 }
    ].map((pose) => data.createUnit('Flyers', 'player-1', 'Dinosaurs', {
        x: pose.x,
        y: pose.y,
        rotation: Math.PI / 2
    }, () => pose.id));
    const result = rules.resolveAutomaticFormUp(flyers.concat([base]), 'player-1', { roads: [], features: [] });
    const formed = result.units.filter((unit) => unit.type === 'Flyers');

    assert.deepEqual(result.movedUnitIds.slice().sort(), ['f1', 'f2', 'f3']);
    formed.forEach((flyer) => {
        assert.ok(geometry.unitsMinDistance(flyer, base) <= 0.6);
        assert.ok(Math.abs(geometry.normalizeAngle(flyer.rotation - (Math.PI / 2))) < 0.05);
    });
});

test('a unit within the base contact fuzz counts as in combat', () => {
    const base = data.createUnit('Base', 'player-2', 'Undead', { x: 240, y: 400, rotation: 0 }, () => 'undead-base');
    const outline = geometry.getUnitFootprintPoints(base);
    const top = outline.reduce((best, point) => (point.y < best.y ? point : best), outline[0]);
    const close = data.createUnit('Blade', 'player-1', 'Gunpowder', {
        x: top.x + 20,
        y: top.y - (data.BASE_CONTACT_FUZZ - 0.5),
        rotation: Math.PI
    }, () => 'close-blade');
    const clear = data.createUnit('Blade', 'player-1', 'Gunpowder', {
        x: top.x + 20,
        y: top.y - (data.BASE_CONTACT_FUZZ + 2),
        rotation: Math.PI
    }, () => 'clear-blade');

    assert.equal(geometry.unitsOverlap(close, base), false);
    assert.equal(rules.detectMeleeCombats([close, base]).combats.length, 1);
    assert.equal(rules.detectMeleeCombats([clear, base]).combats.length, 0);
});

function placeAgainstBase(type, id, x, y = 300) {
    return data.createUnit(type, 'player-2', 'Undead', { x, y, rotation: Math.PI }, () => id);
}

function baseSide(preview) {
    return preview.left.primaryType === 'Base' ? preview.left : preview.right;
}

function attackerSide(preview) {
    return preview.left.primaryType === 'Base' ? preview.right : preview.left;
}

test('a base assault uses the strongest foot factor, then the cheapest unit', () => {
    const terrain = { roads: [], features: [] };
    const base = data.createUnit('Base', 'player-1', 'Panda', { x: 100, y: 300, rotation: 0 }, () => 'panda-base');
    const blade = placeAgainstBase('Blade', 'blade', 140);
    const hero = placeAgainstBase('Hero', 'hero', 190);
    const heroFight = rules.previewMeleeCombats([base, blade, hero], terrain);
    assert.equal(heroFight.length, 1);
    assert.equal(attackerSide(heroFight[0]).primaryId, 'blade');
    assert.equal(attackerSide(heroFight[0]).strength, 5);
    assert.equal(baseSide(heroFight[0]).factor, 5);
    const support = baseSide(heroFight[0]).modifiers.find((modifier) => modifier.id === 'stronghold-support');
    assert.equal(support.value, -1);
    assert.match(support.detail, /Hero/);

    const behemoth = placeAgainstBase('Behemoth', 'behemoth', 190);
    const footFight = rules.previewMeleeCombats([base, hero, behemoth], terrain);
    assert.equal(attackerSide(footFight[0]).primaryId, 'hero');
    assert.equal(attackerSide(footFight[0]).strength, 5);
});

test('supporting attackers do not share the stronghold result', () => {
    const terrain = { roads: [], features: [] };
    const base = data.createUnit('Base', 'player-1', 'Panda', { x: 100, y: 300, rotation: 0 }, () => 'panda-base');
    const blade = placeAgainstBase('Blade', 'blade', 140);
    const knights = placeAgainstBase('Knights', 'knights', 190);
    const resolved = rules.resolveMelee([base, blade, knights], terrain, (info) => {
        const bladeIsLeft = info.leftPrimaryId === 'blade';
        if (info.role === 'left') {
            return bladeIsLeft ? 1 : 6;
        }
        return bladeIsLeft ? 6 : 1;
    });
    const fight = resolved.results[0];
    assert.equal(resolved.results.length, 1);
    assert.equal(fight.outcome, 'recoil');
    assert.equal(fight.leftPrimaryId === 'blade' || fight.rightPrimaryId === 'blade', true);
    const movedBlade = resolved.units.find((unit) => unit.id === 'blade');
    const stayedKnights = resolved.units.find((unit) => unit.id === 'knights');
    assert.notEqual(movedBlade.y, blade.y);
    assert.equal(stayedKnights.x, knights.x);
    assert.equal(stayedKnights.y, knights.y);
    assert.equal(resolved.units.some((unit) => unit.id === 'panda-base'), true);
});

test('a tied stronghold assault picks at random among the cheapest units', () => {
    const terrain = { roads: [], features: [] };
    const base = data.createUnit('Base', 'player-1', 'Panda', { x: 100, y: 300, rotation: 0 }, () => 'panda-base');
    const first = placeAgainstBase('Blade', 'blade-a', 140);
    const second = placeAgainstBase('Blade', 'blade-b', 190);
    const resolved = rules.resolveMelee([base, first, second], terrain, () => 3, () => 0.99);
    const fight = resolved.results[0];
    const fighterId = fight.leftPrimaryId === 'panda-base' ? fight.rightPrimaryId : fight.leftPrimaryId;
    assert.equal(fighterId, 'blade-b');
    const baseModifiers = fight.leftPrimaryId === 'panda-base' ? fight.leftModifiers : fight.rightModifiers;
    assert.equal(baseModifiers.find((modifier) => modifier.id === 'stronghold-support').value, -1);
});

test('a file behind the stronghold fighter still supports that fighter', () => {
    const terrain = { roads: [], features: [] };
    const base = data.createUnit('Base', 'player-1', 'Panda', { x: 100, y: 300, rotation: 0 }, () => 'panda-base');
    const spear = placeAgainstBase('Spear', 'spear', 140);
    const rear = placeAgainstBase('Spear', 'rear-spear', 140, 280);
    const knights = placeAgainstBase('Knights', 'knights', 190);
    const preview = rules.previewMeleeCombats([base, spear, rear, knights], terrain);
    assert.equal(preview.length, 1);
    assert.equal(attackerSide(preview[0]).primaryId, 'spear');
    assert.equal(attackerSide(preview[0]).modifiers.some((modifier) => modifier.id === 'stacked'), true);
    assert.equal(attackerSide(preview[0]).factor, 5);
    const support = baseSide(preview[0]).modifiers.find((modifier) => modifier.id === 'stronghold-support');
    assert.equal(support.value, -1);
    assert.match(support.detail, /Knights/);
});

test('flyers support a ground assault and cannot capture a base alone', () => {
    const terrain = { roads: [], features: [] };
    const base = data.createUnit('Base', 'player-1', 'Panda', { x: 100, y: 300, rotation: 0 }, () => 'panda-base');
    const horde = placeAgainstBase('Horde', 'horde', 140);
    const flyer = placeAgainstBase('Flyers', 'flyer', 190);
    const preview = rules.previewMeleeCombats([base, horde, flyer], terrain);
    assert.equal(preview.length, 1);
    assert.equal(attackerSide(preview[0]).primaryId, 'horde');
    assert.match(baseSide(preview[0]).modifiers.find((modifier) => modifier.id === 'stronghold-support').detail, /Flyers/);

    const alone = placeAgainstBase('Flyers', 'solo-flyer', 140);
    const held = rules.resolveMelee([base, alone], terrain, (info) => {
        const flyerIsLeft = info.leftPrimaryId === 'solo-flyer';
        if (info.role === 'left') {
            return flyerIsLeft ? 6 : 1;
        }
        return flyerIsLeft ? 1 : 6;
    });
    assert.equal(held.results.length, 1);
    assert.equal(held.results[0].outcome, 'tie');
    assert.equal(held.baseFellPlayerId, null);
    assert.equal(held.units.some((unit) => unit.id === 'panda-base'), true);
    assert.equal(held.units.find((unit) => unit.id === 'solo-flyer').y, alone.y);
});

test('a base starts within 400 paces of the center of the defended edge', () => {
    const app = createAppHarness();
    app.state.setup = {};
    app.state.setupStage = 'terrain-placement';
    app.initializeTerrainPlacement(() => 0);
    const placed = app.basePlacementToUnit(app.getDefenderBase());
    assert.ok(geometry.baseClearanceFromDefendedEdge(placed) <= data.BASE_EDGE_CLEARANCE + 0.05);
    assert.ok(geometry.footprintInsideBoard(placed));

    app.getTerrainSetup().base.x = 0;
    app.getTerrainSetup().terrainCount = 0;
    const shoved = app.basePlacementToUnit(app.getDefenderBase());
    assert.ok(geometry.baseClearanceFromDefendedEdge(shoved) > data.BASE_EDGE_CLEARANCE);
    assert.equal(app.isTerrainReady(), false);
});
