(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('./core.js'),
            require('./terrain.js')
        );
        return;
    }
    root.HordesRulesFormUp = factory(root.HordesData, root.HordesGeometry, root.HordesRulesCore, root.HordesRulesTerrain);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, core, terrain) {
    const {
        normalizePlayerId,
        getPlayerId,
        getSideByName,
        sharesFormationContact
    } = core;

    const {
        TERRAIN_SEVERITY,
        sampleUnitTerrain,
        severityFromTerrain
    } = terrain;
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


    function areOpposingLines(leftRotation, rightRotation) {
        const delta = Math.abs(geometry.normalizeAngle(leftRotation - rightRotation));
        return Math.abs(delta - Math.PI) <= data.FORM_UP_SPLIT_ANGLE;
    }


    function shouldUseSplitFormUp(groupRotation, enemyRotation) {
        return getLineAngleDelta(groupRotation, enemyRotation) > data.FORM_UP_SPLIT_ANGLE
            || areOpposingLines(groupRotation, enemyRotation);
    }


    function getRankNeighbors(unit, groupUnits) {
        return groupUnits.filter((other) => other.id !== unit.id && sharesFormationContact(unit, other));
    }


    function getFriendlyDressDistance(unit, neighbors) {
        const unitCorners = geometry.getUnitCorners(unit);
        let best = Number.POSITIVE_INFINITY;
        neighbors.forEach((neighbor) => {
            const neighborCorners = geometry.getUnitCorners(neighbor);
            [
                [unitCorners.frontRight, neighborCorners.frontLeft],
                [unitCorners.frontLeft, neighborCorners.frontRight]
            ].forEach(([left, right]) => {
                best = Math.min(best, geometry.distance(left, right));
            });
        });
        return best;
    }


    function isDressedWithRankNeighbor(unit, groupUnits) {
        const neighbors = getRankNeighbors(unit, groupUnits);
        if (neighbors.length === 0) {
            return false;
        }
        return getFriendlyDressDistance(unit, neighbors) <= data.FORMATION_GAP_TOLERANCE;
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


    function findBestSingleUnitFormUpCandidate(unit, enemyUnit, option, blockers, terrain, maxTriggerDistance, maxTranslationDistance) {
        const currentFriendlyCorners = geometry.getUnitCorners(unit);
        const currentOriginCorners = [currentFriendlyCorners.frontLeft, currentFriendlyCorners.frontRight];
        const orientedUnit = geometry.rotateUnitsAroundCenter([unit], option.targetRotation)[0];
        const orientedFriendlyCorners = geometry.getUnitCorners(orientedUnit);
        const orientedOriginCorners = [orientedFriendlyCorners.frontLeft, orientedFriendlyCorners.frontRight];
        let best = null;
        const triggerLimit = Number.isFinite(maxTriggerDistance) ? maxTriggerDistance : data.FORM_UP_DISTANCE + 0.5;
        const translationLimit = Number.isFinite(maxTranslationDistance) ? maxTranslationDistance : Number.POSITIVE_INFINITY;

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
                if (translationDistance > translationLimit) {
                    return;
                }
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


    function findBestPerUnitOpposingFormUpCandidate(groupUnits, enemyUnits, otherUnits, terrain) {
        const opposingEnemies = enemyUnits.filter((enemyUnit) => (
            areOpposingLines(groupUnits[0].rotation, enemyUnit.rotation)
        ));
        if (opposingEnemies.length === 0) {
            return null;
        }

        const movedUnitsById = new Map();
        const movedStats = [];

        groupUnits.forEach((groupUnit) => {
            let unitBest = null;
            const dressedWithNeighbor = isDressedWithRankNeighbor(groupUnit, groupUnits);
            opposingEnemies.forEach((enemyUnit) => {
                const preferredApproach = getPreferredFormUpApproach(groupUnit, enemyUnit);
                getFormUpOrientationOptions(groupUnit, enemyUnit).forEach((option) => {
                    const blockers = otherUnits.concat(Array.from(movedUnitsById.values()));
                    const candidate = findBestSingleUnitFormUpCandidate(
                        groupUnit,
                        enemyUnit,
                        option,
                        blockers,
                        terrain
                    );
                    if (!candidate) {
                        return;
                    }
                    if (dressedWithNeighbor
                        && candidate.triggerDistance <= data.COLLISION_EPSILON
                        && candidate.translationDistance > data.FORM_UP_DISTANCE + 0.5) {
                        return;
                    }
                    if (!candidate) {
                        return;
                    }
                    const approachPenalty = option.kind === preferredApproach ? 0 : 1;
                    if (!unitBest
                        || approachPenalty < unitBest.approachPenalty
                        || (approachPenalty === unitBest.approachPenalty && (
                            candidate.triggerDistance < unitBest.triggerDistance - data.COLLISION_EPSILON
                            || (Math.abs(candidate.triggerDistance - unitBest.triggerDistance) <= data.COLLISION_EPSILON
                                && candidate.translationDistance < unitBest.translationDistance - data.COLLISION_EPSILON)
                        ))) {
                        unitBest = {
                            approachPenalty,
                            triggerDistance: candidate.triggerDistance,
                            translationDistance: candidate.translationDistance,
                            unit: candidate.unit
                        };
                    }
                });
            });
            if (unitBest) {
                movedUnitsById.set(groupUnit.id, unitBest.unit);
                movedStats.push(unitBest);
            }
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
            const splitFormUpForEnemy = shouldUseSplitFormUp(groupUnits[0].rotation, enemyUnit.rotation)
                && !areOpposingLines(groupUnits[0].rotation, enemyUnit.rotation);
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

        const perUnitOpposing = findBestPerUnitOpposingFormUpCandidate(groupUnits, enemyUnits, otherUnits, terrain);
        if (perUnitOpposing && (!best || perUnitOpposing.movedCount > (best.movedCount || 0))) {
            best = {
                movedCount: perUnitOpposing.movedCount,
                approachPenalty: best?.approachPenalty ?? 0,
                triggerDistance: perUnitOpposing.triggerDistance,
                translationDistance: perUnitOpposing.translationDistance,
                unitIds: perUnitOpposing.unitIds,
                units: perUnitOpposing.units
            };
        }

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
        resolveAutomaticFormUp,
        resolveAngledRankMoveContact
    };
}));
