function buildSetting(numStars, dimensions, cultures){
	var galaxy = [];
	var locations = [];
	//TODO: vary planets by culture
	//TODO: how to generate starting units
	//TODO: how to generate production size
	//TODO: how to place empires
	//TODO: round to perfect numbers?
	for(var i =0;i<numStars;i++)
	{
		//use floor for the moment -- doesn't stick things in margins
		//var changeFunct = Math.round;
		var changeFunct = Math.floor;
		//var changeFunct = (a)=>a;
		locations.push({
			x:changeFunct(Math.random()*dimensions.x),
			y:changeFunct(Math.random()*dimensions.y)}); 
	}
	locations.sort((a,b)=>a.x==b.x?a.y<b.y?-1:1:a.x<b.x?-1:1);
	locations = locations.filter((value,index,self) => index ==0 || self[index-1].x != value.x ||self[index-1].y != value.y);
	locations = locations.map(function (a){ return {location:a,production:Math.floor(Math.pow(6,randomGausian(1,.5)))}});
	var totalProduction = locations.reduce((sofar,a)=> a.production+sofar,0);
	var productionSum = 0;
	var worldNamesByCultures = cultures.map(culture => shuffleArray(JSON.parse(JSON.stringify(culture.planetNames))));
	locations.forEach(a => {
		productionSum += a.production;
		var culture = productionSum<totalProduction/2?cultures[0]:cultures[1];
		var worldNames = productionSum<totalProduction/2?worldNamesByCultures[0]:worldNamesByCultures[1];
		var startingUnits = [];
		for(var unitType of culture.units)
		{
			var effort = unitType.type == "transport"? 5:10;
			produced = Math.round(a.production / unitType.cost *effort *roundingTolerance)/roundingTolerance;
			startingUnits.push(Unit(unitType,culture,produced));
		}
		galaxy.push(Planet(worldNames[Math.floor(Math.random()*worldNames.length)],a.production,a.location,culture,culture,[Fleet(culture,startingUnits,"Ground")]));
	})
	console.log("Production Ratio",galaxy.reduce((sofar,a)=>a.owner().name == "English"? a.production+sofar: sofar,0), totalProduction);
	return galaxy;
}
//TODO: move save data
