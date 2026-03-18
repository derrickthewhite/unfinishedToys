var Attack = function (attacker,defender,forces,targets){
	var attack = {};
	
	attack.attacker = ko.observable(attacker);
	attack.defender = ko.observable(defender);
	attack.forces = ko.observable(forces);
	attack.targets = ko.observableArray(targets);
	
	attack.copy = function (){
		return Attack(
			attack.attacker(),
			attack.defender(),
			Number(attack.forces()),
			attack.targets().map(t=>t.copy()),
		);
	}
	
	return attack;
}
var Target = function (targetType,attackType,count){
	var target = {}
	target.targetType = ko.observable(targetType); // type of construction
	target.attackType = ko.observable(attackType); // attacks, destroys
	target.count=ko.observable(count); //number of attackers
	
	target.copy = function (){
		return Target(
			target.targetType(),
			target.attackType(),
			Number(target.count())
		);
	}
	
	return target;
}