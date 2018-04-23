function Game(){
	var game = {};
	game.statics ={};
	game.statics.manipUses = ['builders','operators','miners',"attackers","researchers"]; //TODO: move to model? maybe?
	//TODO: get these auto creates correct!
	for(var use of game.statics.manipUses)
	{
		game[use] = ko.observable(0);
	}
	
	game.model = Model();
	
	game.currentPlayer = ko.pureComputed(function (){
		return game.model.players()[game.model.currentPlayer()];
	});
	
	//setup
	game.newPlayerName = ko.observable("");
	game.addPlayer = function (){
		game.model.addPlayer(game.newPlayerName(),game);
	};
	game.startGame = function ()
	{
		game.model.startGame();
		game.resetInputs();
	};
	
	game.inventionMode = function (){
		game.model.startInventing();
	}
	
	game.tradeMode = function (){
		console.log("trade is not implemented yet!");
	}

	//building
	//TODO: remove view elements from model elements, particuarly for constructions
	//TODO: make sure active constructions doesn't reset in mid turn
	game.activeConstructions = ko.pureComputed(function (){
		return game.currentPlayer().constructions().map(construction =>{
			return ConstructionWrapperView(construction);
		});
	});
	game.activeConstructionsMap = ko.pureComputed(function (){
		var a =  game.activeConstructions().reduce((out,a)=>{
			out[a.type.id]=a;return out;
		},{});
		return a;
	});
	game.cardsToPurchase = ko.observableArray([]);
	game.manipulatorsLeft = ko.pureComputed(function (){
		var flow = game.playerFlow();
		flow = JSON.parse(JSON.stringify(flow));
		var manipulators = flow.totals.manipulator;
		for(var use of game.statics.manipUses)
		{
			manipulators -= Number(game[use]());
		}
		return manipulators;
	});
	game.positiveResearch =ko.pureComputed(function (){
		return game.cardsToPurchase().reduce((out,a)=>out+Math.max(a.value,0),0);
	});
	game.negativeResearch =ko.pureComputed(function (){
		return game.cardsToPurchase().reduce((out,a)=>out-Math.min(a.value,0),0);
	});
	game.researchCost =ko.pureComputed(function (){
		return Math.max(game.negativeResearch(),game.positiveResearch());
	});
	game.purchaseResearch = function (card){
		game.cardsToPurchase.push(card);
	}
	game.removeCardToBuy = function (card){
		game.cardsToPurchase.remove(card);
	}
	game.nextTurn = function (){
		if(game.hasValidInstructions())
		{
			game.model.runBuildPhase(
				game.activeConstructions().reduce((out,a)=>{
					out[a.type.name]={};
					out[a.type.name].totalChange=a.expectedChange();
					return out;
				},{}),
				game.attacks(),
				game.cardsToPurchase()
			);
			game.resetInputs();
		}
	}
	game.resetInputs = function (){
		game.workingAttack.attacker(game.currentPlayer());
		game.attacks([]);
		game.cardsToPurchase([]);
		for(var construction of game.activeConstructions()){
			construction.toBuild(0);
			construction.toActivate(0);
		}
		for(var use of game.statics.manipUses)
		{
			game[use](0);
		}
	}
	game.playerFlow = ko.pureComputed(function (){
		var result = {}
		result.inputs = {};
		result.outputs = {};
		result.totals = {};
		result.builds = {};
		result.changes = {};
		function addResources(list,aspect,name,sign){
			sign = sign?sign:1;
			for(var item of list)
			for(var resource of item[aspect]()){
				if(!result[name][resource.resource])result[name][resource.resource]=0;
				result[name][resource.resource]+=resource.value*sign;
			}
		}
		addResources(game.activeConstructions(),'cost','inputs');
		addResources(game.activeConstructions(),'cost','totals',-1);
		addResources(game.activeConstructions(),'output','outputs');
		addResources(game.activeConstructions(),'output','totals');
		addResources(game.activeConstructions(),'buildChange','builds');
		
		return result;
	});
	game.currentFlow = ko.pureComputed(function () {
		if(!game.currentPlayer()) return {};
		var flow = game.playerFlow();
		flow = JSON.parse(JSON.stringify(flow))
		flow.inputs.manipulator = 0;
		for(var i of game.statics.manipUses)
		{
			var value = Number(game[i]());
			flow.inputs.manipulator += value;
			flow.outputs[i] = flow.outputs[i]?value+flow.outputs[i]:value;
			flow.totals[i] = flow.totals[i]?value+flow.totals[i]:value;
		}
		flow.inputs.attackers = game.attacks().map(a=>a.forces()).reduce((a,b)=>a+b,0);
		flow.totals.attackers -= flow.inputs.attackers;
		flow.inputs.researchers = game.researchCost();
		flow.totals.researchers -= game.researchCost();
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
					result.push({
						message:"Requires "+flow.inputs[i]+" "+i,
						solution:{action:"adjust Activation",resource:i,amount:flow.inputs[i]}
					});
				}
				else if(flow.outputs[i]<flow.inputs[i])
					result.push({
						message: "Requires "+(flow.inputs[i]-flow.outputs[i])+" more "+i,
						solution:{action:"adjust Activation",resource:i,amount:(flow.inputs[i]-flow.outputs[i])}
					});
			}
			for(var construction of game.activeConstructions())
			{
				if(!construction.type.isMachine && construction.activateCount() > construction.number()+construction.buildCount()) //yes, you can build and burn same round
					result.push ({
						message:"Burning "
						+ (construction.activateCount()-construction.number()) 
						+" more "+construction.type.name+" than you have!",
						solution:{
							action:"adjust Construction",
							resource:construction.type.name,
							amount:(construction.activateCount()-construction.number())
						}
					});
				if(construction.type.limited 
					&& construction.activateCount() 
						> construction.number()*construction.type.limited
				)
					result.push({
						message: "Used "+construction.activateCount()
							+" " +construction.type.name+ ", only can use "
							+construction.number()*construction.type.limited,
						solution:{
							action:"adjust Activation",
							resource:construction.type.name,
							amount:construction.number()*construction.type.limited-construction.number()
						}
					});
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
					result.push({
						message:"You have "+flow.totals[i]+" unused "+i,
						solution: {action:"none"}
					});
				}
			}
			for(var construction of game.activeConstructions())
			{
				if(construction.type.isMachine && Object.keys(construction.type.activateRequirements).length==0 && construction.number()!=construction.toActivate())
					result.push({
						message:"You have only activated "
							+construction.toActivate() +" of "+ construction.number() 
							+" " + construction.type.name,
						solution:{
							action:"adjust Activation",
							resource:construction.type.name,
							amount:construction.number()-construction.toActivate()
						}
					})
				
				if(!construction.type.isMachine && flow.inputs[construction.type.name] < construction.toActivate())
					result.push({
						message:"You are burning "+construction.toActivate()+" "
							+construction.type.name+" but only using "
							+flow.inputs[construction.type.name],
						solution:{
							action: "adjust Activation",
							resource:construction.type.name,
							amout:construction.toActivate()-flow.inputs[construction.type.name]
						}
				});
			}
			if(game.positiveResearch()!=game.negativeResearch())
				result.push({
					message:"You have "
						+Math.abs(game.positiveResearch()-game.negativeResearch())
						+" extra "
						+(game.positiveResearch()>game.negativeResearch()?"positive":"negative")
						+" research",
					solution:{action:"none"}
				})
		}
		return result;
	});
	game.solve = function (problem){
		if(problem.solution.action == "adjust Activation" || problem.solution.action == "adjust Construction"){
			var toAdjust;
			if(game.statics.manipUses.indexOf(problem.solution.resource)!=-1)
				toAdjust = game[problem.solution.resource];
			if(game.activeConstructions().filter(c=>c.type.name==problem.solution.resource).length)
				toAdjust = game.activeConstructions().filter(c=>c.type.name==problem.solution.resource)[0]
				[(problem.solution.action == "adjust Activation")?"toActivate":"toBuild"];
			if(toAdjust)toAdjust(toAdjust()+problem.solution.amount);
			else console.log("no solution found!");
		}
	}
	
	game.hasValidInstructions = ko.pureComputed(function (){
		return game.errors().length==0;
	});
	
	//warfare
	game.attacks = ko.observableArray([]);
	game.workingAttack = Attack(game.currentPlayer(),undefined,0,[]);
	game.workingTarget = Target(undefined,"attack",0);
	
	game.possibleAttackPlayer = ko.pureComputed(function (){
		return game.model.players().filter(p=>p!=game.currentPlayer());
	});
	game.possibleAttackTargets = ko.pureComputed(function (){
		return game.workingAttack.defender()?game.workingAttack.defender().constructions():[];
	});
	game.attackTypes = ["attack","destroy"];
	
	game.addAttack = function (){
		if(!game.workingAttack.defender() 
			|| game.workingAttack.forces() ==0
			|| game.workingAttack.targets().length==0
		)return "Invalid attack";
		game.attacks.push(game.workingAttack.copy())
	}
	game.addTarget = function (){
		if(!game.workingTarget.targetType()  
			|| game.workingTarget.count()==0
		) return "Invalid Target";
		game.workingAttack.targets.push(game.workingTarget.copy())
	}
	game.removeAttack = function (attack){
		game.attacks.remove(attack);
	}
	game.removeTarget = function (target){
		game.workingAttack.targets.remove(target);
	}
	
	//invention
	game.cardForInvention = ko.observable();
	game.cardsSelected = ko.observableArray([]);
	game.inventionName = ko.observable("null");
	game.fuelToUse = ko.observable();
	game.product = ko.observable("custom");
	game.productName = ko.observable("null");
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
