function Card (name,effect,value)
{
	var self = this;
	self.name = name;
	self.value = value;
	self.effect = effect;
	self.id = getID();
}


var cards = {};
cards.deck = [];
var effects = {};
effects.fuel1A = {"name":"1A","action":"consumes","quantity":1,"target":"<Fuel>","trigger":"use"};
effects.fuel2A = {"name":"2A","action":"consumes","quantity":2,"target":"<Fuel>","trigger":"use"};
effects.fuel3A = {"name":"3A","action":"consumes","quantity":3,"target":"<Fuel>","trigger":"use"};
effects.fuel1C = {"name":"1C","action":"consumes","quantity":1,"target":"<Fuel>","trigger":"create"};
effects.fuel2C = {"name":"2C","action":"consumes","quantity":2,"target":"<Fuel>","trigger":"create"};
effects.fuel3C = {"name":"3C","action":"consumes","quantity":3,"target":"<Fuel>","trigger":"create"};
effects.fuel1P = {"name":"1P","action":"consumes","quantity":1,"target":"<Fuel>","trigger":"maintain"};

effects.worthless = {"name":"Worthless","trigger":"score","quantity":-1};
effects.limit1 = {"name":"Once Per Turn","action":"limits","quantity":1,"trigger":"use"};

effects.automatic = {"name":"Automatic","action":"consumes","quantity":-1,"target":"operator","trigger":"use"};
effects.manipulator = {"name":"Manipulator","action":"produces","quantity":1,"target":"manipulator","trigger":"use","machine":true};
effects.miner = {"name":"Miner","action":"produces","quantity":2,"target":"miner","trigger":"use","machine":true};
effects.destroyer = {"name":"Destroyer","action":"destroys","quantity":1,"target":"[object]","trigger":"use","machine":true};

cards.deck.push(new Card("1 <Fuel> to Use",[effects.fuel1A],-2));
cards.deck.push(new Card("2 <Fuel> to Use",[effects.fuel2A],-4));
cards.deck.push(new Card("3 <Fuel> to Use",[effects.fuel3A],-6));
cards.deck.push(new Card("1 <Fuel> to Create",[effects.fuel1C],-1));
cards.deck.push(new Card("2 <Fuel> to Create",[effects.fuel2C],-2));
cards.deck.push(new Card("3 <Fuel> to Create",[effects.fuel3C],-3));
cards.deck.push(new Card("1 <Fuel> to Maintain",[effects.fuel1P],-3));
for(var i =0;i<3;i++)
{
	cards.deck.push(new Card("Automatic",[effects.automatic,effects.limit1],2));
	cards.deck.push(new Card("Manipulator",[effects.manipulator],2));
	cards.deck.push(new Card("Miner",[effects.miner],2));
	cards.deck.push(new Card("Destroyer",[effects.destroyer],2));
	cards.deck.push(new Card("Worthless",[effects.worthless],-4));
}

cards.draw = function(num)
{
	var result = [];
	for(var i =0;i<num;i++) 
		result.push(cards.deck
			[Math.floor(Math.random()*cards.deck.length)]
		);
	return result;
}