(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./data.js'));
        return;
    }
    root.HordesPersistence = factory(root.HordesData);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
    const STORAGE_KEY = 'hordes-of-the-things-saves';
    const CHECKPOINT_KEY = 'hordes-of-the-things-checkpoints';
    const CHECKPOINT_SLOTS = ['gameStart', 'lastTurn', 'endMove'];
    const CHECKPOINT_META = {
        gameStart: { id: 'checkpoint-game-start', name: 'Start of game' },
        lastTurn: { id: 'checkpoint-last-turn', name: 'Last turn' },
        endMove: { id: 'checkpoint-end-move', name: 'End of move' }
    };

    class PersistenceMethods {
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

        cloneJson(value, fallback) {
            if (value === undefined || value === null) {
                return fallback;
            }
            return JSON.parse(JSON.stringify(value));
        }

        getSetupStageLabel(setupStage) {
            if (setupStage === 'army-builder') {
                return 'Army';
            }
            if (setupStage === 'terrain-placement') {
                return 'Terrain';
            }
            if (setupStage === 'unit-deployment') {
                return 'Deploy';
            }
            return 'Game';
        }

        getDefaultSaveName(now = new Date()) {
            if (this.isSetupActive()) {
                const playerOne = `${this.getPlayerLabel('player-1')} ${this.getPlayer('player-1')?.faction || ''}`.trim();
                const playerTwo = `${this.getPlayerLabel('player-2')} ${this.getPlayer('player-2')?.faction || ''}`.trim();
                const screen = this.getSetupStageLabel(this.state.setupStage);
                const date = now.toISOString().slice(0, 10);
                return `${playerOne} vs ${playerTwo} · ${screen} · ${date}`.slice(0, 60);
            }
            return `${this.getPlayerLabel(this.state.activePlayerId)}-${this.state.phase}`;
        }

        cloneSetupState() {
            const setup = this.state.setup || {};
            const deployment = setup.deployment
                ? this.cloneJson({
                    ...setup.deployment,
                    interaction: null,
                    selectedTrayId: null,
                    selectedUnitId: null
                }, null)
                : null;
            return {
                armies: this.cloneJson(setup.armies, this.createArmyDrafts()),
                confirmation: setup.confirmation === 'armies' || setup.confirmation === 'terrain' ? setup.confirmation : null,
                terrain: this.cloneJson(setup.terrain, null),
                deployment
            };
        }

        normalizeSavedSetup(setup, setupStage) {
            const source = setup || {};
            const armies = this.createArmyDrafts();
            data.PLAYER_IDS.forEach((playerId) => {
                armies[playerId] = {
                    counts: { ...(source.armies?.[playerId]?.counts || {}) },
                    random: Boolean(source.armies?.[playerId]?.random)
                };
            });
            const confirmation = source.confirmation === 'armies' || source.confirmation === 'terrain'
                ? source.confirmation
                : null;
            if (setupStage === 'game') {
                return {
                    armies: this.createArmyDrafts(),
                    confirmation: null,
                    terrain: null,
                    deployment: null
                };
            }
            const deployment = source.deployment
                ? {
                    defenderPlayerId: source.deployment.defenderPlayerId || null,
                    attackerPlayerId: source.deployment.attackerPlayerId || null,
                    activePlayerId: source.deployment.activePlayerId || source.deployment.defenderPlayerId || 'player-1',
                    zoneByPlayerId: this.cloneJson(source.deployment.zoneByPlayerId, {}),
                    tray: Array.isArray(source.deployment.tray) ? this.cloneJson(source.deployment.tray, []) : [],
                    selectedTrayId: null,
                    selectedUnitId: null,
                    deployedByPlayerId: {
                        'player-1': [...(source.deployment.deployedByPlayerId?.['player-1'] || [])],
                        'player-2': [...(source.deployment.deployedByPlayerId?.['player-2'] || [])]
                    },
                    interaction: null
                }
                : null;
            const terrain = source.terrain
                ? {
                    ...this.cloneJson(source.terrain, null),
                    selectedTerrainId: null
                }
                : null;
            return {
                armies,
                confirmation,
                terrain,
                deployment
            };
        }

        normalizeSetupStage(setupStage) {
            if (setupStage === 'army-builder' || setupStage === 'terrain-placement' || setupStage === 'unit-deployment' || setupStage === 'game') {
                return setupStage;
            }
            return 'game';
        }

        buildSavePayload(name) {
            return {
                id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name,
                savedAt: new Date().toISOString(),
                snapshot: {
                    mode: this.state.mode,
                    setupStage: this.normalizeSetupStage(this.state.setupStage),
                    setup: this.cloneSetupState(),
                    players: this.cloneJson(this.state.players, this.createDefaultPlayers()),
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
                    terrain: this.cloneJson(this.state.terrain, { roads: [], features: [] }),
                    losses: this.cloneJson(this.state.losses, { 'player-1': [], 'player-2': [] }),
                    startingArmyValueByPlayerId: this.cloneJson(this.state.startingArmyValueByPlayerId, null),
                    victory: this.cloneJson(this.state.victory, null),
                    victoryModalDismissed: Boolean(this.state.victoryModalDismissed),
                    reserveUnits: this.cloneJson(this.getReserveUnits(), []),
                    homeEdgeByPlayerId: this.cloneJson(this.state.homeEdgeByPlayerId, this.getDefaultHomeEdges()),
                    snapEnabled: this.state.snapEnabled,
                    singleRotationMode: this.state.singleRotationMode,
                    showRangedArea: this.state.showRangedArea,
                    showMoveErrors: this.state.showMoveErrors,
                    showBattleStats: this.state.showBattleStats,
                    showStatus: this.state.showStatus !== false,
                    aiEvaluationMode: this.state.aiEvaluationMode,
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

        getExportFileName(name, now = new Date()) {
            const stamp = now.toISOString().replace(/[:.]/g, '-');
            const safeName = String(name || 'hordes-export')
                .trim()
                .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 48) || 'hordes-export';
            return `${safeName}-${stamp}.json`;
        }

        downloadJsonFile(filename, payload) {
            const text = `${JSON.stringify(payload, null, 2)}\n`;
            if (typeof document === 'undefined') {
                return text;
            }
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            return text;
        }

        emptyCheckpointStore() {
            return { gameStart: null, lastTurn: null, endMove: null };
        }

        getCheckpointStore() {
            const store = this.emptyCheckpointStore();
            if (typeof window === 'undefined' || !window.localStorage) {
                return store;
            }
            try {
                const raw = window.localStorage.getItem(CHECKPOINT_KEY);
                const parsed = raw ? JSON.parse(raw) : {};
                CHECKPOINT_SLOTS.forEach((slot) => {
                    const record = parsed?.[slot];
                    if (record?.snapshot) {
                        store[slot] = record;
                    }
                });
                return store;
            } catch (error) {
                console.warn('Unable to read checkpoints from local storage.', error);
                return this.emptyCheckpointStore();
            }
        }

        writeCheckpointStore(store) {
            if (typeof window === 'undefined' || !window.localStorage) {
                return false;
            }
            const payload = this.emptyCheckpointStore();
            CHECKPOINT_SLOTS.forEach((slot) => {
                payload[slot] = store?.[slot]?.snapshot ? store[slot] : null;
            });
            window.localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(payload));
            return true;
        }

        captureCheckpoint(slot) {
            if (this._restoringSave || !CHECKPOINT_META[slot]) {
                return false;
            }
            if (this.state.mode !== 'game' || this.state.setupStage !== 'game') {
                return false;
            }
            try {
                const record = this.buildSavePayload(CHECKPOINT_META[slot].name);
                record.id = CHECKPOINT_META[slot].id;
                const store = this.getCheckpointStore();
                store[slot] = record;
                return this.writeCheckpointStore(store);
            } catch (error) {
                console.warn('Unable to store checkpoint.', error);
                return false;
            }
        }

        captureGameStartCheckpoint() {
            return this.captureCheckpoint('gameStart');
        }

        captureLocalTurnCheckpoint() {
            if (typeof this.canLocallyControl === 'function' && !this.canLocallyControl(this.state.activePlayerId)) {
                return false;
            }
            return this.captureCheckpoint('lastTurn');
        }

        captureEndMoveCheckpoint() {
            if (this.state.phase !== 'move') {
                return false;
            }
            return this.captureCheckpoint('endMove');
        }

        loadCheckpoint(slot) {
            const record = this.getCheckpointStore()[slot];
            if (!record?.snapshot) {
                this.updateStatus('That checkpoint has not been saved yet.');
                return;
            }
            if (typeof this.closeGameSettingsModal === 'function') {
                this.closeGameSettingsModal(false);
            }
            const label = CHECKPOINT_META[slot]?.name || record.name;
            this.restoreSavedRecord(record, `Returned to ${label}.`);
            if (typeof this.canLocallyControl === 'function' && !this.canLocallyControl(this.state.activePlayerId)) {
                this.state.controllerPaused = true;
                this._controllerActionToken = (this._controllerActionToken || 0) + 1;
                if (typeof this.syncUiFromState === 'function') {
                    this.syncUiFromState();
                }
                this.updateStatus(`Returned to ${label}. Computer paused.`);
            }
        }

        exportGameJson() {
            const named = (this.ui.storageNameInput?.value || '').trim();
            const name = named || this.getDefaultSaveName();
            const payload = this.buildSavePayload(name);
            const filename = this.getExportFileName(name);
            this.downloadJsonFile(filename, payload);
            this.updateStatus(`Exported ${filename}.`);
            return payload;
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
            const footprint = unit.type === 'Base' ? data.getBaseFootprint(unit.faction || normalized.faction) : null;
            return {
                ...normalized,
                playerId,
                width: footprint ? footprint.width : normalized.width,
                depth: footprint ? footprint.depth : (data.UNIT_TYPES[unit.type]?.depth ?? unit.depth),
                outline: footprint ? footprint.points.map((point) => ({ x: point.x, y: point.y })) : (normalized.outline || null),
                moves: unit.moves ? { ...unit.moves } : undefined,
                strength: footprint ? { infantry: 6, mounted: 6 } : (unit.strength ? { ...unit.strength } : undefined),
                ranged: unit.ranged ? { ...unit.ranged } : null,
                combat: footprint
                    ? { ...(unit.combat || {}), stationary: true, lossEndsGame: true, unpurchasable: true }
                    : (unit.combat ? { ...unit.combat } : {}),
                value: footprint ? 0 : normalized.value,
                troopClass: footprint ? 'infantry' : normalized.troopClass
            };
        }

        normalizeSavedLosses(losses) {
            return {
                'player-1': losses?.['player-1'] || losses?.blue || [],
                'player-2': losses?.['player-2'] || losses?.red || []
            };
        }

        normalizeSavedHomeEdges(homeEdgeByPlayerId) {
            const source = homeEdgeByPlayerId || {};
            const edges = this.getDefaultHomeEdges();
            data.PLAYER_IDS.forEach((playerId) => {
                if (source[playerId] === 'top' || source[playerId] === 'bottom') {
                    edges[playerId] = source[playerId];
                }
            });
            return edges;
        }

        loadGame(recordId) {
            const record = this.getStorageRecords().find((entry) => entry.id === recordId);
            if (!record) {
                this.updateStatus('That saved game could not be found.');
                this.renderStorageList();
                return;
            }
            this.restoreSavedRecord(record, `Loaded saved game ${record.name}.`);
        }

        restoreSavedRecord(record, statusMessage) {
            this._restoringSave = true;
            try {
            const snapshot = record.snapshot || {};
            const setupStage = this.normalizeSetupStage(snapshot.setupStage);
            this.state.mode = snapshot.mode || (setupStage === 'game' ? 'game' : 'edit');
            this.state.setupStage = setupStage;
            this.state.setup = this.normalizeSavedSetup(snapshot.setup, setupStage);
            this.state.setupCameras = {};
            this.state.players = data.PLAYER_IDS.reduce((players, playerId) => {
                const saved = snapshot.players?.[playerId] || {};
                const colorId = saved.colorId === data.RANDOM_IDENTITY || data.PLAYER_COLORS[saved.colorId]
                    ? saved.colorId
                    : data.DEFAULT_PLAYERS[playerId].colorId;
                const faction = saved.faction === data.RANDOM_IDENTITY || data.FACTIONS.includes(saved.faction)
                    ? saved.faction
                    : data.DEFAULT_PLAYERS[playerId].faction;
                players[playerId] = {
                    ...data.DEFAULT_PLAYERS[playerId],
                    ...saved,
                    id: playerId,
                    colorId,
                    faction,
                    controller: data.normalizeController(saved.controller)
                };
                return players;
            }, {});
            this.state.activePlayerId = snapshot.activePlayerId || (snapshot.activeSide === 'red' ? 'player-2' : 'player-1');
            this.state.remainingMoves = Number.isFinite(snapshot.remainingMoves) ? snapshot.remainingMoves : 0;
            this.state.phase = snapshot.phase || 'move';
            this.state.terrain = snapshot.terrain || (setupStage === 'game' ? data.createDefaultTerrain() : { roads: [], features: [] });
            this.state.units = Array.isArray(snapshot.units) ? snapshot.units.map((unit) => this.normalizeSavedUnit(unit)) : [];
            this.state.reserveUnits = Array.isArray(snapshot.reserveUnits)
                ? snapshot.reserveUnits.map((unit) => this.normalizeSavedUnit(unit))
                : [];
            this.state.homeEdgeByPlayerId = this.normalizeSavedHomeEdges(snapshot.homeEdgeByPlayerId);
            this.relayoutReserveUnits();
            this.state.losses = this.normalizeSavedLosses(snapshot.losses);
            this.state.startingArmyValueByPlayerId = snapshot.startingArmyValueByPlayerId || null;
            this.state.victory = snapshot.victory || null;
            this.state.victoryModalDismissed = Boolean(snapshot.victoryModalDismissed);
            this.state.snapEnabled = snapshot.snapEnabled !== false;
            this.state.showFormUpPreview = Boolean(snapshot.showFormUpPreview);
            this.state.singleRotationMode = snapshot.singleRotationMode === 'front-corner' ? 'front-corner' : 'center';
            this.state.showRangedArea = Boolean(snapshot.showRangedArea);
            this.state.showMoveErrors = Boolean(snapshot.showMoveErrors);
            this.state.showBattleStats = Boolean(snapshot.showBattleStats);
            this.state.showStatus = snapshot.showStatus !== false;
            this.state.aiEvaluationMode = Boolean(snapshot.aiEvaluationMode);
            this.state.moveEvaluation = null;
            this.state.selectedBattleId = null;
            this.state.selectedIds = [];
            this.state.selectionAnalysis = { type: 'none', invalid: false, reason: '' };
            this.state.draft = null;
            this.state.formUp = null;
            this.state.shooting = null;
            this.state.melee = null;
            this.state.combatResolution = null;
            this.state.confirmation = null;
            this.state.editHistory = [];
            this.state.marquee = null;
            this.state.interaction = null;
            this.state.placingUnit = false;
            this.nextUnitId = snapshot.nextUnitId || this.deriveNextUnitId([
                ...this.state.units,
                ...this.getReserveUnits()
            ]);
            if (setupStage === 'game' && this.state.phase === 'shooting') {
                this.initializeShootingPhase();
            }
            if (setupStage === 'game' && this.state.phase === 'melee') {
                this.initializeMeleePhase();
            }
            this.state.controllerPaused = false;
            this.state.controllerThinking = null;
            this.resetControllerRuntime();
            this.closeStorageModal(false);
            if (setupStage === 'game' && !this.state.victory) {
                this.ensureStartingArmyValues();
            }
            if (setupStage === 'game' && this.maybeAutoAdvanceCombatPhase()) {
                this.scheduleControllerAction();
                return;
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus(statusMessage);
            this.scheduleControllerAction();
            } finally {
                this._restoringSave = false;
            }
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
                const setupStage = this.normalizeSetupStage(snapshot.setupStage);
                const timestamp = new Date(record.savedAt).toLocaleString();
                if (setupStage !== 'game') {
                    const confirmLabel = snapshot.setup?.confirmation ? ` · confirm ${snapshot.setup.confirmation}` : '';
                    details.textContent = `${timestamp} | Setup · ${this.getSetupStageLabel(setupStage).toLowerCase()}${confirmLabel}`;
                } else {
                    const lossPoints = Object.values(this.normalizeSavedLosses(snapshot.losses))
                        .flat()
                        .reduce((sum, unit) => sum + unit.value, 0);
                    const activePlayerId = snapshot.activePlayerId || (snapshot.activeSide === 'red' ? 'player-2' : 'player-1');
                    const players = snapshot.players || data.DEFAULT_PLAYERS;
                    const colorId = players[activePlayerId]?.colorId || data.DEFAULT_PLAYERS[activePlayerId].colorId;
                    const activeLabel = data.PLAYER_COLORS[colorId].label;
                    details.textContent = `${timestamp} | ${snapshot.phase || 'move'} | ${activeLabel} to act | ${lossPoints} points destroyed`;
                }
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
            if (this.ui.storageModal) {
                this.ui.storageModal.hidden = false;
            }
            if (this.ui.storageNameInput) {
                if (!this.ui.storageNameInput.value.trim()) {
                    this.ui.storageNameInput.value = this.getDefaultSaveName();
                }
                this.ui.storageNameInput.focus?.();
                this.ui.storageNameInput.select?.();
            }
        }

        closeStorageModal(restoreFocus = true) {
            this.state.storageModalOpen = false;
            this.ui.storageModal.hidden = true;
            if (restoreFocus) {
                this.ui.storageButton.focus();
            }
        }
    }

    function install(PersistencePrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(PersistenceMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(PersistencePrototype.prototype, descriptors);
    }

    return { install };
}));
