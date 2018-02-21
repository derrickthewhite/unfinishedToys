var nextPlanetID = 1000;
function Planet (name,production, location, culture, owner, fleets){
	var planet = {};
	
	planet.id = nextPlanetID++;
	planet.production = production;
	planet.location = location;
	planet.culture = culture;
	planet.name = ko.observable(name);
	
	planet.currentProduction = ko.observable(undefined);
	planet.fleets = ko.observableArray(fleets?fleets:[]);
	planet.owner = ko.observable(owner);
	
	planet.orders = ko.observableArray([]);
	
	planet.productionType = ko.pureComputed(function (){
		if(planet.currentProduction()==undefined) return 'P';
		switch (planet.currentProduction().type)
		{
			case 'infantry': return 'I';
			case 'ship': return 'S';
			case 'transport': return 'T';
		}
	});
	
	planet.infoString = ko.computed(function() {
		if(drawMode && !planet.fleets().length)draw(); //TODO: Find best way to trigger a draw
		return planet.productionType()+(planet.fleets().length? planet.fleets()[0].infoString():"0 0 0");
	});
	
	planet.status = ko.pureComputed(function (){
		var forceLoyalties = planet.fleets().map(a=>a.owner().name);
		var warStatus = root.diplomacy.status(forceLoyalties);
		if(warStatus == "warring") return "Battleground";
		if(forceLoyalties.indexOf(planet.culture.name)==-1) return "Occupied"; 
		return "Peaceful";
	});
	
	return planet;
}