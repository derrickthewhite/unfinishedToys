function buildSetting(numStars, dimensions, cultures){
	var galaxy = [];
	var locations = [];
	//TODO: vary planets by culture
	//TODO: how to generate starting units
	//TODO: how to generate production size
	//TODO: how to place empires
	//TODO: round to perfect numbers?
	console.log(cultures);
	root.players(cultures);
	root.currentPlayer(cultures[0]);
	for(var i =0;i<numStars;i++)
	{
		locations.push({
			x:Math.round(Math.random()*dimensions.x),
			y:Math.round(Math.random()*dimensions.y)}); 
	}
	locations.sort((a,b)=>a.x==b.x?a.y<b.y?-1:1:a.x<b.x?-1:1);
	locations = locations.filter((value,index,self) => index ==0 || self[index-1].x != value.x ||self[index-1].y != value.y);
	locations = locations.map(function (a){ return {location:a,production:Math.floor(Math.pow(6,randomGausian(1,.5)))}});
	var totalProduction = locations.reduce((sofar,a)=> a.production+sofar,0);
	var productionSum = 0;
	locations.forEach(a => {
		productionSum += a.production;
		var culture = productionSum<totalProduction/2?cultures[0]:cultures[1];
		var startingUnits = [];
		for(var unitType of culture.units)
		{
			var effort = unitType.type == "transport"? 5:10;
			produced = Math.round(a.production / unitType.cost *effort *roundingTolerance)/roundingTolerance;
			startingUnits.push(Unit(unitType,culture,produced));
		}
		galaxy.push(Planet(worldNames[Math.floor(Math.random()*worldNames.length)],a.production,a.location,culture,culture,[Fleet(culture,startingUnits,"Ground")]));
	})
	console.log(galaxy.reduce((sofar,a)=>a.owner().name == "English"? a.production+sofar: sofar,0), totalProduction);
	return galaxy;
}