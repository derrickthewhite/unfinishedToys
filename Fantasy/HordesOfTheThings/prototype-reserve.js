(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js')
        );
        return;
    }
    root.HordesReserve = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    const EDGE_CONTACT_EPSILON = 0.6;

    function cloneReserveUnit(unit) {
        return {
            ...unit,
            moves: unit.moves ? { ...unit.moves } : undefined,
            strength: unit.strength ? { ...unit.strength } : undefined,
            ranged: unit.ranged ? { ...unit.ranged } : null,
            movement: unit.movement ? { ...unit.movement } : {},
            combat: unit.combat ? { ...unit.combat } : {}
        };
    }

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            getReserveUnits() {
                if (!Array.isArray(this.state.reserveUnits)) {
                    this.state.reserveUnits = [];
                }
                return this.state.reserveUnits;
            },

            getHomeEdge(playerId) {
                const edges = this.state.homeEdgeByPlayerId;
                if (edges?.[playerId] === 'top' || edges?.[playerId] === 'bottom') {
                    return edges[playerId];
                }
                return playerId === 'player-2' ? 'top' : 'bottom';
            },

            getDefaultHomeEdges() {
                return {
                    'player-1': 'bottom',
                    'player-2': 'top'
                };
            },

            getReserveRectSize() {
                const width = (data.RESERVE_PADDING * 2)
                    + (data.RESERVE_COLUMNS * data.RESERVE_SLOT_SIZE)
                    + ((data.RESERVE_COLUMNS - 1) * data.RESERVE_SLOT_GAP);
                const height = (data.RESERVE_PADDING * 2)
                    + (data.RESERVE_ROWS * data.RESERVE_SLOT_SIZE)
                    + ((data.RESERVE_ROWS - 1) * data.RESERVE_SLOT_GAP);
                return { width, height };
            },

            getReserveRect(playerId) {
                const size = this.getReserveRectSize();
                const homeEdge = this.getHomeEdge(playerId);
                return {
                    left: -data.RESERVE_BOARD_GAP - size.width,
                    top: homeEdge === 'bottom' ? data.BOARD_SIZE - size.height : 0,
                    width: size.width,
                    height: size.height,
                    homeEdge
                };
            },

            isReserveRecycleType(unit) {
                return Boolean(unit && data.RESERVE_RECYCLE_TYPES.includes(unit.type));
            },

            isUnitInReserve(unitOrId) {
                const unitId = typeof unitOrId === 'string' ? unitOrId : unitOrId?.id;
                return this.getReserveUnits().some((unit) => unit.id === unitId);
            },

            isReserveDeployDraft() {
                return this.state.draft?.kind === 'reserve-deploy';
            },

            getReserveSlotPose(playerId, slotIndex) {
                const rect = this.getReserveRect(playerId);
                const capacity = data.RESERVE_COLUMNS * data.RESERVE_ROWS;
                const index = ((Number(slotIndex) || 0) % capacity + capacity) % capacity;
                const colFromBoard = index % data.RESERVE_COLUMNS;
                const rowFromEdge = Math.floor(index / data.RESERVE_COLUMNS);
                const slotRight = rect.left + rect.width - data.RESERVE_PADDING
                    - (colFromBoard * (data.RESERVE_SLOT_SIZE + data.RESERVE_SLOT_GAP));
                const slotLeft = slotRight - data.RESERVE_SLOT_SIZE;
                let slotTop;
                if (rect.homeEdge === 'bottom') {
                    const slotBottom = rect.top + rect.height - data.RESERVE_PADDING
                        - (rowFromEdge * (data.RESERVE_SLOT_SIZE + data.RESERVE_SLOT_GAP));
                    slotTop = slotBottom - data.RESERVE_SLOT_SIZE;
                } else {
                    slotTop = rect.top + data.RESERVE_PADDING
                        + (rowFromEdge * (data.RESERVE_SLOT_SIZE + data.RESERVE_SLOT_GAP));
                }
                return {
                    x: slotLeft + (data.RESERVE_SLOT_SIZE / 2),
                    y: slotTop + (data.RESERVE_SLOT_SIZE / 2),
                    rotation: Math.PI / 2
                };
            },

            getNextReserveSlot(playerId) {
                const used = new Set(
                    this.getReserveUnits()
                        .filter((unit) => this.getUnitPlayerId(unit) === playerId)
                        .map((unit) => unit.reserveSlot)
                        .filter((slot) => Number.isInteger(slot))
                );
                for (let slot = 0; slot < data.RESERVE_CAPACITY; slot += 1) {
                    if (!used.has(slot)) {
                        return slot;
                    }
                }
                return this.getReserveUnits().filter((unit) => this.getUnitPlayerId(unit) === playerId).length;
            },

            sendUnitToReserve(unit) {
                if (!unit) {
                    return null;
                }
                const playerId = this.getUnitPlayerId(unit);
                const slot = this.getNextReserveSlot(playerId);
                const pose = this.getReserveSlotPose(playerId, slot);
                const reserved = geometry.buildUnitFromCenter(cloneReserveUnit(unit), pose, pose.rotation);
                reserved.inReserve = true;
                reserved.reserveSlot = slot;
                reserved.movedThisTurn = false;
                this.state.units = (this.state.units || []).filter((entry) => entry.id !== unit.id);
                this.getReserveUnits().push(reserved);
                return reserved;
            },

            settleRecycledCasualties() {
                const recycledUnits = this.state.combatResolution?.recycledUnits || [];
                recycledUnits.forEach((unit) => this.sendUnitToReserve(unit));
            },

            clearLossForUnit(unitId) {
                if (!this.state.losses) {
                    return;
                }
                data.PLAYER_IDS.forEach((playerId) => {
                    const losses = this.state.losses[playerId];
                    if (!Array.isArray(losses)) {
                        return;
                    }
                    this.state.losses[playerId] = losses.filter((entry) => entry.id !== unitId);
                });
            },

            getHomeEdgeRotation(playerId) {
                return this.getHomeEdge(playerId) === 'bottom' ? 0 : Math.PI;
            },

            applyReserveDeployPose(unit, playerId, worldX) {
                const left = geometry.clamp(worldX - (unit.width / 2), 0, data.BOARD_SIZE - unit.width);
                if (this.getHomeEdge(playerId) === 'bottom') {
                    unit.x = left;
                    unit.y = data.BOARD_SIZE - unit.depth;
                    unit.rotation = 0;
                    return unit;
                }
                unit.x = left + unit.width;
                unit.y = unit.depth;
                unit.rotation = Math.PI;
                return unit;
            },

            getDefaultReserveDeployWorldX() {
                return data.BOARD_SIZE / 2;
            },

            validateReserveDeploy(unit, boardUnits, terrain) {
                if (!unit) {
                    return { invalid: true, reason: 'No unit selected for reserve deployment.' };
                }
                const playerId = this.getUnitPlayerId(unit);
                const homeEdge = this.getHomeEdge(playerId);
                const expectedRotation = this.getHomeEdgeRotation(playerId);
                if (Math.abs(geometry.normalizeAngle(unit.rotation - expectedRotation)) > 0.01) {
                    return { invalid: true, reason: 'Reserve deployment must face inward from the home edge.' };
                }
                const corners = geometry.getUnitCorners(unit);
                const points = geometry.cornersToPoints(corners);
                const onBoard = points.every((point) => (
                    point.x >= -0.01
                    && point.x <= data.BOARD_SIZE + 0.01
                    && point.y >= -0.01
                    && point.y <= data.BOARD_SIZE + 0.01
                ));
                if (!onBoard) {
                    return { invalid: true, reason: 'Reserve deployment must stay on the board.' };
                }
                const rearPoints = [corners.backLeft, corners.backRight];
                const onHomeEdge = homeEdge === 'bottom'
                    ? rearPoints.every((point) => Math.abs(point.y - data.BOARD_SIZE) <= EDGE_CONTACT_EPSILON)
                    : rearPoints.every((point) => Math.abs(point.y) <= EDGE_CONTACT_EPSILON);
                if (!onHomeEdge) {
                    return { invalid: true, reason: 'Reserve deployment must contact the home board edge.' };
                }
                const others = (boardUnits || this.state.units || []).filter((other) => other.id !== unit.id);
                const overlaps = others.some((other) => geometry.polygonsOverlap(corners, geometry.getUnitCorners(other)));
                if (overlaps) {
                    return { invalid: true, reason: 'Reserve deployment overlaps another unit.' };
                }
                const terrainTypes = rules.sampleUnitTerrain(unit, terrain || this.state.terrain);
                if (terrainTypes.has('impassable')) {
                    return { invalid: true, reason: 'Reserve deployment cannot occupy impassable terrain.' };
                }
                const clearance = data.pacesToMm(data.RESERVE_ENEMY_CLEARANCE_PACES);
                const tooClose = others.some((other) => {
                    if (this.getUnitPlayerId(other) === playerId) {
                        return false;
                    }
                    return geometry.minDistanceBetweenPolygons(corners, geometry.getUnitCorners(other)) < clearance - 0.01;
                });
                if (tooClose) {
                    return { invalid: true, reason: 'Reserve deployment cannot end within 200 paces of an enemy.' };
                }
                return { invalid: false, reason: '' };
            },

            beginReserveDeploy(unit, worldX) {
                if (!unit || !this.isUnitInReserve(unit.id)) {
                    return false;
                }
                if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                    this.updateStatus('Reserve units can only deploy during the move phase.');
                    return false;
                }
                if (this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                    this.updateStatus('Only the active side can deploy from reserve.');
                    return false;
                }
                if (this.state.remainingMoves <= 0) {
                    this.updateStatus('No moves remain for this side.');
                    return false;
                }
                if (this.state.draft && !this.isReserveDeployDraft()) {
                    this.cancelDraft(false);
                }
                const reserved = this.getReserveUnits().find((entry) => entry.id === unit.id);
                if (!reserved) {
                    return false;
                }
                const restore = cloneReserveUnit(reserved);
                this.state.reserveUnits = this.getReserveUnits().filter((entry) => entry.id !== unit.id);
                const live = cloneReserveUnit(reserved);
                delete live.inReserve;
                delete live.reserveSlot;
                this.applyReserveDeployPose(live, this.getUnitPlayerId(live), Number.isFinite(worldX) ? worldX : this.getDefaultReserveDeployWorldX());
                this.state.units = [...(this.state.units || []).filter((entry) => entry.id !== live.id), live];
                this.state.selectedIds = [live.id];
                this.state.draft = {
                    kind: 'reserve-deploy',
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
                this.updateStatus(`Deploy ${live.type} onto your board edge. This will spend one move.`);
                return true;
            },

            restoreReserveDeploy(draft) {
                const restore = draft?.reserveRestore;
                if (!restore) {
                    return;
                }
                this.state.units = (this.state.units || []).filter((unit) => unit.id !== restore.id);
                const alreadyReserved = this.getReserveUnits().some((unit) => unit.id === restore.id);
                if (!alreadyReserved) {
                    this.getReserveUnits().push(cloneReserveUnit(restore));
                }
            }
        });
    }

    return { install };
}));
