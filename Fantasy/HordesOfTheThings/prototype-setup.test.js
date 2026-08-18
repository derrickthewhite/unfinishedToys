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
} = require('./prototype-test-harness.js');

test('new games begin with empty 24 AP army drafts instead of a seeded battle', () => {
    const app = Object.create(HordesPrototype.prototype);
    app.nextUnitId = 1;
    app.state = app.createInitialState();

    assert.equal(app.state.setupStage, 'army-builder');
    assert.deepEqual(app.state.units, []);
    assert.deepEqual(app.state.terrain, { roads: [], features: [] });
    assert.deepEqual(app.getArmyDraft('player-1').counts, {});
    assert.deepEqual(app.getArmyDraft('player-2').counts, {});
});

test('army drafts require exactly 24 AP for both players before terrain placement', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'army-builder',
            setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null }
        }
    });

    app.adjustArmyUnit('player-1', 'Blade', 12);
    assert.equal(app.getArmyValue('player-1'), data.ARMY_POINT_TARGET);
    assert.equal(app.canAcceptArmies(), false);

    app.adjustArmyUnit('player-2', 'Blade', 12);
    assert.equal(app.canAcceptArmies(), true);
    app.openArmyConfirmation();
    assert.equal(app.state.setup.confirmation, 'armies');

    app.confirmSetupStage();
    assert.equal(app.state.setupStage, 'terrain-placement');
    assert.equal(app.state.setup.confirmation, null);
});

test('army builder cannot accept matching colors or matching factions', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'army-builder',
            setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 12);
    app.adjustArmyUnit('player-2', 'Blade', 12);
    assert.equal(app.canAcceptArmies(), true);

    app.updateArmyPlayer('player-1', 'colorId', 'red');
    assert.equal(app.getArmyIdentityConflict(), 'Each army needs its own color.');
    assert.equal(app.canAcceptArmies(), false);

    app.updateArmyPlayer('player-1', 'colorId', 'blue');
    app.updateArmyPlayer('player-1', 'faction', 'Undead');
    assert.equal(app.getArmyIdentityConflict(), 'Each army needs its own faction.');
    assert.equal(app.canAcceptArmies(), false);

    app.updateArmyPlayer('player-1', 'colorId', 'red');
    assert.equal(app.getArmyIdentityConflict(), 'Each army needs its own color and faction.');
    app.openArmyConfirmation();
    assert.equal(app.state.setup.confirmation, null);
});

test('army builder updates player color and faction without changing player identity', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'army-builder',
            setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null }
        }
    });

    app.updateArmyPlayer('player-1', 'colorId', 'green');
    app.updateArmyPlayer('player-1', 'faction', 'Undead');

    assert.equal(app.state.players['player-1'].id, 'player-1');
    assert.equal(app.state.players['player-1'].colorId, 'green');
    assert.equal(app.state.players['player-1'].faction, 'Undead');
});

test('army builder random actions create an exact army and can clear it', () => {
    const app = createAppHarness({
        state: { setupStage: 'army-builder', setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null } }
    });

    app.chooseRandomArmy('player-1', () => 0);
    assert.equal(app.getArmyValue('player-1'), data.ARMY_POINT_TARGET);

    app.randomizeArmyPresentation('player-1', () => 0.99);
    const colorIds = Object.keys(data.PLAYER_COLORS);
    assert.equal(app.state.players['player-1'].colorId, colorIds[colorIds.length - 1]);
    assert.equal(app.state.players['player-1'].faction, data.FACTIONS[data.FACTIONS.length - 1]);

    app.clearArmy('player-1');
    assert.equal(app.getArmyValue('player-1'), 0);
});

test('the army builder offers about a dozen player colors', () => {
    assert.equal(Object.keys(data.PLAYER_COLORS).length, 12);
    assert.equal(data.PLAYER_COLORS.silver.label, 'Silver');
    assert.equal(data.PLAYER_COLORS.white.label, 'White');
    assert.equal(data.PLAYER_COLORS.white.stroke, '#f7f3ea');
    assert.equal(data.PLAYER_COLORS.black.stroke, '#141210');
});

