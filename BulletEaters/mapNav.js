function createMapNavigation() {
	//TODO: remove global results
	//TODO: set initial tile outside of creation
	//TODO: split interface vs. map tools?
	var mapNav = {
		currentTile: ko.observable(results.map.reduce((a,b) => a.concat(b)).filter(tile => tile.exploration != "none")[0]),
		gear: ko.observableArray([]),
		terrain: ko.observableArray([]),
		structures: ko.observableArray([]),
		teams: ko.observableArray([]),
		battlesites: ko.observableArray([]),
		cheatList: ko.observableArray([]),
		showCheatList: ko.observable(false),
	};
	mapNav.terrainBonus = function (target, base) {
		return mapNav.terrain().map(terrain=> terrain.effects()).flat()
			.filter(effect => effect.target == target)
			.sort((a,b) => a.effect.priority - b.effect.priority)
			.reduce((sofar, a) => a.effect.func(sofar), base);
	}
	mapNav.updateTileDisplay = function () {
		var tile = mapNav.currentTile();
		mapNav.cheatList(mapNav.currentTile().contents);
		mapNav.gear(mapNav.currentTile().exploredFeatures.filter(feature => feature.featureType == "Gear" || feature.featureType == "GearStack"));
		mapNav.terrain(mapNav.currentTile().exploredFeatures.filter(feature => feature.featureType == "Terrain"));
		mapNav.structures(mapNav.currentTile().exploredFeatures.filter(feature => feature.featureType == "Structure"));
		mapNav.teams(mapNav.currentTile().exploredFeatures.filter(feature => feature.featureType == "Team"));
		mapNav.battlesites(mapNav.currentTile().exploredFeatures.filter(feature => feature.featureType == "Battlesite"));
		
		if(tile.updateTerrain) tile.updateTerrain();
	}
	mapNav.pickUp = function (object) {
		results.teamNavigation.currentTeam().loot.push(object);
		mapNav.gear.remove(object);
		mapNav.currentTile().contents = mapNav.currentTile().contents.filter(item => item != object);
		mapNav.currentTile().exploredFeatures = mapNav.currentTile().exploredFeatures.filter(item => item != object);
		mapNav.updateTileDisplay();
	}
	mapNav.traversePortal = function (portal) {
		var tile = portal.destination;
		if(results.teamNavigation.currentTeam()){
			if(results.teamNavigation.currentTeam().getSupply("moves") <= 0){
				results.message("This team has no moves left!");
				return;
			}
			if(tile.exploration != "explored"){
				results.map.explore(tile);
			}
			if(!tile.exploredFeatures.find(feature => feature.name() == "Portal")) {
				tile.exploredFeatures.push(tile.contents.find(feature => feature.name() == "Portal"));
			}
			mapNav.moveIntoTile(results.teamNavigation.currentTeam(),tile);
		}
		else {
			mapNav.setCurrentTile(tile);
			mapNav.updateTileDisplay();
		}
		draw();
	}
	mapNav.refillSupplies = function (object) {
		//TODO: ammo, magic, and smart refills
		results.teamNavigation.currentTeam().setSupply("food", results.teamNavigation.currentTeam().units().length*15)
	}
	mapNav.enterStructure = function (structure) {
		results.groupNavigation.currentGroup(structure);
		results.groupNavigation.updateGroupDisplay();
	}
	mapNav.exitStructure = function () {
		results.groupNavigation.currentGroup(undefined);
		results.groupNavigation.updateGroupDisplay();
	}
	mapNav.setCurrentTile = function (tile) {
		mapNav.currentTile(tile);
		results.groupNavigation.currentGroup(undefined);
	}
	mapNav.onTileClick = function(tile){
		if(results.battleground.active()){
			results.message("you can't exit this battle!");
			return;
		}
		var team = results.teamNavigation.currentTeam();
		if(!team){
			mapNav.setCurrentTile(tile);
			mapNav.updateTileDisplay();
		}else {
			if(team.getSupply("moves")<=0){
				results.message("This team has no moves left!");
				return;
			}
			var neighbors = results.map.neighbors(tile, false, false);
			if(neighbors.includes(results.teamNavigation.currentTeam().tile())) {
				if(tile.exploration != "explored"){
					results.map.explore(tile);
				}
				if(tile.exploration == "explored" && tile.layout != "closed") {
					mapNav.moveIntoTile(results.teamNavigation.currentTeam(), tile);
				}
			}
			else {
				results.message("This tile is not connected to the team!");
				return;
			}
		}
	}
	mapNav.moveIntoTile = function (team, tile) {
		team.tile().contents = team.tile().contents.filter(feature => feature != team);
		//move team into tile
		mapNav.setCurrentTile(tile);
		team.tile(tile);
		team.addSupply("moves",-1);
		//TODO: make current faction something that can be set
		
		tile.contents.push(team);

		var featuresToFind = tile.contents.filter(feature => !tile.exploredFeatures.includes(feature));
		featuresToFind.filter(feature => feature.featureType == "Terrain").forEach(feature => tile.exploredFeatures.push(feature))
		mapNav.updateTileDisplay();
	}
	//TODO: this should be a universal explore function for all teams. Should it really be in map nav? move to map?
	mapNav.exploreResult = function (tile, exploredFeatures) {
		
		var featuresToFind = tile.contents.filter(feature => !exploredFeatures.includes(feature));
		// first patrolling teams
		// then structures
		// then resting teams
		// then gear and items of interest
		// TODO: passages fit in there somewhere
		var discoveryOdds = featuresToFind.map(feature => ({
			feature: feature,
			odds: feature.featureType=="Team"? 100 :
				feature.featureType == "Structure"? 50 :
				//TODO: does gear even show up anymore?
				feature.featureType == "Gear" || feature.featureType == "GearStack"? 25 :
				feature.featureType == "Battlesite"? 25 :
				console.log("unIdentified feature", feature) && 100
		}))
		.concat({
			feature: {
				featureType: "nothing",
				name: () => "Nothing"
			},
			odds: 50 + featuresToFind.length*10 
		});
		var totalOdds = discoveryOdds.reduce((sofar,a)=> sofar+a.odds, 0);
		//TODO: chance of finding nothing even when something is there
		var selected =  Math.random()*totalOdds;
		var exploredOption;
		while(selected > 0 ) {
			exploredOption = discoveryOdds.pop();
			selected -= exploredOption.odds;
		}
		return exploredOption.feature;
	}
	mapNav.explore = function () {
		var tile = mapNav.currentTile();
		var exploredFeatures = tile.exploredFeatures.concat(results.teamNavigation.currentTeam());
		var encounterFeature = mapNav.exploreResult(tile, exploredFeatures);
		console.log("you have encountered", encounterFeature);
		
		//TODO: better diplomacy check!... are these actually enemies?
		if(encounterFeature.featureType == "Team" &&  encounterFeature.faction() != "modern"){
			results.encounterZone.setEncounter(encounterFeature, tile);
			//results.battleground.setUpBattle(results.teamNavigation.currentTeam(), encounterFeature, tile);
		}
		else {
			//TODO: give options of things to do?
			results.encounterZone.setEncounter(encounterFeature, tile);
			if(encounterFeature.featureType != "nothing") 
				tile.exploredFeatures.push(encounterFeature);
			mapNav.updateTileDisplay()
		}
	}
	return mapNav;
}
function registerMapNav () {
	ko.components.register("map-nav", {
		viewModel: function(params) {
			this.mapNavigation = params.mapNav
			this.root = params.root
		},
		template:
		`<div data-bind="with: mapNavigation">
				<div data-bind="if:$parent.root.teamNavigation.currentTeam() && !$parent.root.groupNavigation.currentGroup()">
					<button data-bind="click:explore">Explore</button>
				</div>
				<div>Stealth:<span data-bind="text:currentTile().stealth"></span></div>
				<div>Cover:<span data-bind="text:currentTile().cover"></span></div>
				<div>Sightlines:<span data-bind="text:currentTile().sightlines"></span></div>
				<div>Explored:</div>
				<div data-bind="foreach: terrain">
					<div>
						<span data-bind="text:name"></span>
					</div>
				</div>
				<div data-bind="foreach: structures">
					<div>
						<span data-bind="text:name"></span>
						<span data-bind="if:name() == 'Portal'">
							<button data-bind="click:$parent.traversePortal">Traverse</button>
						</span>
						<span data-bind="if:name() == 'Base'">
							<button data-bind="click:$parent.refillSupplies">Resupply</button>
						</span>
						<span data-bind="if:name() != 'Portal' && $root.groupNavigation.currentGroup() != $data">
							<button data-bind="click:$parent.enterStructure">Enter</button>
						</span>
						<span data-bind="if: $root.groupNavigation.currentGroup() == $data">
							<button data-bind="click:$parent.exitStructure">Exit</button>
							<!-- TODO: make better names for leaving groups that aren't structures-->
						</span>
					</div>
				</div>
				<div data-bind="foreach: teams">
					<div>
						<span data-bind="text:name"></span>
					</div>
				</div>
				<div data-bind="foreach: battlesites">
					<div>
						<span data-bind="text:name"></span>
						<span data-bind="if:name() != 'Portal' && $root.groupNavigation.currentGroup() != $data">
							<button data-bind="click:$parent.enterStructure">Enter</button>
						</span>
						<span data-bind="if: $root.groupNavigation.currentGroup() == $data">
							<button data-bind="click:$parent.exitStructure">Exit</button>
							<!-- TODO: make better names for leaving groups that aren't structures-->
							<!-- TODO: generalize the group interface-->
						</span>
					</div>
				</div>
				<!-- TODO: remove gear from showing on map-->
				<div data-bind="foreach: gear">
					<div>
						<span data-bind="text:name"></span>
						<span data-bind="if:types.includes('weapon')">
							<!-- TODO: weapon types served more gracefully-->
							<span data-bind="text:weaponTypes.join(',')"></span>
							[<span data-bind="text:damage"></span>]
						</span>
						<button data-bind="click:$parent.pickUp">pick up</button>
					</div>
				</div>
				<div><input type="checkbox" data-bind="checked:showCheatList"/> Show Cheat List</div>
				<div data-bind="if:showCheatList">
					<div data-bind="foreach: cheatList">
						<div>
							<span data-bind="text:name"></span>
						</div>
					</div>
				</div>
			</div>`
	});
	
}