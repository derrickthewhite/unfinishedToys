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

    function pointInBlob(point, feature) {
        const dx = (point.x - feature.cx) / feature.rx;
        const dy = (point.y - feature.cy) / feature.ry;
        const theta = Math.atan2(dy, dx);
        const radius = 1 + Math.sin(theta * 3) * feature.wobble + Math.cos(theta * 5) * feature.wobble * 0.45;
        return (dx * dx) + (dy * dy) <= radius * radius;
    }

    function drawBlob(ctx, feature) {
        const points = 24;
        for (let index = 0; index <= points; index += 1) {
            const ratio = index / points;
            const theta = ratio * Math.PI * 2;
            const wobble = 1 + Math.sin(theta * 3) * feature.wobble + Math.cos(theta * 5) * feature.wobble * 0.45;
            const x = feature.cx + Math.cos(theta) * feature.rx * wobble;
            const y = feature.cy + Math.sin(theta) * feature.ry * wobble;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
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
        normalizeRect,
        pointInBlob,
        drawBlob,
        snapshotPositions,
        restoreSnapshot,
        sameIdSet,
        average,
        isContiguous,
        findFriendlySnapOffset
    };
}));