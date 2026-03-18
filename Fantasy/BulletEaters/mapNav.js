function createMapNavigation() {
	//TODO: remove global results
	//TODO: set initial tile outside of creation
	//TODO: split interface vs. map tools?
	var mapNav = {
		// just to start out looking at the first tile
		// TODO: is this even what we want?
		currentTile: ko.observable(results.map.initialTile),
		gear: ko.observableArray([]),
		terrain: ko.observableArray([]),
		passages: ko.observableArray([]),
		structures: ko.observableArray([]),
		teams: ko.observableArray([]),
		battlesites: ko.observableArray([]),
		cheatList: ko.observableArray([]),
		showCheatList: ko.observable(true),
	};
	mapNav.terrainBonus = function (target, base) {
		return mapNav.terrain().map(terrain=> terrain.effects()).flat()
			.filter(effect => effect.target == target)
			.sort((a,b) => a.effect.priority - b.effect.priority)
			.reduce((sofar, a) => a.effect.func(sofar), base);
	}
	mapNav.updateTileDisplay = function () {
		var tile = mapNav.currentTile();
		var explorationMap = results.teamNavigation.currentTeam()?
			results.teamNavigation.currentTeam().explorationMap():
			results.factionManager.currentFaction().explorationMap();
		mapNav.cheatList(mapNav.currentTile().contents);
		mapNav.gear(explorationMap.features(tile).filter(feature => feature.featureType == "Gear" || feature.featureType == "GearStack"));
		mapNav.terrain(explorationMap.features(tile).filter(feature => feature.featureType == "Terrain"));
		mapNav.structures(explorationMap.features(tile).filter(feature => feature.featureType == "Structure"));
		mapNav.teams(explorationMap.features(tile).filter(feature => feature.featureType == "Team"));
		mapNav.battlesites(explorationMap.features(tile).filter(feature => feature.featureType == "Battlesite"));
		mapNav.passages(explorationMap.features(tile).filter(feature => feature.featureType == "Passage"));
		
		if(tile.updateTerrain) tile.updateTerrain();
	}
	mapNav.pickUp = function (object) {
		results.teamNavigation.currentTeam().loot.push(object);
		mapNav.gear.remove(object); //TODO: can we remove this? (this item? or this line?)
		mapNav.currentTile().contents = mapNav.currentTile().contents.filter(item => item != object);
		results.teamNavigation.currentTeam().explorationMap.remove(mapNav.currentTile(), object);
		mapNav.updateTileDisplay();
	}
	mapNav.traversePassage = function (passage) {
		var tile = passage.destination;
		if(results.teamNavigation.currentTeam()){
			var explorationMap = results.teamNavigation.currentTeam().explorationMap();
			if(results.teamNavigation.currentTeam().getSupply("moves") <= 0){
				results.message("This team has no moves left!");
				return;
			}
			if(explorationMap.getStatus(tile) != "explored"){
				explorationMap.setStatus(tile, "explored")
				results.artist.draw();
			}
			if(!explorationMap.features(tile).find(feature => feature == passage.pair)) {
				explorationMap.add(tile, passage.pair);
			}
			mapNav.moveIntoTile(results.teamNavigation.currentTeam(),tile);
		}
		else {
			mapNav.setCurrentTile(tile);
			mapNav.updateTileDisplay();
		}
		results.artist.draw();
	}
	mapNav.refillSupplies = function (object) {
		//TODO: magic and smart refills
		results.teamNavigation.currentTeam().setSupply("food", results.teamNavigation.currentTeam().units().length*15)
		results.teamNavigation.currentTeam().setSupply("ammo", results.teamNavigation.currentTeam().units().length*25)
	}
	mapNav.enterStructure = function (structure) {
		results.groupNavigation.currentGroup(structure);
		results.groupNavigation.updateGroupDisplay();
	}
	mapNav.exitStructure = function () {
		results.groupNavigation.exit();
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
			var availableTiles = team.explorationMap().features(mapNav.currentTile()).filter(f => f.featureType == "Passage").map(f => f.destination);

			if(availableTiles.includes(tile)) {
				if(team.explorationMap().getStatus(tile.id) != "explored"){
						team.explorationMap().setStatus(tile.id, "explored");
				}
				var portal = team.explorationMap().features(mapNav.currentTile().id).filter(f => f.featureType == "Passage" && f.destination == tile)[0];
				if(!team.explorationMap().features(tile.id).find(feature => feature == portal.pair)) {
					team.explorationMap().add(tile.id,portal.pair);
				}
				if(team.explorationMap().getStatus(tile.id) == "explored" && tile.layout != "closed") {
					mapNav.moveIntoTile(results.teamNavigation.currentTeam(), tile);
				}
			}
			else {
				results.message("This tile is not connected to the team!");
				return;
			}
		}
		results.artist.draw();
	}
	mapNav.moveIntoTile = function (team, tile) {
		team.tile().contents = team.tile().contents.filter(feature => feature != team);
		//move team into tile
		mapNav.setCurrentTile(tile);
		team.tile(tile);
		team.addSupply("moves",-1);
		//TODO: make current faction something that can be set
		
		tile.contents.push(team);
		
		//update maps
		tile.contents.filter(f => f.faction && f.faction() == team.faction())
			.forEach(f => {
				if(f.featureType == "Team"){
					f.explorationMap().share(team.explorationMap())
					team.explorationMap().share(f.explorationMap())
				}
				else {
					results.factionManager.currentFaction().explorationMap().share(team.explorationMap());
					team.explorationMap().share(results.factionManager.currentFaction().explorationMap());
				}
			});

		var featuresToFind = tile.contents.filter(feature => !team.explorationMap().features(tile.id).includes(feature));
		featuresToFind.filter(feature => feature.featureType == "Terrain").forEach(feature => team.explorationMap().add(tile.id, feature));
		mapNav.updateTileDisplay();
	}
	mapNav.visitTeam = function (team) {
		results.encounterZone.setEncounter(team, team.tile());
	}
	//TODO: this should be a universal explore function for all teams. Should it really be in map nav? move to map?
	mapNav.exploreResult = function (tile, exploredFeatures) {
		
		var featuresToFind = tile.contents.filter(feature => !exploredFeatures.includes(feature));
		// first patrolling teams
		// then structures
		// then resting teams
		// then gear and items of interest
		var discoveryOdds = featuresToFind.map(feature => ({
			feature: feature,
			odds: feature.featureType=="Team"? 100 :
				feature.featureType=="Passage"? 100:
				feature.featureType == "Structure"? 50 :
				//TODO: does gear even show up anymore?
				feature.featureType == "Gear" || feature.featureType == "GearStack"? 25 :
				feature.featureType == "Battlesite"? 25 :
				console.log("unIdentified feature", feature) && 100
		}))
		.concat({
			feature: {
				featureType: "nothing",
				name: () => "Nothing",
				svg: () => "assets/blank.svg"
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
		var explorationMap = results.teamNavigation.currentTeam().explorationMap();
		var tile = mapNav.currentTile();
		var exploredFeatures = explorationMap.features(tile.id).concat(results.teamNavigation.currentTeam());
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
				explorationMap.add(tile.id,encounterFeature);
			if(encounterFeature.featureType == "Passage") {
				results.teamNavigation.currentTeam().explorationMap().setStatus(encounterFeature.destination, "seen")
				results.artist.draw();
			}
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
		`<div data-bind="with: mapNavigation" class = "navigationPane">
				<div class="panelLable">Tile Navigation</div>
				<div data-bind="text:currentTile().name" style="font-size: 14pt; font-weight: bold"></div>
				<div>
					<span class="tileKey">Stealth:</span>
					<span data-bind="text:currentTile().stealth()"></span>
				</div>
				<div>
					<span class="tileKey">Cover:</span>
					<span data-bind="text:currentTile().cover()"></span>
				</div>
				<div>
					<span class="tileKey">Sightlines:</span>
					<span data-bind="text:currentTile().sightlines"></span>
				</div>
				<div>
					<button data-bind="click:explore, enable:$parent.root.teamNavigation.currentTeam() && !$parent.root.groupNavigation.currentGroup()">Explore</button>
				</div>
				<div>Explored:</div>
				<div data-bind="foreach: terrain">
					<div>
						<img data-bind="attr:{src: svg}" class="smallIcon"></img>
						<span data-bind="text:name"></span>
					</div>
				</div>
				<div data-bind="foreach: passages">
					<div>
						<img data-bind="attr:{src: svg}" class="smallIcon"></img>
						<span data-bind="text:name"></span>
						<button data-bind="click:$parent.traversePassage">Traverse</button>
					</div>
				</div>
				<div data-bind="foreach: structures">
					<div>
						<img data-bind="attr:{src: svg}" class="smallIcon"></img>
						<span data-bind="text:name"></span>
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
						<img data-bind="attr:{src: svg}" class="smallIcon"></img>
						<span data-bind="text:name"></span>
						<span data-bind="if: $root.teamNavigation.currentTeam">
							<button data-bind="click:$parent.visitTeam">Visit</button>
						</span>
					</div>
				</div>
				<div data-bind="foreach: battlesites">
					<div>
						<img src="assets/battle.svg" class="smallIcon"></img>
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
				<img data-bind="attr:{src: 'assets/caveBase.svg'}" class="stackingImage"></img>
				<div data-bind="foreach: terrain">
					<img data-bind="attr:{src: svg}" class="stackingImage"></img>
				</div>
			</div>`
	});
	
}