var nextGuid = 1000;
var makeGUID = function ()
{
	return nextGuid++;
}

var dice = function(count)
{
	if(!count)return Math.floor(Math.random()*6)+1;
	var total = 0;
	for(var i = 0;i<count;i++)
		total+=dice();
	return total;
};

var Distribution = function(inputs)
{
	var self = {};
	self.value=[];
	self.subDistro = [];
	self.dice = [];

	for(var i = 0;i<inputs.length;i++)
	{
		if(!inputs[i].end)inputs[i].end = inputs[i].start;
		for(var j = inputs[i].start; j<= inputs[i].end; j++)
		{
			self.value[j]=inputs[i].value;
			self.subDistro[j]=inputs[i].subDistro;
			self.dice[j]=inputs[i].dice;
		}
	}

	self.get = function(index)
	{
		if(self.value[index] && self.value[index] == 'SUB' )
		{
			return Distribution(self.subDistro[index]).get(dice(self.dice[index]));
		}
		return self.value[index];
	}
	
	return self;
};

function selectFromOdds(options)
{
	var total = 0;
	for(var i in options)
	{
		total+= options[i].odds;
		options[i].draw = total;
	}
	var roll = Math.random()*total;
	for(var i = 0;i<options.length;i++)
	{
		if(roll<options[i].draw)return options[i].value;
	}
}

function getStellarOrbitEccentricity(modifier)
{
	modifier = modifier?modifier:0;
	return Distribution(random.starEccentricty).get(dice(3)+modifier);
}
function getStellarOrbitDistance(modifier)
{
	modifier = modifier?modifier:0;
	return Distribution(random.starOrbitalDistance).get(dice(3)+modifier);
}

function starCount()
{
	//return 2;
	return Distribution(random.starCount).get(dice(3));
}

function starMass()
{
	return selectFromOdds(random.starMass);
}

function companionMass(primaryMass)
{
	var diceRemoved = dice()-1;
	var stepsRemoved = diceRemoved==0? 0:dice(diceRemoved);
	var massIndex = lookup.starSize.map(s => s.mass).indexOf(primaryMass);
	//console.log("companion mass", lookup.starSize[Math.max(0,massIndex-stepsRemoved)].mass)
	return lookup.starSize[Math.max(0,massIndex-stepsRemoved)].mass;
	
}

function starAge()
{
	var base = Distribution(random.starAge).get(dice(3));
	return base[0]*(dice()-1)+base[1]*(dice()-1)+base[2]*(dice()-1);
}

function generateStarPosition()
{
	//TODO: control x,y,z
	return [Math.random()*100,Math.random()*100,Math.random()*100];
}



var lookup = {};
var random = {};
random.starCount = [
	{start:3,end:10,value:1},
	{start:11,end:15,value:2},
	{start:16,end:24,value:3}
];

random.starAge = [
	{start:3,value:[0,0,0]},
	{start:4,end:6,value:[.1,.3,.05]},
	{start:7,end:10,value:[2,.6,.1]},
	{start:11,end:14,value:[5.6,.6,.1]},
	{start:15,end:17,value:[8,.6,.1]},
	{start:18,value:[10,.6,.1]},
];

