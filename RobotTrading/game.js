function Game(){
	var game = {};
	game.statics ={};
	game.statics.manipUses = ['builders','operators','miners'];
	
	
	game.mode = ko.observable("setup"); // mainView, invention, setup
	game.players = ko.observableArray();
	game.currentPlayer = ko.observable(0);
	
	//setup
	game.newPlayerName = ko.observable("");
	game.addPlayer = function (){
		game.players.push(new player(game.newPlayerName()));
	};
	game.startGame = function ()
	{
		var steel = new ConstructionType("Steel",[],"starting");
		var costsSteel = effects.fuel2C;
		costsSteel.target = "Steel";
		var robot = new ConstructionType("Robot",[effects.worthless,effects.manipulator,effects.automatic,costsSteel,effects.limit1],"starting");
		game.mode("invention");
		for(var player of game.players())
		{
			player.addCards(cards.draw(3));
			player.addConstruction(robot,2);
			player.addConstruction(steel,0);
		}
	};

	//building
	//TODO: get these auto creates correct!
	for(var use of game.statics.manipUses)
	{
		game[use] = ko.observable(0);
	}
	game.manipulatorsLeft = ko.pureComputed(function (){
		var player = game.players()[game.currentPlayer()];
		var flow = player.totalFlow();
		flow = JSON.parse(JSON.stringify(flow));
		var manipulators = flow.totals.manipulator;
		for(var use of game.statics.manipUses)
		{
			manipulators -= Number(game[use]());
		}
		return manipulators;
	});
	game.nextTurn = function (){
		if(game.hasValidInstructions())
		{
			var lastPlayer = game.players()[game.currentPlayer()];
			var nextPlayer = (game.currentPlayer()+1)%game.players().length;
			
			var flow = lastPlayer.totalFlow();
			flow = JSON.parse(JSON.stringify(flow))
			//TODO -- synthetics might be a problem
			//TODO: implement burning properly
			for(var construction of lastPlayer.constructions())
			{
				construction.number(construction.number()+construction.expectedChange());
				if(construction.expectedChange())console.log(construction.name,"changed by",construction.expectedChange());
			}
			
			game.currentPlayer(nextPlayer);
			lastPlayer.addCards(cards.draw(lastPlayer.cards().length?2:3));
			game.mode("invention");
			game.cardsSelected([]);
		}
	}
	game.currentFlow = ko.pureComputed(function () {
		player = game.players()[game.currentPlayer()];
		if(!player) return {};
		var flow = player.totalFlow();
		flow = JSON.parse(JSON.stringify(flow))
		flow.inputs.manipulator = 0;
		for(var i of game.statics.manipUses)
		{
			var value = Number(game[i]());
			flow.inputs.manipulator += value;
			flow.outputs[i] = flow.outputs[i]?value+flow.outputs[i]:value;
			flow.totals[i] = flow.totals[i]?value+flow.totals[i]:value;
		}
		flow.totals.manipulator=game.manipulatorsLeft();
		return flow;
	});
	game.errors = ko.pureComputed( function() {
		var result = [];
		if(game.mode()=="mainView")
		{
			flow = game.currentFlow();
			for(var i in flow.inputs)
			{
				if(!flow.outputs[i] && flow.inputs[i])
				{
					result.push("Requires "+flow.inputs[i]+" "+i);
				}
				else if(flow.outputs[i]<flow.inputs[i])
					result.push("Requires "+(flow.inputs[i]-flow.outputs[i])+" more "+i);
			}
			for(var construction of player.constructions())
			{
				if(!construction.type.isMachine && construction.activateCount() > construction.number()+construction.buildCount()) //yes, you can build and burn same round
					result.push ("Burning "
						+ (construction.activateCount()-construction.number()) 
						+" more "+construction.name+" than you have!"
					);
				if(construction.type.limited 
					&& construction.activateCount() 
						> construction.number()*construction.type.limited
				)
					result.push("Used "+construction.activateCount()
						+" " +construction.name+ ", only can use "
						+construction.number()*construction.type.limited
					);
			}
			//TODO: verify manipulator chain
		}
		return result;
	});
	game.warnings = ko.pureComputed(function (){
		var result = [];
		if(game.mode()=="mainView")
		{
			flow = game.currentFlow();
			for(var i in flow.totals)
			{
				if(flow.totals[i] && game.statics.manipUses.concat('manipulator').indexOf(i)!=-1)
				{
					result.push("You have "+flow.totals[i]+" unused "+i)
				}
			}
			for(var construction of player.constructions())
			{
				if(construction.type.isMachine && Object.keys(construction.type.activateRequirements).length==0 && construction.number()!=construction.toActivate())
					result.push("You have only activated "+construction.toActivate() +" of "+ construction.number() +" " + construction.type.name)
				
				if(!construction.type.isMachine && flow.inputs[construction.name] < construction.toActivate())
					result.push("You are burning "+construction.toActivate()+" "+construction.name+" but only using "+flow.inputs[construction.name]);
			}
		}
		return result;
	})
	
	game.hasValidInstructions = ko.pureComputed(function (){
		return game.errors().length==0;
	});
	
	//invention
	game.cardForInvention = ko.observable();
	game.cardsSelected = ko.observableArray([]);
	game.inventionName = ko.observable("null");
	game.cardActivePlayer = ko.observable(0);
	game.fuelToUse = ko.observable();
	game.activePlayer = ko.computed (function (){
		return (game.cardActivePlayer()+game.currentPlayer())%game.players().length;
	});
	game.possibleFuels = ko.pureComputed(function (){
		var player = game.currentPlayer();
		var sofar = {};
		var result = [];
		
		//TODO: refine possible Fuel rules
		//TODO: Add trading
		//TODO: exclude machines?
		for(var player of game.players())
			for(var invention of player.constructions())
				if(invention.type.inventor != player.name 
					&& !sofar[invention.type.name]
					&& !invention.type.isMachine)
				{
						sofar[invention.type.name] = true
						result.push(invention.type.name);
				}
		return result;
	});
	game.finalizeInvention = function (){
		var player = game.players()[game.currentPlayer()];
		var effects = game.cardsSelected().map((card)=> card.effect);
		effects = effects.length?effects.reduce((a,b)=> a.concat(b)):[];
		var type = new ConstructionType(game.inventionName(),effects,player);
		player.addConstruction(type,0);
		console.log(type);
		game.mode('mainView');
	}
	game.skipInventing = function (){
		game.mode('mainView');
	}
	game.addCard = function (){
		
		var card = game.cardForInvention()
		game.players()[game.currentPlayer()].cards.remove(card);
		card = JSON.parse(JSON.stringify(card));
		for(var effect of card.effect)
			if(effect.target == '<Fuel>')
			{
				console.log("replaceing <Fuel> with "+game.fuelToUse());
				effect.target = game.fuelToUse();
				card.name = card.name.replace('<Fuel>',effect.target);
			}
			else console.log("effect "+effect.name+" has no Fuel!",effect,card.effect);
		game.cardsSelected.push(card);
		
		game.cardActivePlayer((game.cardActivePlayer()+1)%game.players().length);
	}
	game.declineToAdd = function (){
		game.cardActivePlayer((game.cardActivePlayer()+1)%game.players().length);
	}
	return game;
}
