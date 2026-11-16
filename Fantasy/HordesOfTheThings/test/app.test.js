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

test('unit asset lookup includes generic artwork for the remaining unit types', () => {
    const app = createAppHarness();

    ['Heavy-Spear', 'Heavy-Warband', 'Beasts', 'Flyers', 'Behemoth'].forEach((type) => {
        assert.equal(app.getUnitAssetPath({ type, faction: 'Panda' }), `assets/${type}.svg`);
    });
    assert.equal(app.getUnitAssetPath({ type: 'Artillery', faction: 'Undead' }), 'assets/Artillery.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Magician', faction: 'Undead' }), 'assets/undead/Magician.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Spear', faction: 'Goblin' }), 'assets/goblin/Spear.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Blade', faction: 'Goblin' }), 'assets/Blade.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Artillery', faction: 'Gunpowder' }), 'assets/gunpowder/Artillery.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Hero', faction: 'Gunpowder' }), 'assets/Hero.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Behemoth', faction: 'Dinosaurs' }), 'assets/dinosaurs/Behemoth.svg');
    assert.equal(app.getUnitAssetPath({ type: 'Blade', faction: 'Dinosaurs' }), 'assets/Blade.svg');
});

test('left wheeling bubble stays outside the rank and mirrors the right bubble rotation', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const analysis = app.state.selectionAnalysis;
    const handles = app.getSelectionHandles();
    const leftHandle = handles.find((handle) => handle.kind === 'rank-left');
    const rightHandle = handles.find((handle) => handle.kind === 'rank-right');
    const leftOffset = geometry.subtract(leftHandle.position, analysis.leftHandle);

    assert.equal(analysis.type, 'rank');
    assert.ok(geometry.dot(leftOffset, analysis.leftOutward) > 15);
    assert.ok(Math.abs(geometry.normalizeAngle(leftHandle.rotation - rightHandle.rotation)) < 0.001);
});

test('convert bubble sits behind the formation', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const analysis = app.state.selectionAnalysis;
    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'formation-convert');
    const info = app.getFormationCenterInfo(analysis);
    const offset = geometry.subtract(handle.position, info.formationCenter);

    assert.ok(geometry.dot(offset, analysis.forward) < -15);
});

test('rank wheeling only allows forward rotation', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'rank-left');
    const baseSnapshot = geometry.snapshotPositions(app.state.selectedIds, app.state.units);
    const baseRotation = units[0].rotation;
    const allowedDelta = handle.forwardRotationSign > 0 ? 0.3 : -0.3;
    const blockedDelta = -allowedDelta;

    app.state.interaction = {
        type: 'rotate-rank',
        pointerId: 1,
        startClientX: 0,
        startClientY: 0,
        moved: false,
        dragBase: baseSnapshot,
        pivot: handle.pivot,
        anchorAngle: geometry.angleBetween(handle.pivot, handle.position),
        draftIds: [...app.state.selectedIds],
        forwardRotationSign: handle.forwardRotationSign
    };

    const backwardWorld = geometry.rotatePoint(handle.position, handle.pivot, blockedDelta);
    app.onPointerMove({ pointerId: 1, clientX: backwardWorld.x, clientY: backwardWorld.y });
    assert.ok(Math.abs(app.state.units[0].rotation - baseRotation) < 0.0001);

    geometry.restoreSnapshot(baseSnapshot, app.state.units);
    app.state.interaction.anchorAngle = geometry.angleBetween(handle.pivot, handle.position);
    const forwardWorld = geometry.rotatePoint(handle.position, handle.pivot, allowedDelta);
    app.onPointerMove({ pointerId: 1, clientX: forwardWorld.x, clientY: forwardWorld.y });
    assert.ok(Math.abs(app.state.units[0].rotation - baseRotation) > 0.05);
});

test('move-rank keeps an angled contact element formed up while the other element keeps moving forward', () => {
    const blueUnits = createRankPair('b1', 'b2', 100, 200, 0);
    const redUnits = createRankPair('r1', 'r2', 100, 100, Math.PI / 4, 'player-2');
    const app = createAppHarness({
        state: {
            units: [...blueUnits, ...redUnits],
            terrain: { roads: [], features: [] },
            selectedIds: ['b1', 'b2'],
            snapEnabled: false
        }
    });
    app.updateSelectionAnalysis();

    app.state.draft = {
        unitIds: ['b1', 'b2'],
        initialOrigin: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        validationOrigin: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        origin: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        history: [],
        invalidIds: new Set(),
        reasonById: new Map(),
        allowSingleRotationFormationEscape: false
    };

    const analysis = app.state.selectionAnalysis;
    app.state.interaction = {
        type: 'move-rank',
        pointerId: 1,
        startClientX: 0,
        startClientY: 0,
        moved: false,
        dragBase: geometry.snapshotPositions(['b1', 'b2'], app.state.units),
        draftIds: ['b1', 'b2'],
        anchorWorld: { x: 0, y: 0 },
        rankAnalysis: analysis
    };

    const firstWorld = geometry.scaleVector(analysis.forward, 100);
    app.onPointerMove({ pointerId: 1, clientX: firstWorld.x, clientY: firstWorld.y });
    const firstSnapshot = geometry.snapshotPositions(['b1', 'b2'], app.state.units);

    assert.ok(Math.abs(app.getUnitById('b1').rotation + (3 * Math.PI / 4)) < 0.01);
    assert.ok(Math.abs(app.getUnitById('b2').rotation) < 0.01);
    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(app.state.selectionAnalysis.invalid, false);

    const secondWorld = geometry.scaleVector(analysis.forward, 140);
    app.onPointerMove({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });

    assert.equal(geometry.sameFootprint(firstSnapshot.b1, app.getUnitById('b1')), true);
    assert.equal(geometry.sameFootprint(firstSnapshot.b2, app.getUnitById('b2')), false);

    app.onPointerUp({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });
    assert.equal(app.state.selectionAnalysis.type, 'invalid');
    assert.equal(app.state.selectionAnalysis.invalid, true);
});

test('rotate-rank keeps an angled contact element formed up while the other element keeps wheeling', () => {
    const blueUnits = createRankPair('u1', 'u2', 240, 260, 0);
    const redUnits = createRankPair('e1', 'e2', 220, 200, Math.PI / 4, 'player-2');
    const app = createAppHarness({
        state: {
            units: [...blueUnits, ...redUnits],
            terrain: { roads: [], features: [] },
            selectedIds: ['u1', 'u2'],
            snapEnabled: false
        }
    });
    app.updateSelectionAnalysis();

    app.state.draft = {
        unitIds: ['u1', 'u2'],
        initialOrigin: geometry.snapshotPositions(['u1', 'u2'], app.state.units),
        validationOrigin: geometry.snapshotPositions(['u1', 'u2'], app.state.units),
        origin: geometry.snapshotPositions(['u1', 'u2'], app.state.units),
        history: [],
        invalidIds: new Set(),
        reasonById: new Map(),
        allowSingleRotationFormationEscape: false
    };

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'rank-left');
    const initialSnapshot = geometry.snapshotPositions(['u1', 'u2'], app.state.units);
    app.state.interaction = {
        type: 'rotate-rank',
        pointerId: 1,
        startClientX: 0,
        startClientY: 0,
        moved: false,
        dragBase: initialSnapshot,
        pivot: handle.pivot,
        anchorAngle: geometry.angleBetween(handle.pivot, handle.position),
        draftIds: ['u1', 'u2'],
        forwardRotationSign: handle.forwardRotationSign,
        rankAnalysis: app.state.selectionAnalysis
    };

    const firstWorld = geometry.rotatePoint(handle.position, handle.pivot, handle.forwardRotationSign > 0 ? 0.75 : -0.75);
    app.onPointerMove({ pointerId: 1, clientX: firstWorld.x, clientY: firstWorld.y });
    const firstSnapshot = geometry.snapshotPositions(['u1', 'u2'], app.state.units);

    assert.ok(Math.abs(app.getUnitById('u1').rotation + (Math.PI / 4)) < 0.01);
    assert.ok(Math.abs(app.getUnitById('u2').rotation - 0.75) < 0.01);
    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(app.state.selectionAnalysis.invalid, false);

    const secondWorld = geometry.rotatePoint(handle.position, handle.pivot, handle.forwardRotationSign > 0 ? 0.95 : -0.95);
    app.onPointerMove({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });

    assert.equal(geometry.sameFootprint(firstSnapshot.u1, app.getUnitById('u1')), true);
    assert.equal(geometry.sameFootprint(firstSnapshot.u2, app.getUnitById('u2')), false);

    app.onPointerUp({ pointerId: 1, clientX: secondWorld.x, clientY: secondWorld.y });
    assert.equal(app.state.selectionAnalysis.type, 'invalid');
    assert.equal(app.state.selectionAnalysis.invalid, true);
});

test('reverseSelection keeps a rank front-aligned even with mixed depths', () => {
    const units = [
        createBlade('u1', 100, 220),
        { ...createBlade('u2', 140, 220), type: 'Riders', depth: 30 },
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    const originalCenter = app.getFormationCenterInfo(rules.analyzeSelection(units)).formationCenter;
    app.updateSelectionAnalysis();

    app.applyReverseSelection();

    assert.equal(app.state.selectionAnalysis.type, 'rank');
    const frontCenters = app.state.selectedIds.map((unitId) => app.getUnitFrontCenter(app.getUnitById(unitId)));
    const forward = app.state.selectionAnalysis.forward;
    const projections = frontCenters.map((point) => geometry.dot(point, forward));
    projections.forEach((projection) => {
        assert.ok(Math.abs(projection - projections[0]) < 0.001);
    });
    const reversedCenter = app.getFormationCenterInfo(app.state.selectionAnalysis).formationCenter;
    assert.ok(geometry.distance(reversedCenter, originalCenter) < 0.001);
});

test('edit mode click selects a single unit without requiring a drag', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units
        }
    });
    const center = geometry.getUnitCenter(units[0]);

    app.onPointerDown({ pointerId: 1, button: 0, clientX: center.x, clientY: center.y, shiftKey: false });
    app.onPointerUp({ pointerId: 1, clientX: center.x, clientY: center.y });

    assert.deepEqual(app.state.selectedIds, ['u1']);
    assert.equal(app.state.selectionAnalysis.type, 'single');
});

test('game mode click selects a single enemy unit for inspection', () => {
    const friendly = createBlade('u1', 100, 220);
    const enemy = createBlade('u2', 140, 220, 'player-2');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            units: [friendly, enemy]
        }
    });
    const center = geometry.getUnitCenter(enemy);

    app.onPointerDown({ pointerId: 1, button: 0, clientX: center.x, clientY: center.y, shiftKey: false });
    app.onPointerUp({ pointerId: 1, clientX: center.x, clientY: center.y });

    assert.deepEqual(app.state.selectedIds, ['u2']);
    assert.equal(app.state.selectionAnalysis.type, 'single');
});

test('game mode shift-click ignores enemy units during multi-select', () => {
    const friendly = createBlade('u1', 100, 220);
    const enemy = createBlade('u2', 140, 220, 'player-2');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            units: [friendly, enemy],
            selectedIds: ['u1']
        }
    });
    app.updateSelectionAnalysis();
    const center = geometry.getUnitCenter(enemy);

    app.onPointerDown({ pointerId: 1, button: 0, clientX: center.x, clientY: center.y, shiftKey: true });
    app.onPointerUp({ pointerId: 1, clientX: center.x, clientY: center.y, shiftKey: true });

    assert.deepEqual(app.state.selectedIds, ['u1']);
});

test('edit mode delete removes selected units without recording losses', () => {
    const units = [createBlade('u1', 100, 220), createBlade('u2', 200, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            setupStage: 'game',
            units,
            selectedIds: ['u1', 'u2']
        }
    });

    app.removeSelectedUnits({ countAsLoss: false });

    assert.deepEqual(app.state.units, []);
    assert.deepEqual(app.state.selectedIds, []);
    assert.deepEqual(app.state.losses['player-1'], []);
});

test('edit mode destroy removes selected units and records losses', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            setupStage: 'game',
            units,
            selectedIds: ['u1']
        }
    });

    app.removeSelectedUnits({ countAsLoss: true });

    assert.equal(app.state.units.length, 0);
    assert.deepEqual(app.state.losses['player-1'], [{ id: 'u1', type: 'Blade', value: 2 }]);
});

