function buildStartingResourceSet (){
	
	// 20 peices of Land
	// population of 5
	// Hunting and 2 Crops
	// All land is wild
	
	var resourcesList = {};
	
	for(var resourceType of Resources)
	{
		if(! resourcesList[resourceType.type])resourcesList[resourceType.type]={};
		resourcesList[resourceType.type][resourceType.templateName] = resourceType;
	}
	
	var startingResourceIndex = {};
	var landIDs = [];
	// build land
	for(var i =0;i<20;i++)
	{
		var terrainType = Math.random() > .4? "land":"seas";
		var difficulty = Math.round(Math.random()+Math.random()*2);
		var humidity = Math.random() > .4? 3:2;
		var season = "mild dry winter";
		
		var id = resourcesList['Land']['Land'].id({
			terrainType:terrainType,
			humidity:humidity,
			season:season,
			difficulty:difficulty
			});
		if(!startingResourceIndex[id]){
			startingResourceIndex[id] = buildResourceInstance(
				resourcesList['Land']['Land'],
				0,
				[terrainType,difficulty,season,humidity]
			);
			landIDs.push(id);
		} 

		startingResourceIndex[id].number(startingResourceIndex[id].number()+1); // number++
	}
	startingResourceIndex['wild'] = 
		buildResourceInstance(resourcesList['Land Improvements']['Wild'],20);
	
	//build population
	startingResourceIndex['neolithic'] = 
		buildResourceInstance(resourcesList['Populace']['Neolithic'],5);
	
	// build Food Producers
	startingResourceIndex['Hunters'] = 
		buildResourceInstance(resourcesList['Food Production']['Hunter'],5,[startingResourceIndex[landIDs[0]],[]]);
		
	resources =[];
		for(var i in startingResourceIndex) resources.push(startingResourceIndex[i]);

	return resources;
	
}

//if a project is unspecified it will be filled in with the nullProject
var Resources = [
	{
		id: function (instance){return "LAND "+instance.season+" "+instance.terrainType+" H"+instance.humidity+" D"+instance.difficulty;},
		type: "Land",
		templateName:"Land",
		idInputs: ["terrainType:string","difficulty:number","season:string","humidity:number"],
		validIdInputs:{
					terrainType: ["seas","land"],
					difficulty: {min:0,max:3}, // 0 is a flooding river bank, 2 is rocky land
					season: ["tropical","tropical wet-dry","mild wet winter","mild dry winter", "harsh wet winter", "harsh dry winter", "arctic"],
					humidity: {min:0,max:4} // 0 is alien, 1 is desert, 3 is "standard"
					//generates 4*7*3*2 land types. more may (will!) come
		}
	},
	{
		id: function (){return "Wild"},
		type: "Land Improvements",
		templateName:"Wild",
	},
	{
		id: function (){return "Tamed"},
		type: "Land Improvements",
		templateName:"Tamed",
		maintain: [{POLICE:2},{}],
		neglect: [{POLICE:1},{}],
		abandon: [{},{dilapidation:35}]
	},
	{
		id: function (){return "Farmed"},
		type: "Land Improvements",
		templateName:"Farmed",
		maintain: [{INDUSTRY:2},{}],
		neglect: [{INDUSTRY:1},{}],
		abandon: [{},{dilapidation:50}]
	},
	{
		name:"Farmer",
		type:"Food Production",
		templateName:"Farmer",
		ids: ["Land.terrainType","Land.season","Land.humidity"],
		inputs: ["Land","Land Improvements","[Crop]","[Farmer Upgrade]"],
		crops: "Array of Crops",
		build: [{CULTURE:10},{}],
		maintain: [{CULTURE:1},{}],
		neglect: [{CULTURE:1},{}],
		abandon: [{},{dilapidation:40}],
	},
	{
		id: function () {return "Population "+Math.floor(Math.random()*1000000);},
		type: "Populace",
		templateName:"Neolithic",
		idAutoGens: ['cultureString'],
		cultureString: cultureString,
		maintain: [{FOOD: 10},{POPULATION:1}],
		neglect: [{FOOD: 9},{}],
		abandon: [{},{dilapidation:75}]
	},
	{
		type:"Food Production",
		templateName:"Hunter",
		id: function (instance){return "HUNTER "+instance.land.terrainType+" "+instance.land.season+" H"+instance.land.humidity},
		build: [{CULTURE:10},{}],
		maintain: [{CULTURE:1},{}],
		neglect: [{CULTURE:1},{}],
		abandon: [{},{dilapidation:40}],

		idInputs: ["land:Land","upgrades:[Hunter Upgrade]"],
		useInputs: ["Land","Land Improvements"],
		
		isValid: function (land,upgrades){
			
			// need to factor in upgrades at some point
			// for example to allow fishing
			if(Land.season == 'arctic') return false;
			//if(Land.terrainType == 'seas') return false;
			return true;
		},

		use: function (instance, land, improvements)
		{
			var result = 10;
			if(instance.land.humidity != land.humidity) result -= 3;
			if(instance.land.season != land.season) result -= 3;
			if(improvements.name == "Farmed") result -=5;
			result = Math.max (result,2);
			if(instance.land.terrainType != land.terrainType) result =0;
			
			for(var i of instance.upgrades) result = i.alterOutput(instance, land, improvements);
			
			return result;
		}
		//should take multiple land inputs
	}
];


