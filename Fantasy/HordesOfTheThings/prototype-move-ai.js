(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js')
        );
        return;
    }
    root.HordesMoveAi = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    const AUTO_MOVE_WEIGHTS = Object.freeze({
        fight: 3,
        matchup: 1.5,
        modifiers: 1.5,
        newContact: 1,
        dress: 1.5,
        formationSize: 1,
        stackBreak: 2,
        recoilDeath: 2.5,
        pinchRelief: 1,
        reserveEntry: 1,
        advance: 1,
        cohesion: 2,
        terrain: 1
    });
    const MATCHUP_SCALE = 0.25;
    const NEW_CONTACT_BONUS = 1;
    const FAVORABLE_NEW_CONTACT_BONUS = 0.5;
    const SHUFFLE_PENALTY = 0.35;
    const STACK_BREAK_PENALTY = 0.75;
    const DRESS_JOIN_BONUS = 0.6;
    const DRESS_PARTNER_SCALE = 0.2;
    const RECOIL_DEATH_PENALTY = 1.25;
    const PINCH_RELIEF_BONUS = 0.4;
    const REVERSE_MIN_DISADVANTAGE = 0.5;
    const WHEEL_STEP_DEGREES = [15, 30, 45];
    const MIN_BENEFIT = 0.25;
    const FORWARD_PROBE_STEP = 5;

    function getOpponentPlayerId(activePlayerId) {
        return activePlayerId === 'player-1' ? 'player-2' : 'player-1';
    }

    function clusterByCoordinate(entries, axis, tolerance) {
        const sorted = [...entries].sort((left, right) => left[axis] - right[axis]);
        const clusters = [];
        let current = [];
        sorted.forEach((entry) => {
            if (current.length === 0) {
                current.push(entry);
                return;
            }
            const clusterMean = geometry.average(current.map((item) => item[axis]));
            if (Math.abs(entry[axis] - clusterMean) <= tolerance) {
                current.push(entry);
                return;
            }
            clusters.push(current);
            current = [entry];
        });
        if (current.length > 0) {
            clusters.push(current);
        }
        return clusters;
    }

    function splitContiguous(sortedEntries, axis, unitSize, gapTolerance) {
        if (sortedEntries.length === 0) {
            return [];
        }
        const segments = [];
        let current = [sortedEntries[0]];
        for (let index = 1; index < sortedEntries.length; index += 1) {
            const previous = sortedEntries[index - 1];
            const next = sortedEntries[index];
            const gap = next[axis] - previous[axis];
            if (gap <= unitSize + gapTolerance) {
                current.push(next);
            } else {
                segments.push(current);
                current = [next];
            }
        }
        segments.push(current);
        return segments;
    }

    function localizeUnits(units, anchorUnit) {
        const forward = geometry.getForwardVector(anchorUnit.rotation);
        const right = geometry.getRightVector(anchorUnit.rotation);
        const anchor = geometry.getUnitCenter(anchorUnit);
        return units.map((unit) => {
            const delta = geometry.subtract(geometry.getUnitCenter(unit), anchor);
            return {
                unit,
                u: geometry.dot(delta, right),
                v: geometry.dot(delta, forward)
            };
        });
    }

    function findRankSegments(units) {
        if (units.length === 0) {
            return [];
        }
        const localized = localizeUnits(units, units[0]);
        const rows = clusterByCoordinate(localized, 'v', data.RANK_TOLERANCE);
        const segments = [];
        rows.forEach((row) => {
            const sorted = [...row].sort((left, right) => left.u - right.u);
            splitContiguous(sorted, 'u', units[0].width, data.FORMATION_GAP_TOLERANCE).forEach((segment) => {
                segments.push(segment.map((entry) => entry.unit));
            });
        });
        return segments;
    }

    function findFileSegments(units) {
        if (units.length === 0) {
            return [];
        }
        const localized = localizeUnits(units, units[0]);
        const columns = clusterByCoordinate(localized, 'u', data.FILE_TOLERANCE);
        const segments = [];
        columns.forEach((column) => {
            const sorted = [...column].sort((left, right) => right.v - left.v);
            splitContiguous(sorted, 'v', units[0].depth, data.FORMATION_GAP_TOLERANCE).forEach((segment) => {
                segments.push(segment.map((entry) => entry.unit));
            });
        });
        return segments;
    }

    function collectMoveCandidateGroups(units, activePlayerId, getPlayerId) {
        const unmoved = units.filter((unit) => (
            getPlayerId(unit) === activePlayerId
            && !unit.movedThisTurn
            && !unit.inReserve
        ));
        const groups = [];
        const seen = new Set();
        const facingBuckets = new Map();

        unmoved.forEach((unit) => {
            const key = String(Math.round(unit.rotation * 100));
            if (!facingBuckets.has(key)) {
                facingBuckets.set(key, []);
            }
            facingBuckets.get(key).push(unit);
        });

        const addGroup = (unitIds) => {
            const key = [...unitIds].sort().join(',');
            if (seen.has(key)) {
                return;
            }
            const selected = unitIds
                .map((unitId) => units.find((unit) => unit.id === unitId))
                .filter(Boolean);
            const analysis = rules.analyzeSelection(selected);
            if (analysis.invalid || analysis.type === 'none' || analysis.type === 'invalid') {
                return;
            }
            seen.add(key);
            groups.push({ unitIds: [...unitIds], analysis });
        };

        facingBuckets.forEach((bucket) => {
            bucket.forEach((unit) => addGroup([unit.id]));

            findRankSegments(bucket).forEach((segment) => {
                for (let start = 0; start < segment.length; start += 1) {
                    for (let end = start; end < segment.length; end += 1) {
                        addGroup(segment.slice(start, end + 1).map((entry) => entry.id));
                    }
                }
            });

            findFileSegments(bucket).forEach((segment) => {
                for (let start = 0; start < segment.length; start += 1) {
                    for (let end = start; end < segment.length; end += 1) {
                        addGroup(segment.slice(start, end + 1).map((entry) => entry.id));
                    }
                }
            });
        });

        return groups;
    }

    function getReserveDeploySamples() {
        return [
            data.BOARD_SIZE / 2,
            data.BOARD_SIZE * 0.25,
            data.BOARD_SIZE * 0.75
        ];
    }

    function getPlayerMeleeUnitIds(units, playerId, getPlayerId) {
        const setup = rules.detectMeleeCombats(units);
        const ids = new Set();
        setup.combats.forEach((combat) => {
            const leftPlayer = getPlayerId(units.find((unit) => unit.id === combat.leftPrimaryId));
            if (leftPlayer === playerId) {
                combat.leftUnitIds.forEach((unitId) => ids.add(unitId));
            }
            const rightPlayer = getPlayerId(units.find((unit) => unit.id === combat.rightPrimaryId));
            if (rightPlayer === playerId) {
                combat.rightUnitIds.forEach((unitId) => ids.add(unitId));
            }
        });
        return ids;
    }

    function isUnitRecoilPinched(units, unitId, terrain, playerId, getPlayerId) {
        const unit = units.find((entry) => entry.id === unitId);
        if (!unit || getPlayerId(unit) !== playerId) {
            return false;
        }
        if (!getPlayerMeleeUnitIds(units, playerId, getPlayerId).has(unitId)) {
            return false;
        }
        return rules.resolveRecoil(unitId, units, terrain).destroyedIds.length > 0;
    }

    function scoreRecoilRisk(beforeUnits, afterUnits, activePlayerId, getPlayerId, movedUnitIds, terrain) {
        const formUpAfter = rules.resolveAutomaticFormUp(afterUnits, activePlayerId, terrain).units;
        let recoilDeath = 0;
        let pinchRelief = 0;
        const meleeAfter = getPlayerMeleeUnitIds(formUpAfter, activePlayerId, getPlayerId);

        movedUnitIds.forEach((unitId) => {
            if (!meleeAfter.has(unitId)) {
                return;
            }
            const recoil = rules.resolveRecoil(unitId, formUpAfter, terrain);
            recoil.destroyedIds.forEach((destroyedId) => {
                const destroyed = formUpAfter.find((entry) => entry.id === destroyedId);
                if (destroyed && getPlayerId(destroyed) === activePlayerId) {
                    recoilDeath -= RECOIL_DEATH_PENALTY;
                }
            });
        });

        movedUnitIds.forEach((unitId) => {
            const beforePinch = isUnitRecoilPinched(beforeUnits, unitId, terrain, activePlayerId, getPlayerId);
            const afterPinch = isUnitRecoilPinched(formUpAfter, unitId, terrain, activePlayerId, getPlayerId);
            if (beforePinch && !afterPinch) {
                pinchRelief += PINCH_RELIEF_BONUS;
            } else if (!beforePinch && afterPinch) {
                pinchRelief -= PINCH_RELIEF_BONUS * 0.5;
            }
        });

        return { recoilDeath, pinchRelief };
    }

    function isGroupInBadMelee(units, activePlayerId, unitIds, terrain) {
        const previews = getFormUpPreviewCombats(units, activePlayerId, terrain);
        return previews.some((preview) => {
            if (!combatInvolvesMovedUnits(preview, unitIds, activePlayerId)) {
                return false;
            }
            const sides = getActivePreviewSide(preview, activePlayerId);
            return sides && getCombatAdvantage(sides.active, sides.opponent) <= -REVERSE_MIN_DISADVANTAGE;
        });
    }

    function collectExtendedMoveCandidates(context) {
        const {
            units,
            activePlayerId,
            getPlayerId,
            reserveUnits = [],
            remainingMoves = 0
        } = context;
        const candidates = [];

        collectMoveCandidateGroups(units, activePlayerId, getPlayerId).forEach((group) => {
            candidates.push({ ...group, moveKind: 'forward', moveParam: null });

            if (group.analysis.type === 'rank') {
                WHEEL_STEP_DEGREES.forEach((degrees) => {
                    const radians = (degrees * Math.PI) / 180;
                    candidates.push({ ...group, moveKind: 'wheel-left', moveParam: radians });
                    candidates.push({ ...group, moveKind: 'wheel-right', moveParam: radians });
                });
            }

            if (group.analysis.type === 'rank' || group.analysis.type === 'file') {
                candidates.push({ ...group, moveKind: 'convert', moveParam: null });
            }

            if (isGroupInBadMelee(units, activePlayerId, group.unitIds, context.terrain)) {
                candidates.push({ ...group, moveKind: 'reverse', moveParam: null });
            }
        });

        if (remainingMoves > 0) {
            reserveUnits.forEach((unit) => {
                if (getPlayerId(unit) !== activePlayerId || !data.RESERVE_RECYCLE_TYPES.includes(unit.type)) {
                    return;
                }
                getReserveDeploySamples().forEach((worldX) => {
                    candidates.push({
                        unitIds: [unit.id],
                        analysis: {
                            type: 'single',
                            invalid: false,
                            reason: '',
                            forward: geometry.getForwardVector(0),
                            right: geometry.getRightVector(0)
                        },
                        moveKind: 'reserve-deploy',
                        moveParam: worldX,
                        reserveUnitId: unit.id
                    });
                });
            });
        }

        return candidates;
    }

    function cloneUnits(units) {
        return units.map((unit) => ({ ...unit }));
    }

    function applyForwardDistance(units, analysis, unitIds, base, distance) {
        const nextUnits = cloneUnits(units);
        const byId = new Map(nextUnits.map((unit) => [unit.id, unit]));
        const forward = analysis.forward;
        const moveDelta = geometry.scaleVector(forward, distance);

        if (analysis.type === 'single') {
            const unit = byId.get(unitIds[0]);
            const origin = base[unitIds[0]];
            unit.x = origin.x + moveDelta.x;
            unit.y = origin.y + moveDelta.y;
            return nextUnits;
        }

        if (analysis.type === 'rank') {
            unitIds.forEach((unitId) => {
                const unit = byId.get(unitId);
                const origin = base[unitId];
                unit.x = origin.x + moveDelta.x;
                unit.y = origin.y + moveDelta.y;
            });
            return nextUnits;
        }

        const orderedIds = analysis.orderedIds;
        const lead = byId.get(orderedIds[0]);
        const leadBase = base[orderedIds[0]];
        lead.x = leadBase.x + moveDelta.x;
        lead.y = leadBase.y + moveDelta.y;
        lead.rotation = leadBase.rotation;
        for (let index = 1; index < orderedIds.length; index += 1) {
            const previousUnit = byId.get(orderedIds[index - 1]);
            const follower = byId.get(orderedIds[index]);
            const followerBase = base[orderedIds[index]];
            const previousCorners = geometry.getUnitCorners(previousUnit);
            follower.x = previousCorners.backLeft.x;
            follower.y = previousCorners.backLeft.y;
            follower.rotation = followerBase.rotation;
        }
        return nextUnits;
    }

    function buildProbeDraft(unitIds, base) {
        return {
            unitIds: [...unitIds],
            initialOrigin: base,
            validationOrigin: base,
            origin: base,
            history: [],
            invalidIds: new Set(),
            reasonById: new Map(),
            cornerViolations: []
        };
    }

    function applySnapToTrialUnits(units, unitIds, snapEnabled) {
        if (!snapEnabled || unitIds.length === 0) {
            return units;
        }
        const movingIdSet = new Set(unitIds);
        const movingUnits = unitIds
            .map((unitId) => units.find((unit) => unit.id === unitId))
            .filter(Boolean);
        if (movingUnits.length === 0) {
            return units;
        }
        const stationaryUnits = units.filter((unit) => !movingIdSet.has(unit.id));
        const snapOffset = geometry.findFriendlySnapOffset(movingUnits, stationaryUnits);
        if (!snapOffset) {
            return units;
        }
        return units.map((unit) => (
            movingIdSet.has(unit.id)
                ? { ...unit, x: unit.x + snapOffset.x, y: unit.y + snapOffset.y }
                : unit
        ));
    }

    function mergeTrialUnits(units, unitIds, trialUnits) {
        const trialById = new Map(trialUnits.map((unit) => [unit.id, unit]));
        return units.map((unit) => (
            trialById.has(unit.id) ? { ...unit, ...trialById.get(unit.id) } : unit
        ));
    }

    function isTrialBoardLegal(units, terrain, unitIds, base) {
        const draft = buildProbeDraft(unitIds, base);
        return rules.validateDraftState(draft, units, terrain).invalidIds.size === 0;
    }

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

    function buildConvertedFormationCandidates(units, analysis) {
        const boardCenter = { x: data.BOARD_SIZE / 2, y: data.BOARD_SIZE / 2 };
        const orderedUnits = analysis.orderedIds
            .map((unitId) => units.find((unit) => unit.id === unitId))
            .filter(Boolean);
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
            const preferredFirst = geometry.distance(leftSideAnchor, boardCenter) <= geometry.distance(rightSideAnchor, boardCenter);
            const preferredAnchor = preferredFirst ? leftSideAnchor : rightSideAnchor;
            const fallbackAnchor = preferredFirst ? rightSideAnchor : leftSideAnchor;
            const preferredToBoardCenter = geometry.subtract(boardCenter, preferredAnchor);
            const fallbackToBoardCenter = geometry.subtract(boardCenter, fallbackAnchor);
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
        return candidates.sort((left, right) => (
            (right.preference || 0) - (left.preference || 0) || (right.score - left.score)
        ));
    }

    function applyReverseTrial(units, analysis, unitIds) {
        const next = cloneUnits(units);
        const byId = new Map(next.map((unit) => [unit.id, unit]));
        if (analysis.type === 'rank') {
            const ordered = analysis.orderedIds.map((unitId) => byId.get(unitId)).filter(Boolean);
            const reversedRotation = geometry.normalizeAngle(ordered[0].rotation + Math.PI);
            const centers = ordered.map((unit) => geometry.getUnitCenter(unit));
            const formationCenter = {
                x: geometry.average(centers.map((center) => center.x)),
                y: geometry.average(centers.map((center) => center.y))
            };
            const frontAnchor = geometry.add(
                formationCenter,
                geometry.scaleVector(
                    geometry.getForwardVector(reversedRotation),
                    geometry.average(ordered.map((unit) => unit.depth)) / 2
                )
            );
            buildRankFromLead([...ordered].reverse(), reversedRotation, frontAnchor).forEach((candidateUnit) => {
                Object.assign(byId.get(candidateUnit.id), candidateUnit);
            });
        } else {
            unitIds.forEach((unitId) => {
                Object.assign(byId.get(unitId), geometry.reverseUnitFacing(byId.get(unitId)));
            });
        }
        return next;
    }

    function applyWheelTrial(units, analysis, unitIds, base, moveKind, angleRadians) {
        const pivot = moveKind === 'wheel-left' ? analysis.leftPivot : analysis.rightPivot;
        const delta = moveKind === 'wheel-left' ? -Math.abs(angleRadians) : Math.abs(angleRadians);
        return unitIds.map((unitId) => {
            const origin = base[unitId];
            const frontLeft = geometry.rotatePoint({ x: origin.x, y: origin.y }, pivot, delta);
            return {
                ...units.find((unit) => unit.id === unitId),
                id: unitId,
                x: frontLeft.x,
                y: frontLeft.y,
                rotation: geometry.normalizeAngle(origin.rotation + delta)
            };
        });
    }

    function applyConvertTrial(units, analysis, unitIds) {
        const selected = unitIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
        const candidates = buildConvertedFormationCandidates(selected, analysis);
        for (let index = 0; index < candidates.length; index += 1) {
            const next = cloneUnits(units);
            const byId = new Map(next.map((unit) => [unit.id, unit]));
            candidates[index].converted.forEach((candidateUnit) => {
                Object.assign(byId.get(candidateUnit.id), candidateUnit);
            });
            return next;
        }
        return null;
    }

    function getHomeEdgeRotation(homeEdge) {
        return homeEdge === 'bottom' ? 0 : Math.PI;
    }

    function applyReserveDeployPose(unit, playerId, worldX, homeEdge) {
        const posed = { ...unit };
        const left = geometry.clamp(worldX - (posed.width / 2), 0, data.BOARD_SIZE - posed.width);
        if (homeEdge === 'bottom') {
            posed.x = left;
            posed.y = data.BOARD_SIZE - posed.depth;
            posed.rotation = 0;
            return posed;
        }
        posed.x = left + posed.width;
        posed.y = posed.depth;
        posed.rotation = Math.PI;
        return posed;
    }

    function isReserveDeployLegal(unit, boardUnits, terrain, playerId, getPlayerId, homeEdge) {
        const expectedRotation = getHomeEdgeRotation(homeEdge);
        if (Math.abs(geometry.normalizeAngle(unit.rotation - expectedRotation)) > 0.01) {
            return false;
        }
        const corners = geometry.getUnitCorners(unit);
        const others = boardUnits.filter((other) => other.id !== unit.id);
        if (others.some((other) => geometry.polygonsOverlap(corners, geometry.getUnitCorners(other)))) {
            return false;
        }
        const terrainTypes = rules.sampleUnitTerrain(unit, terrain);
        if (terrainTypes.has('impassable')) {
            return false;
        }
        const rearPoints = [corners.backLeft, corners.backRight];
        const onHomeEdge = homeEdge === 'bottom'
            ? rearPoints.every((point) => Math.abs(point.y - data.BOARD_SIZE) <= 0.6)
            : rearPoints.every((point) => Math.abs(point.y) <= 0.6);
        if (!onHomeEdge) {
            return false;
        }
        const clearance = data.pacesToMm(data.RESERVE_ENEMY_CLEARANCE_PACES);
        return !others.some((other) => (
            getPlayerId(other) !== playerId
            && geometry.minDistanceBetweenPolygons(corners, geometry.getUnitCorners(other)) < clearance - 0.01
        ));
    }

    function simulateMoveCandidate(context, candidate, forwardCache) {
        const {
            units,
            terrain,
            activePlayerId,
            remainingMoves,
            getPlayerId,
            snapEnabled = true,
            reserveUnits = [],
            getHomeEdge = (playerId) => (playerId === 'player-2' ? 'top' : 'bottom')
        } = context;
        const enemyPlayerId = getOpponentPlayerId(activePlayerId);
        const {
            unitIds,
            analysis,
            moveKind,
            moveParam
        } = candidate;

        if (moveKind === 'reserve-deploy') {
            if (remainingMoves < 1) {
                return null;
            }
            const reserveUnit = reserveUnits.find((entry) => entry.id === candidate.reserveUnitId);
            if (!reserveUnit) {
                return null;
            }
            const homeEdge = getHomeEdge(activePlayerId);
            const posed = applyReserveDeployPose(
                { ...reserveUnit, inReserve: false },
                activePlayerId,
                moveParam,
                homeEdge
            );
            if (!isReserveDeployLegal(posed, units, terrain, activePlayerId, getPlayerId, homeEdge)) {
                return null;
            }
            const afterUnits = [...units, posed];
            const scoring = scoreCandidate(
                units,
                afterUnits,
                activePlayerId,
                enemyPlayerId,
                getPlayerId,
                [posed.id],
                terrain
            );
            return {
                unitIds: [posed.id],
                analysis: candidate.analysis,
                moveKind,
                moveParam,
                reserveUnitId: reserveUnit.id,
                distance: 0,
                afterUnits,
                score: scoring.total,
                breakdown: scoring.breakdown
            };
        }

        const moveCost = rules.getDraftMoveCost(unitIds, units);
        if (moveCost > remainingMoves) {
            return null;
        }

        const base = geometry.snapshotPositions(unitIds, units);
        let trialUnits = null;
        let distance = 0;

        if (moveKind === 'forward') {
            const cacheKey = unitIds.join(',');
            distance = forwardCache.get(cacheKey);
            if (distance === undefined) {
                distance = findMaxForwardDistance(units, terrain, unitIds, analysis, snapEnabled);
                forwardCache.set(cacheKey, distance);
            }
            if (distance <= 0.05) {
                return null;
            }
            trialUnits = applyForwardDistance(units, analysis, unitIds, base, distance);
            if (analysis.type !== 'rank') {
                trialUnits = applySnapToTrialUnits(trialUnits, unitIds, snapEnabled);
            }
        } else if (moveKind === 'reverse') {
            trialUnits = applyReverseTrial(units, analysis, unitIds);
        } else if (moveKind === 'convert') {
            trialUnits = applyConvertTrial(units, analysis, unitIds);
            if (!trialUnits) {
                return null;
            }
        } else if (moveKind === 'wheel-left' || moveKind === 'wheel-right') {
            if (analysis.type !== 'rank') {
                return null;
            }
            trialUnits = mergeTrialUnits(
                units,
                unitIds,
                applyWheelTrial(units, analysis, unitIds, base, moveKind, moveParam)
            );
        } else {
            return null;
        }

        if (!isTrialBoardLegal(trialUnits, terrain, unitIds, base)) {
            if (moveKind === 'convert') {
                const selected = unitIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
                const conversions = buildConvertedFormationCandidates(selected, analysis);
                trialUnits = null;
                for (let index = 0; index < conversions.length; index += 1) {
                    const attempt = cloneUnits(units);
                    const byId = new Map(attempt.map((unit) => [unit.id, unit]));
                    conversions[index].converted.forEach((candidateUnit) => {
                        Object.assign(byId.get(candidateUnit.id), candidateUnit);
                    });
                    if (isTrialBoardLegal(attempt, terrain, unitIds, base)) {
                        trialUnits = attempt;
                        break;
                    }
                }
                if (!trialUnits) {
                    return null;
                }
            } else {
                return null;
            }
        }

        const afterUnits = trialUnits;
        const scoring = scoreCandidate(
            units,
            afterUnits,
            activePlayerId,
            enemyPlayerId,
            getPlayerId,
            unitIds,
            terrain
        );
        return {
            unitIds,
            analysis,
            moveKind,
            moveParam,
            distance,
            afterUnits,
            score: scoring.total,
            breakdown: scoring.breakdown
        };
    }

    function isForwardDistanceLegal(units, terrain, unitIds, analysis, base, distance, snapEnabled) {
        let trialUnits = applyForwardDistance(units, analysis, unitIds, base, distance);
        if (analysis.type !== 'rank') {
            trialUnits = applySnapToTrialUnits(trialUnits, unitIds, snapEnabled);
        }
        const draft = buildProbeDraft(unitIds, base);
        const result = rules.validateDraftState(draft, trialUnits, terrain);
        return result.invalidIds.size === 0;
    }

    function findMaxForwardDistance(units, terrain, unitIds, analysis, snapEnabled = true) {
        const base = geometry.snapshotPositions(unitIds, units);
        if (!isForwardDistanceLegal(units, terrain, unitIds, analysis, base, 0, snapEnabled)) {
            return 0;
        }

        const maxSearch = unitIds.reduce((limit, unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (!unit) {
                return limit;
            }
            const unitMax = Math.max(unit.moves.road, unit.moves.good, unit.moves.bad, unit.moves.water);
            return Math.max(limit, unitMax);
        }, data.BOARD_SIZE);

        let best = 0;
        for (let distance = FORWARD_PROBE_STEP; distance <= maxSearch; distance += FORWARD_PROBE_STEP) {
            if (!isForwardDistanceLegal(units, terrain, unitIds, analysis, base, distance, snapEnabled)) {
                break;
            }
            best = distance;
        }
        return best;
    }

    function getPlayerCentroid(units, playerId, getPlayerId) {
        const owned = units.filter((unit) => getPlayerId(unit) === playerId && !unit.inReserve);
        if (owned.length === 0) {
            return null;
        }
        const centers = owned.map((unit) => geometry.getUnitCenter(unit));
        return {
            x: geometry.average(centers.map((center) => center.x)),
            y: geometry.average(centers.map((center) => center.y))
        };
    }

    function getFormUpPreviewCombats(units, activePlayerId, terrain) {
        const formUpUnits = rules.resolveAutomaticFormUp(units, activePlayerId, terrain).units;
        return rules.previewMeleeCombats(formUpUnits, terrain);
    }

    function getActivePreviewSide(preview, activePlayerId) {
        if (preview.left.playerId === activePlayerId) {
            return { active: preview.left, opponent: preview.right };
        }
        if (preview.right.playerId === activePlayerId) {
            return { active: preview.right, opponent: preview.left };
        }
        return null;
    }

    function combatInvolvesMovedUnits(preview, movedUnitIds, activePlayerId) {
        const sides = getActivePreviewSide(preview, activePlayerId);
        if (!sides) {
            return false;
        }
        const moved = new Set(movedUnitIds);
        return sides.active.unitIds.some((unitId) => moved.has(unitId));
    }

    function getCombatFingerprint(preview) {
        return [...preview.left.unitIds, ...preview.right.unitIds].sort().join('|');
    }

    function getModifierQuality(side) {
        return side.modifiers.reduce((sum, modifier) => {
            if (modifier.id === 'stacked' || modifier.id === 'flank-attacked' || modifier.id === 'overlapped') {
                return sum + modifier.value;
            }
            return sum;
        }, 0);
    }

    function getCombatAdvantage(active, opponent) {
        return active.factor - opponent.factor;
    }

    function scoreFightQuality(beforeUnits, afterUnits, activePlayerId, terrain, movedUnitIds) {
        const beforePreviews = getFormUpPreviewCombats(beforeUnits, activePlayerId, terrain);
        const afterPreviews = getFormUpPreviewCombats(afterUnits, activePlayerId, terrain);
        const beforeByFingerprint = new Map(beforePreviews.map((preview) => [getCombatFingerprint(preview), preview]));

        const fight = getCombatAdvantageForPlayer(afterPreviews, activePlayerId)
            - getCombatAdvantageForPlayer(beforePreviews, activePlayerId);

        let matchup = 0;
        let modifiers = 0;
        let newContact = 0;

        afterPreviews.forEach((afterPreview) => {
            if (!combatInvolvesMovedUnits(afterPreview, movedUnitIds, activePlayerId)) {
                return;
            }
            const afterSides = getActivePreviewSide(afterPreview, activePlayerId);
            if (!afterSides) {
                return;
            }

            modifiers += getModifierQuality(afterSides.active);
            const afterMatchup = data.getDeploymentMatchupScore(
                afterSides.active.primaryType,
                afterSides.opponent.primaryType
            ) * MATCHUP_SCALE;

            const beforePreview = beforeByFingerprint.get(getCombatFingerprint(afterPreview));
            if (beforePreview) {
                const beforeSides = getActivePreviewSide(beforePreview, activePlayerId);
                if (beforeSides) {
                    modifiers -= getModifierQuality(beforeSides.active);
                    matchup += afterMatchup - (
                        data.getDeploymentMatchupScore(
                            beforeSides.active.primaryType,
                            beforeSides.opponent.primaryType
                        ) * MATCHUP_SCALE
                    );
                    const advantageGain = getCombatAdvantage(afterSides.active, afterSides.opponent)
                        - getCombatAdvantage(beforeSides.active, beforeSides.opponent);
                    if (advantageGain <= 0.01) {
                        newContact -= SHUFFLE_PENALTY;
                    }
                }
                return;
            }

            matchup += afterMatchup;
            newContact += NEW_CONTACT_BONUS;
            if (getCombatAdvantage(afterSides.active, afterSides.opponent) > 0) {
                newContact += FAVORABLE_NEW_CONTACT_BONUS;
            }
        });

        return { fight, matchup, modifiers, newContact };
    }

    function getFormationPartnerCount(units, unitId, activePlayerId, getPlayerId, movedUnitIds) {
        const unit = units.find((entry) => entry.id === unitId);
        if (!unit) {
            return 0;
        }
        const movedSet = new Set(movedUnitIds);
        const friendlies = units.filter((entry) => (
            getPlayerId(entry) === activePlayerId
            && !entry.inReserve
            && entry.id !== unitId
            && !movedSet.has(entry.id)
        ));
        const sameFacing = [unit, ...friendlies].filter((entry) => (
            Math.abs(geometry.normalizeAngle(entry.rotation - unit.rotation)) <= 0.12
        ));
        let partners = 0;
        findRankSegments(sameFacing).forEach((segment) => {
            if (segment.some((entry) => entry.id === unitId)) {
                partners = Math.max(partners, segment.length - 1);
            }
        });
        findFileSegments(sameFacing).forEach((segment) => {
            if (segment.some((entry) => entry.id === unitId)) {
                partners = Math.max(partners, segment.length - 1);
            }
        });
        return partners;
    }

    function sumActiveCombatUnits(previews, activePlayerId, movedUnitIds) {
        return previews.reduce((sum, preview) => {
            if (!combatInvolvesMovedUnits(preview, movedUnitIds, activePlayerId)) {
                return sum;
            }
            const sides = getActivePreviewSide(preview, activePlayerId);
            return sum + (sides ? sides.active.unitIds.length : 0);
        }, 0);
    }

    function sumStackedModifiers(previews, activePlayerId, movedUnitIds) {
        return previews.reduce((sum, preview) => {
            if (!combatInvolvesMovedUnits(preview, movedUnitIds, activePlayerId)) {
                return sum;
            }
            const sides = getActivePreviewSide(preview, activePlayerId);
            if (!sides) {
                return sum;
            }
            return sum + getModifierQuality(sides.active);
        }, 0);
    }

    function scoreFormationSupport(beforeUnits, afterUnits, activePlayerId, getPlayerId, movedUnitIds, terrain) {
        let dress = 0;
        movedUnitIds.forEach((unitId) => {
            const beforePartners = getFormationPartnerCount(
                beforeUnits,
                unitId,
                activePlayerId,
                getPlayerId,
                movedUnitIds
            );
            const afterPartners = getFormationPartnerCount(
                afterUnits,
                unitId,
                activePlayerId,
                getPlayerId,
                movedUnitIds
            );
            if (beforePartners === 0 && afterPartners > 0) {
                dress += DRESS_JOIN_BONUS + (afterPartners * DRESS_PARTNER_SCALE);
            } else if (afterPartners > beforePartners) {
                dress += (afterPartners - beforePartners) * DRESS_PARTNER_SCALE;
            }
        });
        dress /= Math.max(1, movedUnitIds.length);

        const beforePreviews = getFormUpPreviewCombats(beforeUnits, activePlayerId, terrain);
        const afterPreviews = getFormUpPreviewCombats(afterUnits, activePlayerId, terrain);
        const beforeStacked = sumStackedModifiers(beforePreviews, activePlayerId, movedUnitIds);
        const afterStacked = sumStackedModifiers(afterPreviews, activePlayerId, movedUnitIds);
        const beforeCombatUnits = sumActiveCombatUnits(beforePreviews, activePlayerId, movedUnitIds);
        const afterCombatUnits = sumActiveCombatUnits(afterPreviews, activePlayerId, movedUnitIds);

        let formationSize = 0;
        if (afterStacked > beforeStacked) {
            formationSize += afterStacked - beforeStacked;
        }
        if (afterCombatUnits > beforeCombatUnits && afterStacked >= beforeStacked) {
            formationSize += (afterCombatUnits - beforeCombatUnits) * 0.15;
        }

        let stackBreak = 0;
        beforePreviews.forEach((beforePreview) => {
            if (!combatInvolvesMovedUnits(beforePreview, movedUnitIds, activePlayerId)) {
                return;
            }
            const beforeSides = getActivePreviewSide(beforePreview, activePlayerId);
            if (!beforeSides || !beforeSides.active.modifiers.some((modifier) => modifier.id === 'stacked')) {
                return;
            }
            const fingerprint = getCombatFingerprint(beforePreview);
            const afterPreview = afterPreviews.find((preview) => getCombatFingerprint(preview) === fingerprint);
            if (!afterPreview) {
                stackBreak -= STACK_BREAK_PENALTY;
                return;
            }
            const afterSides = getActivePreviewSide(afterPreview, activePlayerId);
            if (!afterSides || !afterSides.active.modifiers.some((modifier) => modifier.id === 'stacked')) {
                stackBreak -= STACK_BREAK_PENALTY;
            }
        });

        return { dress, formationSize, stackBreak };
    }

    function getCombatAdvantageForPlayer(previews, playerId) {
        return previews.reduce((sum, preview) => {
            if (preview.left.playerId === playerId) {
                return sum + preview.left.factor - preview.right.factor;
            }
            if (preview.right.playerId === playerId) {
                return sum + preview.right.factor - preview.left.factor;
            }
            return sum;
        }, 0);
    }

    function scoreCandidate(beforeUnits, afterUnits, activePlayerId, enemyPlayerId, getPlayerId, movedUnitIds, terrain) {
        const fightQuality = scoreFightQuality(
            beforeUnits,
            afterUnits,
            activePlayerId,
            terrain,
            movedUnitIds
        );
        const formationQuality = scoreFormationSupport(
            beforeUnits,
            afterUnits,
            activePlayerId,
            getPlayerId,
            movedUnitIds,
            terrain
        );
        const recoilQuality = scoreRecoilRisk(
            beforeUnits,
            afterUnits,
            activePlayerId,
            getPlayerId,
            movedUnitIds,
            terrain
        );
        const breakdown = {
            ...fightQuality,
            ...formationQuality,
            ...recoilQuality,
            reserveEntry: scoreReserveEntry(beforeUnits, afterUnits, movedUnitIds),
            advance: scoreAdvance(beforeUnits, afterUnits, movedUnitIds, activePlayerId, enemyPlayerId, getPlayerId),
            cohesion: scoreCohesion(beforeUnits, afterUnits, activePlayerId, getPlayerId),
            terrain: scoreTerrain(beforeUnits, afterUnits, movedUnitIds, terrain)
        };
        const total = (
            breakdown.fight * AUTO_MOVE_WEIGHTS.fight
            + breakdown.matchup * AUTO_MOVE_WEIGHTS.matchup
            + breakdown.modifiers * AUTO_MOVE_WEIGHTS.modifiers
            + breakdown.newContact * AUTO_MOVE_WEIGHTS.newContact
            + breakdown.dress * AUTO_MOVE_WEIGHTS.dress
            + breakdown.formationSize * AUTO_MOVE_WEIGHTS.formationSize
            + breakdown.stackBreak * AUTO_MOVE_WEIGHTS.stackBreak
            + breakdown.recoilDeath * AUTO_MOVE_WEIGHTS.recoilDeath
            + breakdown.pinchRelief * AUTO_MOVE_WEIGHTS.pinchRelief
            + breakdown.reserveEntry * AUTO_MOVE_WEIGHTS.reserveEntry
            + breakdown.advance * AUTO_MOVE_WEIGHTS.advance
            + breakdown.cohesion * AUTO_MOVE_WEIGHTS.cohesion
            + breakdown.terrain * AUTO_MOVE_WEIGHTS.terrain
        );
        return { total, breakdown };
    }

    function formatBreakdownValue(label, value) {
        if (Math.abs(value) <= 0.05) {
            return null;
        }
        return `${label} ${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
    }

    function scoreReserveEntry(beforeUnits, afterUnits, movedUnitIds) {
        return movedUnitIds.reduce((sum, unitId) => {
            const before = beforeUnits.find((unit) => unit.id === unitId);
            const after = afterUnits.find((unit) => unit.id === unitId);
            if (!before && after && !after.inReserve) {
                return sum + 0.6;
            }
            return sum;
        }, 0);
    }

    function scoreAdvance(beforeUnits, afterUnits, movedUnitIds, activePlayerId, enemyPlayerId, getPlayerId) {
        const enemyCentroid = getPlayerCentroid(beforeUnits, enemyPlayerId, getPlayerId);
        if (!enemyCentroid || movedUnitIds.length === 0) {
            return 0;
        }
        return movedUnitIds.reduce((sum, unitId) => {
            const before = beforeUnits.find((unit) => unit.id === unitId);
            const after = afterUnits.find((unit) => unit.id === unitId);
            if (!before || !after) {
                return sum;
            }
            const beforeDistance = geometry.distance(geometry.getUnitCenter(before), enemyCentroid);
            const afterDistance = geometry.distance(geometry.getUnitCenter(after), enemyCentroid);
            return sum + ((beforeDistance - afterDistance) / 100);
        }, 0);
    }

    function meanFriendlySpread(units, activePlayerId, getPlayerId) {
        const centroid = getPlayerCentroid(units, activePlayerId, getPlayerId);
        const owned = units.filter((unit) => getPlayerId(unit) === activePlayerId && !unit.inReserve);
        if (!centroid || owned.length === 0) {
            return 0;
        }
        const total = owned.reduce((sum, unit) => (
            sum + geometry.distance(geometry.getUnitCenter(unit), centroid)
        ), 0);
        return total / owned.length;
    }

    function scoreCohesion(beforeUnits, afterUnits, activePlayerId, getPlayerId) {
        const beforeSpread = meanFriendlySpread(beforeUnits, activePlayerId, getPlayerId);
        const afterSpread = meanFriendlySpread(afterUnits, activePlayerId, getPlayerId);
        return (beforeSpread - afterSpread) / 100;
    }

    function scoreTerrain(beforeUnits, afterUnits, movedUnitIds, terrain) {
        if (movedUnitIds.length === 0) {
            return 0;
        }
        const delta = movedUnitIds.reduce((sum, unitId) => {
            const before = beforeUnits.find((unit) => unit.id === unitId);
            const after = afterUnits.find((unit) => unit.id === unitId);
            if (!before || !after) {
                return sum;
            }
            const prefersBad = Boolean(data.UNIT_TYPES[before.type]?.combat?.ignoresBadGoingPenalty);
            const beforeSeverity = rules.severityFromTerrain(rules.sampleUnitTerrain(before, terrain));
            const afterSeverity = rules.severityFromTerrain(rules.sampleUnitTerrain(after, terrain));
            return sum + (prefersBad ? (afterSeverity - beforeSeverity) * 0.5 : (beforeSeverity - afterSeverity));
        }, 0);
        return delta / movedUnitIds.length;
    }

    function describeCandidateGroup(unitIds, units) {
        const selected = unitIds
            .map((unitId) => units.find((unit) => unit.id === unitId))
            .filter(Boolean);
        if (selected.length === 0) {
            return unitIds.join(', ');
        }
        const primary = selected[0];
        return selected.length > 1 ? `${primary.type} (${selected.length})` : primary.type;
    }

    function yieldToBrowser() {
        return new Promise((resolve) => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => resolve());
                return;
            }
            setTimeout(resolve, 0);
        });
    }

    function scoreCandidateGroup(context, group, forwardCache) {
        return simulateMoveCandidate(context, { ...group, moveKind: 'forward', moveParam: null }, forwardCache);
    }

    function findBestAutoMove(context) {
        const candidates = collectExtendedMoveCandidates(context);
        const forwardCache = new Map();
        let best = null;

        candidates.forEach((candidate) => {
            const scored = simulateMoveCandidate(context, candidate, forwardCache);
            if (!scored) {
                return;
            }
            if (!best || scored.score > best.score) {
                best = scored;
            }
        });

        if (!best || best.score < MIN_BENEFIT) {
            return null;
        }
        return best;
    }

    async function findBestAutoMoveAsync(context, hooks = {}) {
        const {
            shouldCancel,
            onProgress,
            yieldEvery = 6
        } = hooks;
        const candidates = collectExtendedMoveCandidates(context);
        const forwardCache = new Map();
        let best = null;

        onProgress?.({
            phase: 'searching',
            message: `Evaluating ${candidates.length} candidate move${candidates.length === 1 ? '' : 's'}…`,
            current: 0,
            total: candidates.length
        });
        await yieldToBrowser();
        if (shouldCancel?.()) {
            return { cancelled: true, suggestion: null };
        }

        for (let index = 0; index < candidates.length; index += 1) {
            if (shouldCancel?.()) {
                return { cancelled: true, suggestion: null };
            }

            const candidate = candidates[index];
            const moveLabel = candidate.moveKind === 'forward'
                ? describeCandidateGroup(candidate.unitIds, context.units)
                : `${describeCandidateGroup(candidate.unitIds, context.units)} ${candidate.moveKind}`;
            onProgress?.({
                phase: 'evaluating',
                message: `Scoring ${moveLabel} (${index + 1}/${candidates.length})`,
                current: index + 1,
                total: candidates.length,
                bestScore: best?.score ?? null
            });

            const scored = simulateMoveCandidate(context, candidate, forwardCache);
            if (scored && (!best || scored.score > best.score)) {
                best = scored;
            }

            if (index % yieldEvery === yieldEvery - 1 || index === candidates.length - 1) {
                await yieldToBrowser();
            }
        }

        if (!best || best.score < MIN_BENEFIT) {
            return { cancelled: false, suggestion: null };
        }
        return { cancelled: false, suggestion: best };
    }

    function describeDraftInvalidReasons(draft) {
        if (!draft) {
            return [];
        }
        return [...draft.unitIds].map((unitId) => ({
            unitId,
            reason: draft.reasonById?.get(unitId) || null,
            invalid: draft.invalidIds?.has(unitId) || false
        })).filter((entry) => entry.invalid || entry.reason);
    }

    function describeAutoMoveUnits(unitIds, units) {
        return unitIds.map((unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (!unit) {
                return unitId;
            }
            return `${unit.type} (${unitId})`;
        });
    }

    function describeAutoMoveSuggestion(suggestion, units) {
        return {
            unitIds: [...suggestion.unitIds],
            units: describeAutoMoveUnits(suggestion.unitIds, units),
            formationType: suggestion.analysis.type,
            moveKind: suggestion.moveKind || 'forward',
            moveParam: suggestion.moveParam ?? null,
            distanceMm: Math.round(suggestion.distance || 0),
            score: suggestion.score,
            breakdown: { ...suggestion.breakdown }
        };
    }

    function describeAutoMoveAction(suggestion) {
        const moveKind = suggestion.moveKind || 'forward';
        if (moveKind === 'forward') {
            return `forward ${Math.round(suggestion.distance || 0)} mm`;
        }
        if (moveKind === 'reverse') {
            return 'reverse';
        }
        if (moveKind === 'convert') {
            return 'convert';
        }
        if (moveKind === 'wheel-left' || moveKind === 'wheel-right') {
            const degrees = Math.round(((suggestion.moveParam || 0) * 180) / Math.PI);
            return `wheel ${degrees}° ${moveKind === 'wheel-left' ? 'left' : 'right'}`;
        }
        if (moveKind === 'reserve-deploy') {
            return 'reserve deploy';
        }
        return moveKind;
    }

    function formatAutoMoveStatus(suggestion, units) {
        const primary = units.find((unit) => unit.id === suggestion.unitIds[0]);
        const typeLabel = primary?.type || 'Unit';
        const countLabel = suggestion.unitIds.length > 1 ? ` (${suggestion.unitIds.length})` : '';
        const parts = [
            formatBreakdownValue('fight', suggestion.breakdown.fight),
            formatBreakdownValue('matchup', suggestion.breakdown.matchup),
            formatBreakdownValue('mods', suggestion.breakdown.modifiers),
            formatBreakdownValue('contact', suggestion.breakdown.newContact),
            formatBreakdownValue('dress', suggestion.breakdown.dress),
            formatBreakdownValue('formation', suggestion.breakdown.formationSize),
            formatBreakdownValue('stack', suggestion.breakdown.stackBreak),
            formatBreakdownValue('recoil', suggestion.breakdown.recoilDeath),
            formatBreakdownValue('pinch', suggestion.breakdown.pinchRelief),
            formatBreakdownValue('advance', suggestion.breakdown.advance),
            formatBreakdownValue('cohesion', suggestion.breakdown.cohesion),
            formatBreakdownValue('terrain', suggestion.breakdown.terrain)
        ].filter(Boolean);
        return `Auto Move: ${typeLabel}${countLabel} ${describeAutoMoveAction(suggestion)} (${parts.join(', ')}).`;
    }

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            openAutoMoveModal(message) {
                this.state.autoMoveModalOpen = true;
                this.state.autoMoveInProgress = true;
                this.state.autoMoveAwaitingAck = false;
                if (this.ui.autoMoveTitle) {
                    this.ui.autoMoveTitle.textContent = 'Auto Move';
                }
                if (this.ui.autoMoveProgressText) {
                    this.ui.autoMoveProgressText.textContent = message || 'Preparing auto move…';
                }
                if (this.ui.autoMoveModal) {
                    this.ui.autoMoveModal.hidden = false;
                }
                this.syncUiFromState();
            },

            updateAutoMoveProgress(info) {
                if (this.ui.autoMoveProgressText && info?.message) {
                    this.ui.autoMoveProgressText.textContent = info.message;
                }
            },

            showAutoMoveNoMovesAcknowledgement() {
                this.state.autoMoveInProgress = false;
                this.state.autoMoveAwaitingAck = true;
                this._autoMoveCancelToken = null;
                if (this.ui.autoMoveTitle) {
                    this.ui.autoMoveTitle.textContent = 'No Good Move';
                }
                if (this.ui.autoMoveProgressText) {
                    this.ui.autoMoveProgressText.textContent = 'No beneficial forward move was found for any unmoved formation. Move manually or end the move phase when ready.';
                }
                this.syncUiFromState();
            },

            acknowledgeAutoMoveModal() {
                if (!this.state.autoMoveAwaitingAck) {
                    return;
                }
                this.state.autoMoveAwaitingAck = false;
                this.closeAutoMoveModal();
                this.updateStatus('Auto Move: no beneficial forward move found.');
                this.syncUiFromState();
                this.requestRender();
            },

            closeAutoMoveModal() {
                this.state.autoMoveModalOpen = false;
                this.state.autoMoveInProgress = false;
                this.state.autoMoveAwaitingAck = false;
                this._autoMoveCancelToken = null;
                if (this.ui.autoMoveModal) {
                    this.ui.autoMoveModal.hidden = true;
                }
                this.syncUiFromState();
            },

            cancelAutoMoveSearch() {
                if (this._autoMoveCancelToken) {
                    this._autoMoveCancelToken.cancelled = true;
                }
                this.updateAutoMoveProgress({ message: 'Cancelling…' });
            },

            maybeClearAutoMoveGhost() {
                const ghost = this.state.autoMoveGhost;
                if (!ghost) {
                    return;
                }
                if (!geometry.sameIdSet(this.state.selectedIds, ghost.unitIds)) {
                    this.state.autoMoveGhost = null;
                    this.requestRender();
                }
            },

            async autoMove() {
                if (this.state.autoMoveInProgress) {
                    return;
                }
                if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                    this.updateStatus('Auto Move is only available during the move phase.');
                    return;
                }
                if (typeof this.isGameOver === 'function' && this.isGameOver()) {
                    this.updateStatus('Auto Move is unavailable after the battle ends.');
                    return;
                }
                if (this.state.remainingMoves <= 0) {
                    this.updateStatus('No moves remain for the active side.');
                    return;
                }

                const startedAt = (typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now();
                const cancelToken = { cancelled: false };
                this._autoMoveCancelToken = cancelToken;

                this.openAutoMoveModal('Gathering candidate formations…');
                await yieldToBrowser();

                const candidateGroups = collectExtendedMoveCandidates({
                    units: this.state.units,
                    terrain: this.state.terrain,
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    getPlayerId: (unit) => this.getUnitPlayerId(unit),
                    reserveUnits: this.getReserveUnits(),
                    getHomeEdge: (playerId) => this.getHomeEdge(playerId)
                });
                console.log('[Auto Move] start', {
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    snapEnabled: this.state.snapEnabled,
                    candidateGroups: candidateGroups.length,
                    unmovedUnits: this.state.units.filter((unit) => (
                        this.getUnitPlayerId(unit) === this.state.activePlayerId
                        && !unit.movedThisTurn
                        && !unit.inReserve
                    )).map((unit) => `${unit.type} (${unit.id})`)
                });

                this.cancelDraft(false);

                const searchContext = {
                    units: this.state.units,
                    terrain: this.state.terrain,
                    activePlayerId: this.state.activePlayerId,
                    remainingMoves: this.state.remainingMoves,
                    getPlayerId: (unit) => this.getUnitPlayerId(unit),
                    snapEnabled: this.state.snapEnabled,
                    reserveUnits: this.getReserveUnits(),
                    getHomeEdge: (playerId) => this.getHomeEdge(playerId)
                };

                const searchResult = await findBestAutoMoveAsync(searchContext, {
                    shouldCancel: () => cancelToken.cancelled,
                    onProgress: (info) => this.updateAutoMoveProgress(info)
                });

                const searchElapsedMs = ((typeof performance !== 'undefined' && performance.now)
                    ? performance.now()
                    : Date.now()) - startedAt;
                console.log('[Auto Move] search complete', {
                    elapsedMs: Math.round(searchElapsedMs),
                    candidateGroups: candidateGroups.length,
                    found: Boolean(searchResult.suggestion),
                    cancelled: searchResult.cancelled
                });

                if (searchResult.cancelled) {
                    console.log('[Auto Move] end', { result: 'cancelled', elapsedMs: Math.round(searchElapsedMs) });
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move cancelled.');
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }

                const suggestion = searchResult.suggestion;
                if (!suggestion) {
                    console.log('[Auto Move] end', {
                        result: 'no-move',
                        reason: 'no beneficial forward move found',
                        elapsedMs: Math.round(searchElapsedMs)
                    });
                    this.showAutoMoveNoMovesAcknowledgement();
                    return;
                }

                console.log('[Auto Move] planned', describeAutoMoveSuggestion(suggestion, this.state.units));
                this.state.autoMovePreview = {
                    afterUnits: suggestion.afterUnits.map((unit) => ({ ...unit })),
                    unitIds: [...suggestion.unitIds]
                };
                this.updateAutoMoveProgress({ message: 'Previewing the best move…' });
                this.requestRender();
                await yieldToBrowser();

                if (cancelToken.cancelled) {
                    this.state.autoMovePreview = null;
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move cancelled.');
                    return;
                }

                this.updateAutoMoveProgress({ message: 'Applying the best move…' });
                await yieldToBrowser();

                if (cancelToken.cancelled) {
                    this.state.autoMovePreview = null;
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move cancelled.');
                    return;
                }

                this.state.autoMovePreview = null;

                if (suggestion.moveKind === 'reserve-deploy') {
                    const reserveUnit = this.getReserveUnits().find((entry) => entry.id === suggestion.reserveUnitId);
                    if (!reserveUnit || !this.beginReserveDeploy(reserveUnit, suggestion.moveParam)) {
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: reserve deployment could not be started.');
                        this.syncUiFromState();
                        return;
                    }
                    this.finishDraft();
                    this.closeAutoMoveModal();
                    this.updateStatus(formatAutoMoveStatus(suggestion, this.state.units));
                    this.syncUiFromState();
                    this.requestRender();
                    return;
                }

                this.state.selectedIds = [...suggestion.unitIds];
                this.updateSelectionAnalysis();
                if (!this.ensureDraft(suggestion.unitIds)) {
                    console.log('[Auto Move] end', {
                        result: 'failed',
                        reason: 'could not start draft',
                        planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                        elapsedMs: Math.round(searchElapsedMs)
                    });
                    this.closeAutoMoveModal();
                    this.updateStatus('Auto Move: could not start the suggested draft.');
                    this.syncUiFromState();
                    return;
                }

                const ghostSnapshot = geometry.snapshotPositions(suggestion.unitIds, this.state.units);

                if (suggestion.moveKind === 'forward') {
                    const actualDistance = this.findMaxForwardDistance();
                    if (actualDistance === null || actualDistance <= 0.05) {
                        const invalidReasons = describeDraftInvalidReasons(this.state.draft);
                        this.cancelDraft(false);
                        console.log('[Auto Move] end', {
                            result: 'failed',
                            reason: 'no legal forward distance after opening draft',
                            planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                            simulatedDistanceMm: Math.round(suggestion.distance),
                            actualDistance,
                            invalidReasons,
                            elapsedMs: Math.round(searchElapsedMs)
                        });
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: the suggested move is not legal on the board.');
                        this.syncUiFromState();
                        return;
                    }

                    const appliedDistance = Math.min(suggestion.distance, actualDistance);
                    if (appliedDistance < suggestion.distance - 0.05) {
                        console.log('[Auto Move] distance clamped', {
                            plannedDistanceMm: Math.round(suggestion.distance),
                            actualDistanceMm: Math.round(actualDistance),
                            appliedDistanceMm: Math.round(appliedDistance)
                        });
                    }

                    const applied = this.applyForwardMove(appliedDistance);
                    if (!applied) {
                        const invalidReasons = describeDraftInvalidReasons(this.state.draft);
                        this.cancelDraft(false);
                        console.log('[Auto Move] end', {
                            result: 'failed',
                            reason: 'applyForwardMove rejected the planned distance',
                            planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                            simulatedDistanceMm: Math.round(suggestion.distance),
                            actualDistanceMm: Math.round(actualDistance),
                            appliedDistanceMm: Math.round(appliedDistance),
                            invalidReasons,
                            elapsedMs: Math.round(searchElapsedMs)
                        });
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: the suggested move could not be applied.');
                        this.syncUiFromState();
                        return;
                    }
                    suggestion.distance = appliedDistance;
                } else {
                    suggestion.unitIds.forEach((unitId) => {
                        const trialUnit = suggestion.afterUnits.find((entry) => entry.id === unitId);
                        const liveUnit = this.getUnitById(unitId);
                        if (trialUnit && liveUnit) {
                            liveUnit.x = trialUnit.x;
                            liveUnit.y = trialUnit.y;
                            liveUnit.rotation = trialUnit.rotation;
                        }
                    });
                    this.evaluateDraft();
                    if (this.state.draft.invalidIds.size > 0) {
                        const invalidReasons = describeDraftInvalidReasons(this.state.draft);
                        this.cancelDraft(false);
                        console.log('[Auto Move] end', {
                            result: 'failed',
                            reason: 'simulated alternate move rejected on apply',
                            planned: describeAutoMoveSuggestion(suggestion, this.state.units),
                            invalidReasons,
                            elapsedMs: Math.round(searchElapsedMs)
                        });
                        this.closeAutoMoveModal();
                        this.updateStatus('Auto Move: the suggested move could not be applied.');
                        this.syncUiFromState();
                        return;
                    }
                    if (suggestion.moveKind !== 'reverse' || suggestion.analysis.type !== 'single') {
                        this.commitDraftStep();
                    }
                }

                this.finishDraft();
                this.state.autoMoveGhost = {
                    unitIds: [...suggestion.unitIds],
                    ghostSnapshot
                };
                console.log('[Auto Move] end', {
                    result: 'success',
                    moved: describeAutoMoveSuggestion(suggestion, this.state.units),
                    remainingMoves: this.state.remainingMoves,
                    elapsedMs: Math.round(((typeof performance !== 'undefined' && performance.now)
                        ? performance.now()
                        : Date.now()) - startedAt),
                    movedThisTurn: suggestion.unitIds.map((unitId) => {
                        const unit = this.getUnitById(unitId);
                        return {
                            id: unitId,
                            type: unit?.type || null,
                            movedThisTurn: Boolean(unit?.movedThisTurn)
                        };
                    })
                });
                this.closeAutoMoveModal();
                this.updateStatus(formatAutoMoveStatus(suggestion, this.state.units));
                this.syncUiFromState();
                this.requestRender();
            }
        });
    }

    return {
        AUTO_MOVE_WEIGHTS,
        MIN_BENEFIT,
        collectMoveCandidateGroups,
        collectExtendedMoveCandidates,
        findMaxForwardDistance,
        findBestAutoMove,
        findBestAutoMoveAsync,
        simulateMoveCandidate,
        scoreCandidate,
        scoreFightQuality,
        scoreFormationSupport,
        scoreRecoilRisk,
        scoreAdvance,
        install
    };
}));