test('edit mode destroy undo restores units and losses', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            setupStage: 'game',
            units,
            selectedIds: ['u1']
        }
    });

    app.removeSelectedUnits({ countAsLoss: true });
    app.undoEditStep();

    assert.equal(app.state.units.length, 1);
    assert.equal(app.state.units[0].id, 'u1');
    assert.deepEqual(app.state.losses['player-1'], []);
    assert.deepEqual(app.state.selectedIds, ['u1']);
});

test('edit mode delete clears an existing loss entry for a reserve unit', () => {
    const reserved = { ...createBlade('u1', 0, 0), playerId: 'player-1' };
    const app = createAppHarness({
        state: {
            mode: 'edit',
            setupStage: 'game',
            units: [],
            reserveUnits: [reserved],
            selectedIds: ['u1'],
            losses: {
                'player-1': [{ id: 'u1', type: 'Blade', value: 2 }],
                'player-2': []
            }
        }
    });

    app.removeSelectedUnits({ countAsLoss: false });

    assert.deepEqual(app.state.reserveUnits, []);
    assert.deepEqual(app.state.losses['player-1'], []);
});

test('edit mode destroy of a reserve unit does not double-count losses', () => {
    const reserved = { ...createBlade('u1', 0, 0), playerId: 'player-1' };
    const app = createAppHarness({
        state: {
            mode: 'edit',
            setupStage: 'game',
            units: [],
            reserveUnits: [reserved],
            selectedIds: ['u1'],
            losses: {
                'player-1': [{ id: 'u1', type: 'Blade', value: 2 }],
                'player-2': []
            }
        }
    });

    app.removeSelectedUnits({ countAsLoss: true });

    assert.deepEqual(app.state.reserveUnits, []);
    assert.deepEqual(app.state.losses['player-1'], [{ id: 'u1', type: 'Blade', value: 2 }]);
});

test('edit mode single-unit rotation handle still rotates the unit', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: ['u1']
        }
    });
    app.updateSelectionAnalysis();

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'single-rotate');
    const center = geometry.getUnitCenter(units[0]);
    app.onPointerDown({ pointerId: 1, button: 0, clientX: handle.position.x, clientY: handle.position.y, shiftKey: false });
    const rotatedWorld = geometry.rotatePoint(handle.position, center, 0.35);
    app.onPointerMove({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });
    app.onPointerUp({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });

    assert.ok(Math.abs(app.getUnitById('u1').rotation) > 0.1);
});

test('single-unit corner rotation keeps the front corner fixed for forward rotation', () => {
    const units = [createBlade('u1', 100, 220)];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: ['u1'],
            singleRotationMode: 'front-corner'
        }
    });
    app.updateSelectionAnalysis();

    const handle = app.getSelectionHandles().find((entry) => entry.kind === 'single-rotate');
    const center = geometry.getUnitCenter(units[0]);
    const before = geometry.getUnitCorners(units[0]);
    app.onPointerDown({ pointerId: 1, button: 0, clientX: handle.position.x, clientY: handle.position.y, shiftKey: false });
    const rotatedWorld = geometry.rotatePoint(handle.position, center, 0.35);
    app.onPointerMove({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });
    app.onPointerUp({ pointerId: 1, clientX: rotatedWorld.x, clientY: rotatedWorld.y });

    const after = geometry.getUnitCorners(app.getUnitById('u1'));
    assert.ok(Math.abs(after.frontRight.x - before.frontRight.x) < 0.001);
    assert.ok(Math.abs(after.frontRight.y - before.frontRight.y) < 0.001);
    assert.ok(after.frontLeft.y < before.frontLeft.y);
});

test('snapSelection can snap a unit against an enemy frontage', () => {
    const mover = createBlade('u1', 100, 220);
    const enemy = { ...createBlade('u2', 145, 220), playerId: 'player-2' };
    const app = createAppHarness({
        state: {
            units: [mover, enemy],
            selectedIds: ['u1']
        }
    });

    app.snapSelection(['u1']);

    assert.equal(app.getUnitById('u1').x, 105);
    assert.equal(app.getUnitById('u1').y, 220);
});

test('snapSelection leaves positions alone when snapping is disabled', () => {
    const mover = createBlade('u1', 100, 220);
    const enemy = { ...createBlade('u2', 145, 220), playerId: 'player-2' };
    const app = createAppHarness({
        state: {
            units: [mover, enemy],
            selectedIds: ['u1'],
            snapEnabled: false
        }
    });

    app.snapSelection(['u1']);

    assert.equal(app.getUnitById('u1').x, 100);
    assert.equal(app.getUnitById('u1').y, 220);
});

test('keyboard shortcuts toggle snap and rotation modes and step a single draft', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            units: [createBlade('u1', 100, 220)],
            selectedIds: ['u1'],
            selectionAnalysis: { type: 'single', invalid: false, reason: '' },
            draft: {
                unitIds: ['u1'],
                invalidIds: new Set(),
                history: [],
                initialOrigin: {},
                origin: {},
                validationOrigin: {}
            }
        }
    });
    let stepCount = 0;
    app.stepSingleDraft = () => {
        stepCount += 1;
    };

    const firstEvent = { key: 'n', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null };
    const secondEvent = { key: 'r', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null };
    const thirdEvent = { key: 's', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null };

    app.onKeyDown(firstEvent);
    app.onKeyDown(secondEvent);
    app.onKeyDown(thirdEvent);

    assert.equal(app.state.snapEnabled, false);
    assert.equal(app.state.singleRotationMode, 'front-corner');
    assert.equal(stepCount, 1);
});

test('collectGhostUnits includes future form-up positions when preview is enabled in move phase', () => {
    const blue = createBlade('b1', 140, 280);
    blue.playerId = 'player-1';
    blue.rotation = Math.PI / 2;
    const red = { ...createBlade('r1', 190, 310), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            showFormUpPreview: true,
            units: [blue, red]
        }
    });
    app.getFormUpPreview = HordesPrototype.prototype.getFormUpPreview;
    app.collectGhostUnits = HordesPrototype.prototype.collectGhostUnits;

    const ghosts = app.collectGhostUnits();

    assert.equal(ghosts.length, 1);
    assert.equal(ghosts[0].id, 'b1');
    assert.notEqual(ghosts[0].x, blue.x);
    assert.notEqual(ghosts[0].rotation, blue.rotation);
});

test('collectGhostUnits omits future form-up positions when preview is disabled', () => {
    const blue = createBlade('b1', 140, 280);
    blue.rotation = Math.PI / 2;
    const red = { ...createBlade('r1', 190, 310), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activeSide: 'blue',
            showFormUpPreview: false,
            units: [blue, red]
        }
    });
    app.getFormUpPreview = HordesPrototype.prototype.getFormUpPreview;
    app.collectGhostUnits = HordesPrototype.prototype.collectGhostUnits;

    const ghosts = app.collectGhostUnits();

    assert.equal(ghosts.length, 0);
});

test('collectGhostUnits includes future form-up positions when preview is enabled in edit mode', () => {
    const blue = createBlade('b1', 140, 280);
    blue.playerId = 'player-1';
    blue.rotation = Math.PI / 2;
    const red = { ...createBlade('r1', 190, 310), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            mode: 'edit',
            phase: 'move',
            activePlayerId: 'player-1',
            showFormUpPreview: true,
            units: [blue, red]
        }
    });
    app.getFormUpPreview = HordesPrototype.prototype.getFormUpPreview;
    app.collectGhostUnits = HordesPrototype.prototype.collectGhostUnits;

    const ghosts = app.collectGhostUnits();

    assert.equal(ghosts.length, 1);
    assert.equal(ghosts[0].id, 'b1');
    assert.notEqual(ghosts[0].x, blue.x);
});

test('keyboard shortcut toggles form-up preview and persists the checkbox state through sync', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            showFormUpPreview: false
        },
        ui: {
            modeGroup: { hidden: true },
            editModeSettingsButton: { hidden: false },
            editModeSettingsHint: { hidden: true },
            gameModeButton: { classList: { toggle() {} } },
            editGroup: { hidden: false },
            actionGroup: { hidden: false },
            activePlayerSelect: { value: '' },
            remainingMovesInput: { value: '' },
            phaseSelect: { value: '' },
            newUnitTypeSelect: { value: '' },
            placementPlayerSelect: { value: '' },
            placeUnitButton: { textContent: '', disabled: false },
            deleteUnitButton: { hidden: false, disabled: false },
            destroyUnitButton: { hidden: false, disabled: false },
            finishMoveButton: { hidden: false, disabled: false },
            endMovePhaseButton: { hidden: false, disabled: false },
            stepMoveButton: { hidden: false, disabled: false },
            snapLabel: { hidden: false },
            snapCheckbox: { checked: false },
            formUpPreviewLabel: { hidden: false },
            formUpPreviewCheckbox: { checked: false },
            cornerRotationLabel: { hidden: false },
            cornerRotationCheckbox: { checked: false },
            rangedAreaLabel: { hidden: false },
            rangedAreaCheckbox: { checked: false },
            moveErrorsLabel: { hidden: false },
            moveErrorsCheckbox: { checked: false },
            battleStatsLabel: { hidden: false },
            battleStatsCheckbox: { checked: false },
            statusLabel: { hidden: false },
            statusCheckbox: { checked: true },
            statusGroup: { hidden: false },
            resolveShootingButton: { hidden: false, textContent: '', disabled: false },
            cancelMoveButton: { hidden: false, disabled: false },
            undoMoveButton: { hidden: false, disabled: false },
            acknowledgedButton: { hidden: false, disabled: false },
            storageModal: { hidden: true },
            playerOneLosses: { textContent: '', title: '' },
            playerTwoLosses: { textContent: '', title: '' },
            statusText: { textContent: '' },
            selectionText: { textContent: '' }
        }
    });
    app.syncUiFromState = HordesPrototype.prototype.syncUiFromState;
    app.renderSelectionInfo = () => {};
    app.getMeleeState = () => ({ combats: [] });
    app.getLossSummary = () => ({ points: 0, title: 'No losses.' });

    app.onKeyDown({ key: 'p', ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, target: null });

    assert.equal(app.state.showFormUpPreview, true);
    assert.equal(app.ui.formUpPreviewCheckbox.checked, true);
});

test('Acknowledge Move stays enabled while a computer move is waiting', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-2',
            setupStage: 'game',
            computerMoveReview: {
                entries: [{ unitIds: ['u1'], ghostSnapshot: {} }],
                awaitingAck: true
            }
        },
        ui: {
            modeGroup: { hidden: true },
            editModeSettingsButton: { hidden: false },
            editModeSettingsHint: { hidden: true },
            gameModeButton: { classList: { toggle() {} } },
            editGroup: { hidden: false },
            actionGroup: { hidden: false },
            activePlayerSelect: { value: '' },
            remainingMovesInput: { value: '' },
            phaseSelect: { value: '' },
            newUnitTypeSelect: { value: '' },
            placementPlayerSelect: { value: '' },
            placeUnitButton: { textContent: '', disabled: false },
            deleteUnitButton: { hidden: false, disabled: false },
            destroyUnitButton: { hidden: false, disabled: false },
            finishMoveButton: { hidden: false, disabled: false },
            endMovePhaseButton: { hidden: false, disabled: false },
            stepMoveButton: { hidden: false, disabled: false },
            snapLabel: { hidden: false },
            snapCheckbox: { checked: false },
            formUpPreviewLabel: { hidden: false },
            formUpPreviewCheckbox: { checked: false },
            cornerRotationLabel: { hidden: false },
            cornerRotationCheckbox: { checked: false },
            rangedAreaLabel: { hidden: false },
            rangedAreaCheckbox: { checked: false },
            moveErrorsLabel: { hidden: false },
            moveErrorsCheckbox: { checked: false },
            battleStatsLabel: { hidden: false },
            battleStatsCheckbox: { checked: false },
            statusLabel: { hidden: false },
            statusCheckbox: { checked: true },
            statusGroup: { hidden: false },
            resolveShootingButton: { hidden: false, textContent: '', disabled: false },
            cancelMoveButton: { hidden: false, disabled: false },
            undoMoveButton: { hidden: false, disabled: false },
            acknowledgedButton: { hidden: true, disabled: true, textContent: '' },
            storageModal: { hidden: true },
            playerOneLosses: { textContent: '', title: '' },
            playerTwoLosses: { textContent: '', title: '' },
            statusText: { textContent: '' },
            selectionText: { textContent: '' }
        }
    });
    app.state.players['player-1'].controller = 'local';
    app.state.players['player-2'].controller = 'computer';
    app.syncUiFromState = HordesPrototype.prototype.syncUiFromState;
    app.renderSelectionInfo = () => {};
    app.getMeleeState = () => ({ combats: [] });
    app.getLossSummary = () => ({ points: 0, title: 'No losses.' });

    app.syncUiFromState();

    assert.equal(app.ui.acknowledgedButton.hidden, false);
    assert.equal(app.ui.acknowledgedButton.disabled, false);
    assert.equal(app.ui.acknowledgedButton.textContent, 'Acknowledge Move');
});

