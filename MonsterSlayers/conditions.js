var condition = function (name,actionModifiers)
{
	var condition = {};
	return condition;
}
var conditions = {};
//TODO: apply bonuses to math
conditions.prone = condition ("prone",[
		{type:'accuracy bonus', value: -4},
		{type:'damage bonus', value: -2 },
		{type: 'movement value', value: 1},
		{type: 'added action',name: 'Get Up',value: function (unit){
			//todo: remove condition
		}}
]);
conditions.defending = condition ("defensive",[
		{}
])
//action modifier keywords:
/*
	accuracy bonus
	damage bonus
	movement bonus
	movement value
	added action
	forbidden action
	allowed action
	incapacitating
	ACTION: -- requires an action to maintain ?? how to best handle things you take an action to do?
*/

// THINGS ABOUT A CONDITION:
/*
	Can be positive OR negative
	
	Possible Actions: 
		none
		no effect on options
		added options
			overcome action
		removed options
	Modified Action values (+ vs mult)
		movement value
		accuracy value
		damage value
		dodge values  ??? not done yet!
	Requirements to effect
		On accuracy threshold
		At damage threshold
		BOTH/EITHER of the above
		check against value
			ST
			DX
			HT
*/