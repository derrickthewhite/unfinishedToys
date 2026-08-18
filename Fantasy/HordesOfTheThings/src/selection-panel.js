(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./data.js'), require('./rules/index.js'));
        return;
    }
    root.HordesSelectionPanel = factory(root.HordesData, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, rules) {
    class SelectionPanelMethods {
        getInspectedDeploymentTrayUnit() {
            if (this.state.setupStage !== 'unit-deployment' || typeof this.getDeploymentSetup !== 'function') {
                return null;
            }
            const deployment = this.getDeploymentSetup();
            if (!deployment?.selectedTrayId) {
                return null;
            }
            const trayEntry = deployment.tray.find((entry) => entry.draftId === deployment.selectedTrayId);
            if (!trayEntry || !data.UNIT_TYPES[trayEntry.type]) {
                return null;
            }
            return data.createUnit(
                trayEntry.type,
                trayEntry.playerId,
                trayEntry.faction,
                { x: 0, y: 0, rotation: 0 },
                () => 'tray-inspect'
            );
        }

        getInspectedUnit() {
            const selectedUnits = this.getSelectedUnits();
            if (selectedUnits.length === 1) {
                return selectedUnits[0];
            }
            if (selectedUnits.length > 1) {
                return null;
            }
            return this.getInspectedDeploymentTrayUnit();
        }

        hostSelectionPanel() {
            const panel = this.ui.selectionPanel;
            if (!panel) {
                return;
            }
            const host = this.state.setupStage === 'unit-deployment'
                ? this.ui.deploymentSelectionHost
                : this.ui.boardShell;
            if (host && panel.parentElement !== host) {
                host.appendChild(panel);
            }
        }

        formatPaces(distanceMm) {
            return Math.round(distanceMm / data.MM_PER_PACE) + 'p';
        }

        getSelectedBattleMarker() {
            if (!this.state.selectedBattleId || typeof this.getBattleStatMarkers !== 'function') {
                return null;
            }
            return this.getBattleStatMarkers().find((marker) => marker.id === this.state.selectedBattleId) || null;
        }

        getSelectedBattleDetails(marker) {
            if (!marker) {
                return [];
            }
            const details = [];
            [marker.active, marker.opponent].forEach((side, index) => {
                const opponent = index === 0 ? marker.opponent : marker.active;
                const playerLabel = this.getPlayerLabel(side.playerId);
                const support = side.unitTypes.filter((_, unitIndex) => side.unitIds[unitIndex] !== side.primaryId);
                details.push({
                    label: `${playerLabel} ${side.primaryType}`,
                    value: `Strength ${side.strength} vs ${opponent.troopClass}${support.length ? `; with ${support.join(', ')}` : ''}`
                });
                if (side.modifiers.length === 0) {
                    details.push({
                        label: `${playerLabel} bonuses`,
                        value: 'None'
                    });
                } else {
                    side.modifiers.forEach((modifier) => {
                        details.push({
                            label: `${playerLabel} ${modifier.label || modifier.id}`,
                            value: modifier.detail
                                ? `${rules.formatSignedModifier(modifier.value)} from ${modifier.detail}`
                                : rules.formatSignedModifier(modifier.value)
                        });
                    });
                }
                details.push({
                    label: `${playerLabel} factor`,
                    value: String(side.factor)
                });
            });
            const delta = marker.relative;
            const leader = delta === 0
                ? 'Even before dice'
                : `${this.getPlayerLabel(delta > 0 ? marker.active.playerId : marker.opponent.playerId)} ${rules.formatSignedModifier(Math.abs(delta))} before dice`;
            details.push({
                label: 'Relative',
                value: leader
            });
            return details;
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
                ? `${this.formatPaces(unit.ranged.range)} range, ${unit.ranged.width || data.SHOOTING_BOX_WIDTH}mm frontage`
                : 'None';
            const details = [
                { label: 'Player', value: this.getPlayerLabel(this.getUnitPlayerId(unit)) },
                { label: 'Class', value: unit.troopClass },
                { label: 'AP', value: String(unit.value) },
                { label: 'Strength', value: `Infantry ${unit.strength.infantry}, Mounted ${unit.strength.mounted}` },
                { label: 'Move', value: movement },
                { label: 'Ranged', value: ranged },
                { label: 'Bad Going', value: unit.combat?.ignoresBadGoingPenalty ? 'Ignores penalty' : 'Normal penalty' }
            ];
            if (rules.isMagicianUnit(unit)) {
                details.push({
                    label: 'Action cost',
                    value: `${rules.getMoveCost(unit)} moves to move, ${rules.getAttackDeclareCost(unit)} to declare an attack`
                });
            }
            if (unit.ensorcelledByUnitId !== undefined) {
                let ensorcellerLabel;
                if (unit.ensorcelledByUnitId === null) {
                    ensorcellerLabel = 'Self (rolled 1)';
                } else {
                    const ensorceller = this.getUnitById(unit.ensorcelledByUnitId);
                    ensorcellerLabel = ensorceller
                        ? `${ensorceller.type} (${this.getPlayerLabel(this.getUnitPlayerId(ensorceller))})`
                        : 'Unknown (destroyed or in reserve)';
                }
                details.push({ label: 'Ensorcelled by', value: ensorcellerLabel });
            }
            return details;
        }

        renderSelectionInfo() {
            const selectedUnits = this.getSelectedUnits();
            const battle = this.getSelectedBattleMarker();
            if (this.ui.selectionText) {
                this.ui.selectionText.textContent = battle
                    ? `Battle ${battle.label}`
                    : rules.describeSelection(this.state.selectionAnalysis, selectedUnits, this.state.draft);
            }

            if (!this.ui.selectionPanel) {
                return;
            }

            const unit = battle ? null : this.getInspectedUnit();
            const details = battle ? this.getSelectedBattleDetails(battle) : this.getSelectedUnitDetails(unit);
            const hasContent = Boolean(battle || unit);
            this.ui.selectionPanel.classList.toggle('is-empty', !hasContent);

            if (this.ui.selectionPanelPortrait) {
                this.ui.selectionPanelPortrait.hidden = !unit;
                if (unit && this.ui.selectionPanelPortrait.style?.setProperty) {
                    const colors = this.getPlayerColors(this.getUnitPlayerId(unit));
                    this.ui.selectionPanelPortrait.style.setProperty('--player-fill', colors.fill);
                    this.ui.selectionPanelPortrait.style.setProperty('--player-stroke', colors.stroke);
                    this.ui.selectionPanelPortrait.style.setProperty('--unit-depth', String(unit.depth || data.UNIT_WIDTH));
                }
            }
            if (this.ui.selectionPanelAsset) {
                const assetPath = unit && typeof this.getUnitAssetPath === 'function'
                    ? this.getUnitAssetPath(unit)
                    : null;
                this.ui.selectionPanelAsset.hidden = !assetPath;
                if (assetPath) {
                    this.ui.selectionPanelAsset.src = assetPath;
                    this.ui.selectionPanelAsset.alt = unit.type;
                } else {
                    this.ui.selectionPanelAsset.removeAttribute?.('src');
                    this.ui.selectionPanelAsset.alt = '';
                }
            }
            if (this.ui.selectionPanelEyebrow) {
                this.ui.selectionPanelEyebrow.textContent = battle
                    ? 'Battle stats'
                    : (unit ? this.getPlayerLabel(this.getUnitPlayerId(unit)) + ' unit' : 'Selection');
            }
            if (this.ui.selectionPanelTitle) {
                this.ui.selectionPanelTitle.textContent = battle
                    ? `${this.getPlayerLabel(battle.active.playerId)} ${battle.label}`
                    : (unit ? unit.type : 'No unit selected');
            }
            if (this.ui.selectionPanelHint) {
                this.ui.selectionPanelHint.textContent = battle
                    ? 'Factors before dice. Active side listed first. Click another marker or a unit to change the inspect target.'
                    : (unit
                        ? `${unit.width}mm frontage, ${unit.depth}mm depth.`
                        : 'Select a single unit to inspect its stats.');
            }
            if (this.ui.selectionPanelStats) {
                this.ui.selectionPanelStats.hidden = !hasContent;
                this.ui.selectionPanelStats.innerHTML = details.map((entry) => (`
                    <div class="selection-stat">
                        <dt>${entry.label}</dt>
                        <dd>${entry.value}</dd>
                    </div>
                `)).join('');
            }
        }
    }

    function install(SelectionPanelPrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(SelectionPanelMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(SelectionPanelPrototype.prototype, descriptors);
    }

    return { install };
}));
