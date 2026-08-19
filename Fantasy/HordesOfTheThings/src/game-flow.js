(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./geometry.js'),
            require('./rules/index.js')
        );
        return;
    }
    root.HordesGameFlow = factory(root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (geometry, rules) {
    class GameFlowMethods {
        stepSingleDraft() {
            const draft = this.state.draft;
            if (!draft || this.state.selectionAnalysis.type !== 'single' || this.isReserveDeployDraft()) {
                return;
            }
            this.evaluateDraft();
            if (draft.invalidIds.size > 0) {
                this.updateStatus('Step is only available for a valid single-unit draft.');
                return;
            }
            const checkpoint = geometry.snapshotPositions(draft.unitIds, this.state.units);
            draft.history.push(checkpoint);
            draft.origin = checkpoint;
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus('Single-unit move stepped.');
        }

        notifyController() {
            if (typeof this.scheduleControllerAction === 'function') {
                this.scheduleControllerAction();
            }
        }

        finishDraft() {
            const draft = this.state.draft;
            if (!draft) {
                return;
            }
            this.evaluateDraft();
            if (draft.invalidIds.size > 0) {
                this.updateStatus('Move is still illegal. Fix highlighted units or cancel the draft.');
                return;
            }
            let moveCost = 1;
            if (draft.kind === 'reserve-deploy') {
                moveCost = 1;
            } else if (draft.kind === 'ensorcelled-return') {
                moveCost = draft.returnCost || 0;
            } else {
                moveCost = rules.getDraftMoveCost(draft.unitIds, this.state.units);
            }
            const movedThisTurnBefore = {};
            draft.unitIds.forEach((unitId) => {
                const unit = this.getUnitById(unitId);
                movedThisTurnBefore[unitId] = Boolean(unit?.movedThisTurn);
            });
            if (!this.state.moveHistory) {
                this.state.moveHistory = [];
            }
            const positionsBefore = {};
            draft.unitIds.forEach((unitId) => {
                if (draft.initialOrigin[unitId]) {
                    positionsBefore[unitId] = { ...draft.initialOrigin[unitId] };
                }
            });
            this.state.moveHistory.push({
                unitIds: [...draft.unitIds],
                positionsBefore,
                movedThisTurnBefore,
                moveCost
            });
            this.state.remainingMoves = Math.max(0, this.state.remainingMoves - moveCost);
            const reserveDeploy = draft.kind === 'reserve-deploy';
            const ensorcelledReturn = draft.kind === 'ensorcelled-return';
            draft.unitIds.forEach((unitId) => {
                const unit = this.getUnitById(unitId);
                const before = draft.initialOrigin[unitId];
                if (!unit) {
                    return;
                }
                if (reserveDeploy || ensorcelledReturn) {
                    unit.movedThisTurn = true;
                    this.clearLossForUnit(unit.id);
                    delete unit.inReserve;
                    delete unit.reserveSlot;
                    if (ensorcelledReturn) {
                        delete unit.ensorcelledByUnitId;
                        delete unit.ensorcelledFrom;
                    }
                    return;
                }
                if (before && this.hasUnitMoved(before, unit)) {
                    unit.movedThisTurn = true;
                }
            });
            this.state.draft = null;
            this.updateSelectionAnalysis();
            if (this.state.phase === 'move' && this.state.remainingMoves === 0) {
                this.beginFormUpPhase();
                return;
            }
            this.syncUiFromState();
            this.updateStatus('Move finished. Remaining moves: ' + this.state.remainingMoves + '.');
            this.notifyController();
        }

        endMovePhase() {
            if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                return;
            }
            // Unused PIPs persist into shooting so Magicians can still declare attacks.
            this.cancelDraft(false);
            this.clearMoveTurnState();
            this.beginFormUpPhase();
        }

        clearMoveTurnState() {
            this.state.moveHistory = [];
            this.state.autoMoveGhost = null;
        }

        undoFinishedMove() {
            const entry = this.state.moveHistory?.pop();
            if (!entry) {
                this.updateStatus('No finished move to undo.');
                return;
            }
            geometry.restoreSnapshot(entry.positionsBefore, this.state.units);
            entry.unitIds.forEach((unitId) => {
                const unit = this.getUnitById(unitId);
                if (!unit) {
                    return;
                }
                unit.movedThisTurn = Boolean(entry.movedThisTurnBefore[unitId]);
            });
            this.state.remainingMoves += entry.moveCost;
            if (this.state.autoMoveGhost && geometry.sameIdSet(this.state.autoMoveGhost.unitIds, entry.unitIds)) {
                this.state.autoMoveGhost = null;
            }
            this.state.selectedIds = [...entry.unitIds];
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus('Last finished move undone.');
        }

        resetMovedFlags(playerId) {
            this.state.units.forEach((unit) => {
                if (!playerId || this.getUnitPlayerId(unit) === playerId) {
                    unit.movedThisTurn = false;
                    unit.attackedThisTurn = false;
                }
            });
        }

        setPhase(phase) {
            if (this.state.phase !== phase) {
                this.state.phase = phase;
                if (phase === 'shooting') {
                    this.initializeShootingPhase();
                } else {
                    this.state.shooting = null;
                }
                if (phase === 'melee') {
                    this.initializeMeleePhase();
                } else {
                    this.state.melee = null;
                }
                if (phase !== 'shooting' && phase !== 'melee') {
                    this.state.combatResolution = null;
                }
                return;
            }
            this.state.phase = phase;
        }

        initializeShootingPhase() {
            this.state.shooting = {
                focusedAttackerId: null,
                validTargetIds: [],
                attacksByAttacker: {}
            };
            this.state.computerShotsDeclared = {
                'player-1': false,
                'player-2': false
            };
        }

        getShootingState() {
            if (!this.state.shooting) {
                this.initializeShootingPhase();
            }
            return this.state.shooting;
        }

        initializeMeleePhase() {
            const melee = rules.detectMeleeCombats(this.state.units, this.state.terrain);
            this.state.melee = {
                combats: melee.combats,
                combatants: melee.combatants,
                participantIds: melee.participantIds
            };
        }

        canDeclareShootingAttack(unit) {
            if (!unit || this.state.mode !== 'game') {
                return false;
            }
            const declareCost = rules.getAttackDeclareCost(unit);
            if (declareCost > 0 && this.state.remainingMoves < declareCost) {
                return false;
            }
            return rules.canUnitShoot(unit, this.state.activePlayerId)
                && rules.getValidShootingTargets(unit, this.state.units, this.state.terrain, this.state.activePlayerId).length > 0;
        }

        hasAnyShootingAttacks() {
            return this.state.units.some((unit) => this.canDeclareShootingAttack(unit));
        }

        hasUndeclaredShootingAttacks() {
            return this.state.units.some((unit) => this.needsShootingDeclaration(unit));
        }

        hasUndeclaredLocalShootingAttacks() {
            return this.state.units.some((unit) => (
                this.needsShootingDeclaration(unit)
                && (typeof this.canLocallyControl !== 'function' || this.canLocallyControl(this.getUnitPlayerId(unit)))
            ));
        }

        advanceToNextTurn() {
            this.state.formUp = null;
            this.state.shooting = null;
            this.state.melee = null;
            this.state.combatResolution = null;
            this.state.selectedIds = [];
            if (this.checkVictoryAtTurnEnd()) {
                this.syncUiFromState();
                return;
            }
            this.state.activePlayerId = this.getOpponentPlayerId(this.state.activePlayerId);
            this.state.remainingMoves = this.rollDie();
            this.clearMoveTurnState();
            this.resetMovedFlags(this.state.activePlayerId);
            this.setPhase('move');
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(`Turn passes to ${this.getPlayerLabel(this.state.activePlayerId)}. ${this.state.remainingMoves} moves available.`);
            this.notifyController();
        }

        maybeAutoAdvanceCombatPhase() {
            if (this.isGameOver() || this.state.mode !== 'game' || this.state.combatResolution) {
                return false;
            }
            if (this.state.phase === 'shooting' && !this.hasAnyShootingAttacks()) {
                this.state.shooting = null;
                this.setPhase('melee');
                if (this.state.phase === 'melee' && this.getMeleeState().combats.length === 0) {
                    this.advanceToNextTurn();
                    return true;
                }
                this.syncUiFromState();
                this.updateStatus('No valid shooting attacks. Advancing to melee.');
                this.notifyController();
                return true;
            }
            if (this.state.phase === 'melee' && this.getMeleeState().combats.length === 0) {
                this.advanceToNextTurn();
                return true;
            }
            return false;
        }

        getMeleeState() {
            if (!this.state.melee) {
                this.initializeMeleePhase();
            }
            return this.state.melee;
        }

        getDeclaredTargetIds() {
            const attacks = this.state.shooting?.attacksByAttacker || {};
            return new Set(Object.values(attacks));
        }

        needsShootingDeclaration(unit) {
            if (this.state.mode !== 'game' || this.state.phase !== 'shooting' || this.state.combatResolution) {
                return false;
            }
            const attacks = this.state.shooting?.attacksByAttacker || {};
            return this.canDeclareShootingAttack(unit) && !attacks[unit.id];
        }

        isUnitShootingParticipant(unit) {
            if (this.state.mode !== 'game' || this.state.phase !== 'shooting') {
                return false;
            }
            if (this.state.combatResolution) {
                return this.state.combatResolution.participantIds.has(unit.id);
            }
            const attacks = this.state.shooting?.attacksByAttacker || {};
            const isAttacker = rules.canUnitShoot(unit, this.state.activePlayerId) && Boolean(attacks[unit.id]);
            const isTarget = Object.values(attacks).includes(unit.id);
            const isPendingTarget = (this.state.shooting?.validTargetIds || []).includes(unit.id);
            const canStillShoot = this.needsShootingDeclaration(unit);
            return isAttacker || isTarget || isPendingTarget || canStillShoot;
        }

        isUnitMeleeParticipant(unit) {
            if (this.state.mode !== 'game' || this.state.phase !== 'melee') {
                return false;
            }
            if (this.state.combatResolution) {
                return this.state.combatResolution.participantIds.has(unit.id);
            }
            return this.getMeleeState().participantIds.has(unit.id);
        }

        isUnitCombatParticipant(unit) {
            if (this.state.phase === 'shooting') {
                return this.isUnitShootingParticipant(unit);
            }
            if (this.state.phase === 'melee') {
                return this.isUnitMeleeParticipant(unit);
            }
            return false;
        }

        handleShootingClick(unit) {
            if (this.state.combatResolution) {
                return;
            }
            const shooting = this.getShootingState();
            if (!unit) {
                shooting.focusedAttackerId = null;
                shooting.validTargetIds = [];
                this.state.selectedIds = [];
                this.syncUiFromState();
                this.requestRender();
                return;
            }
            if (shooting.focusedAttackerId && shooting.validTargetIds.includes(unit.id)) {
                const attacker = this.getUnitById(shooting.focusedAttackerId);
                const declareCost = rules.getAttackDeclareCost(attacker);
                if (declareCost > 0 && this.state.remainingMoves < declareCost) {
                    this.updateStatus(`Declaring a ${attacker.type} attack requires ${declareCost} moves.`);
                    return;
                }
                shooting.attacksByAttacker[shooting.focusedAttackerId] = unit.id;
                if (declareCost > 0) {
                    this.state.remainingMoves = Math.max(0, this.state.remainingMoves - declareCost);
                }
                if (attacker) {
                    attacker.attackedThisTurn = true;
                }
                this.state.selectedIds = [shooting.focusedAttackerId];
                this.syncUiFromState();
                this.requestRender();
                this.updateStatus('Shooting attack declared.');
                return;
            }
            if (rules.isRangedUnit(unit)) {
                if (typeof this.canLocallyControl === 'function' && !this.canLocallyControl(this.getUnitPlayerId(unit))) {
                    this.updateStatus('Only you can declare shooting for your own units.');
                    return;
                }
                if (unit.ranged.requiresOwnTurn && this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                    this.updateStatus('Only the active side can declare shooting attacks.');
                    return;
                }
                if (!rules.canUnitShoot(unit, this.state.activePlayerId)) {
                    shooting.focusedAttackerId = null;
                    shooting.validTargetIds = [];
                    this.state.selectedIds = [];
                    this.syncUiFromState();
                    this.requestRender();
                    const status = rules.isMagicianUnit(unit) && unit.attackedThisTurn
                        ? `${unit.type} has already attacked this turn.`
                        : `${unit.type} cannot shoot after moving this turn.`;
                    this.updateStatus(status);
                    return;
                }
                const declareCost = rules.getAttackDeclareCost(unit);
                if (declareCost > 0 && this.state.remainingMoves < declareCost) {
                    this.updateStatus(`Declaring a ${unit.type} attack requires ${declareCost} moves.`);
                    return;
                }
                const validTargetIds = rules.getValidShootingTargets(unit, this.state.units, this.state.terrain, this.state.activePlayerId);
                if (validTargetIds.length === 0) {
                    shooting.focusedAttackerId = null;
                    shooting.validTargetIds = [];
                    this.state.selectedIds = [];
                    this.syncUiFromState();
                    this.requestRender();
                    this.updateStatus(`${unit.type} cannot shoot while engaged in melee.`);
                    return;
                }
                shooting.focusedAttackerId = unit.id;
                shooting.validTargetIds = validTargetIds;
                this.state.selectedIds = [unit.id];
                this.updateStatus(`${unit.type} selected for shooting.`);
                return;
            }
            if (!shooting.focusedAttackerId) {
                return;
            }
            if (!shooting.validTargetIds.includes(unit.id)) {
                this.updateStatus('That target is not in the selected shooter\'s firing lane.');
                return;
            }
        }

        rollDie() {
            return 1 + Math.floor(Math.random() * 6);
        }

        recordLosses(destroyedUnits) {
            destroyedUnits.forEach((unit) => {
                this.state.losses[this.getUnitPlayerId(unit)].push({ id: unit.id, type: unit.type, value: unit.value });
            });
        }

        buildCombatResolution(snapshot, result, phase) {
            const allIds = Object.keys(snapshot);
            const participantIds = new Set();
            const ghostSnapshot = {};
            const destroyedIds = new Set(result.destroyedUnits.map((unit) => unit.id));
            const ensorcelledIds = new Set((result.ensorcelledUnits || []).map((unit) => unit.id));
            allIds.forEach((unitId) => {
                const before = snapshot[unitId];
                const live = result.units.find((unit) => unit.id === unitId)
                    || result.destroyedUnits.find((unit) => unit.id === unitId)
                    || (result.ensorcelledUnits || []).find((unit) => unit.id === unitId)
                    || null;
                if (destroyedIds.has(unitId) || ensorcelledIds.has(unitId) || !live || this.hasUnitMoved(before, live)) {
                    ghostSnapshot[unitId] = { ...before };
                    participantIds.add(unitId);
                }
            });
            result.results.forEach((entry) => {
                if (phase === 'shooting') {
                    participantIds.add(entry.primaryAttackerId);
                    participantIds.add(entry.defenderId);
                    entry.attackerIds.forEach((attackerId) => participantIds.add(attackerId));
                    return;
                }
                entry.leftUnitIds.forEach((unitId) => participantIds.add(unitId));
                entry.rightUnitIds.forEach((unitId) => participantIds.add(unitId));
            });
            return {
                phase,
                ghostSnapshot,
                destroyedIds,
                recycledUnits: (result.destroyedUnits || []).filter((unit) => this.isReserveRecycleType(unit)),
                ensorcelledUnits: result.ensorcelledUnits || [],
                movedUnitIds: Object.keys(ghostSnapshot),
                results: result.results.map((entry) => ({
                    ...entry,
                    attackerIds: entry.attackerIds ? [...entry.attackerIds] : undefined,
                    leftUnitIds: entry.leftUnitIds ? [...entry.leftUnitIds] : undefined,
                    rightUnitIds: entry.rightUnitIds ? [...entry.rightUnitIds] : undefined
                })),
                participantIds
            };
        }

        logCombatResults(result, phase) {
            if (!result.results.length) {
                console.info(`${phase} resolved with no combats.`);
                return;
            }
            console.groupCollapsed(`${phase} resolution: ${result.results.length} combats`);
            result.results.forEach((entry) => {
                if (phase === 'shooting') {
                    const attackerList = this.describeCombatUnits(result, entry.attackerIds);
                    const defender = this.describeCombatUnits(result, [entry.defenderId]);
                    console.log(
                        `${attackerList} vs ${defender}`
                        + ` | ${this.getCombatSideLabel(result, entry.primaryAttackerId)} roll ${entry.attackerRoll}`
                        + ` | ${this.getCombatSideLabel(result, entry.primaryAttackerId)} modifiers ${this.formatCombatModifiers(entry.attackerModifiers)}`
                        + ` | ${this.getCombatSideLabel(result, entry.defenderId)} roll ${entry.defenderRoll}`
                        + ` | ${this.getCombatSideLabel(result, entry.defenderId)} modifiers ${this.formatCombatModifiers(entry.defenderModifiers)}`
                        + ` | totals ${entry.attackerTotal} vs ${entry.defenderTotal}`
                        + ` | result ${entry.outcome}${entry.loserId ? ` (${this.describeCombatUnits(result, [entry.loserId])})` : ''}`
                        + `${entry.destructionRule ? ` | rule ${entry.destructionRule}` : ''}`
                    );
                    return;
                }
                const leftLabel = this.getCombatSideLabel(result, entry.leftPrimaryId);
                const rightLabel = this.getCombatSideLabel(result, entry.rightPrimaryId);
                console.log(
                    `${this.describeCombatUnits(result, entry.leftUnitIds)} vs ${this.describeCombatUnits(result, entry.rightUnitIds)}`
                    + ` | ${leftLabel} roll ${entry.leftRoll}`
                    + ` | ${leftLabel} modifiers ${this.formatCombatModifiers(entry.leftModifiers)}`
                    + ` | ${rightLabel} roll ${entry.rightRoll}`
                    + ` | ${rightLabel} modifiers ${this.formatCombatModifiers(entry.rightModifiers)}`
                    + ` | totals ${entry.leftTotal} vs ${entry.rightTotal}`
                    + ` | result ${entry.outcome}${entry.loserCombatantId ? ` (${this.describeCombatantById(result, entry.loserCombatantId)})` : ''}`
                    + `${entry.destructionRule ? ` | rule ${entry.destructionRule}` : ''}`
                );
            });
            (result.recoilDestructions || []).forEach((entry) => {
                console.log(`recoil destruction: ${this.describeCombatUnits(result, [entry.unitId])} | reason ${entry.reason}`);
            });
            (result.ensorcelledUnits || []).forEach((unit) => {
                const ensorceller = unit.ensorcelledByUnitId === null
                    ? 'self (rolled 1)'
                    : (this.getCombatUnit(result, unit.ensorcelledByUnitId)
                        ? this.describeCombatUnits(result, [unit.ensorcelledByUnitId])
                        : unit.ensorcelledByUnitId);
                console.log(`ensorcelled: ${this.describeCombatUnits(result, [unit.id])} | ensorcelled by ${ensorceller}`);
            });
            console.groupEnd();
        }

        getCombatUnit(result, unitId) {
            return result.units.find((unit) => unit.id === unitId)
                || result.destroyedUnits.find((unit) => unit.id === unitId)
                || (result.ensorcelledUnits || []).find((unit) => unit.id === unitId)
                || null;
        }

        getCombatSideLabel(result, unitId) {
            const unit = this.getCombatUnit(result, unitId);
            return unit ? this.getPlayerLabel(this.getUnitPlayerId(unit)) : 'unknown';
        }

        describeCombatUnits(result, unitIds) {
            return unitIds
                .map((unitId) => this.getCombatUnit(result, unitId))
                .filter(Boolean)
                .map((unit) => `${this.getPlayerLabel(this.getUnitPlayerId(unit))} ${unit.type} ${unit.id}`)
                .join(', ');
        }

        describeCombatantById(result, combatantId) {
            const entry = result.results.find((combatResult) => combatResult.leftCombatantId === combatantId || combatResult.rightCombatantId === combatantId);
            if (!entry) {
                return combatantId;
            }
            return entry.leftCombatantId === combatantId
                ? this.describeCombatUnits(result, entry.leftUnitIds)
                : this.describeCombatUnits(result, entry.rightUnitIds);
        }

        formatCombatModifiers(modifiers) {
            if (!modifiers || modifiers.length === 0) {
                return 'none';
            }
            return modifiers
                .map((modifier) => `${modifier.id} ${modifier.value >= 0 ? '+' : ''}${modifier.value}`)
                .join(', ');
        }

        skipShootingPhase() {
            this.state.shooting = null;
            this.state.selectedIds = [];
            this.setPhase('melee');
            if (this.maybeAutoAdvanceCombatPhase()) {
                return;
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus('Shooting skipped. Melee phase: resolve all detected combats.');
            this.notifyController();
        }

        openSkipShootingConfirmation() {
            this.state.confirmation = 'skip-shooting';
            this.syncUiFromState();
        }

        resolveShootingPhase(options = {}) {
            if (this.state.mode !== 'game' || this.state.phase !== 'shooting') {
                return;
            }
            if (this.state.combatResolution) {
                return;
            }
            const shooting = this.getShootingState();
            if (this.hasUndeclaredLocalShootingAttacks() && !options.skipUndeclared) {
                this.openSkipShootingConfirmation();
                return;
            }
            this.state.confirmation = null;
            if (Object.keys(shooting.attacksByAttacker || {}).length === 0) {
                this.skipShootingPhase();
                return;
            }
            const snapshot = geometry.snapshotPositions(this.state.units.map((unit) => unit.id), this.state.units);
            const result = rules.resolveShooting(
                this.state.units,
                shooting.attacksByAttacker,
                this.state.terrain,
                () => this.rollDie(),
                this.state.activePlayerId
            );
            this.state.units = result.units;
            this.recordLosses(result.destroyedUnits);
            this.state.combatResolution = this.buildCombatResolution(snapshot, result, 'shooting');
            this.settleEnsorcelledUnits(result.ensorcelledUnits);
            this.logCombatResults(result, 'shooting');
            this.state.selectedIds = [];
            this.state.shooting = null;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            const ensorcelledCount = (result.ensorcelledUnits || []).length;
            const destroyedCount = result.destroyedUnits.length;
            const summary = [];
            if (destroyedCount > 0) {
                summary.push(`${destroyedCount} destroyed`);
            }
            if (ensorcelledCount > 0) {
                summary.push(`${ensorcelledCount} ensorcelled`);
            }
            this.updateStatus(`Shooting resolved${summary.length ? `: ${summary.join(', ')}` : ''}. Review the aftermath, then click Acknowledged.`);
            this.notifyController();
        }

        resolveMeleePhase() {
            if (this.state.mode !== 'game' || this.state.phase !== 'melee' || this.state.combatResolution) {
                return;
            }
            const snapshot = geometry.snapshotPositions(this.state.units.map((unit) => unit.id), this.state.units);
            const result = rules.resolveMelee(this.state.units, this.state.terrain, () => this.rollDie());
            this.state.units = result.units;
            this.recordLosses(result.destroyedUnits);
            this.state.combatResolution = this.buildCombatResolution(snapshot, result, 'melee');
            this.settleEnsorcelledUnits(result.ensorcelledUnits);
            this.logCombatResults(result, 'melee');
            this.state.selectedIds = [];
            this.state.melee = null;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(`Melee resolved: ${result.destroyedUnits.length} units destroyed. Review the aftermath, then click Acknowledged.`);
            this.notifyController();
        }

        getLossSummary(side) {
            const losses = this.state.losses[side] || [];
            const reserveIds = new Set(this.getReserveUnits().map((unit) => unit.id));
            const points = losses.reduce((sum, unit) => sum + unit.value, 0);
            const title = losses.length === 0
                ? 'No losses.'
                : losses.map((unit) => {
                    const suffix = reserveIds.has(unit.id) ? ' in reserve' : '';
                    return `${unit.type} (${unit.value})${suffix}`;
                }).join('\n');
            return { points, title };
        }

        hasUnitMovedThisTurn(unit) {
            return Boolean(unit && unit.movedThisTurn);
        }

        getFormUpPreview() {
            if (this.state.autoMovePreview) {
                const preview = rules.resolveAutomaticFormUp(
                    this.state.autoMovePreview.afterUnits,
                    this.state.activePlayerId,
                    this.state.terrain
                );
                if (preview.movedUnitIds.length > 0) {
                    return preview;
                }
                return {
                    units: this.state.autoMovePreview.afterUnits,
                    movedUnitIds: [...this.state.autoMovePreview.unitIds]
                };
            }
            if (!this.state.showFormUpPreview) {
                return null;
            }
            if (this.state.mode === 'game' && this.state.phase !== 'move') {
                return null;
            }
            const result = rules.resolveAutomaticFormUp(this.state.units, this.state.activePlayerId, this.state.terrain);
            if (!result || result.movedUnitIds.length === 0) {
                return null;
            }
            return result;
        }

        beginFormUpPhase() {
            this.clearMoveTurnState();
            const activeUnits = this.state.units.filter((unit) => this.getUnitPlayerId(unit) === this.state.activePlayerId);
            const activeIds = activeUnits.map((unit) => unit.id);
            const ghostSnapshot = geometry.snapshotPositions(activeIds, this.state.units);
            const result = rules.resolveAutomaticFormUp(this.state.units, this.state.activePlayerId, this.state.terrain);

            this.state.units = result.units;
            const movedUnitIds = new Set(result.movedUnitIds);
            this.state.units.forEach((unit) => {
                if (movedUnitIds.has(unit.id)) {
                    unit.movedThisTurn = true;
                }
            });
            if (result.movedUnitIds.length === 0) {
                this.state.formUp = null;
                this.setPhase('shooting');
                if (this.maybeAutoAdvanceCombatPhase()) {
                    this.notifyController();
                    return;
                }
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus('No units qualified to form up. Advancing to shooting.');
                this.notifyController();
                return;
            }
            this.setPhase('form-up');
            this.state.formUp = {
                ghostSnapshot,
                movedUnitIds: result.movedUnitIds
            };
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            if (result.movedUnitIds.length > 0) {
                this.updateStatus('Form up applied automatically. Review the ghosted original positions, then click Acknowledged.');
                this.notifyController();
                return;
            }
            this.updateStatus('No units qualified to form up. Click Acknowledged to continue to shooting.');
            this.notifyController();
        }

        acknowledgePhase() {
            if (this.state.mode !== 'game') {
                return;
            }
            if (this.state.phase === 'form-up') {
                this.state.formUp = null;
                this.setPhase('shooting');
                if (this.maybeAutoAdvanceCombatPhase()) {
                    this.notifyController();
                    return;
                }
                this.syncUiFromState();
                this.updateStatus('Shooting phase: select a ranged unit, assign valid targets, then resolve shooting.');
                this.notifyController();
                return;
            }
            if (this.state.phase === 'shooting') {
                if (this.state.combatResolution) {
                    this.settleRecycledCasualties();
                    this.state.combatResolution = null;
                    this.setPhase('melee');
                    if (this.maybeAutoAdvanceCombatPhase()) {
                        this.notifyController();
                        return;
                    }
                    this.syncUiFromState();
                    this.updateStatus('Melee phase: resolve all detected combats.');
                    this.notifyController();
                    return;
                }
                this.setPhase('melee');
                if (this.maybeAutoAdvanceCombatPhase()) {
                    this.notifyController();
                    return;
                }
                this.syncUiFromState();
                this.updateStatus('Melee phase: resolve all detected combats.');
                this.notifyController();
                return;
            }
            if (this.state.phase === 'melee' && this.state.combatResolution) {
                this.settleRecycledCasualties();
                this.advanceToNextTurn();
            }
        }

        evaluateDraft() {
            if (!this.state.draft) {
                return;
            }
            if (this.state.draft.kind === 'reserve-deploy') {
                const unit = this.getUnitById(this.state.draft.unitIds[0]);
                const result = this.validateReserveDeploy(unit, this.state.units, this.state.terrain);
                this.state.draft.invalidIds = result.invalid ? new Set(this.state.draft.unitIds) : new Set();
                this.state.draft.reasonById = result.invalid
                    ? new Map([[this.state.draft.unitIds[0], result.reason]])
                    : new Map();
                this.syncUiFromState();
                return;
            }
            if (this.state.draft.kind === 'ensorcelled-return') {
                const unit = this.getUnitById(this.state.draft.unitIds[0]);
                const result = this.validateEnsorcelledReturn(unit, this.state.units, this.state.terrain);
                this.state.draft.invalidIds = result.invalid ? new Set(this.state.draft.unitIds) : new Set();
                this.state.draft.reasonById = result.invalid
                    ? new Map([[this.state.draft.unitIds[0], result.reason]])
                    : new Map();
                this.syncUiFromState();
                return;
            }
            const result = rules.validateDraftState(this.state.draft, this.state.units, this.state.terrain);
            this.state.draft.invalidIds = result.invalidIds;
            this.state.draft.reasonById = result.reasonById;
            this.state.draft.cornerViolations = result.cornerViolations;
            this.syncUiFromState();
        }

        updateSelectionAnalysis() {
            this.state.selectionAnalysis = rules.analyzeSelection(this.getSelectedUnits());
            this.refreshAiEvaluationIfEnabled();
            this.syncUiFromState();
        }

    }

    function install(GameFlowPrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(GameFlowMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(GameFlowPrototype.prototype, descriptors);
    }

    return { install };
}));
