(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js')
        );
        return;
    }
    root.HordesUnitDeployment = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    const BAD_GOING_KINDS = new Set(['forest', 'swamp']);
    const BLOCKING_AHEAD_KINDS = new Set(['forest', 'swamp', 'water', 'impassable']);
    const FRONT_CORRIDOR_STEP = 20;
    const FRONT_CORRIDOR_DISTANCE = 180;
    const ROLE_ORDER = Object.freeze({
        'bad-going': 0,
        front: 1,
        fast: 2,
        flyer: 3,
        rear: 4
    });

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            getDeploymentSetup() {
                return this.state.setup?.deployment || null;
            },

            getDeploymentZone(playerId) {
                const deployment = this.getDeploymentSetup();
                if (!deployment) {
                    return null;
                }
                return deployment.zoneByPlayerId[playerId] || null;
            },

            getDeploymentPlayerTotal(playerId) {
                const draft = this.getArmyDraft(playerId);
                if (!draft || !draft.counts) {
                    return 0;
                }
                return Object.values(draft.counts).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
            },

            getDefaultDeploymentRotation(playerId) {
                const zone = this.getDeploymentZone(playerId);
                return zone === 'bottom' ? 0 : Math.PI;
            },

            initializeUnitDeployment() {
                const terrain = this.getTerrainSetup();
                if (!terrain) {
                    return null;
                }
                const defenderPlayerId = terrain.defenderPlayerId;
                const attackerPlayerId = this.getOpponentPlayerId(defenderPlayerId);
                const tray = [];
                data.PLAYER_IDS.forEach((playerId) => {
                    const draft = this.getArmyDraft(playerId);
                    const faction = this.getPlayer(playerId)?.faction;
                    Object.entries(draft?.counts || {}).forEach(([type, count]) => {
                        for (let index = 0; index < (count || 0); index += 1) {
                            tray.push({
                                draftId: `${playerId}-${type}-${index + 1}`,
                                playerId,
                                type,
                                faction
                            });
                        }
                    });
                });
                this.state.setup.deployment = {
                    defenderPlayerId,
                    attackerPlayerId,
                    activePlayerId: defenderPlayerId,
                    zoneByPlayerId: {
                        [defenderPlayerId]: 'bottom',
                        [attackerPlayerId]: 'top'
                    },
                    tray,
                    selectedTrayId: null,
                    selectedUnitId: null,
                    deployedByPlayerId: {
                        'player-1': [],
                        'player-2': []
                    },
                    interaction: null
                };
                delete this.state.setupCameras?.deployment;
                this.state.units = [];
                this.state.selectedIds = [];
                this.state.draft = null;
                this.state.formUp = null;
                this.state.shooting = null;
                this.state.melee = null;
                this.state.combatResolution = null;
                this.state.losses = { 'player-1': [], 'player-2': [] };
                this.state.editHistory = [];
                this.state.placingUnit = false;
                this.state.mode = 'edit';
                this.updateStatus(`${this.getPlayerLabel(defenderPlayerId)} deploys first in the bottom quarter. ${this.getPlayerLabel(attackerPlayerId)} will deploy in the top quarter.`);
                return this.state.setup.deployment;
            },

            bindUnitDeploymentUi() {
                if (this.ui.deploymentCanvas) {
                    this.ui.deploymentCanvas.addEventListener('pointerdown', (event) => this.onDeploymentPointerDown(event));
                    this.ui.deploymentCanvas.addEventListener('pointermove', (event) => this.onDeploymentPointerMove(event));
                    this.ui.deploymentCanvas.addEventListener('pointerup', (event) => this.onDeploymentPointerUp(event));
                    this.ui.deploymentCanvas.addEventListener('pointercancel', (event) => this.onDeploymentPointerUp(event));
                    this.ui.deploymentCanvas.addEventListener('contextmenu', (event) => event.preventDefault());
                    this.ui.deploymentCanvas.addEventListener('wheel', (event) => {
                        event.preventDefault();
                        this.zoomSetupAt(event, 'deployment', this.ui.deploymentCanvas);
                        this.renderUnitDeployment();
                    }, { passive: false });
                }
                if (this.ui.autoDeployButton) {
                    this.ui.autoDeployButton.addEventListener('click', () => this.autoDeployActiveArmy());
                }
                if (this.ui.returnToTrayButton) {
                    this.ui.returnToTrayButton.addEventListener('click', () => this.returnSelectedUnitsToTray());
                }
                if (this.ui.finishDeploymentButton) {
                    this.ui.finishDeploymentButton.addEventListener('click', () => this.finishDeploymentTurn());
                }
                if (this.ui.deploymentSnapCheckbox) {
                    this.ui.deploymentSnapCheckbox.addEventListener('change', () => {
                        this.state.snapEnabled = this.ui.deploymentSnapCheckbox.checked;
                        this.updateStatus(`Snapping ${this.state.snapEnabled ? 'enabled' : 'disabled'} for deployment.`);
                    });
                }
            },

            withDeploymentView(fn) {
                const previousCanvas = this.canvas;
                const previousCamera = this.state.camera;
                this.canvas = this.ui.deploymentCanvas || previousCanvas;
                this.state.camera = this.getSetupCamera('deployment');
                try {
                    return fn();
                } finally {
                    this.canvas = previousCanvas;
                    this.state.camera = previousCamera;
                }
            },

            deploymentScreenToWorld(event) {
                return this.withDeploymentView(() => this.screenToWorld(event.clientX, event.clientY));
            },

            isEventOverElement(event, element) {
                if (!event || !element || typeof element.getBoundingClientRect !== 'function') {
                    return false;
                }
                const rect = element.getBoundingClientRect();
                const left = rect.left;
                const top = rect.top;
                const right = Number.isFinite(rect.right) ? rect.right : left + rect.width;
                const bottom = Number.isFinite(rect.bottom) ? rect.bottom : top + rect.height;
                if (!(right > left) || !(bottom > top)) {
                    return false;
                }
                return event.clientX >= left
                    && event.clientX <= right
                    && event.clientY >= top
                    && event.clientY <= bottom;
            },

            isEventOverDeploymentCanvas(event) {
                return this.isEventOverElement(event, this.ui.deploymentCanvas);
            },

            isEventOverDeploymentTray(event) {
                return this.isEventOverElement(event, this.ui.deploymentTray);
            },

            isUnitPlacementInZone(unit, playerId) {
                const zone = this.getDeploymentZone(playerId);
                if (!zone) {
                    return false;
                }
                const boundary = zone === 'bottom'
                    ? { minY: data.BOARD_SIZE * 0.75, maxY: data.BOARD_SIZE }
                    : { minY: 0, maxY: data.BOARD_SIZE * 0.25 };
                const corners = Object.values(geometry.getUnitCorners(unit));
                return corners.every((corner) => (
                    corner.x >= 0
                    && corner.x <= data.BOARD_SIZE
                    && corner.y >= 0
                    && corner.y <= data.BOARD_SIZE
                    && corner.y >= boundary.minY
                    && corner.y <= boundary.maxY
                ));
            },

            findDeploymentOverlap(candidateUnit, skipId) {
                const candidateCorners = geometry.getUnitCorners(candidateUnit);
                return this.state.units.find((unit) => {
                    if (skipId && unit.id === skipId) {
                        return false;
                    }
                    return geometry.polygonsOverlap(candidateCorners, geometry.getUnitCorners(unit));
                }) || null;
            },

            snapDeploymentUnits(units, movingUnitIds) {
                if (!this.state.snapEnabled || units.length === 0) {
                    return;
                }
                const movingIdSet = new Set(movingUnitIds);
                const stationaryUnits = this.state.units.filter((unit) => !movingIdSet.has(unit.id));
                const snapOffset = geometry.findFriendlySnapOffset(units, stationaryUnits);
                if (!snapOffset) {
                    return;
                }
                units.forEach((unit) => {
                    unit.x += snapOffset.x;
                    unit.y += snapOffset.y;
                });
            },

            buildDeployedUnit(trayEntry, point, allocateUnitId = () => this.allocateUnitId()) {
                const unit = data.createUnit(
                    trayEntry.type,
                    trayEntry.playerId,
                    trayEntry.faction,
                    {
                        x: point.x - (data.UNIT_WIDTH / 2),
                        y: point.y + (data.UNIT_TYPES[trayEntry.type].depth / 2),
                        rotation: this.getDefaultDeploymentRotation(trayEntry.playerId)
                    },
                    allocateUnitId
                );
                unit.draftId = trayEntry.draftId;
                return unit;
            },

            areDeploymentUnitsLegal(units) {
                return (units || []).every((unit) => (
                    unit
                    && this.isUnitPlacementInZone(unit, this.getUnitPlayerId(unit))
                    && !this.findDeploymentOverlap(unit, unit.id)
                ));
            },

            restoreIllegalDeploymentPlacement(interaction) {
                if (this.state.setupStage !== 'unit-deployment' || !interaction?.dragBase || !interaction.draftIds) {
                    return false;
                }
                if (!['move-edit', 'rotate-single', 'rotate-rank'].includes(interaction.type)) {
                    return false;
                }
                const units = interaction.draftIds.map((unitId) => this.getUnitById(unitId)).filter(Boolean);
                if (units.length === 0 || this.areDeploymentUnitsLegal(units)) {
                    return false;
                }
                geometry.restoreSnapshot(interaction.dragBase, this.state.units);
                this.updateSelectionAnalysis();
                this.updateStatus('Invalid move: deployed units must stay on the board, inside the assigned quarter, and cannot overlap.');
                return true;
            },

            syncDeploymentSelection() {
                const deployment = this.getDeploymentSetup();
                if (!deployment) {
                    return;
                }
                deployment.selectedUnitId = this.state.selectedIds[0] || null;
                if (this.state.selectedIds.length > 0) {
                    deployment.selectedTrayId = null;
                }
            },

            buildTrayEntryFromUnit(unit) {
                return {
                    draftId: unit.draftId || `${unit.playerId}-${unit.type}-${unit.id}`,
                    playerId: this.getUnitPlayerId(unit),
                    type: unit.type,
                    faction: unit.faction
                };
            },

            returnDeployedUnitsToTray(unitIds) {
                const deployment = this.getDeploymentSetup();
                if (!deployment || this.state.setupStage !== 'unit-deployment') {
                    return 0;
                }
                const activePlayerId = deployment.activePlayerId;
                const returnedIds = [];
                (unitIds || []).forEach((unitId) => {
                    const unit = this.getUnitById(unitId);
                    if (!unit || this.getUnitPlayerId(unit) !== activePlayerId) {
                        return;
                    }
                    const trayEntry = this.buildTrayEntryFromUnit(unit);
                    if (!deployment.tray.some((entry) => entry.draftId === trayEntry.draftId)) {
                        deployment.tray.push(trayEntry);
                    }
                    returnedIds.push(unit.id);
                });
                if (returnedIds.length === 0) {
                    return 0;
                }
                const returnedIdSet = new Set(returnedIds);
                this.state.units = this.state.units.filter((unit) => !returnedIdSet.has(unit.id));
                deployment.deployedByPlayerId[activePlayerId] = (deployment.deployedByPlayerId[activePlayerId] || [])
                    .filter((unitId) => !returnedIdSet.has(unitId));
                this.state.selectedIds = this.state.selectedIds.filter((unitId) => !returnedIdSet.has(unitId));
                deployment.selectedUnitId = this.state.selectedIds[0] || null;
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.updateStatus(returnedIds.length === 1
                    ? 'Returned 1 unit to the tray.'
                    : `Returned ${returnedIds.length} units to the tray.`);
                return returnedIds.length;
            },

            returnSelectedUnitsToTray() {
                return this.returnDeployedUnitsToTray([...this.state.selectedIds]);
            },

            canFinishDeploymentTurn() {
                const deployment = this.getDeploymentSetup();
                if (!deployment) {
                    return false;
                }
                const activePlayerId = deployment.activePlayerId;
                const expected = this.getDeploymentPlayerTotal(activePlayerId);
                const deployed = deployment.deployedByPlayerId[activePlayerId].length;
                if (deployed !== expected) {
                    return false;
                }
                return deployment.deployedByPlayerId[activePlayerId]
                    .map((unitId) => this.getUnitById(unitId))
                    .every((unit) => unit && this.isUnitPlacementInZone(unit, activePlayerId) && !this.findDeploymentOverlap(unit, unit.id));
            },

            selectDeploymentTrayUnit(draftId) {
                const deployment = this.getDeploymentSetup();
                if (!deployment || this.state.setupStage !== 'unit-deployment') {
                    return;
                }
                const trayEntry = deployment.tray.find((entry) => entry.draftId === draftId);
                if (!trayEntry || trayEntry.playerId !== deployment.activePlayerId) {
                    return;
                }
                deployment.selectedTrayId = trayEntry.draftId;
                deployment.selectedUnitId = null;
                this.state.selectedIds = [];
                this.updateSelectionAnalysis();
                this.syncUiFromState();
            },

            markDeploymentTraySelection(draftId) {
                const tray = this.ui.deploymentTray;
                if (!tray || typeof tray.querySelectorAll !== 'function') {
                    return;
                }
                tray.querySelectorAll('[data-deploy-draft]').forEach((button) => {
                    button.classList.toggle('is-selected', button.dataset.deployDraft === draftId);
                });
            },

            beginPlaceFromTray(event, draftId, source, captureTarget) {
                const deployment = this.getDeploymentSetup();
                if (!deployment) {
                    return;
                }
                const trayEntry = deployment.tray.find((entry) => entry.draftId === draftId);
                if (!trayEntry || trayEntry.playerId !== deployment.activePlayerId) {
                    return;
                }
                deployment.selectedTrayId = trayEntry.draftId;
                deployment.selectedUnitId = null;
                this.state.selectedIds = [];
                this.updateSelectionAnalysis();
                if (captureTarget && typeof captureTarget.setPointerCapture === 'function') {
                    captureTarget.setPointerCapture(event.pointerId);
                }
                deployment.interaction = {
                    type: 'place-from-tray',
                    source,
                    pointerId: event.pointerId,
                    draftId: trayEntry.draftId,
                    point: this.deploymentScreenToWorld(event),
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    moved: false,
                    captureTarget: captureTarget || null
                };
            },

            onDeploymentTrayPointerDown(event, draftId) {
                if (this.state.setupStage !== 'unit-deployment' || event.button !== 0) {
                    return;
                }
                event.preventDefault();
                this.beginPlaceFromTray(event, draftId, 'tray', event.currentTarget);
                this.markDeploymentTraySelection(draftId);
                this.paintUnitDeploymentCanvas();
                this.syncDeploymentHud();
            },

            onDeploymentPointerDown(event) {
                if (this.state.setupStage !== 'unit-deployment') {
                    return;
                }
                const deployment = this.getDeploymentSetup();
                if (!deployment) {
                    return;
                }
                if (event.button === 2) {
                    this.withDeploymentView(() => this.onPointerDown(event));
                    return;
                }
                if (deployment.selectedTrayId) {
                    this.beginPlaceFromTray(event, deployment.selectedTrayId, 'canvas', this.ui.deploymentCanvas);
                    this.paintUnitDeploymentCanvas();
                    return;
                }
                this.withDeploymentView(() => this.onPointerDown(event));
                this.syncDeploymentSelection();
            },

            onDeploymentPointerMove(event) {
                const deployment = this.getDeploymentSetup();
                const trayInteraction = deployment?.interaction;
                if (trayInteraction && trayInteraction.pointerId === event.pointerId && trayInteraction.type === 'place-from-tray') {
                    const dx = event.clientX - trayInteraction.startClientX;
                    const dy = event.clientY - trayInteraction.startClientY;
                    if (Math.abs(dx) > data.DRAG_THRESHOLD || Math.abs(dy) > data.DRAG_THRESHOLD) {
                        trayInteraction.moved = true;
                    }
                    trayInteraction.point = this.deploymentScreenToWorld(event);
                    this.paintUnitDeploymentCanvas();
                    return;
                }
                this.withDeploymentView(() => this.onPointerMove(event));
            },

            releaseDeploymentPointerCapture(event, captureTarget) {
                const target = captureTarget || this.ui.deploymentCanvas;
                if (target && typeof target.hasPointerCapture === 'function' && target.hasPointerCapture(event.pointerId)) {
                    target.releasePointerCapture(event.pointerId);
                }
            },

            finishPlaceFromTray(event) {
                const deployment = this.getDeploymentSetup();
                const interaction = deployment?.interaction;
                if (!interaction || interaction.type !== 'place-from-tray') {
                    return;
                }
                this.releaseDeploymentPointerCapture(event, interaction.captureTarget);
                deployment.interaction = null;
                if (interaction.source === 'tray' && !interaction.moved) {
                    this.updateStatus('Selected unit. Click the board to place it, or drag it onto the board.');
                    this.syncUiFromState();
                    return;
                }
                if (this.isEventOverDeploymentTray(event)
                    || (interaction.source === 'tray' && !this.isEventOverDeploymentCanvas(event))) {
                    deployment.selectedTrayId = null;
                    this.updateStatus('Placement cancelled.');
                    this.syncUiFromState();
                    return;
                }
                const trayIndex = deployment.tray.findIndex((entry) => entry.draftId === interaction.draftId);
                const trayEntry = trayIndex >= 0 ? deployment.tray[trayIndex] : null;
                if (!trayEntry || trayEntry.playerId !== deployment.activePlayerId) {
                    this.updateStatus('Select one of your undeployed units first.');
                    this.syncUiFromState();
                    return;
                }
                const candidate = this.buildDeployedUnit(trayEntry, this.deploymentScreenToWorld(event));
                this.snapDeploymentUnits([candidate], [candidate.id]);
                if (!this.isUnitPlacementInZone(candidate, trayEntry.playerId)) {
                    this.updateStatus('Invalid deployment: every corner must remain on the board and inside your deployment quarter.');
                    this.syncUiFromState();
                    return;
                }
                if (this.findDeploymentOverlap(candidate, null)) {
                    this.updateStatus('Invalid deployment: units cannot overlap.');
                    this.syncUiFromState();
                    return;
                }
                this.state.units.push(candidate);
                deployment.tray.splice(trayIndex, 1);
                deployment.selectedTrayId = null;
                deployment.selectedUnitId = candidate.id;
                deployment.deployedByPlayerId[trayEntry.playerId].push(candidate.id);
                this.state.selectedIds = [candidate.id];
                this.updateSelectionAnalysis();
                this.updateStatus(`${this.getPlayerLabel(trayEntry.playerId)} deployed ${trayEntry.type}.`);
                this.syncUiFromState();
            },

            onDeploymentPointerUp(event) {
                const deployment = this.getDeploymentSetup();
                if (deployment?.interaction?.pointerId === event.pointerId) {
                    this.finishPlaceFromTray(event);
                    return;
                }
                this.withDeploymentView(() => {
                    const interaction = this.state.interaction;
                    if (interaction && interaction.pointerId === event.pointerId && interaction.moved
                        && ['move-edit', 'rotate-single', 'rotate-rank'].includes(interaction.type)
                        && this.isEventOverDeploymentTray(event)) {
                        this.returnDeployedUnitsToTray(interaction.draftIds || [...this.state.selectedIds]);
                    } else {
                        this.restoreIllegalDeploymentPlacement(interaction);
                    }
                    this.onPointerUp(event);
                });
                this.syncDeploymentSelection();
            },

            finishDeploymentTurn() {
                const deployment = this.getDeploymentSetup();
                if (!deployment || this.state.setupStage !== 'unit-deployment') {
                    return;
                }
                if (!this.canFinishDeploymentTurn()) {
                    this.updateStatus('Finish is only available when all of your units are legally deployed in your assigned quarter.');
                    return;
                }
                if (deployment.activePlayerId === deployment.defenderPlayerId) {
                    deployment.activePlayerId = deployment.attackerPlayerId;
                    deployment.selectedTrayId = null;
                    deployment.selectedUnitId = null;
                    this.state.selectedIds = [];
                    this.updateSelectionAnalysis();
                    this.updateStatus(`${this.getPlayerLabel(deployment.attackerPlayerId)} now deploys in the top quarter.`);
                    this.syncUiFromState();
                    return;
                }
                const firstPlayerId = deployment.defenderPlayerId;
                this.state.setupStage = 'game';
                this.state.mode = 'game';
                this.state.setup.deployment = null;
                this.state.activePlayerId = firstPlayerId;
                this.state.phase = 'move';
                this.state.remainingMoves = this.rollDie();
                this.state.selectedIds = [];
                this.state.draft = null;
                this.state.formUp = null;
                this.state.shooting = null;
                this.state.melee = null;
                this.state.combatResolution = null;
                this.state.losses = { 'player-1': [], 'player-2': [] };
                this.state.editHistory = [];
                this.state.placingUnit = false;
                this.state.marquee = null;
                this.state.interaction = null;
                this.state.setup.confirmation = null;
                this.resetMovedFlags();
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                this.requestRender();
                this.updateStatus(`Deployment complete. ${this.getPlayerLabel(firstPlayerId)} takes the first turn with ${this.state.remainingMoves} moves.`);
            },

            getAutoDeployRole(type) {
                if (type === 'Flyers') {
                    return 'flyer';
                }
                if (type === 'Artillery') {
                    return 'rear';
                }
                if (type === 'Shooter') {
                    return 'front';
                }
                const template = data.UNIT_TYPES[type];
                if (!template) {
                    return 'front';
                }
                if (template.troopClass === 'mounted' && template.moves.good >= 400 && type !== 'Beasts' && type !== 'Behemoth') {
                    return 'fast';
                }
                if (template.combat?.ignoresBadGoingPenalty) {
                    return 'bad-going';
                }
                return 'front';
            },

            unitPrefersBadGoing(type) {
                return Boolean(data.UNIT_TYPES[type]?.combat?.ignoresBadGoingPenalty);
            },

            getDeploymentZoneBounds(playerId) {
                const zone = this.getDeploymentZone(playerId);
                if (zone === 'bottom') {
                    return {
                        zone,
                        minY: data.BOARD_SIZE * 0.75,
                        maxY: data.BOARD_SIZE,
                        midY: data.BOARD_SIZE * 0.875
                    };
                }
                return {
                    zone,
                    minY: 0,
                    maxY: data.BOARD_SIZE * 0.25,
                    midY: data.BOARD_SIZE * 0.125
                };
            },

            getAutoDeployDepthY(playerId, band) {
                const bounds = this.getDeploymentZoneBounds(playerId);
                const span = bounds.maxY - bounds.minY;
                if (bounds.zone === 'bottom') {
                    if (band === 'front') {
                        return bounds.minY + span * 0.32;
                    }
                    if (band === 'rear') {
                        return bounds.minY + span * 0.78;
                    }
                    return bounds.midY;
                }
                if (band === 'front') {
                    return bounds.maxY - span * 0.32;
                }
                if (band === 'rear') {
                    return bounds.maxY - span * 0.78;
                }
                return bounds.midY;
            },

            buildAutoDeployFormations(trayEntries) {
                const byType = new Map();
                trayEntries.forEach((entry) => {
                    if (!byType.has(entry.type)) {
                        byType.set(entry.type, []);
                    }
                    byType.get(entry.type).push(entry);
                });
                const formations = [];
                byType.forEach((entries, type) => {
                    for (let index = 0; index < entries.length; index += data.AUTO_DEPLOY_MAX_RANK) {
                        formations.push({
                            type,
                            role: this.getAutoDeployRole(type),
                            prefersBadGoing: this.unitPrefersBadGoing(type),
                            entries: entries.slice(index, index + data.AUTO_DEPLOY_MAX_RANK)
                        });
                    }
                });
                return formations.sort((left, right) => (ROLE_ORDER[left.role] - ROLE_ORDER[right.role])
                    || left.type.localeCompare(right.type)
                    || left.entries[0].draftId.localeCompare(right.entries[0].draftId));
            },

            collectBadGoingAnchors(playerId) {
                const bounds = this.getDeploymentZoneBounds(playerId);
                const anchors = [];
                (this.state.terrain?.features || []).forEach((feature) => {
                    if (!BAD_GOING_KINDS.has(feature.kind)) {
                        return;
                    }
                    const nearZone = feature.cy >= bounds.minY - 60 && feature.cy <= bounds.maxY + 80;
                    if (!nearZone) {
                        return;
                    }
                    const behindY = bounds.zone === 'bottom'
                        ? Math.min(bounds.maxY - 24, Math.max(bounds.minY + 24, feature.cy + 28))
                        : Math.max(bounds.minY + 24, Math.min(bounds.maxY - 24, feature.cy - 28));
                    const inY = geometry.clamp(feature.cy, bounds.minY + 24, bounds.maxY - 24);
                    anchors.push({ x: feature.cx, y: inY, kind: feature.kind, mode: 'in' });
                    anchors.push({ x: feature.cx, y: behindY, kind: feature.kind, mode: 'behind' });
                });
                return anchors;
            },

            buildAutoDeployFormationUnits(formation, frontAnchor, allocateUnitId = () => this.allocateUnitId()) {
                const playerId = formation.entries[0].playerId;
                const rotation = this.getDefaultDeploymentRotation(playerId);
                const placeholders = formation.entries.map((entry) => data.createUnit(
                    entry.type,
                    entry.playerId,
                    entry.faction,
                    { x: 0, y: 0, rotation },
                    allocateUnitId
                ));
                const ranked = this.buildRankFromLead(placeholders, rotation, frontAnchor);
                return ranked.map((unit, index) => ({
                    entry: formation.entries[index],
                    unit
                }));
            },

            isAutoDeployBatchLegal(units) {
                for (let index = 0; index < units.length; index += 1) {
                    const unit = units[index];
                    if (!this.isUnitPlacementInZone(unit, this.getUnitPlayerId(unit))) {
                        return false;
                    }
                    const occupied = rules.sampleUnitTerrain(unit, this.state.terrain);
                    if (occupied.has('impassable')) {
                        return false;
                    }
                    if ((data.UNIT_TYPES[unit.type]?.moves?.bad || 0) <= 0 && (occupied.has('forest') || occupied.has('swamp'))) {
                        return false;
                    }
                    if (this.findDeploymentOverlap(unit, unit.id)) {
                        return false;
                    }
                    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
                        if (geometry.polygonsOverlap(
                            geometry.getUnitCorners(unit),
                            geometry.getUnitCorners(units[otherIndex])
                        )) {
                            return false;
                        }
                    }
                }
                return true;
            },

            collectFrontCorridorHits(unit) {
                const hits = { forest: 0, swamp: 0, water: 0, impassable: 0 };
                const corners = geometry.getUnitCorners(unit);
                const forward = geometry.getForwardVector(unit.rotation);
                const origins = [
                    corners.frontLeft,
                    geometry.midpoint(corners.frontLeft, corners.frontRight),
                    corners.frontRight
                ];
                for (let distance = FRONT_CORRIDOR_STEP; distance <= FRONT_CORRIDOR_DISTANCE; distance += FRONT_CORRIDOR_STEP) {
                    origins.forEach((origin) => {
                        const point = geometry.add(origin, geometry.scaleVector(forward, distance));
                        if (point.x < 0 || point.x > data.BOARD_SIZE || point.y < 0 || point.y > data.BOARD_SIZE) {
                            return;
                        }
                        const kind = rules.getTerrainTypeAt(point, this.state.terrain);
                        if (BLOCKING_AHEAD_KINDS.has(kind)) {
                            hits[kind] += 1;
                        }
                    });
                }
                return hits;
            },

            scoreFrontCorridor(unit, prefersBadGoing) {
                const hits = this.collectFrontCorridorHits(unit);
                let score = 0;
                if (hits.water > 0) {
                    score -= 26 + Math.min(hits.water, 6) * 3;
                }
                if (hits.impassable > 0) {
                    score -= 30 + Math.min(hits.impassable, 6) * 3;
                }
                const badHits = hits.forest + hits.swamp;
                if (prefersBadGoing) {
                    if (badHits > 0) {
                        score += 6;
                    }
                    return score;
                }
                if (badHits > 0) {
                    score -= 18 + Math.min(badHits, 8) * 3;
                } else if (hits.water === 0 && hits.impassable === 0) {
                    score += 10;
                }
                return score;
            },

            scoreAutoDeployFormation(formation, units, frontAnchor, enemyLine, isAttacker, friendlyFronts = []) {
                let score = 0;
                const playerId = formation.entries[0].playerId;
                const rotation = this.getDefaultDeploymentRotation(playerId);
                const forward = geometry.getForwardVector(rotation);
                units.forEach((unit) => {
                    const occupied = rules.sampleUnitTerrain(unit, this.state.terrain);
                    const inBadGoing = occupied.has('forest') || occupied.has('swamp');
                    if (formation.prefersBadGoing) {
                        score += inBadGoing ? 28 : -8;
                    } else if (formation.role !== 'flyer') {
                        score += inBadGoing ? -30 : 10;
                    }
                    if (formation.role !== 'flyer') {
                        score += this.scoreFrontCorridor(unit, formation.prefersBadGoing);
                    }
                });

                const midX = data.BOARD_SIZE / 2;
                const flankDistance = Math.abs(frontAnchor.x - midX);
                const allowsBehind = formation.role === 'fast' || formation.role === 'flyer' || formation.role === 'rear';

                if (formation.role === 'fast' || formation.role === 'flyer') {
                    score += Math.min(28, flankDistance / 9);
                    if (formation.role === 'flyer') {
                        score += 4;
                    }
                } else if (formation.role === 'rear') {
                    score += Math.min(18, flankDistance / 14);
                }

                if (friendlyFronts.length === 0) {
                    if (formation.role === 'front' || formation.role === 'bad-going') {
                        score += Math.max(0, 10 - (flankDistance / 30));
                    }
                } else {
                    const nearestDx = Math.min(...friendlyFronts.map((friendly) => Math.abs(friendly.x - frontAnchor.x)));
                    score += Math.min(40, nearestDx / 3);
                    const minFriendlyX = Math.min(...friendlyFronts.map((friendly) => friendly.x));
                    const maxFriendlyX = Math.max(...friendlyFronts.map((friendly) => friendly.x));
                    if (frontAnchor.x < minFriendlyX - 16 || frontAnchor.x > maxFriendlyX + 16) {
                        score += 18;
                    }

                    friendlyFronts.forEach((friendly) => {
                        const dx = Math.abs(frontAnchor.x - friendly.x);
                        if (dx > data.UNIT_WIDTH * 1.35) {
                            return;
                        }
                        const friendlyAhead = geometry.dot(geometry.subtract(friendly, frontAnchor), forward);
                        if (friendlyAhead <= 10) {
                            return;
                        }
                        score -= allowsBehind ? 14 : 60;
                    });
                }

                if (isAttacker && enemyLine.length > 0) {
                    let matchupPull = 0;
                    enemyLine.forEach((enemy) => {
                        const sampleWeight = 1 / (1 + (Math.abs(enemy.x - frontAnchor.x) / 48));
                        matchupPull += sampleWeight * (1 + data.getDeploymentMatchupScore(formation.type, enemy.type));
                    });
                    score += matchupPull * 14;
                }
                return score;
            },

            getEnemyDeploymentLine(playerId) {
                return this.state.units
                    .filter((unit) => this.getUnitPlayerId(unit) !== playerId)
                    .map((unit) => ({
                        type: unit.type,
                        x: geometry.getUnitCenter(unit).x
                    }));
            },

            chooseAutoDeployDepthBand(formation) {
                if (formation.role === 'rear') {
                    return ['rear', 'mid'];
                }
                if (formation.role === 'flyer' || formation.role === 'fast') {
                    return ['mid', 'front', 'rear'];
                }
                return ['mid', 'front'];
            },

            findAutoDeployPlacement(formation, occupiedFrontAnchors, enemyLine, isAttacker) {
                const playerId = formation.entries[0].playerId;
                const candidates = [];
                const pushCandidate = (x, y) => {
                    candidates.push({
                        x: geometry.clamp(x, 50, data.BOARD_SIZE - 50),
                        y
                    });
                };
                const rankWidth = Math.max(1, formation.entries.length) * data.UNIT_WIDTH;

                this.chooseAutoDeployDepthBand(formation).forEach((band) => {
                    const y = this.getAutoDeployDepthY(playerId, band);
                    for (let x = 60; x <= data.BOARD_SIZE - 60; x += 20) {
                        pushCandidate(x, y);
                    }
                    pushCandidate(data.BOARD_SIZE * 0.2, y);
                    pushCandidate(data.BOARD_SIZE * 0.35, y);
                    pushCandidate(data.BOARD_SIZE * 0.65, y);
                    pushCandidate(data.BOARD_SIZE * 0.8, y);
                });

                if (formation.prefersBadGoing) {
                    this.collectBadGoingAnchors(playerId).forEach((anchor) => {
                        pushCandidate(anchor.x, anchor.y);
                        pushCandidate(anchor.x - data.UNIT_WIDTH, anchor.y);
                        pushCandidate(anchor.x + data.UNIT_WIDTH, anchor.y);
                    });
                }

                if (formation.role === 'fast' || formation.role === 'flyer') {
                    const midY = this.getAutoDeployDepthY(playerId, 'mid');
                    const frontY = this.getAutoDeployDepthY(playerId, 'front');
                    const rearY = this.getAutoDeployDepthY(playerId, 'rear');
                    [midY, frontY, rearY].forEach((y) => {
                        pushCandidate(70, y);
                        pushCandidate(110, y);
                        pushCandidate(data.BOARD_SIZE - 70, y);
                        pushCandidate(data.BOARD_SIZE - 110, y);
                    });
                }

                occupiedFrontAnchors.forEach((anchor) => {
                    pushCandidate(anchor.x + rankWidth + 8, anchor.y);
                    pushCandidate(anchor.x - rankWidth - 8, anchor.y);
                    pushCandidate(anchor.x + rankWidth + data.UNIT_WIDTH, anchor.y);
                    pushCandidate(anchor.x - rankWidth - data.UNIT_WIDTH, anchor.y);
                });

                let best = null;
                candidates.forEach((frontAnchor) => {
                    let nextId = this.nextUnitId;
                    const built = this.buildAutoDeployFormationUnits(formation, frontAnchor, () => {
                        const id = `unit-${nextId}`;
                        nextId += 1;
                        return id;
                    });
                    const units = built.map((entry) => entry.unit);
                    if (!this.isAutoDeployBatchLegal(units)) {
                        return;
                    }
                    const score = this.scoreAutoDeployFormation(
                        formation,
                        units,
                        frontAnchor,
                        enemyLine,
                        isAttacker,
                        occupiedFrontAnchors
                    );
                    if (!best || score > best.score) {
                        best = { frontAnchor, built, score };
                    }
                });
                return best;
            },

            autoDeployActiveArmy() {
                const deployment = this.getDeploymentSetup();
                if (!deployment || this.state.setupStage !== 'unit-deployment') {
                    return;
                }
                const activePlayerId = deployment.activePlayerId;
                const trayEntries = deployment.tray.filter((entry) => entry.playerId === activePlayerId);
                if (trayEntries.length === 0) {
                    this.updateStatus('All of your units are already deployed.');
                    return;
                }

                const formations = this.buildAutoDeployFormations(trayEntries);
                const enemyLine = this.getEnemyDeploymentLine(activePlayerId);
                const isAttacker = activePlayerId === deployment.attackerPlayerId;
                const occupiedFrontAnchors = this.state.units
                    .filter((unit) => this.getUnitPlayerId(unit) === activePlayerId)
                    .map((unit) => this.getUnitFrontCenter(unit));
                let placedCount = 0;
                let skippedFormations = 0;

                formations.forEach((formation) => {
                    const stillAvailable = formation.entries.every((entry) => deployment.tray.some((trayEntry) => trayEntry.draftId === entry.draftId));
                    if (!stillAvailable) {
                        return;
                    }
                    const placement = this.findAutoDeployPlacement(formation, occupiedFrontAnchors, enemyLine, isAttacker);
                    if (!placement) {
                        skippedFormations += 1;
                        return;
                    }
                    placement.built.forEach(({ entry, unit }) => {
                        const trayIndex = deployment.tray.findIndex((trayEntry) => trayEntry.draftId === entry.draftId);
                        if (trayIndex < 0) {
                            return;
                        }
                        unit.draftId = entry.draftId;
                        this.state.units.push(unit);
                        deployment.tray.splice(trayIndex, 1);
                        deployment.deployedByPlayerId[activePlayerId].push(unit.id);
                        placedCount += 1;
                        occupiedFrontAnchors.push(this.getUnitFrontCenter(unit));
                    });
                    this.nextUnitId += placement.built.length;
                });

                deployment.selectedTrayId = null;
                deployment.selectedUnitId = null;
                deployment.interaction = null;
                this.state.selectedIds = [];
                this.updateSelectionAnalysis();
                this.syncUiFromState();
                if (placedCount === 0) {
                    this.updateStatus('Auto Deploy could not find legal placements for the remaining tray.');
                    return;
                }
                const remaining = deployment.tray.filter((entry) => entry.playerId === activePlayerId).length;
                this.updateStatus(remaining === 0
                    ? `Auto Deploy placed ${placedCount} unit${placedCount === 1 ? '' : 's'}. Adjust manually if needed, then finish.`
                    : `Auto Deploy placed ${placedCount} unit${placedCount === 1 ? '' : 's'}; ${remaining} remain undeployed${skippedFormations ? ` (${skippedFormations} formation${skippedFormations === 1 ? '' : 's'} could not fit)` : ''}.`);
            },

            paintUnitDeploymentCanvas() {
                const deployment = this.getDeploymentSetup();
                if (!deployment || !this.ui.deploymentCanvas || !this.deploymentCtx) {
                    return;
                }
                const canvas = this.ui.deploymentCanvas;
                const ctx = this.deploymentCtx;
                this.renderSetupCanvas('deployment', canvas, ctx, () => {
                    const scale = this.getSetupCamera('deployment').scale;
                    this.drawBoard(ctx);
                    this.drawTerrain(ctx);

                    const topBoundary = data.BOARD_SIZE * 0.25;
                    const bottomBoundary = data.BOARD_SIZE * 0.75;
                    ctx.save();
                    ctx.fillStyle = 'rgba(71, 101, 143, 0.2)';
                    ctx.fillRect(0, 0, data.BOARD_SIZE, topBoundary);
                    ctx.fillStyle = 'rgba(143, 82, 71, 0.2)';
                    ctx.fillRect(0, bottomBoundary, data.BOARD_SIZE, data.BOARD_SIZE - bottomBoundary);
                    ctx.strokeStyle = 'rgba(51, 43, 38, 0.45)';
                    ctx.lineWidth = 2 / scale;
                    ctx.beginPath();
                    ctx.moveTo(0, topBoundary);
                    ctx.lineTo(data.BOARD_SIZE, topBoundary);
                    ctx.moveTo(0, bottomBoundary);
                    ctx.lineTo(data.BOARD_SIZE, bottomBoundary);
                    ctx.stroke();
                    ctx.restore();

                    this.state.units.forEach((unit) => {
                        const selected = this.state.selectedIds.includes(unit.id);
                        const invalid = selected && !this.areDeploymentUnitsLegal([unit]);
                        this.drawUnitBase(ctx, unit, {
                            selected,
                            invalid,
                            highlighted: false,
                            needsShootingDeclaration: false,
                            ghost: false
                        });
                    });
                    this.drawSelectionHandles(ctx);
                    if (this.state.marquee) {
                        this.drawMarquee(ctx);
                    }
                    const interaction = deployment.interaction;
                    if (interaction?.type === 'place-from-tray') {
                        const trayEntry = deployment.tray.find((entry) => entry.draftId === interaction.draftId);
                        if (trayEntry) {
                            const preview = this.buildDeployedUnit(trayEntry, interaction.point, () => 'deployment-preview');
                            this.snapDeploymentUnits([preview], [preview.id]);
                            const invalid = !this.isUnitPlacementInZone(preview, trayEntry.playerId) || Boolean(this.findDeploymentOverlap(preview));
                            this.drawUnitBase(ctx, preview, {
                                selected: false,
                                invalid,
                                highlighted: false,
                                needsShootingDeclaration: false,
                                ghost: true
                            });
                        }
                    }
                });
            },

            syncDeploymentHud() {
                const deployment = this.getDeploymentSetup();
                if (!deployment) {
                    return;
                }
                const activePlayerId = deployment.activePlayerId;
                const zone = deployment.zoneByPlayerId[activePlayerId];
                const expected = this.getDeploymentPlayerTotal(activePlayerId);
                const deployedCount = deployment.deployedByPlayerId[activePlayerId].length;
                if (this.ui.deploymentActivePlayer) {
                    this.ui.deploymentActivePlayer.textContent = `${this.getPlayerLabel(activePlayerId)} deploying (${zone === 'bottom' ? 'bottom quarter' : 'top quarter'})`;
                }
                if (this.ui.deploymentProgress) {
                    this.ui.deploymentProgress.textContent = `${deployedCount} / ${expected} units deployed`;
                }
                if (this.ui.deploymentStatus) {
                    this.ui.deploymentStatus.textContent = 'Every deployed unit must stay on the board, fully inside its assigned quarter, and cannot overlap any other deployed unit.';
                }
                if (this.ui.finishDeploymentButton) {
                    this.ui.finishDeploymentButton.disabled = !this.canFinishDeploymentTurn();
                }
                if (this.ui.autoDeployButton) {
                    const remainingTray = deployment.tray.filter((entry) => entry.playerId === activePlayerId).length;
                    this.ui.autoDeployButton.disabled = remainingTray === 0;
                }
                if (this.ui.returnToTrayButton) {
                    const selectedCount = this.getSelectedUnits()
                        .filter((unit) => this.getUnitPlayerId(unit) === activePlayerId).length;
                    this.ui.returnToTrayButton.disabled = selectedCount === 0;
                }
                if (this.ui.deploymentSnapCheckbox) {
                    this.ui.deploymentSnapCheckbox.checked = this.state.snapEnabled;
                }
            },

            syncDeploymentTray() {
                const deployment = this.getDeploymentSetup();
                if (!deployment || !this.ui.deploymentTray) {
                    return;
                }
                if (deployment.interaction || this.state.interaction) {
                    return;
                }
                const activePlayerId = deployment.activePlayerId;
                const trayEntries = deployment.tray.filter((entry) => entry.playerId === activePlayerId);
                this.ui.deploymentTray.innerHTML = trayEntries.length === 0
                    ? '<p class="deployment-empty">All units deployed for this player.</p>'
                    : trayEntries.map((entry) => {
                        const colors = this.getPlayerColors(entry.playerId);
                        const assetPath = this.getUnitAssetPath(entry);
                        const depth = data.UNIT_TYPES[entry.type]?.depth || data.UNIT_WIDTH;
                        return (`
                            <button type="button" class="deployment-tray-item${deployment.selectedTrayId === entry.draftId ? ' is-selected' : ''}" data-deploy-draft="${entry.draftId}" draggable="false" style="--player-fill: ${colors.fill}; --player-stroke: ${colors.stroke}; --unit-depth: ${depth};">
                                <span class="deployment-unit-preview"><img src="${assetPath}" alt="" aria-hidden="true" draggable="false"></span>
                                <span class="deployment-tray-name">${entry.type}</span>
                            </button>
                        `);
                    }).join('');
                this.ui.deploymentTray.querySelectorAll('[data-deploy-draft]').forEach((button) => {
                    button.addEventListener('pointerdown', (event) => this.onDeploymentTrayPointerDown(event, button.dataset.deployDraft));
                    button.addEventListener('pointermove', (event) => this.onDeploymentPointerMove(event));
                    button.addEventListener('pointerup', (event) => this.onDeploymentPointerUp(event));
                    button.addEventListener('pointercancel', (event) => this.onDeploymentPointerUp(event));
                });
            },

            renderUnitDeployment() {
                this.paintUnitDeploymentCanvas();
                this.syncDeploymentHud();
                this.syncDeploymentTray();
            }
        });
    }

    return { install };
}));