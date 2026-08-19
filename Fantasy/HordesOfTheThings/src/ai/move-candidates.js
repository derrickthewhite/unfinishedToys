(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('../rules/index.js'),
            require('./move-score.js')
        );
        return;
    }
    root.HordesMoveAiCandidates = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesMoveAiScore);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, score) {
    const {
        getFormUpPreviewCombats,
        getActivePreviewSide,
        combatInvolvesMovedUnits,
        getCombatAdvantage
    } = score;
    const REVERSE_MIN_DISADVANTAGE = 0.5;

    function getWheelProbe() {
        return require('./move-simulate.js');
    }


    const FAST_FORWARD_GOOD_MM = 125;

    const FLYER_FORWARD_FRACTIONS = [0.25, 0.5, 0.75];

    const FAST_FORWARD_FRACTIONS = [0.5, 0.75];

    const DEFAULT_FORWARD_FRACTIONS = [0.5];


    function getGroupMaxGoodMove(units, unitIds) {
        return unitIds.reduce((max, unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (!unit) {
                return max;
            }
            return Math.max(max, unit.moves?.good || 0, unit.moves?.road || 0);
        }, 0);
    }


    function getPartialForwardFractions(units, unitIds) {
        const selected = unitIds
            .map((unitId) => units.find((entry) => entry.id === unitId))
            .filter(Boolean);
        if (selected.length === 0) {
            return [];
        }
        if (selected.every((unit) => unit.type === 'Flyers')) {
            return FLYER_FORWARD_FRACTIONS;
        }
        if (getGroupMaxGoodMove(units, unitIds) >= FAST_FORWARD_GOOD_MM) {
            return FAST_FORWARD_FRACTIONS;
        }
        return DEFAULT_FORWARD_FRACTIONS;
    }


    function collectPartialForwardCandidates(group, units) {
        return getPartialForwardFractions(units, group.unitIds).map((fraction) => ({
            ...group,
            moveKind: 'forward',
            moveParam: fraction
        }));
    }


    function getOpponentPlayerId(activePlayerId) {
        return activePlayerId === 'player-1' ? 'player-2' : 'player-1';
    }


    function clusterByCoordinate(entries, axis, tolerance) {
        const sorted = [...entries].sort((left, right) => left[axis] - right[axis]);
        const clusters = [];
        let current = [];
        sorted.forEach((entry) => {
            if (current.length === 0) {
                current.push(entry);
                return;
            }
            const clusterMean = geometry.average(current.map((item) => item[axis]));
            if (Math.abs(entry[axis] - clusterMean) <= tolerance) {
                current.push(entry);
                return;
            }
            clusters.push(current);
            current = [entry];
        });
        if (current.length > 0) {
            clusters.push(current);
        }
        return clusters;
    }


    function splitContiguous(sortedEntries, axis, unitSize, gapTolerance) {
        if (sortedEntries.length === 0) {
            return [];
        }
        const segments = [];
        let current = [sortedEntries[0]];
        for (let index = 1; index < sortedEntries.length; index += 1) {
            const previous = sortedEntries[index - 1];
            const next = sortedEntries[index];
            const gap = next[axis] - previous[axis];
            if (gap <= unitSize + gapTolerance) {
                current.push(next);
            } else {
                segments.push(current);
                current = [next];
            }
        }
        segments.push(current);
        return segments;
    }


    function localizeUnits(units, anchorUnit) {
        const forward = geometry.getForwardVector(anchorUnit.rotation);
        const right = geometry.getRightVector(anchorUnit.rotation);
        const anchor = geometry.getUnitCenter(anchorUnit);
        return units.map((unit) => {
            const delta = geometry.subtract(geometry.getUnitCenter(unit), anchor);
            return {
                unit,
                u: geometry.dot(delta, right),
                v: geometry.dot(delta, forward)
            };
        });
    }


    function findRankSegments(units) {
        if (units.length === 0) {
            return [];
        }
        const localized = localizeUnits(units, units[0]);
        const rows = clusterByCoordinate(localized, 'v', data.RANK_TOLERANCE);
        const segments = [];
        rows.forEach((row) => {
            const sorted = [...row].sort((left, right) => left.u - right.u);
            splitContiguous(sorted, 'u', units[0].width, data.FORMATION_GAP_TOLERANCE).forEach((segment) => {
                segments.push(segment.map((entry) => entry.unit));
            });
        });
        return segments;
    }


    function findFileSegments(units) {
        if (units.length === 0) {
            return [];
        }
        const localized = localizeUnits(units, units[0]);
        const columns = clusterByCoordinate(localized, 'u', data.FILE_TOLERANCE);
        const segments = [];
        columns.forEach((column) => {
            const sorted = [...column].sort((left, right) => right.v - left.v);
            splitContiguous(sorted, 'v', units[0].depth, data.FORMATION_GAP_TOLERANCE).forEach((segment) => {
                segments.push(segment.map((entry) => entry.unit));
            });
        });
        return segments;
    }


    function collectMoveCandidateGroups(units, activePlayerId, getPlayerId) {
        const unmoved = units.filter((unit) => (
            getPlayerId(unit) === activePlayerId
            && !unit.movedThisTurn
            && !unit.inReserve
        ));
        const groups = [];
        const seen = new Set();
        const facingBuckets = new Map();

        unmoved.forEach((unit) => {
            const key = String(Math.round(unit.rotation * 100));
            if (!facingBuckets.has(key)) {
                facingBuckets.set(key, []);
            }
            facingBuckets.get(key).push(unit);
        });

        const addGroup = (unitIds) => {
            const key = [...unitIds].sort().join(',');
            if (seen.has(key)) {
                return;
            }
            const selected = unitIds
                .map((unitId) => units.find((unit) => unit.id === unitId))
                .filter(Boolean);
            const analysis = rules.analyzeSelection(selected);
            if (analysis.invalid || analysis.type === 'none' || analysis.type === 'invalid') {
                return;
            }
            seen.add(key);
            groups.push({ unitIds: [...unitIds], analysis });
        };

        facingBuckets.forEach((bucket) => {
            bucket.forEach((unit) => addGroup([unit.id]));

            findRankSegments(bucket).forEach((segment) => {
                for (let start = 0; start < segment.length; start += 1) {
                    for (let end = start; end < segment.length; end += 1) {
                        addGroup(segment.slice(start, end + 1).map((entry) => entry.id));
                    }
                }
            });

            findFileSegments(bucket).forEach((segment) => {
                for (let start = 0; start < segment.length; start += 1) {
                    for (let end = start; end < segment.length; end += 1) {
                        addGroup(segment.slice(start, end + 1).map((entry) => entry.id));
                    }
                }
            });
        });

        return groups;
    }


    const RESERVE_DEPLOY_STEP = 20;


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


    function collectReserveDeployWorldSamples(context, reserveUnit) {
        const {
            units,
            terrain,
            activePlayerId,
            getPlayerId,
            getHomeEdge = (playerId) => (playerId === 'player-2' ? 'top' : 'bottom')
        } = context;
        const homeEdge = getHomeEdge(activePlayerId);
        const minX = reserveUnit.width / 2;
        const maxX = data.BOARD_SIZE - (reserveUnit.width / 2);
        const samples = [];
        for (let worldX = minX; worldX <= maxX; worldX += RESERVE_DEPLOY_STEP) {
            const posed = applyReserveDeployPose(
                { ...reserveUnit, inReserve: false },
                activePlayerId,
                worldX,
                homeEdge
            );
            if (isReserveDeployLegal(posed, units, terrain, activePlayerId, getPlayerId, homeEdge)) {
                samples.push(worldX);
            }
        }
        return samples;
    }


    function isEnsorcelledInReserve(unit) {
        return Boolean(unit && unit.inReserve && unit.ensorcelledByUnitId !== undefined);
    }


    function getEnsorcelledReturnCost(unit, units, reserveUnits) {
        if (!unit || unit.ensorcelledByUnitId === null || unit.ensorcelledByUnitId === undefined) {
            return 0;
        }
        const ensorceller = units.find((entry) => entry.id === unit.ensorcelledByUnitId);
        if (!ensorceller || reserveUnits.some((entry) => entry.id === ensorceller.id)) {
            return 0;
        }
        return data.ENSORCELLED_RETURN_MOVE_COST;
    }


    function usesEnsorcelledLocalReturn(unit) {
        return Boolean(unit && unit.type === 'Magician' && unit.ensorcelledFrom
            && Number.isFinite(unit.ensorcelledFrom.x)
            && Number.isFinite(unit.ensorcelledFrom.y));
    }


    function getOpponentHomeEdge(homeEdge) {
        return homeEdge === 'bottom' ? 'top' : 'bottom';
    }


    function applyEnsorcelledReturnPose(unit, worldX, opponentHomeEdge) {
        const posed = { ...unit };
        const left = geometry.clamp(worldX - (posed.width / 2), 0, data.BOARD_SIZE - posed.width);
        if (opponentHomeEdge === 'bottom') {
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


    function isEnsorcelledEdgeReturnLegal(unit, boardUnits, terrain, opponentHomeEdge) {
        const expectedRotation = getHomeEdgeRotation(opponentHomeEdge);
        if (Math.abs(geometry.normalizeAngle(unit.rotation - expectedRotation)) > 0.01) {
            return false;
        }
        const corners = geometry.getUnitCorners(unit);
        const points = geometry.cornersToPoints(corners);
        const onBoard = points.every((point) => (
            point.x >= -0.01
            && point.x <= data.BOARD_SIZE + 0.01
            && point.y >= -0.01
            && point.y <= data.BOARD_SIZE + 0.01
        ));
        if (!onBoard) {
            return false;
        }
        const others = boardUnits.filter((other) => other.id !== unit.id);
        if (others.some((other) => geometry.polygonsOverlap(corners, geometry.getUnitCorners(other)))) {
            return false;
        }
        const terrainTypes = rules.sampleUnitTerrain(unit, terrain);
        if (terrainTypes.has('impassable')) {
            return false;
        }
        const rearPoints = [corners.backLeft, corners.backRight];
        const onEdge = opponentHomeEdge === 'bottom'
            ? rearPoints.every((point) => Math.abs(point.y - data.BOARD_SIZE) <= 0.6)
            : rearPoints.every((point) => Math.abs(point.y) <= 0.6);
        return onEdge;
    }


    function isEnsorcelledLocalReturnLegal(unit, boardUnits, terrain) {
        const origin = unit.ensorcelledFrom;
        const radius = data.pacesToMm(data.MAGICIAN_ENSORCELLED_RETURN_PACES);
        const center = geometry.getUnitCenter(unit);
        if (!origin || geometry.distance(center, origin) > radius + 0.01) {
            return false;
        }
        const corners = geometry.getUnitCorners(unit);
        const points = geometry.cornersToPoints(corners);
        const onBoard = points.every((point) => (
            point.x >= -0.01
            && point.x <= data.BOARD_SIZE + 0.01
            && point.y >= -0.01
            && point.y <= data.BOARD_SIZE + 0.01
        ));
        if (!onBoard) {
            return false;
        }
        const others = boardUnits.filter((other) => other.id !== unit.id);
        if (others.some((other) => geometry.polygonsOverlap(corners, geometry.getUnitCorners(other)))) {
            return false;
        }
        const terrainTypes = rules.sampleUnitTerrain(unit, terrain);
        return !terrainTypes.has('impassable');
    }


    function buildEnsorcelledReturnCandidate(reserveUnit, moveParam, localReturn) {
        return {
            unitIds: [reserveUnit.id],
            analysis: {
                type: 'single',
                invalid: false,
                reason: '',
                forward: geometry.getForwardVector(0),
                right: geometry.getRightVector(0)
            },
            moveKind: 'ensorcelled-return',
            moveParam,
            localReturn: localReturn || null,
            reserveUnitId: reserveUnit.id
        };
    }


    function collectEnsorcelledReturnCandidates(context, reserveUnit) {
        const {
            units,
            terrain,
            activePlayerId,
            getPlayerId,
            remainingMoves,
            reserveUnits = [],
            getHomeEdge = (playerId) => (playerId === 'player-2' ? 'top' : 'bottom')
        } = context;
        const returnCost = getEnsorcelledReturnCost(reserveUnit, units, reserveUnits);
        if (remainingMoves < returnCost) {
            return [];
        }

        const candidates = [];
        const baseUnit = { ...reserveUnit, inReserve: false };

        if (usesEnsorcelledLocalReturn(reserveUnit)) {
            const origin = reserveUnit.ensorcelledFrom;
            const radius = data.pacesToMm(data.MAGICIAN_ENSORCELLED_RETURN_PACES);
            const rotation = Number.isFinite(origin.rotation) ? origin.rotation : reserveUnit.rotation;
            const seen = new Set();
            const tryCenter = (center) => {
                const key = `${Math.round(center.x)},${Math.round(center.y)}`;
                if (seen.has(key)) {
                    return;
                }
                seen.add(key);
                const posed = geometry.buildUnitFromCenter(baseUnit, center, rotation);
                posed.ensorcelledFrom = { ...origin };
                if (!isEnsorcelledLocalReturnLegal(posed, units, terrain)) {
                    return;
                }
                candidates.push(buildEnsorcelledReturnCandidate(reserveUnit, null, { x: center.x, y: center.y, rotation }));
            };
            tryCenter({ x: origin.x, y: origin.y });
            for (let dx = -radius; dx <= radius; dx += RESERVE_DEPLOY_STEP) {
                for (let dy = -radius; dy <= radius; dy += RESERVE_DEPLOY_STEP) {
                    if (dx === 0 && dy === 0) {
                        continue;
                    }
                    const center = { x: origin.x + dx, y: origin.y + dy };
                    if (geometry.distance(center, origin) > radius + 0.01) {
                        continue;
                    }
                    tryCenter(center);
                }
            }
            return candidates;
        }

        const opponentEdge = getOpponentHomeEdge(getHomeEdge(activePlayerId));
        const minX = reserveUnit.width / 2;
        const maxX = data.BOARD_SIZE - (reserveUnit.width / 2);
        for (let worldX = minX; worldX <= maxX; worldX += RESERVE_DEPLOY_STEP) {
            const posed = applyEnsorcelledReturnPose(baseUnit, worldX, opponentEdge);
            if (isEnsorcelledEdgeReturnLegal(posed, units, terrain, opponentEdge)) {
                candidates.push(buildEnsorcelledReturnCandidate(reserveUnit, worldX, null));
            }
        }
        return candidates;
    }


    function isGroupInBadMelee(units, activePlayerId, unitIds, terrain) {
        const previews = getFormUpPreviewCombats(units, activePlayerId, terrain);
        return previews.some((preview) => {
            if (!combatInvolvesMovedUnits(preview, unitIds, activePlayerId)) {
                return false;
            }
            const sides = getActivePreviewSide(preview, activePlayerId);
            return sides && getCombatAdvantage(sides.active, sides.opponent) <= -REVERSE_MIN_DISADVANTAGE;
        });
    }


    function isGroupInBadTerrain(units, unitIds, terrain) {
        return unitIds.some((unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (!unit || data.UNIT_TYPES[unit.type]?.combat?.ignoresBadGoingPenalty) {
                return false;
            }
            const severity = rules.severityFromTerrain(rules.sampleUnitTerrain(unit, terrain));
            return severity >= rules.TERRAIN_SEVERITY.swamp;
        });
    }


    function collectExtendedMoveCandidates(context) {
        const {
            units,
            activePlayerId,
            getPlayerId,
            reserveUnits = [],
            remainingMoves = 0
        } = context;
        const candidates = [];

        const wheelProbeCache = context.wheelProbeCache || new Map();
        const { collectWheelCandidatesForGroup } = getWheelProbe();

        collectMoveCandidateGroups(units, activePlayerId, getPlayerId).forEach((group) => {
            candidates.push({ ...group, moveKind: 'forward', moveParam: null });
            collectPartialForwardCandidates(group, units).forEach((candidate) => {
                candidates.push(candidate);
            });

            if (group.analysis.type === 'rank' || group.analysis.type === 'single') {
                collectWheelCandidatesForGroup(context, group, wheelProbeCache).forEach((candidate) => {
                    candidates.push(candidate);
                });
            }

            if (group.analysis.type === 'single') {
                candidates.push({ ...group, moveKind: 'sidestep-left', moveParam: null });
                candidates.push({ ...group, moveKind: 'sidestep-right', moveParam: null });
            }

            if (group.analysis.type === 'rank' || group.analysis.type === 'file') {
                candidates.push({ ...group, moveKind: 'convert', moveParam: null });
            }

            if (isGroupInBadMelee(units, activePlayerId, group.unitIds, context.terrain)
                || isGroupInBadTerrain(units, group.unitIds, context.terrain)) {
                candidates.push({ ...group, moveKind: 'reverse', moveParam: null });
            }
        });

        if (remainingMoves > 0) {
            reserveUnits.forEach((unit) => {
                if (getPlayerId(unit) !== activePlayerId) {
                    return;
                }
                if (isEnsorcelledInReserve(unit)) {
                    collectEnsorcelledReturnCandidates(context, unit).forEach((candidate) => {
                        candidates.push(candidate);
                    });
                    return;
                }
                if (!data.RESERVE_RECYCLE_TYPES.includes(unit.type)) {
                    return;
                }
                collectReserveDeployWorldSamples(context, unit).forEach((worldX) => {
                    candidates.push({
                        unitIds: [unit.id],
                        analysis: {
                            type: 'single',
                            invalid: false,
                            reason: '',
                            forward: geometry.getForwardVector(0),
                            right: geometry.getRightVector(0)
                        },
                        moveKind: 'reserve-deploy',
                        moveParam: worldX,
                        reserveUnitId: unit.id
                    });
                });
            });
        }

        return candidates;
    }


    return {
        getOpponentPlayerId,
        collectMoveCandidateGroups,
        collectExtendedMoveCandidates,
        findRankSegments,
        findFileSegments,
        isEnsorcelledInReserve,
        getEnsorcelledReturnCost,
        usesEnsorcelledLocalReturn,
        getOpponentHomeEdge,
        applyEnsorcelledReturnPose,
        isEnsorcelledEdgeReturnLegal,
        isEnsorcelledLocalReturnLegal,
        getPartialForwardFractions,
        collectPartialForwardCandidates,
        collectEnsorcelledReturnCandidates
    };
}));
