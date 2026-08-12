(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'));
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

            isArmyValid(playerId) {
                return this.getArmyValue(playerId) === data.ARMY_POINT_TARGET;
            },

            canAcceptArmies() {
                return data.PLAYER_IDS.every((playerId) => this.isArmyValid(playerId));
            },

            adjustArmyUnit(playerId, type, delta) {
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
                if (property !== 'colorId' && property !== 'faction') {
                    return;
                }
                this.state.players[playerId][property] = value;
                this.syncUiFromState();
            },

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
            },

            randomizeArmyPresentation(playerId, random = Math.random) {
                const colorIds = Object.keys(data.PLAYER_COLORS);
                this.state.players[playerId].colorId = colorIds[Math.floor(random() * colorIds.length)];
                this.state.players[playerId].faction = data.FACTIONS[Math.floor(random() * data.FACTIONS.length)];
                this.syncUiFromState();
            },

            clearArmy(playerId) {
                this.getArmyDraft(playerId).counts = {};
                this.updateStatus(`Player ${data.PLAYER_IDS.indexOf(playerId) + 1}'s army was cleared.`);
            },

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
        });
    }

    return { install };
}));
