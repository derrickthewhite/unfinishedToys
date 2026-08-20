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
    root.HordesRulesRankDress = factory(
        root.HordesData,
        root.HordesGeometry,
        root.HordesRulesCore,
        root.HordesRulesTerrain
    );
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, core, terrain) {
    const { getPlayerId } = core;
    const { TERRAIN_SEVERITY, sampleUnitTerrain, severityFromTerrain } = terrain;

    function getMaxCornerTravel(originUnit, targetUnit) {
        const originCorners = geometry.getUnitCorners(originUnit);
        const targetCorners = geometry.getUnitCorners(targetUnit);
        return Math.max(
            geometry.distance(originCorners.frontLeft, targetCorners.frontLeft),
            geometry.distance(originCorners.frontRight, targetCorners.frontRight),
            geometry.distance(originCorners.backLeft, targetCorners.backLeft),
            geometry.distance(originCorners.backRight, targetCorners.backRight)
        );
    }


    function clampPose(originUnit, targetUnit, maxTravel) {
        if (getMaxCornerTravel(originUnit, targetUnit) <= maxTravel + data.COLLISION_EPSILON) {
            return targetUnit;
        }
        let low = 0;
        let high = 1;
        for (let iteration = 0; iteration < 12; iteration += 1) {
            const mid = (low + high) / 2;
            const sample = geometry.interpolateUnitPose(originUnit, targetUnit, mid);
            if (getMaxCornerTravel(originUnit, sample) <= maxTravel + data.COLLISION_EPSILON) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return geometry.interpolateUnitPose(originUnit, targetUnit, low);
    }


    function averageAngle(angles) {
        if (angles.length === 0) {
            return 0;
        }
        const sum = angles.reduce((totals, angle) => ({
            x: totals.x + Math.cos(angle),
            y: totals.y + Math.sin(angle)
        }), { x: 0, y: 0 });
        return geometry.normalizeAngle(Math.atan2(sum.y, sum.x));
    }


    function bucketRotations(units) {
        const buckets = [];
        units.forEach((unit) => {
            const existing = buckets.find((bucket) => (
                Math.abs(geometry.normalizeAngle(unit.rotation - bucket.angle)) <= data.RANK_DRESS_ANGLE_TOLERANCE
            ));
            if (existing) {
                existing.units.push(unit);
                existing.angle = averageAngle(existing.units.map((entry) => entry.rotation));
                return;
            }
            buckets.push({
                angle: unit.rotation,
                units: [unit]
            });
        });
        return buckets.sort((left, right) => right.units.length - left.units.length);
    }


    function computeTargetRotation(units) {
        const buckets = bucketRotations(units);
        const largest = buckets[0];
        if (largest && largest.units.length / units.length >= data.RANK_DRESS_MAJORITY_FRACTION) {
            return largest.angle;
        }
        return averageAngle(units.map((unit) => unit.rotation));
    }


    function sharesRankDressContact(left, right) {
        if (getPlayerId(left) !== getPlayerId(right)) {
            return false;
        }
        return getDressGap(left, right) <= data.FORMATION_GAP_TOLERANCE;
    }


    function getFormationComponent(units, seedUnitIds) {
        const byId = new Map(units.map((unit) => [unit.id, unit]));
        const visited = new Set();
        const component = [];
        const stack = seedUnitIds.map((unitId) => byId.get(unitId)).filter(Boolean);

        while (stack.length > 0) {
            const current = stack.pop();
            if (!current || visited.has(current.id)) {
                continue;
            }
            visited.add(current.id);
            component.push(current);
            units.forEach((other) => {
                if (visited.has(other.id) || !sharesRankDressContact(current, other)) {
                    return;
                }
                stack.push(other);
            });
        }

        return component;
    }


    function isRankDressChainContiguous(ordered) {
        for (let index = 1; index < ordered.length; index += 1) {
            if (getDressGap(ordered[index], ordered[index - 1]) > data.FORMATION_GAP_TOLERANCE) {
                return false;
            }
        }
        return true;
    }


    function analyzeRankDressGeometry(units, guideRotation) {
        if (units.length < 2) {
            return { type: 'none', invalid: true, reason: 'Need at least two units.' };
        }
        const playerId = getPlayerId(units[0]);
        if (units.some((unit) => getPlayerId(unit) !== playerId)) {
            return { type: 'invalid', invalid: true, reason: 'Selection mixes players.' };
        }
        const forward = geometry.getForwardVector(guideRotation);
        const right = geometry.getRightVector(guideRotation);
        const anchorFrontLeft = geometry.getUnitCorners(units[0]).frontLeft;
        const localized = units.map((unit) => {
            const frontLeft = geometry.getUnitCorners(unit).frontLeft;
            const delta = geometry.subtract(frontLeft, anchorFrontLeft);
            return {
                unit,
                u: geometry.dot(delta, right),
                v: geometry.dot(delta, forward)
            };
        });
        const meanV = geometry.average(localized.map((entry) => entry.v));
        const rankAligned = localized.every((entry) => Math.abs(entry.v - meanV) <= data.RANK_TOLERANCE);
        const sorted = [...localized].sort((left, rightEntry) => left.u - rightEntry.u);
        const ordered = sorted.map((entry) => entry.unit);
        if (!rankAligned || !isRankDressChainContiguous(ordered)) {
            return { type: 'invalid', invalid: true, reason: 'Selection is not a legal rank formation.' };
        }
        return {
            type: 'rank',
            invalid: false,
            reason: '',
            forward,
            right,
            orderedIds: sorted.map((entry) => entry.unit.id)
        };
    }


    function tryRankDressSelection(units, seedUnitIds, guideRotation) {
        if (units.length < 2) {
            return null;
        }
        const analysis = analyzeRankDressGeometry(units, guideRotation);
        if (analysis.type !== 'rank' || !seedUnitIds.every((unitId) => analysis.orderedIds.includes(unitId))) {
            return null;
        }
        return analysis.orderedIds;
    }


    function findLargestRankUnitIds(allUnits, seedUnitIds, activePlayerId) {
        const playerUnits = allUnits.filter((unit) => getPlayerId(unit) === activePlayerId);
        const seedSet = new Set(seedUnitIds);
        const component = getFormationComponent(playerUnits, seedUnitIds);
        if (component.length === 0) {
            return [];
        }

        const trySelection = (units, guideRotation) => tryRankDressSelection(units, seedUnitIds, guideRotation);

        const guideRotation = computeTargetRotation(component.filter((unit) => seedSet.has(unit.id)));
        const fullRank = trySelection(component, guideRotation);
        if (fullRank) {
            return fullRank;
        }

        const seedUnits = component.filter((unit) => seedSet.has(unit.id));
        const seedRank = trySelection(seedUnits, guideRotation);
        if (seedRank) {
            return seedRank;
        }

        const right = geometry.getRightVector(guideRotation);
        const aligned = component
            .filter((unit) => Math.abs(geometry.normalizeAngle(unit.rotation - guideRotation)) <= data.RANK_DRESS_ANGLE_TOLERANCE)
            .map((unit) => ({
                unit,
                projection: geometry.dot(geometry.getUnitCenter(unit), right)
            }))
            .sort((left, rightEntry) => left.projection - rightEntry.projection);

        if (aligned.length < 2) {
            return seedRank || [];
        }

        const seedIndices = aligned
            .map((entry, index) => (seedSet.has(entry.unit.id) ? index : -1))
            .filter((index) => index >= 0);
        const minSeedIndex = Math.min(...seedIndices);
        const maxSeedIndex = Math.max(...seedIndices);

        let best = null;
        for (let left = 0; left <= minSeedIndex; left += 1) {
            for (let rightIndex = maxSeedIndex; rightIndex < aligned.length; rightIndex += 1) {
                const subset = aligned.slice(left, rightIndex + 1).map((entry) => entry.unit);
                const orderedIds = trySelection(subset, guideRotation);
                if (!orderedIds) {
                    continue;
                }
                if (!best || orderedIds.length > best.length) {
                    best = orderedIds;
                }
            }
        }

        return best || seedRank || [];
    }


    function placeUnitWithFrontLeftAt(unit, rotation, point) {
        return {
            ...unit,
            x: point.x,
            y: point.y,
            rotation
        };
    }


    function placeUnitWithFrontRightAt(unit, rotation, point) {
        const right = geometry.getRightVector(rotation);
        const frontLeft = geometry.subtract(point, geometry.scaleVector(right, unit.width));
        return placeUnitWithFrontLeftAt(unit, rotation, frontLeft);
    }


    function buildIdealRankPoses(units, orderedIds, targetRotation) {
        const byId = new Map(units.map((unit) => [unit.id, unit]));
        const ordered = orderedIds.map((unitId) => byId.get(unitId)).filter(Boolean);
        if (ordered.length === 0) {
            return new Map();
        }

        const poses = new Map();
        const anchorIndex = Math.floor(ordered.length / 2);
        const anchor = ordered[anchorIndex];
        poses.set(
            anchor.id,
            geometry.buildUnitFromCenter(anchor, geometry.getUnitCenter(anchor), targetRotation)
        );

        for (let index = anchorIndex + 1; index < ordered.length; index += 1) {
            const leftUnit = poses.get(ordered[index - 1].id);
            const leftCorners = geometry.getUnitCorners(leftUnit);
            poses.set(
                ordered[index].id,
                placeUnitWithFrontLeftAt(ordered[index], targetRotation, leftCorners.frontRight)
            );
        }

        for (let index = anchorIndex - 1; index >= 0; index -= 1) {
            const rightUnit = poses.get(ordered[index + 1].id);
            const rightCorners = geometry.getUnitCorners(rightUnit);
            poses.set(
                ordered[index].id,
                placeUnitWithFrontRightAt(ordered[index], targetRotation, rightCorners.frontLeft)
            );
        }

        return poses;
    }


    function getDressGap(unit, neighbor) {
        const unitCorners = geometry.getUnitCorners(unit);
        const neighborCorners = geometry.getUnitCorners(neighbor);
        return Math.min(
            geometry.distance(unitCorners.frontRight, neighborCorners.frontLeft),
            geometry.distance(unitCorners.frontLeft, neighborCorners.frontRight)
        );
    }


    function isRankAlreadyDressed(units, orderedIds, targetRotation) {
        const byId = new Map(units.map((unit) => [unit.id, unit]));
        const ordered = orderedIds.map((unitId) => byId.get(unitId)).filter(Boolean);
        return ordered.every((unit) => (
            Math.abs(geometry.normalizeAngle(unit.rotation - targetRotation)) <= data.RANK_DRESS_ANGLE_TOLERANCE
        )) && ordered.every((unit, index) => {
            if (index === 0) {
                return true;
            }
            return getDressGap(unit, ordered[index - 1]) <= data.COLLISION_EPSILON;
        });
    }


    function isLegalDressPose(unit, rankPoses, blockers, terrain) {
        if (severityFromTerrain(sampleUnitTerrain(unit, terrain)) === TERRAIN_SEVERITY.impassable) {
            return false;
        }
        const unitCorners = geometry.getUnitCorners(unit);
        for (const blocker of blockers) {
            if (geometry.polygonsOverlap(unitCorners, geometry.getUnitCorners(blocker))) {
                return false;
            }
        }
        for (const [otherId, otherUnit] of rankPoses.entries()) {
            if (otherId === unit.id) {
                continue;
            }
            if (geometry.polygonsOverlap(unitCorners, geometry.getUnitCorners(otherUnit))) {
                return false;
            }
        }
        return true;
    }


    function resolveRankFormationDress(units, seedUnitIds, activePlayerId, terrain) {
        const rankUnitIds = findLargestRankUnitIds(units, seedUnitIds, activePlayerId);
        if (rankUnitIds.length < 2) {
            return { units, movedUnitIds: [] };
        }

        const originById = new Map(
            rankUnitIds.map((unitId) => [unitId, units.find((unit) => unit.id === unitId)]).filter(([, unit]) => unit)
        );
        const rankUnits = rankUnitIds.map((unitId) => ({ ...originById.get(unitId) }));
        const targetRotation = computeTargetRotation(rankUnits);
        const analysis = analyzeRankDressGeometry(rankUnits, targetRotation);
        if (analysis.type !== 'rank') {
            return { units, movedUnitIds: [] };
        }
        if (isRankAlreadyDressed(rankUnits, analysis.orderedIds, targetRotation)) {
            return { units, movedUnitIds: [] };
        }

        const idealPoses = buildIdealRankPoses(rankUnits, analysis.orderedIds, targetRotation);
        const rankIdSet = new Set(rankUnitIds);
        const blockers = units.filter((unit) => !rankIdSet.has(unit.id));
        const resolvedPoses = new Map();
        const movedUnitIds = [];

        analysis.orderedIds.forEach((unitId) => {
            const origin = originById.get(unitId);
            const chainedIdeal = idealPoses.get(unitId);
            if (!origin || !chainedIdeal) {
                return;
            }
            const rotationDelta = Math.abs(geometry.normalizeAngle(origin.rotation - targetRotation));
            const ideal = rotationDelta > data.RANK_DRESS_ANGLE_TOLERANCE
                ? geometry.buildUnitFromCenter(origin, geometry.getUnitCenter(origin), targetRotation)
                : chainedIdeal;
            const clamped = clampPose(origin, ideal, data.RANK_DRESS_MAX_TRAVEL);
            if (geometry.sameFootprint(origin, clamped)) {
                resolvedPoses.set(unitId, { ...origin });
                return;
            }
            if (!isLegalDressPose(clamped, resolvedPoses, blockers, terrain)) {
                resolvedPoses.set(unitId, { ...origin });
                return;
            }
            resolvedPoses.set(unitId, clamped);
            movedUnitIds.push(unitId);
        });

        if (movedUnitIds.length === 0) {
            return { units, movedUnitIds: [] };
        }

        const nextUnits = units.map((unit) => {
            if (!resolvedPoses.has(unit.id)) {
                return unit;
            }
            return { ...unit, ...resolvedPoses.get(unit.id) };
        });

        return {
            units: nextUnits,
            movedUnitIds
        };
    }


    return {
        findLargestRankUnitIds,
        resolveRankFormationDress
    };
}));
