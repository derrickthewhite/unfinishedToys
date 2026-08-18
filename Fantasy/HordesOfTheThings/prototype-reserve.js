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
            combat: unit.combat ? { ...unit.combat } : {},
            ensorcelledFrom: unit.ensorcelledFrom ? { ...unit.ensorcelledFrom } : undefined
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
                const left = (data.BOARD_SIZE - size.width) / 2;
                if (homeEdge === 'bottom') {
                    return {
                        left,
                        top: data.BOARD_SIZE + data.RESERVE_BOARD_GAP,
                        width: size.width,
                        height: size.height,
                        homeEdge
                    };
                }
                return {
                    left,
                    top: -data.RESERVE_BOARD_GAP - size.height,
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
                return this.state.draft?.kind === 'reserve-deploy' || this.state.draft?.kind === 'ensorcelled-return';
            },

            isEnsorcelledLocalReturnDraft() {
                const unit = this.getUnitById(this.state.draft?.unitIds?.[0]);
                return this.state.draft?.kind === 'ensorcelled-return' && this.usesEnsorcelledLocalReturn(unit);
            },

            usesEnsorcelledLocalReturn(unit) {
                return Boolean(unit && unit.type === 'Magician' && unit.ensorcelledFrom
                    && Number.isFinite(unit.ensorcelledFrom.x)
                    && Number.isFinite(unit.ensorcelledFrom.y));
            },

            isEnsorcelledInReserve(unitOrId) {
                const unit = typeof unitOrId === 'string' ? this.getUnitById(unitOrId) : unitOrId;
                return Boolean(unit && unit.inReserve && unit.ensorcelledByUnitId !== undefined);
            },

            getOpponentHomeEdge(playerId) {
                return this.getHomeEdge(playerId) === 'bottom' ? 'top' : 'bottom';
            },

            getOpponentHomeEdgeRotation(playerId) {
                return this.getOpponentHomeEdge(playerId) === 'bottom' ? 0 : Math.PI;
            },

            getEnsorcelledReturnCost(unit) {
                if (!unit || unit.ensorcelledByUnitId === null || unit.ensorcelledByUnitId === undefined) {
                    return 0;
                }
                const ensorceller = this.getUnitById(unit.ensorcelledByUnitId);
                if (!ensorceller || this.isUnitInReserve(ensorceller.id)) {
                    return 0;
                }
                return data.ENSORCELLED_RETURN_MOVE_COST;
            },

            isEnsorcellerActive(ensorcelledByUnitId) {
                if (!ensorcelledByUnitId) {
                    return false;
                }
                const ensorceller = this.getUnitById(ensorcelledByUnitId);
                return Boolean(ensorceller && !this.isUnitInReserve(ensorceller.id));
            },

            getReserveSlotPose(playerId, slotIndex) {
                const rect = this.getReserveRect(playerId);
                const capacity = data.RESERVE_COLUMNS * data.RESERVE_ROWS;
                const index = ((Number(slotIndex) || 0) % capacity + capacity) % capacity;
                const col = index % data.RESERVE_COLUMNS;
                const rowFromEdge = Math.floor(index / data.RESERVE_COLUMNS);
                const slotLeft = rect.left + data.RESERVE_PADDING
                    + (col * (data.RESERVE_SLOT_SIZE + data.RESERVE_SLOT_GAP));
                let slotTop;
                if (rect.homeEdge === 'bottom') {
                    slotTop = rect.top + data.RESERVE_PADDING
                        + (rowFromEdge * (data.RESERVE_SLOT_SIZE + data.RESERVE_SLOT_GAP));
                } else {
                    const slotBottom = rect.top + rect.height - data.RESERVE_PADDING
                        - (rowFromEdge * (data.RESERVE_SLOT_SIZE + data.RESERVE_SLOT_GAP));
                    slotTop = slotBottom - data.RESERVE_SLOT_SIZE;
                }
                return {
                    x: slotLeft + (data.RESERVE_SLOT_SIZE / 2),
                    y: slotTop + (data.RESERVE_SLOT_SIZE / 2),
                    rotation: this.getHomeEdgeRotation(playerId)
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

            sendUnitToReserve(unit, options = {}) {
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
                if (options.ensorcelledByUnitId !== undefined) {
                    const origin = geometry.getUnitCenter(unit);
                    reserved.ensorcelledByUnitId = options.ensorcelledByUnitId;
                    reserved.ensorcelledFrom = {
                        x: origin.x,
                        y: origin.y,
                        rotation: unit.rotation
                    };
                    this.recordLosses([unit]);
                }
                this.state.units = (this.state.units || []).filter((entry) => entry.id !== unit.id);
                this.getReserveUnits().push(reserved);
                return reserved;
            },

            settleEnsorcelledUnits(units) {
                (units || []).forEach((unit) => {
                    if (!unit || this.isUnitInReserve(unit.id)) {
                        return;
                    }
                    this.sendUnitToReserve(unit, { ensorcelledByUnitId: unit.ensorcelledByUnitId });
                });
            },

            settleRecycledCasualties() {
                const resolution = this.state.combatResolution;
                (resolution?.recycledUnits || []).forEach((unit) => this.sendUnitToReserve(unit));
                this.settleEnsorcelledUnits(resolution?.ensorcelledUnits);
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

            applyReserveDraftPose(unit, playerId, worldX) {
                if (this.isEnsorcelledLocalReturnDraft()) {
                    return unit;
                }
                if (this.state.draft?.kind === 'ensorcelled-return') {
                    return this.applyEnsorcelledReturnPose(unit, playerId, worldX);
                }
                return this.applyReserveDeployPose(unit, playerId, worldX);
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

            applyEnsorcelledLocalReturnPose(unit) {
                const origin = unit?.ensorcelledFrom;
                if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) {
                    return this.applyEnsorcelledReturnPose(unit, this.getUnitPlayerId(unit), this.getDefaultReserveDeployWorldX());
                }
                const restored = geometry.buildUnitFromCenter(
                    unit,
                    origin,
                    Number.isFinite(origin.rotation) ? origin.rotation : unit.rotation
                );
                unit.x = restored.x;
                unit.y = restored.y;
                unit.rotation = restored.rotation;
                return unit;
            },

            validateEnsorcelledLocalReturn(unit, boardUnits, terrain) {
                if (!unit) {
                    return { invalid: true, reason: 'No unit selected for ensorcelled return.' };
                }
                const origin = unit.ensorcelledFrom;
                const radius = data.pacesToMm(data.MAGICIAN_ENSORCELLED_RETURN_PACES);
                const center = geometry.getUnitCenter(unit);
                if (!origin || geometry.distance(center, origin) > radius + 0.01) {
                    return { invalid: true, reason: `Ensorcelled return must stay within ${data.MAGICIAN_ENSORCELLED_RETURN_PACES} paces of the original spot.` };
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
                    return { invalid: true, reason: 'Ensorcelled return must stay on the board.' };
                }
                const others = (boardUnits || this.state.units || []).filter((other) => other.id !== unit.id);
                if (others.some((other) => geometry.polygonsOverlap(corners, geometry.getUnitCorners(other)))) {
                    return { invalid: true, reason: 'Ensorcelled return overlaps another unit.' };
                }
                const terrainTypes = rules.sampleUnitTerrain(unit, terrain || this.state.terrain);
                if (terrainTypes.has('impassable')) {
                    return { invalid: true, reason: 'Ensorcelled return cannot occupy impassable terrain.' };
                }
                return { invalid: false, reason: '' };
            },

            applyEnsorcelledReturnPose(unit, playerId, worldX) {
                const edge = this.getOpponentHomeEdge(playerId);
                const left = geometry.clamp(worldX - (unit.width / 2), 0, data.BOARD_SIZE - unit.width);
                if (edge === 'bottom') {
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

            validateEnsorcelledReturn(unit, boardUnits, terrain) {
                if (this.usesEnsorcelledLocalReturn(unit)) {
                    return this.validateEnsorcelledLocalReturn(unit, boardUnits, terrain);
                }
                if (!unit) {
                    return { invalid: true, reason: 'No unit selected for ensorcelled return.' };
                }
                const playerId = this.getUnitPlayerId(unit);
                const edge = this.getOpponentHomeEdge(playerId);
                const expectedRotation = this.getOpponentHomeEdgeRotation(playerId);
                if (Math.abs(geometry.normalizeAngle(unit.rotation - expectedRotation)) > 0.01) {
                    return { invalid: true, reason: 'Ensorcelled return must face inward from the enemy board edge.' };
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
                    return { invalid: true, reason: 'Ensorcelled return must stay on the board.' };
                }
                const rearPoints = [corners.backLeft, corners.backRight];
                const onEdge = edge === 'bottom'
                    ? rearPoints.every((point) => Math.abs(point.y - data.BOARD_SIZE) <= EDGE_CONTACT_EPSILON)
                    : rearPoints.every((point) => Math.abs(point.y) <= EDGE_CONTACT_EPSILON);
                if (!onEdge) {
                    return { invalid: true, reason: 'Ensorcelled return must contact the enemy board edge.' };
                }
                const others = (boardUnits || this.state.units || []).filter((other) => other.id !== unit.id);
                if (others.some((other) => geometry.polygonsOverlap(corners, geometry.getUnitCorners(other)))) {
                    return { invalid: true, reason: 'Ensorcelled return overlaps another unit.' };
                }
                const terrainTypes = rules.sampleUnitTerrain(unit, terrain || this.state.terrain);
                if (terrainTypes.has('impassable')) {
                    return { invalid: true, reason: 'Ensorcelled return cannot occupy impassable terrain.' };
                }
                return { invalid: false, reason: '' };
            },

            beginReserveDeploy(unit, worldX) {
                if (!unit || !this.isUnitInReserve(unit.id)) {
                    return false;
                }
                if (this.isEnsorcelledInReserve(unit)) {
                    return this.beginEnsorcelledReturn(unit, worldX);
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

            beginEnsorcelledReturn(unit, worldX) {
                if (!unit || !this.isEnsorcelledInReserve(unit)) {
                    return false;
                }
                if (this.state.mode !== 'game' || this.state.phase !== 'move') {
                    this.updateStatus('Ensorcelled units can only return during the move phase.');
                    return false;
                }
                if (this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                    this.updateStatus('Only the original owner can return ensorcelled units.');
                    return false;
                }
                const returnCost = this.getEnsorcelledReturnCost(unit);
                if (this.state.remainingMoves < returnCost) {
                    this.updateStatus(`Returning this unit requires ${returnCost} moves.`);
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
                if (this.usesEnsorcelledLocalReturn(live)) {
                    this.applyEnsorcelledLocalReturnPose(live);
                } else {
                    this.applyEnsorcelledReturnPose(live, this.getUnitPlayerId(live), Number.isFinite(worldX) ? worldX : this.getDefaultReserveDeployWorldX());
                }
                this.state.units = [...(this.state.units || []).filter((entry) => entry.id !== live.id), live];
                this.state.selectedIds = [live.id];
                this.state.draft = {
                    kind: 'ensorcelled-return',
                    unitIds: [live.id],
                    reserveRestore: restore,
                    returnCost,
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
                const costLabel = returnCost === 0 ? 'no moves' : `${returnCost} moves`;
                const placeLabel = this.usesEnsorcelledLocalReturn(live)
                    ? `within ${data.MAGICIAN_ENSORCELLED_RETURN_PACES} paces of where they were ensorcelled`
                    : 'onto the enemy board edge';
                this.updateStatus(`Return ${live.type} ${placeLabel}. This will spend ${costLabel}.`);
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
            },

            relayoutReserveUnits() {
                this.getReserveUnits().forEach((unit) => {
                    const playerId = this.getUnitPlayerId(unit);
                    const pose = this.getReserveSlotPose(playerId, unit.reserveSlot);
                    const relaid = geometry.buildUnitFromCenter(unit, pose, pose.rotation);
                    unit.x = relaid.x;
                    unit.y = relaid.y;
                    unit.rotation = relaid.rotation;
                });
            }
        });
    }

    return { install };
}));
