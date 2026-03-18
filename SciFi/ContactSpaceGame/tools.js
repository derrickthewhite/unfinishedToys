var knockoutMap = function (key,observableArray)
{
	return ko.pureComputed(function (){
		var result = {};
		for(var i of observableArray())
			result[ko.utils.unwrapObservable(i[ko.utils.unwrapObservable(key)])] = i;
		return result;
	});
}

var knockoutArrayMap = function (key,observableArray)
{
	return ko.pureComputed(function (){
		var result = {};
		for(var i of observableArray()){
			var id = ko.utils.unwrapObservable(i[ko.utils.unwrapObservable(key)]);
			if(!result[id]) result[id] = [];
			result[id].push(i);
		}
		return result;
	});
}

ko.components.register('projectDisplay',{
	viewModel: function (params){
		var self = this;
		var project = params.project;
		self.observable = params.observable;
		
		self.title = params.title === undefined? project.key: params.title;
		self.inputs = project.inputs;
		self.outputs = project.outputs;
		self.max = ko.pureComputed(function (){
			if(params.max && self.observable)
				return params.max()+Number(self.observable());
			else return Number.MAX_SAFE_INTEGER;
			});
	},
	template: '<div>\
			<span data-bind="text:title"></span>\
			<span data-bind="foreach:inputs">\
				<span data-bind="text:name"></span>\
				<span data-bind="text:value"></span>\
			</span>\
			=>\
			<span data-bind="foreach:outputs">\
				<span data-bind="text:name"></span>\
				<span data-bind="text:value"></span>\
			</span>\
			<span data-bind="if:observable!==undefined">\
				<input type = "Number" data-bind="value:observable, attr:{max: max}"></input>\
			</span>\
		</div>'
});