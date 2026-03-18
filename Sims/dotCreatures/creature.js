var types = {};
types.creatureTypeAttributes =["move","reproductiveScatter","color","growth","startingStorage","upkeep","reproductionPoint","reproductionCost","consumes","displayOrder"];
types.creatureTypes = ko.observableArray([]);
types.byName = ko.computed(function (){
	var result = [];
	for(var type of types.creatureTypes())
		result[type.name()]=type;
	return result;
});
var CreatureType = function (config)
{
	var type = {};
	for(var attribute of types.creatureTypeAttributes)
		if(!config[attribute] && config[attribute]!=0)
			config[attribute]=defaultCreature[attribute];
	if(!config.name) throw Error ("screaming Fit! No name for this creature type!");
	type.name = ko.observable(config.name); //TODO: should this be changable or not? should an id number be added?
	type.move = Distance(config.move);
	type.color = ko.observable(config.color);
	type.growth = ko.observable(config.growth);
	type.startingStorage = ko.observable(config.startingStorage);
	type.upkeep = ko.observable(config.upkeep);
	type.reproductionPoint = ko.observable(config.reproductionPoint);
	type.reproductionCost = ko.observable(config.reproductionCost);
	type.displayOrder = ko.observable(config.displayOrder);
	
	type.consumes = ko.observableArray([]); 
	config.consumes.forEach(entry => type.consumes.push({name:entry.name, effeciency:ko.observable(entry.effeciency)}));
	type.reproductiveScatter = Distance(config.reproductiveScatter);
	
	type.removeConsumes = function (entry){
		type.consumes.remove(entry);
	}
	type.addConsumes = function (){
		type.consumes.push({name:"",effeciency:ko.observable(50)})
	}
	return type;
}
var initializeCreatureTypes = function (creatureConfig){
	if(!window.localStorage['TaxonomyNameList'])window.localStorage['TaxonomyNameList']="[]";
	types.creatureTypes([]);
	for(var config of creatureConfig){
		var type = CreatureType(config);
		types.creatureTypes.push(type);
	}	
	return types;
}
var saveCreatureTypes = function (saveReference,creatures,overwrite){
	var creatureTypeList=[];
	var taxonList = JSON.parse(window.localStorage['TaxonomyNameList']);
	if(overwrite && taxonList.indexOf(saveReference)==-1)overwrite = false;
	if(!overwrite && taxonList.indexOf(saveReference)!=-1) return "THIS NAME IS ALREADY IN USE!";
	for(var dynamicCreature of creatures)
	{
		var staticCreature = {};
		var attributesToCopy = ["name","color","growth","startingStorage","upkeep","reproductionPoint","reproductionCost","displayOrder"];
		for(var attribute of attributesToCopy) staticCreature[attribute] = dynamicCreature[attribute]();

		staticCreature.move = dynamicCreature.move.toStruct();
		staticCreature.reproductiveScatter = dynamicCreature.reproductiveScatter.toStruct();
		
		staticCreature.consumes = dynamicCreature.consumes().map(entry => {return {name:entry.name,effeciency:entry.effeciency()}});
		creatureTypeList.push(staticCreature);
	}
	window.localStorage[saveReference] = JSON.stringify(creatureTypeList);
	if(!overwrite){
		taxonList.push(saveReference);
		window.localStorage['TaxonomyNameList'] = JSON.stringify(taxonList);
	}
	return "";
}
var defaultCreature = {
	move: 0,
	reproductiveScatter:1,
	color:'#880088',
	growth:0,
	startingStorage:10,
	upkeep:10,
	reproductionPoint:100,
	reproductionCost:50,
	consumes:[],
	displayOrder:0
}
var nextCreatureID = 10000;
var Creature = function (creatureType,startingPosition,energy,age){
	var creature = {};
	creature.type = creatureType;
	creature.id = nextCreatureID++;
	creature.position = startingPosition;
	if(energy==undefined)creature.energy = creatureType.startingStorage();
	else creature.energy = energy;
	creature.age = (age?age:0);
	
	return creature;
}