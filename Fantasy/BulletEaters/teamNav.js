function createTeamNavigation() {
	var consumableList = Object.values(results.library.consumables);
	var teamNav = {
		teams: ko.observableArray([
			createTeam(getTeamName(), consumableList.map(c=>copyConsumable(c)), "modern", "Patrol", "assets/modern.svg"),
		]),
		currentTeam: ko.observable()
	};
	teamNav.turnCount = 1;
	teamNav.endTurn = function (){
		var factionsToRun = ["Goblin", "Undead", "Monster"];
		var wormCount = 0;
		//TODO: results.map to get all the faction Pieces is not the ideal way
		var toMove = factionsToRun.map(faction => ({faction: faction, pieces: results.map.getFactionPieces(faction)}))
		.forEach(faction => {
			results.factionManager.currentFaction(results.factionManager.getFaction(faction.faction));
			faction.pieces.teams.forEach(team => {
				//Its possible that teams have killed each other since then (especially monsters)
				if(team.team.units().filter(u => u.status() != "dead").length == 0) return;
				//console.log("this team can move", team.team.name(), team.team.faction());
				if(faction.faction == "Goblin") {
					var tile = team.tile;
					var exploredFeatures = team.team.explorationMap().features(tile).concat(team.team);
					var discovery = results.mapNavigation.exploreResult(tile, exploredFeatures);
					console.log(team.team.name(), "discovered", discovery.name())
					if(discovery.featureType == "Team") {
						var reaction = results.diplomacy.getReaction(team.team, discovery);
						var opposingReaction = results.diplomacy.getReaction(discovery, team.team);
						
						if(reaction == "Hostile") {
							console.log("fight between" + team.team.name() + " and ", discovery.name())
							var distance = results.encounterZone.stealthDistances(team.team, discovery, tile).distance;
							//TODO: give players control at some point
							//TODO: detail other opposing reactions
							if(opposingReaction == "Player Driven"){
								results.battleground.setUpPlayerBattle(discovery,team.team, tile, distance);
							}else {
								results.battleground.setUpAiBattle(team.team, discovery, tile, distance);
							}
							console.log("battle is over, battle is active? ",results.battleground.active());
						}
						if(reaction == "Wary") {
							//TODO: set the team! -- was this already done?
							teamNav.selectTeam(discovery);
							results.encounterZone.setEncounter(team.team, team.tile);
						}
					}
				}
				if(team.team.units().map(u => u.type()).includes("worm")) {
					wormCount++;
					//TODO: move the worm!
					var tile = team.tile;
					var exploredFeatures = team.team.explorationMap().features(tile).concat(team.team);
					var discovery = results.mapNavigation.exploreResult(tile, exploredFeatures);
					//console.log(team.team.name() + " found ", discovery.name());
					if(discovery.featureType == "Team"){
						console.log("fight between" + team.team.name() + " and ", discovery.name())
						var distance = results.encounterZone.stealthDistances(team.team, discovery, tile).distance;
						if(discovery.faction() == "modern"){
							results.battleground.setUpPlayerBattle(discovery,team.team, tile, distance);
						}else {
							results.battleground.setUpAiBattle(team.team, discovery, tile, distance);
						}
						console.log("battle is over, battle is: ",results.battleground.active());
					}
					if(discovery.featureType == "Passage") {
						results.mapNavigation.moveIntoTile(team.team, discovery.destination);
						console.log("worm moved into ", discovery.destination.x, discovery.destination.y, discovery.destination.name);
					}
				}
			});
			
			faction.pieces.structures.forEach(structure => {
				//TODO: other structures
				if(structure.structure.type() == "Worm Nest") {
					if(Math.random()*10 <1){
						//TODO: better way to construct consumables for teams
						var consumableList = Object.values(results.library.consumables);
						var newWorms = createTeam("worm"+Math.floor(Math.random()*1000), consumableList.map(c=>copyConsumable(c)), "Monster", "Stalk", "assets/worm.svg");
						var tile = structure.tile;
						newWorms.units.push(copyUnit(results.library.units.worm));
						tile.contents.push(newWorms);
						newWorms.tile(tile);
						results.map.obviousContents(tile).forEach(f => newWorms.explorationMap(). add(tile,f));
					}
				}
			})
		});
		
		
		
		//player only
		teamNav.teams().forEach((team) => {
			team.setSupply("moves",3);
			team.addSupply("food",-1*team.units().length);
			if(team.getSupply("food") <0){
				team.units().forEach(unit => {
					if(!unit.buffs().includes(results.library.buffs.hungry))
						unit.buffs.push(results.library.buffs.hungry)
				});
			} else {
				team.units().forEach(unit => unit.buffs.remove(results.library.buffs.hungry));
			}
		});
		results.factionManager.currentFaction(results.factionManager.getFaction("modern"));
	}
	teamNav.drop = function (object) {
		if(results.groupNavigation.currentGroup()){
			teamNav.currentTeam().loot.remove(object);
			results.groupNavigation.currentGroup().contents.push(object);
			results.groupNavigation.updateGroupDisplay();
		} else {
			teamNav.currentTeam().loot.remove(object);
			var dropSite = createBattlesite("drop " +Math.floor(Math.random()*1000000).toString(16));
			results.mapNavigation.currentTile().contents.push(dropSite);
			results.mapNavigation.currentTile().exploredFeatures.push(dropSite);
			results.mapNavigation.updateTileDisplay();
			dropSite.contents.push(object);
			results.mapNavigation.enterStructure(dropSite);
		}
	};
	teamNav.split = function(object) {
		teamNav.currentTeam().loot.remove(object);
		object.items().forEach(item => teamNav.currentTeam().loot.push(item));
	}
	teamNav.stack = function(object) {
		var itemsToStack = teamNav.currentTeam().loot().filter(item => item.handling && item.handling.includes("countable") && item.name() == object.name());
		var stack = gearStack(object);
		itemsToStack.forEach(item => stack.items.push(item));
		itemsToStack.forEach(item => teamNav.currentTeam().loot.remove(item));
		teamNav.currentTeam().loot.push(stack);
	}
	teamNav.unequip = function (object, user) {
		user.gear.remove(object);
		teamNav.currentTeam().loot.push(object);
	};
	teamNav.equip = function (object, user) {
		user.gear.push(object);
		teamNav.currentTeam().loot.remove(object);
	};
	teamNav.selectTeam = function (team) {
		teamNav.currentTeam(team);
		results.mapNavigation.currentTile(team.tile())
		results.mapNavigation.updateTileDisplay();
		results.artist.centerCameraOnTile(team.tile());
		results.artist.draw();
	};
	teamNav.unselectTeam = function () {
		teamNav.currentTeam(undefined);
		results.artist.draw();
	}
	teamNav.formNewTeam = function () {
		var team = createTeam(getTeamName(), consumableList.map(c=>copyConsumable(c)), "modern", "Patrol", "assets/modern.svg");
		//TODO: place in tile associated with structure
		team.tile(results.map.homeTile);
		//TODO: Maybe get base faction instead?
		results.factionManager.currentFaction().explorationMap().share(team.explorationMap());
		teamNav.teams.push(team);
	}
	teamNav.disbandTeam = function (team) {
		if(team.units().length){
			results.message("you cannot disband this team with people in it!");
			return;
		}
		team.tile().contents = team.tile().contents.concat(team.loot());
		teamNav.teams.remove(team);
		results.mapNavigation.updateTileDisplay();
		results.artist.draw();
	}
	teamNav.transferUnit = function (unit) {
		results.groupNavigation.currentGroup().contents.push(unit);
		teamNav.currentTeam().units.remove(unit);
		results.groupNavigation.updateGroupDisplay();
	}
	teamNav.unitActions = ko.pureComputed(() => {
		return teamNav.currentTeam().units().map(unit => {
			return ( results.groupNavigation.currentGroup()? 
			[{
				name:"Transfer",
				svg: "assets/transfer.svg",
				click: () => {teamNav.transferUnit(unit)}
			}]
			:[])
			.concat(unit.gear().map((gear) => ({
				name: "unequip "+gear.name(),
				svg: "assets/unequip_"+gear.name()+".svg",
				//svg: gear.svg,
				click: () => {teamNav.unequip(gear, unit)}
			})));
		})
	});
	return teamNav;
}
function registerTeamNav () {
	ko.components.register("team-nav", {
	viewModel: function(params) {
		this.teamNavigation = params.teamNav;
		this.root = params.root;
	},
	template: 
	`<div data-bind="with: teamNavigation" id="teamNav" class="navigationPane"> 
		<div class="panelLable">Team Navigation</div>
		<div data-bind="foreach:teams">
			<div>
				<image data-bind="attr:{src:svg}" class="smallIcon"></image>
				<span data-bind="text:name"></span>
				<span data-bind="text:tile().name"></span>
				<button data-bind="click:$parent.selectTeam">Select</button>
				<button data-bind="click:$parent.disbandTeam">Disband</button>
			</div>
		</div>
		<div><button data-bind="click:unselectTeam">Unselect Team</button></div>
		<div><button data-bind="click:formNewTeam">Form New Team</button></div>
		<div><button data-bind="click:endTurn">End Turn</button></div>
		<div data-bind="with: currentTeam">
			<h4>
				<span data-bind="text:name"></span>
				<image data-bind="attr:{src:svg}" class="referenceIcon"></image>
				<image data-bind="attr:{src:'assets/transfer.svg'}" class="smallIcon"></image>
				<span data-bind="text:getSupply('moves')"></span>
				<image data-bind="attr:{src:'assets/food.svg'}" class="smallIcon"></image>
				<span data-bind="text:getSupply('food')"></span>
				<image data-bind="attr:{src:'assets/ammo.svg'}" class="smallIcon"></image>
				<span data-bind="text:getSupply('ammo')"></span>
			</h4>
			<div>Stealth: <span data-bind="text:stealth().toFixed(2)"></span></div>
			<div data-bind="foreach: stealthComponents" class="statBreakdown">
				<div class="statItem">
					<span data-bind="text:name"></span>
					<span data-bind="text:value.toFixed(2)"></span>
				</div>
			</div>
			<div>Per: <span data-bind="text:per().toFixed(2)"></span></div>
			<div data-bind="foreach: perComponents" class="statBreakdown">
				<div class="statItem">
					<span data-bind="text:name"></span>
					<span data-bind="text:value.toFixed(2)"></span>
				</div>
			</div>
			<!--div data-bind="foreach: units">
				<unit-stats params="unit:$data, actions: $parents[1].unitActions($data)"/>
			</div-->
			<unit-list params="units: units, actions: $parent.unitActions, style:''"></unit-list>
			<div>Loot:</div>
			<div data-bind="foreach: loot">
				<div>
					<span data-bind="text:name"></span>
					<span data-bind="if:types.includes('weapon')">
						<span data-bind="text:weaponTypes.join(',')"></span>-
						<span data-bind="text:damage"></span>
					</span>
					<button data-bind="click:$root.teamNavigation.drop">drop</button>
					<span data-bind="if:featureType == 'GearStack'">
						<button data-bind="click:$root.teamNavigation.split">split</button>
					</span>
					<span data-bind="if:featureType == 'GearStack' || handling.includes('countable')">
						<button data-bind="click:$root.teamNavigation.stack">stack</button>
					</span>
					<span data-bind="if:types.includes('weapon') && featureType!='GearStack'">
						<span data-bind="foreach:$parent.units">
							<button data-bind="click:() => $root.teamNavigation.equip($parent, $data), text:'equip '+$data.name()"></button>
						</span>
					</span>
				</div>
			</div>
			<div>Supplies:</div>
			<div data-bind="foreach:supply && supply.getSupplies()">
				<div>
					<span data-bind="text:name"></span>
					:
					<span data-bind="text:amount"></span>
					<span data-bind="if:$root.groupNavigation.currentGroup() && amount() >0">
						<button data-bind="click:()=>$parent.supply.transferSupply(name,1,$root.groupNavigation.currentGroup().supply)">transfer</button>
						<button data-bind="click:()=>$parent.supply.transferSupply(name,5,$root.groupNavigation.currentGroup().supply)">transfer 5</button>
					</span>
				</div>
			</div>
		</div>
	</div>`
	});
}