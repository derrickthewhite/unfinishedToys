function randomLocation (){
	var lon = Math.random()*Math.PI*2;
	var lat = Math.asin(Math.random()*2-1);
	return {lon:lon,lat:lat};
}
function distance(a,b){
	return Math.acos(Math.sin(a.lat)*Math.sin(b.lat)+Math.cos(a.lat)*Math.cos(b.lat)*Math.cos(Math.abs(a.lon-b.lon)));
}
function averageAngle(n){
	var runs = [];
	for(var i =0;i<n;i++){
		runs.push(distance(randomLocation(),randomLocation())*180/Math.PI);
	}
	console.log(runs.reduce((a,b)=>a+b)/n);
}