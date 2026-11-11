(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../data.js'), require('../geometry.js'));
        return;
    }
    root.HordesTerrainPlacement = factory(root.HordesData, root.HordesGeometry);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry) {
    function install(TerrainPrototype) {
        Object.assign(TerrainPrototype.prototype, {
            rollTerrainCount(random = Math.random) {
                return 2 + Math.floor(random() * 4) + Math.floor(random() * 4);
            },

            createTerrainSetup(random = Math.random) {
                return {
                    defenderPlayerId: null,
                    terrainCount: this.rollTerrainCount(random),
                    offers: [],
                    selectedTerrainId: null,
                    nextTerrainId: 1
                };
            },

            getTerrainSetup() {
                return this.state.setup?.terrain || null;
            },

            createTerrainOffers(random = Math.random) {
                const terrain = this.getTerrainSetup();
                if (!terrain) {
                    return [];
                }
                const weightedKinds = this.getWeightedTerrainOfferKinds();
                terrain.offers = Array.from({ length: 3 }, () => {
                    const kind = weightedKinds[Math.floor(random() * weightedKinds.length)];
                    const offer = this.createConfiguredTerrainOffer(kind, `terrain-${terrain.nextTerrainId}`, random);
                    terrain.nextTerrainId += 1;
                    return offer;
                });
                return terrain.offers;
            },

            initializeTerrainPlacement(random = Math.random) {
                const terrain = this.createTerrainSetup(random);
                terrain.defenderPlayerId = random() < 0.5 ? 'player-1' : 'player-2';
                terrain.baseSelected = true;
                this.state.setup.terrain = terrain;
                this.state.terrain = { roads: [], features: [] };
                terrain.base = this.createDefenderBasePlacement(
                    terrain.defenderPlayerId,
                    this.getPlayer(terrain.defenderPlayerId)?.faction
                );
                delete this.state.setupCameras?.terrain;
                this.createTerrainOffers(random);
                return terrain;
            },

            getPlacedTerrainCount() {
                return this.state.terrain.roads.length + this.state.terrain.features.length;
            },

            isTerrainReady() {
                const terrain = this.getTerrainSetup();
                const base = this.basePlacementToUnit(terrain?.base);
                return Boolean(terrain)
                    && Boolean(base)
                    && geometry.baseMeetsEdgeClearance(base)
                    && this.getPlacedTerrainCount() === terrain.terrainCount;
            },

            setTerrainCount(value) {
                const terrain = this.getTerrainSetup();
                if (!terrain) {
                    return;
                }
                terrain.terrainCount = geometry.clamp(Math.round(Number(value) || 0), 0, data.TERRAIN_COUNT_MAX);
                if (this.getPlacedTerrainCount() > terrain.terrainCount) {
                    terrain.terrainCount = this.getPlacedTerrainCount();
                }
                this.syncUiFromState();
            },

            placeTerrainOffer(offerId) {
                const terrain = this.getTerrainSetup();
                if (!terrain || this.getPlacedTerrainCount() >= terrain.terrainCount) {
                    return;
                }
                const offerIndex = terrain.offers.findIndex((offer) => offer.id === offerId);
                if (offerIndex < 0) {
                    return;
                }
                const offer = terrain.offers[offerIndex];
                const placed = { ...offer };
                if (placed.kind === 'road') {
                    this.state.terrain.roads.push(placed);
                } else {
                    this.state.terrain.features.push(placed);
                }
                terrain.selectedTerrainId = placed.id;
                this.createTerrainOffers();
                this.updateStatus(`${data.TERRAIN_STYLE[placed.kind].label} placed. Drag it on the board or rotate the selection.`);
            },

            terrainPiecesOverlap(left, right) {
                if (left.kind === 'road' && right.kind === 'road') {
                    return true;
                }
                const road = left.kind === 'road' ? left : right.kind === 'road' ? right : null;
                const feature = road === left ? right : road === right ? left : null;
                if (road) {
                    const points = geometry.getTerrainFeaturePoints(feature);
                    return points.some((point) => (
                        road.orientation === 'horizontal'
                            ? Math.abs(point.y - road.position) <= road.width / 2
                            : Math.abs(point.x - road.position) <= road.width / 2
                    )) || geometry.pointInBlob(
                        road.orientation === 'horizontal'
                            ? { x: feature.cx, y: road.position }
                            : { x: road.position, y: feature.cy },
                        feature
                    );
                }
                const leftPoints = geometry.getTerrainFeaturePoints(left);
                const rightPoints = geometry.getTerrainFeaturePoints(right);
                return leftPoints.some((point) => geometry.pointInBlob(point, right))
                    || rightPoints.some((point) => geometry.pointInBlob(point, left))
                    || geometry.pointInBlob({ x: left.cx, y: left.cy }, right)
                    || geometry.pointInBlob({ x: right.cx, y: right.cy }, left);
            },

            canPlaceTerrainPiece(piece) {
                if (this.terrainPieceOverlapsBase(piece)) {
                    return false;
                }
                return ![...this.state.terrain.roads, ...this.state.terrain.features]
                    .some((placed) => this.terrainPiecesOverlap(piece, placed));
            },

            createDefenderBasePlacement(playerId, faction) {
                const footprint = data.getBaseFootprint(faction);
                if (!footprint) {
                    throw new Error('No base artwork for faction: ' + faction);
                }
                const pose = data.baseHomeEdgePose(footprint);
                const placement = geometry.positionBaseOnHomeEdge({
                    playerId,
                    faction,
                    x: pose.x,
                    y: pose.y,
                    rotation: pose.rotation,
                    width: footprint.width,
                    depth: footprint.depth,
                    outline: footprint.points.map((point) => ({ x: point.x, y: point.y }))
                });
                return {
                    playerId,
                    faction,
                    x: placement.x,
                    y: placement.y,
                    rotation: placement.rotation,
                    width: footprint.width,
                    depth: footprint.depth,
                    outline: placement.outline
                };
            },

            basePlacementToUnit(base) {
                if (!base) {
                    return null;
                }
                return {
                    x: base.x,
                    y: base.y,
                    rotation: base.rotation || 0,
                    width: base.width,
                    depth: base.depth,
                    outline: base.outline
                };
            },

            getDefenderBase() {
                return this.getTerrainSetup()?.base || null;
            },

            terrainPieceOverlapsBase(piece) {
                const unit = this.basePlacementToUnit(this.getDefenderBase());
                if (!unit || !piece) {
                    return false;
                }
                const points = geometry.getUnitFootprintPoints(unit);
                if (piece.kind === 'road') {
                    return points.some((point) => (
                        piece.orientation === 'horizontal'
                            ? Math.abs(point.y - piece.position) <= piece.width / 2
                            : Math.abs(point.x - piece.position) <= piece.width / 2
                    ));
                }
                if (points.some((point) => geometry.pointInBlob(point, piece))) {
                    return true;
                }
                return geometry.getTerrainFeaturePoints(piece).some((point) => geometry.pointInPolygon(point, points));
            },

            getBaseRotationHandle(base) {
                const unit = this.basePlacementToUnit(base);
                const center = geometry.getUnitCenter(unit);
                const forward = geometry.getForwardVector(unit.rotation || 0);
                return geometry.add(center, geometry.scaleVector(forward, (Math.max(unit.width, unit.depth) / 2) + 28));
            },

            drawPlacementBase(ctx, base, selected) {
                const unit = this.basePlacementToUnit(base);
                if (!unit) {
                    return;
                }
                const points = geometry.getUnitFootprintPoints(unit);
                const colors = this.getPlayerColors(base.playerId);
                const scale = this.getSetupCamera('terrain').scale || 1;
                ctx.save();
                ctx.beginPath();
                geometry.tracePointPolygon(ctx, points);
                ctx.fillStyle = colors.fill;
                ctx.fill();
                const image = typeof this.getUnitAsset === 'function'
                    ? this.getUnitAsset({ type: 'Base', faction: base.faction })
                    : null;
                if (image) {
                    ctx.save();
                    ctx.translate(unit.x, unit.y);
                    ctx.rotate(unit.rotation || 0);
                    ctx.drawImage(image, 0, 0, unit.width, unit.depth);
                    ctx.restore();
                }
                ctx.beginPath();
                geometry.tracePointPolygon(ctx, points);
                ctx.strokeStyle = selected ? '#f6dc73' : colors.stroke;
                ctx.lineWidth = (selected ? 4 : 2) / scale;
                ctx.stroke();
                ctx.restore();
            },

            createRandomTerrainPiece(random = Math.random) {
                const terrain = this.getTerrainSetup();
                const weightedKinds = this.getWeightedTerrainOfferKinds();
                const kind = weightedKinds[Math.floor(random() * weightedKinds.length)];
                const piece = this.createConfiguredTerrainOffer(kind, `terrain-${terrain.nextTerrainId}`, random);
                terrain.nextTerrainId += 1;
                if (piece.kind === 'road') {
                    piece.position = random() * data.BOARD_SIZE;
                } else {
                    piece.cx = random() * data.BOARD_SIZE;
                    piece.cy = random() * data.BOARD_SIZE;
                    piece.rotation = random() * Math.PI * 2;
                }
                return piece;
            },

            autoPlaceTerrain(random = Math.random) {
                const terrain = this.getTerrainSetup();
                if (!terrain) {
                    return;
                }
                let placedCount = 0;
                const attemptLimit = 160;
                while (this.getPlacedTerrainCount() < terrain.terrainCount) {
                    let piece = null;
                    for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
                        const candidate = this.createRandomTerrainPiece(random);
                        if (this.canPlaceTerrainPiece(candidate)) {
                            piece = candidate;
                            break;
                        }
                    }
                    if (!piece) {
                        break;
                    }
                    if (piece.kind === 'road') {
                        this.state.terrain.roads.push(piece);
                    } else {
                        this.state.terrain.features.push(piece);
                    }
                    terrain.selectedTerrainId = piece.id;
                    placedCount += 1;
                }
                this.createTerrainOffers(random);
                this.updateStatus(placedCount > 0
                    ? `Placed ${placedCount} random terrain piece${placedCount === 1 ? '' : 's'} without overlap.`
                    : 'No additional non-overlapping terrain positions were available.');
            },

            getTerrainPieceById(id) {
                return this.state.terrain.roads.find((piece) => piece.id === id)
                    || this.state.terrain.features.find((piece) => piece.id === id)
                    || null;
            },

            pickTerrainPiece(point) {
                const feature = [...this.state.terrain.features].reverse().find((entry) => geometry.pointInBlob(point, entry));
                if (feature) {
                    return feature;
                }
                return [...this.state.terrain.roads].reverse().find((road) => (
                    road.orientation === 'horizontal'
                        ? Math.abs(point.y - road.position) <= road.width / 2
                        : Math.abs(point.x - road.position) <= road.width / 2
                )) || null;
            },

            terrainScreenToWorld(event) {
                return this.setupScreenToWorld(event, 'terrain', this.ui.terrainCanvas);
            },

            onTerrainPointerDown(event) {
                if (this.state.setupStage !== 'terrain-placement') {
                    return;
                }
                if (event.button === 1 || event.button === 2) {
                    if (event.button === 1 && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                    }
                    const camera = this.getSetupCamera('terrain');
                    this.ui.terrainCanvas.setPointerCapture(event.pointerId);
                    this.state.terrainInteraction = {
                        type: 'pan',
                        pointerId: event.pointerId,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        cameraStartX: camera.x,
                        cameraStartY: camera.y
                    };
                    return;
                }
                if (typeof this.isComputerPlayer === 'function'
                    && this.isComputerPlayer(this.getTerrainSetup()?.defenderPlayerId)) {
                    return;
                }
                const point = this.terrainScreenToWorld(event);
                const terrainSetup = this.getTerrainSetup();
                const base = terrainSetup?.base;
                if (base && terrainSetup.baseSelected && geometry.distance(point, this.getBaseRotationHandle(base)) <= 16) {
                    const unit = this.basePlacementToUnit(base);
                    this.ui.terrainCanvas.setPointerCapture(event.pointerId);
                    this.state.terrainInteraction = {
                        kind: 'base',
                        type: 'rotate',
                        pointerId: event.pointerId,
                        center: geometry.getUnitCenter(unit),
                        startAngle: geometry.angleBetween(geometry.getUnitCenter(unit), point),
                        baseUnit: unit,
                        baseRotation: unit.rotation
                    };
                    this.renderTerrainPlacement();
                    return;
                }
                if (base && geometry.pointInPolygon(point, geometry.getUnitFootprintPoints(this.basePlacementToUnit(base)))) {
                    terrainSetup.baseSelected = true;
                    terrainSetup.selectedTerrainId = null;
                    this.ui.terrainCanvas.setPointerCapture(event.pointerId);
                    this.state.terrainInteraction = {
                        kind: 'base',
                        type: 'move',
                        pointerId: event.pointerId,
                        start: point,
                        baseUnit: this.basePlacementToUnit(base)
                    };
                    this.renderTerrainPlacement();
                    return;
                }
                terrainSetup.baseSelected = false;
                const rotationPiece = this.getTerrainRotationHandleHit(point);
                if (rotationPiece) {
                    this.getTerrainSetup().selectedTerrainId = rotationPiece.id;
                    this.ui.terrainCanvas.setPointerCapture(event.pointerId);
                    this.state.terrainInteraction = {
                        type: 'rotate', pointerId: event.pointerId, pieceId: rotationPiece.id,
                        center: this.getTerrainPieceCenter(rotationPiece),
                        startAngle: geometry.angleBetween(this.getTerrainPieceCenter(rotationPiece), point),
                        base: { ...rotationPiece }
                    };
                    this.renderTerrainPlacement();
                    return;
                }
                const piece = this.pickTerrainPiece(point);
                this.ui.terrainCanvas.setPointerCapture(event.pointerId);
                if (!piece) {
                    this.getTerrainSetup().selectedTerrainId = null;
                    this.renderTerrainPlacement();
                    return;
                }
                this.getTerrainSetup().selectedTerrainId = piece.id;
                this.state.terrainInteraction = { pointerId: event.pointerId, pieceId: piece.id, start: point, base: { ...piece } };
                this.renderTerrainPlacement();
            },

            onTerrainPointerMove(event) {
                const interaction = this.state.terrainInteraction;
                if (!interaction || interaction.pointerId !== event.pointerId) {
                    return;
                }
                if (interaction.type === 'pan') {
                    this.panSetupCamera(interaction, event, 'terrain');
                    this.renderTerrainPlacement();
                    return;
                }
                if (interaction.kind === 'base') {
                    const base = this.getDefenderBase();
                    const point = this.terrainScreenToWorld(event);
                    if (!base) {
                        return;
                    }
                    if (interaction.type === 'rotate') {
                        const currentAngle = geometry.angleBetween(interaction.center, point);
                        const delta = geometry.normalizeAngle(currentAngle - interaction.startAngle);
                        const rotated = geometry.buildUnitFromCenter(
                            interaction.baseUnit,
                            interaction.center,
                            geometry.normalizeAngle(interaction.baseRotation + delta)
                        );
                        const fitted = geometry.translateUnitOntoBoard(rotated);
                        if (!geometry.baseMeetsEdgeClearance(fitted)) {
                            this.updateStatus('The base must keep a point within 400 paces of the center of the defended edge.');
                            this.renderTerrainPlacement();
                            return;
                        }
                        base.x = fitted.x;
                        base.y = fitted.y;
                        base.rotation = fitted.rotation;
                    } else {
                        const delta = geometry.subtract(point, interaction.start);
                        const moved = geometry.translateUnitOntoBoard({
                            ...interaction.baseUnit,
                            x: interaction.baseUnit.x + delta.x,
                            y: interaction.baseUnit.y + delta.y
                        });
                        if (!geometry.baseMeetsEdgeClearance(moved)) {
                            this.updateStatus('The base must keep a point within 400 paces of the center of the defended edge.');
                            this.renderTerrainPlacement();
                            return;
                        }
                        base.x = moved.x;
                        base.y = moved.y;
                    }
                    this.renderTerrainPlacement();
                    return;
                }
                const piece = this.getTerrainPieceById(interaction.pieceId);
                if (!piece) {
                    return;
                }
                const point = this.terrainScreenToWorld(event);
                if (interaction.type === 'rotate') {
                    const currentAngle = geometry.angleBetween(interaction.center, point);
                    const delta = geometry.normalizeAngle(currentAngle - interaction.startAngle);
                    if (piece.kind === 'road') {
                        const rotation = geometry.normalizeAngle((interaction.base.orientation === 'horizontal' ? 0 : Math.PI / 2) + delta);
                        piece.orientation = Math.abs(Math.cos(rotation)) >= Math.abs(Math.sin(rotation)) ? 'horizontal' : 'vertical';
                    } else {
                        piece.rotation = geometry.normalizeAngle((interaction.base.rotation || 0) + delta);
                    }
                    this.renderTerrainPlacement();
                    return;
                }
                const delta = geometry.subtract(point, interaction.start);
                if (piece.kind === 'road') {
                    piece.position = geometry.clamp(interaction.base.position + (piece.orientation === 'horizontal' ? delta.y : delta.x), 0, data.BOARD_SIZE);
                } else {
                    piece.cx = geometry.clamp(interaction.base.cx + delta.x, 0, data.BOARD_SIZE);
                    piece.cy = geometry.clamp(interaction.base.cy + delta.y, 0, data.BOARD_SIZE);
                }
                this.renderTerrainPlacement();
            },

            onTerrainPointerUp(event) {
                const interaction = this.state.terrainInteraction;
                if (this.ui.terrainCanvas.hasPointerCapture(event.pointerId)) {
                    this.ui.terrainCanvas.releasePointerCapture(event.pointerId);
                }
                if (!interaction || interaction.pointerId !== event.pointerId) {
                    return;
                }
                this.state.terrainInteraction = null;
                if (interaction.type === 'pan') {
                    return;
                }
                const movedBase = interaction.kind === 'base';
                this.updateStatus(movedBase
                    ? (interaction.type === 'rotate' ? 'Base rotation updated.' : 'Base position updated.')
                    : (interaction.type === 'rotate' ? 'Terrain rotation updated.' : 'Terrain position updated.'));
            },

            getTerrainPieceCenter(piece) {
                if (piece.kind !== 'road') {
                    return { x: piece.cx, y: piece.cy };
                }
                return piece.orientation === 'horizontal'
                    ? { x: data.BOARD_SIZE / 2, y: piece.position }
                    : { x: piece.position, y: data.BOARD_SIZE / 2 };
            },

            getTerrainRotationHandle(piece) {
                const center = this.getTerrainPieceCenter(piece);
                if (piece.kind === 'road') {
                    return piece.orientation === 'horizontal' ? { x: center.x, y: center.y - 34 } : { x: center.x + 34, y: center.y };
                }
                const distance = Math.max(piece.rx, piece.ry) + 28;
                const rotation = piece.rotation || 0;
                return { x: center.x + (Math.sin(rotation) * distance), y: center.y - (Math.cos(rotation) * distance) };
            },

            getTerrainRotationHandleHit(point) {
                const terrain = this.getTerrainSetup();
                const selected = this.getTerrainPieceById(terrain?.selectedTerrainId);
                return selected && geometry.distance(point, this.getTerrainRotationHandle(selected)) <= 16 ? selected : null;
            },

            renderTerrainPlacement() {
                const terrain = this.getTerrainSetup();
                if (!terrain || !this.ui.terrainCanvas) {
                    return;
                }
                const canvas = this.ui.terrainCanvas;
                const ctx = this.terrainCtx;
                this.renderSetupCanvas('terrain', canvas, ctx, () => {
                    const scale = this.getSetupCamera('terrain').scale;
                    this.drawBoard(ctx);
                    this.drawTerrain(ctx);
                    if (terrain.base) {
                        this.drawPlacementBase(ctx, terrain.base, terrain.baseSelected);
                    }
                    if (terrain.baseSelected && terrain.base) {
                        const baseHandle = this.getBaseRotationHandle(terrain.base);
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(baseHandle.x, baseHandle.y, 11, 0, Math.PI * 2);
                        ctx.fillStyle = '#f6dc73';
                        ctx.strokeStyle = '#554420';
                        ctx.lineWidth = 2 / scale;
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();
                    }
                    const selected = terrain.baseSelected ? null : this.getTerrainPieceById(terrain.selectedTerrainId);
                    if (!selected) {
                        return;
                    }
                    ctx.save();
                    ctx.strokeStyle = '#f6dc73';
                    ctx.lineWidth = 3 / scale;
                    ctx.beginPath();
                    if (selected.kind === 'road') {
                        if (selected.orientation === 'horizontal') ctx.strokeRect(0, selected.position - selected.width / 2, data.BOARD_SIZE, selected.width);
                        else ctx.strokeRect(selected.position - selected.width / 2, 0, selected.width, data.BOARD_SIZE);
                    } else {
                        geometry.drawBlob(ctx, selected);
                        ctx.stroke();
                    }
                    ctx.restore();
                    const handle = this.getTerrainRotationHandle(selected);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(handle.x, handle.y, 11, 0, Math.PI * 2);
                    ctx.fillStyle = '#f6dc73';
                    ctx.strokeStyle = '#554420';
                    ctx.lineWidth = 2 / scale;
                    ctx.fill();
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(handle.x, handle.y, 5.8, Math.PI * 0.2, Math.PI * 1.35, false);
                    ctx.strokeStyle = '#7e6420';
                    ctx.lineWidth = 1.6 / scale;
                    ctx.stroke();
                    const arrowTip = { x: handle.x + (Math.cos(Math.PI * 0.2) * 5.8), y: handle.y + (Math.sin(Math.PI * 0.2) * 5.8) };
                    this.drawArrowHead(ctx, arrowTip, -0.45);
                    ctx.restore();
                });
                this.ui.terrainCountInput.value = String(terrain.terrainCount);
                this.ui.terrainProgress.textContent = `Base placed · ${this.getPlacedTerrainCount()} / ${terrain.terrainCount} terrain`;
                this.ui.terrainDefender.textContent = `${this.getPlayerSelectLabel(terrain.defenderPlayerId)} is the defender. Place the base within 400 paces of the center of your edge, then the agreed terrain. Drag the base to move it.`;
                const computerDefender = typeof this.isComputerPlayer === 'function'
                    && this.isComputerPlayer(terrain.defenderPlayerId);
                if (this.ui.terrainCountInput) this.ui.terrainCountInput.disabled = computerDefender;
                if (this.ui.autoPlaceTerrainButton) {
                    this.ui.autoPlaceTerrainButton.hidden = computerDefender;
                    this.ui.autoPlaceTerrainButton.disabled = this.isTerrainReady();
                }
                if (this.ui.confirmTerrainButton) {
                    this.ui.confirmTerrainButton.hidden = computerDefender;
                    this.ui.confirmTerrainButton.disabled = !this.isTerrainReady();
                }
                this.ui.terrainOffers.innerHTML = terrain.offers.map((offer) => (`
                    <button type="button" class="terrain-offer" data-terrain-offer="${offer.id}"${computerDefender || this.getPlacedTerrainCount() >= terrain.terrainCount ? ' disabled' : ''}>
                        <canvas class="terrain-offer-preview" width="200" height="200" data-terrain-preview="${offer.id}" aria-hidden="true"></canvas>
                        <span>${data.TERRAIN_STYLE[offer.kind].label}</span>
                        <span class="terrain-offer-description">${this.getTerrainOfferDescription(offer)}</span>
                    </button>`)).join('');
                this.ui.terrainOffers.querySelectorAll('[data-terrain-preview]').forEach((previewCanvas) => {
                    const offer = terrain.offers.find((entry) => entry.id === previewCanvas.dataset.terrainPreview);
                    if (offer) this.drawTerrainOfferPreview(previewCanvas, offer);
                });
                this.ui.terrainOffers.querySelectorAll('[data-terrain-offer]').forEach((button) => {
                    button.addEventListener('click', () => this.placeTerrainOffer(button.dataset.terrainOffer));
                });
            },

            getTerrainOfferDescription(offer) {
                if (offer.kind === 'road') return 'Road · full board';
                const sizeNames = { 0.5: 'Tiny', 0.75: 'Small', 1: 'Medium', 1.5: 'Large' };
                return `${data.TERRAIN_SHAPE_LABELS[offer.shape] || 'Blob'} · ${sizeNames[offer.sizeMultiplier] || 'Medium'}`;
            },

            drawTerrainOfferPreview(canvas, offer) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = data.TERRAIN_STYLE.good.fill;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                ctx.translate(100, 100);
                ctx.scale(1.2, 1.2);
                ctx.translate(-100, -100);
                if (offer.kind === 'road') {
                    ctx.fillStyle = offer.fill || data.TERRAIN_STYLE.road.fill;
                    if (offer.orientation === 'horizontal') ctx.fillRect(0, 90, canvas.width, 20);
                    else ctx.fillRect(90, 0, 20, canvas.height);
                } else {
                    const preview = { ...offer, cx: 100, cy: 100 };
                    ctx.fillStyle = data.TERRAIN_STYLE[offer.kind].fill;
                    ctx.beginPath();
                    geometry.drawBlob(ctx, preview);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(26, 24, 21, 0.3)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.restore();
            }
        });
    }

    return { install };
}));
