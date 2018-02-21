var unitAction = function(name,action, params)
{
	var unitAction = {};
	unitAction.name = name;
	unitAction.baseAction = action;
	unitAction.params = params?Array.isArray(params)?params:[params]:[];
	unitAction.action = function (){ 
		var result = unitAction.baseAction(...unitAction.params);
		game.next();
		return result
	};
	return unitAction;
}

//distance between two units
var distance  = function (a,b){
	// standardize the +.25
	a= ko.unwrap(a);
	b= ko.unwrap(b);
	var dx = a.battlefieldPosition.x()-b.battlefieldPosition.x();
	var dy = a.battlefieldPosition.y()-b.battlefieldPosition.y();
	return Math.pow(dx*dx+dy*dy,.5);
}

var game = {};
game.team = ko.observableArray([]);
game.targets = ko.observableArray([]);
game.activeSide = ko.observable("targets"); //team or targets
game.battleFeild = {};
game.battleFeild.locationClick = function (data,clickEvent){
	console.log(clickEvent.evt.offsetX,clickEvent.evt.offsetY)
}
game.battleFeild.objectClick = function (unit)
{
	if(game[game.activeSide()].indexOf(unit)!=-1){
		if(game.selected() != unit) game.selected(unit);
	}
	else
	{
		console.log("taunt your enemy!");
		if(game.validAttack(game.selected(),unit))
		{
			game.attack(game.selected(),unit);
		}
	}
}
game.battleFeild.moveCircleClick = function (data,clickEvent)
{
	// grid system with 1 unit per person
	// TODO: single steps
	// TODO: partial moves?
	// TODO: generalize with other actions
	var x = Math.round(clickEvent.evt.offsetX/20);
	var y = Math.round(clickEvent.evt.offsetY/20);
	game.selected().battlefieldPosition.x(x);
	game.selected().battlefieldPosition.y(y);
	game.selected().turnStatus("expended");
	game.next();
}

game.narration=ko.observable("");
game.selected = ko.observable(null);
game.select = function (target)
{
	game.selected(target);
}
game.attack = function (attacker,defender)
{
	//TODO: conditions on no wound
	//TODO: make parrying work
	//TODO: armor protects differently against different damage types
	var attacker = game.selected();
	attacker.turnStatus("expended");
	attack = attacker.activeWeapon();
	attacker.weaponStatus(attack.speed-1)
	
	// Roll to Hit
	var hit = 10- dice(3)+attack.accuracy+defender.size;
	// Roll to Block
	var block = 8 - dice(3); //TODO: dodges other than 8
	// Roll Damage
	var damage = attack.strength * (dice(2)-2)/5 
	// Determine DR
	var armorSlot = Math.floor(hit/2);
	if(block >= 0) armorSlot = -1;
	var armor = damage;
	if(armorSlot >= defender.armor.length) armor=defender.armor[defender.armor.length-1];
	else if(armorSlot >=0) armor = defender.armor[armorSlot];

	// Determine Damage Past Armor
	
	var effectiveDamage = damage-armor;
	// Determine Damage Delt
	var woundingModifier = 2;
	if(attack.damageType == "impact") woundingModifier = 1;
	if(attack.damageType == "slashing") woundingModifier = 1.5;
	effectiveDamage*=woundingModifier;
	// Determine Wound size
	var woundSize = Math.floor(Math.log(effectiveDamage/defender.hitPoints)/Math.log(2));
	// Roll HT
	
	console.log(hit,block,"damage",damage,"effetive damage",effectiveDamage,defender.hitPoints);
	if(woundSize >= -4)
	{
		defender.wounds.push(woundSize);
		defender.lastWound(woundSize);
		defender.roundWounds();
		defender.HTcheck();
		
		for(var condition of attack.conditions)
			if(defender.conditions.indexOf(condition)==-1) defender.conditions.push(condition);
		
		game.narration(attacker.name()+" inflicted a "+woundSize+" level wound!");
	}
	else if(hit<0) game.narration(attacker.name()+" missed "+defender.name()+"!");
	else if(block>=0) game.narration(defender.name()+" dodged!");
	else game.narration("The blow ("+damage+") was stopped by armor ("+armor+")!("+attacker.name()+" vs "+defender.name()+")");
	console.log(game.narration());
}


