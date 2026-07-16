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

    const COLORS = {
        blue: {
            fill: '#5f8ecf',
            stroke: '#20456f',
            glow: 'rgba(56, 95, 154, 0.28)'
        },
        red: {
            fill: '#cf665d',
            stroke: '#752924',
            glow: 'rgba(174, 62, 53, 0.26)'
        }
    };

    const UNIT_TYPES = {
        Blade: { value: 2, depth: 20, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 5, mounted: 3 }, combat: { ignoresBadGoingPenalty: false } },
        Spear: { value: 2, depth: 20, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 4, mounted: 4 }, combat: { ignoresBadGoingPenalty: false } },
        Warband: { value: 2, depth: 20, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 3, mounted: 3 }, combat: { ignoresBadGoingPenalty: true } },
        Shooter: {
            value: 2,
            depth: 20,
            troopClass: 'infantry',
            moves: { road: 400, good: 300, bad: 300, water: 100 },
            strength: { infantry: 3, mounted: 4 },
            ranged: { phase: 'shooting', range: SHOOTING_RANGE_PACES, width: SHOOTING_BOX_WIDTH },
            combat: { ignoresBadGoingPenalty: true }
        },
        Horde: { value: 1, depth: 40, troopClass: 'infantry', moves: { road: 400, good: 200, bad: 200, water: 100 }, strength: { infantry: 2, mounted: 2 }, combat: { ignoresBadGoingPenalty: false } },
        Knights: { value: 2, depth: 30, troopClass: 'mounted', moves: { road: 400, good: 400, bad: 200, water: 100 }, strength: { infantry: 3, mounted: 4 }, combat: { ignoresBadGoingPenalty: false } },
        Riders: { value: 2, depth: 30, troopClass: 'mounted', moves: { road: 500, good: 500, bad: 200, water: 100 }, strength: { infantry: 3, mounted: 3 }, combat: { ignoresBadGoingPenalty: false } },
        Hero: { value: 4, depth: 40, troopClass: 'mounted', moves: { road: 500, good: 500, bad: 200, water: 100 }, strength: { infantry: 5, mounted: 5 }, combat: { ignoresBadGoingPenalty: false } }
    };
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
            width: ranged.width
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

    function createDefaultUnits(allocateUnitId) {
        const units = [];

        function pushUnit(type, side, faction, x, y, rotation) {
            const template = UNIT_TYPES[type];
            units.push({
                id: allocateUnitId(),
                type,
                side,
				faction,
                width: UNIT_WIDTH,
                depth: template.depth,
                x,
                y,
                rotation,
                movedThisTurn: false,
                troopClass: template.troopClass,
                moves: convertMovesToMm(template.moves),
                ranged: convertRangedToMm(template.ranged),
                value: template.value,
                strength: { ...template.strength },
                combat: { ...(template.combat || {}) }
            });
        }

        pushUnit('Blade', 'blue', "Panda", 140, 520, 0);
        pushUnit('Spear', 'blue', "Panda", 180, 520, 0);
        pushUnit('Shooter', 'blue', "Panda", 220, 520, 0);
        pushUnit('Riders', 'blue', "Panda", 260, 520, 0);
        pushUnit('Warband', 'blue', "Panda", 120, 475, 0);
        pushUnit('Horde', 'blue', "Panda", 120, 435, 0);

        pushUnit('Knights', 'red', "Undead", 420, 90, Math.PI);
        pushUnit('Riders', 'red', "Undead", 460, 90, Math.PI);
        pushUnit('Hero', 'red', "Undead", 500, 90, Math.PI);
        pushUnit('Blade', 'red', "Undead", 480, 115, Math.PI);
        pushUnit('Horde', 'red', "Undead", 480, 155, Math.PI);
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
        COLORS,
        UNIT_TYPES,
        TERRAIN_STYLE,
        pacesToMm,
        convertMovesToMm,
        convertRangedToMm,
        createDefaultTerrain,
        createDefaultUnits
    };
}));