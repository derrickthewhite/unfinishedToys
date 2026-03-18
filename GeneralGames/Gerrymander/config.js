var config = {};
config.numPlayers = 6;
config.playerNames = ["Adam","Brittany","Chelsea","Derrick","Eli","Frank","Gary","Heather","Ivalou","James","Krystal"]
config.numParties = 4;
config.partyNames = ["up","down","strange","charmed","practical","noble","vision","wild"];
config.partyIcons = ["diamond.svg","circle.svg","spiral.svg","star.svg","bars.svg","cross.svg","widget.svg","galaxy.svg"];
var nextName = 0;
config.constitNames = ["Inner","Outer","Upper","Lower","Hither","Yonder"];
var adjacents = [
	[-1,0],
	[1,0],
	[0,-1],
	[0,1],
]
var constits = [
	{name:"North-West", color:"#008000",blocks:
		[
			[0,0],
			[1,0],
			[2,0],
			[0,1],
			[1,1],
			[2,1],
			[0,2],
			[1,2],
			[0,3],
			[1,3],
		]
	},
	{name:"North", color:"#008080",blocks:
		[
			[3,0],
			[4,0],
			[5,0],
			[6,0],
			[3,1],
			[4,1],
			[5,1],
			[6,1],
			[4,2],
			[5,2],
		]
	},
	{name:"North-East", color:"#800000",blocks:
		[
			[7,0],
			[8,0],
			[9,0],
			[7,1],
			[8,1],
			[9,1],
			[8,2],
			[9,2],
			[8,3],
			[9,3],
		]
	},
	{name:"West", color:"#808000",blocks:
		[
			[2,2],
			[3,2],
			[2,3],
			[3,3],
			[0,4],
			[1,4],
			[2,4],
			[0,5],
			[1,5],
			[2,5],
		]
	},
	{name:"South", color:"#808080",blocks:
		[
			[4,7],
			[5,7],
			[3,8],
			[4,8],
			[5,8],
			[6,8],
			[3,9],
			[4,9],
			[5,9],
			[6,9],
		]
	},
	{name:"South-West", color:"#0000ff",blocks:
		[
			[0,6],
			[1,6],
			[0,7],
			[1,7],
			[0,8],
			[1,8],
			[2,8],
			[0,9],
			[1,9],
			[2,9],
		]
	},
	{name:"South-East", color:"#00ff00",blocks:
		[
			[8,6],
			[9,6],
			[8,7],
			[9,7],
			[7,8],
			[8,8],
			[9,8],
			[7,9],
			[8,9],
			[9,9],
		]
	},
	{name:"East", color:"#00ffff",blocks:
		[
			[6,2],
			[7,2],
			[6,3],
			[7,3],
			[7,4],
			[8,4],
			[9,4],
			[7,5],
			[8,5],
			[9,5],
		]
	},
	{name:"West-Central", color:"#cccccc",blocks:
		[
			[4,3],
			[3,4],
			[4,4],
			[3,5],
			[4,5],
			[2,6],
			[3,6],
			[4,6],
			[2,7],
			[3,7],
		]
	},
	{name:"East-Central", color:"#800080",blocks:
		[
			[5,3],
			[5,4],
			[6,4],
			[5,5],
			[6,5],
			[5,6],
			[6,6],
			[7,6],
			[6,7],
			[7,7],
		]
	}
];