test('status checkbox shows and hides the status group', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            showStatus: true
        },
        ui: {
            modeGroup: { hidden: true },
            editModeSettingsButton: { hidden: false },
            editModeSettingsHint: { hidden: true },
            gameModeButton: { classList: { toggle() {} } },
            editGroup: { hidden: false },
            actionGroup: { hidden: false },
            activePlayerSelect: { value: '' },
            remainingMovesInput: { value: '' },
            phaseSelect: { value: '' },
            newUnitTypeSelect: { value: '' },
            placementPlayerSelect: { value: '' },
            placeUnitButton: { textContent: '', disabled: false },
            deleteUnitButton: { hidden: false, disabled: false },
            destroyUnitButton: { hidden: false, disabled: false },
            finishMoveButton: { hidden: false, disabled: false },
            endMovePhaseButton: { hidden: false, disabled: false },
            stepMoveButton: { hidden: false, disabled: false },
            snapLabel: { hidden: false },
            snapCheckbox: { checked: false },
            formUpPreviewLabel: { hidden: false },
            formUpPreviewCheckbox: { checked: false },
            cornerRotationLabel: { hidden: false },
            cornerRotationCheckbox: { checked: false },
            rangedAreaLabel: { hidden: false },
            rangedAreaCheckbox: { checked: false },
            moveErrorsLabel: { hidden: false },
            moveErrorsCheckbox: { checked: false },
            battleStatsLabel: { hidden: false },
            battleStatsCheckbox: { checked: false },
            statusLabel: { hidden: false },
            statusCheckbox: { checked: false },
            statusGroup: { hidden: true },
            resolveShootingButton: { hidden: false, textContent: '', disabled: false },
            cancelMoveButton: { hidden: false, disabled: false },
            undoMoveButton: { hidden: false, disabled: false },
            acknowledgedButton: { hidden: false, disabled: false },
            storageModal: { hidden: true },
            playerOneLosses: { textContent: '', title: '' },
            playerTwoLosses: { textContent: '', title: '' },
            statusText: { textContent: '' },
            selectionText: { textContent: '' }
        }
    });
    app.syncUiFromState = HordesPrototype.prototype.syncUiFromState;
    app.renderSelectionInfo = () => {};
    app.getMeleeState = () => ({ combats: [] });
    app.getLossSummary = () => ({ points: 0, title: 'No losses.' });

    app.syncUiFromState();

    assert.equal(app.ui.statusCheckbox.checked, true);
    assert.equal(app.ui.statusGroup.hidden, false);
    assert.equal(app.ui.statusLabel.hidden, false);

    app.state.showStatus = false;
    app.syncUiFromState();

    assert.equal(app.ui.statusGroup.hidden, true);
    assert.equal(app.ui.statusCheckbox.checked, false);
});

test('player chrome uses chosen colors instead of fixed Blue and Red sides', () => {
    const app = createAppHarness({
        state: {
            mode: 'edit',
            players: {
                'player-1': { id: 'player-1', colorId: 'gold', faction: 'Dinosaurs' },
                'player-2': { id: 'player-2', colorId: 'teal', faction: 'Goblin' }
            }
        },
        ui: {
            modeGroup: { hidden: true },
            editModeSettingsButton: { hidden: false },
            editModeSettingsHint: { hidden: true },
            gameModeButton: { classList: { toggle() {} } },
            editGroup: { hidden: false },
            actionGroup: { hidden: false },
            activePlayerSelect: {
                value: '',
                options: [
                    { value: 'player-1', textContent: 'Blue Panda' },
                    { value: 'player-2', textContent: 'Red Undead' }
                ]
            },
            remainingMovesInput: { value: '' },
            phaseSelect: { value: '' },
            newUnitTypeSelect: { value: '' },
            placementPlayerSelect: {
                value: '',
                options: [
                    { value: 'player-1', textContent: 'Blue Panda' },
                    { value: 'player-2', textContent: 'Red Undead' }
                ]
            },
            placeUnitButton: { textContent: '', disabled: false },
            deleteUnitButton: { hidden: false, disabled: false },
            destroyUnitButton: { hidden: false, disabled: false },
            finishMoveButton: { hidden: false, disabled: false },
            endMovePhaseButton: { hidden: false, disabled: false },
            stepMoveButton: { hidden: false, disabled: false },
            snapLabel: { hidden: false },
            snapCheckbox: { checked: false },
            formUpPreviewLabel: { hidden: false },
            formUpPreviewCheckbox: { checked: false },
            cornerRotationLabel: { hidden: false },
            cornerRotationCheckbox: { checked: false },
            rangedAreaLabel: { hidden: false },
            rangedAreaCheckbox: { checked: false },
            moveErrorsLabel: { hidden: false },
            moveErrorsCheckbox: { checked: false },
            battleStatsLabel: { hidden: false },
            battleStatsCheckbox: { checked: false },
            statusLabel: { hidden: false },
            statusCheckbox: { checked: true },
            statusGroup: { hidden: false },
            resolveShootingButton: { hidden: false, textContent: '', disabled: false },
            cancelMoveButton: { hidden: false, disabled: false },
            undoMoveButton: { hidden: false, disabled: false },
            acknowledgedButton: { hidden: false, disabled: false },
            storageModal: { hidden: true },
            playerOneLosses: { textContent: '', title: '', style: { setProperty() {} } },
            playerTwoLosses: { textContent: '', title: '', style: { setProperty() {} } },
            statusText: { textContent: '' },
            selectionText: { textContent: '' }
        }
    });
    app.syncUiFromState = HordesPrototype.prototype.syncUiFromState;
    app.renderSelectionInfo = () => {};
    app.getMeleeState = () => ({ combats: [] });
    app.getLossSummary = () => ({ points: 0, title: 'No losses.' });

    app.syncUiFromState();

    assert.equal(app.ui.activePlayerSelect.options[0].textContent, 'Gold Dinosaurs');
    assert.equal(app.ui.activePlayerSelect.options[1].textContent, 'Teal Goblin');
    assert.equal(app.ui.placementPlayerSelect.options[0].textContent, 'Gold Dinosaurs');
    assert.equal(app.ui.playerOneLosses.textContent, 'Gold Dinosaurs lost: 0');
    assert.equal(app.ui.playerTwoLosses.textContent, 'Teal Goblin lost: 0');
});

test('zoomAt can reach the increased maximum zoom level', () => {
    const app = createAppHarness();
    app.zoomAt = HordesPrototype.prototype.zoomAt;
    app.screenToWorld = HordesPrototype.prototype.screenToWorld;
    app.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 600 });
    app.state.camera = { x: 300, y: 300, scale: 5.5, minScale: 0.6, maxScale: 6 };

    app.zoomAt(300, 300, 1.5);

    assert.equal(app.state.camera.scale, 6);
});

test('setup cameras preserve the cursor world point through zoom and pan independently', () => {
    const app = createAppHarness({ state: { setupCameras: {} } });
    const canvas = {
        getBoundingClientRect() { return { left: 20, top: 40, width: 600, height: 600 }; }
    };
    const event = { clientX: 470, clientY: 340, deltaY: -1 };
    const before = app.setupScreenToWorld(event, 'deployment', canvas);

    app.zoomSetupAt(event, 'deployment', canvas);
    const after = app.setupScreenToWorld(event, 'deployment', canvas);

    assert.ok(Math.abs(before.x - after.x) < 0.001);
    assert.ok(Math.abs(before.y - after.y) < 0.001);
    assert.equal(app.getSetupCamera('terrain').scale, 1);

    const camera = app.getSetupCamera('deployment');
    app.panSetupCamera({ cameraStartX: camera.x, cameraStartY: camera.y, startClientX: 470, startClientY: 340 }, { clientX: 580, clientY: 340 }, 'deployment');
    assert.ok(camera.x < before.x);
});

test('renderSelectionInfo shows single-unit details in the side panel', () => {
    const unit = createBlade('u1', 100, 220);
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units: [unit],
            selectedIds: ['u1'],
            status: 'Ready'
        },
        ui: {
            selectionText: { textContent: '' },
            selectionPanel: {
                toggled: [],
                classList: {
                    toggle(name, value) {
                        this.owner.toggled.push([name, value]);
                    },
                    owner: null
                }
            },
            selectionPanelEyebrow: { textContent: '' },
            selectionPanelTitle: { textContent: '' },
            selectionPanelHint: { textContent: '' },
            selectionPanelStats: { hidden: true, innerHTML: '' },
            selectionPanelPortrait: { hidden: true, style: { setProperty() {} } },
            selectionPanelAsset: { hidden: true, src: '', alt: '', removeAttribute() {} }
        }
    });
    app.ui.selectionPanel.classList.owner = app.ui.selectionPanel;
    app.updateSelectionAnalysis = HordesPrototype.prototype.updateSelectionAnalysis;
    app.getSelectedUnitDetails = HordesPrototype.prototype.getSelectedUnitDetails;
    app.formatPaces = HordesPrototype.prototype.formatPaces;
    app.renderSelectionInfo = HordesPrototype.prototype.renderSelectionInfo;

    app.updateSelectionAnalysis();
    app.renderSelectionInfo();

    assert.equal(app.ui.selectionText.textContent, '1 selected, Blade.');
    assert.equal(app.ui.selectionPanelTitle.textContent, 'Blade');
    assert.equal(app.ui.selectionPanelHint.textContent, '40mm frontage, 20mm depth.');
    assert.equal(app.ui.selectionPanelStats.hidden, false);
    assert.match(app.ui.selectionPanelStats.innerHTML, /<dt>Strength<\/dt>/);
    assert.match(app.ui.selectionPanelStats.innerHTML, /Infantry 5, Mounted 3/);
    assert.equal(app.ui.selectionPanelPortrait.hidden, false);
    assert.equal(app.ui.selectionPanelAsset.hidden, false);
    assert.match(app.ui.selectionPanelAsset.src, /Blade\.svg$/);
    assert.deepEqual(app.ui.selectionPanel.toggled, [['is-empty', false]]);
});

test('battle stats markers list the active side first and fill the selection panel on click', () => {
    const blue = createBlade('b1', 100, 220);
    const red = {
        ...createBlade('r1', 140, 220, 'player-2'),
        rotation: Math.PI
    };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-2',
            showBattleStats: true,
            units: [blue, red]
        },
        ui: {
            selectionText: { textContent: '' },
            selectionPanel: {
                toggled: [],
                classList: {
                    toggle(name, value) {
                        this.owner.toggled.push([name, value]);
                    },
                    owner: null
                }
            },
            selectionPanelEyebrow: { textContent: '' },
            selectionPanelTitle: { textContent: '' },
            selectionPanelHint: { textContent: '' },
            selectionPanelStats: { hidden: true, innerHTML: '' },
            selectionPanelPortrait: { hidden: true, style: { setProperty() {} } },
            selectionPanelAsset: { hidden: true, src: '', alt: '', removeAttribute() {} }
        }
    });
    app.ui.selectionPanel.classList.owner = app.ui.selectionPanel;
    app.getBattleStatMarkers = HordesPrototype.prototype.getBattleStatMarkers;
    app.getBattlePreviewUnits = HordesPrototype.prototype.getBattlePreviewUnits;
    app.getBattleStatHit = HordesPrototype.prototype.getBattleStatHit;
    app.getBattleStatMarkerSize = HordesPrototype.prototype.getBattleStatMarkerSize;
    app.getSelectedBattleMarker = HordesPrototype.prototype.getSelectedBattleMarker;
    app.getSelectedBattleDetails = HordesPrototype.prototype.getSelectedBattleDetails;
    app.renderSelectionInfo = HordesPrototype.prototype.renderSelectionInfo;
    app.handleClick = HordesPrototype.prototype.handleClick;
    app.getPlayerLabel = HordesPrototype.prototype.getPlayerLabel;
    app.getPlayerColors = HordesPrototype.prototype.getPlayerColors;
    app.getPlayer = HordesPrototype.prototype.getPlayer;

    const markers = app.getBattleStatMarkers();
    assert.equal(markers.length, 1);
    assert.equal(markers[0].active.playerId, 'player-2');
    assert.equal(markers[0].opponent.playerId, 'player-1');
    assert.equal(markers[0].label, '5 vs 5');

    app.handleClick(markers[0].position, { unitHit: null, shiftKey: false });
    assert.equal(app.state.selectedBattleId, markers[0].id);
    app.renderSelectionInfo();
    assert.equal(app.ui.selectionPanelTitle.textContent, 'Red 5 vs 5');
    assert.match(app.ui.selectionPanelStats.innerHTML, /Red Blade/);
    assert.match(app.ui.selectionPanelStats.innerHTML, /Blue Blade/);
    assert.match(app.ui.selectionPanelStats.innerHTML, /None/);
    assert.equal(app.ui.selectionPanelPortrait.hidden, true);
});

