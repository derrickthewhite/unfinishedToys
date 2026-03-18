function randomGausian(average,dev)
{
	var u = 0, v = 0;
	while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
	while(v === 0) v = Math.random();
	var r = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
	return average+r*dev;
}

function exploreGuassian(power,average,dev){
	var list = [];
	for(var i = 0;i<100;i++) list.push(Math.pow(power,randomGausian(average,dev)));
	list.sort((a,b)=> a<b?-1:1);
	return list;
}