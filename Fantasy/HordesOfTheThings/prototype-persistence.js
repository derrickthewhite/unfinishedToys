(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'));
        return;
    }
    root.HordesPersistence = factory(root.HordesData);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
    const STORAGE_KEY = 'hordes-of-the-things-saves';

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
                    counts: { ...(source.armies?.[playerId]?.counts || {}) }
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
            const setupStage = this.normalizeSetupStage(snapshot.setupStage);
            this.state.mode = snapshot.mode || (setupStage === 'game' ? 'game' : 'edit');
            this.state.setupStage = setupStage;
            this.state.setup = this.normalizeSavedSetup(snapshot.setup, setupStage);
            this.state.setupCameras = {};
            this.state.players = data.PLAYER_IDS.reduce((players, playerId) => {
                players[playerId] = { ...data.DEFAULT_PLAYERS[playerId], ...(snapshot.players?.[playerId] || {}) };
                return players;
            }, {});
            this.state.activePlayerId = snapshot.activePlayerId || (snapshot.activeSide === 'red' ? 'player-2' : 'player-1');
            this.state.remainingMoves = Number.isFinite(snapshot.remainingMoves) ? snapshot.remainingMoves : 0;
            this.state.phase = snapshot.phase || 'move';
            this.state.terrain = snapshot.terrain || (setupStage === 'game' ? data.createDefaultTerrain() : { roads: [], features: [] });
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
            this.state.placingUnit = false;
            this.nextUnitId = snapshot.nextUnitId || this.deriveNextUnitId(this.state.units);
            if (setupStage === 'game' && this.state.phase === 'shooting') {
                this.initializeShootingPhase();
            }
            if (setupStage === 'game' && this.state.phase === 'melee') {
                this.initializeMeleePhase();
            }
            this.closeStorageModal(false);
            if (setupStage === 'game' && this.maybeAutoAdvanceCombatPhase()) {
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
