const test = require('node:test');
const assert = require('node:assert/strict');

const history = require('../src/history.js');

test('createEditSnapshot clones units and selection state', () => {
    const units = [
        { id: 'u1', x: 10, y: 20, rotation: 0 },
        { id: 'u2', x: 30, y: 40, rotation: 1 }
    ];
    const selectedIds = ['u1'];
    const losses = { 'player-1': [{ id: 'u1', type: 'Blade', value: 2 }], 'player-2': [] };
    const reserveUnits = [{ id: 'r1', x: 0, y: 0 }];

    const snapshot = history.createEditSnapshot(units, selectedIds, 7, losses, reserveUnits);
    units[0].x = 999;
    selectedIds.push('u2');
    losses['player-1'][0].value = 99;
    reserveUnits[0].x = 888;

    assert.equal(snapshot.units[0].x, 10);
    assert.deepEqual(snapshot.selectedIds, ['u1']);
    assert.equal(snapshot.nextUnitId, 7);
    assert.equal(snapshot.losses['player-1'][0].value, 2);
    assert.equal(snapshot.reserveUnits[0].x, 0);
});

test('restoreEditSnapshot returns cloned state for undo application', () => {
    const snapshot = {
        units: [
            { id: 'u1', x: 10, y: 20, rotation: 0 },
            { id: 'u2', x: 30, y: 40, rotation: 1 }
        ],
        selectedIds: ['u2'],
        nextUnitId: 3,
        losses: { 'player-1': [{ id: 'u1', type: 'Blade', value: 2 }], 'player-2': [] },
        reserveUnits: [{ id: 'r1', x: 5, y: 6 }]
    };

    const restored = history.restoreEditSnapshot(snapshot);
    restored.units[0].x = 777;
    restored.selectedIds.push('u1');
    restored.losses['player-1'][0].value = 999;

    assert.equal(snapshot.units[0].x, 10);
    assert.deepEqual(snapshot.selectedIds, ['u2']);
    assert.equal(restored.nextUnitId, 3);
    assert.equal(snapshot.losses['player-1'][0].value, 2);
    assert.deepEqual(restored.reserveUnits, [{ id: 'r1', x: 5, y: 6 }]);
});