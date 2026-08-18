const test = require('node:test');
const assert = require('node:assert/strict');

const data = require('../src/data.js');
const geometry = require('../src/geometry.js');
const terrainCatalog = require('../assets/terrain/catalog.json');

test('interpolateUnitPose keeps the center fixed during pure rotation', () => {
    const origin = {
        id: 'u1',
        width: 40,
        depth: 20,
        x: 140,
        y: 520,
        rotation: 0
    };
    const center = geometry.getUnitCenter(origin);
    const current = geometry.buildUnitFromCenter(origin, center, Math.PI / 2);
    const halfway = geometry.interpolateUnitPose(origin, current, 0.5);

    assert.deepEqual(geometry.getUnitCenter(halfway), center);
    assert.equal(halfway.rotation, Math.PI / 4);
});

test('polygonsOverlap treats shared edges as contact, not overlap', () => {
    const left = { id: 'a', width: 40, depth: 20, x: 100, y: 200, rotation: 0 };
    const right = { id: 'b', width: 40, depth: 20, x: 140, y: 200, rotation: 0 };

    assert.equal(geometry.polygonsOverlap(geometry.getUnitCorners(left), geometry.getUnitCorners(right)), false);
});

test('minDistanceBetweenPolygons measures the gap between separated bases', () => {
    const left = { id: 'a', width: 40, depth: 40, x: 100, y: 200, rotation: 0 };
    const right = { id: 'b', width: 40, depth: 40, x: 190, y: 200, rotation: 0 };

    assert.equal(geometry.minDistanceBetweenPolygons(geometry.getUnitCorners(left), geometry.getUnitCorners(right)), 50);
    assert.equal(geometry.minDistanceBetweenPolygons(geometry.getUnitCorners(left), geometry.getUnitCorners(left)), 0);
});

test('reverseUnitFacing preserves the occupied rectangle while swapping facing', () => {
    const unit = { id: 'u1', width: 40, depth: 20, x: 100, y: 200, rotation: 0 };
    const reversed = geometry.reverseUnitFacing(unit);

    assert.equal(geometry.sameFootprint(unit, reversed), true);
    assert.equal(reversed.rotation, Math.PI);
});

test('findFriendlySnapOffset snaps parallel friendly units into side alignment', () => {
    const stationary = { id: 's1', playerId: 'player-1', width: 40, depth: 20, x: 100, y: 200, rotation: 0 };
    const moving = { id: 'm1', playerId: 'player-1', width: 40, depth: 20, x: 145, y: 200, rotation: 0 };

    const offset = geometry.findFriendlySnapOffset([moving], [stationary]);

    assert.deepEqual(offset, { x: -5, y: 0 });
});

test('findFriendlySnapOffset snaps colliding friendly units to nearest corner contact more aggressively', () => {
    const stationary = { id: 's1', playerId: 'player-1', width: 40, depth: 20, x: 100, y: 200, rotation: 0 };
    const moving = { id: 'm1', playerId: 'player-1', width: 40, depth: 20, x: 136, y: 183, rotation: 0 };

    const offset = geometry.findFriendlySnapOffset([moving], [stationary]);

    assert.deepEqual(offset, { x: 4, y: -3 });
});

test('pointInBlob respects the feature rotation', () => {
    const feature = { cx: 100, cy: 100, rx: 50, ry: 20, wobble: 0, rotation: Math.PI / 2 };

    assert.equal(geometry.pointInBlob({ x: 100, y: 140 }, feature), true);
    assert.equal(geometry.pointInBlob({ x: 140, y: 100 }, feature), false);
});

test('terrain wobble keeps the feature center inside a still-recognizable outline', () => {
    const feature = { cx: 100, cy: 100, rx: 50, ry: 40, wobble: 0.24, shape: 'square', rotation: 0 };

    assert.equal(geometry.pointInBlob({ x: 100, y: 100 }, feature), true);
    assert.equal(geometry.pointInBlob({ x: 100, y: 170 }, feature), false);
});

test('terrain assets store original and waved outlines for every shape', () => {
    data.TERRAIN_SHAPES.forEach((shape) => {
        assert.ok((terrainCatalog.original[shape] || []).length >= 3, shape);
        assert.ok((terrainCatalog.waved[shape] || []).length >= 3, shape);
    });
    assert.equal(terrainCatalog.original['fat-l'].length, 6);
    assert.ok(terrainCatalog.waved['fat-l'].length > terrainCatalog.original['fat-l'].length);
});

test('applyTerrainOutlineWave remains available for uploaded terrain blocks', () => {
    const local = geometry.getTerrainShapeLocalPoints('fat-l');
    const waved = geometry.applyTerrainOutlineWave(
        { cx: 0, cy: 0, rx: 80, ry: 80, rotation: 0, wobble: 0.24, shape: 'fat-l' },
        local.map((point) => ({ x: point.x * 80, y: point.y * 80 }))
    );

    assert.equal(local.length, 6);
    assert.ok(waved.length > local.length);
});

test('blob keeps its radial identity wave before the shared edge wave', () => {
    const blob = geometry.getTerrainShapeLocalPoints('blob', 48, { wobble: 0.24 });
    const circle = geometry.getTerrainShapeLocalPoints('circle', 48);
    const blobRadii = blob.map((point) => Math.hypot(point.x, point.y));
    const circleRadii = circle.map((point) => Math.hypot(point.x, point.y));

    assert.ok(Math.max(...blobRadii) - Math.min(...blobRadii) > 0.15);
    assert.ok(Math.max(...circleRadii) - Math.min(...circleRadii) < 0.001);
});

test('lightbulb stem is narrower and longer than the bulb', () => {
    const points = geometry.getTerrainShapeLocalPoints('lightbulb');
    const stem = points.filter((point) => point.y > 0.35);
    const bulb = points.filter((point) => point.y < 0);
    const stemWidth = Math.max(...stem.map((point) => Math.abs(point.x)));
    const bulbWidth = Math.max(...bulb.map((point) => Math.abs(point.x)));

    assert.ok(stemWidth < bulbWidth * 0.75);
    assert.ok(Math.max(...points.map((point) => point.y)) > 0.9);
});