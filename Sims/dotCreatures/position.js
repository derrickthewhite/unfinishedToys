var Position = function (x,y)
{
	var position = {};
	position.x = x;
	position.y=y;
	position.hash = function (){
		return x+"|"+y;
	}
	return position;
}
var positionFromHash = function (hash)
{
	return {x:Number(hash.split("|")[0]),y:Number(hash.split("|")[1])};
}
var generatePositionChange = function(startingPosition,distance){
	var direction = Math.floor(Math.random()*4);// NESW -> 0123
	return Position(
		startingPosition.x+(direction%2*(direction-2))*distance,
		startingPosition.y+((direction+1)%2)*(1-direction)*distance
	);
}
var Distance = function (struct)
{
	var distance ={};
	if(typeof struct == "number") struct = {flatMove:struct};
	distance.type = ko.observable(struct.type?struct.type:"flat"); //none,flat,range
	distance.oldType = struct.type;
	distance.flatMove = ko.observable(struct.flatMove?struct.flatMove:1);
	distance.minValue = ko.observable(struct.minValue?struct.minValue:0);
	distance.maxValue = ko.observable(struct.maxValue?struct.maxValue:2);
	distance.distance = ko.observable(0);
	distance.generateDistance = function (){
		switch(distance.type())
		{
		case "none": distance.distance(0); break;
		case "flat": distance.distance(distance.flatMove());break;
		case "range": 
			if(distance.minValue()<0) distance.distance(0);
			if(distance.minValue() >= distance.maxValue()) distance.distance(distance.minValue());
			var possibleValues = Math.floor(distance.maxValue()-distance.minValue())+1;
			distance.distance(distance.minValue()+Math.floor(Math.random()*possibleValues));
			break;
		}
		return distance.distance();
	}
	distance.toStruct = function (){
		var result = {type:distance.type()};
		switch(distance.type())
		{
		case "none": break;
		case "flat": result.flatMove = distance.flatMove(); break;
		case "range": 
			result.minValue = distance.minValue();
			result.maxValue = distance.maxValue();
			break;
		}
		return result;
	}
	return distance;
}