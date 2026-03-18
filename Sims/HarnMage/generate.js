function RollTheDice(dice, sides) {
	var result = 0;
	for(var die = 0; die< dice; die++) {
		var dieRoll = Math.floor(Math.random()*sides)+1;
		result+=dieRoll;
	}
	return result;
}

function expandingRoll() {
	var dieRoll;
	var result = 0;
	do{
		var dieRoll = Math.floor(Math.random()*6)+1;
		result+=dieRoll;
	}while (dieRoll == 6)
	return result;
}

function getHouseholdHead() {
	var roll = RollTheDice(1,100);
	var result = 0;
	if(roll <= 60) return "Both Parents Alive and living together";
	if(roll <= 70) return "Father Absent, Wardship";
	if(roll <= 75) return "Mother Absent";
	if(roll <= 80) return "Father Dead, Wardship";
	if(roll <= 85) return "Father Dead, Mother remarried";
	if(roll <= 90) return "Mother Dead";
	return "Mother Dead, Father remarried"
}

function getStat() {
	return 7 + Math.floor(RollTheDice(2,6) /2)
}

function getGender() {
	return Math.random() > .49 ? "Female" : "Male";
}

function getMageryValues (premageryZeroMode) {
	var populationDivisor = premageryZeroMode? 111 : 1111;
	var mageryLevel = RollTheDice(1, populationDivisor);
	return mageryLevel <= 1? 3: mageryLevel<=11? 2 : mageryLevel<= 111? 1: 0;
}

function handleSpread(spread) {
	var spreadTotal = spread.map(i=>i.weight).reduce((a,b)=> a+b);
	var selection = RollTheDice(1, spreadTotal);
	var soFar = 0;
	for(var item of spread) {
		if(soFar + item.weight >= selection) return item.value;
		soFar+=item.weight;
	}
	throw Error("rolled "+selection+" out of " + spreadTotal + " but reached" +soFar );
}
var config = {};
config.ageSpread = [
	{value: 0, weight: 25},
	{value: 1, weight: 24},
	{value: 2, weight: 23},
	{value: 3, weight: 22},
	{value: 4, weight: 21},
	{value: 5, weight: 21},
	{value: 6, weight: 20},
	{value: 7, weight: 20},
	{value: 8, weight: 20},
	{value: 9, weight: 20},
	{value: 10, weight: 20},
	{value: 11, weight: 19},
	{value: 12, weight: 19},
	{value: 13, weight: 19},
	{value: 14, weight: 19},
	{value: 15, weight: 19},
	{value: 16, weight: 18},
	{value: 17, weight: 18},
	{value: 18, weight: 18},
	{value: 19, weight: 18},
	{value: 20, weight: 18},
	{value: 21, weight: 17},
	{value: 22, weight: 17},
	{value: 23, weight: 17},
	{value: 24, weight: 17},
	{value: 25, weight: 17},
	
	{value: 26, weight: 16},
	{value: 27, weight: 16},
	{value: 28, weight: 16},
	{value: 29, weight: 16},
	
	{value: 30, weight: 15},
	{value: 31, weight: 15},
	{value: 32, weight: 15},
	{value: 33, weight: 15},
	
	{value: 34, weight: 14},
	{value: 35, weight: 14},
	{value: 36, weight: 14},
	{value: 37, weight: 14},
	
	{value: 38, weight: 13},
	{value: 39, weight: 13},
	{value: 40, weight: 13},
	{value: 41, weight: 13},
	{value: 42, weight: 13},
	
	{value: 42, weight: 12},
	{value: 43, weight: 12},
	{value: 44, weight: 12},
	{value: 45, weight: 12},
	
	{value: 46, weight: 11},
	{value: 47, weight: 11},
	{value: 48, weight: 11},
	{value: 49, weight: 11},
	
	{value: 50, weight: 10},
	{value: 51, weight: 10},
	{value: 52, weight: 10},
	{value: 53, weight: 10},
	
	{value: 54, weight: 9},
	{value: 55, weight: 9},
	{value: 56, weight: 9},
	
	{value: 57, weight: 8},
	{value: 58, weight: 8},
	{value: 59, weight: 8},
	{value: 60, weight: 8},
	
	{value: 61, weight: 7},
	{value: 62, weight: 7},
	
	{value: 63, weight: 6},
	{value: 64, weight: 6},
	{value: 65, weight: 6},
	
	{value: 66, weight: 5},
	{value: 67, weight: 5},
	
	{value: 68, weight: 4},
	{value: 69, weight: 4},
	
	{value: 70, weight: 3},
	{value: 71, weight: 3},
	
	{value: 72, weight: 2},
	{value: 73, weight: 2},
	{value: 74, weight: 2},
	
	{value: 75, weight: 1},
	{value: 76, weight: 1},
	{value: 77, weight: 1},
	{value: 78, weight: 1},
	{value: 79, weight: 1},
	{value: 80, weight: 1}
]

