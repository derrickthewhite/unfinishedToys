(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./data.js'));
        return;
    }
    root.HordesVictory = factory(root.HordesData);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
    const VICTORY_REASONS = Object.freeze({
        'casualty-lead': {
            buildMessage(app, victory) {
                const loserArmy = app.getArmyIdentity(victory.loserPlayerId).label;
                const winnerArmy = app.getArmyIdentity(victory.winnerPlayerId).label;
                return `${loserArmy} has lost more than half its army (${victory.loserLostPoints} of ${victory.loserStartingValue} AP) and more than ${winnerArmy} (${victory.winnerLostPoints} AP lost).`;
            }
        }
    });

    class VictoryMethods {
        isGameOver() {
            return Boolean(this.state.victory);
        }

        captureStartingArmyValues() {
            this.state.startingArmyValueByPlayerId = data.PLAYER_IDS.reduce((values, playerId) => {
                values[playerId] = this.state.units
                    .filter((unit) => this.getUnitPlayerId(unit) === playerId)
                    .reduce((sum, unit) => sum + unit.value, 0);
                return values;
            }, {});
        }

        ensureStartingArmyValues() {
            const existing = this.state.startingArmyValueByPlayerId;
            if (existing && data.PLAYER_IDS.every((playerId) => Number.isFinite(existing[playerId]) && existing[playerId] > 0)) {
                return;
            }
            this.state.startingArmyValueByPlayerId = data.PLAYER_IDS.reduce((values, playerId) => {
                const boardPoints = this.state.units
                    .filter((unit) => this.getUnitPlayerId(unit) === playerId)
                    .reduce((sum, unit) => sum + unit.value, 0);
                const reservePoints = this.getReserveUnits()
                    .filter((unit) => this.getUnitPlayerId(unit) === playerId)
                    .reduce((sum, unit) => sum + unit.value, 0);
                const lostPoints = (this.state.losses[playerId] || [])
                    .reduce((sum, entry) => sum + entry.value, 0);
                values[playerId] = boardPoints + reservePoints + lostPoints;
                return values;
            }, {});
        }

        getRepresentativeUnit(playerId) {
            const faction = this.getPlayer(playerId)?.faction || null;
            const candidates = [];
            const addCandidate = (unit, sourceRank) => {
                if (!unit?.type) {
                    return;
                }
                candidates.push({
                    id: unit.id,
                    type: unit.type,
                    value: unit.value,
                    faction: unit.faction || faction,
                    sourceRank
                });
            };
            this.state.units
                .filter((unit) => this.getUnitPlayerId(unit) === playerId)
                .forEach((unit) => addCandidate(unit, 0));
            this.getReserveUnits()
                .filter((unit) => this.getUnitPlayerId(unit) === playerId)
                .forEach((unit) => addCandidate(unit, 1));
            (this.state.losses[playerId] || []).forEach((entry) => addCandidate(entry, 2));
            candidates.sort((left, right) => {
                if (right.value !== left.value) {
                    return right.value - left.value;
                }
                return left.sourceRank - right.sourceRank;
            });
            return candidates[0] || null;
        }

        buildVictorySnapshot(loserPlayerId) {
            const winnerPlayerId = this.getOpponentPlayerId(loserPlayerId);
            const loserLostPoints = this.getLossSummary(loserPlayerId).points;
            const winnerLostPoints = this.getLossSummary(winnerPlayerId).points;
            const loserStartingValue = this.state.startingArmyValueByPlayerId[loserPlayerId];
            const winnerStartingValue = this.state.startingArmyValueByPlayerId[winnerPlayerId];
            return {
                reasonId: 'casualty-lead',
                loserPlayerId,
                winnerPlayerId,
                loserLostPoints,
                winnerLostPoints,
                loserStartingValue,
                winnerStartingValue,
                representatives: {
                    [loserPlayerId]: this.getRepresentativeUnit(loserPlayerId),
                    [winnerPlayerId]: this.getRepresentativeUnit(winnerPlayerId)
                }
            };
        }

        describeVictoryReason(victory) {
            const reason = VICTORY_REASONS[victory.reasonId];
            return reason ? reason.buildMessage(this, victory) : 'Victory achieved.';
        }

        declareVictory(loserPlayerId) {
            if (this.state.victory || this.state.mode !== 'game') {
                return false;
            }
            this.state.victory = this.buildVictorySnapshot(loserPlayerId);
            this.state.victoryModalDismissed = false;
            this.state.confirmation = null;
            this.state.draft = null;
            this.state.selectedIds = [];
            this.state.placingUnit = false;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus(`${this.getArmyIdentity(this.state.victory.winnerPlayerId).label} wins!`);
            return true;
        }

        checkVictoryAtTurnEnd() {
            if (this.state.mode !== 'game' || this.state.victory) {
                return false;
            }
            this.ensureStartingArmyValues();
            for (const playerId of data.PLAYER_IDS) {
                const opponentId = this.getOpponentPlayerId(playerId);
                const lostPoints = this.getLossSummary(playerId).points;
                const opponentLostPoints = this.getLossSummary(opponentId).points;
                const startingValue = this.state.startingArmyValueByPlayerId[playerId];
                if (!Number.isFinite(startingValue) || startingValue <= 0) {
                    continue;
                }
                if (lostPoints >= startingValue / 2 && lostPoints > opponentLostPoints) {
                    return this.declareVictory(playerId);
                }
            }
            return false;
        }

        dismissVictoryModal() {
            if (!this.state.victory) {
                return;
            }
            this.state.victoryModalDismissed = true;
            this.syncUiFromState();
        }

        openVictoryNewGameConfirmation() {
            if (!this.state.victory) {
                return;
            }
            this.state.setup = this.state.setup || {};
            this.state.setup.confirmation = 'new-game';
            this.syncUiFromState();
        }

        renderVictorySide(sideElement, playerId, victory) {
            if (!sideElement) {
                return;
            }
            const colors = this.getPlayerColors(playerId);
            const identity = this.getArmyIdentity(playerId);
            const representative = victory.representatives[playerId];
            const lostPoints = playerId === victory.loserPlayerId ? victory.loserLostPoints : victory.winnerLostPoints;
            const startingValue = playerId === victory.loserPlayerId ? victory.loserStartingValue : victory.winnerStartingValue;
            const role = playerId === victory.winnerPlayerId ? 'Victor' : 'Defeated';
            sideElement.style.setProperty('--player-fill', colors.fill);
            sideElement.style.setProperty('--player-stroke', colors.stroke);
            sideElement.classList.toggle('is-winner', playerId === victory.winnerPlayerId);
            sideElement.classList.toggle('is-loser', playerId === victory.loserPlayerId);
            const portrait = sideElement.querySelector('.victory-side-portrait');
            const asset = sideElement.querySelector('.victory-side-asset');
            const eyebrow = sideElement.querySelector('.victory-side-eyebrow');
            const colorLabel = sideElement.querySelector('.victory-side-color');
            const title = sideElement.querySelector('.victory-side-title');
            const losses = sideElement.querySelector('.victory-side-losses');
            if (portrait && representative && data.UNIT_TYPES[representative.type]) {
                portrait.style.setProperty('--unit-depth', String(data.UNIT_TYPES[representative.type].depth || data.UNIT_WIDTH));
            }
            if (asset) {
                const assetPath = representative ? this.getUnitAssetPath(representative) : null;
                asset.hidden = !assetPath;
                if (assetPath) {
                    asset.src = assetPath;
                    asset.alt = identity.label;
                } else {
                    asset.removeAttribute('src');
                    asset.alt = '';
                }
            }
            if (eyebrow) {
                eyebrow.textContent = role;
            }
            if (colorLabel) {
                colorLabel.textContent = identity.colorLabel;
            }
            if (title) {
                title.textContent = identity.faction || 'Army';
            }
            if (losses) {
                losses.textContent = `${lostPoints} of ${startingValue} AP lost`;
            }
        }

        renderVictoryModal() {
            const victory = this.state.victory;
            if (!this.ui.victoryModal) {
                return;
            }
            const showModal = Boolean(victory) && !this.state.victoryModalDismissed;
            this.ui.victoryModal.hidden = !showModal;
            if (!victory) {
                return;
            }
            if (this.ui.victoryTitle) {
                this.ui.victoryTitle.textContent = `${this.getArmyIdentity(victory.winnerPlayerId).label} Wins`;
            }
            if (this.ui.victorySubtitle) {
                this.ui.victorySubtitle.textContent = 'The field is theirs.';
            }
            if (this.ui.victoryReason) {
                this.ui.victoryReason.textContent = this.describeVictoryReason(victory);
            }
            this.renderVictorySide(this.ui.victoryWinnerSide, victory.winnerPlayerId, victory);
            this.renderVictorySide(this.ui.victoryLoserSide, victory.loserPlayerId, victory);
        }
    }

    function install(VictoryPrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(VictoryMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(VictoryPrototype.prototype, descriptors);
    }

    return { install, VICTORY_REASONS };
}));
