function Planet (type,size,orbit)
{
	//TODO: moons
	var planet = {};
	planet.type = ko.observable(type);
	planet.size = ko.observable(size);
	planet.orbit = ko.observable(orbit);
	planet.alternateType =ko.observable(Math.random()>.5); //TODO: move to generator and refine odds
	
	planet.viewDistance = ko.pureComputed(function (){
		//TODO: make 700+100 a changeable and important number
		var star = planet.orbit().center();
		var range = Math.log(star.outerLimit())-Math.log(star.innerLimit());
		var num =  700* (Math.log(planet.orbit().distance()) - Math.log(star.innerLimit()))/range+100;
		return num;
	});
	
	planet.blackBody = ko.pureComputed(function (){
		return 278*Math.pow(planet.orbit().center().luminosity(),.25)/Math.pow(planet.orbit().distance(),.5);
	});
	
	planet.terrain = ko.pureComputed(function () {
		//TODO: determine Ammonia Status
		if(planet.type() != "terrestrial") return planet.type();
		if(planet.size() == 1) return planet.blackBody() > 140? 'Rock': planet.alternateType()? 'Sulfer':'Hadean'; 
		if(planet.size() == 2) return planet.blackBody() > 140? 'Rock': planet.blackBody() > 80? 'Ice': 'Hadean';
		return planet.blackBody() > 500? 'Chthonian': planet.blackBody() > 320? 'Greenhouse':
			planet.blackBody() > 240? planet.alternateType()? 'Garden':'Ocean': planet.blackBody() > 230? 'Ice':
			planet.blackBody() > 150? planet.alternateType()? 'Ammonia':'Ice': planet.blackBody() > 80? 'Ice': 
			planet.size() == 3?'Hadean':'Ice';
	});
	
	planet.temperature = ko.pureComputed(function (){
		var absorbtionFactor = 1;
		var greenhouseFactor = 0;
	})
	
	planet.drawnRadius = ko.pureComputed(function (){
		if(planet.size() < 1) return 2;
		return planet.size()*5 +(planet.type() == 'giant'?15:0);
	});
	
	//do with surface temp, not blackbody
	planet.temperature = ko.pureComputed(function() {
		var blackBodyCorrection = getBlackbodyCorrection(planet.terrain(),planet.size(),planet.hydrographicCoverage(),planet.atmosphere.mass());
		return 9/5*(planet.blackBody()*blackBodyCorrection-273)+32;
	});
	
	planet.drawnColor = ko.pureComputed(function () {
		switch (planet.terrain())
		{
			case "giant": return "orange";
			case "asteroid": return "brown";
			case "none": return "black";
			case "Rock": return "brown";
			case "Ice": return "white";
			case "Ammonia": return "teal";
			case "Hadean": return "gray";
			case "Sulfer": return "yellow";
			case "Ocean": return "blue";
			case "Garden": return "green";
			case "Greenhouse": return "yellow";
			case "Chthonian": return "brown";
		}
		console.log("BAD INPUT for PLANET TERRAIN!",planet.terrain());
		return "purple";
	});
	
	planet.atmosphere = generateAtmosphere(planet.terrain(), planet.size());
	planet.hydrographicCoverage = ko.observable(getHydrographicCoverage(planet.terrain(),planet.size()));
	//TODO make these three interactive!
	//TODO: remove gas giants from equation!
	planet.densitySeed = ko.observable(Distribution(random.coreDensity).get(dice(3)));
	planet.density = ko.pureComputed(function () { return planet.densitySeed()+(planet.size()>=3?.5: planet.terrain=='Rock'?.2:0)});
	planet.diameterSeed = ko.observable((dice(2)-2)/10);
	planet.diameter = ko.pureComputed(function (){
		var constraints = lookup.planetSize[planet.size()]
		console.log(constraints, planet.diameterSeed(), planet.density());
		return (planet.diameterSeed()*(constraints.max - constraints.min)+constraints.min)* Math.pow(planet.blackBody()/planet.density(),.5);
	});
	planet.gravity = ko.pureComputed(function (){
		return planet.diameter()*planet.density();
	});
	planet.atmosphere.pressure = ko.pureComputed(function (){
		
	})

	return planet;
}
function getBlackbodyCorrection (terrain, size, hydrographics,atmosphericMass)
{
		var greenhouse = 0;
		var absorbtionFactor =1;
		switch (terrain)
		{
			case "asteroid": 
			case "Chthonian":
			case "Rock": absorbtionFactor = .97; break;
			case "Hadean": absorbtionFactor = size==1?.86:67; break;
			case "Greenhouse": 
			case "Sulfer": absorbtionFactor = .77; break;
			case "Ice": absorbtionFactor = size==2?.93:.86;
			case "Ammonia": absorbtionFactor = .84; break;
			case "Ocean": 
			case "Garden": absorbtionFactor = hydrographics<=.2? .95: hydrographics <= .5? .92: hydrographics < .9? .88: .84;
		}
		switch (terrain)
		{
			case "Greenhouse": greenhouse= 2; break; // MORE NUANCE HERE
			case "Ice": greenhouse = size>2?.2:.1;break;
			case "Ammonia": greenhouse = .2; break;
			case "Ocean": 
			case "Garden": greenhouse = .16;break;
		}
		return absorbtionFactor*(1+atmosphericMass*greenhouse);
}
function getHydrographicCoverage (terrain, size)
{
			switch (terrain)
		{
			case "giant": 
			case "asteroid": 
			case "none": 
			case "Hadean":
			case "Sulfer": 
			case "Rock": 
			case "Chthonian": return 0;
			case "Ice": return size>2?Math.min(0,dice(2)/10-1):(dice()+2)*.1;
			case "Ammonia": //TODO: DO SEPERATLY. MAYBE
			case "Ocean": 
			case "Garden": return Math.min(1,(dice()+(size-1)*2)*.1);
			case "Greenhouse": return "yellow";
		}
		console.log("BAD INPUT for PLANET TERRAIN!",planet.terrain());
		return 1;
}
function generateAtmosphere(terrain, size)
{
	var atmosphere= {};
	atmosphere.mass = ko.observable((dice(3)-1+Math.random())/10);
	atmosphere.tags = ko.observableArray([]); //TODO generate tags
	atmosphere.toxicty = ko.observable(1); // 0 is safe. 
	atmosphere.marginal = ko.observable("Safe");

	if(terrain == "Sulfur" || terrain == "Hadean" || terrain == "Rock" || terrain == "Cthonian") {
		atmosphere.mass(0);
	} else if (terrain == 'Ice'){
		atmosphere.toxicty(dice(3)<21-size*3 || size ==4?3:2); 
	} else if (terrain == "Ammonia"){
		atmosphere.toxicty(4);
	} else if (terrain == "Ocean"){
		atmosphere.toxicty(size==4? 3: dice(3)-12>=0? 2:1);
	} else if (terrain == "Greenhouse") {
		atmosphere.toxicty(4)
	} else if (terrain == "Garden")
	{
		//TODO: alterante marginal qualities
		atmosphere.marginal(Distribution(random.marginalAtmosphereType).get(dice(3)));
		if(dice(3)<12) atmosphere.marginal("Safe");
		atmosphere.toxicty(getMarginalAtmosphereToxicity(atmosphere.marginal(),atmosphere.mass()));
	}
	return atmosphere;
}
function getMarginalAtmosphereToxicity(atmosphere, atmosphereMass)
{
	switch(atmosphere){
		case "Chlorine": return 2;
		case "High CO2": return 1; // TODO-- option for just inconvenient
		case "High Oxygen": return 1; // TODO-- interaction with mass
		case "Inert Gases": return 0;
		case "Low Oxygen": return 0; // TODO -- interaction with mass
		case "Nitrogen Compounds": return 1;
		case "Sulfur Compounds": return 1;
		case "Organic Toxins": return 1; //TODO -- variants
		case "Pollutants": return 0; // TODO -- option for heavier
		case "Safe": return 0;
	}
	console.log("BAD ASSUMPTION!",atmosphere);
}
function generateTerrestialPlanet(orbit,star,sizeModifiers){
	var size = Distribution(random.terrestialPlanetSize).get(dice(3)+sizeModifiers);
	var type = size==-1? "none": size ==0? "asteroid" : "terrestrial";
	
	//TODO: add eccentricity
	return Planet(type,size,new Orbit(orbit,0,star));
}

function generateGasGiant(orbit,star,sizeModifiers){
	var size = Distribution(random.gasPlanetSize).get(dice(3)+sizeModifiers);
	return Planet('giant',size,new Orbit(orbit,0,star));
}
function generatePlanet(systemType, orbit, star){
	var planetType = "giant";
	if(orbit >= star.snowLine())switch (systemType){
		case 'none': planetType = 'terrestrial'; break;
		case 'conventional': planetType =  (dice(3) > 15 ? 'terrestrial': 'giant'); break;
		case 'eccentric': 
		case 'epistellar': planetType =  (dice(3) > 14 ? 'terrestrial': 'giant'); break;
	}
	else switch (systemType){
		case 'none': 
		case 'conventional': planetType = 'terrestrial';break;
		case 'eccentric':  planetType =  (dice(3) > 8 ? 'terrestrial': 'giant'); break;
		case 'epistellar': planetType =  (dice(3) > 6 ? 'terrestrial': 'giant'); break;
	}
	//TODO: add size modifiers
	return planetType == 'giant'? generateGasGiant(orbit,star,0): generateTerrestialPlanet(orbit,star,0);
}
