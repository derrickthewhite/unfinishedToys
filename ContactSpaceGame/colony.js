var Colony = function (name){

	var colony = this;
	colony.name = name;
	colony.visible = ko.observable(true);
	
	colony.standingResources = ko.observableArray([]);

	colony.resourcesList = {};
	colony.resources = ko.observableArray([]);
	colony.turnReady = ko.observable(false);
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
	colony.selected = ko.computed(function (){
		return colony==game.currentColony();
	});

	colony.projects = ko.observableArray([]);
	colony.projectTypes = ko.observableArray([]);

	colony.income = function (){
		var result = {};
		for(var i of resource) result.resources[resource[i]]=1;
		return result;
	};

	colony.allocateResources = function (resources) {
		for(var i of resource) colony.resources[resource[i]].value(colony.resources[resource[i]].value+resources[i]);
	};
	
	colony.resourceFlow = ko.computed(function (){
		var flowIndex ={inputs:{},outputs:{}};
		var directions = ['inputs','outputs'];
		for(var cr of colony.standingResources())
		{
			var flow = cr.resourceFlow();
			for(var d of directions)
			for(var i of flow[d]){
				if(!flowIndex[d][i.name])flowIndex[d][i.name]=0;
				flowIndex[d][i.name]+=i.value;
			}
		}
		
		result = [];
		for(var d of directions)
		for(var i in flowIndex[d])
			result.push({name:i,value:flowIndex[d][i] * (d=="outputs"?1:-1)});
		
		return result;
	});

	colony.useInputOptions = ko.pureComputed(function (){
	
		var result = [];
		for(var r of colony.standingResources())
		{
			if(r.useInputTypes)
			{
				result[r.id]=[];
				for(var input of r.useInputTypes)
				{
					result[r.id][input]=[];
					for(var i of colony.standingResources())
						if(i.type == input)result[r.id][input].push(i);
				}
			}
		}
		return result;
	});

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

	empire.turnReady = ko.computed(function (){
		return true;
	});
	empire.selected = ko.computed(function (){
		return empire==game.currentEmpire();
	});

	empire.addColony = function (){
		empire.colonies.push(new Colony(game.name()));
	};
};
