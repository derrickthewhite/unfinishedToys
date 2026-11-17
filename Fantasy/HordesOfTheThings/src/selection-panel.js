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

        formatMm(distanceMm) {
            return `${Math.round(distanceMm)} mm`;
        }

        escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        statTip(label, tip) {
            const text = this.escapeHtml(label);
            if (!tip) {
                return text;
            }
            return `<span class="stat-tip" data-tip="${this.escapeHtml(tip)}" tabindex="0">${text}</span>`;
        }

        joinStatItems(items) {
            return items.map((item) => this.statTip(item.label, item.note)).join(', ');
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
                const mods = side.modifiers.length
                    ? side.modifiers.map((modifier) => (
                        modifier.detail
                            ? `${rules.formatSignedModifier(modifier.value)} ${modifier.label || modifier.id} from ${modifier.detail}`
                            : `${rules.formatSignedModifier(modifier.value)} ${modifier.label || modifier.id}`
                    )).join('; ')
                    : 'no bonuses';
                details.push(this.escapeHtml(
                    `${playerLabel} ${side.primaryType} · ${side.strength} vs ${opponent.troopClass}`
                    + `${support.length ? ` with ${support.join(', ')}` : ''} · factor ${side.factor} · ${mods}`
                ));
            });
            const delta = marker.relative;
            details.push(this.escapeHtml(delta === 0
                ? 'Even before dice'
                : `${this.getPlayerLabel(delta > 0 ? marker.active.playerId : marker.opponent.playerId)} ${rules.formatSignedModifier(Math.abs(delta))} before dice`));
            return details;
        }

        getSelectedUnitTags(unit) {
            const tags = [];
            if (rules.isMagicianUnit(unit)) {
                tags.push({
                    label: 'Ensorcellment',
                    note: 'Self-ensorcels on a shooting roll of 1. Ensorcelled units may return to the battlefield for 6 PIPs.'
                });
            }
            const moveCost = rules.getMoveCost(unit);
            if (Number.isFinite(moveCost) && moveCost > 1) {
                tags.push({
                    label: `${moveCost} PIP move`,
                    note: `This unit requires ${moveCost} PIPs for each move.`
                });
            }
            if (unit.combat?.ignoresBadGoingPenalty) {
                tags.push({
                    label: 'Ignores bad going',
                    note: 'No −2 combat penalty in forest or swamp.'
                });
            }
            if (unit.movement?.ignoresTerrain) {
                tags.push({
                    label: 'Ignores terrain',
                    note: 'Moves through all terrain, including water and impassable.'
                });
            }
            if (unit.movement?.ignoresUnitsWhenUnengaged) {
                tags.push({
                    label: 'Non-blocking',
                    note: 'Unengaged, this Flyer and other units may overlap.'
                });
            }
            if (data.RESERVE_RECYCLE_TYPES.includes(unit.type)) {
                tags.push({
                    label: 'Returns to reserve',
                    note: 'Destroyed Hordes go to reserve and may redeploy from the home edge.'
                });
            }
            if (data.isLurkerType(unit.type)) {
                tags.push({
                    label: 'Lurker',
                    note: 'Starts in reserve. Ambush an enemy that entered forest or swamp, then stay in bad going. A minor loss or isolation at 600 paces sends them back to reserve.'
                });
            }
            if (unit.type === 'Spear' || unit.type === 'Warband') {
                tags.push({
                    label: 'Can stack',
                    note: 'Two same-type elements can stack for +1 in melee.'
                });
            }
            if (unit.combat?.stationary) {
                tags.push({
                    label: 'Stationary',
                    note: 'This unit cannot move.'
                });
            }
            if (unit.combat?.lossEndsGame) {
                tags.push({
                    label: 'Loss ends the battle',
                    note: 'If this base loses a conflict, its army loses immediately.'
                });
            }
            return tags;
        }

        formatTroopClass(troopClass) {
            if (!troopClass) {
                return '';
            }
            return troopClass.charAt(0).toUpperCase() + troopClass.slice(1);
        }

        selectionMoveCell(label, distanceMm, tip) {
            return `
                <div class="selection-move-cell">
                    <span class="selection-move-label">${this.escapeHtml(label)}</span>
                    ${this.statTip(this.formatPaces(distanceMm), tip)}
                </div>`;
        }

        selectionMatchupRow(kind, label, items) {
            const body = items.length ? this.joinStatItems(items) : '—';
            return `
                <div class="selection-matchup-row ${kind}">
                    <span class="selection-matchup-label">${this.escapeHtml(label)}</span>
                    <span>${body}</span>
                </div>`;
        }

        getSelectedUnitDetails(unit) {
            if (!unit) {
                return '';
            }
            const troopClass = this.formatTroopClass(unit.troopClass);
            const combat = unit.strength
                ? `${this.statTip(`+${unit.strength.infantry}`, 'vs infantry')} / ${this.statTip(`+${unit.strength.mounted}`, 'vs mounted')}`
                : '';
            let rangeRow = '';
            if (unit.ranged) {
                const range = this.formatPaces(unit.ranged.range);
                if (unit.ranged.magician) {
                    rangeRow = `
                        <div class="selection-combat-row">
                            <span>Range</span>
                            <span class="selection-combat-val">${this.statTip(range, 'Casters may target in any direction. Costs 2 PIPs to shoot.')} caster</span>
                        </div>`;
                } else {
                    const width = unit.ranged.width || data.SHOOTING_BOX_WIDTH;
                    const shotTip = unit.ranged.requiresStationary
                        ? `Own turn only, and only if it did not move. ${width}mm firing box.`
                        : `${width}mm firing box. Shooters may fire in each shooting phase.`;
                    rangeRow = `
                        <div class="selection-combat-row">
                            <span>Range</span>
                            <span class="selection-combat-val">${this.statTip(range, shotTip)}</span>
                        </div>`;
                }
            }
            const moveGrid = unit.combat?.stationary || !unit.moves
                ? '<div class="selection-stationary">Stationary</div>'
                : `<div class="selection-move-grid">
                    ${this.selectionMoveCell('Road', unit.moves.road, `on roads, ${this.formatMm(unit.moves.road)}`)}
                    ${this.selectionMoveCell('Good', unit.moves.good, `on good going, ${this.formatMm(unit.moves.good)}`)}
                    ${this.selectionMoveCell('Bad', unit.moves.bad, `on bad going, ${this.formatMm(unit.moves.bad)}`)}
                    ${this.selectionMoveCell('Water', unit.moves.water, `in water, ${this.formatMm(unit.moves.water)}`)}
                </div>`;
            const quick = rules.getTypeQuickKillInfo(unit.type);
            const tags = this.getSelectedUnitTags(unit);
            let extra = '';
            if (tags.length) {
                extra += this.selectionMatchupRow('tags', 'Tags:', tags);
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
                extra += this.selectionMatchupRow('killed', 'Ensorcelled by', [{ label: ensorcellerLabel, note: '' }]);
            }
            return `
                <div class="selection-meta">
                    <span>${this.statTip(`${unit.width}mm`, 'width')} × ${this.statTip(`${unit.depth}mm`, 'depth')}</span>
                    <span>${this.statTip(troopClass, 'class')}</span>
                </div>
                <div class="selection-stats-box">
                    <div class="selection-combat-row">
                        <span>Combat Factor</span>
                        <span class="selection-combat-val">${combat}</span>
                    </div>
                    ${rangeRow}
                    ${moveGrid}
                </div>
                <div class="selection-matchups">
                    ${this.selectionMatchupRow('kills', 'Quick Kills:', quick.kills)}
                    ${this.selectionMatchupRow('killed', 'Quick Killed:', quick.killed)}
                    ${extra}
                </div>`;
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
            const hasContent = Boolean(battle || unit);
            this.ui.selectionPanel.classList.toggle('is-empty', !hasContent);
            this.ui.selectionPanel.classList.toggle('is-battle', Boolean(battle));

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
                    : (unit ? `${this.getPlayerLabel(this.getUnitPlayerId(unit))} Unit` : 'Selection');
            }
            if (this.ui.selectionPanelTitle) {
                this.ui.selectionPanelTitle.textContent = battle
                    ? `${this.getPlayerLabel(battle.active.playerId)} ${battle.label}`
                    : (unit ? unit.type : 'No unit selected');
            }
            if (this.ui.selectionPanelAp) {
                this.ui.selectionPanelAp.hidden = !unit;
                this.ui.selectionPanelAp.innerHTML = unit
                    ? this.statTip(`${unit.value} AP`, 'army points')
                    : '';
            }
            if (this.ui.selectionPanelHint) {
                this.ui.selectionPanelHint.hidden = Boolean(unit);
                this.ui.selectionPanelHint.textContent = battle
                    ? 'Factors before dice. Active side listed first. Click another marker or a unit to change the inspect target.'
                    : (unit ? '' : 'Select a single unit to inspect its stats.');
            }
            if (this.ui.selectionPanelStats) {
                this.ui.selectionPanelStats.hidden = !hasContent;
                if (battle) {
                    this.ui.selectionPanelStats.innerHTML = this.getSelectedBattleDetails(battle).map((entry) => (
                        `<p class="selection-stat-line">${entry}</p>`
                    )).join('');
                } else if (unit) {
                    this.ui.selectionPanelStats.innerHTML = this.getSelectedUnitDetails(unit);
                } else {
                    this.ui.selectionPanelStats.innerHTML = '';
                }
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
