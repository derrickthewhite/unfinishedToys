var CreatureName = function (power, toughness, abilities) {
	if(toughness == 0){
		toughness +=1;
		power-= 1;
	}
	var creatureName =  {
		power: power,
		toughness: toughness,
		abilities: abilities
	}
	creatureName.name =
		power+"/"+toughness +" " + abilities.join(",");
	return creatureName;
}
var CardName = function (type, color, cost, guts){
	var cardName =  {
		type: type,
		cost: cost,
		color: color,
		guid: nextCardNameId++
	}
	for(var key of Object.keys(guts)){
		cardName[key] = guts[key]
	}
	cardName.name = color +(guts.name? " "+guts.name:"")+ " ("+cost+")";
	
	return cardName;
}

var Card = function (cardName) {
	var card = {
		cardName: cardName,
		guid : nextCardId++
	}
	return card;
}

var CreatureInstance = function (card) {
	card.instance = {
		damage: 0,
		tapped: false,
		sick: true,
		dead: false
	}
	if(card.cardName.abilities.includes("haste"))card.instance.sick = false;
	return card;
}
var LandInstance = function (card) {
	card.instance = {
		tapped: false
	}
	return card;
}
var ViewCard = function (card) {
	var view = {};
	
	Object.keys(card).forEach(key => view[key] = card[key]);
	view.display = {};
	view.display.selected = ko.observable(false);
	view.original = card;
	
	return view;
}