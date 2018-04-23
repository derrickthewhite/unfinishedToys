//TODO: should research really be named "Card"?
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

effects.pollutor = {"name":"Pollutor","action":"produces","quantity":1,"target":"<Pollutant>","trigger":"use"};

effects.worthless = {"name":"Worthless","trigger":"score","quantity":-1};
effects.polutant = {"name":"Polutant","trigger":"score","quantity":-2,"polutant":true};
effects.valuable = {"name":"Valuable","trigger":"score","quantity":1};
effects.good = {"name":"Consumer Good","trigger":"burn","action":"scores","quantity":10,"good":true};
effects.limit1 = {"name":"Once Per Turn","action":"limits","quantity":1,"trigger":"use"};

effects.automatic = {"name":"Automatic","action":"consumes","quantity":-1,"target":"operators","trigger":"use"};
effects.manipulator = {"name":"Manipulator","action":"produces","quantity":1,"target":"manipulator","trigger":"use","machine":true};
effects.miner = {"name":"Miner (3)","action":"produces","quantity":3,"target":"miners","trigger":"use","machine":true};
effects.miner2 = {"name":"Miner (2)","action":"produces","quantity":2,"target":"miners","trigger":"use","machine":true};
effects.miner4 = {"name":"Miner (4)","action":"produces","quantity":4,"target":"miners","trigger":"use","machine":true};
effects.builder = {"name":"Builder (3)","action":"produces","quantity":3,"target":"builders","trigger":"use","machine":true};
effects.builder2 = {"name":"Builder (2)","action":"produces","quantity":2,"target":"builders","trigger":"use","machine":true};
effects.builder4 = {"name":"Builder (4)","action":"produces","quantity":4,"target":"builders","trigger":"use","machine":true};
effects.operator = {"name":"Operator","action":"produces","quantity":3,"target":"operators","trigger":"use","machine":true};
effects.attacks = {"name":"Destroyer","action":"produces","quantity":3,"target":"attackers","trigger":"use","machine":true};

function buildCreator(name,product,quantity){
	return {
		"name":name,
		"action":"produces",
		"quantity":quantity,
		"target":product,
		"trigger":"use",
		"machine":true
	}
}
function buildCreatorCard(name,product,quantity,value){
	return new Card(name,[buildCreator(name,product,quantity)],value);
}

cards.deck.push(new Card("2 <Fuel> to Use",[effects.fuel2A],-4));
cards.deck.push(new Card("2 <Fuel> to Create",[effects.fuel2C],-2));
cards.deck.push(new Card("3 <Fuel> to Create",[effects.fuel3C],-3));
cards.deck.push(new Card("1 <Fuel> to Maintain",[effects.fuel1P],-3));

for(var i =0;i<5;i++)cards.deck.push(new Card("1 <Fuel> to Create",[effects.fuel1C],-1));
for(var i =0;i<3;i++)cards.deck.push(new Card("2 <Fuel> to Create",[effects.fuel2C],-2));
for(var i =0;i<3;i++)cards.deck.push(new Card("1 <Fuel> to Use",[effects.fuel1A],-2));
for(var i =0;i<5;i++)cards.deck.push(new Card("Worthless",[effects.worthless],-4));	
for(var i =0;i<5;i++)cards.deck.push(new Card("Valuable",[effects.valuable],4));
for(var i =0;i<10;i++)cards.deck.push(new Card("Automatic",[effects.automatic,effects.limit1],2));
for(var i =0;i<6;i++)cards.deck.push(new Card("Manipulator",[effects.manipulator],2));
for(var i =0;i<6;i++)cards.deck.push(new Card("Miner",[effects.miner],3));
for(var i =0;i<6;i++)cards.deck.push(new Card("Builder",[effects.builder],3));
for(var i =0;i<6;i++)cards.deck.push(new Card("Operator",[effects.operator],3));
for(var i =0;i<4;i++)cards.deck.push(new Card("Destroyer",[effects.destroyer],4));


console.log(cards.deck);
console.log("absolute card value",cards.deck.reduce((out,a)=>out+Math.abs(a.value),0));
console.log("addative card value",cards.deck.reduce((out,a)=>out+a.value,0));
console.log("positive Cards",cards.deck.filter(a=>a.value>0).length);
console.log("negative Cards",cards.deck.filter(a=>a.value<0).length);

cards.draw = function(num)
{
	var result = [];
	for(var i =0;i<num;i++) 
		result.push(cards.deck
			[Math.floor(Math.random()*cards.deck.length)]
		);
	return result;
}

cards.negativePool = [
	new Card("1 <Fuel> to Create",[effects.fuel1C],-2),
	new Card("2 <Fuel> to Create",[effects.fuel2C],-4),
	new Card("3 <Fuel> to Create",[effects.fuel3C],-6),
	new Card("1 <Fuel> to Use",[effects.fuel1A],-4),
	new Card("Worthless",[effects.worthless],-1),
	new Card("Polutant",[effects.polutant],-2),
	new Card("Pollutor",[effects.pollutor],-3),
	new Card("1 <Fuel> to Maintain",[effects.fuel1P],-5),
];
cards.positivePool = [
	new Card("Valuable",[effects.valuable],2),
	new Card("Automatic",[effects.automatic,effects.limit1],2),
	new Card("Manipulator",[effects.manipulator],3)
]
for(var i =2;i<=5;i++)
	for(var product of ['builders','operators','miners',"attackers","researchers"])
		cards.positivePool.push(buildCreatorCard(product+" ("+i+")",product,i,1+(i-2)*2));