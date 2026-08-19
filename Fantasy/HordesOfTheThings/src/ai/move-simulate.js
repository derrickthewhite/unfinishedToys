(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('../rules/index.js'),
            require('../formation.js'),
            require('./move-candidates.js'),
            require('./move-score.js')
        );
        return;
    }
    root.HordesMoveAiSimulate = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesFormation, root.HordesMoveAiCandidates, root.HordesMoveAiScore);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, formation, candidates, score) {
    const {
        buildRankFromLead,
        buildConvertedFormationCandidates
    } = formation;

    const {
        getOpponentPlayerId
    } = candidates;

    const {
        scoreCandidate
    } = score;
    const FORWARD_PROBE_STEP = 5;


    function cloneUnits(units) {
        return units.map((unit) => ({ ...unit }));
    }


    function applyForwardDistance(units, analysis, unitIds, base, distance) {
        const nextUnits = cloneUnits(units);
        const byId = new Map(nextUnits.map((unit) => [unit.id, unit]));
        const forward = analysis.forward;
        const moveDelta = geometry.scaleVector(forward, distance);

        if (analysis.type === 'single') {
            const unit = byId.get(unitIds[0]);
            const origin = base[unitIds[0]];
            unit.x = origin.x + moveDelta.x;
            unit.y = origin.y + moveDelta.y;
            return nextUnits;
        }

        if (analysis.type === 'rank') {
            unitIds.forEach((unitId) => {
                const unit = byId.get(unitId);
                const origin = base[unitId];
                unit.x = origin.x + moveDelta.x;
                unit.y = origin.y + moveDelta.y;
            });
            return nextUnits;
        }

        const orderedIds = analysis.orderedIds;
        const lead = byId.get(orderedIds[0]);
        const leadBase = base[orderedIds[0]];
        lead.x = leadBase.x + moveDelta.x;
        lead.y = leadBase.y + moveDelta.y;
        lead.rotation = leadBase.rotation;
        for (let index = 1; index < orderedIds.length; index += 1) {
            const previousUnit = byId.get(orderedIds[index - 1]);
            const follower = byId.get(orderedIds[index]);
            const followerBase = base[orderedIds[index]];
            const previousCorners = geometry.getUnitCorners(previousUnit);
            follower.x = previousCorners.backLeft.x;
            follower.y = previousCorners.backLeft.y;
            follower.rotation = followerBase.rotation;
        }
        return nextUnits;
    }


    function buildProbeDraft(unitIds, base) {
        return {
            unitIds: [...unitIds],
            initialOrigin: base,
            validationOrigin: base,
            origin: base,
            history: [],
            invalidIds: new Set(),
            reasonById: new Map(),
            cornerViolations: []
        };
    }


    function applySnapToTrialUnits(units, unitIds, snapEnabled) {
        if (!snapEnabled || unitIds.length === 0) {
            return units;
        }
        const movingIdSet = new Set(unitIds);
        const movingUnits = unitIds
            .map((unitId) => units.find((unit) => unit.id === unitId))
            .filter(Boolean);
        if (movingUnits.length === 0) {
            return units;
        }
        const stationaryUnits = units.filter((unit) => !movingIdSet.has(unit.id));
        const snapOffset = geometry.findFriendlySnapOffset(movingUnits, stationaryUnits);
        if (!snapOffset) {
            return units;
        }
        return units.map((unit) => (
            movingIdSet.has(unit.id)
                ? { ...unit, x: unit.x + snapOffset.x, y: unit.y + snapOffset.y }
                : unit
        ));
    }


    function mergeTrialUnits(units, unitIds, trialUnits) {
        const trialById = new Map(trialUnits.map((unit) => [unit.id, unit]));
        return units.map((unit) => (
            trialById.has(unit.id) ? { ...unit, ...trialById.get(unit.id) } : unit
        ));
    }


    function isTrialBoardLegal(units, terrain, unitIds, base) {
        const draft = buildProbeDraft(unitIds, base);
        return rules.validateDraftState(draft, units, terrain).invalidIds.size === 0;
    }


    function applyReverseTrial(units, analysis, unitIds) {
        const next = cloneUnits(units);
        const byId = new Map(next.map((unit) => [unit.id, unit]));
        if (analysis.type === 'rank') {
            const ordered = analysis.orderedIds.map((unitId) => byId.get(unitId)).filter(Boolean);
            const reversedRotation = geometry.normalizeAngle(ordered[0].rotation + Math.PI);
            const centers = ordered.map((unit) => geometry.getUnitCenter(unit));
            const formationCenter = {
                x: geometry.average(centers.map((center) => center.x)),
                y: geometry.average(centers.map((center) => center.y))
            };
            const frontAnchor = geometry.add(
                formationCenter,
                geometry.scaleVector(
                    geometry.getForwardVector(reversedRotation),
                    geometry.average(ordered.map((unit) => unit.depth)) / 2
                )
            );
            buildRankFromLead([...ordered].reverse(), reversedRotation, frontAnchor).forEach((candidateUnit) => {
                Object.assign(byId.get(candidateUnit.id), candidateUnit);
            });
        } else {
            unitIds.forEach((unitId) => {
                Object.assign(byId.get(unitId), geometry.reverseUnitFacing(byId.get(unitId)));
            });
        }
        return next;
    }


    function applyWheelTrial(units, analysis, unitIds, base, moveKind, angleRadians) {
        const pivot = moveKind === 'wheel-left' ? analysis.leftPivot : analysis.rightPivot;
        const delta = moveKind === 'wheel-left' ? -Math.abs(angleRadians) : Math.abs(angleRadians);
        return unitIds.map((unitId) => {
            const origin = base[unitId];
            const frontLeft = geometry.rotatePoint({ x: origin.x, y: origin.y }, pivot, delta);
            return {
                ...units.find((unit) => unit.id === unitId),
                id: unitId,
                x: frontLeft.x,
                y: frontLeft.y,
                rotation: geometry.normalizeAngle(origin.rotation + delta)
            };
        });
    }


    function applyConvertTrial(units, analysis, unitIds) {
        const selected = unitIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
        const candidates = buildConvertedFormationCandidates(selected, analysis);
        for (let index = 0; index < candidates.length; index += 1) {
            const next = cloneUnits(units);
            const byId = new Map(next.map((unit) => [unit.id, unit]));
            candidates[index].converted.forEach((candidateUnit) => {
                Object.assign(byId.get(candidateUnit.id), candidateUnit);
            });
            return next;
        }
        return null;
    }


    function getHomeEdgeRotation(homeEdge) {
        return homeEdge === 'bottom' ? 0 : Math.PI;
    }


    function applyReserveDeployPose(unit, playerId, worldX, homeEdge) {
        const posed = { ...unit };
        const left = geometry.clamp(worldX - (posed.width / 2), 0, data.BOARD_SIZE - posed.width);
        if (homeEdge === 'bottom') {
            posed.x = left;
            posed.y = data.BOARD_SIZE - posed.depth;
            posed.rotation = 0;
            return posed;
        }
        posed.x = left + posed.width;
        posed.y = posed.depth;
        posed.rotation = Math.PI;
        return posed;
    }


    function isReserveDeployLegal(unit, boardUnits, terrain, playerId, getPlayerId, homeEdge) {
        const expectedRotation = getHomeEdgeRotation(homeEdge);
        if (Math.abs(geometry.normalizeAngle(unit.rotation - expectedRotation)) > 0.01) {
            return false;
        }
        const corners = geometry.getUnitCorners(unit);
        const others = boardUnits.filter((other) => other.id !== unit.id);
        if (others.some((other) => geometry.polygonsOverlap(corners, geometry.getUnitCorners(other)))) {
            return false;
        }
        const terrainTypes = rules.sampleUnitTerrain(unit, terrain);
        if (terrainTypes.has('impassable')) {
            return false;
        }
        const rearPoints = [corners.backLeft, corners.backRight];
        const onHomeEdge = homeEdge === 'bottom'
            ? rearPoints.every((point) => Math.abs(point.y - data.BOARD_SIZE) <= 0.6)
            : rearPoints.every((point) => Math.abs(point.y) <= 0.6);
        if (!onHomeEdge) {
            return false;
        }
        const clearance = data.pacesToMm(data.RESERVE_ENEMY_CLEARANCE_PACES);
        return !others.some((other) => (
            getPlayerId(other) !== playerId
            && geometry.minDistanceBetweenPolygons(corners, geometry.getUnitCorners(other)) < clearance - 0.01
        ));
    }


    function simulateMoveCandidate(context, candidate, forwardCache) {
        const {
            units,
            terrain,
            activePlayerId,
            remainingMoves,
            getPlayerId,
            snapEnabled = true,
            reserveUnits = [],
            getHomeEdge = (playerId) => (playerId === 'player-2' ? 'top' : 'bottom')
        } = context;
        const enemyPlayerId = getOpponentPlayerId(activePlayerId);
        const {
            unitIds,
            analysis,
            moveKind,
            moveParam
        } = candidate;

        if (moveKind === 'reserve-deploy') {
            if (remainingMoves < 1) {
                return null;
            }
            const reserveUnit = reserveUnits.find((entry) => entry.id === candidate.reserveUnitId);
            if (!reserveUnit) {
                return null;
            }
            const homeEdge = getHomeEdge(activePlayerId);
            const posed = applyReserveDeployPose(
                { ...reserveUnit, inReserve: false },
                activePlayerId,
                moveParam,
                homeEdge
            );
            if (!isReserveDeployLegal(posed, units, terrain, activePlayerId, getPlayerId, homeEdge)) {
                return null;
            }
            const afterUnits = [...units, posed];
            const scoring = scoreCandidate(
                units,
                afterUnits,
                activePlayerId,
                enemyPlayerId,
                getPlayerId,
                [posed.id],
                terrain,
                { moveKind: 'reserve-deploy', distance: 0, remainingMoves }
            );
            return {
                unitIds: [posed.id],
                analysis: candidate.analysis,
                moveKind,
                moveParam,
                reserveUnitId: reserveUnit.id,
                distance: 0,
                afterUnits,
                score: scoring.total,
                breakdown: scoring.breakdown
            };
        }

        const moveCost = rules.getDraftMoveCost(unitIds, units);
        if (moveCost > remainingMoves) {
            return null;
        }

        const base = geometry.snapshotPositions(unitIds, units);
        let trialUnits = null;
        let distance = 0;

        if (moveKind === 'forward') {
            const cacheKey = unitIds.join(',');
            distance = forwardCache.get(cacheKey);
            if (distance === undefined) {
                distance = findMaxForwardDistance(units, terrain, unitIds, analysis, snapEnabled);
                forwardCache.set(cacheKey, distance);
            }
            if (distance <= 0.05) {
                return null;
            }
            trialUnits = applyForwardDistance(units, analysis, unitIds, base, distance);
            if (analysis.type !== 'rank') {
                trialUnits = applySnapToTrialUnits(trialUnits, unitIds, snapEnabled);
            }
        } else if (moveKind === 'reverse') {
            trialUnits = applyReverseTrial(units, analysis, unitIds);
        } else if (moveKind === 'convert') {
            trialUnits = applyConvertTrial(units, analysis, unitIds);
            if (!trialUnits) {
                return null;
            }
        } else if (moveKind === 'wheel-left' || moveKind === 'wheel-right') {
            if (analysis.type !== 'rank') {
                return null;
            }
            trialUnits = mergeTrialUnits(
                units,
                unitIds,
                applyWheelTrial(units, analysis, unitIds, base, moveKind, moveParam)
            );
        } else {
            return null;
        }

        if (!isTrialBoardLegal(trialUnits, terrain, unitIds, base)) {
            if (moveKind === 'convert') {
                const selected = unitIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
                const conversions = buildConvertedFormationCandidates(selected, analysis);
                trialUnits = null;
                for (let index = 0; index < conversions.length; index += 1) {
                    const attempt = cloneUnits(units);
                    const byId = new Map(attempt.map((unit) => [unit.id, unit]));
                    conversions[index].converted.forEach((candidateUnit) => {
                        Object.assign(byId.get(candidateUnit.id), candidateUnit);
                    });
                    if (isTrialBoardLegal(attempt, terrain, unitIds, base)) {
                        trialUnits = attempt;
                        break;
                    }
                }
                if (!trialUnits) {
                    return null;
                }
            } else {
                return null;
            }
        }

        const afterUnits = trialUnits;
        const scoring = scoreCandidate(
            units,
            afterUnits,
            activePlayerId,
            enemyPlayerId,
            getPlayerId,
            unitIds,
            terrain,
            { moveKind, distance, remainingMoves }
        );
        return {
            unitIds,
            analysis,
            moveKind,
            moveParam,
            distance,
            afterUnits,
            score: scoring.total,
            breakdown: scoring.breakdown
        };
    }


    function isForwardDistanceLegal(units, terrain, unitIds, analysis, base, distance, snapEnabled) {
        let trialUnits = applyForwardDistance(units, analysis, unitIds, base, distance);
        if (analysis.type !== 'rank') {
            trialUnits = applySnapToTrialUnits(trialUnits, unitIds, snapEnabled);
        }
        const draft = buildProbeDraft(unitIds, base);
        const result = rules.validateDraftState(draft, trialUnits, terrain);
        return result.invalidIds.size === 0;
    }


    function findMaxForwardDistance(units, terrain, unitIds, analysis, snapEnabled = true) {
        const base = geometry.snapshotPositions(unitIds, units);
        if (!isForwardDistanceLegal(units, terrain, unitIds, analysis, base, 0, snapEnabled)) {
            return 0;
        }

        const maxSearch = unitIds.reduce((limit, unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (!unit) {
                return limit;
            }
            const unitMax = Math.max(unit.moves.road, unit.moves.good, unit.moves.bad, unit.moves.water);
            return Math.max(limit, unitMax);
        }, data.BOARD_SIZE);

        let best = 0;
        for (let distance = FORWARD_PROBE_STEP; distance <= maxSearch; distance += FORWARD_PROBE_STEP) {
            if (!isForwardDistanceLegal(units, terrain, unitIds, analysis, base, distance, snapEnabled)) {
                break;
            }
            best = distance;
        }
        return best;
    }


    return {
        simulateMoveCandidate,
        findMaxForwardDistance,
        cloneUnits
    };
}));
