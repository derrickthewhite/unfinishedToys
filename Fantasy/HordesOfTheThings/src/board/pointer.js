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
    root.HordesBoardPointer = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory, root.HordesFormation);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history, formation) {
    class Methods {
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

            if (typeof this.isGameOver === 'function' && this.isGameOver() && this.state.mode === 'game') {
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
                if (handleHit.kind === 'formation-forward' || handleHit.kind === 'single-forward') {
                    this.state.interaction.suppressClick = true;
                    this.applyMaxForwardMove();
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
            if (typeof this.isGameOver === 'function' && this.isGameOver()) {
                return;
            }
            const battleHit = typeof this.getBattleStatHit === 'function' ? this.getBattleStatHit(world) : null;
            if (battleHit) {
                this.state.selectedBattleId = battleHit.id;
                this.state.selectedIds = [];
                if (this.state.draft) {
                    this.cancelDraft(false);
                }
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.requestRender();
                return;
            }
            if (this.state.selectedBattleId) {
                this.state.selectedBattleId = null;
            }
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
            this.state.selectedBattleId = null;
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
            this.maybeClearAutoMoveGhost();
            this.updateSelectionAnalysis();
            this.syncUiFromState();
            this.requestRender();
        }


        clearSelection() {
            this.state.selectedIds = [];
            this.state.selectedBattleId = null;
            if (this.state.draft) {
                this.cancelDraft(false);
            }
            this.maybeClearAutoMoveGhost();
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
            this.maybeClearAutoMoveGhost();
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

    }

    function install(BoardInteractionPrototype) {
        const mixinDescriptors = Object.getOwnPropertyDescriptors(Methods.prototype);
        delete mixinDescriptors.constructor;
        Object.defineProperties(BoardInteractionPrototype.prototype, mixinDescriptors);
    }

    return { install };
}));
