var nextPlanetID = 1000;
function Planet (name,production, position, culture, owner, fleets){
	var planet = {};
	
	planet.id = "Planet_"+(nextPlanetID++);
	planet.production = production;
	planet.position = position;
	planet.culture = culture;
	planet.name = ko.observable(name);
	
	planet.currentProduction = ko.observable({name:"peace"});
	planet.fleets = ko.observableArray(fleets?fleets:[]);
	planet.owner = ko.observable(owner);
	
	planet.orders = ko.observableArray([]);
	
	planet.productionType = ko.pureComputed(function (){
		if(planet.currentProduction().type==undefined) return 'P';
		switch (planet.currentProduction().type)
		{
			case 'infantry': return 'I';
			case 'ship': return 'S';
			case 'transport': return 'T';
		}
	});
	
	planet.infoString = ko.computed(function() {
		return planet.productionType()+(planet.fleets().length? planet.fleets()[0].infoString():"0 0 0");
	});
	
	planet.status = ko.pureComputed(function (){
		var forceLoyalties = planet.fleets().map(a=>a.owner().name);
		var warStatus = game.diplomacy.status(forceLoyalties);
		if(warStatus == "warring") return "Battleground";
		if(forceLoyalties.indexOf(planet.culture.name)==-1) return "Occupied"; 
		return "Peaceful";
	});
	
	return planet;
}

function productionChange(planet,production)
{
	//TODO: report if not valid
	if(planet.culture.units.indexOf(production)==-1) 
		return {planet:planet,production:undefined};
	var change = {};
	change.planet = planet;
	change.production = production;
	return change;
}