test('handle clicks do not collapse a formation selection to one underlying unit', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220)
    ];
    const app = createAppHarness({
        state: {
            mode: 'edit',
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.updateSelectionAnalysis();

    const reverseHandle = app.getSelectionHandles().find((entry) => entry.kind === 'formation-reverse');
    app.onPointerDown({ pointerId: 1, button: 0, clientX: reverseHandle.position.x, clientY: reverseHandle.position.y, shiftKey: false });
    app.onPointerUp({ pointerId: 1, clientX: reverseHandle.position.x, clientY: reverseHandle.position.y });

    assert.deepEqual(app.state.selectedIds, ['u1', 'u2', 'u3']);
    assert.equal(app.state.selectionAnalysis.type, 'rank');
});

test('rank selection exposes forward and rear reverse handles', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220)
    ];
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            units,
            selectedIds: ['u1', 'u2']
        }
    });
    app.updateSelectionAnalysis();
    const handles = app.getSelectionHandles();
    assert.ok(handles.some((entry) => entry.kind === 'formation-forward'));
    assert.ok(handles.some((entry) => entry.kind === 'formation-reverse'));
    assert.ok(handles.some((entry) => entry.kind === 'formation-convert'));
});

test('applyMaxForwardMove advances a legal rank to its terrain-limited distance', () => {
    const units = [
        createBlade('u1', 100, 400),
        createBlade('u2', 140, 400)
    ];
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            remainingMoves: 4,
            units,
            selectedIds: ['u1', 'u2']
        }
    });
    app.updateSelectionAnalysis();
    app.ensureDraft(['u1', 'u2']);
    const startCenter = geometry.getUnitCenter(units[0]);
    app.applyMaxForwardMove();
    const endCenter = geometry.getUnitCenter(app.state.units.find((unit) => unit.id === 'u1'));
    const travel = geometry.distance(startCenter, endCenter);
    assert.ok(travel >= 45);
    assert.equal(app.state.draft.invalidIds.size, 0);
});

test('ensureDraft blocks movement while active player is computer-controlled', () => {
    const unit = createBlade('u1', 100, 220);
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            units: [unit],
            selectedIds: ['u1']
        }
    });
    app.canLocallyControl = () => false;
    app.hasLocalHuman = () => true;

    const started = app.ensureDraft(['u1']);

    assert.equal(started, false);
    assert.equal(app.state.draft, null);
    assert.equal(app.lastStatus, 'Movement is unavailable while the active side is computer-controlled.');
});

test('ensureDraft lets the computer draft its own move against a local opponent', () => {
    const unit = createBlade('u1', 100, 220, 'player-2');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-2',
            remainingMoves: 4,
            units: [unit],
            selectedIds: ['u1']
        }
    });
    app.state.players['player-1'].controller = 'local';
    app.state.players['player-2'].controller = 'computer';

    const started = app.ensureDraft(['u1'], { allowComputer: true });

    assert.equal(started, true);
    assert.ok(app.state.draft);
});

test('ensureDraft allows computer moves in an all-computer match', () => {
    const unit = createBlade('u1', 100, 220, 'player-2');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-2',
            remainingMoves: 4,
            units: [unit],
            selectedIds: ['u1'],
            terrain: { roads: [], features: [] }
        }
    });
    app.state.players['player-1'].controller = 'computer';
    app.state.players['player-2'].controller = 'computer';

    const started = app.ensureDraft(['u1']);

    assert.equal(started, true);
    assert.ok(app.state.draft);
});

test('inspect-only enemy selection does not expose move handles', () => {
    const friendly = createBlade('u1', 100, 220, 'player-1');
    const enemy = createBlade('u2', 100, 170, 'player-2');
    enemy.rotation = Math.PI;
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            units: [friendly, enemy],
            selectedIds: ['u2'],
            terrain: { roads: [], features: [] }
        }
    });
    app.state.players['player-2'].controller = 'computer';

    assert.equal(app.getSelectionHandles().length, 0);
    assert.equal(app.canManipulateSelection(), false);
});

test('setMode keeps the current selection across edit and game modes', () => {
    const friendly = createBlade('u1', 100, 220, 'player-1');
    const enemy = createBlade('u2', 100, 170, 'player-2');
    enemy.rotation = Math.PI;
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            activePlayerId: 'player-1',
            units: [friendly, enemy],
            selectedIds: ['u2'],
            terrain: { roads: [], features: [] }
        }
    });

    app.setMode('edit');
    assert.deepEqual(app.state.selectedIds, ['u2']);

    app.setMode('game');
    assert.deepEqual(app.state.selectedIds, ['u2']);
});

test('convertSelection turns a rank into a legal file without recentering the whole formation', () => {
    const units = [
        createBlade('u1', 100, 520),
        createBlade('u2', 140, 520),
        createBlade('u3', 180, 520)
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.ensureDraft = () => {
        app.state.draft = {
            unitIds: [...app.state.selectedIds],
            initialOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            validationOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            origin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            history: [],
            invalidIds: new Set(),
            reasonById: new Map()
        };
        return true;
    };
    app.evaluateDraft = function evaluateDraft() {
        const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
        this.state.draft.invalidIds = result.invalidIds;
        this.state.draft.reasonById = result.reasonById;
    };
    app.commitDraftStep = function commitDraftStep() {
        this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
    };
    const formationFrontBefore = geometry.midpoint(app.getUnitFrontCenter(units[0]), app.getUnitFrontCenter(units[2]));
    const originalForward = geometry.getForwardVector(units[0].rotation);
    app.updateSelectionAnalysis();

    app.applyConvertSelection();

    assert.equal(app.state.selectionAnalysis.type, 'file');
    assert.equal(app.state.draft.history.length, 1);
    assert.equal(app.lastStatus, 'Rank converted to file.');
    const leftSideCenters = app.state.selectedIds.map((unitId) => app.getUnitSideCenter(app.getUnitById(unitId), -1));
    const rightSideCenters = app.state.selectedIds.map((unitId) => app.getUnitSideCenter(app.getUnitById(unitId), 1));
    const oldFrontProjection = geometry.dot(formationFrontBefore, app.state.selectionAnalysis.right);
    const leftAligned = leftSideCenters.every((point) => Math.abs(geometry.dot(point, app.state.selectionAnalysis.right) - oldFrontProjection) < 0.001);
    const rightAligned = rightSideCenters.every((point) => Math.abs(geometry.dot(point, app.state.selectionAnalysis.right) - oldFrontProjection) < 0.001);
    assert.ok(leftAligned || rightAligned);
    const convertedCenters = app.state.selectedIds.map((unitId) => geometry.getUnitCenter(app.getUnitById(unitId)));
    convertedCenters.forEach((center) => {
        assert.ok(geometry.dot(geometry.subtract(center, formationFrontBefore), originalForward) <= 0.001);
    });
});

test('convertSelection lines up fronts when turning a file into a rank', () => {
    const units = [
        createBlade('u1', 220, 520),
        createBlade('u2', 220, 500),
        createBlade('u3', 220, 480)
    ].map((unit) => ({
        ...unit,
        moves: { road: 400, good: 400, bad: 400, water: 400 }
    }));
    const app = createAppHarness({
        state: {
            units,
            selectedIds: units.map((unit) => unit.id)
        }
    });
    app.ensureDraft = () => {
        app.state.draft = {
            unitIds: [...app.state.selectedIds],
            initialOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            validationOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            origin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            history: [],
            invalidIds: new Set(),
            reasonById: new Map(),
            allowSingleRotationFormationEscape: false
        };
        return true;
    };
    app.evaluateDraft = function evaluateDraft() {
        const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
        this.state.draft.invalidIds = result.invalidIds;
        this.state.draft.reasonById = result.reasonById;
    };
    app.commitDraftStep = function commitDraftStep() {
        this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
    };
    const leftSideAnchor = geometry.midpoint(app.getUnitSideCenter(units[0], -1), app.getUnitSideCenter(units[2], -1));
    const rightSideAnchor = geometry.midpoint(app.getUnitSideCenter(units[0], 1), app.getUnitSideCenter(units[2], 1));
    app.updateSelectionAnalysis();

    app.applyConvertSelection();

    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(app.state.draft.history.length, 1);
    const frontCenters = app.state.selectedIds.map((unitId) => app.getUnitFrontCenter(app.getUnitById(unitId)));
    const averageFront = {
        x: frontCenters.reduce((sum, point) => sum + point.x, 0) / frontCenters.length,
        y: frontCenters.reduce((sum, point) => sum + point.y, 0) / frontCenters.length
    };
    const forward = app.state.selectionAnalysis.forward;
    const projections = frontCenters.map((point) => geometry.dot(point, forward));
    projections.forEach((projection) => {
        assert.ok(Math.abs(projection - projections[0]) < 0.001);
    });
    const leftDistance = geometry.distance(leftSideAnchor, { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 });
    const rightDistance = geometry.distance(rightSideAnchor, { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 });
    const preferredAnchor = leftDistance <= rightDistance ? leftSideAnchor : rightSideAnchor;
    assert.ok(geometry.distance(averageFront, preferredAnchor) < 0.001);
    const toBoardCenter = geometry.subtract({ x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 }, averageFront);
    assert.ok(geometry.dot(forward, toBoardCenter) > 0);
});

test('convertSelection rejects illegal final formations', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220),
        createBlade('u3', 180, 220),
        { ...createBlade('blocker', 140, 240), playerId: 'player-2' }
    ];
    const app = createAppHarness({
        state: {
            units,
            selectedIds: ['u1', 'u2', 'u3']
        }
    });
    app.ensureDraft = () => {
        app.state.draft = {
            unitIds: [...app.state.selectedIds],
            initialOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            validationOrigin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            origin: geometry.snapshotPositions(app.state.selectedIds, app.state.units),
            history: [],
            invalidIds: new Set(),
            reasonById: new Map()
        };
        return true;
    };
    app.evaluateDraft = function evaluateDraft() {
        const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
        this.state.draft.invalidIds = result.invalidIds;
        this.state.draft.reasonById = result.reasonById;
    };
    app.commitDraftStep = function commitDraftStep() {
        this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
    };
    const before = geometry.snapshotPositions(app.state.selectedIds, app.state.units);
    app.updateSelectionAnalysis();

    app.applyConvertSelection();

    assert.equal(app.lastStatus, 'That rank/file conversion would be illegal.');
    assert.equal(app.state.selectionAnalysis.type, 'rank');
    assert.equal(geometry.sameFootprint(before.u1, app.getUnitById('u1')), true);
    assert.equal(app.state.draft.history.length, 0);
});

