function Game (){
	var game = {};
	game.players = ko.observableArray([]);
	game.movingFleets= ko.observableArray([]);
	
	//Orders and production changes: attached to the game or to planets?
	game.productionChanges = ko.observableArray([]);
	game.orders = ko.pureComputed(function (){
		var orders=[];
		for(var planet of game.galaxy())
		{
			orders = orders.concat(planet.orders());
		}
		return orders;
	});
	
	game.createGame = function(factions,map,numSystems){
		game.players(factions);
		game.galaxy = ko.observableArray(buildSetting(numSystems,map,factions));
		game.diplomacy = Diplomacy(factions); //TODO -- interactions with buildSetting?
	}
	
	game.addProductionChanges = function (changes){
		if(!Array.isArray(changes)) changes = [changes];
		var preseveredChanges = game.productionChanges().filter(old => changes.map(c => c.planet).indexOf(old.planet)==-1);
		game.productionChanges(preseveredChanges.concat(changes));
	}

	game.getPlanetAtPosition = function(position){
		return game.galaxy().filter(planet => planet.position.x == position.x && planet.position.y == position.y)[0];
	}
	game.getObjectsAtPosition = function(position){
		return {planets : game.galaxy().filter(planet => 
			planet.position.x == position.x 
			&& planet.position.y == position.y
		),
		orders : game.orders().filter(order =>
			Math.abs(order.midpoint.x - position.x)<1 
			&& Math.abs(order.midpoint.y - position.y)<1
		),
		fleets : game.movingFleets().filter(fleet =>
			Math.abs(fleet.position.x() - position.x)<1 
			&& Math.abs(fleet.position.y() - position.y)<1
		)};
	}
	return game;
}
