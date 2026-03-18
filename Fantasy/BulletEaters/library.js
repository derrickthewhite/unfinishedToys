function createWeapon(name, types, damage, damageTypes, handling, effects, costs, svg) {
	return {
		//TODO: do we need an id as well as a name?
		featureType: "Gear",
		types: ["weapon"], //TODO: why is this an array?
		name: ko.observable(name),
		weaponTypes: types, // ranged or melee
		damageTypes: damageTypes,
		damage: ko.observable(damage), //TODO: make this variable?
		handling: handling,
		effects: ko.observableArray(effects?effects:[]),
		costs: costs,
		svg: svg? svg: "assets/blank.svg"
	}
}
function copyWeapon(weapon){
	return createWeapon(weapon.name(), weapon.weaponTypes, weapon.damage(), weapon.damageTypes, weapon.handling, weapon.effects(), weapon.costs, weapon.svg);
}
function weaponCost(name, value) {
	return {
		name: name,
		value: value
	}
}
function createAttributeEffect (name, attributes, weaponEffect, svg) {
	var effect = createBaseTrait(name, "weaponEffect");
	effect.attributes = attributes;
	effect.effect = weaponEffect;
	return effect;
}
function createStatusCheck (name, timing, func){
	return {
		name: name,
		timing: timing,
		func: func
	}
}
function createBuffStatus (name, effects, removal, svg) {
	return {
		name: name,
		effects: effects,
		removal: removal,
		svg: svg? svg: "assets/blank.svg"
	}
}
function gearStack(seed) {
	var stack = {
		featureType: "GearStack",
		types: seed.types,
		itemName: seed.name(),
		items: ko.observableArray([])
	};
	stack.name = ko.pureComputed(() => "stack of "+stack.items().length + " " + stack.itemName);
	if(seed.weaponTypes){
		stack.weaponTypes = seed.weaponTypes;
		stack.damage = seed.damage;
	}
	stack.name = ko.pureComputed(() => {
		return "stack of " +stack.items().length+ " "+seed.name();
	})
	return stack;
}
function createActivity(name, perform) {
	var activity = {
		name: ko.observable(name),
		perform: perform // this is a function
	}
	return activity;
}
function createSupply(supplyArray) {
	var s = {
		supply: ko.observableArray(supplyArray)
	}
	s.setSupply = function (name, amount) {
		var supply = s.supply().find(c=>c.name == name);
		supply.amount(amount)
	}
	s.addSupply = function (name, amount) {
		var supply = s.supply().find(c=>c.name == name);
		supply.amount(supply.amount() + amount)
	}
	s.getSupply = function (name) {
		return s.supply().find(c=>c.name == name).amount();
	}
	s.getSupplies = function (){
		return s.supply();
	}
	s.transferSupply = function (name, amount, dest){
		if(dest){
			var transferAmount = Math.min(s.getSupply(name), amount);
			dest.addSupply(name, transferAmount);
			s.addSupply(name, -transferAmount);
		}
	}
	return s;
}
function createTerrainTrait (name, target, effect){
	var trait = createBaseTrait(name, "terrain");
	trait.target = target;
	trait.effect = effect;
	return trait;
}
function createExplorationMap() {
	//TODO: date stamped exploration maps
	//TODO: update maps when re-entering a tile
	var explorationMap = {
		tiles: []
	}
	explorationMap.features = function (tileId) {
		if(tileId.id) tileId = tileId.id;
		if(explorationMap.tiles[tileId])
			return [...explorationMap.tiles[tileId]];
		return [];
	}
	explorationMap.add = function (tileId, feature){
		if(tileId.id) tileId = tileId.id;
		if(!explorationMap.tiles[tileId]) {
			explorationMap.tiles[tileId]=[];
			explorationMap.tiles[tileId].exploration = "none";
		}
		explorationMap.tiles[tileId].push(feature);
	}
	explorationMap.remove = function (tileId, feature) {
		if(tileId.id) tileId = tileId.id;
		explorationMap.tiles[tileId] = explorationMap.tiles[tileId].filter(item => item != feature)
	}
	explorationMap.getStatus = function(tileId) {
		if(tileId.id) tileId = tileId.id;
		if(! explorationMap.tiles[tileId]) return "none";
		return explorationMap.tiles[tileId].exploration;
	}
	explorationMap.setStatus = function(tileId, exploration){
		if(tileId.id) tileId = tileId.id;
		if(!explorationMap.tiles[tileId]) {
			explorationMap.tiles[tileId]=[];
			explorationMap.tiles[tileId].exploration = "none";
		}
		explorationMap.tiles[tileId].exploration = exploration;
	}
	explorationMap.statusNumber = function (status) {
		return status== "explored"? 2:
			status == "seen"? 1: 0
	}
	explorationMap.share = function (b) {
		var a = explorationMap;
		var keys = Object.keys(a.tiles)
		var added = false;
		for(var key of keys){
			a.tiles[key].forEach( f => {
				if(!b.features(key).includes(f)){
					b.add(key,f);
					added = added || true;
				}
			});
			if(explorationMap.statusNumber(b.getStatus(key))< explorationMap.statusNumber(a.getStatus(key))){
				b.setStatus(key, a.getStatus(key))
			}
		}
		return added;
	}
	return explorationMap
}
function createTeam(name,supply, faction, initialPosture, svg){
	var team = {
		featureType: "Team",
		name: ko.observable(name),
		units: ko.observableArray([]),
		loot: ko.observableArray([]),
		supply: supply.getSupply? supply: createSupply(supply),
		tile: ko.observable(),
		faction: ko.observable(faction),
		posture: ko.observable(initialPosture), // Patrol, Stalk, Hide
		explorationMap: ko.observable(createExplorationMap()),
		svg: ko.observable(svg?svg: "assets/blank.svg")
	}
	team.setSupply = function (name, amount) {
		team.supply.setSupply(name, amount)
	}
	team.addSupply = function (name, amount) {
		team.supply.addSupply(name, amount)
	}
	team.getSupply = function (name) {
		return team.supply.getSupply(name)
	}
	team.contents = function (){
		return team.units().concat(team.loot())
	}
	team.stealth = ko.pureComputed(() => {
		if(team.units().length == 0) return Number.POSITIVE_INFINITY;
		return team.stealthComponents().reduce((sofar, a) => sofar+a.value, 0);
	});
	team.stealthComponents = ko.pureComputed(() => {
		if(team.units().length == 0) return [];
		var lowestScore = team.units().reduce((soFar,a) => Math.min(soFar, a.stealth()),Number.POSITIVE_INFINITY);
		var lowestMemember = team.units().find(u => u.stealth() == lowestScore);
		return [
			{name: "numeric penalty", value: -Math.log(team.units().length)/Math.log(2)},
			{name: lowestMemember.name(), value: lowestScore}
		];
	});
	team.per = ko.pureComputed(() => {
		if(team.units().length == 0) return Number.NEGATIVE_INFINITY;
		return team.perComponents().reduce((sofar, a) => sofar+a.value, 0);
	});
	team.perComponents = ko.pureComputed(() => {
		if(team.units().length == 0) return [];
		var highestScore = team.units().reduce((soFar,a) => Math.max(soFar, a.per()),Number.NEGATIVE_INFINITY);
		var highestMemeber = team.units().find(u => u.per() == highestScore);
		return [
			{name: "numeric bonus", value: Math.log(team.units().length)/Math.log(2)},
			{name: highestMemeber.name(), value: highestScore}
		];
	});
	return team;
}
function createCorpse(base) {
	return {
		featureType: "Gear",
		types: ["corpse"],
		original: base,
		name: ko.observable(base.name() +" corpse"),
		handling: []
	}
}
function createPassage(type, name, destination, svg) {
	var passage = {
		featureType: "Passage",
		name: ko.observable(name),
		type: type,
		destination: destination,
		pair: undefined,
		svg: ko.observable(svg? svg: "assets/blank.svg")
	}
	return passage;
}
function createPassages(type, names, destinations, svg) {
	var passage0 = createPassage(type, names[0], destinations[1], svg);
	var passage1 = createPassage(type, names[1], destinations[0], svg);
	passage0.pair = passage1;
	passage1.pair = passage0;
	destinations[0].contents.push(passage0);
	destinations[1].contents.push(passage1);
}
function createStructure(name, faction, svg) {
	//TODO: standardize (maybe with team?)
	//TODO: consumables by faction? or maybe presets
	//TODO: reference globals for supply... maybe in config
	var consumables = ["food" , "ammo", "gold", "moves", "magic"];
	var structure =  {
		featureType: "Structure",
		type: ko.observable(name),
		name: ko.observable(name),
		contents: ko.observableArray([]),
		svg: ko.observable(svg? svg: "assets/blank.svg"),
		supply: createSupply(consumables.map(c=>createConsumable(c, 0))),
		faction: ko.observable(faction),
	};
	structure.units = ko.pureComputed(() => {
		return structure.contents().filter(item => item.featureType == "Unit");
	});
	
	structure.setSupply = function (name, amount) {
		structure.supply.setSupply(name, amount)
	}
	structure.addSupply = function (name, amount) {
		structure.supply.addSupply(name, amount)
	}
	structure.getSupply = function (name) {
		return structure.supply.getSupply(name)
	}
	return structure;
}
function copyStructure(structure){
	return createStructure(structure.name(), structure.faction(), structure.svg())
}
function createBattlesite(name) {
	//TODO: standardize
	var consumables = ["food" , "ammo", "gold", "moves", "magic"];
	return {
		name: ko.observable(name),
		featureType: "Battlesite",
		contents: ko.observableArray([]),
		supply: createSupply(consumables.map(c=>createConsumable(c, 0))),
		svg: ko.observable("assets/battle.svg")
	};
}
function createTerrain(name, effects, svg) {
	return {
		featureType: "Terrain",
		type: ko.observable(name),
		name: ko.observable(name),
		effects: ko.observableArray(effects),
		svg :ko.observable(svg?svg:"assets/blank.svg")
	}
}
function getConsumableIcon(name) {
	if(name == "food") return "assets/food.svg";
	if(name == "moves") return "assets/transfer.svg";
	if(name == "ammo") return "assets/ammo.svg";
	if(name == "gold") return "assets/gold.svg";
	if(name == "magic") return "assets/magic.svg";
	return "assets/blank.svg";
}
function createConsumable(name, amount){
	return {
		featureType: "Consumable",
		name: name,
		amount: ko.observable(amount),
		svg: ko.observable(getConsumableIcon(name))
	}
}
function copyConsumable(consumable) {
	return createConsumable(consumable.name,0);
}
function buildLibrary() {
	var library = {};
	library.names = {
		human: []
	}
	library.effects = {
		divide5: createMathEffect("/5", 20, (d) => Math.ceil(d/5)),
		reduceTo1: createMathEffect("reduceTo1", 100, (d) => 1),
		eightyPercent: createMathEffect("80%", 20, (d) => d*0.8),
		plus25Percent: createMathEffect("+20%", 20, (d) => d*1.25),
		addLog4: createMathEffect("addLog4", 15, (d) => Math.log(Math.pow(1.5,d) +Math.pow(1.5,4))/Math.log(1.5)),
		minus5: createMathEffect("-5", 10, (d) => d-5),
		minus2: createMathEffect("-2", 10, (d) => d-2)
	};
	library.statusChecks = {
		food: createStatusCheck("food", "food", (unit, team) => {team.getSupply("food") >= team.units().length}),
		endOfFight: createStatusCheck("End Of Fight", "endOfFight", (unit)=> true)
	}
	library.traits = {
		//damage
		justBones: createDamageTrait("justBones",["bullet"], library.effects.divide5),
		ooze: createDamageTrait("ooze", ["bullet","slashing"], library.effects.reduceTo1),
		//weapon effect
		slime: createAttributeEffect("slime", ["stealth", "cover", "ranged", "block", "melee"], library.effects.minus5),
		slimeMove: createAttributeEffect("slime", ["speed"], library.effects.minus2),
		hunger: createAttributeEffect("hunger", ["stealth", "cover", "ranged", "block", "melee"], library.effects.minus2 ),
		hungerMove: createAttributeEffect("hunger", ["speed"], library.effects.minus2 ),
		//terrain
		visualObstacles: createTerrainTrait("visualObstacles", "sightlines", library.effects.eightyPercent),
		concealment: createTerrainTrait("visualObstacles", "stealth", library.effects.addLog4),
		cover: createTerrainTrait("cover", "cover", library.effects.addLog4),
		moreOpen: createTerrainTrait("moreOpen", "sightlines", library.effects.plus25Percent)
	};
	library.buffs = {
		wormSlime: createBuffStatus("worm slime", [library.traits.slime, library.traits.slimeMove], library.statusChecks.endOfFight, "assets/acid.svg"),
		hungry: createBuffStatus("hungry", [library.traits.hunger, library.traits.hungerMove], library.statusChecks.food, "assets/food.svg")
	}
	library.weapons = {
		riffle: createWeapon("riffle", ["ranged"], 15, ["bullet"], ["countable"], [], [weaponCost("ammo",1)], "assets/riffle.svg"),
		pistol: createWeapon("pistol", ["ranged"], 10, ["bullet"], ["countable"], [], [weaponCost("ammo",1)], "assets/pistol.svg"),
		machineGun: createWeapon("machineGun", ["ranged", "area"], 20, ["bullet"], ["countable"], [], [weaponCost("ammo",2)], "assets/machineGun.svg"),
		jaws: createWeapon("jaws", ["melee"], 10, ["slashing"], ["embedded"], [], [], "assets/jaws.svg"),
		slime: createWeapon("slime", ["ranged", "area"], 0, ["none"], ["embedded"], [library.buffs.wormSlime], [], "assets/acid.svg"),
		sword: createWeapon("sword", ["melee"], 6, ["slashing"], ["countable"], [], [], "assets/sword.svg"),
		acid: createWeapon("acid", ["melee"], 3 , ["acid"], ["embedded"], [], [], "assets/acid.svg"),
		fireball: createWeapon("fireball", ["ranged", "area"], 5, ["fire"], ["embedded"], [], [], "assets/fireball.svg"),
		bow: createWeapon("bow", ["ranged"], 4, ["bullet"], ["countable"], [], [], "assets/bow.svg")
	};
	
	library.activities = {
		doNothing: createActivity("Do Nothing", () => {console.log(unit.name() +" did nothing!")}),
		move: createActivity("move", () => {}),
		train: createActivity("train", () => {
			//TODO: track days of training
		}),
		heal: createActivity("heal", (unit) => {
			//TODO: better healing rate
			unit.currentHp(unit.currentHp+1);
		})
	}
	library.activityList = Object.values(library.activities);
	library.race = {
		human: createRace("Human", "mortal", 7, 5, []),
		goblin: createRace("goblin", "mortal", 6, 5, []),
		squidling: createRace("squidling", "mortal", 7, 5, []),
		bug: createRace("bug", "mortal", 10, 6, []),
		skeleton: createRace("skeleton", "undead", 10, 3, [library.traits.justBones]),
		worm: createRace("worm", "beast", 15, 5, []),
		ooze: createRace("ooze", "ooze", 10, 1, [library.traits.ooze])
	};
	library.training = {
	}
	var basics = ["melee","block","ranged","cover","stealth","per"];
	for(var i = 1; i<=10; i++) {
		for(var stat of basics) {
			library.training[stat+i]=createBasicTraining(stat,i);
		}
	}
	for(var weaponId of Object.keys(library.weapons)){
		var weapon = library.weapons[weaponId];
		library.training["basic"+weapon.name()] = createTraining("basic "+weapon.name(), weapon.name(), 5, 2, []);
		for(var i = 1;i<=5;i++){
			library.training[weapon.name()+(i*2)] = createTraining(weapon.name()+" "+(i*2), weapon.name(), 5+i*2, Math.pow(2,i), [i==1?"basic"+weapon.name:weapon.name()+" "+(i-1)*2]);
		}
	}
	library.traitLists = {
		goblin: [
			library.training.stealth5,
			library.training.per5,
			library.training.ranged2,
			library.training.cover2
		]
	}
	library.units = {
		conscript: createAdvancedUnit("modern", "conscript", library.race.human, [library.weapons.riffle], [library.training.basicriffle], "assets/modern.svg"),
		scout: createUnit("modern", "scout", 7, 0, 0, 5, 5, 4, -5, 0, [library.weapons.riffle], [library.training.basicriffle], [], "assets/modern.svg"),
		heavy: createUnit("modern", "heavy", 10, -5, -5, 0, 5, 2, -10, -2, [library.weapons.machineGun], [library.training.basicmachineGun], [], "assets/modern.svg"),
		officer: createUnit("modern", "officer", 8, 2, -2, 0, 3, 3, -3, 2, [library.weapons.pistol], [library.training.basicpistol], [], "assets/modern.svg"),
		worm: createUnit("worm","worm", 15, 20, 10, 0, 0, 5, 5, 10, [library.weapons.slime, library.weapons.jaws], [library.training.basicjaws], [],  "assets/worm.svg"),
		//Only high HP vs bullets
		skeleton: createUnit("skeleton","skeleton", 10, -5, -5, -12, 0, 3, -5, 0, [library.weapons.sword], [library.training.basicsword],[library.traits.justBones], "assets/undead.svg"),
		skeletonArcher: createAdvancedUnit("skeleton", "Skeleton Archer", library.race.skeleton, [library.weapons.bow], [library.training.basicbow], "assets/undead.svg"),
		//High HP only vs some damage types
		ooze: createUnit("ooze","ooze", 10, -5, 10, -12, 0, 1, -15, 0, [library.weapons.acid], [library.training.basicacid],[library.traits.ooze], "assets/ooze.svg"),
		squidlingWarrior: createUnit("squidling","Squidling Warrior", 7, 0, 0, 2, 2, 5, 4, 4, [library.weapons.sword], [library.training.basicsword],[], "assets/squidling.svg"),
		goblin: createUnit("goblin","goblin", 6, 5, 5, 2, -2, 5, 0, 0, [library.weapons.sword], [library.training.basicsword], [], "assets/goblin.svg"),
		goblinWizard: createAdvancedUnit("goblin", "Goblin Wizard", library.race.goblin, [library.weapons.fireball], [library.training.fireball2, library.training.stealth3], "assets/goblin.svg"),
		goblinArcher: createAdvancedUnit("goblin", "Goblin Archer", library.race.goblin, [library.weapons.bow], [library.training.basicbow, library.training.stealth3], "assets/goblin.svg")
	};
	
	library.faction = {
		goblin: {
			name: "goblin",
			faction: "Goblin",
			image: "assets/goblin.svg",
			teamSize: () => randInt(10) +1,
			units: [
			{proportion: 10, unit: library.units.goblinArcher, warrior: true},
			{proportion: 10, unit: library.units.goblinWizard, warrior: true},
			{proportion: 10, unit: library.units.goblin, warrior: true},
			]
		},
		ooze: {
			name: "ooze",
			faction: "Monster",
			teamSize: () => 1,
			image: "assets/ooze.svg",
			units: [{proportion: 1, unit: library.units.ooze, warrior: true}]
		},
		worm: {
			name: "worm",
			faction: "Monster",
			teamSize: () => 1,
			image: "assets/worm.svg",
			units: [{proportion: 1, unit: library.units.worm, warrior: true}]
		},
		undead: {
			name: "skeleton",
			faction: "Undead",
			teamSize: () => randInt(10) +1,
			image: "assets/undead.svg",
			units:[
				{proportion: 10, unit: library.units.skeletonArcher, warrior: true},
				{proportion: 20, unit: library.units.skeleton, warrior: true}
			]
		},
		squidling: {
			name: "squidling",
			faction: "Squidling",
			teamSize: () => randInt(10) +1,
			image: "assets/squidling.svg",
			units: [{proportion: 10, unit: library.units.squidlingWarrior, warrior: true}]
		}
	}
	//TODO: what was this for?
	library.consumables = {
		food: createConsumable("food",0),
		ammo: createConsumable("ammo",0),
		gold: createConsumable("gold",0),
		moves: createConsumable("moves",0),
		magic: createConsumable("magic",0),
	}
	library.terrain = {
		glowshrooms: createTerrain("glowshrooms",[library.traits.visualObstacles, library.traits.cover, library.traits.concealment], "assets/glowshrooms.svg"),
		pools: createTerrain("pools", [library.traits.moreOpen, library.traits.concealment], "assets/pools.svg"),
		narrows: createTerrain("narrows", [library.traits.visualObstacles], "assets/narrows.svg"),
		stalagtites: createTerrain("stalagtites", [library.traits.visualObstacles, library.traits.cover, library.traits.concealment], "assets/stalagtites.svg"),
	};
	library.structures = {
		wormNest: createStructure("Worm Nest", "Monster"),
		goblinTown: createStructure("Goblin Town", "Goblin", "assets/village.svg"),
		camp: createStructure("Camp", "modern"),
		base: createStructure("Base", "modern", "assets/base.svg"),
	}
	return library;
}