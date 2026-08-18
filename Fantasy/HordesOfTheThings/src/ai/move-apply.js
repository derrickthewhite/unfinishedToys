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


    function yieldToBrowser() {
        return new Promise((resolve) => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => resolve());
                return;
            }
            setTimeout(resolve, 0);
        });
    }


    function scoreCandidateGroup(context, group, forwardCache) {
        return simulateMoveCandidate(context, { ...group, moveKind: 'forward', moveParam: null }, forwardCache);
    }


    function findBestAutoMove(context) {
        const candidates = collectExtendedMoveCandidates(context);
        const forwardCache = new Map();
        let best = null;

        candidates.forEach((candidate) => {
            const scored = simulateMoveCandidate(context, candidate, forwardCache);
            if (!scored) {
                return;
            }
            if (!best || scored.score > best.score) {
                best = scored;
            }
        });

        if (!best || best.score < MIN_BENEFIT) {
            return null;
        }
        return best;
    }


    async function findBestAutoMoveAsync(context, hooks = {}) {
        const {
            shouldCancel,
            onProgress,
            yieldEvery = 6
        } = hooks;
        const candidates = collectExtendedMoveCandidates(context);
        const forwardCache = new Map();
        let best = null;

        onProgress?.({
            phase: 'searching',
            message: `Evaluating ${candidates.length} candidate move${candidates.length === 1 ? '' : 's'}…`,
            current: 0,
            total: candidates.length
        });
        await yieldToBrowser();
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
            if (scored && (!best || scored.score > best.score)) {
                best = scored;
            }

            if (index % yieldEvery === yieldEvery - 1 || index === candidates.length - 1) {
                await yieldToBrowser();
            }
        }

        if (!best || best.score < MIN_BENEFIT) {
            return { cancelled: false, suggestion: null };
        }
        return { cancelled: false, suggestion: best };
    }


    function describeDraftInvalidReasons(draft) {
        if (!draft) {
            return [];
        }
        return [...draft.unitIds].map((unitId) => ({
            unitId,
            reason: draft.reasonById?.get(unitId) || null,
            invalid: draft.invalidIds?.has(unitId) || false
        })).filter((entry) => entry.invalid || entry.reason);
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
        if (moveKind === 'reserve-deploy') {
            return 'reserve deploy';
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
                this.updateAutoMoveProgress({ message: 'Cancelling…' });
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

                if (suggestion.moveKind === 'reserve-deploy') {
                    const reserveUnit = this.getReserveUnits().find((entry) => entry.id === suggestion.reserveUnitId);
                    if (!reserveUnit || !this.beginReserveDeploy(reserveUnit, suggestion.moveParam)) {
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: reserve deployment could not be started.');
                        this.syncUiFromState();
                        return;
                    }
                    this.finishDraft();
                    this.closeAutoMoveModal();
                    this.updateStatus(formatAutoMoveStatus(suggestion, this.state.units));
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }

                this.state.selectedIds = [...suggestion.unitIds];
                this.updateSelectionAnalysis();
                if (!this.ensureDraft(suggestion.unitIds)) {
                    console.log('[Auto Move] end', {
                        result: 'failed',
                        reason: 'could not start draft',
                        planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                        elapsedMs: Math.round(searchElapsedMs)
                    });
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move: could not start the suggested draft.');
                    this.syncUiFromState();
                    return;
                }

                const ghostSnapshot = geometry.snapshotPositions(suggestion.unitIds, this.state.units);

                if (suggestion.moveKind === 'forward') {
                    const actualDistance = this.findMaxForwardDistance();
                    if (actualDistance === null || actualDistance <= 0.05) {
                        const invalidReasons = describeDraftInvalidReasons(this.state.draft);
                        this.cancelDraft(false);
                        console.log('[Auto Move] end', {
                            result: 'failed',
                            reason: 'no legal forward distance after opening draft',
                            planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                            simulatedDistanceMm: Math.round(suggestion.distance),
                            actualDistance,
                            invalidReasons,
                            elapsedMs: Math.round(searchElapsedMs)
                        });
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: the suggested move is not legal on the board.');
                        this.syncUiFromState();
                        return;
                    }

                    const appliedDistance = Math.min(suggestion.distance, actualDistance);
                    if (appliedDistance < suggestion.distance - 0.05) {
                        console.log('[Auto Move] distance clamped', {
                            plannedDistanceMm: Math.round(suggestion.distance),
                            actualDistanceMm: Math.round(actualDistance),
                            appliedDistanceMm: Math.round(appliedDistance)
                        });
                    }

                    const applied = this.applyForwardMove(appliedDistance);
                    if (!applied) {
                        const invalidReasons = describeDraftInvalidReasons(this.state.draft);
                        this.cancelDraft(false);
                        console.log('[Auto Move] end', {
                            result: 'failed',
                            reason: 'applyForwardMove rejected the planned distance',
                            planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                            simulatedDistanceMm: Math.round(suggestion.distance),
                            actualDistanceMm: Math.round(actualDistance),
                            appliedDistanceMm: Math.round(appliedDistance),
                            invalidReasons,
                            elapsedMs: Math.round(searchElapsedMs)
                        });
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: the suggested move could not be applied.');
                        this.syncUiFromState();
                        return;
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
                        const invalidReasons = describeDraftInvalidReasons(this.state.draft);
                        this.cancelDraft(false);
                        console.log('[Auto Move] end', {
                            result: 'failed',
                            reason: 'simulated alternate move rejected on apply',
                            planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                            invalidReasons,
                            elapsedMs: Math.round(searchElapsedMs)
                        });
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: the suggested move could not be applied.');
                        this.syncUiFromState();
                        return;
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
                console.log('[Auto Move] end', {
                    result: 'success',
                    moved: describeAutoMoveSuggestion(suggestion, this.state.units),
                    remainingMoves: this.state.remainingMoves,
                    elapsedMs: Math.round(((typeof performance !== 'undefined' && performance.now)
                        ? performance.now()
                        : Date.now()) - startedAt),
                    movedThisTurn: suggestion.unitIds.map((unitId) => {
                        const unit = this.getUnitById(unitId);
                        return {
                            id: unitId,
                            type: unit?.type || null,
                            movedThisTurn: Boolean(unit?.movedThisTurn)
                        };
                    })
                });
                this.closeAutoMoveModal();
                this.updateStatus(formatAutoMoveStatus(suggestion, this.state.units));
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
