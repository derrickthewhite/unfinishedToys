function createWeapon(name, types, damage, damageTypes, handling) {
	return {
		//TODO: do we need an id as well as a name?
		featureType: "Gear",
		types: ["weapon"], //TODO: why is this an array?
		name: ko.observable(name),
		weaponTypes: types, // ranged or melee
		damageTypes: damageTypes,
		damage: ko.observable(damage), //TODO: make this variable?
		handling: handling
	}
}
function copyWeapon(weapon){
	return createWeapon(weapon.name(), weapon.weaponTypes, weapon.damage(), weapon.damageTypes, weapon.handling);
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
function createTeam(name,supply, faction, initialPosture){
	var team = {
		featureType: "Team",
		name: ko.observable(name),
		units: ko.observableArray([]),
		loot: ko.observableArray([]),
		supply: supply.getSupply? supply: createSupply(supply),
		tile: ko.observable(),
		faction: ko.observable(faction),
		posture: ko.observable(initialPosture), // Patrol, Stalk, Hide
		featureMap: createFeatureMap()
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
	team.stealth = ko.pureComputed(() => {
		var lowestScore = team.units().reduce((soFar,a) => Math.min(soFar, a.stealth()),Number.POSITIVE_INFINITY);
		var numbericPenalty = Math.log(team.units().length)/Math.log(2);
		return lowestScore-numbericPenalty;
	});
	team.per = ko.pureComputed(() => {
		var lowestScore = team.units().reduce((soFar,a) => Math.max(soFar, a.per()),Number.NEGATIVE_INFINITY);
		var numbericPenalty = Math.log(team.units().length)/Math.log(2);
		return lowestScore+numbericPenalty;
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
function createStructure(name, faction) {
	//TODO: standardize
	var consumables = ["food" , "ammo", "gold", "moves", "magic"];
	return {
		featureType: "Structure",
		type: ko.observable(name),
		name: ko.observable(name),
		contents: [],
		supply: createSupply(consumables.map(c=>createConsumable(c, 0))),
		faction: ko.observable(faction),
		featureMap: createFeatureMap()
	}
}
function copyStructure(structure){
	return createStructure(structure.name(), structure.faction())
}
function createBattlesite(name) {
	//TODO: standardize
	var consumables = ["food" , "ammo", "gold", "moves", "magic"];
	return {
		name: ko.observable(name),
		featureType: "Battlesite",
		contents: [],
		supply: createSupply(consumables.map(c=>createConsumable(c, 0)))
	};
	
}
function createTerrain(name, effects) {
	return {
		featureType: "Terrain",
		type: ko.observable(name),
		name: ko.observable(name),
		effects: ko.observableArray(effects)
	}
}
function createConsumable(name, amount){
	return {
		featureType: "Consumable",
		name: name,
		amount: ko.observable(amount),
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
	library.weapons = {
		riffle: createWeapon("riffle", ["ranged"], 15, ["bullet"], ["countable"]),
		pistol: createWeapon("pistol", ["ranged"], 10, ["bullet"], ["countable"]),
		machineGun: createWeapon("machineGun", ["ranged", "area"], 20, ["bullet"], ["countable"]),
		jaws: createWeapon("jaws", ["melee"], 10, ["slashing"], ["embedded"]),
		sword: createWeapon("sword", ["melee"], 6, ["slashing"], ["countable"]),
		acid: createWeapon("acid", ["melee"], 3 , ["acid"], ["embedded"])
	};
	console.log(library.weapons);
	library.effects = {
		divide5: createMathEffect("divide5", 20, (d) => Math.ceil(d/5)),
		reduceTo1: createMathEffect("reduceTo1", 100, (d) => 1),
		eightyPercent: createMathEffect("eightyPercent", 20, (d) => d*0.8),
		plus25Percent: createMathEffect("plus20Percent", 20, (d) => d*1.25),
		addLog4: createMathEffect("addLog4", 15, (d) => Math.log(Math.pow(1.5,d) +Math.pow(1.5,4))/Math.log(1.5))
	}
	library.traits = {
		//damage
		justBones: createDamageTrait("justBones",["bullet"], library.effects.divide5),
		ooze: createDamageTrait("ooze", ["bullet","slashing"], library.effects.reduceTo1),
		//terrain
		visualObstacles: createTerrainTrait("visualObstacles", "sightlines", library.effects.eightyPercent),
		concealment: createTerrainTrait("visualObstacles", "stealth", library.effects.addLog4),
		cover: createTerrainTrait("cover", "cover", library.effects.addLog4),
		moreOpen: createTerrainTrait("moreOpen", "sightlines", library.effects.plus25Percent)
	}
	library.race = {
		human: createRace("Human", "mortal", 7, 5, []),
		goblin: createRace("goblin", "mortal", 6, 5, []),
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
	library.units = {
		conscript: createAdvancedUnit("modern", "conscript", library.race.human, [library.weapons.riffle], [library.training.basicriffle]),
		scout: createUnit("modern", "scout", 7, 0, 0, 5, 5, 4, -5, 0, [library.weapons.riffle], [library.training.basicriffle]),
		heavy: createUnit("modern", "heavy", 10, -5, -5, 0, 5, 2, -10, -2, [library.weapons.machineGun], [library.training.basicmachineGun]),
		officer: createUnit("modern", "officer", 8, 2, -2, 0, 3, 3, -3, 2, [library.weapons.pistol], [library.training.basicpistol]),
		worm: createUnit("worm","worm", 15, 20, 10, -7, 0, 5, 5, 10, [library.weapons.jaws], [library.training.basicjaws]),
		//Only high HP vs bullets
		skeleton: createUnit("skeleton","skeleton", 10, -5, -5, -12, 0, 3, -5, 0, [library.weapons.sword], [library.training.basicsword],[library.traits.justBones]),
		//High HP only vs some damage types
		ooze: createUnit("ooze","ooze", 10, -5, 10, -12, 0, 1, -15, 0, [library.weapons.acid], [library.training.basicacid],[library.traits.ooze]),
		goblin: createUnit("goblin","goblin", 6, 5, 5, 2, -2, 5, 0, 0, [library.weapons.sword], [library.training.basicsword]),
	};
	library.consumables = {
		food: createConsumable("food",0),
		ammo: createConsumable("ammo",0),
		gold: createConsumable("gold",0),
		moves: createConsumable("moves",0),
		magic: createConsumable("magic",0),
	}
	library.terrain = {
		glowshrooms: createTerrain("glowshrooms",[library.traits.visualObstacles, library.traits.cover, library.traits.concealment]),
		pools: createTerrain("pools", [library.traits.moreOpen, library.traits.concealment]),
		narrows: createTerrain("narrows", [library.traits.visualObstacles]),
		stalagtites: createTerrain("stalagtites", [library.traits.visualObstacles, library.traits.cover, library.traits.concealment]),
	};
	library.structures = {
		wormNest: createStructure("Worm Nest", "Monster"),
		goblinTown: createStructure("Goblin Town", "Goblin"),
		portal: createStructure("Portal", "None"),
		camp: createStructure("Camp", "Modern"),
		base: createStructure("Base", "Modern"),
	}
	return library;
}