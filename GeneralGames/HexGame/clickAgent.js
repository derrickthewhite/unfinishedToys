let lastHex = null;
let secondLastHex = null;
let selectedUnit = null;
let activeUnit = null;
let hoveredHex = null;
let hoveredHexMessage = "";
let turnIndex = 0;

function unitsInTurnOrder() {
	return units.slice().sort((a, b) => (b.speed || 0) - (a.speed || 0));
}

function showActiveUnitActions() {
	const img = document.getElementById("activeUnitImage");
	if (!activeUnit || !units.includes(activeUnit)) {
		if (img) img.style.backgroundImage = "";
		setManueverOptions([], [], [], [], []);
		return;
	}
	if (img && activeUnit.image) {
		img.style.backgroundImage = `url('${activeUnit.image.src}')`;
	}
	const nameEl = document.getElementById("activeUnitName");
	if (nameEl) nameEl.textContent = activeUnit.name;
	const menu = document.getElementById("maneuverDropdown");
	if (!menu || menu.options.length === 0 || menu.style.display === "none") {
		setManueverOptions(
			["do nothing", "attack", "move", "move and attack", "ready", "concentrate", "all-out-attack", "all-out-defense"],
			[],
			[],
			[],
			[]
		);
	}
}

function refreshUnitTurn(unit) {
	unit.currentMove = unit.maxMove || 0;
	unit.currentAttacks = unit.maxAttacks || 0;
}

function setCurrentUnit(unit) {
	activeUnit = unit;
	const order = unitsInTurnOrder();
	turnIndex = Math.max(0, order.indexOf(unit));
	const menu = document.getElementById("maneuverDropdown");
	if (menu) {
		menu.innerHTML = "";
		menu.style.display = "none";
	}
	showActiveUnitActions();
	clearPlan();
	if (typeof drawGrid === "function") drawGrid();
}

function startTurns() {
	const order = unitsInTurnOrder();
	if (!order.length) return;
	refreshUnitTurn(order[0]);
	setCurrentUnit(order[0]);
}

function advanceTurn() {
	const order = unitsInTurnOrder();
	if (!order.length) return;
	const currentIndex = order.indexOf(activeUnit);
	turnIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
	refreshUnitTurn(order[turnIndex]);
	setCurrentUnit(order[turnIndex]);
}

