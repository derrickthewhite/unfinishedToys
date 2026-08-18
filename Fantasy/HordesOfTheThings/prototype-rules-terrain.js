(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js')
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


    function isUnitInBadGoing(unit, terrain) {
        const sample = sampleUnitTerrain(unit, terrain);
        return sample.has('forest') || sample.has('swamp');
    }


    return {
        ROUGH_TERRAIN_TYPES,
        TERRAIN_SEVERITY,
        getTerrainTypeAt,
        sampleUnitTerrain,
        severityFromTerrain,
        combineMoveSeverity,
        movementAllowanceForSeverity,
        isUnitInBadGoing
    };
}));
