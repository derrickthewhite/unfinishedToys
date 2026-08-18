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
            require('./prototype-game-settings.js'),
            require('./prototype-board-input.js'),
            require('./prototype-board-interaction.js'),
            require('./prototype-board-render.js'),
            require('./prototype-game-flow.js'),
            require('./prototype-reserve.js'),
            require('./prototype-setup-camera.js'),
            require('./prototype-unit-deployment.js'),
            require('./prototype-ai.js'),
            require('./prototype-selection-panel.js'),
            require('./prototype-victory.js')
        );
        return;
    }
    root.HordesPrototypeApp = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory, root.HordesTerrainPlacement, root.HordesArmyBuilder, root.HordesPersistence, root.HordesGameSettings, root.HordesBoardInput, root.HordesBoardInteraction, root.HordesBoardRender, root.HordesGameFlow, root.HordesReserve, root.HordesSetupCamera, root.HordesUnitDeployment, root.HordesAi, root.HordesSelectionPanel, root.HordesVictory);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history, terrainPlacement, armyBuilder, persistence, gameSettings, boardInput, boardInteraction, boardRender, gameFlow, reserve, setupCamera, unitDeployment, ai, selectionPanel, victory) {
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
            if (geometry.loadTerrainCatalog) {
                geometry.loadTerrainCatalog().then((catalog) => {
                    if (catalog) {
                        this.requestRender();
                    }
                });
            }
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
                armyIdentityHint: document.getElementById('armyIdentityHint'),
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
                deploymentSelectionHost: document.getElementById('deploymentSelectionHost'),
                deploymentTray: document.getElementById('deploymentTray'),
                autoDeployButton: document.getElementById('autoDeployButton'),
                returnToTrayButton: document.getElementById('returnToTrayButton'),
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
                deleteUnitButton: document.getElementById('deleteUnitButton'),
                destroyUnitButton: document.getElementById('destroyUnitButton'),
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
                newGameButton: document.getElementById('newGameButton'),
                openGameSettingsButton: document.getElementById('openGameSettingsButton'),
                gameSettingsModal: document.getElementById('gameSettingsModal'),
                gameSettingsBackdrop: document.getElementById('gameSettingsBackdrop'),
                closeGameSettingsButton: document.getElementById('closeGameSettingsButton'),
                limitFactionRostersCheckbox: document.getElementById('limitFactionRostersCheckbox'),
                terrainSettingsList: document.getElementById('terrainSettingsList'),
                blueLosses: document.getElementById('blueLosses'),
                redLosses: document.getElementById('redLosses'),
                statusText: document.getElementById('statusText'),
                selectionText: document.getElementById('selectionText'),
                selectionPanel: document.getElementById('selectionPanel'),
                selectionPanelPortrait: document.getElementById('selectionPanelPortrait'),
                selectionPanelAsset: document.getElementById('selectionPanelAsset'),
                selectionPanelEyebrow: document.getElementById('selectionPanelEyebrow'),
                selectionPanelTitle: document.getElementById('selectionPanelTitle'),
                selectionPanelHint: document.getElementById('selectionPanelHint'),
                selectionPanelStats: document.getElementById('selectionPanelStats'),
                victoryModal: document.getElementById('victoryModal'),
                victoryBackdrop: document.getElementById('victoryBackdrop'),
                victoryTitle: document.getElementById('victoryTitle'),
                victorySubtitle: document.getElementById('victorySubtitle'),
                victoryReason: document.getElementById('victoryReason'),
                victoryWinnerSide: document.getElementById('victoryWinnerSide'),
                victoryLoserSide: document.getElementById('victoryLoserSide'),
                reviewVictoryButton: document.getElementById('reviewVictoryButton'),
                victoryNewGameButton: document.getElementById('victoryNewGameButton')
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
                confirmation: null,
                storageModalOpen: false,
                gameSettingsModalOpen: false,
                snapEnabled: true,
                showFormUpPreview: false,
                singleRotationMode: 'center',
                showRangedArea: false,
                losses: { 'player-1': [], 'player-2': [] },
                startingArmyValueByPlayerId: null,
                victory: null,
                victoryModalDismissed: false,
                reserveUnits: [],
                homeEdgeByPlayerId: this.getDefaultHomeEdges(),
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
            this.state.confirmation = null;
            if (this.state.setup) {
                this.state.setup.confirmation = null;
            }
            this.syncUiFromState();
        }

        confirmSetupStage() {
            if (this.state.confirmation === 'skip-shooting') {
                this.state.confirmation = null;
                this.resolveShootingPhase({ skipUndeclared: true });
                return;
            }
            if (this.state.setup?.confirmation === 'new-game') {
                this.startNewGame();
                return;
            }
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
            if (this.ui.reviewVictoryButton) {
                this.ui.reviewVictoryButton.addEventListener('click', () => this.dismissVictoryModal());
            }
            if (this.ui.victoryBackdrop) {
                this.ui.victoryBackdrop.addEventListener('click', () => this.dismissVictoryModal());
            }
            if (this.ui.victoryNewGameButton) {
                this.ui.victoryNewGameButton.addEventListener('click', () => this.openVictoryNewGameConfirmation());
            }
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
            this.ui.deleteUnitButton.addEventListener('click', () => {
                this.removeSelectedUnits({ countAsLoss: false });
            });
            this.ui.destroyUnitButton.addEventListener('click', () => {
                this.removeSelectedUnits({ countAsLoss: true });
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
            this.ui.newGameButton.addEventListener('click', () => this.openNewGameConfirmation());
            this.ui.openGameSettingsButton.addEventListener('click', () => this.openGameSettingsModal());
            this.ui.closeGameSettingsButton.addEventListener('click', () => this.closeGameSettingsModal());
            this.ui.gameSettingsBackdrop.addEventListener('click', () => this.closeGameSettingsModal());
            this.ui.limitFactionRostersCheckbox.addEventListener('change', () => {
                this.setLimitFactionRosters(this.ui.limitFactionRostersCheckbox.checked);
            });
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
            if (event.key === 'Escape' && this.state.victory && !this.state.victoryModalDismissed) {
                event.preventDefault();
                this.dismissVictoryModal();
                return;
            }
            if (event.key === 'Escape' && (this.state.confirmation || this.state.setup?.confirmation)) {
                event.preventDefault();
                this.closeSetupConfirmation();
                return;
            }
            if (event.key === 'Escape' && this.state.gameSettingsModalOpen) {
                event.preventDefault();
                this.closeGameSettingsModal();
                return;
            }
            if (event.key === 'Escape' && this.state.storageModalOpen) {
                event.preventDefault();
                this.closeStorageModal();
                return;
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && this.state.setupStage === 'unit-deployment') {
                if (!this.state.storageModalOpen && !this.state.gameSettingsModalOpen && !this.state.setup?.confirmation) {
                    event.preventDefault();
                    this.returnSelectedUnitsToTray();
                }
                return;
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && this.state.mode === 'edit' && this.state.setupStage !== 'unit-deployment') {
                if (!this.state.storageModalOpen && !this.state.gameSettingsModalOpen && !this.state.setup?.confirmation) {
                    event.preventDefault();
                    this.removeSelectedUnits({ countAsLoss: event.shiftKey });
                }
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
                if (!this.state.startingArmyValueByPlayerId) {
                    this.captureStartingArmyValues();
                }
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
            return this.state.units.find((unit) => unit.id === unitId)
                || this.getReserveUnits().find((unit) => unit.id === unitId)
                || null;
        }

        getSelectedUnits() {
            return this.state.selectedIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
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

        syncUiFromState() {
            const setupActive = this.isSetupActive();
            const boardSetup = this.state.setupStage === 'terrain-placement' || this.state.setupStage === 'unit-deployment';
            if (this.ui.gameBar) this.ui.gameBar.hidden = setupActive;
            if (this.ui.boardShell) this.ui.boardShell.hidden = setupActive;
            if (this.ui.helpBar) this.ui.helpBar.hidden = setupActive;
            if (this.ui.setupShell) {
                this.ui.setupShell.hidden = !setupActive;
                this.ui.setupShell.classList?.toggle('is-board-setup', boardSetup);
            }
            if (this.ui.armyBuilder) this.ui.armyBuilder.hidden = this.state.setupStage !== 'army-builder';
            if (this.ui.terrainPlacement) this.ui.terrainPlacement.hidden = this.state.setupStage !== 'terrain-placement';
            if (this.ui.deploymentScreen) this.ui.deploymentScreen.hidden = this.state.setupStage !== 'unit-deployment';
            this.hostSelectionPanel();
            const confirmation = this.state.confirmation || this.state.setup?.confirmation;
            if (this.ui.confirmationModal) this.ui.confirmationModal.hidden = !confirmation;
            if (confirmation === 'skip-shooting') {
                if (this.ui.confirmationTitle) this.ui.confirmationTitle.textContent = 'Skip Remaining Shots';
                if (this.ui.confirmationText) this.ui.confirmationText.textContent = 'Some units can still shoot. Resolve now and skip the rest?';
                if (this.ui.confirmSetupButton) this.ui.confirmSetupButton.textContent = 'Skip and Resolve';
                if (this.ui.cancelConfirmationButton) this.ui.cancelConfirmationButton.textContent = 'Keep Shooting';
            } else if (confirmation === 'new-game') {
                if (this.ui.confirmationTitle) this.ui.confirmationTitle.textContent = 'Start New Game';
                if (this.ui.confirmationText) this.ui.confirmationText.textContent = 'Unsaved progress will be lost.';
                if (this.ui.confirmSetupButton) this.ui.confirmSetupButton.textContent = 'New Game';
                if (this.ui.cancelConfirmationButton) this.ui.cancelConfirmationButton.textContent = 'Cancel';
            } else if (confirmation === 'terrain') {
                if (this.ui.confirmationTitle) this.ui.confirmationTitle.textContent = 'Confirm Terrain';
                if (this.ui.confirmationText) this.ui.confirmationText.textContent = 'The terrain board will be locked and the game will proceed to unit deployment.';
                if (this.ui.confirmSetupButton) this.ui.confirmSetupButton.textContent = 'Begin Deployment';
                if (this.ui.cancelConfirmationButton) this.ui.cancelConfirmationButton.textContent = 'Keep Editing';
            } else {
                if (this.ui.confirmationTitle) this.ui.confirmationTitle.textContent = 'Confirm Armies';
                if (this.ui.confirmationText) this.ui.confirmationText.textContent = 'Both 24 AP armies will be locked and terrain placement will begin.';
                if (this.ui.confirmSetupButton) this.ui.confirmSetupButton.textContent = 'Continue';
                if (this.ui.cancelConfirmationButton) this.ui.cancelConfirmationButton.textContent = 'Keep Editing';
            }
            if (this.state.setupStage === 'army-builder') {
                this.renderArmyBuilder();
                const identityConflict = this.getArmyIdentityConflict();
                if (this.ui.acceptArmiesButton) this.ui.acceptArmiesButton.disabled = !this.canAcceptArmies();
                if (this.ui.armyIdentityHint) {
                    this.ui.armyIdentityHint.hidden = !identityConflict;
                    this.ui.armyIdentityHint.textContent = identityConflict || '';
                }
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
            const canRemoveSelection = this.state.mode === 'edit' && this.state.selectedIds.length > 0;
            this.ui.deleteUnitButton.disabled = this.state.mode !== 'edit' || this.state.selectedIds.length === 0;
            this.ui.destroyUnitButton.disabled = this.state.mode !== 'edit' || this.state.selectedIds.length === 0;
            this.ui.deleteUnitButton.hidden = this.state.mode !== 'edit';
            this.ui.destroyUnitButton.hidden = this.state.mode !== 'edit';
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
                || this.state.draft.kind === 'reserve-deploy'
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
                || (this.state.phase === 'melee' && this.getMeleeState().combats.length === 0);
            this.ui.cancelMoveButton.disabled = this.state.mode !== 'game' || this.state.phase !== 'move' || !this.state.draft;
            this.ui.undoMoveButton.disabled = this.state.mode === 'edit' ? this.state.editHistory.length === 0 : !this.state.draft;
            this.ui.acknowledgedButton.disabled = this.state.mode !== 'game' || (this.state.phase !== 'form-up' && !this.state.combatResolution);
            this.ui.storageModal.hidden = !this.state.storageModalOpen;
            if (this.ui.gameSettingsModal) this.ui.gameSettingsModal.hidden = !this.state.gameSettingsModalOpen;
            if (this.ui.saveStorageButton) this.ui.saveStorageButton.disabled = false;
            const playerOneLosses = this.getLossSummary('player-1');
            const playerTwoLosses = this.getLossSummary('player-2');
            this.ui.blueLosses.textContent = `${this.getPlayerLabel('player-1')} lost: ${playerOneLosses.points}`;
            this.ui.blueLosses.title = playerOneLosses.title;
            this.ui.redLosses.textContent = `${this.getPlayerLabel('player-2')} lost: ${playerTwoLosses.points}`;
            this.ui.redLosses.title = playerTwoLosses.title;
            this.ui.statusText.textContent = this.state.status;
            this.renderSelectionInfo();
            this.renderVictoryModal();
            const gameOver = this.isGameOver();
            if (gameOver) {
                this.ui.finishMoveButton.disabled = true;
                this.ui.endMovePhaseButton.disabled = true;
                this.ui.stepMoveButton.disabled = true;
                this.ui.resolveShootingButton.disabled = true;
                this.ui.cancelMoveButton.disabled = true;
                this.ui.undoMoveButton.disabled = true;
                this.ui.acknowledgedButton.disabled = true;
                this.ui.deleteUnitButton.disabled = true;
                this.ui.destroyUnitButton.disabled = true;
            } else if (canRemoveSelection) {
                this.ui.deleteUnitButton.disabled = false;
                this.ui.destroyUnitButton.disabled = false;
            }
        }

    }

    terrainPlacement.install(HordesPrototype);
    armyBuilder.install(HordesPrototype);
    persistence.install(HordesPrototype);
    gameSettings.install(HordesPrototype);
    boardInput.install(HordesPrototype);
    boardInteraction.install(HordesPrototype);
    boardRender.install(HordesPrototype);
    gameFlow.install(HordesPrototype);
    reserve.install(HordesPrototype);
    setupCamera.install(HordesPrototype);
    unitDeployment.install(HordesPrototype);
    ai.install(HordesPrototype);
    selectionPanel.install(HordesPrototype);
    victory.install(HordesPrototype);
    return { HordesPrototype };
}));