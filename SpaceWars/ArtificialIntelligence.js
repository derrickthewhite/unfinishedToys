function AI(game,ownerID){
	var ai = {};
	ai.owner = ownerID;
	
	//TODO: consider numbers other than fleet power
	ai.fleetMovementMap = function (planets,fleets){
		return planets.concat(fleets).reverse().
		reduce((out,origin) => 
			out.concat(origin.fleets().map(fleet => 
				{
				return {
					origin:origin,
					fleet:fleet,
					productionRate:origin.production?origin.production:0,
					destinations:planets.map(destination => {
						return {
							destination:destination,
							distance: Math.ceil(distance(origin.position,destination.position)/fleet.speed())
						}
					}
				)}}
			)),
			[]
		);
	}
	
	ai.strongPositions = function (planets,fleets,troops){
		
		var unitTypeToBuild = troops?"infantry":"ship";
		var powerFunction = troops?"troopPower":"power";
		
		var result = [];
		var locales = planets.concat(fleets);
		locales.forEach(locale => result[locale.id]=[]);
		var fleetMovementMap = ai.fleetMovementMap(planets,fleets);
		var maxTime = fleetMovementMap.reduce((out,fleet) => Math.max(out,fleet.destinations.reduce((out,destination)=>Math.max(out,destination.distance),0)),0);

		//TODO: include planet production into calcs
		for(var time = 0; time <= maxTime; time++)
		{
			locales.forEach(
				locale =>
				result[locale.id][time]={
					origin:locale,
					power:game.diplomacy.possibleStatus.reduce(
						(out,status) => {out[status]=0; return out},[]
					)
				}
			);
			fleetMovementMap.forEach(
				fleet => 
				fleet.destinations.forEach(
					destination => 
					result[destination.destination.id][time].power[
						game.diplomacy.factionRelations[ai.owner.name][fleet.fleet.owner().name]] 
						+=(destination.distance<=time?fleet.fleet[powerFunction]():0)
				)
			);
			//*
			fleetMovementMap.forEach(
				fleet => {
					var productionRate = 0;
				if(fleet.origin.production){ //duck typing for is a planet
					var buildUnit = fleet.origin.culture.units.filter(unitType=>unitType.type==unitTypeToBuild)[0];//TODO: optimize unit chosen
					productionRate = fleet.productionRate*buildUnit.power/buildUnit.cost; 
				}
				
				result[fleet.origin.id][time].power[
					game.diplomacy.factionRelations[ai.owner.name][fleet.fleet.owner().name]] 
					+= time*productionRate;
				}
			);
			//*/
		}
		return result;
	}
	
	ai.classifyFriendlyPlanetFuture = function (predictedHistory,horizon){
		
		var highestEnemyRatio = predictedHistory.slice(0,horizon)
			.reduce((out,history)=> 
				Math.max(out,history.power.warring/history.power.unified)
			,0);
		
		//TODO: refine these numbers
		var abandonDelay= 1.7;
		var delayReinforce = .9;
		var reinforceAttack = .6;
		
		if(highestEnemyRatio > abandonDelay) return "abandon";
		if(highestEnemyRatio > delayReinforce) return "delay";
		if(highestEnemyRatio > reinforceAttack) return "reinforce";
		return "attack";
	}
	
	ai.classifyEnemyPlanetBattleOdds = function (predictedHistory,horizon){
		
		//TODO: refine these numbers!
		var goodOdds = 1.5;
		var exceptionalOdds = 3;
		var fairOdds = 1.1;
		
		var ratioHistory = predictedHistory.slice(0,horizon).map(history => history.power.unified/history.power.warring);
		var maxPower = ratioHistory.reduce((out,history,index)=>out.power<history? {power:history,index:index}: out,{power:0,index:-1});
		
		//recommendation
		if(maxPower.power > exceptionalOdds)
			return 2;
		if(maxPower.power > goodOdds)
			return 1;
		if(maxPower.power > fairOdds)
			return 0;
		return -1;
	}
	
	ai.planetsSpareUnits = function (predictedHistory,horizon){
		var spareUnits = Infinity;
		for(var time = 0; time <= horizon; time++){
			var turn = predictedHistory[time]
			spareUnits = Math.min(spareUnits,turn.power.unified-turn.power.warring);
		}
		return spareUnits;
	}
	
	ai.horizon = function (analysis){
		//TODO: should horizon be the time to defend any of their worlds? 
		var endTotals = analysis[Object.keys(analysis)[0]][analysis[Object.keys(analysis)[0]].length -1].power; // analysis has enough time for every ship to go everywhere
		var horizon = Math.min(...(Object.keys(analysis).map(
			key => Math.min(...analysis[key].map(
				// Horizon is the amount of time needed for the enemy to move all ships to one position
				//(data,time) => data.power.warring == endTotals.warring?time:Infinity 
				//Horizon is amount of time needed for enemy to move 90% of ships to one position
				(data,time) => data.power.warring >= endTotals.warring*.9?time:Infinity 
				))
		)));
		return horizon;
	}
	
	ai.attackAndAbandon = function (){
		// abandon weak points, attack the enemies' weak points, reinforce neccisary points
		// jump ship immediately or just in time?

		var analysis = ai.strongPositions(game.galaxy(),game.movingFleets());
		var extraUnits = [];
		
		var horizon = ai.horizon(analysis);
		
		//TODO: factor these functions
		function analyzePlanetsWithHorizon(tool,isOwner){
			return Object.keys(analysis).map((key)=>analysis[key]).filter(planetHistory => (planetHistory[0].origin.owner() == ai.owner)==isOwner).map(
				planetHistory => { return{action:tool(planetHistory,horizon),origin:planetHistory[0].origin}}
			);
		}
		var spareUnits = analyzePlanetsWithHorizon(ai.planetsSpareUnits,true);
		var planetStatus = analyzePlanetsWithHorizon(ai.classifyFriendlyPlanetFuture,true);
		planetStatus.forEach((origin,index)=>origin.units = spareUnits[index].action);
		//TODO: target status distinguish between ally, neutral, and enemy
		var targetStatus = analyzePlanetsWithHorizon(ai.classifyEnemyPlanetBattleOdds,false);
		
		return {enemyStatus:targetStatus,freindlyStatus:planetStatus,spareUnits:spareUnits,horizon:horizon};
	}
	ai.rallyPoint = function (toRetreat,freindlyStatus){
		//TODO: nearest is not necessarily best
		//TODO: consider fleets as well as planets
		//TODO: consider empty space?
		return freindlyStatus.filter(locale => ["attack", "reinforce"].indexOf(locale.action)!=-1 && locale.origin.production)
			.map(locale => locale.origin)
			.map(origin => {return {distance:distance(toRetreat.position,origin.position),destination:origin}})
			.sort((a,b)=>a.distance<b.distance?-1:1)[0];
	}
	ai.troopsNeeded = function (targetPlanet, analysis){
		
	}
	ai.troopMovements = function (){
		//TODO: consider troops and ships separately
		var toMove = ai.attackAndAbandon();
		var retreats = toMove.freindlyStatus.filter(origin => origin.action == "abandon")
			.map(origin => {return {
				toMove:origin.origin,
				destination: ai.rallyPoint(origin.origin,toMove.freindlyStatus).destination,
				units: -origin.units
			}});
		
		var attacks = toMove.enemyStatus.filter(origin => origin.action > 0);
		//TODO: don't attack if you will be overwhelmed
		//TODO: time attacks to arrive all at the same time
		//TODO: nearest isn't always best
		
		//TODO: possible to have not hot spots!
		var hotSpots = attacks.map(a=>a.origin).concat(retreats.map(a=>a.destination));
		
		var moves = toMove.freindlyStatus.filter(origin => origin.action == "attack")
			.map(origin => {
				return {
					toMove: origin.origin,
					destination: hotSpots.reduce((a,b)=> distance(a.position,origin.origin.position) < distance(b.position,origin.origin.position)?a:b),
					units:origin.units 
				}
			});
		return moves.concat(retreats);
	}
	ai.purchaseChoices = function (){
		//TODO: consider transports and troop types
		function choice (action){
			switch(action){
				case "abandon":
				case "delay": return "infantry";
				case "reinforce":
				case "attack": return "ship";
			}
		}
		return ai.attackAndAbandon().freindlyStatus
			.filter(locale=>locale.origin.production)
			.map(planet => {
				return {planet:planet.origin,build:choice(planet.action)};
			});
	}
	return ai;
}

