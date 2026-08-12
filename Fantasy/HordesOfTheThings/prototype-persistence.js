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
            if (this.isSetupActive()) {
                this.updateStatus('Saving is available once deployment has begun the game.');
                return;
            }
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
            this.state.setupStage = 'game';
            this.state.setup = {
                armies: this.createArmyDrafts(),
                confirmation: null,
                terrain: null,
                deployment: null
            };
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
            this.state.placingUnit = false;
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
    }

    function install(PersistencePrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(PersistenceMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(PersistencePrototype.prototype, descriptors);
    }

    return { install };
}));
