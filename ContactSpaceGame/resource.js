function buildResourceInstance (template,number,idInputs)
{
	var ri = {};
	
	ri.type = template.type;
	ri.templateName = template.templateName;
	ri.number = ko.observable(number);
	ri.useInputTypes = template.useInputs;
	ri.inputCases = ko.observableArray([]);
	ri.visible=ko.observable(false);
	ri.hasBuild = !!(template.build);
	ri.view = function (){ri.visible(true);};
	ri.hide = function (){ri.visible(false);};
	//ri.mode = ko.observable(); //maintain, neglect, abandon
	
	//TODO: Add ability to increase Instance!

	var actions = ["maintain","neglect","abandon"];
	ri.actionNumbers={};
	for(var action of actions)
		ri.actionNumbers[action]=ko.observable(0);
	ri.actionNumbers['maintain'](number);
	
	if(template.build)ri.actionNumbers['build']=ko.observable(0);
	
	ri.unassignedNumbers = ko.pureComputed(function (){
		return ri.number() - actions.reduce (
			function (total,action){return total+Number(ri.actionNumbers[action]())},
			0
		);
	});
	
	ri.resourceFlow = ko.pureComputed(function (){
		var directions = ['inputs','outputs'];
		var flow = {inputs:{},outputs:{}};
		for(var action of projects)
		{
			var actionResult = ri[action];
			if(actionResult) 
				for(var d of directions)
					for(var i of actionResult[d])
					{
						var value = i.value*ri.actionNumbers[action]();
						if(!flow[d][i.name])flow[d][i.name]= value;
						else flow[d][i.name] +=value;
					}
		}
		var result = {inputs:[],outputs:[]};
		for(var d of directions)
			for(var i in flow[d])
				result[d].push({name:i, value:flow[d][i]});
		return result;
	});
	
	if(template.idInputs && template.idInputs.length != 0)
	{
		for(var i = 0;i< template.idInputs.length; i++)
		{
			var requirements = template.idInputs[i].split(':');
			if(isValidInputType(
				idInputs[i],
				requirements[1],
				template.validIdInputs?template.validIdInputs[requirements[1]]:null)
			)
				ri[requirements[0]] = idInputs[i];
			else
			{
				console.log("BAD INPUT");
				return false;
			}
		}
	}
	
	if(template.idAutoGens)
		for(var i of template.idAutoGens)
		{
			ri[i] = template[i](ri);
		}
	
	ri.id = template.id(ri);
	ri.template = template;
	
	var projects = ["maintain","neglect","abandon"];
	if(template.build) projects.push("build");
	for(var i of projects)
	{
		ri[i] = template[i]?template[i]:[{},{}];
		ri[i] = buildProjectType(i,ri[i][0],ri[i][1]);
	}
	
	if(template.useInputs)
	{
		ri.useInputs = [];
		for(var i of template.useInputs)
			ri.useInputs.push(ko.observable());
	}
	
	return ri;
}
