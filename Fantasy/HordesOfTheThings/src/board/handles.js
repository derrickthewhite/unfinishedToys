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
    root.HordesBoardHandles = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory, root.HordesFormation);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history, formation) {
    class Methods {
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
                    kind: 'single-forward',
                    unitId: unit.id,
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(center, geometry.scaleVector(geometry.getForwardVector(unit.rotation), (unit.depth / 2) + 12)),
                    rotation: Math.atan2(geometry.getForwardVector(unit.rotation).y, geometry.getForwardVector(unit.rotation).x)
                }, {
                    kind: 'single-rotate',
                    unitId: unit.id,
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(center, geometry.scaleVector(geometry.getRightVector(unit.rotation), unit.width * 0.8)),
                    rotation: unit.rotation
                }, {
                    kind: 'single-reverse',
                    unitId: unit.id,
                    radius: data.HANDLE_RADIUS,
                    position: geometry.add(center, geometry.scaleVector(geometry.getForwardVector(unit.rotation), -((unit.depth / 2) + 12))),
                    rotation: geometry.normalizeAngle(unit.rotation + (Math.PI / 2))
                }];
            }
            if (analysis.type === 'rank') {
                const forwardHandle = this.getFormationForwardHandle(analysis);
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
                }, forwardHandle];
                if (this.state.setupStage !== 'unit-deployment') {
                    handles.push(convertHandle);
                }
                handles.push(reverseHandle);
                return handles;
            }
            if (analysis.type === 'file') {
                const forwardHandle = this.getFormationForwardHandle(analysis);
                const reverseHandle = this.getFormationReverseHandle(analysis);
                if (this.state.setupStage === 'unit-deployment') {
                    return [forwardHandle, reverseHandle];
                }
                return [forwardHandle, this.getFormationConvertHandle(analysis), reverseHandle];
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
            const backCenter = geometry.add(info.formationCenter, geometry.scaleVector(analysis.forward, -info.backOffset));
            const lateralOffset = this.state.setupStage === 'unit-deployment' ? 0 : -24;
            return {
                kind: 'formation-reverse',
                radius: data.HANDLE_RADIUS,
                position: geometry.add(backCenter, geometry.scaleVector(analysis.right, lateralOffset)),
                rotation: geometry.normalizeAngle(Math.atan2(analysis.forward.y, analysis.forward.x) + (Math.PI / 2))
            };
        }


        getFormationForwardHandle(analysis) {
            const info = this.getFormationCenterInfo(analysis);
            return {
                kind: 'formation-forward',
                radius: data.HANDLE_RADIUS,
                position: geometry.add(info.formationCenter, geometry.scaleVector(analysis.forward, info.frontOffset)),
                rotation: Math.atan2(analysis.forward.y, analysis.forward.x)
            };
        }


        getFormationConvertHandle(analysis) {
            const info = this.getFormationCenterInfo(analysis);
            const backCenter = geometry.add(info.formationCenter, geometry.scaleVector(analysis.forward, -info.backOffset));
            return {
                kind: 'formation-convert',
                radius: data.HANDLE_RADIUS,
                position: geometry.add(backCenter, geometry.scaleVector(analysis.right, 24)),
                rotation: geometry.normalizeAngle(Math.atan2(analysis.forward.y, analysis.forward.x) + (Math.PI / 2))
            };
        }


        findMaxForwardDistance() {
            const analysis = this.state.selectionAnalysis;
            const draft = this.state.draft;
            if (!analysis || analysis.invalid || analysis.type === 'none' || !draft) {
                return null;
            }

            const draftIds = draft.unitIds;
            const base = draft.validationOrigin;
            const forward = analysis.forward;
            const liveSnapshot = geometry.snapshotPositions(draftIds, this.state.units);
            const maxSearch = draftIds.reduce((limit, unitId) => {
                const unit = this.getUnitById(unitId);
                if (!unit) {
                    return limit;
                }
                const unitMax = Math.max(unit.moves.road, unit.moves.good, unit.moves.bad, unit.moves.water);
                return Math.max(limit, unitMax);
            }, data.BOARD_SIZE);

            const applyForwardDistance = (distance) => {
                geometry.restoreSnapshot(liveSnapshot, this.state.units);
                const moveDelta = geometry.scaleVector(forward, distance);
                if (analysis.type === 'single') {
                    const unitId = draftIds[0];
                    const unit = this.getUnitById(unitId);
                    const origin = base[unitId];
                    unit.x = origin.x + moveDelta.x;
                    unit.y = origin.y + moveDelta.y;
                    return;
                }
                if (analysis.type === 'rank') {
                    draftIds.forEach((unitId) => {
                        const unit = this.getUnitById(unitId);
                        const origin = base[unitId];
                        unit.x = origin.x + moveDelta.x;
                        unit.y = origin.y + moveDelta.y;
                    });
                    return;
                }
                const orderedIds = analysis.orderedIds;
                const leadId = orderedIds[0];
                const lead = this.getUnitById(leadId);
                const leadBase = base[leadId];
                lead.x = leadBase.x + moveDelta.x;
                lead.y = leadBase.y + moveDelta.y;
                lead.rotation = leadBase.rotation;
                for (let index = 1; index < orderedIds.length; index += 1) {
                    const previousUnit = this.getUnitById(orderedIds[index - 1]);
                    const follower = this.getUnitById(orderedIds[index]);
                    const followerBase = base[orderedIds[index]];
                    const previousCorners = geometry.getUnitCorners(previousUnit);
                    follower.x = previousCorners.backLeft.x;
                    follower.y = previousCorners.backLeft.y;
                    follower.rotation = followerBase.rotation;
                }
            };

            const isValidDistance = (distance) => {
                applyForwardDistance(distance);
                this.finalizeForwardDraftPositions(analysis, draftIds, base);
                this.evaluateDraft();
                return draft.invalidIds.size === 0;
            };

            if (!isValidDistance(0)) {
                geometry.restoreSnapshot(liveSnapshot, this.state.units);
                this.evaluateDraft();
                return null;
            }

            let best = 0;
            const step = 2;
            for (let distance = step; distance <= maxSearch; distance += step) {
                if (!isValidDistance(distance)) {
                    break;
                }
                best = distance;
            }

            geometry.restoreSnapshot(liveSnapshot, this.state.units);
            this.evaluateDraft();
            return best;
        }


        finalizeForwardDraftPositions(analysis, draftIds, base) {
            if (analysis.type === 'rank') {
                const projectedUnits = draftIds.map((unitId) => ({ ...this.getUnitById(unitId) }));
                this.applyProjectedRankUnits({ draftIds, dragBase: base }, projectedUnits, true);
                return;
            }
            this.snapSelection(draftIds);
        }


        applyForwardMove(distance) {
            const analysis = this.state.selectionAnalysis;
            const draft = this.state.draft;
            if (!analysis || analysis.invalid || analysis.type === 'none' || !draft) {
                return false;
            }
            if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                return false;
            }

            const draftIds = draft.unitIds;
            const base = draft.validationOrigin;
            const forward = analysis.forward;
            const liveSnapshot = geometry.snapshotPositions(draftIds, this.state.units);
            const moveDelta = geometry.scaleVector(forward, distance);

            if (analysis.type === 'single') {
                const unitId = draftIds[0];
                const unit = this.getUnitById(unitId);
                const origin = base[unitId];
                unit.x = origin.x + moveDelta.x;
                unit.y = origin.y + moveDelta.y;
            } else if (analysis.type === 'rank') {
                draftIds.forEach((unitId) => {
                    const unit = this.getUnitById(unitId);
                    const origin = base[unitId];
                    unit.x = origin.x + moveDelta.x;
                    unit.y = origin.y + moveDelta.y;
                });
            } else {
                const orderedIds = analysis.orderedIds;
                const leadId = orderedIds[0];
                const lead = this.getUnitById(leadId);
                const leadBase = base[leadId];
                lead.x = leadBase.x + moveDelta.x;
                lead.y = leadBase.y + moveDelta.y;
                lead.rotation = leadBase.rotation;
                for (let index = 1; index < orderedIds.length; index += 1) {
                    const previousUnit = this.getUnitById(orderedIds[index - 1]);
                    const follower = this.getUnitById(orderedIds[index]);
                    const followerBase = base[orderedIds[index]];
                    const previousCorners = geometry.getUnitCorners(previousUnit);
                    follower.x = previousCorners.backLeft.x;
                    follower.y = previousCorners.backLeft.y;
                    follower.rotation = followerBase.rotation;
                }
            }

            this.finalizeForwardDraftPositions(analysis, draftIds, base);
            this.evaluateDraft();
            if (draft.invalidIds.size > 0) {
                geometry.restoreSnapshot(liveSnapshot, this.state.units);
                this.evaluateDraft();
                return false;
            }
            if (analysis.type !== 'single' && distance > 0.05) {
                this.commitDraftStep();
            }
            this.updateSelectionAnalysis();
            return true;
        }


        applyMaxForwardMove() {
            const analysis = this.state.selectionAnalysis;
            if (!analysis || analysis.invalid || analysis.type === 'none') {
                return;
            }
            if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                return;
            }
            if (!this.ensureDraft(this.state.selectedIds)) {
                return;
            }

            const best = this.findMaxForwardDistance();
            if (best === null) {
                this.updateStatus('The current draft is already invalid.');
                return;
            }
            if (best <= 0.05) {
                this.updateStatus('No forward movement is legal from here.');
                return;
            }

            this.applyForwardMove(best);
            this.syncUiFromState();
            this.requestRender();
            this.updateStatus(`Moved ${Math.round(best)} mm forward.`);
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
            return formation.buildCenteredLinearOffsets(sizes, orientation);
        }


        getUnitFrontCenter(unit) {
            return formation.getUnitFrontCenter(unit);
        }


        getUnitSideCenter(unit, sideSign) {
            return formation.getUnitSideCenter(unit, sideSign);
        }


        buildFileFromSide(order, rotation, sideAnchor, sideSign) {
            return formation.buildFileFromSide(order, rotation, sideAnchor, sideSign);
        }


        buildRankFromLead(order, rotation, frontAnchor) {
            return formation.buildRankFromLead(order, rotation, frontAnchor);
        }


        estimateConvertedFormationTravel(units, converted) {
            return formation.estimateConvertedFormationTravel(units, converted);
        }


        buildConvertedFormationCandidates(units, analysis) {
            return formation.buildConvertedFormationCandidates(units, analysis);
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

    }

    function install(BoardInteractionPrototype) {
        const mixinDescriptors = Object.getOwnPropertyDescriptors(Methods.prototype);
        delete mixinDescriptors.constructor;
        Object.defineProperties(BoardInteractionPrototype.prototype, mixinDescriptors);
    }

    return { install };
}));
