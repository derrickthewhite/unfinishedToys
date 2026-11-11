(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('./core.js'),
            require('./terrain.js'),
            require('./melee.js'),
            require('./recoil.js')
        );
        return;
    }
    root.HordesRulesShooting = factory(root.HordesData, root.HordesGeometry, root.HordesRulesCore, root.HordesRulesTerrain, root.HordesRulesMelee, root.HordesRulesRecoil);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, core, terrain, melee, recoil) {
    const {
        normalizePlayerId,
        getPlayerId,
        getUnitSides,
        getSideByName,
        sideMidpoint,
        cloneUnit,
        isEnsorcellableType,
        buildEnsorcelledUnit
    } = core;

    const {
        ROUGH_TERRAIN_TYPES,
        getTerrainTypeAt,
        isUnitInBadGoing
    } = terrain;

    const {
        getCombatModifiers,
        getExtraShooterPenalty,
        getMinorLossResolution,
        resolveCombatLoss,
        getUnitStrengthAgainst,
        choosePrimaryAttacker,
        sumModifiers
    } = melee;

    const {
        resolveRecoil,
        resolveFlee
    } = recoil;
    function isRangedUnit(unit) {
        return Boolean(unit && unit.ranged && unit.ranged.phase === 'shooting');
    }


    function isMagicianUnit(unit) {
        return Boolean(unit && unit.type === 'Magician');
    }


    function getMoveCost(unit) {
        if (unit?.combat?.stationary) {
            return Infinity;
        }
        return unit?.combat?.moveCost || 1;
    }


    function getAttackDeclareCost(unit) {
        return unit?.combat?.attackDeclareCost || 0;
    }


    function getDraftMoveCost(unitIds, units) {
        return unitIds.some((unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            return getMoveCost(unit) > 1;
        }) ? data.MAGICIAN_MOVE_COST : 1;
    }


    function getBaseEdgeDistance(left, right) {
        return geometry.unitsMinDistance(left, right);
    }


    function isMagicianSightLineBlocked(start, end, terrain) {
        return sampleSegmentTerrain(start, end, terrain).some((sample) => sample.kind === 'impassable');
    }


    function canUnitShoot(unit, activePlayerId, options) {
        if (!isRangedUnit(unit)) {
            return false;
        }
        if (unit.ranged.requiresOwnTurn && activePlayerId && getPlayerId(unit) !== normalizePlayerId(activePlayerId)) {
            return false;
        }
        if (!options?.allowAlreadyAttacked && unit.attackedThisTurn) {
            return false;
        }
        if (isMagicianUnit(unit)) {
            return !unit.ranged.requiresStationary || !unit.movedThisTurn;
        }
        return !unit.ranged.requiresStationary || !unit.movedThisTurn;
    }


    function getOutwardEdgeNormal(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length <= Number.EPSILON) {
            return { x: 0, y: 0 };
        }
        return { x: dy / length, y: -dx / length };
    }


    function getMagicianRangedArea(unit) {
        const range = unit.ranged.range;
        const vertices = geometry.cornersToPoints(geometry.getUnitCorners(unit));
        const corners = vertices.map((vertex, index) => {
            const prev = vertices[(index - 1 + vertices.length) % vertices.length];
            const next = vertices[(index + 1) % vertices.length];
            const normalIn = getOutwardEdgeNormal(prev, vertex);
            const normalOut = getOutwardEdgeNormal(vertex, next);
            return {
                vertex,
                arcStart: geometry.add(vertex, geometry.scaleVector(normalIn, range)),
                arcEnd: geometry.add(vertex, geometry.scaleVector(normalOut, range))
            };
        });
        return {
            kind: 'offset-rect',
            range,
            corners
        };
    }


    function getRangedArea(unit) {
        if (!isRangedUnit(unit)) {
            return null;
        }
        if (isMagicianUnit(unit) || unit.ranged?.magician) {
            return getMagicianRangedArea(unit);
        }
        const corners = geometry.getUnitCorners(unit);
        const frontMid = geometry.midpoint(corners.frontLeft, corners.frontRight);
        const right = geometry.getRightVector(unit.rotation);
        const forward = geometry.getForwardVector(unit.rotation);
        const width = unit.ranged.width || data.SHOOTING_BOX_WIDTH;
        const nearLeft = geometry.add(frontMid, geometry.scaleVector(right, -width / 2));
        const nearRight = geometry.add(frontMid, geometry.scaleVector(right, width / 2));
        const farLeft = geometry.add(nearLeft, geometry.scaleVector(forward, unit.ranged.range));
        const farRight = geometry.add(nearRight, geometry.scaleVector(forward, unit.ranged.range));
        return {
            kind: 'box',
            nearLeft,
            nearRight,
            farRight,
            farLeft
        };
    }


    function getNearestTargetSide(attacker, target) {
        let origin;
        if (isMagicianUnit(attacker)) {
            const corners = geometry.getUnitCorners(attacker);
            origin = geometry.midpoint(corners.frontLeft, corners.frontRight);
        } else {
            const attackerArea = getRangedArea(attacker);
            origin = attackerArea?.kind === 'box'
                ? geometry.midpoint(attackerArea.nearLeft, attackerArea.nearRight)
                : geometry.getUnitCenter(attacker);
        }
        const sides = geometry.hasOutline(target)
            ? geometry.getUnitFootprintPoints(target).map((start, index, points) => ({
                name: 'outline',
                start,
                end: points[(index + 1) % points.length]
            }))
            : getUnitSides(target);
        return sides.reduce((best, side) => {
            const distance = geometry.distancePointToSegment(origin, side.start, side.end);
            if (!best || distance < best.distance) {
                return { ...side, distance };
            }
            return best;
        }, null);
    }


    function pointToLocal(point, origin, right, forward) {
        const delta = geometry.subtract(point, origin);
        return {
            u: geometry.dot(delta, right),
            v: geometry.dot(delta, forward)
        };
    }


    function segmentIntersectsBox(start, end, box) {
        let t0 = 0;
        let t1 = 1;
        const dx = end.u - start.u;
        const dy = end.v - start.v;
        const tests = [
            [-dx, start.u - box.minU],
            [dx, box.maxU - start.u],
            [-dy, start.v - box.minV],
            [dy, box.maxV - start.v]
        ];
        for (const [p, q] of tests) {
            if (Math.abs(p) <= Number.EPSILON) {
                if (q < 0) {
                    return false;
                }
                continue;
            }
            const ratio = q / p;
            if (p < 0) {
                t0 = Math.max(t0, ratio);
            } else {
                t1 = Math.min(t1, ratio);
            }
            if (t0 > t1) {
                return false;
            }
        }
        return true;
    }


    function isTargetInRangedArea(attacker, target) {
        if (!isRangedUnit(attacker) || getPlayerId(attacker) === getPlayerId(target)) {
            return false;
        }
        const nearestSide = getNearestTargetSide(attacker, target);
        if (!nearestSide) {
            return false;
        }
        const shooterCorners = geometry.getUnitCorners(attacker);
        const frontMid = geometry.midpoint(shooterCorners.frontLeft, shooterCorners.frontRight);
        const right = geometry.getRightVector(attacker.rotation);
        const forward = geometry.getForwardVector(attacker.rotation);
        const localStart = pointToLocal(nearestSide.start, frontMid, right, forward);
        const localEnd = pointToLocal(nearestSide.end, frontMid, right, forward);
        return segmentIntersectsBox(localStart, localEnd, {
            minU: -attacker.ranged.width / 2,
            maxU: attacker.ranged.width / 2,
            minV: 0,
            maxV: attacker.ranged.range
        });
    }


    function buildSightLines(attacker, target) {
        const shooterCorners = geometry.getUnitCorners(attacker);
        const nearestSide = getNearestTargetSide(attacker, target);
        const frontMid = geometry.midpoint(shooterCorners.frontLeft, shooterCorners.frontRight);
        const targetMid = sideMidpoint(nearestSide);
        return [
            { start: shooterCorners.frontLeft, end: nearestSide.start },
            { start: frontMid, end: targetMid },
            { start: shooterCorners.frontRight, end: nearestSide.end }
        ];
    }


    function sampleSegmentTerrain(start, end, terrain) {
        const length = geometry.distance(start, end);
        const steps = Math.max(2, Math.ceil(length / 2));
        const samples = [];
        for (let step = 1; step < steps; step += 1) {
            const ratio = step / steps;
            const point = geometry.lerpPoint(start, end, ratio);
            samples.push({
                point,
                distanceFromStart: length * ratio,
                distanceFromEnd: length * (1 - ratio),
                kind: getTerrainTypeAt(point, terrain)
            });
        }
        return samples;
    }


    function isSightLineBlocked(start, end, attacker, target, units, terrain) {
        const ignoreIds = new Set([attacker.id, target.id]);
        const blockingUnit = units.find((unit) => !ignoreIds.has(unit.id) && geometry.segmentIntersectsPolygon(start, end, geometry.getUnitFootprintPoints(unit)));
        if (blockingUnit) {
            return true;
        }

        const roughAllowance = data.pacesToMm(data.ROUGH_LOS_ALLOWANCE_PACES);
        const startRoughAllowance = isUnitInBadGoing(attacker, terrain) ? roughAllowance : 0;
        const endRoughAllowance = isUnitInBadGoing(target, terrain) ? roughAllowance : 0;
        const samples = sampleSegmentTerrain(start, end, terrain);
        return samples.some((sample) => {
            if (sample.kind === 'impassable') {
                return true;
            }
            if (!ROUGH_TERRAIN_TYPES.has(sample.kind)) {
                return false;
            }
            return sample.distanceFromStart > startRoughAllowance + 0.5 && sample.distanceFromEnd > endRoughAllowance + 0.5;
        });
    }


    function hasAnyFrontContact(left, right) {
        const leftFront = getSideByName(left, 'front');
        const rightFront = getSideByName(right, 'front');
        return getUnitSides(right).some((side) => geometry.segmentsIntersect(leftFront.start, leftFront.end, side.start, side.end))
            || getUnitSides(left).some((side) => geometry.segmentsIntersect(rightFront.start, rightFront.end, side.start, side.end));
    }


    function isUnitEngagedForShooting(unit, units) {
        if (!unit) {
            return false;
        }
        return units.some((otherUnit) => {
            if (!otherUnit || otherUnit.id === unit.id || getPlayerId(otherUnit) === getPlayerId(unit)) {
                return false;
            }
            return hasAnyFrontContact(unit, otherUnit);
        });
    }


    function isValidMagicianAttack(attacker, target, units, terrain, activePlayerId, options) {
        if (!attacker || !target || getPlayerId(attacker) === getPlayerId(target) || !canUnitShoot(attacker, activePlayerId, options)) {
            return false;
        }
        if (!isMagicianUnit(attacker)) {
            return false;
        }
        if (isUnitEngagedForShooting(attacker, units)) {
            return false;
        }
        if (getBaseEdgeDistance(attacker, target) > attacker.ranged.range + 0.5) {
            return false;
        }
        const shooterCorners = geometry.getUnitCorners(attacker);
        const frontMid = geometry.midpoint(shooterCorners.frontLeft, shooterCorners.frontRight);
        const nearestSide = getNearestTargetSide(attacker, target);
        if (!nearestSide) {
            return false;
        }
        const targetMid = sideMidpoint(nearestSide);
        return !isMagicianSightLineBlocked(frontMid, targetMid, terrain);
    }


    function isValidShootingAttack(attacker, target, units, terrain, activePlayerId, options) {
        if (!attacker || !target || getPlayerId(attacker) === getPlayerId(target) || !canUnitShoot(attacker, activePlayerId, options)) {
            return false;
        }
        if (isMagicianUnit(attacker)) {
            return isValidMagicianAttack(attacker, target, units, terrain, activePlayerId, options);
        }
        if (isUnitEngagedForShooting(attacker, units)) {
            return false;
        }
        if (!isTargetInRangedArea(attacker, target)) {
            return false;
        }
        const sightLines = buildSightLines(attacker, target);
        return sightLines.some((line) => !isSightLineBlocked(line.start, line.end, attacker, target, units, terrain));
    }


    function getValidShootingTargets(attacker, units, terrain, activePlayerId, options) {
        if (!canUnitShoot(attacker, activePlayerId, options)) {
            return [];
        }
        return units
            .filter((unit) => getPlayerId(unit) !== getPlayerId(attacker))
            .filter((unit) => isValidShootingAttack(attacker, unit, units, terrain, activePlayerId, options))
            .map((unit) => unit.id);
    }


    function buildShootingExchanges(attacksByTarget) {
        const exchanges = [];
        const consumed = new Set();
        attacksByTarget.forEach((attackerIds, targetId) => {
            if (consumed.has(targetId)) {
                return;
            }
            const partnerId = attackerIds.find((attackerId) => (attacksByTarget.get(attackerId) || []).includes(targetId));
            if (!partnerId) {
                exchanges.push({
                    mutual: false,
                    attackerIds: [...attackerIds],
                    defenderId: targetId,
                    returnShooterIds: [],
                    returnTargetId: null
                });
                consumed.add(targetId);
                return;
            }
            exchanges.push({
                mutual: true,
                attackerIds: [...attackerIds],
                defenderId: targetId,
                returnShooterIds: [...(attacksByTarget.get(partnerId) || [])],
                returnTargetId: partnerId
            });
            consumed.add(targetId);
            consumed.add(partnerId);
        });
        return exchanges;
    }


    function resolveShooting(units, declarations, terrain, rollDie, activePlayerId) {
        const baseUnits = units.map(cloneUnit);
        const attacksByTarget = new Map();
        Object.entries(declarations || {}).forEach(([attackerId, targetId]) => {
            const attacker = baseUnits.find((unit) => unit.id === attackerId);
            const target = baseUnits.find((unit) => unit.id === targetId);
            if (!attacker || !target || !isValidShootingAttack(attacker, target, baseUnits, terrain, activePlayerId, { allowAlreadyAttacked: true })) {
                return;
            }
            if (!attacksByTarget.has(targetId)) {
                attacksByTarget.set(targetId, []);
            }
            attacksByTarget.get(targetId).push(attackerId);
        });

        const exchanges = buildShootingExchanges(attacksByTarget);
        const results = [];
        const recoilDestructions = [];
        exchanges.forEach((exchange) => {
            const defender = baseUnits.find((unit) => unit.id === exchange.defenderId);
            const attackers = exchange.attackerIds
                .map((attackerId) => baseUnits.find((unit) => unit.id === attackerId))
                .filter(Boolean);
            const returnShooters = exchange.returnShooterIds
                .map((shooterId) => baseUnits.find((unit) => unit.id === shooterId))
                .filter(Boolean);
            if (!defender || attackers.length === 0) {
                return;
            }
            const primaryAttacker = choosePrimaryAttacker(attackers, defender);
            const returnOpponent = exchange.mutual
                ? (baseUnits.find((unit) => unit.id === exchange.returnTargetId) || primaryAttacker)
                : primaryAttacker;
            const returnPrimary = exchange.mutual
                ? choosePrimaryAttacker(returnShooters, returnOpponent)
                : defender;
            const attackerModifiers = getCombatModifiers({
                phase: 'shooting',
                role: 'attacker',
                unit: primaryAttacker,
                opponent: defender,
                attackers,
                terrain,
                shotAtUnit: exchange.mutual ? returnOpponent : null
            });
            const defenderModifiers = getCombatModifiers({
                phase: 'shooting',
                role: 'defender',
                unit: exchange.mutual ? returnPrimary : defender,
                opponent: exchange.mutual ? returnOpponent : primaryAttacker,
                attackers,
                terrain,
                shotAtUnit: defender
            });
            if (exchange.mutual && returnShooters.length > 1) {
                const penalty = getExtraShooterPenalty(returnShooters.length);
                if (penalty > 0) {
                    const extras = returnShooters.filter((unit) => unit.id !== returnPrimary.id).slice(0, penalty);
                    attackerModifiers.push({
                        id: 'multiple-shooters',
                        value: -penalty,
                        label: 'Multiple shooters',
                        sources: extras.map((unit) => ({ unitId: unit.id, value: -1 }))
                    });
                }
            }
            const attackerRoll = rollDie({ role: 'attacker', attackerIds: exchange.attackerIds, primaryAttackerId: primaryAttacker.id, defenderId: defender.id });
            const defenderRoll = rollDie({ role: 'defender', attackerIds: exchange.attackerIds, primaryAttackerId: primaryAttacker.id, defenderId: returnPrimary.id });
            const attackerTotal = attackerRoll + getUnitStrengthAgainst(primaryAttacker, defender) + sumModifiers(attackerModifiers);
            const defenderTotal = defenderRoll + getUnitStrengthAgainst(returnPrimary, exchange.mutual ? returnOpponent : primaryAttacker) + sumModifiers(defenderModifiers);
            const result = {
                attackerIds: exchange.attackerIds,
                primaryAttackerId: primaryAttacker.id,
                defenderId: defender.id,
                returnPrimaryId: returnPrimary.id,
                mutual: exchange.mutual,
                returnTargetId: exchange.returnTargetId,
                attackerRoll,
                defenderRoll,
                attackerModifiers,
                defenderModifiers,
                attackerTotal,
                defenderTotal,
                outcome: 'tie',
                loserId: null,
                destructionRule: null
            };
            if (attackerTotal === defenderTotal) {
                results.push(result);
                return;
            }
            const attackerWon = attackerTotal > defenderTotal;
            if (!attackerWon && !exchange.mutual) {
                result.outcome = 'no-effect';
                results.push(result);
                return;
            }
            const highTotal = Math.max(attackerTotal, defenderTotal);
            const lowTotal = Math.min(attackerTotal, defenderTotal);
            const winner = attackerWon ? primaryAttacker : returnPrimary;
            const loser = attackerWon
                ? defender
                : (baseUnits.find((unit) => unit.id === exchange.returnTargetId) || primaryAttacker);
            result.loserId = loser.id;
            result.winnerId = winner.id;
            const lossResolution = resolveCombatLoss(winner, loser, 'shooting', terrain, highTotal >= lowTotal * 2);
            result.outcome = lossResolution.outcome;
            result.destructionRule = lossResolution.destructionRule;
            results.push(result);
        });

        const destroyedIds = new Set();
        const ensorcelledIds = new Map();
        const recoils = [];
        let baseFellPlayerId = null;
        results.forEach((result) => {
            if (!result.loserId) {
                return;
            }
            if (result.outcome === 'destroy' || result.outcome === 'base-fall') {
                destroyedIds.add(result.loserId);
                if (result.outcome === 'base-fall') {
                    const loser = baseUnits.find((unit) => unit.id === result.loserId);
                    baseFellPlayerId = loser ? getPlayerId(loser) : baseFellPlayerId;
                }
                return;
            }
            if (result.outcome === 'ensorcel') {
                ensorcelledIds.set(result.loserId, result.winnerId);
                return;
            }
            if (result.outcome === 'recoil' || result.outcome === 'flee') {
                recoils.push({ unitId: result.loserId, flee: result.outcome === 'flee' });
            }
        });
        results.forEach((result) => {
            const attacker = baseUnits.find((unit) => unit.id === result.primaryAttackerId);
            if (attacker?.type === 'Magician' && result.attackerRoll === 1) {
                ensorcelledIds.set(attacker.id, null);
            }
            if (!result.mutual) {
                return;
            }
            const returnShooter = baseUnits.find((unit) => unit.id === result.defenderId);
            if (returnShooter?.type === 'Magician' && result.defenderRoll === 1) {
                ensorcelledIds.set(returnShooter.id, null);
            }
        });

        let mutableUnits = units.map(cloneUnit).filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id));
        recoils.forEach((entry) => {
            const unitId = entry.unitId;
            if (destroyedIds.has(unitId)) {
                return;
            }
            const recoil = resolveRecoil(unitId, mutableUnits, terrain);
            if (recoil.destroyedIds.length > 0) {
                recoil.destroyedIds.forEach((destroyedId) => {
                    recoilDestructions.push({
                        unitId: destroyedId,
                        reason: recoil.destructionReasons[destroyedId] || 'recoil destruction reason unavailable'
                    });
                });
                recoil.destroyedIds.forEach((destroyedId) => destroyedIds.add(destroyedId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = recoil.units;
            if (!entry.flee) {
                return;
            }
            const flee = resolveFlee(unitId, mutableUnits, terrain);
            if (flee.destroyedIds.length > 0) {
                flee.destroyedIds.forEach((destroyedId) => {
                    recoilDestructions.push({
                        unitId: destroyedId,
                        reason: flee.destructionReasons[destroyedId] || 'flee destruction reason unavailable'
                    });
                });
                flee.destroyedIds.forEach((destroyedId) => destroyedIds.add(destroyedId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = flee.units;
        });

        const destroyedUnits = units.filter((unit) => destroyedIds.has(unit.id)).map(cloneUnit);
        const ensorcelledUnits = [...ensorcelledIds.entries()].map(([unitId, ensorcelledByUnitId]) => {
            const unit = units.find((entry) => entry.id === unitId);
            return unit ? buildEnsorcelledUnit(unit, ensorcelledByUnitId) : null;
        }).filter(Boolean);
        return {
            units: mutableUnits.filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id)),
            destroyedUnits,
            ensorcelledUnits,
            results,
            recoilDestructions,
            baseFellPlayerId,
            attacksByTarget: Object.fromEntries(Array.from(attacksByTarget.entries()).map(([targetId, attackerIds]) => [targetId, [...attackerIds]]))
        };
    }


    return {
        isRangedUnit,
        isMagicianUnit,
        isEnsorcellableType,
        getMoveCost,
        getAttackDeclareCost,
        getDraftMoveCost,
        canUnitShoot,
        getRangedArea,
        getNearestTargetSide,
        isTargetInRangedArea,
        isValidShootingAttack,
        getValidShootingTargets,
        resolveShooting
    };
}));
