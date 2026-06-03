const test = require('node:test');
const assert = require('node:assert/strict');

const history = require('./prototype-history.js');

test('createEditSnapshot clones units and selection state', () => {
    const units = [
        { id: 'u1', x: 10, y: 20, rotation: 0 },
        { id: 'u2', x: 30, y: 40, rotation: 1 }
    ];
    const selectedIds = ['u1'];

    const snapshot = history.createEditSnapshot(units, selectedIds, 7);
    units[0].x = 999;
    selectedIds.push('u2');

    assert.equal(snapshot.units[0].x, 10);
    assert.deepEqual(snapshot.selectedIds, ['u1']);
    assert.equal(snapshot.nextUnitId, 7);
});

test('restoreEditSnapshot returns cloned state for undo application', () => {
    const snapshot = {
        units: [
            { id: 'u1', x: 10, y: 20, rotation: 0 },
            { id: 'u2', x: 30, y: 40, rotation: 1 }
        ],
        selectedIds: ['u2'],
        nextUnitId: 3
    };

    const restored = history.restoreEditSnapshot(snapshot);
    restored.units[0].x = 777;
    restored.selectedIds.push('u1');

    assert.equal(snapshot.units[0].x, 10);
    assert.deepEqual(snapshot.selectedIds, ['u2']);
    assert.equal(restored.nextUnitId, 3);
});