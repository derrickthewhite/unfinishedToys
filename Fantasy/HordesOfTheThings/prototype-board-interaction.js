(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js'),
            require('./prototype-history.js')
        );
        return;
    }
    root.HordesBoardInteraction = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history) {
    const INTERACTION_METHOD_NAMES = Object.freeze([
        'nudgeSelection',
        'snapSelection',
        'snapProjectedUnits',
        'screenToWorld',
        'worldToScreen',
        'zoomAt',
        'onPointerDown',
        'beginRotationInteraction',
        'applyProjectedRankUnits',
        'onPointerMove',
        'onPointerUp',
        'handleClick',
        'placeUnit',
        'toggleSelection',
        'clearSelection',
        'applyMarqueeSelection',
        'pickUnit',
        'getHandleHit',
        'getSelectionHandles',
        'getFormationCenterInfo',
        'getFormationReverseHandle',
        'getFormationConvertHandle',
        'applyReverseSelection',
        'buildCenteredLinearOffsets',
        'getUnitFrontCenter',
        'getUnitSideCenter',
        'buildFileFromSide',
        'buildRankFromLead',
        'estimateConvertedFormationTravel',
        'buildConvertedFormationCandidates',
        'applyConvertSelection',
        'ensureDraft',
        'commitDraftStep',
        'undoDraftStep',
        'createEditSnapshot',
        'recordEditSnapshot',
        'undoEditStep',
        'cancelDraft'
    ]);

    class BoardInteractionMethods {
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

        screenToWorld(screenX, screenY) {
            const rect = this.canvas.getBoundingClientRect();
            const localX = screenX - rect.left;
            const localY = screenY - rect.top;
            return {
                x: (localX - rect.width / 2) / this.state.camera.scale + this.state.camera.x,
                y: (localY - rect.height / 2) / this.state.camera.scale + this.state.camera.y
            };
        }

        worldToScreen(worldX, worldY) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (worldX - this.state.camera.x) * this.state.camera.scale + rect.width / 2,
                y: (worldY - this.state.camera.y) * this.state.camera.scale + rect.height / 2
            };
        }

        zoomAt(screenX, screenY, factor) {
            const rect = this.canvas.getBoundingClientRect();
            const before = this.screenToWorld(screenX + rect.left, screenY + rect.top);
            this.state.camera.scale = geometry.clamp(this.state.camera.scale * factor, this.state.camera.minScale, this.state.camera.maxScale);
            const after = this.screenToWorld(screenX + rect.left, screenY + rect.top);
            this.state.camera.x += before.x - after.x;
            this.state.camera.y += before.y - after.y;
            this.requestRender();
        }

        onPointerDown(event) {
            const world = this.screenToWorld(event.clientX, event.clientY);
            const shiftKey = event.shiftKey;
            this.canvas.setPointerCapture(event.pointerId);
            if (event.button === 2) {
                this.state.interaction = {
                    type: 'pan',
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    cameraStartX: this.state.camera.x,
                    cameraStartY: this.state.camera.y
                };
                return;
            }

            const handleHit = this.getHandleHit(world);
            let unitHit = this.pickUnit(world);
            if (this.state.setupStage === 'unit-deployment') {
                const activePlayerId = this.getDeploymentSetup()?.activePlayerId;
                if (unitHit && this.getUnitPlayerId(unitHit) !== activePlayerId) {
                    unitHit = null;
                }
            }
            this.state.interaction = {
                type: 'click',
                pointerId: event.pointerId,
                startWorld: world,
                startClientX: event.clientX,
                startClientY: event.clientY,
                shiftKey,
                unitHit: unitHit ? unitHit.id : null,
                handleHit,
                suppressClick: false,
                moved: false,
                dragBase: null
            };

            if (handleHit) {
                if (this.state.mode === 'game' && this.state.phase !== 'move') {
                    return;
                }
                if (handleHit.kind === 'formation-reverse' || handleHit.kind === 'single-reverse') {
                    this.state.interaction.suppressClick = true;
                    this.applyReverseSelection();
                    return;
                }
                if (handleHit.kind === 'formation-convert') {
                    this.state.interaction.suppressClick = true;
                    this.applyConvertSelection();
                    return;
                }
                this.beginRotationInteraction(handleHit, world);
                return;
            }

            const isSelectedUnit = unitHit && this.state.selectedIds.includes(unitHit.id);

            if (unitHit && this.isUnitInReserve(unitHit.id)) {
                if (this.state.mode === 'game' && this.state.phase === 'move') {
                    if (!this.beginReserveDeploy(unitHit, world.x)) {
                        this.state.selectedIds = [unitHit.id];
                        this.updateSelectionAnalysis();
                        this.syncUiFromState();
                        this.requestRender();
                        return;
                    }
                    this.state.interaction.type = 'move-single';
                    this.state.interaction.draftIds = [...this.state.selectedIds];
                    this.state.interaction.dragBase = geometry.snapshotPositions(this.state.selectedIds, this.state.units);
                    this.state.interaction.anchorWorld = world;
                    this.state.interaction.suppressClick = true;
                }
                return;
            }

            if (this.state.setupStage !== 'unit-deployment' && this.state.mode === 'game' && this.state.phase === 'move' && isSelectedUnit) {
                const analysis = this.state.selectionAnalysis;
                if (analysis.type === 'single' || analysis.type === 'rank' || (analysis.type === 'file' && analysis.leadId === unitHit.id)) {
                    if (!this.ensureDraft(this.state.selectedIds)) {
                        return;
                    }
                    this.state.draft.allowSingleRotationFormationEscape = false;
                    this.state.interaction.type = analysis.type === 'single' ? 'move-single' : analysis.type === 'rank' ? 'move-rank' : 'move-file';
                    this.state.interaction.rankAnalysis = analysis.type === 'rank' ? analysis : null;
                    this.state.interaction.dragBase = geometry.snapshotPositions(this.state.selectedIds, this.state.units);
                    this.state.interaction.draftIds = [...this.state.selectedIds];
                    this.state.interaction.anchorWorld = world;
                    return;
                }
            }

            if (isSelectedUnit && (this.state.mode === 'edit' || this.state.setupStage === 'unit-deployment')) {
                const draftIds = [...this.state.selectedIds];
                this.state.interaction.type = 'move-edit';
                this.state.interaction.dragBase = geometry.snapshotPositions(draftIds, this.state.units);
                this.state.interaction.draftIds = draftIds;
                this.state.interaction.anchorWorld = world;
                this.state.interaction.suppressClick = true;
                if (this.state.setupStage !== 'unit-deployment') {
                    this.state.interaction.editSnapshot = this.createEditSnapshot();
                }
                return;
            }

            this.state.interaction.type = 'marquee';
            this.state.marquee = {
                start: world,
                end: world,
                additive: shiftKey
            };
            this.requestRender();
        }

        beginRotationInteraction(handleHit, world) {
            const selectionIds = [...this.state.selectedIds];
            if (selectionIds.length === 0) {
                return;
            }
            if (this.state.mode === 'game' && this.state.setupStage !== 'unit-deployment' && !this.ensureDraft(selectionIds)) {
                return;
            }
            const positions = geometry.snapshotPositions(selectionIds, this.state.units);
            let pivot = null;
            if (handleHit.kind === 'rank-left' || handleHit.kind === 'rank-right') {
                pivot = handleHit.pivot;
                this.state.interaction.type = 'rotate-rank';
                this.state.interaction.rankAnalysis = this.state.selectionAnalysis;
                this.state.interaction.forwardRotationSign = handleHit.forwardRotationSign || 1;
                this.state.interaction.suppressClick = true;
                if (this.state.draft) {
                    this.state.draft.allowSingleRotationFormationEscape = false;
                }
            } else {
                const selectedUnit = this.getUnitById(handleHit.unitId);
                pivot = geometry.getUnitCenter(selectedUnit);
                this.state.interaction.type = 'rotate-single';
                this.state.interaction.singleRotationMode = this.state.singleRotationMode;
                this.state.interaction.centerPivot = pivot;
                this.state.interaction.suppressClick = true;
                if (this.state.draft) {
                    this.state.draft.allowSingleRotationFormationEscape = true;
                }
            }
            this.state.interaction.dragBase = positions;
            this.state.interaction.anchorAngle = geometry.angleBetween(pivot, world);
            this.state.interaction.pivot = pivot;
            this.state.interaction.draftIds = selectionIds;
            if (this.state.mode === 'edit' && this.state.setupStage !== 'unit-deployment') {
                this.state.interaction.editSnapshot = this.createEditSnapshot();
            }
        }

        applyProjectedRankUnits(interaction, projectedUnits, snapBeforeResolve) {
            const originUnits = interaction.draftIds
                .map((unitId) => interaction.dragBase[unitId])
                .filter(Boolean)
                .map((unit) => ({ ...unit }));
            let nextUnits = projectedUnits;
            if (snapBeforeResolve) {
                nextUnits = this.snapProjectedUnits(nextUnits, interaction.draftIds);
            }
            const resolved = rules.resolveAngledRankMoveContact(
                originUnits,
                nextUnits,
                this.state.units,
                this.state.activePlayerId,
                this.state.terrain
            );
            const appliedUnits = resolved ? resolved.units : nextUnits;
            interaction.preserveRankFormation = Boolean(resolved && resolved.unitIds && resolved.unitIds.length > 0);
            appliedUnits.forEach((projectedUnit) => {
                const unit = this.getUnitById(projectedUnit.id);
                Object.assign(unit, projectedUnit);
            });
        }

        onPointerMove(event) {
            const interaction = this.state.interaction;
            if (!interaction || interaction.pointerId !== event.pointerId) {
                return;
            }
            const world = this.screenToWorld(event.clientX, event.clientY);
            const dx = event.clientX - interaction.startClientX;
            const dy = event.clientY - interaction.startClientY;
            if (Math.abs(dx) > data.DRAG_THRESHOLD || Math.abs(dy) > data.DRAG_THRESHOLD) {
                interaction.moved = true;
            }

            if (interaction.type === 'pan') {
                this.state.camera.x = interaction.cameraStartX - dx / this.state.camera.scale;
                this.state.camera.y = interaction.cameraStartY - dy / this.state.camera.scale;
                this.requestRender();
                return;
            }

            if (interaction.type === 'marquee') {
                this.state.marquee.end = world;
                this.requestRender();
                return;
            }

            if (!interaction.moved || !interaction.dragBase) {
                return;
            }

            if (interaction.type === 'move-edit') {
                const delta = geometry.subtract(world, interaction.anchorWorld);
                interaction.draftIds.forEach((unitId) => {
                    const base = interaction.dragBase[unitId];
                    const unit = this.getUnitById(unitId);
                    unit.x = base.x + delta.x;
                    unit.y = base.y + delta.y;
                });
                this.snapSelection(interaction.draftIds);
                this.updateSelectionAnalysis();
                this.requestRender();
                return;
            }

            if (interaction.type === 'move-single') {
                const delta = geometry.subtract(world, interaction.anchorWorld);
                const unitId = interaction.draftIds[0];
                const base = interaction.dragBase[unitId];
                const unit = this.getUnitById(unitId);
                if (this.isEnsorcelledLocalReturnDraft()) {
                    unit.x = base.x + delta.x;
                    unit.y = base.y + delta.y;
                    this.evaluateDraft();
                    this.requestRender();
                    return;
                }
                if (this.isReserveDeployDraft()) {
                    this.applyReserveDraftPose(unit, this.getUnitPlayerId(unit), geometry.getUnitCenter(base).x + delta.x);
                    this.evaluateDraft();
                    this.requestRender();
                    return;
                }
                unit.x = base.x + delta.x;
                unit.y = base.y + delta.y;
                this.snapSelection(interaction.draftIds);
                this.evaluateDraft();
                this.requestRender();
                return;
            }

            if (interaction.type === 'move-rank') {
                const analysis = interaction.rankAnalysis || this.state.selectionAnalysis;
                const delta = geometry.subtract(world, interaction.anchorWorld);
                const allowedDistance = Math.max(0, geometry.dot(delta, analysis.forward));
                const moveDelta = geometry.scaleVector(analysis.forward, allowedDistance);
                const projectedUnits = interaction.draftIds.map((unitId) => {
                    const base = interaction.dragBase[unitId];
                    return {
                        ...base,
                        x: base.x + moveDelta.x,
                        y: base.y + moveDelta.y
                    };
                });
                this.applyProjectedRankUnits(interaction, projectedUnits, true);
                this.evaluateDraft();
                if (interaction.preserveRankFormation) {
                    this.state.selectionAnalysis = interaction.rankAnalysis;
                } else {
                    this.updateSelectionAnalysis();
                }
                this.requestRender();
                return;
            }

            if (interaction.type === 'move-file') {
                const analysis = this.state.selectionAnalysis;
                const delta = geometry.subtract(world, interaction.anchorWorld);
                const forwardAmount = Math.max(0, geometry.dot(delta, analysis.forward));
                const lateralAmount = geometry.clamp(geometry.dot(delta, analysis.right), -forwardAmount, forwardAmount);
                const leadDelta = geometry.add(geometry.scaleVector(analysis.forward, forwardAmount), geometry.scaleVector(analysis.right, lateralAmount));
                const orderedIds = analysis.orderedIds;
                const leadBase = interaction.dragBase[orderedIds[0]];
                const leadUnit = this.getUnitById(orderedIds[0]);
                leadUnit.x = leadBase.x + leadDelta.x;
                leadUnit.y = leadBase.y + leadDelta.y;
                leadUnit.rotation = leadBase.rotation;
                for (let index = 1; index < orderedIds.length; index += 1) {
                    const previousUnit = this.getUnitById(orderedIds[index - 1]);
                    const follower = this.getUnitById(orderedIds[index]);
                    const followerBase = interaction.dragBase[orderedIds[index]];
                    const previousCorners = geometry.getUnitCorners(previousUnit);
                    follower.x = previousCorners.backLeft.x;
                    follower.y = previousCorners.backLeft.y;
                    follower.rotation = followerBase.rotation;
                }
                this.snapSelection(interaction.draftIds);
                this.evaluateDraft();
                this.requestRender();
                return;
            }

            if (interaction.type === 'rotate-single') {
                const unitId = interaction.draftIds[0];
                const unit = this.getUnitById(unitId);
                const currentAngle = geometry.angleBetween(interaction.centerPivot || interaction.pivot, world);
                const rotationDelta = geometry.normalizeAngle(currentAngle - interaction.anchorAngle);
                const nextRotation = geometry.normalizeAngle(interaction.dragBase[unitId].rotation + rotationDelta);
                if (interaction.singleRotationMode === 'front-corner') {
                    const baseCorners = geometry.getUnitCorners(interaction.dragBase[unitId]);
                    if (rotationDelta >= 0) {
                        const fixedFrontRight = baseCorners.frontRight;
                        const nextRight = geometry.getRightVector(nextRotation);
                        unit.x = fixedFrontRight.x - (nextRight.x * unit.width);
                        unit.y = fixedFrontRight.y - (nextRight.y * unit.width);
                    } else {
                        unit.x = baseCorners.frontLeft.x;
                        unit.y = baseCorners.frontLeft.y;
                    }
                    unit.rotation = nextRotation;
                } else {
                    const rotatedFrontLeft = geometry.rotatePoint({ x: interaction.dragBase[unitId].x, y: interaction.dragBase[unitId].y }, interaction.pivot, rotationDelta);
                    unit.rotation = nextRotation;
                    unit.x = rotatedFrontLeft.x;
                    unit.y = rotatedFrontLeft.y;
                }
                if (this.state.mode === 'game') {
                    this.evaluateDraft();
                }
                this.updateSelectionAnalysis();
                this.requestRender();
                return;
            }

            if (interaction.type === 'rotate-rank') {
                const analysis = interaction.rankAnalysis || this.state.selectionAnalysis;
                const currentAngle = geometry.angleBetween(interaction.pivot, world);
                const rawRotationDelta = geometry.normalizeAngle(currentAngle - interaction.anchorAngle);
                const rotationDelta = (interaction.forwardRotationSign || 1) > 0
                    ? Math.max(0, rawRotationDelta)
                    : Math.min(0, rawRotationDelta);
                const projectedUnits = interaction.draftIds.map((unitId) => {
                    const base = interaction.dragBase[unitId];
                    const frontLeft = geometry.rotatePoint({ x: base.x, y: base.y }, interaction.pivot, rotationDelta);
                    return {
                        ...base,
                        x: frontLeft.x,
                        y: frontLeft.y,
                        rotation: geometry.normalizeAngle(base.rotation + rotationDelta)
                    };
                });
                if (analysis.type === 'rank') {
                    this.applyProjectedRankUnits(interaction, projectedUnits, false);
                } else {
                    projectedUnits.forEach((projectedUnit) => {
                        const unit = this.getUnitById(projectedUnit.id);
                        Object.assign(unit, projectedUnit);
                    });
                    this.snapSelection(interaction.draftIds);
                }
                this.evaluateDraft();
                if (interaction.preserveRankFormation) {
                    this.state.selectionAnalysis = interaction.rankAnalysis;
                } else {
                    this.updateSelectionAnalysis();
                }
                this.requestRender();
            }
        }

        onPointerUp(event) {
            const interaction = this.state.interaction;
            if (!interaction || interaction.pointerId !== event.pointerId) {
                return;
            }
            const world = this.screenToWorld(event.clientX, event.clientY);
            if (interaction.type === 'marquee' && this.state.marquee) {
                const marquee = this.state.marquee;
                this.state.marquee = null;
                if (interaction.moved) {
                    this.applyMarqueeSelection(marquee);
                } else if (!interaction.suppressClick) {
                    this.handleClick(world, interaction);
                }
            } else if (!interaction.moved && !interaction.suppressClick) {
                this.handleClick(world, interaction);
            } else if (this.state.mode === 'edit' && this.state.setupStage !== 'unit-deployment' && interaction.editSnapshot && (interaction.type === 'move-edit' || interaction.type === 'rotate-single' || interaction.type === 'rotate-rank')) {
                this.recordEditSnapshot(interaction.editSnapshot);
            } else if (interaction.type === 'move-rank' || interaction.type === 'move-file' || interaction.type === 'rotate-rank') {
                this.commitDraftStep();
            }
            if (interaction.preserveRankFormation) {
                this.updateSelectionAnalysis();
                this.syncUiFromState();
            }
            if (this.canvas.hasPointerCapture(event.pointerId)) {
                this.canvas.releasePointerCapture(event.pointerId);
            }
            this.state.interaction = null;
            this.requestRender();
        }

        handleClick(world, interaction) {
            const unitHit = interaction.unitHit ? this.getUnitById(interaction.unitHit) : this.pickUnit(world);
            if (this.state.mode === 'game' && this.state.phase === 'shooting') {
                this.handleShootingClick(unitHit);
                return;
            }
            if (this.state.mode === 'edit' && this.state.placingUnit && !unitHit) {
                this.placeUnit(world);
                return;
            }
            if (unitHit) {
                if (this.state.setupStage === 'unit-deployment' && this.getUnitPlayerId(unitHit) !== this.getDeploymentSetup()?.activePlayerId) {
                    return;
                }
                if (this.isUnitInReserve(unitHit.id)) {
                    if (this.state.mode === 'game' && this.state.phase === 'move') {
                        this.beginReserveDeploy(unitHit, world.x);
                    } else if (this.state.mode === 'game' && this.getUnitPlayerId(unitHit) !== this.state.activePlayerId) {
                        this.updateStatus('Only the active side can be selected in game mode.');
                    } else {
                        this.toggleSelection(unitHit.id, false);
                    }
                    return;
                }
                if (this.state.mode === 'game' && this.state.setupStage !== 'unit-deployment' && this.getUnitPlayerId(unitHit) !== this.state.activePlayerId) {
                    this.updateStatus('Only the active side can be selected in game mode.');
                    return;
                }
                this.toggleSelection(unitHit.id, interaction.shiftKey);
            }
        }

        placeUnit(world) {
            const template = data.UNIT_TYPES[this.state.placementType];
            this.recordEditSnapshot(this.createEditSnapshot());
            const unit = {
                id: this.allocateUnitId(),
                type: this.state.placementType,
                ...data.createUnit(
                    this.state.placementType,
                    this.state.placementPlayerId,
                    this.getPlayer(this.state.placementPlayerId).faction,
                    {
                        x: world.x - data.UNIT_WIDTH / 2,
                        y: world.y + template.depth / 2,
                        rotation: this.state.placementPlayerId === 'player-1' ? 0 : Math.PI
                    },
                    () => this.allocateUnitId()
                )
            };
            this.state.units.push(unit);
            this.state.placingUnit = false;
            this.toggleSelection(unit.id, false);
            this.updateStatus('Placed a new ' + unit.type + '.');
        }

        toggleSelection(unitId, additive) {
            if (!additive) {
                if (this.state.selectedIds.length === 1 && this.state.selectedIds[0] === unitId) {
                    this.clearSelection();
                    return;
                }
                this.state.selectedIds = [unitId];
            } else if (this.state.selectedIds.includes(unitId)) {
                this.state.selectedIds = this.state.selectedIds.filter((id) => id !== unitId);
            } else {
                this.state.selectedIds = [...this.state.selectedIds, unitId];
            }
            if (this.state.draft && !geometry.sameIdSet(this.state.selectedIds, this.state.draft.unitIds)) {
                this.cancelDraft(false);
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
        }

        clearSelection() {
            this.state.selectedIds = [];
            if (this.state.draft) {
                this.cancelDraft(false);
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
        }

        applyMarqueeSelection(marquee) {
            const rect = geometry.normalizeRect(marquee.start, marquee.end);
            const hitIds = this.state.units
                .filter((unit) => geometry.polygonInsideRect(geometry.getUnitCorners(unit), rect))
                .filter((unit) => {
                    if (this.state.setupStage === 'unit-deployment') {
                        return this.getUnitPlayerId(unit) === this.getDeploymentSetup()?.activePlayerId;
                    }
                    return this.state.mode === 'edit' || this.getUnitPlayerId(unit) === this.state.activePlayerId;
                })
                .map((unit) => unit.id);
            if (marquee.additive) {
                const nextIds = [...this.state.selectedIds];
                hitIds.forEach((unitId) => {
                    if (!nextIds.includes(unitId)) {
                        nextIds.push(unitId);
                    }
                });
                this.state.selectedIds = nextIds;
            } else {
                this.state.selectedIds = hitIds;
            }
            if (this.state.draft && !geometry.sameIdSet(this.state.selectedIds, this.state.draft.unitIds)) {
                this.cancelDraft(false);
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
        }

        pickUnit(world) {
            for (let index = this.state.units.length - 1; index >= 0; index -= 1) {
                const unit = this.state.units[index];
                if (geometry.pointInPolygon(world, geometry.getUnitCorners(unit))) {
                    return unit;
                }
            }
            const reserveUnits = this.getReserveUnits();
            for (let index = reserveUnits.length - 1; index >= 0; index -= 1) {
                const unit = reserveUnits[index];
                if (geometry.pointInPolygon(world, geometry.getUnitCorners(unit))) {
                    return unit;
                }
            }
            return null;
        }

        getHandleHit(world) {
            const handles = this.getSelectionHandles();
            for (const handle of handles) {
                if (geometry.distance(world, handle.position) <= handle.radius) {
                    return handle;
                }
            }
            return null;
        }

        getSelectionHandles() {
            if (this.isReserveDeployDraft() && !this.isEnsorcelledLocalReturnDraft()) {
                return [];
            }
            if (this.state.mode === 'game' && this.state.phase !== 'move' && this.state.setupStage !== 'unit-deployment') {
                return [];
            }
            const analysis = this.state.selectionAnalysis;
            if (analysis.type === 'none' || analysis.invalid) {
                return [];
            }
            if (analysis.type === 'single') {
                const unit = this.getUnitById(this.state.selectedIds[0]);
                if (!unit) {
                    return [];
                }
                const center = geometry.getUnitCenter(unit);
                return [{
                    kind: 'single-rotate',
                    unitId: unit.id,
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(center, geometry.scaleVector(geometry.getRightVector(unit.rotation), unit.width * 0.8)),
                    rotation: unit.rotation
                }, {
                    kind: 'single-reverse',
                    unitId: unit.id,
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(center, geometry.scaleVector(geometry.getForwardVector(unit.rotation), (unit.depth / 2) + 12)),
                    rotation: geometry.normalizeAngle(unit.rotation + (Math.PI / 2))
                }];
            }
            if (analysis.type === 'rank') {
                const reverseHandle = this.getFormationReverseHandle(analysis);
                const convertHandle = this.getFormationConvertHandle(analysis);
                const leftWheelVector = geometry.subtract(analysis.leftPivot, analysis.rightPivot);
                const rightWheelVector = geometry.subtract(analysis.rightPivot, analysis.leftPivot);
                const handles = [{
                    kind: 'rank-left',
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(analysis.leftHandle, geometry.scaleVector(analysis.leftOutward, 16)),
                    pivot: analysis.rightPivot,
                    rotation: Math.atan2(-analysis.leftOutward.y, -analysis.leftOutward.x),
                    forwardRotationSign: Math.sign(geometry.dot({ x: -leftWheelVector.y, y: leftWheelVector.x }, analysis.forward)) || 1
                }, {
                    kind: 'rank-right',
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(analysis.rightHandle, geometry.scaleVector(analysis.rightOutward, 16)),
                    pivot: analysis.leftPivot,
                    rotation: Math.atan2(analysis.rightOutward.y, analysis.rightOutward.x),
                    forwardRotationSign: Math.sign(geometry.dot({ x: -rightWheelVector.y, y: rightWheelVector.x }, analysis.forward)) || 1
                }, reverseHandle];
                if (this.state.setupStage !== 'unit-deployment') {
                    handles.push(convertHandle);
                }
                return handles;
            }
            if (analysis.type === 'file') {
                if (this.state.setupStage === 'unit-deployment') {
                    return [this.getFormationReverseHandle(analysis)];
                }
                return [this.getFormationReverseHandle(analysis), this.getFormationConvertHandle(analysis)];
            }
            return [];
        }

        getFormationCenterInfo(analysis) {
            const selectedUnits = this.getSelectedUnits();
            const centers = selectedUnits.map((unit) => geometry.getUnitCenter(unit));
            const formationCenter = {
                x: geometry.average(centers.map((center) => center.x)),
                y: geometry.average(centers.map((center) => center.y))
            };
            const projections = selectedUnits
                .flatMap((unit) => geometry.cornersToPoints(geometry.getUnitCorners(unit)))
                .map((point) => ({ point, distance: geometry.dot(point, analysis.forward) }));
            const frontDistance = Math.max(...projections.map((entry) => entry.distance));
            const backDistance = Math.min(...projections.map((entry) => entry.distance));
            const centerDistance = geometry.dot(formationCenter, analysis.forward);
            return {
                formationCenter,
                frontOffset: Math.max(18, frontDistance - centerDistance + 12),
                backOffset: Math.max(18, centerDistance - backDistance + 12)
            };
        }

        getFormationReverseHandle(analysis) {
            const info = this.getFormationCenterInfo(analysis);
            return {
                kind: 'formation-reverse',
                radius: data.HANDLE_RADIUS,
                position: geometry.add(info.formationCenter, geometry.scaleVector(analysis.forward, info.frontOffset)),
                rotation: geometry.normalizeAngle(Math.atan2(analysis.forward.y, analysis.forward.x) + (Math.PI / 2))
            };
        }

        getFormationConvertHandle(analysis) {
            const info = this.getFormationCenterInfo(analysis);
            return {
                kind: 'formation-convert',
                radius: data.HANDLE_RADIUS,
                position: geometry.add(info.formationCenter, geometry.scaleVector(analysis.forward, -info.backOffset)),
                rotation: geometry.normalizeAngle(Math.atan2(analysis.forward.y, analysis.forward.x) + (Math.PI / 2))
            };
        }

        applyReverseSelection() {
            const analysis = this.state.selectionAnalysis;
            if (analysis.type !== 'single' && analysis.type !== 'rank' && analysis.type !== 'file') {
                return;
            }
            const selectionIds = [...this.state.selectedIds];
            if (selectionIds.length === 0) {
                return;
            }
            if (this.state.mode === 'game' && this.state.setupStage !== 'unit-deployment') {
                if (!this.ensureDraft(selectionIds)) {
                    return;
                }
            } else if (this.state.setupStage !== 'unit-deployment') {
                this.recordEditSnapshot(this.createEditSnapshot());
            }

            const reverseSnapshot = this.state.setupStage === 'unit-deployment'
                ? geometry.snapshotPositions(selectionIds, this.state.units)
                : null;
            if (analysis.type === 'rank') {
                const orderedUnits = analysis.orderedIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
                const reversedRotation = geometry.normalizeAngle(orderedUnits[0].rotation + Math.PI);
                const formationCenter = this.getFormationCenterInfo(analysis).formationCenter;
                const reversedUnits = this.buildRankFromLead([...orderedUnits].reverse(), reversedRotation, geometry.add(
                    formationCenter,
                    geometry.scaleVector(geometry.getForwardVector(reversedRotation), geometry.average(orderedUnits.map((unit) => unit.depth)) / 2)
                ));
                reversedUnits.forEach((candidateUnit) => {
                    const unit = this.getUnitById(candidateUnit.id);
                    Object.assign(unit, candidateUnit);
                });
            } else {
                selectionIds.forEach((unitId) => {
                    const unit = this.getUnitById(unitId);
                    Object.assign(unit, geometry.reverseUnitFacing(unit));
                });
            }

            if (reverseSnapshot && typeof this.areDeploymentUnitsLegal === 'function') {
                const reversedUnits = selectionIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
                if (!this.areDeploymentUnitsLegal(reversedUnits)) {
                    geometry.restoreSnapshot(reverseSnapshot, this.state.units);
                    this.updateSelectionAnalysis();
                    this.syncUiFromState();
                    this.updateStatus('Invalid reverse: deployed units must stay on the board, inside the assigned quarter, and cannot overlap.');
                    return;
                }
            }

            if (this.state.mode === 'game' && this.state.setupStage !== 'unit-deployment') {
                this.evaluateDraft();
                if (analysis.type !== 'single') {
                    this.commitDraftStep();
                }
            }
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(analysis.type === 'single' ? 'Unit reversed.' : 'Formation reversed.');
        }

        buildCenteredLinearOffsets(sizes, orientation) {
            const total = sizes.reduce((sum, size) => sum + size, 0);
            let cursor = orientation === 'forward'
                ? (total / 2) - (sizes[0] / 2)
                : (-total / 2) + (sizes[0] / 2);
            return sizes.map((size, index) => {
                if (index === 0) {
                    return cursor;
                }
                const previousSize = sizes[index - 1];
                cursor += (orientation === 'forward' ? -1 : 1) * ((previousSize / 2) + (size / 2));
                return cursor;
            });
        }

        getUnitFrontCenter(unit) {
            const corners = geometry.getUnitCorners(unit);
            return geometry.midpoint(corners.frontLeft, corners.frontRight);
        }

        getUnitSideCenter(unit, sideSign) {
            const corners = geometry.getUnitCorners(unit);
            return sideSign < 0
                ? geometry.midpoint(corners.frontLeft, corners.backLeft)
                : geometry.midpoint(corners.frontRight, corners.backRight);
        }

        buildFileFromSide(order, rotation, sideAnchor, sideSign) {
            const forward = geometry.getForwardVector(rotation);
            const right = geometry.getRightVector(rotation);
            const offsets = this.buildCenteredLinearOffsets(order.map((unit) => unit.depth), 'forward');
            const converted = [];
            order.forEach((unit, index) => {
                const sideCenter = geometry.add(sideAnchor, geometry.scaleVector(forward, offsets[index]));
                const center = geometry.add(sideCenter, geometry.scaleVector(right, -sideSign * (unit.width / 2)));
                converted.push(geometry.buildUnitFromCenter(unit, center, rotation));
            });
            return converted;
        }

        buildRankFromLead(order, rotation, frontAnchor) {
            const forward = geometry.getForwardVector(rotation);
            const right = geometry.getRightVector(rotation);
            const offsets = this.buildCenteredLinearOffsets(order.map((unit) => unit.width), 'right');
            const converted = [];
            order.forEach((unit, index) => {
                const frontCenter = geometry.add(frontAnchor, geometry.scaleVector(right, offsets[index]));
                const center = geometry.add(frontCenter, geometry.scaleVector(forward, -(unit.depth / 2)));
                converted.push(geometry.buildUnitFromCenter(unit, center, rotation));
            });
            return converted;
        }

        estimateConvertedFormationTravel(units, converted) {
            const byId = new Map(converted.map((unit) => [unit.id, unit]));
            return converted.reduce((maxDistance, unit) => {
                const originalUnit = units.find((candidate) => candidate.id === unit.id);
                const candidateUnit = byId.get(unit.id);
                return Math.max(maxDistance, geometry.distance(geometry.getUnitCenter(originalUnit), geometry.getUnitCenter(candidateUnit)));
            }, 0);
        }

        buildConvertedFormationCandidates(units, analysis) {
            const boardCenter = { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 };
            const orderedUnits = analysis.orderedIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
            const candidates = [];
            if (analysis.type === 'rank') {
                const frontAnchor = geometry.midpoint(
                    this.getUnitFrontCenter(orderedUnits[0]),
                    this.getUnitFrontCenter(orderedUnits[orderedUnits.length - 1])
                );
                const toBoardCenter = geometry.subtract(boardCenter, frontAnchor);
                const leftRotation = geometry.normalizeAngle(orderedUnits[0].rotation - (Math.PI / 2));
                const rightRotation = geometry.normalizeAngle(orderedUnits[0].rotation + (Math.PI / 2));
                candidates.push({
                    converted: this.buildFileFromSide(orderedUnits, leftRotation, frontAnchor, 1),
                    score: geometry.dot(geometry.getForwardVector(leftRotation), toBoardCenter)
                });
                candidates.push({
                    converted: this.buildFileFromSide([...orderedUnits].reverse(), rightRotation, frontAnchor, -1),
                    score: geometry.dot(geometry.getForwardVector(rightRotation), toBoardCenter)
                });
            } else {
                const inwardRotationA = geometry.normalizeAngle(orderedUnits[0].rotation - (Math.PI / 2));
                const inwardRotationB = geometry.normalizeAngle(orderedUnits[0].rotation + (Math.PI / 2));
                const leftSideAnchor = geometry.midpoint(
                    this.getUnitSideCenter(orderedUnits[0], -1),
                    this.getUnitSideCenter(orderedUnits[orderedUnits.length - 1], -1)
                );
                const rightSideAnchor = geometry.midpoint(
                    this.getUnitSideCenter(orderedUnits[0], 1),
                    this.getUnitSideCenter(orderedUnits[orderedUnits.length - 1], 1)
                );
                const leftToBoardCenter = geometry.subtract(boardCenter, leftSideAnchor);
                const rightToBoardCenter = geometry.subtract(boardCenter, rightSideAnchor);
                const preferredFirst = geometry.distance(leftSideAnchor, boardCenter) <= geometry.distance(rightSideAnchor, boardCenter);
                const preferredAnchor = preferredFirst ? leftSideAnchor : rightSideAnchor;
                const fallbackAnchor = preferredFirst ? rightSideAnchor : leftSideAnchor;
                const preferredToBoardCenter = preferredFirst ? leftToBoardCenter : rightToBoardCenter;
                const fallbackToBoardCenter = preferredFirst ? rightToBoardCenter : leftToBoardCenter;
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationA, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationA), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationA, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationA), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationB, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationB), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationB, preferredAnchor),
                    preference: 1,
                    score: 10 + geometry.dot(geometry.getForwardVector(inwardRotationB), preferredToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationA, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationA), fallbackToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationA, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationA), fallbackToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead(orderedUnits, inwardRotationB, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationB), fallbackToBoardCenter)
                });
                candidates.push({
                    converted: this.buildRankFromLead([...orderedUnits].reverse(), inwardRotationB, fallbackAnchor),
                    preference: 0,
                    score: geometry.dot(geometry.getForwardVector(inwardRotationB), fallbackToBoardCenter)
                });
            }

            return candidates
                .map((candidate) => ({
                    ...candidate,
                    travel: this.estimateConvertedFormationTravel(units, candidate.converted)
                }))
                .sort((left, right) => (right.preference || 0) - (left.preference || 0) || (right.score - left.score) || (left.travel - right.travel));
        }

        applyConvertSelection() {
            const analysis = this.state.selectionAnalysis;
            if (analysis.type !== 'rank' && analysis.type !== 'file') {
                return;
            }
            const selectionIds = [...this.state.selectedIds];
            if (selectionIds.length === 0) {
                return;
            }
            if (this.state.mode === 'game') {
                if (!this.ensureDraft(selectionIds)) {
                    return;
                }
            } else {
                this.recordEditSnapshot(this.createEditSnapshot());
            }

            const snapshot = geometry.snapshotPositions(selectionIds, this.state.units);
            const candidateFormations = this.buildConvertedFormationCandidates(this.state.units, analysis);
            let applied = false;

            for (const candidate of candidateFormations) {
                geometry.restoreSnapshot(snapshot, this.state.units);
                candidate.converted.forEach((candidateUnit) => {
                    const unit = this.getUnitById(candidateUnit.id);
                    Object.assign(unit, candidateUnit);
                });

                if (this.state.mode === 'game') {
                    const previousCornerMetric = this.state.draft.useFinalCornerDisplacement;
                    this.state.draft.useFinalCornerDisplacement = true;
                    this.evaluateDraft();
                    this.state.draft.useFinalCornerDisplacement = previousCornerMetric;
                    if (this.state.draft.invalidIds.size > 0) {
                        continue;
                    }
                    this.commitDraftStep();
                }

                applied = true;
                break;
            }

            if (!applied) {
                geometry.restoreSnapshot(snapshot, this.state.units);
                if (this.state.mode === 'game') {
                    this.evaluateDraft();
                }
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus('That rank/file conversion would be illegal.');
                return;
            }

            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus(analysis.type === 'rank' ? 'Rank converted to file.' : 'File converted to rank.');
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
                reasonById: new Map()
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
            return history.createEditSnapshot(this.state.units, this.state.selectedIds, this.nextUnitId);
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
            this.state.placingUnit = false;
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.updateStatus('Edit action undone.');
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
        const mixinDescriptors = Object.getOwnPropertyDescriptors(BoardInteractionMethods.prototype);
        delete mixinDescriptors.constructor;
        Object.defineProperties(BoardInteractionPrototype.prototype, mixinDescriptors);
    }

    return { install };
}));