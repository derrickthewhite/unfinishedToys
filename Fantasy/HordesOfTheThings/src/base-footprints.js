(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
        return;
    }
    root.HordesBaseFootprints = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    // Outer silhouettes traced from each faction's assets/<Faction>/Base.svg.
    // Coordinates are millimetres in that file's viewBox, origin at the art's top-left.
    const BASE_FOOTPRINTS = {
        Panda: {
            width: 160.69,
            depth: 100,
            points: [
            { x: 0, y: 0 }, { x: 160.02, y: 0 }, { x: 160.35, y: 99.68 }, { x: 0.33, y: 99.68 }
            ]
        },
        Undead: {
            width: 120.31,
            depth: 120.41,
            points: [
            { x: 56.32, y: 0 }, { x: 76.99, y: 2.33 }, { x: 88.99, y: 7.33 }, { x: 98.32, y: 13.66 },
            { x: 111.65, y: 29.33 }, { x: 117.32, y: 41.99 }, { x: 119.98, y: 55.99 }, { x: 117.32, y: 77.99 },
            { x: 105.98, y: 98.65 }, { x: 88.99, y: 112.65 }, { x: 76.99, y: 117.65 }, { x: 63.66, y: 119.98 },
            { x: 42.99, y: 117.65 }, { x: 31, y: 112.65 }, { x: 21.66, y: 106.32 }, { x: 8.33, y: 90.65 },
            { x: 2.67, y: 77.99 }, { x: 0, y: 63.99 }, { x: 2.67, y: 41.99 }, { x: 14, y: 21.33 },
            { x: 31, y: 7.33 }, { x: 42.99, y: 2.33 }
            ]
        },
        Goblin: {
            width: 174.34,
            depth: 113.12,
            points: [
            { x: 32.67, y: 0 }, { x: 144.68, y: 0.33 }, { x: 174.01, y: 56.34 }, { x: 144.68, y: 112.34 },
            { x: 32.67, y: 112.67 }, { x: 0.33, y: 56.67 }
            ]
        },
        Gunpowder: {
            width: 160.69,
            depth: 100,
            points: [
            { x: 0, y: 0 }, { x: 160.02, y: 0 }, { x: 160.35, y: 99.68 }, { x: 0.33, y: 99.68 }
            ]
        },
        Dinosaurs: {
            width: 131.18,
            depth: 99.79,
            points: [
            { x: 60.6, y: 0 }, { x: 81.24, y: 1.33 }, { x: 103.22, y: 8.99 }, { x: 119.86, y: 21.97 },
            { x: 129.52, y: 39.29 }, { x: 130.19, y: 57.27 }, { x: 123.19, y: 73.25 }, { x: 111.54, y: 85.24 },
            { x: 91.56, y: 95.56 }, { x: 76.91, y: 98.89 }, { x: 60.93, y: 99.55 }, { x: 35.63, y: 94.23 },
            { x: 15.65, y: 82.24 }, { x: 5.66, y: 70.25 }, { x: 1.33, y: 60.26 }, { x: 0, y: 46.95 },
            { x: 1.66, y: 38.29 }, { x: 11.32, y: 21.64 }, { x: 22.64, y: 11.99 }, { x: 33.96, y: 5.99 },
            { x: 47.95, y: 1.66 }
            ]
        }
    };

    function getBaseFootprint(faction) {
        return BASE_FOOTPRINTS[faction] || null;
    }

    return {
        BASE_FOOTPRINTS,
        getBaseFootprint
    };
}));
