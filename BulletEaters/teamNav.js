function createTeamNavigation() {
	var consumableList = Object.values(results.library.consumables);
	var teamNav = {
		teams: ko.observableArray([
			createTeam(getTeamName(), consumableList.map(c=>copyConsumable(c)), "modern", "Patrol"),
		]),
		currentTeam: ko.observable()
	};
	teamNav.endTurn = function (){
		//TODO: actually run enemy action
		var factionsToRun = ["Goblin", "Undead", "Monster"];
		//TODO: results.map is not the idea way
		var toMove = factionsToRun.map(faction => ({faction: faction, pieces: results.map.getFactionPieces(faction)}))
		.forEach(faction => {
			faction.pieces.teams.forEach(team => {
				
				//console.log("this team can move", team.team.name(), team.team.faction());
				if(team.team.units().map(u => u.type()).includes("worm")) {
					//TODO: move the worm!
					var tile = team.tile;
					var discovery = results.mapNavigation.exploreResult(tile, team.team.featureMap[tile.x][tile.y].concat(team.team));
					//console.log("this worm can move to...");
					//console.log("this worm needs to go exploring!");
					console.log(team.team.name() + " found ", discovery.name());
					if(discovery.featureType == "Team"){
						var distance = results.encounterZone.stealthDistances(team.team, discovery, tile).distance;
						if(discovery.faction() == "modern"){
							results.battleground.setUpPlayerBattle(discovery,team.team, tile, distance);
						}else {
							results.battleground.setUpAiBattle(team.team, discovery, tile, distance);
						}
					}
				}
			});
			faction.pieces.structures.forEach(structure => {
				
				if(structure.structure.type() == "Worm Nest") {
					if(Math.random()*10 <1){
						var newWorms = createTeam("worm"+Math.floor(Math.random()*1000), [], "Monster", "Stalk");
						var tile = structure.tile;
						newWorms.units.push(copyUnit(results.library.units.worm));
						tile.contents.push(newWorms);
						newWorms.tile(tile);
						//TODO: don't rely on results to get the map... maybe it should live somewhere better?
						newWorms.featureMap[tile.x][tile.y] = results.map.obviousContents(tile);
						console.log("a new worm at ", tile.x, tile.y);
					}
				}
				//console.log("this structure can do things", structure.name(), structure.faction());
			})

		});
		teamNav.teams().forEach((team) => {
			team.setSupply("moves",3);
			team.addSupply("food",-1*team.units().length);
		});
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
		centerCameraOnTile(team.tile());
		draw();
	};
	teamNav.unselectTeam = function () {
		teamNav.currentTeam(undefined);
		draw();
	}
	teamNav.formNewTeam = function () {
		//TODO: associate with stuctures?
		var team = createTeam(getTeamName(), consumableList.map(c=>copyConsumable(c)), "modern", "Patrol");
		team.tile(teamNav.homeTile);
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
		draw();
	}
	teamNav.transferUnit = function (unit) {
		results.groupNavigation.currentGroup().contents.push(unit);
		teamNav.currentTeam().units.remove(unit);
		results.groupNavigation.updateGroupDisplay();
	}
	teamNav.unitActions = function(unit){
		return [{
			name:"Transfer",
			click: () => {teamNav.transferUnit(unit)}
		}]
		.concat(unit.gear().map((gear) => ({
			name: "unequip "+gear.name(),
			click: () => {teamNav.unequip(gear, unit)}
		})));
	}
	return teamNav;
}
function registerTeamNav () {
	ko.components.register("team-nav", {
	viewModel: function(params) {
		this.teamNavigation = params.teamNav;
		this.root = params.root;
	},
	template: 
	`<div data-bind="with: teamNavigation" id="teamNav"> 
		<div data-bind="foreach:teams">
			<div>
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
			<h4 data-bind="text:name"></h4>
			<div>Stealth: <span data-bind="text:stealth"></span></div>
			<div>Per: <span data-bind="text:per"></span></div>
			<div data-bind="foreach: units">
				<unit-stats params="unit:$data, actions: $parents[1].unitActions($data)"/>
			</div>
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