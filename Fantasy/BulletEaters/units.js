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
		displayDetails: ko.observable(false),
		faction: ko.observable("none"),
		displayGear: ko.observable(false),
		gear: ko.observableArray([]),
		svg: ko.observable("assets/blank.svg"),
		
		currentHp: ko.observable(0),
		training: ko.observableArray([]),
		buffs: ko.observableArray([]),
		dailyActivity: ko.observable(results.library?results.library.activities.move:createActivity("Do Nothing", () => {console.log(unit.name() +" did nothing!")}))
	};
	console.log("dailyActivity: ", unit.dailyActivity().name());
	unit.log = function (message) {
		console.log("unit log", message);
		console.trace();
		//todo remove this after its no longer called
	}
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
	unit.effects = ko.pureComputed(() => {
		return unit.buffs().map(buff => buff.effects).flat();
	});
	return unit;
}
function finishUnit(unit) {
	unit.per= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("per"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar),unit.basePer());
	});
	unit.stealth= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("stealth"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar), unit.baseStealth());
	});
	unit.cover= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("cover"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar),unit.baseCover());
	});
	unit.ranged= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("ranged"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar),unit.baseRanged());
	});
	unit.block= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("block"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar),unit.baseBlock());
	});
	unit.melee= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("melee"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar),unit.baseMelee());
	});
	unit.speed= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("per"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar),unit.baseSpeed());
	});
	unit.maxHp= ko.pureComputed(() => {
		return unit.effects().filter(e=>e.attributes.includes("maxHp"))
		.map(e => e.effect).sort((a,b) => a.priority - b.priority)
		.reduce((sofar, a) => a.func(sofar),unit.baseMaxHp());
	});
	return unit;
}
function createAdvancedUnit(name, type, race, gear, training, svg) {
	//TODO: combine two unit types with inheritence
	var unit = createUnitBase();
	unit.name = ko.observable(name);
	unit.type = ko.observable(type);
	unit.race = race;
	
	unit.basePer= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "per").reduce((sofar,training)=>training.bonus+sofar,0));
	unit.baseStealth= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "stealth").reduce((sofar,training)=>training.bonus+sofar,0));
	unit.baseCover= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "cover").reduce((sofar,training)=>training.bonus+sofar,0));
	unit.baseRanged= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "ranged").reduce((sofar,training)=>training.bonus+sofar,0));
	unit.baseBlock= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "block").reduce((sofar,training)=>training.bonus+sofar,0));
	unit.baseMelee= ko.pureComputed(() => 0 + unit.training().filter(t=>t.type == "melee").reduce((sofar,training)=>training.bonus+sofar,0));
	unit.baseSpeed= ko.pureComputed(() => unit.race.speed + unit.training().filter(t=>t.type == "speed").reduce((sofar,training)=>training.bonus+sofar,0));

	unit.baseMaxHp= ko.pureComputed(() =>  unit.race.hp);

	unit.training(training?training:[]);
	unit.gear(gear);
	unit.currentHp = ko.observable(unit.baseMaxHp());
	
	if(svg)unit.svg(svg);
	//TODO: sort out effect vs trait name wise
	unit.getEffects = function (effectType, selector) {
		return unit.race.traits
		.filter( trait => trait.type == effectType);
	}

	return finishUnit(unit);
}
function copyAdvancedUnit(unit, preserveName){
	var result =  createAdvancedUnit(
		preserveName? unit.name(): getName(unit.name()),
		unit.type(),
		unit.race,
		unit.gear().map(gear => copyWeapon(gear)),
		unit.training(),
		unit.svg()
	);
	if(!preserveName)
		result.faction(unit.name());
	return result;
}
function createUnit(name, type, hp, per, stealth, cover, ranged, speed, block, melee, gear, training, traits, svg) {
	var unit = createUnitBase();
	
	unit.name = ko.observable(name);
	unit.type = ko.observable(type);

	unit.basePer= ko.observable(per);
	unit.baseStealth= ko.observable(stealth);
	unit.baseCover= ko.observable(cover);
	unit.baseRanged= ko.observable(ranged);
	unit.baseBlock= ko.observable(block);
	unit.baseMelee= ko.observable(melee);
	unit.baseSpeed= ko.observable(speed);
	unit.baseMaxHp= ko.observable(hp);

	unit.gear(gear);
	unit.training(training?training:[]);
	unit.traits = ko.observable(traits?traits:[]);
	unit.currentHp = ko.observable(unit.baseMaxHp());
	
	if(svg)unit.svg(svg)
	
	unit.getEffects = function (effectType) {
		return unit.traits().filter( trait => trait.type == effectType);
	}

	return finishUnit(unit);
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
		unit.traits(),
		unit.svg()
	);
	if(!preserveName)
		result.faction(unit.name());
	return result;
}
function registerUnitStats() {
	ko.components.register("unit-stats", {
		viewModel: function (params){
			this.unit = params.unit;
			this.edit = params.edit? true: false;
			this.actions = params.actions;
			this.style = params.style? params.style: "#000000";
			this.index = params.index;
		},
		template: 
		`<!-- ko with:unit -->
			<img data-bind="attr: {src: svg}" class= "smallIcon"></img>
			<span data-bind="if: gear()[0]">
				<img data-bind="attr: {src: gear()[0].svg}" class="smallIcon"></img>
			</span>
			<span data-bind="text:name" class="unitName"></span>
			<span data-bind="text:type" class="unitType"></span>
			<span class="unitHP">
				<span data-bind="text:currentHp"></span>/
				<span data-bind="text:maxHp"></span>
			</span>
			<span class="unitDistance">
				[<span data-bind="text:distance"></span>]
			</span>
			<!--span data-bind="text:status" class="unitStatus"></span-->
			<img data-bind="attr: {src: 'assets/'+status()+'.svg'}" class= "smallIcon"></img>
			<!--span data-bind="if:!$parent.edit">
				<span data-bind = "text: dailyActivity().name"></span>
			</span-->
			<span data-bind = "text: dailyActivity().name"></span>
			<span data-bind="if:$parent.edit">
				<select data-bind="options: $parents[4].dailyUnitActions()[$parent.index()], clickBubble:false, click: function() { }, optionsText:'name', value: dailyActivity"></select>
			</span>
			<span data-bind="foreach:$parent.actions" class="unitActions">
				<button data-bind="clickBubble:false, click:click">
					<span data-bind="if:svg">
						<img data-bind="attr:{src:svg, title: name}" class="smallIcon"></img>
					</span>
					<span data-bind="if: !svg">
						<span data-bind="text:name"></span>
					</span>
				</button>
			</span>
			<!--span data-bind="text:log"></span-->
			<div data-bind="if:displayDetails" class="displayDetails">
				<div>
					<span class="unitKey">HP:</span>
					<span data-bind="text:currentHp"></span>
					/<span data-bind="text:maxHp"></span>
				</div>
				<div>
					<span class="unitKey">move:</span>
					<span data-bind="text:speed"></span>
				</div>
				<div>
					<span class="unitKey">Sneaking:</span>
					<span data-bind="text:per"></span>
					|<span data-bind="text:stealth"></span>
				</div>
				<div>
					<span class="unitKey">Ranged:</span>
					<span data-bind="text:cover"></span>
					|<span data-bind="text:ranged"></span>
				</div>
				<div>
					<span class="unitKey">Melee:</span>
					<span data-bind="text:block"></span>
					|<span data-bind="text:melee"></span>
				</div>
				<div>
					<span class="unitKey">Weapons:</span>
					<div data-bind="foreach:gear">
						<div>
							<img data-bind="attr:{src:svg, title: name}" class="smallIcon"></img>
							<span data-bind="text:name"></span>
							SK<span data-bind="text:$parent.attackModifier($data)"></span>
							DMG<span data-bind="text:damage"></span>
						</div>
					</div>
				</div>
				<div>
					<span class="unitKey">Effects:</span>
					<div data-bind="foreach:buffs">
						<div>
							<img data-bind="attr:{src:svg, title: name}" class="smallIcon"></img>
							<span data-bind="text:name"></span>
						</div>
					</div>
				</div>

			</div>
		<!-- /ko -->`
	})
}
function registerUnitList () {
	ko.components.register("unit-list", {
		viewModel: function (params){
			this.edit = params.edit? true: false;
			this.units = params.units;
			this.actions = params.actions;
			this.style = params.style? params.style: "#000000";
		},
		template: 
		`<div data-bind="foreach: units">
			<unit-stats 
				params="unit:$data, actions: $parent.actions()[$index()], style: $parent.style, edit: $parent.edit, index: $index"
				data-bind="click:toggleDisplayDetails, style: {color:$parent.style, border: '1px solid '+$parent.style}"  
				class="unit"
			></unit-stats>
		</div>`
	})
}