(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('./core.js'),
            require('./terrain.js'),
            require('./melee.js')
        );
        return;
    }
    root.HordesRulesMovement = factory(root.HordesData, root.HordesGeometry, root.HordesRulesCore, root.HordesRulesTerrain, root.HordesRulesMelee);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, core, terrain, melee) {
    const {
        getPlayerId,
        sharesFormationContact
    } = core;

    const {
        TERRAIN_SEVERITY,
        sampleUnitTerrain,
        severityFromTerrain,
        combineMoveSeverity,
        movementAllowanceForSeverity
    } = terrain;

    const {
        detectMeleeCombats
    } = melee;
    const CORNER_TRAVEL_NAMES = ['frontLeft', 'frontRight', 'backLeft', 'backRight'];


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
        const cornerViolations = [];
        if (!draft) {
            return { invalidIds, reasonById, cornerViolations };
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
            const travels = travelById.get(unit.id);
            const maxCornerTravel = Math.max(...travels);
            if (maxCornerTravel > allowance + 0.5) {
                setInvalid(invalidIds, reasonById, unit.id, 'A corner moved farther than the terrain-limited allowance.');
                const originCorners = geometry.getUnitCorners(validationOrigin[unit.id]);
                const currentCorners = geometry.getUnitCorners(unit);
                CORNER_TRAVEL_NAMES.forEach((cornerName, index) => {
                    if (travels[index] > allowance + 0.5) {
                        cornerViolations.push({
                            unitId: unit.id,
                            corner: cornerName,
                            from: originCorners[cornerName],
                            to: currentCorners[cornerName]
                        });
                    }
                });
            }
        });

        return { invalidIds, reasonById, cornerViolations };
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


    return {
        analyzeSelection,
        validateDraftState,
        describeSelection
    };
}));