test('faction rosters are limited by default and can be turned off in game settings', () => {
    const app = createAppHarness({
        state: { setupStage: 'army-builder', setup: { armies: Object.create(HordesPrototype.prototype).createArmyDrafts(), confirmation: null } }
    });
    app.settingsStorage = createStorage();

    assert.equal(app.areFactionRostersLimited(), true);
    assert.deepEqual(app.getAllowedUnitTypes('player-1'), data.FACTION_ROSTERS.Panda);

    app.adjustArmyUnit('player-1', 'Behemoth', 1);
    assert.equal(app.getArmyDraft('player-1').counts.Behemoth, undefined);

    app.updateArmyPlayer('player-1', 'faction', 'Dinosaurs');
    app.chooseRandomArmy('player-1', () => 0);
    assert.equal(app.getArmyValue('player-1'), data.ARMY_POINT_TARGET);
    assert.deepEqual(Object.keys(app.getArmyDraft('player-1').counts), ['Heavy-Spear']);

    app.adjustArmyUnit('player-1', 'Blade', 1);
    assert.equal(app.getArmyDraft('player-1').counts.Blade, undefined);

    app.setLimitFactionRosters(false);
    assert.equal(app.areFactionRostersLimited(), false);
    app.adjustArmyUnit('player-1', 'Blade', 1);
    assert.equal(app.getArmyDraft('player-1').counts.Blade, 1);

    const stored = JSON.parse(app.settingsStorage.getItem('hordes-of-the-things-settings'));
    assert.equal(stored.limitFactionRosters, false);
});

test('terrain offer descriptions include shape and size labels, with a road exception', () => {
    const app = createAppHarness();

    assert.equal(app.getTerrainOfferDescription({ kind: 'forest', shape: 'oval', sizeMultiplier: 1.5 }), 'Oval · Large');
    assert.equal(app.getTerrainOfferDescription({ kind: 'forest', shape: 'square', sizeMultiplier: 0.5 }), 'Square · Tiny');
    assert.equal(app.getTerrainOfferDescription({ kind: 'forest', shape: 'square', sizeMultiplier: 0.75 }), 'Square · Small');
    assert.equal(app.getTerrainOfferDescription({ kind: 'road' }), 'Road · full board');
});

test('terrain setup rolls a defender and creates a bounded editable terrain target', () => {
    const app = createAppHarness({
        state: { setup: { armies: {}, confirmation: null } }
    });

    const terrain = app.initializeTerrainPlacement(() => 0.99);
    assert.equal(terrain.defenderPlayerId, 'player-2');
    assert.equal(terrain.terrainCount, 8);
    assert.equal(terrain.offers.length, 3);

    app.setTerrainCount(99);
    assert.equal(terrain.terrainCount, data.TERRAIN_COUNT_MAX);
});

test('placing terrain refreshes offers and confirmation transitions to unit deployment', () => {
    const app = createAppHarness({
        state: { setupStage: 'terrain-placement', setup: { armies: {}, confirmation: null } }
    });
    const terrain = app.initializeTerrainPlacement(() => 0);
    terrain.terrainCount = 1;
    terrain.offers = [data.createTerrainOffer('forest', 'forest-1', () => 0)];

    app.placeTerrainOffer('forest-1');
    assert.equal(app.state.terrain.features.length, 1);
    assert.equal(terrain.offers.length, 3);
    assert.equal(app.isTerrainReady(), true);

    app.openTerrainConfirmation();
    assert.equal(app.state.setup.confirmation, 'terrain');
    app.confirmSetupStage();
    assert.equal(app.state.setupStage, 'unit-deployment');
});

test('terrain offers include a named shape and one of the prescribed size tiers', () => {
    const offer = data.createTerrainOffer('forest', 'forest-1', () => 0.99);

    assert.equal(data.TERRAIN_SHAPES.includes(offer.shape), true);
    assert.equal(data.TERRAIN_SIZE_MULTIPLIERS.includes(offer.sizeMultiplier), true);
    assert.equal(offer.sizeMultiplier, 1.5);
});

