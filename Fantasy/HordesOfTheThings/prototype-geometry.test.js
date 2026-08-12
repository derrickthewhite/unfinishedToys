const test = require('node:test');
const assert = require('node:assert/strict');

const geometry = require('./prototype-geometry.js');

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

test('reverseUnitFacing preserves the occupied rectangle while swapping facing', () => {
    const unit = { id: 'u1', width: 40, depth: 20, x: 100, y: 200, rotation: 0 };
    const reversed = geometry.reverseUnitFacing(unit);

    assert.equal(geometry.sameFootprint(unit, reversed), true);
    assert.equal(reversed.rotation, Math.PI);
});

test('findFriendlySnapOffset snaps parallel friendly units into side alignment', () => {
    const stationary = { id: 's1', side: 'blue', width: 40, depth: 20, x: 100, y: 200, rotation: 0 };
    const moving = { id: 'm1', side: 'blue', width: 40, depth: 20, x: 145, y: 200, rotation: 0 };

    const offset = geometry.findFriendlySnapOffset([moving], [stationary]);

    assert.deepEqual(offset, { x: -5, y: 0 });
});

test('findFriendlySnapOffset snaps colliding friendly units to nearest corner contact more aggressively', () => {
    const stationary = { id: 's1', side: 'blue', width: 40, depth: 20, x: 100, y: 200, rotation: 0 };
    const moving = { id: 'm1', side: 'blue', width: 40, depth: 20, x: 136, y: 183, rotation: 0 };

    const offset = geometry.findFriendlySnapOffset([moving], [stationary]);

    assert.deepEqual(offset, { x: 4, y: -3 });
});

test('pointInBlob respects the feature rotation', () => {
    const feature = { cx: 100, cy: 100, rx: 50, ry: 20, wobble: 0, rotation: Math.PI / 2 };

    assert.equal(geometry.pointInBlob({ x: 100, y: 140 }, feature), true);
    assert.equal(geometry.pointInBlob({ x: 140, y: 100 }, feature), false);
});