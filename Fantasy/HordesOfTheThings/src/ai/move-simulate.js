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
        getOpponentPlayerId,
        getEnsorcelledReturnCost,
        getOpponentHomeEdge,
        applyEnsorcelledReturnPose,
        isEnsorcelledEdgeReturnLegal,
        isEnsorcelledLocalReturnLegal
    } = candidates;

    const {
        scoreCandidate
    } = score;
    const FORWARD_PROBE_STEP = 5;

    const WHEEL_STEP_DEGREES = [15, 30, 45];

    const WHEEL_PROBE_STEP_DEGREES = 5;

    const WHEEL_MAX_SEARCH_DEGREES = 45;


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


    function applySidestepDistance(units, analysis, unitIds, base, distance, side) {
        const sign = side === 'left' ? -1 : 1;
        const moveDelta = geometry.scaleVector(analysis.right, sign * distance);
        const nextUnits = cloneUnits(units);
        const byId = new Map(nextUnits.map((unit) => [unit.id, unit]));

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


    function snapForwardDistance(distance) {
        return Math.round(distance / FORWARD_PROBE_STEP) * FORWARD_PROBE_STEP;
    }


    function getCachedMaxForwardDistance(units, terrain, unitIds, analysis, forwardCache, snapEnabled) {
        const cacheKey = unitIds.join(',');
        let maxDistance = forwardCache.get(cacheKey);
        if (maxDistance === undefined) {
            maxDistance = findMaxForwardDistance(units, terrain, unitIds, analysis, snapEnabled);
            forwardCache.set(cacheKey, maxDistance);
        }
        return maxDistance;
    }


    function resolveForwardMoveDistance(units, terrain, unitIds, analysis, base, forwardCache, snapEnabled, fraction = 1) {
        const maxDistance = getCachedMaxForwardDistance(
            units,
            terrain,
            unitIds,
            analysis,
            forwardCache,
            snapEnabled
        );
        if (maxDistance <= 0.05) {
            return null;
        }
        if (fraction === null || fraction === undefined || fraction >= 1 - 0.001) {
            return maxDistance;
        }
        const clampedFraction = Math.min(1, Math.max(0, fraction));
        let distance = snapForwardDistance(maxDistance * clampedFraction);
        if (distance <= 0.05 || distance >= maxDistance - 0.05) {
            return null;
        }
        if (!isForwardDistanceLegal(units, terrain, unitIds, analysis, base, distance, snapEnabled)) {
            return null;
        }
        return distance;
    }


    function buildWheelTrialUnits(units, analysis, unitIds, base, moveKind, angleRadians) {
        if (analysis.type === 'rank') {
            return mergeTrialUnits(
                units,
                unitIds,
                applyWheelTrial(units, analysis, unitIds, base, moveKind, angleRadians)
            );
        }
        if (analysis.type === 'single' && unitIds.length === 1) {
            return mergeTrialUnits(
                units,
                unitIds,
                [applySingleWheelTrial(units, unitIds[0], base, moveKind, angleRadians)]
            );
        }
        return null;
    }


    function isWheelAngleLegal(units, terrain, unitIds, analysis, base, moveKind, angleRadians) {
        const trialUnits = buildWheelTrialUnits(units, analysis, unitIds, base, moveKind, angleRadians);
        if (!trialUnits) {
            return false;
        }
        return isTrialBoardLegal(trialUnits, terrain, unitIds, base);
    }


    function findMaxWheelAngle(units, terrain, unitIds, analysis, base, moveKind) {
        if (!buildWheelTrialUnits(units, analysis, unitIds, base, moveKind, 0)) {
            return 0;
        }
        const maxSearch = (WHEEL_MAX_SEARCH_DEGREES * Math.PI) / 180;
        const step = (WHEEL_PROBE_STEP_DEGREES * Math.PI) / 180;
        let best = 0;
        for (let angle = step; angle <= maxSearch + 0.0001; angle += step) {
            if (!isWheelAngleLegal(units, terrain, unitIds, analysis, base, moveKind, angle)) {
                break;
            }
            best = angle;
        }
        return best;
    }


    function collectWheelAngleSamples(units, terrain, unitIds, analysis, moveKind, probeCache) {
        const cacheKey = `${unitIds.join(',')}:${moveKind}:max-angle`;
        let maxAngle = probeCache.get(cacheKey);
        if (maxAngle === undefined) {
            const base = geometry.snapshotPositions(unitIds, units);
            maxAngle = findMaxWheelAngle(units, terrain, unitIds, analysis, base, moveKind);
            probeCache.set(cacheKey, maxAngle);
        }
        if (maxAngle <= 0.001) {
            return [];
        }

        const samples = [];
        const epsilon = 0.001;
        WHEEL_STEP_DEGREES.forEach((degrees) => {
            const radians = (degrees * Math.PI) / 180;
            if (radians <= maxAngle + epsilon) {
                samples.push(radians);
            }
        });
        if (!samples.some((radians) => Math.abs(radians - maxAngle) < epsilon)) {
            samples.push(maxAngle);
        }
        return samples;
    }


    function collectWheelCandidatesForGroup(context, group, probeCache) {
        const { units, terrain } = context;
        const candidates = [];
        ['wheel-left', 'wheel-right'].forEach((moveKind) => {
            collectWheelAngleSamples(
                units,
                terrain,
                group.unitIds,
                group.analysis,
                moveKind,
                probeCache
            ).forEach((angleRadians) => {
                candidates.push({
                    ...group,
                    moveKind,
                    moveParam: angleRadians
                });
            });
        });
        return candidates;
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


    function applySingleWheelTrial(units, unitId, base, moveKind, angleRadians) {
        const unit = units.find((entry) => entry.id === unitId);
        const origin = base[unitId];
        const trialUnit = {
            ...unit,
            x: origin.x,
            y: origin.y,
            rotation: origin.rotation
        };
        const corners = geometry.getUnitCorners(trialUnit);
        const pivot = moveKind === 'wheel-left' ? corners.frontLeft : corners.frontRight;
        const delta = moveKind === 'wheel-left' ? -Math.abs(angleRadians) : Math.abs(angleRadians);
        const rotated = geometry.rotatePoint({ x: origin.x, y: origin.y }, pivot, delta);
        return {
            ...unit,
            id: unitId,
            x: rotated.x,
            y: rotated.y,
            rotation: geometry.normalizeAngle(origin.rotation + delta)
        };
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


    function getForwardScoreForGroup(context, candidate, forwardCache) {
        const {
            units,
            terrain,
            activePlayerId,
            remainingMoves,
            getPlayerId,
            snapEnabled = true
        } = context;
        const { unitIds, analysis } = candidate;
        const scoreKey = `${unitIds.join(',')}:forward-score`;
        if (forwardCache.has(scoreKey)) {
            return forwardCache.get(scoreKey);
        }

        const enemyPlayerId = getOpponentPlayerId(activePlayerId);
        const base = geometry.snapshotPositions(unitIds, units);
        const distanceKey = unitIds.join(',');
        let distance = forwardCache.get(distanceKey);
        if (distance === undefined) {
            distance = findMaxForwardDistance(units, terrain, unitIds, analysis, snapEnabled);
            forwardCache.set(distanceKey, distance);
        }
        if (distance <= 0.05) {
            forwardCache.set(scoreKey, 0);
            return 0;
        }

        let trialUnits = applyForwardDistance(units, analysis, unitIds, base, distance);
        if (analysis.type !== 'rank') {
            trialUnits = applySnapToTrialUnits(trialUnits, unitIds, snapEnabled);
        }
        if (!isTrialBoardLegal(trialUnits, terrain, unitIds, base)) {
            forwardCache.set(scoreKey, 0);
            return 0;
        }

        const forwardScore = scoreCandidate(
            units,
            trialUnits,
            activePlayerId,
            enemyPlayerId,
            getPlayerId,
            unitIds,
            terrain,
            { moveKind: 'forward', distance, remainingMoves }
        ).total;
        forwardCache.set(scoreKey, forwardScore);
        return forwardScore;
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

        if (moveKind === 'ensorcelled-return') {
            const reserveUnit = reserveUnits.find((entry) => entry.id === candidate.reserveUnitId);
            if (!reserveUnit) {
                return null;
            }
            const returnCost = getEnsorcelledReturnCost(reserveUnit, units, reserveUnits);
            if (remainingMoves < returnCost) {
                return null;
            }

            let posed;
            if (candidate.localReturn) {
                posed = geometry.buildUnitFromCenter(
                    { ...reserveUnit, inReserve: false },
                    candidate.localReturn,
                    candidate.localReturn.rotation
                );
                if (reserveUnit.ensorcelledFrom) {
                    posed.ensorcelledFrom = { ...reserveUnit.ensorcelledFrom };
                }
                if (!isEnsorcelledLocalReturnLegal(posed, units, terrain)) {
                    return null;
                }
            } else {
                const opponentEdge = getOpponentHomeEdge(getHomeEdge(activePlayerId));
                posed = applyEnsorcelledReturnPose(
                    { ...reserveUnit, inReserve: false },
                    moveParam,
                    opponentEdge
                );
                if (!isEnsorcelledEdgeReturnLegal(posed, units, terrain, opponentEdge)) {
                    return null;
                }
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
                {
                    moveKind: 'ensorcelled-return',
                    distance: 0,
                    remainingMoves,
                    ensorcelledUnit: reserveUnit,
                    ensorcelledReturnCost: returnCost
                }
            );
            return {
                unitIds: [posed.id],
                analysis: candidate.analysis,
                moveKind,
                moveParam,
                localReturn: candidate.localReturn || null,
                reserveUnitId: reserveUnit.id,
                returnCost,
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
            distance = resolveForwardMoveDistance(
                units,
                terrain,
                unitIds,
                analysis,
                base,
                forwardCache,
                snapEnabled,
                moveParam
            );
            if (distance === null || distance <= 0.05) {
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
            if (moveParam === null || moveParam === undefined) {
                return null;
            }
            trialUnits = buildWheelTrialUnits(units, analysis, unitIds, base, moveKind, moveParam);
            if (!trialUnits) {
                return null;
            }
        } else if (moveKind === 'sidestep-left' || moveKind === 'sidestep-right') {
            if (analysis.type !== 'single' && analysis.type !== 'rank' && analysis.type !== 'file') {
                return null;
            }
            const side = moveKind === 'sidestep-left' ? 'left' : 'right';
            const cacheKey = `${unitIds.join(',')}:${moveKind}`;
            distance = forwardCache.get(cacheKey);
            if (distance === undefined) {
                distance = findMaxSidestepDistance(units, terrain, unitIds, analysis, side, snapEnabled);
                forwardCache.set(cacheKey, distance);
            }
            if (distance <= 0.05) {
                return null;
            }
            trialUnits = applySidestepDistance(units, analysis, unitIds, base, distance, side);
            if (analysis.type !== 'rank') {
                trialUnits = applySnapToTrialUnits(trialUnits, unitIds, snapEnabled);
            }
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
        const forwardScore = (moveKind === 'sidestep-left' || moveKind === 'sidestep-right')
            ? getForwardScoreForGroup(context, candidate, forwardCache)
            : null;
        const scoring = scoreCandidate(
            units,
            afterUnits,
            activePlayerId,
            enemyPlayerId,
            getPlayerId,
            unitIds,
            terrain,
            { moveKind, distance, remainingMoves, forwardScore }
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


    function isSidestepDistanceLegal(units, terrain, unitIds, analysis, base, distance, side, snapEnabled) {
        let trialUnits = applySidestepDistance(units, analysis, unitIds, base, distance, side);
        if (analysis.type !== 'rank') {
            trialUnits = applySnapToTrialUnits(trialUnits, unitIds, snapEnabled);
        }
        const draft = buildProbeDraft(unitIds, base);
        const result = rules.validateDraftState(draft, trialUnits, terrain);
        return result.invalidIds.size === 0;
    }


    function findMaxSidestepDistance(units, terrain, unitIds, analysis, side, snapEnabled = true) {
        const base = geometry.snapshotPositions(unitIds, units);
        if (!isSidestepDistanceLegal(units, terrain, unitIds, analysis, base, 0, side, snapEnabled)) {
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
            if (!isSidestepDistanceLegal(units, terrain, unitIds, analysis, base, distance, side, snapEnabled)) {
                break;
            }
            best = distance;
        }
        return best;
    }


    return {
        simulateMoveCandidate,
        findMaxForwardDistance,
        findMaxSidestepDistance,
        findMaxWheelAngle,
        collectWheelCandidatesForGroup,
        cloneUnits
    };
}));