test('terrain movement allows a feature center to rest on the board edge', () => {
    const app = createAppHarness({
        state: { setupStage: 'terrain-placement', setup: { armies: {}, confirmation: null } }
    });
    const terrain = app.initializeTerrainPlacement(() => 0);
    const feature = data.createTerrainOffer('forest', 'forest-1', () => 0);
    app.state.terrain.features.push(feature);
    terrain.selectedTerrainId = feature.id;

    app.state.terrainInteraction = {
        pointerId: 1,
        pieceId: feature.id,
        start: { x: 300, y: 300 },
        base: { ...feature }
    };
    app.terrainScreenToWorld = () => ({ x: 0, y: 0 });
    app.renderTerrainPlacement = () => {};
    app.onTerrainPointerMove({ pointerId: 1 });

    assert.equal(feature.cx, 0);
    assert.equal(feature.cy, 0);
});

test('random terrain placement retries overlaps and fills the requested terrain count', () => {
    const app = createAppHarness({
        state: { setupStage: 'terrain-placement', setup: { armies: {}, confirmation: null } }
    });
    const terrain = app.initializeTerrainPlacement(() => 0.5);
    terrain.terrainCount = 2;
    const candidates = [
        { id: 'one', kind: 'forest', shape: 'circle', cx: 100, cy: 100, rx: 30, ry: 30, wobble: 0, rotation: 0 },
        { id: 'overlap', kind: 'forest', shape: 'circle', cx: 100, cy: 100, rx: 30, ry: 30, wobble: 0, rotation: 0 },
        { id: 'two', kind: 'forest', shape: 'circle', cx: 400, cy: 400, rx: 30, ry: 30, wobble: 0, rotation: 0 }
    ];
    app.createRandomTerrainPiece = () => candidates.shift();

    app.autoPlaceTerrain();

    assert.equal(app.state.terrain.features.length, 2);
    assert.equal(app.terrainPiecesOverlap(app.state.terrain.features[0], app.state.terrain.features[1]), false);
    assert.equal(app.isTerrainReady(), true);
});

test('game settings persist which terrain types each shape may appear as', () => {
    const app = createAppHarness();
    app.settingsStorage = createStorage();

    data.TERRAIN_SHAPES.forEach((shape) => {
        app.setTerrainShapeKindEnabled(shape, 'forest', shape === 'square');
    });

    assert.deepEqual(app.getAllowedShapesForKind('forest'), ['square']);
    const stored = JSON.parse(app.settingsStorage.getItem('hordes-of-the-things-settings'));
    assert.equal(stored.terrainShapeKinds.square.forest, true);
    assert.equal(stored.terrainShapeKinds.blob.forest, false);
});

test('terrain offers skip kinds with no enabled shapes and honor the remaining shape list', () => {
    const app = createAppHarness({
        state: { setupStage: 'terrain-placement', setup: { armies: {}, confirmation: null } }
    });
    app.settingsStorage = createStorage();
    data.TERRAIN_SHAPES.forEach((shape) => {
        data.TERRAIN_FEATURE_KINDS.forEach((kind) => {
            app.setTerrainShapeKindEnabled(shape, kind, false);
        });
    });
    app.setTerrainShapeKindEnabled('oval', 'swamp', true);

    assert.deepEqual(app.getWeightedTerrainOfferKinds(), ['road', 'road', 'swamp']);
    const offer = app.createConfiguredTerrainOffer('swamp', 'swamp-1', () => 0);
    assert.equal(offer.kind, 'swamp');
    assert.equal(offer.shape, 'oval');
});

test('new game from the gear menu asks in the confirmation modal before resetting', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            mode: 'game',
            units: [createBlade('unit-1', 100, 220)],
            storageModalOpen: true,
            setup: { armies: {}, confirmation: null, terrain: null, deployment: null }
        },
        nextUnitId: 9
    });

    app.openNewGameConfirmation();
    assert.equal(app.state.setup.confirmation, 'new-game');
    assert.equal(app.state.units.length, 1);

    app.closeSetupConfirmation();
    assert.equal(app.state.setup.confirmation, null);
    assert.equal(app.state.units.length, 1);
    assert.equal(app.state.storageModalOpen, true);

    app.openNewGameConfirmation();
    app.confirmSetupStage();
    assert.equal(app.state.setupStage, 'army-builder');
    assert.deepEqual(app.state.units, []);
    assert.deepEqual(app.state.terrain, { roads: [], features: [] });
    assert.equal(app.nextUnitId, 1);
    assert.equal(app.state.storageModalOpen, false);
    assert.equal(app.state.gameSettingsModalOpen, false);
    assert.equal(app.state.setup.confirmation, null);
});

