(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../data.js'));
        return;
    }
    root.HordesArmyBuilder = factory(root.HordesData);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
    function install(ArmyPrototype) {
        Object.assign(ArmyPrototype.prototype, {
            getArmyDraft(playerId) {
                return this.state.setup?.armies?.[playerId] || { counts: {} };
            },

            getArmyValue(playerId) {
                const counts = this.getArmyDraft(playerId).counts;
                return Object.entries(counts).reduce((total, [type, count]) => total + ((data.UNIT_TYPES[type]?.value || 0) * count), 0);
            },

            isArmyRandom(playerId) {
                return Boolean(this.getArmyDraft(playerId).random);
            },

            isArmyValid(playerId) {
                return this.isArmyRandom(playerId) || this.getArmyValue(playerId) === data.ARMY_POINT_TARGET;
            },

            getArmyIdentity(playerId) {
                const player = this.getPlayer(playerId);
                const colorId = player?.colorId || 'blue';
                const randomColor = colorId === data.RANDOM_IDENTITY;
                const colors = randomColor ? data.RANDOM_PLAYER_COLOR : this.getPlayerColors(playerId);
                const faction = player?.faction || '';
                const randomFaction = faction === data.RANDOM_IDENTITY;
                const factionLabel = randomFaction ? 'Random' : faction;
                return {
                    colorId,
                    colorLabel: colors.label,
                    faction,
                    randomColor,
                    randomFaction,
                    label: factionLabel ? `${colors.label} ${factionLabel}` : colors.label
                };
            },

            getArmyIdentityConflict() {
                const playerOne = this.getArmyIdentity('player-1');
                const playerTwo = this.getArmyIdentity('player-2');
                const sameColor = !playerOne.randomColor && !playerTwo.randomColor && playerOne.colorId === playerTwo.colorId;
                const sameFaction = !playerOne.randomFaction
                    && !playerTwo.randomFaction
                    && Boolean(playerOne.faction)
                    && playerOne.faction === playerTwo.faction;
                if (sameColor && sameFaction) {
                    return 'Each army needs its own color and faction.';
                }
                if (sameColor) {
                    return 'Each army needs its own color.';
                }
                if (sameFaction) {
                    return 'Each army needs its own faction.';
                }
                return null;
            },

            canAcceptArmies() {
                return !this.getArmyIdentityConflict()
                    && data.PLAYER_IDS.every((playerId) => this.isArmyValid(playerId));
            },

            getAllowedUnitTypes(playerId) {
                const types = Object.keys(data.UNIT_TYPES);
                if (!this.areFactionRostersLimited()) {
                    return types;
                }
                const faction = this.getPlayer(playerId)?.faction;
                if (!faction || faction === data.RANDOM_IDENTITY) {
                    return types;
                }
                const roster = data.FACTION_ROSTERS[faction] || [];
                return types.filter((type) => roster.includes(type));
            },

            pruneArmyToAllowedTypes(playerId) {
                const allowed = new Set(this.getAllowedUnitTypes(playerId));
                const counts = this.getArmyDraft(playerId).counts;
                Object.keys(counts).forEach((type) => {
                    if (!allowed.has(type)) {
                        delete counts[type];
                    }
                });
            },

            pruneArmiesToAllowedTypes() {
                data.PLAYER_IDS.forEach((playerId) => this.pruneArmyToAllowedTypes(playerId));
            },

            adjustArmyUnit(playerId, type, delta) {
                if (this.isArmyRandom(playerId)) {
                return;
            }
            if (this.state.setupStage === 'army-builder'
                    && delta > 0
                    && !this.getAllowedUnitTypes(playerId).includes(type)) {
                    return;
                }
                const draft = this.getArmyDraft(playerId);
                const current = draft.counts[type] || 0;
                const next = Math.max(0, current + delta);
                if (next === current) {
                    return;
                }
                draft.counts[type] = next;
                this.syncUiFromState();
            },

            updateArmyPlayer(playerId, property, value) {
                if (property === 'controller') {
                    this.state.players[playerId].controller = data.normalizeController(value);
                    this.syncUiFromState();
                    return;
                }
                if (property !== 'colorId' && property !== 'faction') {
                    return;
                }
                this.state.players[playerId][property] = value;
                if (property === 'faction' && value !== data.RANDOM_IDENTITY) {
                    this.pruneArmyToAllowedTypes(playerId);
                }
                this.syncUiFromState();
            },

            setArmyRandom(playerId, random) {
                const draft = this.getArmyDraft(playerId);
                draft.random = Boolean(random);
                this.syncUiFromState();
            },

            pickRandomDistinct(options, blocked, random) {
                const eligible = options.filter((option) => option !== blocked);
                const pool = eligible.length > 0 ? eligible : options;
                return pool[Math.floor(random() * pool.length)] || pool[0] || null;
            },

            resolveRandomArmySetup(random = Math.random) {
                data.PLAYER_IDS.forEach((playerId) => {
                    const player = this.state.players[playerId];
                    const opponent = this.getPlayer(this.getOpponentPlayerId(playerId));
                    if (player.colorId === data.RANDOM_IDENTITY) {
                        const blocked = opponent?.colorId !== data.RANDOM_IDENTITY ? opponent?.colorId : null;
                        player.colorId = this.pickRandomDistinct(Object.keys(data.PLAYER_COLORS), blocked, random)
                            || player.colorId;
                    }
                    if (player.faction === data.RANDOM_IDENTITY) {
                        const blocked = opponent?.faction !== data.RANDOM_IDENTITY ? opponent?.faction : null;
                        player.faction = this.pickRandomDistinct([...data.FACTIONS], blocked, random)
                            || player.faction;
                        this.pruneArmyToAllowedTypes(playerId);
                    }
                });
                data.PLAYER_IDS.forEach((playerId) => {
                    if (!this.isArmyRandom(playerId)) {
                        return;
                    }
                    this.chooseRandomArmy(playerId, random);
                    this.getArmyDraft(playerId).random = false;
                });
            },

            chooseRandomArmy(playerId, random = Math.random) {
                this.getArmyDraft(playerId).random = false;
                const templates = this.getAllowedUnitTypes(playerId)
                    .map((type) => [type, data.UNIT_TYPES[type]])
                    .filter(([, unit]) => unit);
                let counts = {};
                for (let attempt = 0; attempt < 40; attempt += 1) {
                    counts = {};
                    let remaining = data.ARMY_POINT_TARGET;
                    let stuck = false;
                    while (remaining > 0) {
                        const eligible = templates.filter(([, unit]) => unit.value <= remaining);
                        if (eligible.length === 0) {
                            stuck = true;
                            break;
                        }
                        const [type, unit] = eligible[Math.floor(random() * eligible.length)];
                        counts[type] = (counts[type] || 0) + 1;
                        remaining -= unit.value;
                    }
                    if (!stuck) {
                        break;
                    }
                }
                this.getArmyDraft(playerId).counts = counts;
                this.updateStatus(`${this.getArmyIdentity(playerId).label} received a random 24 AP army.`);
            },

            randomizeArmyPresentation(playerId, random = Math.random) {
                const opponent = this.getPlayer(this.getOpponentPlayerId(playerId));
                const colorIds = Object.keys(data.PLAYER_COLORS).filter((colorId) => colorId !== opponent?.colorId);
                const factions = data.FACTIONS.filter((faction) => faction !== opponent?.faction);
                this.state.players[playerId].colorId = colorIds[Math.floor(random() * colorIds.length)] || this.state.players[playerId].colorId;
                this.state.players[playerId].faction = factions[Math.floor(random() * factions.length)] || this.state.players[playerId].faction;
                this.syncUiFromState();
            },

            clearArmy(playerId) {
                this.getArmyDraft(playerId).counts = {};
                this.getArmyDraft(playerId).random = false;
                this.updateStatus(`${this.getArmyIdentity(playerId).label}'s army was cleared.`);
            },

            renderArmyBuilder() {
                if (!this.ui.armyColumns) {
                    return;
                }
                this.ui.armyColumns.innerHTML = data.PLAYER_IDS.map((playerId, playerIndex) => {
                    const player = this.getPlayer(playerId);
                    const colors = this.getPlayerColors(playerId);
                    const value = this.getArmyValue(playerId);
                    const randomArmy = this.isArmyRandom(playerId);
                    const valueClass = randomArmy
                        ? 'is-exact'
                        : (value === data.ARMY_POINT_TARGET ? 'is-exact' : (value > data.ARMY_POINT_TARGET ? 'is-over' : 'is-under'));
                    const opponent = this.getPlayer(this.getOpponentPlayerId(playerId));
                    const controller = data.normalizeController(player.controller);
                    const controllerOptions = `
                        <option value="local"${controller === 'local' ? ' selected' : ''}>Local</option>
                        <option value="computer"${controller === 'computer' ? ' selected' : ''}>Computer</option>
                        <option value="remote" disabled>Online (later)</option>`;
                    const colorOptions = [
                        `<option value="${data.RANDOM_IDENTITY}"${player.colorId === data.RANDOM_IDENTITY ? ' selected' : ''}>Random</option>`,
                        ...Object.entries(data.PLAYER_COLORS).map(([colorId, color]) => (
                            `<option value="${colorId}"${colorId === player.colorId ? ' selected' : ''}${colorId === opponent?.colorId && opponent?.colorId !== data.RANDOM_IDENTITY ? ' disabled' : ''}>${color.label}</option>`
                        ))
                    ].join('');
                    const factionOptions = [
                        `<option value="${data.RANDOM_IDENTITY}"${player.faction === data.RANDOM_IDENTITY ? ' selected' : ''}>Random</option>`,
                        ...data.FACTIONS.map((faction) => (
                            `<option value="${faction}"${faction === player.faction ? ' selected' : ''}${faction === opponent?.faction && opponent?.faction !== data.RANDOM_IDENTITY ? ' disabled' : ''}>${faction}</option>`
                        ))
                    ].join('');
                    const previewFaction = player.faction === data.RANDOM_IDENTITY ? data.FACTIONS[0] : player.faction;
                    const rows = this.getAllowedUnitTypes(playerId).map((type) => {
                        const unit = data.UNIT_TYPES[type];
                        const count = this.getArmyDraft(playerId).counts[type] || 0;
                        const assetPath = this.getUnitAssetPath({ type, faction: previewFaction });
                        const disabled = randomArmy ? ' disabled' : '';
                        return `
                            <div class="army-unit-row${randomArmy ? ' is-random' : ''}">
                                <img class="army-unit-preview" src="${assetPath}" alt="${previewFaction} ${type}">
                                <div>
                                    <div class="army-unit-name">${type}</div>
                                    <div class="army-unit-cost">${unit.value} AP</div>
                                </div>
                                <div class="army-count-control" aria-label="${type} count">
                                    <button type="button" data-army-action="decrement" data-player-id="${playerId}" data-unit-type="${type}" aria-label="Remove ${type}"${disabled}>−</button>
                                    <output class="army-count">${count}</output>
                                    <button type="button" data-army-action="increment" data-player-id="${playerId}" data-unit-type="${type}" aria-label="Add ${type}"${disabled}>+</button>
                                </div>
                            </div>`;
                    }).join('');
                    return `
                        <section class="army-player" style="--player-fill: ${colors.fill}; --player-stroke: ${colors.stroke};" aria-labelledby="armyPlayerTitle${playerIndex}">
                            <header class="army-player-header">
                                <div class="army-player-heading">
                                    <h2 id="armyPlayerTitle${playerIndex}">${this.getArmyIdentity(playerId).label}</h2>
                                    <output class="army-total ${valueClass}">${randomArmy ? 'Random' : `${value} / ${data.ARMY_POINT_TARGET} AP`}</output>
                                </div>
                                <div class="army-player-options">
                                    <label>Controlled by
                                        <select data-player-setting="controller" data-player-id="${playerId}">${controllerOptions}</select>
                                    </label>
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
                                <label class="army-random-toggle">
                                    <input type="checkbox" data-army-random-toggle="${playerId}"${randomArmy ? ' checked' : ''}>
                                    Random army
                                </label>
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
                this.ui.armyColumns.querySelectorAll('[data-army-random-toggle]').forEach((checkbox) => {
                    checkbox.addEventListener('change', () => this.setArmyRandom(checkbox.dataset.armyRandomToggle, checkbox.checked));
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
        });
    }

    return { install };
}));
