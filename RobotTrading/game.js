function Game(){
	var game = {};
	game.statics ={};
	game.statics.manipUses = ['builders','operators','miners']; //TODO: move to model? maybe?
	//TODO: get these auto creates correct!
	for(var use of game.statics.manipUses)
	{
		game[use] = ko.observable(0);
	}
	
	game.model = Model();
	
	game.currentPlayer = ko.pureComputed(function (){
		return game.model.players()[game.model.currentPlayer()];
	});

	//TODO: remove view elements from model elements, particuarly for constructions
	game.activeConstructions = ko.pureComputed(function (){
		return game.currentPlayer().constructions().map(construction =>{
			return {
				base:construction,
				toBuild: ko.observable(0),
				toActivate:ko.observable(construction.type.free?construction.number():0)
			};
		});
	});
	
	//setup
	game.newPlayerName = ko.observable("");
	game.addPlayer = function (){
		game.model.addPlayer(game.newPlayerName(),game);
	};
	game.startGame = function ()
	{
		game.model.startGame();
	};

	//building
	game.manipulatorsLeft = ko.pureComputed(function (){
		var flow = game.currentPlayer().totalFlow();
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
			game.model.runBuildPhase(game.currentPlayer().constructions().reduce((out,a)=>{
					out[a.name]={};
					out[a.name].totalChange=a.expectedChange();
					return out;
			},{}));
			for(var use of game.statics.manipUses)
			{
				game[use](0);
			}
		}
	}
	game.currentFlow = ko.pureComputed(function () {
		if(!game.currentPlayer()) return {};
		var flow = game.currentPlayer().totalFlow();
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
		if(game.model.mode()=="mainView")
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
			for(var construction of game.currentPlayer().constructions())
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
		if(game.model.mode()=="mainView")
		{
			flow = game.currentFlow();
			for(var i in flow.totals)
			{
				if(flow.totals[i] && game.statics.manipUses.concat('manipulator').indexOf(i)!=-1)
				{
					result.push("You have "+flow.totals[i]+" unused "+i)
				}
			}
			for(var construction of game.currentPlayer().constructions())
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
	game.fuelToUse = ko.observable();
	game.possibleFuels = ko.pureComputed(function (){
		var sofar = {};
		var result = [];
		
		//TODO: refine possible Fuel rules
		//TODO: Add trading
		//TODO: exclude machines?
		for(var neighbor of game.model.players())
			for(var invention of neighbor.constructions())
				if(invention.type.inventor != game.currentPlayer().name 
					&& !sofar[invention.type.name]
					&& !invention.type.isMachine)
				{
						sofar[invention.type.name] = true
						result.push(invention.type.name);
				}
		return result;
	});
	game.finalizeInvention = function (){
		game.model.finalizeInvention(game.inventionName());
	}
	game.skipInventing = function (){
		game.model.doneInventing();
	}
	game.addCard = function (){
		game.model.addCard(game.cardForInvention(),game.fuelToUse());
	}
	game.declineToAdd = function (){
		game.model.addCard();
	}
	return game;
}
