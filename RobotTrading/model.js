function Model(){
	var model = {};
	
	model.mode = ko.observable("setup"); // mainView, invention, setup
	
	model.players = ko.observableArray([]);
	model.turn = ko.observable(-1);
	model.currentPlayer = ko.observable(0);
	
	//Invention phase
	model.cardsSelected=ko.observableArray();
	model.cardActivePlayerIndex = ko.observable(0); 
	model.cardActivePlayer = ko.pureComputed(()=>model.players()[model.cardActivePlayerIndex()]);
	
	model.addPlayer = function (name,view){
		//TODO: make players track views and enfource orders coming from views
		//TODO: enforce unique names
		model.players.push(new player(name));
	};
	
	model.startGame = function ()
	{
		var steel = new ConstructionType("Steel",[],"starting");
		var costsSteel = effects.fuel1C;
		costsSteel.target = "Steel";
		var robot = new ConstructionType("Robot",[effects.worthless,effects.manipulator,effects.automatic,costsSteel,effects.limit1],"starting");
		model.mode("invention");
		for(var player of model.players())
		{
			player.addCards(cards.draw(3));
			player.addConstruction(robot,2);
			player.addConstruction(steel,0);
		}
	};
	
	model.runBuildPhase = function(orders){
		var currentPlayer = model.players()[model.currentPlayer()];
		var nextPlayer = (model.currentPlayer()+1)%model.players().length;
		
		//TODO: verifify orders are valid!
		
		//TODO -- synthetics might be a problem
		//TODO: implement burning properly
		for(var construction of currentPlayer.constructions())
		{
			construction.number(construction.number()+orders[construction.name].totalChange);
			if(orders[construction.name].totalChange)console.log(construction.name,"changed by",orders[construction.name].totalChange);
		}
		
		model.currentPlayer(nextPlayer);
		currentPlayer.addCards(cards.draw(currentPlayer.cards().length?2:3));
		model.startInventing();
	}
	
	model.addCard = function (card,fuel){
		//TODO: check that current active player has card!
		//TODO: return card to deck (discard?) (we may need to be removing them first!)
		if(card){
			model.cardActivePlayer().cards.remove(card);
			card = JSON.parse(JSON.stringify(card));
			for(var effect of card.effect)
				if(effect.target == '<Fuel>')
				{
					console.log("replaceing <Fuel> with "+fuel);
					effect.target = fuel;
					card.name = card.name.replace('<Fuel>',effect.target);
				}
			model.cardsSelected.push(card);
		}
		model.cardActivePlayerIndex((model.cardActivePlayerIndex()+1)%model.players().length);
	}
	model.startInventing = function (){
		model.cardActivePlayerIndex(model.currentPlayer());
		model.cardsSelected([]);
		model.mode("invention");
	}
	model.doneInventing = function(){
		model.mode('mainView');
	}
	model.finalizeInvention = function(name){
		var player = model.players()[model.currentPlayer()];
		var effects = model.cardsSelected().map((card)=> card.effect);
		effects = effects.length?effects.reduce((a,b)=> a.concat(b)):[];
		var type = new ConstructionType(name,effects,player);
		player.addConstruction(type,0);
		model.doneInventing();
	}
	return model;
}