test('exportGameJson builds a downloadable save payload', () => {
    const app = createAppHarness({
        state: {
            phase: 'move',
            activePlayerId: 'player-1',
            units: [createBlade('unit-1', 100, 220)],
            remainingMoves: 3
        },
        nextUnitId: 7,
        ui: {
            storageNameInput: { value: 'Bug report' }
        }
    });
    const downloads = [];
    app.downloadJsonFile = (filename, payload) => {
        downloads.push({ filename, payload });
        return JSON.stringify(payload);
    };

    const payload = app.exportGameJson();

    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].payload, payload);
    assert.equal(payload.name, 'Bug report');
    assert.equal(payload.snapshot.phase, 'move');
    assert.equal(payload.snapshot.remainingMoves, 3);
    assert.equal(payload.snapshot.nextUnitId, 7);
    assert.match(downloads[0].filename, /^Bug-report-.*\.json$/);
});

test('saveCurrentGame stores named snapshots in local storage', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({
            state: {
                phase: 'shooting',
                units: [createBlade('unit-1', 100, 220)],
                losses: { blue: [{ id: 'dead-1', type: 'Blade', value: 2 }], red: [] },
                snapEnabled: false,
                showFormUpPreview: true,
                singleRotationMode: 'front-corner',
                showRangedArea: true,
                showStatus: false
            },
            nextUnitId: 12,
            ui: {
                storageNameInput: { value: 'slot one' }
            }
        });

        app.saveCurrentGame();

        const records = JSON.parse(storage.getItem('hordes-of-the-things-saves'));
        assert.equal(records.length, 1);
        assert.equal(records[0].name, 'slot one');
        assert.equal(records[0].snapshot.phase, 'shooting');
        assert.equal(records[0].snapshot.losses.blue[0].type, 'Blade');
        assert.equal(records[0].snapshot.snapEnabled, false);
        assert.equal(records[0].snapshot.showFormUpPreview, true);
        assert.equal(records[0].snapshot.showStatus, false);
        assert.equal(records[0].snapshot.singleRotationMode, 'front-corner');
        assert.equal(records[0].snapshot.nextUnitId, 12);
    } finally {
        global.window = previousWindow;
    }
});

test('saveCurrentGame stores guided setup snapshots in local storage', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({
            state: {
                setupStage: 'army-builder',
                setup: {
                    armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                    confirmation: 'armies',
                    terrain: null,
                    deployment: null
                }
            },
            ui: {
                storageNameInput: { value: 'setup slot' }
            }
        });
        app.adjustArmyUnit('player-1', 'Blade', 12);
        app.adjustArmyUnit('player-2', 'Spear', 12);
        app.updateArmyPlayer('player-1', 'faction', 'Undead');

        app.saveCurrentGame();

        const records = JSON.parse(storage.getItem('hordes-of-the-things-saves'));
        assert.equal(records.length, 1);
        assert.equal(records[0].name, 'setup slot');
        assert.equal(records[0].snapshot.setupStage, 'army-builder');
        assert.equal(records[0].snapshot.setup.confirmation, 'armies');
        assert.equal(records[0].snapshot.setup.armies['player-1'].counts.Blade, 12);
        assert.equal(records[0].snapshot.players['player-1'].faction, 'Undead');
        assert.equal(app.lastStatus, 'Saved game as setup slot.');
    } finally {
        global.window = previousWindow;
    }
});

test('loadGame restores saved state from local storage', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    const record = {
        id: 'save-1',
        name: 'loaded slot',
        savedAt: '2026-05-29T15:30:00.000Z',
        snapshot: {
            mode: 'game',
            activeSide: 'red',
            remainingMoves: 3,
            phase: 'shooting',
            units: [createBlade('unit-4', 240, 260)],
            terrain: data.createDefaultTerrain(),
            losses: { blue: [], red: [{ id: 'dead-2', type: 'Horde', value: 1 }] },
            snapEnabled: false,
            showFormUpPreview: true,
            singleRotationMode: 'front-corner',
            showRangedArea: true,
            nextUnitId: 9
        }
    };
    storage.setItem('hordes-of-the-things-saves', JSON.stringify([record]));
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({ state: { setupStage: 'terrain-placement' } });
        app.loadGame('save-1');

        assert.equal(app.state.setupStage, 'game');
        assert.equal(app.state.activePlayerId, 'player-2');
        assert.equal(app.state.phase, 'shooting');
        assert.equal(app.state.units[0].id, 'unit-4');
        assert.equal(app.state.losses['player-2'][0].type, 'Horde');
        assert.equal(app.state.snapEnabled, false);
        assert.equal(app.state.showFormUpPreview, true);
        assert.equal(app.state.singleRotationMode, 'front-corner');
        assert.equal(app.state.showRangedArea, true);
        assert.equal(app.state.showStatus, true);
        assert.equal(app.nextUnitId, 9);
        assert.ok(app.state.shooting);
        assert.equal(app.state.storageModalOpen, false);
        assert.equal(app.lastStatus, 'Loaded saved game loaded slot.');
    } finally {
        global.window = previousWindow;
    }
});

test('loadGame updates legacy Flyer depth to the current 30 mm template', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    storage.setItem('hordes-of-the-things-saves', JSON.stringify([{
        id: 'save-flyers',
        name: 'legacy flyers',
        savedAt: '2026-05-29T15:30:00.000Z',
        snapshot: {
            setupStage: 'game',
            units: [{ id: 'flyer-1', type: 'Flyers', playerId: 'player-1', width: 40, depth: 20, x: 100, y: 220, rotation: 0 }]
        }
    }]));
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness();
        app.loadGame('save-flyers');
        assert.equal(app.state.units[0].depth, 30);
    } finally {
        global.window = previousWindow;
    }
});

test('getDefaultSaveName uses matchup, setup screen, and date', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'terrain-placement',
            players: {
                'player-1': { id: 'player-1', colorId: 'green', faction: 'Panda' },
                'player-2': { id: 'player-2', colorId: 'gold', faction: 'Undead' }
            }
        }
    });
    const name = app.getDefaultSaveName(new Date('2026-08-17T15:04:00.000Z'));
    assert.equal(name, 'Green Panda vs Gold Undead · Terrain · 2026-08-17');
});

test('loadGame restores army-builder setup including confirmation', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    const armies = Object.create(HordesPrototype.prototype).createArmyDrafts();
    armies['player-1'].counts.Blade = 12;
    armies['player-2'].counts.Spear = 12;
    storage.setItem('hordes-of-the-things-saves', JSON.stringify([{
        id: 'setup-army',
        name: 'army slot',
        savedAt: '2026-08-17T15:04:00.000Z',
        snapshot: {
            mode: 'edit',
            setupStage: 'army-builder',
            setup: {
                armies,
                confirmation: 'armies',
                terrain: null,
                deployment: null
            },
            players: {
                'player-1': { id: 'player-1', colorId: 'green', faction: 'Undead' },
                'player-2': { id: 'player-2', colorId: 'gold', faction: 'Panda' }
            },
            units: [],
            terrain: { roads: [], features: [] }
        }
    }]));
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({ state: { setupStage: 'game' } });
        app.loadGame('setup-army');

        assert.equal(app.state.setupStage, 'army-builder');
        assert.equal(app.state.setup.confirmation, 'armies');
        assert.equal(app.getArmyDraft('player-1').counts.Blade, 12);
        assert.equal(app.state.players['player-1'].faction, 'Undead');
        assert.equal(app.state.players['player-1'].colorId, 'green');
        assert.equal(app.lastStatus, 'Loaded saved game army slot.');
    } finally {
        global.window = previousWindow;
    }
});

test('loadGame restores terrain placement progress and confirmation', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    storage.setItem('hordes-of-the-things-saves', JSON.stringify([{
        id: 'setup-terrain',
        name: 'terrain slot',
        savedAt: '2026-08-17T15:04:00.000Z',
        snapshot: {
            mode: 'edit',
            setupStage: 'terrain-placement',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: 'terrain',
                terrain: {
                    defenderPlayerId: 'player-2',
                    terrainCount: 3,
                    offers: [{ id: 'terrain-4', kind: 'forest', cx: 300, cy: 300, rx: 40, ry: 30, wobble: 0.2, shape: 'blob', sizeMultiplier: 1, rotation: 0 }],
                    selectedTerrainId: 'terrain-1',
                    nextTerrainId: 5
                },
                deployment: null
            },
            players: data.DEFAULT_PLAYERS,
            units: [],
            terrain: {
                roads: [],
                features: [{ kind: 'forest', id: 'terrain-1', cx: 200, cy: 180, rx: 50, ry: 40, wobble: 0.2 }]
            }
        }
    }]));
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({ state: { setupStage: 'army-builder' } });
        app.loadGame('setup-terrain');

        assert.equal(app.state.setupStage, 'terrain-placement');
        assert.equal(app.state.setup.confirmation, 'terrain');
        assert.equal(app.state.setup.terrain.defenderPlayerId, 'player-2');
        assert.equal(app.state.setup.terrain.terrainCount, 3);
        assert.equal(app.state.setup.terrain.offers[0].id, 'terrain-4');
        assert.equal(app.state.setup.terrain.selectedTerrainId, null);
        assert.equal(app.state.terrain.features[0].id, 'terrain-1');
        assert.equal(app.getPlacedTerrainCount(), 1);
    } finally {
        global.window = previousWindow;
    }
});

test('loadGame restores unit deployment tray and placed units without selection', () => {
    const previousWindow = global.window;
    const storage = createStorage();
    storage.setItem('hordes-of-the-things-saves', JSON.stringify([{
        id: 'setup-deploy',
        name: 'deploy slot',
        savedAt: '2026-08-17T15:04:00.000Z',
        snapshot: {
            mode: 'edit',
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1', terrainCount: 0, offers: [], selectedTerrainId: null, nextTerrainId: 1 },
                deployment: {
                    defenderPlayerId: 'player-1',
                    attackerPlayerId: 'player-2',
                    activePlayerId: 'player-1',
                    zoneByPlayerId: { 'player-1': 'bottom', 'player-2': 'top' },
                    tray: [
                        { draftId: 'player-1-Blade-2', playerId: 'player-1', type: 'Blade', faction: 'Panda' },
                        { draftId: 'player-2-Spear-1', playerId: 'player-2', type: 'Spear', faction: 'Undead' }
                    ],
                    selectedTrayId: 'player-1-Blade-2',
                    selectedUnitId: 'unit-1',
                    deployedByPlayerId: { 'player-1': ['unit-1'], 'player-2': [] },
                    interaction: { type: 'move-unit', pointerId: 9 }
                }
            },
            players: data.DEFAULT_PLAYERS,
            units: [createBlade('unit-1', 280, 520)],
            terrain: { roads: [], features: [] },
            nextUnitId: 2
        }
    }]));
    global.window = { localStorage: storage };

    try {
        const app = createAppHarness({ state: { setupStage: 'terrain-placement' } });
        app.loadGame('setup-deploy');

        assert.equal(app.state.setupStage, 'unit-deployment');
        assert.equal(app.state.setup.deployment.activePlayerId, 'player-1');
        assert.equal(app.state.setup.deployment.tray.length, 2);
        assert.equal(app.state.setup.deployment.selectedTrayId, null);
        assert.equal(app.state.setup.deployment.selectedUnitId, null);
        assert.equal(app.state.setup.deployment.interaction, null);
        assert.equal(app.state.units[0].id, 'unit-1');
        assert.equal(app.state.units[0].playerId, 'player-1');
        assert.equal(app.nextUnitId, 2);
        assert.deepEqual(app.state.setup.deployment.deployedByPlayerId['player-1'], ['unit-1']);
    } finally {
        global.window = previousWindow;
    }
});

test('handleShootingClick does not select a shooter with enemy front contact', () => {
    const shooter = {
        id: 's1',
        type: 'Shooter',
        playerId: 'player-1',
        width: 40,
        depth: 20,
        x: 328.2549045788197,
        y: 311.5331540840229,
        rotation: 0,
        movedThisTurn: false,
        troopClass: 'infantry',
        moves: { road: 100, good: 75, bad: 75, water: 25 },
        ranged: { phase: 'shooting', range: 50, width: 120 },
        value: 2,
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const enemyInMelee = {
        id: 'e1',
        type: 'Riders',
        playerId: 'player-2',
        width: 40,
        depth: 30,
        x: 328.2549045788197,
        y: 311.5331540840229,
        rotation: Math.PI,
        movedThisTurn: false,
        troopClass: 'mounted',
        moves: { road: 125, good: 125, bad: 50, water: 25 },
        ranged: null,
        value: 2,
        strength: { infantry: 3, mounted: 3 },
        combat: { ignoresBadGoingPenalty: false }
    };
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [shooter, enemyInMelee]
        }
    });

    app.handleShootingClick(shooter);

    assert.equal(app.state.shooting.focusedAttackerId, null);
    assert.deepEqual(app.state.shooting.validTargetIds, []);
    assert.deepEqual(app.state.selectedIds, []);
    assert.equal(app.lastStatus, 'Shooter cannot shoot while engaged in melee.');
});

