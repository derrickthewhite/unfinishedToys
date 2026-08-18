(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js')
        );
        return;
    }
    root.HordesRulesCore = factory(root.HordesData, root.HordesGeometry);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry) {
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


    function getUnitSides(unit) {
        const corners = geometry.getUnitCorners(unit);
        return [
            { name: 'front', start: corners.frontLeft, end: corners.frontRight },
            { name: 'right', start: corners.frontRight, end: corners.backRight },
            { name: 'back', start: corners.backRight, end: corners.backLeft },
            { name: 'left', start: corners.backLeft, end: corners.frontLeft }
        ];
    }


    function getSideByName(unit, sideName) {
        return getUnitSides(unit).find((side) => side.name === sideName) || null;
    }


    function sideMidpoint(side) {
        return geometry.midpoint(side.start, side.end);
    }


    function hasMeaningfulSharedEdge(a1, a2, b1, b2) {
        return geometry.sharedSegmentLength(a1, a2, b1, b2) > data.COLLISION_EPSILON;
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


    function translateUnit(unit, direction, distance) {
        return {
            ...unit,
            x: unit.x + (direction.x * distance),
            y: unit.y + (direction.y * distance)
        };
    }


    function rotateUnitInPlace(unit, rotation) {
        return geometry.buildUnitFromCenter(unit, geometry.getUnitCenter(unit), rotation);
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


    return {
        normalizePlayerId,
        getPlayerId,
        getUnitSides,
        getSideByName,
        sideMidpoint,
        hasMeaningfulSharedEdge,
        cloneUnit,
        buildEnsorcelledUnit,
        translateUnit,
        rotateUnitInPlace,
        sharesFormationContact
    };
}));
