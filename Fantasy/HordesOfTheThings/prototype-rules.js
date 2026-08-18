(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'), require('./prototype-geometry.js'));
        return;
    }
    root.HordesRules = factory(root.HordesData, root.HordesGeometry);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry) {
    const ROUGH_TERRAIN_TYPES = new Set(['forest', 'swamp']);
    const STACKABLE_TYPES = new Set(['Spear', 'Warband']);
    const TERRAIN_SEVERITY = {
        road: 0,
        good: 1,
        swamp: 2,
        forest: 2,
        water: 3,
        impassable: 4
    };

    function normalizePlayerId(playerId) {
        if (playerId === 'blue') {
            return 'player-1';
        }
        if (playerId === 'red') {
            return 'player-2';
        }
        return playerId;
    }

    function getPlayerId(unit) {
        return normalizePlayerId(unit.playerId || unit.side || null);
    }

    function getRankPivot(unit, forward, right, side) {
        const corners = geometry.cornersToPoints(geometry.getUnitCorners(unit)).map((point) => ({
            point,
            u: geometry.dot(point, right),
            v: geometry.dot(point, forward)
        }));
        const frontV = Math.max(...corners.map((entry) => entry.v));
        const frontCorners = corners.filter((entry) => Math.abs(entry.v - frontV) <= 1.5);
        return frontCorners.reduce((best, current) => {
            if (!best) {
                return current;
            }
            if (side === 'left') {
                return current.u < best.u ? current : best;
            }
            return current.u > best.u ? current : best;
        }, null).point;
    }

    function analyzeSelection(units) {
        if (units.length === 0) {
            return { type: 'none', invalid: false, reason: '' };
        }
        if (units.length === 1) {
            return {
                type: 'single',
                invalid: false,
                reason: '',
                forward: geometry.getForwardVector(units[0].rotation),
                right: geometry.getRightVector(units[0].rotation)
            };
        }
        const playerId = getPlayerId(units[0]);
        if (units.some((unit) => getPlayerId(unit) !== playerId)) {
            return { type: 'invalid', invalid: true, reason: 'Selection mixes players.' };
        }
        const baseRotation = units[0].rotation;
        if (units.some((unit) => Math.abs(geometry.normalizeAngle(unit.rotation - baseRotation)) > 0.12)) {
            return { type: 'invalid', invalid: true, reason: 'Selection does not share a facing.' };
        }
        const forward = geometry.getForwardVector(baseRotation);
        const right = geometry.getRightVector(baseRotation);
        const centers = units.map((unit) => ({ unit, center: geometry.getUnitCenter(unit) }));
        const anchor = centers[0].center;
        const localized = centers.map(({ unit, center }) => {
            const delta = geometry.subtract(center, anchor);
            return {
                unit,
                u: geometry.dot(delta, right),
                v: geometry.dot(delta, forward)
            };
        });
        const meanU = geometry.average(localized.map((entry) => entry.u));
        const meanV = geometry.average(localized.map((entry) => entry.v));
        const rankAligned = localized.every((entry) => Math.abs(entry.v - meanV) <= data.RANK_TOLERANCE);
        const fileAligned = localized.every((entry) => Math.abs(entry.u - meanU) <= data.FILE_TOLERANCE);
        if (rankAligned && geometry.isContiguous(localized, 'u', units[0].width, data.FORMATION_GAP_TOLERANCE)) {
            const sorted = [...localized].sort((left, rightEntry) => left.u - rightEntry.u);
            const leftUnit = sorted[0].unit;
            const rightUnit = sorted[sorted.length - 1].unit;
            const leftPivot = getRankPivot(leftUnit, forward, right, 'left');
            const rightPivot = getRankPivot(rightUnit, forward, right, 'right');
            return {
                type: 'rank',
                invalid: false,
                reason: '',
                forward,
                right,
                orderedIds: sorted.map((entry) => entry.unit.id),
                leftPivot,
                rightPivot,
                leftHandle: geometry.midpoint(leftPivot, geometry.add(leftPivot, geometry.scaleVector(right, 12))),
                rightHandle: geometry.midpoint(rightPivot, geometry.add(rightPivot, geometry.scaleVector(right, -12))),
                leftOutward: geometry.scaleVector(right, -1),
                rightOutward: right
            };
        }
        if (fileAligned && geometry.isContiguous(localized, 'v', units[0].depth, data.FORMATION_GAP_TOLERANCE)) {
            const sorted = [...localized].sort((left, rightEntry) => rightEntry.v - left.v);
            return {
                type: 'file',
                invalid: false,
                reason: '',
                forward,
                right,
                leadId: sorted[0].unit.id,
                orderedIds: sorted.map((entry) => entry.unit.id)
            };
        }
        return { type: 'invalid', invalid: true, reason: 'Selection is not a legal rank or file formation.' };
    }

    function validateDraftState(draft, units, terrain) {
        const invalidIds = new Set();
        const reasonById = new Map();
        if (!draft) {
            return { invalidIds, reasonById };
        }
        const pathOrigin = draft.origin || draft.initialOrigin;
        const validationOrigin = draft.validationOrigin || draft.initialOrigin || draft.origin;
        const selectedUnits = draft.unitIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
        const otherUnits = units.filter((unit) => !draft.unitIds.includes(unit.id));
        const startingUnits = units.map((unit) => validationOrigin[unit.id] || unit);
        const startingMelee = detectMeleeCombats(startingUnits);
        const engagedFlyerIds = new Set(startingUnits
            .filter((unit) => unit.movement?.ignoresUnitsWhenUnengaged && startingMelee.participantIds.has(unit.id))
            .map((unit) => unit.id));
        const worstSeverityById = new Map();
        const travelById = new Map();
        const pathCollisionExemptions = new Map();
        const flyerWithdrawalReached = new Set();
        const stationaryIds = new Set(selectedUnits
            .filter((unit) => geometry.sameFootprint(pathOrigin[unit.id], unit))
            .map((unit) => unit.id));
        let previousSamples = buildSampleMap(selectedUnits, pathOrigin, 0, stationaryIds);
        let previousTravelSamples = buildSampleMap(selectedUnits, validationOrigin, 0, stationaryIds);

        if (draft.allowSingleRotationFormationEscape && selectedUnits.length === 1) {
            const selectedUnit = selectedUnits[0];
            const pathStartUnit = pathOrigin[selectedUnit.id] || validationOrigin[selectedUnit.id] || selectedUnit;
            pathCollisionExemptions.set(
                selectedUnit.id,
                new Set(
                    otherUnits
                        .filter((otherUnit) => sharesFormationContact(pathStartUnit, otherUnit))
                        .map((otherUnit) => otherUnit.id)
                )
            );
        }

        selectedUnits.forEach((unit) => {
            worstSeverityById.set(unit.id, null);
            travelById.set(unit.id, [0, 0, 0, 0]);
        });

        (draft.history || []).forEach((snapshot) => {
            engagedFlyerIds.forEach((unitId) => {
                const checkpoint = snapshot[unitId];
                const origin = validationOrigin[unitId];
                if (!checkpoint || !origin) {
                    return;
                }
                const displacement = geometry.subtract(geometry.getUnitCenter(checkpoint), geometry.getUnitCenter(origin));
                const rearwardDistance = -geometry.dot(displacement, geometry.getForwardVector(origin.rotation));
                const flyer = startingUnits.find((unit) => unit.id === unitId);
                if (rearwardDistance >= flyer.movement.disengageDistance) {
                    flyerWithdrawalReached.add(unitId);
                }
            });
        });

        for (let step = 0; step <= data.PATH_SAMPLES; step += 1) {
            const t = step / data.PATH_SAMPLES;
            const currentSamples = buildSampleMap(selectedUnits, pathOrigin, t, stationaryIds);
            const currentTravelSamples = buildSampleMap(selectedUnits, validationOrigin, t, stationaryIds);
            selectedUnits.forEach((unit) => {
                const sample = currentSamples.get(unit.id);
                const ignoresTerrain = Boolean(unit.movement?.ignoresTerrain);
                const sampleTerrain = ignoresTerrain ? new Set(['good']) : sampleUnitTerrain(sample, terrain);
                const severity = severityFromTerrain(sampleTerrain);
                worstSeverityById.set(unit.id, combineMoveSeverity(worstSeverityById.get(unit.id), severity));
                if (!ignoresTerrain && severity === TERRAIN_SEVERITY.impassable) {
                    setInvalid(invalidIds, reasonById, unit.id, 'Path enters impassable terrain.');
                }
                if (engagedFlyerIds.has(unit.id)) {
                    const originCenter = geometry.getUnitCenter(validationOrigin[unit.id]);
                    const displacement = geometry.subtract(geometry.getUnitCenter(sample), originCenter);
                    const rearwardDistance = -geometry.dot(displacement, geometry.getForwardVector(validationOrigin[unit.id].rotation));
                    if (rearwardDistance >= unit.movement.disengageDistance) {
                        flyerWithdrawalReached.add(unit.id);
                    }
                }
                otherUnits.forEach((otherUnit) => {
                    if (t < 1 && pathCollisionExemptions.get(unit.id)?.has(otherUnit.id)) {
                        return;
                    }
                    const unitIsUnengagedFlyer = unit.movement?.ignoresUnitsWhenUnengaged && !engagedFlyerIds.has(unit.id);
                    const otherIsUnengagedFlyer = otherUnit.movement?.ignoresUnitsWhenUnengaged && !engagedFlyerIds.has(otherUnit.id);
                    if (unitIsUnengagedFlyer || otherIsUnengagedFlyer) {
                        return;
                    }
                    if (geometry.polygonsOverlap(geometry.getUnitCorners(sample), geometry.getUnitCorners(otherUnit))) {
                        setInvalid(invalidIds, reasonById, unit.id, 'Move collides with another unit.');
                    }
                });
            });

            if (step > 0) {
                selectedUnits.forEach((unit) => {
                    const previous = previousTravelSamples.get(unit.id);
                    const current = currentTravelSamples.get(unit.id);
                    if (geometry.sameFootprint(previous, current)) {
                        return;
                    }
                    const previousCorners = geometry.getUnitCorners(previous);
                    const currentCorners = geometry.getUnitCorners(current);
                    const totals = travelById.get(unit.id);
                    const frontDistances = geometry.pairTravelDistances(
                        [previousCorners.frontLeft, previousCorners.frontRight],
                        [currentCorners.frontLeft, currentCorners.frontRight]
                    );
                    const backDistances = geometry.pairTravelDistances(
                        [previousCorners.backLeft, previousCorners.backRight],
                        [currentCorners.backLeft, currentCorners.backRight]
                    );
                    totals[0] += frontDistances[0];
                    totals[1] += frontDistances[1];
                    totals[2] += backDistances[0];
                    totals[3] += backDistances[1];
                });
            }

            previousSamples = currentSamples;
            previousTravelSamples = currentTravelSamples;
        }

        for (let index = 0; index < selectedUnits.length; index += 1) {
            for (let inner = index + 1; inner < selectedUnits.length; inner += 1) {
                const left = selectedUnits[index];
                const right = selectedUnits[inner];
                const leftIsUnengagedFlyer = left.movement?.ignoresUnitsWhenUnengaged && !engagedFlyerIds.has(left.id);
                const rightIsUnengagedFlyer = right.movement?.ignoresUnitsWhenUnengaged && !engagedFlyerIds.has(right.id);
                if (leftIsUnengagedFlyer || rightIsUnengagedFlyer) {
                    continue;
                }
                if (geometry.polygonsOverlap(geometry.getUnitCorners(selectedUnits[index]), geometry.getUnitCorners(selectedUnits[inner]))) {
                    setInvalid(invalidIds, reasonById, selectedUnits[index].id, 'Formation overlaps itself.');
                    setInvalid(invalidIds, reasonById, selectedUnits[inner].id, 'Formation overlaps itself.');
                }
            }
        }

        if (draft.useFinalCornerDisplacement) {
            selectedUnits.forEach((unit) => {
                const originUnit = validationOrigin[unit.id];
                const centerDistance = geometry.distance(geometry.getUnitCenter(originUnit), geometry.getUnitCenter(unit));
                travelById.set(unit.id, [
                    centerDistance,
                    centerDistance,
                    centerDistance,
                    centerDistance
                ]);
            });
        }

        selectedUnits.forEach((unit) => {
            if (engagedFlyerIds.has(unit.id) && !flyerWithdrawalReached.has(unit.id)) {
                invalidIds.add(unit.id);
                reasonById.set(unit.id, 'An engaged Flyer must first move 20 mm backward.');
                return;
            }
            if (invalidIds.has(unit.id)) {
                return;
            }
            const allowance = movementAllowanceForSeverity(unit, worstSeverityById.get(unit.id));
            const maxCornerTravel = Math.max(...travelById.get(unit.id));
            if (maxCornerTravel > allowance + 0.5) {
                setInvalid(invalidIds, reasonById, unit.id, 'A corner moved farther than the terrain-limited allowance.');
            }
        });

        return { invalidIds, reasonById };
    }

    function buildSampleMap(selectedUnits, originSnapshot, t, stationaryIds) {
        const samples = new Map();
        selectedUnits.forEach((unit) => {
            if (stationaryIds && stationaryIds.has(unit.id)) {
                samples.set(unit.id, originSnapshot[unit.id]);
                return;
            }
            samples.set(unit.id, geometry.interpolateUnitPose(originSnapshot[unit.id], unit, t));
        });
        return samples;
    }

    function setInvalid(invalidIds, reasonById, unitId, reason) {
        if (!invalidIds.has(unitId)) {
            invalidIds.add(unitId);
            reasonById.set(unitId, reason);
        }
    }

    function getTerrainTypeAt(point, terrain) {
        for (const road of terrain.roads) {
            if (road.orientation === 'horizontal' && Math.abs(point.y - road.position) <= road.width / 2) {
                return 'road';
            }
            if (road.orientation === 'vertical' && Math.abs(point.x - road.position) <= road.width / 2) {
                return 'road';
            }
        }
        for (const feature of terrain.features) {
            if (geometry.pointInBlob(point, feature)) {
                return feature.kind;
            }
        }
        return 'good';
    }

    function sampleUnitTerrain(unit, terrain) {
        const corners = geometry.getUnitCorners(unit);
        const center = geometry.getUnitCenter(unit);
        const frontMid = geometry.midpoint(corners.frontLeft, corners.frontRight);
        const backMid = geometry.midpoint(corners.backLeft, corners.backRight);
        const samplePoints = [corners.frontLeft, corners.frontRight, corners.backLeft, corners.backRight, center, frontMid, backMid];
        const terrainTypes = new Set();
        samplePoints.forEach((point) => terrainTypes.add(getTerrainTypeAt(point, terrain)));
        return terrainTypes;
    }

    function severityFromTerrain(terrainTypes) {
        if (terrainTypes.has('road')) {
            return TERRAIN_SEVERITY.road;
        }
        let severity = TERRAIN_SEVERITY.good;
        terrainTypes.forEach((terrainType) => {
            severity = Math.max(severity, TERRAIN_SEVERITY[terrainType]);
        });
        return severity;
    }

    function combineMoveSeverity(currentSeverity, nextSeverity) {
        if (currentSeverity === null || currentSeverity === undefined) {
            return nextSeverity;
        }
        if (currentSeverity === TERRAIN_SEVERITY.road || nextSeverity === TERRAIN_SEVERITY.road) {
            return TERRAIN_SEVERITY.road;
        }
        return Math.max(currentSeverity, nextSeverity);
    }

    function movementAllowanceForSeverity(unit, severity) {
        if (severity === TERRAIN_SEVERITY.road) {
            return unit.moves.road;
        }
        if (severity === TERRAIN_SEVERITY.good) {
            return unit.moves.good;
        }
        if (severity === TERRAIN_SEVERITY.swamp) {
            return unit.moves.bad;
        }
        if (severity === TERRAIN_SEVERITY.water) {
            return unit.moves.water;
        }
        return 0;
    }

    function isRangedUnit(unit) {
        return Boolean(unit && unit.ranged && unit.ranged.phase === 'shooting');
    }

    function isMagicianUnit(unit) {
        return Boolean(unit && unit.type === 'Magician');
    }

    function isEnsorcellableType(unit) {
        return Boolean(unit && data.ENSORCELLABLE_TYPES.includes(unit.type));
    }

    function getMoveCost(unit) {
        return unit?.combat?.moveCost || 1;
    }

    function getAttackDeclareCost(unit) {
        return unit?.combat?.attackDeclareCost || 0;
    }

    function getDraftMoveCost(unitIds, units) {
        return unitIds.some((unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            return getMoveCost(unit) > 1;
        }) ? data.MAGICIAN_MOVE_COST : 1;
    }

    function getBaseEdgeDistance(left, right) {
        return geometry.minDistanceBetweenPolygons(
            geometry.getUnitCorners(left),
            geometry.getUnitCorners(right)
        );
    }

    function isMagicianSightLineBlocked(start, end, terrain) {
        return sampleSegmentTerrain(start, end, terrain).some((sample) => sample.kind === 'impassable');
    }

    function canUnitShoot(unit, activePlayerId, options) {
        if (!isRangedUnit(unit)) {
            return false;
        }
        if (unit.ranged.requiresOwnTurn && activePlayerId && getPlayerId(unit) !== normalizePlayerId(activePlayerId)) {
            return false;
        }
        if (!options?.allowAlreadyAttacked && unit.attackedThisTurn) {
            return false;
        }
        if (isMagicianUnit(unit)) {
            return !unit.ranged.requiresStationary || !unit.movedThisTurn;
        }
        return !unit.ranged.requiresStationary || !unit.movedThisTurn;
    }

    function getRangedArea(unit) {
        if (!isRangedUnit(unit)) {
            return null;
        }
        const corners = geometry.getUnitCorners(unit);
        const frontMid = geometry.midpoint(corners.frontLeft, corners.frontRight);
        const right = geometry.getRightVector(unit.rotation);
        const forward = geometry.getForwardVector(unit.rotation);
        const width = unit.ranged.width || data.SHOOTING_BOX_WIDTH;
        const nearLeft = geometry.add(frontMid, geometry.scaleVector(right, -width / 2));
        const nearRight = geometry.add(frontMid, geometry.scaleVector(right, width / 2));
        const farLeft = geometry.add(nearLeft, geometry.scaleVector(forward, unit.ranged.range));
        const farRight = geometry.add(nearRight, geometry.scaleVector(forward, unit.ranged.range));
        return { nearLeft, nearRight, farRight, farLeft };
    }

    function getUnitSides(unit) {
        const corners = geometry.getUnitCorners(unit);
        return [
            { name: 'front', start: corners.frontLeft, end: corners.frontRight },
            { name: 'right', start: corners.frontRight, end: corners.backRight },
            { name: 'back', start: corners.backRight, end: corners.backLeft },
            { name: 'left', start: corners.backLeft, end: corners.frontLeft }
        ];
    }

    function lerpPoint(start, end, t) {
        return {
            x: geometry.lerp(start.x, end.x, t),
            y: geometry.lerp(start.y, end.y, t)
        };
    }

    function segmentLength(start, end) {
        return geometry.distance(start, end);
    }

    function distancePointToSegment(point, start, end) {
        const segment = geometry.subtract(end, start);
        const lengthSquared = geometry.dot(segment, segment);
        if (lengthSquared <= Number.EPSILON) {
            return geometry.distance(point, start);
        }
        const projection = geometry.clamp(geometry.dot(geometry.subtract(point, start), segment) / lengthSquared, 0, 1);
        return geometry.distance(point, lerpPoint(start, end, projection));
    }

    function sideMidpoint(side) {
        return geometry.midpoint(side.start, side.end);
    }

    function getNearestTargetSide(attacker, target) {
        const attackerArea = getRangedArea(attacker);
        const origin = attackerArea ? geometry.midpoint(attackerArea.nearLeft, attackerArea.nearRight) : geometry.getUnitCenter(attacker);
        return getUnitSides(target).reduce((best, side) => {
            const distance = distancePointToSegment(origin, side.start, side.end);
            if (!best || distance < best.distance) {
                return { ...side, distance };
            }
            return best;
        }, null);
    }

    function pointToLocal(point, origin, right, forward) {
        const delta = geometry.subtract(point, origin);
        return {
            u: geometry.dot(delta, right),
            v: geometry.dot(delta, forward)
        };
    }

    function segmentIntersectsBox(start, end, box) {
        let t0 = 0;
        let t1 = 1;
        const dx = end.u - start.u;
        const dy = end.v - start.v;
        const tests = [
            [-dx, start.u - box.minU],
            [dx, box.maxU - start.u],
            [-dy, start.v - box.minV],
            [dy, box.maxV - start.v]
        ];
        for (const [p, q] of tests) {
            if (Math.abs(p) <= Number.EPSILON) {
                if (q < 0) {
                    return false;
                }
                continue;
            }
            const ratio = q / p;
            if (p < 0) {
                t0 = Math.max(t0, ratio);
            } else {
                t1 = Math.min(t1, ratio);
            }
            if (t0 > t1) {
                return false;
            }
        }
        return true;
    }

    function isTargetInRangedArea(attacker, target) {
        if (!isRangedUnit(attacker) || getPlayerId(attacker) === getPlayerId(target)) {
            return false;
        }
        const nearestSide = getNearestTargetSide(attacker, target);
        if (!nearestSide) {
            return false;
        }
        const shooterCorners = geometry.getUnitCorners(attacker);
        const frontMid = geometry.midpoint(shooterCorners.frontLeft, shooterCorners.frontRight);
        const right = geometry.getRightVector(attacker.rotation);
        const forward = geometry.getForwardVector(attacker.rotation);
        const localStart = pointToLocal(nearestSide.start, frontMid, right, forward);
        const localEnd = pointToLocal(nearestSide.end, frontMid, right, forward);
        return segmentIntersectsBox(localStart, localEnd, {
            minU: -attacker.ranged.width / 2,
            maxU: attacker.ranged.width / 2,
            minV: 0,
            maxV: attacker.ranged.range
        });
    }

    function cross(left, right) {
        return (left.x * right.y) - (left.y * right.x);
    }

    function orientation(a, b, c) {
        const value = cross(geometry.subtract(b, a), geometry.subtract(c, a));
        if (Math.abs(value) <= 0.0001) {
            return 0;
        }
        return value > 0 ? 1 : -1;
    }

    function onSegment(a, point, b) {
        return point.x >= Math.min(a.x, b.x) - 0.0001
            && point.x <= Math.max(a.x, b.x) + 0.0001
            && point.y >= Math.min(a.y, b.y) - 0.0001
            && point.y <= Math.max(a.y, b.y) + 0.0001;
    }

    function segmentsIntersect(a1, a2, b1, b2) {
        const o1 = orientation(a1, a2, b1);
        const o2 = orientation(a1, a2, b2);
        const o3 = orientation(b1, b2, a1);
        const o4 = orientation(b1, b2, a2);
        if (o1 !== o2 && o3 !== o4) {
            return true;
        }
        if (o1 === 0 && onSegment(a1, b1, a2)) {
            return true;
        }
        if (o2 === 0 && onSegment(a1, b2, a2)) {
            return true;
        }
        if (o3 === 0 && onSegment(b1, a1, b2)) {
            return true;
        }
        if (o4 === 0 && onSegment(b1, a2, b2)) {
            return true;
        }
        return false;
    }

    function sharedSegmentLength(a1, a2, b1, b2) {
        if (orientation(a1, a2, b1) !== 0 || orientation(a1, a2, b2) !== 0) {
            return 0;
        }
        const axis = geometry.normalize(geometry.subtract(a2, a1));
        const aStart = geometry.dot(a1, axis);
        const aEnd = geometry.dot(a2, axis);
        const bStart = geometry.dot(b1, axis);
        const bEnd = geometry.dot(b2, axis);
        const overlapStart = Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd));
        const overlapEnd = Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd));
        return Math.max(0, overlapEnd - overlapStart);
    }

    function hasMeaningfulSharedEdge(a1, a2, b1, b2) {
        return sharedSegmentLength(a1, a2, b1, b2) > data.COLLISION_EPSILON;
    }

    function segmentIntersectsPolygon(start, end, polygon) {
        if (geometry.pointInPolygon(start, polygon) || geometry.pointInPolygon(end, polygon)) {
            return true;
        }
        const points = geometry.cornersToPoints(polygon);
        for (let index = 0; index < points.length; index += 1) {
            const next = points[(index + 1) % points.length];
            if (segmentsIntersect(start, end, points[index], next)) {
                return true;
            }
        }
        return false;
    }

    function buildSightLines(attacker, target) {
        const shooterCorners = geometry.getUnitCorners(attacker);
        const nearestSide = getNearestTargetSide(attacker, target);
        const frontMid = geometry.midpoint(shooterCorners.frontLeft, shooterCorners.frontRight);
        const targetMid = sideMidpoint(nearestSide);
        return [
            { start: shooterCorners.frontLeft, end: nearestSide.start },
            { start: frontMid, end: targetMid },
            { start: shooterCorners.frontRight, end: nearestSide.end }
        ];
    }

    function sampleSegmentTerrain(start, end, terrain) {
        const length = segmentLength(start, end);
        const steps = Math.max(2, Math.ceil(length / 2));
        const samples = [];
        for (let step = 1; step < steps; step += 1) {
            const ratio = step / steps;
            const point = lerpPoint(start, end, ratio);
            samples.push({
                point,
                distanceFromStart: length * ratio,
                distanceFromEnd: length * (1 - ratio),
                kind: getTerrainTypeAt(point, terrain)
            });
        }
        return samples;
    }

    function isSightLineBlocked(start, end, attacker, target, units, terrain) {
        const ignoreIds = new Set([attacker.id, target.id]);
        const blockingUnit = units.find((unit) => !ignoreIds.has(unit.id) && segmentIntersectsPolygon(start, end, geometry.getUnitCorners(unit)));
        if (blockingUnit) {
            return true;
        }

        const roughAllowance = data.pacesToMm(data.ROUGH_LOS_ALLOWANCE_PACES);
        const startRoughAllowance = isUnitInBadGoing(attacker, terrain) ? roughAllowance : 0;
        const endRoughAllowance = isUnitInBadGoing(target, terrain) ? roughAllowance : 0;
        const samples = sampleSegmentTerrain(start, end, terrain);
        return samples.some((sample) => {
            if (sample.kind === 'impassable') {
                return true;
            }
            if (!ROUGH_TERRAIN_TYPES.has(sample.kind)) {
                return false;
            }
            return sample.distanceFromStart > startRoughAllowance + 0.5 && sample.distanceFromEnd > endRoughAllowance + 0.5;
        });
    }

    function hasAnyFrontContact(left, right) {
        const leftFront = getSideByName(left, 'front');
        const rightFront = getSideByName(right, 'front');
        return getUnitSides(right).some((side) => segmentsIntersect(leftFront.start, leftFront.end, side.start, side.end))
            || getUnitSides(left).some((side) => segmentsIntersect(rightFront.start, rightFront.end, side.start, side.end));
    }

    function isUnitEngagedForShooting(unit, units) {
        if (!unit) {
            return false;
        }
        return units.some((otherUnit) => {
            if (!otherUnit || otherUnit.id === unit.id || getPlayerId(otherUnit) === getPlayerId(unit)) {
                return false;
            }
            return hasAnyFrontContact(unit, otherUnit);
        });
    }

    function isValidMagicianAttack(attacker, target, units, terrain, activePlayerId, options) {
        if (!attacker || !target || getPlayerId(attacker) === getPlayerId(target) || !canUnitShoot(attacker, activePlayerId, options)) {
            return false;
        }
        if (!isMagicianUnit(attacker)) {
            return false;
        }
        if (isUnitEngagedForShooting(attacker, units)) {
            return false;
        }
        if (getBaseEdgeDistance(attacker, target) > attacker.ranged.range + 0.5) {
            return false;
        }
        const shooterCorners = geometry.getUnitCorners(attacker);
        const frontMid = geometry.midpoint(shooterCorners.frontLeft, shooterCorners.frontRight);
        const nearestSide = getNearestTargetSide(attacker, target);
        if (!nearestSide) {
            return false;
        }
        const targetMid = sideMidpoint(nearestSide);
        return !isMagicianSightLineBlocked(frontMid, targetMid, terrain);
    }

    function isValidShootingAttack(attacker, target, units, terrain, activePlayerId, options) {
        if (!attacker || !target || getPlayerId(attacker) === getPlayerId(target) || !canUnitShoot(attacker, activePlayerId, options)) {
            return false;
        }
        if (isMagicianUnit(attacker)) {
            return isValidMagicianAttack(attacker, target, units, terrain, activePlayerId, options);
        }
        if (isUnitEngagedForShooting(attacker, units)) {
            return false;
        }
        if (!isTargetInRangedArea(attacker, target)) {
            return false;
        }
        const sightLines = buildSightLines(attacker, target);
        return sightLines.some((line) => !isSightLineBlocked(line.start, line.end, attacker, target, units, terrain));
    }

    function getValidShootingTargets(attacker, units, terrain, activePlayerId) {
        if (!canUnitShoot(attacker, activePlayerId)) {
            return [];
        }
        return units
            .filter((unit) => getPlayerId(unit) !== getPlayerId(attacker))
            .filter((unit) => isValidShootingAttack(attacker, unit, units, terrain, activePlayerId))
            .map((unit) => unit.id);
    }

    function isUnitInBadGoing(unit, terrain) {
        const sample = sampleUnitTerrain(unit, terrain);
        return sample.has('forest') || sample.has('swamp');
    }

    function getUnitStrengthAgainst(unit, opponent) {
        return unit.strength[opponent.troopClass === 'mounted' ? 'mounted' : 'infantry'];
    }

    function choosePrimaryAttacker(attackers, defender) {
        return [...attackers].sort((left, right) => {
            const strengthDelta = getUnitStrengthAgainst(right, defender) - getUnitStrengthAgainst(left, defender);
            if (strengthDelta !== 0) {
                return strengthDelta;
            }
            return left.id.localeCompare(right.id);
        })[0];
    }

    function getExtraShooterPenalty(count) {
        if (count <= 1) {
            return 0;
        }
        return Math.min(count - 1, 2);
    }

    function getCombatModifiers(context) {
        const modifiers = [];
        const unitInBadGoing = isUnitInBadGoing(context.unit, context.terrain);
        if (unitInBadGoing && !context.unit.combat?.ignoresBadGoingPenalty) {
            modifiers.push({ id: 'bad-going', value: -2 });
        }
        if (context.role === 'attacker' && context.unit.troopClass === 'mounted' && isUnitInBadGoing(context.opponent, context.terrain)) {
            const hasBadGoingPenalty = modifiers.some((modifier) => modifier.value === -2);
            if (!hasBadGoingPenalty) {
                modifiers.push({ id: 'mounted-into-bad-going', value: -2 });
            }
        }
        if (context.phase === 'shooting' && context.role === 'defender' && context.attackers) {
            const extraShooterPenalty = getExtraShooterPenalty(context.attackers.length);
            if (extraShooterPenalty > 0) {
                modifiers.push({ id: 'multiple-shooters', value: -extraShooterPenalty });
            }
        }
        if (context.phase === 'melee') {
            if (context.combatant && context.combatant.unitIds.length > 1) {
                modifiers.push({ id: 'stacked', value: 1 });
            }
            const incomingEdges = context.incomingEdges || [];
            if (incomingEdges.includes('left') || incomingEdges.includes('right')) {
                modifiers.push({ id: 'flank-attacked', value: -1 });
            }
            if (incomingEdges.includes('rear') && context.opponentCombatant && !hasFrontContactOnCombatant(context.opponentCombatant.id, context.combats || [])) {
                modifiers.push({ id: 'rear-attacked', value: -1 });
            }
            if (context.combatant && context.opponentCombatant && context.combatants && context.fightingCombatantIds) {
                const idleEnemyCombatants = context.combatants.filter((combatant) => combatant.playerId === context.opponentCombatant.playerId);
                const overlapCount = countOverlapsOnCombatant(context.combatant, idleEnemyCombatants, context.fightingCombatantIds);
                if (overlapCount > 0) {
                    modifiers.push({ id: 'overlapped', value: -overlapCount });
                }
            }
        }
        return modifiers;
    }

    function sumModifiers(modifiers) {
        return modifiers.reduce((sum, modifier) => sum + modifier.value, 0);
    }

    function getMinorLossResolution(winner, loser, phase, terrain) {
        const loserInBadGoing = isUnitInBadGoing(loser, terrain);
        const loserIsSpear = loser.type === 'Spear' || loser.type === 'Heavy-Spear';
        const winnerIsWarband = winner.type === 'Warband' || winner.type === 'Heavy-Warband';
        if (loser.type === 'Flyers') {
            return { outcome: 'flee', destructionRule: null };
        }
        if (loser.type === 'Behemoth' && winner.type === 'Artillery') {
            return { outcome: 'flee', destructionRule: null };
        }
        if (loser.type === 'Magician' && winner.type === 'Hero' && phase === 'melee') {
            return { outcome: 'destroy', destructionRule: 'Heroes destroy Magicians when they win melee.' };
        }
        if (winner.type === 'Magician' && (loser.type === 'Hero' || loser.type === 'Magician')) {
            return { outcome: 'ensorcel', destructionRule: 'Magicians ensorcel Heroes and Magicians on a minor win.' };
        }
        if (loser.type === 'Hero') {
            return { outcome: 'recoil', destructionRule: null };
        }
        if (loser.type === 'Beasts' && phase === 'melee' && winner.troopClass === 'mounted') {
            return { outcome: 'destroy', destructionRule: 'Mounted troops destroy Beasts when the Beasts lose melee.' };
        }
        if (loser.type === 'Artillery' && phase === 'melee') {
            return { outcome: 'destroy', destructionRule: 'Artillery is destroyed when it loses melee.' };
        }
        if (loser.type === 'Shooter') {
            if (phase === 'shooting') {
                return { outcome: 'recoil', destructionRule: null };
            }
            return winner.troopClass === 'mounted'
                ? { outcome: 'destroy', destructionRule: 'Mounted troops destroy Shooters on a minor win.' }
                : { outcome: 'recoil', destructionRule: null };
        }
        if (loser.type === 'Riders') {
            return loserInBadGoing
                ? { outcome: 'destroy', destructionRule: 'Riders are destroyed when they lose in bad going.' }
                : { outcome: 'recoil', destructionRule: null };
        }
        if (loser.type === 'Knights') {
            if (loserInBadGoing) {
                return { outcome: 'destroy', destructionRule: 'Knights are destroyed when they lose in bad going.' };
            }
            if (phase === 'melee' && winner.type === 'Shooter') {
                return { outcome: 'destroy', destructionRule: 'Shooters destroy Knights when the Knights lose melee.' };
            }
            return { outcome: 'recoil', destructionRule: null };
        }
        if (loserIsSpear || loser.type === 'Blade' || loser.type === 'Horde') {
            if (winnerIsWarband) {
                return { outcome: 'destroy', destructionRule: 'Warbands destroy Spears, Blades, and Hordes on a minor win.' };
            }
            if (winner.type === 'Knights' && !loserInBadGoing) {
                return { outcome: 'destroy', destructionRule: 'Knights destroy Spears, Blades, and Hordes in good going.' };
            }
            return { outcome: 'recoil', destructionRule: null };
        }
        return { outcome: 'recoil', destructionRule: null };
    }

    function cloneUnit(unit) {
        return {
            ...unit,
            moves: unit.moves ? { ...unit.moves } : undefined,
            strength: unit.strength ? { ...unit.strength } : undefined,
            ranged: unit.ranged ? { ...unit.ranged } : null,
            movement: unit.movement ? { ...unit.movement } : {},
            combat: unit.combat ? { ...unit.combat } : {},
            ensorcelledByUnitId: unit.ensorcelledByUnitId
        };
    }

    function buildEnsorcelledUnit(unit, ensorcelledByUnitId) {
        return {
            ...cloneUnit(unit),
            ensorcelledByUnitId: ensorcelledByUnitId === undefined ? null : ensorcelledByUnitId
        };
    }

    function getRearAlignedFriendly(unit, units, excludedIds) {
        const unitCorners = geometry.getUnitCorners(unit);
        const unitBackMid = geometry.midpoint(unitCorners.backLeft, unitCorners.backRight);
        const forward = geometry.getForwardVector(unit.rotation);
        const right = geometry.getRightVector(unit.rotation);
        return units.find((otherUnit) => {
            if (excludedIds.has(otherUnit.id) || getPlayerId(otherUnit) !== getPlayerId(unit)) {
                return false;
            }
            if (Math.abs(geometry.normalizeAngle(otherUnit.rotation - unit.rotation)) > 0.12) {
                return false;
            }
            const otherCorners = geometry.getUnitCorners(otherUnit);
            const otherFrontMid = geometry.midpoint(otherCorners.frontLeft, otherCorners.frontRight);
            const delta = geometry.subtract(otherFrontMid, unitBackMid);
            return Math.abs(geometry.dot(delta, right)) <= data.FILE_TOLERANCE
                && Math.abs(geometry.dot(delta, forward)) <= data.FORMATION_GAP_TOLERANCE;
        }) || null;
    }

    function hasRearOrSideEnemyContact(unit, units) {
        return units.some((otherUnit) => {
            if (getPlayerId(otherUnit) === getPlayerId(unit) || otherUnit.id === unit.id) {
                return false;
            }
            const touchedSides = new Set();
            getUnitSides(unit).forEach((unitSide) => {
                if (touchedSides.has(unitSide.name)) {
                    return;
                }
                const sharesEdge = getUnitSides(otherUnit).some((otherSide) => hasMeaningfulSharedEdge(unitSide.start, unitSide.end, otherSide.start, otherSide.end));
                if (sharesEdge) {
                    touchedSides.add(unitSide.name);
                }
            });
            return touchedSides.has('back') || touchedSides.has('left') || touchedSides.has('right');
        });
    }

    function getRecoilBlockReason(unit, units, terrain, movingIds) {
        const terrainTypes = sampleUnitTerrain(unit, terrain);
        if (terrainTypes.has('impassable') || terrainTypes.has('water')) {
            return terrainTypes.has('water')
                ? 'recoil path enters water'
                : 'recoil path enters impassable terrain';
        }
        const blockingUnit = units.find((otherUnit) => !movingIds.has(otherUnit.id) && geometry.polygonsOverlap(geometry.getUnitCorners(unit), geometry.getUnitCorners(otherUnit)));
        if (blockingUnit) {
            return `recoil path is blocked by ${getPlayerId(blockingUnit)} ${blockingUnit.type} ${blockingUnit.id}`;
        }
        return null;
    }

    function canOccupyAfterRecoil(unit, units, terrain, movingIds) {
        return !getRecoilBlockReason(unit, units, terrain, movingIds);
    }

    function resolveRecoil(unitId, units, terrain) {
        const movingIds = new Set();
        const chain = [];
        let current = units.find((unit) => unit.id === unitId) || null;
        if (!current) {
            return { units, destroyedIds: [], destructionReasons: {} };
        }
        if (hasRearOrSideEnemyContact(current, units)) {
            return {
                units,
                destroyedIds: [unitId],
                destructionReasons: { [unitId]: 'recoil is blocked by rear or side enemy contact' }
            };
        }
        while (current) {
            chain.push(current.id);
            movingIds.add(current.id);
            current = getRearAlignedFriendly(current, units, movingIds);
        }

        const shifted = new Map();
        for (let index = chain.length - 1; index >= 0; index -= 1) {
            const unit = units.find((entry) => entry.id === chain[index]);
            const backwardDelta = geometry.scaleVector(geometry.getForwardVector(unit.rotation), -unit.depth);
            const candidate = cloneUnit(unit);
            candidate.x += backwardDelta.x;
            candidate.y += backwardDelta.y;
            const stagedUnits = units.map((entry) => shifted.get(entry.id) || entry);
            const recoilBlockReason = getRecoilBlockReason(candidate, stagedUnits, terrain, movingIds);
            if (recoilBlockReason) {
                return {
                    units,
                    destroyedIds: [unitId],
                    destructionReasons: { [unitId]: recoilBlockReason }
                };
            }
            shifted.set(candidate.id, candidate);
        }

        return {
            units: units.map((unit) => shifted.get(unit.id) || unit),
            destroyedIds: [],
            destructionReasons: {}
        };
    }

    function translateUnit(unit, direction, distance) {
        return {
            ...unit,
            x: unit.x + (direction.x * distance),
            y: unit.y + (direction.y * distance)
        };
    }

    function isUnitInForbiddenBehemothFleeTerrain(unit, terrain) {
        const corners = geometry.getUnitCorners(unit);
        const center = geometry.getUnitCenter(unit);
        const frontMid = geometry.midpoint(corners.frontLeft, corners.frontRight);
        const backMid = geometry.midpoint(corners.backLeft, corners.backRight);
        const samplePoints = [corners.frontLeft, corners.frontRight, corners.backLeft, corners.backRight, center, frontMid, backMid];
        return terrain.features.some((feature) => (feature.kind === 'forest'
            || feature.kind === 'swamp'
            || feature.kind === 'water'
            || feature.kind === 'impassable')
            && samplePoints.some((point) => geometry.pointInBlob(point, feature)));
    }

    function getBehemothFleeBlockReason(candidate, units, terrain, fleeingUnitId) {
        if (isUnitInForbiddenBehemothFleeTerrain(candidate, terrain)) {
            return 'flee path enters forbidden terrain';
        }
        const enemyBlocker = units.find((unit) => unit.id !== fleeingUnitId
            && getPlayerId(unit) !== getPlayerId(candidate)
            && geometry.polygonsOverlap(geometry.getUnitCorners(candidate), geometry.getUnitCorners(unit)));
        if (enemyBlocker) {
            return `flee path is blocked by ${getPlayerId(enemyBlocker)} ${enemyBlocker.type} ${enemyBlocker.id}`;
        }
        return null;
    }

    function canBehemothFleeAlong(unit, direction, units, terrain) {
        const fleeDistance = data.pacesToMm(600);
        for (let step = 1; step <= data.PATH_SAMPLES; step += 1) {
            const candidate = translateUnit(unit, direction, fleeDistance * (step / data.PATH_SAMPLES));
            if (getBehemothFleeBlockReason(candidate, units, terrain, unit.id)) {
                return false;
            }
        }
        const finalUnit = translateUnit(unit, direction, fleeDistance);
        return !units.some((otherUnit) => otherUnit.id !== unit.id
            && getPlayerId(otherUnit) === getPlayerId(unit)
            && geometry.polygonsOverlap(geometry.getUnitCorners(finalUnit), geometry.getUnitCorners(otherUnit)));
    }

    function resolveFlee(unitId, units, terrain) {
        const unit = units.find((entry) => entry.id === unitId) || null;
        if (!unit) {
            return { units, destroyedIds: [], destructionReasons: {} };
        }
        const fleeDistance = data.pacesToMm(600);
        const backward = geometry.scaleVector(geometry.getForwardVector(unit.rotation), -1);
        if (unit.type === 'Flyers') {
            const fledUnit = translateUnit(unit, backward, fleeDistance);
            return {
                units: units.map((entry) => entry.id === unitId ? fledUnit : entry),
                destroyedIds: [],
                destructionReasons: {}
            };
        }
        if (unit.type !== 'Behemoth') {
            return { units, destroyedIds: [], destructionReasons: {} };
        }
        const backwardAngle = Math.atan2(backward.y, backward.x);
        for (let degrees = 0; degrees <= 90; degrees += 1) {
            const offsets = degrees === 0 ? [0] : [-degrees, degrees];
            for (const offset of offsets) {
                const angle = backwardAngle + (offset * (Math.PI / 180));
                const direction = { x: Math.cos(angle), y: Math.sin(angle) };
                if (!canBehemothFleeAlong(unit, direction, units, terrain)) {
                    continue;
                }
                const fledUnit = translateUnit(unit, direction, fleeDistance);
                return {
                    units: units.map((entry) => entry.id === unitId ? fledUnit : entry),
                    destroyedIds: [],
                    destructionReasons: {}
                };
            }
        }
        return {
            units,
            destroyedIds: [unitId],
            destructionReasons: { [unitId]: 'Behemoth flee requires a turn greater than 90 degrees.' }
        };
    }

    function resolveShooting(units, declarations, terrain, rollDie, activePlayerId) {
        const baseUnits = units.map(cloneUnit);
        const attacksByTarget = new Map();
        Object.entries(declarations || {}).forEach(([attackerId, targetId]) => {
            const attacker = baseUnits.find((unit) => unit.id === attackerId);
            const target = baseUnits.find((unit) => unit.id === targetId);
            if (!attacker || !target || !isValidShootingAttack(attacker, target, baseUnits, terrain, activePlayerId, { allowAlreadyAttacked: true })) {
                return;
            }
            if (!attacksByTarget.has(targetId)) {
                attacksByTarget.set(targetId, []);
            }
            attacksByTarget.get(targetId).push(attackerId);
        });

        const results = [];
        const recoilDestructions = [];
        attacksByTarget.forEach((attackerIds, targetId) => {
            const defender = baseUnits.find((unit) => unit.id === targetId);
            const attackers = attackerIds
                .map((attackerId) => baseUnits.find((unit) => unit.id === attackerId))
                .filter(Boolean);
            if (!defender || attackers.length === 0) {
                return;
            }
            const primaryAttacker = choosePrimaryAttacker(attackers, defender);
            const attackerModifiers = getCombatModifiers({
                phase: 'shooting',
                role: 'attacker',
                unit: primaryAttacker,
                opponent: defender,
                attackers,
                terrain
            });
            const defenderModifiers = getCombatModifiers({
                phase: 'shooting',
                role: 'defender',
                unit: defender,
                opponent: primaryAttacker,
                attackers,
                terrain
            });
            const attackerRoll = rollDie({ role: 'attacker', attackerIds, primaryAttackerId: primaryAttacker.id, defenderId: defender.id });
            const defenderRoll = rollDie({ role: 'defender', attackerIds, primaryAttackerId: primaryAttacker.id, defenderId: defender.id });
            const attackerTotal = attackerRoll + getUnitStrengthAgainst(primaryAttacker, defender) + sumModifiers(attackerModifiers);
            const defenderTotal = defenderRoll + getUnitStrengthAgainst(defender, primaryAttacker) + sumModifiers(defenderModifiers);
            const result = {
                attackerIds,
                primaryAttackerId: primaryAttacker.id,
                defenderId: defender.id,
                attackerRoll,
                defenderRoll,
                attackerModifiers,
                defenderModifiers,
                attackerTotal,
                defenderTotal,
                outcome: 'tie',
                loserId: null,
                destructionRule: null
            };
            if (attackerTotal === defenderTotal) {
                results.push(result);
                return;
            }
            const attackerWon = attackerTotal > defenderTotal;
            const highTotal = Math.max(attackerTotal, defenderTotal);
            const lowTotal = Math.min(attackerTotal, defenderTotal);
            const winner = attackerWon ? primaryAttacker : defender;
            const loser = attackerWon ? defender : primaryAttacker;
            if (!attackerWon) {
                result.outcome = 'no-effect';
                results.push(result);
                return;
            }
            result.loserId = loser.id;
            result.winnerId = winner.id;
            if (highTotal >= lowTotal * 2) {
                result.outcome = 'destroy';
                result.destructionRule = 'Double total destroys the loser.';
                results.push(result);
                return;
            }
            const lossResolution = getMinorLossResolution(winner, loser, 'shooting', terrain);
            result.outcome = lossResolution.outcome;
            result.destructionRule = lossResolution.destructionRule;
            results.push(result);
        });

        const destroyedIds = new Set();
        const ensorcelledIds = new Map();
        const recoils = [];
        results.forEach((result) => {
            if (!result.loserId) {
                return;
            }
            if (result.outcome === 'destroy') {
                destroyedIds.add(result.loserId);
                return;
            }
            if (result.outcome === 'ensorcel') {
                ensorcelledIds.set(result.loserId, result.winnerId);
                return;
            }
            if (result.outcome === 'recoil' || result.outcome === 'flee') {
                recoils.push({ unitId: result.loserId, flee: result.outcome === 'flee' });
            }
        });
        results.forEach((result) => {
            const attacker = baseUnits.find((unit) => unit.id === result.primaryAttackerId);
            if (attacker?.type === 'Magician' && result.attackerRoll === 1) {
                ensorcelledIds.set(attacker.id, null);
            }
        });

        let mutableUnits = units.map(cloneUnit).filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id));
        recoils.forEach((entry) => {
            const unitId = entry.unitId;
            if (destroyedIds.has(unitId)) {
                return;
            }
            const recoil = resolveRecoil(unitId, mutableUnits, terrain);
            if (recoil.destroyedIds.length > 0) {
                recoil.destroyedIds.forEach((destroyedId) => {
                    recoilDestructions.push({
                        unitId: destroyedId,
                        reason: recoil.destructionReasons[destroyedId] || 'recoil destruction reason unavailable'
                    });
                });
                recoil.destroyedIds.forEach((destroyedId) => destroyedIds.add(destroyedId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = recoil.units;
            if (!entry.flee) {
                return;
            }
            const flee = resolveFlee(unitId, mutableUnits, terrain);
            if (flee.destroyedIds.length > 0) {
                flee.destroyedIds.forEach((destroyedId) => {
                    recoilDestructions.push({
                        unitId: destroyedId,
                        reason: flee.destructionReasons[destroyedId] || 'flee destruction reason unavailable'
                    });
                });
                flee.destroyedIds.forEach((destroyedId) => destroyedIds.add(destroyedId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = flee.units;
        });

        const destroyedUnits = units.filter((unit) => destroyedIds.has(unit.id)).map(cloneUnit);
        const ensorcelledUnits = [...ensorcelledIds.entries()].map(([unitId, ensorcelledByUnitId]) => {
            const unit = units.find((entry) => entry.id === unitId);
            return unit ? buildEnsorcelledUnit(unit, ensorcelledByUnitId) : null;
        }).filter(Boolean);
        return {
            units: mutableUnits.filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id)),
            destroyedUnits,
            ensorcelledUnits,
            results,
            recoilDestructions,
            attacksByTarget: Object.fromEntries(Array.from(attacksByTarget.entries()).map(([targetId, attackerIds]) => [targetId, [...attackerIds]]))
        };
    }

    function getSideByName(unit, sideName) {
        return getUnitSides(unit).find((side) => side.name === sideName) || null;
    }

    function getFrontTouchedEdges(attacker, defender) {
        const attackerFront = getSideByName(attacker, 'front');
        const touched = new Set();
        getUnitSides(defender).forEach((side) => {
            if (hasMeaningfulSharedEdge(attackerFront.start, attackerFront.end, side.start, side.end)) {
                touched.add(side.name);
            }
        });
        return touched;
    }

    function areSameFacing(left, right) {
        return Math.abs(geometry.normalizeAngle(left.rotation - right.rotation)) <= 0.12;
    }

    function isStackEligible(unit) {
        return STACKABLE_TYPES.has(unit.type);
    }

    function buildStackGroups(units) {
        const parent = new Map();
        units.forEach((unit) => parent.set(unit.id, unit.id));

        function find(unitId) {
            let current = parent.get(unitId);
            while (current !== parent.get(current)) {
                current = parent.get(current);
            }
            let walker = unitId;
            while (walker !== current) {
                const next = parent.get(walker);
                parent.set(walker, current);
                walker = next;
            }
            return current;
        }

        function union(leftId, rightId) {
            const leftRoot = find(leftId);
            const rightRoot = find(rightId);
            if (leftRoot !== rightRoot) {
                parent.set(rightRoot, leftRoot);
            }
        }

        for (let index = 0; index < units.length; index += 1) {
            for (let inner = index + 1; inner < units.length; inner += 1) {
                const left = units[index];
                const right = units[inner];
                if (getPlayerId(left) !== getPlayerId(right) || left.type !== right.type || !isStackEligible(left) || !areSameFacing(left, right)) {
                    continue;
                }
                if (sharesFormationContact(left, right)) {
                    union(left.id, right.id);
                }
            }
        }

        const groups = new Map();
        units.forEach((unit) => {
            const root = find(unit.id);
            if (!groups.has(root)) {
                groups.set(root, []);
            }
            groups.get(root).push(unit.id);
        });

        return Array.from(groups.values()).map((group) => group.sort());
    }

    function buildMeleeCombatants(units) {
        return buildStackGroups(units).map((unitIds) => {
            const members = unitIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
            const primaryUnit = [...members].sort((left, right) => left.id.localeCompare(right.id))[0];
            return {
                id: unitIds.join('+'),
                unitIds: [...unitIds],
                units: members,
                primaryUnit,
                playerId: getPlayerId(primaryUnit),
                type: primaryUnit.type
            };
        });
    }

    function collectCombatantContact(leftCombatant, rightCombatant) {
        const edgesOnLeft = new Set();
        const edgesOnRight = new Set();

        leftCombatant.units.forEach((leftUnit) => {
            rightCombatant.units.forEach((rightUnit) => {
                getFrontTouchedEdges(leftUnit, rightUnit).forEach((edgeName) => edgesOnRight.add(edgeName));
                getFrontTouchedEdges(rightUnit, leftUnit).forEach((edgeName) => edgesOnLeft.add(edgeName));
            });
        });

        if (edgesOnLeft.size === 0 && edgesOnRight.size === 0) {
            return null;
        }

        return {
            edgesOnLeft: [...edgesOnLeft],
            edgesOnRight: [...edgesOnRight]
        };
    }

    function collectCombatantEdgeContact(leftCombatant, rightCombatant) {
        const edgesOnLeft = new Set();
        const edgesOnRight = new Set();

        leftCombatant.units.forEach((leftUnit) => {
            const leftSides = getUnitSides(leftUnit);
            rightCombatant.units.forEach((rightUnit) => {
                const rightSides = getUnitSides(rightUnit);
                leftSides.forEach((leftSide) => {
                    rightSides.forEach((rightSide) => {
                        if (hasMeaningfulSharedEdge(leftSide.start, leftSide.end, rightSide.start, rightSide.end)) {
                            edgesOnLeft.add(leftSide.name);
                            edgesOnRight.add(rightSide.name);
                        }
                    });
                });
            });
        });

        if (edgesOnLeft.size === 0 && edgesOnRight.size === 0) {
            return null;
        }

        return {
            edgesOnLeft: [...edgesOnLeft],
            edgesOnRight: [...edgesOnRight]
        };
    }

    function getSharedEdgeMidpoint(leftSide, rightSide) {
        const axis = geometry.normalize(geometry.subtract(leftSide.end, leftSide.start));
        const leftStart = geometry.dot(leftSide.start, axis);
        const leftEnd = geometry.dot(leftSide.end, axis);
        const rightStart = geometry.dot(rightSide.start, axis);
        const rightEnd = geometry.dot(rightSide.end, axis);
        const overlapStart = Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd));
        const overlapEnd = Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd));
        const overlapMid = (overlapStart + overlapEnd) / 2;
        const offset = overlapMid - leftStart;
        return geometry.add(leftSide.start, geometry.scaleVector(axis, offset));
    }

    function findCombatantSharedEdge(leftCombatant, rightCombatant) {
        for (const leftUnit of leftCombatant.units) {
            const leftSides = getUnitSides(leftUnit);
            for (const rightUnit of rightCombatant.units) {
                const rightSides = getUnitSides(rightUnit);
                for (const leftSide of leftSides) {
                    for (const rightSide of rightSides) {
                        if (!hasMeaningfulSharedEdge(leftSide.start, leftSide.end, rightSide.start, rightSide.end)) {
                            continue;
                        }
                        return {
                            leftUnitId: leftUnit.id,
                            rightUnitId: rightUnit.id,
                            leftSideName: leftSide.name,
                            rightSideName: rightSide.name,
                            midpoint: getSharedEdgeMidpoint(leftSide, rightSide)
                        };
                    }
                }
            }
        }
        return null;
    }

    function hasSideOnlyContact(contact) {
        if (!contact) {
            return false;
        }
        const leftTouchesSide = contact.edgesOnLeft.includes('left') || contact.edgesOnLeft.includes('right');
        const rightTouchesSide = contact.edgesOnRight.includes('left') || contact.edgesOnRight.includes('right');
        return leftTouchesSide
            && rightTouchesSide
            && !contact.edgesOnLeft.includes('front')
            && !contact.edgesOnRight.includes('front');
    }

    function detectMeleeCombats(units) {
        const combatants = buildMeleeCombatants(units);
        const combats = [];
        const participantIds = new Set();
        const engagedCombatantIds = new Set();

        function addCombat(leftCombatant, rightCombatant, contact) {
            combats.push({
                id: `${leftCombatant.id}::${rightCombatant.id}`,
                leftCombatantId: leftCombatant.id,
                rightCombatantId: rightCombatant.id,
                leftUnitIds: [...leftCombatant.unitIds],
                rightUnitIds: [...rightCombatant.unitIds],
                leftPrimaryId: leftCombatant.primaryUnit.id,
                rightPrimaryId: rightCombatant.primaryUnit.id,
                edgesOnLeft: contact.edgesOnLeft,
                edgesOnRight: contact.edgesOnRight
            });
            engagedCombatantIds.add(leftCombatant.id);
            engagedCombatantIds.add(rightCombatant.id);
            leftCombatant.unitIds.forEach((unitId) => participantIds.add(unitId));
            rightCombatant.unitIds.forEach((unitId) => participantIds.add(unitId));
        }

        for (let index = 0; index < combatants.length; index += 1) {
            for (let inner = index + 1; inner < combatants.length; inner += 1) {
                const leftCombatant = combatants[index];
                const rightCombatant = combatants[inner];
                if (leftCombatant.playerId === rightCombatant.playerId) {
                    continue;
                }
                const contact = collectCombatantContact(leftCombatant, rightCombatant);
                if (!contact) {
                    continue;
                }
                addCombat(leftCombatant, rightCombatant, contact);
            }
        }

        for (let index = 0; index < combatants.length; index += 1) {
            for (let inner = index + 1; inner < combatants.length; inner += 1) {
                const leftCombatant = combatants[index];
                const rightCombatant = combatants[inner];
                if (leftCombatant.playerId === rightCombatant.playerId) {
                    continue;
                }
                if (engagedCombatantIds.has(leftCombatant.id) || engagedCombatantIds.has(rightCombatant.id)) {
                    continue;
                }
                const sideContact = collectCombatantEdgeContact(leftCombatant, rightCombatant);
                if (!hasSideOnlyContact(sideContact)) {
                    continue;
                }
                addCombat(leftCombatant, rightCombatant, sideContact);
            }
        }

        return {
            combatants,
            combats,
            participantIds
        };
    }

    function getIncomingEdges(combat, combatantId) {
        if (combat.leftCombatantId === combatantId) {
            return combat.edgesOnLeft;
        }
        if (combat.rightCombatantId === combatantId) {
            return combat.edgesOnRight;
        }
        return [];
    }

    function hasFrontContactOnCombatant(combatantId, combats) {
        return combats.some((combat) => getIncomingEdges(combat, combatantId).includes('front'));
    }

    function getSideContactDirection(anchorUnit, otherUnit) {
        if (!areSameFacing(anchorUnit, otherUnit)) {
            return null;
        }
        const forward = geometry.getForwardVector(anchorUnit.rotation);
        const right = geometry.getRightVector(anchorUnit.rotation);
        const anchorCenter = geometry.getUnitCenter(anchorUnit);
        const otherCenter = geometry.getUnitCenter(otherUnit);
        const delta = geometry.subtract(otherCenter, anchorCenter);
        const u = geometry.dot(delta, right);
        const v = geometry.dot(delta, forward);
        const sideAligned = Math.abs(v) <= data.RANK_TOLERANCE && Math.abs(Math.abs(u) - anchorUnit.width) <= data.FORMATION_GAP_TOLERANCE;
        if (!sideAligned) {
            return null;
        }
        return u < 0 ? 'left' : 'right';
    }

    function getFlankContactDirection(anchorUnit, otherUnit) {
        const anchorSides = getUnitSides(anchorUnit).filter((side) => side.name === 'left' || side.name === 'right');
        for (const anchorSide of anchorSides) {
            const sharesEdge = getUnitSides(otherUnit).some((otherSide) => hasMeaningfulSharedEdge(anchorSide.start, anchorSide.end, otherSide.start, otherSide.end));
            if (sharesEdge) {
                return anchorSide.name;
            }
        }
        return null;
    }

    function countOverlapsOnCombatant(combatant, idleEnemyCombatants, fightingCombatantIds) {
        const overlappedSides = new Set();
        idleEnemyCombatants.forEach((enemyCombatant) => {
            if (enemyCombatant.id === combatant.id || fightingCombatantIds.has(enemyCombatant.id)) {
                return;
            }
            combatant.units.forEach((anchorUnit) => {
                enemyCombatant.units.forEach((enemyUnit) => {
                    const side = getFlankContactDirection(anchorUnit, enemyUnit);
                    if (side) {
                        overlappedSides.add(side);
                    }
                });
            });
        });
        return overlappedSides.size;
    }

    function rotateUnitInPlace(unit, rotation) {
        return geometry.buildUnitFromCenter(unit, geometry.getUnitCenter(unit), rotation);
    }

    function getCombatantCenter(combatant) {
        const centers = combatant.units.map((unit) => geometry.getUnitCenter(unit));
        return {
            x: geometry.average(centers.map((center) => center.x)),
            y: geometry.average(centers.map((center) => center.y))
        };
    }

    function getFacingRotationTowardOpponent(combatant, opponentCombatant) {
        const from = getCombatantCenter(combatant);
        const to = getCombatantCenter(opponentCombatant);
        if (geometry.distance(from, to) <= data.COLLISION_EPSILON) {
            return null;
        }
        return geometry.normalizeAngle(Math.atan2(to.x - from.x, from.y - to.y));
    }

    function buildCombatFacingPlans(combatSetup) {
        const combatantsById = new Map(combatSetup.combatants.map((combatant) => [combatant.id, combatant]));
        const combatCountByCombatant = new Map();
        combatSetup.combats.forEach((combat) => {
            combatCountByCombatant.set(combat.leftCombatantId, (combatCountByCombatant.get(combat.leftCombatantId) || 0) + 1);
            combatCountByCombatant.set(combat.rightCombatantId, (combatCountByCombatant.get(combat.rightCombatantId) || 0) + 1);
        });

        const plans = new Map();
        combatSetup.combats.forEach((combat) => {
            const leftCombatant = combatantsById.get(combat.leftCombatantId);
            const rightCombatant = combatantsById.get(combat.rightCombatantId);
            const sharedEdge = findCombatantSharedEdge(leftCombatant, rightCombatant);
            if (!hasFrontContactOnCombatant(leftCombatant.id, combatSetup.combats) && combatCountByCombatant.get(leftCombatant.id) === 1) {
                const rotation = getFacingRotationTowardOpponent(leftCombatant, rightCombatant);
                if (rotation !== null && sharedEdge) {
                    plans.set(leftCombatant.id, {
                        rotation,
                        anchorUnitId: sharedEdge.leftUnitId,
                        anchorMidpoint: sharedEdge.midpoint
                    });
                }
            }
            if (!hasFrontContactOnCombatant(rightCombatant.id, combatSetup.combats) && combatCountByCombatant.get(rightCombatant.id) === 1) {
                const rotation = getFacingRotationTowardOpponent(rightCombatant, leftCombatant);
                if (rotation !== null && sharedEdge) {
                    plans.set(rightCombatant.id, {
                        rotation,
                        anchorUnitId: sharedEdge.rightUnitId,
                        anchorMidpoint: sharedEdge.midpoint
                    });
                }
            }
        });
        return plans;
    }

    function applyCombatFacing(units, combatSetup, facingPlans) {
        const transformedUnitsById = new Map();

        combatSetup.combatants.forEach((combatant) => {
            const plan = facingPlans.get(combatant.id);
            if (!plan) {
                combatant.units.forEach((unit) => {
                    transformedUnitsById.set(unit.id, cloneUnit(unit));
                });
                return;
            }

            const rotatedUnits = geometry.rotateUnitsAroundCenter(combatant.units, plan.rotation);
            const anchorUnit = rotatedUnits.find((unit) => unit.id === plan.anchorUnitId);
            if (!anchorUnit) {
                combatant.units.forEach((unit) => {
                    transformedUnitsById.set(unit.id, cloneUnit(unit));
                });
                return;
            }

            const anchorFront = getSideByName(anchorUnit, 'front');
            const anchorFrontMid = sideMidpoint(anchorFront);
            const delta = geometry.subtract(plan.anchorMidpoint, anchorFrontMid);
            rotatedUnits.forEach((unit) => {
                transformedUnitsById.set(unit.id, {
                    ...unit,
                    x: unit.x + delta.x,
                    y: unit.y + delta.y
                });
            });
        });

        return units.map((unit) => transformedUnitsById.get(unit.id) || cloneUnit(unit));
    }

    function resolveCombatantRecoil(combatant, units, terrain, options) {
        const targetRotation = options && options.targetRotation;
        if (combatant.unitIds.length === 1) {
            const mutableUnits = units.map(cloneUnit);
            if (targetRotation !== undefined && targetRotation !== null) {
                const unitIndex = mutableUnits.findIndex((unit) => unit.id === combatant.unitIds[0]);
                if (unitIndex >= 0) {
                    mutableUnits[unitIndex] = rotateUnitInPlace(mutableUnits[unitIndex], targetRotation);
                }
            }
            const recoil = resolveRecoil(combatant.unitIds[0], mutableUnits, terrain);
            if (recoil.destroyedIds.length > 0) {
                return {
                    units,
                    destroyedIds: [...combatant.unitIds],
                    destructionReasons: recoil.destructionReasons || {}
                };
            }
            return recoil;
        }

        let mutableUnits = units.map(cloneUnit);
        const movingIds = new Set(combatant.unitIds);
        if (targetRotation !== undefined && targetRotation !== null) {
            mutableUnits = mutableUnits.map((unit) => {
                if (!movingIds.has(unit.id)) {
                    return unit;
                }
                return rotateUnitInPlace(unit, targetRotation);
            });
        }
        const shifted = new Map();
        for (const unitId of combatant.unitIds) {
            const unit = mutableUnits.find((entry) => entry.id === unitId);
            const backwardDelta = geometry.scaleVector(geometry.getForwardVector(unit.rotation), -unit.depth);
            const candidate = cloneUnit(unit);
            candidate.x += backwardDelta.x;
            candidate.y += backwardDelta.y;
            const stagedUnits = mutableUnits.map((entry) => shifted.get(entry.id) || entry);
            const recoilBlockReason = getRecoilBlockReason(candidate, stagedUnits, terrain, movingIds);
            if (recoilBlockReason) {
                return {
                    units,
                    destroyedIds: [...combatant.unitIds],
                    destructionReasons: Object.fromEntries(combatant.unitIds.map((unitId) => [unitId, recoilBlockReason]))
                };
            }
            shifted.set(candidate.id, candidate);
        }

        return {
            units: mutableUnits.map((unit) => shifted.get(unit.id) || unit),
            destroyedIds: [],
            destructionReasons: {}
        };
    }

    function resolveMelee(units, terrain, rollDie) {
        const combatSetup = detectMeleeCombats(units);
        const facingPlans = buildCombatFacingPlans(combatSetup);
        const adjustedCombats = combatSetup.combats.map((combat) => ({
            ...combat,
            edgesOnLeft: facingPlans.has(combat.leftCombatantId) ? ['front'] : combat.edgesOnLeft,
            edgesOnRight: facingPlans.has(combat.rightCombatantId) ? ['front'] : combat.edgesOnRight
        }));
        const mutableStartingUnits = applyCombatFacing(units, combatSetup, facingPlans);
        const combatantsById = new Map(buildMeleeCombatants(mutableStartingUnits).map((combatant) => [combatant.id, combatant]));
        const fightingCombatantIds = new Set(adjustedCombats.flatMap((combat) => [combat.leftCombatantId, combat.rightCombatantId]));
        const results = [];
        const recoilDestructions = [];

        adjustedCombats.forEach((combat) => {
            const leftCombatant = combatantsById.get(combat.leftCombatantId);
            const rightCombatant = combatantsById.get(combat.rightCombatantId);
            const leftModifiers = getCombatModifiers({
                phase: 'melee',
                role: 'attacker',
                unit: leftCombatant.primaryUnit,
                opponent: rightCombatant.primaryUnit,
                combatant: leftCombatant,
                opponentCombatant: rightCombatant,
                incomingEdges: combat.edgesOnLeft,
                combats: adjustedCombats,
                combatants: [...combatantsById.values()],
                fightingCombatantIds,
                terrain
            });
            const rightModifiers = getCombatModifiers({
                phase: 'melee',
                role: 'defender',
                unit: rightCombatant.primaryUnit,
                opponent: leftCombatant.primaryUnit,
                combatant: rightCombatant,
                opponentCombatant: leftCombatant,
                incomingEdges: combat.edgesOnRight,
                combats: adjustedCombats,
                combatants: [...combatantsById.values()],
                fightingCombatantIds,
                terrain
            });
            const leftRoll = rollDie({ role: 'left', combatId: combat.id, leftPrimaryId: leftCombatant.primaryUnit.id, rightPrimaryId: rightCombatant.primaryUnit.id });
            const rightRoll = rollDie({ role: 'right', combatId: combat.id, leftPrimaryId: leftCombatant.primaryUnit.id, rightPrimaryId: rightCombatant.primaryUnit.id });
            const leftTotal = leftRoll + getUnitStrengthAgainst(leftCombatant.primaryUnit, rightCombatant.primaryUnit) + sumModifiers(leftModifiers);
            const rightTotal = rightRoll + getUnitStrengthAgainst(rightCombatant.primaryUnit, leftCombatant.primaryUnit) + sumModifiers(rightModifiers);
            const result = {
                combatId: combat.id,
                leftCombatantId: leftCombatant.id,
                rightCombatantId: rightCombatant.id,
                leftUnitIds: [...leftCombatant.unitIds],
                rightUnitIds: [...rightCombatant.unitIds],
                leftPrimaryId: leftCombatant.primaryUnit.id,
                rightPrimaryId: rightCombatant.primaryUnit.id,
                leftRoll,
                rightRoll,
                leftModifiers,
                rightModifiers,
                leftTotal,
                rightTotal,
                outcome: 'tie',
                loserCombatantId: null,
                recoilRotation: null,
                destructionRule: null
            };
            if (leftTotal === rightTotal) {
                results.push(result);
                return;
            }
            const leftWon = leftTotal > rightTotal;
            const winnerCombatant = leftWon ? leftCombatant : rightCombatant;
            const loserCombatant = leftWon ? rightCombatant : leftCombatant;
            result.loserCombatantId = loserCombatant.id;
            const highTotal = Math.max(leftTotal, rightTotal);
            const lowTotal = Math.min(leftTotal, rightTotal);
            if (highTotal >= lowTotal * 2) {
                result.outcome = 'destroy';
                result.destructionRule = 'Double total destroys the loser.';
                results.push(result);
                return;
            }
            const lossResolution = getMinorLossResolution(winnerCombatant.primaryUnit, loserCombatant.primaryUnit, 'melee', terrain);
            result.outcome = lossResolution.outcome;
            result.destructionRule = lossResolution.destructionRule;
            const incomingEdges = leftWon ? combat.edgesOnRight : combat.edgesOnLeft;
            if (incomingEdges.includes('rear')) {
                result.recoilRotation = winnerCombatant.primaryUnit.rotation;
            }
            results.push(result);
        });

        const destroyedIds = new Set();
        const ensorcelledIds = new Map();
        const recoilQueue = [];
        results.forEach((result) => {
            if (!result.loserCombatantId) {
                return;
            }
            const loserCombatant = combatantsById.get(result.loserCombatantId);
            const winnerCombatant = result.loserCombatantId === result.leftCombatantId
                ? combatantsById.get(result.rightCombatantId)
                : combatantsById.get(result.leftCombatantId);
            if (result.outcome === 'destroy') {
                loserCombatant.unitIds.forEach((unitId) => destroyedIds.add(unitId));
                return;
            }
            if (result.outcome === 'ensorcel') {
                loserCombatant.unitIds.forEach((unitId) => {
                    const unit = mutableStartingUnits.find((entry) => entry.id === unitId);
                    if (unit && isEnsorcellableType(unit)) {
                        ensorcelledIds.set(unitId, winnerCombatant.primaryUnit.id);
                    }
                });
                return;
            }
            if (result.outcome === 'recoil' || result.outcome === 'flee') {
                recoilQueue.push({
                    combatant: loserCombatant,
                    targetRotation: result.recoilRotation,
                    flee: result.outcome === 'flee'
                });
            }
        });

        let mutableUnits = mutableStartingUnits.filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id));
        recoilQueue.forEach((entry) => {
            if (entry.combatant.unitIds.some((unitId) => destroyedIds.has(unitId))) {
                return;
            }
            const recoil = resolveCombatantRecoil(entry.combatant, mutableUnits, terrain, { targetRotation: entry.targetRotation });
            if (recoil.destroyedIds.length > 0) {
                recoil.destroyedIds.forEach((unitId) => {
                    recoilDestructions.push({
                        unitId,
                        reason: recoil.destructionReasons[unitId] || 'recoil destruction reason unavailable'
                    });
                });
                recoil.destroyedIds.forEach((unitId) => destroyedIds.add(unitId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = recoil.units;
            if (!entry.flee) {
                return;
            }
            const flee = resolveFlee(entry.combatant.primaryUnit.id, mutableUnits, terrain);
            if (flee.destroyedIds.length > 0) {
                flee.destroyedIds.forEach((unitId) => {
                    recoilDestructions.push({
                        unitId,
                        reason: flee.destructionReasons[unitId] || 'flee destruction reason unavailable'
                    });
                });
                flee.destroyedIds.forEach((unitId) => destroyedIds.add(unitId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = flee.units;
        });

        const destroyedUnits = mutableStartingUnits.filter((unit) => destroyedIds.has(unit.id)).map(cloneUnit);
        const ensorcelledUnits = [...ensorcelledIds.entries()].map(([unitId, ensorcelledByUnitId]) => {
            const unit = mutableStartingUnits.find((entry) => entry.id === unitId);
            return unit ? buildEnsorcelledUnit(unit, ensorcelledByUnitId) : null;
        }).filter(Boolean);
        return {
            units: mutableUnits.filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id)),
            destroyedUnits,
            ensorcelledUnits,
            results,
            recoilDestructions,
            combats: adjustedCombats,
            combatants: [...combatantsById.values()],
            participantIds: combatSetup.participantIds
        };
    }

    function describeSelection(analysis, units, draft) {
        if (units.length === 0) {
            return 'No units selected.';
        }
        const typeLabel = units.length === 1
            ? units[0].type
            : analysis.type === 'invalid'
                ? analysis.reason
                : analysis.type;
        if (draft && draft.invalidIds.size > 0) {
            const reasons = Array.from(draft.reasonById.values()).filter(Boolean);
            return `${units.length} selected, ${typeLabel}. Illegal: ${reasons[0]}`;
        }
        return `${units.length} selected, ${typeLabel}.`;
    }

    function resolveAutomaticFormUp(units, activePlayerId, terrain) {
        const normalizedActivePlayerId = normalizePlayerId(activePlayerId);
        const mutableUnits = units.map((unit) => ({ ...unit }));
        const activeUnits = mutableUnits.filter((unit) => getPlayerId(unit) === normalizedActivePlayerId);
        const groups = buildFormationGroups(activeUnits);
        const movedUnitIds = [];

        groups.forEach((groupIds) => {
            const groupUnits = groupIds
                .map((unitId) => mutableUnits.find((unit) => unit.id === unitId))
                .filter(Boolean);
            const best = findBestFormUpCandidate(groupUnits, mutableUnits, normalizedActivePlayerId, terrain);
            if (!best) {
                return;
            }
            best.units.forEach((candidateUnit) => {
                const unit = mutableUnits.find((entry) => entry.id === candidateUnit.id);
                Object.assign(unit, candidateUnit);
            });
            best.unitIds.forEach((unitId) => {
                if (!movedUnitIds.includes(unitId)) {
                    movedUnitIds.push(unitId);
                }
            });
        });

        return {
            units: mutableUnits,
            movedUnitIds
        };
    }

    function buildFormationGroups(units) {
        const visited = new Set();
        const groups = [];

        units.forEach((unit) => {
            if (visited.has(unit.id)) {
                return;
            }
            const stack = [unit];
            const groupIds = [];
            visited.add(unit.id);

            while (stack.length > 0) {
                const current = stack.pop();
                groupIds.push(current.id);
                units.forEach((other) => {
                    if (visited.has(other.id) || other.id === current.id) {
                        return;
                    }
                    if (!sharesFormationContact(current, other)) {
                        return;
                    }
                    visited.add(other.id);
                    stack.push(other);
                });
            }

            groups.push(groupIds);
        });

        return groups;
    }

    function sharesFormationContact(left, right) {
        if (getPlayerId(left) !== getPlayerId(right)) {
            return false;
        }
        if (Math.abs(geometry.normalizeAngle(left.rotation - right.rotation)) > 0.12) {
            return false;
        }
        const forward = geometry.getForwardVector(left.rotation);
        const rightVector = geometry.getRightVector(left.rotation);
        const leftCenter = geometry.getUnitCenter(left);
        const rightCenter = geometry.getUnitCenter(right);
        const delta = geometry.subtract(rightCenter, leftCenter);
        const u = geometry.dot(delta, rightVector);
        const v = geometry.dot(delta, forward);
        const lateralGap = Math.abs(Math.abs(u) - ((left.width + right.width) / 2));
        const fileGap = Math.abs(Math.abs(v) - ((left.depth + right.depth) / 2));
        const widthOverlap = Math.min(left.width / 2, u + (right.width / 2)) - Math.max(-(left.width / 2), u - (right.width / 2));
        const depthOverlap = Math.min(left.depth / 2, v + (right.depth / 2)) - Math.max(-(left.depth / 2), v - (right.depth / 2));
        const rankAligned = lateralGap <= data.FORMATION_GAP_TOLERANCE && depthOverlap > data.COLLISION_EPSILON;
        const fileAligned = fileGap <= data.FORMATION_GAP_TOLERANCE && widthOverlap > data.COLLISION_EPSILON;
        return rankAligned || fileAligned;
    }

    function isBehindEnemyFrontLine(unit, enemyUnit) {
        const enemyForward = geometry.getForwardVector(enemyUnit.rotation);
        const enemyCorners = geometry.getUnitCorners(enemyUnit);
        const enemyFrontProjection = Math.max(
            geometry.dot(enemyCorners.frontLeft, enemyForward),
            geometry.dot(enemyCorners.frontRight, enemyForward)
        );
        const friendlyCorners = geometry.getUnitCorners(unit);
        return [friendlyCorners.frontLeft, friendlyCorners.frontRight]
            .every((corner) => geometry.dot(corner, enemyForward) <= enemyFrontProjection + data.FORM_UP_SIDE_APPROACH_TOLERANCE);
    }

    function getFormUpOrientationOptions(unit, enemyUnit) {
        const enemyLeft = getSideByName(enemyUnit, 'left');
        const enemyRight = getSideByName(enemyUnit, 'right');
        const enemyCorners = geometry.getUnitCorners(enemyUnit);
        const options = [{
            kind: 'front',
            targetRotation: geometry.normalizeAngle(enemyUnit.rotation + Math.PI),
            targetPoints: [enemyCorners.frontLeft, enemyCorners.frontRight, enemyCorners.backLeft, enemyCorners.backRight]
        }];

        if (isBehindEnemyFrontLine(unit, enemyUnit)) {
            options.push({
                kind: 'left',
                targetRotation: geometry.normalizeAngle(enemyUnit.rotation + (Math.PI / 2)),
                targetPoints: [enemyLeft.start, enemyLeft.end]
            });
            options.push({
                kind: 'right',
                targetRotation: geometry.normalizeAngle(enemyUnit.rotation - (Math.PI / 2)),
                targetPoints: [enemyRight.start, enemyRight.end]
            });
        }

        return options;
    }

    function getPreferredFormUpApproach(unit, enemyUnit) {
        const unitCenter = geometry.getUnitCenter(unit);
        const enemyCenter = geometry.getUnitCenter(enemyUnit);
        const offset = geometry.subtract(unitCenter, enemyCenter);
        const forwardOffset = geometry.dot(offset, geometry.getForwardVector(enemyUnit.rotation));
        const rightOffset = geometry.dot(offset, geometry.getRightVector(enemyUnit.rotation));

        if (Math.abs(rightOffset) > Math.abs(forwardOffset) + 1e-9) {
            return rightOffset >= 0 ? 'right' : 'left';
        }

        return 'front';
    }

    function getLineAngleDelta(leftRotation, rightRotation) {
        const delta = Math.abs(geometry.normalizeAngle(leftRotation - rightRotation));
        return Math.min(delta, Math.abs(Math.PI - delta));
    }

    function translateUnits(units, delta) {
        return units.map((unit) => ({
            ...unit,
            x: unit.x + delta.x,
            y: unit.y + delta.y
        }));
    }

    function isUnitLegalAtPosition(unit, blockers, terrain) {
        if (severityFromTerrain(sampleUnitTerrain(unit, terrain)) === TERRAIN_SEVERITY.impassable) {
            return false;
        }
        return blockers.every((otherUnit) => !geometry.polygonsOverlap(geometry.getUnitCorners(unit), geometry.getUnitCorners(otherUnit)));
    }

    function findBestSingleUnitFormUpCandidate(unit, enemyUnit, option, blockers, terrain, maxTriggerDistance) {
        const currentFriendlyCorners = geometry.getUnitCorners(unit);
        const currentOriginCorners = [currentFriendlyCorners.frontLeft, currentFriendlyCorners.frontRight];
        const orientedUnit = geometry.rotateUnitsAroundCenter([unit], option.targetRotation)[0];
        const orientedFriendlyCorners = geometry.getUnitCorners(orientedUnit);
        const orientedOriginCorners = [orientedFriendlyCorners.frontLeft, orientedFriendlyCorners.frontRight];
        let best = null;
        const triggerLimit = Number.isFinite(maxTriggerDistance) ? maxTriggerDistance : data.FORM_UP_DISTANCE + 0.5;

        orientedOriginCorners.forEach((orientedOriginPoint, index) => {
            const triggerOriginPoint = currentOriginCorners[index];
            option.targetPoints.forEach((targetPoint) => {
                const triggerDistance = geometry.distance(triggerOriginPoint, targetPoint);
                if (triggerDistance > triggerLimit) {
                    return;
                }
                const delta = geometry.subtract(targetPoint, orientedOriginPoint);
                const shiftedUnit = {
                    ...orientedUnit,
                    x: orientedUnit.x + delta.x,
                    y: orientedUnit.y + delta.y
                };
                if (!isUnitLegalAtPosition(shiftedUnit, blockers, terrain)) {
                    return;
                }
                const translationDistance = geometry.distance(orientedOriginPoint, targetPoint);
                if (!best
                    || triggerDistance < best.triggerDistance - data.COLLISION_EPSILON
                    || (Math.abs(triggerDistance - best.triggerDistance) <= data.COLLISION_EPSILON
                        && translationDistance < best.translationDistance - data.COLLISION_EPSILON)) {
                    best = {
                        unit: shiftedUnit,
                        triggerDistance,
                        translationDistance
                    };
                }
            });
        });

        return best;
    }

    function findBestProjectedSingleUnitFormUpCandidate(unit, enemyUnits, blockers, terrain) {
        let best = null;

        enemyUnits.forEach((enemyUnit) => {
            if (getLineAngleDelta(unit.rotation, enemyUnit.rotation) <= data.FORM_UP_SPLIT_ANGLE) {
                return;
            }
            if (!geometry.polygonsOverlap(geometry.getUnitCorners(unit), geometry.getUnitCorners(enemyUnit))) {
                return;
            }
            const preferredApproach = getPreferredFormUpApproach(unit, enemyUnit);
            getFormUpOrientationOptions(unit, enemyUnit).forEach((option) => {
                const candidate = findBestSingleUnitFormUpCandidate(unit, enemyUnit, option, blockers, terrain, Number.POSITIVE_INFINITY);
                if (!candidate) {
                    return;
                }
                const approachPenalty = option.kind === preferredApproach ? 0 : 1;
                if (!best
                    || approachPenalty < best.approachPenalty
                    || (approachPenalty === best.approachPenalty && (
                        candidate.translationDistance < best.translationDistance - data.COLLISION_EPSILON
                        || (Math.abs(candidate.translationDistance - best.translationDistance) <= data.COLLISION_EPSILON
                            && candidate.triggerDistance < best.triggerDistance - data.COLLISION_EPSILON)
                    ))) {
                    best = {
                        approachPenalty,
                        triggerDistance: candidate.triggerDistance,
                        translationDistance: candidate.translationDistance,
                        unit: candidate.unit
                    };
                }
            });
        });

        return best;
    }

    function getEligibleProjectedCollisionEnemies(unit, enemyUnits) {
        return enemyUnits.filter((enemyUnit) => (
            getLineAngleDelta(unit.rotation, enemyUnit.rotation) > data.FORM_UP_SPLIT_ANGLE
            && geometry.polygonsOverlap(geometry.getUnitCorners(unit), geometry.getUnitCorners(enemyUnit))
        ));
    }

    function findProjectedCollisionPose(originUnit, projectedUnit, enemyUnits) {
        let previousT = 0;
        let collisionT = null;
        let collidingEnemies = [];

        for (let step = 1; step <= data.PATH_SAMPLES; step += 1) {
            const t = step / data.PATH_SAMPLES;
            const sample = geometry.interpolateUnitPose(originUnit, projectedUnit, t);
            const sampleCollisions = getEligibleProjectedCollisionEnemies(sample, enemyUnits);
            if (sampleCollisions.length > 0) {
                collisionT = t;
                collidingEnemies = sampleCollisions;
                break;
            }
            previousT = t;
        }

        if (collisionT === null) {
            return null;
        }

        let low = previousT;
        let high = collisionT;
        for (let iteration = 0; iteration < 12; iteration += 1) {
            const mid = (low + high) / 2;
            const sample = geometry.interpolateUnitPose(originUnit, projectedUnit, mid);
            const sampleCollisions = getEligibleProjectedCollisionEnemies(sample, enemyUnits);
            if (sampleCollisions.length > 0) {
                high = mid;
                collidingEnemies = sampleCollisions;
            } else {
                low = mid;
            }
        }

        const collisionUnit = geometry.interpolateUnitPose(originUnit, projectedUnit, high);
        return {
            t: high,
            unit: collisionUnit,
            enemyUnits: getEligibleProjectedCollisionEnemies(collisionUnit, enemyUnits)
        };
    }

    function resolveAngledRankMoveContact(originUnits, projectedUnits, allUnits, activePlayerId, terrain) {
        if (!originUnits || !projectedUnits || projectedUnits.length === 0) {
            return null;
        }
        const normalizedActivePlayerId = normalizePlayerId(activePlayerId);
        const projectedIds = new Set(projectedUnits.map((unit) => unit.id));
        const otherUnits = allUnits.filter((unit) => !projectedIds.has(unit.id));
        const enemyUnits = otherUnits.filter((unit) => getPlayerId(unit) !== normalizedActivePlayerId);
        const originById = new Map(originUnits.map((unit) => [unit.id, unit]));
        const orderedIds = getRankOrderIds(originUnits, originUnits[0].rotation);
        const collisionInfos = projectedUnits
            .map((projectedUnit) => {
                const originUnit = originById.get(projectedUnit.id);
                if (!originUnit) {
                    return null;
                }
                const collision = findProjectedCollisionPose(originUnit, projectedUnit, enemyUnits);
                if (!collision) {
                    return null;
                }
                return {
                    projectedUnit,
                    collisionT: collision.t,
                    collisionUnit: collision.unit,
                    enemyUnits: collision.enemyUnits
                };
            })
            .filter(Boolean)
            .sort((left, right) => left.collisionT - right.collisionT);

        if (collisionInfos.length === 0) {
            return null;
        }

        const collidingIds = new Set(collisionInfos.map((entry) => entry.projectedUnit.id));
        const resolvedById = new Map(
            projectedUnits
                .filter((projectedUnit) => !collidingIds.has(projectedUnit.id))
                .map((projectedUnit) => [projectedUnit.id, projectedUnit])
        );
        const formedUnitIds = [];

        collisionInfos.forEach((entry) => {
            const blockers = otherUnits.concat(Array.from(resolvedById.values()));
            const candidate = findBestProjectedSingleUnitFormUpCandidate(entry.collisionUnit, entry.enemyUnits, blockers, terrain);
            if (candidate) {
                resolvedById.set(entry.projectedUnit.id, candidate.unit);
                formedUnitIds.push(entry.projectedUnit.id);
                return;
            }
            resolvedById.set(entry.projectedUnit.id, entry.projectedUnit);
        });

        projectedUnits.forEach((projectedUnit) => {
            if (!resolvedById.has(projectedUnit.id)) {
                resolvedById.set(projectedUnit.id, projectedUnit);
            }
        });

        const formedIdSet = new Set(formedUnitIds);
        orderedIds.forEach((unitId, index) => {
            if (!formedIdSet.has(unitId)) {
                return;
            }
            applyRankPushChain(orderedIds, index - 1, -1, formedIdSet, resolvedById, otherUnits, terrain);
            applyRankPushChain(orderedIds, index + 1, 1, formedIdSet, resolvedById, otherUnits, terrain);
        });

        return {
            unitIds: formedUnitIds,
            units: projectedUnits.map((projectedUnit) => resolvedById.get(projectedUnit.id) || projectedUnit)
        };
    }

    function findMinimalOrthogonalShift(unit, blockers, terrain) {
        if (isUnitLegalAtPosition(unit, blockers, terrain)) {
            return unit;
        }
        const right = geometry.getRightVector(unit.rotation);
        let best = null;

        [-1, 1].forEach((direction) => {
            let low = 0;
            let high = 0.5;
            let candidate = {
                ...unit,
                x: unit.x + (right.x * high * direction),
                y: unit.y + (right.y * high * direction)
            };

            while (high <= 200 && !isUnitLegalAtPosition(candidate, blockers, terrain)) {
                low = high;
                high *= 2;
                candidate = {
                    ...unit,
                    x: unit.x + (right.x * high * direction),
                    y: unit.y + (right.y * high * direction)
                };
            }

            if (high > 200 || !isUnitLegalAtPosition(candidate, blockers, terrain)) {
                return;
            }

            for (let iteration = 0; iteration < 12; iteration += 1) {
                const mid = (low + high) / 2;
                const probe = {
                    ...unit,
                    x: unit.x + (right.x * mid * direction),
                    y: unit.y + (right.y * mid * direction)
                };
                if (isUnitLegalAtPosition(probe, blockers, terrain)) {
                    high = mid;
                    candidate = probe;
                } else {
                    low = mid;
                }
            }

            const distance = Math.abs(high);
            if (!best || distance < best.distance) {
                best = { unit: candidate, distance };
            }
        });

        return best ? best.unit : null;
    }

    function findDirectedOrthogonalShift(unit, blockers, terrain, directionSign) {
        if (isUnitLegalAtPosition(unit, blockers, terrain)) {
            return unit;
        }
        if (!directionSign) {
            return null;
        }
        const right = geometry.getRightVector(unit.rotation);
        let low = 0;
        let high = 0.5;
        let candidate = {
            ...unit,
            x: unit.x + (right.x * high * directionSign),
            y: unit.y + (right.y * high * directionSign)
        };

        while (high <= 200 && !isUnitLegalAtPosition(candidate, blockers, terrain)) {
            low = high;
            high *= 2;
            candidate = {
                ...unit,
                x: unit.x + (right.x * high * directionSign),
                y: unit.y + (right.y * high * directionSign)
            };
        }

        if (high > 200 || !isUnitLegalAtPosition(candidate, blockers, terrain)) {
            return null;
        }

        for (let iteration = 0; iteration < 12; iteration += 1) {
            const mid = (low + high) / 2;
            const probe = {
                ...unit,
                x: unit.x + (right.x * mid * directionSign),
                y: unit.y + (right.y * mid * directionSign)
            };
            if (isUnitLegalAtPosition(probe, blockers, terrain)) {
                high = mid;
                candidate = probe;
            } else {
                low = mid;
            }
        }

        return candidate;
    }

    function getRankOrderIds(units, rotation) {
        const right = geometry.getRightVector(rotation);
        return [...units]
            .map((unit) => ({
                id: unit.id,
                projection: geometry.dot(geometry.getUnitCenter(unit), right)
            }))
            .sort((left, rightEntry) => left.projection - rightEntry.projection)
            .map((entry) => entry.id);
    }

    function applyRankPushChain(orderedIds, startIndex, direction, formedIdSet, resolvedById, otherUnits, terrain) {
        const pushedIds = new Set();

        for (let index = startIndex; index >= 0 && index < orderedIds.length; index += direction) {
            const unitId = orderedIds[index];
            if (formedIdSet.has(unitId)) {
                break;
            }
            const unit = resolvedById.get(unitId);
            const blockers = otherUnits.concat(
                Array.from(resolvedById.entries())
                    .filter(([otherId]) => otherId !== unitId && (formedIdSet.has(otherId) || pushedIds.has(otherId)))
                    .map(([, otherUnit]) => otherUnit)
            );
            const shiftedUnit = findDirectedOrthogonalShift(unit, blockers, terrain, direction);
            if (shiftedUnit) {
                resolvedById.set(unitId, shiftedUnit);
            }
            pushedIds.add(unitId);
        }
    }

    function buildSplitFormUpCandidate(groupUnits, enemyUnit, option, otherUnits, terrain) {
        const movedUnitsById = new Map();
        const movedStats = [];

        groupUnits.forEach((groupUnit) => {
            const blockers = otherUnits.concat(Array.from(movedUnitsById.values()));
            const candidate = findBestSingleUnitFormUpCandidate(groupUnit, enemyUnit, option, blockers, terrain);
            if (!candidate) {
                return;
            }
            movedUnitsById.set(groupUnit.id, candidate.unit);
            movedStats.push(candidate);
        });

        if (movedUnitsById.size === 0) {
            return null;
        }

        const resolvedUnitsById = new Map();
        const movedUnitIds = [];

        groupUnits.forEach((groupUnit) => {
            if (movedUnitsById.has(groupUnit.id)) {
                resolvedUnitsById.set(groupUnit.id, movedUnitsById.get(groupUnit.id));
                movedUnitIds.push(groupUnit.id);
                return;
            }
            const blockers = otherUnits.concat(Array.from(resolvedUnitsById.values()));
            const shiftedUnit = findMinimalOrthogonalShift(groupUnit, blockers, terrain);
            if (!shiftedUnit) {
                resolvedUnitsById.clear();
                return;
            }
            resolvedUnitsById.set(groupUnit.id, shiftedUnit);
            if (!geometry.sameFootprint(groupUnit, shiftedUnit)) {
                movedUnitIds.push(groupUnit.id);
            }
        });

        if (resolvedUnitsById.size !== groupUnits.length) {
            return null;
        }

        const resolvedUnits = groupUnits.map((groupUnit) => resolvedUnitsById.get(groupUnit.id));
        if (!isLegalFormUpPosition(resolvedUnits, otherUnits, terrain)) {
            return null;
        }

        return {
            movedCount: movedStats.length,
            triggerDistance: movedStats.reduce((total, entry) => total + entry.triggerDistance, 0),
            translationDistance: movedStats.reduce((total, entry) => total + entry.translationDistance, 0),
            unitIds: movedUnitIds,
            units: resolvedUnits
        };
    }

    function findBestFormUpCandidate(groupUnits, allUnits, activePlayerId, terrain) {
        if (groupUnits.length === 0) {
            return null;
        }
        const enemyUnits = allUnits.filter((unit) => getPlayerId(unit) !== activePlayerId);
        const otherUnits = allUnits.filter((unit) => !groupUnits.some((groupUnit) => groupUnit.id === unit.id));
        let best = null;

        enemyUnits.forEach((enemyUnit) => {
            const splitFormUpForEnemy = getLineAngleDelta(groupUnits[0].rotation, enemyUnit.rotation) > data.FORM_UP_SPLIT_ANGLE;
            groupUnits.forEach((groupUnit) => {
                const currentFriendlyCorners = geometry.getUnitCorners(groupUnit);
                const currentOriginCorners = [currentFriendlyCorners.frontLeft, currentFriendlyCorners.frontRight];
                const preferredApproach = getPreferredFormUpApproach(groupUnit, enemyUnit);
                getFormUpOrientationOptions(groupUnit, enemyUnit).forEach((option) => {
                    if (splitFormUpForEnemy) {
                        const splitCandidate = buildSplitFormUpCandidate(groupUnits, enemyUnit, option, otherUnits, terrain);
                        if (!splitCandidate) {
                            return;
                        }
                        const approachPenalty = option.kind === preferredApproach ? 0 : 1;
                        if (!best
                            || splitCandidate.movedCount > (best.movedCount || 0)
                            || (splitCandidate.movedCount === (best.movedCount || 0) && (
                                approachPenalty < best.approachPenalty
                                || (approachPenalty === best.approachPenalty && (
                                    splitCandidate.triggerDistance < best.triggerDistance - data.COLLISION_EPSILON
                                    || (Math.abs(splitCandidate.triggerDistance - best.triggerDistance) <= data.COLLISION_EPSILON
                                        && splitCandidate.translationDistance < best.translationDistance - data.COLLISION_EPSILON)
                                ))
                            ))) {
                            best = {
                                movedCount: splitCandidate.movedCount,
                                approachPenalty,
                                triggerDistance: splitCandidate.triggerDistance,
                                translationDistance: splitCandidate.translationDistance,
                                unitIds: splitCandidate.unitIds,
                                units: splitCandidate.units
                            };
                        }
                        return;
                    }
                    const orientedGroup = geometry.rotateUnitsAroundCenter(groupUnits, option.targetRotation);
                    const orientedUnit = orientedGroup.find((unit) => unit.id === groupUnit.id);
                    const orientedFriendlyCorners = geometry.getUnitCorners(orientedUnit);
                    const orientedOriginCorners = [orientedFriendlyCorners.frontLeft, orientedFriendlyCorners.frontRight];

                    orientedOriginCorners.forEach((orientedOriginPoint, index) => {
                        const triggerOriginPoint = currentOriginCorners[index];
                        option.targetPoints.forEach((targetPoint) => {
                            const triggerDistance = geometry.distance(triggerOriginPoint, targetPoint);
                            if (triggerDistance > data.FORM_UP_DISTANCE + 0.5) {
                                return;
                            }
                            const delta = geometry.subtract(targetPoint, orientedOriginPoint);
                            const shiftedGroup = translateUnits(orientedGroup, delta);
                            if (!isLegalFormUpPosition(shiftedGroup, otherUnits, terrain)) {
                                return;
                            }
                            const approachPenalty = option.kind === preferredApproach ? 0 : 1;
                            const translationDistance = geometry.distance(orientedOriginPoint, targetPoint);
                            if (!best
                                || approachPenalty < best.approachPenalty
                                || (approachPenalty === best.approachPenalty && (
                                    triggerDistance < best.triggerDistance - data.COLLISION_EPSILON
                                    || (Math.abs(triggerDistance - best.triggerDistance) <= data.COLLISION_EPSILON && translationDistance < best.translationDistance - data.COLLISION_EPSILON)
                                ))) {
                                best = {
                                    approachPenalty,
                                    triggerDistance,
                                    translationDistance,
                                    unitIds: groupUnits.map((unit) => unit.id),
                                    units: shiftedGroup
                                };
                            }
                        });
                    });
                });
            });
        });

        return best;
    }

    function isLegalFormUpPosition(groupUnits, otherUnits, terrain) {
        for (let index = 0; index < groupUnits.length; index += 1) {
            for (let inner = index + 1; inner < groupUnits.length; inner += 1) {
                if (geometry.polygonsOverlap(geometry.getUnitCorners(groupUnits[index]), geometry.getUnitCorners(groupUnits[inner]))) {
                    return false;
                }
            }
            if (severityFromTerrain(sampleUnitTerrain(groupUnits[index], terrain)) === TERRAIN_SEVERITY.impassable) {
                return false;
            }
            for (const otherUnit of otherUnits) {
                if (geometry.polygonsOverlap(geometry.getUnitCorners(groupUnits[index]), geometry.getUnitCorners(otherUnit))) {
                    return false;
                }
            }
        }
        return true;
    }

    return {
        ROUGH_TERRAIN_TYPES,
        TERRAIN_SEVERITY,
        analyzeSelection,
        validateDraftState,
        getTerrainTypeAt,
        sampleUnitTerrain,
        severityFromTerrain,
        combineMoveSeverity,
        movementAllowanceForSeverity,
        resolveAngledRankMoveContact,
        isRangedUnit,
        isMagicianUnit,
        isEnsorcellableType,
        getMoveCost,
        getAttackDeclareCost,
        getDraftMoveCost,
        canUnitShoot,
        getRangedArea,
        getNearestTargetSide,
        isTargetInRangedArea,
        isValidShootingAttack,
        getValidShootingTargets,
        detectMeleeCombats,
        getCombatModifiers,
        getExtraShooterPenalty,
        getMinorLossResolution,
        resolveRecoil,
        resolveFlee,
        resolveShooting,
        resolveMelee,
        describeSelection,
        resolveAutomaticFormUp
    };
}));