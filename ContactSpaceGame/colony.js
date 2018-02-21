var Colony = function (name){
	//TODO: 
	var colony = this;
	colony.name = name;
	colony.visible = ko.observable(true);
	
	colony.standingResources = ko.observableArray([]);
	colony.resourceUses = ko.observableArray([]);

	colony.resourcesList = {};
	colony.resources = ko.observableArray([]);
	colony.IssuesBeforeValidTurn = ko.pureComputed(function (){
		var result = [];
		var resourceTotal = [];
		for(var i of colony.resourceFlow())
		{
			if(!resourceTotal[i.name])resourceTotal[i.name]=0;
			resourceTotal[i.name]+=i.value;
		}
		for(var i in resourceTotal)
		{
			if(resourceTotal[i]<0) result.push(i+" is short by "+resourceTotal[i]+" on "+colony.name);
		}
		return result;
	});
	for(var i of resource) {
		colony.resourcesList[i]= ko.observable(0);
		colony.resources.push({name:i,value:colony.resourcesList[i]})
	}

	colony.select = function (){
		game.currentColony(colony);
		colony.visible(true);
	};
	colony.view = function (){colony.visible(true);};
	colony.hide = function (){colony.visible(false);};
	colony.selected = ko.pureComputed(function (){
		return colony==game.currentColony();
	});

	colony.projects = ko.observableArray([]);
	colony.projectTypes = ko.observableArray([]);
	
	function translateResourceFlow (flowIndex,directions,flowList)
	{
		for(var flItem of flowList)
		{
			var flow = flItem.resourceFlow();
			for(var d of directions)
			for(var i of flow[d]){
				if(!flowIndex[d][i.name])flowIndex[d][i.name]=0;
				flowIndex[d][i.name]+=i.value;
			}
		}
	}
	colony.resourceFlow = ko.pureComputed(function (){
		var flowIndex ={inputs:{},outputs:{}};
		var directions = ['inputs','outputs'];
		translateResourceFlow(flowIndex,directions,colony.standingResources());
		translateResourceFlow(flowIndex,directions,colony.resourceUses());
		
		result = [];
		for(var d of directions)
		for(var i in flowIndex[d])
			result.push({name:i,value:flowIndex[d][i] * (d=="outputs"?1:-1)});
		
		return result;
	});
	
	colony.resourceUsesByUsingResourceID = knockoutArrayMap('usingResourceID',colony.resourceUses);
	colony.resourcesByType = knockoutArrayMap('type',colony.standingResources);
	colony.resourcesByID = knockoutMap('id',colony.standingResources);
	
	colony.resourcesUsed = ko.pureComputed(function (){
		var result = [];
		var addUse = function (resource,number){
			number = Number(number);
			if(!result[resource.id])result[resource.id]=0;
			result[resource.id]+=number;
		};
		for(var i of colony.resourceUses())
		{
			addUse(i.usingResource(),i.number());
			for(var j of i.inputs()) addUse(j,i.number());
		}
		return result;
	});
	
	colony.resourcesNotUsed = ko.pureComputed(function (){
		var result = [];
		for(var i in colony.resourcesUsed())
		{
			result[i]= colony.resourcesByID()[i].number()-colony.resourcesUsed()[i]
		}
		return result;
	});
	
	colony.resourcesAvailable = function (resourceUse){
		var notUsed = colony.resourcesNotUsed();
		return Number(Math.min.apply(
			null,
			[notUsed[resourceUse.usingResource().id]]
				.concat(resourceUse.inputs().map(function (a) {return notUsed[a.id]}))
		))
		+Number(resourceUse.number());
	};

	colony.addResourceUse = function (usingResource){
		var usedResources = [];
		for(var i of usingResource.useInputs)
			usedResources.push(i());
		colony.resourceUses.push(new ResourceUse (usingResource,usedResources));
	};
	
	colony.removeResourceUse = function (resourceUse){colony.resourceUses.remove(resourceUse);};
	
	//TODO: Science Projects -- probably empire scale
	colony.validProjects = ko.pureComputed(function (){
		
		var result = [];
		
		for(var resource of colony.standingResources())
		{
			if(resource['build'])
				result.push(resource['build']);
		}
		return result;
	});
	
	colony.allProjects = ko.pureComputed(function (){
		var result = [];
		
		for(var resource of colony.standingResources())
		{
			if(resource['build'])
				result.push(resource['build']);
			// ARE THESE REALLY PROJECTS?
			for(var i of resource.actions){
				result.push(resource['build']);
			}
		}
		return result;

	});
	
	colony.advanceProjects = function ()
	{
		//TODO: finish this!
		//TODO: store numbers that carry over from turn to turn
		//TODO: dilapidation!
		//TODO: projects include ability to advance themselves!
		/*
		for(var resource of colony.standingResources())
		{
			if(resource['build'])resource.number(resource.number()+Number(resource.actionNumbers['build']()))
		}
		*/
	};

	colony.resourcePossibilities = function (){
		//NOTE: one resource will have all the functionality, 
		//	but it isn't really privledged from an IO view
		var standingResources = colony.standingResources();
		var resourcesToPossibleResults = [];
		for(var resource of standingResources)
		{
			if(resource.useInputTypes) {
				var possibleInputs = [];
				for(var inputType of resource.useInputTypes)
				{
					possibleInputs[inputType] = [];
					for(var possibleInput of standingResources)
						if(possibleInput.type == inputType)
							possibleInputs[inputType].push(possibleInput);
				}
				var possibleCombinations = [[]];
				
				for(var inputType in possibleInputs)
				{
					var nextSetPossibleCombinations = [];
					for(var i of possibleCombinations)
						for(var j of possibleInputs[inputType])
						{
							nextSetPossibleCombinations.push(i.concat(j));
						}
					possibleCombinations = nextSetPossibleCombinations;
				}
				
				resourcesToPossibleResults[resource.id] 
					= possibleCombinations.map((i)=>{ 
						return {value:resource.template.use(resource,...i),inputs:i}
					});
			}
			else{
				resourcesToPossibleResults[resource.id] 
					=resource.actions.map(action=> 
					{
							var result = {inputs:[],value:[{},{}]};
							for(var input of resource[action].inputs) result.value[0][input.name]=input.value;
							for(var output of resource[action].outputs) result.value[1][output.name]=output.value;
							return result;
					});
			}
		}
		return resourcesToPossibleResults;
	}
	
	colony.resourceSourcesFromPossibilities = function (resource,possibilities){
		var result = [];
		for(var source in possibilities)
		{
			result[source] = possibilities[source].filter(possibility =>{ return possibility.value[1][resource] > 0});
			if(result[source].length ==0) delete result[source];
		}
		return result;
	}
	//targets: {FOOD:50}
	//extras: {Culture:1, FOOD: 1}
	colony.hitTargets = function (targets, extras){
		//TODO: this function
		var possibilities = colony.resourcePossibilities();
		console.log(possibilities);
		console.log(colony.resourceSourcesFromPossibilities('FOOD',possibilities));
		
	}
	
	colony.hitProductionGoal = function (resource,possibilities,goal){
		
		var productionCurve =[];
		for(var source in possibilities)
		{
			productionCurve = productionCurve.concat(possibilities[source].map(a=>{return {inputs:a.inputs,value:a.value,actor:source}}));
		}
		//TODO: sort by things other than population
		productionCurve.sort(function (a,b){
					var aValue = a.value[1][resource]/a.value[0].POPULATION;
					var bValue = b.value[1][resource]/b.value[0].POPULATION;
					return aValue>bValue?-1:1; //highest to lowest
				});
		var soFar = 0;
		var productionCurvePosition=0;
		while (soFar < goal && productionCurve.length > productionCurvePosition)
		{
			var resourceArrangement = productionCurve[productionCurvePosition++];
			var source = colony.resourcesByID()[resourceArrangement.actor];
			var rateOfGain = resourceArrangement.value[1][resource];
			//TODO: single line for max applications?
			//TODO: don't allow reuse of items (important for double situations)
			var maxApplications = source.number();
			for(var input of resourceArrangement.inputs)
			{
				maxApplications = Math.min(maxApplications,input.number());
			}
			var applications = Math.min (maxApplications, (goal-soFar)/rateOfGain);
			//TODO: allow for theoretical use rather than otherwriting by the governor
			var resourceUse = new ResourceUse (source,resourceArrangement.inputs);
			source.increaseAction("maintain",applications);
			resourceArrangement.inputs.forEach(i=>i.increaseAction("maintain",applications));
			colony.resourceUses.push(resourceUse);
			resourceUse.number(applications);
			soFar += rateOfGain*applications;
		}
	}
	
	//Basic AI function, tries to optimize economy as given.
	colony.balanceBudget = function (){
		//TODO: THIS! BALANCE BUDGET!
		// optimize it for what?
		// meet population requirements
		
		//Set initial goal: maintain (and use) populace
		for(var resource of colony.standingResources()) 
			if(resource.type == "Populace"){
				resource.actionNumbers.maintain(resource.number());
				resource.actionNumbers.neglect(0);
				resource.actionNumbers.abandon(0);
			}
		
		var goods = colony.resourceFlow();
		var resourcesToPossibleResults = colony.resourcePossibilities();

		var goodsToSatisfy = [];
		for(var good of goods)
		{
			if(!goodsToSatisfy[good.name])goodsToSatisfy[good.name]=0;
			goodsToSatisfy[good.name]+=good.value;
		}

		//TODO: handle shortages by abandoning things
		for(var i in goodsToSatisfy)
		{
			if(goodsToSatisfy[i] < 0)
				colony.hitProductionGoal(
					"FOOD",
					colony.resourceSourcesFromPossibilities("FOOD",resourcesToPossibleResults),
					-goodsToSatisfy.FOOD
				)
		}
	};

};

var Empire = function (name){
	var empire = this;
	empire.name = name;
	empire.colonies = ko.observableArray([]);
	empire.visible = ko.observable(false);

	empire.select = function (){
		game.currentEmpire(empire);
		empire.visible(true);
	};
	empire.view = function (){empire.visible(true);};
	empire.hide = function (){empire.visible(false);};

	empire.turnReady = ko.pureComputed(function (){
		return true;
	});
	empire.selected = ko.pureComputed(function (){
		return empire==game.currentEmpire();
	});

	empire.addColony = function (){
		empire.colonies.push(new Colony(game.name()));
	};
};
