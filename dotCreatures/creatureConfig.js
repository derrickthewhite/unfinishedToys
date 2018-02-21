var creatureConfig = [
	{
		name:"plant",
		color:"#00ff00",
		growth: 20,
		upkeep: 10,
		move: {type:'none'},
		startingStorage:10,
		reproductionPoint:50,
		reproductionCost:25,
		consumes: [],
		displayOrder:0
	},
	{
		name:"flower",
		color:"#88ff88",
		growth: 20,
		upkeep: 10,
		move: {type:'none'},
		startingStorage:10,
		reproductionPoint:80,
		reproductionCost:55,
		reproductiveScatter:{type:'range',minValue:1,maxValue:4},
		consumes: [],
		displayOrder:0
	},
	{
		name:"cactus",
		color:"#44ff00",
		growth: 10,
		upkeep: 8,
		move: {type:'none'},
		startingStorage:10,
		reproductionPoint:50,
		reproductionCost:40,
		consumes: [],
		displayOrder:0
	},
	{
		name:"grazer",
		color:"#aaaa00",
		upkeep: 20,
		move: {type:'flat', flatMove:2},
		startingStorage:20,
		reproductionPoint:300,
		reproductionCost:100,
		consumes: [{name:"plant",effeciency:70},{name:"flower",effeciency:70}],
		displayOrder:5
	},
	{
		name:"lazy grazer",
		color:"#888800",
		upkeep: 8,
		move: 1,
		startingStorage:8,
		reproductionPoint:500,
		reproductionCost:30,
		consumes: [{name:"plant",effeciency:70},{name:"flower",effeciency:70},{name:"cactus",effeciency:70}],
		displayOrder:5
	},
	{
		name:"carnivore",
		color:"#aa3333",
		upkeep: 10,
		move: {type:'flat',flatMove:4},
		startingStorage:50,
		reproductionPoint:1000,
		reproductionCost:100,
		consumes: [{name:"grazer",effeciency:52},{name:"lazy grazer",effeciency:50}],
		displayOrder:10
	}
];
