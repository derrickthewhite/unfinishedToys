(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('../data.js'),
            require('../geometry.js'),
            require('../rules/index.js')
        );
        return;
    }
    root.HordesAi = factory(root.HordesData, root.HordesGeometry, root.HordesRules);
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
    const AUTO_DEPLOY_LEFTOVER_MAX_GOOD_GAP = 300;

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            getAutoDeployRole(type) {
                if (type === 'Flyers') {
                    return 'flyer';
                }
                const template = data.UNIT_TYPES[type];
                if (!template) {
                    return 'front';
                }
                if (type === 'Behemoth' || (template.troopClass === 'mounted' && template.moves.good >= 400 && type !== 'Beasts')) {
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

            getAutoDeployMovementKey(type) {
                if (this.getAutoDeployRole(type) === 'flyer') {
                    return 'flyer';
                }
                const moves = data.UNIT_TYPES[type]?.moves || {};
                return `${moves.good || 0}:${moves.bad || 0}:${moves.water || 0}`;
            },

            getAutoDeployGoodPace(type) {
                return data.UNIT_TYPES[type]?.moves?.good || 0;
            },

            isAutoDeployLeftoverGroupLegal(entries) {
                if (entries.length === 0 || entries.length > data.AUTO_DEPLOY_MAX_RANK) {
                    return false;
                }
                const flyerCount = entries.filter((entry) => this.getAutoDeployRole(entry.type) === 'flyer').length;
                if (flyerCount > 0) {
                    return flyerCount === entries.length;
                }
                const goods = entries.map((entry) => this.getAutoDeployGoodPace(entry.type));
                return Math.max(...goods) - Math.min(...goods) < AUTO_DEPLOY_LEFTOVER_MAX_GOOD_GAP;
            },

            getAutoDeployLeftoverSlowdown(entries) {
                const goods = entries.map((entry) => this.getAutoDeployGoodPace(entry.type));
                const slowest = Math.min(...goods);
                return goods.reduce((sum, good) => sum + (good - slowest), 0);
            },

            getAutoDeployLeftoverClassMix(entries) {
                const classes = new Set(entries.map((entry) => data.UNIT_TYPES[entry.type]?.troopClass || 'infantry'));
                return classes.size > 1 ? 1 : 0;
            },

            compareAutoDeployLeftoverScores(left, right) {
                for (let index = 0; index < left.length; index += 1) {
                    if (left[index] !== right[index]) {
                        return left[index] - right[index];
                    }
                }
                return 0;
            },

            orderAutoDeployLeftoverGroup(entries) {
                return [...entries].sort((left, right) => {
                    const bad = Number(this.unitPrefersBadGoing(right.type)) - Number(this.unitPrefersBadGoing(left.type));
                    if (bad) {
                        return bad;
                    }
                    const type = left.type.localeCompare(right.type);
                    if (type) {
                        return type;
                    }
                    return left.draftId.localeCompare(right.draftId);
                });
            },

            createAutoDeployFormation(entries) {
                const typeCounts = new Map();
                entries.forEach((entry) => {
                    typeCounts.set(entry.type, (typeCounts.get(entry.type) || 0) + 1);
                });
                const primaryType = [...typeCounts.entries()]
                    .sort((left, right) => (right[1] - left[1]) || left[0].localeCompare(right[0]))[0][0];
                return {
                    type: primaryType,
                    role: this.getAutoDeployRole(primaryType),
                    prefersBadGoing: entries.some((entry) => this.unitPrefersBadGoing(entry.type)),
                    entries
                };
            },

            sortDeploymentTrayEntries(entries) {
                return [...entries].sort((left, right) => {
                    const movement = this.getAutoDeployMovementKey(left.type).localeCompare(this.getAutoDeployMovementKey(right.type));
                    if (movement) {
                        return movement;
                    }
                    const type = left.type.localeCompare(right.type);
                    if (type) {
                        return type;
                    }
                    return left.draftId.localeCompare(right.draftId);
                });
            },

            packAutoDeployRankChunks(entries) {
                const chunks = [];
                let index = 0;
                while (index < entries.length) {
                    const remaining = entries.length - index;
                    let take = Math.min(data.AUTO_DEPLOY_MAX_RANK, remaining);
                    if (take === data.AUTO_DEPLOY_MAX_RANK && remaining - take === 1) {
                        take -= 1;
                    }
                    chunks.push(entries.slice(index, index + take));
                    index += take;
                }
                return chunks;
            },

            packAutoDeployLeftoverFormations(remainders) {
                const formations = [];
                const flyers = remainders.filter((entry) => this.getAutoDeployRole(entry.type) === 'flyer');
                const ground = remainders.filter((entry) => this.getAutoDeployRole(entry.type) !== 'flyer');
                this.packAutoDeployRankChunks(this.sortDeploymentTrayEntries(flyers)).forEach((group) => {
                    formations.push(this.createAutoDeployFormation(group));
                });
                const items = ground;
                const count = items.length;
                if (count === 0) {
                    return formations;
                }
                const memo = new Map();
                const solve = (mask) => {
                    if (mask === 0) {
                        return { score: [0, 0, 0, 0, 0], groups: [] };
                    }
                    if (memo.has(mask)) {
                        return memo.get(mask);
                    }
                    const indices = [];
                    for (let index = 0; index < count; index += 1) {
                        if (mask & (1 << index)) {
                            indices.push(index);
                        }
                    }
                    const first = indices[0];
                    const others = indices.slice(1);
                    let best = null;
                    const consider = (picked) => {
                        const entries = picked.map((index) => items[index]);
                        if (!this.isAutoDeployLeftoverGroupLegal(entries)) {
                            return;
                        }
                        let restMask = mask;
                        picked.forEach((index) => {
                            restMask &= ~(1 << index);
                        });
                        const rest = solve(restMask);
                        const candidate = {
                            score: [
                                rest.score[0] + 1,
                                rest.score[1] + this.getAutoDeployLeftoverSlowdown(entries),
                                rest.score[2] + this.getAutoDeployLeftoverClassMix(entries),
                                rest.score[3] + (picked.length === 1 ? 1 : 0),
                                rest.score[4] + new Set(entries.map((entry) => entry.type)).size
                            ],
                            groups: [picked, ...rest.groups]
                        };
                        if (!best || this.compareAutoDeployLeftoverScores(candidate.score, best.score) < 0) {
                            best = candidate;
                        }
                    };
                    const chooseOthers = (start, picked) => {
                        consider(picked);
                        if (picked.length >= data.AUTO_DEPLOY_MAX_RANK) {
                            return;
                        }
                        for (let index = start; index < others.length; index += 1) {
                            chooseOthers(index + 1, picked.concat(others[index]));
                        }
                    };
                    chooseOthers(0, [first]);
                    memo.set(mask, best);
                    return best;
                };
                const packed = solve((1 << count) - 1);
                packed.groups.forEach((picked) => {
                    formations.push(this.createAutoDeployFormation(
                        this.orderAutoDeployLeftoverGroup(picked.map((index) => items[index]))
                    ));
                });
                return formations;
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
                const remainders = [];
                byType.forEach((entries) => {
                    const sorted = this.sortDeploymentTrayEntries(entries);
                    let index = 0;
                    while (index + data.AUTO_DEPLOY_MAX_RANK <= sorted.length) {
                        formations.push(this.createAutoDeployFormation(sorted.slice(index, index + data.AUTO_DEPLOY_MAX_RANK)));
                        index += data.AUTO_DEPLOY_MAX_RANK;
                    }
                    if (index < sorted.length) {
                        remainders.push(...sorted.slice(index));
                    }
                });
                formations.push(...this.packAutoDeployLeftoverFormations(remainders));
                return formations.sort((left, right) => (right.entries.length - left.entries.length)
                    || (ROLE_ORDER[left.role] - ROLE_ORDER[right.role])
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

            scoreFrontCorridor(unit) {
                const hits = this.collectFrontCorridorHits(unit);
                let score = 0;
                if (hits.water > 0) {
                    score -= 26 + Math.min(hits.water, 6) * 3;
                }
                if (hits.impassable > 0) {
                    score -= 30 + Math.min(hits.impassable, 6) * 3;
                }
                const badHits = hits.forest + hits.swamp;
                if (unit.type === 'Shooter') {
                    if (hits.water === 0 && hits.impassable === 0) {
                        score += 6;
                    }
                    return score;
                }
                if (this.unitPrefersBadGoing(unit.type)) {
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

            describeAutoDeployOccupied(units, size) {
                if (!units.length) {
                    return [];
                }
                const fronts = units.map((unit) => this.getUnitFrontCenter(unit));
                const minX = Math.min(...fronts.map((front) => front.x));
                const maxX = Math.max(...fronts.map((front) => front.x));
                return fronts.map((front) => ({
                    x: front.x,
                    y: front.y,
                    minX,
                    maxX,
                    size
                }));
            },

            scoreAutoDeployOverlap(units, frontAnchor, forward, occupiedFronts) {
                const fronts = units.map((unit) => this.getUnitFrontCenter(unit));
                const thisMinX = Math.min(...fronts.map((front) => front.x));
                const thisMaxX = Math.max(...fronts.map((front) => front.x));
                const thisSize = units.length;
                const midX = data.BOARD_SIZE / 2;
                const flankDistance = Math.abs(frontAnchor.x - midX);
                let score = 0;

                if (occupiedFronts.length === 0) {
                    score += Math.max(0, 12 - (flankDistance / 28));
                    return score;
                }

                occupiedFronts.forEach((friendly) => {
                    const friendlySize = friendly.size || 1;
                    const friendlyMin = friendly.minX ?? friendly.x;
                    const friendlyMax = friendly.maxX ?? friendly.x;
                    const overlaps = thisMinX <= friendlyMax + 8 && thisMaxX >= friendlyMin - 8;
                    const friendlyAhead = geometry.dot(geometry.subtract(friendly, frontAnchor), forward);
                    if (!overlaps) {
                        const gap = thisMinX > friendlyMax ? thisMinX - friendlyMax : friendlyMin - thisMaxX;
                        if (Math.abs(friendlyAhead) <= 24 && gap < 80) {
                            score += Math.max(0, 18 - (gap / 4));
                        }
                        return;
                    }
                    if (friendlyAhead > 10) {
                        score -= thisSize < friendlySize ? 8 : 36;
                    } else if (friendlyAhead < -10) {
                        score -= 70;
                    }
                });

                const minFriendlyX = Math.min(...occupiedFronts.map((friendly) => friendly.minX ?? friendly.x));
                const maxFriendlyX = Math.max(...occupiedFronts.map((friendly) => friendly.maxX ?? friendly.x));
                if (thisMaxX < minFriendlyX - 8 || thisMinX > maxFriendlyX + 8) {
                    score += 16;
                }
                return score;
            },

            scoreAutoDeployFormation(formation, units, frontAnchor, enemyLine, isAttacker, friendlyFronts = []) {
                let score = 0;
                const playerId = formation.entries[0].playerId;
                const rotation = this.getDefaultDeploymentRotation(playerId);
                const forward = geometry.getForwardVector(rotation);
                units.forEach((unit) => {
                    if (formation.role === 'flyer') {
                        return;
                    }
                    const occupied = rules.sampleUnitTerrain(unit, this.state.terrain);
                    const inBadGoing = occupied.has('forest') || occupied.has('swamp');
                    if (this.unitPrefersBadGoing(unit.type)) {
                        score += inBadGoing ? 28 : -8;
                    } else {
                        score += inBadGoing ? -30 : 10;
                    }
                    score += this.scoreFrontCorridor(unit);
                });

                const midX = data.BOARD_SIZE / 2;
                const flankDistance = Math.abs(frontAnchor.x - midX);
                if (formation.role === 'flyer' || (friendlyFronts.length > 0 && units.length <= 2 && formation.role === 'fast')) {
                    score += Math.min(18, flankDistance / 12);
                    if (formation.role === 'flyer') {
                        score += 4;
                    }
                }

                score += this.scoreAutoDeployOverlap(units, frontAnchor, forward, friendlyFronts);

                if (isAttacker && enemyLine.length > 0) {
                    let matchupPull = 0;
                    enemyLine.forEach((enemy) => {
                        const sampleWeight = 1 / (1 + (Math.abs(enemy.x - frontAnchor.x) / 48));
                        matchupPull += sampleWeight * (1 + this.getFormationMatchupScore(formation, enemy.type));
                    });
                    score += matchupPull * 14;
                }
                return score;
            },

            getFormationMatchupScore(formation, enemyType) {
                const types = (formation.entries || []).map((entry) => entry.type);
                if (types.length === 0) {
                    return data.getDeploymentMatchupScore(formation.type, enemyType);
                }
                return types.reduce((sum, type) => sum + data.getDeploymentMatchupScore(type, enemyType), 0) / types.length;
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

                const orientations = [formation.entries];
                if (formation.entries.length > 1) {
                    orientations.push([...formation.entries].reverse());
                }

                let best = null;
                orientations.forEach((entries) => {
                    const oriented = { ...formation, entries };
                    candidates.forEach((frontAnchor) => {
                        let nextId = this.nextUnitId;
                        const built = this.buildAutoDeployFormationUnits(oriented, frontAnchor, () => {
                            const id = `unit-${nextId}`;
                            nextId += 1;
                            return id;
                        });
                        const units = built.map((entry) => entry.unit);
                        if (!this.isAutoDeployBatchLegal(units)) {
                            return;
                        }
                        const score = this.scoreAutoDeployFormation(
                            oriented,
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
                });
                return best;
            },

            autoDeployActiveArmy() {
                const deployment = this.getDeploymentSetup();
                if (!deployment || this.state.setupStage !== 'unit-deployment') {
                    return;
                }
                const activePlayerId = deployment.activePlayerId;
                let trayEntries = deployment.tray.filter((entry) => entry.playerId === activePlayerId);
                if (trayEntries.length === 0) {
                    const deployedIds = [...(deployment.deployedByPlayerId[activePlayerId] || [])];
                    if (deployedIds.length === 0) {
                        this.updateStatus('There are no units to auto-deploy.');
                        return;
                    }
                    this.returnDeployedUnitsToTray(deployedIds);
                    trayEntries = deployment.tray.filter((entry) => entry.playerId === activePlayerId);
                }

                const formations = this.buildAutoDeployFormations(trayEntries);
                const enemyLine = this.getEnemyDeploymentLine(activePlayerId);
                const isAttacker = activePlayerId === deployment.attackerPlayerId;
                const occupiedFrontAnchors = this.describeAutoDeployOccupied(
                    this.state.units.filter((unit) => this.getUnitPlayerId(unit) === activePlayerId),
                    1
                );
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
                    });
                    occupiedFrontAnchors.push(...this.describeAutoDeployOccupied(
                        placement.built.map((entry) => entry.unit),
                        placement.built.length
                    ));
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
            }
        });
    }

    return { install };
}));
