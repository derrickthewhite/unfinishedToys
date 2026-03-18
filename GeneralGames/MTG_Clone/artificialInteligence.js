{
	var AI_Helper = {};
	AI_Helper.powerSet = (options) => {
		var result = [[]];
		for(var option of options){
			result = result.map(set => [set, set.concat(option)])
				.reduce((a,b)=>a.concat(b),[])
		}
		return result;
	}
	AI_Helper.possibilitiesToPermutations = (possibilityArray) => {
		var result = [[]];
		for(var choice of possibilityArray){
			var newResult = [];
			for(var possibility of choice.possibilities){
				for(var previousChoice of result){
					var pcCopy = [];
					Object.keys(previousChoice).forEach(key => pcCopy[key] = previousChoice[key]);
					pcCopy[possibility] = pcCopy[possibility]?pcCopy[possibility].concat(choice.item):[choice.item];
					newResult.push(pcCopy);
				}
			}
			result = newResult;
		}
		return result;
	}
	AI_Helper.canCastSpells = (plays, mana, spareLand) => {
		return AI_Helper.landRequirements(plays, mana, spareLand) != -1;
	}
	AI_Helper.landRequirements = (plays, mana, spareLand) => {
		var manaRequired = plays.reduce((sofar,card) => sofar+card.cardName.cost,0);
		var colors = {};
		plays.map(card => card.cardName.color).forEach((color) => { colors[color] = (colors[color] || 0)+1; });
		var handLandPlayed = spareLand? undefined: true;
		for(color of Object.keys(colors)){
			if(!mana[color] || colors[color] > mana[color]){
				if(handLandPlayed == undefined && colors[color] <= mana[color] + 1)
					handLandPlayed = color;
				else return -1;
			}
		}
		if(mana.total >= manaRequired){
			return handLandPlayed? handLandPlayed : 0;
		}
		else if(spareLand && mana.total + 1 >= manaRequired)
			return handLandPlayed? handLandPlayed : 1;
		else return -1;
	}
	AI_Helper.allPossibleSpells =  (spells, mana, handLands) => {
		return allSpellCombinations = AI_Helper.powerSet(spells)
			.filter(combination => AI_Helper.canCastSpells(combination, mana, true));
	}
	AI_Helper.allOrders = function (arr, perms = [], len = arr.length) {
		if(len == 0 )return [[]];
		if (len === 1) perms.push(arr.slice(0))
		for (let i = 0; i < len; i++) {
			AI_Helper.allOrders(arr, perms, len - 1)
			len % 2 // parity dependent adjacent elements swap
				? [arr[0], arr[len - 1]] = [arr[len - 1], arr[0]]
				: [arr[i], arr[len - 1]] = [arr[len - 1], arr[i]]
		}
		return perms
	}
}
var Intelligence = function (random) {
	var intelligence = {};
	
	intelligence.calculateSpellsToPlay = function (game, player, callback) {
		var mana = player.mana(true);
		var possiblePlays = AI_Helper.allPossibleSpells(player.spells(), mana);
		var toPlay = selectItem(possiblePlays, random);
		var landRequirements = AI_Helper.landRequirements(toPlay, mana);
		var landToPlay = selectItem(player.handLands(), random);
		if(landRequirements != 1 && landRequirements != 0){
			landToPlay = selectItem(player.handLands().filter(land => land.color == landRequirements), random);
		}
		callback({
			land: landToPlay,
			plays: toPlay
		});
	}
	
	intelligence.calculateAttacks = function (game, player, callback) {
		var creaturesToAttack = player.getValidAttackers();
		var attackPossibilities = AI_Helper.powerSet(creaturesToAttack);
		var attacks = selectItem(attackPossibilities, random);
		callback(attacks);
	}
	intelligence.calculateBlocks = function (game, player, attacks, callback) {
		var blockers = player.getValidBlockers();
		// how to get all blocker possibilities?
		var blockPossibilities = blockers.map(blocker => ({
			item: blocker.guid,
			possibilities: attacks.filter(attacker => game.canBlock(blocker,attacker))
				.map(attacker => attacker.guid)
		}));
		var blockPermutations = AI_Helper.possibilitiesToPermutations(blockPossibilities);
		var selectedBlock = selectItem(blockPermutations, random);
		var blocks =  attacks.map(attack => ({
			attacker: attack,
			blockers: []
		}));
		if(selectedBlock){
			for(key of Object.keys(selectedBlock)){
				var block = blocks.find(block => block.attacker.guid == key)
				block.blockers = selectedBlock[key].map(guid=>game.getCard(guid));
				block.blockers = block.blockers?block.blockers:[];
			}
		}
		callback(blocks);
	}
	intelligence.calculateAssignDamage = function (game, player, blocks, callback) {
		callback(blocks.map(battle => {
			var possibleBlocks = AI_Helper.allOrders(battle.blockers);
			return {attacker: battle.attacker, blockers: selectItem(possibleBlocks, random)};
		}));
	}
	
	return intelligence;
}