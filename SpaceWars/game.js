function Game (){
	var game = {};
	game.players = ko.observableArray([]);
	game.movingFleets= ko.observableArray([]);
	game.turnsCompleted = ko.observableArray([]);
	
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
	
	game.createGame = function(factions,playerTypes,map,numSystems){
		game.galaxy = ko.observableArray(buildSetting(numSystems,map,factions));
		game.diplomacy = Diplomacy(factions); //TODO -- interactions with buildSetting?
		
		players = playerTypes.map((type,index)=>type(game,factions[index]));
		game.players(players);
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
	
	//REGION commands
	//TODO: authenticate user giving command... far in future
	game.addOrder = function(order){
		//TODO: make game store orders, not planets!
		//TODO: remove orders!
		//TODO: make this the enforced canonical way
		//TODO: reject invalid orders 
		//	not enough transports
		//	not enough units
		order.origin.orders.push(order);
	}
	game.addProductionChanges = function (changes){
		//TODO: reject invalid production changes
		if(!Array.isArray(changes)) changes = [changes];
		var preseveredChanges = game.productionChanges().filter(old => changes.map(c => c.planet).indexOf(old.planet)==-1);
		game.productionChanges(preseveredChanges.concat(changes));
	}
	game.readyToTick = function (readyPlayer){
		if(game.turnsCompleted().indexOf(readyPlayer)==-1){
			game.turnsCompleted.push(readyPlayer);
			if(game.players().length == game.turnsCompleted().length){
				//console.log("VIRTUAL TICK");
				game.runRound();
			}
		}
		return game.players().length - game.turnsCompleted().length;
	}
	//ENDREGION
	
	//REGION push notifications
	game.runRound = function (){
		tick();
		game.turnsCompleted([]);
		game.players().forEach(player=>player.takeTurn());
	}
	//ENDREGION
	return game;
}