random.starMass = [
	{value:2,odds:108},
	{value:1.9,odds:108},
	{value:1.8,odds:168},
	{value:1.7,odds:237},
	{value:1.6,odds:243},
	{value:1.5,odds:336},
	{value:1.45,odds:312},
	{value:1.4,odds:312},
	{value:1.35,odds:336},
	{value:1.3,odds:350},
	{value:1.25,odds:365},
	{value:1.2,odds:365},
	{value:1.15,odds:520},
	{value:1.1,odds:560},
	{value:1.05,odds:525},
	{value:1,odds:550},
	{value:.95,odds:550},
	{value:.9,odds:780},
	{value:.85,odds:840},
	{value:.8,odds:735},
	{value:.75,odds:770},
	{value:.7,odds:770},
	{value:.65,odds:1090},
	{value:.6,odds:1175},
	{value:.55,odds:1400},
	{value:.5,odds:1975},
	{value:.45,odds:2025},
	{value:.4,odds:1512},
	{value:.35,odds:2133},
	{value:.3,odds:2187},
	{value:.25,odds:5832},
	{value:.2,odds:5400},
	{value:.15,odds:4536},
	{value:.1,odds:7560}
];
lookup.starSize = [
	{mass:0.1,starclass:"M7",temp:3100,lmin:0.0012,lmax:0,mspan:0,sspan:0,gspan:0},
	{mass:0.15,starclass:"M6",temp:3200,lmin:0.0036,lmax:0,mspan:0,sspan:0,gspan:0},
	{mass:0.2,starclass:"M5",temp:3200,lmin:0.0079,lmax:0,mspan:0,sspan:0,gspan:0},
	{mass:0.25,starclass:"M4",temp:3300,lmin:0.015,lmax:0,mspan:0,sspan:0,gspan:0},
	{mass:0.3,starclass:"M4",temp:3300,lmin:0.024,lmax:0,mspan:0,sspan:0,gspan:0},
	{mass:0.35,starclass:"M3",temp:3400,lmin:0.037,lmax:0,mspan:0,sspan:0,gspan:0},
	{mass:0.4,starclass:"M2",temp:3500,lmin:0.054,lmax:0,mspan:0,sspan:0,gspan:0},
	{mass:0.45,starclass:"M1",temp:3600,lmin:0.07,lmax:0.08,mspan:70,sspan:0,gspan:0},
	{mass:0.5,starclass:"M0",temp:3800,lmin:0.09,lmax:0.11,mspan:59,sspan:0,gspan:0},
	{mass:0.55,starclass:"K8",temp:4000,lmin:0.11,lmax:0.15,mspan:50,sspan:0,gspan:0},
	{mass:0.6,starclass:"K6",temp:4200,lmin:0.13,lmax:0.2,mspan:42,sspan:0,gspan:0},
	{mass:0.65,starclass:"K5",temp:4400,lmin:0.15,lmax:0.25,mspan:37,sspan:0,gspan:0},
	{mass:0.7,starclass:"K4",temp:4600,lmin:0.19,lmax:0.35,mspan:30,sspan:0,gspan:0},
	{mass:0.75,starclass:"K2",temp:4900,lmin:0.23,lmax:0.48,mspan:24,sspan:0,gspan:0},
	{mass:0.8,starclass:"K0",temp:5200,lmin:0.28,lmax:0.65,mspan:20,sspan:0,gspan:0},
	{mass:0.85,starclass:"G8",temp:5400,lmin:0.36,lmax:0.84,mspan:17,sspan:0,gspan:0},
	{mass:0.9,starclass:"G6",temp:5500,lmin:0.45,lmax:1,mspan:14,sspan:0,gspan:0},
	{mass:0.95,starclass:"G4",temp:5700,lmin:0.56,lmax:1.3,mspan:12,sspan:1.8,gspan:1.1},
	{mass:1,starclass:"G2",temp:5800,lmin:0.68,lmax:1.6,mspan:10,sspan:1.6,gspan:1},
	{mass:1.05,starclass:"G1",temp:5900,lmin:0.87,lmax:1.9,mspan:8.8,sspan:1.4,gspan:0.8},
	{mass:1.1,starclass:"G0",temp:6000,lmin:1.1,lmax:2.2,mspan:7.7,sspan:1.2,gspan:0.7},
	{mass:1.15,starclass:"F9",temp:6100,lmin:1.4,lmax:2.6,mspan:6.7,sspan:1,gspan:0.6},
	{mass:1.2,starclass:"F8",temp:6300,lmin:1.7,lmax:3,mspan:5.9,sspan:0.9,gspan:0.6},
	{mass:1.25,starclass:"F7",temp:6400,lmin:2.1,lmax:3.5,mspan:5.2,sspan:0.8,gspan:0.5},
	{mass:1.3,starclass:"F6",temp:6500,lmin:2.5,lmax:3.9,mspan:4.6,sspan:0.7,gspan:0.4},
	{mass:1.35,starclass:"F5",temp:6600,lmin:3.1,lmax:4.5,mspan:4.1,sspan:0.6,gspan:0.4},
	{mass:1.4,starclass:"F4",temp:6700,lmin:3.7,lmax:5.1,mspan:3.7,sspan:0.6,gspan:0.4},
	{mass:1.45,starclass:"F3",temp:6900,lmin:4.3,lmax:5.7,mspan:3.3,sspan:0.5,gspan:0.3},
	{mass:1.5,starclass:"F2",temp:7000,lmin:5.1,lmax:6.5,mspan:3,sspan:0.5,gspan:0.3},
	{mass:1.6,starclass:"F0",temp:7300,lmin:6.7,lmax:8.2,mspan:2.5,sspan:0.4,gspan:0.2},
	{mass:1.7,starclass:"A9",temp:7500,lmin:8.6,lmax:10,mspan:2.1,sspan:0.3,gspan:0.2},
	{mass:1.8,starclass:"A7",temp:7800,lmin:11,lmax:13,mspan:1.8,sspan:0.3,gspan:0.2},
	{mass:1.9,starclass:"A6",temp:8000,lmin:13,lmax:16,mspan:1.5,sspan:0.2,gspan:0.1},
	{mass:2,starclass:"A5",temp:8200,lmin:16,lmax:20,mspan:1.3,sspan:0.2,gspan:0.1,}
];
lookup.planetSize = [
	{min:.000, max:.004},
	{min:.004, max:.024},
	{min:.024, max:.030},
	{min:.030, max:.065},
	{min:.065, max:.091}
]