test('movement flags persist through shooting and reset for the incoming side', () => {
    const blueArtillery = createArtillery('blue-artillery', 100, 220);
    const redArtillery = createArtillery('red-artillery', 160, 220, 'player-2');
    blueArtillery.movedThisTurn = true;
    redArtillery.movedThisTurn = true;
    const app = createAppHarness({
        state: {
            phase: 'form-up',
            units: [blueArtillery, redArtillery]
        }
    });
    app.rollDie = () => 4;

    app.setPhase('shooting');

    assert.equal(blueArtillery.movedThisTurn, true);
    assert.equal(redArtillery.movedThisTurn, true);

    app.advanceToNextTurn();

    assert.equal(app.state.activePlayerId, 'player-2');
    assert.equal(blueArtillery.movedThisTurn, true);
    assert.equal(redArtillery.movedThisTurn, false);
});

test('handleShootingClick rejects moved and inactive artillery', () => {
    const artillery = createArtillery('a1', 100, 220);
    const target = { ...createBlade('t1', 100, 100), playerId: 'player-2', rotation: Math.PI };
    artillery.movedThisTurn = true;
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [artillery, target],
            terrain: { roads: [], features: [] }
        }
    });
    app.state.players['player-2'].controller = 'local';

    app.handleShootingClick(artillery);

    assert.equal(app.state.shooting.focusedAttackerId, null);
    assert.equal(app.lastStatus, 'Artillery cannot shoot after moving this turn.');

    artillery.movedThisTurn = false;
    artillery.playerId = 'player-2';
    app.handleShootingClick(artillery);

    assert.equal(app.state.shooting.focusedAttackerId, null);
    assert.equal(app.lastStatus, 'Only the active side can declare shooting attacks.');
});

test('handleShootingClick selects stationary artillery on its own turn', () => {
    const artillery = createArtillery('a1', 100, 220);
    const target = { ...createBlade('t1', 100, 100), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [artillery, target],
            terrain: { roads: [], features: [] }
        }
    });

    app.handleShootingClick(artillery);

    assert.equal(app.state.shooting.focusedAttackerId, 'a1');
    assert.deepEqual(app.state.shooting.validTargetIds, ['t1']);
    assert.equal(app.lastStatus, 'Artillery selected for shooting.');
});

test('handleShootingClick allows shooters to fire on the opposing side turn', () => {
    const shooter = {
        ...createBlade('s1', 100, 220),
        type: 'Shooter',
        depth: 20,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = { ...createBlade('t1', 100, 170), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            activeSide: 'red',
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] }
        }
    });

    app.handleShootingClick(shooter);

    assert.equal(app.state.shooting.focusedAttackerId, 's1');
    assert.deepEqual(app.state.shooting.validTargetIds, ['t1']);
    assert.equal(app.lastStatus, 'Shooter selected for shooting.');
});

test('a shooter who fired last phase can fire again on the opponent turn', () => {
    const shooter = {
        ...createBlade('s1', 100, 220),
        type: 'Shooter',
        depth: 20,
        attackedThisTurn: true,
        ranged: { phase: 'shooting', range: 50, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const artillery = {
        ...createArtillery('a1', 160, 220),
        attackedThisTurn: true
    };
    const target = { ...createBlade('t1', 100, 170), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            activePlayerId: 'player-2',
            phase: 'form-up',
            units: [shooter, artillery, target],
            terrain: { roads: [], features: [] }
        }
    });

    app.setPhase('shooting');

    assert.equal(shooter.attackedThisTurn, false);
    assert.equal(artillery.attackedThisTurn, false);
    assert.equal(app.canDeclareShootingAttack(shooter), true);
    assert.equal(app.canDeclareShootingAttack(artillery), false);
});

test('handleShootingClick can retarget an already declared shot without spending again', () => {
    const shooter = {
        ...createBlade('s1', 100, 220),
        type: 'Shooter',
        ranged: { phase: 'shooting', range: 80, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const firstTarget = { ...createBlade('t1', 100, 170), playerId: 'player-2', rotation: Math.PI };
    const secondTarget = { ...createBlade('t2', 140, 170), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            remainingMoves: 4,
            units: [shooter, firstTarget, secondTarget],
            terrain: { roads: [], features: [] },
            shooting: { focusedAttackerId: null, validTargetIds: [], attacksByAttacker: {} }
        }
    });

    app.handleShootingClick(shooter);
    app.handleShootingClick(firstTarget);
    assert.equal(app.state.shooting.attacksByAttacker.s1, 't1');
    assert.equal(shooter.attackedThisTurn, true);

    app.handleShootingClick(shooter);
    assert.equal(app.state.shooting.focusedAttackerId, 's1');
    assert.ok(app.state.shooting.validTargetIds.includes('t2'));
    app.handleShootingClick(secondTarget);

    assert.equal(app.state.shooting.attacksByAttacker.s1, 't2');
    assert.equal(app.state.remainingMoves, 4);
    assert.equal(app.lastStatus, 'Shooting target changed.');
});

test('handleShootingClick retargeting a magician does not charge declare cost twice', () => {
    const magician = data.createUnit('Magician', 'player-1', 'Undead', { x: 280, y: 520, rotation: 0 }, () => 'mag');
    const firstTarget = data.createUnit('Hero', 'player-2', 'Undead', { x: 280, y: 400, rotation: Math.PI }, () => 'hero');
    const secondTarget = data.createUnit('Blade', 'player-2', 'Undead', { x: 340, y: 400, rotation: Math.PI }, () => 'blade');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            remainingMoves: 2,
            units: [magician, firstTarget, secondTarget],
            terrain: { roads: [], features: [] },
            shooting: { focusedAttackerId: null, validTargetIds: [], attacksByAttacker: {} }
        }
    });

    app.handleShootingClick(magician);
    app.handleShootingClick(firstTarget);
    assert.equal(app.state.shooting.attacksByAttacker.mag, 'hero');
    assert.equal(app.state.remainingMoves, 0);

    app.handleShootingClick(magician);
    assert.equal(app.state.shooting.focusedAttackerId, 'mag');
    app.handleShootingClick(secondTarget);

    assert.equal(app.state.shooting.attacksByAttacker.mag, 'blade');
    assert.equal(app.state.remainingMoves, 0);
});

test('needsShootingDeclaration identifies eligible undeclared shooters', () => {
    const shooter = {
        ...createBlade('s1', 100, 220),
        type: 'Shooter',
        ranged: { phase: 'shooting', range: 50, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = { ...createBlade('t1', 100, 170), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] },
            shooting: { focusedAttackerId: null, validTargetIds: [], attacksByAttacker: {} }
        }
    });

    assert.equal(app.needsShootingDeclaration(shooter), true);

    app.state.shooting.attacksByAttacker.s1 = 't1';

    assert.equal(app.needsShootingDeclaration(shooter), false);
    assert.equal(app.needsShootingDeclaration(target), false);
});

test('buildCombatResolution keeps destroyed units as ghosts for aftermath display', () => {
    const attacker = createBlade('u1', 100, 220);
    const defender = createBlade('u2', 140, 220);
    const app = createAppHarness({
        state: {
            units: [attacker]
        }
    });
    const snapshot = {
        u1: { ...attacker },
        u2: { ...defender }
    };
    const result = {
        units: [{ ...attacker }],
        destroyedUnits: [{ ...defender }],
        results: [{
            primaryAttackerId: 'u1',
            defenderId: 'u2',
            attackerIds: ['u1'],
            attackerTotal: 5,
            defenderTotal: 2
        }]
    };

    const resolution = app.buildCombatResolution(snapshot, result, 'shooting');
    app.state.combatResolution = resolution;

    assert.ok(resolution.ghostSnapshot.u2);
    assert.ok(resolution.destroyedIds.has('u2'));
    const ghosts = app.collectGhostUnits();
    assert.ok(ghosts.some((unit) => unit.id === 'u2'));
});

