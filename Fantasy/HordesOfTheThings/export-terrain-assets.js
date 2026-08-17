const fs = require('fs');
const path = require('path');

const data = require('./prototype-data.js');
const geometry = require('./prototype-geometry.js');

geometry.setTerrainCatalog(null);

const root = path.join(__dirname, data.TERRAIN_ASSET_ROOT);
const originalDir = path.join(root, 'original');
const wavedDir = path.join(root, 'waved');

fs.mkdirSync(originalDir, { recursive: true });
fs.mkdirSync(wavedDir, { recursive: true });

function roundPoint(point) {
    return [Number(point.x.toFixed(6)), Number(point.y.toFixed(6))];
}

function pointsToSvg(points, fill) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 0.12;
    const width = (maxX - minX) + (pad * 2);
    const height = (maxY - minY) + (pad * 2);
    const polygon = points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join(' ');
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(minX - pad).toFixed(4)} ${(minY - pad).toFixed(4)} ${width.toFixed(4)} ${height.toFixed(4)}">`,
        `  <polygon fill="${fill}" stroke="#1a1815" stroke-width="0.04" stroke-linejoin="round" points="${polygon}"/>`,
        '</svg>',
        ''
    ].join('\n');
}

const catalog = {
    version: 1,
    wobble: data.TERRAIN_ASSET_WOBBLE,
    original: {},
    waved: {}
};

data.TERRAIN_SHAPES.forEach((shape) => {
    const previewScale = 80;
    const original = geometry.getTerrainShapeLocalPoints(shape, 48, {
        wobble: shape === 'blob' ? data.TERRAIN_ASSET_WOBBLE : 0
    });
    const waved = geometry.applyTerrainOutlineWave(
        { cx: 0, cy: 0, rx: previewScale, ry: previewScale, rotation: 0, wobble: data.TERRAIN_ASSET_WOBBLE, shape },
        original.map((point) => ({ x: point.x * previewScale, y: point.y * previewScale }))
    ).map((point) => ({ x: point.x / previewScale, y: point.y / previewScale }));
    catalog.original[shape] = original.map(roundPoint);
    catalog.waved[shape] = waved.map(roundPoint);
    fs.writeFileSync(path.join(originalDir, `${shape}.svg`), pointsToSvg(original, '#54704d'));
    fs.writeFileSync(path.join(wavedDir, `${shape}.svg`), pointsToSvg(waved, '#54704d'));
});

fs.writeFileSync(path.join(root, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${data.TERRAIN_SHAPES.length} original and waved terrain shapes to ${root}`);
