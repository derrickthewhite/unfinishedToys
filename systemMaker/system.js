var nextSystemNumber = 10000;
var lastSystemSeed;
function System(){
	var system = {};
	
	system.stars = ko.observableArray([]);
	system.planets = ko.observableArray([]);
	system.gasGiantArrangement = ko.observable("conventional");
	
	system.location = {};
	system.location.x = ko.observable();
	system.location.y = ko.observable();
	system.location.z = ko.observable();
	
	/*
	if(lastSystemSeed != root.seed()){
		lastSystemSeed = root.seed();
		nextSystemNumber = 10000;
	}
	*/
	//system.name = ko.observable((nextSystemNumber++).toString(36));
	system.name = ko.observable(root.names.getName());
	
	system.habitability = ko.pureComputed(function () {
		return Math.max(...system.planets().map(p => p.habitability()));
	});
	system.affinity = ko.pureComputed(function () {
		return Math.max(...system.planets().map(p => p.affinity()));
	});
	system.resourceValue = ko.pureComputed(function () {
		return Math.max(...system.planets().map(p => p.resourceValue()));
	});
	
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
				//TODO: default case (whose default?)
				//TODO: companions of companions
			}
			for(var forbidden of forbiddenZones)
			{
				var modifiedZones = [];
				for(var zone of zones)
				{
					//TODO: correct boundaries: >=
					// (are they not correct now?)
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
	
	system.population = ko.pureComputed(function () {
		return system.planets().reduce((sofar, planet) => {
			return sofar + planet.population();
		},0);
	});
	
	function getBestOrbitByStar(star,planets)
	{
		var planets = system.planets()
			.filter(planet=>planet.orbit().center() == star)
			.map(planet=>planet.orbit().distance())
			.sort((a,b)=> a-b);
		console.log(planets);

		if(planets.length ==0) return star.snowLine();
		if(planets[0]/star.innerLimit()>1.4)
			return planets[0]/1.4/star.orbitAdjustment();
		if(star.outerLimit()/planets[planets.length-1]>1.4)
			return planets[planets.length-1]*1.4/star.orbitAdjustment();
		for(var i=1;i<planets.length;i++)
			if(planets[i]/planets[i-1] > 2.8)
				return planets[i]*1.4/star.orbitAdjustment();
		return planets[planets.length-1]*1.4/star.orbitAdjustment();
	}
	system.nextBestOrbit = ko.pureComputed(function (){
		var result = [];
		var starOrbits = [];
		var planetLists = [];
		for(var star of system.stars())
		{
			result[star.guid]= getBestOrbitByStar(star,system.planets());
		}
		return result;
	});
	
	system.dryCopy = function () {
		var copy = {};
		copy.stars = system.stars().map(star => star.dryCopy());
		copy.planets = system.planets().map(planet => planet.dryCopy());
		copy.gasGiantArrangement = system.gasGiantArrangement();
		copy.name = system.name();
		
		copy.location = {};
		copy.location.x = system.location.x()
		copy.location.y = system.location.y()
		copy.location.z = system.location.z()
		return copy;
	}
	
	system.water = function (struct) {
		var guidMap = [];
		system.stars(struct.stars.map(starStruct => {
			var star = Star();
			star.water(starStruct);
			guidMap[star.guid] = star;
			star.system(system);
			return star;
		}));
		system.planets(struct.planets.map(planetStruct => {
			var planet = Planet();
			planet.water(planetStruct);
			guidMap[planet.guid] = planet;
			return planet;
		}));
		system.planets().forEach(planet => {
			planet.orbit().connect(guidMap);
		})
		system.stars().forEach(star => {
			star.orbit().connect(guidMap);
		})
		system.location.x(struct.location.x)
		system.location.y(struct.location.y)
		system.location.z(struct.location.z)

	}
	
	return system;
}

function generateSystem()
{
	var system = System();
	var position = generateStarPosition();
	system.location.x(position[0])
	system.location.y(position[1])
	system.location.z(position[2])
	
	var age = starAge();
	var primaryMass = starMass();
	var primaryStar = Star(primaryMass,age, new Orbit(0,0))
	system.stars.push(primaryStar);
	primaryStar.system(system);
	primaryStar.name(system.name()+"-I")
	
	var numStars = starCount(); // TODO: companions of distant companions
	for(var i =1; i< numStars; i++)
	{
		var distanceMultiplier = getStellarOrbitDistance(i==2?6:0);
		var eccentrictyModifier = Math.min(0, Math.floor(Math.log(distanceMultiplier)/ Math.log(10)-1)*2);
		var eccentricty = getStellarOrbitEccentricity(eccentrictyModifier);
		var distance = distanceMultiplier*dice(2);
		var star = Star(companionMass(primaryMass),age, new Orbit(distance,eccentricty,primaryStar));
		system.stars.push(star);
		star.system(system);
		star.name(system.name()+"-"+(system.stars().length==2?"II":"III"))
	}
	
	var inZone = function(distance,zones){
		if(zones.length == 0) return false;
		for(var zone of zones)if(distance > zone.inner && distance < zone.outer) return true;
		return false;
	}
	
	for(var i =0;i< system.stars().length;i++)
	{
		var star = system.stars()[i];
		system.gasGiantArrangement(Distribution(random.gasGiantArrangement).get(dice(3)));
		var orbits = [];
		switch (system.gasGiantArrangement()){
			case "none": 
			case "conventional": orbits.push(star.snowLine()*(dice(2)-2)*0.05+1);break;
			case "eccentric": orbits.push(star.snowLine() * dice()*.125); break;
			case "epistellar": orbits.push(star.innerLimit()*0.1 * dice(3)); break;
		}
		var zones = system.orbitalZones();
		var initialOrbit = orbits[0];
		var currentOrbit = initialOrbit;
		if(!inZone(currentOrbit, zones[i]))orbits.pop();
		
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
		}
		for(var distance of orbits)
		{
			var planet = generatePlanet(system.gasGiantArrangement(),distance,star);
			var modifier = system.gasGiantArrangement() == "conventional"?-6: 
				system.gasGiantArrangement() == "eccentric" && star.snowLine()>= distance? 4:
				system.gasGiantArrangement() == "epistellar" && distance == initialOrbit? -6 : 0;
			var eccentricty = Distribution(random.planetEccentricity).get(dice(3)+modifier);
			planet.orbit().eccentricty(eccentricty);
			if(planet.size() != -1){ // means no planet in this orbit
				system.planets.push(planet);
				planet.name(star.name()+"" +system.planets().length);
			}
		}
	}
	
	//generateMoons
	var moons = [];
	for(var planet of system.planets())
	{
		moons = moons.concat(generateMoons(planet));
	}
	for(var moon of moons)system.planets.push(moon);
	
	//place main settlement
	var settlementRandom = new MersenneTwister(parseInt(Math.random().toString(36).slice(2),36));
	settlementRandom.dice = function (count){
		if(!count)return Math.floor(settlementRandom.random()*6)+1;
		var total = 0;
		for(var i = 0;i<count;i++)
			total+=dice();
		return total;
	}
	var planetsByAffinity = system.planets()
	.filter(p => p.type() != "giant")
	.sort((a,b) => b.affinity() - a.affinity());
	var mainPlanet = planetsByAffinity[0]
	mainPlanet.settlementType("colony");
	mainPlanet.worldUnity(generateWorldUnity(mainPlanet));
	mainPlanet.government(Distribution(root.generation.govGenerator()).get(settlementRandom.dice(3) + Math.min(10,Math.round(mainPlanet.techLevel()))));

	// place other settlements
	var planetOrbitDistance = mainPlanet.isMoon()? mainPlanet.orbit().center().orbit().distance(): mainPlanet.orbit().distance();
	var techLevel = Math.round(mainPlanet.techLevel());
	var accessablePlanets = planetsByAffinity.filter( p => {
		if(p == mainPlanet) return false;
		if(techLevel <7) return false;
		var distance = Number.Infinity;
		var pOrbitDistance = p.isMoon()? p.orbit().center().orbit().distance(): p.orbit().distance();
		if(p.star() == mainPlanet.star()) distance = Math.abs(planetOrbitDistance - pOrbitDistance);
		else distance = Math.abs((p.star().orbit().distance() + mainPlanet.star().orbit().distance())-pOrbitDistance - planetOrbitDistance);
		
		if(techLevel ==7) return distance <= .1;
		if(techLevel ==8) return distance <= 1;
		if(techLevel ==9) return distance <= 10;
		if(techLevel <= 10) return true;
	});
	//TODO: base tech level off of "main colony"
	accessablePlanets.forEach( p => {
		if(p.affinity() > 0) p.settlementType("colony");
		else {
			var roll = settlementRandom.dice(3);
			if(techLevel >= 10 && roll<= 9) p.settlementType("outpost");
			else if (roll <= techLevel-2) p.settlementType("outpost");
			
		}
		if(settlementRandom.dice(3 )+ p.populationRating() >= 20){
			p.government(Distribution(root.generation.govGenerator()).get(settlementRandom.dice(3) + Math.min(10,Math.round(p.techLevel()))));
			p.worldUnity(generateWorldUnity(p));
		}
		else {
			p.government(mainPlanet.government());
			p.worldUnity(mainPlanet.worldUnity());
		}
	});
	return system;
}