function isValidInput(input,type,validation)
{
	if(input === undefined) return false;
	if(type == "number"){
		if(!Number.isInteger(input)) return false;
	}
	else if(type == "string") { 
		if (typeof input != 'string') return false;
	}
	else if (type[0]=='[' ){ 
		if(!Array.isArray(input) || !input.map(a=>validation(a,type.slice(1,-1))).reduce((a,b)=>a&&b,true))
			return false;
	}
	else if (!input.type || input.type != type) return false;
	
	if(validation)
	{
		if(Array.isArray(validation) && validation.indexOf(input) ==-1) return false;
		if(validation.min && validation.min > input) return false;
		if(validation.max && validation.max < input) return false;
	}
	return true;
}

function buildProjectType(key,inputs,outputs,target)
{
	var projectType = {};

	projectType.key = key;
	projectType.target = target;
	projectType.inputsIndex = inputs;
	projectType.outputsIndex = outputs;
	
	projectType.inputs=[];
	for(var i in inputs)projectType.inputs.push({name:i,value:inputs[i]});
	
	projectType.outputs=[];
	for(var i in outputs)projectType.outputs.push({name:i,value:outputs[i]});
	
	return projectType;
}



var technologies = [

];


var sampleCrop = {
	name: "Grain - R",
	type: "Crop",
	baseOutput: 10,
	cropType: "Staple", // Staple, suplement
	seasons: {
		"mild wet winter": 0,
		"harsh wet winter": -2,
		"mild dry winter": -3,
	},
	humity: {
		4:-1,
		3:0,
		2:-2,
	}
}

// Farmer Requires:
// One Land (specific type, various by instance, some illegal)
// One Specific Improvement (or multiples?)
// An array of Crops (specific but unspecified)
// Improvements 
//		Multipliers
//		Additions
//		Altered Base Costs
// So much comes from crops? 
// Am I trying to make this too complicated?

function farmYeild (land,landImprovement,typeUpgrades,cropArray,modifiers)
{
	// determine number of farmers
	// land, landImprovement, self, typeUpgrades
	
	//screen for invalid combos
	// land, landImprovement
	
	//figure crops contribution
	// cropArray, land
	var maxCrop = Math.max (cropArray.output);
	
	// add crop bonuses
	// cropArray, land
	var cropBase = maxCrop;
	var cropOutputs = Math.sum(cropArray.output)-cropBase;
	var cropResult = cropBase + Math.round(Math.pow(cropOutputs,2)/1.5);
	// 10, 12, 13, 14

	// modifiers
	modifiers.sort(modiferSortFunction);
	for (var i of modifiers) cropResult = i.alterOutput(self,cropResult)
}

function cultureString()
{
	var result = [];
	for(var i = 0;i<20;i++)
	{
		result[i]="ABCDEFGHIJKLMNOPQRST"[Math.floor(Math.random()*20)];
	}
	return result;
}