test('game settings open as a separate modal and return to saved games when closed', () => {
    const app = createAppHarness({ state: { storageModalOpen: true } });

    app.openGameSettingsModal();
    assert.equal(app.state.storageModalOpen, false);
    assert.equal(app.state.gameSettingsModalOpen, true);

    app.closeGameSettingsModal();
    assert.equal(app.state.gameSettingsModalOpen, false);
    assert.equal(app.state.storageModalOpen, true);
});

test('deployment tray selection reuses the battle selection panel stats', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            }
        },
        ui: {
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
    app.adjustArmyUnit('player-1', 'Blade', 1);
    app.initializeUnitDeployment();
    app.selectDeploymentTrayUnit(app.getDeploymentSetup().tray[0].draftId);
    app.renderSelectionInfo();

    assert.equal(app.ui.selectionPanelTitle.textContent, 'Blade');
    assert.equal(app.ui.selectionPanelStats.hidden, false);
    assert.match(app.ui.selectionPanelStats.innerHTML, /<dt>AP<\/dt>/);
    assert.match(app.ui.selectionPanelAsset.src, /Blade\.svg$/);
});

test('unit deployment initialization uses defender-first order and quarter assignments', () => {
    const app = createAppHarness({
        state: {
            setupStage: 'terrain-placement',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.adjustArmyUnit('player-2', 'Spear', 2);
    const terrain = app.initializeTerrainPlacement(() => 0);
    app.initializeUnitDeployment();

    const deployment = app.getDeploymentSetup();
    assert.equal(deployment.activePlayerId, terrain.defenderPlayerId);
    assert.equal(deployment.zoneByPlayerId[terrain.defenderPlayerId], 'bottom');
    assert.equal(deployment.zoneByPlayerId[app.getOpponentPlayerId(terrain.defenderPlayerId)], 'top');
});

test('deployment creates units from tray drafts and enforces defender then attacker order', () => {
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
    app.adjustArmyUnit('player-1', 'Blade', 1);
    app.adjustArmyUnit('player-2', 'Spear', 1);
    const deployment = app.initializeUnitDeployment();

    const defenderDraftId = deployment.tray.find((entry) => entry.playerId === 'player-1').draftId;
    app.selectDeploymentTrayUnit(defenderDraftId);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 300, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 300, clientY: 550 });

    assert.equal(app.state.units.length, 1);
    assert.equal(app.state.units[0].playerId, 'player-1');
    assert.equal(app.state.units[0].type, 'Blade');
    assert.equal(app.canFinishDeploymentTurn(), true);

    app.finishDeploymentTurn();
    assert.equal(deployment.activePlayerId, 'player-2');
    assert.equal(app.canFinishDeploymentTurn(), false);
});

test('deployment rejects invalid zone placement and rotated footprint outside quarter', () => {
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
    app.adjustArmyUnit('player-1', 'Blade', 1);
    app.initializeUnitDeployment();
    const draftId = app.getDeploymentSetup().tray[0].draftId;

    app.selectDeploymentTrayUnit(draftId);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 300, clientY: 300 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 300, clientY: 300 });
    assert.equal(app.state.units.length, 0);

    app.selectDeploymentTrayUnit(draftId);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 10, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 10, clientY: 550 });
    assert.equal(app.state.units.length, 0);

    const rotated = data.createUnit('Blade', 'player-1', 'Panda', {
        x: 280,
        y: 430,
        rotation: Math.PI / 2
    }, () => 'rotated-1');
    assert.equal(app.isUnitPlacementInZone(rotated, 'player-1'), false);
});

