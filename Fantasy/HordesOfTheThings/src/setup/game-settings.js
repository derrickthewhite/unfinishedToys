(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../data.js'));
        return;
    }
    root.HordesGameSettings = factory(root.HordesData);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
    const SETTINGS_KEY = 'hordes-of-the-things-settings';

    function createDefaultTerrainShapeKindSettings() {
        const settings = {};
        data.TERRAIN_SHAPES.forEach((shape) => {
            settings[shape] = {};
            data.TERRAIN_FEATURE_KINDS.forEach((kind) => {
                settings[shape][kind] = true;
            });
        });
        return settings;
    }

    function normalizeTerrainShapeKindSettings(raw) {
        const settings = createDefaultTerrainShapeKindSettings();
        data.TERRAIN_SHAPES.forEach((shape) => {
            data.TERRAIN_FEATURE_KINDS.forEach((kind) => {
                if (raw?.[shape]?.[kind] === false) {
                    settings[shape][kind] = false;
                }
            });
        });
        return settings;
    }

    function install(SettingsPrototype) {
        Object.assign(SettingsPrototype.prototype, {
            getGameSettingsStorage() {
                if (this.settingsStorage) {
                    return this.settingsStorage;
                }
                if (typeof window !== 'undefined' && window.localStorage) {
                    return window.localStorage;
                }
                return null;
            },

            readGameSettings() {
                const defaults = {
                    limitFactionRosters: true,
                    terrainShapeKinds: createDefaultTerrainShapeKindSettings()
                };
                const storage = this.getGameSettingsStorage();
                if (!storage) {
                    return defaults;
                }
                try {
                    const raw = storage.getItem(SETTINGS_KEY);
                    const parsed = raw ? JSON.parse(raw) : {};
                    return {
                        limitFactionRosters: parsed?.limitFactionRosters !== false,
                        terrainShapeKinds: normalizeTerrainShapeKindSettings(parsed?.terrainShapeKinds)
                    };
                } catch (error) {
                    console.warn('Unable to read game settings from local storage.', error);
                    return defaults;
                }
            },

            writeGameSettings(settings) {
                const storage = this.getGameSettingsStorage();
                if (!storage) {
                    return false;
                }
                storage.setItem(SETTINGS_KEY, JSON.stringify({
                    limitFactionRosters: settings?.limitFactionRosters !== false,
                    terrainShapeKinds: normalizeTerrainShapeKindSettings(settings?.terrainShapeKinds)
                }));
                return true;
            },

            areFactionRostersLimited() {
                return this.readGameSettings().limitFactionRosters !== false;
            },

            setLimitFactionRosters(enabled) {
                const settings = this.readGameSettings();
                settings.limitFactionRosters = Boolean(enabled);
                this.writeGameSettings(settings);
                if (settings.limitFactionRosters) {
                    this.pruneArmiesToAllowedTypes();
                }
                this.syncUiFromState();
                return settings.limitFactionRosters;
            },

            getTerrainShapeKindSettings() {
                return this.readGameSettings().terrainShapeKinds;
            },

            setTerrainShapeKindEnabled(shape, kind, enabled) {
                if (!data.TERRAIN_SHAPES.includes(shape) || !data.TERRAIN_FEATURE_KINDS.includes(kind)) {
                    return this.getTerrainShapeKindSettings();
                }
                const settings = this.readGameSettings();
                settings.terrainShapeKinds[shape][kind] = Boolean(enabled);
                this.writeGameSettings(settings);
                return settings.terrainShapeKinds;
            },

            getAllowedShapesForKind(kind) {
                if (kind === 'road') {
                    return [];
                }
                const settings = this.getTerrainShapeKindSettings();
                return data.TERRAIN_SHAPES.filter((shape) => settings[shape]?.[kind] !== false);
            },

            getWeightedTerrainOfferKinds() {
                const weightedKinds = ['road', 'road', 'forest', 'swamp', 'water', 'impassable', 'forest'];
                const filtered = weightedKinds.filter((kind) => kind === 'road' || this.getAllowedShapesForKind(kind).length > 0);
                return filtered.length > 0 ? filtered : ['road'];
            },

            createConfiguredTerrainOffer(kind, id, random = Math.random) {
                return data.createTerrainOffer(kind, id, random, {
                    allowedShapes: this.getAllowedShapesForKind(kind)
                });
            },

            openGameSettingsModal() {
                this.closeStorageModal(false);
                this.state.gameSettingsModalOpen = true;
                this.renderGameSettings();
                this.syncUiFromState();
                if (this.ui.gameSettingsModal) {
                    this.ui.gameSettingsModal.hidden = false;
                }
            },

            closeGameSettingsModal(restoreFocus = true) {
                this.state.gameSettingsModalOpen = false;
                if (this.ui.gameSettingsModal) {
                    this.ui.gameSettingsModal.hidden = true;
                }
                if (restoreFocus) {
                    this.openStorageModal();
                }
            },

            renderGameSettings() {
                if (this.ui.limitFactionRostersCheckbox) {
                    this.ui.limitFactionRostersCheckbox.checked = this.areFactionRostersLimited();
                }
                const list = this.ui.terrainSettingsList;
                if (!list) {
                    return;
                }
                const settings = this.getTerrainShapeKindSettings();
                list.innerHTML = '';
                data.TERRAIN_SHAPES.forEach((shape) => {
                    const row = document.createElement('div');
                    row.className = 'terrain-settings-row';

                    const preview = document.createElement('img');
                    preview.className = 'terrain-settings-preview';
                    preview.src = `${data.TERRAIN_ASSET_ROOT}/waved/${shape}.svg`;
                    preview.alt = data.TERRAIN_SHAPE_LABELS[shape] || shape;

                    const body = document.createElement('div');
                    body.className = 'terrain-settings-body';
                    const title = document.createElement('h4');
                    title.className = 'terrain-settings-title';
                    title.textContent = data.TERRAIN_SHAPE_LABELS[shape] || shape;
                    const kinds = document.createElement('div');
                    kinds.className = 'terrain-settings-kinds';
                    data.TERRAIN_FEATURE_KINDS.forEach((kind) => {
                        const label = document.createElement('label');
                        label.className = 'terrain-settings-kind';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.checked = settings[shape][kind] !== false;
                        checkbox.addEventListener('change', () => {
                            this.setTerrainShapeKindEnabled(shape, kind, checkbox.checked);
                        });
                        label.append(checkbox, document.createTextNode(data.TERRAIN_STYLE[kind].label));
                        kinds.appendChild(label);
                    });
                    body.append(title, kinds);
                    row.append(preview, body);
                    list.appendChild(row);
                });
            },

            openNewGameConfirmation() {
                if (!this.state.setup) {
                    this.state.setup = {
                        armies: this.createArmyDrafts(),
                        confirmation: null,
                        terrain: null,
                        deployment: null
                    };
                }
                this.state.setup.confirmation = 'new-game';
                this.syncUiFromState();
            },

            startNewGame() {
                this.closeGameSettingsModal(false);
                this.closeStorageModal(false);
                this.nextUnitId = 1;
                this.unitAssetCache = new Map();
                this.state = this.createInitialState();
                this.syncUiFromState();
                this.requestRender();
                return true;
            }
        });
    }

    return { install, SETTINGS_KEY };
}));
