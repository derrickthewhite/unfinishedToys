const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const hexRadius = 40;
const hexWidth = 2 * hexRadius;
const hexHeight = Math.sqrt(3) * hexRadius;
const hexGrid = [];
let units = [];
let terrain = [];

// Create a hex grid
for (let q = -10; q <= 10; q++) {
    for (let r = -10; r <= 10; r++) {
        if (Math.abs(q + r) <= 10) {
            const x = canvas.width / 2 + hexWidth * (3/4) * q;
            const y = canvas.height / 2 + hexHeight * (r + q / 2);
            hexGrid.push({ q, r, x, y });
        }
    }
}
const hexKeys = new Set(hexGrid.map(h => `${h.q},${h.r}`));

// Function to load images with callback
function loadImage(src, callback) {
    const img = new Image();
    img.onload = callback;
    img.src = src;
    return img;
}

// Add test units
for (const key in unitData) {
    units.push({
        ...unitData[key],
        q: Math.floor(Math.random() * 9) - 4,
        r: Math.floor(Math.random() * 9) - 4,
        image: loadImage(unitData[key].image, drawGrid)
    });
}

// Add test terrain
for (const key in terrainData) {
    terrain.push({
        ...terrainData[key],
        q: Math.floor(Math.random() * 5) - 4,
        r: Math.floor(Math.random() * 5) - 4,
        image: loadImage(terrainData[key].image, drawGrid)
    });
}

function traceHex(x, y) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = x + hexRadius * Math.cos(angle);
        const py = y + hexRadius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawHex(x, y, color = "black", width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    traceHex(x, y);
    ctx.stroke();
}

function fillHex(x, y, color) {
    ctx.fillStyle = color;
    traceHex(x, y);
    ctx.fill();
}

function drawUnits() {
    for (const unit of units) {
        const hex = hexGrid.find(h => h.q === unit.q && h.r === unit.r);
        if (hex && unit.image.complete) {
            ctx.drawImage(unit.image, hex.x - hexRadius*2/3, hex.y - hexRadius*2/3, hexRadius*4/3, hexRadius*4/3);
        }
    }
}

function drawTerrain() {
    for (const t of terrain) {
        const hex = hexGrid.find(h => h.q === t.q && h.r === t.r);
        if (hex && t.image.complete) {
            ctx.drawImage(t.image, hex.x - hexRadius*2/3, hex.y - hexRadius*2/3, hexRadius*4/3, hexRadius*4/3);
        }
    }
}

function highlightActiveUnit() {
    if (!activeUnit || !units.includes(activeUnit)) return;
    const hex = hexGrid.find(h => h.q === activeUnit.q && h.r === activeUnit.r);
    if (!hex) return;
    fillHex(hex.x, hex.y, "#b3e0ff");
    drawHex(hex.x, hex.y, "#7eb6e6", 2);
}

