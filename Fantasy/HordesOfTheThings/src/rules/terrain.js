(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js')
        );
        return;
    }
    root.HordesRulesTerrain = factory(root.HordesData, root.HordesGeometry);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry) {
    const ROUGH_TERRAIN_TYPES = new Set(['forest', 'swamp']);

    const TERRAIN_SEVERITY = {
        road: 0,
        good: 1,
        swamp: 2,
        forest: 2,
        water: 3,
        impassable: 4
    };


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
        const samplePoints = geometry.hasOutline(unit)
            ? geometry.getUnitFootprintPoints(unit).concat([center])
            : [corners.frontLeft, corners.frontRight, corners.backLeft, corners.backRight, center, frontMid, backMid];
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


    function isUnitInBadGoing(unit, terrain) {
        const sample = sampleUnitTerrain(unit, terrain);
        return sample.has('forest') || sample.has('swamp');
    }


    function getUnitLurkFeatureKey(unit, terrain) {
        if (!unit || !terrain) {
            return null;
        }
        const corners = geometry.getUnitCorners(unit);
        const center = geometry.getUnitCenter(unit);
        const samplePoints = [
            corners.frontLeft,
            corners.frontRight,
            corners.backLeft,
            corners.backRight,
            center,
            geometry.midpoint(corners.frontLeft, corners.frontRight),
            geometry.midpoint(corners.backLeft, corners.backRight)
        ];
        const features = terrain.features || [];
        for (let index = 0; index < features.length; index += 1) {
            const feature = features[index];
            if (feature.kind !== 'forest' && feature.kind !== 'swamp') {
                continue;
            }
            if (samplePoints.some((point) => geometry.pointInBlob(point, feature))) {
                return `${index}:${feature.kind}:${Math.round(feature.cx)}:${Math.round(feature.cy)}`;
            }
        }
        return null;
    }


    function collectLurkerOccupancy(units, terrain) {
        const occupancy = {};
        (units || []).forEach((unit) => {
            occupancy[unit.id] = getUnitLurkFeatureKey(unit, terrain);
        });
        return occupancy;
    }


    function distanceToNearestBadGoing(unit, terrain) {
        if (!unit || !terrain) {
            return Infinity;
        }
        if (isUnitInBadGoing(unit, terrain)) {
            return 0;
        }
        const center = geometry.getUnitCenter(unit);
        let best = Infinity;
        (terrain.features || []).forEach((feature) => {
            if (feature.kind !== 'forest' && feature.kind !== 'swamp') {
                return;
            }
            const radius = Math.min(feature.rx || 0, feature.ry || 0);
            const gap = geometry.distance(center, { x: feature.cx, y: feature.cy }) - radius;
            best = Math.min(best, Math.max(0, gap));
        });
        return best;
    }


    function isLurkerIsolated(unit, units, terrain) {
        if (!data.isLurkerType(unit?.type)) {
            return false;
        }
        const limit = data.pacesToMm(data.LURKER_ISOLATION_PACES);
        const playerId = unit.playerId;
        return !(units || []).some((other) => {
            if (!other || other.id === unit.id || other.playerId === playerId || other.type === 'Base') {
                return false;
            }
            return geometry.unitsMinDistance(unit, other) <= limit;
        });
    }


    function findIsolatedLurkers(units, terrain) {
        return (units || []).filter((unit) => isLurkerIsolated(unit, units, terrain));
    }


    return {
        ROUGH_TERRAIN_TYPES,
        TERRAIN_SEVERITY,
        getTerrainTypeAt,
        sampleUnitTerrain,
        severityFromTerrain,
        combineMoveSeverity,
        movementAllowanceForSeverity,
        isUnitInBadGoing,
        getUnitLurkFeatureKey,
        collectLurkerOccupancy,
        distanceToNearestBadGoing,
        isLurkerIsolated,
        findIsolatedLurkers
    };
}));
