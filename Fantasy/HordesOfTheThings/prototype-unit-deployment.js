(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'), require('./prototype-geometry.js'));
        return;
    }
    root.HordesUnitDeployment = factory(root.HordesData, root.HordesGeometry);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry) {
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

            deploymentScreenToWorld(event) {
                return this.setupScreenToWorld(event, 'deployment', this.ui.deploymentCanvas);
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
                return corners.every((corner) => corner.y >= boundary.minY && corner.y <= boundary.maxY);
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
                return data.createUnit(
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
                this.syncUiFromState();
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
                    const camera = this.getSetupCamera('deployment');
                    this.ui.deploymentCanvas.setPointerCapture(event.pointerId);
                    deployment.interaction = {
                        type: 'pan',
                        pointerId: event.pointerId,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        cameraStartX: camera.x,
                        cameraStartY: camera.y
                    };
                    return;
                }
                const world = this.deploymentScreenToWorld(event);
                const activePlayerId = deployment.activePlayerId;
                if (deployment.selectedTrayId) {
                    this.ui.deploymentCanvas.setPointerCapture(event.pointerId);
                    deployment.interaction = {
                        type: 'place-from-tray',
                        pointerId: event.pointerId,
                        draftId: deployment.selectedTrayId,
                        point: world
                    };
                    return;
                }
                const hit = this.pickUnit(world);
                if (!hit || this.getUnitPlayerId(hit) !== activePlayerId) {
                    deployment.selectedUnitId = null;
                    this.syncUiFromState();
                    return;
                }
                this.ui.deploymentCanvas.setPointerCapture(event.pointerId);
                deployment.selectedUnitId = hit.id;
                deployment.interaction = {
                    type: 'move-unit',
                    pointerId: event.pointerId,
                    unitId: hit.id,
                    start: world,
                    base: { ...hit }
                };
                this.syncUiFromState();
            },

            onDeploymentPointerMove(event) {
                const deployment = this.getDeploymentSetup();
                const interaction = deployment?.interaction;
                if (!interaction || interaction.pointerId !== event.pointerId) {
                    return;
                }
                if (interaction.type === 'pan') {
                    this.panSetupCamera(interaction, event, 'deployment');
                    this.renderUnitDeployment();
                    return;
                }
                const world = this.deploymentScreenToWorld(event);
                if (interaction.type === 'place-from-tray') {
                    interaction.point = world;
                    this.renderUnitDeployment();
                    return;
                }
                if (interaction.type !== 'move-unit') {
                    return;
                }
                const unit = this.getUnitById(interaction.unitId);
                if (!unit) {
                    return;
                }
                const delta = geometry.subtract(world, interaction.start);
                unit.x = interaction.base.x + delta.x;
                unit.y = interaction.base.y + delta.y;
                this.snapDeploymentUnits([unit], [unit.id]);
                this.renderUnitDeployment();
            },

            onDeploymentPointerUp(event) {
                const deployment = this.getDeploymentSetup();
                const interaction = deployment?.interaction;
                if (this.ui.deploymentCanvas.hasPointerCapture(event.pointerId)) {
                    this.ui.deploymentCanvas.releasePointerCapture(event.pointerId);
                }
                if (!interaction || interaction.pointerId !== event.pointerId) {
                    return;
                }
                deployment.interaction = null;
                if (interaction.type === 'pan') {
                    return;
                }
                const point = this.deploymentScreenToWorld(event);
                if (interaction.type === 'place-from-tray') {
                    const trayIndex = deployment.tray.findIndex((entry) => entry.draftId === interaction.draftId);
                    const trayEntry = trayIndex >= 0 ? deployment.tray[trayIndex] : null;
                    if (!trayEntry || trayEntry.playerId !== deployment.activePlayerId) {
                        this.updateStatus('Select one of your undeployed units first.');
                        return;
                    }
                    const candidate = this.buildDeployedUnit(trayEntry, point);
                    this.snapDeploymentUnits([candidate], [candidate.id]);
                    if (!this.isUnitPlacementInZone(candidate, trayEntry.playerId)) {
                        this.updateStatus('Invalid deployment: every corner must remain inside your deployment quarter.');
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
                    this.updateStatus(`${this.getPlayerLabel(trayEntry.playerId)} deployed ${trayEntry.type}.`);
                    return;
                }
                if (interaction.type !== 'move-unit') {
                    return;
                }
                const movedUnit = this.getUnitById(interaction.unitId);
                if (!movedUnit) {
                    return;
                }
                if (!this.isUnitPlacementInZone(movedUnit, deployment.activePlayerId)) {
                    Object.assign(movedUnit, interaction.base);
                    this.updateStatus('Invalid move: deployed units must stay inside the assigned deployment quarter.');
                    return;
                }
                if (this.findDeploymentOverlap(movedUnit, movedUnit.id)) {
                    Object.assign(movedUnit, interaction.base);
                    this.updateStatus('Invalid move: deployed units cannot overlap.');
                    return;
                }
                this.updateStatus('Deployment position updated.');
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

            renderUnitDeployment() {
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
                        this.drawUnitBase(ctx, unit, {
                            selected: deployment.selectedUnitId === unit.id,
                            invalid: false,
                            highlighted: false,
                            needsShootingDeclaration: false,
                            ghost: false
                        });
                    });
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
                    this.ui.deploymentStatus.textContent = 'Every deployed unit must be fully inside its assigned quarter and cannot overlap any other deployed unit.';
                }
                if (this.ui.finishDeploymentButton) {
                    this.ui.finishDeploymentButton.disabled = !this.canFinishDeploymentTurn();
                }
                if (this.ui.deploymentSnapCheckbox) {
                    this.ui.deploymentSnapCheckbox.checked = this.state.snapEnabled;
                }
                if (this.ui.deploymentTray) {
                    const trayEntries = deployment.tray.filter((entry) => entry.playerId === activePlayerId);
                    this.ui.deploymentTray.innerHTML = trayEntries.length === 0
                        ? '<p class="deployment-empty">All units deployed for this player.</p>'
                        : trayEntries.map((entry) => {
                            const colors = this.getPlayerColors(entry.playerId);
                            const assetPath = this.getUnitAssetPath(entry);
                            const depth = data.UNIT_TYPES[entry.type]?.depth || data.UNIT_WIDTH;
                            return (`
                            <button type="button" class="deployment-tray-item${deployment.selectedTrayId === entry.draftId ? ' is-selected' : ''}" data-deploy-draft="${entry.draftId}" style="--player-fill: ${colors.fill}; --player-stroke: ${colors.stroke}; --unit-depth: ${depth};">
                                <span class="deployment-unit-preview"><img src="${assetPath}" alt="" aria-hidden="true"></span>
                                <span class="deployment-tray-name">${entry.type}</span>
                            </button>
                        `);
                        }).join('');
                    this.ui.deploymentTray.querySelectorAll('[data-deploy-draft]').forEach((button) => {
                        button.addEventListener('click', () => this.selectDeploymentTrayUnit(button.dataset.deployDraft));
                    });
                }
            }
        });
    }

    return { install };
}));