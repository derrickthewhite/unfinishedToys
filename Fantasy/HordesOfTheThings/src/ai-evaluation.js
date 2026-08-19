(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./ai/move.js'));
        return;
    }
    root.HordesAiEvaluation = factory(root.HordesMoveAi);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (moveAi) {
    const { MIN_BENEFIT, scoreAllMoveCandidatesAsync } = moveAi;

    function buildEvaluationAfterUnit(scored, focusUnitId) {
        const direct = scored.afterUnits.find((unit) => unit.id === focusUnitId);
        if (direct) {
            return direct;
        }
        if (scored.unitIds.includes(focusUnitId)) {
            return scored.afterUnits.find((unit) => unit.id === focusUnitId) || null;
        }
        if (scored.reserveUnitId === focusUnitId) {
            return scored.afterUnits.find((unit) => unit.id === focusUnitId) || null;
        }
        return null;
    }

    function decorateEvaluationCandidates(candidates, focusUnitId) {
        return candidates.map((entry, index) => ({
            index,
            label: entry.label,
            score: entry.score,
            breakdown: entry.breakdown,
            elapsedMs: entry.elapsedMs,
            moveKind: entry.moveKind,
            moveParam: entry.moveParam ?? null,
            distance: entry.distance || 0,
            unitIds: [...entry.unitIds],
            afterUnit: buildEvaluationAfterUnit(entry, focusUnitId)
        })).filter((entry) => entry.afterUnit);
    }

    function formatEvaluationStatus(state, unit) {
        const evaluation = state.moveEvaluation;
        if (!state.aiEvaluationMode) {
            return null;
        }
        if (!unit) {
            return 'AI Eval: select one friendly unit to inspect move scores.';
        }
        if (!evaluation || evaluation.unitId !== unit.id) {
            return `AI Eval: scoring moves for ${unit.type}…`;
        }
        if (evaluation.loading) {
            const progress = evaluation.progressTotal
                ? ` (${evaluation.progressCurrent}/${evaluation.progressTotal})`
                : '';
            return `AI Eval: scoring moves for ${unit.type}${progress}…`;
        }
        const countLabel = `${evaluation.candidates.length} candidate${evaluation.candidates.length === 1 ? '' : 's'}`;
        const timeLabel = `${Math.round(evaluation.elapsedMs)} ms`;
        if (evaluation.candidates.length === 0) {
            return `AI Eval: no legal moves for ${unit.type} (${timeLabel}).`;
        }
        const best = evaluation.candidates[0];
        return `AI Eval: ${countLabel} for ${unit.type} in ${timeLabel} — best ${best.label} (${best.score.toFixed(2)}).`;
    }

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            buildMoveEvaluationContext() {
                return {
                    units: this.state.units,
                    terrain: this.state.terrain,
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    getPlayerId: (unit) => this.getUnitPlayerId(unit),
                    snapEnabled: this.state.snapEnabled,
                    reserveUnits: this.getReserveUnits(),
                    getHomeEdge: (playerId) => this.getHomeEdge(playerId)
                };
            },

            canRunAiEvaluation() {
                return this.state.setupStage === 'game'
                    && this.state.phase === 'move'
                    && !this.isGameOver();
            },

            getAiEvaluationFocusUnit() {
                if (this.state.selectedIds.length !== 1) {
                    return null;
                }
                const unit = this.getUnitById(this.state.selectedIds[0]);
                if (!unit) {
                    return null;
                }
                if (this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                    return null;
                }
                if (unit.inReserve) {
                    return unit;
                }
                if (unit.movedThisTurn) {
                    return null;
                }
                return unit;
            },

            toggleAiEvaluationMode() {
                this.state.aiEvaluationMode = !this.state.aiEvaluationMode;
                if (!this.state.aiEvaluationMode) {
                    this.cancelAiEvaluationRefresh();
                    this.state.moveEvaluation = null;
                } else {
                    this.scheduleAiEvaluationRefresh();
                }
                this.syncUiFromState();
                this.requestRender();
            },

            cancelAiEvaluationRefresh() {
                this._aiEvaluationToken = (this._aiEvaluationToken || 0) + 1;
            },

            scheduleAiEvaluationRefresh() {
                if (!this.state.aiEvaluationMode) {
                    return;
                }
                this.cancelAiEvaluationRefresh();
                const token = this._aiEvaluationToken;
                void this.refreshAiEvaluation(token);
            },

            async refreshAiEvaluation(token = this._aiEvaluationToken) {
                if (!this.state.aiEvaluationMode || token !== this._aiEvaluationToken) {
                    return;
                }

                const unit = this.getAiEvaluationFocusUnit();
                if (!unit || !this.canRunAiEvaluation()) {
                    this.state.moveEvaluation = unit && this.state.aiEvaluationMode
                        ? {
                            unitId: unit.id,
                            loading: false,
                            elapsedMs: 0,
                            candidates: [],
                            error: this.canRunAiEvaluation() ? null : 'Move phase required.'
                        }
                        : null;
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }

                this.state.moveEvaluation = {
                    unitId: unit.id,
                    loading: true,
                    elapsedMs: 0,
                    progressCurrent: 0,
                    progressTotal: 0,
                    candidates: []
                };
                this.syncUiFromState();
                this.requestRender();

                const result = await scoreAllMoveCandidatesAsync(
                    this.buildMoveEvaluationContext(),
                    { unitId: unit.id },
                    {
                        shouldCancel: () => token !== this._aiEvaluationToken || !this.state.aiEvaluationMode,
                        onProgress: (info) => {
                            if (token !== this._aiEvaluationToken) {
                                return;
                            }
                            this.state.moveEvaluation = {
                                ...this.state.moveEvaluation,
                                progressCurrent: info.current,
                                progressTotal: info.total
                            };
                            this.syncUiFromState();
                        },
                        yieldEvery: 4
                    }
                );

                if (token !== this._aiEvaluationToken || !this.state.aiEvaluationMode) {
                    return;
                }

                this.state.moveEvaluation = {
                    unitId: unit.id,
                    loading: false,
                    elapsedMs: result.elapsedMs,
                    evaluatedCount: result.evaluatedCount,
                    totalCount: result.totalCount,
                    cancelled: result.cancelled,
                    candidates: decorateEvaluationCandidates(result.candidates, unit.id)
                };
                this.syncUiFromState();
                this.requestRender();
            },

            refreshAiEvaluationIfEnabled() {
                if (!this.state.aiEvaluationMode) {
                    return;
                }
                this.scheduleAiEvaluationRefresh();
            },

            formatEvaluationBubbleLines(entry) {
                const scoreText = entry.score.toFixed(2);
                const benefitMark = entry.score >= MIN_BENEFIT ? ' ✓' : '';
                const timingText = `${Math.round(entry.elapsedMs)} ms`;
                return {
                    title: entry.label,
                    scoreLine: `${scoreText}${benefitMark}`,
                    timingLine: timingText
                };
            }
        });
    }

    return { install, formatEvaluationStatus, MIN_BENEFIT };
}));