config.deathDate = [
	{"weight":320,"value":0},
	{"weight":27,"value":1},
	{"weight":26,"value":2},
	{"weight":19,"value":3},
	{"weight":18,"value":4},
	{"weight":12,"value":5},
	{"weight":12,"value":6},
	{"weight":6,"value":7},
	{"weight":6,"value":8},
	{"weight":6,"value":9},
	{"weight":5,"value":10},
	{"weight":5,"value":11},
	{"weight":5,"value":12},
	{"weight":15,"value":13},
	{"weight":5,"value":14},
	{"weight":6,"value":15},
	{"weight":5,"value":16},
	{"weight":5,"value":17},
	{"weight":6,"value":18},
	{"weight":6,"value":19},
	{"weight":6,"value":20},
	{"weight":5,"value":21},
	{"weight":6,"value":22},
	{"weight":6,"value":23},
	{"weight":7,"value":24},
	{"weight":6,"value":25},
	{"weight":6,"value":26},
	{"weight":6,"value":27},
	{"weight":7,"value":28},
	{"weight":6,"value":29},
	{"weight":7,"value":30},
	{"weight":6,"value":31},
	{"weight":7,"value":32},
	{"weight":6,"value":33},
	{"weight":7,"value":34},
	{"weight":7,"value":35},
	{"weight":7,"value":36},
	{"weight":6,"value":37},
	{"weight":7,"value":38},
	{"weight":7,"value":39},
	{"weight":6,"value":40},
	{"weight":7,"value":41},
	{"weight":7,"value":42},
	{"weight":6,"value":43},
	{"weight":7,"value":44},
	{"weight":7,"value":45},
	{"weight":7,"value":46},
	{"weight":8,"value":47},
	{"weight":7,"value":48},
	{"weight":8,"value":49},
	{"weight":8,"value":50},
	{"weight":7,"value":51},
	{"weight":8,"value":52},
	{"weight":8,"value":53},
	{"weight":8,"value":54},
	{"weight":8,"value":55},
	{"weight":8,"value":56},
	{"weight":8,"value":57},
	{"weight":8,"value":58},
	{"weight":8,"value":59},
	{"weight":9,"value":60},
	{"weight":9,"value":61},
	{"weight":10,"value":62},
	{"weight":11,"value":63},
	{"weight":10,"value":64},
	{"weight":12,"value":65},
	{"weight":13,"value":66},
	{"weight":13,"value":67},
	{"weight":13,"value":68},
	{"weight":13,"value":69},
	{"weight":12,"value":70},
	{"weight":12,"value":71},
	{"weight":12,"value":72},
	{"weight":10,"value":73},
	{"weight":10,"value":74},
	{"weight":8,"value":75},
	{"weight":7,"value":76},
	{"weight":7,"value":77},
	{"weight":5,"value":78},
	{"weight":5,"value":79},
	{"weight":4,"value":80},
	{"weight":3,"value":81},
	{"weight":3,"value":82},
	{"weight":2,"value":83},
	{"weight":2,"value":84},
	{"weight":1,"value":85},
	{"weight":1,"value":86}
];

