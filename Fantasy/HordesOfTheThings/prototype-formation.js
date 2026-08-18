(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'), require('./prototype-geometry.js'));
        return;
    }
    root.HordesFormation = factory(root.HordesData, root.HordesGeometry);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry) {
    function buildCenteredLinearOffsets(sizes, orientation) {
        const total = sizes.reduce((sum, size) => sum + size, 0);
        let cursor = orientation === 'forward'
            ? (total / 2) - (sizes[0] / 2)
            : (-total / 2) + (sizes[0] / 2);
        return sizes.map((size, index) => {
            if (index === 0) {
                return cursor;
            }
            const previousSize = sizes[index - 1];
            cursor += (orientation === 'forward' ? -1 : 1) * ((previousSize / 2) + (size / 2));
            return cursor;
        });
    }

    function getUnitFrontCenter(unit) {
        const corners = geometry.getUnitCorners(unit);
        return geometry.midpoint(corners.frontLeft, corners.frontRight);
    }

    function getUnitSideCenter(unit, sideSign) {
        const corners = geometry.getUnitCorners(unit);
        return sideSign < 0
            ? geometry.midpoint(corners.frontLeft, corners.backLeft)
            : geometry.midpoint(corners.frontRight, corners.backRight);
    }

    function buildFileFromSide(order, rotation, sideAnchor, sideSign) {
        const forward = geometry.getForwardVector(rotation);
        const right = geometry.getRightVector(rotation);
        const offsets = buildCenteredLinearOffsets(order.map((unit) => unit.depth), 'forward');
        return order.map((unit, index) => {
            const sideCenter = geometry.add(sideAnchor, geometry.scaleVector(forward, offsets[index]));
            const center = geometry.add(sideCenter, geometry.scaleVector(right, -sideSign * (unit.width / 2)));
            return geometry.buildUnitFromCenter(unit, center, rotation);
        });
    }

    function buildRankFromLead(order, rotation, frontAnchor) {
        const forward = geometry.getForwardVector(rotation);
        const right = geometry.getRightVector(rotation);
        const offsets = buildCenteredLinearOffsets(order.map((unit) => unit.width), 'right');
        return order.map((unit, index) => {
            const frontCenter = geometry.add(frontAnchor, geometry.scaleVector(right, offsets[index]));
            const center = geometry.add(frontCenter, geometry.scaleVector(forward, -(unit.depth / 2)));
            return geometry.buildUnitFromCenter(unit, center, rotation);
        });
    }

    function estimateConvertedFormationTravel(units, converted) {
        const byId = new Map(converted.map((unit) => [unit.id, unit]));
        return converted.reduce((maxDistance, unit) => {
            const originalUnit = units.find((candidate) => candidate.id === unit.id);
            const candidateUnit = byId.get(unit.id);
            return Math.max(maxDistance, geometry.distance(geometry.getUnitCenter(originalUnit), geometry.getUnitCenter(candidateUnit)));
        }, 0);
    }

    function buildConvertedFormationCandidates(units, analysis) {
        const boardCenter = { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 };
        const orderedUnits = analysis.orderedIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
        const candidates = [];
        if (analysis.type === 'rank') {
            const frontAnchor = geometry.midpoint(
                getUnitFrontCenter(orderedUnits[0]),
                getUnitFrontCenter(orderedUnits[orderedUnits.length - 1])
            );
            const toBoardCenter = geometry.subtract(boardCenter, frontAnchor);
            const leftRotation = geometry.normalizeAngle(orderedUnits[0].rotation - (Math.PI / 2));
            const rightRotation = geometry.normalizeAngle(orderedUnits[0].rotation + (Math.PI / 2));
            candidates.push({
                converted: buildFileFromSide(orderedUnits, leftRotation, frontAnchor, 1),
                score: geometry.dot(geometry.getForwardVector(leftRotation), toBoardCenter)
            });
            candidates.push({
                converted: buildFileFromSide([...orderedUnits].reverse(), rightRotation, frontAnchor, -1),
                score: geometry.dot(geometry.getForwardVector(rightRotation), toBoardCenter)
            });
        } else {
            const inwardRotationA = geometry.normalizeAngle(orderedUnits[0].rotation - (Math.PI / 2));
            const inwardRotationB = geometry.normalizeAngle(orderedUnits[0].rotation + (Math.PI / 2));
            const leftSideAnchor = geometry.midpoint(
                getUnitSideCenter(orderedUnits[0], -1),
                getUnitSideCenter(orderedUnits[orderedUnits.length - 1], -1)
            );
            const rightSideAnchor = geometry.midpoint(
                getUnitSideCenter(orderedUnits[0], 1),
                getUnitSideCenter(orderedUnits[orderedUnits.length - 1], 1)
            );
            const leftToBoardCenter = geometry.subtract(boardCenter, leftSideAnchor);
            const rightToBoardCenter = geometry.subtract(boardCenter, rightSideAnchor);
            const preferredFirst = geometry.distance(leftSideAnchor, boardCenter) <= geometry.distance(rightSideAnchor, boardCenter);
            const preferredAnchor = preferredFirst ? leftSideAnchor : rightSideAnchor;
            const fallbackAnchor = preferredFirst ? rightSideAnchor : leftSideAnchor;
            const preferredToBoardCenter = preferredFirst ? leftToBoardCenter : rightToBoardCenter;
            const fallbackToBoardCenter = preferredFirst ? rightToBoardCenter : leftToBoardCenter;
            [
                [orderedUnits, inwardRotationA, preferredAnchor, preferredToBoardCenter, 1],
                [[...orderedUnits].reverse(), inwardRotationA, preferredAnchor, preferredToBoardCenter, 1],
                [orderedUnits, inwardRotationB, preferredAnchor, preferredToBoardCenter, 1],
                [[...orderedUnits].reverse(), inwardRotationB, preferredAnchor, preferredToBoardCenter, 1],
                [orderedUnits, inwardRotationA, fallbackAnchor, fallbackToBoardCenter, 0],
                [[...orderedUnits].reverse(), inwardRotationA, fallbackAnchor, fallbackToBoardCenter, 0],
                [orderedUnits, inwardRotationB, fallbackAnchor, fallbackToBoardCenter, 0],
                [[...orderedUnits].reverse(), inwardRotationB, fallbackAnchor, fallbackToBoardCenter, 0]
            ].forEach(([order, rotation, anchor, toCenter, preference]) => {
                candidates.push({
                    converted: buildRankFromLead(order, rotation, anchor),
                    preference,
                    score: (preference ? 10 : 0) + geometry.dot(geometry.getForwardVector(rotation), toCenter)
                });
            });
        }

        return candidates
            .map((candidate) => ({
                ...candidate,
                travel: estimateConvertedFormationTravel(units, candidate.converted)
            }))
            .sort((left, right) => (right.preference || 0) - (left.preference || 0) || (right.score - left.score) || (left.travel - right.travel));
    }

    return {
        buildCenteredLinearOffsets,
        getUnitFrontCenter,
        getUnitSideCenter,
        buildFileFromSide,
        buildRankFromLead,
        estimateConvertedFormationTravel,
        buildConvertedFormationCandidates
    };
}));