function drawArrow(x1, y1, x2, y2, color = "#16324f") {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 16;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - headLength * Math.cos(angle - Math.PI / 7),
        y2 - headLength * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
        x2 - headLength * Math.cos(angle + Math.PI / 7),
        y2 - headLength * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function drawDistanceLabel(x, y, text) {
    ctx.save();
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = ctx.measureText(text).width + 16;
    const height = 30;
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#16324f";
    ctx.lineWidth = 2;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
    ctx.fillStyle = "#16324f";
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawDistanceArrow() {
    if (!selectedUnit || !hoveredHex || !hoveredHexMessage || editMode) return;
    const from = hexGrid.find(h => h.q === selectedUnit.q && h.r === selectedUnit.r);
    if (!from) return;
    drawArrow(from.x, from.y, hoveredHex.x, hoveredHex.y);
    const angle = Math.atan2(hoveredHex.y - from.y, hoveredHex.x - from.x);
    const labelX = hoveredHex.x - Math.sin(angle) * 22;
    const labelY = hoveredHex.y + Math.cos(angle) * 22;
    drawDistanceLabel(labelX, labelY, hoveredHexMessage);
}

function drawPlanFills() {
    for (const hex of attackHexes) {
        const spot = hexGrid.find(item => item.q === hex.q && item.r === hex.r);
        if (!spot) continue;
        fillHex(spot.x, spot.y, "#f4a3a3");
        drawHex(spot.x, spot.y, "#c0392b", 3);
    }
    moveHexes.forEach(hex => {
        const spot = hexGrid.find(item => item.q === hex.q && item.r === hex.r);
        if (!spot) return;
        fillHex(spot.x, spot.y, "#a8e6a8");
        drawHex(spot.x, spot.y, "#1e8f3e", 3);
    });
}

function drawPlanArrows() {
    if (!activeUnit || !moveHexes.length) return;
    const points = [];
    const start = hexGrid.find(item => item.q === activeUnit.q && item.r === activeUnit.r);
    if (start) points.push(start);
    moveHexes.forEach(hex => {
        const spot = hexGrid.find(item => item.q === hex.q && item.r === hex.r);
        if (spot) points.push(spot);
    });
    for (let i = 1; i < points.length; i++) {
        const from = points[i - 1];
        const to = points[i];
        drawArrow(from.x, from.y, to.x, to.y, "#1e8f3e");
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        drawDistanceLabel(to.x - Math.sin(angle) * 22, to.y + Math.cos(angle) * 22, String(i));
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const hex of hexGrid) {
        drawHex(hex.x, hex.y);
    }
    drawTerrain();
    highlightActiveUnit();
    drawPlanFills();
    drawUnits();
    if (hoveredHex) drawHex(hoveredHex.x, hoveredHex.y, "#555", 2);
    drawPlanArrows();
    drawDistanceArrow();
}

startTurns();

function hexDistance(hex1, hex2) {
    return (Math.abs(hex1.q - hex2.q) + Math.abs(hex1.r - hex2.r) + Math.abs(hex1.q + hex1.r - (hex2.q + hex2.r))) / 2;
}

function pathDistanceAroundTerrain(from, to, blocked) {
    const key = (q, r) => `${q},${r}`;
    if (!from || !to || !hexKeys.has(key(to.q, to.r))) return Infinity;
    if (from.q === to.q && from.r === to.r) return 0;

    const directions = [
        { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
        { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 }
    ];

    const terrainMap = {};
    terrain.forEach(t => terrainMap[key(t.q, t.r)] = t.effects || []);
    if ((terrainMap[key(to.q, to.r)] || []).includes("blocking")) return Infinity;
    if (blocked && blocked.has(key(to.q, to.r))) return Infinity;

    function getCost(q, r) {
        const id = key(q, r);
        if (!hexKeys.has(id)) return Infinity;
        if (blocked && blocked.has(id)) return Infinity;
        const effects = terrainMap[id] || [];
        if (effects.includes("blocking")) return Infinity;
        if (effects.includes("elevated")) return 3;
        if (effects.includes("bad-footing")) return 2;
        return 1;
    }

    const frontier = [{ q: from.q, r: from.r, cost: 0 }];
    const visited = new Set();
    const costs = { [key(from.q, from.r)]: 0 };

    while (frontier.length > 0) {
        frontier.sort((a, b) => (a.cost + hexDistance(a, to)) - (b.cost + hexDistance(b, to)));
        const current = frontier.shift();
        const currKey = key(current.q, current.r);

        if (visited.has(currKey)) continue;
        visited.add(currKey);

        if (current.q === to.q && current.r === to.r) return costs[currKey];

        for (const d of directions) {
            const nq = current.q + d.q;
            const nr = current.r + d.r;
            const nextKey = key(nq, nr);
            if (visited.has(nextKey) || !hexKeys.has(nextKey)) continue;

            const stepCost = getCost(nq, nr);
            if (stepCost === Infinity) continue;

            const newCost = costs[currKey] + stepCost;
            if (!(nextKey in costs) || newCost < costs[nextKey]) {
                costs[nextKey] = newCost;
                frontier.push({ q: nq, r: nr, cost: newCost });
            }
        }
    }

    return Infinity; // No path found
}

canvas.addEventListener("click", (event) => {
    const { offsetX, offsetY } = event;
    let clickedHex = null;
    
    for (const hex of hexGrid) {
        const dx = hex.x - offsetX;
        const dy = hex.y - offsetY;
        if (Math.sqrt(dx * dx + dy * dy) < hexRadius) {
            clickedHex = hex;
            break;
        }
    }
    
    if (clickedHex) {
        trackClick(clickedHex, event);
		if(editMode) editHex(clickedHex);
		drawGrid(); // Redraw the grid to update highlights
		const contextMenu = document.getElementById("context-menu")
		if(contextMenu) contextMenu.style.display = "none";
    }
});

canvas.addEventListener("mousemove", (event) => {
	const { offsetX, offsetY } = event;
	let found = null;

	for (const hex of hexGrid) {
        const dx = hex.x - offsetX;
        const dy = hex.y - offsetY;
        if (Math.sqrt(dx * dx + dy * dy) < hexRadius) {
            found = hex;
            break;
        }
    }

	if (!found || (hoveredHex && found.q === hoveredHex.q && found.r === hoveredHex.r)) return;
	setHoverHex(found);
	drawGrid();
});

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const { offsetX, offsetY } = event;
    let clickedHex = null;
    
    for (const hex of hexGrid) {
        const dx = hex.x - offsetX;
        const dy = hex.y - offsetY;
        if (Math.sqrt(dx * dx + dy * dy) < hexRadius) {
            clickedHex = hex;
            break;
        }
    }
    
    if (clickedHex) {
        trackRightClick(clickedHex);
    }
});
