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
		message: ko.observable(""),
		currentTurn: ko.observable(""),
		location: ko.observable()
	};
	
	battleground.setUpBattle = function(attackers, defenders, tile, distance, attackersStart) {
		battleground.attackingTeam(attackers);
		battleground.defendingTeam(defenders);
		battleground.attackers(attackers.units());
		battleground.defenders(defenders.units());
		battleground.location(tile);

		battleground.attackers().forEach(unit=> {
			unit.log("");
			unit.distance(distance);
			unit.actions(attackersStart?1:0);
		});
		battleground.defenders().forEach(unit=> {
			unit.log("");
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
		
		battleground.setUpBattle(attackers, defenders, tile, distance);
		
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
		battleground.aiTurn();
	}
	
	battleground.attackerOptions = ko.pureComputed(() => {
		return battleground.attackers().map(unit => battleground.moveOptions(unit));
	}); 
	battleground.targetOptions = ko.pureComputed(() => {
		if(battleground.mode() != "selectTarget" || !battleground.currentUnit() || !battleground.currentWeapon()){
			return [];
		}
		var result = battleground.targets(battleground.currentUnit(), battleground.currentWeapon(), battleground.defenders());
		return result;
	});
	battleground.targetUnitOptions = function(unit) {
		return battleground.targetOptions().filter(t => t==unit)
		.map(unit => ({
			name:battleground.attackOdds(battleground.currentUnit(),battleground.currentWeapon(),unit) +'%',
			click: () => battleground.target(unit)
		}))
	}
	battleground.target = function (unit) {
		if(battleground.mode() == "selectTarget") {
			var attacker = battleground.currentUnit();
			var weapon = attacker.gear()[0];
			battleground.runAttack(attacker, weapon, unit);
		}
		battleground.checkStatus();
	}
	battleground.checkStatus = function (enemyActionsQueued){
		if(battleground.mode() == "over") return;
		var attackerStatus = battleground.attackers().map(a => a.status());
		var defenderStatus = battleground.defenders().map(a => a.status());
		if(debugBattleGround)console.log("statuses", attackerStatus, defenderStatus);
		if(attackerStatus.filter(a=>a!="dead").length == 0){
			battleground.message("attackers are defeated");
			battleground.active(false);
			results.map.updateAfterBattle(battleground, battleground.attackingTeam());
			return;
		}
		if(defenderStatus.filter(a=>a!="dead").length == 0) {
			battleground.message("defenders are defeated");
			battleground.active(false);
			//TODO: way to avoid tieing to results?
			results.map.updateAfterBattle(battleground, battleground.defendingTeam());
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
				var options = battleground.moveOptions(unit);
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
				var options = battleground.moveOptions(unit);
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
				var options = battleground.moveOptions(unit);
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
		opps = opps
		.filter(opp => opp.status() != "dead")
		.filter(opp => weapon.weaponTypes.includes("ranged") || Math.abs(opp.distance()-unit.distance())<=1)
		if(weapon.weaponTypes.includes("area")) { 
			opps = 
				opps.map(opp =>opp.distance())
				.filter((distance,index, array) => array.indexOf(distance)==index)
				.map(distance => opps.filter(opp => opp.distance() == distance))
				.concat(opps);
		}
		return opps;
	}
	battleground.enemyTurn = function () {
		battleground.enemyMove(battleground.defenders().filter(unit => unit.status() == "ready"));
	}
	battleground.aiTurn = function () {
		var currentTeam = battleground.currentTurn() =="attackers"? battleground.attackers(): battleground.defenders();
		battleground.enemyMove(currentTeam.filter(unit => unit.status() == "ready"));
	}
	battleground.enemyMove = function (readyUnits) {
		//TODO: check if unit is still available
		var unit = readyUnits.pop();
		var unitActions = battleground.moveOptions(unit);
		var isAttacker = battleground.attackers().includes(unit);
		var opponents = isAttacker? battleground.defenders() : battleground.attackers();

		var attacks = unitActions.filter(action => action.id == "attack");
		var moves = unitActions.filter(action => action.id == "move");
		if(attacks.length){
			var attack = attacks.sort((a,b)=> a.value.damage() - b.value.damage())[0];
			targets = battleground.targets(unit, attack.value, opponents)
			//TODO: target choosing function!
			var target = targets[0];
			battleground.runAttack(unit, attack.value, target);
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
			unit.log("moved " +distance +" to " + unit.distance())
			battleground.message(unit.name() + " "+ unit.log());
		}
	}
	battleground.runAttack = function(attacker, weapon, defenders) {
		//TODO: reject if not a valid attack
		defenders = [defenders].flat();
		var areaPenalty = 0;
		for(var defender of defenders){
			var targetNumber = battleground.attackTargetNumber(attacker, weapon, defender, defenders.length >1)
			var combatResult = randomGausian(0,10);
			var damage = 0;
			if(combatResult > targetNumber){
				//TODO: add effects
				//damage = weapon.damage()
				damage = defender.damageFrom(weapon);
			}
			defender.currentHp(defender.currentHp() - damage);
			attacker.actions(attacker.actions()-1);
			//log results  
			attacker.log("attacked "+defender.name()+ " for " + damage);
			defender.log("attacked by "+attacker.name()+ " for " + damage);
			battleground.message("attacked "+defender.name()+ " with " + combatResult +" vs " + targetNumber);
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
			targetNumber += rangePenalty;
		}
		if(areaAttack) targetNumber+=5;
		return targetNumber;
	}
	battleground.moveOptions = function (unit) {
		if(unit.status() != "ready" || battleground.active() == false) return [];
		var isAttacker = battleground.attackers().includes(unit);
		var opponents = isAttacker? battleground.defenders() : battleground.attackers();
		var distanceClusters = opponents.map(opp => opp.distance())
			.filter((distance, index, array) => array.indexOf(distance) == index);
		var options = [
			{name: "Move Towards", id: "move", value: (unit.speed()*(isAttacker?-1:1))},
			{name: "Move Away", id: "move", value: (unit.speed()*(isAttacker?1:-1))}
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
						oppDistance: 0
					})
				}
			});
		unit.gear().forEach(gear => {
			if(gear.types.includes("weapon")){
				if(battleground.targets(unit, gear, opponents).length){
					options.push({name: gear.name(), id: "attack", value: gear});
				}
			}
		});
		options.forEach(action => {
			action.click = () => {battleground.handleAction(action);};
			action.unit = unit;
		});
		return options;
	};
	return battleground;
}