test('drawCombatResolutionOverlays still renders summaries for destroyed participants', () => {
    const attacker = createBlade('u1', 100, 220);
    const defender = createBlade('u2', 140, 220);
    const app = createAppHarness({
        state: {
            units: [attacker],
            combatResolution: {
                phase: 'shooting',
                participantIds: new Set(['u1', 'u2']),
                destroyedIds: new Set(['u2']),
                ghostSnapshot: {
                    u2: { ...defender }
                },
                movedUnitIds: ['u2'],
                results: [{
                    primaryAttackerId: 'u1',
                    defenderId: 'u2',
                    attackerIds: ['u1'],
                    attackerTotal: 5,
                    defenderTotal: 2
                }]
            }
        }
    });
    const labels = [];
    const ctx = {
        save() {},
        restore() {},
        beginPath() {},
        roundRect() {},
        fill() {},
        stroke() {},
        translate() {},
        moveTo() {},
        lineTo() {},
        fillText(text, x, y) {
            labels.push({ text, x, y });
        },
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set lineCap(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    };

    app.drawCombatResolutionOverlays(ctx);

    assert.equal(labels.length, 1);
    assert.equal(labels[0].text, '5 vs 2');
});

test('combat labels use ghost positions for ensorcelled participants', () => {
    const attacker = data.createUnit('Magician', 'player-1', 'Undead', { x: 280, y: 520, rotation: 0 }, () => 'mag');
    const defender = data.createUnit('Hero', 'player-2', 'Undead', { x: 280, y: 400, rotation: Math.PI }, () => 'hero');
    const reservePose = { ...attacker, inReserve: true, reserveSlot: 0, x: -120, y: 520 };
    const app = createAppHarness({
        state: {
            units: [defender],
            reserveUnits: [reservePose],
            combatResolution: {
                phase: 'shooting',
                participantIds: new Set(['mag', 'hero']),
                ghostSnapshot: {
                    mag: { ...attacker }
                },
                movedUnitIds: ['mag'],
                results: [{
                    primaryAttackerId: 'mag',
                    defenderId: 'hero',
                    attackerIds: ['mag'],
                    attackerTotal: 5,
                    defenderTotal: 9
                }]
            }
        }
    });
    const labels = [];
    const ctx = {
        save() {},
        restore() {},
        beginPath() {},
        roundRect() {},
        fill() {},
        stroke() {},
        fillText(text, x, y) {
            labels.push({ text, x, y });
        },
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    };

    app.drawCombatResolutionOverlays(ctx);

    assert.equal(labels.length, 1);
    const expected = geometry.midpoint(geometry.getUnitCenter(attacker), geometry.getUnitCenter(defender));
    assert.ok(Math.abs(labels[0].x - expected.x) < 0.01);
    assert.ok(Math.abs(labels[0].y - expected.y) < 0.01);
    assert.ok(labels[0].x > 0, 'label should stay on the board, not over the reserve lot');
});

test('combat acknowledgement places strength, dice, and modifier marks on the units', () => {
    const attacker = createBlade('a', 100, 200);
    const defender = { ...createBlade('d', 140, 200, 'player-2'), rotation: Math.PI };
    const support = createBlade('s', 100, 220);
    const app = createAppHarness({
        state: {
            units: [attacker, defender, support],
            combatResolution: {
                phase: 'melee',
                participantIds: new Set(['a', 'd', 's']),
                destroyedIds: new Set(),
                ghostSnapshot: {},
                movedUnitIds: [],
                results: [{
                    leftPrimaryId: 'a',
                    rightPrimaryId: 'd',
                    leftRoll: 4,
                    rightRoll: 2,
                    leftTotal: 9,
                    rightTotal: 7,
                    leftModifiers: [],
                    rightModifiers: [
                        { id: 'flank-attacked', value: -1, sources: [{ unitId: 's', value: -1 }] },
                        { id: 'bad-going', value: -2, terrainKind: 'forest' }
                    ]
                }]
            }
        }
    });
    const marks = app.getCombatReadoutMarks();
    const mark = (unitId, kind) => marks.find((entry) => entry.unitId === unitId && entry.kind === kind);

    assert.equal(mark('a', 'strength').value, 5);
    assert.deepEqual(mark('a', 'strength').position, { x: 110, y: 210 });
    assert.equal(mark('a', 'strength').color, data.PLAYER_COLORS.blue.fill);
    assert.equal(mark('a', 'strength').fill, '#ffffff');
    assert.deepEqual(mark('a', 'die').position, { x: 130, y: 210 });
    assert.equal(mark('a', 'die').value, 4);
    assert.equal(mark('a', 'die').fill, '#161616');
    assert.ok(Math.abs(mark('d', 'strength').position.x - 130) < 0.01);
    assert.ok(Math.abs(mark('d', 'strength').position.y - 190) < 0.01);
    assert.equal(mark('d', 'strength').color, data.PLAYER_COLORS.red.fill);
    assert.equal(mark('d', 'terrain').value, -2);
    assert.equal(mark('d', 'terrain').color, data.TERRAIN_STYLE.forest.fill);
    assert.deepEqual(mark('d', 'terrain').position, { x: 120, y: 180 });
    assert.equal(mark('s', 'modifier').value, -1);
    assert.equal(mark('s', 'modifier').color, data.PLAYER_COLORS.blue.fill);
    assert.deepEqual(mark('s', 'modifier').position, { x: 120, y: 230 });

    const texts = [];
    const arcs = [];
    app.drawCombatReadoutMarks({
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        fill() {},
        stroke() {},
        arc(x, y) {
            arcs.push({ x, y });
        },
        fillText(text) {
            texts.push(text);
        },
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    }, app.state.combatResolution);

    assert.ok(texts.includes('5'));
    assert.ok(texts.includes('-1'));
    assert.ok(texts.includes('-2'));
    assert.equal(texts.includes('4'), false);
    assert.equal(arcs.length, 6);
});

test('render draws combat summaries after units', () => {
    const app = createAppHarness({
        state: {
            combatResolution: {
                phase: 'shooting',
                participantIds: new Set(),
                destroyedIds: new Set(),
                ghostSnapshot: {},
                movedUnitIds: [],
                results: []
            }
        }
    });
    const order = [];
    app.canvas.getBoundingClientRect = () => ({ width: 800, height: 600 });
    app.ctx = {
        clearRect() {},
        save() {},
        restore() {},
        translate() {},
        scale() {}
    };
    app.syncCanvasResolution = () => {};
    app.drawBoard = () => order.push('board');
    app.drawReserveZones = () => order.push('reserve');
    app.drawTerrain = () => order.push('terrain');
    app.drawGhostUnits = () => order.push('ghosts');
    app.drawShootingOverlays = () => order.push('shooting');
    app.drawUnits = () => order.push('units');
    app.drawSelectionHandles = () => order.push('handles');
    app.drawCombatResolutionOverlays = () => order.push('combat');

    app.render();

    assert.ok(order.indexOf('combat') > order.indexOf('units'));
});

test('drawTerrain clips terrain rendering to board bounds', () => {
    const app = createAppHarness();
    const calls = [];
    const ctx = {
        save() {},
        restore() {},
        beginPath() { calls.push('beginPath'); },
        rect(x, y, width, height) { calls.push(`rect:${x},${y},${width},${height}`); },
        clip() { calls.push('clip'); },
        moveTo() {},
        lineTo() {},
        closePath() {},
        roundRect() {},
        fill() {},
        stroke() {},
        lineWidth: 1
    };

    app.drawTerrain(ctx);

    assert.equal(calls.includes(`rect:0,0,${data.BOARD_SIZE},${data.BOARD_SIZE}`), true);
    assert.equal(calls.includes('clip'), true);
});

test('logCombatResults includes modifiers, rolls, and outcome details', () => {
    const app = createAppHarness();
    const previousConsole = global.console;
    const calls = [];
    global.console = {
        ...previousConsole,
        groupCollapsed(message) {
            calls.push(['group', message]);
        },
        log(message) {
            calls.push(['log', message]);
        },
        groupEnd() {
            calls.push(['end']);
        },
        info(message) {
            calls.push(['info', message]);
        }
    };

    try {
        app.logCombatResults({
            units: [{ id: 'u1', playerId: 'player-1', type: 'Shooter' }, { id: 'u3', playerId: 'player-1', type: 'Shooter' }],
            destroyedUnits: [{ id: 'u2', playerId: 'player-2', type: 'Blade' }],
            recoilDestructions: [{ unitId: 'u2', reason: 'recoil path enters water' }],
            results: [{
                primaryAttackerId: 'u1',
                defenderId: 'u2',
                attackerIds: ['u1', 'u3'],
                attackerRoll: 4,
                defenderRoll: 2,
                attackerModifiers: [{ id: 'multiple-shooters', value: -1 }],
                defenderModifiers: [{ id: 'bad-going', value: -2 }],
                attackerTotal: 7,
                defenderTotal: 3,
                loserId: 'u2',
                outcome: 'destroy',
                destructionRule: 'Double total destroys the loser.'
            }]
        }, 'shooting');
    } finally {
        global.console = previousConsole;
    }

    const detailLog = calls.find((entry) => entry[0] === 'log')[1];
    assert.ok(detailLog.includes('Blue Shooter u1, Blue Shooter u3 vs Red Blade u2'));
    assert.ok(detailLog.includes('Blue roll 4'));
    assert.ok(detailLog.includes('Blue modifiers multiple-shooters -1'));
    assert.ok(detailLog.includes('Red roll 2'));
    assert.ok(detailLog.includes('Red modifiers bad-going -2'));
    assert.ok(detailLog.includes('totals 7 vs 3'));
    assert.ok(detailLog.includes('result destroy (Red Blade u2)'));
    assert.ok(detailLog.includes('rule Double total destroys the loser.'));
    const recoilLog = calls.filter((entry) => entry[0] === 'log').map((entry) => entry[1]).find((entry) => entry.includes('recoil destruction:'));
    assert.ok(recoilLog.includes('Red Blade u2'));
    assert.ok(recoilLog.includes('reason recoil path enters water'));
});

test('attacker auto deploy uses the enemy line for matchup-biased placement', () => {
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
    app.adjustArmyUnit('player-1', 'Shooter', 3);
    app.adjustArmyUnit('player-2', 'Knights', 3);
    app.initializeUnitDeployment();
    app.autoDeployActiveArmy();
    app.finishDeploymentTurn();

    assert.equal(app.getDeploymentSetup().activePlayerId, 'player-2');
    app.autoDeployActiveArmy();

    const knights = app.state.units.filter((unit) => unit.playerId === 'player-2' && unit.type === 'Knights');
    const shooters = app.state.units.filter((unit) => unit.playerId === 'player-1' && unit.type === 'Shooter');
    assert.equal(knights.length, 3);
    assert.equal(shooters.length, 3);
    const shooterMean = shooters.reduce((sum, unit) => sum + geometry.getUnitCenter(unit).x, 0) / shooters.length;
    const knightMean = knights.reduce((sum, unit) => sum + geometry.getUnitCenter(unit).x, 0) / knights.length;
    assert.ok(Math.abs(knightMean - shooterMean) < 160);
});

test('finish-move boot sits between reverse and side-turn and commits the move', () => {
    const units = [
        createBlade('u1', 100, 220),
        createBlade('u2', 140, 220)
    ];
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            setupStage: 'game',
            remainingMoves: 4,
            activePlayerId: 'player-1',
            units,
            selectedIds: ['u1', 'u2'],
            terrain: { roads: [], features: [] }
        }
    });
    app.scheduleControllerAction = () => {};
    app.updateSelectionAnalysis();
    assert.equal(app.getSelectionHandles().some((handle) => handle.kind === 'finish-move'), false);

    assert.equal(app.ensureDraft(['u1', 'u2']), true);
    units.forEach((unit) => {
        unit.y -= 15;
    });
    app.updateSelectionAnalysis();
    const handles = app.getSelectionHandles();
    const finish = handles.find((handle) => handle.kind === 'finish-move');
    const reverse = handles.find((handle) => handle.kind === 'formation-reverse');
    const convert = handles.find((handle) => handle.kind === 'formation-convert');
    assert.ok(finish);
    assert.ok(reverse);
    assert.ok(convert);
    assert.ok(Math.abs(finish.position.x - ((reverse.position.x + convert.position.x) / 2)) < 0.01);
    assert.ok(Math.abs(finish.position.y - ((reverse.position.y + convert.position.y) / 2)) < 0.01);

    const positions = handles.map((handle) => ({ kind: handle.kind, x: handle.position.x, y: handle.position.y }));
    app.state.hover = { handleKind: 'formation-reverse', unitId: null };
    app.getSelectionHandles().forEach((handle) => {
        const position = positions.find((entry) => entry.kind === handle.kind);
        assert.equal(handle.position.x, position.x);
        assert.equal(handle.position.y, position.y);
    });

    app.onPointerDown({
        pointerId: 3,
        button: 0,
        clientX: finish.position.x,
        clientY: finish.position.y,
        shiftKey: false
    });
    app.onPointerUp({ pointerId: 3, clientX: finish.position.x, clientY: finish.position.y });

    assert.equal(app.state.draft, null);
    assert.equal(units[0].movedThisTurn, true);
    assert.equal(units[1].movedThisTurn, true);
    assert.equal(app.shouldMarkMovedUnit(units[0]), true);
    const enemy = createBlade('enemy', 300, 220, 'player-2');
    enemy.movedThisTurn = true;
    app.state.units.push(enemy);
    assert.equal(app.shouldMarkMovedUnit(enemy), false);
    app.state.players['player-1'].controller = 'computer';
    assert.equal(app.shouldMarkMovedUnit(units[0]), false);
    app.state.players['player-1'].controller = 'local';
    app.state.phase = 'shooting';
    assert.equal(app.shouldMarkMovedUnit(units[0]), false);
});

test('acknowledge button names the phase it closes', () => {
    const app = createAppHarness();
    app.state.phase = 'form-up';
    assert.equal(app.acknowledgeButtonLabel(), 'Acknowledge Forming Up');
    app.state.phase = 'shooting';
    app.state.combatResolution = { phase: 'shooting' };
    assert.equal(app.acknowledgeButtonLabel(), 'Acknowledge Shooting');
    app.state.phase = 'melee';
    app.state.combatResolution = { phase: 'melee' };
    assert.equal(app.acknowledgeButtonLabel(), 'Acknowledge Melee');
    app.state.victory = { winnerPlayerId: 'player-1' };
    app.state.victoryModalDismissed = true;
    assert.equal(app.acknowledgeButtonLabel(), 'Victory');
});

test('victory acknowledge button reopens the victory modal', () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            victory: { winnerPlayerId: 'player-1', loserPlayerId: 'player-2' },
            victoryModalDismissed: true
        }
    });
    app.acknowledgePhase();
    assert.equal(app.state.victoryModalDismissed, false);
});

test('resolve shooting button reports assigned shot progress', () => {
    const shooter = {
        ...createBlade('s1', 100, 220),
        type: 'Shooter',
        ranged: { phase: 'shooting', range: 50, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = { ...createBlade('t1', 100, 170), playerId: 'player-2', rotation: Math.PI };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] },
            shooting: {
                focusedAttackerId: null,
                validTargetIds: [],
                attacksByAttacker: {}
            }
        }
    });
    assert.deepEqual(app.getShootingAssignmentProgress(), { assigned: 0, total: 1 });
    app.state.shooting.attacksByAttacker.s1 = 't1';
    assert.deepEqual(app.getShootingAssignmentProgress(), { assigned: 1, total: 1 });
});

test('drawCombatResolutionOverlays marks destroyed, ensorcelled, and pushed units', () => {
    const destroyed = createBlade('dead', 100, 220);
    const ensorcelled = createBlade('hexed', 160, 220);
    const pushedBefore = createBlade('pushed', 220, 220);
    const pushedAfter = { ...pushedBefore, y: 260 };
    const app = createAppHarness({
        state: {
            units: [pushedAfter],
            combatResolution: {
                phase: 'melee',
                participantIds: new Set(['dead', 'hexed', 'pushed']),
                destroyedIds: new Set(['dead']),
                ensorcelledIds: new Set(['hexed']),
                ensorcelledUnits: [{ ...ensorcelled }],
                ghostSnapshot: {
                    dead: { ...destroyed },
                    hexed: { ...ensorcelled },
                    pushed: { ...pushedBefore }
                },
                movedUnitIds: ['dead', 'hexed', 'pushed'],
                results: []
            }
        }
    });
    const calls = [];
    app.drawDestroyedMark = () => calls.push('destroyed');
    app.drawEnsorcelledMark = () => calls.push('ensorcelled');
    app.drawPushbackArrow = () => calls.push('pushback');
    app.drawCombatResolutionOverlays({
        save() {},
        restore() {},
        beginPath() {},
        roundRect() {},
        fill() {},
        stroke() {},
        fillText() {},
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    });
    assert.deepEqual(calls, ['destroyed', 'ensorcelled', 'pushback']);
});

