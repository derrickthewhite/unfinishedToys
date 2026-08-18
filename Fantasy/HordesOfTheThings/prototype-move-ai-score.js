(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js')
        );
        return;
    }
    root.HordesMoveAiScore = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    function getGrouping() {
        if (typeof module !== 'undefined' && module.exports) {
            return require('./prototype-move-ai-candidates.js');
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


    return {
        AUTO_MOVE_WEIGHTS,
        scoreCandidate,
        scoreFightQuality,
        scoreFormationSupport,
        scoreRecoilRisk,
        scoreAdvance,
        formatBreakdownValue,
        getFormUpPreviewCombats,
        getActivePreviewSide,
        combatInvolvesMovedUnits,
        getCombatAdvantage
    };
}));