config.motherAge = [
	{"weight":7,"value":15},
	{"weight":14,"value":16},
	{"weight":22,"value":17},
	{"weight":29,"value":18},
	{"weight":36,"value":19},
	{"weight":43,"value":20},
	{"weight":47,"value":21},
	{"weight":49,"value":22},
	{"weight":53,"value":23},
	{"weight":56,"value":24},
	{"weight":56,"value":25},
	{"weight":54,"value":26},
	{"weight":50,"value":27},
	{"weight":48,"value":28},
	{"weight":46,"value":29},
	{"weight":43,"value":30},
	{"weight":40,"value":31},
	{"weight":38,"value":32},
	{"weight":35,"value":33},
	{"weight":33,"value":34},
	{"weight":30,"value":35},
	{"weight":27,"value":36},
	{"weight":24,"value":37},
	{"weight":21,"value":38},
	{"weight":18,"value":39},
	{"weight":16,"value":40},
	{"weight":14,"value":41},
	{"weight":12,"value":42},
	{"weight":10,"value":43},
	{"weight":7,"value":44},
	{"weight":6,"value":45},
	{"weight":5,"value":46},
	{"weight":4,"value":47},
	{"weight":3,"value":48},
	{"weight":2,"value":49},
	{"weight":2,"value":50}
];

config.infertility = [
	{"weight":9,"value":15},
	{"weight":9,"value":16},
	{"weight":9,"value":17},
	{"weight":9,"value":18},
	{"weight":9,"value":19},
	{"weight":9,"value":20},
	{"weight":9,"value":21},
	{"weight":9,"value":22},
	{"weight":9,"value":23},
	{"weight":9,"value":24},
	{"weight":9,"value":25},
	{"weight":9,"value":26},
	{"weight":9,"value":27},
	{"weight":9,"value":28},
	{"weight":9,"value":29},
	{"weight":9,"value":30},
	{"weight":9,"value":31},
	{"weight":9,"value":32},
	{"weight":9,"value":33},
	{"weight":9,"value":34},
	{"weight":9,"value":35},
	{"weight":9,"value":36},
	{"weight":9,"value":37},
	{"weight":9,"value":38},
	{"weight":14,"value":39},
	{"weight":24,"value":40},
	{"weight":29,"value":41},
	{"weight":36,"value":42},
	{"weight":41,"value":43},
	{"weight":45,"value":44},
	{"weight":59,"value":45},
	{"weight":64,"value":46},
	{"weight":66,"value":47},
	{"weight":65,"value":48},
	{"weight":68,"value":49},
	{"weight":69,"value":50},
	{"weight":61,"value":51},
	{"weight":50,"value":52},
	{"weight":37,"value":53},
	{"weight":28,"value":54},
	{"weight":28,"value":55}
]

config.tenantClass = [
	{weight: 10, value: "Craftsman"},
	{weight: 15, value: "Farmer"},
	{weight: 35, value: "Villein"},
	{weight: 20, value: "Half-Villein"},
	{weight: 20, value: "Cottar"},
]

config.craftsman = [
	{weight: 25, value: {title: "Miller", fee: 240}},
	{weight: 20, value: {title:"Metalsmith", fee: 144}},
	{weight: 15, value: {title:"Woodcrafter", fee: 120}},
	{weight: 10, value: {title:"Salter", fee: 120}},
	{weight: 5, value: {title:"Hideworker", fee: 144}},
	{weight: 5, value: {title:"Timberwright", fee: 216}},
	{weight: 5, value: {title:"Charcoaler", fee: 180}},
	{weight: 5, value: {title:"Shipwright", fee: 144}},
	{weight: 5, value: {title:"Innkeeper", fee: 216}},
	{weight: 1, value: {title:"Extra5", fee: 216}},
	{weight: 1, value: {title:"Extra", fee: 216}},
	{weight: 1, value: {title:"Extra2", fee: 216}},
	{weight: 1, value: {title:"Extra3", fee: 216}},
	{weight: 1, value: {title:"Extra4", fee: 216}},
];

config.yeoman = [
	{weight: 50, value: "Light Foot"},
	{weight: 20, value: "Medium Foot"},
	{weight: 20, value: "Longbow"},
	{weight: 10, value: "Light Horse"},
]

function getAge () {
	return handleSpread(config.ageSpread);
}
function getInfertilityAge () {
	handleSpread(config.infertility);
}
function getBirthAge() {
	handleSpread(config.motherAge);
}
function getLifeSpan() {
	handleSpread(config.deathDate);
}
