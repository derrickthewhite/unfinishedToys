var graph = [
	[1,2,3],
	[0,5,8],
	[0,4,7],
	[0,6,9],
	[2,5,9],
	[1,4,6],
	[3,5,7],
	[2,6,8],
	[1,7,9],
	[3,8,4]
];
var names = [
	"Center",
	"Life",
	"Power",
	"Wealth",
	"Fire",
	"Blood",
	"Purple",
	"Water",
	"Plant",
	"Gold"
];



var interDistance =function(a,b)
{
	a = Number(a);
	b = Number(b);
	if(a>9 || a<0 || b>9 || b<0)return Math.Infinity;

	if(a==b)return 0;
	if(graph[a].indexOf(b)!=-1)return 1;

	return 2;
};

var petersenSteps = function (a,b){
	a = Number(a);
	b = Number(b);
	if(a>9 || a<0 || b>9 || b<0)throw "invalid graphPoints "+a+":"+b;

	if(graph[a].indexOf(b) != -1 || a==b) return [];
	else return [graph.indexOf(graph.filter(node=>node.indexOf(a)!=-1).filter(node=>node.indexOf(b)!=-1)[0])];
}

var switchesNeeded = function (a,b)
{
	var result = "";

	for(var i =0;i<10;i++)
	{
		if(a.charAt(i)!= b.charAt(i))result+=''+i;
		else result+='-';
	}

	console.log(result);
	return result;
};

var generatenextCrossing = function ()
{
	var result = "";

	for(var i =0;i<10;i++)
	{
		if(Math.random()*2>1)result+="0";
		else result+="1";
	}

	result+= Math.floor(Math.random()*10)+"";
	return result;
};

var routes = function (a,b,sortBy)
{
	sortBy=sortBy?sortBy:function (a){return a.gear.length}
	var changesToMake = switchesNeeded(a,b);
	var changesToMake = changesToMake.replace(/-/g,'');

	var routes = [];
	routes.push({position:a,togo:changesToMake,path:[a],distances:[0],jumps:0});

	for(var i = 0;i<=changesToMake.length;i++)
	{
		console.log(i+"/"+changesToMake.length,routes.length+" so far");
		var nextStep = [];
		for(var route of routes)
		{
			var launchPoint = route.position[route.position.length-1];
			if(i==changesToMake.length){
				if(b!=route.position){
					route.jumps +=interDistance(launchPoint,b[b.length-1]);
					route.path.push(b);
					route.distances.push(interDistance(launchPoint,b[b.length-1]));
					route.position = b;
				}
				nextStep.push(route);
			}
			for(var v in route.togo)
			{
				var nextCrossing = Number(route.togo[v]);
				var nextnextCrossing = route.position.substring(0,nextCrossing)
					+(Number(route.position[nextCrossing])?"0":"1")
					+route.position.substring(nextCrossing+1,route.position.length-1)
					+nextCrossing;
				var newPath = route.path.slice();
				var newDistances =route.distances.slice();
				//for(var p in route.path) newPath.push(route.path[p]);
				newPath.push(nextnextCrossing);
				newDistances.push(interDistance(launchPoint,nextCrossing)+1);
				var newToGo = route.togo.replace(route.togo[v],'');
				var distance = route.jumps+interDistance(launchPoint,nextCrossing)+1;
				nextStep.push({
					position: nextnextCrossing,
					path:newPath,
					distances:newDistances,
					togo:newToGo,
					jumps:distance
				});
			}
		}
		routes = nextStep;
	}
	routes.forEach(route=>{
		route.fullPath =[route.path[0]];
		for(var i=1;i<route.path.length;i++){
			var aPetersen = route.path[i-1][route.path[i-1].length-1]
			var bPetersen = route.path[i][route.path[i].length-1]
			var middleSteps = petersenSteps(
				aPetersen,
				bPetersen
			)
			for(var n in middleSteps)
				route.fullPath.push(route.path[i-1].slice(0,-1)+n);
			if(aPetersen!=bPetersen)route.fullPath.push(route.path[i-1].slice(0,-1)+bPetersen);
			if(route.path[i]!=route.fullPath[route.fullPath.length-1])route.fullPath.push(route.path[i]);
		}
	});
	routes.forEach(route=>{
		route.gear = route.fullPath.map(world => gearRequired(getWorld(world)))
			.reduce((a,b)=>a.concat(b))
			.filter((a,index,list)=> list.indexOf(a)==index);
	});
	
	var sortedRoutes = [];
	routes.forEach(route=>{
			value = sortBy(route);
			if(!sortedRoutes[value])
				sortedRoutes[value]=[];
			sortedRoutes[value].push(route)
		});
	routes = sortedRoutes.reduce((out,a)=>{
		return out.concat(a?a:[])
	},[]);
	//routes.sort((a,b)=> b.jumps>a.jumps?-1:1); //overkill: takes way too long on 9 and 10 distance
	return routes.slice();
};
var allHyperCoords = function (soFar,toGo){
	if(toGo==0)return soFar;
	return allHyperCoords(soFar.map(a=>[a+"1",a+"0"]).reduce((a,b)=>a.concat(b)),toGo-1);
}
var allCoords = function (){
	return allHyperCoords([""],10).map(a=>graph.map((connections,index)=>a+index)).reduce((a,b)=>a.concat(b));
}
Survey = function (){
	var worlds = allCoords().map(c=>getWorld(c));
	console.log(worlds.reduce((out,a)=>{out[a.gear.length]=out[a.gear.length]?out[a.gear.length]+1:1; return out;},[]));
	console.log(worlds.map(a=>a.gear.sort().reduce((out,a)=>out+" "+a,"")).reduce((out,a)=>{out[a]=out[a]?out[a]+1:1; return out;},[]));
	
}