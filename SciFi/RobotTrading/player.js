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
	self.score = ko.pureComputed(function (){
		return self.constructions().reduce((out,a)=>out+a.score(),0);
	});
}