test('deployment rejects overlap and restores moved unit position on invalid move', () => {
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
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.initializeUnitDeployment();
    const trayIds = app.getDeploymentSetup().tray.map((entry) => entry.draftId);

    app.selectDeploymentTrayUnit(trayIds[0]);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 260, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 260, clientY: 550 });
    app.selectDeploymentTrayUnit(trayIds[1]);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 340, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 340, clientY: 550 });

    const [first, second] = app.state.units;
    const originalSecond = { x: second.x, y: second.y };
    app.onDeploymentPointerDown({ pointerId: 3, clientX: second.x, clientY: second.y });
    app.onDeploymentPointerMove({ pointerId: 3, clientX: first.x, clientY: first.y });
    app.onDeploymentPointerUp({ pointerId: 3, clientX: first.x, clientY: first.y });

    assert.equal(Math.round(second.x), Math.round(originalSecond.x));
    assert.equal(Math.round(second.y), Math.round(originalSecond.y));
});

test('deployment shift-click and marquee select only the active player, without convert handles', () => {
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
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.initializeUnitDeployment();
    const trayIds = app.getDeploymentSetup().tray.map((entry) => entry.draftId);

    app.selectDeploymentTrayUnit(trayIds[0]);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 260, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 260, clientY: 550 });
    app.selectDeploymentTrayUnit(trayIds[1]);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 340, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 340, clientY: 550 });

    const [first, second] = app.state.units;
    assert.deepEqual(app.state.selectedIds, [second.id]);

    app.onDeploymentPointerDown({ pointerId: 3, clientX: first.x + 8, clientY: first.y + 4, shiftKey: true });
    app.onDeploymentPointerUp({ pointerId: 3, clientX: first.x + 8, clientY: first.y + 4, shiftKey: true });
    assert.equal(app.state.selectedIds.includes(first.id), true);
    assert.equal(app.state.selectedIds.includes(second.id), true);

    app.clearSelection();
    app.onDeploymentPointerDown({ pointerId: 4, clientX: 200, clientY: 500 });
    app.onDeploymentPointerMove({ pointerId: 4, clientX: 400, clientY: 590 });
    app.onDeploymentPointerUp({ pointerId: 4, clientX: 400, clientY: 590 });
    assert.equal(app.state.selectedIds.includes(first.id), true);
    assert.equal(app.state.selectedIds.includes(second.id), true);
    assert.equal(app.getSelectionHandles().some((handle) => handle.kind === 'formation-convert'), false);

    app.state.selectedIds = [first.id];
    app.updateSelectionAnalysis();
    const singleHandles = app.getSelectionHandles();
    assert.ok(singleHandles.some((handle) => handle.kind === 'single-rotate'));
    assert.ok(singleHandles.some((handle) => handle.kind === 'single-forward'));
    assert.ok(singleHandles.some((handle) => handle.kind === 'single-reverse'));
    assert.equal(singleHandles.some((handle) => handle.kind === 'formation-convert'), false);
});

test('deployment returns selected units to the tray and can place by dragging from the tray', () => {
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
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.initializeUnitDeployment();
    const trayIds = app.getDeploymentSetup().tray.map((entry) => entry.draftId);

    app.selectDeploymentTrayUnit(trayIds[0]);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 260, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 260, clientY: 550 });
    app.selectDeploymentTrayUnit(trayIds[1]);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 340, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 340, clientY: 550 });

    const [first, second] = app.state.units;
    const firstDraftId = first.draftId;
    app.state.selectedIds = [first.id, second.id];
    assert.equal(app.returnSelectedUnitsToTray(), 2);
    assert.equal(app.state.units.length, 0);
    assert.equal(app.getDeploymentSetup().tray.filter((entry) => entry.playerId === 'player-1').length, 2);
    assert.ok(app.getDeploymentSetup().tray.some((entry) => entry.draftId === firstDraftId));
    assert.equal(app.canFinishDeploymentTurn(), false);

    const trayButton = {
        setPointerCapture() {},
        hasPointerCapture() { return false; },
        releasePointerCapture() {},
        classList: { toggle() {} }
    };
    app.onDeploymentTrayPointerDown({
        pointerId: 3,
        button: 0,
        clientX: 20,
        clientY: 20,
        preventDefault() {},
        currentTarget: trayButton
    }, firstDraftId);
    app.onDeploymentPointerUp({ pointerId: 3, clientX: 20, clientY: 20 });
    assert.equal(app.state.units.length, 0);
    assert.equal(app.getDeploymentSetup().selectedTrayId, firstDraftId);

    app.onDeploymentTrayPointerDown({
        pointerId: 4,
        button: 0,
        clientX: 20,
        clientY: 20,
        preventDefault() {},
        currentTarget: trayButton
    }, firstDraftId);
    app.onDeploymentPointerMove({ pointerId: 4, clientX: 300, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 4, clientX: 300, clientY: 550 });
    assert.equal(app.state.units.length, 1);
    assert.equal(app.state.units[0].draftId, firstDraftId);
    assert.equal(app.state.selectedIds[0], app.state.units[0].id);
});

