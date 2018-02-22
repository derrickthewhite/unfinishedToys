function AI(ownerID){
	var ai = {};
	ai.owner = ownerID;
	
	ai.strongPositions = function (planets,fleets){
		
		var result = [];
		planets.forEach(planet => result[planet.id]=[]);
		var fleetMovementMap = planets.reduce((out,planet) => 
			out.concat(planet.fleets().map(fleet => 
				{return {planet:planet,fleet:fleet,destinations:planets.map(destination => 
					{return {destination:destination,distance: Math.ceil(distance(planet.location,destination.location)/fleet.speed())
					}}
				)}}
			)),
			[]
		);
		var maxTime = fleetMovementMap.reduce((out,fleet) => Math.max(out,fleet.destinations.reduce((out,destination)=>Math.max(out,destination.distance),0)),0);
		
		for(var time = 0; time <= maxTime; time++)
		{
			//TODO: global access! shame! no! (of game)
			// Or is that ok and everyone should see game?
			planets.forEach(
				planet =>
				result[planet.id][time]={planet:planet,power:game.diplomacy.possibleStatus.reduce(
					(out,status) => {out[status]=0; return out},[]
				)}
			);
			fleetMovementMap.forEach(
				fleet => 
				fleet.destinations.forEach(
					destination => 
					result[destination.destination.id][time].power[game.diplomacy.factionRelations[ai.owner.name][fleet.fleet.owner().name]] += destination.distance<=time?fleet.fleet.power():0
				)
			);
		}
		return result;
	}
	
	ai.attackAndAbandon = function (){
		var analysis = ai.strongPositions();
		var abandon = [];
		var attack = [];
		
		for(var planet in analysis)
		{
			if(planet[0].warring > planet[0].unified) abandon.push({planet:planet,count:planet[0].unified});
		}
		
		//TODO: this basic AI function
		// abandon weak points, attack the enemies' weak points
		// what distance to use as the "horizon"?
		// jump ship immediately or just in time?
		// where to pull people from?
	}
	return ai;
}