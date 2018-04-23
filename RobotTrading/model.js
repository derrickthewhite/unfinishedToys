function Model(){
	var model = {};
	
	model.mode = ko.observable("setup"); // mainView, invention, trading, setup
	
	model.players = ko.observableArray([]);
	model.turn = ko.observable(-1);
	model.currentPlayer = ko.observable(0);
	
	//Invention phase
	model.cardsSelected=ko.observableArray();
	model.cardActivePlayerIndex = ko.observable(0); 
	model.cardActivePlayer = ko.pureComputed(()=>model.players()[model.cardActivePlayerIndex()]);
	
	//TODO: move observables away from model
	model.goodCards =ko.observableArray([]);
	model.badCards =ko.observableArray([]);
	
	model.addPlayer = function (name,view){
		//TODO: make players track views and enfource orders coming from views
		//TODO: enforce unique names
		if(name == "")name = config.names[model.players().length];
		if(model.players().map(player => player.name).indexOf(name)!=-1)
			return "Bad player Name!";
		else model.players.push(new player(name));
	};
	
	model.startGame = function ()
	{
		var steel = new ConstructionType("Steel",[],"starting");
		var costsSteel = effects.fuel2C;
		costsSteel.target = "Steel";
		var robot = new ConstructionType("Robots",[effects.worthless,effects.manipulator,effects.automatic,costsSteel,effects.limit1],"starting");
		model.mode("mainView");
		for(var player of model.players())
		{
			player.addConstruction(robot,3);
			player.addConstruction(steel,0);
		}
		model.goodCards (cards.positivePool);
		model.badCards (cards.negativePool);
		model.turn(0);
	};
	
	
	model.runBuildPhase = function(orders,attacks,research){
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
		
		for(var attack of attacks){
			var targetPlayer = model.players().filter(p=>p.id == attack.defender().id)[0];
			var expendedAttacks = 0;
			var currentTargetAttackCount = 0;
			var currentTargetIndex = 0;
			var currentTarget = attack.targets()[currentTargetIndex];
			while(
				attack.targets().length>currentTargetIndex 
				&& expendedAttacks<attack.forces()
			){
				//TODO: make the roll under number configurable
				var targetObject = targetPlayer.constructions().filter(c=>c.type.id == currentTarget.targetType().type.id)[0];
				var hit = Math.random()*config.rollUnder < targetObject.number();
				if(hit || currentTarget.attackType == "attacks")currentTargetAttackCount++;
				if(hit)targetObject.number(targetObject.number()-1);
				expendedAttacks++;
				//TODO: report succesful attacks?
				if(currentTargetAttackCount == currentTarget.count() || targetObject.number()==0){
					currentTargetIndex++;
					currentTarget = attack.targets()[currentTargetIndex];
				}
			}
		}
		
		research.forEach(c=>currentPlayer.cards.push(c));
		if(nextPlayer <= model.currentPlayer())model.turn(model.turn()+1);
		model.currentPlayer(nextPlayer);
		//currentPlayer.addCards(cards.draw(currentPlayer.cards().length?2:3));
		//model.startInventing();
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