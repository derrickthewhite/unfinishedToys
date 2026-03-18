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

function drawHex(x, y, color = "black", width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const px = x + hexRadius * Math.cos(angle);
        const py = y + hexRadius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
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

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const hex of hexGrid) {
        drawHex(hex.x, hex.y);
    }
    drawTerrain();
    drawUnits();
    if (lastHex) drawHex(lastHex.x, lastHex.y, "blue", 2);
    if (secondLastHex) drawHex(secondLastHex.x, secondLastHex.y, "red", 2);
	if (hoveredHex) {
		drawHex(hoveredHex.x, hoveredHex.y, "green", 2);
		if(hoveredHexMessage){
			ctx.font = "30px ariel"
            ctx.fillText(hoveredHexMessage, hoveredHex.x, hoveredHex.y);
		}
	}
}

drawGrid();
setManueverOptions([],[],[],[],[]);

function hexDistance(hex1, hex2) {
    return (Math.abs(hex1.q - hex2.q) + Math.abs(hex1.r - hex2.r) + Math.abs(hex1.q + hex1.r - (hex2.q + hex2.r))) / 2;
}

function pathDistanceAroundTerrain(from, to) {
    const key = (q, r) => `${q},${r}`;
    const directions = [
        { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
        { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 }
    ];

    const terrainMap = {};
    terrain.forEach(t => terrainMap[key(t.q, t.r)] = t.effects || []);

    function getCost(q, r) {
        const effects = terrainMap[key(q, r)] || [];
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
            if (visited.has(nextKey)) continue;

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
        trackClick(clickedHex);
		if(editMode) editHex(clickedHex);
		drawGrid(); // Redraw the grid to update highlights
		const contextMenu = document.getElementById("context-menu")
		if(contextMenu) contextMenu.style.display = "none";
    }
});

canvas.addEventListener("mousemove", (event) => {
	const { offsetX, offsetY } = event;
	let hoveredHex = null;
	
	for (const hex of hexGrid) {
        const dx = hex.x - offsetX;
        const dy = hex.y - offsetY;
        if (Math.sqrt(dx * dx + dy * dy) < hexRadius) {
            hoveredHex = hex;
            break;
        }
    }
	
	if(hoveredHex) {
		setHoverHex(hoveredHex);
	}
	drawGrid(); // Redraw the grid to update highlights

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
