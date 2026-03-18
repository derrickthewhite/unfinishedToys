let messageHistory = [];
let editMode = false; // false, "terrain", "unit"
let selectedTerrain = null;
let unitToAdd = null;

let actionMode = "select" // select, move, target, manuever

document.getElementById("editObstacles").addEventListener("click", () => {
	editMode = "terrain";
	const terrainDisplay = document.getElementById("terrainAddDisplay");
	terrainDisplay.style.display = editMode ? "flex" : "none";
	
	terrainDisplay.innerHTML = Object.keys(terrainData).map(terrainKey => `
		<div class="attackTile terrainTile" data-terrain="${terrainKey}" style="background-image: url('${terrainData[terrainKey].image}')">
			<div>${terrainKey}</div>
		</div>
	`).join("");
	
	document.querySelectorAll(".terrainTile").forEach(tile => {
		tile.addEventListener("click", (event) => {
			selectedTerrain = event.currentTarget.getAttribute("data-terrain");
			displayMessage(`Selected Terrain: ${selectedTerrain}`);
		});
	});
	const unitDisplay = document.getElementById("unitAddDisplay");
	unitDisplay.style.display = "none";

});

document.getElementById("editUnits").addEventListener("click", () => {
	editMode = "unit";
	const unitDisplay = document.getElementById("unitAddDisplay");
	unitDisplay.style.display = editMode ? "flex" : "none";
	
	unitDisplay.innerHTML = Object.keys(unitData).map(unitKey => `
		<div class="attackTile terrainTile" data-unit="${unitKey}" style="background-image: url('${unitData[unitKey].image}')">
			<div>${unitKey}</div>
		</div>
	`).join("");
	
	document.querySelectorAll(".terrainTile").forEach(tile => {
		tile.addEventListener("click", (event) => {
			unitToAdd = event.currentTarget.getAttribute("data-unit");
			displayMessage(`Selected Unit: ${unitToAdd}`);
		});
	});
	const terrainDisplay = document.getElementById("terrainAddDisplay");
	terrainDisplay.style.display = "none";

});

document.getElementById("noEdit").addEventListener("click", () => {
	editMode = false;
	const terrainDisplay = document.getElementById("terrainAddDisplay");
	terrainDisplay.style.display = "none";
	const unitDisplay = document.getElementById("unitAddDisplay");
	unitDisplay.style.display = "none";

	document.getElementById("editObstacles").style.display = "none";
	document.getElementById("editUnits").style.display = "none";
	document.getElementById("noEdit").style.display = "none";
	document.getElementById("takeTurn").style.display = "block";
	document.getElementById("edit").style.display = "block";

});

document.getElementById("takeTurn").addEventListener("click", () => {
	console.log("next unit!");
});

document.getElementById("edit").addEventListener("click", () => {
	document.getElementById("editObstacles").style.display = "block";
	document.getElementById("editUnits").style.display = "block";
	document.getElementById("noEdit").style.display = "block";
	document.getElementById("takeTurn").style.display = "none";
	document.getElementById("edit").style.display = "none";
});

function displayMessage(message) {
	messageHistory.push(message);
	const toast = document.getElementById("toast");
	toast.textContent = message;
	toast.style.display = "block";
	setTimeout(clearMessage, 10000);
}

function clearMessage() {
	document.getElementById("toast").style.display = "none";
}

function displayUnit(unit) {
	const unitDisplay = document.getElementById("unitDisplay");
	const unitName = document.getElementById("unitName");
	const unitImage = document.getElementById("unitImage");
	const unitStats = document.getElementById("unitStats");
	const attackDisplay = document.getElementById("attackDisplay");
	const defenseDisplay = document.getElementById("defenseDisplay");

	unitName.textContent = unit.name;
	unitImage.style.backgroundImage = `url('${unit.image.src}')`;
	
	unitStats.innerHTML = Object.entries(unit)
		.filter(([key]) => key !== "name" && key !== "attacks" && key !== "defenses" && key !== "image" && !['q','r'].includes(key))
		.map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
		.join("");
	unitDisplay.style.display = "block";

	attackDisplay.innerHTML = unit.attacks.map((attack, index) => `
		<div class="attackTile" style="background-image: url('${attack.image}')" id="attack${index}">
			<div>${attack.name}</div>
			<div>${attack.skill}</div>
			<div>${attack.damage}</div>
			<div>${attack.range}</div>
		</div>
	`).join("");
	
	unit.attacks.forEach((attack, index)=>{
		document.getElementById("attack"+index).addEventListener("click", () => {
			console.log("attack ", attack);
		})
	})

	defenseDisplay.innerHTML = unit.defenses.map(defense => `
		<div>${defense.name} (${defense.skill}, ${defense.penalty}, ${defense.defendRanged ? 'Ranged' : 'Melee'})</div>
	`).join("");
	defenseDisplay.style.display = "block";
	
	if(unit == activeUnit) {
		
		document.getElementById("activeUnitImage").style.backgroundImage = `url('${unit.image.src}')`;;
		setManueverOptions(["do nothing","attack","move","move and attack","ready", "concentrate","ready", "all-out-attack", "all-out-defense"]);
	}
}

document.getElementById("maneuverDropdown").addEventListener("change", event => {
    const sub = document.getElementById("submaneuverDropdown");
    const value = event.target.value;
    sub.innerHTML = `<option value="">Submaneuver</option>`; // reset

    if (value === "all-out-attack") {
		setManueverOptions(
			undefined,
			["determined", "double", "strong"],
			["none","flurry of blows", "mighty blows", "heroic charge"], 
			getUnitWeapons(), 
			["none", "ground", "darkness"]
		);
    } else if (value === "all-out-defense") {
		setManueverOptions(
			undefined,
			["dodge", "parry", "block", "double"],
			[], 
			[], 
			[]
		);
    } else if (["move and attack", "attack"].includes(value)){
		setManueverOptions(
			undefined,
			[],
			["none","flurry of blows", "mighty blows", "heroic charge"], 
			getUnitWeapons(), 
			["none", "ground", "darkness"]
		);
	}else if ( ["move", "do nothing"].includes(value)){
		setManueverOptions(
			undefined,
			[],
			[], 
			[], 
			[]
		);
	} else if ( ["ready", "concentrate"].includes(value)){
		setManueverOptions(
			undefined,
			[],
			[], 
			["placeholder weapon"], 
			[]
		);
	} else {
		console.log("manuever not recognized!", value);
	}
});

function clearUnitDisplay() {
	document.getElementById("unitDisplay").style.display = "none";
	document.getElementById("attackDisplay").innerHTML = "";
	document.getElementById("defenseDisplay").style.display = "none";
	//setManueverOptions([],[],[],[],[]); // todo: sperate "selected" unit from current unit?
}

function setManueverOptions(m,sm, ee, weapon, target) {
	setOptions("maneuverDropdown", m);
	setOptions("submaneuverDropdown", sm);
	setOptions("extraEffortDropdown", ee);
	setOptions("weaponDropdown", weapon);
	setOptions("targetDropdown", target);
}

function setOptions (selectInput, options) {
	let selectDom =document.getElementById(selectInput);
	if(!selectDom) return;
	if (options == undefined) return;
	if(options.length > 0){
		selectDom.innerHTML = "";
		options.forEach(opt => {
			const option = document.createElement("option");
			option.value = opt;
			option.textContent = opt;
			selectDom.appendChild(option);
		});
		selectDom.style.display = "block"
	} else {
		selectDom.style.display = "none"
	}
}

function getUnitWeapons() {
	
	return activeUnit.attacks.map(a=>a.name)
}
