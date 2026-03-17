  const mapCanvas = document.getElementById("map-canvas");
  const ctx = mapCanvas.getContext("2d");
  const hoverInfo = document.getElementById("hover-info");
  const arrangeNodesButton = document.getElementById("arrangeNodesButton");
  const showEntireMazeButton = document.getElementById("showEntireMaze");
  const analyzeMazeButton = document.getElementById("AnalyzeMaze");
  const nodePositions = {};
  const nodeSize = 35;
  let dragNode = null;
  let offsetX, offsetY;
  let shakeMap = false;

  function drawMap() {
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
	
	seen.forEach(name => {

		if (!nodePositions[name]) {
		  const radius = 100;
		  const angle = Math.random() * 2 * Math.PI;
		  nodePositions[name] = {
			//x: mapCanvas.width / 2 + radius * Math.cos(angle),
			x: Math.random() * mapCanvas.width,
			//x: nodePositions[currentLocation].x + radius * Math.cos(angle),
			//y: nodePositions[currentLocation].y + radius * Math.sin(angle)
			//y: mapCanvas.height / 2 + radius * Math.sin(angle)
			y: Math.random() * mapCanvas.height
		  };
		}
		});


    // Draw directional arrows (edges)
    visited.forEach(from => {
      maze[from].forEach(to => {
        if (seen.has(to)) {
          const fromPos = nodePositions[from];
          const toPos = nodePositions[to];
		  const color = (blockedPortals[from] && blockedPortals[from][to])?"#f00": "#333";
          if (fromPos && toPos) {
            drawArrow(fromPos.x, fromPos.y, toPos.x, toPos.y, color);
          }
        }
      });
    });

	// Draw nodes
	seen.forEach(name => {
	  const pos = nodePositions[name];

	  if (pos) {
		ctx.strokeStyle = "#333";
		ctx.beginPath();
		ctx.arc(pos.x, pos.y, nodeSize, 0, 2 * Math.PI);
		ctx.fillStyle = name === currentLocation ? "orange" : visited.has(name) ? "lightblue" : "#CBC3E3";
		ctx.fill();
		ctx.stroke();

		// Room Emoji
		ctx.font = "20px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(emojiMap[name] || "🔮", pos.x, pos.y - 10);

		// Room Name
		ctx.fillStyle = "black";
		ctx.font = "12px sans-serif";
		ctx.fillText(name, pos.x, pos.y + 5);

		// Item Emojis
		const items = roomItems[name] || [];
		if (items.length > 0 && visited.has(name)) {
		  const itemEmojis = items.filter((item) => !getParty().includes(item)).map(item => emojiMap[item] || "❓").join(" ");
		  ctx.font = "14px sans-serif";
		  ctx.fillText(itemEmojis, pos.x, pos.y + 20);
		}
	  }
	});
  }

  function drawArrow(x1, y1, x2, y2, color) {
    const headlen = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const x3 = x2 - Math.cos(angle) * nodeSize;
    const y3 = y2 - Math.sin(angle) * nodeSize;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x3, y3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x3, y3);
    ctx.lineTo(x3 - headlen * Math.cos(angle - Math.PI / 6), y3 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x3 - headlen * Math.cos(angle + Math.PI / 6), y3 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function initMap() {
    let radius = 200;
    let angle = 0;
    seen.forEach((name, i) => {
      const x = mapCanvas.width / 2 + radius * Math.cos(angle);
      const y = mapCanvas.height / 2 + radius * Math.sin(angle);
      nodePositions[name] = { x, y };
      angle += (2 * Math.PI) / seen.size;
    });
    drawMap();
  }

  mapCanvas.addEventListener("mousedown", e => {
    const rect = mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const name in nodePositions) {
      const pos = nodePositions[name];
      if ((x - pos.x) ** 2 + (y - pos.y) ** 2 < nodeSize ** 2) {
        dragNode = name;
        offsetX = x - pos.x;
        offsetY = y - pos.y;
        return;
      }
    }
  });
  
mapCanvas.addEventListener("mousemove", (e) => {
  const rect = mapCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (dragNode) {
    nodePositions[dragNode].x = mx - offsetX;
    nodePositions[dragNode].y = my - offsetY;
    drawMap();
    return;
  }

  // Hover detection for node item info
  let hovering = false;
  for (const name in nodePositions) {
    const { x, y } = nodePositions[name];
    if (Math.hypot(x - mx, y - my) < nodeSize) {
      const items = (roomItems[name] || []).join(", ");
      hoverInfo.textContent = `${name}: ${visited.has(name)? items || "No items": "Unvisited"}`;
      hovering = true;
      break;
    }
  }
  if (!hovering) hoverInfo.textContent = "";
});


  mapCanvas.addEventListener("mouseup", () => dragNode = null);
  mapCanvas.addEventListener("mouseleave", () => dragNode = null);
  
  // Double click to travel if legal
