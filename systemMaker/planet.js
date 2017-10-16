function Planet (type,size,orbit,alternateTypes)
{
	var planet = {};
	planet.type = ko.observable(type);
	planet.size = ko.observable(size);
	
	planet.orbit = ko.observable(orbit);
	planet.alternateTypes = {}; 
	planet.alternateTypes.canBeSulfur = ko.observable(alternateTypes[0]);
	planet.alternateTypes.canBeGarden = ko.observable(alternateTypes[1]);
	planet.resourceValue = ko.observable(Distribution(random.gasPlanetSize).get(dice(3)));
	planet.minorMoons = ko.observable(0);
	//TODO: convert to computed
	planet.majorMoons = ko.observable(0);
	
	planet.star = ko.pureComputed(function (){
		var current = planet.orbit().center();
		while(!current.luminosity)current = current.orbit().center();
		return current;
	});
	planet.isMoon = ko.pureComputed(function (){
		return planet.star()!=planet.orbit().center();
	});
	
	planet.blackBody = ko.pureComputed(function (){
		var distance = planet.isMoon()?
			planet.orbit().center().orbit().distance():
			planet.orbit().distance();
		return 278*Math.pow(planet.star().luminosity(),.25)/Math.pow(distance,.5);
	});
	
	planet.terrain = ko.pureComputed(function () {
		//TODO: ammonia should depends on ALL stars in system?
		if(planet.type() != "terrestrial") return planet.type();
		if(planet.size() == 1) return planet.blackBody() > 140? 'Rock': planet.alternateTypes.canBeSulfur()? 'Sulfer':'Hadean'; 
		if(planet.size() == 2) return planet.blackBody() > 140? 'Rock': planet.blackBody() > 80? 'Ice': 'Hadean';
		return planet.blackBody() > 500? 'Chthonian': planet.blackBody() > 320? 'Greenhouse':
			planet.blackBody() > 240? planet.alternateTypes.canBeGarden()? 'Garden':'Ocean': planet.blackBody() > 230? 'Ice':
			planet.blackBody() > 150? planet.star().mass()<=.65? 'Ammonia':'Ice': planet.blackBody() > 80? 'Ice': 
			planet.size() == 3?'Hadean':'Ice';
	});
	
	planet.drawnRadius = ko.pureComputed(function (){
		if(planet.size() < 1) return 2; //TODO: better astroid render
		var scaleFactor = planet.orbit().center()==planet.star()?5:1;
		return planet.size()*scaleFactor +(planet.type() == 'giant'?15:0);
	});
	
	//do with surface temp, not blackbody
	planet.temperature = ko.pureComputed(function() {
		var blackBodyCorrection = getBlackbodyCorrection(planet.terrain(),planet.size(),planet.hydrographicCoverage(),planet.atmosphere.mass());
		return 9/5*(planet.blackBody()*blackBodyCorrection-273)+32;
	});
	planet.temperatureRange = ko.pureComputed(function (){
		var temperature = planet.temperature();
		
		if(temperature<-20) return "Frozen";
		if(temperature<0) return "Very Cold";
		if(temperature<20) return "Cold";
		if(temperature<40) return "Chilly";
		if(temperature<60) return "Cool";
		if(temperature<80) return "Normal";
		if(temperature<100) return "Warm";
		if(temperature<120) return "Tropical";
		if(temperature<140) return "Hot";
		if(temperature<160) return "Very Hot";
		 return "Infernal";
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
	
	planet.atmosphere = generateAtmosphere(planet);
	//TODO: hydrographics have diceless memory!
	planet.hydrographicDice1 = ko.observable(dice());
	planet.hydrographicDice2 = ko.observable(dice(2));
	planet.hydrographicCoverage = ko.pureComputed(function (){
		var terrain = planet.terrain();
		var size = planet.size();
		switch (terrain)
		{
			case "giant": 
			case "asteroid": 
			case "none": 
			case "Hadean":
			case "Sulfer": 
			case "Rock": 
			case "Chthonian": return 0;
			case "Ice": return size>2
				?Math.max(0,planet.hydrographicDice2()/10-1)
				:(planet.hydrographicDice1()+2)*.1;
			case "Ammonia": return Math.min(1,planet.hydrographicDice2()/10)
			case "Ocean": 
			case "Garden": return Math.min(1,(planet.hydrographicDice1()+(size-1)*2)*.1);
			case "Greenhouse": return Math.max(0,(planet.hydrographicDice2()-7)*.1);
		}
		console.log("BAD INPUT for PLANET TERRAIN!",planet.terrain());
		return 1;

	});
	//TODO make gravity something that can be set!
	planet.gasGiantMassSeed = ko.observable(dice(3));
	planet.mass = ko.pureComputed(function (){
		if(planet.type()=='giant')
		{
			return Distribution(random.GasGiantMass).get(planet.gasGiantMassSeed())[planet.size()-1];
		}
	});
	planet.densitySeed = ko.observable(Distribution(random.coreDensity).get(dice(3)));
	planet.density = ko.pureComputed(function () {
		if(planet.type()=='giant')
			return extrapolateFromTable(lookup.gasGiantSize,'mass',planet.mass()).density;
		return Number(planet.densitySeed())+(planet.size()>=3?.5: planet.terrain=='Rock'?.2:0)
	});
	planet.diameterSeed = ko.observable((dice(2)-2)/10);
	planet.diameter = ko.pureComputed(function (){
		if(planet.type()=='giant')
		{
			return Math.pow(planet.mass()/planet.density(),1/3);
		}
		var constraints = lookup.planetSize[planet.size()];
		return (planet.diameterSeed()*(constraints.max - constraints.min)+constraints.min)* Math.pow(planet.blackBody()/planet.density(),.5);
	});
	//TODO: it seems earth is on the heavy side. Why?
	planet.gravity = ko.pureComputed(function (){
		return planet.diameter()*planet.density();
	});
	planet.affinity = ko.pureComputed(function (){
		if(planet.atmosphere.mass()==0) return 0;
		var result = 0;
		if(planet.atmosphere.tags().indexOf("Breathable")==-1)
		{
			if(planet.atmosphere.tags().indexOf("Corrosive")!=-1)result=-2
			else if(planet.atmosphere.tags().indexOf("Highly Toxic")!=-1) result=-1;
			else if(planet.atmosphere.tags().indexOf("Mildly Toxic")!=-1) result=-1;
		}
		else 
		{
			//TODO: account for low oxygen high pressure situations
			if(planet.atmosphere.pressureClass()=="Very Thin")result+=1;
			else if(planet.atmosphere.pressureClass()=="Thin")result+=2;
			else if(planet.atmosphere.pressureClass()=="Standard")result+=3;
			else if(planet.atmosphere.pressureClass()=="Dense")result+=3;
			else if(planet.atmosphere.pressureClass()=="Very Dense")result+=1;
			else if(planet.atmosphere.pressureClass()=="SuperDense")result+=1;
			
			if(!planet.atmosphere.marginal())result+=1;
			
			if(['Cold','Hot'].indexOf(planet.temperatureRange())!=-1) result+=1;
			if(['Chilly','Cool','Normal','Warm','Tropical'].indexOf(planet.temperatureRange())!=-1) result+=2;
		}
		if(planet.terrain()=="Ocean" || planet.terrain()=="Garden") 
		{
			if(planet.hydrographicCoverage()<.6) result +=1;
			else if(planet.hydrographicCoverage()<.9) result +=2;
			else if(planet.hydrographicCoverage()<1) result +=1;
		}
		return result;
	});

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

//TODO: perhaps we should not be passing in the planet!
function generateAtmosphere(planet)
{
	var atmosphere= {};
	atmosphere.naturalMass = ko.observable((dice(3)-1+Math.random())/10);
	atmosphere.toxicityDice = ko.observable(dice(3)); //TODO: make independent?
	atmosphere.marginalDice = ko.observable(dice(3)); 
	atmosphere.marginalValue = ko.observable(Distribution(random.marginalAtmosphereType).get(dice(3)));
	
	atmosphere.pressure = ko.pureComputed(function (){
		var pressureFactor = 0;
		var size = planet.size();
		var terrain = planet.terrain();
		if(size == 2 && terrain=='Ice') pressureFactor=10;
		if(size == 3) pressureFactor=1;
		if(size == 4) pressureFactor=5;
		if(terrain == 'Greenhouse') pressureFactor*=100; 
		return planet.gravity()*atmosphere.mass()*pressureFactor;
	});
	atmosphere.pressureClass = ko.pureComputed(function (){
		var pressure = atmosphere.pressure();
		if(pressure < .01) return "Trace";
		if(pressure < .5) return "Very Thin";
		if(pressure < .8) return "Thin";
		if(pressure <=1.2) return "Standard";
		if(pressure <= 1.5) return "Dense";
		if(pressure <= 10) return "Very Dense";
		return "SuperDense";
	});
	atmosphere.marginal = ko.pureComputed(function (){
		if(planet.terrain()!="Garden") return false;
		if(atmosphere.marginalDice<12) return false;
		return true;
	});
	atmosphere.toxicity = ko.pureComputed(function (){
		var terrain = planet.terrain();
		var size = planet.size();
		//TODO: spell sulfur consistently
		//Sulfur and Hadean should behave the same
		if(terrain == "Sulfer" || terrain == "Hadean" || terrain == "Rock" || terrain == "Chthonian") return 0;
		if (terrain == 'Ice') return atmosphere.toxicityDice()<21-size*3 || size ==4?3:2; 
		if (terrain == "Ammonia") return 4;
		if (terrain == "Ocean")return size==4? 3: atmosphere.toxicityDice()-12>=0? 2:1;
		if (terrain == "Greenhouse") return 4;
		else if (terrain == "Garden")
		{
			if(atmosphere.marginal())
				return getMarginalAtmosphereToxicity(atmosphere.marginalValue(),atmosphere.mass());
			else return 0;
		}
		console.log("BAD ASSUMPTION! TOXICTY NOT CALCULATABLE!",terrain);
	});
	atmosphere.tags = ko.pureComputed(function (){
		var result = [];
		var terrain = planet.terrain();
		var size = planet.size();
		if(atmosphere.mass()==0) return ['No Atmosphere'];
		if (terrain == 'Ice') 
			if(atmosphere.toxicityDice()<21-size*3 || size ==4) 
				result = result.concat(['Suffocating',"Highly Toxic"]);
			else result = result.concat(['Suffocating',"Mildly Toxic"]);
		if (terrain == "Ammonia") result = result.concat(['Suffocating',"Lethally Toxic","Corrosive"]);
		if (terrain == "Ocean")
			if(size==4) result = result.concat(['Suffocating',"Highly Toxic"]);
			else if(atmosphere.toxicityDice()-12>=0) result = result.concat(['Suffocating',"Mildly Toxic"]);
			else result = result.concat(['Suffocating']);
		if (terrain == "Greenhouse") result = result.concat(['Suffocating',"Lethally Toxic","Corrosive"]);
		if (terrain == "Garden")
		{
			result.push("Breathable");
			if(atmosphere.marginal())result.push(atmosphere.marginalValue());
		}
		return result;
	}); 
	atmosphere.mass = ko.pureComputed(function (){
		var terrain = planet.terrain();
		return (terrain == "Sulfur" || terrain == "Hadean" || terrain == "Rock" || terrain == "Cthonian")?
		0:
		Math.round(atmosphere.naturalMass()*100)/100;
	});

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
function generateAlternatePlanetTypes (){
	return [Math.random()>.5,Math.random()>.5];
}
function generateTerrestialPlanet(orbit,star,sizeModifiers){
	var size = Distribution(random.terrestialPlanetSize).get(dice(3)+sizeModifiers);
	var type = size==-1? "none": size ==0? "asteroid" : "terrestrial";
	//TODO: add eccentricity
	return Planet(type,size,new Orbit(orbit,0,star),generateAlternatePlanetTypes());
}

function generateGasGiant(orbit,star,sizeModifiers){
	var size = Distribution(random.gasPlanetSize).get(dice(3)+sizeModifiers);
	return Planet('giant',size,new Orbit(orbit,0,star),generateAlternatePlanetTypes());
}
function generatePlanet(systemType, orbit, star){
	var planetType = 'giant';
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

function generateMoons(planet)
{
	var major = 0;
	var minor = 0;
	var result = [];
	var modifiers= findInRangeTable(lookup.moonModifiers,planet.orbit().distance());
	if(planet.type() == 'giant')
	{
		var innerMoons = dice(2)+modifiers.inner;
		var outerMoons = dice(1)+modifiers.outer;
		minor+=innerMoons+outerMoons;
		major = dice(1)+modifiers.major;
	}
	else if (planet.type() == "terrestrial")
	{
		major = dice(1)-4+modifiers.terrestrial;
		minor += major?0:dice(1)-2+modifiers.terrestrial+planet.size()-3;
	}
	major = Math.max(0,major);
	minor = Math.max(0,minor);
	
	planet.minorMoons(minor);
	planet.majorMoons(major);
	for(var i =0;i<major;i++)
	{
		//TODO: orbital distances on moons
		var planetSize = planet.type() == "terrestrial"?planet.size():4;
		var moonAdjustment = Distribution(random.moonSize).get(dice(3));
		var size = Math.max(1,moonAdjustment+planetSize);
		result.push(Planet("terrestrial",size,new Orbit(i,0,planet),generateAlternatePlanetTypes()));
	}
	return result;
	
}