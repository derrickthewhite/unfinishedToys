(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('../rules/index.js')
        );
        return;
    }
    root.HordesMoveAiScore = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    function getGrouping() {
        if (typeof module !== 'undefined' && module.exports) {
            return require('./move-candidates.js');
        }
        return (typeof globalThis !== 'undefined' ? globalThis : this).HordesMoveAiCandidates;
    }

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
        advance: 0.6,
        splitEfficiency: 0.5,
        cohesion: 2,
        terrain: 1.5,
        formationApproach: 1.2,
        lateralReposition: 1,
        ensorcelledReturn: 1,
        stationaryShooter: 2,
        rangeBand: 1.5,
        rangedOpportunity: 1.5
    });

    const MATCHUP_SCALE = 0.25;

    const NEW_CONTACT_BONUS = 1;

    const FAVORABLE_NEW_CONTACT_BONUS = 0.5;

    const SHUFFLE_PENALTY = 0.35;

    const STACK_BREAK_PENALTY = 0.75;

    const DRESS_JOIN_BONUS = 0.6;

    const DRESS_PARTNER_SCALE = 0.2;

    const FORMATION_APPROACH_SCALE = 0.8;

    const LATERAL_REPOSITION_BONUS = 0.2;

    const STUCK_FORWARD_THRESHOLD = 0.25;

    const STUCK_FORWARD_SIDESTEP_BONUS = 0.2;

    const ENSORCELLED_RETURN_VALUE_SCALE = 2.5;

    const ENSORCELLED_SIX_PIP_BONUS = 6;

    const WATER_ESCAPE_BONUS = 1.2;

    const BAD_TERRAIN_ESCAPE_SCALE = 0.75;

    const RECOIL_DEATH_PENALTY = 1.25;

    const PINCH_RELIEF_BONUS = 0.4;

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
        const sacrificingShooterIds = getSacrificingShooterIds(beforeUnits, movedUnitIds, terrain, activePlayerId);

        let fight = getCombatAdvantageForPlayer(afterPreviews, activePlayerId)
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
            const sacrificesLiveShot = previewInvolvesSacrificingShooter(
                afterPreview,
                sacrificingShooterIds,
                activePlayerId
            );

            const beforePreview = beforeByFingerprint.get(getCombatFingerprint(afterPreview));
            if (beforePreview) {
                modifiers += getModifierQuality(afterSides.active);
                const afterMatchup = data.getDeploymentMatchupScore(
                    afterSides.active.primaryType,
                    afterSides.opponent.primaryType
                ) * MATCHUP_SCALE;
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

            if (sacrificesLiveShot) {
                fight -= getCombatAdvantage(afterSides.active, afterSides.opponent);
                return;
            }

            modifiers += getModifierQuality(afterSides.active);
            matchup += data.getDeploymentMatchupScore(
                afterSides.active.primaryType,
                afterSides.opponent.primaryType
            ) * MATCHUP_SCALE;
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
        getGrouping().findRankSegments(sameFacing).forEach((segment) => {
            if (segment.some((entry) => entry.id === unitId)) {
                partners = Math.max(partners, segment.length - 1);
            }
        });
        getGrouping().findFileSegments(sameFacing).forEach((segment) => {
            if (segment.some((entry) => entry.id === unitId)) {
                partners = Math.max(partners, segment.length - 1);
            }
        });
        return partners;
    }


    function getNearestSameTypeFriendlyDistance(units, unitId, activePlayerId, getPlayerId, movedUnitIds) {
        const unit = units.find((entry) => entry.id === unitId);
        if (!unit) {
            return Infinity;
        }
        const movedSet = new Set(movedUnitIds);
        const center = geometry.getUnitCenter(unit);
        let nearest = Infinity;
        units.forEach((entry) => {
            if (getPlayerId(entry) !== activePlayerId || entry.inReserve || entry.id === unitId) {
                return;
            }
            if (entry.type !== unit.type || movedSet.has(entry.id)) {
                return;
            }
            if (Math.abs(geometry.normalizeAngle(entry.rotation - unit.rotation)) > 0.12) {
                return;
            }
            nearest = Math.min(nearest, geometry.distance(center, geometry.getUnitCenter(entry)));
        });
        return nearest;
    }


    function scoreFormationApproach(beforeUnits, afterUnits, activePlayerId, getPlayerId, movedUnitIds) {
        if (movedUnitIds.length === 0) {
            return 0;
        }
        const gain = movedUnitIds.reduce((sum, unitId) => {
            const beforeDistance = getNearestSameTypeFriendlyDistance(
                beforeUnits,
                unitId,
                activePlayerId,
                getPlayerId,
                movedUnitIds
            );
            const afterDistance = getNearestSameTypeFriendlyDistance(
                afterUnits,
                unitId,
                activePlayerId,
                getPlayerId,
                movedUnitIds
            );
            if (!Number.isFinite(beforeDistance) || !Number.isFinite(afterDistance)) {
                return sum;
            }
            const delta = beforeDistance - afterDistance;
            if (delta <= data.FORMATION_GAP_TOLERANCE) {
                return sum;
            }
            return sum + (delta / 100) * FORMATION_APPROACH_SCALE;
        }, 0);
        return gain / movedUnitIds.length;
    }


    function scoreLateralReposition(moveKind, breakdown, forwardScore = null) {
        if (!moveKind || !moveKind.startsWith('sidestep')) {
            return 0;
        }
        if (breakdown.fight < 0 || breakdown.newContact < 0) {
            return 0;
        }
        if (breakdown.fight !== 0 || breakdown.newContact > 0) {
            return 0;
        }
        let bonus = LATERAL_REPOSITION_BONUS;
        if (forwardScore !== null && forwardScore < STUCK_FORWARD_THRESHOLD) {
            bonus += STUCK_FORWARD_SIDESTEP_BONUS;
        }
        return bonus;
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
        const sacrificingShooterIds = getSacrificingShooterIds(beforeUnits, movedUnitIds, terrain, activePlayerId);
        const beforeStacked = sumStackedModifiers(beforePreviews, activePlayerId, movedUnitIds);
        const afterStacked = sumStackedModifiers(afterPreviews, activePlayerId, movedUnitIds);
        const beforeCombatUnits = sumActiveCombatUnits(beforePreviews, activePlayerId, movedUnitIds);
        const afterCombatUnits = sumActiveCombatUnits(afterPreviews, activePlayerId, movedUnitIds);
        const sacrificingNewCombatUnits = sacrificingShooterIds.length === 0
            ? 0
            : afterPreviews.reduce((sum, preview) => {
                if (!previewInvolvesSacrificingShooter(preview, sacrificingShooterIds, activePlayerId)) {
                    return sum;
                }
                const fingerprint = getCombatFingerprint(preview);
                if (beforePreviews.some((beforePreview) => getCombatFingerprint(beforePreview) === fingerprint)) {
                    return sum;
                }
                const sides = getActivePreviewSide(preview, activePlayerId);
                return sum + (sides ? sides.active.unitIds.length : 0);
            }, 0);

        let formationSize = 0;
        if (afterStacked > beforeStacked) {
            formationSize += afterStacked - beforeStacked;
        }
        const combatUnitGain = afterCombatUnits - beforeCombatUnits - sacrificingNewCombatUnits;
        if (combatUnitGain > 0 && afterStacked >= beforeStacked) {
            formationSize += combatUnitGain * 0.15;
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


    function hasValidShootingTarget(unit, allUnits, terrain, activePlayerId) {
        return allUnits.some((other) => (
            !other.inReserve
            && rules.isValidShootingAttack(unit, other, allUnits, terrain, activePlayerId)
        ));
    }


    function unitSacrificesLiveRangedShot(unit, beforeUnits, terrain, activePlayerId) {
        if (!unit || !unit.ranged) {
            return false;
        }
        if (!unit.ranged.requiresStationary && !unit.ranged.requiresOwnTurn) {
            return false;
        }
        return hasValidShootingTarget(unit, beforeUnits, terrain, activePlayerId);
    }


    function getSacrificingShooterIds(beforeUnits, movedUnitIds, terrain, activePlayerId) {
        return movedUnitIds.filter((unitId) => {
            const unit = beforeUnits.find((entry) => entry.id === unitId);
            return unitSacrificesLiveRangedShot(unit, beforeUnits, terrain, activePlayerId);
        });
    }


    function previewInvolvesSacrificingShooter(preview, sacrificingIds, activePlayerId) {
        return sacrificingIds.some((unitId) => combatInvolvesMovedUnits(preview, [unitId], activePlayerId));
    }


    /**
     * Penalty when a candidate moves a unit that would sacrifice a live ranged attack.
     * Only fires when the unit actually has a valid target right now — so Artillery that
     * hasn't reached shooting range yet is free to advance.
     */
    function scoreStationaryShooter(beforeUnits, movedUnitIds, terrain, getPlayerId) {
        return movedUnitIds.reduce((sum, unitId) => {
            const unit = beforeUnits.find((entry) => entry.id === unitId);
            if (!unit || !unit.ranged) {
                return sum;
            }
            if (!unit.ranged.requiresStationary && !unit.ranged.requiresOwnTurn) {
                return sum;
            }
            // Only penalise when there is actually a live target to sacrifice.
            const hasTargets = hasValidShootingTarget(unit, beforeUnits, terrain, getPlayerId(unit));
            return hasTargets ? sum - 1 : sum;
        }, 0);
    }


    /**
     * Scores the value of ranged attack opportunities that exist BEFORE this move.
     * Used to reward keeping ranged units in position and to penalise moving them away.
     *
     * Ranged combat is asymmetric: the attacker can never lose (a defender win = no-effect),
     * so even a matched 3v3 shot is always worth taking. The scoring reflects this:
     * - Base advantage: attacker strength vs defender strength (like fight, but ranged).
     * - Asymmetry bonus: a fixed positive reward whenever an attack is available at all,
     *   because even a losing roll does nothing to the attacker.
     *
     * A moving candidate loses these scores because the ranged unit won't be stationary.
     */
    /**
     * Scores the *quality* of the best ranged opportunity that would be lost by moving.
     * scoreStationaryShooter already provides a flat "you're giving up a shot" penalty;
     * this adds the quality differential so better targets (vs weak enemies, or favourable
     * matchups) produce a stronger discouragement. Returns a negative value (opportunity cost).
     *
     * Also handles the positive side: Magicians (requiresOwnTurn) with an enemy in range
     * score positively for the *candidate* that keeps them stationary — but since we score
     * the moving candidate, we only apply the negative here.
     */
    function scoreRangedOpportunity(beforeUnits, movedUnitIds, activePlayerId, enemyPlayerId, getPlayerId, terrain) {
        const meleeIds = getPlayerMeleeUnitIds(beforeUnits, activePlayerId, getPlayerId);
        let total = 0;

        movedUnitIds.forEach((unitId) => {
            const unit = beforeUnits.find((entry) => entry.id === unitId);
            if (!unit || !unit.ranged || meleeIds.has(unitId)) {
                return;
            }
            const losesShot = unit.ranged.requiresStationary || unit.ranged.requiresOwnTurn;
            if (!losesShot) {
                return;
            }

            let bestScore = 0;
            beforeUnits.forEach((enemy) => {
                if (getPlayerId(enemy) !== enemyPlayerId || enemy.inReserve) {
                    return;
                }
                if (!rules.isValidShootingAttack(unit, enemy, beforeUnits, terrain, activePlayerId)) {
                    return;
                }
                const attackStrength = unit.strength
                    ? (unit.strength[enemy.troopClass] || unit.strength.infantry || 0)
                    : 0;
                const defendStrength = enemy.strength
                    ? (enemy.strength[unit.troopClass] || enemy.strength.infantry || 0)
                    : 0;
                // Asymmetry bonus: attacker can't lose a ranged exchange (defender win = no-effect).
                // Even parity shots are net-positive, so any valid target has positive value.
                const asymmetryBonus = 0.15 + (attackStrength / 50);
                const rawAdvantage = (attackStrength - defendStrength) / 12;
                bestScore = Math.max(bestScore, rawAdvantage + asymmetryBonus);
            });

            // Only penalise the quality delta — the flat "giving up a shot" cost
            // is already handled by scoreStationaryShooter.
            if (bestScore > 0) {
                total -= bestScore;
            }
        });

        return total;
    }


    /**
     * Penalty when a ranged unit that is NOT currently in melee advances so close to an
     * enemy that it will be within easy charge range next turn. Reward for staying inside
     * its own shooting range but outside melee contact.
     *
     * "Danger distance" = largest single-turn move of any enemy unit (approximated by
     * checking the nearest enemy's moves.good value).
     */
    function scoreRangeBand(beforeUnits, afterUnits, movedUnitIds, activePlayerId, enemyPlayerId, getPlayerId, terrain) {
        const meleeAfter = getPlayerMeleeUnitIds(afterUnits, activePlayerId, getPlayerId);
        const enemies = afterUnits.filter(
            (unit) => getPlayerId(unit) === enemyPlayerId && !unit.inReserve
        );
        if (enemies.length === 0) {
            return 0;
        }

        let total = 0;
        movedUnitIds.forEach((unitId) => {
            const unit = afterUnits.find((entry) => entry.id === unitId);
            if (!unit || !unit.ranged || !unit.ranged.range) {
                return;
            }
            // Only penalise/reward movement for units not already locked in melee.
            if (meleeAfter.has(unitId)) {
                return;
            }

            const unitCenter = geometry.getUnitCenter(unit);
            let closestEnemy = null;
            let closestDist = Infinity;
            enemies.forEach((enemy) => {
                const dist = geometry.distance(unitCenter, geometry.getUnitCenter(enemy));
                if (dist < closestDist) {
                    closestDist = dist;
                    closestEnemy = enemy;
                }
            });
            if (!closestEnemy) {
                return;
            }

            const shootRange = unit.ranged.range;
            // Approximate danger radius: the closest enemy's best single-move distance.
            const enemyMoveRange = Math.max(
                closestEnemy.moves.road,
                closestEnemy.moves.good,
                closestEnemy.moves.bad
            );

            // Unit has blundered inside a distance from which the enemy can charge next turn.
            if (closestDist < enemyMoveRange + unit.depth) {
                total -= 1;
            } else if (closestDist <= shootRange) {
                // Within own shooting range and not in danger — a mild positive.
                total += 0.2;
            }
        });
        return total;
    }


    /**
     * Returns a penalty (negative) when a forward move restricts fast units to the speed of
     * slow ones, AND the player still has moves remaining to spend on a split.
     *
     * actualDistance  — how far the group actually moved (from the forward probe)
     * units           — the board state before moving
     * movedUnitIds    — ids of units in this candidate
     * remainingMoves  — PIPs left after this move would be spent
     */
    function scoreSplitEfficiency(actualDistance, units, movedUnitIds, remainingMoves) {
        if (movedUnitIds.length <= 1 || remainingMoves < 1) {
            return 0;
        }
        const perUnitMax = movedUnitIds.map((unitId) => {
            const unit = units.find((entry) => entry.id === unitId);
            if (!unit) {
                return 0;
            }
            return Math.max(unit.moves.road, unit.moves.good, unit.moves.bad);
        });
        const maxPossible = Math.max(...perUnitMax);
        if (maxPossible <= 0 || actualDistance <= 0) {
            return 0;
        }
        // Fraction of movement range that is wasted by dragging slower units.
        // Only meaningful when there is a real spread between best and worst.
        const slowest = Math.min(...perUnitMax);
        const throttleRatio = 1 - (slowest / maxPossible);
        if (throttleRatio <= 0.1) {
            return 0;
        }
        // Diminish penalty when we barely have a move to spare, amplify when we have many.
        const movesBonus = Math.min(remainingMoves - 1, 2) / 2;
        return -throttleRatio * movesBonus;
    }


    function scoreEnsorcelledReturn(ensorcelledUnit, returnCost, remainingMoves) {
        if (!ensorcelledUnit || ensorcelledUnit.ensorcelledByUnitId === undefined) {
            return 0;
        }
        const template = data.UNIT_TYPES[ensorcelledUnit.type];
        const unitValue = ensorcelledUnit.value ?? template?.value ?? 1;
        let bonus = unitValue * ENSORCELLED_RETURN_VALUE_SCALE;
        if (returnCost >= data.ENSORCELLED_RETURN_MOVE_COST && remainingMoves >= returnCost) {
            bonus += ENSORCELLED_SIX_PIP_BONUS;
        } else if (returnCost === 0) {
            bonus += 3;
        }
        return bonus;
    }


    function scoreCandidate(beforeUnits, afterUnits, activePlayerId, enemyPlayerId, getPlayerId, movedUnitIds, terrain, opts = {}) {
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
        const splitEff = opts.moveKind === 'forward'
            ? scoreSplitEfficiency(opts.distance ?? 0, beforeUnits, movedUnitIds, opts.remainingMoves ?? 0)
            : 0;
        const breakdown = {
            ...fightQuality,
            ...formationQuality,
            ...recoilQuality,
            reserveEntry: scoreReserveEntry(beforeUnits, afterUnits, movedUnitIds),
            advance: scoreAdvance(beforeUnits, afterUnits, movedUnitIds, activePlayerId, enemyPlayerId, getPlayerId),
            splitEfficiency: splitEff,
            stationaryShooter: scoreStationaryShooter(beforeUnits, movedUnitIds, terrain, getPlayerId),
            rangeBand: scoreRangeBand(
                beforeUnits, afterUnits, movedUnitIds,
                activePlayerId, enemyPlayerId, getPlayerId, terrain
            ),
            rangedOpportunity: scoreRangedOpportunity(
                beforeUnits, movedUnitIds,
                activePlayerId, enemyPlayerId, getPlayerId, terrain
            ),
            cohesion: opts.moveKind === 'reserve-deploy' || opts.moveKind === 'ensorcelled-return'
                ? 0
                : scoreCohesion(beforeUnits, afterUnits, activePlayerId, getPlayerId),
            terrain: scoreTerrain(beforeUnits, afterUnits, movedUnitIds, terrain),
            formationApproach: scoreFormationApproach(
                beforeUnits,
                afterUnits,
                activePlayerId,
                getPlayerId,
                movedUnitIds
            ),
            lateralReposition: scoreLateralReposition(opts.moveKind, {
                fight: fightQuality.fight,
                newContact: fightQuality.newContact
            }, opts.forwardScore ?? null),
            ensorcelledReturn: opts.moveKind === 'ensorcelled-return'
                ? scoreEnsorcelledReturn(
                    opts.ensorcelledUnit,
                    opts.ensorcelledReturnCost ?? 0,
                    opts.remainingMoves ?? 0
                )
                : 0
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
            + breakdown.splitEfficiency * AUTO_MOVE_WEIGHTS.splitEfficiency
            + breakdown.stationaryShooter * AUTO_MOVE_WEIGHTS.stationaryShooter
            + breakdown.rangeBand * AUTO_MOVE_WEIGHTS.rangeBand
            + breakdown.rangedOpportunity * AUTO_MOVE_WEIGHTS.rangedOpportunity
            + breakdown.cohesion * AUTO_MOVE_WEIGHTS.cohesion
            + breakdown.terrain * AUTO_MOVE_WEIGHTS.terrain
            + breakdown.formationApproach * AUTO_MOVE_WEIGHTS.formationApproach
            + breakdown.lateralReposition * AUTO_MOVE_WEIGHTS.lateralReposition
            + breakdown.ensorcelledReturn * AUTO_MOVE_WEIGHTS.ensorcelledReturn
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
        let gains = 0;
        let counted = 0;
        movedUnitIds.forEach((unitId) => {
            const before = beforeUnits.find((unit) => unit.id === unitId);
            const after = afterUnits.find((unit) => unit.id === unitId);
            if (!after) {
                return;
            }
            if (!before) {
                const afterDistance = geometry.distance(geometry.getUnitCenter(after), enemyCentroid);
                gains += (data.BOARD_SIZE - afterDistance) / 100;
                counted += 1;
                return;
            }
            const beforeDistance = geometry.distance(geometry.getUnitCenter(before), enemyCentroid);
            const afterDistance = geometry.distance(geometry.getUnitCenter(after), enemyCentroid);
            gains += (beforeDistance - afterDistance) / 100;
            counted += 1;
        });
        if (counted === 0) {
            return 0;
        }
        // Mean distance gained per unit × √n: rewards moving more material without letting
        // a slow rank dominate over a smaller faster group.
        return (gains / counted) * Math.sqrt(counted);
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
            const beforeTerrain = rules.sampleUnitTerrain(before, terrain);
            const afterTerrain = rules.sampleUnitTerrain(after, terrain);
            const beforeSeverity = rules.severityFromTerrain(beforeTerrain);
            const afterSeverity = rules.severityFromTerrain(afterTerrain);
            let unitDelta = prefersBad
                ? (afterSeverity - beforeSeverity) * 0.5
                : (beforeSeverity - afterSeverity);
            if (!prefersBad && beforeSeverity > rules.TERRAIN_SEVERITY.good && unitDelta > 0) {
                unitDelta *= 1 + ((beforeSeverity - rules.TERRAIN_SEVERITY.good) * BAD_TERRAIN_ESCAPE_SCALE);
            }
            if (!prefersBad && beforeTerrain.has('water') && !afterTerrain.has('water')) {
                unitDelta += WATER_ESCAPE_BONUS;
            }
            return sum + unitDelta;
        }, 0);
        return delta / movedUnitIds.length;
    }


    return {
        AUTO_MOVE_WEIGHTS,
        scoreCandidate,
        scoreFightQuality,
        scoreFormationSupport,
        scoreRecoilRisk,
        scoreAdvance,
        scoreSplitEfficiency,
        scoreStationaryShooter,
        scoreRangeBand,
        scoreRangedOpportunity,
        scoreEnsorcelledReturn,
        formatBreakdownValue,
        getFormUpPreviewCombats,
        getActivePreviewSide,
        combatInvolvesMovedUnits,
        getCombatAdvantage
    };
}));
