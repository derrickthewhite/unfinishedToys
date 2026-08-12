(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js'),
            require('./prototype-history.js')
        );
        return;
    }
    root.HordesPrototypeApp = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history) {
    const STORAGE_KEY = 'hordes-of-the-things-saves';
	const PANDA_UNIT_ASSET_PATHS = Object.freeze({
		Blade: 'assets/panda/Blade.svg',
		Hero: 'assets/panda/Hero.svg',
		Knights: 'assets/panda/Knights.svg',
		Shooter: 'assets/panda/Shooter.svg',
		Spear: 'assets/panda/Spear.svg',
		Artillery: 'assets/panda/Artillery.svg'
	});
	const UNDEAD_UNIT_ASSET_PATHS = Object.freeze({
		Blade: 'assets/undead/Blade.svg',
		Horde: 'assets/undead/Horde.svg',
		Riders: 'assets/undead/Riders.svg',
		Spear: 'assets/undead/Spear.svg',
		Warband: 'assets/undead/Warband.svg',
	});
    const UNIT_ASSET_PATHS = Object.freeze({
        Blade: 'assets/Blade.svg',
        Spear: 'assets/Spear.svg',
        Warband: 'assets/Warband.svg',
        Shooter: 'assets/Shooter.svg',
        Horde: 'assets/Horde.svg',
        Knights: 'assets/Knights.svg',
        Riders: 'assets/Riders.svg',
        Hero: 'assets/Hero.svg',
        'Heavy-Spear': 'assets/Heavy-Spear.svg',
        'Heavy-Warband': 'assets/Heavy-Warband.svg',
        Beasts: 'assets/Beasts.svg',
        Flyers: 'assets/Flyers.svg',
        Behemoth: 'assets/Behemoth.svg'
    });

    class HordesPrototype {
        constructor() {
            this.canvas = document.getElementById('boardCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.ui = this.captureUi();
            this.terrainCtx = this.ui.terrainCanvas.getContext('2d');
            this.unitAssetCache = new Map();
            this.nextUnitId = 1;
            this.state = this.createInitialState();
            this.renderQueued = false;
            this.bindUi();
            this.bindCanvas();
            this.resizeCanvas();
            this.syncUiFromState();
            this.requestRender();
        }

        captureUi() {
            return {
                editModeButton: document.getElementById('editModeButton'),
                gameModeButton: document.getElementById('gameModeButton'),
                turnGroup: document.querySelector('.turn-group'),
                editGroup: document.querySelector('.edit-group'),
                actionGroup: document.querySelector('.action-group'),
                gameBar: document.querySelector('.game-bar'),
                boardShell: document.querySelector('.board-shell'),
                helpBar: document.querySelector('.help-bar'),
                setupShell: document.getElementById('setupShell'),
                armyBuilder: document.getElementById('armyBuilder'),
                armyColumns: document.getElementById('armyColumns'),
                acceptArmiesButton: document.getElementById('acceptArmiesButton'),
                setupPending: document.getElementById('setupPending'),
                setupPendingText: document.getElementById('setupPendingText'),
                terrainPlacement: document.getElementById('terrainPlacement'),
                terrainCanvas: document.getElementById('terrainCanvas'),
                terrainCountInput: document.getElementById('terrainCountInput'),
                terrainProgress: document.getElementById('terrainProgress'),
                terrainDefender: document.getElementById('terrainDefender'),
                terrainOffers: document.getElementById('terrainOffers'),
                autoPlaceTerrainButton: document.getElementById('autoPlaceTerrainButton'),
                confirmTerrainButton: document.getElementById('confirmTerrainButton'),
                confirmationModal: document.getElementById('confirmationModal'),
                confirmationBackdrop: document.getElementById('confirmationBackdrop'),
                confirmationTitle: document.getElementById('confirmationTitle'),
                confirmationText: document.getElementById('confirmationText'),
                cancelConfirmationButton: document.getElementById('cancelConfirmationButton'),
                confirmSetupButton: document.getElementById('confirmSetupButton'),
                activeSideSelect: document.getElementById('activeSideSelect'),
                remainingMovesInput: document.getElementById('remainingMovesInput'),
                phaseSelect: document.getElementById('phaseSelect'),
                newUnitTypeSelect: document.getElementById('newUnitTypeSelect'),
                placementSideSelect: document.getElementById('placementSideSelect'),
                placeUnitButton: document.getElementById('placeUnitButton'),
                finishMoveButton: document.getElementById('finishMoveButton'),
                endMovePhaseButton: document.getElementById('endMovePhaseButton'),
                stepMoveButton: document.getElementById('stepMoveButton'),
                snapCheckbox: document.getElementById('snapCheckbox'),
                snapLabel: document.getElementById('snapLabel'),
                formUpPreviewCheckbox: document.getElementById('formUpPreviewCheckbox'),
                formUpPreviewLabel: document.getElementById('formUpPreviewLabel'),
                cornerRotationCheckbox: document.getElementById('cornerRotationCheckbox'),
                cornerRotationLabel: document.getElementById('cornerRotationLabel'),
                rangedAreaCheckbox: document.getElementById('rangedAreaCheckbox'),
                rangedAreaLabel: document.getElementById('rangedAreaLabel'),
                resolveShootingButton: document.getElementById('resolveShootingButton'),
                cancelMoveButton: document.getElementById('cancelMoveButton'),
                undoMoveButton: document.getElementById('undoMoveButton'),
                acknowledgedButton: document.getElementById('acknowledgedButton'),
                storageButton: document.getElementById('storageButton'),
                storageModal: document.getElementById('storageModal'),
                storageBackdrop: document.getElementById('storageBackdrop'),
                closeStorageButton: document.getElementById('closeStorageButton'),
                storageNameInput: document.getElementById('storageNameInput'),
                saveStorageButton: document.getElementById('saveStorageButton'),
                storageList: document.getElementById('storageList'),
                blueLosses: document.getElementById('blueLosses'),
                redLosses: document.getElementById('redLosses'),
                statusText: document.getElementById('statusText'),
                selectionText: document.getElementById('selectionText'),
                selectionPanel: document.getElementById('selectionPanel'),
                selectionPanelEyebrow: document.getElementById('selectionPanelEyebrow'),
                selectionPanelTitle: document.getElementById('selectionPanelTitle'),
                selectionPanelHint: document.getElementById('selectionPanelHint'),
                selectionPanelStats: document.getElementById('selectionPanelStats')
            };
        }

        createInitialState() {
            return {
                setupStage: 'army-builder',
                setup: {
                    armies: this.createArmyDrafts(),
                    confirmation: null
                },
                mode: 'edit',
                placingUnit: false,
                placementType: 'Blade',
                players: this.createDefaultPlayers(),
                placementPlayerId: 'player-1',
                activePlayerId: 'player-1',
                remainingMoves: 4,
                phase: 'move',
                terrain: { roads: [], features: [] },
                units: [],
                selectedIds: [],
                selectionAnalysis: { type: 'none', invalid: false, reason: '' },
                draft: null,
                formUp: null,
                shooting: null,
                melee: null,
                combatResolution: null,
                storageModalOpen: false,
                snapEnabled: true,
                showFormUpPreview: false,
                singleRotationMode: 'center',
                showRangedArea: false,
                losses: { 'player-1': [], 'player-2': [] },
                editHistory: [],
                marquee: null,
                interaction: null,
                camera: {
                    x: data.BOARD_SIZE / 2,
                    y: data.BOARD_SIZE / 2,
                    scale: 1.1,
                    minScale: 0.6,
                    maxScale: 10
                },
                status: 'Build both 24 AP armies to begin setup.'
            };
        }

        allocateUnitId() {
            const id = 'unit-' + this.nextUnitId;
            this.nextUnitId += 1;
            return id;
        }

        createDefaultPlayers() {
            return Object.fromEntries(data.PLAYER_IDS.map((playerId) => [playerId, { ...data.DEFAULT_PLAYERS[playerId] }]));
        }

        createArmyDrafts() {
            return Object.fromEntries(data.PLAYER_IDS.map((playerId) => [playerId, { counts: {} }]));
        }

        rollTerrainCount(random = Math.random) {
            return 2 + Math.floor(random() * 4) + Math.floor(random() * 4);
        }

        createTerrainSetup(random = Math.random) {
            return {
                defenderPlayerId: null,
                terrainCount: this.rollTerrainCount(random),
                offers: [],
                selectedTerrainId: null,
                nextTerrainId: 1
            };
        }

        getTerrainSetup() {
            return this.state.setup?.terrain || null;
        }

        createTerrainOffers(random = Math.random) {
            const terrain = this.getTerrainSetup();
            if (!terrain) {
                return [];
            }
            const weightedKinds = ['road', 'road', 'forest', 'swamp', 'water', 'impassable', 'forest'];
            terrain.offers = Array.from({ length: 3 }, (_, index) => {
                const kind = weightedKinds[Math.floor(random() * weightedKinds.length)];
                const offer = data.createTerrainOffer(kind, `terrain-${terrain.nextTerrainId}`, random);
                terrain.nextTerrainId += 1;
                return offer;
            });
            return terrain.offers;
        }

        initializeTerrainPlacement(random = Math.random) {
            const terrain = this.createTerrainSetup(random);
            terrain.defenderPlayerId = random() < 0.5 ? 'player-1' : 'player-2';
            this.state.setup.terrain = terrain;
            this.state.terrain = { roads: [], features: [] };
            this.createTerrainOffers(random);
            return terrain;
        }

        getPlacedTerrainCount() {
            return this.state.terrain.roads.length + this.state.terrain.features.length;
        }

        isTerrainReady() {
            const terrain = this.getTerrainSetup();
            return Boolean(terrain) && this.getPlacedTerrainCount() === terrain.terrainCount;
        }

        setTerrainCount(value) {
            const terrain = this.getTerrainSetup();
            if (!terrain) {
                return;
            }
            terrain.terrainCount = geometry.clamp(Math.round(Number(value) || 0), 0, data.TERRAIN_COUNT_MAX);
            if (this.getPlacedTerrainCount() > terrain.terrainCount) {
                terrain.terrainCount = this.getPlacedTerrainCount();
            }
            this.syncUiFromState();
        }

        placeTerrainOffer(offerId) {
            const terrain = this.getTerrainSetup();
            if (!terrain || this.getPlacedTerrainCount() >= terrain.terrainCount) {
                return;
            }
            const offerIndex = terrain.offers.findIndex((offer) => offer.id === offerId);
            if (offerIndex < 0) {
                return;
            }
            const offer = terrain.offers[offerIndex];
            const placed = { ...offer };
            if (placed.kind === 'road') {
                this.state.terrain.roads.push(placed);
            } else {
                this.state.terrain.features.push(placed);
            }
            terrain.selectedTerrainId = placed.id;
            this.createTerrainOffers();
            this.updateStatus(`${data.TERRAIN_STYLE[placed.kind].label} placed. Drag it on the board or rotate the selection.`);
        }

        terrainPiecesOverlap(left, right) {
            if (left.kind === 'road' && right.kind === 'road') {
                return true;
            }
            const road = left.kind === 'road' ? left : right.kind === 'road' ? right : null;
            const feature = road === left ? right : road === right ? left : null;
            if (road) {
                const points = geometry.getTerrainFeaturePoints(feature);
                return points.some((point) => (
                    road.orientation === 'horizontal'
                        ? Math.abs(point.y - road.position) <= road.width / 2
                        : Math.abs(point.x - road.position) <= road.width / 2
                )) || geometry.pointInBlob(
                    road.orientation === 'horizontal'
                        ? { x: feature.cx, y: road.position }
                        : { x: road.position, y: feature.cy },
                    feature
                );
            }
            const leftPoints = geometry.getTerrainFeaturePoints(left);
            const rightPoints = geometry.getTerrainFeaturePoints(right);
            return leftPoints.some((point) => geometry.pointInBlob(point, right))
                || rightPoints.some((point) => geometry.pointInBlob(point, left))
                || geometry.pointInBlob({ x: left.cx, y: left.cy }, right)
                || geometry.pointInBlob({ x: right.cx, y: right.cy }, left);
        }

        canPlaceTerrainPiece(piece) {
            return ![...this.state.terrain.roads, ...this.state.terrain.features]
                .some((placed) => this.terrainPiecesOverlap(piece, placed));
        }

        createRandomTerrainPiece(random = Math.random) {
            const terrain = this.getTerrainSetup();
            const weightedKinds = ['road', 'road', 'forest', 'swamp', 'water', 'impassable', 'forest'];
            const kind = weightedKinds[Math.floor(random() * weightedKinds.length)];
            const piece = data.createTerrainOffer(kind, `terrain-${terrain.nextTerrainId}`, random);
            terrain.nextTerrainId += 1;
            if (piece.kind === 'road') {
                piece.position = random() * data.BOARD_SIZE;
            } else {
                piece.cx = random() * data.BOARD_SIZE;
                piece.cy = random() * data.BOARD_SIZE;
                piece.rotation = random() * Math.PI * 2;
            }
            return piece;
        }

        autoPlaceTerrain(random = Math.random) {
            const terrain = this.getTerrainSetup();
            if (!terrain) {
                return;
            }
            let placedCount = 0;
            const attemptLimit = 160;
            while (this.getPlacedTerrainCount() < terrain.terrainCount) {
                let piece = null;
                for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
                    const candidate = this.createRandomTerrainPiece(random);
                    if (this.canPlaceTerrainPiece(candidate)) {
                        piece = candidate;
                        break;
                    }
                }
                if (!piece) {
                    break;
                }
                if (piece.kind === 'road') {
                    this.state.terrain.roads.push(piece);
                } else {
                    this.state.terrain.features.push(piece);
                }
                terrain.selectedTerrainId = piece.id;
                placedCount += 1;
            }
            this.createTerrainOffers(random);
            this.updateStatus(placedCount > 0
                ? `Placed ${placedCount} random terrain piece${placedCount === 1 ? '' : 's'} without overlap.`
                : 'No additional non-overlapping terrain positions were available.');
        }

        getTerrainPieceById(id) {
            return this.state.terrain.roads.find((piece) => piece.id === id)
                || this.state.terrain.features.find((piece) => piece.id === id)
                || null;
        }

        pickTerrainPiece(point) {
            const feature = [...this.state.terrain.features].reverse().find((entry) => geometry.pointInBlob(point, entry));
            if (feature) {
                return feature;
            }
            return [...this.state.terrain.roads].reverse().find((road) => (
                road.orientation === 'horizontal'
                    ? Math.abs(point.y - road.position) <= road.width / 2
                    : Math.abs(point.x - road.position) <= road.width / 2
            )) || null;
        }

        isSetupActive() {
            return Boolean(this.state.setupStage && this.state.setupStage !== 'game');
        }

        getArmyDraft(playerId) {
            return this.state.setup?.armies?.[playerId] || { counts: {} };
        }

        getArmyValue(playerId) {
            const counts = this.getArmyDraft(playerId).counts;
            return Object.entries(counts).reduce((total, [type, count]) => total + ((data.UNIT_TYPES[type]?.value || 0) * count), 0);
        }

        isArmyValid(playerId) {
            return this.getArmyValue(playerId) === data.ARMY_POINT_TARGET;
        }

        canAcceptArmies() {
            return data.PLAYER_IDS.every((playerId) => this.isArmyValid(playerId));
        }

        adjustArmyUnit(playerId, type, delta) {
            const draft = this.getArmyDraft(playerId);
            const current = draft.counts[type] || 0;
            const next = Math.max(0, current + delta);
            if (next === current) {
                return;
            }
            draft.counts[type] = next;
            this.syncUiFromState();
        }

        updateArmyPlayer(playerId, property, value) {
            if (property !== 'colorId' && property !== 'faction') {
                return;
            }
            this.state.players[playerId][property] = value;
            this.syncUiFromState();
        }

        chooseRandomArmy(playerId, random = Math.random) {
            const counts = this.getArmyDraft(playerId).counts;
            Object.keys(counts).forEach((type) => delete counts[type]);
            let remaining = data.ARMY_POINT_TARGET;
            const templates = Object.entries(data.UNIT_TYPES);
            while (remaining > 0) {
                const eligible = templates.filter(([, unit]) => unit.value <= remaining);
                const [type, unit] = eligible[Math.floor(random() * eligible.length)];
                counts[type] = (counts[type] || 0) + 1;
                remaining -= unit.value;
            }
            this.updateStatus(`Player ${data.PLAYER_IDS.indexOf(playerId) + 1} received a random 24 AP army.`);
        }

        randomizeArmyPresentation(playerId, random = Math.random) {
            const colorIds = Object.keys(data.PLAYER_COLORS);
            this.state.players[playerId].colorId = colorIds[Math.floor(random() * colorIds.length)];
            this.state.players[playerId].faction = data.FACTIONS[Math.floor(random() * data.FACTIONS.length)];
            this.syncUiFromState();
        }

        clearArmy(playerId) {
            this.getArmyDraft(playerId).counts = {};
            this.updateStatus(`Player ${data.PLAYER_IDS.indexOf(playerId) + 1}'s army was cleared.`);
        }

        openArmyConfirmation() {
            if (!this.canAcceptArmies()) {
                return;
            }
            this.state.setup.confirmation = 'armies';
            this.syncUiFromState();
        }

        closeSetupConfirmation() {
            this.state.setup.confirmation = null;
            this.syncUiFromState();
        }

        confirmSetupStage() {
            if (this.state.setup.confirmation !== 'armies' || !this.canAcceptArmies()) {
                if (this.state.setup.confirmation !== 'terrain' || !this.isTerrainReady()) {
                    return;
                }
                this.state.setup.confirmation = null;
                this.state.setupStage = 'unit-deployment';
                this.updateStatus('Terrain confirmed. Unit deployment is next.');
                return;
            }
            this.state.setup.confirmation = null;
            this.initializeTerrainPlacement();
            this.state.setupStage = 'terrain-placement';
            this.updateStatus(`${this.getPlayerLabel(this.getTerrainSetup().defenderPlayerId)} is the defender and places terrain first.`);
        }

        openTerrainConfirmation() {
            if (!this.isTerrainReady()) {
                return;
            }
            this.state.setup.confirmation = 'terrain';
            this.syncUiFromState();
        }

        getUnitPlayerId(unit) {
            if (unit?.playerId) {
                return unit.playerId;
            }
            return unit?.side === 'red' ? 'player-2' : unit?.side === 'blue' ? 'player-1' : null;
        }

        getPlayer(playerId) {
            const normalizedPlayerId = playerId === 'red' ? 'player-2' : playerId === 'blue' ? 'player-1' : playerId;
            return this.state.players?.[normalizedPlayerId] || data.DEFAULT_PLAYERS[normalizedPlayerId] || null;
        }

        getPlayerColors(playerId) {
            const colorId = this.getPlayer(playerId)?.colorId || 'blue';
            return data.PLAYER_COLORS[colorId] || data.PLAYER_COLORS.blue;
        }

        getPlayerLabel(playerId) {
            return this.getPlayerColors(playerId).label;
        }

        getOpponentPlayerId(playerId) {
            return data.PLAYER_IDS.find((candidate) => candidate !== playerId) || null;
        }

        bindUi() {
            this.populateUnitTypes();
            window.addEventListener('resize', () => this.resizeCanvas());
            window.addEventListener('keydown', (event) => this.onKeyDown(event));
            this.ui.editModeButton.addEventListener('click', () => this.setMode('edit'));
            this.ui.gameModeButton.addEventListener('click', () => this.setMode('game'));
            this.ui.acceptArmiesButton.addEventListener('click', () => this.openArmyConfirmation());
            this.ui.cancelConfirmationButton.addEventListener('click', () => this.closeSetupConfirmation());
            this.ui.confirmationBackdrop.addEventListener('click', () => this.closeSetupConfirmation());
            this.ui.confirmSetupButton.addEventListener('click', () => this.confirmSetupStage());
            this.ui.terrainCountInput.addEventListener('change', () => this.setTerrainCount(this.ui.terrainCountInput.value));
            this.ui.autoPlaceTerrainButton.addEventListener('click', () => this.autoPlaceTerrain());
            this.ui.confirmTerrainButton.addEventListener('click', () => this.openTerrainConfirmation());
            this.ui.activeSideSelect.addEventListener('change', () => {
                this.state.activePlayerId = this.ui.activeSideSelect.value;
                this.resetMovedFlags(this.state.activePlayerId);
                this.cancelDraft(false);
                this.updateSelectionAnalysis();
                this.updateStatus(this.state.mode === 'edit' ? 'Edit mode: active side updated.' : 'Game mode: active side updated.');
            });
            this.ui.remainingMovesInput.addEventListener('change', () => {
                this.state.remainingMoves = geometry.clamp(Number(this.ui.remainingMovesInput.value) || 0, 0, 9);
                this.syncUiFromState();
                this.requestRender();
            });
            this.ui.phaseSelect.addEventListener('change', () => {
                this.cancelDraft(false);
                this.setPhase(this.ui.phaseSelect.value);
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus('Phase set to ' + this.state.phase + '.');
            });
            this.ui.newUnitTypeSelect.addEventListener('change', () => {
                this.state.placementType = this.ui.newUnitTypeSelect.value;
            });
            this.ui.placementSideSelect.addEventListener('change', () => {
                this.state.placementPlayerId = this.ui.placementSideSelect.value;
            });
            this.ui.placeUnitButton.addEventListener('click', () => {
                this.state.placingUnit = !this.state.placingUnit;
                this.updateStatus(this.state.placingUnit ? 'Click the board to place a new ' + this.state.placementType + '.' : 'Placement cancelled.');
                this.syncUiFromState();
            });
            this.ui.finishMoveButton.addEventListener('click', () => this.finishDraft());
            this.ui.endMovePhaseButton.addEventListener('click', () => this.endMovePhase());
            this.ui.stepMoveButton.addEventListener('click', () => this.stepSingleDraft());
            this.ui.snapCheckbox.addEventListener('change', () => {
                this.state.snapEnabled = this.ui.snapCheckbox.checked;
                this.updateStatus(`Snapping ${this.state.snapEnabled ? 'enabled' : 'disabled'}.`);
            });
            this.ui.formUpPreviewCheckbox.addEventListener('change', () => {
                this.state.showFormUpPreview = this.ui.formUpPreviewCheckbox.checked;
                this.syncUiFromState();
                this.requestRender();
                this.updateStatus(`Form-up preview ${this.state.showFormUpPreview ? 'enabled' : 'disabled'}.`);
            });
            this.ui.cornerRotationCheckbox.addEventListener('change', () => {
                this.state.singleRotationMode = this.ui.cornerRotationCheckbox.checked ? 'front-corner' : 'center';
                this.updateStatus(`Single-unit rotation mode: ${this.state.singleRotationMode === 'front-corner' ? 'front corner' : 'center'}.`);
            });
            this.ui.rangedAreaCheckbox.addEventListener('change', () => {
                this.state.showRangedArea = this.ui.rangedAreaCheckbox.checked;
                this.requestRender();
            });
            this.ui.resolveShootingButton.addEventListener('click', () => {
                if (this.state.phase === 'melee') {
                    this.resolveMeleePhase();
                    return;
                }
                this.resolveShootingPhase();
            });
            this.ui.storageButton.addEventListener('click', () => this.openStorageModal());
            this.ui.closeStorageButton.addEventListener('click', () => this.closeStorageModal());
            this.ui.storageBackdrop.addEventListener('click', () => this.closeStorageModal());
            this.ui.saveStorageButton.addEventListener('click', () => this.saveCurrentGame());
            this.ui.cancelMoveButton.addEventListener('click', () => this.cancelDraft(true));
            this.ui.acknowledgedButton.addEventListener('click', () => this.acknowledgePhase());
            this.ui.undoMoveButton.addEventListener('click', () => {
                if (this.state.mode === 'edit') {
                    this.undoEditStep();
                    return;
                }
                this.undoDraftStep();
            });
        }

        onKeyDown(event) {
            if (this.isTypingTarget(event.target)) {
                return;
            }
            if (event.key === 'Escape' && this.state.setup?.confirmation) {
                event.preventDefault();
                this.closeSetupConfirmation();
                return;
            }
            if (event.key === 'Escape' && this.state.storageModalOpen) {
                event.preventDefault();
                this.closeStorageModal();
                return;
            }
            if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (this.state.mode === 'edit') {
                    this.undoEditStep();
                    return;
                }
                this.undoDraftStep();
                return;
            }
            if (event.code === 'Space') {
                if (this.state.mode === 'game' && this.state.phase === 'move' && this.state.draft) {
                    event.preventDefault();
                    this.finishDraft();
                }
                return;
            }
            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'u') {
                if (this.state.mode === 'game' && this.state.phase === 'move' && this.state.draft) {
                    event.preventDefault();
                    this.cancelDraft(true);
                }
                return;
            }
            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'n') {
                event.preventDefault();
                this.state.snapEnabled = !this.state.snapEnabled;
                this.updateStatus(`Snapping ${this.state.snapEnabled ? 'enabled' : 'disabled'}.`);
                return;
            }
            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'p') {
                event.preventDefault();
                this.state.showFormUpPreview = !this.state.showFormUpPreview;
                this.syncUiFromState();
                this.requestRender();
                this.updateStatus(`Form-up preview ${this.state.showFormUpPreview ? 'enabled' : 'disabled'}.`);
                return;
            }
            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'r') {
                event.preventDefault();
                this.state.singleRotationMode = this.state.singleRotationMode === 'front-corner' ? 'center' : 'front-corner';
                this.updateStatus(`Single-unit rotation mode: ${this.state.singleRotationMode === 'front-corner' ? 'front corner' : 'center'}.`);
                return;
            }
            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 's') {
                if (this.state.mode === 'game' && this.state.phase === 'move' && this.state.draft) {
                    event.preventDefault();
                    this.stepSingleDraft();
                }
                return;
            }

            const nudgeDistance = data.pacesToMm(50);
            let delta = null;
            if (event.key === 'ArrowUp') {
                delta = { x: 0, y: -nudgeDistance };
            } else if (event.key === 'ArrowDown') {
                delta = { x: 0, y: nudgeDistance };
            } else if (event.key === 'ArrowLeft') {
                delta = { x: -nudgeDistance, y: 0 };
            } else if (event.key === 'ArrowRight') {
                delta = { x: nudgeDistance, y: 0 };
            }
            if (!delta) {
                return;
            }
            if (!this.nudgeSelection(delta)) {
                return;
            }
            event.preventDefault();
        }

        isTypingTarget(target) {
            if (!target || !(target instanceof HTMLElement)) {
                return false;
            }
            const tagName = target.tagName;
            return tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' || target.isContentEditable;
        }

        nudgeSelection(delta) {
            const selectedUnits = this.getSelectedUnits();
            if (selectedUnits.length === 0) {
                return false;
            }
            if (this.state.mode === 'edit') {
                this.recordEditSnapshot(this.createEditSnapshot());
                selectedUnits.forEach((unit) => {
                    unit.x += delta.x;
                    unit.y += delta.y;
                });
                this.updateSelectionAnalysis();
                this.requestRender();
                this.updateStatus('Selection nudged.');
                return true;
            }
            if (this.state.phase !== 'move') {
                return false;
            }
            if (!this.ensureDraft(this.state.selectedIds)) {
                return false;
            }
            selectedUnits.forEach((unit) => {
                unit.x += delta.x;
                unit.y += delta.y;
            });
            this.evaluateDraft();
            if (this.state.selectionAnalysis.type !== 'single') {
                this.commitDraftStep();
            }
            this.updateSelectionAnalysis();
            this.requestRender();
            this.updateStatus('Draft nudged.');
            return true;
        }

        snapSelection(unitIds) {
            if (!this.state.snapEnabled) {
                return;
            }
            const movingUnits = unitIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
            if (movingUnits.length === 0) {
                return;
            }
            const movingIdSet = new Set(unitIds);
            const stationaryUnits = this.state.units.filter((unit) => !movingIdSet.has(unit.id));
            const snapOffset = geometry.findFriendlySnapOffset(movingUnits, stationaryUnits);
            if (!snapOffset) {
                return;
            }
            movingUnits.forEach((unit) => {
                unit.x += snapOffset.x;
                unit.y += snapOffset.y;
            });
        }

        snapProjectedUnits(projectedUnits, unitIds) {
            if (!this.state.snapEnabled) {
                return projectedUnits;
            }
            const movingIdSet = new Set(unitIds);
            const stationaryUnits = this.state.units.filter((unit) => !movingIdSet.has(unit.id));
            const snapOffset = geometry.findFriendlySnapOffset(projectedUnits, stationaryUnits);
            if (!snapOffset) {
                return projectedUnits;
            }
            return projectedUnits.map((unit) => ({
                ...unit,
                x: unit.x + snapOffset.x,
                y: unit.y + snapOffset.y
            }));
        }

        bindCanvas() {
            this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
            this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
            this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
            this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
            this.canvas.addEventListener('pointerleave', (event) => this.onPointerUp(event));
            this.canvas.addEventListener('wheel', (event) => {
                event.preventDefault();
                const factor = event.deltaY > 0 ? 0.9 : 1.1;
                this.zoomAt(event.offsetX, event.offsetY, factor);
            }, { passive: false });
            this.ui.terrainCanvas.addEventListener('pointerdown', (event) => this.onTerrainPointerDown(event));
            this.ui.terrainCanvas.addEventListener('pointermove', (event) => this.onTerrainPointerMove(event));
            this.ui.terrainCanvas.addEventListener('pointerup', (event) => this.onTerrainPointerUp(event));
            this.ui.terrainCanvas.addEventListener('pointerleave', (event) => this.onTerrainPointerUp(event));
        }

        terrainScreenToWorld(event) {
            const rect = this.ui.terrainCanvas.getBoundingClientRect();
            return {
                x: geometry.clamp(((event.clientX - rect.left) / rect.width) * data.BOARD_SIZE, 0, data.BOARD_SIZE),
                y: geometry.clamp(((event.clientY - rect.top) / rect.height) * data.BOARD_SIZE, 0, data.BOARD_SIZE)
            };
        }

        onTerrainPointerDown(event) {
            if (this.state.setupStage !== 'terrain-placement') {
                return;
            }
            const point = this.terrainScreenToWorld(event);
            const rotationPiece = this.getTerrainRotationHandleHit(point);
            if (rotationPiece) {
                this.getTerrainSetup().selectedTerrainId = rotationPiece.id;
                this.ui.terrainCanvas.setPointerCapture(event.pointerId);
                this.state.terrainInteraction = {
                    type: 'rotate',
                    pointerId: event.pointerId,
                    pieceId: rotationPiece.id,
                    center: this.getTerrainPieceCenter(rotationPiece),
                    startAngle: geometry.angleBetween(this.getTerrainPieceCenter(rotationPiece), point),
                    base: { ...rotationPiece }
                };
                this.renderTerrainPlacement();
                return;
            }
            const piece = this.pickTerrainPiece(point);
            this.ui.terrainCanvas.setPointerCapture(event.pointerId);
            if (!piece) {
                this.getTerrainSetup().selectedTerrainId = null;
                this.renderTerrainPlacement();
                return;
            }
            this.getTerrainSetup().selectedTerrainId = piece.id;
            this.state.terrainInteraction = {
                pointerId: event.pointerId,
                pieceId: piece.id,
                start: point,
                base: { ...piece }
            };
            this.renderTerrainPlacement();
        }

        onTerrainPointerMove(event) {
            const interaction = this.state.terrainInteraction;
            if (!interaction || interaction.pointerId !== event.pointerId) {
                return;
            }
            const piece = this.getTerrainPieceById(interaction.pieceId);
            if (!piece) {
                return;
            }
            const point = this.terrainScreenToWorld(event);
            if (interaction.type === 'rotate') {
                const currentAngle = geometry.angleBetween(interaction.center, point);
                const delta = geometry.normalizeAngle(currentAngle - interaction.startAngle);
                if (piece.kind === 'road') {
                    const rotation = geometry.normalizeAngle((interaction.base.orientation === 'horizontal' ? 0 : Math.PI / 2) + delta);
                    piece.orientation = Math.abs(Math.cos(rotation)) >= Math.abs(Math.sin(rotation)) ? 'horizontal' : 'vertical';
                } else {
                    piece.rotation = geometry.normalizeAngle((interaction.base.rotation || 0) + delta);
                }
                this.renderTerrainPlacement();
                return;
            }
            const delta = geometry.subtract(point, interaction.start);
            if (piece.kind === 'road') {
                piece.position = geometry.clamp(
                    interaction.base.position + (piece.orientation === 'horizontal' ? delta.y : delta.x),
                    0,
                    data.BOARD_SIZE
                );
            } else {
                piece.cx = geometry.clamp(interaction.base.cx + delta.x, 0, data.BOARD_SIZE);
                piece.cy = geometry.clamp(interaction.base.cy + delta.y, 0, data.BOARD_SIZE);
            }
            this.renderTerrainPlacement();
        }

        onTerrainPointerUp(event) {
            const interaction = this.state.terrainInteraction;
            if (!interaction || interaction.pointerId !== event.pointerId) {
                return;
            }
            if (this.ui.terrainCanvas.hasPointerCapture(event.pointerId)) {
                this.ui.terrainCanvas.releasePointerCapture(event.pointerId);
            }
            this.state.terrainInteraction = null;
            this.updateStatus(interaction.type === 'rotate' ? 'Terrain rotation updated.' : 'Terrain position updated.');
        }

        getTerrainPieceCenter(piece) {
            if (piece.kind !== 'road') {
                return { x: piece.cx, y: piece.cy };
            }
            return piece.orientation === 'horizontal'
                ? { x: data.BOARD_SIZE / 2, y: piece.position }
                : { x: piece.position, y: data.BOARD_SIZE / 2 };
        }

        getTerrainRotationHandle(piece) {
            const center = this.getTerrainPieceCenter(piece);
            if (piece.kind === 'road') {
                return piece.orientation === 'horizontal'
                    ? { x: center.x, y: center.y - 34 }
                    : { x: center.x + 34, y: center.y };
            }
            const distance = Math.max(piece.rx, piece.ry) + 28;
            const rotation = piece.rotation || 0;
            return {
                x: center.x + (Math.sin(rotation) * distance),
                y: center.y - (Math.cos(rotation) * distance)
            };
        }

        getTerrainRotationHandleHit(point) {
            const terrain = this.getTerrainSetup();
            const selected = this.getTerrainPieceById(terrain?.selectedTerrainId);
            return selected && geometry.distance(point, this.getTerrainRotationHandle(selected)) <= 16 ? selected : null;
        }

        populateUnitTypes() {
            Object.keys(data.UNIT_TYPES).forEach((name) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.ui.newUnitTypeSelect.appendChild(option);
            });
        }

        setMode(mode) {
            if (this.state.mode === mode) {
                return;
            }
            this.state.mode = mode;
            this.state.placingUnit = false;
            this.cancelDraft(false);
            if (mode !== 'game') {
                this.state.formUp = null;
            }
            if (mode === 'game') {
                this.state.selectedIds = this.state.selectedIds.filter((unitId) => {
                    const unit = this.getUnitById(unitId);
                    return unit && this.getUnitPlayerId(unit) === this.state.activePlayerId;
                });
                this.updateSelectionAnalysis();
                this.updateStatus('Game mode: select units on the active side and draft a move.');
            } else {
                this.updateStatus('Edit mode: place, drag, marquee-select, or rotate units.');
            }
            this.syncUiFromState();
            this.requestRender();
        }

        resizeCanvas() {
            const changed = this.syncCanvasResolution();
            if (!changed) {
                this.requestRender();
            }
        }

        syncCanvasResolution() {
            const displayWidth = Math.max(900, Math.round(this.canvas.clientWidth * window.devicePixelRatio));
            const displayHeight = Math.max(600, Math.round(this.canvas.clientHeight * window.devicePixelRatio));
            if (this.canvas.width === displayWidth && this.canvas.height === displayHeight) {
                return false;
            }
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            this.requestRender();
            return true;
        }

        screenToWorld(screenX, screenY) {
            const rect = this.canvas.getBoundingClientRect();
            const localX = screenX - rect.left;
            const localY = screenY - rect.top;
            return {
                x: (localX - rect.width / 2) / this.state.camera.scale + this.state.camera.x,
                y: (localY - rect.height / 2) / this.state.camera.scale + this.state.camera.y
            };
        }

        worldToScreen(worldX, worldY) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (worldX - this.state.camera.x) * this.state.camera.scale + rect.width / 2,
                y: (worldY - this.state.camera.y) * this.state.camera.scale + rect.height / 2
            };
        }

        zoomAt(screenX, screenY, factor) {
            const rect = this.canvas.getBoundingClientRect();
            const before = this.screenToWorld(screenX + rect.left, screenY + rect.top);
            this.state.camera.scale = geometry.clamp(this.state.camera.scale * factor, this.state.camera.minScale, this.state.camera.maxScale);
            const after = this.screenToWorld(screenX + rect.left, screenY + rect.top);
            this.state.camera.x += before.x - after.x;
            this.state.camera.y += before.y - after.y;
            this.requestRender();
        }

        getUnitById(unitId) {
            return this.state.units.find((unit) => unit.id === unitId) || null;
        }

        getSelectedUnits() {
            return this.state.selectedIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
        }

        onPointerDown(event) {
            const world = this.screenToWorld(event.clientX, event.clientY);
            const shiftKey = event.shiftKey;
            this.canvas.setPointerCapture(event.pointerId);
            if (event.button === 2) {
                this.state.interaction = {
                    type: 'pan',
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    cameraStartX: this.state.camera.x,
                    cameraStartY: this.state.camera.y
                };
                return;
            }

            const handleHit = this.getHandleHit(world);
            const unitHit = this.pickUnit(world);
            this.state.interaction = {
                type: 'click',
                pointerId: event.pointerId,
                startWorld: world,
                startClientX: event.clientX,
                startClientY: event.clientY,
                shiftKey,
                unitHit: unitHit ? unitHit.id : null,
                handleHit,
                suppressClick: false,
                moved: false,
                dragBase: null
            };

            if (handleHit) {
                if (this.state.mode === 'game' && this.state.phase !== 'move') {
                    return;
                }
                if (handleHit.kind === 'formation-reverse' || handleHit.kind === 'single-reverse') {
                    this.state.interaction.suppressClick = true;
                    this.applyReverseSelection();
                    return;
                }
                if (handleHit.kind === 'formation-convert') {
                    this.state.interaction.suppressClick = true;
                    this.applyConvertSelection();
                    return;
                }
                this.beginRotationInteraction(handleHit, world);
                return;
            }

            const isSelectedUnit = unitHit && this.state.selectedIds.includes(unitHit.id);

            if (this.state.mode === 'game' && this.state.phase === 'move' && isSelectedUnit) {
                const analysis = this.state.selectionAnalysis;
                if (analysis.type === 'single' || analysis.type === 'rank' || (analysis.type === 'file' && analysis.leadId === unitHit.id)) {
                    if (!this.ensureDraft(this.state.selectedIds)) {
                        return;
                    }
                    this.state.draft.allowSingleRotationFormationEscape = false;
                    this.state.interaction.type = analysis.type === 'single' ? 'move-single' : analysis.type === 'rank' ? 'move-rank' : 'move-file';
                    this.state.interaction.rankAnalysis = analysis.type === 'rank' ? analysis : null;
                    this.state.interaction.dragBase = geometry.snapshotPositions(this.state.selectedIds, this.state.units);
                    this.state.interaction.draftIds = [...this.state.selectedIds];
                    this.state.interaction.anchorWorld = world;
                    return;
                }
            }

            if (this.state.mode === 'edit' && isSelectedUnit) {
                const draftIds = [...this.state.selectedIds];
                this.state.interaction.type = 'move-edit';
                this.state.interaction.dragBase = geometry.snapshotPositions(draftIds, this.state.units);
                this.state.interaction.draftIds = draftIds;
                this.state.interaction.anchorWorld = world;
                this.state.interaction.suppressClick = true;
                this.state.interaction.editSnapshot = this.createEditSnapshot();
                return;
            }

            this.state.interaction.type = 'marquee';
            this.state.marquee = {
                start: world,
                end: world,
                additive: shiftKey
            };
            this.requestRender();
        }

        beginRotationInteraction(handleHit, world) {
            const selectionIds = [...this.state.selectedIds];
            if (selectionIds.length === 0) {
                return;
            }
            if (this.state.mode === 'game' && !this.ensureDraft(selectionIds)) {
                return;
            }
            const positions = geometry.snapshotPositions(selectionIds, this.state.units);
            let pivot = null;
            if (handleHit.kind === 'rank-left' || handleHit.kind === 'rank-right') {
                pivot = handleHit.pivot;
                this.state.interaction.type = 'rotate-rank';
                this.state.interaction.rankAnalysis = this.state.selectionAnalysis;
                this.state.interaction.forwardRotationSign = handleHit.forwardRotationSign || 1;
                this.state.interaction.suppressClick = true;
                if (this.state.draft) {
                    this.state.draft.allowSingleRotationFormationEscape = false;
                }
            } else {
                const selectedUnit = this.getUnitById(handleHit.unitId);
                pivot = geometry.getUnitCenter(selectedUnit);
                this.state.interaction.type = 'rotate-single';
                this.state.interaction.singleRotationMode = this.state.singleRotationMode;
                this.state.interaction.centerPivot = pivot;
                this.state.interaction.suppressClick = true;
                if (this.state.draft) {
                    this.state.draft.allowSingleRotationFormationEscape = true;
                }
            }
            this.state.interaction.dragBase = positions;
            this.state.interaction.anchorAngle = geometry.angleBetween(pivot, world);
            this.state.interaction.pivot = pivot;
            this.state.interaction.draftIds = selectionIds;
            if (this.state.mode === 'edit') {
                this.state.interaction.editSnapshot = this.createEditSnapshot();
            }
        }

        applyProjectedRankUnits(interaction, projectedUnits, snapBeforeResolve) {
            const originUnits = interaction.draftIds
                .map((unitId) => interaction.dragBase[unitId])
                .filter(Boolean)
                .map((unit) => ({ ...unit }));
            let nextUnits = projectedUnits;
            if (snapBeforeResolve) {
                nextUnits = this.snapProjectedUnits(nextUnits, interaction.draftIds);
            }
            const resolved = rules.resolveAngledRankMoveContact(
                originUnits,
                nextUnits,
                this.state.units,
                this.state.activePlayerId,
                this.state.terrain
            );
            const appliedUnits = resolved ? resolved.units : nextUnits;
            interaction.preserveRankFormation = Boolean(resolved && resolved.unitIds && resolved.unitIds.length > 0);
            appliedUnits.forEach((projectedUnit) => {
                const unit = this.getUnitById(projectedUnit.id);
                Object.assign(unit, projectedUnit);
            });
        }

        onPointerMove(event) {
            const interaction = this.state.interaction;
            if (!interaction || interaction.pointerId !== event.pointerId) {
                return;
            }
            const world = this.screenToWorld(event.clientX, event.clientY);
            const dx = event.clientX - interaction.startClientX;
            const dy = event.clientY - interaction.startClientY;
            if (Math.abs(dx) > data.DRAG_THRESHOLD || Math.abs(dy) > data.DRAG_THRESHOLD) {
                interaction.moved = true;
            }

            if (interaction.type === 'pan') {
                this.state.camera.x = interaction.cameraStartX - dx / this.state.camera.scale;
                this.state.camera.y = interaction.cameraStartY - dy / this.state.camera.scale;
                this.requestRender();
                return;
            }

            if (interaction.type === 'marquee') {
                this.state.marquee.end = world;
                this.requestRender();
                return;
            }

            if (!interaction.moved || !interaction.dragBase) {
                return;
            }

            if (interaction.type === 'move-edit') {
                const delta = geometry.subtract(world, interaction.anchorWorld);
                interaction.draftIds.forEach((unitId) => {
                    const base = interaction.dragBase[unitId];
                    const unit = this.getUnitById(unitId);
                    unit.x = base.x + delta.x;
                    unit.y = base.y + delta.y;
                });
                this.snapSelection(interaction.draftIds);
                this.updateSelectionAnalysis();
                this.requestRender();
                return;
            }

            if (interaction.type === 'move-single') {
                const delta = geometry.subtract(world, interaction.anchorWorld);
                const unitId = interaction.draftIds[0];
                const base = interaction.dragBase[unitId];
                const unit = this.getUnitById(unitId);
                unit.x = base.x + delta.x;
                unit.y = base.y + delta.y;
                this.snapSelection(interaction.draftIds);
                this.evaluateDraft();
                this.requestRender();
                return;
            }

            if (interaction.type === 'move-rank') {
                const analysis = interaction.rankAnalysis || this.state.selectionAnalysis;
                const delta = geometry.subtract(world, interaction.anchorWorld);
                const allowedDistance = Math.max(0, geometry.dot(delta, analysis.forward));
                const moveDelta = geometry.scaleVector(analysis.forward, allowedDistance);
                const projectedUnits = interaction.draftIds.map((unitId) => {
                    const base = interaction.dragBase[unitId];
                    return {
                        ...base,
                        x: base.x + moveDelta.x,
                        y: base.y + moveDelta.y
                    };
                });
                this.applyProjectedRankUnits(interaction, projectedUnits, true);
                this.evaluateDraft();
                if (interaction.preserveRankFormation) {
                    this.state.selectionAnalysis = interaction.rankAnalysis;
                } else {
                    this.updateSelectionAnalysis();
                }
                this.requestRender();
                return;
            }

            if (interaction.type === 'move-file') {
                const analysis = this.state.selectionAnalysis;
                const delta = geometry.subtract(world, interaction.anchorWorld);
                const forwardAmount = Math.max(0, geometry.dot(delta, analysis.forward));
                const lateralAmount = geometry.clamp(geometry.dot(delta, analysis.right), -forwardAmount, forwardAmount);
                const leadDelta = geometry.add(geometry.scaleVector(analysis.forward, forwardAmount), geometry.scaleVector(analysis.right, lateralAmount));
                const orderedIds = analysis.orderedIds;
                const leadBase = interaction.dragBase[orderedIds[0]];
                const leadUnit = this.getUnitById(orderedIds[0]);
                leadUnit.x = leadBase.x + leadDelta.x;
                leadUnit.y = leadBase.y + leadDelta.y;
                leadUnit.rotation = leadBase.rotation;
                for (let index = 1; index < orderedIds.length; index += 1) {
                    const previousUnit = this.getUnitById(orderedIds[index - 1]);
                    const follower = this.getUnitById(orderedIds[index]);
                    const followerBase = interaction.dragBase[orderedIds[index]];
                    const previousCorners = geometry.getUnitCorners(previousUnit);
                    follower.x = previousCorners.backLeft.x;
                    follower.y = previousCorners.backLeft.y;
                    follower.rotation = followerBase.rotation;
                }
                this.snapSelection(interaction.draftIds);
                this.evaluateDraft();
                this.requestRender();
                return;
            }

            if (interaction.type === 'rotate-single') {
                const unitId = interaction.draftIds[0];
                const unit = this.getUnitById(unitId);
                const currentAngle = geometry.angleBetween(interaction.centerPivot || interaction.pivot, world);
                const rotationDelta = geometry.normalizeAngle(currentAngle - interaction.anchorAngle);
                const nextRotation = geometry.normalizeAngle(interaction.dragBase[unitId].rotation + rotationDelta);
                if (interaction.singleRotationMode === 'front-corner') {
                    const baseCorners = geometry.getUnitCorners(interaction.dragBase[unitId]);
                    if (rotationDelta >= 0) {
                        const fixedFrontRight = baseCorners.frontRight;
                        const nextRight = geometry.getRightVector(nextRotation);
                        unit.x = fixedFrontRight.x - (nextRight.x * unit.width);
                        unit.y = fixedFrontRight.y - (nextRight.y * unit.width);
                    } else {
                        unit.x = baseCorners.frontLeft.x;
                        unit.y = baseCorners.frontLeft.y;
                    }
                    unit.rotation = nextRotation;
                } else {
                    const rotatedFrontLeft = geometry.rotatePoint({ x: interaction.dragBase[unitId].x, y: interaction.dragBase[unitId].y }, interaction.pivot, rotationDelta);
                    unit.rotation = nextRotation;
                    unit.x = rotatedFrontLeft.x;
                    unit.y = rotatedFrontLeft.y;
                }
                if (this.state.mode === 'game') {
                    this.evaluateDraft();
                }
                this.updateSelectionAnalysis();
                this.requestRender();
                return;
            }

            if (interaction.type === 'rotate-rank') {
                const analysis = interaction.rankAnalysis || this.state.selectionAnalysis;
                const currentAngle = geometry.angleBetween(interaction.pivot, world);
                const rawRotationDelta = geometry.normalizeAngle(currentAngle - interaction.anchorAngle);
                const rotationDelta = (interaction.forwardRotationSign || 1) > 0
                    ? Math.max(0, rawRotationDelta)
                    : Math.min(0, rawRotationDelta);
                const projectedUnits = interaction.draftIds.map((unitId) => {
                    const base = interaction.dragBase[unitId];
                    const frontLeft = geometry.rotatePoint({ x: base.x, y: base.y }, interaction.pivot, rotationDelta);
                    return {
                        ...base,
                        x: frontLeft.x,
                        y: frontLeft.y,
                        rotation: geometry.normalizeAngle(base.rotation + rotationDelta)
                    };
                });
                if (analysis.type === 'rank') {
                    this.applyProjectedRankUnits(interaction, projectedUnits, false);
                } else {
                    projectedUnits.forEach((projectedUnit) => {
                        const unit = this.getUnitById(projectedUnit.id);
                        Object.assign(unit, projectedUnit);
                    });
                    this.snapSelection(interaction.draftIds);
                }
                this.evaluateDraft();
                if (interaction.preserveRankFormation) {
                    this.state.selectionAnalysis = interaction.rankAnalysis;
                } else {
                    this.updateSelectionAnalysis();
                }
                this.requestRender();
            }
        }

        onPointerUp(event) {
            const interaction = this.state.interaction;
            if (!interaction || interaction.pointerId !== event.pointerId) {
                return;
            }
            const world = this.screenToWorld(event.clientX, event.clientY);
            if (interaction.type === 'marquee' && this.state.marquee) {
                const marquee = this.state.marquee;
                this.state.marquee = null;
                if (interaction.moved) {
                    this.applyMarqueeSelection(marquee);
                } else if (!interaction.suppressClick) {
                    this.handleClick(world, interaction);
                }
            } else if (!interaction.moved && !interaction.suppressClick) {
                this.handleClick(world, interaction);
            } else if (this.state.mode === 'edit' && interaction.editSnapshot && (interaction.type === 'move-edit' || interaction.type === 'rotate-single' || interaction.type === 'rotate-rank')) {
                this.recordEditSnapshot(interaction.editSnapshot);
            } else if (interaction.type === 'move-rank' || interaction.type === 'move-file' || interaction.type === 'rotate-rank') {
                this.commitDraftStep();
            }
            if (interaction.preserveRankFormation) {
                this.updateSelectionAnalysis();
                this.syncUiFromState();
            }
            if (this.canvas.hasPointerCapture(event.pointerId)) {
                this.canvas.releasePointerCapture(event.pointerId);
            }
            this.state.interaction = null;
            this.requestRender();
        }

        handleClick(world, interaction) {
            const unitHit = interaction.unitHit ? this.getUnitById(interaction.unitHit) : this.pickUnit(world);
            if (this.state.mode === 'game' && this.state.phase === 'shooting') {
                this.handleShootingClick(unitHit);
                return;
            }
            if (this.state.mode === 'edit' && this.state.placingUnit && !unitHit) {
                this.placeUnit(world);
                return;
            }
            if (unitHit) {
                if (this.state.mode === 'game' && this.getUnitPlayerId(unitHit) !== this.state.activePlayerId) {
                    this.updateStatus('Only the active side can be selected in game mode.');
                    return;
                }
                this.toggleSelection(unitHit.id, interaction.shiftKey);
            }
        }

        placeUnit(world) {
            const template = data.UNIT_TYPES[this.state.placementType];
            this.recordEditSnapshot(this.createEditSnapshot());
            const unit = {
                id: this.allocateUnitId(),
                type: this.state.placementType,
                ...data.createUnit(
                    this.state.placementType,
                    this.state.placementPlayerId,
                    this.getPlayer(this.state.placementPlayerId).faction,
                    {
                        x: world.x - data.UNIT_WIDTH / 2,
                        y: world.y + template.depth / 2,
                        rotation: this.state.placementPlayerId === 'player-1' ? 0 : Math.PI
                    },
                    () => this.allocateUnitId()
                )
            };
            this.state.units.push(unit);
            this.state.placingUnit = false;
            this.toggleSelection(unit.id, false);
            this.updateStatus('Placed a new ' + unit.type + '.');
        }

        toggleSelection(unitId, additive) {
            if (!additive) {
                if (this.state.selectedIds.length === 1 && this.state.selectedIds[0] === unitId) {
                    this.clearSelection();
                    return;
                }
                this.state.selectedIds = [unitId];
            } else if (this.state.selectedIds.includes(unitId)) {
                this.state.selectedIds = this.state.selectedIds.filter((id) => id !== unitId);
            } else {
                this.state.selectedIds = [...this.state.selectedIds, unitId];
            }
            if (this.state.draft && !geometry.sameIdSet(this.state.selectedIds, this.state.draft.unitIds)) {
                this.cancelDraft(false);
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
        }

        clearSelection() {
            this.state.selectedIds = [];
            if (this.state.draft) {
                this.cancelDraft(false);
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
        }

        applyMarqueeSelection(marquee) {
            const rect = geometry.normalizeRect(marquee.start, marquee.end);
            const hitIds = this.state.units
                .filter((unit) => geometry.polygonInsideRect(geometry.getUnitCorners(unit), rect))
                .filter((unit) => this.state.mode === 'edit' || this.getUnitPlayerId(unit) === this.state.activePlayerId)
                .map((unit) => unit.id);
            if (marquee.additive) {
                const nextIds = [...this.state.selectedIds];
                hitIds.forEach((unitId) => {
                    if (!nextIds.includes(unitId)) {
                        nextIds.push(unitId);
                    }
                });
                this.state.selectedIds = nextIds;
            } else {
                this.state.selectedIds = hitIds;
            }
            if (this.state.draft && !geometry.sameIdSet(this.state.selectedIds, this.state.draft.unitIds)) {
                this.cancelDraft(false);
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
        }

        pickUnit(world) {
            for (let index = this.state.units.length - 1; index >= 0; index -= 1) {
                const unit = this.state.units[index];
                if (geometry.pointInPolygon(world, geometry.getUnitCorners(unit))) {
                    return unit;
                }
            }
            return null;
        }

        getHandleHit(world) {
            const handles = this.getSelectionHandles();
            for (const handle of handles) {
                if (geometry.distance(world, handle.position) <= handle.radius) {
                    return handle;
                }
            }
            return null;
        }

        getSelectionHandles() {
            if (this.state.mode === 'game' && this.state.phase !== 'move') {
                return [];
            }
            const analysis = this.state.selectionAnalysis;
            if (analysis.type === 'none' || analysis.invalid) {
                return [];
            }
            if (analysis.type === 'single') {
                const unit = this.getUnitById(this.state.selectedIds[0]);
                if (!unit) {
                    return [];
                }
                const center = geometry.getUnitCenter(unit);
                return [{
                    kind: 'single-rotate',
                    unitId: unit.id,
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(center, geometry.scaleVector(geometry.getRightVector(unit.rotation), unit.width * 0.8)),
                    rotation: unit.rotation
                }, {
                    kind: 'single-reverse',
                    unitId: unit.id,
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(center, geometry.scaleVector(geometry.getForwardVector(unit.rotation), (unit.depth / 2) + 12)),
                    rotation: geometry.normalizeAngle(unit.rotation + (Math.PI / 2))
                }];
            }
            if (analysis.type === 'rank') {
                const reverseHandle = this.getFormationReverseHandle(analysis);
                const convertHandle = this.getFormationConvertHandle(analysis);
                const leftWheelVector = geometry.subtract(analysis.leftPivot, analysis.rightPivot);
                const rightWheelVector = geometry.subtract(analysis.rightPivot, analysis.leftPivot);
                return [{
                    kind: 'rank-left',
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(analysis.leftHandle, geometry.scaleVector(analysis.leftOutward, 16)),
                    pivot: analysis.rightPivot,
                    rotation: Math.atan2(-analysis.leftOutward.y, -analysis.leftOutward.x),
                    forwardRotationSign: Math.sign(geometry.dot({ x: -leftWheelVector.y, y: leftWheelVector.x }, analysis.forward)) || 1
                }, {
                    kind: 'rank-right',
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(analysis.rightHandle, geometry.scaleVector(analysis.rightOutward, 16)),
                    pivot: analysis.leftPivot,
                    rotation: Math.atan2(analysis.rightOutward.y, analysis.rightOutward.x),
                    forwardRotationSign: Math.sign(geometry.dot({ x: -rightWheelVector.y, y: rightWheelVector.x }, analysis.forward)) || 1
                }, reverseHandle, convertHandle];
            }
            if (analysis.type === 'file') {
                return [this.getFormationReverseHandle(analysis), this.getFormationConvertHandle(analysis)];
            }
            return [];
        }

        getFormationCenterInfo(analysis) {
            const selectedUnits = this.getSelectedUnits();
            const centers = selectedUnits.map((unit) => geometry.getUnitCenter(unit));
            const formationCenter = {
                x: geometry.average(centers.map((center) => center.x)),
                y: geometry.average(centers.map((center) => center.y))
            };
            const projections = selectedUnits
                .flatMap((unit) => geometry.cornersToPoints(geometry.getUnitCorners(unit)))
                .map((point) => ({ point, distance: geometry.dot(point, analysis.forward) }));
            const frontDistance = Math.max(...projections.map((entry) => entry.distance));
            const backDistance = Math.min(...projections.map((entry) => entry.distance));
            const centerDistance = geometry.dot(formationCenter, analysis.forward);
            return {
                formationCenter,
                frontOffset: Math.max(18, frontDistance - centerDistance + 12),
                backOffset: Math.max(18, centerDistance - backDistance + 12)
            };
        }

        getFormationReverseHandle(analysis) {
            const info = this.getFormationCenterInfo(analysis);
            return {
                kind: 'formation-reverse',
                radius: data.HANDLE_RADIUS,
                position: geometry.add(info.formationCenter, geometry.scaleVector(analysis.forward, info.frontOffset)),
                rotation: geometry.normalizeAngle(Math.atan2(analysis.forward.y, analysis.forward.x) + (Math.PI / 2))
            };
        }

        getFormationConvertHandle(analysis) {
            const info = this.getFormationCenterInfo(analysis);
            return {
                kind: 'formation-convert',
                radius: data.HANDLE_RADIUS,
                position: geometry.add(info.formationCenter, geometry.scaleVector(analysis.forward, -info.backOffset)),
                rotation: geometry.normalizeAngle(Math.atan2(analysis.forward.y, analysis.forward.x) + (Math.PI / 2))
            };
        }

        applyReverseSelection() {
            const analysis = this.state.selectionAnalysis;
            if (analysis.type !== 'single' && analysis.type !== 'rank' && analysis.type !== 'file') {
                return;
            }
            const selectionIds = [...this.state.selectedIds];
            if (selectionIds.length === 0) {
                return;
            }
            if (this.state.mode === 'game') {
                if (!this.ensureDraft(selectionIds)) {
                    return;
                }
            } else {
                this.recordEditSnapshot(this.createEditSnapshot());
            }

            if (analysis.type === 'rank') {
                const orderedUnits = analysis.orderedIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
                const reversedRotation = geometry.normalizeAngle(orderedUnits[0].rotation + Math.PI);
                const formationCenter = this.getFormationCenterInfo(analysis).formationCenter;
                const reversedUnits = this.buildRankFromLead([...orderedUnits].reverse(), reversedRotation, geometry.add(
                    formationCenter,
                    geometry.scaleVector(geometry.getForwardVector(reversedRotation), geometry.average(orderedUnits.map((unit) => unit.depth)) / 2)
                ));
                reversedUnits.forEach((candidateUnit) => {
                    const unit = this.getUnitById(candidateUnit.id);
                    Object.assign(unit, candidateUnit);
                });
            } else {
                selectionIds.forEach((unitId) => {
                    const unit = this.getUnitById(unitId);
                    Object.assign(unit, geometry.reverseUnitFacing(unit));
                });
            }

            if (this.state.mode === 'game') {
                this.evaluateDraft();
                if (analysis.type !== 'single') {
                    this.commitDraftStep();
                }
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(analysis.type === 'single' ? 'Unit reversed.' : 'Formation reversed.');
        }

        buildCenteredLinearOffsets(sizes, orientation) {
            const total = sizes.reduce((sum, size) => sum + size, 0);
            let cursor = orientation === 'forward'
                ? (total / 2) - (sizes[0] / 2)
                : (-total / 2) + (sizes[0] / 2);
            return sizes.map((size, index) => {
                if (index === 0) {
                    return cursor;
                }
                const previousSize = sizes[index - 1];
                cursor += (orientation === 'forward' ? -1 : 1) * ((previousSize / 2) + (size / 2));
                return cursor;
            });
        }

        getUnitFrontCenter(unit) {
            const corners = geometry.getUnitCorners(unit);
            return geometry.midpoint(corners.frontLeft, corners.frontRight);
        }

        getUnitSideCenter(unit, sideSign) {
            const corners = geometry.getUnitCorners(unit);
            return sideSign < 0
                ? geometry.midpoint(corners.frontLeft, corners.backLeft)
                : geometry.midpoint(corners.frontRight, corners.backRight);
        }

        buildFileFromSide(order, rotation, sideAnchor, sideSign) {
            const forward = geometry.getForwardVector(rotation);
            const right = geometry.getRightVector(rotation);
            const offsets = this.buildCenteredLinearOffsets(order.map((unit) => unit.depth), 'forward');
            const converted = [];
            order.forEach((unit, index) => {
                const sideCenter = geometry.add(sideAnchor, geometry.scaleVector(forward, offsets[index]));
                const center = geometry.add(sideCenter, geometry.scaleVector(right, -sideSign * (unit.width / 2)));
                converted.push(geometry.buildUnitFromCenter(unit, center, rotation));
            });
            return converted;
        }

        buildRankFromLead(order, rotation, frontAnchor) {
            const forward = geometry.getForwardVector(rotation);
            const right = geometry.getRightVector(rotation);
            const offsets = this.buildCenteredLinearOffsets(order.map((unit) => unit.width), 'right');
            const converted = [];
            order.forEach((unit, index) => {
                const frontCenter = geometry.add(frontAnchor, geometry.scaleVector(right, offsets[index]));
                const center = geometry.add(frontCenter, geometry.scaleVector(forward, -(unit.depth / 2)));
                converted.push(geometry.buildUnitFromCenter(unit, center, rotation));
            });
            return converted;
        }

        estimateConvertedFormationTravel(units, converted) {
            const byId = new Map(converted.map((unit) => [unit.id, unit]));
            return converted.reduce((maxDistance, unit) => {
                const originalUnit = units.find((candidate) => candidate.id === unit.id);
                const candidateUnit = byId.get(unit.id);
                return Math.max(maxDistance, geometry.distance(geometry.getUnitCenter(originalUnit), geometry.getUnitCenter(candidateUnit)));
            }, 0);
        }

        buildConvertedFormationCandidates(units, analysis) {
            const boardCenter = { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 };
            const orderedUnits = analysis.orderedIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
            const candidates = [];
            if (analysis.type === 'rank') {
                const frontAnchor = geometry.midpoint(
                    this.getUnitFrontCenter(orderedUnits[0]),
                    this.getUnitFrontCenter(orderedUnits[orderedUnits.length - 1])
                );
                const toBoardCenter = geometry.subtract(boardCenter, frontAnchor);
                const leftRotation = geometry.normalizeAngle(orderedUnits[0].rotation - (Math.PI / 2));
                const rightRotation = geometry.normalizeAngle(orderedUnits[0].rotation + (Math.PI / 2));
                candidates.push({
                    converted: this.buildFileFromSide(orderedUnits, leftRotation, frontAnchor, 1),
                    score: geometry.dot(geometry.getForwardVector(leftRotation), toBoardCenter)
                });
                candidates.push({
                    converted: this.buildFileFromSide([...orderedUnits].reverse(), rightRotation, frontAnchor, -1),
                    score: geometry.dot(geometry.getForwardVector(rightRotation), toBoardCenter)
                });
            } else {
                const inwardRotationA = geometry.normalizeAngle(orderedUnits[0].rotation - (Math.PI / 2));
                const inwardRotationB = geometry.normalizeAngle(orderedUnits[0].rotation + (Math.PI / 2));
                const leftSideAnchor = geometry.midpoint(
                    this.getUnitSideCenter(orderedUnits[0], -1),
                    this.getUnitSideCenter(orderedUnits[orderedUnits.length - 1], -1)
                );
                const rightSideAnchor = geometry.midpoint(
                    this.getUnitSideCenter(orderedUnits[0], 1),
                    this.getUnitSideCenter(orderedUnits[orderedUnits.length - 1], 1)
                );
                const leftToBoardCenter = geometry.subtract(boardCenter, leftSideAnchor);
                const rightToBoardCenter = geometry.subtract(boardCenter, rightSideAnchor);
                const preferredFirst = geometry.distance(leftSideAnchor, boardCenter) <= geometry.distance(rightSideAnchor, boardCenter);
                const preferredAnchor = preferredFirst ? leftSideAnchor : rightSideAnchor;
                const fallbackAnchor = preferredFirst ? rightSideAnchor : leftSideAnchor;
                const preferredToBoardCenter = preferredFirst ? leftToBoardCenter : rightToBoardCenter;
                const fallbackToBoardCenter = preferredFirst ? rightToBoardCenter : leftToBoardCenter;
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationA, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationA), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationA, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationA), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationB, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationB), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationB, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationB), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationA, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationA), fallbackToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationA, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationA), fallbackToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationB, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationB), fallbackToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationB, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationB), fallbackToBoardCenter)
                });
            }

            return candidates
                .map((candidate) => ({
                    ...candidate,
                    travel: this.estimateConvertedFormationTravel(units, candidate.converted)
                }))
                .sort((left, right) => (right.preference || 0) - (left.preference || 0) || (right.score - left.score) || (left.travel - right.travel));
        }

        applyConvertSelection() {
            const analysis = this.state.selectionAnalysis;
            if (analysis.type !== 'rank' && analysis.type !== 'file') {
                return;
            }
            const selectionIds = [...this.state.selectedIds];
            if (selectionIds.length === 0) {
                return;
            }
            if (this.state.mode === 'game') {
                if (!this.ensureDraft(selectionIds)) {
                    return;
                }
            } else {
                this.recordEditSnapshot(this.createEditSnapshot());
            }

            const snapshot = geometry.snapshotPositions(selectionIds, this.state.units);
            const candidateFormations = this.buildConvertedFormationCandidates(this.state.units, analysis);
            let applied = false;

            for (const candidate of candidateFormations) {
                geometry.restoreSnapshot(snapshot, this.state.units);
                candidate.converted.forEach((candidateUnit) => {
                    const unit = this.getUnitById(candidateUnit.id);
                    Object.assign(unit, candidateUnit);
                });

                if (this.state.mode === 'game') {
                    const previousCornerMetric = this.state.draft.useFinalCornerDisplacement;
                    this.state.draft.useFinalCornerDisplacement = true;
                    this.evaluateDraft();
                    this.state.draft.useFinalCornerDisplacement = previousCornerMetric;
                    if (this.state.draft.invalidIds.size > 0) {
                        continue;
                    }
                    this.commitDraftStep();
                }

                applied = true;
                break;
            }

            if (!applied) {
                geometry.restoreSnapshot(snapshot, this.state.units);
                if (this.state.mode === 'game') {
                    this.evaluateDraft();
                }
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus('That rank/file conversion would be illegal.');
                return;
            }

            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(analysis.type === 'rank' ? 'Rank converted to file.' : 'File converted to rank.');
        }

        ensureDraft(unitIds) {
            if (this.state.mode !== 'game') {
                return false;
            }
            if (this.state.phase !== 'move') {
                this.updateStatus('Movement is only available during the move phase.');
                return false;
            }
            const selectedUnits = unitIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
            if (selectedUnits.length === 0 || selectedUnits.some((unit) => this.getUnitPlayerId(unit) !== this.state.activePlayerId)) {
                this.updateStatus('Only units on the active side can draft a move.');
                return false;
            }
            if (selectedUnits.some((unit) => unit.movedThisTurn)) {
                this.updateStatus('One or more selected units have already moved this turn.');
                return false;
            }
            if (this.state.remainingMoves <= 0) {
                this.updateStatus('No moves remain for this side.');
                return false;
            }
            if (this.state.draft && geometry.sameIdSet(this.state.draft.unitIds, unitIds)) {
                return true;
            }
            this.state.draft = {
                unitIds: [...unitIds],
                initialOrigin: geometry.snapshotPositions(unitIds, this.state.units),
                validationOrigin: geometry.snapshotPositions(unitIds, this.state.units),
                origin: geometry.snapshotPositions(unitIds, this.state.units),
                allowSingleRotationFormationEscape: false,
                history: [],
                invalidIds: new Set(),
                reasonById: new Map()
            };
            this.evaluateDraft();
            this.syncUiFromState();
            return true;
        }

        commitDraftStep() {
            if (!this.state.draft || this.state.selectionAnalysis.type === 'single') {
                return;
            }
            this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
            this.syncUiFromState();
        }

        undoDraftStep() {
            const draft = this.state.draft;
            if (!draft) {
                return;
            }
            if (this.state.selectionAnalysis.type === 'single') {
                const currentSnapshot = geometry.snapshotPositions(draft.unitIds, this.state.units);
                const unitId = draft.unitIds[0];
                if (geometry.sameFootprint(currentSnapshot[unitId], draft.origin[unitId])) {
                    if (draft.history.length > 0) {
                        draft.history.pop();
                    }
                    const snapshot = draft.history[draft.history.length - 1] || draft.initialOrigin;
                    geometry.restoreSnapshot(snapshot, this.state.units);
                    draft.origin = geometry.snapshotPositions(draft.unitIds, this.state.units);
                } else {
                    geometry.restoreSnapshot(draft.origin, this.state.units);
                }
                this.evaluateDraft();
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus('Draft step undone.');
                return;
            }
            if (draft.history.length > 0) {
                draft.history.pop();
            }
            const snapshot = draft.history[draft.history.length - 1] || draft.initialOrigin;
            geometry.restoreSnapshot(snapshot, this.state.units);
            this.evaluateDraft();
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus('Draft step undone.');
        }

        createEditSnapshot() {
            return history.createEditSnapshot(this.state.units, this.state.selectedIds, this.nextUnitId);
        }

        recordEditSnapshot(snapshot) {
            if (!snapshot) {
                return;
            }
            this.state.editHistory.push(snapshot);
            this.syncUiFromState();
        }

        undoEditStep() {
            const snapshot = this.state.editHistory.pop();
            if (!snapshot) {
                this.updateStatus('No edit action to undo.');
                return;
            }
            const restored = history.restoreEditSnapshot(snapshot);
            this.state.units = restored.units;
            this.state.selectedIds = restored.selectedIds;
            this.nextUnitId = restored.nextUnitId;
            this.state.placingUnit = false;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus('Edit action undone.');
        }

        cancelDraft(showStatus) {
            if (!this.state.draft) {
                this.syncUiFromState();
                return;
            }
            geometry.restoreSnapshot(this.state.draft.initialOrigin, this.state.units);
            this.state.draft = null;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            if (showStatus) {
                this.updateStatus('Draft cancelled and original position restored.');
            }
        }

        stepSingleDraft() {
            const draft = this.state.draft;
            if (!draft || this.state.selectionAnalysis.type !== 'single') {
                return;
            }
            this.evaluateDraft();
            if (draft.invalidIds.size > 0) {
                this.updateStatus('Step is only available for a valid single-unit draft.');
                return;
            }
            const checkpoint = geometry.snapshotPositions(draft.unitIds, this.state.units);
            draft.history.push(checkpoint);
            draft.origin = checkpoint;
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus('Single-unit move stepped.');
        }

        finishDraft() {
            const draft = this.state.draft;
            if (!draft) {
                return;
            }
            this.evaluateDraft();
            if (draft.invalidIds.size > 0) {
                this.updateStatus('Move is still illegal. Fix highlighted units or cancel the draft.');
                return;
            }
            // Commit the move and mark moved units so they cannot move again this turn
            this.state.remainingMoves = Math.max(0, this.state.remainingMoves - 1);
            // Mark units that actually changed footprint as having moved this turn
            draft.unitIds.forEach((unitId) => {
                const unit = this.getUnitById(unitId);
                const before = draft.initialOrigin[unitId];
                if (unit && before && this.hasUnitMoved(before, unit)) {
                    unit.movedThisTurn = true;
                }
            });
            this.state.draft = null;
            this.updateSelectionAnalysis();
            if (this.state.phase === 'move' && this.state.remainingMoves === 0) {
                this.beginFormUpPhase();
                return;
            }
            this.syncUiFromState();
            this.updateStatus('Move finished. Remaining moves: ' + this.state.remainingMoves + '.');
        }

        endMovePhase() {
            if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                return;
            }
            // Cancel any active draft and proceed to form-up as if moves were exhausted
            this.cancelDraft(false);
            this.state.remainingMoves = 0;
            this.beginFormUpPhase();
        }

        resetMovedFlags(playerId) {
            this.state.units.forEach((unit) => {
            if (!playerId || this.getUnitPlayerId(unit) === playerId) {
                    unit.movedThisTurn = false;
                }
            });
        }

        setPhase(phase) {
            if (this.state.phase !== phase) {
                this.state.phase = phase;
                if (phase === 'shooting') {
                    this.initializeShootingPhase();
                } else {
                    this.state.shooting = null;
                }
                if (phase === 'melee') {
                    this.initializeMeleePhase();
                } else {
                    this.state.melee = null;
                }
                if (phase !== 'shooting' && phase !== 'melee') {
                    this.state.combatResolution = null;
                }
                return;
            }
            this.state.phase = phase;
        }

        initializeShootingPhase() {
            this.state.shooting = {
                focusedAttackerId: null,
                validTargetIds: [],
                attacksByAttacker: {}
            };
        }

        getShootingState() {
            if (!this.state.shooting) {
                this.initializeShootingPhase();
            }
            return this.state.shooting;
        }

        initializeMeleePhase() {
            const melee = rules.detectMeleeCombats(this.state.units, this.state.terrain);
            this.state.melee = {
                combats: melee.combats,
                combatants: melee.combatants,
                participantIds: melee.participantIds
            };
        }

        hasAnyShootingAttacks() {
            return this.state.units.some((unit) => rules.isRangedUnit(unit)
                && rules.getValidShootingTargets(unit, this.state.units, this.state.terrain, this.state.activePlayerId).length > 0);
        }

        advanceToNextTurn() {
            this.state.formUp = null;
            this.state.shooting = null;
            this.state.melee = null;
            this.state.combatResolution = null;
            this.state.selectedIds = [];
            this.state.activePlayerId = this.getOpponentPlayerId(this.state.activePlayerId);
            this.state.remainingMoves = this.rollDie();
            this.resetMovedFlags(this.state.activePlayerId);
            this.setPhase('move');
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(`Turn passes to ${this.getPlayerLabel(this.state.activePlayerId)}. ${this.state.remainingMoves} moves available.`);
        }

        maybeAutoAdvanceCombatPhase() {
            if (this.state.mode !== 'game' || this.state.combatResolution) {
                return false;
            }
            if (this.state.phase === 'shooting' && !this.hasAnyShootingAttacks()) {
                this.state.shooting = null;
                this.setPhase('melee');
                if (this.state.phase === 'melee' && this.getMeleeState().combats.length === 0) {
                    this.advanceToNextTurn();
                    return true;
                }
                this.syncUiFromState();
                this.updateStatus('No valid shooting attacks. Advancing to melee.');
                return true;
            }
            if (this.state.phase === 'melee' && this.getMeleeState().combats.length === 0) {
                this.advanceToNextTurn();
                return true;
            }
            return false;
        }

        getMeleeState() {
            if (!this.state.melee) {
                this.initializeMeleePhase();
            }
            return this.state.melee;
        }

        getDeclaredTargetIds() {
            const attacks = this.state.shooting?.attacksByAttacker || {};
            return new Set(Object.values(attacks));
        }

        needsShootingDeclaration(unit) {
            if (this.state.mode !== 'game' || this.state.phase !== 'shooting' || this.state.combatResolution) {
                return false;
            }
            const attacks = this.state.shooting?.attacksByAttacker || {};
            return rules.canUnitShoot(unit, this.state.activePlayerId)
                && !attacks[unit.id]
                && rules.getValidShootingTargets(unit, this.state.units, this.state.terrain, this.state.activePlayerId).length > 0;
        }

        isUnitShootingParticipant(unit) {
            if (this.state.mode !== 'game' || this.state.phase !== 'shooting') {
                return false;
            }
            if (this.state.combatResolution) {
                return this.state.combatResolution.participantIds.has(unit.id);
            }
            const attacks = this.state.shooting?.attacksByAttacker || {};
            const isAttacker = rules.canUnitShoot(unit, this.state.activePlayerId) && Boolean(attacks[unit.id]);
            const isTarget = Object.values(attacks).includes(unit.id);
            const isPendingTarget = (this.state.shooting?.validTargetIds || []).includes(unit.id);
            const canStillShoot = this.needsShootingDeclaration(unit);
            return isAttacker || isTarget || isPendingTarget || canStillShoot;
        }

        isUnitMeleeParticipant(unit) {
            if (this.state.mode !== 'game' || this.state.phase !== 'melee') {
                return false;
            }
            if (this.state.combatResolution) {
                return this.state.combatResolution.participantIds.has(unit.id);
            }
            return this.getMeleeState().participantIds.has(unit.id);
        }

        isUnitCombatParticipant(unit) {
            if (this.state.phase === 'shooting') {
                return this.isUnitShootingParticipant(unit);
            }
            if (this.state.phase === 'melee') {
                return this.isUnitMeleeParticipant(unit);
            }
            return false;
        }

        handleShootingClick(unit) {
            if (this.state.combatResolution) {
                return;
            }
            const shooting = this.getShootingState();
            if (!unit) {
                shooting.focusedAttackerId = null;
                shooting.validTargetIds = [];
                this.state.selectedIds = [];
                this.syncUiFromState();
                this.requestRender();
                return;
            }
            if (shooting.focusedAttackerId && shooting.validTargetIds.includes(unit.id)) {
                shooting.attacksByAttacker[shooting.focusedAttackerId] = unit.id;
                this.state.selectedIds = [shooting.focusedAttackerId];
                this.syncUiFromState();
                this.requestRender();
                this.updateStatus('Shooting attack declared.');
                return;
            }
            if (rules.isRangedUnit(unit)) {
                if (unit.ranged.requiresOwnTurn && this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                    this.updateStatus('Only the active side can declare shooting attacks.');
                    return;
                }
                if (!rules.canUnitShoot(unit, this.state.activePlayerId)) {
                    shooting.focusedAttackerId = null;
                    shooting.validTargetIds = [];
                    this.state.selectedIds = [];
                    this.syncUiFromState();
                    this.requestRender();
                    this.updateStatus(`${unit.type} cannot shoot after moving this turn.`);
                    return;
                }
                const validTargetIds = rules.getValidShootingTargets(unit, this.state.units, this.state.terrain, this.state.activePlayerId);
                if (validTargetIds.length === 0) {
                    shooting.focusedAttackerId = null;
                    shooting.validTargetIds = [];
                    this.state.selectedIds = [];
                    this.syncUiFromState();
                    this.requestRender();
                    this.updateStatus(`${unit.type} cannot shoot while engaged in melee.`);
                    return;
                }
                shooting.focusedAttackerId = unit.id;
                shooting.validTargetIds = validTargetIds;
                this.state.selectedIds = [unit.id];
                this.updateStatus(`${unit.type} selected for shooting.`);
                return;
            }
            if (!shooting.focusedAttackerId) {
                return;
            }
            if (!shooting.validTargetIds.includes(unit.id)) {
                this.updateStatus('That target is not in the selected shooter\'s firing lane.');
                return;
            }
        }

        rollDie() {
            return 1 + Math.floor(Math.random() * 6);
        }

        recordLosses(destroyedUnits) {
            destroyedUnits.forEach((unit) => {
                this.state.losses[this.getUnitPlayerId(unit)].push({ id: unit.id, type: unit.type, value: unit.value });
            });
        }

        buildCombatResolution(snapshot, result, phase) {
            const allIds = Object.keys(snapshot);
            const participantIds = new Set();
            const ghostSnapshot = {};
            const destroyedIds = new Set(result.destroyedUnits.map((unit) => unit.id));
            allIds.forEach((unitId) => {
                const before = snapshot[unitId];
                const live = result.units.find((unit) => unit.id === unitId) || result.destroyedUnits.find((unit) => unit.id === unitId) || null;
                if (destroyedIds.has(unitId) || !live || this.hasUnitMoved(before, live)) {
                    ghostSnapshot[unitId] = { ...before };
                    participantIds.add(unitId);
                }
            });
            result.results.forEach((entry) => {
                if (phase === 'shooting') {
                    participantIds.add(entry.primaryAttackerId);
                    participantIds.add(entry.defenderId);
                    entry.attackerIds.forEach((attackerId) => participantIds.add(attackerId));
                    return;
                }
                entry.leftUnitIds.forEach((unitId) => participantIds.add(unitId));
                entry.rightUnitIds.forEach((unitId) => participantIds.add(unitId));
            });
            return {
                phase,
                ghostSnapshot,
                destroyedIds,
                movedUnitIds: Object.keys(ghostSnapshot),
                results: result.results.map((entry) => ({
                    ...entry,
                    attackerIds: entry.attackerIds ? [...entry.attackerIds] : undefined,
                    leftUnitIds: entry.leftUnitIds ? [...entry.leftUnitIds] : undefined,
                    rightUnitIds: entry.rightUnitIds ? [...entry.rightUnitIds] : undefined
                })),
                participantIds
            };
        }

        logCombatResults(result, phase) {
            if (!result.results.length) {
                console.info(`${phase} resolved with no combats.`);
                return;
            }
            console.groupCollapsed(`${phase} resolution: ${result.results.length} combats`);
            result.results.forEach((entry) => {
                if (phase === 'shooting') {
                    const attackerList = this.describeCombatUnits(result, entry.attackerIds);
                    const defender = this.describeCombatUnits(result, [entry.defenderId]);
                    console.log(
                        `${attackerList} vs ${defender}`
                        + ` | ${this.getCombatSideLabel(result, entry.primaryAttackerId)} roll ${entry.attackerRoll}`
                        + ` | ${this.getCombatSideLabel(result, entry.primaryAttackerId)} modifiers ${this.formatCombatModifiers(entry.attackerModifiers)}`
                        + ` | ${this.getCombatSideLabel(result, entry.defenderId)} roll ${entry.defenderRoll}`
                        + ` | ${this.getCombatSideLabel(result, entry.defenderId)} modifiers ${this.formatCombatModifiers(entry.defenderModifiers)}`
                        + ` | totals ${entry.attackerTotal} vs ${entry.defenderTotal}`
                        + ` | result ${entry.outcome}${entry.loserId ? ` (${this.describeCombatUnits(result, [entry.loserId])})` : ''}`
                        + `${entry.destructionRule ? ` | rule ${entry.destructionRule}` : ''}`
                    );
                    return;
                }
                const leftLabel = this.getCombatSideLabel(result, entry.leftPrimaryId);
                const rightLabel = this.getCombatSideLabel(result, entry.rightPrimaryId);
                console.log(
                    `${this.describeCombatUnits(result, entry.leftUnitIds)} vs ${this.describeCombatUnits(result, entry.rightUnitIds)}`
                    + ` | ${leftLabel} roll ${entry.leftRoll}`
                    + ` | ${leftLabel} modifiers ${this.formatCombatModifiers(entry.leftModifiers)}`
                    + ` | ${rightLabel} roll ${entry.rightRoll}`
                    + ` | ${rightLabel} modifiers ${this.formatCombatModifiers(entry.rightModifiers)}`
                    + ` | totals ${entry.leftTotal} vs ${entry.rightTotal}`
                    + ` | result ${entry.outcome}${entry.loserCombatantId ? ` (${this.describeCombatantById(result, entry.loserCombatantId)})` : ''}`
                    + `${entry.destructionRule ? ` | rule ${entry.destructionRule}` : ''}`
                );
            });
            (result.recoilDestructions || []).forEach((entry) => {
                console.log(`recoil destruction: ${this.describeCombatUnits(result, [entry.unitId])} | reason ${entry.reason}`);
            });
            console.groupEnd();
        }

        getCombatUnit(result, unitId) {
            return result.units.find((unit) => unit.id === unitId) || result.destroyedUnits.find((unit) => unit.id === unitId) || null;
        }

        getCombatSideLabel(result, unitId) {
            const unit = this.getCombatUnit(result, unitId);
            return unit ? this.getPlayerLabel(this.getUnitPlayerId(unit)) : 'unknown';
        }

        describeCombatUnits(result, unitIds) {
            return unitIds
                .map((unitId) => this.getCombatUnit(result, unitId))
                .filter(Boolean)
                .map((unit) => `${this.getPlayerLabel(this.getUnitPlayerId(unit))} ${unit.type} ${unit.id}`)
                .join(', ');
        }

        describeCombatantById(result, combatantId) {
            const entry = result.results.find((combatResult) => combatResult.leftCombatantId === combatantId || combatResult.rightCombatantId === combatantId);
            if (!entry) {
                return combatantId;
            }
            return entry.leftCombatantId === combatantId
                ? this.describeCombatUnits(result, entry.leftUnitIds)
                : this.describeCombatUnits(result, entry.rightUnitIds);
        }

        formatCombatModifiers(modifiers) {
            if (!modifiers || modifiers.length === 0) {
                return 'none';
            }
            return modifiers
                .map((modifier) => `${modifier.id} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`)
                .join(', ');
        }

        resolveShootingPhase() {
            if (this.state.mode !== 'game' || this.state.phase !== 'shooting') {
                return;
            }
            if (this.state.combatResolution) {
                return;
            }
            const shooting = this.getShootingState();
            const snapshot = geometry.snapshotPositions(this.state.units.map((unit) => unit.id), this.state.units);
            const result = rules.resolveShooting(
                this.state.units,
                shooting.attacksByAttacker,
                this.state.terrain,
                () => this.rollDie(),
                this.state.activePlayerId
            );
            this.state.units = result.units;
            this.recordLosses(result.destroyedUnits);
            this.state.combatResolution = this.buildCombatResolution(snapshot, result, 'shooting');
            this.logCombatResults(result, 'shooting');
            this.state.selectedIds = [];
            this.state.shooting = null;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(`Shooting resolved: ${result.destroyedUnits.length} units destroyed. Review the aftermath, then click Acknowledged.`);
        }

        resolveMeleePhase() {
            if (this.state.mode !== 'game' || this.state.phase !== 'melee' || this.state.combatResolution) {
                return;
            }
            const snapshot = geometry.snapshotPositions(this.state.units.map((unit) => unit.id), this.state.units);
            const result = rules.resolveMelee(this.state.units, this.state.terrain, () => this.rollDie());
            this.state.units = result.units;
            this.recordLosses(result.destroyedUnits);
            this.state.combatResolution = this.buildCombatResolution(snapshot, result, 'melee');
            this.logCombatResults(result, 'melee');
            this.state.selectedIds = [];
            this.state.melee = null;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(`Melee resolved: ${result.destroyedUnits.length} units destroyed. Review the aftermath, then click Acknowledged.`);
        }

        getLossSummary(side) {
            const losses = this.state.losses[side];
            const points = losses.reduce((sum, unit) => sum + unit.value, 0);
            const title = losses.length === 0
                ? 'No losses.'
                : losses.map((unit) => `${unit.type} (${unit.value})`).join('\n');
            return { points, title };
        }

        hasUnitMovedThisTurn(unit) {
            return Boolean(unit && unit.movedThisTurn);
        }

        getFormUpPreview() {
            if (this.state.mode !== 'game' || this.state.phase !== 'move' || !this.state.showFormUpPreview) {
                return null;
            }
            const result = rules.resolveAutomaticFormUp(this.state.units, this.state.activePlayerId, this.state.terrain);
            if (!result || result.movedUnitIds.length === 0) {
                return null;
            }
            return result;
        }

        beginFormUpPhase() {
            const activeUnits = this.state.units.filter((unit) => this.getUnitPlayerId(unit) === this.state.activePlayerId);
            const activeIds = activeUnits.map((unit) => unit.id);
            const ghostSnapshot = geometry.snapshotPositions(activeIds, this.state.units);
            const result = rules.resolveAutomaticFormUp(this.state.units, this.state.activePlayerId, this.state.terrain);

            this.state.units = result.units;
            const movedUnitIds = new Set(result.movedUnitIds);
            this.state.units.forEach((unit) => {
                if (movedUnitIds.has(unit.id)) {
                    unit.movedThisTurn = true;
                }
            });
            if (result.movedUnitIds.length === 0) {
                this.state.formUp = null;
                this.setPhase('shooting');
                if (this.maybeAutoAdvanceCombatPhase()) {
                    return;
                }
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus('No units qualified to form up. Advancing to shooting.');
                return;
            }
            this.setPhase('form-up');
            this.state.formUp = {
                ghostSnapshot,
                movedUnitIds: result.movedUnitIds
            };
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            if (result.movedUnitIds.length > 0) {
                this.updateStatus('Form up applied automatically. Review the ghosted original positions, then click Acknowledged.');
                return;
            }
            this.updateStatus('No units qualified to form up. Click Acknowledged to continue to shooting.');
        }

        getStorageRecords() {
            if (typeof window === 'undefined' || !window.localStorage) {
                return [];
            }
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                const records = raw ? JSON.parse(raw) : [];
                return Array.isArray(records) ? records : [];
            } catch (error) {
                console.warn('Unable to read saved games from local storage.', error);
                return [];
            }
        }

        writeStorageRecords(records) {
            if (typeof window === 'undefined' || !window.localStorage) {
                return false;
            }
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            return true;
        }

        buildSavePayload(name) {
            return {
                id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name,
                savedAt: new Date().toISOString(),
                snapshot: {
                    mode: this.state.mode,
                    players: JSON.parse(JSON.stringify(this.state.players)),
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    phase: this.state.phase,
                    units: this.state.units.map((unit) => ({
                        ...unit,
                        moves: unit.moves ? { ...unit.moves } : undefined,
                        strength: unit.strength ? { ...unit.strength } : undefined,
                        ranged: unit.ranged ? { ...unit.ranged } : null,
                        combat: unit.combat ? { ...unit.combat } : {}
                    })),
                    terrain: JSON.parse(JSON.stringify(this.state.terrain)),
                    losses: JSON.parse(JSON.stringify(this.state.losses)),
                    snapEnabled: this.state.snapEnabled,
                    singleRotationMode: this.state.singleRotationMode,
                    showRangedArea: this.state.showRangedArea,
                    showFormUpPreview: this.state.showFormUpPreview,
                    nextUnitId: this.nextUnitId
                }
            };
        }

        saveCurrentGame() {
            const name = (this.ui.storageNameInput.value || '').trim();
            if (!name) {
                this.updateStatus('Enter a save name before storing the game.');
                return;
            }
            const records = this.getStorageRecords().filter((record) => record.name !== name);
            records.unshift(this.buildSavePayload(name));
            this.writeStorageRecords(records);
            this.renderStorageList();
            this.updateStatus(`Saved game as ${name}.`);
        }

        deriveNextUnitId(units) {
            const maxNumericId = units.reduce((maxId, unit) => {
                const match = /^unit-(\d+)$/.exec(unit.id);
                if (!match) {
                    return maxId;
                }
                return Math.max(maxId, Number(match[1]));
            }, 0);
            return maxNumericId + 1;
        }

        normalizeSavedUnit(unit) {
            const playerId = unit.playerId || (unit.side === 'red' ? 'player-2' : 'player-1');
            const { side, ...normalized } = unit;
            return {
                ...normalized,
                playerId,
                moves: unit.moves ? { ...unit.moves } : undefined,
                strength: unit.strength ? { ...unit.strength } : undefined,
                ranged: unit.ranged ? { ...unit.ranged } : null,
                combat: unit.combat ? { ...unit.combat } : {}
            };
        }

        normalizeSavedLosses(losses) {
            return {
                'player-1': losses?.['player-1'] || losses?.blue || [],
                'player-2': losses?.['player-2'] || losses?.red || []
            };
        }

        loadGame(recordId) {
            const record = this.getStorageRecords().find((entry) => entry.id === recordId);
            if (!record) {
                this.updateStatus('That saved game could not be found.');
                this.renderStorageList();
                return;
            }
            const snapshot = record.snapshot || {};
            this.state.mode = snapshot.mode || 'game';
            this.state.players = data.PLAYER_IDS.reduce((players, playerId) => {
                players[playerId] = { ...data.DEFAULT_PLAYERS[playerId], ...(snapshot.players?.[playerId] || {}) };
                return players;
            }, {});
            this.state.activePlayerId = snapshot.activePlayerId || (snapshot.activeSide === 'red' ? 'player-2' : 'player-1');
            this.state.remainingMoves = Number.isFinite(snapshot.remainingMoves) ? snapshot.remainingMoves : 0;
            this.state.phase = snapshot.phase || 'move';
            this.state.terrain = snapshot.terrain || data.createDefaultTerrain();
            this.state.units = Array.isArray(snapshot.units) ? snapshot.units.map((unit) => this.normalizeSavedUnit(unit)) : [];
            this.state.losses = this.normalizeSavedLosses(snapshot.losses);
            this.state.snapEnabled = snapshot.snapEnabled !== false;
            this.state.showFormUpPreview = Boolean(snapshot.showFormUpPreview);
            this.state.singleRotationMode = snapshot.singleRotationMode === 'front-corner' ? 'front-corner' : 'center';
            this.state.showRangedArea = Boolean(snapshot.showRangedArea);
            this.state.selectedIds = [];
            this.state.selectionAnalysis = { type: 'none', invalid: false, reason: '' };
            this.state.draft = null;
            this.state.formUp = null;
            this.state.shooting = null;
            this.state.melee = null;
            this.state.combatResolution = null;
            this.state.editHistory = [];
            this.state.marquee = null;
            this.state.interaction = null;
            this.nextUnitId = snapshot.nextUnitId || this.deriveNextUnitId(this.state.units);
            if (this.state.phase === 'shooting') {
                this.initializeShootingPhase();
            }
            if (this.state.phase === 'melee') {
                this.initializeMeleePhase();
            }
            this.closeStorageModal(false);
            if (this.maybeAutoAdvanceCombatPhase()) {
                return;
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus(`Loaded saved game ${record.name}.`);
        }

        deleteGame(recordId) {
            const records = this.getStorageRecords().filter((record) => record.id !== recordId);
            this.writeStorageRecords(records);
            this.renderStorageList();
            this.updateStatus('Saved game deleted.');
        }

        renderStorageList() {
            const records = this.getStorageRecords();
            this.ui.storageList.replaceChildren();
            if (records.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'storage-empty';
                empty.textContent = 'No saved games in local storage yet.';
                this.ui.storageList.appendChild(empty);
                return;
            }
            records.forEach((record) => {
                const item = document.createElement('div');
                item.className = 'storage-item';

                const meta = document.createElement('div');
                meta.className = 'storage-meta';
                const name = document.createElement('div');
                name.className = 'storage-name';
                name.textContent = record.name;
                const details = document.createElement('div');
                details.className = 'storage-details';
                const snapshot = record.snapshot || {};
                const lossPoints = Object.values(this.normalizeSavedLosses(snapshot.losses))
                    .flat()
                    .reduce((sum, unit) => sum + unit.value, 0);
                const activePlayerId = snapshot.activePlayerId || (snapshot.activeSide === 'red' ? 'player-2' : 'player-1');
                const players = snapshot.players || data.DEFAULT_PLAYERS;
                const colorId = players[activePlayerId]?.colorId || data.DEFAULT_PLAYERS[activePlayerId].colorId;
                const activeLabel = data.PLAYER_COLORS[colorId].label;
                details.textContent = `${new Date(record.savedAt).toLocaleString()} | ${snapshot.phase || 'move'} | ${activeLabel} to act | ${lossPoints} points destroyed`;
                meta.append(name, details);

                const actions = document.createElement('div');
                actions.className = 'storage-actions';
                const loadButton = document.createElement('button');
                loadButton.type = 'button';
                loadButton.textContent = 'Load';
                loadButton.addEventListener('click', () => this.loadGame(record.id));
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', () => this.deleteGame(record.id));
                actions.append(loadButton, deleteButton);

                item.append(meta, actions);
                this.ui.storageList.appendChild(item);
            });
        }

        openStorageModal() {
            this.state.storageModalOpen = true;
            this.renderStorageList();
            this.ui.storageModal.hidden = false;
            if (!this.ui.storageNameInput.value.trim()) {
                this.ui.storageNameInput.value = `${this.getPlayerLabel(this.state.activePlayerId)}-${this.state.phase}`;
            }
            this.ui.storageNameInput.focus();
            this.ui.storageNameInput.select();
        }

        closeStorageModal(restoreFocus = true) {
            this.state.storageModalOpen = false;
            this.ui.storageModal.hidden = true;
            if (restoreFocus) {
                this.ui.storageButton.focus();
            }
        }

        acknowledgePhase() {
            if (this.state.mode !== 'game') {
                return;
            }
            if (this.state.phase === 'form-up') {
                this.state.formUp = null;
                this.setPhase('shooting');
                if (this.maybeAutoAdvanceCombatPhase()) {
                    return;
                }
                this.syncUiFromState();
                this.updateStatus('Shooting phase: select a ranged unit, assign valid targets, then resolve shooting.');
                return;
            }
            if (this.state.phase === 'shooting') {
                if (this.state.combatResolution) {
                    this.state.combatResolution = null;
                    this.setPhase('melee');
                    if (this.maybeAutoAdvanceCombatPhase()) {
                        return;
                    }
                    this.syncUiFromState();
                    this.updateStatus('Melee phase: resolve all detected combats.');
                    return;
                }
                this.setPhase('melee');
                if (this.maybeAutoAdvanceCombatPhase()) {
                    return;
                }
                this.syncUiFromState();
                this.updateStatus('Melee phase: resolve all detected combats.');
                return;
            }
            if (this.state.phase === 'melee' && this.state.combatResolution) {
                this.advanceToNextTurn();
            }
        }

        evaluateDraft() {
            if (!this.state.draft) {
                return;
            }
            const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
            this.state.draft.invalidIds = result.invalidIds;
            this.state.draft.reasonById = result.reasonById;
            this.syncUiFromState();
        }

        updateSelectionAnalysis() {
            this.state.selectionAnalysis = rules.analyzeSelection(this.getSelectedUnits());
            this.syncUiFromState();
        }

        updateStatus(message) {
            this.state.status = message;
            this.syncUiFromState();
            this.requestRender();
        }

        getSingleSelectedUnit() {
            if (this.state.selectedIds.length !== 1) {
                return null;
            }
            return this.getUnitById(this.state.selectedIds[0]) || null;
        }

        formatPaces(distanceMm) {
            return Math.round(distanceMm / data.MM_PER_PACE) + 'p';
        }

        getSelectedUnitDetails(unit) {
            if (!unit) {
                return [];
            }
            const movement = [
                `Road ${this.formatPaces(unit.moves.road)}`,
                `Good ${this.formatPaces(unit.moves.good)}`,
                `Bad ${this.formatPaces(unit.moves.bad)}`,
                `Water ${this.formatPaces(unit.moves.water)}`
            ].join(' / ');
            const ranged = unit.ranged
                ? `${this.formatPaces(unit.ranged.range)} range, ${unit.ranged.width}mm frontage`
                : 'None';
            return [
                { label: 'Player', value: this.getPlayerLabel(this.getUnitPlayerId(unit)) },
                { label: 'Class', value: unit.troopClass },
                { label: 'AP', value: String(unit.value) },
                { label: 'Strength', value: `Infantry ${unit.strength.infantry}, Mounted ${unit.strength.mounted}` },
                { label: 'Move', value: movement },
                { label: 'Ranged', value: ranged },
                { label: 'Bad Going', value: unit.combat?.ignoresBadGoingPenalty ? 'Ignores penalty' : 'Normal penalty' }
            ];
        }

        renderSelectionInfo() {
            const selectedUnits = this.getSelectedUnits();
            if (this.ui.selectionText) {
                this.ui.selectionText.textContent = rules.describeSelection(this.state.selectionAnalysis, selectedUnits, this.state.draft);
            }

            if (!this.ui.selectionPanel) {
                return;
            }

            const unit = selectedUnits.length === 1 ? selectedUnits[0] : null;
            const details = this.getSelectedUnitDetails(unit);
            this.ui.selectionPanel.classList.toggle('is-empty', !unit);

            if (this.ui.selectionPanelEyebrow) {
                this.ui.selectionPanelEyebrow.textContent = unit ? this.getPlayerLabel(this.getUnitPlayerId(unit)) + ' unit' : 'Selection';
            }
            if (this.ui.selectionPanelTitle) {
                this.ui.selectionPanelTitle.textContent = unit ? unit.type : 'No unit selected';
            }
            if (this.ui.selectionPanelHint) {
                this.ui.selectionPanelHint.textContent = unit
                    ? `${unit.width}mm frontage, ${unit.depth}mm depth.`
                    : 'Select a single unit to inspect its stats.';
            }
            if (this.ui.selectionPanelStats) {
                this.ui.selectionPanelStats.hidden = !unit;
                this.ui.selectionPanelStats.innerHTML = details.map((entry) => (`
                    <div class="selection-stat">
                        <dt>${entry.label}</dt>
                        <dd>${entry.value}</dd>
                    </div>
                `)).join('');
            }
        }

        renderArmyBuilder() {
            if (!this.ui.armyColumns) {
                return;
            }
            this.ui.armyColumns.innerHTML = data.PLAYER_IDS.map((playerId, playerIndex) => {
                const player = this.getPlayer(playerId);
                const colors = this.getPlayerColors(playerId);
                const value = this.getArmyValue(playerId);
                const valueClass = value === data.ARMY_POINT_TARGET ? 'is-exact' : (value > data.ARMY_POINT_TARGET ? 'is-over' : 'is-under');
                const colorOptions = Object.entries(data.PLAYER_COLORS).map(([colorId, color]) => (
                    `<option value="${colorId}"${colorId === player.colorId ? ' selected' : ''}>${color.label}</option>`
                )).join('');
                const factionOptions = data.FACTIONS.map((faction) => (
                    `<option value="${faction}"${faction === player.faction ? ' selected' : ''}>${faction}</option>`
                )).join('');
                const rows = Object.entries(data.UNIT_TYPES).map(([type, unit]) => {
                    const count = this.getArmyDraft(playerId).counts[type] || 0;
                    const assetPath = this.getUnitAssetPath({ type, faction: player.faction });
                    return `
                        <div class="army-unit-row">
                            <img class="army-unit-preview" src="${assetPath}" alt="${player.faction} ${type}">
                            <div>
                                <div class="army-unit-name">${type}</div>
                                <div class="army-unit-cost">${unit.value} AP</div>
                            </div>
                            <div class="army-count-control" aria-label="${type} count">
                                <button type="button" data-army-action="decrement" data-player-id="${playerId}" data-unit-type="${type}" aria-label="Remove ${type}">−</button>
                                <output class="army-count">${count}</output>
                                <button type="button" data-army-action="increment" data-player-id="${playerId}" data-unit-type="${type}" aria-label="Add ${type}">+</button>
                            </div>
                        </div>`;
                }).join('');
                return `
                    <section class="army-player" style="--player-fill: ${colors.fill}; --player-stroke: ${colors.stroke};" aria-labelledby="armyPlayerTitle${playerIndex}">
                        <header class="army-player-header">
                            <div class="army-player-heading">
                                <h2 id="armyPlayerTitle${playerIndex}">Player ${playerIndex + 1}</h2>
                                <output class="army-total ${valueClass}">${value} / ${data.ARMY_POINT_TARGET} AP</output>
                            </div>
                            <div class="army-player-options">
                                <label>Color
                                    <select data-player-setting="colorId" data-player-id="${playerId}">${colorOptions}</select>
                                </label>
                                <label>Faction
                                    <select data-player-setting="faction" data-player-id="${playerId}">${factionOptions}</select>
                                </label>
                            </div>
                        </header>
                        <div class="army-unit-list">${rows}</div>
                        <footer class="army-builder-actions">
                            <button type="button" data-army-builder-action="random-army" data-player-id="${playerId}">Random Army</button>
                            <button type="button" data-army-builder-action="random-presentation" data-player-id="${playerId}">Random Color + Faction</button>
                            <button type="button" data-army-builder-action="clear" data-player-id="${playerId}">Clear Army</button>
                        </footer>
                    </section>`;
            }).join('');

            this.ui.armyColumns.querySelectorAll('[data-army-action]').forEach((button) => {
                button.addEventListener('click', () => this.adjustArmyUnit(
                    button.dataset.playerId,
                    button.dataset.unitType,
                    button.dataset.armyAction === 'increment' ? 1 : -1
                ));
            });
            this.ui.armyColumns.querySelectorAll('[data-player-setting]').forEach((select) => {
                select.addEventListener('change', () => this.updateArmyPlayer(
                    select.dataset.playerId,
                    select.dataset.playerSetting,
                    select.value
                ));
            });
            this.ui.armyColumns.querySelectorAll('[data-army-builder-action]').forEach((button) => {
                button.addEventListener('click', () => {
                    const playerId = button.dataset.playerId;
                    if (button.dataset.armyBuilderAction === 'random-army') this.chooseRandomArmy(playerId);
                    if (button.dataset.armyBuilderAction === 'random-presentation') this.randomizeArmyPresentation(playerId);
                    if (button.dataset.armyBuilderAction === 'clear') this.clearArmy(playerId);
                });
            });
        }

        renderTerrainPlacement() {
            const terrain = this.getTerrainSetup();
            if (!terrain || !this.ui.terrainCanvas) {
                return;
            }
            const canvas = this.ui.terrainCanvas;
            const size = Math.max(1, Math.round(Math.min(canvas.clientWidth, canvas.clientHeight) * window.devicePixelRatio));
            if (canvas.width !== size || canvas.height !== size) {
                canvas.width = size;
                canvas.height = size;
            }
            const ctx = this.terrainCtx;
            const scale = canvas.width / data.BOARD_SIZE;
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            this.drawBoard(ctx);
            this.drawTerrain(ctx);
            const selected = this.getTerrainPieceById(terrain.selectedTerrainId);
            if (selected) {
                ctx.save();
                ctx.strokeStyle = '#f6dc73';
                ctx.lineWidth = 3 / scale;
                if (selected.kind === 'road') {
                    if (selected.orientation === 'horizontal') {
                        ctx.strokeRect(0, selected.position - selected.width / 2, data.BOARD_SIZE, selected.width);
                    } else {
                        ctx.strokeRect(selected.position - selected.width / 2, 0, selected.width, data.BOARD_SIZE);
                    }
                } else {
                    ctx.beginPath();
                    geometry.drawBlob(ctx, selected);
                    ctx.stroke();
                }
                ctx.restore();
                const handle = this.getTerrainRotationHandle(selected);
                ctx.save();
                ctx.beginPath();
                ctx.arc(handle.x, handle.y, 11, 0, Math.PI * 2);
                ctx.fillStyle = '#f6dc73';
                ctx.strokeStyle = '#554420';
                ctx.lineWidth = 2 / scale;
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(handle.x, handle.y, 5.8, Math.PI * 0.2, Math.PI * 1.35, false);
                ctx.strokeStyle = '#7e6420';
                ctx.lineWidth = 1.6 / scale;
                ctx.stroke();
                const arrowTip = {
                    x: handle.x + (Math.cos(Math.PI * 0.2) * 5.8),
                    y: handle.y + (Math.sin(Math.PI * 0.2) * 5.8)
                };
                this.drawArrowHead(ctx, arrowTip, -0.45);
                ctx.restore();
            }
            this.ui.terrainCountInput.value = String(terrain.terrainCount);
            this.ui.terrainProgress.textContent = `${this.getPlacedTerrainCount()} / ${terrain.terrainCount} placed`;
            this.ui.terrainDefender.textContent = `${this.getPlayerLabel(terrain.defenderPlayerId)} is the defender. Place the agreed terrain, then confirm the board.`;
            this.ui.autoPlaceTerrainButton.disabled = this.isTerrainReady();
            this.ui.confirmTerrainButton.disabled = !this.isTerrainReady();
            this.ui.terrainOffers.innerHTML = terrain.offers.map((offer) => (`
                <button type="button" class="terrain-offer" data-terrain-offer="${offer.id}"${this.getPlacedTerrainCount() >= terrain.terrainCount ? ' disabled' : ''}>
                    <canvas class="terrain-offer-preview" width="200" height="200" data-terrain-preview="${offer.id}" aria-hidden="true"></canvas>
                    <span>${data.TERRAIN_STYLE[offer.kind].label}</span>
                    <span class="terrain-offer-description">${this.getTerrainOfferDescription(offer)}</span>
                </button>
            `)).join('');
            this.ui.terrainOffers.querySelectorAll('[data-terrain-preview]').forEach((canvas) => {
                const offer = terrain.offers.find((entry) => entry.id === canvas.dataset.terrainPreview);
                if (offer) {
                    this.drawTerrainOfferPreview(canvas, offer);
                }
            });
            this.ui.terrainOffers.querySelectorAll('[data-terrain-offer]').forEach((button) => {
                button.addEventListener('click', () => this.placeTerrainOffer(button.dataset.terrainOffer));
            });
        }

        getTerrainOfferDescription(offer) {
            if (offer.kind === 'road') {
                return 'Road · full board';
            }
            const shapeNames = {
                blob: 'Blob',
                kidney: 'Kidney bean',
                circle: 'Circle',
                'half-circle': 'Half-circle',
                square: 'Square',
                rectangle: 'Long thin rectangle',
                oval: 'Oval',
                'fat-l': 'Fat L-shape',
                horseshoe: 'Horseshoe',
                cross: 'Fat stubby cross',
                lightbulb: 'Lightbulb'
            };
            const sizeNames = { 0.25: 'Tiny', 0.5: 'Small', 1: 'Medium', 1.5: 'Large' };
            return `${shapeNames[offer.shape] || 'Blob'} · ${sizeNames[offer.sizeMultiplier] || 'Medium'}`;
        }

        drawTerrainOfferPreview(canvas, offer) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = data.TERRAIN_STYLE.good.fill;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(100, 100);
            ctx.scale(1.2, 1.2);
            ctx.translate(-100, -100);
            if (offer.kind === 'road') {
                ctx.fillStyle = offer.fill || data.TERRAIN_STYLE.road.fill;
                if (offer.orientation === 'horizontal') {
                    ctx.fillRect(0, 90, canvas.width, 20);
                } else {
                    ctx.fillRect(90, 0, 20, canvas.height);
                }
            } else {
                const preview = { ...offer, cx: 100, cy: 100 };
                ctx.fillStyle = data.TERRAIN_STYLE[offer.kind].fill;
                ctx.beginPath();
                geometry.drawBlob(ctx, preview);
                ctx.fill();
                ctx.strokeStyle = 'rgba(26, 24, 21, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.restore();
        }

        syncUiFromState() {
            const setupActive = this.isSetupActive();
            if (this.ui.gameBar) this.ui.gameBar.hidden = setupActive;
            if (this.ui.boardShell) this.ui.boardShell.hidden = setupActive;
            if (this.ui.helpBar) this.ui.helpBar.hidden = setupActive;
            if (this.ui.setupShell) this.ui.setupShell.hidden = !setupActive;
            if (this.ui.armyBuilder) this.ui.armyBuilder.hidden = this.state.setupStage !== 'army-builder';
            if (this.ui.terrainPlacement) this.ui.terrainPlacement.hidden = this.state.setupStage !== 'terrain-placement';
            if (this.ui.setupPending) this.ui.setupPending.hidden = this.state.setupStage !== 'unit-deployment';
            if (this.ui.confirmationModal) this.ui.confirmationModal.hidden = !this.state.setup?.confirmation;
            if (this.ui.confirmationTitle) this.ui.confirmationTitle.textContent = this.state.setup?.confirmation === 'terrain' ? 'Confirm Terrain' : 'Confirm Armies';
            if (this.ui.confirmationText) this.ui.confirmationText.textContent = this.state.setup?.confirmation === 'terrain'
                ? 'The terrain board will be locked and the game will proceed to unit deployment.'
                : 'Both 24 AP armies will be locked and terrain placement will begin.';
            if (this.ui.confirmSetupButton) this.ui.confirmSetupButton.textContent = this.state.setup?.confirmation === 'terrain' ? 'Begin Deployment' : 'Continue';
            if (this.state.setupStage === 'army-builder') {
                this.renderArmyBuilder();
                if (this.ui.acceptArmiesButton) this.ui.acceptArmiesButton.disabled = !this.canAcceptArmies();
            }
            if (this.state.setupStage === 'terrain-placement' && this.ui.setupPendingText) {
                this.renderTerrainPlacement();
            }
            if (this.state.setupStage === 'unit-deployment' && this.ui.setupPendingText) {
                this.ui.setupPendingText.textContent = 'The terrain is locked. Sequential unit deployment is the next setup stage.';
            }
            this.ui.editModeButton.classList.toggle('is-active', this.state.mode === 'edit');
            this.ui.gameModeButton.classList.toggle('is-active', this.state.mode === 'game');
            this.ui.editGroup.hidden = this.state.mode !== 'edit';
            this.ui.actionGroup.hidden = false;
            this.ui.activeSideSelect.value = this.state.activePlayerId;
            this.ui.remainingMovesInput.value = String(this.state.remainingMoves);
            this.ui.phaseSelect.value = this.state.phase;
            this.ui.newUnitTypeSelect.value = this.state.placementType;
            this.ui.placementSideSelect.value = this.state.placementPlayerId;
            this.ui.placeUnitButton.textContent = this.state.placingUnit ? 'Cancel Placement' : 'Place Unit';
            this.ui.placeUnitButton.disabled = this.state.mode !== 'edit';
            this.ui.newUnitTypeSelect.disabled = this.state.mode !== 'edit';
            this.ui.placementSideSelect.disabled = this.state.mode !== 'edit';
            this.ui.activeSideSelect.disabled = this.state.mode !== 'edit';
            this.ui.remainingMovesInput.disabled = this.state.mode !== 'edit';
            this.ui.phaseSelect.disabled = this.state.mode !== 'edit';
            this.ui.finishMoveButton.hidden = this.state.mode !== 'game' || this.state.phase !== 'move';
            this.ui.endMovePhaseButton.hidden = this.state.mode !== 'game' || this.state.phase !== 'move';
            this.ui.stepMoveButton.hidden = this.state.mode !== 'game' || this.state.phase !== 'move';
            this.ui.snapLabel.hidden = false;
            this.ui.formUpPreviewLabel.hidden = false;
            this.ui.cornerRotationLabel.hidden = false;
            this.ui.rangedAreaLabel.hidden = false;
            this.ui.resolveShootingButton.hidden = this.state.mode !== 'game'
                || (this.state.phase !== 'shooting' && this.state.phase !== 'melee')
                || Boolean(this.state.combatResolution);
            this.ui.cancelMoveButton.hidden = this.state.mode !== 'game' || this.state.phase !== 'move';
            this.ui.acknowledgedButton.hidden = this.state.mode !== 'game' || (this.state.phase !== 'form-up' && !this.state.combatResolution);
            this.ui.undoMoveButton.hidden = this.state.mode === 'game' && this.state.phase !== 'move';
            this.ui.finishMoveButton.disabled = this.state.mode !== 'game' || this.state.phase !== 'move' || !this.state.draft;
            this.ui.endMovePhaseButton.disabled = this.state.mode !== 'game' || this.state.phase !== 'move';
            this.ui.stepMoveButton.disabled = this.state.mode !== 'game'
                || this.state.phase !== 'move'
                || !this.state.draft
                || this.state.selectionAnalysis.type !== 'single'
                || this.state.draft.invalidIds.size > 0;
            this.ui.snapCheckbox.checked = this.state.snapEnabled;
            this.ui.formUpPreviewCheckbox.checked = this.state.showFormUpPreview;
            this.ui.cornerRotationCheckbox.checked = this.state.singleRotationMode === 'front-corner';
            this.ui.rangedAreaCheckbox.checked = this.state.showRangedArea;
            this.ui.resolveShootingButton.textContent = this.state.phase === 'melee' ? 'Resolve Melee' : 'Resolve Shooting';
            this.ui.resolveShootingButton.disabled = this.state.mode !== 'game'
                || (this.state.phase !== 'shooting' && this.state.phase !== 'melee')
                || Boolean(this.state.combatResolution)
                || (this.state.phase === 'shooting' && Object.keys(this.state.shooting?.attacksByAttacker || {}).length === 0)
                || (this.state.phase === 'melee' && this.getMeleeState().combats.length === 0);
            this.ui.cancelMoveButton.disabled = this.state.mode !== 'game' || this.state.phase !== 'move' || !this.state.draft;
            this.ui.undoMoveButton.disabled = this.state.mode === 'edit' ? this.state.editHistory.length === 0 : !this.state.draft;
            this.ui.acknowledgedButton.disabled = this.state.mode !== 'game' || (this.state.phase !== 'form-up' && !this.state.combatResolution);
            this.ui.storageModal.hidden = !this.state.storageModalOpen;
            const playerOneLosses = this.getLossSummary('player-1');
            const playerTwoLosses = this.getLossSummary('player-2');
            this.ui.blueLosses.textContent = `${this.getPlayerLabel('player-1')} lost: ${playerOneLosses.points}`;
            this.ui.blueLosses.title = playerOneLosses.title;
            this.ui.redLosses.textContent = `${this.getPlayerLabel('player-2')} lost: ${playerTwoLosses.points}`;
            this.ui.redLosses.title = playerTwoLosses.title;
            this.ui.statusText.textContent = this.state.status;
            this.renderSelectionInfo();
        }

        requestRender() {
            if (this.renderQueued) {
                return;
            }
            this.renderQueued = true;
            window.requestAnimationFrame(() => {
                this.renderQueued = false;
                this.render();
            });
        }

        render() {
            this.syncCanvasResolution();
            const ctx = this.ctx;
            const rect = this.canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.save();
            ctx.translate(rect.width / 2, rect.height / 2);
            ctx.scale(this.state.camera.scale, this.state.camera.scale);
            ctx.translate(-this.state.camera.x, -this.state.camera.y);
            this.drawBoard(ctx);
            this.drawTerrain(ctx);
            this.drawGhostUnits(ctx);
            this.drawShootingOverlays(ctx);
            this.drawUnits(ctx);
            this.drawSelectionHandles(ctx);
            if (this.state.combatResolution) {
                this.drawCombatResolutionOverlays(ctx);
            }
            if (this.state.marquee) {
                this.drawMarquee(ctx);
            }
            ctx.restore();
        }

        drawBoard(ctx) {
            ctx.save();
            ctx.fillStyle = data.TERRAIN_STYLE.good.fill;
            ctx.fillRect(0, 0, data.BOARD_SIZE, data.BOARD_SIZE);
            ctx.strokeStyle = 'rgba(78, 72, 64, 0.15)';
            ctx.lineWidth = 1 / this.state.camera.scale;
            for (let offset = 0; offset <= data.BOARD_SIZE; offset += data.MM_GRID) {
                ctx.beginPath();
                ctx.moveTo(offset, 0);
                ctx.lineTo(offset, data.BOARD_SIZE);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, offset);
                ctx.lineTo(data.BOARD_SIZE, offset);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(58, 50, 40, 0.28)';
            ctx.lineWidth = 2 / this.state.camera.scale;
            ctx.strokeRect(0, 0, data.BOARD_SIZE, data.BOARD_SIZE);
            ctx.restore();
        }

        drawTerrain(ctx) {
            ctx.save();
            this.state.terrain.roads.forEach((road) => {
                ctx.fillStyle = road.fill;
                ctx.beginPath();
                if (road.orientation === 'horizontal') {
                    ctx.roundRect(0, road.position - road.width / 2, data.BOARD_SIZE, road.width, 8);
                } else {
                    ctx.roundRect(road.position - road.width / 2, 0, road.width, data.BOARD_SIZE, 8);
                }
                ctx.fill();
            });
            this.state.terrain.features.forEach((feature) => {
                ctx.fillStyle = data.TERRAIN_STYLE[feature.kind].fill;
                ctx.beginPath();
                geometry.drawBlob(ctx, feature);
                ctx.fill();
                ctx.strokeStyle = 'rgba(26, 24, 21, 0.26)';
                ctx.lineWidth = 2 / this.state.camera.scale;
                ctx.stroke();
            });
            ctx.restore();
        }

        drawUnits(ctx) {
            const selectedIds = new Set(this.state.selectedIds);
            const invalidSelection = this.state.selectionAnalysis.invalid;
            const validTargetIds = new Set(this.state.shooting?.validTargetIds || []);
            this.state.units.forEach((unit) => {
                const isSelected = selectedIds.has(unit.id);
                const isDraftInvalid = Boolean(this.state.draft && this.state.draft.invalidIds.has(unit.id));
                this.drawUnitBase(ctx, unit, {
                    selected: isSelected,
                    invalid: isDraftInvalid || (isSelected && invalidSelection),
                    highlighted: this.state.mode === 'game' && this.state.phase === 'shooting' && validTargetIds.has(unit.id),
                    needsShootingDeclaration: this.needsShootingDeclaration(unit),
                    ghost: false
                });
            });
        }

        drawShootingOverlays(ctx) {
            if (!this.state.showRangedArea && !this.state.combatResolution && (this.state.mode !== 'game' || this.state.phase !== 'shooting')) {
                return;
            }
            const shooting = this.state.mode === 'game' && this.state.phase === 'shooting'
                ? this.getShootingState()
                : null;
            if (this.state.showRangedArea) {
                const selectedIds = new Set(this.state.selectedIds);
                this.state.units.filter((unit) => rules.isRangedUnit(unit)).forEach((unit) => {
                    const area = rules.getRangedArea(unit);
                    if (!area) {
                        return;
                    }
                    const highlighted = selectedIds.has(unit.id);
                    ctx.save();
                    ctx.lineWidth = (highlighted ? 2.2 : 1.2) / this.state.camera.scale;
                    ctx.strokeStyle = highlighted ? 'rgba(215, 172, 55, 0.95)' : 'rgba(137, 55, 47, 0.72)';
                    ctx.beginPath();
                    ctx.moveTo(area.nearLeft.x, area.nearLeft.y);
                    ctx.lineTo(area.nearRight.x, area.nearRight.y);
                    ctx.lineTo(area.farRight.x, area.farRight.y);
                    ctx.lineTo(area.farLeft.x, area.farLeft.y);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.restore();
                });
            }
            const attacks = shooting ? shooting.attacksByAttacker || {} : {};
            Object.entries(attacks).forEach(([attackerId, targetId]) => {
                const attacker = this.getUnitById(attackerId);
                const target = this.getUnitById(targetId);
                if (!attacker || !target) {
                    return;
                }
                this.drawShootingArrow(ctx, attacker, target);
            });

        }

        drawCombatResolutionOverlays(ctx) {
            const resolution = this.state.combatResolution;
            if (!resolution) {
                return;
            }
            resolution.results.forEach((entry) => {
                let leftUnit = null;
                let rightUnit = null;
                let leftTotal = null;
                let rightTotal = null;
                if (resolution.phase === 'shooting') {
                    leftUnit = this.getUnitById(entry.primaryAttackerId) || resolution.ghostSnapshot[entry.primaryAttackerId];
                    rightUnit = this.getUnitById(entry.defenderId) || resolution.ghostSnapshot[entry.defenderId];
                    leftTotal = entry.attackerTotal;
                    rightTotal = entry.defenderTotal;
                } else {
                    leftUnit = this.getUnitById(entry.leftPrimaryId) || resolution.ghostSnapshot[entry.leftPrimaryId];
                    rightUnit = this.getUnitById(entry.rightPrimaryId) || resolution.ghostSnapshot[entry.rightPrimaryId];
                    leftTotal = entry.leftTotal;
                    rightTotal = entry.rightTotal;
                }
                if (!leftUnit || !rightUnit) {
                    return;
                }
                const labelPosition = geometry.midpoint(geometry.getUnitCenter(leftUnit), geometry.getUnitCenter(rightUnit));
                ctx.save();
                ctx.fillStyle = 'rgba(255, 249, 236, 0.94)';
                ctx.strokeStyle = 'rgba(55, 45, 36, 0.35)';
                ctx.lineWidth = 1 / this.state.camera.scale;
                const width = 42 / this.state.camera.scale;
                const height = 14 / this.state.camera.scale;
                ctx.beginPath();
                ctx.roundRect(labelPosition.x - width / 2, labelPosition.y - height / 2, width, height, 4 / this.state.camera.scale);
                ctx.fill();
                ctx.stroke();
                ctx.font = `${10 / this.state.camera.scale}px Georgia`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#6e231c';
                ctx.fillText(`${leftTotal} vs ${rightTotal}`, labelPosition.x, labelPosition.y);
                ctx.restore();
            });
        }

        drawShootingArrow(ctx, attacker, target) {
            const start = geometry.getUnitCenter(attacker);
            const end = geometry.getUnitCenter(target);
            const delta = geometry.subtract(end, start);
            const distance = geometry.distance(start, end);
            const normal = geometry.normalize({ x: -delta.y, y: delta.x });
            const control = geometry.add(geometry.midpoint(start, end), geometry.scaleVector(normal, Math.min(28, distance * 0.2)));
            ctx.save();
            ctx.strokeStyle = 'rgba(187, 44, 31, 0.95)';
            ctx.lineWidth = 2 / this.state.camera.scale;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
            ctx.stroke();
            ctx.restore();
        }

        drawGhostUnits(ctx) {
            const ghosts = this.collectGhostUnits();
            ghosts.forEach((unit) => {
                this.drawUnitBase(ctx, unit, {
                    selected: false,
                    invalid: false,
                    ghost: true
                });
            });
        }

        collectGhostUnits() {
            const ghosts = [];
            const seen = new Set();
            const pushSnapshot = (snapshot, unitIds) => {
                unitIds.forEach((unitId) => {
                    const unit = snapshot[unitId];
                    if (!unit) {
                        return;
                    }
                    const liveUnit = this.getUnitById(unitId);
                    if (liveUnit && !this.hasUnitMoved(unit, liveUnit)) {
                        return;
                    }
                    const key = `${unitId}:${unit.x.toFixed(2)}:${unit.y.toFixed(2)}:${unit.rotation.toFixed(3)}`;
                    if (seen.has(key)) {
                        return;
                    }
                    seen.add(key);
                    ghosts.push({ ...unit });
                });
            };
            const pushUnits = (units, unitIds) => {
                unitIds.forEach((unitId) => {
                    const unit = units.find((entry) => entry.id === unitId);
                    if (!unit) {
                        return;
                    }
                    const liveUnit = this.getUnitById(unitId);
                    if (liveUnit && !this.hasUnitMoved(liveUnit, unit)) {
                        return;
                    }
                    const key = `${unitId}:${unit.x.toFixed(2)}:${unit.y.toFixed(2)}:${unit.rotation.toFixed(3)}`;
                    if (seen.has(key)) {
                        return;
                    }
                    seen.add(key);
                    ghosts.push({ ...unit });
                });
            };

            const formUpPreview = this.getFormUpPreview();
            if (formUpPreview) {
                pushUnits(formUpPreview.units, formUpPreview.movedUnitIds);
            }

            if (this.state.formUp) {
                pushSnapshot(this.state.formUp.ghostSnapshot, this.state.formUp.movedUnitIds);
            }
            if (this.state.combatResolution) {
                pushSnapshot(this.state.combatResolution.ghostSnapshot, this.state.combatResolution.movedUnitIds);
            }
            if (this.state.draft) {
                pushSnapshot(this.state.draft.initialOrigin, this.state.draft.unitIds);
                this.state.draft.history.forEach((snapshot) => pushSnapshot(snapshot, this.state.draft.unitIds));
                pushSnapshot(this.state.draft.origin, this.state.draft.unitIds);
            }
            const interaction = this.state.interaction;
            if (interaction && interaction.dragBase && interaction.draftIds) {
                pushSnapshot(interaction.dragBase, interaction.draftIds);
            }

            return ghosts;
        }

        hasUnitMoved(snapshotUnit, liveUnit) {
            return Math.abs(snapshotUnit.x - liveUnit.x) > 0.05
                || Math.abs(snapshotUnit.y - liveUnit.y) > 0.05
                || Math.abs(geometry.normalizeAngle(snapshotUnit.rotation - liveUnit.rotation)) > 0.01;
        }

        drawUnitBase(ctx, unit, options) {
            const corners = geometry.getUnitCorners(unit);
            const colors = this.getPlayerColors(this.getUnitPlayerId(unit));
            ctx.save();
            if (options.ghost) {
                ctx.globalAlpha = 0.35;
            }
            ctx.beginPath();
            geometry.tracePolygon(ctx, corners);
            ctx.fillStyle = colors.fill;
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = options.selected ? 22 / this.state.camera.scale : 0;
            ctx.fill();
            ctx.shadowBlur = 0;
            const drewAsset = this.drawUnitAsset(ctx, unit);
            ctx.lineWidth = (options.selected || options.needsShootingDeclaration ? 4 : 2) / this.state.camera.scale;
            if (options.ghost) {
                ctx.setLineDash([6 / this.state.camera.scale, 4 / this.state.camera.scale]);
            }
            ctx.strokeStyle = options.invalid ? '#d01111' : (options.needsShootingDeclaration || options.highlighted) ? '#d7ac37' : colors.stroke;
            ctx.stroke();
            if (!drewAsset) {
                this.drawUnitArrow(ctx, unit);
                this.drawUnitText(ctx, unit);
            }
            ctx.restore();
        }

        getUnitAssetPath(unit) {
            if (!unit || !unit.type) {
                return null;
            }
            const type = unit.type;
            // Prefer faction-specific asset sets when available
            if (unit.faction) {
                const faction = String(unit.faction).toLowerCase();
                if (faction === 'panda' && PANDA_UNIT_ASSET_PATHS[type]) {
                    return PANDA_UNIT_ASSET_PATHS[type];
                }
                if (faction === 'undead' && UNDEAD_UNIT_ASSET_PATHS[type]) {
                    return UNDEAD_UNIT_ASSET_PATHS[type];
                }
            }
            // Fallback to generic asset path
            return UNIT_ASSET_PATHS[type] || null;
        }

        getUnitAsset(unit) {
            const assetPath = this.getUnitAssetPath(unit);
            if (!assetPath || typeof Image === 'undefined') {
                return null;
            }
            if (!this.unitAssetCache) {
                this.unitAssetCache = new Map();
            }
            let entry = this.unitAssetCache.get(assetPath);
            if (!entry) {
                const image = new Image();
                entry = { image, status: 'loading' };
                image.addEventListener('load', () => {
                    entry.status = 'ready';
                    this.requestRender();
                });
                image.addEventListener('error', () => {
                    entry.status = 'error';
                });
                image.src = assetPath;
                this.unitAssetCache.set(assetPath, entry);
            }
            return entry.status === 'ready' ? entry.image : null;
        }

        drawUnitAsset(ctx, unit) {
            const image = this.getUnitAsset(unit);
            if (!image) {
                return false;
            }
            ctx.save();
            ctx.translate(unit.x, unit.y);
            ctx.rotate(unit.rotation);
            ctx.drawImage(image, 0, 0, unit.width, unit.depth);
            ctx.restore();
            return true;
        }

        drawUnitArrow(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            const forward = geometry.getForwardVector(unit.rotation);
            const right = geometry.getRightVector(unit.rotation);
            const frontInset = 2;
            const tipOffset = Math.max(0, (unit.depth / 2) - frontInset);
            const tip = geometry.add(center, geometry.scaleVector(forward, tipOffset));
            const arrowBase = geometry.add(tip, geometry.scaleVector(forward, -7));
            const left = geometry.add(arrowBase, geometry.scaleVector(right, -6));
            const rightPoint = geometry.add(arrowBase, geometry.scaleVector(right, 6));
            ctx.beginPath();
            ctx.moveTo(left.x, left.y);
            ctx.lineTo(rightPoint.x, rightPoint.y);
            ctx.lineTo(tip.x, tip.y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(244, 241, 234, 0.94)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(34, 31, 28, 0.55)';
            ctx.lineWidth = 1.25 / this.state.camera.scale;
            ctx.stroke();
        }

        drawUnitText(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            const displayRotation = this.getUnitPlayerId(unit) === 'player-1' ? unit.rotation : geometry.normalizeAngle(unit.rotation + Math.PI);
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(displayRotation);
            ctx.font = `${12 / this.state.camera.scale}px Georgia`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const isInactiveForCombat = this.state.mode === 'game'
                && (this.state.phase === 'shooting' || this.state.phase === 'melee')
                && !this.isUnitCombatParticipant(unit);
            ctx.fillStyle = isInactiveForCombat || unit.movedThisTurn
                ? 'rgba(160,160,160,0.95)'
                : 'rgba(248, 244, 237, 0.95)';
            ctx.fillText(unit.type, 0, 0);
            ctx.restore();
        }

        drawSelectionHandles(ctx) {
            const handles = this.getSelectionHandles();
            if (handles.length === 0) {
                return;
            }
            ctx.save();
            handles.forEach((handle) => {
                if (handle.kind === 'formation-convert') {
                    this.drawConvertHandle(ctx, handle);
                    return;
                }
                if (handle.kind === 'formation-reverse' || handle.kind === 'single-reverse') {
                    this.drawReverseHandle(ctx, handle);
                    return;
                }
                this.drawRotateHandle(ctx, handle);
            });
            ctx.restore();
        }

        drawRotateHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            ctx.beginPath();
            ctx.arc(0, 0, handle.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = 2 / this.state.camera.scale;
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();

            const iconRadius = handle.radius * 0.52;
            const mirrorLeft = handle.kind === 'rank-left';
            ctx.beginPath();
            ctx.save();
            ctx.rotate(Math.PI);
            if (mirrorLeft) {
                ctx.scale(-1, 1);
            }
            ctx.arc(0, 0, iconRadius, Math.PI * 0.2, Math.PI * 1.35, false);
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();

            const tip = {
                x: Math.cos(Math.PI * 0.2) * iconRadius,
                y: Math.sin(Math.PI * 0.2) * iconRadius
            };
            this.drawArrowHead(ctx, tip, -0.45);
            ctx.restore();
            ctx.restore();
        }

        drawReverseHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            const size = handle.radius * 2;
            ctx.beginPath();
            ctx.rect(-handle.radius, -handle.radius, size, size);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = 2 / this.state.camera.scale;
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();

            const left = -handle.radius * 0.22;
            const right = handle.radius * 0.22;
            const top = -handle.radius * 0.45;
            const bottom = handle.radius * 0.45;

            ctx.beginPath();
            ctx.moveTo(left, top);
            ctx.lineTo(left, bottom);
            ctx.moveTo(right, bottom);
            ctx.lineTo(right, top);
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();

            this.drawArrowHead(ctx, { x: left, y: bottom }, Math.PI / 2);
            this.drawArrowHead(ctx, { x: right, y: top }, -Math.PI / 2);
            ctx.restore();
        }

        drawConvertHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            const size = handle.radius * 2;
            ctx.beginPath();
            ctx.rect(-handle.radius, -handle.radius, size, size);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = 2 / this.state.camera.scale;
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();

            const arm = handle.radius * 0.45;
            ctx.beginPath();
            ctx.moveTo(-arm, 0);
            ctx.lineTo(arm * 0.25, 0);
            ctx.lineTo(arm * 0.25, -arm);
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();

            this.drawArrowHead(ctx, { x: arm * 0.25, y: -arm }, -Math.PI / 2);
            this.drawArrowHead(ctx, { x: -arm, y: 0 }, Math.PI);
            ctx.restore();
        }

        drawArrowHead(ctx, tip, angle) {
            const size = 4 / this.state.camera.scale;
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(
                tip.x - Math.cos(angle - Math.PI / 6) * size,
                tip.y - Math.sin(angle - Math.PI / 6) * size
            );
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(
                tip.x - Math.cos(angle + Math.PI / 6) * size,
                tip.y - Math.sin(angle + Math.PI / 6) * size
            );
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();
        }

        drawMarquee(ctx) {
            const rect = geometry.normalizeRect(this.state.marquee.start, this.state.marquee.end);
            ctx.save();
            ctx.fillStyle = 'rgba(85, 132, 173, 0.14)';
            ctx.strokeStyle = 'rgba(42, 90, 136, 0.85)';
            ctx.lineWidth = 1.5 / this.state.camera.scale;
            ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
            ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
            ctx.restore();
        }
    }

    return { HordesPrototype };
}));