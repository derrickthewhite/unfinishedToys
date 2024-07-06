function createEncounterZone () {
	var encounterZone = {
		active: ko.observable(false),
		encounter: ko.observable(undefined),
		tile: ko.observable(undefined),
		message: ko.observable(""),
		question: ko.observable(""),
		options: ko.observableArray([]),
		mood: ko.observable(""), // mysterious, hostile, tense, mercantile, friendly
		showImage: ko.observable(false),
		image: ko.observable("")
	};
	encounterZone.endEncounter = function () {
		encounterZone.active(false);
		encounterZone.encounter(undefined);
		encounterZone.tile(undefined);
		encounterZone.message("");
		encounterZone.question("");
		encounterZone.options([]);
		encounterZone.mood("");
		encounterZone.showImage(false);
		encounterZone.image(false);
		results.groupNavigation.currentGroup(undefined);
	}
	encounterZone.setEncounter = function(feature, tile) {
		encounterZone.encounter(feature);
		encounterZone.tile(tile);
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
			]);
			if(feature.svg()) {
				encounterZone.image(feature.svg());
				encounterZone.showImage(true);
			}
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
		console.log("stealth contest results: atk, def", attackerContestResult, defenderContestResult)
		//TODO: figure the +3 into the system somehow
		var distances = {
			attacker : Math.round(Math.pow(2, attackerContestResult/5 + 3)),
			defender : Math.round(Math.pow(2, defenderContestResult/5 + 3)),
			maximum : Math.round(tile.sightlines()*randomGausian(1,.25)),
		}
		distances.distance = attackerPrefersClose^attackerContestResult>defenderContestResult?
			distances.defender: distances.attacker
		distances.attackersStart = distances.attacker > distances.defender;
		return distances;
	}
	encounterZone.setTeamEncounter = function (feature, tile){
			var defendingTeam = feature;
			var attackingTeam = results.teamNavigation.currentTeam();
			
			results.groupNavigation.currentGroup(feature);
			results.groupNavigation.updateGroupDisplay();
			
			encounterZone.showImage(true);
			encounterZone.image(feature.svg());
			encounterZone.encounter(feature);
			encounterZone.tile(tile);
			
			var distances = encounterZone.stealthDistances(attackingTeam, defendingTeam, tile)
			//TODO: watching to make sure distances are working correctly
			console.log("distances: max, attk, def", distances.maximum, distances.attacker, distances.defender);
			
			if((distances.maximum < distances.attacker && distances.maximum < distances.defender) || distances.attacker == distances.defender) {
				encounterZone.setAccidentalEncounter(distances.maximum)
			}
			
			if(!distances.attackersStart) {
				//TODO: this presumes that the defenders want to get as close as possible, and want to attack
				encounterZone.setDefenderAmbush(distances.attacker, false)
			}
			else {
				encounterZone.setAttackerAmbush(Math.min(distances.attacker, distances.maximum), Math.min(distances.defender,distances.maximum));
			}
	}
	encounterZone.setAttackerAmbush = function (attackerDistance, defenderDistance) {
		encounterZone.message("you have encountered a team of "+ encounterZone.encounter().name() +"from "+attackerDistance+" away!");
		encounterZone.question("would you like to...");
		encounterZone.options([
			{
				text:"leave without making yourself known?",
				click: () => {
					encounterZone.tile().exploredFeatures.push(encounterZone.encounter());
					encounterZone.endEncounter();
					results.mapNavigation.updateTileDisplay();
				}
			},
			{
				text: "Open fire at maximum range?(" + attackerDistance+ ")",
				click: () => {encounterZone.toBattle(attackerDistance, true);}
			},
			{
				text: "Sneak as close as possible before attacking? (" + defenderDistance+ ")",
				click: () => {encounterZone.toBattle(defenderDistance, true);}
			},
			{
				text:"Negotiate?",
				click: () => {
					//TODO: should not add feature to map just quite yet
					encounterZone.setDiplomacy();
				}
			},
			{
				text: "Walk Away and End Encounter?",
				click: () => {
					encounterZone.walkAway();
				}
			}
		]);
		encounterZone.mood("mysterious");
	}
	encounterZone.setDefenderAmbush = function (distance) {
		encounterZone.message("you have been ambushed by "+ encounterZone.encounter().name() +" at "+ distance+ "!")
		encounterZone.question("Defend Yourselves!")
		encounterZone.options([
			{
				text: "Ok",
				click: () => {encounterZone.toBattle(distance, false);}
			}
		])
	};
	encounterZone.attackedOnLeaving = function () {
		//TODO: make distance dynamic... maybe even passed in
		var distance = 5;
		encounterZone.message("As you turn to leave, the "+ encounterZone.encounter().name() +" attacks from "+ distance+ "!")
		encounterZone.question("Defend Yourselves!")
		encounterZone.options([
			{
				text: "Ok",
				click: () => {encounterZone.toBattle(distance, false);}
			}
		]);
	};
	encounterZone.peacefulParting = function () {
		encounterZone.message("You Part Peacefully");
		encounterZone.question("Perhaps you will meet again")
		encounterZone.options([
			{
				text: "Ok",
				click: () => {
					encounterZone.tile().exploredFeatures.push(encounterZone.encounter());
					results.mapNavigation.updateTileDisplay();
					encounterZone.endEncounter();
				}
			}
		]);

	}
	encounterZone.setDiplomacy = function () {
		encounterZone.message("you wish to negotiate with "+ encounterZone.encounter().name())
		encounterZone.question("would you like to...")
		encounterZone.options([
			{
				text:"offer a gift of food?",
				click: () => {
					console.log("you have offered food!");
					var reaction = results.diplomacy.getReaction(encounterZone.encounter(), results.teamNavigation.currentTeam());
					console.log("reaction: ", reaction);
					if(reaction == "Hostile") {
						encounterZone.failedNegotiation(encounterZone.encounter().name() +" rejects the food!");
					} else if (reaction == "Hungery") {
						encounterZone.acceptedFood()
					} else if(reaction == "Wary") {
						//TODO: stick modifiers on this so people can be better at it or harder to make friendly/ more suspicious
						negotiation = randomGausian(0,10);
						if(negotiation > 0) {
							encounterZone.acceptedFood();
						}
						else {
						encounterZone.failedNegotiation(encounterZone.encounter().name() +" rejects the food!");
						}
					} else if(reaction == "Allied") {
						encounterZone.acceptedFood();
					} else if(reaction == "Mercantile"){
						encounterZone.acceptedFood();
					} else {
						console.log("the reaction was ", reaction, ", which we don't know how to handle");
						encounterZone.endEncounter();
					}
				}
			},
			{
				text:"brandish weapons?",
				click: () => {
					//TODO: how do factions size up your threat?
					var scariness = randomGausian(0,10);
					
					console.log("you are brandishing weapons!");
					console.log("your scariness is: ", scariness);
					if(scariness > 0 ) {
						encounterZone.scaredAway();
					} else {
						encounterZone.failedNegotiation(encounterZone.encounter().name() + " is not frightened by your display!")
					}
				}
			},
			{
				text: "attack?",
				//TODO: get distance right
				click: () => {encounterZone.toBattle( 0, true);}
			},
			{
				text: "walk away",
				click: () => {encounterZone.walkAway();}
			}
		]);
	};
	encounterZone.walkAway = function () {
		if(encounterZone.mood() == "mysterious") {
			var reaction = results.diplomacy.getReaction(encounterZone.encounter(), results.teamNavigation.currentTeam());
			if(["Hungery", "Hostile"].includes(reaction)) encounterZone.attackedOnLeaving();
			else if (reaction == "Wary" ) {
				if(randomGausian(0,10) <0){
					encounterZone.attackedOnLeaving();
				} else {
					encounterZone.peacefulParting();
				}
			} else {
				encounterZone.peacefulParting();
			}
		} else if (encounterZone.mood() == "hostile") {
			encounterZone.attackedOnLeaving();
		} else {
			encounterZone.peacefulParting();
		}
	};
	encounterZone.failedNegotiation = function ( message) {
		encounterZone.message(message);
		encounterZone.question(encounterZone.encounter().name() + "attacks!")
		encounterZone.options([
			{
				text: "Ok",
				//TODO: get distance
				click: () => {encounterZone.toBattle( 4, false);}
			}
		]);
	}
	encounterZone.acceptedFood = function () {
		if(["mysterious", "hostile", "tense"].includes(encounterZone.mood())){
			encounterZone.mood("mercantile")
		}
		encounterZone.message(encounterZone.encounter().name() + " takes your offer of food")
		encounterZone.question(encounterZone.encounter().name() + " seems to appreciate the gift!")
		encounterZone.options([
			{
				text: "Ok",
				click: () => {encounterZone.setDiplomacy();}
			}
		]);
	};
	encounterZone.scaredAway = function() {
		encounterZone.message(encounterZone.encounter().name() + " attempts to run away!");
		encounterZone.question(encounterZone.encounter().name() + " Do you wish to...");
		encounterZone.options([
			{
				text: "Let them go",
				click: () => {
					//TODO: how to list them? they can't be found again automatically...
					encounterZone.endEncounter();
				}
			},
			{
				text: "Chase them down",
				click: () => {
					//TODO: distance
					encounterZone.toBattle(20, true);
				}
			}
		]);
	};
	encounterZone.setAccidentalEncounter = function (distance) {
		encounterZone.message("you have bumped into a team of "+ encounterZone.encounter().name() +"!")
		encounterZone.question("would you like to...")
		encounterZone.options([
			{
				//TODO: determined by speed
				text:"Flee?",
				click: () => {
					//TODO: failure chance, report that you have escaped
					//TODO: maybe not add it to list of explored places!
					encounterZone.tile().exploredFeatures.push(encounterZone.encounter());
					encounterZone.endEncounter();
					results.mapNavigation.updateTileDisplay();
				}
			},
			{
				text:"Negotiate?",
				click: () => {
					encounterZone.setDiplomacy();
				}
			},
			{
				text: "Attack?",
				//TODO: who goes first less random
				click: () => {encounterZone.toBattle(distance, randomGausian(0,10)>0);}
			}
		]);
	}
	encounterZone.toBattle = function ( distance, attackersStart) {
		results.battleground.setUpPlayerBattle(results.teamNavigation.currentTeam(), encounterZone.encounter(), encounterZone.tile(), distance, attackersStart); //TODO: range controls
		encounterZone.endEncounter();
	}
	return encounterZone;
}