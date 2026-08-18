(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js'),
            require('./prototype-move-ai-score.js')
        );
        return;
    }
    root.HordesMoveAiCandidates = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesMoveAiScore);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, score) {
    const {
        getFormUpPreviewCombats,
        getActivePreviewSide,
        combatInvolvesMovedUnits,
        getCombatAdvantage
    } = score;
    const REVERSE_MIN_DISADVANTAGE = 0.5;

    const WHEEL_STEP_DEGREES = [15, 30, 45];

    function getOpponentPlayerId(activePlayerId) {
        return activePlayerId === 'player-1' ? 'player-2' : 'player-1';
    }


    function clusterByCoordinate(entries, axis, tolerance) {
        const sorted = [...entries].sort((left, right) => left[axis] - right[axis]);
        const clusters = [];
        let current = [];
        sorted.forEach((entry) => {
            if (current.length === 0) {
                current.push(entry);
                return;
            }
            const clusterMean = geometry.average(current.map((item) => item[axis]));
            if (Math.abs(entry[axis] - clusterMean) <= tolerance) {
                current.push(entry);
                return;
            }
            clusters.push(current);
            current = [entry];
        });
        if (current.length > 0) {
            clusters.push(current);
        }
        return clusters;
    }


    function splitContiguous(sortedEntries, axis, unitSize, gapTolerance) {
        if (sortedEntries.length === 0) {
            return [];
        }
        const segments = [];
        let current = [sortedEntries[0]];
        for (let index = 1; index < sortedEntries.length; index += 1) {
            const previous = sortedEntries[index - 1];
            const next = sortedEntries[index];
            const gap = next[axis] - previous[axis];
            if (gap <= unitSize + gapTolerance) {
                current.push(next);
            } else {
                segments.push(current);
                current = [next];
            }
        }
        segments.push(current);
        return segments;
    }


    function localizeUnits(units, anchorUnit) {
        const forward = geometry.getForwardVector(anchorUnit.rotation);
        const right = geometry.getRightVector(anchorUnit.rotation);
        const anchor = geometry.getUnitCenter(anchorUnit);
        return units.map((unit) => {
            const delta = geometry.subtract(geometry.getUnitCenter(unit), anchor);
            return {
                unit,
                u: geometry.dot(delta, right),
                v: geometry.dot(delta, forward)
            };
        });
    }


    function findRankSegments(units) {
        if (units.length === 0) {
            return [];
        }
        const localized = localizeUnits(units, units[0]);
        const rows = clusterByCoordinate(localized, 'v', data.RANK_TOLERANCE);
        const segments = [];
        rows.forEach((row) => {
            const sorted = [...row].sort((left, right) => left.u - right.u);
            splitContiguous(sorted, 'u', units[0].width, data.FORMATION_GAP_TOLERANCE).forEach((segment) => {
                segments.push(segment.map((entry) => entry.unit));
            });
        });
        return segments;
    }


    function findFileSegments(units) {
        if (units.length === 0) {
            return [];
        }
        const localized = localizeUnits(units, units[0]);
        const columns = clusterByCoordinate(localized, 'u', data.FILE_TOLERANCE);
        const segments = [];
        columns.forEach((column) => {
            const sorted = [...column].sort((left, right) => right.v - left.v);
            splitContiguous(sorted, 'v', units[0].depth, data.FORMATION_GAP_TOLERANCE).forEach((segment) => {
                segments.push(segment.map((entry) => entry.unit));
            });
        });
        return segments;
    }


    function collectMoveCandidateGroups(units, activePlayerId, getPlayerId) {
        const unmoved = units.filter((unit) => (
            getPlayerId(unit) === activePlayerId
            && !unit.movedThisTurn
            && !unit.inReserve
        ));
        const groups = [];
        const seen = new Set();
        const facingBuckets = new Map();

        unmoved.forEach((unit) => {
            const key = String(Math.round(unit.rotation * 100));
            if (!facingBuckets.has(key)) {
                facingBuckets.set(key, []);
            }
            facingBuckets.get(key).push(unit);
        });

        const addGroup = (unitIds) => {
            const key = [...unitIds].sort().join(',');
            if (seen.has(key)) {
                return;
            }
            const selected = unitIds
                .map((unitId) => units.find((unit) => unit.id === unitId))
                .filter(Boolean);
            const analysis = rules.analyzeSelection(selected);
            if (analysis.invalid || analysis.type === 'none' || analysis.type === 'invalid') {
                return;
            }
            seen.add(key);
            groups.push({ unitIds: [...unitIds], analysis });
        };

        facingBuckets.forEach((bucket) => {
            bucket.forEach((unit) => addGroup([unit.id]));

            findRankSegments(bucket).forEach((segment) => {
                for (let start = 0; start < segment.length; start += 1) {
                    for (let end = start; end < segment.length; end += 1) {
                        addGroup(segment.slice(start, end + 1).map((entry) => entry.id));
                    }
                }
            });

            findFileSegments(bucket).forEach((segment) => {
                for (let start = 0; start < segment.length; start += 1) {
                    for (let end = start; end < segment.length; end += 1) {
                        addGroup(segment.slice(start, end + 1).map((entry) => entry.id));
                    }
                }
            });
        });

        return groups;
    }


    function getReserveDeploySamples() {
        return [
            data.BOARD_SIZE / 2,
            data.BOARD_SIZE * 0.25,
            data.BOARD_SIZE * 0.75
        ];
    }


    function isGroupInBadMelee(units, activePlayerId, unitIds, terrain) {
        const previews = getFormUpPreviewCombats(units, activePlayerId, terrain);
        return previews.some((preview) => {
            if (!combatInvolvesMovedUnits(preview, unitIds, activePlayerId)) {
                return false;
            }
            const sides = getActivePreviewSide(preview, activePlayerId);
            return sides && getCombatAdvantage(sides.active, sides.opponent) <= -REVERSE_MIN_DISADVANTAGE;
        });
    }


    function collectExtendedMoveCandidates(context) {
        const {
            units,
            activePlayerId,
            getPlayerId,
            reserveUnits = [],
            remainingMoves = 0
        } = context;
        const candidates = [];

        collectMoveCandidateGroups(units, activePlayerId, getPlayerId).forEach((group) => {
            candidates.push({ ...group, moveKind: 'forward', moveParam: null });

            if (group.analysis.type === 'rank') {
                WHEEL_STEP_DEGREES.forEach((degrees) => {
                    const radians = (degrees * Math.PI) / 180;
                    candidates.push({ ...group, moveKind: 'wheel-left', moveParam: radians });
                    candidates.push({ ...group, moveKind: 'wheel-right', moveParam: radians });
                });
            }

            if (group.analysis.type === 'rank' || group.analysis.type === 'file') {
                candidates.push({ ...group, moveKind: 'convert', moveParam: null });
            }

            if (isGroupInBadMelee(units, activePlayerId, group.unitIds, context.terrain)) {
                candidates.push({ ...group, moveKind: 'reverse', moveParam: null });
            }
        });

        if (remainingMoves > 0) {
            reserveUnits.forEach((unit) => {
                if (getPlayerId(unit) !== activePlayerId || !data.RESERVE_RECYCLE_TYPES.includes(unit.type)) {
                    return;
                }
                getReserveDeploySamples().forEach((worldX) => {
                    candidates.push({
                        unitIds: [unit.id],
                        analysis: {
                            type: 'single',
                            invalid: false,
                            reason: '',
                            forward: geometry.getForwardVector(0),
                            right: geometry.getRightVector(0)
                        },
                        moveKind: 'reserve-deploy',
                        moveParam: worldX,
                        reserveUnitId: unit.id
                    });
                });
            });
        }

        return candidates;
    }


    return {
        getOpponentPlayerId,
        collectMoveCandidateGroups,
        collectExtendedMoveCandidates,
        findRankSegments,
        findFileSegments
    };
}));
