var roll = function(dice)
{
	if(!dice)return Math.floor(Math.random()*6)+1;
	var total = 0;
	for(var i = 0;i<dice;i++)
		total+=roll();
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
			return new Distribution(self.subDistro[index]).get(roll(self.dice[index]));
		}
		return self.value[index];
	}
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
	return new Distribution(tabels.starEccentricty).get(dice(3)+modifier);
}

function starCount()
{
	return new Distribution(tables.starCount).get(dice(3));
}

function starMass()
{
	return selectFromOdds(tables.starMass);
}

function starAge()
{
	var base = new Distribution(tables.starAge).get(dice(3));
	return base[0]*(roll()-1)+base[1]*(roll()-1)+base[2]*(roll()-1);
}

var getStarSize = function (mass){
	for(var i in tables.starSize)
		if(tables.starSize[i]==mass) 
		{
			var base = tabels.starSize[i];
			var result = {};
			result.mass= mass;
			result.lmin = base[3];
			result.lmax = base[4];
			result.mspan = base[5];
			result.sspan = base[6];
			result.gspan = base[7];
			result.spectralType = base[8];
			return result;
		}
}

var getStarStage = function (age, mass)
{
	var size = getStarSize(mass);
	if(size.mspan==0 || size.mspan> age) return "main";
	if(size.sspan == 0) return "white dwarf";
	if(size.sspan==0 || size.mspan+size.sspan > age) return "subgiant";
	if(size.mspan+size.sspan+size.gspan > age) return "giant";
	return "white dwarf";
	
}

var getStarLum(age,mass)
{
	var size = getStarSize(mass);
	if(size[3]== 0) return size[2];
	var stage = getStarStage(age,mass);
	
	if(stage == main)
		return size.lmin + (size.lmax-size.lmin)*(age/size.mspan);
	if(stage == "dwhite dwarf") return .0005;
	if(stage == 'subgiant') return size.lmax;
	if (starge == 'giant') reurn size.lmax*25;
}


var tables = {};
tables.starCount = [
	{start:3,end:10,value:1},
	{start:11,end:15,value:2},
	{start:16,end:24,value:3}
];

tables.starAge = [
	{start:3,value:[0,0,0]},
	{start:4,end:6,value:[.1,.3,.05]},
	{start:7,end:10,value:[2,.6,.1]},
	{start:11,end:14,value:[5.6,.6,.1]},
	{start:15,end:17,value:[8,.6,.1]},
	{start:18,value:[10,.6,.1]},
];

tables.starMass = [
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
	{value:9,odds:780},
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

tables.starSize = [
	{0.10,"M7",3100,0.0012,0,0,0,0},
	{0.15,"M6",3200,0.0036,0,0,0,0},
	{0.20,"M5",3200,0.0079,0,0,0,0},
	{0.25,"M4",3300,0.015,0,0,0,0},
	{0.30,"M4",3300,0.024,0,0,0,0},
	{0.35,"M3",3400,0.037,0,0,0,0},
	{0.40,"M2",3500,0.054,0,0,0,0},
	{0.45,"M1",3600,0.07,0.08,70,0,0},
	{0.50,"M0",3800,0.09,0.11,59,0,0},
	{0.55,"K8",4000,0.11,0.15,50,0,0},
	{0.60,"K6",4200,0.13,0.20,42,0,0},
	{0.65,"K5",4400,0.15,0.25,37,0,0},
	{0.70,"K4",4600,0.19,0.35,30,0,0},
	{0.75,"K2",4900,0.23,0.48,24,0,0},
	{0.80,"K0",5200,0.28,0.65,20,0,0},
	{0.85,"G8",5400,0.36,0.84,17,0,0},
	{0.90,"G6",5500,0.45,1.0,14,0,0},
	{0.95,'G4',5700,0.56,1.3,12,1.8,1.1},
	{1.00,'G2',5800,0.68,1.6,10,1.6,1.0},
	{1.05,'G1',5900,0.87,1.9,8.8,1.4,0.8},
	{1.10,'G0',6000,1.1,2.2,7.7,1.2,0.7},
	{1.15,'F9',6100,1.4,2.6,6.7,1.0,0.6},
	{1.20,'F8',6300,1.7,3.0,5.9,0.9,0.6},
	{1.25,'F7',6400,2.1,3.5,5.2,0.8,0.5},
	{1.30,'F6',6500,2.5,3.9,4.6,0.7,0.4},
	{1.35,'F5',6600,3.1,4.5,4.1,0.6,0.4},
	{1.40,'F4',6700,3.7,5.1,3.7,0.6,0.4},
	{1.45,'F3',6900,4.3,5.7,3.3,0.5,0.3},
	{1.50,'F2',7000,5.1,6.5,3.0,0.5,0.3},
	{1.60,'F0',7300,6.7,8.2,2.5,0.4,0.2},
	{1.70,'A9',7500,8.6,10,2.1,0.3,0.2},
	{1.80,'A7',7800,11,13,1.8,0.3,0.2},
	{1.90,'A6',8000,13,16,1.5,0.2,0.1},
	{2.00,'A5',8200,16,20,1.3,0.2,0.1}
];

tabels.starEccentricty = [
	{start:-10,end:3,value:0},
	{start:4,value:.1},
	{start:5,value:.2},
	{start:6,value:.3},
	{start:7,end:8,value:.4},
	{start:9,end:11,value:.5},
	{start:12,end:13,value:.6},
	{start:14,end:15,value:.7},
	{start:16,value:.8}
	{start:17,value:.9}
	{start:16,end:24,value:.95}
]

