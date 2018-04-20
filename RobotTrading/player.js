function player (name)
{
	var self = this;
	self.name = name;
	self.constructions = ko.observableArray([]);
	var constructionMap = {};
	self.cards = ko.observableArray();
	self.id = getID();
	self.addCards = function (cards){
		for(var card of cards) self.cards.push(card);
	};
	self.addConstruction = function(type,number){
		var construction = constructionMap[type.name];
		if(!construction)
		{
			construction = new Construction(type,self,0);
			constructionMap[type.name] = construction;
			self.constructions.push(construction);
		}
		construction.number(construction.number()+number);
	};
	
	self.totalFlow = ko.pureComputed(function (){
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
		addResources(self.constructions(),'cost','inputs');
		addResources(self.constructions(),'cost','totals',-1);
		addResources(self.constructions(),'output','outputs');
		addResources(self.constructions(),'output','totals');
		addResources(self.constructions(),'buildChange','builds');
		
		console.log(result);
		return result;
	});

	self.score = ko.pureComputed(function (){
		return self.constructions().reduce((out,a)=>out+a.score(),0);
	});
}