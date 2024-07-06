var generateColors = function (random) {
	var abilities = config.abilities;
	var shapes = Object.keys(config.shapes);
	var possibleAbilities = shuffleArray(abilities.concat(abilities), random);
	var possibleShapes = shuffleArray(shapes.concat(shapes).concat(shapes), random);
	var result = {};
	for(var color of config.colors) {
		result[color] = {
			name: color,
			abilities: [],
			shapes: []
		}
	}
	var colors = config.colors;
	var nextColor = function () {
		var color = colors.shift();
		colors.push(color);
		return color;
	}
	for(var ability of possibleAbilities) {
		result[nextColor()].abilities.push(ability);
	}
	for(var shape of possibleShapes) {
		result[nextColor()].shapes.push(shape);
	}
	return Object.keys(result).map(color=> result[color]);
}

var generateMeta = function (colors, random) {
	var result = {};
	for(var color of colors){
		result[color.name] = [];
		var creaturesToBuild = config.costVariations.reduce((a,b)=>a+b);
		var abilityPool = shuffleArray(copyUntilLargerThan(color.abilities,creaturesToBuild), random);
		var shapePool = shuffleArray(copyUntilLargerThan(color.shapes,creaturesToBuild), random);
		for(var cost = 0; cost <config.costVariations.length; cost++){
			for(var i = 0;i < config.costVariations[cost]; i++){
				var ability = abilityPool.pop();
				var stats = config.shapes[shapePool.pop()](cost);
				result[color.name].push(
					CardName("creature", color.name, cost, CreatureName(stats[0],stats[1],[ability]))
				);
			}
		}
		result[color.name]["land"] = CardName("land", color.name, "land", {});
	}
	return result;
}

var generateDeck = function(meta, colors, random) {
	var possibleCardTypes = colors.map(color => meta[color])
		.reduce((a,b)=> a.concat(b),[]);
	var possibleCards = possibleCardTypes.map(cardType => 
		[
			Card(cardType),
			Card(cardType),
			Card(cardType),
			Card(cardType)
		])
		.reduce((a,b)=> a.concat(b),[]);
	possibleCards = shuffleArray(possibleCards, random);
	result = possibleCards.slice(0,36);
	while(result.length < 60 ){
		result.push(Card(meta[colors[0]]["land"]));
		colors.push(colors.shift());
	}
	return result;
}