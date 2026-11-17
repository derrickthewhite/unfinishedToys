(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./data.js'),
            require('./geometry.js'),
            require('./rules/index.js')
        );
        return;
    }
    root.HordesLurkers = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    function cloneLurker(unit) {
        return {
            ...unit,
            moves: unit.moves ? { ...unit.moves } : undefined,
            strength: unit.strength ? { ...unit.strength } : undefined,
            ranged: unit.ranged ? { ...unit.ranged } : null,
            movement: unit.movement ? { ...unit.movement } : {},
            combat: unit.combat ? { ...unit.combat } : {}
        };
    }

    function frontMidpoint(unit) {
        const corners = geometry.getUnitCorners(unit);
        return geometry.midpoint(corners.frontLeft, corners.frontRight);
    }

    function facingDeltaFromOpposite(lurker, enemy) {
        const lurkerForward = geometry.getForwardVector(lurker.rotation);
        const enemyForward = geometry.getForwardVector(enemy.rotation);
        const opposite = { x: -enemyForward.x, y: -enemyForward.y };
        const dot = (lurkerForward.x * opposite.x) + (lurkerForward.y * opposite.y);
        return Math.acos(Math.max(-1, Math.min(1, dot)));
    }

    function buildFrontContactPose(lurker, enemy) {
        const rotation = geometry.normalizeAngle(enemy.rotation + Math.PI);
        const enemyCorners = geometry.getUnitCorners(enemy);
        return {
            ...cloneLurker(lurker),
            x: enemyCorners.frontRight.x,
            y: enemyCorners.frontRight.y,
            rotation,
            inReserve: false
        };
    }

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            isLurkerUnit(unit) {
                return data.isLurkerType(unit?.type);
            },

            getLurkerDeployCost(unit) {
                return data.getLurkerDeployCost(unit);
            },

            captureLurkerOccupancy(options = {}) {
                const current = rules.collectLurkerOccupancy(this.state.units, this.state.terrain);
                if (options.initialize) {
                    this.state.lurkerStartOccupancy = current;
                    this.state.lurkerLastOccupancy = current;
                    return;
                }
                this.state.lurkerLastOccupancy = this.state.lurkerStartOccupancy || current;
                this.state.lurkerStartOccupancy = current;
            },

            getLurkerLastOccupancy() {
                return this.state.lurkerLastOccupancy || this.state.lurkerStartOccupancy || {};
            },

            isEligibleLurkerAmbushTarget(enemy, lurker, units, terrain, occupancy) {
                if (!enemy || !lurker || enemy.playerId === lurker.playerId || enemy.type === 'Base') {
                    return false;
                }
                const featureKey = rules.getUnitLurkFeatureKey(enemy, terrain);
                if (!featureKey) {
                    return false;
                }
                if ((occupancy || {})[enemy.id] === featureKey) {
                    return false;
                }
                const melee = rules.detectMeleeCombats(units || this.state.units, terrain);
                if (melee.participantIds?.has(enemy.id)) {
                    return false;
                }
                const pose = this.buildLurkerAmbushPose(lurker, enemy, units, terrain);
                return Boolean(pose);
            },

            buildLurkerAmbushPose(lurker, enemy, units, terrain) {
                const candidate = buildFrontContactPose(lurker, enemy);
                const others = (units || this.state.units || []).filter((unit) => unit.id !== lurker.id);
                if (this.isLegalLurkerAmbushPose(candidate, enemy, others, terrain)) {
                    return candidate;
                }
                const right = geometry.getRightVector(candidate.rotation);
                const offsets = [-8, 8, -16, 16, -4, 4];
                for (let index = 0; index < offsets.length; index += 1) {
                    const shifted = {
                        ...candidate,
                        x: candidate.x + (right.x * offsets[index]),
                        y: candidate.y + (right.y * offsets[index])
                    };
                    if (this.isLegalLurkerAmbushPose(shifted, enemy, others, terrain)) {
                        return shifted;
                    }
                }
                return null;
            },

            isLegalLurkerAmbushPose(lurker, enemy, others, terrain) {
                if (!lurker || !enemy) {
                    return false;
                }
                if (!geometry.footprintInsideBoard(lurker, data.BOARD_SIZE)) {
                    return false;
                }
                if (!rules.isUnitInBadGoing(lurker, terrain)) {
                    return false;
                }
                const lurkerFeature = rules.getUnitLurkFeatureKey(lurker, terrain);
                const enemyFeature = rules.getUnitLurkFeatureKey(enemy, terrain);
                if (!lurkerFeature || lurkerFeature !== enemyFeature) {
                    return false;
                }
                if ((others || []).some((other) => geometry.unitsOverlap(lurker, other))) {
                    return false;
                }
                if (facingDeltaFromOpposite(lurker, enemy) > data.LURKER_AMBUSH_FACING) {
                    return false;
                }
                if (geometry.distance(frontMidpoint(lurker), frontMidpoint(enemy)) > data.LURKER_AMBUSH_GAP) {
                    return false;
                }
                const enemyRight = geometry.getRightVector(enemy.rotation);
                const centerDelta = geometry.subtract(geometry.getUnitCenter(lurker), geometry.getUnitCenter(enemy));
                const lateral = Math.abs(geometry.dot(centerDelta, enemyRight));
                return lateral <= ((lurker.width + enemy.width) / 2) + data.LURKER_AMBUSH_LATERAL;
            },

            getEligibleLurkerAmbushTargets(lurker) {
                if (!this.isLurkerUnit(lurker)) {
                    return [];
                }
                const occupancy = this.getLurkerLastOccupancy();
                const units = this.state.units || [];
                const terrain = this.state.terrain;
                return units.filter((enemy) => this.isEligibleLurkerAmbushTarget(enemy, lurker, units, terrain, occupancy));
            },

            hasLurkerAmbushPlacement(unit) {
                return this.getEligibleLurkerAmbushTargets(unit).length > 0;
            },

            isLurkerBlockedInReserve(unit) {
                if (!this.isLurkerUnit(unit)) {
                    return false;
                }
                const inReserve = Boolean(unit.inReserve) || this.isUnitInReserve(unit.id);
                return inReserve && !this.hasLurkerAmbushPlacement(unit);
            },

            getLurkerAmbushGhosts() {
                const lurker = this.getLurkerAmbushFocusUnit();
                if (!lurker) {
                    return [];
                }
                return this.getEligibleLurkerAmbushTargets(lurker)
                    .map((enemy) => this.buildLurkerAmbushPose(lurker, enemy, this.state.units, this.state.terrain))
                    .filter(Boolean)
                    .map((pose) => ({ ...pose, id: lurker.id, ghostAmbush: true }));
            },

            getLurkerAmbushFocusUnit() {
                if (this.state.draft?.kind === 'lurker-ambush') {
                    return this.getUnitById(this.state.draft.unitIds[0]);
                }
                if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                    return null;
                }
                const selected = this.getSelectedUnits();
                if (selected.length !== 1 || !this.isLurkerUnit(selected[0]) || !this.isUnitInReserve(selected[0].id)) {
                    return null;
                }
                if (this.getUnitPlayerId(selected[0]) !== this.state.activePlayerId) {
                    return null;
                }
                return selected[0];
            },

            pickLurkerAmbushGhost(world) {
                return this.getLurkerAmbushGhosts().find((ghost) => geometry.pointInPolygon(world, geometry.getUnitCorners(ghost))) || null;
            },

            snapLurkerAmbush(unit) {
                if (!unit || this.state.draft?.kind !== 'lurker-ambush') {
                    return;
                }
                const ghosts = this.getLurkerAmbushGhosts();
                let best = null;
                ghosts.forEach((ghost) => {
                    const distance = geometry.distance(geometry.getUnitCenter(unit), geometry.getUnitCenter(ghost));
                    if (distance <= data.LURKER_AMBUSH_GAP + data.LURKER_AMBUSH_LATERAL && (!best || distance < best.distance)) {
                        best = { ghost, distance };
                    }
                });
                if (!best) {
                    return;
                }
                unit.x = best.ghost.x;
                unit.y = best.ghost.y;
                unit.rotation = best.ghost.rotation;
            },

            validateLurkerAmbush(unit, units, terrain) {
                if (!unit) {
                    return { invalid: true, reason: 'No lurker to place.' };
                }
                const occupancy = this.getLurkerLastOccupancy();
                const boardUnits = units || this.state.units;
                const match = (boardUnits || []).find((enemy) => (
                    this.isEligibleLurkerAmbushTarget(enemy, unit, boardUnits, terrain, occupancy)
                    && this.isLegalLurkerAmbushPose(
                        unit,
                        enemy,
                        boardUnits.filter((other) => other.id !== unit.id),
                        terrain
                    )
                ));
                if (!match) {
                    return { invalid: true, reason: 'Place the Lurkers in front of an enemy that entered forest or swamp this turn.' };
                }
                return { invalid: false, reason: '' };
            },

            beginLurkerAmbush(unit, pose) {
                if (!unit || !this.isLurkerUnit(unit) || !this.isUnitInReserve(unit.id)) {
                    return false;
                }
                if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                    this.updateStatus('Lurkers can only ambush during the move phase.');
                    return false;
                }
                if (this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                    this.updateStatus('Only the active side can deploy Lurkers.');
                    return false;
                }
                const cost = this.getLurkerDeployCost(unit);
                if (this.state.remainingMoves < cost) {
                    this.updateStatus(`Deploying these Lurkers requires ${cost} moves.`);
                    return false;
                }
                const ghosts = this.getEligibleLurkerAmbushTargets(unit)
                    .map((enemy) => this.buildLurkerAmbushPose(unit, enemy, this.state.units, this.state.terrain))
                    .filter(Boolean);
                if (ghosts.length === 0) {
                    this.updateStatus('No eligible ambush. An enemy must have entered forest or swamp since last turn.');
                    return false;
                }
                if (this.state.draft && this.state.draft.kind !== 'lurker-ambush' && this.state.draft.kind !== 'reserve-deploy') {
                    this.cancelDraft(false);
                }
                const reserved = this.getReserveUnits().find((entry) => entry.id === unit.id);
                if (!reserved) {
                    return false;
                }
                const restore = cloneLurker(reserved);
                this.state.reserveUnits = this.getReserveUnits().filter((entry) => entry.id !== unit.id);
                const live = cloneLurker(reserved);
                delete live.inReserve;
                delete live.reserveSlot;
                const startPose = pose && Number.isFinite(pose.x)
                    ? pose
                    : ghosts[0];
                live.x = startPose.x;
                live.y = startPose.y;
                live.rotation = startPose.rotation;
                this.state.units = [...(this.state.units || []).filter((entry) => entry.id !== live.id), live];
                this.state.selectedIds = [live.id];
                this.state.draft = {
                    kind: 'lurker-ambush',
                    unitIds: [live.id],
                    reserveRestore: restore,
                    initialOrigin: geometry.snapshotPositions([live.id], [restore]),
                    validationOrigin: geometry.snapshotPositions([live.id], this.state.units),
                    origin: geometry.snapshotPositions([live.id], this.state.units),
                    allowSingleRotationFormationEscape: false,
                    history: [],
                    invalidIds: new Set(),
                    reasonById: new Map()
                };
                this.updateSelectionAnalysis();
                this.evaluateDraft();
                this.updateStatus(`Ambush with ${live.type}. Placement costs ${cost} move${cost === 1 ? '' : 's'}.`);
                return true;
            },

            applyLurkerAmbushGhost(ghost) {
                if (!ghost) {
                    return false;
                }
                const focus = this.getLurkerAmbushFocusUnit() || this.getUnitById(ghost.id);
                if (!focus) {
                    return false;
                }
                if (this.isUnitInReserve(focus.id)) {
                    return this.beginLurkerAmbush(focus, ghost);
                }
                if (this.state.draft?.kind !== 'lurker-ambush') {
                    return false;
                }
                const unit = this.getUnitById(focus.id);
                unit.x = ghost.x;
                unit.y = ghost.y;
                unit.rotation = ghost.rotation;
                this.evaluateDraft();
                this.requestRender();
                return true;
            },

            spawnStartingLurkersToReserve() {
                const reserved = [];
                data.PLAYER_IDS.forEach((playerId) => {
                    const draft = this.getArmyDraft?.(playerId);
                    const faction = this.getPlayer(playerId)?.faction;
                    Object.entries(draft?.counts || {}).forEach(([type, count]) => {
                        if (!data.isLurkerType(type)) {
                            return;
                        }
                        for (let index = 0; index < (count || 0); index += 1) {
                            const unit = data.createUnit(type, playerId, faction, { x: 0, y: 0, rotation: 0 }, () => this.allocateUnitId());
                            this.sendUnitToReserve(unit);
                            reserved.push(unit.id);
                        }
                    });
                });
                return reserved;
            },

            settleLurkerReturns(units) {
                (units || []).forEach((unit) => {
                    if (!unit || this.isUnitInReserve(unit.id)) {
                        return;
                    }
                    const returning = cloneLurker(unit);
                    if (unit.lurkerReturnReason === 'isolation') {
                        returning.lurkerDeployments = (returning.lurkerDeployments || 0) + 1;
                    }
                    this.sendUnitToReserve(returning);
                });
            }
        });
    }

    return { install };
}));
