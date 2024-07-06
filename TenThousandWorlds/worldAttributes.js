var getWorld = function (idString){
	
	Math.seedrandom(idString);
	
	var hydro = Math.random()<.1?0:Math.random()<.1?Math.random()*.4:.4+Math.random()*.6;
	var temperature = Math.round(((Math.random()+Math.random())/2*70+250)*1.8-460);
	var life = getLifeStage(hydro);
	var atmosphere = getAtmosphere(life);
	
	var result =  {
		hydro:hydro,
		life:life,
		temperature: temperature,
		atmos: atmosphere
	}
	result.gear = gearRequired(result);
	return result;
}

var gearRequired = function (world){
	var result = [];
	if(world.atmos.oxygen*world.atmos.pressure < 50) result.push("oxygen"); 
	if(world.atmos.oxygen*world.atmos.pressure > 150 || world.atmos.pressure > 200) 
		result.push("rebreather"); 
	if(world.temperature < 32) result.push("winter gear");
	if(world.temperature > 100) result.push("Air Conditioning");
	if(world.hydro >.95) result.push("boat");
	return result;
}

var getAtmosphere = function (life){
	var basePressure = Math.random()<.1
		?Math.round(Math.random()*5 *100)/100
		:Math.random()<.05
		?Math.round(Math.random()*100)/100
		:1;
	if(life=="lifeless"){
		return {
			oxygen:0,
			CO2: 1000,
			pressure: logarithmicPercent(3,basePressure)
		}
	}
	if(life=="single cell"){
		return {
			oxygen:Math.round(Math.random()*100),
			CO2: logarithmicPercent(3,3*100),
			pressure: logarithmicPercent(2,basePressure)
		}
	}
	return {
			oxygen:Math.round(logarithmicPercent(1.5)*100),
			CO2: Math.round(logarithmicPercent(1.5)*100),
			pressure: logarithmicPercent(1.5,basePressure)
	}
}

var getLifeStage = function(hydro)
{
	roll = Math.random()*20;
    if(Math.random()< .3){
		if(roll<3) return 'simple';
		if(roll<15) return 'single cell';
		if(roll<20)return 'lifeless';
	}
		if(hydro<.2)
        {
            if(roll>5)return 'lifeless';
            if(roll>10)return 'single cell';
            if(roll>15)return 'simple';
            else return 'mature';
        }
        if(hydro<.85)
        {
            if(roll>15)return 'mature';
            else return 'early land';
        }
        if(hydro<.95)
        {
            if(roll<2) return 'mature ocean';
            else if(roll<4)return 'early land';
            else return 'mature';
        }
        if(hydro<.97)
        {
            if(roll<2) return 'mature ocean';
            else if(roll<8)return 'early land';
            return 'mature';
        }
        if(hydro<1)
        {
            if(roll<10) return 'mature ocean';
            else if(roll<15)return 'early land';
            return 'mature';
        }
        return 'mature ocean';
};

var logarithmicPercent = function (base,multiplier){
	multiplier=multiplier==undefined?1:multiplier;
	return Math.round(Math.pow(base,Math.random()+Math.random()-1)*100*multiplier)/100;
}