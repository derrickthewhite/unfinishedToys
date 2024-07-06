function createMap(config) {
	var map = [];
	map.index = [];
	map.generateTileID = function () {
		return Math.random().toString(36).slice(2)+ Math.random().toString(36).slice(2)
	}
	map.createTile = function (i,j) {
		var tile = {
			x: i,
			y: j,
			name: randomLocationName(),
			exploration: "none",
			id: map.generateTileID()
		};
		
		map.index[tile.id] = tile;
		
		if(i%2==0 && j%2==0){
			tile.type = "cave";
		}
		else if(i%2==1 && j%2==1) {
			tile.type = "corner";
			tile.layout = randomElement(["closed", "closed", "open/", "open\\"]);
		}
		else{
			tile.type = i%2 == 1 ? "passageH": "passageV";
			tile.layout = randomElement(["closed", "open"]);
		}
		
		if(tile.layout!= "closed") {
			populateTile(tile);
		} 
		else {
			tile.contents=[];
		}
		tile.contentSummary = (tile) => {
			tile.contents.sort((a,b)=>{
				if(a.featureType == "Unit" && b.featureType != "Unit") return -1;
				if(b.featureType == "Unit" && a.featureType != "Unit") return 1;
				if(a.featureType == "GearStack" && b.featureType != "GearStack") return -1;
				if(b.featureType == "GearStack" && a.featureType != "GearStack") return 1;
				if(a.featureType == "Gear" && b.featureType != "Gear") return -1;
				if(b.featureType == "Gear" && a.featureType != "Gear") return 1;
				return a.name().localeCompare(b.name());
			});
			if(tile.contents.length == 0) return "";
			namer = tile.contents[0];
			if(tile.contents.length == 1) {
				if(namer.featureType == "Unit")return namer.type() + " 1";
				else return namer.name();
			}
			var teams = tile.contents.filter(f =>f.featureType == "Team")
			if(teams.length){
				return teams[0].faction()+" "+teams[0].units().length;
			}
			if(tile.contents[0].featureType == "Gear")
				return tile.contents[0].name()+" + "+tile.contents.length;
			if(tile.contents[0].featureType == "GearStack")
				return tile.contents[0].name();

			return "no summary found for "+tile.x+","+tile.y+"!";
		}
		tile.environmentSummary = (tile) => {
			var environments = tile.contents.filter(a=> a.featureType=="Terrain" || a.featureType=="Structure");
			if(environments.length) return environments.map(f=>f.name()).join(",");
			return "[]"
		}
		//TODO: this should not be the same list for everyone
		tile.exploredFeatures = [];
		tile.stealth = ko.observable();
		tile.sightlines = ko.observable();
		tile.cover = ko.observable();
		tile.terrainBonus = function (target, base) {
			return tile.contents.filter(feature => feature.featureType == "Terrain")
				.map(terrain=> terrain.effects()).flat()
				.filter(effect => effect.target == target)
				.sort((a,b) => a.effect.priority - b.effect.priority)
				.reduce((sofar, a) => a.effect.func(sofar), base);
		}
		tile.updateTerrain  = () => {
			//TODO: should the base numbers be determined here?
			tile.stealth(tile.terrainBonus("stealth",0)+"");
			tile.sightlines(tile.terrainBonus("sightlines",20)+""); 
			tile.cover(tile.terrainBonus("cover",0)+"");
		}
		tile.updateTerrain();
		return tile;
	}

	map.neighbors = function(tile, includeClosed, includePotential) {
		var result = [];
		var tileX = tile.x;
		var tileY = tile.y;
		for(var i = -1; i<=1; i++){
			for(var j = -1; j<=1; j++){
				var neighbor = map[tileX+i] && map[tileX+i][tileY+j];
				if(neighbor && (neighbor.layout!=="closed" || includeClosed) && neighbor!=tile){
					if(
						(tile.type == "passageH" && j==0) ||
						(tile.type == "passageV" && i==0) ||
						(neighbor.type == "passageH" && j==0) ||
						(neighbor.type == "passageV" && i==0) ||
						((tile.layout == "open\\" || neighbor.layout == "open\\") && i==j) ||
						((tile.layout == "open/" || neighbor.layout == "open/") && i==-j) ||
						(includePotential && tile.type == "corner" && neighbor.type == "cave") ||
						(includePotential && neighbor.type == "corner" && tile.type == "cave")
					){
						result.push(neighbor);
					}
				}
			}
		}
		return result;
	}
	map.obviousContents = function (tile) {
		return tile.contents.filter(feature => feature.featureType == "Terrain");
	}
	//TODO: get rid of this... it doesn't track anything anymore!
	map.explore = function (tile) {
		console.log("I THOUGH THIS WAS REPLACED!")
		if(tile.exploration != "explored"){
			if(tile.type!= "corner" 
				|| map.neighbors(tile).filter(n=>n.exploration == "explored").length
				|| (tile.layout == "closed" && map.neighbors(tile,false,true).filter(n=>n.exploration == "explored").length >=2)
			){
				tile.exploration = "explored";
			} else {
				tile.exploration = "partial"
			}
			if(tile.layout!="closed" && tile.exploration=="explored") {
				var neighborsList = tile.type == "cave"? map.neighbors(tile, true, true): map.neighbors(tile,true, false);
				neighborsList.forEach((neighbor) => {
					if(neighbor.exploration == "none"){
						neighbor.exploration = "seen"
					}
					if(neighbor.exploration == "partial" && map.neighbors(tile).filter(n=>n.exploration == "explored").length) {
						neighbor.exploration = "seen"
					}
				});
			}
		}
		else {
			//TODO: display this message better
			console.log("this tile could not be explored",tile);
		}
	}
	map.getFactionPieces = function (factionName) {
		var result = {
			teams: [],
			structures: []
		};
		for(var i = 0; i< map.length; i++ ){
			for(var j=0;j<map[i].length; j++) {
				var tile = map[i][j];
				var structures = tile.contents.filter(feature => feature.featureType == "Structure");
				if(factionName) structures= structures.filter(feature => feature.faction() == factionName);
				var teams = tile.contents.filter(feature => feature.featureType == "Team");
				if(factionName) teams= teams.filter(feature => feature.faction() == factionName);
				result.teams = result.teams.concat(teams.map(team => ({tile: tile, team: team})));
				result.structures = result.structures.concat(structures.map(structure => ({tile: tile, structure: structure})));
			}
		}
		return result;
	}
	
	for(var i = 0;i<config.height();i++){
		map[i] = [];
		for(var j = 0;j<config.width();j++){
			 var tile = map.createTile(i,j);
			 map[i][j] = tile;
		}
	}
	//todo: this feels so sloppy and non-elegant
	for(i=0;i<config.height();i++)
		for(j=0;j<config.width();j++) {
			tile = map[i][j];
			if(tile.type == "corner" && tile.layout == "open/") {
				if(map[i-1][j-1]){
					createPassages("cave", ["NE passage", "SW end"], [map[i-1][j+1], tile], "assets/blank.svg");
				}
				if(map[i+1][j+1]){
					createPassages("cave", ["SW passage", "NE end"], [map[i+1][j-1], tile], "assets/blank.svg");
				}
			}
			if(tile.type == "corner" && tile.layout == "open\\") {
				if(map[i+1][j-1]){
					createPassages("cave", ["NW passage", "SE end"], [map[i+1][j+1], tile], "assets/blank.svg");
				}
				if(map[i-1][j+1]){
					createPassages("cave", ["SE passage", "NW end"], [map[i-1][j-1], tile], "assets/blank.svg");
				}
			}
			if(tile.type == "passageH"&& tile.layout == "open"){
				if(map[i-1][j]){
					createPassages("cave", ["E passage", "W end"], [map[i-1][j], tile], "assets/blank.svg");
				}
				if(map[i+1][j]){
					createPassages("cave", ["W passage", "E end"], [map[i+1][j], tile], "assets/blank.svg");
				}
			}
			if(tile.type == "passageV"&& tile.layout == "open"){
				if(map[i][j-1]){
					createPassages("cave", ["S passage", "N end"], [map[i][j-1], tile], "assets/blank.svg");
				}
				if(map[i][j+1]){
					createPassages("cave", ["N passage", "S end"], [map[i][j+1], tile], "assets/blank.svg");
				}
			}

		}
		map.initialTile = map[Math.floor(config.cellsHigh()/2)*2][Math.floor(config.cellsWide()/2)*2];
	return map;
}
function randomLocationName() {
	var descriptors = ["red","orange","yellow","green","blue","purple","black","white", "grey", "brown", "tall","wide","narrow","short", "wet","dry"];
	var locations = ["cavern", "tunnel", "spire", "tube", "passage", "ruins", "carving", "cliffs", "cave", "opening", "Spot", "stalagtites"];
	
	return randomElement(descriptors)+" "+randomElement(locations);
}
function randomUnitFromProportionedList(list) {
	var total = list.map(u => u.proportion).reduce((a,b)=> a+b, 0);
	var selection = Math.floor(Math.random()*total);
	for (currentIndex = 0; currentIndex <= list.length; currentIndex++) {
		if(selection < list[currentIndex].proportion) return list[currentIndex];
		selection -= list[currentIndex].proportion;
	}
	console.log("you have errors in this function!");
}
function populateTile (tile) {
	tile.contents = [];
	var terrainCount = randInt(3); //0 is possible
	for(var i = 0; i< terrainCount; i++ ){
		tile.contents.push(results.library.terrain[randomTerrain()]);
	}
	
	var monsterFaction = randomFaction();
	var monsterName = monsterFaction.name;
	var factionName = monsterFaction.faction;

	var monsterImage = monsterFaction.image;
	var ambushTypes = ["worm", "ooze"];
	var monsterPosture = ambushTypes.includes(monsterName) ? "Stalk": "Patrol";
	var consumableList = Object.values(results.library.consumables);
	var team = createTeam(monsterName+Math.floor(Math.random()*1000), consumableList.map(c=>copyConsumable(c)), factionName, monsterPosture, monsterImage);
	var count = monsterFaction.teamSize();
	var factionSelectionSize = monsterFaction.units.map(u => u.proportion).reduce((a,b) => a+b, 0);
	for(var monsters = 0; monsters < count; monsters++){
		team.units.push(copyUnit(randomUnitFromProportionedList(monsterFaction.units).unit));
	}
	team.setSupply("food", team.units().length*5);

	tile.contents.push(team);
	if(monsterName == "worm") {
		var nest = copyStructure(results.library.structures.wormNest)
		nest.contents.push(copyUnit(results.library.units.worm));
		tile.contents.push(nest);
	}
	if(monsterName == "goblin"){
		var town = copyStructure(results.library.structures.goblinTown);
		//TODO: town population as configuration rather than hard coded
		var count = randInt(6)+randInt(6) +2;
		for(var i = 0; i<count;i++){
			var monster = randomElement([
				results.library.units.goblin,
				results.library.units.goblinWizard,
				results.library.units.goblinArcher
			]);
			town.contents.push(copyUnit(monster));
		}
		town.setSupply("food", 500);
		town.setSupply("gold", 1000);
		town.setSupply("magic", 400);
		tile.contents.push(town);
	}
	if(team) {
		tile.contents.forEach(f => team.explorationMap().add(tile,f));
		team.explorationMap().setStatus(tile, "explored");
		team.tile(tile);
	}
}

function randomTerrain () {
	var terrain = [
		"glowshrooms",
		"pools",
		"narrows",
		"stalagtites"
	];
	return randomElement(terrain);
}
function randomStructure () {
	var structures = [
		"wormNest",
		"goblinTown"
	];
	return randomElement(structures);
}
function randomMonster () {
	var monsters = [
		"worm",
		"skeleton",
		"ooze",
		"goblin",
		"squidling"
	];
	return randomElement(monsters);
}
function randomFaction () {
	var library = results.library;
	var factions = [
		library.faction.goblin,
		library.faction.ooze,
		library.faction.worm,
		library.faction.undead,
		library.faction.squidling,
	];
	return randomElement(factions);
}