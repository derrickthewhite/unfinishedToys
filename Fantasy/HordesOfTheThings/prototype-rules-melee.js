(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules-core.js'),
            require('./prototype-rules-terrain.js'),
            require('./prototype-rules-recoil.js')
        );
        return;
    }
    root.HordesRulesMelee = factory(root.HordesData, root.HordesGeometry, root.HordesRulesCore, root.HordesRulesTerrain, root.HordesRulesRecoil);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, core, terrain, recoil) {
    const {
        getPlayerId,
        getUnitSides,
        getSideByName,
        sideMidpoint,
        hasMeaningfulSharedEdge,
        cloneUnit,
        buildEnsorcelledUnit,
        rotateUnitInPlace,
        sharesFormationContact
    } = core;

    const {
        isUnitInBadGoing
    } = terrain;

    const {
        resolveRecoil,
        resolveFlee,
        getRecoilBlockReason
    } = recoil;
    const STACKABLE_TYPES = new Set(['Spear', 'Warband']);

    function getUnitStrengthAgainst(unit, opponent) {
        return unit.strength[opponent.troopClass === 'mounted' ? 'mounted' : 'infantry'];
    }


    function choosePrimaryAttacker(attackers, defender) {
        return [...attackers].sort((left, right) => {
            const strengthDelta = getUnitStrengthAgainst(right, defender) - getUnitStrengthAgainst(left, defender);
            if (strengthDelta !== 0) {
                return strengthDelta;
            }
            return left.id.localeCompare(right.id);
        })[0];
    }


    function getExtraShooterPenalty(count) {
        if (count <= 1) {
            return 0;
        }
        return Math.min(count - 1, 2);
    }


    function getCombatModifierLabel(id) {
        return {
            'bad-going': 'In bad going',
            'mounted-into-bad-going': 'Mounted against enemy in bad going',
            'multiple-shooters': 'Multiple shooters',
            'stacked': 'Supporting element',
            'flank-attacked': 'Attacked in flank',
            'rear-attacked': 'Attacked in rear',
            'overlapped': 'Overlap from idle enemy'
        }[id] || id;
    }


    function combatModifier(id, value, detail) {
        const modifier = {
            id,
            value,
            label: getCombatModifierLabel(id)
        };
        if (detail) {
            modifier.detail = detail;
        }
        return modifier;
    }


    function formatSignedModifier(value) {
        return `${value >= 0 ? '+' : ''}${value}`;
    }


    function describeCombatModifier(modifier) {
        const label = modifier.label || getCombatModifierLabel(modifier.id);
        const signed = formatSignedModifier(modifier.value);
        return modifier.detail ? `${label} (${modifier.detail}) ${signed}` : `${label} ${signed}`;
    }


    function getCombatModifiers(context) {
        const modifiers = [];
        const unitInBadGoing = isUnitInBadGoing(context.unit, context.terrain);
        if (unitInBadGoing && !context.unit.combat?.ignoresBadGoingPenalty) {
            modifiers.push(combatModifier('bad-going', -2));
        }
        if (context.role === 'attacker' && context.unit.troopClass === 'mounted' && isUnitInBadGoing(context.opponent, context.terrain)) {
            const hasBadGoingPenalty = modifiers.some((modifier) => modifier.value === -2);
            if (!hasBadGoingPenalty) {
                modifiers.push(combatModifier('mounted-into-bad-going', -2));
            }
        }
        if (context.phase === 'shooting' && context.role === 'defender' && context.attackers) {
            const extraShooterPenalty = getExtraShooterPenalty(context.attackers.length);
            if (extraShooterPenalty > 0) {
                modifiers.push(combatModifier('multiple-shooters', -extraShooterPenalty));
            }
        }
        if (context.phase === 'melee') {
            if (context.combatant && context.combatant.unitIds.length > 1) {
                const supports = (context.combatant.units || [])
                    .filter((unit) => unit.id !== context.unit.id)
                    .map((unit) => unit.type);
                modifiers.push(combatModifier('stacked', 1, supports.length > 0 ? supports.join(', ') : null));
            }
            const incomingEdges = context.incomingEdges || [];
            if (incomingEdges.includes('left') || incomingEdges.includes('right')) {
                const sides = incomingEdges.filter((edge) => edge === 'left' || edge === 'right');
                modifiers.push(combatModifier('flank-attacked', -1, sides.join(' and ')));
            }
            if (incomingEdges.includes('rear') && context.opponentCombatant && !hasFrontContactOnCombatant(context.opponentCombatant.id, context.combats || [])) {
                modifiers.push(combatModifier('rear-attacked', -1));
            }
            if (context.combatant && context.opponentCombatant && context.combatants && context.fightingCombatantIds) {
                const idleEnemyCombatants = context.combatants.filter((combatant) => combatant.playerId === context.opponentCombatant.playerId);
                const overlapCount = countOverlapsOnCombatant(context.combatant, idleEnemyCombatants, context.fightingCombatantIds);
                if (overlapCount > 0) {
                    modifiers.push(combatModifier('overlapped', -overlapCount, overlapCount === 1 ? 'one flank' : 'both flanks'));
                }
            }
        }
        return modifiers;
    }


    function sumModifiers(modifiers) {
        return modifiers.reduce((sum, modifier) => sum + modifier.value, 0);
    }


    function getMinorLossResolution(winner, loser, phase, terrain) {
        const loserInBadGoing = isUnitInBadGoing(loser, terrain);
        const loserIsSpear = loser.type === 'Spear' || loser.type === 'Heavy-Spear';
        const winnerIsWarband = winner.type === 'Warband' || winner.type === 'Heavy-Warband';
        if (loser.type === 'Flyers') {
            return { outcome: 'flee', destructionRule: null };
        }
        if (loser.type === 'Behemoth' && winner.type === 'Artillery') {
            return { outcome: 'flee', destructionRule: null };
        }
        if (loser.type === 'Magician' && winner.type === 'Hero' && phase === 'melee') {
            return { outcome: 'destroy', destructionRule: 'Heroes destroy Magicians when they win melee.' };
        }
        if (winner.type === 'Magician' && (loser.type === 'Hero' || loser.type === 'Magician')) {
            return { outcome: 'ensorcel', destructionRule: 'Magicians ensorcel Heroes and Magicians on a minor win.' };
        }
        if (loser.type === 'Hero') {
            return { outcome: 'recoil', destructionRule: null };
        }
        if (loser.type === 'Beasts' && phase === 'melee' && winner.troopClass === 'mounted') {
            return { outcome: 'destroy', destructionRule: 'Mounted troops destroy Beasts when the Beasts lose melee.' };
        }
        if (loser.type === 'Artillery' && phase === 'melee') {
            return { outcome: 'destroy', destructionRule: 'Artillery is destroyed when it loses melee.' };
        }
        if (loser.type === 'Shooter') {
            if (phase === 'shooting') {
                return { outcome: 'recoil', destructionRule: null };
            }
            return winner.troopClass === 'mounted'
                ? { outcome: 'destroy', destructionRule: 'Mounted troops destroy Shooters on a minor win.' }
                : { outcome: 'recoil', destructionRule: null };
        }
        if (loser.type === 'Riders') {
            return loserInBadGoing
                ? { outcome: 'destroy', destructionRule: 'Riders are destroyed when they lose in bad going.' }
                : { outcome: 'recoil', destructionRule: null };
        }
        if (loser.type === 'Knights') {
            if (loserInBadGoing) {
                return { outcome: 'destroy', destructionRule: 'Knights are destroyed when they lose in bad going.' };
            }
            if (phase === 'melee' && winner.type === 'Shooter') {
                return { outcome: 'destroy', destructionRule: 'Shooters destroy Knights when the Knights lose melee.' };
            }
            return { outcome: 'recoil', destructionRule: null };
        }
        if (loserIsSpear || loser.type === 'Blade' || loser.type === 'Horde') {
            if (winnerIsWarband) {
                return { outcome: 'destroy', destructionRule: 'Warbands destroy Spears, Blades, and Hordes on a minor win.' };
            }
            if (winner.type === 'Knights' && !loserInBadGoing) {
                return { outcome: 'destroy', destructionRule: 'Knights destroy Spears, Blades, and Hordes in good going.' };
            }
            return { outcome: 'recoil', destructionRule: null };
        }
        return { outcome: 'recoil', destructionRule: null };
    }


    function getFrontTouchedEdges(attacker, defender) {
        const attackerFront = getSideByName(attacker, 'front');
        const touched = new Set();
        getUnitSides(defender).forEach((side) => {
            if (hasMeaningfulSharedEdge(attackerFront.start, attackerFront.end, side.start, side.end)) {
                touched.add(side.name);
            }
        });
        return touched;
    }


    function areSameFacing(left, right) {
        return Math.abs(geometry.normalizeAngle(left.rotation - right.rotation)) <= 0.12;
    }


    function isStackEligible(unit) {
        return STACKABLE_TYPES.has(unit.type);
    }


    function buildStackGroups(units) {
        const parent = new Map();
        units.forEach((unit) => parent.set(unit.id, unit.id));

        function find(unitId) {
            let current = parent.get(unitId);
            while (current !== parent.get(current)) {
                current = parent.get(current);
            }
            let walker = unitId;
            while (walker !== current) {
                const next = parent.get(walker);
                parent.set(walker, current);
                walker = next;
            }
            return current;
        }

        function union(leftId, rightId) {
            const leftRoot = find(leftId);
            const rightRoot = find(rightId);
            if (leftRoot !== rightRoot) {
                parent.set(rightRoot, leftRoot);
            }
        }

        for (let index = 0; index < units.length; index += 1) {
            for (let inner = index + 1; inner < units.length; inner += 1) {
                const left = units[index];
                const right = units[inner];
                if (getPlayerId(left) !== getPlayerId(right) || left.type !== right.type || !isStackEligible(left) || !areSameFacing(left, right)) {
                    continue;
                }
                if (sharesFormationContact(left, right)) {
                    union(left.id, right.id);
                }
            }
        }

        const groups = new Map();
        units.forEach((unit) => {
            const root = find(unit.id);
            if (!groups.has(root)) {
                groups.set(root, []);
            }
            groups.get(root).push(unit.id);
        });

        return Array.from(groups.values()).map((group) => group.sort());
    }


    function buildMeleeCombatants(units) {
        return buildStackGroups(units).map((unitIds) => {
            const members = unitIds.map((unitId) => units.find((unit) => unit.id === unitId)).filter(Boolean);
            const primaryUnit = [...members].sort((left, right) => left.id.localeCompare(right.id))[0];
            return {
                id: unitIds.join('+'),
                unitIds: [...unitIds],
                units: members,
                primaryUnit,
                playerId: getPlayerId(primaryUnit),
                type: primaryUnit.type
            };
        });
    }


    function collectCombatantContact(leftCombatant, rightCombatant) {
        const edgesOnLeft = new Set();
        const edgesOnRight = new Set();

        leftCombatant.units.forEach((leftUnit) => {
            rightCombatant.units.forEach((rightUnit) => {
                getFrontTouchedEdges(leftUnit, rightUnit).forEach((edgeName) => edgesOnRight.add(edgeName));
                getFrontTouchedEdges(rightUnit, leftUnit).forEach((edgeName) => edgesOnLeft.add(edgeName));
            });
        });

        if (edgesOnLeft.size === 0 && edgesOnRight.size === 0) {
            return null;
        }

        return {
            edgesOnLeft: [...edgesOnLeft],
            edgesOnRight: [...edgesOnRight]
        };
    }


    function collectCombatantEdgeContact(leftCombatant, rightCombatant) {
        const edgesOnLeft = new Set();
        const edgesOnRight = new Set();

        leftCombatant.units.forEach((leftUnit) => {
            const leftSides = getUnitSides(leftUnit);
            rightCombatant.units.forEach((rightUnit) => {
                const rightSides = getUnitSides(rightUnit);
                leftSides.forEach((leftSide) => {
                    rightSides.forEach((rightSide) => {
                        if (hasMeaningfulSharedEdge(leftSide.start, leftSide.end, rightSide.start, rightSide.end)) {
                            edgesOnLeft.add(leftSide.name);
                            edgesOnRight.add(rightSide.name);
                        }
                    });
                });
            });
        });

        if (edgesOnLeft.size === 0 && edgesOnRight.size === 0) {
            return null;
        }

        return {
            edgesOnLeft: [...edgesOnLeft],
            edgesOnRight: [...edgesOnRight]
        };
    }


    function getSharedEdgeMidpoint(leftSide, rightSide) {
        const axis = geometry.normalize(geometry.subtract(leftSide.end, leftSide.start));
        const leftStart = geometry.dot(leftSide.start, axis);
        const leftEnd = geometry.dot(leftSide.end, axis);
        const rightStart = geometry.dot(rightSide.start, axis);
        const rightEnd = geometry.dot(rightSide.end, axis);
        const overlapStart = Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd));
        const overlapEnd = Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd));
        const overlapMid = (overlapStart + overlapEnd) / 2;
        const offset = overlapMid - leftStart;
        return geometry.add(leftSide.start, geometry.scaleVector(axis, offset));
    }


    function findCombatantSharedEdge(leftCombatant, rightCombatant) {
        for (const leftUnit of leftCombatant.units) {
            const leftSides = getUnitSides(leftUnit);
            for (const rightUnit of rightCombatant.units) {
                const rightSides = getUnitSides(rightUnit);
                for (const leftSide of leftSides) {
                    for (const rightSide of rightSides) {
                        if (!hasMeaningfulSharedEdge(leftSide.start, leftSide.end, rightSide.start, rightSide.end)) {
                            continue;
                        }
                        return {
                            leftUnitId: leftUnit.id,
                            rightUnitId: rightUnit.id,
                            leftSideName: leftSide.name,
                            rightSideName: rightSide.name,
                            midpoint: getSharedEdgeMidpoint(leftSide, rightSide)
                        };
                    }
                }
            }
        }
        return null;
    }


    function hasSideOnlyContact(contact) {
        if (!contact) {
            return false;
        }
        const leftTouchesSide = contact.edgesOnLeft.includes('left') || contact.edgesOnLeft.includes('right');
        const rightTouchesSide = contact.edgesOnRight.includes('left') || contact.edgesOnRight.includes('right');
        return leftTouchesSide
            && rightTouchesSide
            && !contact.edgesOnLeft.includes('front')
            && !contact.edgesOnRight.includes('front');
    }


    function detectMeleeCombats(units) {
        const combatants = buildMeleeCombatants(units);
        const combats = [];
        const participantIds = new Set();
        const engagedCombatantIds = new Set();

        function addCombat(leftCombatant, rightCombatant, contact) {
            combats.push({
                id: `${leftCombatant.id}::${rightCombatant.id}`,
                leftCombatantId: leftCombatant.id,
                rightCombatantId: rightCombatant.id,
                leftUnitIds: [...leftCombatant.unitIds],
                rightUnitIds: [...rightCombatant.unitIds],
                leftPrimaryId: leftCombatant.primaryUnit.id,
                rightPrimaryId: rightCombatant.primaryUnit.id,
                edgesOnLeft: contact.edgesOnLeft,
                edgesOnRight: contact.edgesOnRight
            });
            engagedCombatantIds.add(leftCombatant.id);
            engagedCombatantIds.add(rightCombatant.id);
            leftCombatant.unitIds.forEach((unitId) => participantIds.add(unitId));
            rightCombatant.unitIds.forEach((unitId) => participantIds.add(unitId));
        }

        for (let index = 0; index < combatants.length; index += 1) {
            for (let inner = index + 1; inner < combatants.length; inner += 1) {
                const leftCombatant = combatants[index];
                const rightCombatant = combatants[inner];
                if (leftCombatant.playerId === rightCombatant.playerId) {
                    continue;
                }
                const contact = collectCombatantContact(leftCombatant, rightCombatant);
                if (!contact) {
                    continue;
                }
                addCombat(leftCombatant, rightCombatant, contact);
            }
        }

        for (let index = 0; index < combatants.length; index += 1) {
            for (let inner = index + 1; inner < combatants.length; inner += 1) {
                const leftCombatant = combatants[index];
                const rightCombatant = combatants[inner];
                if (leftCombatant.playerId === rightCombatant.playerId) {
                    continue;
                }
                if (engagedCombatantIds.has(leftCombatant.id) || engagedCombatantIds.has(rightCombatant.id)) {
                    continue;
                }
                const sideContact = collectCombatantEdgeContact(leftCombatant, rightCombatant);
                if (!hasSideOnlyContact(sideContact)) {
                    continue;
                }
                addCombat(leftCombatant, rightCombatant, sideContact);
            }
        }

        return {
            combatants,
            combats,
            participantIds
        };
    }


    function getIncomingEdges(combat, combatantId) {
        if (combat.leftCombatantId === combatantId) {
            return combat.edgesOnLeft;
        }
        if (combat.rightCombatantId === combatantId) {
            return combat.edgesOnRight;
        }
        return [];
    }


    function hasFrontContactOnCombatant(combatantId, combats) {
        return combats.some((combat) => getIncomingEdges(combat, combatantId).includes('front'));
    }


    function getSideContactDirection(anchorUnit, otherUnit) {
        if (!areSameFacing(anchorUnit, otherUnit)) {
            return null;
        }
        const forward = geometry.getForwardVector(anchorUnit.rotation);
        const right = geometry.getRightVector(anchorUnit.rotation);
        const anchorCenter = geometry.getUnitCenter(anchorUnit);
        const otherCenter = geometry.getUnitCenter(otherUnit);
        const delta = geometry.subtract(otherCenter, anchorCenter);
        const u = geometry.dot(delta, right);
        const v = geometry.dot(delta, forward);
        const sideAligned = Math.abs(v) <= data.RANK_TOLERANCE && Math.abs(Math.abs(u) - anchorUnit.width) <= data.FORMATION_GAP_TOLERANCE;
        if (!sideAligned) {
            return null;
        }
        return u < 0 ? 'left' : 'right';
    }


    function getFlankContactDirection(anchorUnit, otherUnit) {
        const anchorSides = getUnitSides(anchorUnit).filter((side) => side.name === 'left' || side.name === 'right');
        for (const anchorSide of anchorSides) {
            const sharesEdge = getUnitSides(otherUnit).some((otherSide) => hasMeaningfulSharedEdge(anchorSide.start, anchorSide.end, otherSide.start, otherSide.end));
            if (sharesEdge) {
                return anchorSide.name;
            }
        }
        return null;
    }


    function countOverlapsOnCombatant(combatant, idleEnemyCombatants, fightingCombatantIds) {
        const overlappedSides = new Set();
        idleEnemyCombatants.forEach((enemyCombatant) => {
            if (enemyCombatant.id === combatant.id || fightingCombatantIds.has(enemyCombatant.id)) {
                return;
            }
            combatant.units.forEach((anchorUnit) => {
                enemyCombatant.units.forEach((enemyUnit) => {
                    const side = getFlankContactDirection(anchorUnit, enemyUnit);
                    if (side) {
                        overlappedSides.add(side);
                    }
                });
            });
        });
        return overlappedSides.size;
    }


    function getCombatantCenter(combatant) {
        const centers = combatant.units.map((unit) => geometry.getUnitCenter(unit));
        return {
            x: geometry.average(centers.map((center) => center.x)),
            y: geometry.average(centers.map((center) => center.y))
        };
    }


    function getFacingRotationTowardOpponent(combatant, opponentCombatant) {
        const from = getCombatantCenter(combatant);
        const to = getCombatantCenter(opponentCombatant);
        if (geometry.distance(from, to) <= data.COLLISION_EPSILON) {
            return null;
        }
        return geometry.normalizeAngle(Math.atan2(to.x - from.x, from.y - to.y));
    }


    function buildCombatFacingPlans(combatSetup) {
        const combatantsById = new Map(combatSetup.combatants.map((combatant) => [combatant.id, combatant]));
        const combatCountByCombatant = new Map();
        combatSetup.combats.forEach((combat) => {
            combatCountByCombatant.set(combat.leftCombatantId, (combatCountByCombatant.get(combat.leftCombatantId) || 0) + 1);
            combatCountByCombatant.set(combat.rightCombatantId, (combatCountByCombatant.get(combat.rightCombatantId) || 0) + 1);
        });

        const plans = new Map();
        combatSetup.combats.forEach((combat) => {
            const leftCombatant = combatantsById.get(combat.leftCombatantId);
            const rightCombatant = combatantsById.get(combat.rightCombatantId);
            const sharedEdge = findCombatantSharedEdge(leftCombatant, rightCombatant);
            if (!hasFrontContactOnCombatant(leftCombatant.id, combatSetup.combats) && combatCountByCombatant.get(leftCombatant.id) === 1) {
                const rotation = getFacingRotationTowardOpponent(leftCombatant, rightCombatant);
                if (rotation !== null && sharedEdge) {
                    plans.set(leftCombatant.id, {
                        rotation,
                        anchorUnitId: sharedEdge.leftUnitId,
                        anchorMidpoint: sharedEdge.midpoint
                    });
                }
            }
            if (!hasFrontContactOnCombatant(rightCombatant.id, combatSetup.combats) && combatCountByCombatant.get(rightCombatant.id) === 1) {
                const rotation = getFacingRotationTowardOpponent(rightCombatant, leftCombatant);
                if (rotation !== null && sharedEdge) {
                    plans.set(rightCombatant.id, {
                        rotation,
                        anchorUnitId: sharedEdge.rightUnitId,
                        anchorMidpoint: sharedEdge.midpoint
                    });
                }
            }
        });
        return plans;
    }


    function applyCombatFacing(units, combatSetup, facingPlans) {
        const transformedUnitsById = new Map();

        combatSetup.combatants.forEach((combatant) => {
            const plan = facingPlans.get(combatant.id);
            if (!plan) {
                combatant.units.forEach((unit) => {
                    transformedUnitsById.set(unit.id, cloneUnit(unit));
                });
                return;
            }

            const rotatedUnits = geometry.rotateUnitsAroundCenter(combatant.units, plan.rotation);
            const anchorUnit = rotatedUnits.find((unit) => unit.id === plan.anchorUnitId);
            if (!anchorUnit) {
                combatant.units.forEach((unit) => {
                    transformedUnitsById.set(unit.id, cloneUnit(unit));
                });
                return;
            }

            const anchorFront = getSideByName(anchorUnit, 'front');
            const anchorFrontMid = sideMidpoint(anchorFront);
            const delta = geometry.subtract(plan.anchorMidpoint, anchorFrontMid);
            rotatedUnits.forEach((unit) => {
                transformedUnitsById.set(unit.id, {
                    ...unit,
                    x: unit.x + delta.x,
                    y: unit.y + delta.y
                });
            });
        });

        return units.map((unit) => transformedUnitsById.get(unit.id) || cloneUnit(unit));
    }


    function resolveCombatantRecoil(combatant, units, terrain, options) {
        const targetRotation = options && options.targetRotation;
        if (combatant.unitIds.length === 1) {
            const mutableUnits = units.map(cloneUnit);
            if (targetRotation !== undefined && targetRotation !== null) {
                const unitIndex = mutableUnits.findIndex((unit) => unit.id === combatant.unitIds[0]);
                if (unitIndex >= 0) {
                    mutableUnits[unitIndex] = rotateUnitInPlace(mutableUnits[unitIndex], targetRotation);
                }
            }
            const recoil = resolveRecoil(combatant.unitIds[0], mutableUnits, terrain);
            if (recoil.destroyedIds.length > 0) {
                return {
                    units,
                    destroyedIds: [...combatant.unitIds],
                    destructionReasons: recoil.destructionReasons || {}
                };
            }
            return recoil;
        }

        let mutableUnits = units.map(cloneUnit);
        const movingIds = new Set(combatant.unitIds);
        if (targetRotation !== undefined && targetRotation !== null) {
            mutableUnits = mutableUnits.map((unit) => {
                if (!movingIds.has(unit.id)) {
                    return unit;
                }
                return rotateUnitInPlace(unit, targetRotation);
            });
        }
        const shifted = new Map();
        for (const unitId of combatant.unitIds) {
            const unit = mutableUnits.find((entry) => entry.id === unitId);
            const backwardDelta = geometry.scaleVector(geometry.getForwardVector(unit.rotation), -unit.depth);
            const candidate = cloneUnit(unit);
            candidate.x += backwardDelta.x;
            candidate.y += backwardDelta.y;
            const stagedUnits = mutableUnits.map((entry) => shifted.get(entry.id) || entry);
            const recoilBlockReason = getRecoilBlockReason(candidate, stagedUnits, terrain, movingIds);
            if (recoilBlockReason) {
                return {
                    units,
                    destroyedIds: [...combatant.unitIds],
                    destructionReasons: Object.fromEntries(combatant.unitIds.map((unitId) => [unitId, recoilBlockReason]))
                };
            }
            shifted.set(candidate.id, candidate);
        }

        return {
            units: mutableUnits.map((unit) => shifted.get(unit.id) || unit),
            destroyedIds: [],
            destructionReasons: {}
        };
    }


    function buildMeleeCombatSide(combatant, opponentCombatant, incomingEdges, role, adjustedCombats, combatants, fightingCombatantIds, terrain) {
        const strength = getUnitStrengthAgainst(combatant.primaryUnit, opponentCombatant.primaryUnit);
        const modifiers = getCombatModifiers({
            phase: 'melee',
            role,
            unit: combatant.primaryUnit,
            opponent: opponentCombatant.primaryUnit,
            combatant,
            opponentCombatant,
            incomingEdges,
            combats: adjustedCombats,
            combatants,
            fightingCombatantIds,
            terrain
        });
        return {
            combatantId: combatant.id,
            playerId: combatant.playerId,
            primaryId: combatant.primaryUnit.id,
            primaryType: combatant.primaryUnit.type,
            troopClass: combatant.primaryUnit.troopClass,
            unitIds: [...combatant.unitIds],
            unitTypes: combatant.units.map((unit) => unit.type),
            strength,
            modifiers,
            factor: strength + sumModifiers(modifiers),
            center: geometry.getUnitCenter(combatant.primaryUnit)
        };
    }


    function previewMeleeCombats(units, terrain) {
        const combatSetup = detectMeleeCombats(units);
        const facingPlans = buildCombatFacingPlans(combatSetup);
        const adjustedCombats = combatSetup.combats.map((combat) => ({
            ...combat,
            edgesOnLeft: facingPlans.has(combat.leftCombatantId) ? ['front'] : combat.edgesOnLeft,
            edgesOnRight: facingPlans.has(combat.rightCombatantId) ? ['front'] : combat.edgesOnRight
        }));
        const facedUnits = applyCombatFacing(units, combatSetup, facingPlans);
        const combatantsById = new Map(buildMeleeCombatants(facedUnits).map((combatant) => [combatant.id, combatant]));
        const combatants = [...combatantsById.values()];
        const fightingCombatantIds = new Set(adjustedCombats.flatMap((combat) => [combat.leftCombatantId, combat.rightCombatantId]));
        return adjustedCombats.map((combat) => {
            const leftCombatant = combatantsById.get(combat.leftCombatantId);
            const rightCombatant = combatantsById.get(combat.rightCombatantId);
            const left = buildMeleeCombatSide(
                leftCombatant,
                rightCombatant,
                combat.edgesOnLeft,
                'attacker',
                adjustedCombats,
                combatants,
                fightingCombatantIds,
                terrain
            );
            const right = buildMeleeCombatSide(
                rightCombatant,
                leftCombatant,
                combat.edgesOnRight,
                'defender',
                adjustedCombats,
                combatants,
                fightingCombatantIds,
                terrain
            );
            return {
                id: combat.id,
                left,
                right,
                position: geometry.midpoint(left.center, right.center)
            };
        });
    }


    function resolveMelee(units, terrain, rollDie) {
        const combatSetup = detectMeleeCombats(units);
        const facingPlans = buildCombatFacingPlans(combatSetup);
        const adjustedCombats = combatSetup.combats.map((combat) => ({
            ...combat,
            edgesOnLeft: facingPlans.has(combat.leftCombatantId) ? ['front'] : combat.edgesOnLeft,
            edgesOnRight: facingPlans.has(combat.rightCombatantId) ? ['front'] : combat.edgesOnRight
        }));
        const mutableStartingUnits = applyCombatFacing(units, combatSetup, facingPlans);
        const combatantsById = new Map(buildMeleeCombatants(mutableStartingUnits).map((combatant) => [combatant.id, combatant]));
        const fightingCombatantIds = new Set(adjustedCombats.flatMap((combat) => [combat.leftCombatantId, combat.rightCombatantId]));
        const results = [];
        const recoilDestructions = [];

        adjustedCombats.forEach((combat) => {
            const leftCombatant = combatantsById.get(combat.leftCombatantId);
            const rightCombatant = combatantsById.get(combat.rightCombatantId);
            const leftModifiers = getCombatModifiers({
                phase: 'melee',
                role: 'attacker',
                unit: leftCombatant.primaryUnit,
                opponent: rightCombatant.primaryUnit,
                combatant: leftCombatant,
                opponentCombatant: rightCombatant,
                incomingEdges: combat.edgesOnLeft,
                combats: adjustedCombats,
                combatants: [...combatantsById.values()],
                fightingCombatantIds,
                terrain
            });
            const rightModifiers = getCombatModifiers({
                phase: 'melee',
                role: 'defender',
                unit: rightCombatant.primaryUnit,
                opponent: leftCombatant.primaryUnit,
                combatant: rightCombatant,
                opponentCombatant: leftCombatant,
                incomingEdges: combat.edgesOnRight,
                combats: adjustedCombats,
                combatants: [...combatantsById.values()],
                fightingCombatantIds,
                terrain
            });
            const leftRoll = rollDie({ role: 'left', combatId: combat.id, leftPrimaryId: leftCombatant.primaryUnit.id, rightPrimaryId: rightCombatant.primaryUnit.id });
            const rightRoll = rollDie({ role: 'right', combatId: combat.id, leftPrimaryId: leftCombatant.primaryUnit.id, rightPrimaryId: rightCombatant.primaryUnit.id });
            const leftTotal = leftRoll + getUnitStrengthAgainst(leftCombatant.primaryUnit, rightCombatant.primaryUnit) + sumModifiers(leftModifiers);
            const rightTotal = rightRoll + getUnitStrengthAgainst(rightCombatant.primaryUnit, leftCombatant.primaryUnit) + sumModifiers(rightModifiers);
            const result = {
                combatId: combat.id,
                leftCombatantId: leftCombatant.id,
                rightCombatantId: rightCombatant.id,
                leftUnitIds: [...leftCombatant.unitIds],
                rightUnitIds: [...rightCombatant.unitIds],
                leftPrimaryId: leftCombatant.primaryUnit.id,
                rightPrimaryId: rightCombatant.primaryUnit.id,
                leftRoll,
                rightRoll,
                leftModifiers,
                rightModifiers,
                leftTotal,
                rightTotal,
                outcome: 'tie',
                loserCombatantId: null,
                recoilRotation: null,
                destructionRule: null
            };
            if (leftTotal === rightTotal) {
                results.push(result);
                return;
            }
            const leftWon = leftTotal > rightTotal;
            const winnerCombatant = leftWon ? leftCombatant : rightCombatant;
            const loserCombatant = leftWon ? rightCombatant : leftCombatant;
            result.loserCombatantId = loserCombatant.id;
            const highTotal = Math.max(leftTotal, rightTotal);
            const lowTotal = Math.min(leftTotal, rightTotal);
            if (highTotal >= lowTotal * 2) {
                result.outcome = 'destroy';
                result.destructionRule = 'Double total destroys the loser.';
                results.push(result);
                return;
            }
            const lossResolution = getMinorLossResolution(winnerCombatant.primaryUnit, loserCombatant.primaryUnit, 'melee', terrain);
            result.outcome = lossResolution.outcome;
            result.destructionRule = lossResolution.destructionRule;
            const incomingEdges = leftWon ? combat.edgesOnRight : combat.edgesOnLeft;
            if (incomingEdges.includes('rear')) {
                result.recoilRotation = winnerCombatant.primaryUnit.rotation;
            }
            results.push(result);
        });

        const destroyedIds = new Set();
        const ensorcelledIds = new Map();
        const recoilQueue = [];
        results.forEach((result) => {
            if (!result.loserCombatantId) {
                return;
            }
            const loserCombatant = combatantsById.get(result.loserCombatantId);
            const winnerCombatant = result.loserCombatantId === result.leftCombatantId
                ? combatantsById.get(result.rightCombatantId)
                : combatantsById.get(result.leftCombatantId);
            if (result.outcome === 'destroy') {
                loserCombatant.unitIds.forEach((unitId) => destroyedIds.add(unitId));
                return;
            }
            if (result.outcome === 'ensorcel') {
                loserCombatant.unitIds.forEach((unitId) => {
                    const unit = mutableStartingUnits.find((entry) => entry.id === unitId);
                    if (unit && isEnsorcellableType(unit)) {
                        ensorcelledIds.set(unitId, winnerCombatant.primaryUnit.id);
                    }
                });
                return;
            }
            if (result.outcome === 'recoil' || result.outcome === 'flee') {
                recoilQueue.push({
                    combatant: loserCombatant,
                    targetRotation: result.recoilRotation,
                    flee: result.outcome === 'flee'
                });
            }
        });

        let mutableUnits = mutableStartingUnits.filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id));
        recoilQueue.forEach((entry) => {
            if (entry.combatant.unitIds.some((unitId) => destroyedIds.has(unitId))) {
                return;
            }
            const recoil = resolveCombatantRecoil(entry.combatant, mutableUnits, terrain, { targetRotation: entry.targetRotation });
            if (recoil.destroyedIds.length > 0) {
                recoil.destroyedIds.forEach((unitId) => {
                    recoilDestructions.push({
                        unitId,
                        reason: recoil.destructionReasons[unitId] || 'recoil destruction reason unavailable'
                    });
                });
                recoil.destroyedIds.forEach((unitId) => destroyedIds.add(unitId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = recoil.units;
            if (!entry.flee) {
                return;
            }
            const flee = resolveFlee(entry.combatant.primaryUnit.id, mutableUnits, terrain);
            if (flee.destroyedIds.length > 0) {
                flee.destroyedIds.forEach((unitId) => {
                    recoilDestructions.push({
                        unitId,
                        reason: flee.destructionReasons[unitId] || 'flee destruction reason unavailable'
                    });
                });
                flee.destroyedIds.forEach((unitId) => destroyedIds.add(unitId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = flee.units;
        });

        const destroyedUnits = mutableStartingUnits.filter((unit) => destroyedIds.has(unit.id)).map(cloneUnit);
        const ensorcelledUnits = [...ensorcelledIds.entries()].map(([unitId, ensorcelledByUnitId]) => {
            const unit = mutableStartingUnits.find((entry) => entry.id === unitId);
            return unit ? buildEnsorcelledUnit(unit, ensorcelledByUnitId) : null;
        }).filter(Boolean);
        return {
            units: mutableUnits.filter((unit) => !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id)),
            destroyedUnits,
            ensorcelledUnits,
            results,
            recoilDestructions,
            combats: adjustedCombats,
            combatants: [...combatantsById.values()],
            participantIds: combatSetup.participantIds
        };
    }


    return {
        detectMeleeCombats,
        previewMeleeCombats,
        getCombatModifiers,
        describeCombatModifier,
        formatSignedModifier,
        getExtraShooterPenalty,
        getMinorLossResolution,
        getUnitStrengthAgainst,
        choosePrimaryAttacker,
        sumModifiers,
        resolveMelee
    };
}));
