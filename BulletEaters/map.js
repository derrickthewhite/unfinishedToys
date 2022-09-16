function createMap(config) {
	var map = [];
	map.createTile = function (i,j) {
		var tile = {
			x: i,
			y: j,
			name: randomLocationName(),
			exploration: "none"
		};
		
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
		return tile;
	}

	//TODO: move this somewhere better
	map.updateAfterBattle = function (battle, loosingTeam) {
		battle.attackers().concat(battle.defenders())
		.forEach(unit => unit.log(""))
		var dead = loosingTeam.units();
		var gear = dead.map(unit => unit.gear())
			.reduce((sofar, a) => sofar.concat(a), [])
			.filter((gear) => !gear.handling.includes("embedded"));
		var corpses = dead.map(unit => createCorpse(unit));
		var itemsToAdd = gear.concat(corpses);
		var stackableItemsToAdd = itemsToAdd.filter(item => item.handling.includes("countable"));
		itemsToAdd = itemsToAdd.filter(item => !item.handling.includes("countable"))
		
		battle.location().contents = battle.location().contents.filter(item => item!=loosingTeam);

		stackableItemsToAdd.forEach(item => {
			var stack = itemsToAdd.find(stack => stack.featureType == "GearStack" && stack.itemName == item.name()); 
			if(!stack){
				stack = gearStack(item);
				itemsToAdd.push(stack);
			}
			stack.items.push(item);
		});
		
		var battlesite = createBattlesite("Battle " +Math.floor(Math.random()*1000000).toString(16));
		battlesite.contents = itemsToAdd;
		
		battle.location().contents.push(battlesite);
		//TODO: remove map-base exploredFeatures from use
		if(battle.mode() != "aiFight")battle.location().exploredFeatures.push(battlesite);
		var winners = [battle.attackingTeam(),battle.defendingTeam()].filter(team => team != loosingTeam)[0]; 
		winners.featureMap[battle.location().x][battle.location().y].push(battlesite);
		
		results.mapNavigation.updateTileDisplay(); //TODO: using results!
		if(battle.mode()!= "aiFight")results.mapNavigation.enterStructure(battlesite);
		// ends the fight
		battle.mode("over");
		draw(); //TODO: currently universal!
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
	map.explore = function (tile) {
		//TODO: this needs to be replaced by exit exploration;
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
	map.initialTile = map[Math.floor(config.cellsWide()/2)*2][Math.floor(config.cellsHigh()/2)*2];
	map.initialTile.exploration = "seen";
	map.initialTile.contents.push(copyStructure(results.library.structures.portal));
	
	return map;
}
function createFeatureMap () {
	//TODO: make config generic
	var fm = [];
	for(var i = 0;i<results.config.height();i++){
		fm[i] = [];
		for(var j = 0;j<results.config.width();j++){
			 fm[i][j] = [];
		}
	}
	return fm;
}
function randomLocationName() {
	var descriptors = ["red","orange","yellow","green","blue","purple","black","white", "grey", "brown", "tall","wide","narrow","short", "wet","dry"];
	var locations = ["cavern", "tunnel", "spire", "tube", "passage", "ruins", "carving", "cliffs", "cave", "opening", "Spot", "stalagtites"];
	
	return randomElement(descriptors)+" "+randomElement(locations);
}
function populateTile (tile) {
	tile.contents = [];
	var terrainCount = randInt(3);
	for(var i = 0; i< terrainCount; i++ ){
		tile.contents.push(results.library.terrain[randomTerrain()]);
	}
	
	var monsterName = randomMonster();
	var monsterFaction = monsterName == "goblin"? "Goblin": 
		monsterName == "skeleton"? "Undead" :"Monster"
	var ambushTypes = ["worm", "ooze"];
	var monsterPosture = ambushTypes.includes(monsterName) ? "Stalk": "Patrol";
	var team = createTeam(monsterName+Math.floor(Math.random()*1000), [], monsterFaction, monsterPosture);
	if(monsterName == "worm" || monsterName == "ooze"){
		team.units.push(copyUnit(results.library.units[monsterName]));
	}
	if(monsterName == "goblin" || monsterName == "skeleton") {
		var count = randInt(10);
		for(var monsters = 0; monsters < count; monsters++)
			team.units.push(copyUnit(results.library.units[monsterName]));
	}
	tile.contents.push(team);
	if(monsterName == "worm") {
		var nest = copyStructure(results.library.structures.wormNest)
		nest.contents.push(copyUnit(results.library.units.worm));
		nest.contents.push(copyUnit(results.library.units.worm));
		tile.contents.push(nest);
	}
	if(monsterName == "goblin"){
		var town = copyStructure(results.library.structures.goblinTown);
		var count = randInt(6)+randInt(6);
		for(var i = 0; i<count;i++)
			town.contents.push(copyUnit(results.library.units.goblin));
		tile.contents.push(town);
	}
	if(team) {
		team.featureMap[tile.x][tile.y] = team.featureMap[tile.x][tile.y].concat(tile.contents);
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
	//TODO: undo
	return "worm";
	var monsters = [
		"worm",
		"skeleton",
		"ooze",
		"goblin"
	];
	return randomElement(monsters);
}