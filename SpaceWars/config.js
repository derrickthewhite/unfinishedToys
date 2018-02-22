
var roundingTolerance = 1000;
var config = {
	map:{
		x:20,
		y:10,
		scale:40
	},
	factions:[
		{
			"name": "English",
			"color": "#008800",
			"units":[
				{type:"infantry", name:"Conscripts",power:10,cost:10},
				{type:"ship", name:"Carrier",power:10,speed:2,cost:10},
				{type:"transport",name:"transport",speed:2,cost:5}
			]
		},
		{
			"name": "Chinese",
			"color": "#880000",
			"units":[
				{type:"infantry",power:10,cost:10},
				{type:"ship",power:10,speed:2,cost:10},
				{type:"transport",speed:2,cost:5}
			]
		},
		{
			"name": "Galactic Empire",
			"color": "#008800",
			"units":[
				{type:"infantry",power:5,cost:3},
				{type:"ship",power:10,speed:15,cost:12},
				{type:"transport",speed:15,cost:6}
			]
		},
		{
			"name": "Machine Collective",
			"color": "#008800",
			"units":[
				{type:"infantry",power:20,cost:30},
				{type:"ship",power:12,speed:12,cost:12},
				{type:"transport",speed:12,cost:6}
			]
		}
	]
};

function initConfig(){
	config.factionByName = [];
	for(var faction of config.factions){
		config.factionByName[faction.name]=faction;
		for(var unit of faction.units)
			if(!unit.name)unit.name = faction.name+" "+unit.type;
	}
}