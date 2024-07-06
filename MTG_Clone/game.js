var Game = function (){
	var game = {};
	//TODO: do players store the gamestate or just the AI?
	game.setUpGame = function (players, intelligences, seed) {
		game.players = players;
		game.intelligences = intelligences;
		game.currentPlayerIndex = 0;
		game.turn = 0;
		game.random = new MersenneTwister(seed);
		
		for(player of game.players) {
			player.life = 20;
			
			player.library = shuffleArray(player.deck, game.random);
			player.hand = [];
			player.battlefield = [];
			player.graveyard = [];

			for(var i = 0;i< 7; i++) 
				game.drawCard(player);
		}
	}
	
	game.startGame = function () {
		game.currentPlayerIndex = -1;
		game.startTurn();
	}
	var counter = 0;
	game.startTurn = function () {
		game.currentPlayerIndex = (game.currentPlayerIndex +1) % game.players.length;
		if(game.currentPlayerIndex == 0) game.turn++;
		console.log("turn", game.turn);
		var player = game.players[game.currentPlayerIndex];
		if(game.turn!=1 || game.currentPlayerIndex!=0) 
			game.drawCard(player);
		game.untap(player);
		game.intelligences[game.currentPlayerIndex].calculateSpellsToPlay(game,player, game.onSpellsPlayed);
	}
	game.onSpellsPlayed = function (spellsPlayed) {
		console.log(spellsPlayed.land? spellsPlayed.land.cardName.color +" land": "no land", spellsPlayed.plays.map(card => card.cardName.name).join(", "));
		//TODO: tap lands 
		//TODO: check if correct!
		var player = game.players[game.currentPlayerIndex];
		for(var card of spellsPlayed.plays)
			game.playCard(card, player);
		game.playCard(spellsPlayed.land, player);
		
		if(counter++ < 20){
			game.intelligences[game.currentPlayerIndex].calculateAttacks(game, player, game.onAttacksDeclared)
		}
		else{
			game.reportGame();
		}
	}
	game.onAttacksDeclared = function(attacks) {
		//TODO: verify attackers are legal!
		//TODO: multiple attack targets!
		if(attacks.length) {
			console.log("attacks",attacks.map(attacker => attacker.cardName.name));
			var player = game.players[(game.currentPlayerIndex+1)%2];
			attacks.forEach(attacker => {attacker.instance.tapped = !attacker.cardName.abilities.includes("vigilance")});
			game.intelligences[(game.currentPlayerIndex+1)%2].calculateBlocks(game, player, attacks, game.onBlockersDeclared);
		}
		else game.endTurn();
	}
	game.onBlockersDeclared = function (blocks) {
		console.log("blocks declared", blocks);
		var player = game.players[game.currentPlayerIndex];
		game.intelligences[game.currentPlayerIndex].calculateAssignDamage(game, player,blocks, game.onDamageAssigned)
	}
	game.onDamageAssigned = function (battles){
		console.log("blocks", battles.map(block => block.attacker.cardName.name + " blocked by ["+ block.blockers.map(card => card.cardName.name).join(", ")+"]"));
		var attackingPlayer = game.players[game.currentPlayerIndex];
		var defendingPlayer = game.players[(game.currentPlayerIndex+1)%2];
		for(var battle of battles){
			var attackerDamage = battle.attacker.cardName.abilities.includes("first strike")?battle.attacker.cardName.power: 0;
			var defenderDamage = battle.blockers.reduce((total, blocker) => blocker.cardName.abilities.includes("first strike")?blocker.cardName.power + total: total, 0);
			
			for(var blocker of battle.blockers) {
				if (attackerDamage > 0){
					attackerDamage = game.damageCreature(blocker, attackerDamage);
				}
			}
			if(attackerDamage > 0 && (battle.blockers.length == 0 || battle.attacker.cardName.abilities.includes("trample"))) 
				game.damagePlayer(defendingPlayer,attackerDamage);
			game.damageCreature(battle.attacker, defenderDamage);
			game.killDeadCreatures();
			
			attackerDamage = !battle.attacker.cardName.abilities.includes("first strike") && !battle.attacker.instance.dead?battle.attacker.cardName.power: 0;
			defenderDamage = battle.blockers.reduce((total,blocker) => !blocker.cardName.abilities.includes("first strike") && !blocker.instance.dead?blocker.cardName.power +total: total, 0);
			
			for(var blocker of battle.blockers) {
				if (attackerDamage > 0){
					attackerDamage = game.damageCreature(blocker, attackerDamage);
				}
			}
			if(attackerDamage > 0 && (battle.blockers.length == 0 || battle.attacker.cardName.abilities.includes("trample"))) 
				game.damagePlayer(defendingPlayer,attackerDamage);
			game.damageCreature(battle.attacker, defenderDamage);
			game.killDeadCreatures();
		}
		game.endTurn();
	}
	game.endTurn = function () {
		var over = game.players.filter(player => player.life <=0).length !=0;
		if(!over)game.startTurn();
		else game.reportGame();
	}
	game.reportGame = function () {
		console.log(game);
		console.log(game.players);
		console.log("life",game.players.map(p=>p.life));
		console.log("creatures",game.players.map(p => p.getCreatures().map(c => c.cardName.name)));
		console.log("lands",game.players.map(p => p.getLands().map(c => c.cardName.name)));
		console.log("hands ",game.players.map(p => p.hand.map(c => c.cardName.name)));
		console.log("graveyards ",game.players.map(p => p.graveyard.map(c => c.cardName.name)));

	}
	game.playCard = function (card,player) {
		if(card){
			if(card.cardName.type == "creature"){
				card = CreatureInstance(card);
			} else if (card.cardName.type == "land")
				card = LandInstance(card);
			player.battlefield.push(card);
			player.hand = player.hand.filter(c => c != card);
		}
	}
	game.drawCard = function (player){
		player.hand.push(player.library.pop());
	}
	game.untap = function (player) {
		player.battlefield.forEach(card => {
			card.instance.tapped = false;
			card.instance.sick = false;
		});
	}
	game.canBlock = function (blocker, attacker) {
		if (blocker.instance.tapped) return false;
		if (attacker.cardName.abilities.includes("flying") && !blocker.cardName.abilities.includes("flying") && !blocker.cardName.abilities.includes("reach")) return false;
		return true;
	}
	game.getCard = function (id) {
		return game.players.map(player => player.deck).reduce((a,b)=>a.concat(b),[]).find(card => card.guid == id);
	}
	game.damageCreature = function (creature, damage, tags) {
		//TODO: apply tags like deathtouch, lifelink, and protection
		var damageToZero = creature.cardName.toughness - creature.instance.damage;
		creature.instance.damage += damage < damageToZero? damage: damageToZero;
		return damage - damageToZero;
	}
	game.damagePlayer = function (player, damage, tags) {
		console.log(player.name, "took", damage, "damage");
		player.life -= damage;
	}
	game.killDeadCreatures = function (){
		for(var player of game.players) {
			var toRemove = [];
			for(var card of player.battlefield){
				if(
					card.cardName.type == "creature" && 
					card.instance.damage >= card.cardName.toughness && 
					!card.cardName.abilities.includes("indestructible")
				){
					toRemove.push(card);
					card.instance.dead = true;
				}
			}
			player.battlefield = player.battlefield.filter(card => !toRemove.find(removed => removed.guid == card.guid));
			player.graveyard = player.graveyard.concat(toRemove);
			if(toRemove.length)
				console.log(toRemove.map(card => card.cardName.name),"died");
		}
	}
	return game;
}
/*
	event driven game loop
	*setup game
	*turn start/end
	*cast spells
	declare attackers
	declare blockers
	assign damage
	
*/

/*
	Player interface:

	play spells
	pick targets (many contexts!)
	declare attackers
	declare blockers
	assign damage
*/