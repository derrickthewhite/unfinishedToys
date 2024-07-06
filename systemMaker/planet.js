function Planet (type,size,orbit/*,alternateTypes*/)
{
	var planet = {};
	planet.type = ko.observable(type);
	planet.size = ko.observable(size);
	
	planet.orbit = ko.observable(orbit);
	planet.canBeSulfur = ko.observable(Math.random() < .33);
	//planet.canBeGarden = ko.observable(Math.random() < .5);
	planet.ageToGarden = ko.observable(9-dice(3)/2);
	planet.resourceValueRoll = ko.observable(dice(3));
	//planet.baseResourceValue = ko.observable(Distribution(random.gasPlanetSize).get(dice(3)));
	//TODO: inner vs outer moons
	planet.minorMoons = ko.observable(0);
	//TODO: convert to computed
	planet.majorMoons = ko.observable(0);
	planet.moonDistanceInDiam = ko.observable(0);
	planet.axialTilt = ko.observable(generateAxialTilt());
	planet.vulcanismRoll = ko.observable(dice(3));
	planet.tectonicRoll = ko.observable(dice(3));
	planet.baseRotationRate = ko.observable(dice(3));
	planet.specialRotationTableRoll = ko.observable(dice(2));
	planet.specialRotationRoll = ko.observable(dice(1));
	planet.retrogradeRotation = ko.observable(dice(3) >= orbit?.center().luminosity? 13: 17);
	
	//determined after all planets in system are generated
	//TODO: copy and water
	planet.settlementType = ko.observable("none");
	planet.techLevelRoll = ko.observable(dice(3));
	planet.primitiveTechLevelRoll = ko.observable(dice(3));
	planet.useCustomTechLevel = ko.observable(false);
	planet.customTechLevel = ko.observable(0);
	planet.populationRoll = ko.observable(dice(3));
	planet.homeworldPopulationRoll = ko.observable(dice(2));
	planet.colonyAge = ko.observable(Number(root.generation.colonyAgeMin()) + Math.round(Math.random()*(root.generation.colonyAgeMax() -root.generation.colonyAgeMin())));
	planet.worldUnity = ko.observable("World Gov");
	planet.specialGov = ko.observable(Distribution(random.specialGovCondition).get(dice(3)));
	if(planet.specialGov() == "Matriarchy or Patriarchy") planet.specialGov(Math.random() < .5? "Matriarchy": "Patriarchy");
	planet.government = ko.observable("none");
	
	planet.name = ko.observable("");
	planet.guid = makeGUID();
	planet.notes = ko.observable("");
	
	planet.star = ko.pureComputed(function (){
		var current = planet.orbit().center();
		while(!current.luminosity)current = current.orbit().center();
		return current;
	});
	planet.isMoon = ko.pureComputed(function (){
		return planet.star()!=planet.orbit().center();
	});
	planet.distanceFromPlanet  = ko.pureComputed(function () {
		return planet.moonDistanceInDiam()*planet.orbit().center().diameter();
	})
	
	planet.blackBody = ko.pureComputed(function (){
		var distance = planet.isMoon()?
			planet.orbit().center().orbit().distance():
			planet.orbit().distance();
		return 278*Math.pow(planet.star().luminosity(),.25)/Math.pow(distance,.5);
	});
	
	planet.terrain = ko.pureComputed(function () {
		//TODO: ammonia should depends on ALL stars in system?
		if(planet.type() != "terrestrial") return planet.type();
		if(planet.size() == 1) return planet.blackBody() > 140? 'Rock': planet.canBeSulfur() && planet.isMoon() && planet.orbit().distance() <= 1? 'Sulfur':'Hadean'; 
		if(planet.size() == 2) return planet.blackBody() > 140? 'Rock': planet.blackBody() > 80? 'Ice': 'Hadean';
		return planet.blackBody() > 500? 'Chthonian': planet.blackBody() > 320? 'Greenhouse':
			planet.blackBody() > 240? 
				Number(planet.ageToGarden())<=planet.star()?.age() && planet.ageToGarden() <= (planet.size() == 3?5:2.5)? 'Garden':'Ocean': 
			planet.blackBody() > 230? 'Ice':
			planet.blackBody() > 150? 
				planet.star().mass()<=.65? 'Ammonia':'Ice': 
			planet.blackBody() > 80? 'Ice': 
			planet.size() == 3?'Hadean':'Ice';
	});
	
	planet.drawnRadius = ko.pureComputed(function (){
		if(planet.size() < 1) return 2;
		var scaleFactor = planet.orbit().center()==planet.star()?5:1;
		var size = planet.size() && planet.type() == "terrestrial" == 1? 1.5: planet.size();
		return planet.size()*scaleFactor +(planet.type() == 'giant'?15:0);
	});
	
	//do with surface temp, not blackbody
	planet.temperature = ko.pureComputed(function() {
		var blackBodyCorrection = getBlackbodyCorrection(planet.terrain(),planet.size(),planet.hydrographicCoverage(),planet.atmosphere.mass());
		return sigFigs(9/5*(planet.blackBody()*blackBodyCorrection-273)+32,3);
	});
	planet.temperatureCelcius = ko.pureComputed(function () {
		var blackBodyCorrection = getBlackbodyCorrection(planet.terrain(),planet.size(),planet.hydrographicCoverage(),planet.atmosphere.mass());
		return sigFigs(planet.blackBody()*blackBodyCorrection-273,3);
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
	
	planet.sizeName = ko.pureComputed(function () {
		if(planet.type()=='giant') {
			if(planet.size() == 1) return "Small";
			if(planet.size() == 2) return "Medium";
			if(planet.size() == 3) return "Large";
			if(planet.size() == 4) return "Large";

		}
		if(planet.size() == 1) return "Tiny";
		if(planet.size() == 2) return "Small";
		if(planet.size() == 3) return "Standard";
		if(planet.size() == 4) return "Large";
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
			case "Sulfur": return "yellow";
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
			case "Sulfur": 
			case "Rock": 
			case "Chthonian": return 0;
			case "Ice": return size>2
				?Math.max(0,planet.hydrographicDice2()/10-1)
				:(planet.hydrographicDice1()+2)*.1;
			case "Ammonia": return Math.min(1,planet.hydrographicDice2()/10)
			case "Ocean": 
			case "Garden": return Math.min(1,(Number(planet.hydrographicDice1())+(size-1)*2)*.1);
			case "Greenhouse": return Math.max(0,(planet.hydrographicDice2()-7)*.1);
		}
		console.log("BAD INPUT for PLANET TERRAIN!",planet.terrain());
		return 1;
	});
	planet.hasHydrographicCoverage = ko.pureComputed(() => {
		return ["Ice", "Ammonia", "Ocean", "Garden", "Greenhouse"].includes(planet.terrain());
	});
	planet.usesSingleHydroDice = ko.pureComputed(() => {
		return planet.terrain() == "Garden" || (planet.terrain() == "Ice" && planet.size() <=2);
	});
	//TODO make gravity something that can be set!
	planet.gasGiantMassSeed = ko.observable(dice(3));
	planet.mass = ko.pureComputed(function (){
		if(planet.type()=='giant')
		{
			var size = planet.size() == 4? 3: planet.size();
			return Distribution(random.GasGiantMass).get(planet.gasGiantMassSeed())[size-1];
		} else {
			return planet.density() * Math.pow(planet.diameter(),3);
		}
	});
	planet.densitySeed = ko.observable(Distribution(random.coreDensity).get(dice(3)));
	planet.density = ko.pureComputed(function () {
		if(planet.type()=='giant'){
			var mass = planet.mass();
			return extrapolateFromTable(lookup.gasGiantSize,'mass',planet.mass()).density;
		}
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
		return sigFigs(planet.diameter()*planet.density(),3);
	});
	planet.habitability = ko.pureComputed(() => {
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
	planet.affinity = ko.pureComputed(function (){
		return planet.habitability() + planet.resourceValue();
	});

	planet.yearLength = ko.pureComputed(() => {
		if(planet.isMoon()){
			return Math.sqrt(Math.pow(planet.distanceFromPlanet()*2,3)/(planet.mass() + planet.orbit().center().mass()))* .0588 / 365.25;
		}
		return Math.sqrt(Math.pow(planet.orbit().distance(),3)/planet.orbit().center().mass());
	});
	planet.yearDayLength = ko.pureComputed(() => {
		return planet.yearLength()*365.25;
	});
	planet.moons = ko.pureComputed(() => {
		if(planet.isMoon())return [];
		if(planet.orbit().center() == undefined) return [];
		if(!planet.orbit().center().system()) return [];
		var system = planet.orbit().center().system();
		return system.planets().filter(moon => moon.orbit().center() == planet);
	});
	
	planet.tidalEffects = ko.pureComputed(() => {
		if(planet.isMoon()) return [2230000 * planet.orbit().center().mass()* planet.diameter()/ Math.pow(planet.distanceFromPlanet(), 3)];
		return [.46* planet.orbit().center().mass()* planet.diameter()/ Math.pow(planet.orbit().distance(), 3)].concat(
		planet.moons().map(moon => {
			return 2230000 * planet.diameter() * moon.mass() / Math.pow(moon.distanceFromPlanet(),3);
		}));
	});
	
	planet.totalTidalEffect = ko.pureComputed(() => {
		return planet.tidalEffects().reduce((sofar, effect) => sofar+effect, 0)* planet.star().age()/ planet.mass();
	});
	planet.rotation = ko.pureComputed(() => {

		var tideLockedLength = planet.yearDayLength()*24;
		if(planet.totalTidalEffect() > 50) return tideLockedLength;

		var rotation = Number(planet.baseRotationRate()) + lookup.rotationModifier[ planet.type() + planet.size()] + planet.totalTidalEffect();
		var specialRotation = Distribution(random.specialRotation).get(planet.specialRotationTableRoll());
		if((rotation > 36 || Number(planet.baseRotationRate()) >= 16) && specialRotation !="original") {
			return Math.min(specialRotation*Number(planet.specialRotationRoll())*24, planet.yearDayLength(), tideLockedLength);
		}
		return Math.min (rotation, tideLockedLength);
	});
	planet.rotationInDays = ko.pureComputed(() => {
		return planet.rotation()/24;
	});
	planet.tideLocked = ko.pureComputed(() => {
		return Math.abs(planet.rotationInDays() - planet.yearDayLength())<.001;
	});
	planet.vulcanism = ko.pureComputed(() => {
		var baseValue = planet.gravity()/planet.star().age() *40;
		if(planet.moons()>=2) baseValue+=10;
		else if(planet.moons() ==1) baseValue+=1;
		else if (planet.terrain() =="Sulfur") baseValue +=60;
		else if (planet.isMoon() && planet.orbit().center().type() == "giant") baseValue+=5;
		var lookupValue = baseValue+ Number(planet.vulcanismRoll());
		if(lookupValue <= 16) return "None";
		if(lookupValue <= 20) return "Light";
		if(lookupValue <= 26) return "Moderate";
		if(lookupValue <= 70) return "Heavy";
		return "Extreme";
		//TODO: add atmosphere effects
	});
	planet.tectonics = ko.pureComputed(() => {
		if(planet.type=="giant" || planet.size == 1 || planet.size == 2) return "None";
		
		var volcanicModifer = 0;
		if(planet.vulcanism() == "None") volcanicModifer = -8;
		if(planet.vulcanism() == "Light") volcanicModifer = -4;
		if(planet.vulcanism() == "Moderate") volcanicModifer = 0;
		if(planet.vulcanism() == "Heavy") volcanicModifer = 4;
		if(planet.vulcanism() == "Extreme") volcanicModifer = 8;
		var hydrographicModifier =0;
		if(planet.hydrographicCoverage() < .01) hydrographicModifier = -4;
		if(planet.hydrographicCoverage() < .5) hydrographicModifier = -2;
		var lunarModifier = 0;
		if(planet.moons()==1) lunarModifier=2;
		if(planet.moons()>1) lunarModifier =4;
		return Distribution(random.tectonicActivity).get(Number(planet.tectonicRoll())+volcanicModifer+hydrographicModifier+lunarModifier);
	});
	planet.resourceValue= ko.pureComputed(() => {
		var vulcanismModifiers = {
			"None":-2,
			"Light": -1,
			"Moderate":0,
			"Heavy": 1,
			"Extreme": 2
		};
		
		return Distribution(planet.terrain()=="asteroid"?random.asteroidResourceValue: random.resourceValue).get(
			Number(planet.resourceValueRoll()) + (planet.terrain()=="asteroid"? 0 : vulcanismModifiers[planet.vulcanism()])
		);
	});
	planet.techLevel = ko.pureComputed(() => {
		if(planet.settlementType() == "none") return Number(root.generation.TL());
		if(planet.useCustomTechLevel()) return planet.customTechLevel();
		var modifier = 
		planet.settlementType() == "outpost"? 3:
		planet.settlementType() == "homeworld"? -10:
		planet.habitability() > 6? 0: 
		planet.habitability() > 3? 1 : 2;
		var relativeTL = Distribution(random.techLevel).get(Number(planet.techLevelRoll())+modifier);
		if(relativeTL == "Primitive") {
			return Math.max(0,planet.primitiveTechLevelRoll() -12);
		}
		else return Number(root.generation.TL())+relativeTL;
	});
	planet.carryingCapacity = ko.pureComputed(() => {
		var capacityByTL = [
			10000, //TL0: 10k
			100000, //TL1: 100k
			500000, //TL2: 500k
			600000, //TL3: 600k
			700000, //TL4: 700k
			2500000, //TL5: 2.5M
			5000000, //TL6: 5M
			7500000, //TL7: 7.5M
			10000000, //TL8: 10M
			15000000, //TL9: 15M
			20000000, //TL10: 20M
			30000000, //TL11: 30M
			50000000, //TL12: 50M
		];
		var capacityByAffinity = [];
		capacityByAffinity[-5] = .03;
		capacityByAffinity[-4] = .06;
		capacityByAffinity[-3] = .13;
		capacityByAffinity[-2] = .25;
		capacityByAffinity[-1] = .5;
		capacityByAffinity[0] = 1;
		capacityByAffinity[1] = 2;
		capacityByAffinity[2] = 4;
		capacityByAffinity[3] = 8;
		capacityByAffinity[4] = 15;
		capacityByAffinity[5] = 30;
		capacityByAffinity[6] = 60;
		capacityByAffinity[7] = 130;
		capacityByAffinity[8] = 250;
		capacityByAffinity[9] = 500;
		capacityByAffinity[10] = 1000;
		return capacityByAffinity[planet.affinity()] * capacityByTL[Math.round(planet.techLevel())];
	});
	planet.population = ko.pureComputed(() => {
		if(planet.settlementType() == "none")return 0;
		if(planet.settlementType() == "outpost") return Distribution(random.outpostPopulation).get(planet.populationRoll());
		if(planet.settlementType() == "colony"){
			var result = Math.floor(planet.colonyAge()/10) + Number(planet.populationRoll()) + planet.affinity()*3;
			if(result <=25) return 10000;
			return Math.min (planet.carryingCapacity(),Distribution(random.colonyPopulation).get(result%10)* Math.pow(10, Math.floor(result/10)));
		} 
		if(planet.settlementType() == "homeworld") {
			if(planet.techLevel() > 4)
				return planet.carryingCapacity()*10/planet.homeworldPopulationRoll();
			else 
				return planet.carryingCapacity()*(planet.homeworldPopulationRoll()+3)/10;
		}
	});
	planet.populationRating = ko.pureComputed(() => {
		if(planet.population() == 0 )return 0;
		return planet.population().toFixed(0).length;
	});
	planet.wealthModifier = ko.pureComputed(() => {
		var modifier = planet.populationRating() > 6? 0: 
			planet.populationRating() == 5? -.1: -.2;
		var affinity = planet.affinity();
		if(affinity == 10) modifier += .4
		else if (affinity == 9) modifier += .2
		else if (affinity >= 7) modifier += 0
		else if (affinity >= 4) modifier += -.1
		else if (affinity >= 1) modifier += -.2
		modifier += -.3

		return 1+modifier;
	});
	planet.averageWealth = ko.pureComputed(() => {
		var baseWealth =  lookup.baseTLIncomeTable[Math.round(planet.techLevel())]*planet.wealthModifier();
		
		if(planet.population() > planet.carryingCapacity()){
			baseWealth = baseWealth() * planet.carryingCapacity() / planet.population();
		}
		return baseWealth;
	});
	planet.wealthDescriptor = ko.pureComputed(() => {
		var baseWealth = lookup.baseTLIncomeTable[Math.round(planet.techLevel())];
		var ratio = planet.averageWealth()/baseWealth;
		
		if(ratio >= 1.4) return "Comfortable";
		if(ratio >= .73) return "Average";
		if(ratio >= .32) return "Strugling";
		if(ratio >= .09) return "Poor";
		return "Dead Broke";
	});
	planet.economicVolume = ko.pureComputed(() => {
		return planet.averageWealth() * planet.population();
	});
	planet.controlRating = ko.pureComputed( () => {
		var government = planet.government();
		minCRTable = {
			"Anarchy": 0,
			"Athenian Democracy": 2,
			"Democractic Republic": 2,
			"Clan/Tribal": 3,
			"Caste": 3,
			"Dictatorship": 3,
			"Technocracy": 3,
			"Theocracy": 3,
			"Corporate": 4,
			"Feudal": 4
		};
		maxCRTable = {
			"Anarchy": 0,
			"Athenian Democracy": 4,
			"Democractic Republic": 4,
			"Clan/Tribal": 5,
			"Caste": 6,
			"Dictatorship": 6,
			"Technocracy": 6,
			"Theocracy": 6,
			"Corporate": 6,
			"Feudal": "6"
		};
		var minCR = minCRTable[planet.government()];
		var maxCR = maxCRTable[planet.government()];
		switch (planet.specialGov()){
			case "Colony":
				minCR = minCR-1;
				maxCR= maxCR-1;
				break;
			case "Cybercracy":
			case "Meritocracy*":
			case "Oligarchy":
			case "Socialist*":
				minCR = Math.max(minCR, 3);
				break;
			case "Sanctuary":
				maxCR = Math.min(maxCR, 4);
				break;
			case "Bureaucracy": 
			case "Military Rule":
			case "Subjugated*":
				minCR = Math.max(minCR, 4);
				break;
			default:
			break;
		}
		return "CR "+minCR+"-"+maxCR;
	})

	planet.dryCopy = function () {
		var copy = {};
		
		copy.type = planet.type();
		copy.size = planet.size();
		
		copy.orbit = planet.orbit().dryCopy();
		copy.canBeSulfur = planet.canBeSulfur();
		copy.ageToGarden = planet.ageToGarden();
		copy.resourceValueRoll = planet.resourceValueRoll();
		copy.minorMoons = planet.minorMoons();
		copy.majorMoons = planet.majorMoons();
		
		copy.hydrographicDice1 = planet.hydrographicDice1();
		copy.hydrographicDice2 = planet.hydrographicDice2();
		copy.gasGiantMassSeed = planet.gasGiantMassSeed();
		copy.densitySeed = planet.densitySeed();
		copy.diameterSeed = planet.diameterSeed();
		copy.moonDistanceInDiam = planet.moonDistanceInDiam();
		
		copy.baseRotationRate = planet.baseRotationRate();
		copy.specialRotationTableRoll = planet.specialRotationTableRoll();
		copy.specialRotationRoll = planet.specialRotationRoll();
		copy.retrogradeRotation = planet.retrogradeRotation();
		copy.vulcanismRoll = planet.vulcanismRoll();
		copy.tectonicRoll = planet.tectonicRoll();
		copy.axialTilt = planet.axialTilt();
		
		copy.settlementType = planet.settlementType();
		copy.techLevelRoll = planet.techLevelRoll();
		copy.primitiveTechLevelRoll = planet.primitiveTechLevelRoll();
		copy.useCustomTechLevel = planet.useCustomTechLevel();
		copy.customTechLevel = planet.customTechLevel();
		copy.populationRoll = planet.populationRoll();
		copy.homeworldPopulationRoll = planet.homeworldPopulationRoll();
		copy.worldUnity = planet.worldUnity();
		copy.government = planet.government();

		copy.atmosphere = planet.atmosphere.dryCopy();
		
		copy.name = planet.name();
		copy.notes = planet.notes();
		copy.guid = planet.guid;
		
		return copy;
	}
	planet.water = function (pStruct) {
		
		planet.type(pStruct.type);
		planet.size(pStruct.size);
		
		planet.orbit(Orbit());
		planet.orbit().water(pStruct.orbit);
		planet.canBeSulfur(pStruct.canBeSulfur);
		planet.ageToGarden(pStruct.ageToGarden);
		planet.resourceValueRoll(pStruct.resourceValueRoll);
		planet.minorMoons(pStruct.minorMoons);
		planet.majorMoons(pStruct.majorMoons);
		
		planet.type(pStruct.type);
		planet.hydrographicDice1(pStruct.hydrographicDice1);
		planet.gasGiantMassSeed(pStruct.gasGiantMassSeed);
		planet.densitySeed(pStruct.densitySeed);
		planet.diameterSeed(pStruct.diameterSeed);
		planet.moonDistanceInDiam(pStruct.moonDistanceInDiam);
		
		planet.baseRotationRate(pStruct.baseRotationRate);
		planet.specialRotationTableRoll(pStruct.specialRotationTableRoll);
		planet.specialRotationRoll(pStruct.specialRotationRoll);
		planet.retrogradeRotation(pStruct.retrogradeRotation);
		planet.vulcanismRoll(pStruct.vulcanismRoll);
		planet.tectonicRoll(pStruct.tectonicRoll);
		planet.axialTilt(pStruct.axialTilt);
		
		planet.settlementType(pStruct.settlementType);
		planet.techLevelRoll(pStruct.techLevelRoll);
		planet.primitiveTechLevelRoll(pStruct.primitiveTechLevelRoll);
		planet.useCustomTechLevel(pStruct.useCustomTechLevel);
		planet.customTechLevel(pStruct.customTechLevel);
		planet.populationRoll(pStruct.populationRoll);
		planet.homeworldPopulationRoll(pStruct.homeworldPopulationRoll);
		planet.worldUnity(pStruct.worldUnity);
		planet.government(pStruct.government);
		
		planet.atmosphere.water(pStruct.atmosphere);
		
		planet.name(pStruct.name);
		planet.notes(pStruct.notes);
		planet.guid = pStruct.guid;
	}
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
			case "Hadean": absorbtionFactor = size==1?.86:.67; break;
			case "Greenhouse": 
			case "Sulfur": absorbtionFactor = .77; break;
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
	atmosphere.canBeMarginal = ko.observable(dice(3)>=12); 
	//atmosphere.marginalValue = ko.observable(Distribution(random.marginalAtmosphereType).get(dice(3)));
	atmosphere.marginalValueRoll = ko.observable(dice(3));
	
	atmosphere.marginalValue = ko.pureComputed(function () {
		return Distribution(random.marginalAtmosphereType).get(atmosphere.marginalValueRoll());
	});
	
	atmosphere.pressure = ko.pureComputed(function (){
		var pressureFactor = 0;
		var size = planet.size();
		var terrain = planet.terrain();
		if(["Hadean", "Sulfur", "asteroid"].includes(terrain) || (terrain == "Rock" && size == 1)) return 0;
		if(terrain == "Chthonian" || (terrain == "Rock" && size ==2)) return .005;
		if(size == 2 && terrain=='Ice') pressureFactor=10;
		if(size == 3) pressureFactor=1;
		if(size == 4) pressureFactor=5;
		if(terrain == 'Greenhouse') pressureFactor*=100; 
		return planet.gravity()*atmosphere.mass()*pressureFactor;
	});
	atmosphere.pressureClass = ko.pureComputed(function (){
		var pressure = atmosphere.pressure();
		if(pressure == 0) return "none";
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
		//if(atmosphere.marginalDice()<12) return false;
		return atmosphere.canBeMarginal();
	});

	atmosphere.tags = ko.pureComputed(function (){
		var result = [];
		var terrain = planet.terrain();
		var size = planet.size();
		if(atmosphere.pressure()==0) return ['No Atmosphere'];
		if(atmosphere.pressure()< .01) return ['Trace Atmosphere'];
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
	
	atmosphere.dryCopy = function () {
		var copy={};
		copy.naturalMass = atmosphere.naturalMass();
		copy.toxicityDice = atmosphere.toxicityDice();
		copy.canBeMarginal = atmosphere.canBeMarginal();
		copy.marginalValueRoll = atmosphere.marginalValueRoll();
		return copy;
	}
	atmosphere.water = function (aStruct) {
		atmosphere.naturalMass(aStruct.naturalMass);
		atmosphere.toxicityDice(aStruct.toxicityDice);
		atmosphere.canBeMarginal(aStruct.canBeMarginal);
		atmosphere.marginalValueRoll(aStruct.marginalValueRoll);
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
/*
function generateAlternatePlanetTypes (){
	return [Math.random()>.33,Math.random()>.5];
}
*/
function generateAxialTilt () {
	var tilt = Distribution(random.baseAxialTilt).get(dice(3));
	if(tilt== "extended") 
		tilt = Distribution(random.extendedAxialTilt).get(dice(1));
	return tilt+dice(2)-2;
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
		var moon = Planet("terrestrial",size,new Orbit(i,0,planet));
		moon.moonDistanceInDiam(generateMoonDistanceInDiam(planet, moon));
		moon.name(planet.name()+" " +(i+1));
		result.push(moon);
	}
	while (result.map(moon => moon.moonDistanceInDiam()).filter((d,i,a) => a.indexOf(d) != i).length) {
		var collisions = result.map(moon => moon.moonDistanceInDiam())
			.filter((d,i,a) => a.indexOf(d) != i);
		result.filter(moon => collisions.includes(moon.moonDistanceInDiam()))
		.forEach(moon => moon.moonDistanceInDiam(generateMoonDistanceInDiam(planet, moon)))
	}
	result.sort((a,b) => a.moonDistanceInDiam() - b.moonDistanceInDiam());
	result.forEach((moon, index) => moon.orbit().baseDistance(index));
	return result;
	
}

function generateMoonDistanceInDiam(planet, moon) {
		var orbitRadii = 0;
		if(planet.type() == "terrestrial") {
			var modifiers = 
				planet.orbit().center().size() - moon.size == 1? 4:
				planet.orbit().center().size() - moon.size == 2? 2:0;
			orbitRadii = (dice(2)+modifiers)*2.5;
		}
		else {
			orbitRadii = dice(3)+3;
			if(orbitRadii>=15) orbitRadii+=dice(2);
			orbitRadii = orbitRadii/2;
			planet.moonDistanceInDiam(orbitRadii);
		}
		return orbitRadii;
}

function generateWorldUnity (planet) {
	var modifiers = Math.max(0, 8 - planet.populationRating());
	return Distribution(random.worldUnity).get(dice(2)+ modifiers);
}