mapCanvas.addEventListener("dblclick", (e) => {
  const rect = mapCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const name in nodePositions) {
    const { x, y } = nodePositions[name];
    if (Math.hypot(x - mx, y - my) < nodeSize) {
      if (maze[currentLocation]?.includes(name)) {
        let blocker = blockedPortals[currentLocation] && blockedPortals[currentLocation][name]? blockedPortals[currentLocation][name] : undefined;
        if(blocker){
          unblocker = portalUnblockers[blocker+'-'+currentLocation]
        }
        if(!blocker || inventory.includes[unblocker] || roomItems[currentLocation].includes(unblocker)){

          movefromTo(currentLocation, name);
        }
      }
      break;
    }
  }
});

arrangeNodesButton.addEventListener("click", () => {
	shakeMap = !shakeMap;
	if(shakeMap) arrangeNodesButton.textContent = "Stop Drift";
	else arrangeNodesButton.textContent = "Shake Nodes"
	layoutMap();
});

	function layoutMap() {
	  drawMap();
	  //const repulsion = 100000;
	  const repulsion = 1000;
	  const attraction = 0.0005;
	  const damping = 0.99;
		const nodeRadius = 100;

	  const velocities = {};
	  const mapNodes = nodePositions;

	  for (const name in mapNodes) {
		velocities[name] = { x: 0, y: 0 };
	  }

	//for(var steps = 0; steps < 100; steps++){
		// Apply repulsion
		for (const a in mapNodes) {
		  for (const b in mapNodes) {
			if (a === b) continue;
			const dx = mapNodes[a].x - mapNodes[b].x;
			const dy = mapNodes[a].y - mapNodes[b].y;
			let distSq = dx * dx + dy * dy + 0.1;
			//const force = repulsion / distSq;
			const force = distSq < 10000? repulsion / distSq: 0;
			const angle = Math.atan2(dy, dx);
			velocities[a].x += Math.cos(angle) * force;
			velocities[a].y += Math.sin(angle) * force;
		  }
		}

		// Apply attraction
		for (const from in maze) {
		  if (!visited.has(from)) continue;
		  for (const to of maze[from]) {
			if (!visited.has(to)) continue;
			const dx = mapNodes[to].x - mapNodes[from].x;
			const dy = mapNodes[to].y - mapNodes[from].y;
			velocities[from].x += dx*dx * attraction;
			velocities[from].y += dy*dy * attraction;
			velocities[to].x -= dx*dx * attraction;
			velocities[to].y -= dy*dy * attraction;
		  }
		}

		// Apply movement
		for (const name in mapNodes) {
		  mapNodes[name].x += velocities[name].x * damping;
		  mapNodes[name].y += velocities[name].y * damping;

		  // Keep inside canvas
		  mapNodes[name].x = Math.max(nodeRadius, Math.min(mapCanvas.width - nodeRadius, mapNodes[name].x));
		  mapNodes[name].y = Math.max(nodeRadius, Math.min(mapCanvas.height - nodeRadius, mapNodes[name].y));

		  velocities[name].x *= 0.5;
		  velocities[name].y *= 0.5;
		}
	//}
	  drawMap();
	  if(shakeMap) setTimeout(layoutMap, 100)

	}

  const originalShowLocation = showLocation;
  showLocation = function(location, add) {
    originalShowLocation(location, add);
	//layoutMap(); //for now do nothing
    drawMap();
  };
  
  function showEntireMaze() {
	locationNames.forEach(location => {visited.add(location); seen.add(location);});
	
	showLocation(currentLocation);
	
  }
  
  showEntireMazeButton.addEventListener("click", showEntireMaze);
  analyzeMazeButton.addEventListener("click", () => {
		let distances = analyzeDistances(currentLocation);
		let blockedEntrances = Object.keys(blockedPortals).map(to => blockedPortals[to]).map(portals => Object.keys(portals)).flat().reduce((counts, element) => {counts[element] = (counts[element] || 0) + 1; return counts;},{});
		let entrances = Object.keys(maze).map(to => maze[to]).flat().reduce((counts, element) => {counts[element] = (counts[element] || 0) + 1; return counts;},{});
		
		let result = Object.keys(distances).map(key => ({room: key, distance: distances[key], entrances: entrances[key], blockedEntrances: (blockedEntrances[key]?blockedEntrances[key]: 0), unblockedEntrances: entrances[key] - (blockedEntrances[key]? blockedEntrances[key]: 0)}))
		console.log(result);
  });
