var resource = ["POPULATION","FOOD","INDUSTRY","RESEARCH","CULTURE","TRANSPORTATION","POLICE"];

var game = {};

var Project = function (projectType)
{
	var project = this;
	project.type = projectType;
	project.number = ko.observable(0);

	project.cost = ko.computed(function (){
		var cost = {};

		for(var i of project.type.inputs){
			cost[i.name] = {name:i.name,value:project.number()* i.value}
		}
		return cost;
	});
	
	project.output = ko.computed(function (){
		var cost = {};

		for(var i of project.type.inputs){
			cost[i.name] = {name:i.name,value:project.number()* i.value}
		}
		return cost;

	});

	return project;
};

var Colony = function (name){

	var colony = this;
	colony.name = name;
	colony.visible = ko.observable(true);
	
	colony.standingResources = ko.observableArray(buildStartingResourceSet());

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
	// TODO: list possible inputs for use by useable standing resources
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

function startState (){
	var result = {foo:"bar"};
	result.empireName = ko.observable("Human");
	result.numColonies = ko.observable(1);
	result.colonyNameList = [{name:ko.observable("Earth")}];
	result.colonyNames = ko.computed(function (){
		var names = [];
		for(var i =0;i<result.numColonies();i++)
		{
			if(result.colonyNameList.length <= i)
				result.colonyNameList.push({name:ko.observable("")});
			names.push(result.colonyNameList[i]);
		}
		return names;
	});
	result.numEmpires = ko.observable(2);

	result.generateGame = function ()
	{
		var usedNames = [];
		var errorMessage = "";
		for(var i of result.colonyNames())
		{
			if(i.name()=="")errorMessage+="Colonies must be named!\n";
			if(usedNames.indexOf(i)!=-1) errorMessage+="The name '"+i.name()+"' has been used before!\n"
			usedNames.push(i.name());
		}
		if(errorMessage==""){
			game.empires.push(new Empire(game.startState.empireName()));
			for(var i =0;i<game.startState.numColonies();i++)
				game.empires()[0].colonies.push(new Colony(game.startState.colonyNameList[i].name()));
			for(var j =1;j<game.startState.numEmpires();j++)
			{
				var empire = new Empire(storedNames.random("alienRaces"));
				for(var i =0;i<game.startState.numColonies();i++)
					empire.colonies.push(new Colony(storedNames.random("worldNames")));
				game.empires.push(empire);
			}
			game.error("");
			game.mode("play");
		}
		else game.error(errorMessage);

	};
	return result;

}

function load(){

	game.empires =ko.observableArray([]);
	game.id = ko.observable(Math.floor(Math.random()*1000000));
	game.name = ko.observable("");
	game.error = ko.observable("");

	game.mode = ko.observable("start"); //start,play,addColony, addProject
	game.currentMode = {};
	game.currentMode.start = ko.computed(function(){return game.mode() == "start"});
	game.currentMode.play = ko.computed(function(){return game.mode() == "play"});
	game.currentMode.addColony = ko.computed(function(){return game.mode() == "addColony"});
	game.currentMode.addProject = ko.computed(function(){return game.mode() == "addProject"});

	game.currentEmpire = ko.observable(null); // null is a valid value here
	game.currentColony = ko.observable(null); // null is a valid value here
	
	game.selectedProject = ko.observable(null); //null is a valid value here

	game.startState = startState();

	game.validProjectsToAdd = ko.computed(function() {
		if(game.currentColony()== null) return [];
		var result = [];

		return result;
	});

	game.showAddProject= function (){

		if(game.currentColony()==null) game.error("You must select a colony first!");
		else{
			game.mode("addProject");
		}
	};
	
	game.addProject = function (){
		var colony = game.currentColony();
		var projectType = game.selectedProject();
		
		if(colony == null) game.error("No Colony Selected");
		else if (projectType == null ) game.error("No Project Selected");
		else {
			colony.projects.push(new Project(projectType));
			colony.projectTypes.push(projectType);
			game.mode("play");
			game.error("");
		}
	}

	game.runTurn = function ()
	{
		var obstacles = [];
		for(var empire of game.empires())
		{
			if(!empire.turnReady())obstacles.push(empire);
			for(var colony of empire.colonies())
			{
				if(!colony.turnReady())obstacles.push(colony);
			}
		}
		if(obstacles.length){
			var message = obstacles.length + " errors to be resolved. ";
			for(var i of obstacles) message+="<br/> A problem must be resolved on "+ i.name;
			game.error(message);
		}
		else
		{
			for(var empire of game.empires())
			{
				for(var colony of empire.colonies())
				{
					colony.allocateResources(colony.income());
				}
			}
		}
	}

	ko.applyBindings(game,document.getElementById('main'));
}