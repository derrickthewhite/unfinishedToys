function tick(){
	drawMode=false;
	for(var order of game.orders())
	{
		var planet = order.origin;
		var activeFleet = planet.fleets().filter(a=>a.owner()==order.owner)[0];
		for(var unit of order.fleet.units())
		{
			var sources = activeFleet.units().filter(troops => troops.type.name == unit.type.name);
			var total = sources.reduce((sofar,a)=> sofar+a.count(),0);
			if(total < unit.count())
			{
				console.log("TODO: tell the user why we didn't do this! (Not enough troops to do so)");
				continue;
			}
			else 
			{
				//TODO: rounding
				var removed = 0;
				var counter = 0;
				while(unit.count()>removed && counter++<100){
					var current = sources.pop();
					var toRemove = Math.min(current.count(),unit.count());
					removed += toRemove;
					current.count(current.count()-toRemove);
				}
			}
		}
		planet.orders.remove(order);
		var fleet = order.fleet;
		game.movingFleets.push(MovingFleet(fleet,order.origin.location,order.destination));
	}
	for(var movingFleet of game.movingFleets()){
		movingFleet.move();
		if(movingFleet.position == movingFleet.destination)
		{
			var planet = getPlanetAtLocation({x:movingFleet.destination.x(),y:movingFleet.destination.y()});
			var activeFleet = planet?planet.fleets().filter(a=>a.owner()==movingFleet.fleet.owner())[0]:undefined;
			if(activeFleet)
				for(var unit of movingFleet.fleet.units())
				{
					var mergeUnit = activeFleet.units().filter(a=> a.type.name == unit.type.name)[0];
					if(mergeUnit)
						mergeUnit.count(mergeUnit.count()+unit.count());
					else
						activeFleet.push(unit);
				}
			else 
				planet.fleets.push(movingFleet.fleet);
			
			game.movingFleets.remove(movingFleet);
		}
	}
	console.log(game.galaxy());
	for(var planet of game.galaxy())
	{
		//Do production before combat so we can fairly defeat all troops and take over planet
		//TODO: produce less depending on planet's status.
		var type = planet.currentProduction();
		if(type){//TODO: accomodate Different production choices better
			var fleet = planet.fleets().filter(a=>a.owner() == planet.owner())[0];
			if(!fleet){
				fleet = new Fleet(planet.owner(),[]);
				planet.fleets.push(fleet);
			}
			var addition = Math.round(planet.production/type.cost*roundingTolerance)/roundingTolerance;
			var existing = fleet.units().filter(a=>a.type.name == type.name)[0]
			if(!existing)
				fleet.units.push(Unit(type,planet.owner(),addition));
			else 
				existing.count(Math.round((existing.count()+addition)*roundingTolerance)/roundingTolerance);
		}
		
		if(planet.status() == "Battleground")
		{
			//TODO: 3+ factions!
			//TODO: uneven casulties
			var defendFleets = [];
			var attackFleets=[];
			for(var fleet of planet.fleets())
				if(game.diplomacy.factionRelations[fleet.owner().name][planet.fleets()[0].owner().name]=="warring")
					attackFleets.push(fleet);
				else defendFleets.push(fleet);
			//Space Mode
			//TODO: allow Retreat
			//TODO: defenders advantage

			var power = [attackFleets.reduce((total,fleet)=>total+fleet.power(),0),
				defendFleets.reduce((total,fleet)=>total+fleet.power(),0)
			];
			if(power[0]==power[1]) power[1]+=randomGausian(0,power[1]*battleRate);
			var initalPower = power;
			while(power[0] >0 && power[1] > 0)
				power = battleRound(...power);
			
			var losingFleet = power[0]>0 ? defendFleets: attackFleets;
			var winningFleet = power[1]>0 ? defendFleets: attackFleets;
			var survivalRatio = power[0]>0? power[0]/initalPower[0]: power[1]/initalPower[1];
			
			losingFleet.forEach( fleet => fleet.takeCausulties('ship',0));
			losingFleet.forEach( fleet => fleet.takeCausulties('transport',0));
			winningFleet.forEach (fleet => fleet.takeCausulties('ship',survivalRatio));
			
			//Ground Mode
			//TODO: Allow variations of the casulty rate!
			//TODO: Allow space superiority to matter?
			var troopPower = [attackFleets.reduce((total,fleet)=>total+fleet.troopPower(),0),
				defendFleets.reduce((total,fleet)=>total+fleet.troopPower(),0)
			];
			var remainingTroops = battleRound(...troopPower);
			console.log("Ground Battle",remainingTroops[0]/troopPower[0],remainingTroops[1]/troopPower[1])
			attackFleets.forEach( fleet => fleet.takeCausulties('infantry',remainingTroops[0]/troopPower[0]));
			defendFleets.forEach( fleet => fleet.takeCausulties('infantry',remainingTroops[1]/troopPower[1]));
		}
		planet.fleets().filter(planet => planet.empty()).forEach(fleet => planet.fleets.remove(fleet));
		if(game.diplomacy.status(planet.fleets().map(fleet=> fleet.owner().name)) == "unified" && planet.fleets()[0].owner().name != planet.owner().name)
			planet.owner(planet.fleets()[0].owner());
	}
	drawMode=true;
	draw();
}