game.nextTurn = function ()
{
	game.startTurn(game.activeSide()=="team"?"targets":"team");
}
game.startTurn = function (side)
{
	game.activeSide(side);
	var opposing = side == "team"?game.targets():game.team();
	var active = side == "team"?game.team():game.targets();
	
	for(var i of opposing) if(i.turnStatus()=="ready")i.turnStatus("expended");
	for(var i of active) if(i.turnStatus()=="expended")i.turnStatus("ready");
}
game.validAttack = function(attacker,defender)
{
	if(!attacker || !defender) return false;
	return attacker.weaponStatus()==0 && distance(defender,attacker) <= attacker.activeWeapon().reach;
}
game.isUnitActive = function(unit){
	if(unit == undefined) return false;
	if(game[game.activeSide()]().indexOf(unit)==-1) return false;
	if(unit.turnStatus() == "expended") return false;
	if(unit.conditions().indexOf("dead")!=-1) return false;
	if(unit.conditions().indexOf("unconscious")!=-1) return false;
	return true;
}
game.validActions = function (unit)
{
	if(!unit || !game.isUnitActive(unit)) return [];
	var result = [];
	// TODO: removal parameters included in condition infliction
	if(unit.conditions.indexOf("prone") != -1)
		result.push (unitAction ("Get Up",()=> unit.conditions.remove("prone")));
	if(unit.weaponStatus()>0) result.push(unitAction("Ready Weapon",unit.readyWeapon));
	else{
		// attacks
		var targets = game.targets();
		if(game.activeSide() == 'targets') targets = game.team();
		for(var i of targets)
		{
			if(game.validAttack(unit,i)) // needs to be ko.computed stuff
				result.push(unitAction("Attack "+i.name(),game.attack,[unit,i]));
		}

	}
	//TODO; allow multiple attacks with one weaponStatus
	// different styles of attacks. actually going for the kill versus essentially threating to keep the monster at bay
	if(unit.attacks.length > 1)
	{
		for(var i of unit.attacks)
		{
			if (i.name != unit.activeWeapon().name)
				result.push(unitAction("Switch to "+i.name,unit.swapWeapon,[i]));
		}
	}
	// TODO: Defensive Position
	// TODO: Move changes the state of the actor
	// TODO: Go to waiting condition
	// TODO: First Aid
	// TODO: Swap Weapon taking more time
	return result;
}
game.next = function (unit){
	var foundReady = false;
	var side =game.activeSide();
	for(var i of game[side]())
	{
		//if(i.canAct()) {
		if(game.isUnitActive(i)) {
			game.selected(i);
			foundReady=true;
		}
	}
	if(!foundReady) 
	{
		game.nextTurn();
		game.next();
	}
}
game.currentValidActions = ko.computed (function (){return game.validActions(game.selected())});
game.validMovePositions = ko.pureComputed (function (){
	
	//TODO: single steps
	//TODO: status's that slow you down
	//TODO: obstacles
	if(!game.selected()  || !game.isUnitActive(game.selected())) return [];
	var unit = game.selected();
	var positioning = unit.battlefieldPosition;
	var result = [];
	for(var i = -(unit.move); i<= unit.move;i++)
	for(var j = -(unit.move); j<= unit.move;j++)
	{
		if(Math.pow(i*i+j*j,.5)<unit.move+.25) result.push({x:i+positioning.x(),y:j+positioning.y()});
	}
	return result;
	
});

function setUpFight()
{
	var pike = attack("pike",0,6,"stabbing","melee",4,2,1,[],1);
	var cheaterStick = attack("cheater stick",5,10,"stabbing","melee",4,5,1,[],4); //Testing only
	var bow = attack("bow",0,3,"stabbing","ranged",100,0,4,[],0);
	var crossbow = attack("crossbow",0,5,"stabbing","ranged",100,0,20,[],2);
	var spear = attack("spear",1,6,"stabbing","melee",2,2,1,[],1);
	var bearClaws = attack("claws",0,4,"slashing","melee",1,0,1,[],1);
	var monsterClaws = attack("claws",0,10,"slashing","melee",1,0,1,[],1);
	var trample = attack("Trample",5,15,"impact","melee",1,0,1,["prone"],[],10);
	
	var archer = unit("default","archer",10,10,[4,1,0],10,0,4,[bow,spear]);
	var pikeman = unit("default","pikeman",10,10,[8,1,0],10,0,4,[pike]);
	var bear = unit("Bruin","Bear",20,11,[2,1,1,0],20,0,4,[bearClaws]); 
	//var monster = unit("Beast","Beast",20,11,[2,1,1,0],20,2,4,[monsterClaws]); 
	var monster = unit("Beast","Beast",20,11,[2,1,1,0],20,2,4,[trample]); 
	
	var names = ["peter (pike)","james (pike)","john (pike)","andrew (pike)","abraham (bow)","issac (bow)","jacob (bow)","joseph (bow)"];
	for(var i = 0;i<4;i++)game.team.push(copyUnit(names[i],pikeman));
	for(var i = 4;i<8;i++)game.team.push(copyUnit(names[i],archer));
	
	var count = 1;
	for(var i of game.team()) {
		i.battlefieldPosition.x(1);
		i.battlefieldPosition.y(count++);
	}
	
	game.targets.push(copyUnit("Questing Beast",monster));
	game.targets()[0].battlefieldPosition.x(5);
	game.targets()[0].battlefieldPosition.y(5);
}

function load()
{
	setUpFight();
	ko.applyBindings(game,document.getElementById('main'));
}