random.coreDensity={};
random.coreDensity = [
	{start:3,end:6,value:.3},
	{start:7,end:10,value:.4},
	{start:11,end:14,value:.5},
	{start:15,end:17,value:.6},
	{start:18,value:.7}
];

random.starEccentricty = [
	{start:-10,end:3,value:0},
	{start:4,value:.1},
	{start:5,value:.2},
	{start:6,value:.3},
	{start:7,end:8,value:.4},
	{start:9,end:11,value:.5},
	{start:12,end:13,value:.6},
	{start:14,end:15,value:.7},
	{start:16,value:.8},
	{start:17,value:.9},
	{start:18,end:24,value:.95}
];

random.starOrbitalDistance = [
	{start:-10,end:6,value:.05},
	{start:7,end:9,value:.5},
	{start:10,end:11,value:2},
	{start:12,end:14,value:10},
	{start:15,end:24,value:50}
];

random.gasGiantArrangement = [
	{start:-10,end:10,value:"none"},
	{start:11,end:12,value:"conventional"},
	{start:13,end:14,value:"eccentric"},
	{start:15,end:26,value:"epistellar"}
];

random.planetSpacing = [
	{start:3,end:4,value:1.4},
	{start:5,end:6,value:1.5},
	{start:7,end:8,value:1.6},
	{start:9,end:12,value:1.7},
	{start:13,end:14,value:1.8},
	{start:15,end:16,value:1.9},
	{start:17,end:18,value:2.0},
];

random.terrestialPlanetSize = [
	{start:-10,end:3,value:-1},
	{start:4,end:6,value:0},
	{start:7,end:8,value:1},
	{start:9,end:11,value:2},
	{start:12,end:15,value:3},
	{start:16,end:30,value:4},
];

random.gasPlanetSize = [
	{start:-10,end:10,value:1},
	{start:11,end:16,value:2},
	{start:17,end:30,value:3}
];

random.marginalAtmosphereType = [
	{start:3,end:4,value:"Chlorine"},
	{start:5,end:6,value:"Sulfur Compounds"},
	{start:7,value:"Nitrogen Compounds"},
	{start:8,end:9,value:"Organic Toxins"},
	{start:10,end:11,value:"Low Oxygen"},
	{start:12,end:13,value:"Pollutants"},
	{start:14,value:"High CO2"},
	{start:15,end:16,value:"High Oxygen"},
	{start:17,end:18,value:"Inert Gases"}
];

