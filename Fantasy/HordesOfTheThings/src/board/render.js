(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('../rules/index.js')
        );
        return;
    }
    root.HordesBoardRender = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    const EVAL_MIN_BENEFIT = 0.2;

    const UNIT_ASSET_PATHS = Object.freeze({
        Blade: 'assets/Blade.svg',
        Spear: 'assets/Spear.svg',
        Warband: 'assets/Warband.svg',
        Shooter: 'assets/Shooter.svg',
        Horde: 'assets/Horde.svg',
        Knights: 'assets/Knights.svg',
        Riders: 'assets/Riders.svg',
        Hero: 'assets/Hero.svg',
        Magician: 'assets/Magician.svg',
        'Heavy-Spear': 'assets/Heavy-Spear.svg',
        'Heavy-Warband': 'assets/Heavy-Warband.svg',
        Beasts: 'assets/Beasts.svg',
        Flyers: 'assets/Flyers.svg',
        Behemoth: 'assets/Behemoth.svg',
        Artillery: 'assets/Artillery.svg'
    });

    class BoardRenderMethods {
        requestRender() {
            if (this.renderQueued) {
                return;
            }
            this.renderQueued = true;
            window.requestAnimationFrame(() => {
                this.renderQueued = false;
                if (this.state.setupStage === 'unit-deployment') {
                    this.renderUnitDeployment();
                    return;
                }
                if (this.state.setupStage === 'terrain-placement') {
                    this.renderTerrainPlacement();
                    return;
                }
                this.render();
            });
        }

        render() {
            this.syncCanvasResolution();
            const ctx = this.ctx;
            const rect = this.canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.save();
            ctx.translate(rect.width / 2, rect.height / 2);
            ctx.scale(this.state.camera.scale, this.state.camera.scale);
            ctx.translate(-this.state.camera.x, -this.state.camera.y);
            this.drawBoard(ctx);
            this.drawReserveZones(ctx);
            this.drawTerrain(ctx);
            this.drawGhostUnits(ctx);
            this.drawShootingOverlays(ctx);
            this.drawUnits(ctx);
            this.drawComputerMoveArrows(ctx);
            this.drawCornerTravelViolations(ctx);
            this.drawSelectionHandles(ctx);
            this.drawBattleStatOverlays(ctx);
            this.drawMoveEvaluationOverlays(ctx);
            if (this.state.combatResolution) {
                this.drawCombatResolutionOverlays(ctx);
            }
            if (this.state.marquee) {
                this.drawMarquee(ctx);
            }
            ctx.restore();
        }

        drawBoard(ctx) {
            ctx.save();
            ctx.fillStyle = data.TERRAIN_STYLE.good.fill;
            ctx.fillRect(0, 0, data.BOARD_SIZE, data.BOARD_SIZE);
            ctx.strokeStyle = 'rgba(78, 72, 64, 0.15)';
            ctx.lineWidth = 1 / this.state.camera.scale;
            for (let offset = 0; offset <= data.BOARD_SIZE; offset += data.MM_GRID) {
                ctx.beginPath();
                ctx.moveTo(offset, 0);
                ctx.lineTo(offset, data.BOARD_SIZE);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, offset);
                ctx.lineTo(data.BOARD_SIZE, offset);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(58, 50, 40, 0.28)';
            ctx.lineWidth = 2 / this.state.camera.scale;
            ctx.strokeRect(0, 0, data.BOARD_SIZE, data.BOARD_SIZE);
            ctx.restore();
        }

        drawReserveZones(ctx) {
            ctx.save();
            data.PLAYER_IDS.forEach((playerId) => {
                const rect = this.getReserveRect(playerId);
                const colors = this.getPlayerColors(playerId);
                ctx.fillStyle = 'rgba(92, 82, 68, 0.12)';
                ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
                ctx.strokeStyle = colors.stroke;
                ctx.lineWidth = 2 / this.state.camera.scale;
                ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
                ctx.fillStyle = colors.stroke;
                ctx.font = `${12 / this.state.camera.scale}px Georgia, serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = `${this.getPlayerLabel(playerId)} Reserve`;
                const labelY = rect.homeEdge === 'bottom'
                    ? rect.top + 10 / this.state.camera.scale
                    : rect.top + rect.height - (10 / this.state.camera.scale);
                ctx.fillText(label, rect.left + rect.width / 2, labelY);
            });
            if (this.isEnsorcelledLocalReturnDraft()) {
                const unit = this.getUnitById(this.state.draft.unitIds[0]);
                const origin = unit?.ensorcelledFrom;
                if (origin) {
                    const colors = this.getPlayerColors(this.state.activePlayerId);
                    const radius = data.pacesToMm(data.MAGICIAN_ENSORCELLED_RETURN_PACES);
                    ctx.fillStyle = colors.glow;
                    ctx.strokeStyle = colors.stroke;
                    ctx.lineWidth = 2 / this.state.camera.scale;
                    ctx.beginPath();
                    ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            } else if (this.isReserveDeployDraft()) {
                const playerId = this.state.activePlayerId;
                const draftKind = this.state.draft.kind;
                const edge = draftKind === 'ensorcelled-return'
                    ? this.getOpponentHomeEdge(playerId)
                    : this.getHomeEdge(playerId);
                const colors = this.getPlayerColors(playerId);
                const depth = this.getUnitById(this.state.draft.unitIds[0])?.depth || data.RESERVE_SLOT_SIZE;
                ctx.fillStyle = colors.glow;
                if (edge === 'bottom') {
                    ctx.fillRect(0, data.BOARD_SIZE - depth, data.BOARD_SIZE, depth);
                } else {
                    ctx.fillRect(0, 0, data.BOARD_SIZE, depth);
                }
            }
            ctx.restore();
        }

        drawTerrain(ctx) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, data.BOARD_SIZE, data.BOARD_SIZE);
            ctx.clip();
            this.state.terrain.roads.forEach((road) => {
                ctx.fillStyle = road.fill;
                ctx.beginPath();
                if (road.orientation === 'horizontal') {
                    ctx.roundRect(0, road.position - road.width / 2, data.BOARD_SIZE, road.width, 8);
                } else {
                    ctx.roundRect(road.position - road.width / 2, 0, road.width, data.BOARD_SIZE, 8);
                }
                ctx.fill();
            });
            this.state.terrain.features.forEach((feature) => {
                ctx.fillStyle = data.TERRAIN_STYLE[feature.kind].fill;
                ctx.beginPath();
                geometry.drawBlob(ctx, feature);
                ctx.fill();
                ctx.strokeStyle = 'rgba(26, 24, 21, 0.26)';
                ctx.lineWidth = 2 / this.state.camera.scale;
                ctx.stroke();
            });
            ctx.restore();
        }

        drawUnits(ctx) {
            const selectedIds = new Set(this.state.selectedIds);
            const invalidSelection = this.state.selectionAnalysis.invalid;
            const validTargetIds = new Set(this.state.shooting?.validTargetIds || []);
            this.state.units.forEach((unit) => {
                const isSelected = selectedIds.has(unit.id);
                const isDraftInvalid = Boolean(this.state.draft && this.state.draft.invalidIds.has(unit.id));
                this.drawUnitBase(ctx, unit, {
                    selected: isSelected,
                    invalid: isDraftInvalid || (isSelected && invalidSelection),
                    highlighted: this.state.mode === 'game' && this.state.phase === 'shooting' && validTargetIds.has(unit.id),
                    needsShootingDeclaration: this.needsShootingDeclaration(unit),
                    ghost: false
                });
            });
            this.getReserveUnits().forEach((unit) => {
                const isSelected = selectedIds.has(unit.id);
                this.drawUnitBase(ctx, unit, {
                    selected: isSelected,
                    invalid: isSelected && invalidSelection,
                    highlighted: false,
                    needsShootingDeclaration: false,
                    ghost: false
                });
            });
        }

        drawShootingOverlays(ctx) {
            if (!this.state.showRangedArea && !this.state.combatResolution && (this.state.mode !== 'game' || this.state.phase !== 'shooting')) {
                return;
            }
            const resolution = this.state.combatResolution?.phase === 'shooting'
                ? this.state.combatResolution
                : null;
            const shooting = !resolution && this.state.mode === 'game' && this.state.phase === 'shooting'
                ? this.getShootingState()
                : null;
            if (this.state.showRangedArea) {
                const selectedIds = new Set(this.state.selectedIds);
                this.state.units.filter((unit) => rules.isRangedUnit(unit)).forEach((unit) => {
                    const area = rules.getRangedArea(unit);
                    if (!area) {
                        return;
                    }
                    const highlighted = selectedIds.has(unit.id);
                    ctx.save();
                    ctx.lineWidth = (highlighted ? 2.2 : 1.2) / this.state.camera.scale;
                    ctx.strokeStyle = highlighted ? 'rgba(215, 172, 55, 0.95)' : 'rgba(137, 55, 47, 0.72)';
                    ctx.beginPath();
                    if (area.kind === 'offset-rect') {
                        ctx.moveTo(area.corners[0].arcStart.x, area.corners[0].arcStart.y);
                        area.corners.forEach((corner, index) => {
                            const next = area.corners[(index + 1) % area.corners.length];
                            ctx.arc(
                                corner.vertex.x,
                                corner.vertex.y,
                                area.range,
                                Math.atan2(corner.arcStart.y - corner.vertex.y, corner.arcStart.x - corner.vertex.x),
                                Math.atan2(corner.arcEnd.y - corner.vertex.y, corner.arcEnd.x - corner.vertex.x),
                                false
                            );
                            ctx.lineTo(next.arcStart.x, next.arcStart.y);
                        });
                        ctx.closePath();
                    } else {
                        ctx.moveTo(area.nearLeft.x, area.nearLeft.y);
                        ctx.lineTo(area.nearRight.x, area.nearRight.y);
                        ctx.lineTo(area.farRight.x, area.farRight.y);
                        ctx.lineTo(area.farLeft.x, area.farLeft.y);
                        ctx.closePath();
                    }
                    ctx.stroke();
                    ctx.restore();
                });
            }
            const attacks = resolution
                ? (resolution.attacksByAttacker || {})
                : (shooting?.attacksByAttacker || {});
            Object.entries(attacks).forEach(([attackerId, targetId]) => {
                const attacker = this.getCombatPoseUnit(resolution, attackerId)
                    || this.getUnitById(attackerId);
                const target = this.getCombatPoseUnit(resolution, targetId)
                    || this.getUnitById(targetId);
                if (!attacker || !target) {
                    return;
                }
                this.drawShootingArrow(ctx, attacker, target);
            });

        }

        getCombatLabelUnit(resolution, unitId) {
            return this.getCombatPoseUnit(resolution, unitId);
        }

        getCombatPoseUnit(resolution, unitId) {
            if (!unitId) {
                return null;
            }
            if (resolution?.ghostSnapshot?.[unitId]) {
                return resolution.ghostSnapshot[unitId];
            }
            const ensorcelled = (resolution?.ensorcelledUnits || []).find((unit) => unit.id === unitId);
            if (ensorcelled && !ensorcelled.inReserve) {
                return ensorcelled;
            }
            const live = this.getUnitById(unitId);
            if (live && !live.inReserve) {
                return live;
            }
            return ensorcelled || live || null;
        }

        combatMarkPosition(unit, across, back) {
            const forward = geometry.getForwardVector(unit.rotation || 0);
            const right = geometry.getRightVector(unit.rotation || 0);
            return geometry.add(
                { x: unit.x, y: unit.y },
                geometry.add(
                    geometry.scaleVector(right, across),
                    geometry.scaleVector(forward, -back)
                )
            );
        }

        makeCombatReadoutMark(unit, kind, value, color, fill, across, back) {
            return {
                kind,
                value,
                color,
                fill,
                unitId: unit.id,
                rotation: unit.rotation || 0,
                position: this.combatMarkPosition(unit, across, back)
            };
        }

        factionMarkColor(unit) {
            return this.getPlayerColors(this.getUnitPlayerId(unit)).fill;
        }

        terrainMarkColor(kind) {
            return data.TERRAIN_STYLE[kind]?.fill || '#54704d';
        }

        getCombatReadoutMarks(resolution = this.state.combatResolution) {
            if (!resolution?.results) {
                return [];
            }
            const marks = [];
            const rolled = new Set();
            const terrainSlots = new Map();
            const modifierSlots = new Map();
            const pose = (unitId) => this.getCombatPoseUnit(resolution, unitId);
            const addRoll = (unitId, total, roll, modifiers) => {
                const unit = pose(unitId);
                if (!unit || roll == null || total == null || rolled.has(unit.id)) {
                    return;
                }
                rolled.add(unit.id);
                const strength = total - roll - rules.sumModifiers(modifiers || []);
                const color = this.factionMarkColor(unit);
                marks.push(this.makeCombatReadoutMark(unit, 'strength', strength, color, '#ffffff', 10, 10));
                marks.push(this.makeCombatReadoutMark(unit, 'die', roll, '#f4f1ea', '#161616', 30, 10));
                (modifiers || []).forEach((modifier) => {
                    if (!modifier.terrainKind) {
                        return;
                    }
                    const slot = terrainSlots.get(unit.id) || 0;
                    terrainSlots.set(unit.id, slot + 1);
                    marks.push(this.makeCombatReadoutMark(
                        unit,
                        'terrain',
                        modifier.value,
                        this.terrainMarkColor(modifier.terrainKind),
                        '#ffffff',
                        20,
                        20 + (slot * 12)
                    ));
                });
            };
            const addSources = (modifiers) => {
                (modifiers || []).forEach((modifier) => {
                    (modifier.sources || []).forEach((source) => {
                        const unit = pose(source.unitId);
                        if (!unit || !source.value) {
                            return;
                        }
                        const slot = modifierSlots.get(unit.id) || 0;
                        modifierSlots.set(unit.id, slot + 1);
                        marks.push(this.makeCombatReadoutMark(
                            unit,
                            'modifier',
                            source.value,
                            this.factionMarkColor(unit),
                            '#ffffff',
                            20,
                            10 + (slot * 12)
                        ));
                    });
                });
            };
            resolution.results.forEach((entry) => {
                if (resolution.phase === 'shooting') {
                    addRoll(entry.primaryAttackerId, entry.attackerTotal, entry.attackerRoll, entry.attackerModifiers);
                    addRoll(entry.returnPrimaryId || entry.defenderId, entry.defenderTotal, entry.defenderRoll, entry.defenderModifiers);
                    addSources(entry.attackerModifiers);
                    addSources(entry.defenderModifiers);
                    return;
                }
                addRoll(entry.leftPrimaryId, entry.leftTotal, entry.leftRoll, entry.leftModifiers);
                addRoll(entry.rightPrimaryId, entry.rightTotal, entry.rightRoll, entry.rightModifiers);
                addSources(entry.leftModifiers);
                addSources(entry.rightModifiers);
            });
            return marks;
        }

        drawCombatReadoutMarks(ctx, resolution) {
            const size = 10;
            this.getCombatReadoutMarks(resolution).forEach((mark) => {
                this.drawCombatReadoutBox(ctx, mark, size);
                if (mark.kind === 'die') {
                    this.drawDiePips(ctx, mark);
                    return;
                }
                ctx.save();
                ctx.fillStyle = mark.color;
                ctx.font = `${mark.kind === 'strength' ? 6.4 : 5.2}px Georgia, serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const text = mark.kind === 'strength' ? String(mark.value) : rules.formatSignedModifier(mark.value);
                ctx.fillText(text, mark.position.x, mark.position.y);
                ctx.restore();
            });
        }

        drawCombatReadoutBox(ctx, mark, size) {
            const forward = geometry.getForwardVector(mark.rotation || 0);
            const right = geometry.getRightVector(mark.rotation || 0);
            const half = size / 2;
            const corner = (across, along) => geometry.add(
                mark.position,
                geometry.add(geometry.scaleVector(right, across), geometry.scaleVector(forward, along))
            );
            ctx.save();
            ctx.beginPath();
            geometry.tracePointPolygon(ctx, [
                corner(-half, half),
                corner(half, half),
                corner(half, -half),
                corner(-half, -half)
            ]);
            ctx.fillStyle = mark.fill;
            ctx.strokeStyle = mark.kind === 'die' ? mark.fill : mark.color;
            ctx.lineWidth = 0.7;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        drawDiePips(ctx, mark) {
            const faces = {
                1: [[0, 0]],
                2: [[-1, -1], [1, 1]],
                3: [[-1, -1], [0, 0], [1, 1]],
                4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
                5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
                6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
            };
            const pips = faces[mark.value] || faces[1];
            const spread = 2.55;
            ctx.save();
            ctx.fillStyle = mark.color;
            pips.forEach(([column, row]) => {
                ctx.beginPath();
                ctx.arc(mark.position.x + (column * spread), mark.position.y + (row * spread), 1.05, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        }

        drawCombatResolutionOverlays(ctx) {
            const resolution = this.state.combatResolution;
            if (!resolution) {
                return;
            }
            this.drawCombatOutcomeMarks(ctx, resolution);
            this.drawCombatPushbackArrows(ctx, resolution);
            this.drawCombatReadoutMarks(ctx, resolution);
            resolution.results.forEach((entry) => {
                let leftUnit = null;
                let rightUnit = null;
                let leftTotal = null;
                let rightTotal = null;
                if (resolution.phase === 'shooting') {
                    leftUnit = this.getCombatLabelUnit(resolution, entry.primaryAttackerId);
                    rightUnit = this.getCombatLabelUnit(resolution, entry.defenderId);
                    leftTotal = entry.attackerTotal;
                    rightTotal = entry.defenderTotal;
                } else {
                    leftUnit = this.getCombatLabelUnit(resolution, entry.leftPrimaryId);
                    rightUnit = this.getCombatLabelUnit(resolution, entry.rightPrimaryId);
                    leftTotal = entry.leftTotal;
                    rightTotal = entry.rightTotal;
                }
                if (!leftUnit || !rightUnit) {
                    return;
                }
                const labelPosition = geometry.midpoint(geometry.getUnitCenter(leftUnit), geometry.getUnitCenter(rightUnit));
                ctx.save();
                ctx.fillStyle = 'rgba(255, 249, 236, 0.94)';
                ctx.strokeStyle = 'rgba(55, 45, 36, 0.35)';
                ctx.lineWidth = 1 / this.state.camera.scale;
                const width = 42 / this.state.camera.scale;
                const height = 14 / this.state.camera.scale;
                ctx.beginPath();
                ctx.roundRect(labelPosition.x - width / 2, labelPosition.y - height / 2, width, height, 4 / this.state.camera.scale);
                ctx.fill();
                ctx.stroke();
                ctx.font = `${10 / this.state.camera.scale}px Georgia`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#6e231c';
                ctx.fillText(`${leftTotal} vs ${rightTotal}`, labelPosition.x, labelPosition.y);
                ctx.restore();
            });
        }

        drawCombatOutcomeMarks(ctx, resolution) {
            const destroyedIds = resolution.destroyedIds || new Set();
            const recoilDestroyedIds = new Set(
                (resolution.recoilDestructions || [])
                    .filter((entry) => entry.kind !== 'flee')
                    .map((entry) => entry.unitId)
            );
            const ensorcelledIds = resolution.ensorcelledIds
                || new Set((resolution.ensorcelledUnits || []).map((unit) => unit.id));
            destroyedIds.forEach((unitId) => {
                if (recoilDestroyedIds.has(unitId)) {
                    return;
                }
                const unit = this.getCombatPoseUnit(resolution, unitId);
                if (unit) {
                    this.drawDestroyedMark(ctx, unit);
                }
            });
            ensorcelledIds.forEach((unitId) => {
                const unit = this.getCombatPoseUnit(resolution, unitId);
                if (unit) {
                    this.drawEnsorcelledMark(ctx, unit);
                }
            });
        }

        drawCombatPushbackArrows(ctx, resolution) {
            const destroyedIds = resolution.destroyedIds || new Set();
            const ensorcelledIds = resolution.ensorcelledIds
                || new Set((resolution.ensorcelledUnits || []).map((unit) => unit.id));
            (resolution.movedUnitIds || []).forEach((unitId) => {
                if (destroyedIds.has(unitId) || ensorcelledIds.has(unitId)) {
                    return;
                }
                const before = resolution.ghostSnapshot?.[unitId];
                const after = this.state.units.find((unit) => unit.id === unitId);
                if (!before || !after || !this.hasUnitMoved(before, after)) {
                    return;
                }
                this.drawPushbackArrow(ctx, geometry.getUnitCenter(before), geometry.getUnitCenter(after));
            });
            (resolution.recoilDestructions || []).forEach((entry) => {
                if (entry.kind === 'flee') {
                    return;
                }
                const before = resolution.ghostSnapshot?.[entry.unitId];
                if (!before) {
                    return;
                }
                const destination = this.getRecoilDestructionPoint(before, entry.rotation);
                this.drawPushbackArrow(ctx, geometry.getUnitCenter(before), destination);
                this.drawRecoiledDestroyedMark(ctx, destination);
            });
        }

        getRecoilDestructionPoint(unit, rotation) {
            const facing = rotation == null ? (unit.rotation || 0) : rotation;
            const backward = geometry.scaleVector(geometry.getForwardVector(facing), -(unit.depth || 0));
            return geometry.add(geometry.getUnitCenter(unit), backward);
        }

        drawDestroyedMark(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            const size = Math.min(unit.width, unit.depth) * 0.72;
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.strokeStyle = 'rgba(196, 28, 28, 0.92)';
            ctx.lineWidth = Math.max(4, size * 0.14) / this.state.camera.scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-size / 2, -size / 2);
            ctx.lineTo(size / 2, size / 2);
            ctx.moveTo(size / 2, -size / 2);
            ctx.lineTo(-size / 2, size / 2);
            ctx.stroke();
            ctx.restore();
        }

        drawRecoiledDestroyedMark(ctx, point) {
            const size = 7;
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.strokeStyle = 'rgba(196, 28, 28, 0.92)';
            ctx.lineWidth = 2.2 / this.state.camera.scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-size / 2, -size / 2);
            ctx.lineTo(size / 2, size / 2);
            ctx.moveTo(size / 2, -size / 2);
            ctx.lineTo(-size / 2, size / 2);
            ctx.stroke();
            ctx.restore();
        }

        drawEnsorcelledMark(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            const radius = Math.min(unit.width, unit.depth) * 0.38;
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.strokeStyle = 'rgba(48, 92, 210, 0.95)';
            ctx.lineWidth = Math.max(3, radius * 0.22) / this.state.camera.scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const turns = 2.35;
            const steps = 56;
            for (let index = 0; index <= steps; index += 1) {
                const t = index / steps;
                const angle = t * turns * Math.PI * 2;
                const spiralRadius = radius * (0.18 + (0.82 * t));
                const x = Math.cos(angle) * spiralRadius;
                const y = Math.sin(angle) * spiralRadius;
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.restore();
        }

        getComputerMoveArrows() {
            const entries = this.state.computerMoveReview?.entries || [];
            const arrows = [];
            entries.forEach((entry) => {
                entry.unitIds.forEach((unitId) => {
                    const before = entry.ghostSnapshot?.[unitId];
                    const after = this.getUnitById(unitId);
                    if (!before || !after) {
                        return;
                    }
                    const from = geometry.getUnitCenter(before);
                    const to = geometry.getUnitCenter(after);
                    const distance = geometry.distance(from, to);
                    let end = to;
                    if (distance < 0.5) {
                        const turn = geometry.subtract(
                            geometry.getForwardVector(after.rotation || 0),
                            geometry.getForwardVector(before.rotation || 0)
                        );
                        const direction = geometry.distance({ x: 0, y: 0 }, turn) > 0.05
                            ? geometry.normalize(turn)
                            : geometry.getForwardVector(after.rotation || 0);
                        end = geometry.add(from, geometry.scaleVector(direction, 10));
                    }
                    arrows.push({
                        from,
                        to: end,
                        color: this.getPlayerColors(this.getUnitPlayerId(after)).fill
                    });
                });
            });
            return arrows;
        }

        drawComputerMoveArrows(ctx) {
            this.getComputerMoveArrows().forEach((arrow) => {
                this.drawPushbackArrow(ctx, arrow.from, arrow.to, arrow.color);
            });
        }

        drawPushbackArrow(ctx, from, to, color) {
            const delta = geometry.subtract(to, from);
            const distance = geometry.distance(from, to);
            if (distance < 0.5) {
                return;
            }
            const direction = geometry.normalize(delta);
            const shaftColor = color || 'rgba(196, 92, 18, 0.96)';
            const desiredHead = Math.min(16, Math.max(10, distance * 0.28)) / this.state.camera.scale;
            const headLength = Math.min(desiredHead, distance * 0.42);
            const headWidth = headLength * 0.72;
            const tip = to;
            const base = geometry.add(tip, geometry.scaleVector(direction, -headLength));
            const ortho = { x: -direction.y, y: direction.x };
            const shaftWidth = Math.max(3.2, Math.min(5.5, distance * 0.12)) / this.state.camera.scale;
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(255, 248, 230, 0.95)';
            ctx.lineWidth = shaftWidth + (2.4 / this.state.camera.scale);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(base.x, base.y);
            ctx.stroke();
            ctx.strokeStyle = shaftColor;
            ctx.fillStyle = shaftColor;
            ctx.lineWidth = shaftWidth;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(base.x, base.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(
                base.x + ortho.x * headWidth,
                base.y + ortho.y * headWidth
            );
            ctx.lineTo(
                base.x - ortho.x * headWidth,
                base.y - ortho.y * headWidth
            );
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 248, 230, 0.95)';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();
            ctx.restore();
        }

        getBattlePreviewUnits() {
            if (this.state.mode === 'edit' || this.state.phase === 'move') {
                return rules.resolveAutomaticFormUp(this.state.units, this.state.activePlayerId, this.state.terrain).units;
            }
            return this.state.units;
        }

        getBattleStatMarkers() {
            if (!this.state.showBattleStats || this.state.combatResolution) {
                return [];
            }
            const previews = rules.previewMeleeCombats(this.getBattlePreviewUnits(), this.state.terrain);
            const activePlayerId = this.state.activePlayerId;
            return previews.map((preview) => {
                const activeFirst = preview.left.playerId === activePlayerId || preview.right.playerId !== activePlayerId;
                const active = activeFirst ? preview.left : preview.right;
                const opponent = activeFirst ? preview.right : preview.left;
                return {
                    id: preview.id,
                    position: preview.position,
                    label: `${active.factor} vs ${opponent.factor}`,
                    relative: active.factor - opponent.factor,
                    active,
                    opponent
                };
            });
        }

        getBattleStatMarkerSize() {
            return {
                width: 52 / this.state.camera.scale,
                height: 16 / this.state.camera.scale
            };
        }

        getBattleStatHit(world) {
            const size = this.getBattleStatMarkerSize();
            return this.getBattleStatMarkers().find((marker) => (
                Math.abs(world.x - marker.position.x) <= (size.width / 2)
                && Math.abs(world.y - marker.position.y) <= (size.height / 2)
            )) || null;
        }

        drawBattleStatOverlays(ctx) {
            const markers = this.getBattleStatMarkers();
            if (markers.length === 0) {
                return;
            }
            const size = this.getBattleStatMarkerSize();
            markers.forEach((marker) => {
                const selected = this.state.selectedBattleId === marker.id;
                ctx.save();
                ctx.fillStyle = selected ? 'rgba(255, 242, 206, 0.96)' : 'rgba(255, 249, 236, 0.94)';
                ctx.strokeStyle = selected ? 'rgba(128, 95, 29, 0.7)' : 'rgba(55, 45, 36, 0.35)';
                ctx.lineWidth = (selected ? 1.6 : 1) / this.state.camera.scale;
                ctx.beginPath();
                ctx.roundRect(
                    marker.position.x - size.width / 2,
                    marker.position.y - size.height / 2,
                    size.width,
                    size.height,
                    4 / this.state.camera.scale
                );
                ctx.fill();
                ctx.stroke();
                ctx.font = `${10 / this.state.camera.scale}px Georgia`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#6e231c';
                ctx.fillText(marker.label, marker.position.x, marker.position.y);
                ctx.restore();
            });
        }

        getMoveEvaluationMarkers() {
            if (!this.state.aiEvaluationMode || !this.state.moveEvaluation || this.state.moveEvaluation.loading) {
                return [];
            }
            const evaluation = this.state.moveEvaluation;
            const stackCounts = new Map();
            return evaluation.candidates.map((entry, rank) => {
                const center = geometry.getUnitCenter(entry.afterUnit);
                const stackKey = `${center.x.toFixed(0)}:${center.y.toFixed(0)}`;
                const stackIndex = stackCounts.get(stackKey) || 0;
                stackCounts.set(stackKey, stackIndex + 1);
                const lines = this.formatEvaluationBubbleLines(entry);
                return {
                    entry,
                    rank,
                    center,
                    stackIndex,
                    lines,
                    score: entry.score
                };
            });
        }

        getEvaluationBubbleMetrics(lines) {
            const scale = this.state.camera.scale;
            const titleFont = `${9 / scale}px Georgia`;
            const detailFont = `${10 / scale}px Georgia`;
            const paddingX = 6 / scale;
            const paddingY = 4 / scale;
            const lineGap = 2 / scale;
            const measure = (font, text) => {
                this.ctx.save();
                this.ctx.font = font;
                const width = this.ctx.measureText(text).width;
                this.ctx.restore();
                return width;
            };
            const titleWidth = measure(titleFont, lines.title);
            const scoreWidth = measure(detailFont, lines.scoreLine);
            const timingWidth = measure(detailFont, lines.timingLine);
            const width = Math.max(titleWidth, scoreWidth, timingWidth) + paddingX * 2;
            const height = (9 / scale) + (10 / scale) + (10 / scale) + lineGap * 2 + paddingY * 2;
            return { width, height, titleFont, detailFont, paddingX, paddingY, lineGap };
        }

        getEvaluationScoreColors(score, rank) {
            if (score >= EVAL_MIN_BENEFIT) {
                return {
                    fill: rank === 0 ? 'rgba(214, 245, 214, 0.96)' : 'rgba(232, 248, 232, 0.94)',
                    stroke: 'rgba(44, 110, 44, 0.65)',
                    text: '#1f4d1f'
                };
            }
            if (score > 0) {
                return {
                    fill: 'rgba(255, 244, 210, 0.94)',
                    stroke: 'rgba(128, 95, 29, 0.55)',
                    text: '#6e231c'
                };
            }
            return {
                fill: 'rgba(245, 232, 232, 0.92)',
                stroke: 'rgba(120, 54, 54, 0.45)',
                text: '#6e231c'
            };
        }

        drawMoveEvaluationOverlays(ctx) {
            if (!this.state.aiEvaluationMode) {
                return;
            }
            const evaluation = this.state.moveEvaluation;
            if (evaluation?.loading) {
                const unit = this.getAiEvaluationFocusUnit?.();
                if (unit) {
                    const center = geometry.getUnitCenter(unit);
                    this.drawEvaluationBubble(ctx, {
                        x: center.x,
                        y: center.y - unit.depth - 18 / this.state.camera.scale
                    }, {
                        title: 'Scoring…',
                        scoreLine: evaluation.progressTotal
                            ? `${evaluation.progressCurrent}/${evaluation.progressTotal}`
                            : '…',
                        timingLine: 'AI Eval'
                    }, {
                        fill: 'rgba(255, 249, 236, 0.94)',
                        stroke: 'rgba(55, 45, 36, 0.35)',
                        text: '#6e231c'
                    }, false);
                }
                return;
            }
            const markers = this.getMoveEvaluationMarkers();
            markers.forEach((marker) => {
                this.drawEvaluationGhostUnit(ctx, marker.entry.afterUnit, marker.score, marker.rank);
            });
            markers.forEach((marker) => {
                const unit = marker.entry.afterUnit;
                const baseY = geometry.getUnitCenter(unit).y - unit.depth / 2 - 8 / this.state.camera.scale;
                const stackOffset = marker.stackIndex * (42 / this.state.camera.scale);
                const colors = this.getEvaluationScoreColors(marker.score, marker.rank);
                this.drawEvaluationBubble(
                    ctx,
                    { x: marker.center.x, y: baseY - stackOffset },
                    marker.lines,
                    colors,
                    marker.rank === 0
                );
            });
        }

        drawEvaluationGhostUnit(ctx, unit, score, rank) {
            const corners = geometry.getUnitCorners(unit);
            const colors = this.getPlayerColors(this.getUnitPlayerId(unit));
            ctx.save();
            ctx.globalAlpha = rank === 0 ? 0.42 : 0.28;
            ctx.beginPath();
            geometry.tracePolygon(ctx, corners);
            if (score >= EVAL_MIN_BENEFIT) {
                ctx.fillStyle = 'rgba(120, 196, 120, 0.55)';
            } else if (score > 0) {
                ctx.fillStyle = 'rgba(220, 196, 120, 0.5)';
            } else {
                ctx.fillStyle = 'rgba(196, 140, 140, 0.45)';
            }
            ctx.fill();
            ctx.lineWidth = (rank === 0 ? 2.4 : 1.6) / this.state.camera.scale;
            ctx.setLineDash([5 / this.state.camera.scale, 4 / this.state.camera.scale]);
            ctx.strokeStyle = colors.stroke;
            ctx.stroke();
            ctx.restore();
        }

        drawEvaluationBubble(ctx, anchor, lines, colors, emphasized) {
            const metrics = this.getEvaluationBubbleMetrics(lines);
            const x = anchor.x - metrics.width / 2;
            const y = anchor.y - metrics.height;
            ctx.save();
            ctx.fillStyle = colors.fill;
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = (emphasized ? 1.8 : 1.2) / this.state.camera.scale;
            ctx.beginPath();
            ctx.roundRect(x, y, metrics.width, metrics.height, 5 / this.state.camera.scale);
            ctx.fill();
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = colors.text;
            ctx.font = metrics.titleFont;
            ctx.textBaseline = 'top';
            ctx.fillText(lines.title, anchor.x, y + metrics.paddingY);
            ctx.font = metrics.detailFont;
            ctx.fillText(
                lines.scoreLine,
                anchor.x,
                y + metrics.paddingY + (9 / this.state.camera.scale) + metrics.lineGap
            );
            ctx.fillText(
                lines.timingLine,
                anchor.x,
                y + metrics.paddingY + (9 / this.state.camera.scale) + metrics.lineGap + (10 / this.state.camera.scale) + metrics.lineGap
            );
            ctx.restore();
        }

        drawShootingArrow(ctx, attacker, target) {
            const start = geometry.getUnitCenter(attacker);
            const end = geometry.getUnitCenter(target);
            const delta = geometry.subtract(end, start);
            const distance = geometry.distance(start, end);
            const normal = geometry.normalize({ x: -delta.y, y: delta.x });
            const control = geometry.add(geometry.midpoint(start, end), geometry.scaleVector(normal, Math.min(28, distance * 0.2)));
            ctx.save();
            ctx.strokeStyle = 'rgba(187, 44, 31, 0.95)';
            ctx.lineWidth = 2 / this.state.camera.scale;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
            ctx.stroke();
            ctx.restore();
        }

        drawGhostUnits(ctx) {
            const ghosts = this.collectGhostUnits();
            ghosts.forEach((unit) => {
                this.drawUnitBase(ctx, unit, {
                    selected: false,
                    invalid: false,
                    ghost: true
                });
            });
        }

        collectGhostUnits() {
            const ghosts = [];
            const seen = new Set();
            const pushSnapshot = (snapshot, unitIds) => {
                unitIds.forEach((unitId) => {
                    const unit = snapshot[unitId];
                    if (!unit) {
                        return;
                    }
                    const liveUnit = this.getUnitById(unitId);
                    if (liveUnit && !this.hasUnitMoved(unit, liveUnit)) {
                        return;
                    }
                    const key = `${unitId}:${unit.x.toFixed(2)}:${unit.y.toFixed(2)}:${unit.rotation.toFixed(3)}`;
                    if (seen.has(key)) {
                        return;
                    }
                    seen.add(key);
                    ghosts.push({ ...unit });
                });
            };
            const pushUnits = (units, unitIds) => {
                unitIds.forEach((unitId) => {
                    const unit = units.find((entry) => entry.id === unitId);
                    if (!unit) {
                        return;
                    }
                    const liveUnit = this.getUnitById(unitId);
                    if (liveUnit && !this.hasUnitMoved(liveUnit, unit)) {
                        return;
                    }
                    const key = `${unitId}:${unit.x.toFixed(2)}:${unit.y.toFixed(2)}:${unit.rotation.toFixed(3)}`;
                    if (seen.has(key)) {
                        return;
                    }
                    seen.add(key);
                    ghosts.push({ ...unit });
                });
            };

            const formUpPreview = this.getFormUpPreview();
            if (formUpPreview) {
                pushUnits(formUpPreview.units, formUpPreview.movedUnitIds);
            }

            if (this.state.formUp) {
                pushSnapshot(this.state.formUp.ghostSnapshot, this.state.formUp.movedUnitIds);
            }
            if (this.state.combatResolution) {
                pushSnapshot(this.state.combatResolution.ghostSnapshot, this.state.combatResolution.movedUnitIds);
            }
            if (this.state.draft) {
                pushSnapshot(this.state.draft.initialOrigin, this.state.draft.unitIds);
                this.state.draft.history.forEach((snapshot) => pushSnapshot(snapshot, this.state.draft.unitIds));
                pushSnapshot(this.state.draft.origin, this.state.draft.unitIds);
            }
            if (this.state.autoMoveGhost) {
                pushSnapshot(this.state.autoMoveGhost.ghostSnapshot, this.state.autoMoveGhost.unitIds);
            }
            (this.state.computerMoveReview?.entries || []).forEach((entry) => {
                pushSnapshot(entry.ghostSnapshot, entry.unitIds);
            });
            const interaction = this.state.interaction;
            if (interaction && interaction.dragBase && interaction.draftIds) {
                pushSnapshot(interaction.dragBase, interaction.draftIds);
            }

            return ghosts;
        }

        hasUnitMoved(snapshotUnit, liveUnit) {
            return Math.abs(snapshotUnit.x - liveUnit.x) > 0.05
                || Math.abs(snapshotUnit.y - liveUnit.y) > 0.05
                || Math.abs(geometry.normalizeAngle(snapshotUnit.rotation - liveUnit.rotation)) > 0.01;
        }

        drawUnitBase(ctx, unit, options) {
            const outlined = geometry.hasOutline(unit);
            const colors = this.getPlayerColors(this.getUnitPlayerId(unit));
            ctx.save();
            if (options.ghost) {
                ctx.globalAlpha = 0.35;
            }
            ctx.beginPath();
            if (outlined) {
                geometry.tracePointPolygon(ctx, geometry.getUnitFootprintPoints(unit));
            } else {
                geometry.tracePolygon(ctx, geometry.getUnitCorners(unit));
            }
            ctx.fillStyle = colors.fill;
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = options.selected ? 22 / this.state.camera.scale : 0;
            ctx.fill();
            ctx.shadowBlur = 0;
            const drewAsset = this.drawUnitAsset(ctx, unit);
            const hovered = !options.ghost
                && this.state.hover?.unitId === unit.id
                && (typeof this.canCurrentlySelectUnit !== 'function' || this.canCurrentlySelectUnit(unit));
            const borderWidth = (options.selected || options.needsShootingDeclaration ? 4 : 2) + (hovered ? 2.5 : 0);
            ctx.lineWidth = borderWidth / this.state.camera.scale;
            if (options.ghost) {
                ctx.setLineDash([6 / this.state.camera.scale, 4 / this.state.camera.scale]);
            }
            ctx.strokeStyle = options.invalid ? '#d01111' : (options.needsShootingDeclaration || options.highlighted) ? '#d7ac37' : colors.stroke;
            ctx.stroke();
            if (!drewAsset) {
                this.drawUnitArrow(ctx, unit);
                this.drawUnitText(ctx, unit);
            }
            if (!options.ghost && this.shouldMarkMovedUnit(unit)) {
                this.drawMovedBoot(ctx, unit);
            } else if (!options.ghost && this.shouldMarkUnaffordableUnit(unit)) {
                this.drawNoMoveMark(ctx, unit);
            }
            ctx.restore();
        }

        shouldMarkMovedUnit(unit) {
            if (!unit || this.state.mode !== 'game' || this.state.phase !== 'move' || this.state.setupStage === 'unit-deployment') {
                return false;
            }
            if (!unit.movedThisTurn || unit.inReserve) {
                return false;
            }
            if (this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                return false;
            }
            return typeof this.canLocallyControl !== 'function' || this.canLocallyControl(this.getUnitPlayerId(unit));
        }

        drawMovedBoot(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(Math.atan2(geometry.getForwardVector(unit.rotation).y, geometry.getForwardVector(unit.rotation).x));
            ctx.globalAlpha = 0.48;
            this.drawBootprintIcon(ctx, Math.min(unit.width, unit.depth) * 0.95, 'rgb(112, 112, 112)', 'boot', 'assets/boot-print.svg');
            ctx.restore();
        }

        unitMoveCost(unit) {
            if (unit.inReserve && typeof this.isEnsorcelledInReserve === 'function' && this.isEnsorcelledInReserve(unit)) {
                return typeof this.getEnsorcelledReturnCost === 'function' ? this.getEnsorcelledReturnCost(unit) : 0;
            }
            if (unit.inReserve) {
                return 1;
            }
            return rules.getMoveCost(unit);
        }

        shouldMarkUnaffordableUnit(unit) {
            if (!unit || this.state.mode !== 'game' || this.state.phase !== 'move' || this.state.setupStage === 'unit-deployment') {
                return false;
            }
            if (unit.movedThisTurn || unit.combat?.stationary) {
                return false;
            }
            if (this.getUnitPlayerId(unit) !== this.state.activePlayerId) {
                return false;
            }
            if (typeof this.canLocallyControl === 'function' && !this.canLocallyControl(this.getUnitPlayerId(unit))) {
                return false;
            }
            if (this.state.draft?.unitIds?.includes(unit.id)) {
                return false;
            }
            const cost = this.unitMoveCost(unit);
            return cost > 0 && this.state.remainingMoves < cost;
        }

        drawNoMoveMark(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(Math.atan2(geometry.getForwardVector(unit.rotation).y, geometry.getForwardVector(unit.rotation).x));
            ctx.globalAlpha = 0.48;
            this.drawBootprintIcon(ctx, Math.min(unit.width, unit.depth) * 0.95, 'rgb(72, 72, 72)', 'no-move', 'assets/noMove.svg', true);
            ctx.restore();
        }

        getSvgAsset(key, src) {
            if (typeof Image === 'undefined') {
                return null;
            }
            if (!this.svgAssets) {
                this.svgAssets = new Map();
            }
            let entry = this.svgAssets.get(key);
            if (!entry) {
                const image = new Image();
                entry = { image, status: 'loading' };
                image.addEventListener('load', () => {
                    entry.status = 'ready';
                    this.requestRender();
                });
                image.addEventListener('error', () => {
                    entry.status = 'error';
                });
                image.src = src;
                this.svgAssets.set(key, entry);
            }
            return entry.status === 'ready' ? entry.image : null;
        }

        getTintedSvgAsset(key, src, color) {
            const image = this.getSvgAsset(key, src);
            if (!image || typeof document === 'undefined') {
                return null;
            }
            if (!this.svgTints) {
                this.svgTints = new Map();
            }
            const tintKey = `${key}\n${color}`;
            let tinted = this.svgTints.get(tintKey);
            if (!tinted) {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth || image.width;
                canvas.height = image.naturalHeight || image.height;
                const tintCtx = canvas.getContext('2d');
                tintCtx.drawImage(image, 0, 0);
                tintCtx.globalCompositeOperation = 'source-in';
                tintCtx.fillStyle = color;
                tintCtx.fillRect(0, 0, canvas.width, canvas.height);
                tinted = canvas;
                this.svgTints.set(tintKey, tinted);
            }
            return tinted;
        }

        drawBootprintIcon(ctx, length, color, assetKey = 'boot', src = 'assets/boot-print.svg', crossed = false) {
            const tinted = this.getTintedSvgAsset(assetKey, src, color);
            if (tinted && tinted.width && tinted.height) {
                const scale = length / Math.max(tinted.width, tinted.height);
                const drawW = tinted.width * scale;
                const drawH = tinted.height * scale;
                ctx.drawImage(tinted, -drawW / 2, -drawH / 2, drawW, drawH);
                return;
            }
            ctx.save();
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(length * 0.12, 1.5 / (this.state.camera?.scale || 1));
            ctx.beginPath();
            ctx.ellipse(-length * 0.22, -length * 0.16, length * 0.28, length * 0.12, -0.35, 0, Math.PI * 2);
            ctx.ellipse(length * 0.22, length * 0.16, length * 0.28, length * 0.12, -0.35, 0, Math.PI * 2);
            ctx.fill();
            if (crossed) {
                ctx.beginPath();
                ctx.moveTo(-length * 0.42, -length * 0.42);
                ctx.lineTo(length * 0.42, length * 0.42);
                ctx.stroke();
            }
            ctx.restore();
        }

        getUnitAssetPath(unit) {
            if (!unit || !unit.type) {
                return null;
            }
            const type = unit.type;
            if (type === 'Base' && unit.faction && data.FACTIONS.includes(unit.faction)) {
                return `assets/${unit.faction}/Base.svg`;
            }
            // Prefer faction-specific asset sets when available
            if (unit.faction && data.FACTION_ROSTERS[unit.faction]?.includes(type)) {
                return `assets/${String(unit.faction).toLowerCase()}/${type}.svg`;
            }
            // Fallback to generic asset path
            return UNIT_ASSET_PATHS[type] || null;
        }

        getUnitAsset(unit) {
            const assetPath = this.getUnitAssetPath(unit);
            if (!assetPath || typeof Image === 'undefined') {
                return null;
            }
            if (!this.unitAssetCache) {
                this.unitAssetCache = new Map();
            }
            let entry = this.unitAssetCache.get(assetPath);
            if (!entry) {
                const image = new Image();
                entry = { image, status: 'loading' };
                image.addEventListener('load', () => {
                    entry.status = 'ready';
                    this.requestRender();
                });
                image.addEventListener('error', () => {
                    entry.status = 'error';
                });
                image.src = assetPath;
                this.unitAssetCache.set(assetPath, entry);
            }
            return entry.status === 'ready' ? entry.image : null;
        }

        drawUnitAsset(ctx, unit) {
            const image = this.getUnitAsset(unit);
            if (!image) {
                return false;
            }
            ctx.save();
            ctx.translate(unit.x, unit.y);
            ctx.rotate(unit.rotation);
            ctx.drawImage(image, 0, 0, unit.width, unit.depth);
            ctx.restore();
            return true;
        }

        drawUnitArrow(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            const forward = geometry.getForwardVector(unit.rotation);
            const right = geometry.getRightVector(unit.rotation);
            const frontInset = 2;
            const tipOffset = Math.max(0, (unit.depth / 2) - frontInset);
            const tip = geometry.add(center, geometry.scaleVector(forward, tipOffset));
            const arrowBase = geometry.add(tip, geometry.scaleVector(forward, -7));
            const left = geometry.add(arrowBase, geometry.scaleVector(right, -6));
            const rightPoint = geometry.add(arrowBase, geometry.scaleVector(right, 6));
            ctx.beginPath();
            ctx.moveTo(left.x, left.y);
            ctx.lineTo(rightPoint.x, rightPoint.y);
            ctx.lineTo(tip.x, tip.y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(244, 241, 234, 0.94)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(34, 31, 28, 0.55)';
            ctx.lineWidth = 1.25 / this.state.camera.scale;
            ctx.stroke();
        }

        drawUnitText(ctx, unit) {
            const center = geometry.getUnitCenter(unit);
            const displayRotation = this.getUnitPlayerId(unit) === 'player-1' ? unit.rotation : geometry.normalizeAngle(unit.rotation + Math.PI);
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(displayRotation);
            ctx.font = `${12 / this.state.camera.scale}px Georgia`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const isInactiveForCombat = this.state.mode === 'game'
                && (this.state.phase === 'shooting' || this.state.phase === 'melee')
                && !this.isUnitCombatParticipant(unit);
            ctx.fillStyle = isInactiveForCombat || unit.movedThisTurn
                ? 'rgba(160,160,160,0.95)'
                : 'rgba(248, 244, 237, 0.95)';
            ctx.fillText(unit.type, 0, 0);
            ctx.restore();
        }

        drawCornerTravelViolations(ctx) {
            if (!this.state.showMoveErrors) {
                return;
            }
            const violations = this.state.draft?.cornerViolations;
            if (!violations || violations.length === 0) {
                return;
            }
            ctx.save();
            ctx.strokeStyle = 'rgba(176, 48, 40, 0.92)';
            ctx.lineWidth = 2 / this.state.camera.scale;
            violations.forEach((violation) => {
                ctx.beginPath();
                ctx.moveTo(violation.from.x, violation.from.y);
                ctx.lineTo(violation.to.x, violation.to.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(violation.from.x, violation.from.y, 3 / this.state.camera.scale, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(176, 48, 40, 0.95)';
                ctx.fill();
            });
            ctx.restore();
        }

        drawSelectionHandles(ctx) {
            const handles = this.getSelectionHandles();
            if (handles.length === 0) {
                return;
            }
            ctx.save();
            handles.forEach((handle) => {
                if (handle.kind === 'finish-move') {
                    this.drawFinishMoveHandle(ctx, handle);
                    return;
                }
                if (handle.kind === 'formation-convert') {
                    this.drawConvertHandle(ctx, handle);
                    return;
                }
                if (handle.kind === 'formation-forward' || handle.kind === 'single-forward') {
                    this.drawForwardHandle(ctx, handle);
                    return;
                }
                if (handle.kind === 'formation-reverse' || handle.kind === 'single-reverse') {
                    this.drawReverseHandle(ctx, handle);
                    return;
                }
                this.drawRotateHandle(ctx, handle);
            });
            ctx.restore();
        }

        handleBorderWidth(handle) {
            const extra = this.state.hover?.handleKind === handle.kind ? 2.5 : 0;
            return (2 + extra) / this.state.camera.scale;
        }

        drawFinishMoveHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            const size = handle.radius * 2;
            ctx.beginPath();
            ctx.rect(-handle.radius, -handle.radius, size, size);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = this.handleBorderWidth(handle);
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();
            this.drawBootprintIcon(ctx, handle.radius * 1.65, '#7e6420');
            ctx.restore();
        }

        drawRotateHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            ctx.beginPath();
            ctx.arc(0, 0, handle.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = this.handleBorderWidth(handle);
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();

            const iconRadius = handle.radius * 0.52;
            const mirrorLeft = handle.kind === 'rank-left';
            ctx.beginPath();
            ctx.save();
            ctx.rotate(Math.PI);
            if (mirrorLeft) {
                ctx.scale(-1, 1);
            }
            ctx.arc(0, 0, iconRadius, Math.PI * 0.2, Math.PI * 1.35, false);
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();

            const tip = {
                x: Math.cos(Math.PI * 0.2) * iconRadius,
                y: Math.sin(Math.PI * 0.2) * iconRadius
            };
            this.drawArrowHead(ctx, tip, -0.45);
            ctx.restore();
            ctx.restore();
        }

        drawForwardHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            const size = handle.radius * 2;
            ctx.beginPath();
            ctx.rect(-handle.radius, -handle.radius, size, size);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = this.handleBorderWidth(handle);
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();

            const shaftStart = -handle.radius * 0.35;
            const shaftEnd = handle.radius * 0.1;
            ctx.beginPath();
            ctx.moveTo(shaftStart, 0);
            ctx.lineTo(shaftEnd, 0);
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.8 / this.state.camera.scale;
            ctx.stroke();
            this.drawArrowHead(ctx, { x: shaftEnd, y: 0 }, 0);
            ctx.restore();
        }

        drawReverseHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            const size = handle.radius * 2;
            ctx.beginPath();
            ctx.rect(-handle.radius, -handle.radius, size, size);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = this.handleBorderWidth(handle);
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();

            const left = -handle.radius * 0.22;
            const right = handle.radius * 0.22;
            const top = -handle.radius * 0.45;
            const bottom = handle.radius * 0.45;

            ctx.beginPath();
            ctx.moveTo(left, top);
            ctx.lineTo(left, bottom);
            ctx.moveTo(right, bottom);
            ctx.lineTo(right, top);
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();

            this.drawArrowHead(ctx, { x: left, y: bottom }, Math.PI / 2);
            this.drawArrowHead(ctx, { x: right, y: top }, -Math.PI / 2);
            ctx.restore();
        }

        drawConvertHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            const size = handle.radius * 2;
            ctx.beginPath();
            ctx.rect(-handle.radius, -handle.radius, size, size);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = this.handleBorderWidth(handle);
            ctx.strokeStyle = '#7e6420';
            ctx.stroke();

            const arm = handle.radius * 0.45;
            ctx.beginPath();
            ctx.moveTo(-arm, 0);
            ctx.lineTo(arm * 0.25, 0);
            ctx.lineTo(arm * 0.25, -arm);
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();

            this.drawArrowHead(ctx, { x: arm * 0.25, y: -arm }, -Math.PI / 2);
            this.drawArrowHead(ctx, { x: -arm, y: 0 }, Math.PI);
            ctx.restore();
        }

        drawArrowHead(ctx, tip, angle) {
            const size = 4 / this.state.camera.scale;
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(
                tip.x - Math.cos(angle - Math.PI / 6) * size,
                tip.y - Math.sin(angle - Math.PI / 6) * size
            );
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(
                tip.x - Math.cos(angle + Math.PI / 6) * size,
                tip.y - Math.sin(angle + Math.PI / 6) * size
            );
            ctx.strokeStyle = '#7e6420';
            ctx.lineWidth = 1.6 / this.state.camera.scale;
            ctx.stroke();
        }

        drawMarquee(ctx) {
            const rect = geometry.normalizeRect(this.state.marquee.start, this.state.marquee.end);
            ctx.save();
            ctx.fillStyle = 'rgba(85, 132, 173, 0.14)';
            ctx.strokeStyle = 'rgba(42, 90, 136, 0.85)';
            ctx.lineWidth = 1.5 / this.state.camera.scale;
            ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
            ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
            ctx.restore();
        }
    }

    function install(BoardRenderPrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(BoardRenderMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(BoardRenderPrototype.prototype, descriptors);
    }

    return { install };
}));
