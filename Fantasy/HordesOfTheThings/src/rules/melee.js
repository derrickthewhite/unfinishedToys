(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('./core.js'),
            require('./terrain.js'),
            require('./recoil.js')
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
        isStationaryUnit,
        isEnsorcellableType,
        buildEnsorcelledUnit,
        rotateUnitInPlace
    } = core;

    const {
        isUnitInBadGoing,
        getTerrainTypeAt,
        sampleUnitTerrain,
        findIsolatedLurkers
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
            'shot-in-cover': 'Shot at in woods',
            'mounted-into-bad-going': 'Mounted against enemy in bad going',
            'multiple-shooters': 'Multiple shooters',
            'stacked': 'Supporting element',
            'flank-attacked': 'Attacked in flank',
            'rear-attacked': 'Attacked in rear',
            'overlapped': 'Overlap from idle enemy',
            'stronghold-support': 'Supporting attacker'
        }[id] || id;
    }


    function combatModifier(id, value, detail, extra) {
        const modifier = {
            id,
            value,
            label: getCombatModifierLabel(id)
        };
        if (detail) {
            modifier.detail = detail;
        }
        if (extra?.sources?.length) {
            modifier.sources = extra.sources;
        }
        if (extra?.terrainKind) {
            modifier.terrainKind = extra.terrainKind;
        }
        return modifier;
    }


    function isRearEdgeName(edgeName) {
        return edgeName === 'rear' || edgeName === 'back';
    }


    function badGoingKind(unit, terrainContext) {
        if (!unit || !terrainContext) {
            return null;
        }
        const centerKind = getTerrainTypeAt(geometry.getUnitCenter(unit), terrainContext);
        if (centerKind === 'forest' || centerKind === 'swamp') {
            return centerKind;
        }
        const sample = sampleUnitTerrain(unit, terrainContext);
        if (sample.has('forest')) {
            return 'forest';
        }
        if (sample.has('swamp')) {
            return 'swamp';
        }
        return null;
    }


    function shootingCoverKind(unit, terrainContext) {
        if (!unit || !terrainContext) {
            return null;
        }
        if (getTerrainTypeAt(geometry.getUnitCenter(unit), terrainContext) === 'forest') {
            return 'forest';
        }
        if (sampleUnitTerrain(unit, terrainContext).has('forest')) {
            return 'forest';
        }
        return null;
    }


    function unitsWhoseFrontTouches(combatant, targetUnits, edgeNames) {
        const wanted = new Set(edgeNames);
        const found = [];
        (combatant?.units || []).forEach((unit) => {
            const touches = (targetUnits || []).some((target) => {
                const edges = getFrontTouchedEdges(unit, target);
                return [...edges].some((edgeName) => wanted.has(edgeName));
            });
            if (touches) {
                found.push(unit);
            }
        });
        return found;
    }


    function flankProviderUnits(context) {
        const sides = (context.incomingEdges || []).filter((edgeName) => edgeName === 'left' || edgeName === 'right');
        if (sides.length === 0) {
            return [];
        }
        const targetUnits = context.combatant?.units || [];
        const providers = [];
        const seen = new Set();
        const addUnits = (units) => {
            units.forEach((unit) => {
                if (!unit || seen.has(unit.id)) {
                    return;
                }
                seen.add(unit.id);
                providers.push(unit);
            });
        };
        (context.supportContacts || []).forEach((contact) => {
            const contactSides = (contact.edgesOnTarget || []).filter((edgeName) => sides.includes(edgeName));
            if (contactSides.length === 0) {
                return;
            }
            const combatant = (context.combatants || []).find((entry) => entry.id === contact.combatantId);
            const touched = unitsWhoseFrontTouches(combatant, targetUnits, contactSides);
            addUnits(touched.length > 0 ? touched : (combatant?.units || []).slice(0, 1));
        });
        const supportEdges = new Set((context.supportContacts || []).flatMap((contact) => contact.edgesOnTarget || []));
        const opponentSides = sides.filter((side) => !supportEdges.has(side));
        if (opponentSides.length > 0 && context.opponentCombatant) {
            const touched = unitsWhoseFrontTouches(context.opponentCombatant, targetUnits, opponentSides);
            addUnits(touched.length > 0 ? touched : context.opponentCombatant.units.slice(0, 1));
        }
        return providers;
    }


    function rearProviderUnits(context) {
        const targetUnits = context.combatant?.units || [];
        const providers = [];
        const seen = new Set();
        const addUnits = (units) => {
            units.forEach((unit) => {
                if (!unit || seen.has(unit.id)) {
                    return;
                }
                seen.add(unit.id);
                providers.push(unit);
            });
        };
        const supportRears = (context.supportContacts || []).filter((contact) => (contact.edgesOnTarget || []).some(isRearEdgeName));
        if (supportRears.length > 0) {
            supportRears.forEach((contact) => {
                if (hasFrontContactOnCombatant(contact.combatantId, context.combats || [])) {
                    return;
                }
                const combatant = (context.combatants || []).find((entry) => entry.id === contact.combatantId);
                const touched = unitsWhoseFrontTouches(combatant, targetUnits, ['rear', 'back']);
                addUnits(touched.length > 0 ? touched : (combatant?.units || []).slice(0, 1));
            });
            return providers;
        }
        if (context.opponentCombatant && !hasFrontContactOnCombatant(context.opponentCombatant.id, context.combats || [])) {
            const touched = unitsWhoseFrontTouches(context.opponentCombatant, targetUnits, ['rear', 'back']);
            addUnits(touched.length > 0 ? touched : context.opponentCombatant.units.slice(0, 1));
        }
        return providers;
    }


    function sharesRankContact(left, right) {
        if (isStationaryUnit(left) || isStationaryUnit(right)) {
            return false;
        }
        if (getPlayerId(left) !== getPlayerId(right)) {
            return false;
        }
        if (!areSameFacing(left, right)) {
            return false;
        }
        const forward = geometry.getForwardVector(left.rotation);
        const rightVector = geometry.getRightVector(left.rotation);
        const delta = geometry.subtract(geometry.getUnitCenter(right), geometry.getUnitCenter(left));
        const alongRank = geometry.dot(delta, rightVector);
        const alongFile = geometry.dot(delta, forward);
        const lateralGap = Math.abs(Math.abs(alongRank) - ((left.width + right.width) / 2));
        const depthOverlap = Math.min(left.depth / 2, alongFile + (right.depth / 2))
            - Math.max(-(left.depth / 2), alongFile - (right.depth / 2));
        return lateralGap <= data.FORMATION_GAP_TOLERANCE && depthOverlap > data.COLLISION_EPSILON;
    }


    function rankMates(seedUnits, units) {
        const found = new Map(seedUnits.map((unit) => [unit.id, unit]));
        const queue = [...seedUnits];
        while (queue.length > 0) {
            const current = queue.pop();
            units.forEach((other) => {
                if (found.has(other.id) || !sharesRankContact(current, other)) {
                    return;
                }
                found.set(other.id, other);
                queue.push(other);
            });
        }
        seedUnits.forEach((unit) => found.delete(unit.id));
        return [...found.values()];
    }


    function frontageExtensionSide(anchorUnit, otherUnit) {
        const right = geometry.getRightVector(anchorUnit.rotation);
        const origin = geometry.getUnitCorners(anchorUnit).frontLeft;
        const project = (point) => geometry.dot(geometry.subtract(point, origin), right);
        const anchorCorners = geometry.getUnitCorners(anchorUnit);
        const anchorMin = Math.min(project(anchorCorners.frontLeft), project(anchorCorners.frontRight));
        const anchorMax = Math.max(project(anchorCorners.frontLeft), project(anchorCorners.frontRight));
        const projections = geometry.cornersToPoints(geometry.getUnitCorners(otherUnit)).map(project);
        const otherMin = Math.min(...projections);
        const otherMax = Math.max(...projections);
        const pastLeft = otherMin < anchorMin - data.COLLISION_EPSILON;
        const pastRight = otherMax > anchorMax + data.COLLISION_EPSILON;
        if (pastLeft && !pastRight) {
            return 'left';
        }
        if (pastRight && !pastLeft) {
            return 'right';
        }
        if (pastLeft && pastRight) {
            return (anchorMin - otherMin) >= (otherMax - anchorMax) ? 'left' : 'right';
        }
        return null;
    }


    function overlapSources(context) {
        const sources = [];
        const usedSides = new Set();
        const ignoredUnitIds = context.unit?.type === 'Base'
            ? new Set((context.strongholdSupporters || []).map((unit) => unit.id))
            : null;
        const record = (unitId, side) => {
            if (!side || usedSides.has(side)) {
                return;
            }
            usedSides.add(side);
            sources.push({ unitId, value: -1 });
        };
        const idleEnemyCombatants = context.combatants.filter((combatant) => combatant.playerId === context.opponentCombatant.playerId);
        idleEnemyCombatants.forEach((enemyCombatant) => {
            if (enemyCombatant.id === context.combatant.id || context.fightingCombatantIds.has(enemyCombatant.id)) {
                return;
            }
            enemyCombatant.units.forEach((enemyUnit) => {
                if (ignoredUnitIds?.has(enemyUnit.id)) {
                    return;
                }
                context.combatant.units.forEach((anchorUnit) => {
                    record(enemyUnit.id, getFlankContactDirection(anchorUnit, enemyUnit));
                });
            });
        });
        const sameSideUnits = context.combatants
            .filter((combatant) => combatant.playerId === context.opponentCombatant.playerId)
            .flatMap((combatant) => combatant.units);
        const fightingUnitIds = new Set();
        context.combatants.forEach((combatant) => {
            if (context.fightingCombatantIds.has(combatant.id)) {
                combatant.unitIds.forEach((unitId) => fightingUnitIds.add(unitId));
            }
        });
        context.combatant.units.forEach((anchorUnit) => {
            const touching = (context.opponentCombatant.units || []).filter((unit) => getFrontTouchedEdges(unit, anchorUnit).has('front'));
            const seeds = touching.length > 0 ? touching : (context.opponentCombatant.units || []);
            rankMates(seeds, sameSideUnits).forEach((mate) => {
                if (fightingUnitIds.has(mate.id) || ignoredUnitIds?.has(mate.id)) {
                    return;
                }
                record(mate.id, frontageExtensionSide(anchorUnit, mate));
            });
        });
        return sources;
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
            modifiers.push(combatModifier('bad-going', -2, null, { terrainKind: badGoingKind(context.unit, context.terrain) }));
        } else if (context.role === 'attacker' && context.unit.troopClass === 'mounted' && !unitInBadGoing && isUnitInBadGoing(context.opponent, context.terrain)) {
            modifiers.push(combatModifier('mounted-into-bad-going', -2, null, { terrainKind: badGoingKind(context.opponent, context.terrain) }));
        }
        if (context.phase === 'shooting' && context.shotAtUnit) {
            const cover = shootingCoverKind(context.shotAtUnit, context.terrain);
            if (cover) {
                modifiers.push(combatModifier('shot-in-cover', 2, null, { terrainKind: cover }));
            }
        }
        if (context.phase === 'shooting' && context.role === 'defender' && context.attackers) {
            const extraShooterPenalty = getExtraShooterPenalty(context.attackers.length);
            if (extraShooterPenalty > 0) {
                const primary = choosePrimaryAttacker(context.attackers, context.opponent || context.unit);
                const extras = context.attackers.filter((unit) => unit.id !== primary.id).slice(0, extraShooterPenalty);
                modifiers.push(combatModifier('multiple-shooters', -extraShooterPenalty, null, {
                    sources: extras.map((unit) => ({ unitId: unit.id, value: -1 }))
                }));
            }
        }
        if (context.phase === 'melee') {
            if (context.combatant && context.combatant.unitIds.length > 1) {
                const supports = (context.combatant.units || []).filter((unit) => unit.id !== context.unit.id);
                modifiers.push(combatModifier('stacked', 1, supports.map((unit) => unit.type).join(', ') || null, {
                    sources: supports.slice(0, 1).map((unit) => ({ unitId: unit.id, value: 1 }))
                }));
            }
            const incomingEdges = context.incomingEdges || [];
            if (context.unit?.type !== 'Base' && (incomingEdges.includes('left') || incomingEdges.includes('right'))) {
                const sides = incomingEdges.filter((edge) => edge === 'left' || edge === 'right');
                const providers = flankProviderUnits(context);
                modifiers.push(combatModifier('flank-attacked', -1, sides.join(' and '), {
                    sources: providers.map((unit) => ({ unitId: unit.id, value: -1 }))
                }));
            }
            if (rearAttackApplies(context)) {
                modifiers.push(combatModifier('rear-attacked', -1, null, {
                    sources: rearProviderUnits(context).map((unit) => ({ unitId: unit.id, value: -1 }))
                }));
            }
            if (context.unit?.type === 'Base' && context.strongholdSupporters?.length) {
                modifiers.push(combatModifier(
                    'stronghold-support',
                    -context.strongholdSupporters.length,
                    context.strongholdSupporters.map((unit) => unit.type).join(', '),
                    { sources: context.strongholdSupporters.map((unit) => ({ unitId: unit.id, value: -1 })) }
                ));
            }
            if (context.combatant && context.opponentCombatant && context.combatants && context.fightingCombatantIds) {
                const sources = overlapSources(context);
                if (sources.length > 0) {
                    modifiers.push(combatModifier(
                        'overlapped',
                        -sources.length,
                        sources.length === 1 ? 'one flank' : 'both flanks',
                        { sources }
                    ));
                }
            }
        }
        return modifiers;
    }


    function sumModifiers(modifiers) {
        return modifiers.reduce((sum, modifier) => sum + modifier.value, 0);
    }


    const BASE_FALL_RULE = 'The base falls, and its army loses the battle.';

    function getMinorLossResolution(winner, loser, phase, terrain) {
        if (loser?.combat?.lossEndsGame) {
            return { outcome: 'base-fall', destructionRule: BASE_FALL_RULE };
        }
        const loserInBadGoing = isUnitInBadGoing(loser, terrain);
        const loserIsSpear = loser.type === 'Spear' || loser.type === 'Heavy-Spear';
        const winnerIsWarband = winner.type === 'Warband' || winner.type === 'Heavy-Warband';
        if (data.isLurkerType(loser.type)) {
            return {
                outcome: 'lurk-return',
                destructionRule: 'Lurkers return to reserve on a minor loss.'
            };
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
        if (loser.type === 'Hero' && winner.type === 'Artillery') {
            return { outcome: 'destroy', destructionRule: 'Artillery destroys Heroes on a minor win.' };
        }
        if (loser.type === 'Hero') {
            return { outcome: 'recoil', destructionRule: null };
        }
        if (loser.type === 'Beasts' && phase === 'melee' && winner.troopClass === 'mounted' && !loserInBadGoing) {
            return { outcome: 'destroy', destructionRule: 'Mounted troops destroy Beasts when the Beasts lose melee in good going.' };
        }
        if ((loser.type === 'Warband' || loser.type === 'Heavy-Warband') && winner.type === 'Behemoth' && phase === 'melee') {
            return { outcome: 'destroy', destructionRule: 'Behemoths destroy Warbands on a minor melee win.' };
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


    const QUICK_KILL_SITUATIONS = [
        { phase: 'melee', badGoing: false },
        { phase: 'melee', badGoing: true },
        { phase: 'shooting', badGoing: false },
        { phase: 'shooting', badGoing: true }
    ];
    const OPEN_STAT_TERRAIN = { roads: [], features: [] };
    const BAD_STAT_TERRAIN = {
        roads: [],
        features: [{ kind: 'swamp', cx: 100, cy: 100, rx: 200, ry: 200, wobble: 0 }]
    };
    let quickKillInfoByType = null;


    function combatStatTypes() {
        return Object.keys(data.UNIT_TYPES).filter((type) => type !== 'Base');
    }


    function makeStatDummy(type, playerId) {
        const template = data.UNIT_TYPES[type];
        return {
            id: `${type}-${playerId}`,
            type,
            playerId,
            width: data.UNIT_WIDTH,
            depth: template.depth,
            x: 100,
            y: 100,
            rotation: 0,
            troopClass: template.troopClass,
            combat: { ...(template.combat || {}) }
        };
    }


    function specialMinorOutcome(resolution) {
        if (resolution.outcome === 'destroy'
            || resolution.outcome === 'ensorcel'
            || resolution.outcome === 'flee'
            || resolution.outcome === 'lurk-return') {
            return resolution.outcome;
        }
        return null;
    }


    function situationKey(situation) {
        return `${situation.phase}:${situation.badGoing ? 'bad' : 'good'}`;
    }


    function noteForSituations(hits, kind) {
        const bits = [];
        if (kind === 'ensorcel') {
            bits.push('ensorcelled, not destroyed');
        }
        if (kind === 'flee') {
            bits.push('flees, not destroyed');
        }
        if (kind === 'lurk-return') {
            bits.push('returns to reserve, not destroyed');
        }
        if (hits.length && hits.length < QUICK_KILL_SITUATIONS.length) {
            const meleeOnly = hits.every((hit) => hit.phase === 'melee');
            const shootingOnly = hits.every((hit) => hit.phase === 'shooting');
            const goodOnly = hits.every((hit) => !hit.badGoing);
            const badOnly = hits.every((hit) => hit.badGoing);
            if (meleeOnly) {
                bits.push('in melee');
            } else if (shootingOnly) {
                bits.push('shooting');
            }
            if (goodOnly) {
                bits.push('in good going');
            } else if (badOnly) {
                bits.push('in bad going');
            }
        }
        return bits.join(', ');
    }


    function describeKillerSet(winners) {
        const types = combatStatTypes();
        if (winners.length === types.length) {
            return 'Anyone';
        }
        const mounted = types.filter((type) => data.UNIT_TYPES[type].troopClass === 'mounted');
        const infantry = types.filter((type) => data.UNIT_TYPES[type].troopClass === 'infantry');
        const set = new Set(winners);
        if (mounted.length && mounted.every((type) => set.has(type)) && winners.length === mounted.length) {
            return 'Mounted';
        }
        if (infantry.length && infantry.every((type) => set.has(type)) && winners.length === infantry.length) {
            return 'Infantry';
        }
        return null;
    }


    function buildQuickKillInfoByType() {
        const types = combatStatTypes();
        const killers = {};
        types.forEach((loserType) => {
            killers[loserType] = {};
            QUICK_KILL_SITUATIONS.forEach((situation) => {
                const key = situationKey(situation);
                killers[loserType][key] = {};
                const terrain = situation.badGoing ? BAD_STAT_TERRAIN : OPEN_STAT_TERRAIN;
                types.forEach((winnerType) => {
                    const kind = specialMinorOutcome(getMinorLossResolution(
                        makeStatDummy(winnerType, 'winner'),
                        makeStatDummy(loserType, 'loser'),
                        situation.phase,
                        terrain
                    ));
                    if (!kind) {
                        return;
                    }
                    if (!killers[loserType][key][kind]) {
                        killers[loserType][key][kind] = [];
                    }
                    killers[loserType][key][kind].push(winnerType);
                });
            });
        });

        function collectKillEntries(subjectType, asWinner) {
            if (asWinner) {
                const groups = new Map();
                types.forEach((loserType) => {
                    QUICK_KILL_SITUATIONS.forEach((situation) => {
                        const kindMap = killers[loserType][situationKey(situation)];
                        Object.keys(kindMap).forEach((kind) => {
                            const winners = kindMap[kind];
                            if (!winners.includes(subjectType) || winners.length === types.length) {
                                return;
                            }
                            const groupKey = `${kind}::${loserType}`;
                            if (!groups.has(groupKey)) {
                                groups.set(groupKey, { kind, otherType: loserType, sits: [] });
                            }
                            groups.get(groupKey).sits.push(situation);
                        });
                    });
                });
                const entries = [];
                groups.forEach((group) => {
                    entries.push({ label: group.otherType, note: noteForSituations(group.sits, group.kind) });
                });
                entries.sort((left, right) => types.indexOf(left.label) - types.indexOf(right.label));
                return entries;
            }

            const universal = {};
            const leftover = {};
            types.forEach((winnerType) => {
                leftover[winnerType] = {};
            });
            QUICK_KILL_SITUATIONS.forEach((situation) => {
                const kindMap = killers[subjectType][situationKey(situation)];
                Object.keys(kindMap).forEach((kind) => {
                    const winners = kindMap[kind];
                    if (winners.length === types.length) {
                        if (!universal[kind]) {
                            universal[kind] = [];
                        }
                        universal[kind].push(situation);
                        return;
                    }
                    winners.forEach((winnerType) => {
                        if (!leftover[winnerType][kind]) {
                            leftover[winnerType][kind] = [];
                        }
                        leftover[winnerType][kind].push(situation);
                    });
                });
            });

            const entries = [];
            Object.keys(universal).forEach((kind) => {
                entries.push({
                    label: 'Anyone',
                    note: noteForSituations(universal[kind], kind)
                });
            });
            const leftoverGroups = new Map();
            types.forEach((winnerType) => {
                Object.keys(leftover[winnerType]).forEach((kind) => {
                    const note = noteForSituations(leftover[winnerType][kind], kind);
                    const groupKey = `${kind}::${note}`;
                    if (!leftoverGroups.has(groupKey)) {
                        leftoverGroups.set(groupKey, { kind, note, winners: [] });
                    }
                    leftoverGroups.get(groupKey).winners.push(winnerType);
                });
            });
            leftoverGroups.forEach((group) => {
                const collapsed = describeKillerSet(group.winners);
                if (collapsed) {
                    entries.push({ label: collapsed, note: group.note });
                    return;
                }
                group.winners.forEach((winnerType) => {
                    entries.push({ label: winnerType, note: group.note });
                });
            });
            const order = ['Anyone', 'Mounted', 'Infantry', ...types];
            entries.sort((left, right) => order.indexOf(left.label) - order.indexOf(right.label));
            return entries;
        }

        const info = {};
        types.forEach((type) => {
            const killed = collectKillEntries(type, false);
            if (type === 'Flyers') {
                ['Hero', 'Magician', 'Flyers', 'Shooter'].forEach((label) => {
                    killed.push({ label, note: 'when doubled' });
                });
            }
            info[type] = {
                kills: collectKillEntries(type, true),
                killed
            };
        });
        info.Base = { kills: [], killed: [] };
        return info;
    }


    function getTypeQuickKillInfo(type) {
        if (!quickKillInfoByType) {
            quickKillInfoByType = buildQuickKillInfoByType();
        }
        return quickKillInfoByType[type] || { kills: [], killed: [] };
    }


    function flyerDestroyedBy(winner) {
        return winner?.type === 'Hero'
            || winner?.type === 'Magician'
            || winner?.type === 'Flyers'
            || winner?.type === 'Shooter';
    }


    function resolveCombatLoss(winner, loser, phase, terrain, isDouble) {
        if (loser?.combat?.lossEndsGame) {
            return { outcome: 'base-fall', destructionRule: BASE_FALL_RULE };
        }
        if (loser?.type === 'Flyers') {
            if (isDouble && flyerDestroyedBy(winner)) {
                return {
                    outcome: 'destroy',
                    destructionRule: 'A double from a Hero, Magician, Flyers, or Shooters destroys Flyers.'
                };
            }
            if (isDouble) {
                return { outcome: 'flee', destructionRule: null };
            }
            return { outcome: 'recoil', destructionRule: null };
        }
        if (isDouble) {
            return { outcome: 'destroy', destructionRule: 'Double total destroys the loser.' };
        }
        return getMinorLossResolution(winner, loser, phase, terrain);
    }


    function getFrontTouchedEdges(attacker, defender) {
        if (geometry.hasOutline(attacker) || geometry.hasOutline(defender)) {
            const attackerEdges = geometry.unitTouchEdges(attacker, defender);
            if (!attackerEdges.includes('front')) {
                return new Set();
            }
            return new Set(geometry.unitTouchEdges(defender, attacker));
        }
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


    function hasFileSupportContact(left, right) {
        if (getPlayerId(left) !== getPlayerId(right)) {
            return false;
        }
        if (!areSameFacing(left, right)) {
            return false;
        }
        const forward = geometry.getForwardVector(left.rotation);
        const rightVector = geometry.getRightVector(left.rotation);
        const leftCenter = geometry.getUnitCenter(left);
        const rightCenter = geometry.getUnitCenter(right);
        const delta = geometry.subtract(rightCenter, leftCenter);
        const u = geometry.dot(delta, rightVector);
        const v = geometry.dot(delta, forward);
        const fileGap = Math.abs(Math.abs(v) - ((left.depth + right.depth) / 2));
        const widthOverlap = Math.min(left.width / 2, u + (right.width / 2))
            - Math.max(-(left.width / 2), u - (right.width / 2));
        return fileGap <= data.FORMATION_GAP_TOLERANCE
            && widthOverlap > data.COLLISION_EPSILON;
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
                // Melee stacking support is file-only: rear support behind a front unit.
                // Rank-adjacent units should not be merged into one stacked combatant.
                if (hasFileSupportContact(left, right)) {
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
            rightCombatant.units.forEach((rightUnit) => {
                if (geometry.hasOutline(leftUnit) || geometry.hasOutline(rightUnit)) {
                    geometry.unitTouchEdges(leftUnit, rightUnit).forEach((edgeName) => edgesOnLeft.add(edgeName));
                    geometry.unitTouchEdges(rightUnit, leftUnit).forEach((edgeName) => edgesOnRight.add(edgeName));
                    return;
                }
                const leftSides = getUnitSides(leftUnit);
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


    function rearAttackApplies(context) {
        if (!(context.incomingEdges || []).some(isRearEdgeName)) {
            return false;
        }
        const supportRears = (context.supportContacts || []).filter((contact) => (contact.edgesOnTarget || []).some(isRearEdgeName));
        if (supportRears.length > 0) {
            return supportRears.some((contact) => !hasFrontContactOnCombatant(contact.combatantId, context.combats || []));
        }
        return Boolean(context.opponentCombatant)
            && !hasFrontContactOnCombatant(context.opponentCombatant.id, context.combats || []);
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


    function countOverlapsOnCombatant(combatant, idleEnemyCombatants, fightingCombatantIds, ignoredUnitIds) {
        const overlappedSides = new Set();
        idleEnemyCombatants.forEach((enemyCombatant) => {
            if (enemyCombatant.id === combatant.id || fightingCombatantIds.has(enemyCombatant.id)) {
                return;
            }
            combatant.units.forEach((anchorUnit) => {
                enemyCombatant.units.forEach((enemyUnit) => {
                    if (ignoredUnitIds?.has(enemyUnit.id)) {
                        return;
                    }
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
            const frontToSide = sharedEdge && describeFrontToSideContact(sharedEdge, leftCombatant, rightCombatant);
            if (frontToSide) {
                if (canTurnToFace(frontToSide.mover, combatSetup.combats, combatCountByCombatant)) {
                    const attackerFront = getSideByName(frontToSide.attackerUnit, 'front');
                    plans.set(frontToSide.mover.id, {
                        kind: 'match-front',
                        rotation: geometry.normalizeAngle(frontToSide.attackerUnit.rotation + Math.PI),
                        anchorUnitId: frontToSide.moverUnitId,
                        targetFrontMid: sideMidpoint(attackerFront)
                    });
                }
                return;
            }
            if (canTurnToFace(leftCombatant, combatSetup.combats, combatCountByCombatant)) {
                const rotation = getFacingRotationTowardOpponent(leftCombatant, rightCombatant);
                if (rotation !== null && sharedEdge) {
                    plans.set(leftCombatant.id, {
                        rotation,
                        anchorUnitId: sharedEdge.leftUnitId,
                        anchorMidpoint: sharedEdge.midpoint
                    });
                }
            }
            if (canTurnToFace(rightCombatant, combatSetup.combats, combatCountByCombatant)) {
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


    function isSideOrRearEdge(sideName) {
        return sideName === 'left' || sideName === 'right' || sideName === 'back';
    }


    function canTurnToFace(combatant, combats, combatCountByCombatant) {
        return !combatant.units.some((unit) => isStationaryUnit(unit))
            && !hasFrontContactOnCombatant(combatant.id, combats)
            && combatCountByCombatant.get(combatant.id) === 1;
    }


    function describeFrontToSideContact(sharedEdge, leftCombatant, rightCombatant) {
        const leftUnit = leftCombatant.units.find((unit) => unit.id === sharedEdge.leftUnitId);
        const rightUnit = rightCombatant.units.find((unit) => unit.id === sharedEdge.rightUnitId);
        if (!leftUnit || !rightUnit) {
            return null;
        }
        if (sharedEdge.leftSideName === 'front' && isSideOrRearEdge(sharedEdge.rightSideName)) {
            return {
                attackerUnit: leftUnit,
                mover: rightCombatant,
                moverUnitId: rightUnit.id
            };
        }
        if (sharedEdge.rightSideName === 'front' && isSideOrRearEdge(sharedEdge.leftSideName)) {
            return {
                attackerUnit: rightUnit,
                mover: leftCombatant,
                moverUnitId: leftUnit.id
            };
        }
        return null;
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
            const targetMid = plan.kind === 'match-front' ? plan.targetFrontMid : plan.anchorMidpoint;
            const delta = geometry.subtract(targetMid, anchorFrontMid);
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


    function fightingUnit(combatant, combat) {
        const fighterId = combat?.strongholdFighterId;
        if (!fighterId || !combatant.unitIds.includes(fighterId)) {
            return combatant.primaryUnit;
        }
        return combatant.units.find((unit) => unit.id === fighterId) || combatant.primaryUnit;
    }


    function strongholdSupporters(combat, combatants) {
        const ids = new Set(combat?.strongholdSupportIds || []);
        if (ids.size === 0) {
            return [];
        }
        const supporters = [];
        combatants.forEach((combatant) => {
            combatant.units.forEach((unit) => {
                if (ids.has(unit.id)) {
                    supporters.push(unit);
                }
            });
        });
        return supporters;
    }


    function unitsTouching(unit, others) {
        const self = { units: [unit] };
        return others.filter((other) => {
            if (other.id === unit.id || getPlayerId(other) === getPlayerId(unit)) {
                return false;
            }
            return Boolean(collectCombatantEdgeContact(self, { units: [other] }));
        });
    }


    function assaultContact(fighter, base) {
        const pair = [{ units: [fighter] }, { units: [base] }];
        return collectCombatantContact(pair[0], pair[1]) || collectCombatantEdgeContact(pair[0], pair[1]);
    }


    function isAerialUnit(unit) {
        return unit?.type === 'Flyers';
    }


    function chooseStrongholdAttacker(attackers, base, random) {
        const ground = attackers.filter((unit) => !isAerialUnit(unit));
        const candidates = ground.length > 0 ? ground : attackers;
        const ranked = candidates.map((unit) => ({
            unit,
            strength: getUnitStrengthAgainst(unit, base),
            value: Number.isFinite(unit.value) ? unit.value : 0
        }));
        const bestStrength = Math.max(...ranked.map((entry) => entry.strength));
        let pool = ranked.filter((entry) => entry.strength === bestStrength);
        const cheapest = Math.min(...pool.map((entry) => entry.value));
        pool = pool.filter((entry) => entry.value === cheapest);
        pool.sort((left, right) => left.unit.id.localeCompare(right.unit.id));
        if (pool.length === 1 || typeof random !== 'function') {
            return pool[0].unit;
        }
        const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
        return pool[index].unit;
    }


    function fightingIdsFrom(combats) {
        return new Set(combats.flatMap((combat) => [
            combat.leftCombatantId,
            combat.rightCombatantId,
            ...(combat.supportCombatantIds || [])
        ]));
    }


    function collapseStrongholdAssaults(setup, random) {
        const baseCombatants = setup.combatants.filter((combatant) => combatant.units.some((unit) => unit.type === 'Base'));
        if (baseCombatants.length === 0) {
            return {
                ...setup,
                fightingCombatantIds: fightingIdsFrom(setup.combats)
            };
        }
        let combats = setup.combats.slice();
        const participantIds = new Set(setup.participantIds);
        baseCombatants.forEach((baseCombatant) => {
            const base = baseCombatant.units.find((unit) => unit.type === 'Base');
            const attackers = unitsTouching(base, setup.facedUnits);
            if (attackers.length === 0) {
                return;
            }
            const fighter = chooseStrongholdAttacker(attackers, base, random);
            const fighterCombatant = setup.combatants.find((combatant) => combatant.unitIds.includes(fighter.id));
            const contact = assaultContact(fighter, base);
            if (!fighterCombatant || !contact) {
                return;
            }
            combats = combats.filter((combat) => combat.leftCombatantId !== baseCombatant.id && combat.rightCombatantId !== baseCombatant.id);
            const support = attackers.filter((unit) => unit.id !== fighter.id);
            const fighterFirst = setup.combatants.indexOf(fighterCombatant) < setup.combatants.indexOf(baseCombatant);
            const leftCombatant = fighterFirst ? fighterCombatant : baseCombatant;
            const rightCombatant = fighterFirst ? baseCombatant : fighterCombatant;
            combats.push({
                id: `${leftCombatant.id}::${rightCombatant.id}`,
                leftCombatantId: leftCombatant.id,
                rightCombatantId: rightCombatant.id,
                leftUnitIds: [...leftCombatant.unitIds],
                rightUnitIds: [...rightCombatant.unitIds],
                leftPrimaryId: fighterFirst ? fighter.id : base.id,
                rightPrimaryId: fighterFirst ? base.id : fighter.id,
                edgesOnLeft: fighterFirst ? contact.edgesOnLeft : contact.edgesOnRight,
                edgesOnRight: fighterFirst ? contact.edgesOnRight : contact.edgesOnLeft,
                strongholdFighterId: fighter.id,
                strongholdSupportIds: support.map((unit) => unit.id)
            });
            participantIds.add(base.id);
            participantIds.add(fighter.id);
            support.forEach((unit) => participantIds.add(unit.id));
        });
            return {
                ...setup,
                combats,
                fightingCombatantIds: fightingIdsFrom(combats),
                participantIds
            };
    }


    function buildMeleeCombatSide(combatant, opponentCombatant, incomingEdges, role, adjustedCombats, combatants, fightingCombatantIds, terrain, combat) {
        const unit = fightingUnit(combatant, combat);
        const opponent = fightingUnit(opponentCombatant, combat);
        const supporters = unit.type === 'Base' ? strongholdSupporters(combat, combatants) : [];
        const supportContacts = combat?.supportTargetCombatantId === combatant.id
            ? (combat.supportContacts || [])
            : [];
        const strength = getUnitStrengthAgainst(unit, opponent);
        const modifiers = getCombatModifiers({
            phase: 'melee',
            role,
            unit,
            opponent,
            combatant,
            opponentCombatant,
            incomingEdges,
            supportContacts,
            combats: adjustedCombats,
            combatants,
            fightingCombatantIds,
            terrain,
            strongholdSupporters: supporters
        });
        return {
            combatantId: combatant.id,
            playerId: combatant.playerId,
            primaryId: unit.id,
            primaryType: unit.type,
            troopClass: unit.troopClass,
            unitIds: [...combatant.unitIds],
            unitTypes: combatant.units.map((entry) => entry.type),
            strength,
            modifiers,
            factor: strength + sumModifiers(modifiers),
            center: geometry.getUnitCenter(unit)
        };
    }


    function unionEdgeNames(left, right) {
        return [...new Set([...(left || []), ...(right || [])])];
    }


    function collapseSharedAssaults(setup) {
        const combatantsById = setup.combatantsById;
        let combats = setup.combats.map((combat) => ({
            ...combat,
            edgesOnLeft: [...(combat.edgesOnLeft || [])],
            edgesOnRight: [...(combat.edgesOnRight || [])]
        }));
        const consumed = new Set();
        const grouped = new Map();
        combats.forEach((combat) => {
            [combat.leftCombatantId, combat.rightCombatantId].forEach((combatantId) => {
                if (!grouped.has(combatantId)) {
                    grouped.set(combatantId, []);
                }
                grouped.get(combatantId).push(combat);
            });
        });

        grouped.forEach((group, combatantId) => {
            const shared = combatantsById.get(combatantId);
            if (!shared || shared.units.some((unit) => unit.type === 'Base') || shared.units.some((unit) => isStationaryUnit(unit))) {
                return;
            }
            const live = group.filter((combat) => !consumed.has(combat.id));
            if (live.length < 2) {
                return;
            }
            const opponents = live.map((combat) => {
                const sharedIsLeft = combat.leftCombatantId === combatantId;
                return {
                    combat,
                    opponentId: sharedIsLeft ? combat.rightCombatantId : combat.leftCombatantId,
                    edgesOnShared: sharedIsLeft ? combat.edgesOnLeft : combat.edgesOnRight,
                    edgesOnOpponent: sharedIsLeft ? combat.edgesOnRight : combat.edgesOnLeft
                };
            });
            const facingFront = opponents.filter((entry) => entry.edgesOnShared.includes('front'));
            const pool = (facingFront.length > 0 ? facingFront : opponents).slice().sort((left, right) => {
                const leftFront = left.edgesOnOpponent.includes('front') ? 0 : 1;
                const rightFront = right.edgesOnOpponent.includes('front') ? 0 : 1;
                if (leftFront !== rightFront) {
                    return leftFront - rightFront;
                }
                return left.opponentId.localeCompare(right.opponentId);
            });
            const main = pool[0];
            const supports = opponents.filter((entry) => entry.opponentId !== main.opponentId);
            const sharedIsLeft = main.combat.leftCombatantId === combatantId;
            const supportEdges = supports.flatMap((entry) => entry.edgesOnShared);
            if (sharedIsLeft) {
                main.combat.edgesOnLeft = unionEdgeNames(main.combat.edgesOnLeft, supportEdges);
            } else {
                main.combat.edgesOnRight = unionEdgeNames(main.combat.edgesOnRight, supportEdges);
            }
            main.combat.supportTargetCombatantId = combatantId;
            main.combat.supportCombatantIds = supports.map((entry) => entry.opponentId);
            main.combat.supportContacts = supports.map((entry) => ({
                combatantId: entry.opponentId,
                edgesOnTarget: [...entry.edgesOnShared]
            }));
            supports.forEach((entry) => consumed.add(entry.combat.id));
        });

        combats = combats.filter((combat) => !consumed.has(combat.id));
        const participantIds = new Set(setup.participantIds);
        combats.forEach((combat) => {
            (combat.supportCombatantIds || []).forEach((combatantId) => {
                const combatant = combatantsById.get(combatantId);
                combatant?.unitIds.forEach((unitId) => participantIds.add(unitId));
            });
        });
        return {
            ...setup,
            combats,
            participantIds
        };
    }


    function buildPostFacingCombatSetup(units, random) {
        const combatSetup = detectMeleeCombats(units);
        const facingPlans = buildCombatFacingPlans(combatSetup);
        const facedUnits = applyCombatFacing(units, combatSetup, facingPlans);
        const postFacingSetup = detectMeleeCombats(facedUnits);
        const combatantsById = new Map(postFacingSetup.combatants.map((combatant) => [combatant.id, combatant]));
        const shared = collapseSharedAssaults({
            facedUnits,
            combats: postFacingSetup.combats,
            combatants: postFacingSetup.combatants,
            combatantsById,
            participantIds: postFacingSetup.participantIds
        });
        return collapseStrongholdAssaults(shared, random);
    }


    function previewMeleeCombats(units, terrain) {
        const { combats, combatants, combatantsById, fightingCombatantIds } = buildPostFacingCombatSetup(units);
        return combats.map((combat) => {
            const leftCombatant = combatantsById.get(combat.leftCombatantId);
            const rightCombatant = combatantsById.get(combat.rightCombatantId);
            const left = buildMeleeCombatSide(
                leftCombatant,
                rightCombatant,
                combat.edgesOnLeft,
                'attacker',
                combats,
                combatants,
                fightingCombatantIds,
                terrain,
                combat
            );
            const right = buildMeleeCombatSide(
                rightCombatant,
                leftCombatant,
                combat.edgesOnRight,
                'defender',
                combats,
                combatants,
                fightingCombatantIds,
                terrain,
                combat
            );
            return {
                id: combat.id,
                left,
                right,
                position: geometry.midpoint(left.center, right.center)
            };
        });
    }


    function resolveMelee(units, terrain, rollDie, random = Math.random) {
        const { facedUnits: mutableStartingUnits, combats: adjustedCombats, combatantsById, fightingCombatantIds, participantIds } = buildPostFacingCombatSetup(units, random);
        const results = [];
        const recoilDestructions = [];
        const combatants = [...combatantsById.values()];

        adjustedCombats.forEach((combat) => {
            const leftCombatant = combatantsById.get(combat.leftCombatantId);
            const rightCombatant = combatantsById.get(combat.rightCombatantId);
            const leftUnit = fightingUnit(leftCombatant, combat);
            const rightUnit = fightingUnit(rightCombatant, combat);
            const leftSupporters = leftUnit.type === 'Base' ? strongholdSupporters(combat, combatants) : [];
            const rightSupporters = rightUnit.type === 'Base' ? strongholdSupporters(combat, combatants) : [];
            const leftModifiers = getCombatModifiers({
                phase: 'melee',
                role: 'attacker',
                unit: leftUnit,
                opponent: rightUnit,
                combatant: leftCombatant,
                opponentCombatant: rightCombatant,
                incomingEdges: combat.edgesOnLeft,
                supportContacts: combat.supportTargetCombatantId === leftCombatant.id ? (combat.supportContacts || []) : [],
                combats: adjustedCombats,
                combatants,
                fightingCombatantIds,
                terrain,
                strongholdSupporters: leftSupporters
            });
            const rightModifiers = getCombatModifiers({
                phase: 'melee',
                role: 'defender',
                unit: rightUnit,
                opponent: leftUnit,
                combatant: rightCombatant,
                opponentCombatant: leftCombatant,
                incomingEdges: combat.edgesOnRight,
                supportContacts: combat.supportTargetCombatantId === rightCombatant.id ? (combat.supportContacts || []) : [],
                combats: adjustedCombats,
                combatants,
                fightingCombatantIds,
                terrain,
                strongholdSupporters: rightSupporters
            });
            const leftRoll = rollDie({ role: 'left', combatId: combat.id, leftPrimaryId: leftUnit.id, rightPrimaryId: rightUnit.id });
            const rightRoll = rollDie({ role: 'right', combatId: combat.id, leftPrimaryId: leftUnit.id, rightPrimaryId: rightUnit.id });
            const leftTotal = leftRoll + getUnitStrengthAgainst(leftUnit, rightUnit) + sumModifiers(leftModifiers);
            const rightTotal = rightRoll + getUnitStrengthAgainst(rightUnit, leftUnit) + sumModifiers(rightModifiers);
            const supportIds = (combat.supportCombatantIds || []).flatMap((combatantId) => combatantsById.get(combatantId)?.unitIds || []);
            const leftUnitIds = [...leftCombatant.unitIds];
            const rightUnitIds = [...rightCombatant.unitIds];
            if (combat.supportTargetCombatantId === leftCombatant.id) {
                rightUnitIds.push(...supportIds);
            } else if (combat.supportTargetCombatantId === rightCombatant.id) {
                leftUnitIds.push(...supportIds);
            }
            const result = {
                combatId: combat.id,
                leftCombatantId: leftCombatant.id,
                rightCombatantId: rightCombatant.id,
                leftUnitIds,
                rightUnitIds,
                leftPrimaryId: leftUnit.id,
                rightPrimaryId: rightUnit.id,
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
            const winnerUnit = leftWon ? leftUnit : rightUnit;
            const loserUnit = leftWon ? rightUnit : leftUnit;
            result.loserCombatantId = loserCombatant.id;
            const highTotal = Math.max(leftTotal, rightTotal);
            const lowTotal = Math.min(leftTotal, rightTotal);
            const lossResolution = resolveCombatLoss(
                winnerUnit,
                loserUnit,
                'melee',
                terrain,
                highTotal >= lowTotal * 2
            );
            result.outcome = lossResolution.outcome;
            result.destructionRule = lossResolution.destructionRule;
            if (lossResolution.outcome === 'base-fall' && isAerialUnit(winnerUnit)) {
                result.outcome = 'tie';
                result.loserCombatantId = null;
                result.destructionRule = 'Aerials alone cannot capture a base.';
                results.push(result);
                return;
            }
            if (lossResolution.outcome === 'destroy' || lossResolution.outcome === 'base-fall') {
                results.push(result);
                return;
            }
            const incomingEdges = leftWon ? combat.edgesOnRight : combat.edgesOnLeft;
            if (incomingEdges.some(isRearEdgeName)) {
                result.recoilRotation = winnerUnit.rotation;
            }
            results.push(result);
        });

        const destroyedIds = new Set();
        const ensorcelledIds = new Map();
        const lurkerReturnedIds = new Map();
        const recoilQueue = [];
        let baseFellPlayerId = null;
        results.forEach((result) => {
            if (!result.loserCombatantId) {
                return;
            }
            const loserCombatant = combatantsById.get(result.loserCombatantId);
            const winnerCombatant = result.loserCombatantId === result.leftCombatantId
                ? combatantsById.get(result.rightCombatantId)
                : combatantsById.get(result.leftCombatantId);
            if (result.outcome === 'destroy' || result.outcome === 'base-fall') {
                loserCombatant.unitIds.forEach((unitId) => destroyedIds.add(unitId));
                if (result.outcome === 'base-fall') {
                    baseFellPlayerId = getPlayerId(loserCombatant.primaryUnit);
                }
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
            if (result.outcome === 'lurk-return') {
                loserCombatant.unitIds.forEach((unitId) => lurkerReturnedIds.set(unitId, 'combat'));
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

        let mutableUnits = mutableStartingUnits.filter((unit) => (
            !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id) && !lurkerReturnedIds.has(unit.id)
        ));
        recoilQueue.forEach((entry) => {
            if (entry.combatant.unitIds.some((unitId) => destroyedIds.has(unitId))) {
                return;
            }
            const recoil = resolveCombatantRecoil(entry.combatant, mutableUnits, terrain, { targetRotation: entry.targetRotation });
            if (recoil.destroyedIds.length > 0) {
                recoil.destroyedIds.forEach((unitId) => {
                    recoilDestructions.push({
                        unitId,
                        kind: 'recoil',
                        rotation: entry.targetRotation ?? null,
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
                        kind: 'flee',
                        reason: flee.destructionReasons[unitId] || 'flee destruction reason unavailable'
                    });
                });
                flee.destroyedIds.forEach((unitId) => destroyedIds.add(unitId));
                mutableUnits = mutableUnits.filter((unit) => !destroyedIds.has(unit.id));
                return;
            }
            mutableUnits = flee.units;
        });

        const isolatedLurkers = findIsolatedLurkers(mutableUnits, terrain);
        isolatedLurkers.forEach((unit) => {
            if (!lurkerReturnedIds.has(unit.id)) {
                lurkerReturnedIds.set(unit.id, 'isolation');
            }
        });
        const lurkerReturnedUnits = [...lurkerReturnedIds.entries()].map(([unitId, reason]) => {
            const unit = isolatedLurkers.find((entry) => entry.id === unitId)
                || mutableStartingUnits.find((entry) => entry.id === unitId);
            return unit ? { ...cloneUnit(unit), lurkerReturnReason: reason } : null;
        }).filter(Boolean);
        mutableUnits = mutableUnits.filter((unit) => !lurkerReturnedIds.has(unit.id));

        const destroyedUnits = mutableStartingUnits.filter((unit) => destroyedIds.has(unit.id)).map(cloneUnit);
        const ensorcelledUnits = [...ensorcelledIds.entries()].map(([unitId, ensorcelledByUnitId]) => {
            const unit = mutableStartingUnits.find((entry) => entry.id === unitId);
            return unit ? buildEnsorcelledUnit(unit, ensorcelledByUnitId) : null;
        }).filter(Boolean);
        return {
            units: mutableUnits.filter((unit) => (
                !destroyedIds.has(unit.id) && !ensorcelledIds.has(unit.id) && !lurkerReturnedIds.has(unit.id)
            )),
            destroyedUnits,
            ensorcelledUnits,
            lurkerReturnedUnits,
            results,
            recoilDestructions,
            baseFellPlayerId,
            combats: adjustedCombats,
            combatants: [...combatantsById.values()],
            participantIds
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
        getTypeQuickKillInfo,
        resolveCombatLoss,
        getUnitStrengthAgainst,
        choosePrimaryAttacker,
        sumModifiers,
        resolveMelee
    };
}));
