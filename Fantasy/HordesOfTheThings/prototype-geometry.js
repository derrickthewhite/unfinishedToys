(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'));
        return;
    }
    root.HordesGeometry = factory(root.HordesData);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
    function add(left, right) {
        return { x: left.x + right.x, y: left.y + right.y };
    }

    function subtract(left, right) {
        return { x: left.x - right.x, y: left.y - right.y };
    }

    function scaleVector(vector, scale) {
        return { x: vector.x * scale, y: vector.y * scale };
    }

    function dot(left, right) {
        return left.x * right.x + left.y * right.y;
    }

    function distance(left, right) {
        return Math.hypot(left.x - right.x, left.y - right.y);
    }

    function normalize(vector) {
        const magnitude = Math.hypot(vector.x, vector.y) || 1;
        return { x: vector.x / magnitude, y: vector.y / magnitude };
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function lerp(start, end, t) {
        return start + (end - start) * t;
    }

    function lerpPoint(start, end, t) {
        return {
            x: lerp(start.x, end.x, t),
            y: lerp(start.y, end.y, t)
        };
    }

    function cross(left, right) {
        return (left.x * right.y) - (left.y * right.x);
    }

    function orientation(a, b, c) {
        const value = cross(subtract(b, a), subtract(c, a));
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
        const axis = normalize(subtract(a2, a1));
        const aStart = dot(a1, axis);
        const aEnd = dot(a2, axis);
        const bStart = dot(b1, axis);
        const bEnd = dot(b2, axis);
        const overlapStart = Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd));
        const overlapEnd = Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd));
        return Math.max(0, overlapEnd - overlapStart);
    }

    function segmentIntersectsPolygon(start, end, polygon) {
        if (pointInPolygon(start, polygon) || pointInPolygon(end, polygon)) {
            return true;
        }
        const points = cornersToPoints(polygon);
        for (let index = 0; index < points.length; index += 1) {
            const next = points[(index + 1) % points.length];
            if (segmentsIntersect(start, end, points[index], next)) {
                return true;
            }
        }
        return false;
    }

    function normalizeAngle(angle) {
        let value = angle;
        while (value <= -Math.PI) {
            value += Math.PI * 2;
        }
        while (value > Math.PI) {
            value -= Math.PI * 2;
        }
        return value;
    }

    function lerpAngle(start, end, t) {
        const delta = normalizeAngle(end - start);
        return normalizeAngle(start + delta * t);
    }

    function midpoint(left, right) {
        return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    }

    function rotatePoint(point, pivot, angle) {
        const dx = point.x - pivot.x;
        const dy = point.y - pivot.y;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: pivot.x + (dx * cos) - (dy * sin),
            y: pivot.y + (dx * sin) + (dy * cos)
        };
    }

    function angleBetween(from, to) {
        return Math.atan2(to.y - from.y, to.x - from.x);
    }

    function getForwardVector(rotation) {
        return { x: Math.sin(rotation), y: -Math.cos(rotation) };
    }

    function getRightVector(rotation) {
        return { x: Math.cos(rotation), y: Math.sin(rotation) };
    }

    function getUnitCorners(unit) {
        const forward = getForwardVector(unit.rotation);
        const right = getRightVector(unit.rotation);
        const frontLeft = { x: unit.x, y: unit.y };
        const frontRight = add(frontLeft, scaleVector(right, unit.width));
        const backLeft = add(frontLeft, scaleVector(forward, -unit.depth));
        const backRight = add(frontRight, scaleVector(forward, -unit.depth));
        return { frontLeft, frontRight, backRight, backLeft };
    }

    function cornersToPoints(corners) {
        return [corners.frontLeft, corners.frontRight, corners.backRight, corners.backLeft];
    }

    function getUnitCenter(unit) {
        const corners = getUnitCorners(unit);
        return {
            x: (corners.frontLeft.x + corners.backRight.x) / 2,
            y: (corners.frontLeft.y + corners.backRight.y) / 2
        };
    }

    function buildUnitFromCenter(unit, center, rotation) {
        const right = getRightVector(rotation);
        const forward = getForwardVector(rotation);
        const frontLeft = add(add(center, scaleVector(right, -unit.width / 2)), scaleVector(forward, unit.depth / 2));
        return {
            ...unit,
            x: frontLeft.x,
            y: frontLeft.y,
            rotation
        };
    }

    function reverseUnitFacing(unit) {
        const corners = getUnitCorners(unit);
        return {
            ...unit,
            x: corners.backRight.x,
            y: corners.backRight.y,
            rotation: normalizeAngle(unit.rotation + Math.PI)
        };
    }

    function rotateUnitsAroundCenter(units, targetRotation) {
        if (units.length === 0) {
            return [];
        }
        const centers = units.map((unit) => getUnitCenter(unit));
        const formationCenter = {
            x: average(centers.map((center) => center.x)),
            y: average(centers.map((center) => center.y))
        };
        const rotationDelta = normalizeAngle(targetRotation - units[0].rotation);
        return units.map((unit) => {
            const unitCenter = getUnitCenter(unit);
            const rotatedCenter = rotatePoint(unitCenter, formationCenter, rotationDelta);
            return buildUnitFromCenter(unit, rotatedCenter, normalizeAngle(unit.rotation + rotationDelta));
        });
    }

    function pairTravelDistances(previousPair, currentPair) {
        const direct = [
            distance(previousPair[0], currentPair[0]),
            distance(previousPair[1], currentPair[1])
        ];
        const swapped = [
            distance(previousPair[0], currentPair[1]),
            distance(previousPair[1], currentPair[0])
        ];
        const directWorst = Math.max(...direct);
        const swappedWorst = Math.max(...swapped);
        return swappedWorst < directWorst ? swapped : direct;
    }

    function sameFootprint(leftUnit, rightUnit, epsilon) {
        const threshold = epsilon || 0.05;
        const leftPoints = cornersToPoints(getUnitCorners(leftUnit));
        const rightPoints = cornersToPoints(getUnitCorners(rightUnit));
        return leftPoints.every((leftPoint) => rightPoints.some((rightPoint) => distance(leftPoint, rightPoint) <= threshold))
            && rightPoints.every((rightPoint) => leftPoints.some((leftPoint) => distance(leftPoint, rightPoint) <= threshold));
    }

    function interpolateUnitPose(origin, current, t) {
        const originCenter = getUnitCenter(origin);
        const currentCenter = getUnitCenter(current);
        const center = {
            x: lerp(originCenter.x, currentCenter.x, t),
            y: lerp(originCenter.y, currentCenter.y, t)
        };
        const rotation = lerpAngle(origin.rotation, current.rotation, t);
        return buildUnitFromCenter(current, center, rotation);
    }

    function tracePolygon(ctx, corners) {
        ctx.moveTo(corners.frontLeft.x, corners.frontLeft.y);
        ctx.lineTo(corners.frontRight.x, corners.frontRight.y);
        ctx.lineTo(corners.backRight.x, corners.backRight.y);
        ctx.lineTo(corners.backLeft.x, corners.backLeft.y);
        ctx.closePath();
    }

    function pointInPolygon(point, corners) {
        const polygon = cornersToPoints(corners);
        let inside = false;
        for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
            const current = polygon[index];
            const prior = polygon[previous];
            const intersects = ((current.y > point.y) !== (prior.y > point.y))
                && (point.x < ((prior.x - current.x) * (point.y - current.y)) / ((prior.y - current.y) + Number.EPSILON) + current.x);
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    function polygonInsideRect(corners, rect) {
        return cornersToPoints(corners).every((point) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
    }

    function projectPolygon(points, axis) {
        const values = points.map((point) => dot(point, axis));
        return { min: Math.min(...values), max: Math.max(...values) };
    }

    function distancePointToSegment(point, start, end) {
        const edge = subtract(end, start);
        const lengthSq = edge.x * edge.x + edge.y * edge.y;
        if (lengthSq <= 1e-8) {
            return distance(point, start);
        }
        const t = clamp(dot(subtract(point, start), edge) / lengthSq, 0, 1);
        return distance(point, add(start, scaleVector(edge, t)));
    }

    function minDistanceBetweenPolygons(aCorners, bCorners) {
        if (polygonsOverlap(aCorners, bCorners)) {
            return 0;
        }
        const polygons = [cornersToPoints(aCorners), cornersToPoints(bCorners)];
        let min = Infinity;
        polygons.forEach((source, sourceIndex) => {
            const target = polygons[1 - sourceIndex];
            source.forEach((point) => {
                for (let index = 0; index < target.length; index += 1) {
                    min = Math.min(min, distancePointToSegment(point, target[index], target[(index + 1) % target.length]));
                }
            });
        });
        return min;
    }

    function polygonsOverlap(aCorners, bCorners) {
        const polygons = [cornersToPoints(aCorners), cornersToPoints(bCorners)];
        for (const polygon of polygons) {
            for (let index = 0; index < polygon.length; index += 1) {
                const current = polygon[index];
                const next = polygon[(index + 1) % polygon.length];
                const edge = subtract(next, current);
                const axis = normalize({ x: -edge.y, y: edge.x });
                const projectionA = projectPolygon(polygons[0], axis);
                const projectionB = projectPolygon(polygons[1], axis);
                if (projectionA.max <= projectionB.min + data.COLLISION_EPSILON || projectionB.max <= projectionA.min + data.COLLISION_EPSILON) {
                    return false;
                }
            }
        }
        return true;
    }

    function normalizeRect(start, end) {
        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const bottom = Math.max(start.y, end.y);
        return { left, top, right, bottom, width: right - left, height: bottom - top };
    }

    function roundClosedPolygon(points, radius) {
        if (points.length < 3 || radius <= 0) {
            return points;
        }
        const rounded = [];
        const count = points.length;
        for (let index = 0; index < count; index += 1) {
            const previous = points[(index + count - 1) % count];
            const current = points[index];
            const next = points[(index + 1) % count];
            const toPrevious = subtract(previous, current);
            const toNext = subtract(next, current);
            const previousLength = Math.hypot(toPrevious.x, toPrevious.y);
            const nextLength = Math.hypot(toNext.x, toNext.y);
            if (previousLength < 0.5 || nextLength < 0.5) {
                rounded.push(current);
                continue;
            }
            const cut = Math.min(radius, previousLength * 0.42, nextLength * 0.42);
            if (cut < 1) {
                rounded.push(current);
                continue;
            }
            const start = add(current, scaleVector(toPrevious, cut / previousLength));
            const end = add(current, scaleVector(toNext, cut / nextLength));
            const steps = Math.max(2, Math.round(cut / 8));
            for (let step = 0; step <= steps; step += 1) {
                const t = step / steps;
                const inverse = 1 - t;
                rounded.push({
                    x: (inverse * inverse * start.x) + (2 * inverse * t * current.x) + (t * t * end.x),
                    y: (inverse * inverse * start.y) + (2 * inverse * t * current.y) + (t * t * end.y)
                });
            }
        }
        return rounded;
    }

    function polygonSignedArea(points) {
        let area = 0;
        for (let index = 0; index < points.length; index += 1) {
            const current = points[index];
            const next = points[(index + 1) % points.length];
            area += (current.x * next.y) - (next.x * current.y);
        }
        return area / 2;
    }

    function subdivideClosedPolygon(points, maxEdge = 8) {
        if (points.length < 3) {
            return points;
        }
        const subdivided = [];
        for (let index = 0; index < points.length; index += 1) {
            const current = points[index];
            const next = points[(index + 1) % points.length];
            subdivided.push(current);
            const span = distance(current, next);
            const splits = Math.floor(span / maxEdge);
            for (let step = 1; step < splits; step += 1) {
                const t = step / splits;
                subdivided.push({
                    x: current.x + ((next.x - current.x) * t),
                    y: current.y + ((next.y - current.y) * t)
                });
            }
        }
        return subdivided;
    }

    function waveClosedPolygon(points, amplitude, phase = 0) {
        if (points.length < 8 || amplitude <= 0) {
            return points;
        }
        const count = points.length;
        const ccw = polygonSignedArea(points) >= 0;
        let perimeter = 0;
        const edgeLengths = [];
        for (let index = 0; index < count; index += 1) {
            const length = distance(points[index], points[(index + 1) % count]);
            edgeLengths.push(length);
            perimeter += length;
        }
        if (perimeter < 1) {
            return points;
        }
        let traveled = 0;
        return points.map((current, index) => {
            const previous = points[(index + count - 1) % count];
            const next = points[(index + 1) % count];
            const tangent = { x: next.x - previous.x, y: next.y - previous.y };
            const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
            const normal = ccw
                ? { x: tangent.y / tangentLength, y: -tangent.x / tangentLength }
                : { x: -tangent.y / tangentLength, y: tangent.x / tangentLength };
            const t = traveled / perimeter;
            traveled += edgeLengths[index];
            const offset = amplitude * (
                Math.sin((t * Math.PI * 18) + phase)
                + (0.4 * Math.sin((t * Math.PI * 30) + (phase * 1.7)))
                + (0.18 * Math.sin((t * Math.PI * 46) + (phase * 0.6)))
            );
            return add(current, scaleVector(normal, offset));
        });
    }

    let terrainCatalog = null;
    let terrainCatalogResolved = false;

    function setTerrainCatalog(catalog) {
        terrainCatalog = catalog || null;
        terrainCatalogResolved = true;
        return terrainCatalog;
    }

    function getTerrainCatalog() {
        tryLoadTerrainCatalogSync();
        return terrainCatalog;
    }

    function tryLoadTerrainCatalogSync() {
        if (terrainCatalogResolved) {
            return terrainCatalog;
        }
        if (typeof require === 'function' && typeof module !== 'undefined' && module.exports) {
            try {
                terrainCatalog = require('./assets/terrain/catalog.json');
            } catch (error) {
                terrainCatalog = null;
            }
        }
        terrainCatalogResolved = true;
        return terrainCatalog;
    }

    function loadTerrainCatalog() {
        tryLoadTerrainCatalogSync();
        if (terrainCatalog || typeof fetch !== 'function' || typeof window === 'undefined') {
            return Promise.resolve(terrainCatalog);
        }
        return fetch('assets/terrain/catalog.json')
            .then((response) => response.ok ? response.json() : null)
            .then((catalog) => setTerrainCatalog(catalog))
            .catch(() => setTerrainCatalog(null));
    }

    function catalogPointsForShape(shape, variant) {
        const raw = terrainCatalog?.[variant]?.[shape];
        if (!Array.isArray(raw) || raw.length < 3) {
            return null;
        }
        return raw.map(([x, y]) => ({ x, y }));
    }

    function getTerrainShapeLocalPoints(shape, pointCount = 48, options = {}) {
        const points = [];
        const addPoint = (x, y) => points.push({ x, y });
        const wobble = options.wobble || 0;
        if (shape === 'fat-l') {
            [[-1, -1], [-0.2, -1], [-0.2, 0.2], [1, 0.2], [1, 1], [-1, 1]].forEach(([x, y]) => addPoint(x, y));
            return points;
        }
        if (shape === 'cross') {
            [[-0.35, -1], [0.35, -1], [0.35, -0.35], [1, -0.35], [1, 0.35], [0.35, 0.35], [0.35, 1], [-0.35, 1], [-0.35, 0.35], [-1, 0.35], [-1, -0.35], [-0.35, -0.35]].forEach(([x, y]) => addPoint(x, y));
            return points;
        }
        if (shape === 'horseshoe') {
            [[-1, -1], [1, -1], [1, 0.55], [0.55, 1], [0.28, 0.58], [0.28, -0.48], [-0.28, -0.48], [-0.28, 0.58], [-0.55, 1], [-1, 0.55]].forEach(([x, y]) => addPoint(x, y));
            return points;
        }
        for (let index = 0; index < pointCount; index += 1) {
            const theta = (index / pointCount) * Math.PI * 2;
            let x = Math.cos(theta);
            let y = Math.sin(theta);
            if (shape === 'blob') {
                const radius = 1 + Math.sin(theta * 3) * wobble + Math.cos(theta * 5) * wobble * 0.45;
                x *= radius;
                y *= radius;
            } else if (shape === 'kidney') {
                x = Math.cos(theta) * (0.78 + (0.3 * Math.sin(theta)));
            } else if (shape === 'half-circle') {
                y = Math.max(-0.45, y);
            } else if (shape === 'square') {
                const scale = 1 / Math.max(Math.abs(x), Math.abs(y));
                x *= scale;
                y *= scale;
            } else if (shape === 'rectangle') {
                const scale = 1 / Math.max(Math.abs(x), Math.abs(y));
                x *= scale * 1.7;
                y *= scale * 0.38;
            } else if (shape === 'oval') {
                x *= 1.45;
                y *= 0.68;
            } else if (shape === 'lightbulb') {
                const top = Math.max(0, -y);
                x *= 0.50 + (top * 0.62);
                y = y < 0 ? y * 1.12 : y * 0.82 + 0.18;
            }
            addPoint(x, y);
        }
        return points;
    }

    function finishTerrainOutline(feature, points) {
        const scale = Math.min(feature.rx || 0, feature.ry || 0);
        const filleted = points.length <= 16
            ? roundClosedPolygon(points, scale * 0.22)
            : points;
        const targetEdge = Math.max(6, (Math.PI * (scale || 40)) / 32);
        const dense = subdivideClosedPolygon(filleted, targetEdge);
        const amplitude = scale * (feature.wobble || 0) * 0.12;
        const phase = (feature.wobble || 0) * 8;
        return waveClosedPolygon(dense, amplitude, phase);
    }

    function applyTerrainOutlineWave(feature, points) {
        return finishTerrainOutline(feature, points);
    }

    function transformTerrainLocalPoints(feature, localPoints) {
        const rotation = feature.rotation || 0;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        return localPoints.map((point) => ({
            x: feature.cx + (point.x * feature.rx * cos) - (point.y * feature.ry * sin),
            y: feature.cy + (point.x * feature.rx * sin) + (point.y * feature.ry * cos)
        }));
    }

    function getTerrainFeaturePoints(feature, pointCount = 48) {
        tryLoadTerrainCatalogSync();
        const shape = feature.shape || 'blob';
        const localPoints = shape === 'blob'
            ? getTerrainShapeLocalPoints('blob', pointCount, { wobble: feature.wobble || 0 })
            : (catalogPointsForShape(shape, 'original') || getTerrainShapeLocalPoints(shape, pointCount));
        return applyTerrainOutlineWave(feature, transformTerrainLocalPoints(feature, localPoints));
    }

    function pointInBlob(point, feature) {
        const points = getTerrainFeaturePoints(feature);
        let inside = false;
        for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
            const current = points[index];
            const prior = points[previous];
            if (((current.y > point.y) !== (prior.y > point.y))
                && point.x < ((prior.x - current.x) * (point.y - current.y)) / ((prior.y - current.y) + Number.EPSILON) + current.x) {
                inside = !inside;
            }
        }
        return inside;
    }

    function drawBlob(ctx, feature) {
        const points = getTerrainFeaturePoints(feature);
        points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.closePath();
    }

    function snapshotPositions(unitIds, units) {
        const snapshot = {};
        unitIds.forEach((unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (unit) {
                snapshot[unitId] = { ...unit };
            }
        });
        return snapshot;
    }

    function restoreSnapshot(snapshot, units) {
        units.forEach((unit) => {
            const saved = snapshot[unit.id];
            if (saved) {
                Object.assign(unit, saved);
            }
        });
    }

    function sameIdSet(left, right) {
        if (!left || !right || left.length !== right.length) {
            return false;
        }
        const leftSorted = [...left].sort();
        const rightSorted = [...right].sort();
        return leftSorted.every((value, index) => value === rightSorted[index]);
    }

    function average(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function isContiguous(localized, axisKey, size, tolerance) {
        const ordered = [...localized].sort((left, right) => left[axisKey] - right[axisKey]);
        for (let index = 1; index < ordered.length; index += 1) {
            const gap = Math.abs((ordered[index][axisKey] - ordered[index - 1][axisKey]) - size);
            if (gap > tolerance) {
                return false;
            }
        }
        return true;
    }

    function intervalsOverlapOrClose(leftStart, leftEnd, rightStart, rightEnd, tolerance) {
        return Math.min(leftEnd, rightEnd) >= Math.max(leftStart, rightStart) - tolerance;
    }

    function anyFriendlyCollision(movingUnits, stationaryUnits) {
        return movingUnits.some((movingUnit) => stationaryUnits.some((stationaryUnit) => polygonsOverlap(getUnitCorners(movingUnit), getUnitCorners(stationaryUnit))));
    }

    function findFriendlySnapOffset(movingUnits, stationaryUnits) {
        if (!movingUnits || movingUnits.length === 0 || !stationaryUnits || stationaryUnits.length === 0) {
            return null;
        }
        const colliding = anyFriendlyCollision(movingUnits, stationaryUnits);
        const threshold = colliding ? data.SNAP_COLLISION_DISTANCE : data.SNAP_DISTANCE;
        const candidates = [];

        movingUnits.forEach((movingUnit) => {
            const movingCorners = getUnitCorners(movingUnit);
            const movingPoints = cornersToPoints(movingCorners);

            stationaryUnits.forEach((stationaryUnit) => {
                const stationaryCorners = getUnitCorners(stationaryUnit);
                const stationaryPoints = cornersToPoints(stationaryCorners);

                movingPoints.forEach((movingPoint) => {
                    stationaryPoints.forEach((stationaryPoint) => {
                        const offset = subtract(stationaryPoint, movingPoint);
                        const magnitude = Math.hypot(offset.x, offset.y);
                        if (magnitude > 0.01 && magnitude <= threshold) {
                            candidates.push({ offset, magnitude, kind: 'corner' });
                        }
                    });
                });

                const angleDelta = Math.abs(normalizeAngle(movingUnit.rotation - stationaryUnit.rotation));
                if (angleDelta > data.SNAP_PARALLEL_ANGLE) {
                    return;
                }

                const right = getRightVector(stationaryUnit.rotation);
                const forward = getForwardVector(stationaryUnit.rotation);
                const relative = subtract({ x: movingUnit.x, y: movingUnit.y }, { x: stationaryUnit.x, y: stationaryUnit.y });
                const movingLeft = dot(relative, right);
                const movingRight = movingLeft + movingUnit.width;
                const movingFront = dot(relative, forward);
                const movingBack = movingFront + movingUnit.depth;

                if (intervalsOverlapOrClose(movingFront, movingBack, 0, stationaryUnit.depth, threshold)) {
                    [0, stationaryUnit.width].forEach((stationaryEdge) => {
                        [movingLeft, movingRight].forEach((movingEdge) => {
                            const amount = stationaryEdge - movingEdge;
                            if (Math.abs(amount) > 0.01 && Math.abs(amount) <= threshold) {
                                const offset = scaleVector(right, amount);
                                candidates.push({ offset, magnitude: Math.abs(amount), kind: 'side' });
                            }
                        });
                    });
                }

                if (intervalsOverlapOrClose(movingLeft, movingRight, 0, stationaryUnit.width, threshold)) {
                    [0, stationaryUnit.depth].forEach((stationaryEdge) => {
                        [movingFront, movingBack].forEach((movingEdge) => {
                            const amount = stationaryEdge - movingEdge;
                            if (Math.abs(amount) > 0.01 && Math.abs(amount) <= threshold) {
                                const offset = scaleVector(forward, amount);
                                candidates.push({ offset, magnitude: Math.abs(amount), kind: 'side' });
                            }
                        });
                    });
                }
            });
        });

        if (candidates.length === 0) {
            return null;
        }

        let bestResolved = null;
        let bestAny = null;

        candidates.forEach((candidate) => {
            const shiftedUnits = movingUnits.map((unit) => ({
                ...unit,
                x: unit.x + candidate.offset.x,
                y: unit.y + candidate.offset.y
            }));
            const resolvesCollision = !anyFriendlyCollision(shiftedUnits, stationaryUnits);
            const scored = {
                offset: candidate.offset,
                magnitude: candidate.magnitude,
                kind: candidate.kind,
                resolvesCollision
            };
            if (!bestAny || scored.magnitude < bestAny.magnitude) {
                bestAny = scored;
            }
            if (resolvesCollision && (!bestResolved
                || (colliding && bestResolved.kind !== 'corner' && scored.kind === 'corner')
                || (bestResolved.kind === scored.kind && scored.magnitude < bestResolved.magnitude))) {
                bestResolved = scored;
            }
        });

        return colliding ? (bestResolved ? bestResolved.offset : bestAny.offset) : bestAny.offset;
    }

    return {
        add,
        subtract,
        scaleVector,
        dot,
        distance,
        normalize,
        clamp,
        lerp,
        lerpPoint,
        cross,
        orientation,
        onSegment,
        segmentsIntersect,
        sharedSegmentLength,
        segmentIntersectsPolygon,
        normalizeAngle,
        lerpAngle,
        midpoint,
        rotatePoint,
        angleBetween,
        getForwardVector,
        getRightVector,
        getUnitCorners,
        cornersToPoints,
        getUnitCenter,
        buildUnitFromCenter,
        reverseUnitFacing,
        rotateUnitsAroundCenter,
        pairTravelDistances,
        sameFootprint,
        interpolateUnitPose,
        tracePolygon,
        pointInPolygon,
        polygonInsideRect,
        polygonsOverlap,
        distancePointToSegment,
        minDistanceBetweenPolygons,
        normalizeRect,
        pointInBlob,
        getTerrainShapeLocalPoints,
        applyTerrainOutlineWave,
        getTerrainFeaturePoints,
        setTerrainCatalog,
        getTerrainCatalog,
        loadTerrainCatalog,
        drawBlob,
        snapshotPositions,
        restoreSnapshot,
        sameIdSet,
        average,
        isContiguous,
        findFriendlySnapOffset
    };
}));