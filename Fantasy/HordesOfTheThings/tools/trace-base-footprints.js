const fs = require('fs');
const path = require('path');
const { Resvg } = require(process.env.RESVG_MODULE);

const FACTIONS = ['Panda', 'Undead', 'Goblin', 'Gunpowder', 'Dinosaurs'];
const ASSETS = path.join(__dirname, '..', 'assets');
const OUTPUT = path.join(__dirname, '..', 'src', 'base-footprints.js');
const PIXELS_PER_MM = 3;
const ALPHA_THRESHOLD = 128;

function readViewBox(svg) {
    const match = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
    if (!match) {
        throw new Error('SVG is missing a viewBox');
    }
    const parts = match[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
        throw new Error('Unreadable viewBox: ' + match[1]);
    }
    return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function isOpaque(pixels, width, x, y) {
    if (x < 0 || y < 0 || x >= width) {
        return false;
    }
    return pixels[((y * width) + x) * 4 + 3] > ALPHA_THRESHOLD;
}

function traceOuterContour(pixels, width, height) {
    const filled = (x, y) => isOpaque(pixels, width, x, y);
    let startX = -1;
    let startY = -1;
    for (let y = 0; y < height && startX < 0; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (filled(x, y)) {
                startX = x;
                startY = y;
                break;
            }
        }
    }
    if (startX < 0) {
        throw new Error('Base art has no opaque pixels');
    }
    const dx = [1, 1, 0, -1, -1, -1, 0, 1];
    const dy = [0, 1, 1, 1, 0, -1, -1, -1];
    const contour = [{ x: startX, y: startY }];
    let cx = startX;
    let cy = startY;
    let bx = startX - 1;
    let by = startY;
    const startBackX = bx;
    const startBackY = by;
    const limit = width * height;
    for (let step = 0; step < limit; step += 1) {
        let startDir = 0;
        for (let direction = 0; direction < 8; direction += 1) {
            if (cx + dx[direction] === bx && cy + dy[direction] === by) {
                startDir = direction;
                break;
            }
        }
        let next = null;
        let nextBack = null;
        for (let offset = 1; offset <= 8; offset += 1) {
            const direction = (startDir + offset) % 8;
            const nx = cx + dx[direction];
            const ny = cy + dy[direction];
            if (!filled(nx, ny)) {
                continue;
            }
            const previousDirection = (startDir + offset - 1 + 8) % 8;
            next = { x: nx, y: ny };
            nextBack = { x: cx + dx[previousDirection], y: cy + dy[previousDirection] };
            break;
        }
        if (!next) {
            break;
        }
        if (next.x === startX && next.y === startY && nextBack.x === startBackX && nextBack.y === startBackY) {
            break;
        }
        contour.push(next);
        cx = next.x;
        cy = next.y;
        bx = nextBack.x;
        by = nextBack.y;
    }
    if (contour.length < 8) {
        throw new Error('Outline trace was too short');
    }
    const sampled = [];
    const stride = Math.max(1, Math.round(PIXELS_PER_MM / 2));
    for (let index = 0; index < contour.length; index += stride) {
        sampled.push(contour[index]);
    }
    sampled.push(contour[0]);
    return sampled;
}

function perpendicularDistance(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) {
        return Math.hypot(point.x - start.x, point.y - start.y);
    }
    return Math.abs((dy * point.x) - (dx * point.y) + (end.x * start.y) - (end.y * start.x)) / length;
}

function simplify(points, epsilon) {
    if (points.length < 4) {
        return points;
    }
    let farthestIndex = 0;
    let farthest = 0;
    const end = points.length - 1;
    for (let index = 1; index < end; index += 1) {
        const distance = perpendicularDistance(points[index], points[0], points[end]);
        if (distance > farthest) {
            farthest = distance;
            farthestIndex = index;
        }
    }
    if (farthest <= epsilon) {
        return [points[0], points[end]];
    }
    const left = simplify(points.slice(0, farthestIndex + 1), epsilon);
    const right = simplify(points.slice(farthestIndex), epsilon);
    return left.slice(0, -1).concat(right);
}

function toMillimetres(points, viewBox, pixelWidth) {
    const scale = viewBox.width / pixelWidth;
    const unique = [];
    points.forEach((point) => {
        const next = {
            x: Number((viewBox.minX + (point.x * scale)).toFixed(2)),
            y: Number((viewBox.minY + (point.y * scale)).toFixed(2))
        };
        const previous = unique[unique.length - 1];
        if (!previous || previous.x !== next.x || previous.y !== next.y) {
            unique.push(next);
        }
    });
    if (unique.length > 1) {
        const first = unique[0];
        const last = unique[unique.length - 1];
        if (first.x === last.x && first.y === last.y) {
            unique.pop();
        }
    }
    return unique;
}

function traceFaction(faction) {
    const filePath = path.join(ASSETS, faction, 'Base.svg');
    const svg = fs.readFileSync(filePath, 'utf8');
    const viewBox = readViewBox(svg);
    const pixelWidth = Math.max(32, Math.round(viewBox.width * PIXELS_PER_MM));
    const rendered = new Resvg(svg, {
        fitTo: { mode: 'width', value: pixelWidth },
        background: 'rgba(0,0,0,0)'
    }).render();
    const contour = traceOuterContour(rendered.pixels, rendered.width, rendered.height);
    let epsilon = 1.15 * PIXELS_PER_MM;
    let simplified = simplify(contour, epsilon);
    while (simplified.length > 72 && epsilon < 8 * PIXELS_PER_MM) {
        epsilon += 0.35 * PIXELS_PER_MM;
        simplified = simplify(contour, epsilon);
    }
    const points = toMillimetres(simplified, viewBox, rendered.width);
    return {
        width: Number(viewBox.width.toFixed(2)),
        depth: Number(viewBox.height.toFixed(2)),
        points
    };
}

function formatPoints(points) {
    const rows = [];
    for (let index = 0; index < points.length; index += 4) {
        rows.push(points.slice(index, index + 4).map((point) => `{ x: ${point.x}, y: ${point.y} }`).join(', '));
    }
    return rows.join(',\n            ');
}

const footprints = {};
FACTIONS.forEach((faction) => {
    footprints[faction] = traceFaction(faction);
    console.log(`${faction}: ${footprints[faction].width} x ${footprints[faction].depth} mm, ${footprints[faction].points.length} outline points`);
});

const body = FACTIONS.map((faction) => {
    const footprint = footprints[faction];
    return `        ${faction}: {
            width: ${footprint.width},
            depth: ${footprint.depth},
            points: [
            ${formatPoints(footprint.points)}
            ]
        }`;
}).join(',\n');

const source = `(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
        return;
    }
    root.HordesBaseFootprints = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    // Outer silhouettes traced from each faction's assets/<Faction>/Base.svg.
    // Coordinates are millimetres in that file's viewBox, origin at the art's top-left.
    const BASE_FOOTPRINTS = {
${body}
    };

    function getBaseFootprint(faction) {
        return BASE_FOOTPRINTS[faction] || null;
    }

    return {
        BASE_FOOTPRINTS,
        getBaseFootprint
    };
}));
`;

fs.writeFileSync(OUTPUT, source);
console.log('Wrote ' + OUTPUT);
