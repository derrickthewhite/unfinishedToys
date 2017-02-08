function buildResourceInstance (template,number,idInputs)
{
	var ri = {};
	
	ri.type = template.type;
	ri.templateName = template.templateName;
	ri.number = ko.observable(number);
	
	if(template.idInputs && template.idInputs.length != 0)
	{
		for(var i = 0;i< template.idInputs.length; i++)
		{
			var requirements = template.idInputs[i].split(':');
			if(isValidInput(
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
	
	var projects = ["build","maintain","neglect","abandon"];
	for(var i of projects)
	{
		ri[i] = template[i]?template[i]:[{},{}];
		ri[i] = buildProjectType(i,ri[i][0],ri[i][1]);
	}
	
	ri.visible=ko.observable(false);
	ri.view = function (){ri.visible(true);};
	ri.hide = function (){ri.visible(false);};

	ri.mode = ko.observable("maintain"); //maintain, neglect, abandon
	ri.setMaintain = function (){ri.mode("maintain")};
	ri.setNeglect = function (){ri.mode("neglect")};
	ri.setAbandon= function (){ri.mode("abandon")};
	
	ri.resourceFlow = ko.computed(function (){
		var action = ri[ri.mode()];
		
		var flow = {inputs:[],outputs:[]};
		var directions = ['inputs','outputs'];
		for(var d of directions)
			for(var i of action[d])flow[d].push({name:i.name, value:i.value*ri.number()});
		
		//TODO: add flow requiring inputs
		
		return flow;
	});
	
	ri.useInputTypes = template.useInputs;
	
	if(template.useInputs)
	{
		ri.useInputs = [];
		for(var i of template.useInputs)
			ri.useInputs.push(ko.observable());
	}
	ri.inputCases = ko.observableArray([]);
	
	//TODO: track things put into input cases
	ri.addInputCase = function (){
		var inputCase = {};
		inputCase.removeInputCase = function ()
		{
			console.log("this function is not properly tested!");
			ri.inputCases.remove(inputCase);
		}
		inputCase.number = ko.observable(0);
		inputCase.output = ko.pureComputed(function (){
			var result = template.use(ri,inputCase.inputs[0],inputCase.inputs[1]);
			console.log(result);
			return result;
		});
		inputCase.totalOutput = ko.pureComputed(function (){
			return inputCase.output()*inputCase.number();
		});
		inputCase.availiableCounts = ko.pureComputed(function (){
			var max = Number.MAX_VALUE;
			for(i of inputCase.inputs)
				max = Math.min(max,i.number());
			return max;
		});
		inputCase.inputs = [];
		for(var i in ri.useInputs)
			inputCase.inputs.push(ri.useInputs[i]());
		ri.inputCases.push(inputCase);
	};
	
	return ri;
}
