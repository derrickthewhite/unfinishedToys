let lastHex = null;
let secondLastHex = null;
let selectedUnit = null;
let activeUnit = null;
let hoveredHex = null;
let hoveredHexMessage = "";

function trackClick(clickedHex) {
    secondLastHex = lastHex;
    lastHex = clickedHex;
    
    if (secondLastHex) {
        const distance = hexDistance(secondLastHex, lastHex);
        displayMessage(`Distance: ${distance}`);
    }
    
    // Check if a unit is at the clicked hex
    const unit = units.find(u => u.q === clickedHex.q && u.r === clickedHex.r);
    if (unit) {
		selectedUnit = unit;
        displayUnit(unit);
    } else {
		selectedUnit = null;
        clearUnitDisplay();
    }
	
	if(!editMode && actionMode == "move") {
		
		
	}
}

function trackRightClick(clickedHex) {
    let menu = document.getElementById("context-menu");
    if (!menu) {
        const newMenu = document.createElement("div");
        newMenu.id = "context-menu";
        newMenu.style.position = "absolute";
        newMenu.style.background = "white";
        newMenu.style.border = "1px solid black";
        newMenu.style.padding = "5px";
        newMenu.style.boxShadow = "2px 2px 5px rgba(0,0,0,0.5)";
        document.body.appendChild(newMenu);
		menu = newMenu;
    }
    menu.innerHTML = "";
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.style.display = "block";
	
	if(editMode){
        const moveOption = document.createElement("div");
        moveOption.innerText = "Clear Hex";
        moveOption.onclick = () => {
            terrain = terrain.filter(t => t.r != clickedHex.r || t.q != clickedHex.q);
            units = units.filter(u => u.r != clickedHex.r || u.q != clickedHex.q);
            menu.style.display = "none";
			drawGrid();
        };
        menu.appendChild(moveOption);
	} else {
		if (selectedUnit && (isDistanceInRange(hexDistance(selectedUnit, clickedHex), "0-"+selectedUnit.currentMove))) {
			const moveOption = document.createElement("div");
			moveOption.innerText = "Move Unit";
			moveOption.onclick = () => {
				selectedUnit.q = clickedHex.q;
				selectedUnit.r = clickedHex.r;
				menu.style.display = "none";
				drawGrid();
			};
			menu.appendChild(moveOption);
		}
		const unitsInHex = units.filter(u => u.q === clickedHex.q && u.r === clickedHex.r);
		if(unitsInHex.length >= 1) {
			if(selectedUnit && selectedUnit.currentAttacks > 0)
				for(unit of unitsInHex){
					selectedUnit.attacks.forEach(attack => {
						if(selectedUnit == unit) return;
						if(!isDistanceInRange(hexDistance(selectedUnit, unit), attack.range)) return;
						const attackOption = document.createElement("div");
						attackOption.innerText = attack.name +" "+unit.name;
						attackOption.onclick = () => {
							console.log("attack!", attack, unit)
							menu.style.display = "none";
							drawGrid();
						};
						menu.appendChild(attackOption);
					})
				}
			for(unit of unitsInHex){
				const selectOpion = document.createElement("div");
				selectOpion.innerText = "Select "+unit.name;
				selectOpion.onclick = () => {
					selectedUnit = unit;
					displayUnit(unit);
					menu.style.display = "none";
					drawGrid();
				};
				menu.appendChild(selectOpion);
			}
			for(unit of unitsInHex){
				const selectOpion = document.createElement("div");
				selectOpion.innerText = "Activate "+unit.name;
				selectOpion.onclick = () => {
					selectedUnit = unit;
					activeUnit = unit;
					displayUnit(unit);
					menu.style.display = "none";
					drawGrid();
				};
				menu.appendChild(selectOpion);
			}

		}

	}
    
    
    const closeOption = document.createElement("div");
    closeOption.innerText = "Close";
    closeOption.onclick = () => menu.style.display = "none";
    menu.appendChild(closeOption);
}

function setHoverHex(hex) {
	hoveredHex = hex;
	if(selectedUnit && !editMode){
		//hoveredHexMessage = hexDistance(hoveredHex, selectedUnit) +" ";
		hoveredHexMessage = pathDistanceAroundTerrain(hoveredHex, selectedUnit) +" ";
	}
}


function isDistanceInRange(distance, range) {
	if(!range.includes) range = range+"";
    if (range.includes('-')) {
        // Handle "Y-Z" format
        const [min, max] = range.split('-').map(Number);
        return distance >= min && distance <= max;
    } else if (range.includes('/')) {
        // Handle "W/V" format
        const [, max] = range.split('/').map(Number);
        return distance < max;
    } else {
        // Handle "X" format
        return distance === Number(range);
    }
}
