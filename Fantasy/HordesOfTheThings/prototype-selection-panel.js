(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'), require('./prototype-rules.js'));
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

            const unit = this.getInspectedUnit();
            const details = this.getSelectedUnitDetails(unit);
            this.ui.selectionPanel.classList.toggle('is-empty', !unit);

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
    }

    function install(SelectionPanelPrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(SelectionPanelMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(SelectionPanelPrototype.prototype, descriptors);
    }

    return { install };
}));
