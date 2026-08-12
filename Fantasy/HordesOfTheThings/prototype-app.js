(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js'),
            require('./prototype-history.js'),
            require('./prototype-terrain-placement.js'),
            require('./prototype-army-builder.js'),
            require('./prototype-persistence.js'),
            require('./prototype-board-input.js'),
            require('./prototype-board-interaction.js'),
            require('./prototype-setup-camera.js'),
            require('./prototype-unit-deployment.js')
        );
        return;
    }
    root.HordesPrototypeApp = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory, root.HordesTerrainPlacement, root.HordesArmyBuilder, root.HordesPersistence, root.HordesBoardInput, root.HordesBoardInteraction, root.HordesSetupCamera, root.HordesUnitDeployment);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history, terrainPlacement, armyBuilder, persistence, boardInput, boardInteraction, setupCamera, unitDeployment) {
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
        Behemoth: 'assets/Behemoth.svg',
        Artillery: 'assets/Artillery.svg'
    });

    class HordesPrototype {
        constructor() {
            this.canvas = document.getElementById('boardCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.ui = this.captureUi();
            this.terrainCtx = this.ui.terrainCanvas.getContext('2d');
            this.deploymentCtx = this.ui.deploymentCanvas ? this.ui.deploymentCanvas.getContext('2d') : null;
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
                deploymentScreen: document.getElementById('deploymentScreen'),
                deploymentCanvas: document.getElementById('deploymentCanvas'),
                deploymentActivePlayer: document.getElementById('deploymentActivePlayer'),
                deploymentProgress: document.getElementById('deploymentProgress'),
                deploymentStatus: document.getElementById('deploymentStatus'),
                deploymentSnapCheckbox: document.getElementById('deploymentSnapCheckbox'),
                deploymentTray: document.getElementById('deploymentTray'),
                finishDeploymentButton: document.getElementById('finishDeploymentButton'),
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
                    confirmation: null,
                    terrain: null,
                    deployment: null
                },
                setupCameras: {},
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

        isSetupActive() {
            return Boolean(this.state.setupStage && this.state.setupStage !== 'game');
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
                this.initializeUnitDeployment();
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
            this.bindUnitDeploymentUi();
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

        getUnitById(unitId) {
            return this.state.units.find((unit) => unit.id === unitId) || null;
        }

        getSelectedUnits() {
            return this.state.selectedIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
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

        syncUiFromState() {
            const setupActive = this.isSetupActive();
            if (this.ui.gameBar) this.ui.gameBar.hidden = setupActive;
            if (this.ui.boardShell) this.ui.boardShell.hidden = setupActive;
            if (this.ui.helpBar) this.ui.helpBar.hidden = setupActive;
            if (this.ui.setupShell) this.ui.setupShell.hidden = !setupActive;
            if (this.ui.armyBuilder) this.ui.armyBuilder.hidden = this.state.setupStage !== 'army-builder';
            if (this.ui.terrainPlacement) this.ui.terrainPlacement.hidden = this.state.setupStage !== 'terrain-placement';
            if (this.ui.deploymentScreen) this.ui.deploymentScreen.hidden = this.state.setupStage !== 'unit-deployment';
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
            if (this.state.setupStage === 'terrain-placement') {
                this.renderTerrainPlacement();
            }
            if (this.state.setupStage === 'unit-deployment') {
                this.renderUnitDeployment();
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
            if (this.ui.saveStorageButton) this.ui.saveStorageButton.disabled = this.isSetupActive();
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

    terrainPlacement.install(HordesPrototype);
    armyBuilder.install(HordesPrototype);
    persistence.install(HordesPrototype);
    boardInput.install(HordesPrototype);
    boardInteraction.install(HordesPrototype);
    setupCamera.install(HordesPrototype);
    unitDeployment.install(HordesPrototype);
    return { HordesPrototype };
}));