test('a recoil destruction draws the recoil arrow and a small x at its end', () => {
    const dead = createBlade('dead', 100, 220);
    const app = createAppHarness({
        state: {
            units: [],
            combatResolution: {
                phase: 'melee',
                participantIds: new Set(['dead']),
                destroyedIds: new Set(['dead']),
                ensorcelledIds: new Set(),
                recoilDestructions: [{ unitId: 'dead', kind: 'recoil' }],
                ghostSnapshot: { dead: { ...dead } },
                movedUnitIds: ['dead'],
                results: []
            }
        }
    });
    const calls = [];
    app.drawDestroyedMark = () => calls.push('destroyed');
    app.drawEnsorcelledMark = () => calls.push('ensorcelled');
    app.drawPushbackArrow = (ctx, from, to) => calls.push(['arrow', from, to]);
    app.drawRecoiledDestroyedMark = (ctx, point) => calls.push(['small', point]);
    app.drawCombatResolutionOverlays({
        save() {},
        restore() {},
        beginPath() {},
        roundRect() {},
        fill() {},
        stroke() {},
        fillText() {},
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    });

    const arrow = calls.find((call) => call[0] === 'arrow');
    const small = calls.find((call) => call[0] === 'small');
    assert.equal(calls.includes('destroyed'), false);
    assert.ok(arrow);
    assert.ok(small);
    assert.deepEqual(small[1], arrow[2]);
    assert.ok(arrow[2].y > arrow[1].y);
    assert.ok(Math.abs((arrow[2].y - arrow[1].y) - dead.depth) < 0.01);
});

test('shooting recoil aftermath draws a centerline pushback arrow', () => {
    const shooter = {
        ...createBlade('s1', 300, 400),
        type: 'Shooter',
        ranged: { phase: 'shooting', range: 300, width: 120 },
        strength: { infantry: 3, mounted: 4 },
        combat: { ignoresBadGoingPenalty: true }
    };
    const target = { ...createBlade('t1', 300, 250), playerId: 'player-2', rotation: 0 };
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            units: [shooter, target],
            terrain: { roads: [], features: [] },
            shooting: {
                focusedAttackerId: null,
                validTargetIds: [],
                attacksByAttacker: { s1: 't1' }
            }
        }
    });
    let roll = 0;
    const rolls = [6, 1];
    app.rollDie = () => rolls[roll++];
    app.resolveShootingPhase({ skipUndeclared: true });

    assert.equal(app.state.combatResolution.results[0].outcome, 'recoil');
    assert.equal(app.state.combatResolution.destroyedIds.has('t1'), false);
    assert.ok(app.state.combatResolution.movedUnitIds.includes('t1'));

    const arrows = [];
    app.drawPushbackArrow = (ctx, from, to) => arrows.push({ from, to });
    app.drawDestroyedMark = () => {};
    app.drawEnsorcelledMark = () => {};
    app.drawCombatResolutionOverlays({
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        arc() {},
        roundRect() {},
        fill() {},
        stroke() {},
        fillText() {},
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    });

    assert.equal(arrows.length, 1);
    assert.ok(Math.abs(arrows[0].to.y - arrows[0].from.y) > 15);
    assert.ok(Math.abs(arrows[0].from.x - 320) < 0.01);
    assert.ok(Math.abs(arrows[0].to.x - 320) < 0.01);
});

test('shooting overlays keep declared attack lines during acknowledge', () => {
    const attacker = createBlade('a1', 100, 220);
    const target = createBlade('t1', 100, 80);
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'shooting',
            units: [attacker],
            combatResolution: {
                phase: 'shooting',
                participantIds: new Set(['a1', 't1']),
                destroyedIds: new Set(['t1']),
                ensorcelledIds: new Set(),
                ghostSnapshot: { t1: { ...target } },
                movedUnitIds: ['t1'],
                attacksByAttacker: { a1: 't1' },
                results: []
            }
        }
    });
    const arrows = [];
    app.drawShootingArrow = (ctx, fromUnit, toUnit) => {
        arrows.push({ from: fromUnit.id, to: toUnit.id });
    };
    app.drawShootingOverlays({});
    assert.deepEqual(arrows, [{ from: 'a1', to: 't1' }]);
});

test('end move prompt appears when nothing legal can still be spent', () => {
    const blade = createBlade('blade', 100, 220);
    const mage = createBlade('mage', 160, 220);
    mage.type = 'Magician';
    mage.combat = { moveCost: 2 };
    const reserve = createBlade('reserve', 40, 40);
    reserve.inReserve = true;
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            setupStage: 'game',
            remainingMoves: 1,
            units: [blade, mage],
            reserveUnits: [reserve]
        }
    });

    assert.equal(app.hasLegalMoveRemaining(), true);
    blade.movedThisTurn = true;
    assert.equal(app.hasLegalMoveRemaining(), true);
    app.state.reserveUnits = [];
    assert.equal(app.hasLegalMoveRemaining(), false);
    app.state.remainingMoves = 2;
    assert.equal(app.hasLegalMoveRemaining(), true);
    app.state.remainingMoves = 0;
    assert.equal(app.hasLegalMoveRemaining(), false);
});

test('unaffordable move mark covers blades, magicians, deployments, and ensorcelled returns', () => {
    const blade = createBlade('blade', 100, 220);
    const mage = createBlade('mage', 160, 220);
    mage.type = 'Magician';
    mage.combat = { moveCost: 2 };
    const caster = createBlade('caster', 220, 220);
    const reserve = createBlade('reserve', 40, 40);
    reserve.inReserve = true;
    const ensorcelled = createBlade('ensorcelled', 80, 40);
    ensorcelled.inReserve = true;
    ensorcelled.ensorcelledByUnitId = 'caster';
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            setupStage: 'game',
            remainingMoves: 1,
            units: [blade, mage, caster],
            reserveUnits: [reserve, ensorcelled]
        }
    });

    assert.equal(app.shouldMarkUnaffordableUnit(blade), false);
    assert.equal(app.shouldMarkUnaffordableUnit(reserve), false);
    assert.equal(app.shouldMarkUnaffordableUnit(mage), true);
    assert.equal(app.shouldMarkUnaffordableUnit(ensorcelled), true);

    app.state.remainingMoves = 0;
    assert.equal(app.shouldMarkUnaffordableUnit(blade), true);
    assert.equal(app.shouldMarkUnaffordableUnit(reserve), true);
    blade.movedThisTurn = true;
    assert.equal(app.shouldMarkUnaffordableUnit(blade), false);

    app.state.remainingMoves = 6;
    assert.equal(app.shouldMarkUnaffordableUnit(ensorcelled), false);
    app.state.players['player-1'].controller = 'computer';
    app.state.remainingMoves = 0;
    assert.equal(app.shouldMarkUnaffordableUnit(reserve), false);
});

test('single-unit finish boot sits on the rear beside reverse', () => {
    const unit = createBlade('u1', 100, 220);
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            setupStage: 'game',
            remainingMoves: 4,
            units: [unit],
            selectedIds: ['u1']
        }
    });
    app.updateSelectionAnalysis();
    assert.equal(app.ensureDraft(['u1']), true);
    unit.y -= 10;
    const handles = app.getSelectionHandles();
    const finish = handles.find((handle) => handle.kind === 'finish-move');
    const reverse = handles.find((handle) => handle.kind === 'single-reverse');
    const right = geometry.getRightVector(unit.rotation);
    assert.ok(finish);
    assert.ok(reverse);
    assert.ok(Math.abs(finish.position.x - (reverse.position.x - (right.x * 24))) < 0.01);
    assert.ok(Math.abs(finish.position.y - (reverse.position.y - (right.y * 24))) < 0.01);
});

test('middle-button drag pans the board like a right-button drag', () => {
    const app = createAppHarness();
    app.state.camera = { x: 100, y: 80, scale: 1, minScale: 0.6, maxScale: 6 };
    let prevented = false;
    app.onPointerDown({
        pointerId: 8,
        button: 1,
        clientX: 10,
        clientY: 20,
        shiftKey: false,
        preventDefault() {
            prevented = true;
        }
    });
    assert.equal(prevented, true);
    assert.equal(app.state.interaction.type, 'pan');
    app.onPointerMove({ pointerId: 8, clientX: 40, clientY: 25 });
    assert.equal(app.state.camera.x, 70);
    assert.equal(app.state.camera.y, 75);
});

test('hover marks selectable units and handle buttons', () => {
    const friendly = createBlade('u1', 100, 220);
    const enemy = createBlade('u2', 100, 120, 'player-2');
    const app = createAppHarness({
        state: {
            mode: 'game',
            phase: 'move',
            setupStage: 'game',
            units: [friendly, enemy],
            selectedIds: ['u1']
        }
    });
    app.updateSelectionAnalysis();
    app.getHandleHit = () => null;
    app.pickUnit = (world) => (world.x < 50 ? enemy : friendly);
    app.updatePointerHover({ clientX: 80, clientY: 80 });
    assert.equal(app.state.hover.unitId, 'u1');
    app.updatePointerHover({ clientX: 10, clientY: 10 });
    assert.equal(app.state.hover.unitId, 'u2');

    const reverse = app.getSelectionHandles().find((handle) => handle.kind === 'single-reverse');
    app.getHandleHit = () => reverse;
    app.updatePointerHover({ clientX: reverse.position.x, clientY: reverse.position.y });
    assert.equal(app.state.hover.handleKind, 'single-reverse');
    assert.equal(app.state.hover.unitId, null);
    assert.equal(app.handleBorderWidth(reverse), 4.5);

    app.state.hover = null;
    app.state.setupStage = 'unit-deployment';
    app.state.setup = { deployment: { activePlayerId: 'player-1' } };
    app.getHandleHit = () => null;
    app.pickUnit = () => enemy;
    app.updatePointerHover({ clientX: 1, clientY: 1 });
    assert.equal(app.state.hover.unitId, 'u2');
});

test('phase changes announce the phase the turn lands on in the active player color', async () => {
    const app = createAppHarness({
        state: {
            mode: 'game',
            setupStage: 'game',
            phase: 'move',
            activePlayerId: 'player-1'
        }
    });
    const shown = [];
    app.showPhaseBanner = (playerId, phase) => {
        shown.push(`${playerId}:${phase}`);
    };
    app.setPhase('shooting');
    app.state.activePlayerId = 'player-2';
    app.setPhase('melee');
    app.setPhase('move');
    await Promise.resolve();
    assert.deepEqual(shown, ['player-2:move']);

    const classNames = new Set();
    const title = { textContent: '' };
    const player = { textContent: '' };
    app.showPhaseBanner = HordesPrototype.prototype.showPhaseBanner;
    app.ui.phaseBanner = {
        hidden: true,
        dataset: {},
        style: {
            setProperty(name, value) {
                this[name] = value;
            }
        },
        classList: {
            remove(name) {
                classNames.delete(name);
            },
            add(name) {
                classNames.add(name);
            }
        },
        querySelector(selector) {
            if (selector === '.phase-banner-title') {
                return title;
            }
            if (selector === '.phase-banner-player') {
                return player;
            }
            return null;
        },
        offsetWidth: 12
    };
    app.showPhaseBanner('player-2', 'form-up');
    assert.equal(app.ui.phaseBanner.hidden, false);
    assert.equal(title.textContent, 'Form Up Phase');
    assert.equal(player.textContent, 'Red Undead');
    assert.equal(app.ui.phaseBanner.style['--phase-ink'], data.PLAYER_COLORS.red.stroke);
    assert.equal(classNames.has('is-showing'), true);
    clearTimeout(app._phaseBannerTimer);
});
