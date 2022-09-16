function createEncounterZone () {
	var encounterZone = {
		active: ko.observable(false),
		encounter: ko.observable(undefined),
		message: ko.observable(""),
		question: ko.observable(""),
		options: ko.observableArray([])
	};
	encounterZone.endEncounter = function () {
		encounterZone.active(false);
		encounterZone.encounter(undefined);
		encounterZone.message("");
		encounterZone.question("");
		encounterZone.options([]);
	}
	encounterZone.setEncounter = function(feature, tile) {
		encounterZone.encounter(feature);
		encounterZone.active(true);
		if(feature.featureType == "Team"){
			encounterZone.setTeamEncounter(feature,tile);
		} 
		else {
			encounterZone.message("you have encountered a "+feature.featureType)
			encounterZone.question("It is called a "+feature.name())
			encounterZone.options([
				{
					text:"OK",
					click: () => {encounterZone.endEncounter();}
				}
			])
		}
	}
	encounterZone.stealthDistances = function (attackingTeam, defendingTeam, tile, attackerPrefersClose) {
		var defenderPer = defendingTeam.per();
		var defenderStealth = defendingTeam.stealth();
		var attackerPer = attackingTeam.per();
		var attackerStealth = attackingTeam.stealth();

		var attackerPerResult = randomGausian(0,10);
		var defenderPerResult = randomGausian(0,10);
		
		var attackerContestResult = attackerPerResult + attackerPer - defenderStealth;
		var defenderContestResult = defenderPerResult + defenderPer - attackerStealth;
		//TODO: figure the +3 into the system somehow
		var distances = {
			attacker : Math.round(Math.pow(2, attackerContestResult/5 + 3)),
			defender : Math.round(Math.pow(2, defenderContestResult/5 + 3)),
			maximum : tile.sightlines()*randomGausian(1,.25),
		}
		distances.distance = attackerPrefersClose^attackerContestResult>defenderContestResult?
			distances.defender: distances.attacker

		return distances;
	}
	encounterZone.setTeamEncounter = function (feature, tile){
			var defendingTeam = feature;
			var attackingTeam = results.teamNavigation.currentTeam()
			
			var distances = encounterZone.stealthDistances(attackingTeam, defendingTeam, tile)
			//TODO: watching to make sure distances are working correctly
			console.log("distances: max, attk, def", distances.maximum, distances.attacker, distances.defender);
			
			if((distances.maximum < distances.attacker && distances.maximum < distances.defender) || distances.attacker == distances.defender) {
				encounterZone.setAccidentalEncounter(feature,tile, distances.maximum)
			}
			
			if(!distances.attackersStart) {
				//TODO: this presumes that the defenders want to get as close as possible, and want to attack
				encounterZone.setDefenderAmbush(feature, tile, distances.attacker, false)
			}
			else {
				encounterZone.setAttackerAmbush(feature, tile, distances.attacker, distances.defender);
			}
	}
	encounterZone.setAttackerAmbush = function (feature, tile, attackerDistance, defenderDistance) {
		encounterZone.message("you have encountered a team of "+ feature.name() +"!")
		encounterZone.question("would you like to...")
		encounterZone.options([
			{
				text:"leave without making yourself known?",
				click: () => {
					tile.exploredFeatures.push(feature);
					encounterZone.endEncounter();
					results.mapNavigation.updateTileDisplay();
				}
			},
			{
				text: "Open fire at maximum range?",
				click: () => {encounterZone.toBattle(feature, tile, attackerDistance, true);}
			},
			{
				text: "Sneak as close as possible before attacking?",
				click: () => {encounterZone.toBattle(feature, tile, defenderDistance, true);}
			},
			{
				text:"Negotiate?",
				click: () => {
					tile.exploredFeatures.push(feature);
					results.mapNavigation.updateTileDisplay();
					encounterZone.setDiplomacy(feature,tile);
				}
			},

		])
	}
	encounterZone.setDefenderAmbush = function (feature, tile, distance) {
		encounterZone.message("you have been ambushed by "+ feature.name() +" at "+ distance+ "!")
		encounterZone.question("Defend Yourselves!")
		encounterZone.options([
			{
				text: "Ok",
				click: () => {encounterZone.toBattle(feature, tile, distance, false);}
			}
		])
	}
	encounterZone.setDiplomacy = function (feature, tile) {
		encounterZone.message("you wish to negotiate with "+ feature.name())
		encounterZone.question("would you like to...")
		encounterZone.options([
			{
				text:"offer a gift of food?",
				click: () => {
					console.log("you have offered food!");
					console.log("We need to implement a reaction system!");
					encounterZone.endEncounter();
				}
			},
			{
				text:"brandish weapons?",
				click: () => {
					console.log("you are brandishing weapons!")
					encounterZone.endEncounter();
				}
			},
			{
				text: "attack?",
				click: () => {encounterZone.toBattle(feature, tile, 0, true);}
			}
		]);
	}
	encounterZone.rejectedFood = function (feature, tile) {
		encounterZone.message(feature.name() + "has rejected your offer of food!")
		encounterZone.question(feature.name() + "attacks!")
		encounterZone.options([
			{
				text: "Ok",
				//TODO: get distance
				click: () => {encounterZone.toBattle(feature, tile, 4, false);}
			}
		]);
	}
	encounterZone.acceptedFood = function (feature, tile) {
		encounterZone.message(feature.name() + " takes your offer of food")
		encounterZone.question(feature.name() + " seems to appreciate the gift!")
		encounterZone.options([
			{
				text: "Ok",
				click: () => {encounterZone.endEncounter();}
			}
		]);
	}
	encounterZone.setAccidentalEncounter = function (feature, tile, distance) {
		encounterZone.message("you have bumped into a team of "+ feature.name() +"!")
		encounterZone.question("would you like to...")
		encounterZone.options([
			{
				//TODO: determined by speed
				text:"Flee?",
				click: () => {
					tile.exploredFeatures.push(feature);
					encounterZone.endEncounter();
					results.mapNavigation.updateTileDisplay();
				}
			},
			{
				text:"Negotiate?",
				click: () => {
					tile.exploredFeatures.push(feature);
					results.mapNavigation.updateTileDisplay();
					encounterZone.setDiplomacy(feature,tile);
				}
			},
			{
				text: "Attack?",
				//TODO: who goes first less random
				click: () => {encounterZone.toBattle(feature, tile, distance, randomGausian(0,10)>0);}
			}
		]);
	}
	encounterZone.toBattle = function (feature, tile, distance, attackersStart) {
		results.battleground.setUpPlayerBattle(results.teamNavigation.currentTeam(), feature, tile, distance, attackersStart); //TODO: range controls
		encounterZone.endEncounter();
	}
	return encounterZone;
}