function AI_Player(game,owner){
	var player = {};
	var ai = AI(game,owner); //The AI itself is an analysis tool, not a player
	player.owner = function (){return owner};
	player.playerType = "AI_PLAYER";
	var grabRequestedFleet = function (location,owner,numbers){
		//TODO: optimize unit types grabbed
		var units = location.fleets().filter(fleet => fleet.owner()==owner)
			.map(fleet=>fleet.units())
			.reduce((a,b)=>a.concat(b));
		return numbers.map(unitRequest => {
			var runningTotal=0;
			var available = units.filter(unit=>unit.type.type == unitRequest.type);
			var sumSoFar = available.map(unit => {runningTotal+=unit.power()});
			var indexToGrab = sumSoFar.findIndex(a=> a> unitRequest.count);
			var unitsToUse = available.slice(0,indexToGrab==-1?undefined:indexToGrab+1).map(unit=>unit.copy());
			var powerToLeave = indexToGrab==-1?0:sumSoFar[indexToGrab]-unitRequest;
			var unitToSplit = unitsToUse[unitsToUse.length-1];
			unitToSplit.count(unitToSplit.count() - powerToLeave/unitToSplit.type.power);
			return unitsToUse;
		}).reduce((a,b)=>a.concat(b));
	};
	player.takeTurn = function (){
		ai.purchaseChoices().forEach(choice => game.addProductionChanges(ProductionChange(
			choice.planet,
			choice.planet.culture.units.filter(unit => choice.build==unit.type)[0]
		)));
		//TODO: sort out what is and isn't required to be stored in an order
		ai.troopMovements().forEach(choice => game.addOrder(Order(
			Fleet(owner,grabRequestedFleet(choice.toMove,owner,[{type:"ship",count:choice.units}]),"space"),
			choice.toMove,
			{
				x:ko.unwrap(choice.destination.position.x),
				y:ko.unwrap(choice.destination.position.y),
				name:game.getPlanetAtPosition(choice.destination.position).name()
				//objects:game.getObjectsAtPosition(choice.destination.position),
				//planet:game.getPlanetAtPosition(choice.destination.position)
			}
		)));
		game.readyToTick(owner);
	}
	player.ai= ai;
	return player;
}