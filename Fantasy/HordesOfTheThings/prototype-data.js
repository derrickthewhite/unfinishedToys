(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
        return;
    }
    root.HordesData = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const BOARD_SIZE = 600;
    const UNIT_WIDTH = 40;
    const MM_GRID = 40;
    const MM_PER_PACE = 0.25;
    const RANK_TOLERANCE = 8;
    const FILE_TOLERANCE = 8;
    const FORMATION_GAP_TOLERANCE = 10;
    const HANDLE_RADIUS = 9;
    const DRAG_THRESHOLD = 4;
    const PATH_SAMPLES = 24;
    const COLLISION_EPSILON = 0.15;
    const FORM_UP_DISTANCE = 20;
    const FORM_UP_SIDE_APPROACH_TOLERANCE = 2;
    const FORM_UP_SPLIT_ANGLE_DEGREES = 5; // this is not supposed to be 15 computer!
    const FORM_UP_SPLIT_ANGLE = FORM_UP_SPLIT_ANGLE_DEGREES * (Math.PI / 180);
    const SNAP_DISTANCE = 6;
    const SNAP_COLLISION_DISTANCE = 18;
    const SNAP_PARALLEL_ANGLE = Math.PI / 24;
    const SHOOTING_RANGE_PACES = 200;
    const SHOOTING_BOX_WIDTH = 120;
    const ROUGH_LOS_ALLOWANCE_PACES = 50;

    const PLAYER_IDS = Object.freeze(['player-1', 'player-2']);
    const ARMY_POINT_TARGET = 24;
    const FACTIONS = Object.freeze(['Panda', 'Undead']);
    const TERRAIN_OFFER_KINDS = Object.freeze(['forest', 'swamp', 'water', 'impassable', 'road']);
    const TERRAIN_COUNT_MAX = 8;
    const TERRAIN_SHAPES = Object.freeze(['blob', 'kidney', 'circle', 'half-circle', 'square', 'rectangle', 'oval', 'fat-l', 'horseshoe', 'cross', 'lightbulb']);
    const TERRAIN_SIZE_MULTIPLIERS = Object.freeze([0.25, 0.5, 1, 1.5]);

    const PLAYER_COLORS = Object.freeze({
        blue: {
            label: 'Blue',
            fill: '#5f8ecf',
            stroke: '#20456f',
            glow: 'rgba(56, 95, 154, 0.28)'
        },
        red: {
            label: 'Red',
            fill: '#cf665d',
            stroke: '#752924',
            glow: 'rgba(174, 62, 53, 0.26)'
        },
        green: {
            label: 'Green',
            fill: '#6f9d62',
            stroke: '#315b38',
            glow: 'rgba(70, 126, 76, 0.28)'
        },
        gold: {
            label: 'Gold',
            fill: '#c9a650',
            stroke: '#72531d',
            glow: 'rgba(181, 139, 38, 0.28)'
        }
    });

    const DEFAULT_PLAYERS = Object.freeze({
        'player-1': { id: 'player-1', colorId: 'blue', faction: 'Panda' },
        'player-2': { id: 'player-2', colorId: 'red', faction: 'Undead' }
    });

    // Retained until all rendering consumers use player color configuration.
    const COLORS = PLAYER_COLORS;

    const UNIT_TYPES = {
        Blade: { value: 2, depth: 20, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 5, mounted: 3 }, combat: { ignoresBadGoingPenalty: false } },
        Spear: { value: 2, depth: 20, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 4, mounted: 4 }, combat: { ignoresBadGoingPenalty: false } },
        'Heavy-Spear': { value: 3, depth: 30, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 5, mounted: 5 }, combat: { ignoresBadGoingPenalty: false } },
        Warband: { value: 2, depth: 20, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 3, mounted: 3 }, combat: { ignoresBadGoingPenalty: true } },
        'Heavy-Warband': { value: 3, depth: 30, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 4, mounted: 4 }, combat: { ignoresBadGoingPenalty: true } },
        Shooter: {
            value: 2,
            depth: 20,
            troopClass: 'infantry',
            moves: { road: 400, good: 300, bad: 300, water: 100 },
            strength: { infantry: 3, mounted: 4 },
            ranged: { phase: 'shooting', range: SHOOTING_RANGE_PACES, width: SHOOTING_BOX_WIDTH },
            combat: { ignoresBadGoingPenalty: true }
        },
        Artillery: {
            value: 3,
            depth: 40,
            troopClass: 'infantry',
            moves: { road: 300, good: 200, bad: 0, water: 100 },
            strength: { infantry: 4, mounted: 4 },
            ranged: { phase: 'shooting', range: 500, width: SHOOTING_BOX_WIDTH, requiresOwnTurn: true, requiresStationary: true },
            combat: { ignoresBadGoingPenalty: false }
        },
        Horde: { value: 1, depth: 40, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 2, mounted: 2 }, combat: { ignoresBadGoingPenalty: false } },
        Knights: { value: 2, depth: 30, troopClass: 'mounted', moves: { road: 400, good: 400, bad: 200, water: 100 }, strength: { infantry: 3, mounted: 4 }, combat: { ignoresBadGoingPenalty: false } },
        Riders: { value: 2, depth: 30, troopClass: 'mounted', moves: { road: 500, good: 500, bad: 200, water: 100 }, strength: { infantry: 3, mounted: 3 }, combat: { ignoresBadGoingPenalty: false } },
        Hero: { value: 4, depth: 40, troopClass: 'mounted', moves: { road: 500, good: 500, bad: 200, water: 100 }, strength: { infantry: 5, mounted: 5 }, combat: { ignoresBadGoingPenalty: false } },
        Beasts: { value: 2, depth: 30, troopClass: 'mounted', moves: { road: 400, good: 400, bad: 400, water: 100 }, strength: { infantry: 3, mounted: 4 }, combat: { ignoresBadGoingPenalty: true } },
        Flyers: { value: 2, depth: 20, troopClass: 'mounted', moves: { road: 1200, good: 1200, bad: 1200, water: 1200 }, strength: { infantry: 2, mounted: 2 }, combat: { ignoresBadGoingPenalty: false }, movement: { ignoresTerrain: true, ignoresUnitsWhenUnengaged: true, disengageDistance: 20 } },
        Behemoth: { value: 4, depth: 40, troopClass: 'mounted', moves: { road: 400, good: 300, bad: 200, water: 100 }, strength: { infantry: 4, mounted: 5 }, combat: { ignoresBadGoingPenalty: false } }
    };

    const AUTO_DEPLOY_MAX_RANK = 4;

    // Additive matchup bias on top of strength-difference scoring for attacker auto-deploy.
    const DEPLOYMENT_MATCHUP_BONUSES = Object.freeze({
        Blade: { Horde: 1, Warband: 1 },
        Spear: { Knights: 1, Riders: 1, Beasts: 1 },
        'Heavy-Spear': { Knights: 1, Riders: 1, Behemoth: 1 },
        Warband: { Spear: 1, 'Heavy-Spear': 1 },
        'Heavy-Warband': { Spear: 1, Blade: 1 },
        Shooter: { Knights: 1, Riders: 1, Flyers: 1 },
        Artillery: { Behemoth: 2, Knights: 1, Hero: 1 },
        Horde: {},
        Knights: { Shooter: 2, Horde: 2, Blade: 1, Warband: 1, Spear: -1 },
        Riders: { Shooter: 1, Artillery: 1, Horde: 1 },
        Hero: { Hero: 1, Behemoth: 1, Knights: 1 },
        Beasts: { Warband: 1, Horde: 1, Shooter: 1 },
        Flyers: { Artillery: 1, Shooter: 1, Horde: 1 },
        Behemoth: { Knights: 1, Spear: 1, Blade: 1, Artillery: -2 }
    });

    function getDeploymentMatchupScore(attackerType, defenderType) {
        const attacker = UNIT_TYPES[attackerType];
        const defender = UNIT_TYPES[defenderType];
        if (!attacker || !defender) {
            return 0;
        }
        const strengthEdge = attacker.strength[defender.troopClass] - defender.strength[attacker.troopClass];
        const bonus = DEPLOYMENT_MATCHUP_BONUSES[attackerType]?.[defenderType] || 0;
        return strengthEdge + bonus;
    }

    function pacesToMm(paces) {
        return paces * MM_PER_PACE;
    }

    function convertMovesToMm(moves) {
        return {
            road: pacesToMm(moves.road),
            good: pacesToMm(moves.good),
            bad: pacesToMm(moves.bad),
            water: pacesToMm(moves.water)
        };
    }

    function convertRangedToMm(ranged) {
        if (!ranged) {
            return null;
        }
        return {
            phase: ranged.phase,
            range: pacesToMm(ranged.range),
            width: ranged.width,
            requiresOwnTurn: Boolean(ranged.requiresOwnTurn),
            requiresStationary: Boolean(ranged.requiresStationary)
        };
    }


    const TERRAIN_STYLE = {
        good: { fill: '#cab88e', label: 'Good Going' },
        road: { fill: '#d8c59a', label: 'Road' },
        swamp: { fill: '#859a63', label: 'Swamp' },
        forest: { fill: '#54704d', label: 'Forest' },
        water: { fill: '#5e92b2', label: 'Water' },
        impassable: { fill: '#595661', label: 'Impassable' }
    };

    function createTerrainOffer(kind, id, random = Math.random) {
        if (!TERRAIN_OFFER_KINDS.includes(kind)) {
            throw new Error('Unknown terrain offer kind: ' + kind);
        }
        if (kind === 'road') {
            return {
                id,
                kind,
                orientation: random() < 0.5 ? 'horizontal' : 'vertical',
                position: BOARD_SIZE / 2,
                width: 20,
                fill: '#d7c28f'
            };
        }
        const sizeMultiplier = TERRAIN_SIZE_MULTIPLIERS[Math.floor(random() * TERRAIN_SIZE_MULTIPLIERS.length)];
        return {
            id,
            kind,
            cx: BOARD_SIZE / 2,
            cy: BOARD_SIZE / 2,
            shape: TERRAIN_SHAPES[Math.floor(random() * TERRAIN_SHAPES.length)],
            sizeMultiplier,
            rx: (48 + Math.round(random() * 24)) * sizeMultiplier,
            ry: (42 + Math.round(random() * 20)) * sizeMultiplier,
            wobble: 0.16 + (random() * 0.12),
            rotation: 0
        };
    }

    function createDefaultTerrain() {
        return {
            roads: [
                { orientation: 'vertical', position: BOARD_SIZE / 2, width: 20, kind: 'road', fill: '#d7c28f' }
            ],
            features: [
                { kind: 'water', cx: 160, cy: 150, rx: 74, ry: 58, wobble: 0.24 },
                { kind: 'forest', cx: 448, cy: 154, rx: 70, ry: 62, wobble: 0.22 },
                { kind: 'impassable', cx: 456, cy: 438, rx: 68, ry: 56, wobble: 0.2 },
                { kind: 'swamp', cx: 160, cy: 438, rx: 80, ry: 60, wobble: 0.26 }
            ]
        };
    }

    function createUnit(type, playerId, faction, pose, allocateUnitId) {
        const template = UNIT_TYPES[type];
        if (!template) {
            throw new Error('Unknown unit type: ' + type);
        }
        return {
            id: allocateUnitId(),
            type,
            playerId,
            faction,
            width: UNIT_WIDTH,
            depth: template.depth,
            x: pose.x,
            y: pose.y,
            rotation: pose.rotation,
            movedThisTurn: false,
            troopClass: template.troopClass,
            moves: convertMovesToMm(template.moves),
            ranged: convertRangedToMm(template.ranged),
            movement: { ...(template.movement || {}) },
            value: template.value,
            strength: { ...template.strength },
            combat: { ...(template.combat || {}) }
        };
    }

    function createDefaultUnits(allocateUnitId) {
        const units = [];

        function pushUnit(type, playerId, x, y, rotation) {
            const player = DEFAULT_PLAYERS[playerId];
            units.push(createUnit(type, playerId, player.faction, { x, y, rotation }, allocateUnitId));
        }

        pushUnit('Blade', 'player-1', 140, 520, 0);
        pushUnit('Spear', 'player-1', 180, 520, 0);
        pushUnit('Shooter', 'player-1', 220, 520, 0);
        pushUnit('Riders', 'player-1', 260, 520, 0);
        pushUnit('Warband', 'player-1', 120, 475, 0);
        pushUnit('Horde', 'player-1', 120, 435, 0);
        pushUnit('Artillery', 'player-1', 180, 435, 0);

        pushUnit('Knights', 'player-2', 420, 90, Math.PI);
        pushUnit('Riders', 'player-2', 460, 90, Math.PI);
        pushUnit('Hero', 'player-2', 500, 90, Math.PI);
        pushUnit('Blade', 'player-2', 480, 115, Math.PI);
        pushUnit('Horde', 'player-2', 480, 155, Math.PI);
        return units;
    }

    return {
        BOARD_SIZE,
        UNIT_WIDTH,
        MM_GRID,
        MM_PER_PACE,
        RANK_TOLERANCE,
        FILE_TOLERANCE,
        FORMATION_GAP_TOLERANCE,
        HANDLE_RADIUS,
        DRAG_THRESHOLD,
        PATH_SAMPLES,
        COLLISION_EPSILON,
        FORM_UP_DISTANCE,
        FORM_UP_SIDE_APPROACH_TOLERANCE,
        FORM_UP_SPLIT_ANGLE_DEGREES,
        FORM_UP_SPLIT_ANGLE,
        SNAP_DISTANCE,
        SNAP_COLLISION_DISTANCE,
        SNAP_PARALLEL_ANGLE,
        SHOOTING_RANGE_PACES,
        SHOOTING_BOX_WIDTH,
        ROUGH_LOS_ALLOWANCE_PACES,
        ARMY_POINT_TARGET,
        FACTIONS,
        TERRAIN_OFFER_KINDS,
        TERRAIN_COUNT_MAX,
        TERRAIN_SHAPES,
        TERRAIN_SIZE_MULTIPLIERS,
        PLAYER_IDS,
        PLAYER_COLORS,
        DEFAULT_PLAYERS,
        COLORS,
        UNIT_TYPES,
        TERRAIN_STYLE,
        AUTO_DEPLOY_MAX_RANK,
        DEPLOYMENT_MATCHUP_BONUSES,
        getDeploymentMatchupScore,
        createTerrainOffer,
        pacesToMm,
        convertMovesToMm,
        convertRangedToMm,
        createUnit,
        createDefaultTerrain,
        createDefaultUnits
    };
}));