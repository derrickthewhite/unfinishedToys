(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('../rules/index.js'),
            require('./move-candidates.js'),
            require('./move-simulate.js'),
            require('./move-score.js')
        );
        return;
    }
    root.HordesMoveAiApply = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesMoveAiCandidates, root.HordesMoveAiSimulate, root.HordesMoveAiScore);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, candidates, simulate, score) {
    const {
        collectExtendedMoveCandidates
    } = candidates;

    const {
        simulateMoveCandidate,
        findMaxForwardDistance
    } = simulate;

    const {
        formatBreakdownValue
    } = score;
    const MIN_BENEFIT = 0.25;

    function describeCandidateGroup(unitIds, units) {
        const selected = unitIds
            .map((unitId) => units.find((unit) => unit.id === unitId))
            .filter(Boolean);
        if (selected.length === 0) {
            return unitIds.join(', ');
        }
        const primary = selected[0];
        return selected.length > 1 ? `${primary.type} (${selected.length})` : primary.type;
    }


    function nowMs() {
        return (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
    }


    function yieldToBrowser() {
        return new Promise((resolve) => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => resolve());
                return;
            }
            setTimeout(resolve, 0);
        });
    }


    async function yieldIfOverBudget(lastYieldAt, budgetMs = 8) {
        if (nowMs() - lastYieldAt >= budgetMs) {
            await yieldToBrowser();
            return nowMs();
        }
        return lastYieldAt;
    }


    function scoreCandidateGroup(context, group, forwardCache) {
        return simulateMoveCandidate(context, { ...group, moveKind: 'forward', moveParam: null }, forwardCache);
    }


    function improvesBadTerrain(units, scored, terrain) {
        return scored.unitIds.some((unitId) => {
            const before = units.find((unit) => unit.id === unitId);
            const after = scored.afterUnits.find((unit) => unit.id === unitId);
            if (!before || !after || data.UNIT_TYPES[before.type]?.combat?.ignoresBadGoingPenalty) {
                return false;
            }
            const beforeTerrain = rules.sampleUnitTerrain(before, terrain);
            const afterTerrain = rules.sampleUnitTerrain(after, terrain);
            if (beforeTerrain.has('water') && !afterTerrain.has('water')) {
                return true;
            }
            const beforeSeverity = rules.severityFromTerrain(beforeTerrain);
            const afterSeverity = rules.severityFromTerrain(afterTerrain);
            return beforeSeverity >= rules.TERRAIN_SEVERITY.swamp && afterSeverity < beforeSeverity;
        });
    }


    function clearsWaterExposure(units, scored, terrain) {
        return scored.unitIds.some((unitId) => {
            const before = units.find((unit) => unit.id === unitId);
            const after = scored.afterUnits.find((unit) => unit.id === unitId);
            if (!before || !after) {
                return false;
            }
            const beforeTerrain = rules.sampleUnitTerrain(before, terrain);
            const afterTerrain = rules.sampleUnitTerrain(after, terrain);
            return beforeTerrain.has('water') && !afterTerrain.has('water');
        });
    }


    function hasUnmovedUnitInWater(units, activePlayerId, terrain, getPlayerId) {
        return units.some((unit) => {
            if (getPlayerId(unit) !== activePlayerId || unit.movedThisTurn || unit.inReserve) {
                return false;
            }
            return rules.sampleUnitTerrain(unit, terrain).has('water');
        });
    }


    function resolveBestCandidate(context, best, bestTerrainEscape, bestWaterClear, bestReserveDeploy, bestEnsorcelledReturn) {
        if (bestEnsorcelledReturn && bestEnsorcelledReturn.score >= MIN_BENEFIT) {
            return bestEnsorcelledReturn;
        }
        if (best && best.score >= MIN_BENEFIT) {
            if (hasUnmovedUnitInWater(context.units, context.activePlayerId, context.terrain, context.getPlayerId)
                && bestWaterClear
                && bestWaterClear.score > 0
                && !clearsWaterExposure(context.units, best, context.terrain)) {
                return bestWaterClear;
            }
            return best;
        }
        if (bestReserveDeploy && bestReserveDeploy.score >= MIN_BENEFIT) {
            return bestReserveDeploy;
        }
        if (bestTerrainEscape && bestTerrainEscape.score > 0) {
            return bestTerrainEscape;
        }
        if (bestWaterClear) {
            return bestWaterClear;
        }
        if (bestReserveDeploy && bestReserveDeploy.score > 0) {
            return bestReserveDeploy;
        }
        if (bestEnsorcelledReturn && bestEnsorcelledReturn.score > 0) {
            return bestEnsorcelledReturn;
        }
        return null;
    }


    function pickBestCandidate(context, candidates, forwardCache) {
        let best = null;
        let bestTerrainEscape = null;
        let bestWaterClear = null;
        let bestReserveDeploy = null;
        let bestEnsorcelledReturn = null;

        candidates.forEach((candidate) => {
            const scored = simulateMoveCandidate(context, candidate, forwardCache);
            if (!scored) {
                return;
            }
            if (!best || scored.score > best.score) {
                best = scored;
            }
            if (candidate.moveKind === 'reserve-deploy'
                && (!bestReserveDeploy || scored.score > bestReserveDeploy.score)) {
                bestReserveDeploy = scored;
            }
            if (candidate.moveKind === 'ensorcelled-return'
                && (!bestEnsorcelledReturn || scored.score > bestEnsorcelledReturn.score)) {
                bestEnsorcelledReturn = scored;
            }
            if (improvesBadTerrain(context.units, scored, context.terrain)
                && (!bestTerrainEscape || scored.score > bestTerrainEscape.score)) {
                bestTerrainEscape = scored;
            }
            if (clearsWaterExposure(context.units, scored, context.terrain)
                && (!bestWaterClear || scored.score > bestWaterClear.score)) {
                bestWaterClear = scored;
            }
        });

        return resolveBestCandidate(context, best, bestTerrainEscape, bestWaterClear, bestReserveDeploy, bestEnsorcelledReturn);
    }


    function findBestAutoMove(context) {
        const candidates = collectExtendedMoveCandidates(context);
        const forwardCache = new Map();
        return pickBestCandidate(context, candidates, forwardCache);
    }


    async function findBestAutoMoveAsync(context, hooks = {}) {
        const {
            shouldCancel,
            onProgress,
            yieldEvery = 1
        } = hooks;
        let lastYieldAt = nowMs();

        onProgress?.({
            phase: 'gathering',
            message: 'Gathering candidate moves…',
            current: 0,
            total: 0
        });
        await yieldToBrowser();
        lastYieldAt = nowMs();
        if (shouldCancel?.()) {
            return { cancelled: true, suggestion: null };
        }

        const candidates = collectExtendedMoveCandidates(context);
        const forwardCache = new Map();
        let best = null;
        let bestTerrainEscape = null;
        let bestWaterClear = null;
        let bestReserveDeploy = null;
        let bestEnsorcelledReturn = null;

        onProgress?.({
            phase: 'searching',
            message: `Evaluating ${candidates.length} candidate move${candidates.length === 1 ? '' : 's'}…`,
            current: 0,
            total: candidates.length
        });
        await yieldToBrowser();
        lastYieldAt = nowMs();
        if (shouldCancel?.()) {
            return { cancelled: true, suggestion: null };
        }

        for (let index = 0; index < candidates.length; index += 1) {
            if (shouldCancel?.()) {
                return { cancelled: true, suggestion: null };
            }

            const candidate = candidates[index];
            const moveLabel = candidate.moveKind === 'forward'
                ? describeCandidateGroup(candidate.unitIds, context.units)
                : `${describeCandidateGroup(candidate.unitIds, context.units)} ${candidate.moveKind}`;
            onProgress?.({
                phase: 'evaluating',
                message: `Scoring ${moveLabel} (${index + 1}/${candidates.length})`,
                current: index + 1,
                total: candidates.length,
                bestScore: best?.score ?? null
            });

            const scored = simulateMoveCandidate(context, candidate, forwardCache);
            if (scored) {
                if (!best || scored.score > best.score) {
                    best = scored;
                }
                if (candidate.moveKind === 'reserve-deploy'
                    && (!bestReserveDeploy || scored.score > bestReserveDeploy.score)) {
                    bestReserveDeploy = scored;
                }
                if (candidate.moveKind === 'ensorcelled-return'
                    && (!bestEnsorcelledReturn || scored.score > bestEnsorcelledReturn.score)) {
                    bestEnsorcelledReturn = scored;
                }
                if (improvesBadTerrain(context.units, scored, context.terrain)
                    && (!bestTerrainEscape || scored.score > bestTerrainEscape.score)) {
                    bestTerrainEscape = scored;
                }
                if (clearsWaterExposure(context.units, scored, context.terrain)
                    && (!bestWaterClear || scored.score > bestWaterClear.score)) {
                    bestWaterClear = scored;
                }
            }

            if (index % yieldEvery === yieldEvery - 1 || index === candidates.length - 1) {
                await yieldToBrowser();
                lastYieldAt = nowMs();
            } else {
                lastYieldAt = await yieldIfOverBudget(lastYieldAt);
            }
        }

        const suggestion = resolveBestCandidate(
            context,
            best,
            bestTerrainEscape,
            bestWaterClear,
            bestReserveDeploy,
            bestEnsorcelledReturn
        );
        return { cancelled: false, suggestion };
    }


    function describeAutoMoveUnits(unitIds, units) {
        return unitIds.map((unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (!unit) {
                return unitId;
            }
            return `${unit.type} (${unitId})`;
        });
    }


    function describeAutoMoveSuggestion(suggestion, units) {
        return {
            unitIds: [...suggestion.unitIds],
            units: describeAutoMoveUnits(suggestion.unitIds, units),
            formationType: suggestion.analysis.type,
            moveKind: suggestion.moveKind || 'forward',
            moveParam: suggestion.moveParam ?? null,
            distanceMm: Math.round(suggestion.distance || 0),
            score: suggestion.score,
            breakdown: { ...suggestion.breakdown }
        };
    }


    function describeAutoMoveAction(suggestion) {
        const moveKind = suggestion.moveKind || 'forward';
        if (moveKind === 'forward') {
            return `forward ${Math.round(suggestion.distance || 0)} mm`;
        }
        if (moveKind === 'reverse') {
            return 'reverse';
        }
        if (moveKind === 'convert') {
            return 'convert';
        }
        if (moveKind === 'wheel-left' || moveKind === 'wheel-right') {
            const degrees = Math.round(((suggestion.moveParam || 0) * 180) / Math.PI);
            return `wheel ${degrees}° ${moveKind === 'wheel-left' ? 'left' : 'right'}`;
        }
        if (moveKind === 'sidestep-left' || moveKind === 'sidestep-right') {
            return `sidestep ${Math.round(suggestion.distance || 0)} mm ${moveKind === 'sidestep-left' ? 'left' : 'right'}`;
        }
        if (moveKind === 'reserve-deploy') {
            return 'reserve deploy';
        }
        if (moveKind === 'ensorcelled-return') {
            return 'ensorcelled return';
        }
        return moveKind;
    }


    function formatAutoMoveStatus(suggestion, units) {
        const primary = units.find((unit) => unit.id === suggestion.unitIds[0]);
        const typeLabel = primary?.type || 'Unit';
        const countLabel = suggestion.unitIds.length > 1 ? ` (${suggestion.unitIds.length})` : '';
        const parts = [
            formatBreakdownValue('fight', suggestion.breakdown.fight),
            formatBreakdownValue('matchup', suggestion.breakdown.matchup),
            formatBreakdownValue('mods', suggestion.breakdown.modifiers),
            formatBreakdownValue('contact', suggestion.breakdown.newContact),
            formatBreakdownValue('dress', suggestion.breakdown.dress),
            formatBreakdownValue('formation', suggestion.breakdown.formationSize),
            formatBreakdownValue('stack', suggestion.breakdown.stackBreak),
            formatBreakdownValue('recoil', suggestion.breakdown.recoilDeath),
            formatBreakdownValue('pinch', suggestion.breakdown.pinchRelief),
            formatBreakdownValue('reserve', suggestion.breakdown.reserveEntry),
            formatBreakdownValue('ensorcel', suggestion.breakdown.ensorcelledReturn),
            formatBreakdownValue('advance', suggestion.breakdown.advance),
            formatBreakdownValue('cohesion', suggestion.breakdown.cohesion),
            formatBreakdownValue('terrain', suggestion.breakdown.terrain)
        ].filter(Boolean);
        return `Auto Move: ${typeLabel}${countLabel} ${describeAutoMoveAction(suggestion)} (${parts.join(', ')}).`;
    }


    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            openAutoMoveModal(message) {
                this.state.autoMoveModalOpen = true;
                this.state.autoMoveInProgress = true;
                this.state.autoMoveAwaitingAck = false;
                if (this.ui.autoMoveTitle) {
                    this.ui.autoMoveTitle.textContent = 'Auto Move';
                }
                if (this.ui.autoMoveProgressText) {
                    this.ui.autoMoveProgressText.textContent = message || 'Preparing auto move…';
                }
                if (this.ui.autoMoveModal) {
                    this.ui.autoMoveModal.hidden = false;
                }
                this.syncUiFromState();
            },

            updateAutoMoveProgress(info) {
                if (this.ui.autoMoveProgressText && info?.message) {
                    this.ui.autoMoveProgressText.textContent = info.message;
                }
            },

            showAutoMoveNoMovesAcknowledgement() {
                this.state.autoMoveInProgress = false;
                this.state.autoMoveAwaitingAck = true;
                this._autoMoveCancelToken = null;
                if (this.ui.autoMoveTitle) {
                    this.ui.autoMoveTitle.textContent = 'No Good Move';
                }
                if (this.ui.autoMoveProgressText) {
                    this.ui.autoMoveProgressText.textContent = 'No beneficial forward move was found for any unmoved formation. Move manually or end the move phase when ready.';
                }
                this.syncUiFromState();
            },

            acknowledgeAutoMoveModal() {
                if (!this.state.autoMoveAwaitingAck) {
                    return;
                }
                this.state.autoMoveAwaitingAck = false;
                this.closeAutoMoveModal();
                this.updateStatus('Auto Move: no beneficial forward move found.');
                this.syncUiFromState();
                this.requestRender();
            },

            closeAutoMoveModal() {
                this.state.autoMoveModalOpen = false;
                this.state.autoMoveInProgress = false;
                this.state.autoMoveAwaitingAck = false;
                this._autoMoveCancelToken = null;
                if (this.ui.autoMoveModal) {
                    this.ui.autoMoveModal.hidden = true;
                }
                this.syncUiFromState();
            },

            cancelAutoMoveSearch() {
                if (this._autoMoveCancelToken) {
                    this._autoMoveCancelToken.cancelled = true;
                }
                if (this._computerMoveCancelToken) {
                    this._computerMoveCancelToken.cancelled = true;
                }
                this.updateAutoMoveProgress({ message: 'Cancelling…' });
            },

            applyAutoMoveSuggestion(suggestion) {
                if (!suggestion) {
                    return false;
                }
                if (suggestion.moveKind === 'reserve-deploy' || suggestion.moveKind === 'ensorcelled-return') {
                    const reserveUnit = this.getReserveUnits().find((entry) => entry.id === suggestion.reserveUnitId);
                    const deployX = suggestion.moveKind === 'ensorcelled-return' && suggestion.localReturn
                        ? this.getDefaultReserveDeployWorldX()
                        : suggestion.moveParam;
                    if (!reserveUnit || !this.beginReserveDeploy(reserveUnit, deployX)) {
                        this.updateStatus('Auto Move: reserve deployment could not be started.');
                        return false;
                    }
                    if (suggestion.localReturn) {
                        const trialUnit = suggestion.afterUnits.find((entry) => entry.id === suggestion.unitIds[0]);
                        const liveUnit = this.getUnitById(suggestion.unitIds[0]);
                        if (trialUnit && liveUnit) {
                            liveUnit.x = trialUnit.x;
                            liveUnit.y = trialUnit.y;
                            liveUnit.rotation = trialUnit.rotation;
                        }
                        this.evaluateDraft();
                        if (this.state.draft?.invalidIds?.size > 0) {
                            this.cancelDraft(false);
                            this.updateStatus('Auto Move: the suggested ensorcelled return could not be applied.');
                            return false;
                        }
                    }
                    this.finishDraft();
                    this.updateStatus(formatAutoMoveStatus(suggestion, this.state.units));
                    return true;
                }

                const computerActive = typeof this.canLocallyControl === 'function'
                    && !this.canLocallyControl(this.state.activePlayerId);
                if (computerActive) {
                    this.state.selectionAnalysis = suggestion.analysis || rules.analyzeSelection(
                        suggestion.unitIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean)
                    );
                } else {
                    this.state.selectedIds = [...suggestion.unitIds];
                    this.updateSelectionAnalysis();
                }
                if (!this.ensureDraft(suggestion.unitIds)) {
                    this.updateStatus('Auto Move: could not start the suggested draft.');
                    return false;
                }

                const ghostSnapshot = geometry.snapshotPositions(suggestion.unitIds, this.state.units);

                if (suggestion.moveKind === 'forward') {
                    const actualDistance = this.findMaxForwardDistance();
                    if (actualDistance === null || actualDistance <= 0.05) {
                        this.cancelDraft(false);
                        this.updateStatus('Auto Move: the suggested move is not legal on the board.');
                        return false;
                    }
                    const appliedDistance = Math.min(suggestion.distance, actualDistance);
                    const applied = this.applyForwardMove(appliedDistance);
                    if (!applied) {
                        this.cancelDraft(false);
                        this.updateStatus('Auto Move: the suggested move could not be applied.');
                        return false;
                    }
                    suggestion.distance = appliedDistance;
                } else {
                    suggestion.unitIds.forEach((unitId) => {
                        const trialUnit = suggestion.afterUnits.find((entry) => entry.id === unitId);
                        const liveUnit = this.getUnitById(unitId);
                        if (trialUnit && liveUnit) {
                            liveUnit.x = trialUnit.x;
                            liveUnit.y = trialUnit.y;
                            liveUnit.rotation = trialUnit.rotation;
                        }
                    });
                    this.evaluateDraft();
                    if (this.state.draft.invalidIds.size > 0) {
                        this.cancelDraft(false);
                        this.updateStatus('Auto Move: the suggested move could not be applied.');
                        return false;
                    }
                    if (suggestion.moveKind !== 'reverse' || suggestion.analysis.type !== 'single') {
                        this.commitDraftStep();
                    }
                }

                this.finishDraft();
                this.state.autoMoveGhost = {
                    unitIds: [...suggestion.unitIds],
                    ghostSnapshot
                };
                this.updateStatus(formatAutoMoveStatus(suggestion, this.state.units));
                return true;
            },

            async playComputerMove() {
                if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                    return 'idle';
                }
                if (typeof this.isGameOver === 'function' && this.isGameOver()) {
                    return 'idle';
                }
                if (this.state.remainingMoves <= 0) {
                    return 'end-phase';
                }

                const cancelToken = { cancelled: false };
                this._computerMoveCancelToken = cancelToken;
                this.cancelDraft(false);

                const searchContext = {
                    units: this.state.units,
                    terrain: this.state.terrain,
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    getPlayerId: (unit) => this.getUnitPlayerId(unit),
                    snapEnabled: this.state.snapEnabled,
                    reserveUnits: this.getReserveUnits(),
                    getHomeEdge: (playerId) => this.getHomeEdge(playerId)
                };
                const searchResult = await findBestAutoMoveAsync(searchContext, {
                    shouldCancel: () => cancelToken.cancelled || Boolean(this.state.controllerPaused),
                    yieldEvery: 1,
                    onProgress: (info) => {
                        if (typeof this.setComputerThinking === 'function') {
                            this.setComputerThinking(this.state.activePlayerId, info.message);
                        }
                    }
                });
                this._computerMoveCancelToken = null;
                if (searchResult.cancelled || this.state.controllerPaused) {
                    return 'paused';
                }
                if (!searchResult.suggestion) {
                    return 'end-phase';
                }
                const applied = this.applyAutoMoveSuggestion(searchResult.suggestion);
                this.syncUiFromState();
                this.requestRender();
                return applied ? 'moved' : 'end-phase';
            },

            maybeClearAutoMoveGhost() {
                const ghost = this.state.autoMoveGhost;
                if (!ghost) {
                    return;
                }
                if (!geometry.sameIdSet(this.state.selectedIds, ghost.unitIds)) {
                    this.state.autoMoveGhost = null;
                    this.requestRender();
                }
            },

            async autoMove() {
                if (this.state.autoMoveInProgress) {
                    return;
                }
                if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                    this.updateStatus('Auto Move is only available during the move phase.');
                    return;
                }
                if (typeof this.isGameOver === 'function' && this.isGameOver()) {
                    this.updateStatus('Auto Move is unavailable after the battle ends.');
                    return;
                }
                if (this.state.remainingMoves <= 0) {
                    this.updateStatus('No moves remain for the active side.');
                    return;
                }

                const startedAt = (typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now();
                const cancelToken = { cancelled: false };
                this._autoMoveCancelToken = cancelToken;

                this.openAutoMoveModal('Gathering candidate formations…');
                await yieldToBrowser();

                const candidateGroups = collectExtendedMoveCandidates({
                    units: this.state.units,
                    terrain: this.state.terrain,
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    getPlayerId: (unit) => this.getUnitPlayerId(unit),
                    reserveUnits: this.getReserveUnits(),
                    getHomeEdge: (playerId) => this.getHomeEdge(playerId)
                });
                console.log('[Auto Move] start', {
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    snapEnabled: this.state.snapEnabled,
                    candidateGroups: candidateGroups.length,
                    unmovedUnits: this.state.units.filter((unit) => (
                        this.getUnitPlayerId(unit) === this.state.activePlayerId
                        && !unit.movedThisTurn
                        && !unit.inReserve
                    )).map((unit) => `${unit.type} (${unit.id})`)
                });

                this.cancelDraft(false);

                const searchContext = {
                    units: this.state.units,
                    terrain: this.state.terrain,
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    getPlayerId: (unit) => this.getUnitPlayerId(unit),
                    snapEnabled: this.state.snapEnabled,
                    reserveUnits: this.getReserveUnits(),
                    getHomeEdge: (playerId) => this.getHomeEdge(playerId)
                };

                const searchResult = await findBestAutoMoveAsync(searchContext, {
                    shouldCancel: () => cancelToken.cancelled,
                    yieldEvery: 1,
                    onProgress: (info) => this.updateAutoMoveProgress(info)
                });

                const searchElapsedMs = ((typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now()) - startedAt;
                console.log('[Auto Move] search complete', {
                    elapsedMs: Math.round(searchElapsedMs),
                    candidateGroups: candidateGroups.length,
                    found: Boolean(searchResult.suggestion),
                    cancelled: searchResult.cancelled
                });

                if (searchResult.cancelled) {
                    console.log('[Auto Move] end', { result: 'cancelled', elapsedMs: Math.round(searchElapsedMs) });
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move cancelled.');
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }

                const suggestion = searchResult.suggestion;
                if (!suggestion) {
                    console.log('[Auto Move] end', {
                        result: 'no-move',
                        reason: 'no beneficial forward move found',
                        elapsedMs: Math.round(searchElapsedMs)
                    });
                    this.showAutoMoveNoMovesAcknowledgement();
                    return;
                }

                console.log('[Auto Move] planned', describeAutoMoveSuggestion(suggestion, this.state.units));
                this.state.autoMovePreview = {
                    afterUnits: suggestion.afterUnits.map((unit) => ({ ...unit })),
                    unitIds: [...suggestion.unitIds]
                };
                this.updateAutoMoveProgress({ message: 'Previewing the best move…' });
                this.requestRender();
                await yieldToBrowser();

                if (cancelToken.cancelled) {
                    this.state.autoMovePreview = null;
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move cancelled.');
                    return;
                }

                this.updateAutoMoveProgress({ message: 'Applying the best move…' });
                await yieldToBrowser();

                if (cancelToken.cancelled) {
                    this.state.autoMovePreview = null;
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move cancelled.');
                    return;
                }

                this.state.autoMovePreview = null;
                const applied = this.applyAutoMoveSuggestion(suggestion);
                console.log('[Auto Move] end', {
                    result: applied ? 'success' : 'failed',
                    planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                    remainingMoves: this.state.remainingMoves,
                    elapsedMs: Math.round(((typeof performance !== 'undefined' && performance.now)
                        ? performance.now()
                        : Date.now()) - startedAt)
                });
                this.closeAutoMoveModal();
                this.syncUiFromState();
                this.requestRender();
            }
        });
    }


    return {
        MIN_BENEFIT,
        findBestAutoMove,
        findBestAutoMoveAsync,
        install,
        formatAutoMoveStatus
    };
}));
