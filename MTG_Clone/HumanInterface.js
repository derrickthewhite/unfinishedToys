var HumanInterface = function (){
	var hi = {}
	hi.errorCallback = () => { console.log("no callback appropriate!")};
	hi.nextCallback = hi.errorCallback;
	hi.state = ko.observable("none"); // playingSpells, attacking, defending, assigningDamage
	hi.selected = ko.observableArray([]);
	hi.model = {};
	
	hi.currentPlayer;
	
	hi.initializeView = function () {
		hi.model.hand = ko.observableArray([]);
		hi.model.creatures = ko.observableArray([]);
		hi.model.lands = ko.observableArray([]);
		hi.model.toSelect = ko.observableArray([]);
		hi.model.battles = ko.observableArray([]);
		
		hi.model.playerLife = ko.observable(0);
		hi.model.opponentLife = ko.observable(0);
		
		hi.model.opponentCreatures = ko.observableArray([]);
		hi.model.opponentLands = ko.observableArray([]);
		hi.model.opponentHand = ko.observableArray([]);
		
		hi.model.state = ko.pureComputed(()=> {
			return hi.state();
		})
		
		ko.applyBindings(hi.model,document.getElementById("humanInterface"))
	}
	
	hi.calculateSpellsToPlay = function (game, player, callback) {
		console.log("calculating spells by human");
		hi.currentPlayer = player;
		hi.state("playingSpells");
		hi.nextCallback = callback;
		hi.updateDisplay(game, player);
	}
	hi.calculateAttacks = function (game, player, callback) {
		console.log("calculating attacks by human");
		hi.currentPlayer = player;
		hi.state("attacking");
		hi.nextCallback = callback;
		hi.updateDisplay(game, player);
		hi.model.toSelect(player.getValidAttackers().map(ViewCard));
		if(player.getValidAttackers().length == 0) callback([]);
	}
	hi.calculateBlocks = function (game, player, callback) {
		console.log("calculating blocks by human");
	}
	hi.calculateAssignDamage = function (game, player, blocks, callback) {
		console.log("calculating damage by human");
		hi.currentPlayer = player;
		hi.state("assigningDamage");
		hi.nextCallback = callback;
		hi.updateDisplay(game, player);
		hi.model.battles(blocks.map(block => ({ 
			attacker: ViewCard(block.attacker),
			blockers: () => {return block.blockers.map(ViewCard)}
		})));
	}
	hi.model.onSubmit = function (){
		if(hi.state() == "playingSpells" ) {
			var plays = hi.playSpellsState();
			hi.nextCallback({
				land: plays.lands[0]? plays.lands[0].original: undefined, 
				plays: plays.spells.map(c=>c.original)
			});
		}
		else if(hi.state() == "attacking") {
			var attackers = hi.model.creatures().filter(card => card.display.selected());
			hi.nextCallback(attackers.map(card => card.original));
		}
		else if (hi.state() == "assigningDamage"){
			hi.nextCallback(hi.model.battles().map(block =>  ({
				attacker: block.attacker.original,
				blockers: block.blockers().map(c => c.original)
			})));
		}
		hi.selected([]); // todo: get timing on this right
	}
	hi.model.onClick = function (list, card) {
		if((hi.state() =="playingSpells" && list == "hand")){
			hi.selectCard(card);
		}
		if((hi.state() =="attacking" &&  list == "toSelect")){
			if(card.instance.tapped === false && card.instance.sick === false) {
				hi.selectCard(card);
			}
		}
	}
	hi.model.isSubmitValid = ko.pureComputed(() => {
		if(hi.state() == "playingSpells")return hi.isValidSpellPlay();
		if(hi.state() == "attacking") return true;
		if(hi.state() == "assigningDamage") return true;
		return false;
	});
	hi.selectCard = function (card) {
		card.display.selected(!card.display.selected());
		if (card.display.selected()){
			hi.selected.push(card);
		}
		else hi.selected.remove(card);
	}
	hi.updateDisplay = function (game, player) {
		hi.model.hand(player.hand.map(ViewCard));
		hi.model.creatures(player.getCreatures().map(ViewCard));
		hi.model.lands(player.getLands().map(ViewCard));
		
		hi.model.playerLife(player.life);
		hi.model.opponentLife(game.players.filter(p=>p!=player)[0].life);
		
		hi.model.hand().concat(hi.model.creatures()).concat(hi.model.lands()).forEach(card => {
			card.display = {};
			card.display.selected = ko.observable(false);
		})
		
		var opponent = game.players.find(p => p != player);
		hi.model.opponentCreatures(opponent.getCreatures().map(ViewCard));
		hi.model.opponentLands(opponent.getLands().map(ViewCard));
		hi.model.opponentHand(opponent.hand.map(ViewCard))
		
		hi.model.toSelect([]);
		hi.model.battles([]);
	}
	hi.isValidSpellPlay = ko.pureComputed(function () {
		var playState = hi.playSpellsState();
		if(playState.lands.length > 1) return false;
		return AI_Helper.canCastSpells(playState.spells, playState.mana, false);
	});
	hi.playSpellsState = ko.pureComputed(function (){
		var toPlay = hi.model.hand().filter(card => card.display && card.display.selected());
		var toPlay = hi.selected();
		var spells = toPlay.filter(card => card.cardName.type != "land");
		var lands = toPlay.filter(card => card.cardName.type == "land");

		var mana = hi.currentPlayer.mana(false);
		if(lands[0]){
			mana.total ++;
			mana[lands[0].cardName.color] = (mana[lands[0].cardName.color] || 0)+1;
		}
		return {spells:spells, lands:lands, mana:mana};
	});
	return hi;
}
ko.components.register("cardlist", {
	viewModel: function (params) {
		params.cards().forEach(card => {
			if(!card.display){
				card.display = {};
				card.display.selected = ko.observable(false);
			}
		});
		this.cards = params.cards;
		this.name = params.name;
		this.borderColor = params.color;
		this.click = function (card) {
			params.click(params.name, card)
		};
	},
	template: `<div data-bind="foreach:cards, style:{'border-color':borderColor}" class = "cardList">
				<card params="card:$data, list:name, click:$parent.click"></card>
			</div>`
});
ko.components.register("card", {
	viewModel: function (params) {
		this.name = params.card.cardName.name;
		this.color = params.card.cardName.color;
		this.list = params.list;
		this.selected = params.card.display.selected;
		this.click = function (){
			//console.log("base click")
			params.click(params.card);
		};
	},
	template: `
		<div data-bind="css:{selected:selected(), card:true}, click:click">
			<span data-bind="text:name"></span>
		</div>
`
});
ko.components.register("blocklist", {
	viewModel: function (params) {
		this.blockers = params.blockers;
		this.attacker = params.attacker;
		this.onClick = params.onClick;
	},
	template: 
	`
		<div>
			<card params ="card:attacker, list: 'blockList', click:onClick"></card>
			<cardlist params="cards: blockers, name: 'blockList', color:'purple', click: onClick"></cardlist>
		</div>
	`
})