function System(){
	var system = {};
	
	system.stars = ko.observableArray([]);
	system.planets = ko.observableArray([]);
	
	system.orbitalZones = ko.pureComputed(function (){
		var starZones = [];
		for(var star of system.stars())
		{
			var innerRadius = star.innerLimit();
			var outerRadius = star.outerLimit();
			var zones = [{inner:innerRadius, outer:outerRadius}];
			var forbiddenZones = [];
			for(var companion of system.stars() )
			{
				if(star == companion) continue;
				else if (star.orbit().center() == companion){
					forbiddenZones.push({
						inner:star.orbit().minDistance()/3,
						outer: Number.POSITIVE_INFINITY
					});
				} else if (companion.orbit().center() == star){
					forbiddenZones.push({
						inner:companion.orbit().minDistance()/3,
						outer:companion.orbit().maxDistance()*3
					});
				} else if(star.orbit().center() == companion.orbit().center())
				{
					//TODO: calculate what this should be
				}
				//TODO: default case
				//TODO: companions of companions
			}
			for(var forbidden of forbiddenZones)
			{
				var modifiedZones = [];
				for(var zone of zones)
				{
					//TODO: correct boundaries: >=
					if(zone.inner >= forbidden.outer || zone.outer <= forbidden.inner) modifiedZones.push(zone);
					else if (zone.inner >= forbidden.inner && zone.outer <= forbidden.outer) continue;
					else if (zone.inner < forbidden.inner && zone.outer > forbidden.outer) {
						modifiedZones.push({inner:zone.inner, outer:forbidden.inner});
						modifiedZones.push({inner:forbidden.outer, outer:zone.outer});
					} else if (zone.inner >= forbidden.inner) modifiedZones.push({inner:forbidden.outer,outer:zone.outer});
					else if (zone.outer <= forbidden.outer) modifiedZones.push({inner:zone.inner,outer:forbidden.inner});
					else console.log("ASSUMPTION ERROR!", zone, forbidden);
				}
				zones = modifiedZones;
			}
			starZones.push(zones);
		}
		return starZones;
	});
	system.isHabitable = ko.pureComputed(function (){
	
		for(var planet of system.planets())
			if(planet.terrain()=="Garden") return true;
		return false;
	});
	return system;
}

function generateSystem(cosmos)
{
	var system = System();
	system.location = {};
	var position = generateStarPosition();
	system.location.x = ko.observable(position[0]);
	system.location.y = ko.observable(position[1]);
	system.location.z = ko.observable(position[2]);
	
	var age = starAge();
	var primaryMass = starMass();
	var primaryStar = Star(primaryMass,age, new Orbit(0,0))
	system.stars.push(primaryStar);
	var numStars = starCount(); // TODO: companions of distant companions
	for(var i =1; i< numStars; i++)
	{
		var distanceMultiplier = getStellarOrbitDistance(i==2?6:0);
		var eccentrictyModifier = Math.min(0, Math.floor(Math.log(distanceMultiplier)/ Math.log(10)-1)*2);
		var eccentricty = getStellarOrbitEccentricity(eccentrictyModifier);
		var distance = distanceMultiplier*dice(2);
		system.stars.push(Star(companionMass(primaryMass),age, new Orbit(distance,eccentricty,primaryStar)));
	}
	
	var inZone = function(distance,zones){
		if(zones.length == 0) return false;
		for(var zone of zones)if(distance > zone.inner && distance < zone.outer) return true;
		return false;
	}
	
	for(var i =0;i< system.stars().length;i++)
	{
		var star = system.stars()[i];
		var gasGiantArrangement = Distribution(random.gasGiantArrangement).get(dice(3));
		var orbits = [];
		switch (gasGiantArrangement){
			case "none": 
			case "conventional": orbits.push(star.snowLine()*(dice(2)-2)*0.05+1);break;
			case "eccentric": orbits.push(star.snowLine() * dice()*.125); break;
			case "epistellar": orbits.push(star.innerLimit()*0.1 * dice(3)); break;
		}
		var zones = system.orbitalZones();
		var initialOrbit = orbits[0];
		var currentOrbit = initialOrbit;
		
		if(zones[i].length != 0)
		{
			do {
				currentOrbit = currentOrbit/ Distribution(random.planetSpacing).get(dice(3));
				if(inZone(currentOrbit,zones[i]))orbits.unshift(currentOrbit);
			} while(currentOrbit > zones[i][0].inner)
			currentOrbit = initialOrbit
			
			do {
				currentOrbit = currentOrbit* Distribution(random.planetSpacing).get(dice(3));
				if(inZone(currentOrbit,zones[i]))orbits.push(currentOrbit);
			}while(currentOrbit < zones[i][zones[i].length-1].outer);
			
			for(var distance of orbits)
			{
				system.planets.push(generatePlanet(gasGiantArrangement,distance,star));
			}
		}
	}
	
	return system;
}