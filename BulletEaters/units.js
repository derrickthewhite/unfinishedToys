function createTraining(name, type, bonus, time, replaces) {
	//TODO: should type be an array?
	return {
		name: name,
		type: type,
		bonus: bonus,
		time: time,
		replaces: replaces
	}
}
function createBaseTrait(name, type){
	return {
		name: name,
		type: type
	}
} 
function createMathEffect(name, priority, func){
	return {
		name: name,
		priority: priority,
		func: func
	}
}
function createDamageTrait(name, damageTypes, effect) {
	var trait = createBaseTrait(name, "damage");
	trait.damageTypes = damageTypes;
	trait.effect = effect;
	return trait;
}
function createBasicTraining(type, bonus){
	return createTraining(type+" "+bonus, type, bonus, Math.pow(2,bonus), [bonus-1?type+" "+(bonus-1):undefined])
}
function createRace(name, type, hp, speed, traits) {
	var race = {
		modifierType: "Race",
		name: name,
		type: type,
		hp: hp,
		speed: speed,
		traits: traits
	}
	return race;
}
function createUnitBase() {
	var unit = {
		//TODO: do we need an id as well as a name?
		featureType: "Unit",
		distance: ko.observable(0),
		actions: ko.observable(0),
		log: ko.observable(""),
		displayDetails: ko.observable(false),
		faction: ko.observable("none"),
		displayGear: ko.observable(false),
		gear: ko.observableArray([]),
		
		currentHp: ko.observable(0),
		training: ko.observableArray([])
	};
	unit.attackModifier = function (weapon) {
		//TOOD: do we need a "training" property on weapons?
		return -5
		+ (weapon.weaponTypes.includes("ranged")?unit.ranged():unit.melee())
		+ unit.training().filter(t=> t.type==weapon.name()).reduce((sofar,a)=>a.bonus+sofar,0);
	}
	unit.damageFrom = function (weapon) {
		return unit.getEffects("damage")
		.filter(effect => effect.damageTypes.filter(damageType => weapon.damageTypes.includes(damageType)).length)
		.map(e=>e.effect)
		.sort((a,b)=> a.priority - b.priority) //TODO: test order on this
		.reduce((damage,effect) => effect.func(damage),weapon.damage());
	}
	unit.toggleDisplayDetails = function (data, event) {
		unit.displayDetails(!unit.displayDetails());
	}
	unit.status = ko.pureComputed(() => {
		return unit.currentHp()<1?"dead":
			unit.actions()>0? "ready": "acted"
	});
	return unit;
}
function createAdvancedUnit(name, type, race, gear, training) {
	//TODO: combine two unit types with inheritence
	var unit = createUnitBase();
	unit.name = ko.observable(name);
	unit.type = ko.observable(type);
	unit.race = race;
	
	unit.per= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "per").reduce((a,b)=>a+b,0));
	unit.stealth= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "stealth").reduce((a,b)=>a+b,0));
	unit.cover= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "cover").reduce((a,b)=>a+b,0));
	unit.ranged= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "ranged").reduce((a,b)=>a+b,0));
	unit.block= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "block").reduce((a,b)=>a+b,0));
	unit.melee= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "melee").reduce((a,b)=>a+b,0));
	unit.speed= ko.pureComputed(() => unit.race.speed + unit.training().filter(t=>t.type == "speed").reduce((a,b)=>a+b,0));

	unit.maxHp= ko.pureComputed(() =>  unit.race.hp);

	unit.training(training?training:[]);
	unit.gear(gear);
	unit.currentHp = ko.observable(unit.maxHp());
	
	unit.getEffects = function (effectType, selector) {
		return unit.race.traits
		.filter( trait => trait.type == effectType);
	}

	return unit;
}
function copyAdvancedUnit(unit, preserveName){
	var result =  createAdvancedUnit(
		preserveName? unit.name(): getName(unit.name()),
		unit.type(),
		unit.race,
		unit.gear().map(gear => copyWeapon(gear)),
		unit.training()
	);
	if(!preserveName)
		result.faction(unit.name());
	return result;
}
function createUnit(name, type, hp, per, stealth, cover, ranged, speed, block, melee, gear, training, traits) {
	var unit = createUnitBase();
	
	unit.name = ko.observable(name);
	unit.type = ko.observable(type);
	
	unit.per= ko.observable(per);
	unit.stealth= ko.observable(stealth);
	unit.cover= ko.observable(cover);
	unit.ranged= ko.observable(ranged);
	unit.block= ko.observable(block);
	unit.melee= ko.observable(melee);
	unit.speed= ko.observable(speed);
	unit.maxHp= ko.observable(hp);

	unit.gear(gear);
	unit.training(training?training:[]);
	unit.traits = ko.observable(traits?traits:[]);
	unit.currentHp = ko.observable(unit.maxHp());
	
	unit.getEffects = function (effectType) {
		return unit.traits().filter( trait => trait.type == effectType);
	}

	return unit;
}
function copyUnit(unit, preserveName) {
	if(unit.race) return copyAdvancedUnit(unit, preserveName);
	var result =  createUnit(
		preserveName? unit.name(): getName(unit.name()),
		unit.type(),
		unit.maxHp(),
		unit.per(),
		unit.stealth(),
		unit.cover(),
		unit.ranged(),
		unit.speed(),
		unit.block(),
		unit.melee(),
		unit.gear().map(gear => copyWeapon(gear)),
		unit.training(),
		unit.traits()
	);
	if(!preserveName)
		result.faction(unit.name());
	return result;
}
function registerUnitStats() {
	ko.components.register("unit-stats", {
		viewModel: function (params){
			this.unit = params.unit;
			this.actions = params.actions;
			this.style = params.style? params.style: "#000000";
			//this.battle = params.battle;
		},
		template: 
		`<div data-bind="with:unit">
		<div data-bind="click:toggleDisplayDetails, style: {color:$parent.style, border: '1px solid '+$parent.style}">
			<span data-bind="text:name"></span>
			<span data-bind="text:type"></span>
			<span data-bind="text:currentHp"></span>/
			<span data-bind="text:maxHp"></span>
			[<span data-bind="text:distance"></span>]
			<span data-bind="text:status"></span>
			<span data-bind="foreach:$parent.actions">
				<button data-bind="clickBubble:false, text:name, click:click"></button>
			</span>
			<span data-bind="text:log"></span>
			<div data-bind="if:displayDetails">
				<div>name:<span data-bind="text:name"></span></div>
				<div>HP:
					<span data-bind="text:currentHp"></span>
					/<span data-bind="text:maxHp"></span>
				</div>
				<div>move:<span data-bind="text:speed"></span></div>
				<div>Sneaking:
					<span data-bind="text:per"></span>
					|<span data-bind="text:stealth"></span>
				</div>
				<div>Ranged Combat:
					<span data-bind="text:cover"></span>
					|<span data-bind="text:ranged"></span>
				</div>
				<div>Melee Combat:
					<span data-bind="text:block"></span>
					|<span data-bind="text:melee"></span>
				</div>
				<div>Weapons:
					<div data-bind="foreach:gear">
						<div>
						<span data-bind="text:name"></span>
						SK<span data-bind="text:$parent.attackModifier($data)"></span>
						DMG<span data-bind="text:damage"></span>
						</div>
					</div>
				</div>
			</div>
		</div>
		</div>`
	})
}