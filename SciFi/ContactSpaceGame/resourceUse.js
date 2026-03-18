function ResourceUse (usingResource,usedResources){
	var resourceUse = this;
	
	resourceUse.number = ko.observable(0);
	resourceUse.usingResource = ko.observable(usingResource);
	resourceUse.inputs = ko.observableArray(usedResources);
	
	resourceUse.usingResourceID = ko.pureComputed(function (){ return resourceUse.usingResource().id;});
	resourceUse.output = ko.pureComputed(function (){
		//return resourceUse.usingResource().use(resourceUse.usingResource(),resourceUse.inputs()[0],resourceUse.inputs()[1]);
		return resourceUse.usingResource().template.use.apply(
			null,
			[resourceUse.usingResource()].concat(resourceUse.inputs())
		);
	});
	resourceUse.totalOutput = ko.pureComputed(function (){
		var result = [{},{}];
		for(var d in resourceUse.output())
			for(var i in resourceUse.output()[d])
				result[d][i] = resourceUse.output()[d][i]*resourceUse.number();
		return result;
	});
	resourceUse.resourceFlow = ko.pureComputed(function (){
		var flow = {inputs:[],outputs:[]};
		var directions = ['inputs','outputs'];
		for(var d of directions)
			for(var i of resourceUse.totalOutputProject()[d])flow[d].push(i);
		return flow;
	});
	resourceUse.outputProject = ko.pureComputed(function (){
		return buildProjectType('output',resourceUse.output()[0],resourceUse.output()[1]);
	});
	resourceUse.totalOutputProject = ko.pureComputed(function (){
		return buildProjectType('totalOutput',resourceUse.totalOutput()[0],resourceUse.totalOutput()[1]);
	});
}