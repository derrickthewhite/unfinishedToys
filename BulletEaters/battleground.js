var debugBattleGround = false;
function createBattleground(){
	var battleground = {
		active: ko.observable(false),
		attackers: ko.observableArray([]),
		defenders: ko.observableArray([]),
		attackingTeam: ko.observable(),
		defendingTeam: ko.observable(),
		mode: ko.observable("selectUnit"), //selectUnit, selectTarget, enemyTurn, aiFight, over
		currentUnit: ko.observable(),
		currentWeapon: ko.observable(),
		currentMessage: ko.observable(""),
		messages: ko.observableArray([]),
		currentTurn: ko.observable(""),
		location: ko.observable()
	};
	
	battleground.message = function(message) {
		battleground.currentMessage(message);
		battleground.messages.unshift(message);
	}
	
	battleground.setUpBattle = function(attackers, defenders, tile, distance, attackersStart) {
		battleground.attackingTeam(attackers);
		battleground.defendingTeam(defenders);
		battleground.attackers(attackers.units());
		battleground.defenders(defenders.units());
		battleground.location(tile);

		battleground.attackers().forEach(unit=> {
			unit.distance(distance);
			unit.actions(attackersStart?1:0);
		});
		battleground.defenders().forEach(unit=> {
			unit.distance(0);
			unit.actions(attackersStart?0:1 );
		});
		
		if(debugBattleGround){
			console.log("battle ground defenders", battleground.defenders().map(u => u.status()));
			console.log("battle ground attackers", battleground.attackers().map(u => u.status()));
		}
		
	}
	battleground.setUpPlayerBattle = function (attackers, defenders, tile, distance, attackersStart) {
		battleground.message("starting combat with "+ (attackersStart?"attackers":"defenders"));
		
		battleground.mode(attackersStart? "selectUnit": "enemyTurn");
		
		battleground.setUpBattle(attackers, defenders, tile, distance, attackersStart);
		
		battleground.active(true);
		battleground.currentTurn(attackersStart?"attackers":"defenders");
		if(!attackersStart)
			battleground.enemyTurn();
	}
	//attackers are assumed to go first in ai setup
	battleground.setUpAiBattle = function (attackers, defenders, tile, distance) {
		battleground.setUpBattle(attackers, defenders, tile, distance, true);
		if(debugBattleGround)console.log("setting up AI battle", attackers.name(), "vs", defenders.name());
		battleground.mode("aiFight");
		battleground.active(true);
		
		battleground.currentTurn("attackers");
		//TODO: run until battle is over
		while(battleground.active())
			battleground.aiTurn();
	}

	battleground.targetOptions = ko.pureComputed(() => {
		if(battleground.mode() != "selectTarget" || !battleground.currentUnit() || !battleground.currentWeapon()){
			return [];
		}
		var result = battleground.targets(battleground.currentUnit(), battleground.currentWeapon(), battleground.defenders());
		return result;
	});
	battleground.targetActions = ko.pureComputed (() => {
		return battleground.defenders().map(unit => {
			return battleground.targetOptions().includes(unit)?
			{
				name:battleground.attackOdds(battleground.currentUnit(),battleground.currentWeapon(),unit) +'%',
				click: () => battleground.target(unit),
				svg: "" //TODO: add a unit maybe?
			}:
			[]
		});
	});
	
	battleground.unitGrid = function () {
		var result = [];
		var units = battleground.attackers().concat(battleground.defenders());
		var locations = units.map(unit => unit.distance()).filter((distance, index, array) => array.indexOf(distance) == index).sort((a,b) => a-b);
		var zones = [];
		var buffer = 1;
		var currentZone = {start: locations[0]-buffer, end: locations[0]+buffer};
		zones.push(currentZone);
		for(var i = 1; i< locations.length; i++){
			var currentLocation = locations[i];
			if(currentLocation <= currentZone.end + buffer +1) currentZone.end = currentLocation + buffer;
			else {
				currentZone = {start: currentLocation-buffer, end: currentLocation+buffer};
				zones.push(currentZone);
			}
		}
		var shownZoneLength = zones.reduce((sofar, zone) => sofar + zone.end-zone.start +1, 0)
		var positions = [{description: "..."}];
		var scale = battleMapConfig.scale;
		for(var z =0; z< zones.length; z++) {
			var startPositionCtxCoord =positions.length*scale+scale/2;
			
			for(var p = zones[z].start; p <= zones[z].end; p++){
				positions.push({description: p, index: p});
			}
			
			if(zones[z+1]) positions.push({description: "..."})
			else positions.push({description: "..."});
		}
		for(var i = 0 ;i < positions.length; i++){
			//TODO: rename index
			result[i] = units.filter(unit => unit.distance() == positions[i].index);
			result[i].description = positions[i].description;
		}
		return result;
	}

	battleground.target = function (unit) {
		if(battleground.mode() == "selectTarget") {
			var attacker = battleground.currentUnit();
			//TODO: multiple weapon evaluation
			//TODO: is all gear weapons?
			var weapon = attacker.gear()[0];
			battleground.runAttack(attacker, weapon, unit);
		}
		battleground.checkStatus();
	}
	battleground.checkStatus = function (enemyActionsQueued){
		if ( battleground.mode() != 'aiFight') results.artist.drawBattleMap();
		if(battleground.mode() == "over") return;
		var attackerStatus = battleground.attackers().map(a => a.status());
		var defenderStatus = battleground.defenders().map(a => a.status());
		if(debugBattleGround)console.log("statuses", attackerStatus, defenderStatus);
		if(attackerStatus.filter(a=>a!="dead").length == 0){
			battleground.message("attackers are defeated");
			battleground.active(false);
			battleground.updateAfterBattle(battleground, battleground.attackingTeam());
			return;
		}
		if(defenderStatus.filter(a=>a!="dead").length == 0) {
			battleground.message("defenders are defeated");
			battleground.active(false);
			//TODO: way to avoid tieing to results?
			battleground.updateAfterBattle(battleground, battleground.defendingTeam());
			return;
		}
		var attackersTurn = battleground.currentTurn() == "attackers";
		var currentSide = attackersTurn? attackerStatus: defenderStatus;
		var turnOver = currentSide.filter(a=>a=="ready").length == 0;
		
		if(debugBattleGround)console.log("checking status", enemyActionsQueued);
		if(debugBattleGround)console.log("attackers turn", attackersTurn, "turn over", turnOver);
		
		if(turnOver){
			battleground.currentTurn(attackersTurn? "defenders": "attackers");
			var nextTeam = attackersTurn? battleground.defenders(): battleground.attackers();
			nextTeam.forEach(unit => unit.actions(1));
		}
		
		if((attackersTurn && turnOver) || (!attackersTurn && !turnOver)){
			if(debugBattleGround)console.log("its the defenders turn turn!");

			if(battleground.mode() != "aiFight") {
				battleground.mode("enemyTurn");
				if(!enemyActionsQueued)battleground.enemyTurn();
			} else {
				if(!enemyActionsQueued)battleground.aiTurn();
			}
		}
		else {
			if(debugBattleGround)console.log("its the attackers turn turn!");
			if(battleground.mode() != "aiFight"){
				battleground.mode("selectUnit");
			} else {
				if(!enemyActionsQueued) battleground.aiTurn(); 
			}
		}
	}
	battleground.allAttack = function () {
		if(["aiFight", "enemyTurn"].includes(battleground.mode())) return;
		var unitsActions = [];
		var opponents = battleground.defenders();
		battleground.attackers().forEach(unit => {
			if(unit.status() == "ready") {
				//var options = battleground.moveOptions(unit);
				var options = battleground.moveOptions()[battleground.attackers().concat(battleground.defenders()).indexOf(unit)];
				var attacks = options.filter(action => action.id == "attack");
				if(attacks.length > 0) {
					var attack = attacks.sort((a,b)=> a.value.damage() - b.value.damage())[0];
					//TODO: target choosing function!
					var target = battleground.targets(unit, attack.value, opponents)[0];
					battleground.runAttack(unit, attack.value, target);
				}
			}
		});
		battleground.checkStatus();
	}
	battleground.allRetreat = function () {
		if(["aiFight", "enemyTurn"].includes(battleground.mode())) return;
		battleground.attackers().forEach(unit => {
			if(unit.status() == "ready") {
				var options = battleground.moveOptions()[battleground.attackers().concat(battleground.defenders()).indexOf(unit)];
				var moves = options.filter(action => action.id == "move");
				if(moves.length > 0) {
					var move = moves.sort((a,b)=> b.value - a.value)[0];
					battleground.moveUnit(unit, move.value);
				}
			}
		});
		battleground.checkStatus();
	}
	battleground.allAdvance	= function () {
		if(["aiFight", "enemyTurn"].includes(battleground.mode())) return;
		battleground.attackers().forEach(unit => {
			if(unit.status() == "ready") {
				var options = battleground.moveOptions()[battleground.attackers().concat(battleground.defenders()).indexOf(unit)];
				var moves = options.filter(action => action.id == "move");
				if(moves.length > 0) {
					var move = moves.sort((a,b)=> a.value -b.value)[0];
					battleground.moveUnit(unit, move.value);
				}
			}
		});
		battleground.checkStatus();
	}
	battleground.targets = function (unit, weapon, opps) {
		if(unit.status()!="ready") return [];
		var team = battleground.attackers().includes(unit)? battleground.attackingTeam(): battleground.defendingTeam();
		for(var cost of weapon.costs){
			if(team.getSupply(cost.name) < cost.value) return [];
		}
		opps = opps
		.filter(opp => opp.status() != "dead")
		//TODO: finish move and attack!
		.filter(opp => weapon.weaponTypes.includes("ranged") || Math.abs(opp.distance()-unit.distance())<=unit.speed())
		if(weapon.weaponTypes.includes("area")) { 
			opps = 
				opps.map(opp =>opp.distance())
				.filter((distance,index, array) => array.indexOf(distance)==index)
				.map(distance => opps.filter(opp => opp.distance() == distance))
				.concat(opps);
		}
		return opps;
	}
	battleground.canTarget = function(unit, weapon, target) {
		if(!unit) return false;
		if(!weapon) weapon = unit.gear()[0];
		if(!target && target!=0) return false;
		var isAttacker = battleground.attackers().includes(unit);
		var opponents = isAttacker? battleground.defenders() : battleground.attackers();
		targets = battleground.targets(unit, weapon, opponents);
		if(isNaN(target)){
			return targets.includes(target)
		}
		return targets.find(pTarget => Array.isArray(pTarget) && pTarget[0].distance() == target);
	}
	battleground.enemyTurn = function () {
		battleground.enemyMove(battleground.defenders().filter(unit => unit.status() == "ready"));
	}
	battleground.aiTurn = function () {
		var currentTeam = battleground.currentTurn() =="attackers"? battleground.attackers(): battleground.defenders();
		battleground.enemyMove(currentTeam.filter(unit => unit.status() == "ready"));
	}
	battleground.enemyMove = function (readyUnits) {
		if(battleground.mode() == "over"){
			console.log("call enemy move when battle is over");
			return;
		}
		//TODO: check if unit is still available
		var unit = readyUnits.pop();
		var unitActions = battleground.moveOptions()[battleground.attackers().concat(battleground.defenders()).indexOf(unit)];
		var isAttacker = battleground.attackers().includes(unit);
		var opponents = isAttacker? battleground.defenders() : battleground.attackers();

		var attacks = unitActions.filter(action => action.id == "attack");
		var moves = unitActions.filter(action => action.id == "move");
		var attackOptions = attacks.map(attack => battleground.targets(unit, attack.value, opponents).map(target => ({
			attack: attack.value, 
			target: target
			}))).flat();
		attackOptions.forEach( attackOption =>  {
			if(Array.isArray(attackOption.target)){
				attackOption.damage= attackOption.target.map(target => target.damageFrom(attackOption.attack));
				attackOption.percentage = attackOption.target.length? attackOption.target.reduce((sofar, target) => sofar * battleground.attackOdds(unit, attackOption.attack, target),1): 0;
				attackOption.death = attackOption.target.length? attackOption.target.reduce((sofar, target) => (target.damageFrom(attackOption.attack) >= target.currentHp() && target.status() != "dead") || sofar, false): false;
			}
			else {
				attackOption.damage=  attackOption.target.damageFrom(attackOption.attack);
				attackOption.percentage = battleground.attackOdds(unit, attackOption.attack, attackOption.target);
				attackOption.death = attackOption.damage >= attackOption.target.currentHp() && attackOption.target.status() != "dead";
			}
		});
		//TODO: distinguish between stacking and non-stacking effects
		attackOptions= attackOptions.filter(attackOption => {
			if(Array.isArray(attackOption.target))
				return attackOption.target.reduce((sofar, target) => !target.buffs().includes(attackOption.attack.effects()[0]) || sofar, false);
			else 
				return !attackOption.target.buffs().includes(attackOption.attack.effects()[0]);
		})
		
		if(attackOptions.length){
			//TODO: better attack choosing function? worms are just spitting at each other back and forth
			var optionSelected = randomElement(attackOptions);
			battleground.runAttack(unit, optionSelected.attack, optionSelected.target);
		} else if(moves.length){
			//TODO: is the order on this correct
			var move = moves.sort((a,b) => {
				return a.oppDistance - b.oppDistance;
			})[0];
			battleground.moveUnit(unit, move.value);
		} else {
			if(debugBattleGround)console.log("no action found");
			battleground.message("no action found");
			unit.actions(unit.actions() -1);
		}
		battleground.checkStatus(true);
		var delay = battleground.mode() == "aiFight"?0:results.config.aiTurnLength();
		if(readyUnits.length)
			setTimeout(() => battleground.enemyMove(readyUnits), delay);
		else
			setTimeout(() => battleground.checkStatus(false), delay);
	}
	battleground.handleAction = function (action) {
		if(action.id == "move") {
			battleground.moveUnit(action.unit, action.value);
			battleground.checkStatus();
		}
		if(action.id == "attack") {
			battleground.currentUnit(action.unit);
			battleground.currentWeapon(action.value);
			battleground.mode("selectTarget");
			results.artist.drawBattleMap();
			action.unit.log("about to attack");
			battleground.message("select "+action.unit.name()+"'s target");
					
			var isAttacker = battleground.attackers().includes(action.unit);
			var opponents = isAttacker? battleground.defenders() : battleground.attackers();

			if(debugBattleGround)console.log("possible targets", action, battleground.targets(action.unit, action.value, opponents))
		}
	}
	battleground.moveUnit = function(unit, distance) {
		if(Math.abs(distance) <= unit.speed() && unit.actions()) {
			unit.distance(unit.distance() + distance);
			unit.actions(unit.actions()-1);
			battleground.message(unit.name() + " "+ "moved " +distance +" to " + unit.distance());
		}
	}
	battleground.runAttack = function(attacker, weapon, defenders) {
		//TODO: reject if not a valid attack
		defenders = [defenders].flat();
		
		//TODO: reject attacks without supply
		var team = battleground.attackers().includes(attacker)? battleground.attackingTeam(): battleground.defendingTeam();
		for(var cost of weapon.costs){
			team.addSupply(cost.name, -cost.value);
		}
		
		var areaPenalty = 0;
		for(var defender of defenders){
			var targetNumber = battleground.attackTargetNumber(attacker, weapon, defender, defenders.length >1);
			var combatResult = randomGausian(0,10);
			var damage = 0;
			if(combatResult > targetNumber){
				damage = defender.damageFrom(weapon);
				weapon.effects().forEach(effect => defender.buffs.push(effect));
				
			}
			defender.currentHp(defender.currentHp() - damage);
			//close the distance
			if(attacker.distance() != defender.distance() && weapon.weaponTypes.includes("melee")){
				attacker.distance(defender.distance());
			}
			attacker.actions(attacker.actions()-1);
			battleground.message(attacker.type() +"("+attacker.name()+") attacked "+defender.type()+ "(" + defender.name() +") with " + weapon.name()+ " : " + combatResult.toFixed(2) +" vs " + targetNumber.toFixed(2) + (combatResult > targetNumber? " success!": " failure!"));
		}
	}
	battleground.attackOdds = function (attacker, weapon, defender) {
		var targetNumber;
		if(defender.length) {
			targetNumber = defender.reduce((sofar, defender) =>  Math.min(sofar, battleground.attackTargetNumber(attacker, weapon, defender)), Number.POSITIVE_INFINITY) + 5;
		} else {
			targetNumber = battleground.attackTargetNumber(attacker, weapon, defender);
		}
		return battleground.targetNumberOdds(targetNumber);
	}
	battleground.targetNumberOdds = function (targetNumber) {
		return Math.round((zPercentage(targetNumber)+ Number.EPSILON)*100)/100;
	}
	battleground.attackTargetNumber = function(attacker, weapon, defender, areaAttack) {
		var range = Math.abs(attacker.distance() - defender.distance());
		var attackSkill = (weapon.weaponTypes.includes("ranged")? attacker.ranged() : attacker.melee()) + attacker.attackModifier(weapon);
		var defenseSkill = range <= 1 ? Math.max(defender.cover(), defender.block()) :
			weapon.weaponTypes.includes("ranged")? defender.cover() : defender.block();
		var targetNumber = defenseSkill - attackSkill;
		var rangePenalty =0;
		if(weapon.weaponTypes.includes("ranged")){
			rangePenalty = Math.log(range)/Math.log(1.4);
			rangePenalty = Math.max(rangePenalty, 0);
		}
		if(attacker.distance() != defender.distance() && weapon.weaponTypes.includes("melee")){
			rangePenalty = -2 * Math.min(3, Math.abs(attacker.distance() - defender.distance()));
		}
		targetNumber += rangePenalty;
		if(areaAttack) targetNumber+=5;
		return targetNumber;
	}
	battleground.unitIndex = function (unit) {
		return battleground.attackers().concat(battleground.defenders()).indexOf(unit);
	}
	battleground.moveOptions = ko.pureComputed(function () {
		return battleground.attackers().concat(battleground.defenders()). map(unit => {
			if(unit.status() != "ready" || battleground.active() == false) return [];
			var isAttacker = battleground.attackers().includes(unit);
			var opponents = isAttacker? battleground.defenders() : battleground.attackers();
			var distanceClusters = opponents.map(opp => opp.distance())
				.filter((distance, index, array) => array.indexOf(distance) == index);
			var options = [
				{name: "Move Towards", id: "move", value: (unit.speed()*(isAttacker?-1:1)), svg: "assets/moveTowards.svg"},
				{name: "Move Away", id: "move", value: (unit.speed()*(isAttacker?1:-1)), svg: "assets/moveAway.svg"}
			];
			options.forEach(option => {
				option.oppDistance = distanceClusters.map(distance => Math.abs(distance - unit.distance() - option.value)).sort()[0]
			});
			 distanceClusters.map(distance => opponents.filter(opp =>  opp.distance() == distance))
				.forEach(oppCluster => {
					if(oppCluster[0].distance() > unit.distance() - unit.speed() && oppCluster[0].distance() < unit.distance() + unit.speed()){
						options.push({
							name: "move to "+ oppCluster[0].distance(),
							id: "move",
							value: oppCluster[0].distance() - unit.distance(),
							foes: oppCluster,
							oppDistance: 0,
							svg: "assets/moveTo.svg"
						})
					}
				});
			unit.gear().forEach(gear => {
				if(gear.types.includes("weapon")){
					if(battleground.targets(unit, gear, opponents).length){
						options.push({
							name: gear.name(), 
							id: "attack", 
							value: gear,
							svg: gear.svg
						});
					}
				}
			});
			options.forEach(action => {
				action.click = () => {battleground.handleAction(action);};
				action.unit = unit;
			});
			return options;
		});
	});
	
	battleground.removeEndOfFightBuffs = function (team) {
		team.units().forEach(unit => {
			unit.buffs.removeAll(
				unit.buffs().filter(buff => buff.removal.timing == "endOfFight" && buff.removal.func(unit, team))
			);
		});
	}
	
	//TODO: move this somewhere better
	battleground.updateAfterBattle = function (battle, loosingTeam) {
		battleground.messages([]);
		battleground.removeEndOfFightBuffs(battleground.attackingTeam());
		battleground.removeEndOfFightBuffs(battleground.defendingTeam());

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
		battlesite.contents(itemsToAdd);
		
		battle.location().contents.push(battlesite);
		if(battle.mode() != "aiFight")battle.location().exploredFeatures.push(battlesite);
		var winners = [battle.attackingTeam(),battle.defendingTeam()].filter(team => team != loosingTeam)[0]; 
		winners.explorationMap().add(battle.location(),battlesite);
		
		battle.location().exploredFeatures = battle.location().exploredFeatures.filter(feature => feature != loosingTeam);
		winners.explorationMap().remove(battle.location(),loosingTeam);
		
		results.mapNavigation.updateTileDisplay();
		if(battle.mode()!= "aiFight")results.mapNavigation.enterStructure(battlesite);
		// ends the fight
		battle.mode("over");
		results.artist.draw();
	}
	
	return battleground;
}
function registerBattleground () {
	ko.components.register("battle-ground", {
		viewModel: function (params) {
			this.battleground = params.battleground
			this.root = params.root
		},
		template: `<div data-bind="with:battleground"  id = "battleground" class="navigationPane">
						<h1 data-bind="text:currentMessage"></h1>
						<div data-bind="text:mode"></div>
						<div data-bind="if:mode() != 'enemyTurn'">
							<button data-bind="click:allAttack">All Attack</button>
							<button data-bind="click:allRetreat">All Move Back</button>
							<button data-bind="click:allAdvance">All Move Forward</button>
						</div>
						<div data-bind="foreach:targetOptions()">
							<span data-bind="if:$data.length">
								<button data-bind="click:$parent.target, clickBubble:false">All foes at <span data-bind ="text:$data[0].distance()"></span></button>0
								<span data-bind="text:$root.battleground.attackOdds($root.battleground.currentUnit(),$root.battleground.currentWeapon(),$data) +'%'"></span>
							</span>
						</div>
						<unit-list params="units: attackers, actions: moveOptions, style:'#000088'"></unit-list>
						<unit-list params="units: defenders, actions: targetActions, style: '#880000'"></unit-list>
					</div>`
	})
}
function registerBattleReport () {
	ko.components.register("battle-report", {
		viewModel: function (params) {
			this.battleground = params.battleground
			this.root = params.root
		},
		template: `
			<div data-bind="with:battleground" class="navigationPane">
				<div class="panelLable">Battle Report</div>
				<h3>
					<span>Battle</span>
					<img src="assets/battle.svg" class="referenceIcon"></img>
				</h3>

				<div data-bind="foreach: messages">
					<div data-bind="text:$data"></div>
				</div>
			</div>`
		});
}