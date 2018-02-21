function player (name)
{
	var self = this;
	self.name = name;
	self.constructions = ko.observableArray();
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
		for(var construction of self.constructions())
		{
			for(var input of construction.cost())
			{
				if(!result.inputs[input.resource]) result.inputs[input.resource]=0;
				if(!result.totals[input.resource]) result.totals[input.resource]=0;
				
				result.inputs[input.resource]+=input.value;
				result.totals[input.resource]-=input.value;
			}
			for(var output of construction.output())
			{
				if(!result.outputs[output.resource]) result.outputs[output.resource]=0;
				if(!result.totals[output.resource]) result.totals[output.resource]=0;
				
				result.outputs[output.resource]+=output.value;
				result.totals[output.resource]+=output.value;
			}
		}
		return result;
	});
}