function trackClick(clickedHex, event) {
    secondLastHex = lastHex;
    lastHex = clickedHex;

    const unit = units.find(u => u.q === clickedHex.q && u.r === clickedHex.r);
    if (unit) {
		selectedUnit = unit;
        displayUnit(unit);
    } else {
		selectedUnit = null;
        clearUnitDisplay();
    }

	if (!editMode) markClickedHex(clickedHex, event);
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
					displayUnit(unit);
					menu.style.display = "none";
					setCurrentUnit(unit);
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
	if (selectedUnit && !editMode && (hex.q !== selectedUnit.q || hex.r !== selectedUnit.r)) {
		const dist = pathDistanceAroundTerrain(selectedUnit, hex);
		hoveredHexMessage = dist === Infinity ? "blocked" : String(dist);
	} else {
		hoveredHexMessage = "";
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

let moveHexes = [];
let attackHexes = [];
let pendingHex = null;

const HIT_LOCATIONS = [
	{ name: "Torso", mod: 0 },
	{ name: "Arm", mod: -2 },
	{ name: "Skull", mod: -7 }
];

function sameHex(a, b) {
	return !!(a && b && a.q === b.q && a.r === b.r);
}

function currentManeuver() {
	const menu = document.getElementById("maneuverDropdown");
	return menu && menu.style.display !== "none" ? menu.value : "do nothing";
}

function currentSubmaneuver() {
	const menu = document.getElementById("submaneuverDropdown");
	return menu && menu.style.display !== "none" ? menu.value : "";
}

function chosenWeapon() {
	const menu = document.getElementById("weaponDropdown");
	if (!menu || menu.style.display === "none" || !activeUnit) return null;
	if (!menu.value || menu.value === "placeholder weapon") return null;
	return activeUnit.attacks.find(attack => attack.name === menu.value) || null;
}

function allowsAttack() {
	return ["attack", "move and attack", "all-out-attack"].includes(currentManeuver());
}

function moveBudget() {
	if (!activeUnit) return 0;
	const move = activeUnit.currentMove || 0;
	const maneuver = currentManeuver();
	if (maneuver === "move" || maneuver === "move and attack") return move;
	if (maneuver === "all-out-attack") return Math.floor(move / 2);
	if (["attack", "ready", "concentrate", "all-out-defense"].includes(maneuver)) return Math.min(1, move);
	return 0;
}

function attackLimit() {
	if (!activeUnit || !allowsAttack()) return 0;
	if (currentManeuver() === "all-out-attack" && currentSubmaneuver() === "double") return 2;
	return activeUnit.currentAttacks || 0;
}

function occupiedByOther(hex) {
	return units.some(unit => unit !== activeUnit && sameHex(unit, hex));
}

function terrainBlocks(hex) {
	return terrain.some(item => sameHex(item, hex) && (item.effects || []).includes("blocking"));
}

function otherUnitKeys() {
	const blocked = new Set();
	units.forEach(unit => {
		if (unit !== activeUnit) blocked.add(`${unit.q},${unit.r}`);
	});
	return blocked;
}

function movePathCost(unit, hexes) {
	let cost = 0;
	let previous = unit;
	const blocked = otherUnitKeys();
	for (const hex of hexes) {
		const leg = pathDistanceAroundTerrain(previous, hex, blocked);
		if (leg === Infinity) return Infinity;
		cost += leg;
		previous = hex;
	}
	return cost;
}

function attackOrigin() {
	if (moveHexes.length) return moveHexes[moveHexes.length - 1];
	return activeUnit;
}

function weaponsReaching(origin, hex) {
	if (!activeUnit || !origin || typeof hexDistance !== "function") return [];
	const distance = hexDistance(origin, hex);
	const chosen = chosenWeapon();
	const attacks = chosen ? [chosen] : activeUnit.attacks;
	return attacks.filter(attack => isDistanceInRange(distance, attack.range));
}

function canMarkMove(hex) {
	if (!activeUnit || !(activeUnit.currentMove > 0)) return false;
	if (sameHex(hex, activeUnit) || occupiedByOther(hex) || terrainBlocks(hex)) return false;
	const soFar = movePathCost(activeUnit, moveHexes);
	const from = moveHexes.length ? moveHexes[moveHexes.length - 1] : activeUnit;
	const leg = pathDistanceAroundTerrain(from, hex, otherUnitKeys());
	return leg !== Infinity && soFar + leg <= activeUnit.currentMove;
}

function canMarkTarget(hex) {
	if (!activeUnit) return false;
	if (sameHex(hex, activeUnit) && !moveHexes.length) return false;
	return weaponsReaching(attackOrigin(), hex).length > 0;
}

function markClickedHex(hex, event) {
	if (!activeUnit) return;
	const moveIndex = moveHexes.findIndex(item => sameHex(item, hex));
	if (moveIndex >= 0) {
		moveHexes.splice(moveIndex, 1);
		closeHexChoice();
		refreshPlan();
		return;
	}
	const attackIndex = attackHexes.findIndex(item => sameHex(item, hex));
	if (attackIndex >= 0) {
		attackHexes.splice(attackIndex, 1);
		closeHexChoice();
		refreshPlan();
		return;
	}
	if (sameHex(hex, activeUnit)) return;

	const asMove = canMarkMove(hex);
	const asTarget = canMarkTarget(hex);
	if (asMove && asTarget) {
		openHexChoice(hex, event ? event.clientX : 0, event ? event.clientY : 0);
		return;
	}
	if (asMove) moveHexes.push({ q: hex.q, r: hex.r });
	else if (asTarget) attackHexes.push({ q: hex.q, r: hex.r, locations: {} });
	closeHexChoice();
	refreshPlan();
}

function openHexChoice(hex, x, y) {
	pendingHex = { q: hex.q, r: hex.r };
	const pop = document.getElementById("hexChoice");
	if (!pop) return;
	pop.style.left = Math.max(8, Math.min(x, window.innerWidth - 140)) + "px";
	pop.style.top = Math.max(8, Math.min(y, window.innerHeight - 110)) + "px";
	pop.hidden = false;
}

function closeHexChoice() {
	pendingHex = null;
	const pop = document.getElementById("hexChoice");
	if (pop) pop.hidden = true;
}

function chooseHexMark(kind) {
	if (!pendingHex) return;
	const hex = pendingHex;
	if (kind === "move" && canMarkMove(hex)) moveHexes.push({ q: hex.q, r: hex.r });
	if (kind === "target" && canMarkTarget(hex)) attackHexes.push({ q: hex.q, r: hex.r, locations: {} });
	closeHexChoice();
	refreshPlan();
	if (typeof drawGrid === "function") drawGrid();
}

function clearPlan() {
	moveHexes = [];
	attackHexes = [];
	closeHexChoice();
	refreshPlan();
}

function refreshPlan() {
	renderHitLocations();
	updateTakeActionButton();
}

function renderHitLocations() {
	const list = document.getElementById("hitLocationList");
	if (!list) return;
	if (!attackHexes.length) {
		list.hidden = true;
		list.innerHTML = "";
		return;
	}
	list.hidden = false;
	list.innerHTML = attackHexes.map((hex, index) => {
		const present = units.filter(unit => unit !== activeUnit && sameHex(unit, hex));
		if (!present.length) {
			return `<div class="hitGroup"><strong>Hex ${hex.q},${hex.r}</strong><div>No unit</div></div>`;
		}
		return present.map(unit => {
			const chosen = (hex.locations && hex.locations[unit.name]) || "Torso";
			const buttons = HIT_LOCATIONS.map(location =>
				`<button type="button" class="hitLoc${location.name === chosen ? " chosen" : ""}" data-hex="${index}" data-unit="${unit.name}" data-loc="${location.name}">${location.name} (${location.mod})</button>`
			).join("");
			return `<div class="hitGroup"><strong>${unit.name}</strong>${buttons}</div>`;
		}).join("");
	}).join("");
	list.querySelectorAll(".hitLoc").forEach(button => {
		button.addEventListener("click", () => {
			const hex = attackHexes[Number(button.dataset.hex)];
			if (!hex.locations) hex.locations = {};
			hex.locations[button.dataset.unit] = button.dataset.loc;
			renderHitLocations();
		});
	});
}

function planIsValid() {
	if (!activeUnit || editMode) return false;
	const maneuver = currentManeuver();
	const cost = movePathCost(activeUnit, moveHexes);
	if (cost === Infinity || cost > moveBudget()) return false;
	if (attackHexes.length > attackLimit()) return false;
	const origin = attackOrigin();
	if (attackHexes.some(hex => weaponsReaching(origin, hex).length === 0)) return false;
	if (moveHexes.some(hex => occupiedByOther(hex) || terrainBlocks(hex))) return false;

	if (maneuver === "do nothing") return moveHexes.length === 0 && attackHexes.length === 0;
	if (maneuver === "move") return moveHexes.length > 0 && attackHexes.length === 0;
	if (maneuver === "attack") return attackHexes.length > 0;
	if (maneuver === "move and attack") return moveHexes.length > 0 && attackHexes.length > 0;
	if (maneuver === "all-out-attack") return attackHexes.length > 0;
	if (maneuver === "all-out-defense" || maneuver === "ready" || maneuver === "concentrate") return attackHexes.length === 0;
	return false;
}

function updateTakeActionButton() {
	const button = document.getElementById("takeAction");
	if (!button) return;
	button.disabled = !planIsValid();
}

function rollDie() {
	return Math.floor(Math.random() * 6) + 1;
}

function rollDamage(notation) {
	const match = /^(\d+)d6([+-]\d+)?$/.exec(notation || "");
	if (!match) return 0;
	let total = Number(match[2] || 0);
	for (let i = 0; i < Number(match[1]); i++) total += rollDie();
	return Math.max(0, total);
}

function takeAction() {
	if (!planIsValid()) return;
	const notes = [];
	const maneuver = currentManeuver();
	const cost = movePathCost(activeUnit, moveHexes);
	if (moveHexes.length) {
		const destination = moveHexes[moveHexes.length - 1];
		activeUnit.q = destination.q;
		activeUnit.r = destination.r;
		activeUnit.currentMove = Math.max(0, activeUnit.currentMove - cost);
		notes.push(`Moved ${cost}`);
	}
	attackHexes.forEach(target => {
		const weapon = weaponsReaching(activeUnit, target)[0];
		const present = units.filter(unit => unit !== activeUnit && sameHex(unit, target));
		if (!weapon) return;
		if (!present.length) {
			notes.push(`${weapon.name} at empty hex`);
			return;
		}
		present.forEach(foe => {
			const locName = (target.locations && target.locations[foe.name]) || "Torso";
			const location = HIT_LOCATIONS.find(item => item.name === locName) || HIT_LOCATIONS[0];
			const roll = rollDie() + rollDie() + rollDie();
			const skill = weapon.skill + location.mod;
			if (roll <= skill) {
				const damage = rollDamage(weapon.damage);
				foe.currentHP -= damage;
				notes.push(`${weapon.name} hit ${foe.name} ${location.name} for ${damage}`);
			} else {
				notes.push(`${weapon.name} missed ${foe.name} (${roll} vs ${skill})`);
			}
		});
	});
	if (attackHexes.length) activeUnit.currentAttacks = Math.max(0, activeUnit.currentAttacks - attackHexes.length);
	if (!notes.length) notes.push(maneuver);
	displayMessage(notes.join(". "));
	const shown = selectedUnit;
	clearPlan();
	if (shown && units.includes(shown)) displayUnit(shown);
	if (typeof drawGrid === "function") drawGrid();
}
