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
	}
	
	colony.removeResourceUse = function (resourceUse){colony.resourceUses.remove(resourceUse);};
	
	colony.advanceProjects = function ()
	{
		//TODO: finish this!
		//TODO: store numbers that carry over from turn to turn
		//TODO: dilapidation!
		for(var resource of colony.standingResources())
		{
			if(resource['build'])resource.number(resource.number()+Number(resource.actionNumbers['build']()))
		}
	}

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
