//TODO: factor into sub functions

function tick(){
	for(var order of game.orders().reverse())
	{
		order.removeFromOrigin();
		var fleet = order.fleet;
		game.movingFleets.push(MovingFleet(fleet,order.origin.position,order.destination));
	}
	game.orders([]);
	for(var movingFleet of game.movingFleets()){
		movingFleet.move();
		if(movingFleet.position == movingFleet.destination)
		{
			var planet = game.getPlanetAtPosition(movingFleet.destination);
			var activeFleet = planet?planet.fleets().filter(a=>a.owner()==movingFleet.fleet.owner())[0]:undefined;
			if(activeFleet)
				activeFleet.combine(movingFleet.fleet);
				/*
				for(var unit of movingFleet.fleet.units())
				{
					var mergeUnit = activeFleet.units().filter(a=> a.type.name == unit.type.name)[0];
					if(mergeUnit)
						mergeUnit.count(mergeUnit.count()+unit.count());
					else
						activeFleet.push(unit);
				}
				*/
			else 
				planet.fleets.push(movingFleet.fleet);
			
			game.movingFleets.remove(movingFleet);
		}
	}
	var mergeTolerance = .25; //turn fractions spent merging
	//TODO: set merge number in config, not here
	//TODO: match all and then combine (handle a string)
	game.movingFleets().sort((a,b)=> {
		a.fleet.speed() != b.fleet.speed()?a.fleet.speed() - b.fleet.speed()
		:a.destination.x()!=b.destination.x()?b.destination.x()-a.destination.x()
		:a.destination.y()!=b.destination.y()?b.destination.y()-a.destination.y()
		:a.position.x()!=b.position.x()?b.position.x()-a.position.x()
		:a.position.y()!=b.position.y()?b.position.y()-a.position.y()
		:0
	})
	for(var i=1;i<game.movingFleets().length;i++){
		var a =game.movingFleets()[i-1];
		var b =game.movingFleets()[i];
		if(distance(a.position,b.position)<mergeTolerance){
			a.position.x(a.position.x()/2+b.position.x()/2);
			a.position.y(a.position.y()/2+b.position.y()/2);
			game.movingFleets.remove(b);
			a.fleet.combine(b.fleet);
			i--;
		}
	}
	game.movingFleets(game.movingFleets().filter(mf=>!mf.fleet.empty()));
	for(var productionChange of game.productionChanges()){
		productionChange.planet.currentProduction(productionChange.production);
	}
	for(var planet of game.galaxy())
	{
		//Do production before combat so we can fairly defeat all troops and take over planet
		//TODO: produce less depending on planet's status.
		var type = planet.currentProduction();
		if(type && type.name != "peace"){//TODO: accomodate Different production choices better
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
			//TODO: test cases!
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
			if(power[1]!=0 && power[0]!=0) //don't run no contest battles
			{
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
			}

			
			//Ground Mode
			//TODO: Allow variations of the casulty rate!
			//TODO: Allow space superiority to matter?
			var troopPower = [attackFleets.reduce((total,fleet)=>total+fleet.troopPower(),0),
				defendFleets.reduce((total,fleet)=>total+fleet.troopPower(),0)
			];
			var remainingTroops = battleRound(...troopPower);
			attackFleets.forEach( fleet => fleet.takeCausulties('infantry',remainingTroops[0]/troopPower[0]));
			defendFleets.forEach( fleet => fleet.takeCausulties('infantry',remainingTroops[1]/troopPower[1]));
		}
		planet.fleets().filter(planet => planet.empty()).forEach(fleet => planet.fleets.remove(fleet));
		if(game.diplomacy.status(planet.fleets().map(fleet=> fleet.owner().name)) == "unified" && planet.fleets()[0].owner().name != planet.owner().name)
			planet.owner(planet.fleets()[0].owner());
	}
}