var unit = function (name,type,hitPoints,toughness,armor,strength,size,move,attacks)
{
	var unit = {};
	unit.name = ko.observable(name);
	
	unit.type = type;
	unit.hitPoints = hitPoints; // Does the attack make the killing range?
	unit.toughness = toughness; // HT roll to not die
	unit.armor=armor; // Damage reduction [4,1,0] suceed by 2 to use the next lower value. If it goes off the chart use the lowest number 
	unit.strength = strength; // does nothing yet -- will be important later.
	unit.size = size;
	unit.move = move;
	
	unit.attacks = attacks?attacks:[];
	
	unit.wounds = ko.observableArray([]); // a 0 wound is full HP or more.  -1 is half that, +1 is double
	unit.conditions = ko.observableArray([]);
	unit.lastWound = ko.observable();
	
	//defaulting to 0?
	unit.battlefieldPosition = {};
	unit.battlefieldPosition.x = ko.observable(0);
	unit.battlefieldPosition.y = ko.observable(0);
	unit.battlefieldPosition.battlefield = ko.observable(); //TODO -- will this do anything?
	
	/*
		expended: unable to act until the next turn
		ready: able to act this turn
	*/
	unit.turnStatus = ko.observable("expended");
	unit.activeWeapon = ko.observable(unit.attacks[0]);
	unit.weaponStatus = ko.observable(unit.activeWeapon().speed-1); // turns until another attack
	
	unit.status = ko.pureComputed(function (){
		var result = "fresh";
		if(unit.wounds().length ==0) return result;
		var wound = unit.wounds()[unit.wounds().length-1];
		return "wounded:"+wound;
	});
	unit.isProne = ko.pureComputed(function (){
		if(unit.conditions().indexOf("dead")!=-1) return true;
		if(unit.conditions().indexOf("unconscious")!=-1) return true;
		if(unit.conditions().indexOf("prone")!=-1) return true;
		return false;

	});
	
	//sums up wounds and condenses them. 
	unit.roundWounds = function (){
		unit.wounds.sort((a,b)=>a-b);
		var currentWoundSize = -4;
		var currentWoundCount = 0;
		
		var woundsToNext = 3;
		var woundRack = [];
		for(var i =0;i<unit.wounds().length;i++)
		{
			if(!woundRack[unit.wounds()[i]]) woundRack[unit.wounds()[i]]=0;
			woundRack[unit.wounds()[i]]++;
		}
		var previousWounds=[];
		for(var i =-4;i<20;i++)
		{
			if(!woundRack[i])woundRack[i]=0;
			previousWounds[i]=woundRack[i];
		}
		for(var i =-4;i<woundRack.length;i++)
		{
			if(woundRack[i] >= woundsToNext){
				woundRack[i+1]+=Math.floor(woundRack[i]/woundsToNext);
				woundRack[i]=woundRack[i]%woundsToNext;
			} 
		}
		for(var i = 19;i>=-4;i--)
			if(woundRack[i]!=previousWounds[i]){
				unit.lastWound(i); // updates previous wound if it affected rounding
				break;
			}
		unit.wounds([]);
		for(var i=-4;i<20;i++)
			for(var j=0;j<woundRack[i];j++)
				unit.wounds.push(i);
	}
	//handles all HT rolls from injury
	// Death
	// Unconsciousness
	// TODO: Knockdown
	// TODO: stun recovery??
	unit.HTcheck = function ()
	{
		if(unit.wounds()[unit.wounds().length-1] >=0 && unit.toughness - dice(3) <0)
		{
			unit.conditions.push("unconscious");
		}
		if(unit.lastWound()>=0 && unit.toughness - dice(3) <unit.lastWound())
		{
			unit.conditions.push("dead");
		}
	}
	
	// TODO: make cross bows stay loaded
	// TODO: make dragon breath auto-charge
	// TODO: handle multiple active weapons
	// TODO: handle weapons that may be freely activated
	// TODO: handle weapons that must be put away with care
	unit.readyWeapon = function ()
	{
		if(unit.weaponStatus()<1) console.err("this weapon is already ready!");
		unit.weaponStatus(unit.weaponStatus()-1);
		unit.turnStatus("expended");
	}
	unit.swapWeapon = function (weapon)
	{
		unit.activeWeapon(weapon);
		unit.weaponStatus(unit.activeWeapon().speed-1);
		unit.turnStatus("expended");
	}
	return unit;
}

var copyUnit = function (name,template)
{
	return unit(name,template.type,template.hitPoints,template.toughness,template.armor,template.strength,template.size,template.move,template.attacks)
}

var attack = function (name,accuracy,strength,damageType,attackType,reach,parry,speed, conditions)
{
	var attack = {};
	attack.name = name;
	
	attack.accuracy = accuracy;
	attack.strength = strength;
	attack.damageType = damageType;
	attack.attackType = attackType;
	attack.reach = reach;
	//attack.parry = parry;  // TODO: figure out how parries effect defense. Include parry weight
	attack.speed = speed; // number of rounds for one attack
	attack.conditions = conditions?conditions:[];
	return attack;
}