test('deployment snaps tray units and releases capture after blank canvas clicks', () => {
    const capturedPointers = new Set();
    const app = createAppHarness({
        state: {
            setupStage: 'unit-deployment',
            setup: {
                armies: Object.create(HordesPrototype.prototype).createArmyDrafts(),
                confirmation: null,
                terrain: { defenderPlayerId: 'player-1' }
            }
        },
        ui: {
            deploymentCanvas: {
                setPointerCapture(pointerId) { capturedPointers.add(pointerId); },
                hasPointerCapture(pointerId) { return capturedPointers.has(pointerId); },
                releasePointerCapture(pointerId) { capturedPointers.delete(pointerId); },
                getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 600 }; },
                clientWidth: 600,
                clientHeight: 600,
                width: 600,
                height: 600
            }
        }
    });
    app.adjustArmyUnit('player-1', 'Blade', 2);
    app.initializeUnitDeployment();
    const [firstDraftId, secondDraftId] = app.getDeploymentSetup().tray.map((entry) => entry.draftId);

    app.onDeploymentPointerDown({ pointerId: 1, clientX: 100, clientY: 400 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 100, clientY: 400 });
    assert.equal(capturedPointers.size, 0);

    app.selectDeploymentTrayUnit(firstDraftId);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 260, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 260, clientY: 550 });
    app.selectDeploymentTrayUnit(secondDraftId);
    app.onDeploymentPointerDown({ pointerId: 3, clientX: 304, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 3, clientX: 304, clientY: 550 });

    assert.equal(app.state.units.length, 2);
    assert.equal(Math.round(app.state.units[1].x), Math.round(app.state.units[0].x + app.state.units[0].width));
});

test('deployment handoff enters game mode with defender as active player and rolled moves', () => {
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
    app.adjustArmyUnit('player-1', 'Blade', 1);
    app.adjustArmyUnit('player-2', 'Spear', 1);
    app.initializeUnitDeployment();
    app.rollDie = () => 5;

    let defenderDraftId = app.getDeploymentSetup().tray.find((entry) => entry.playerId === 'player-1').draftId;
    app.selectDeploymentTrayUnit(defenderDraftId);
    app.onDeploymentPointerDown({ pointerId: 1, clientX: 300, clientY: 550 });
    app.onDeploymentPointerUp({ pointerId: 1, clientX: 300, clientY: 550 });
    app.finishDeploymentTurn();

    const attackerDraftId = app.getDeploymentSetup().tray.find((entry) => entry.playerId === 'player-2').draftId;
    app.selectDeploymentTrayUnit(attackerDraftId);
    app.onDeploymentPointerDown({ pointerId: 2, clientX: 300, clientY: 70 });
    app.onDeploymentPointerUp({ pointerId: 2, clientX: 300, clientY: 70 });
    app.finishDeploymentTurn();

    assert.equal(app.state.setupStage, 'game');
    assert.equal(app.state.mode, 'game');
    assert.equal(app.state.activePlayerId, 'player-1');
    assert.equal(app.state.phase, 'move');
    assert.equal(app.state.remainingMoves, 5);
    assert.deepEqual(app.state.losses, { 'player-1': [], 'player-2': [] });
    assert.deepEqual(app.state.homeEdgeByPlayerId, { 'player-1': 'bottom', 'player-2': 'top' });
    assert.deepEqual(app.state.reserveUnits, []);
});
