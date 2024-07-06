var clueTypes = [
		"who",
		"what",
		"where (target)",
		"where (homeworld)",
		"why (destruction)",
		"why (parachronics)"
	];
var bonuses = [
	{
		baseType:'who',
		prereq: 5,
		target: 'where',
		value:4
	},
	{
		baseType:'what',
		prereq: 5,
		target: 'who',
		value:2
	},
	{
		baseType:'what',
		prereq: 5,
		target: 'why (parachronics)',
		value:2
	},
	{
		baseType:'where (target)',
		prereq: 5,
		target: 'why (destruction)', // or destruction, not sure which
		value:2
	},
	{
		baseType:'where (target)',
		prereq: 5,
		target: 'why (parachronics)', // or destruction, not sure which
		value:2
	},
	{
		baseType:'why (destruction)',
		prereq: 5,
		target: 'why (parachronics)', // or destruction, not sure which
		value:2
	},
	{
		baseType:'why (destruction)',
		prereq: 5,
		target: 'where (target)', // or destruction, not sure which
		value:2
	}
]
var detective = function (name,randomGenerator){
	var detective = {};
	
	
	detective.clues = [];
	detective.clueConclusions = [];
	
	detective.detectiveSkill = 12;
	
	detective.typeStatus = {};
	clueTypes.forEach(type=> {detective.typeStatus[type] = {
		name:name,
		type: type,
		basePenalty: -Infinity,
		bestSuccess: -Infinity
	};});
	
	
	detective.bonus = function (type){
		var result = bonuses.filter(bonus=>bonus.target==type && detective.typeStatus[bonus.baseType].bestSuccess >= bonus.prereq).reduce((sofar,bonus)=>sofar+bonus.value,0)
		
		result += detective.clueConclusions.length
		
		return result;
	}
	detective.analyzeClue = function(clue){
		//TODO: chance of not catching it!
		
		var bonus = detective.bonus(clue.category);
		
		var basePenalty = Math.max(detective.typeStatus[clue.category].basePenalty,clue.modifier)
		detective.typeStatus[clue.category].basePenalty = basePenalty;
		
		var clueResult = {
			clue:clue,
			result : detective.detectiveSkill + bonus + basePenalty - randomGenerator.dice()
		};
		
		detective.clueConclusions.push(clueResult);
		
		detective.typeStatus[clue.category].bestSuccess = Math.max(clueResult.result,detective.typeStatus[clue.category].bestSuccess);
	}
	
	return detective;
}
var clueManager = function (randomGenerator){
	var manager = {};
	
	manager.clues = [];
	manager.localDetectives = [];
	
	manager.analyzeClue = function(clue){
		manager.clues.push(clue);
		if(!manager.localDetectives[clue.location])
			manager.localDetectives[clue.location] = detective(clue.location,randomGenerator)
		
		var localDet = manager.localDetectives[clue.location];
		localDet.analyzeClue(clue);
	}
	
	manager.findings = function (){
		
		return Object.keys(manager.localDetectives)
			.map(key=>manager.localDetectives[key])
			.map(det=>clueTypes.map(type=>det.typeStatus[type]))
			.reduce((sofar,a)=>sofar.concat(a),[])
			.filter(clueStatus=>clueStatus.bestSuccess!=-Infinity);
			
	}
	
	return manager;
}