(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../data.js'), require('../rules/index.js'));
        return;
    }
    root.HordesShootingAi = factory(root.HordesData, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, rules) {
    function scoreShootingTarget(attacker, target) {
        if (!target) {
            return -Infinity;
        }
        let score = target.value || 0;
        if (target.type === 'Hero' || target.type === 'Magician' || target.type === 'Behemoth') {
            score += 2;
        }
        if (attacker?.type === 'Shooter' && target.troopClass === 'mounted') {
            score += 1;
        }
        if (target.movedThisTurn) {
            score += 0.25;
        }
        return score;
    }

    function pickBestShootingTarget(unit, units, terrain, activePlayerId) {
        const targetIds = rules.getValidShootingTargets(unit, units, terrain, activePlayerId);
        let best = null;
        targetIds.forEach((targetId) => {
            const target = units.find((entry) => entry.id === targetId);
            const score = scoreShootingTarget(unit, target);
            if (!best || score > best.score) {
                best = { targetId, score };
            }
        });
        return best?.targetId || null;
    }

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            declareComputerShooting(playerId) {
                if (!this.state.computerShotsDeclared) {
                    this.state.computerShotsDeclared = {
                        'player-1': false,
                        'player-2': false
                    };
                }
                this.state.computerShotsDeclared[playerId] = true;
                if (this.state.mode !== 'game' || this.state.phase !== 'shooting' || this.state.combatResolution) {
                    return;
                }
                const shooting = this.getShootingState();
                this.state.units.forEach((unit) => {
                    if (this.getUnitPlayerId(unit) !== playerId || !this.needsShootingDeclaration(unit)) {
                        return;
                    }
                    const targetId = pickBestShootingTarget(
                        unit,
                        this.state.units,
                        this.state.terrain,
                        this.state.activePlayerId
                    );
                    if (!targetId) {
                        return;
                    }
                    const declareCost = rules.getAttackDeclareCost(unit);
                    if (declareCost > 0 && this.state.remainingMoves < declareCost) {
                        return;
                    }
                    shooting.attacksByAttacker[unit.id] = targetId;
                    if (declareCost > 0) {
                        this.state.remainingMoves = Math.max(0, this.state.remainingMoves - declareCost);
                    }
                    unit.attackedThisTurn = true;
                });
                shooting.focusedAttackerId = null;
                shooting.validTargetIds = [];
            }
        });
    }

    return {
        install,
        pickBestShootingTarget,
        scoreShootingTarget
    };
}));
