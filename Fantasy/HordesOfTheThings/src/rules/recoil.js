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
    root.HordesRulesRecoil = factory(root.HordesData, root.HordesGeometry, root.HordesRulesCore, root.HordesRulesTerrain);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, core, terrain) {
    const {
        getPlayerId,
        getUnitSides,
        hasMeaningfulSharedEdge,
        cloneUnit,
        translateUnit
    } = core;

    const {
        sampleUnitTerrain
    } = terrain;
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
        const outsideBoard = geometry.cornersToPoints(geometry.getUnitCorners(unit))
            .some((point) => point.x < 0 || point.x > data.BOARD_SIZE || point.y < 0 || point.y > data.BOARD_SIZE);
        if (outsideBoard) {
            return 'recoil carries unit off the board';
        }
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


    return {
        resolveRecoil,
        resolveFlee,
        getRecoilBlockReason
    };
}));
