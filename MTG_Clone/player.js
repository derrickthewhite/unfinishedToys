var playerNames = [
	"adam",
	"bethany",
	"chelsea",
	"derrick",
	"eric",
	"feston"
];
var Player = function (deck) {
	var player = {};
	
	player.life = 20;
	
	player.name = "player "+playerNames.shift();
	player.deck = deck;
	player.library = []
	player.hand = [];
	player.battlefield = [];
	player.graveyard = [];
	
	player.spells = function () {
		return player.hand.filter(card => card.cardName.type != "land");
	}
	player.mana = function (canPlayLand) {
		var mana = {};
		var lands =  player.battlefield.filter(card=> card.cardName.type == "land" );
		mana.total = lands.length;
		lands.map(card => card.cardName.color).forEach((color) => { mana[color] = (mana[color] || 0)+1;});
		
		if(canPlayLand){
			mana.playLand= {};
			mana.playLand.total = player.handLands().length? 1: 0;
			for(var color of player.handLands()){
				mana.playLand.color = 1;
			}
		}
		return mana;
	}
	player.handLands = function () {
		return player.hand.filter(card => card.cardName.type == "land");
	}
	player.getCreatures = function () {
		return player.battlefield.filter(card=> card.cardName.type == "creature" );
	}
	player.getLands = function () {
		return player.battlefield.filter(card=> card.cardName.type == "land" );
	}
	player.getValidAttackers = function () {
		return player.getCreatures().
			filter(creature => creature.instance.tapped == false && creature.instance.sick == false && !creature.cardName.abilities.some(ability => ability == "defender"))
	}
	player.getValidBlockers = function () {
		return player.getCreatures().
		filter(creature => creature.instance.tapped == false);
	}
	return player;
}