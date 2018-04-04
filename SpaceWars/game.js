function Game (){
	var game = {};
	game.players = ko.observableArray([]);
	game.movingFleets= ko.observableArray([]);
	game.turnsCompleted = ko.observableArray([]);
	
	//production changes: attached to the game or to planets?
	game.productionChanges = ko.observableArray([]);
	game.orders = ko.observableArray([]);
	
	game.createGame = function(factions,playerTypes,map,numSystems){
		game.galaxy = ko.observableArray(buildSetting(numSystems,map,factions));
		game.diplomacy = Diplomacy(factions); //TODO -- interactions with buildSetting?
		
		players = playerTypes.map((type,index)=>type(game,factions[index]));
		game.players(players);
	}
	
	game.load = function (savedState){
		var cultures = savedState.cultures;
		var playerTypes = {"VIEW":View,"AI_PLAYER":AI_Player};
		game.players(savedState.owners.map(savedOwner => playerTypes[savedOwner.type](
			game,
			cultures.filter(culture=> culture.name == savedOwner.owner)[0]
		)));
		var ownerMap = game.players().reduce((out,a)=>{ out[a.owner().name] = a.owner();return out;},{});
		var unitMap = cultures.map(culture=>culture.units).reduce((a,b)=>a.concat(b)).reduce((out,type)=>{out[type.id]=type;return out;},{})

		function buildFleet(savedFleet){ 
			return Fleet(
				ownerMap[savedFleet.owner],
				savedFleet.units.map(unit => 
					Unit(
						unitMap[unit.type],
						ownerMap[unit.owner],
						unit.count
					)
				),
				savedFleet.status
			);
		}
		game.galaxy (savedState.planets.map(planet=>Planet(
			planet.name,
			planet.production,
			planet.position,
			cultures.filter(culture=> culture.name ==planet.culture)[0],
			ownerMap[planet.owner],
			planet.fleets.map(fleet=>buildFleet(fleet)),
			planet.id
		)));
		game.movingFleets(savedState.movingFleets.map(mf=>MovingFleet(
			buildFleet(mf.fleet),
			mf.position,
			mf.destination,
			mf.id
		)));
		game.orders(savedState.orders.map(order => Order(
			buildFleet(order.fleet),
			game.movingFleets().concat(game.galaxy()).filter(origin=>origin.id == order.origin)[0],
			order.destination
		)));
		game.productionChanges(savedState.productionChanges.map(change=>ProductionChange(
			game.galaxy().filter(planet=>planet.id == change.planet)[0],
			unitMap[change.production]
		)));
	}
	//TODO: move functionality to Galaxy?
	game.getPlanetAtPosition = function(position){
		return game.galaxy().filter(planet => planet.position.x() == position.x() && planet.position.y() == position.y())[0];
	}
	//TODO: move functionality to Galaxy?
	game.getObjectsAtPosition = function(position){
		return {planets : game.galaxy().filter(planet => 
			planet.position.x() == position.x() 
			&& planet.position.y() == position.y()
		),
		orders : game.orders().filter(order =>
			Math.abs(order.midpoint.x() - position.x())<1 
			&& Math.abs(order.midpoint.y() - position.y())<1
		),
		fleets : game.movingFleets().filter(fleet =>
			Math.abs(fleet.position.x() - position.x())<1 
			&& Math.abs(fleet.position.y() - position.y())<1
		)};
	}
	
	game.save = function (){
		var result = {};

		result.productionChanges = game.productionChanges().map(change=>change.save());
		result.planets = game.galaxy().map(p=>p.save());
		result.movingFleets = game.movingFleets().map(mf=>mf.save());
		result.orders = game.orders().map(order=>order.save());
		result.cultures = game.galaxy().map(p=>p.culture).filter((culture,index,cultures)=>cultures.indexOf(culture)==index);
		result.owners = game.players().map(p=>{
			return {
				owner:p.owner().name,
				type:p.playerType
			}
		})
		return result;
	}
	//REGION commands
	//TODO: authenticate user giving command... far in future
	game.addOrder = function(order){
		//TODO: remove orders!
		//TODO: make this the enforced canonical way
		//TODO: reject invalid orders 
		//	not enough transports
		//	not enough units
		game.orders.push(order);
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
