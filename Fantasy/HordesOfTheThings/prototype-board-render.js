(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js')
        );
        return;
    }
    root.HordesBoardRender = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules) {
    const PANDA_UNIT_ASSET_PATHS = Object.freeze({
        Blade: 'assets/panda/Blade.svg',
        Hero: 'assets/panda/Hero.svg',
        Knights: 'assets/panda/Knights.svg',
        Shooter: 'assets/panda/Shooter.svg',
        Spear: 'assets/panda/Spear.svg',
        Artillery: 'assets/panda/Artillery.svg'
    });
    const UNDEAD_UNIT_ASSET_PATHS = Object.freeze({
        Blade: 'assets/undead/Blade.svg',
        Horde: 'assets/undead/Horde.svg',
        Riders: 'assets/undead/Riders.svg',
        Spear: 'assets/undead/Spear.svg',
        Warband: 'assets/undead/Warband.svg',
    });
    const UNIT_ASSET_PATHS = Object.freeze({
        Blade: 'assets/Blade.svg',
        Spear: 'assets/Spear.svg',
        Warband: 'assets/Warband.svg',
        Shooter: 'assets/Shooter.svg',
        Horde: 'assets/Horde.svg',
        Knights: 'assets/Knights.svg',
        Riders: 'assets/Riders.svg',
        Hero: 'assets/Hero.svg',
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
            this.drawTerrain(ctx);
            this.drawGhostUnits(ctx);
            this.drawShootingOverlays(ctx);
            this.drawUnits(ctx);
            this.drawSelectionHandles(ctx);
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

        drawTerrain(ctx) {
            ctx.save();
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
        }

        drawShootingOverlays(ctx) {
            if (!this.state.showRangedArea && !this.state.combatResolution && (this.state.mode !== 'game' || this.state.phase !== 'shooting')) {
                return;
            }
            const shooting = this.state.mode === 'game' && this.state.phase === 'shooting'
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
                    ctx.moveTo(area.nearLeft.x, area.nearLeft.y);
                    ctx.lineTo(area.nearRight.x, area.nearRight.y);
                    ctx.lineTo(area.farRight.x, area.farRight.y);
                    ctx.lineTo(area.farLeft.x, area.farLeft.y);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.restore();
                });
            }
            const attacks = shooting ? shooting.attacksByAttacker || {} : {};
            Object.entries(attacks).forEach(([attackerId, targetId]) => {
                const attacker = this.getUnitById(attackerId);
                const target = this.getUnitById(targetId);
                if (!attacker || !target) {
                    return;
                }
                this.drawShootingArrow(ctx, attacker, target);
            });

        }

        drawCombatResolutionOverlays(ctx) {
            const resolution = this.state.combatResolution;
            if (!resolution) {
                return;
            }
            resolution.results.forEach((entry) => {
                let leftUnit = null;
                let rightUnit = null;
                let leftTotal = null;
                let rightTotal = null;
                if (resolution.phase === 'shooting') {
                    leftUnit = this.getUnitById(entry.primaryAttackerId) || resolution.ghostSnapshot[entry.primaryAttackerId];
                    rightUnit = this.getUnitById(entry.defenderId) || resolution.ghostSnapshot[entry.defenderId];
                    leftTotal = entry.attackerTotal;
                    rightTotal = entry.defenderTotal;
                } else {
                    leftUnit = this.getUnitById(entry.leftPrimaryId) || resolution.ghostSnapshot[entry.leftPrimaryId];
                    rightUnit = this.getUnitById(entry.rightPrimaryId) || resolution.ghostSnapshot[entry.rightPrimaryId];
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
            const corners = geometry.getUnitCorners(unit);
            const colors = this.getPlayerColors(this.getUnitPlayerId(unit));
            ctx.save();
            if (options.ghost) {
                ctx.globalAlpha = 0.35;
            }
            ctx.beginPath();
            geometry.tracePolygon(ctx, corners);
            ctx.fillStyle = colors.fill;
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = options.selected ? 22 / this.state.camera.scale : 0;
            ctx.fill();
            ctx.shadowBlur = 0;
            const drewAsset = this.drawUnitAsset(ctx, unit);
            ctx.lineWidth = (options.selected || options.needsShootingDeclaration ? 4 : 2) / this.state.camera.scale;
            if (options.ghost) {
                ctx.setLineDash([6 / this.state.camera.scale, 4 / this.state.camera.scale]);
            }
            ctx.strokeStyle = options.invalid ? '#d01111' : (options.needsShootingDeclaration || options.highlighted) ? '#d7ac37' : colors.stroke;
            ctx.stroke();
            if (!drewAsset) {
                this.drawUnitArrow(ctx, unit);
                this.drawUnitText(ctx, unit);
            }
            ctx.restore();
        }

        getUnitAssetPath(unit) {
            if (!unit || !unit.type) {
                return null;
            }
            const type = unit.type;
            // Prefer faction-specific asset sets when available
            if (unit.faction) {
                const faction = String(unit.faction).toLowerCase();
                if (faction === 'panda' && PANDA_UNIT_ASSET_PATHS[type]) {
                    return PANDA_UNIT_ASSET_PATHS[type];
                }
                if (faction === 'undead' && UNDEAD_UNIT_ASSET_PATHS[type]) {
                    return UNDEAD_UNIT_ASSET_PATHS[type];
                }
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

        drawSelectionHandles(ctx) {
            const handles = this.getSelectionHandles();
            if (handles.length === 0) {
                return;
            }
            ctx.save();
            handles.forEach((handle) => {
                if (handle.kind === 'formation-convert') {
                    this.drawConvertHandle(ctx, handle);
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

        drawRotateHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            ctx.beginPath();
            ctx.arc(0, 0, handle.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = 2 / this.state.camera.scale;
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

        drawReverseHandle(ctx, handle) {
            ctx.save();
            ctx.translate(handle.position.x, handle.position.y);
            ctx.rotate(handle.rotation || 0);
            const size = handle.radius * 2;
            ctx.beginPath();
            ctx.rect(-handle.radius, -handle.radius, size, size);
            ctx.fillStyle = '#fff7dd';
            ctx.fill();
            ctx.lineWidth = 2 / this.state.camera.scale;
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
            ctx.lineWidth = 2 / this.state.camera.scale;
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
