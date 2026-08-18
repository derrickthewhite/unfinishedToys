(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('../rules/index.js'),
            require('../history.js'),
            require('../formation.js')
        );
        return;
    }
    root.HordesBoardDraft = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory, root.HordesFormation);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history, formation) {
    class Methods {
        nudgeSelection(delta) {
            const selectedUnits = this.getSelectedUnits();
            if (selectedUnits.length === 0) {
                return false;
            }
            if (selectedUnits.length === 1 && this.isUnitInReserve(selectedUnits[0].id)) {
                if (!this.beginReserveDeploy(selectedUnits[0])) {
                    return false;
                }
                const unit = this.getUnitById(selectedUnits[0].id);
                if (this.isEnsorcelledLocalReturnDraft()) {
                    unit.x += delta.x;
                    unit.y += delta.y;
                } else {
                    this.applyReserveDraftPose(unit, this.getUnitPlayerId(unit), geometry.getUnitCenter(unit).x + delta.x);
                }
                this.evaluateDraft();
                this.requestRender();
                return true;
            }
            if (this.isEnsorcelledLocalReturnDraft()) {
                const unit = selectedUnits[0];
                unit.x += delta.x;
                unit.y += delta.y;
                this.evaluateDraft();
                this.requestRender();
                this.updateStatus('Draft nudged.');
                return true;
            }
            if (this.isReserveDeployDraft()) {
                const unit = selectedUnits[0];
                this.applyReserveDraftPose(unit, this.getUnitPlayerId(unit), geometry.getUnitCenter(unit).x + delta.x);
                this.evaluateDraft();
                this.requestRender();
                this.updateStatus('Draft nudged.');
                return true;
            }
            if (this.state.mode === 'edit' || this.state.setupStage === 'unit-deployment') {
                const deploymentNudge = this.state.setupStage === 'unit-deployment';
                const nudgeSnapshot = deploymentNudge
                    ? geometry.snapshotPositions(this.state.selectedIds, this.state.units)
                    : null;
                if (!deploymentNudge) {
                    this.recordEditSnapshot(this.createEditSnapshot());
                }
                selectedUnits.forEach((unit) => {
                    unit.x += delta.x;
                    unit.y += delta.y;
                });
                if (deploymentNudge && typeof this.areDeploymentUnitsLegal === 'function'
                    && !this.areDeploymentUnitsLegal(selectedUnits)) {
                    geometry.restoreSnapshot(nudgeSnapshot, this.state.units);
                    this.updateStatus('Invalid move: deployed units must stay on the board, inside the assigned quarter, and cannot overlap.');
                    this.requestRender();
                    return true;
                }
                this.updateSelectionAnalysis();
                this.requestRender();
                this.updateStatus(deploymentNudge ? 'Deployment position updated.' : 'Selection nudged.');
                return true;
            }
            if (this.state.phase !== 'move') {
                return false;
            }
            if (!this.ensureDraft(this.state.selectedIds)) {
                return false;
            }
            selectedUnits.forEach((unit) => {
                unit.x += delta.x;
                unit.y += delta.y;
            });
            this.evaluateDraft();
            if (this.state.selectionAnalysis.type !== 'single') {
                this.commitDraftStep();
            }
            this.updateSelectionAnalysis();
            this.requestRender();
            this.updateStatus('Draft nudged.');
            return true;
        }


        snapSelection(unitIds) {
            if (!this.state.snapEnabled) {
                return;
            }
            const movingUnits = unitIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
            if (movingUnits.length === 0) {
                return;
            }
            const movingIdSet = new Set(unitIds);
            const stationaryUnits = this.state.units.filter((unit) => !movingIdSet.has(unit.id));
            const snapOffset = geometry.findFriendlySnapOffset(movingUnits, stationaryUnits);
            if (!snapOffset) {
                return;
            }
            movingUnits.forEach((unit) => {
                unit.x += snapOffset.x;
                unit.y += snapOffset.y;
            });
        }


        snapProjectedUnits(projectedUnits, unitIds) {
            if (!this.state.snapEnabled) {
                return projectedUnits;
            }
            const movingIdSet = new Set(unitIds);
            const stationaryUnits = this.state.units.filter((unit) => !movingIdSet.has(unit.id));
            const snapOffset = geometry.findFriendlySnapOffset(projectedUnits, stationaryUnits);
            if (!snapOffset) {
                return projectedUnits;
            }
            return projectedUnits.map((unit) => ({
                ...unit,
                x: unit.x + snapOffset.x,
                y: unit.y + snapOffset.y
            }));
        }


        ensureDraft(unitIds) {
            if (this.state.mode !== 'game') {
                return false;
            }
            if (unitIds.length === 1 && this.isUnitInReserve(unitIds[0])) {
                return this.beginReserveDeploy(this.getUnitById(unitIds[0]));
            }
            if (this.state.phase !== 'move') {
                this.updateStatus('Movement is only available during the move phase.');
                return false;
            }
            const selectedUnits = unitIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
            if (selectedUnits.length === 0 || selectedUnits.some((unit) => this.getUnitPlayerId(unit) !== this.state.activePlayerId)) {
                this.updateStatus('Only units on the active side can draft a move.');
                return false;
            }
            if (selectedUnits.some((unit) => unit.movedThisTurn)) {
                this.updateStatus('One or more selected units have already moved this turn.');
                return false;
            }
            if (this.state.remainingMoves <= 0) {
                this.updateStatus('No moves remain for this side.');
                return false;
            }
            const moveCost = rules.getDraftMoveCost(unitIds, this.state.units);
            if (this.state.remainingMoves < moveCost) {
                this.updateStatus(`This move requires ${moveCost} moves.`);
                return false;
            }
            if (this.state.draft && geometry.sameIdSet(this.state.draft.unitIds, unitIds)) {
                return true;
            }
            this.state.draft = {
                unitIds: [...unitIds],
                initialOrigin: geometry.snapshotPositions(unitIds, this.state.units),
                validationOrigin: geometry.snapshotPositions(unitIds, this.state.units),
                origin: geometry.snapshotPositions(unitIds, this.state.units),
                allowSingleRotationFormationEscape: false,
                history: [],
                invalidIds: new Set(),
                reasonById: new Map(),
                cornerViolations: []
            };
            this.evaluateDraft();
            this.syncUiFromState();
            return true;
        }


        commitDraftStep() {
            if (!this.state.draft || this.state.selectionAnalysis.type === 'single') {
                return;
            }
            this.state.draft.history.push(geometry.snapshotPositions(this.state.draft.unitIds, this.state.units));
            this.syncUiFromState();
        }


        undoDraftStep() {
            const draft = this.state.draft;
            if (!draft) {
                return;
            }
            if (this.state.selectionAnalysis.type === 'single') {
                const currentSnapshot = geometry.snapshotPositions(draft.unitIds, this.state.units);
                const unitId = draft.unitIds[0];
                if (geometry.sameFootprint(currentSnapshot[unitId], draft.origin[unitId])) {
                    if (draft.history.length > 0) {
                        draft.history.pop();
                    }
                    const snapshot = draft.history[draft.history.length - 1] || draft.initialOrigin;
                    geometry.restoreSnapshot(snapshot, this.state.units);
                    draft.origin = geometry.snapshotPositions(draft.unitIds, this.state.units);
                } else {
                    geometry.restoreSnapshot(draft.origin, this.state.units);
                }
                this.evaluateDraft();
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus('Draft step undone.');
                return;
            }
            if (draft.history.length > 0) {
                draft.history.pop();
            }
            const snapshot = draft.history[draft.history.length - 1] || draft.initialOrigin;
            geometry.restoreSnapshot(snapshot, this.state.units);
            this.evaluateDraft();
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus('Draft step undone.');
        }


        createEditSnapshot() {
            return history.createEditSnapshot(
                this.state.units,
                this.state.selectedIds,
                this.nextUnitId,
                this.state.losses,
                this.getReserveUnits()
            );
        }


        recordEditSnapshot(snapshot) {
            if (!snapshot) {
                return;
            }
            this.state.editHistory.push(snapshot);
            this.syncUiFromState();
        }


        undoEditStep() {
            const snapshot = this.state.editHistory.pop();
            if (!snapshot) {
                this.updateStatus('No edit action to undo.');
                return;
            }
            const restored = history.restoreEditSnapshot(snapshot);
            this.state.units = restored.units;
            this.state.selectedIds = restored.selectedIds;
            this.nextUnitId = restored.nextUnitId;
            if (restored.losses) {
                this.state.losses = restored.losses;
            }
            this.state.reserveUnits = restored.reserveUnits || [];
            this.state.placingUnit = false;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus('Edit action undone.');
        }


        isUnitAlreadyLost(unitId) {
            return data.PLAYER_IDS.some((playerId) => (
                (this.state.losses[playerId] || []).some((entry) => entry.id === unitId)
            ));
        }


        removeSelectedUnits(options = {}) {
            const countAsLoss = Boolean(options.countAsLoss);
            if (this.state.mode !== 'edit') {
                return false;
            }
            const selected = this.getSelectedUnits();
            if (selected.length === 0) {
                this.updateStatus('Select one or more units to remove.');
                return false;
            }
            if (typeof this.isGameOver === 'function' && this.isGameOver()) {
                this.updateStatus('The battle is over.');
                return false;
            }

            this.recordEditSnapshot(this.createEditSnapshot());

            const removedIds = new Set(selected.map((unit) => unit.id));
            const unitsToRecordLoss = [];

            selected.forEach((unit) => {
                if (this.isUnitInReserve(unit.id)) {
                    this.state.reserveUnits = this.getReserveUnits().filter((entry) => entry.id !== unit.id);
                }
                if (countAsLoss) {
                    if (!this.isUnitAlreadyLost(unit.id)) {
                        unitsToRecordLoss.push(unit);
                    }
                } else {
                    this.clearLossForUnit(unit.id);
                }
            });

            this.state.units = this.state.units.filter((unit) => !removedIds.has(unit.id));

            if (countAsLoss && unitsToRecordLoss.length > 0) {
                this.recordLosses(unitsToRecordLoss);
            }

            this.state.selectedIds = [];
            this.state.placingUnit = false;
            this.cancelDraft(false);
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus(`${countAsLoss ? 'Destroyed' : 'Removed'} ${removedIds.size} unit(s).`);
            return true;
        }


        cancelDraft(showStatus) {
            if (!this.state.draft) {
                this.syncUiFromState();
                return;
            }
            if (this.isReserveDeployDraft()) {
                const draftKind = this.state.draft.kind;
                this.restoreReserveDeploy(this.state.draft);
                this.state.draft = null;
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.requestRender();
                if (showStatus) {
                    this.updateStatus(draftKind === 'ensorcelled-return'
                        ? 'Ensorcelled return cancelled.'
                        : 'Reserve deployment cancelled.');
                }
                return;
            }
            geometry.restoreSnapshot(this.state.draft.initialOrigin, this.state.units);
            this.state.draft = null;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            if (showStatus) {
                this.updateStatus('Draft cancelled and original position restored.');
            }
        }
    }

    function install(BoardInteractionPrototype) {
        const mixinDescriptors = Object.getOwnPropertyDescriptors(Methods.prototype);
        delete mixinDescriptors.constructor;
        Object.defineProperties(BoardInteractionPrototype.prototype, mixinDescriptors);
    }

    return { install };
}));
