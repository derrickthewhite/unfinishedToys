var nextFleetID=1000;
function Fleet(owner,units,status)
{
	var fleet = {};
	fleet.id = nextFleetID++;
	fleet.units = ko.observableArray(units?units:[]);
	fleet.owner = ko.observable(owner);
	fleet.status = ko.observable(status); // Space,Land -- not fully implemented
	fleet.attackPriority = ko.observable("defend"); //defend OR factionName
	
	fleet.speed = ko.pureComputed(function (){
		return fleet.units().reduce((sofar,a) => Math.min(sofar,a.type.speed?a.type.speed:Number.POSITIVE_INFINITY),Number.POSITIVE_INFINITY);
	});
	//TODO: factor these!
	fleet.sum = function (attribute,filter){
		var result = {
			attribute:attribute,
			filter:filter,
			func: function (){
				return Math.round(fleet.units().reduce((sofar,a)=> sofar+(a.type.type == filter?a[attribute]():0),0));
			}
		};
		return result.func;
	}

	fleet.power = ko.pureComputed(fleet.sum("power","ship"));
	fleet.capacity = ko.pureComputed(fleet.sum("count","transport"));
	fleet.troops = ko.pureComputed(fleet.sum("count","infantry"));
	fleet.troopPower = ko.pureComputed(fleet.sum("power","infantry"));
	/*
	fleet.power = ko.pureComputed(function (){
		return Math.round(fleet.units().reduce((sofar,a)=> sofar+(a.type.type=="ship"?a.power():0),0));
	});
	fleet.capacity = ko.pureComputed(function (){
		return Math.round(fleet.units().reduce((sofar,a)=> sofar+(a.type.type=="transport"?a.count():0),0));
	});
	fleet.troops = ko.pureComputed(function (){
		return Math.round(fleet.units().reduce((sofar,a)=> sofar+(a.type.type=="infantry"?a.count():0),0));
	});
	fleet.troopPower = ko.pureComputed(function (){
		return Math.round(fleet.units().reduce((sofar,a)=> sofar+(a.type.type=="infantry"?a.power():0),0));
	});
	//*/
	fleet.empty = ko.pureComputed(function (){
		return fleet.units().reduce((sofar,unit) => unit.count()+sofar,0)==0;
	});
	
	fleet.infoString = ko.computed(function() {
		var infantry=0;
		var ships=0;
		var transports=0;
		for(var unit of fleet.units()){
			//TODO: maybe not do all this checking here.
			if(unit.type.type == 'infantry')infantry+=unit.power();
			if(unit.type.type == 'ship')ships+=unit.power();
			if(unit.type.type == 'transport')transports+=unit.count();
		}
		if(root.view && root.view.drawMode)
			root.view.draw(); //TODO: Find best way to trigger a draw, make it not fail if there is no view!
		return infantry+" "+ships+" "+transports;
	});
	
	fleet.takeCausulties = function(type, survivalRatio){
		survivalRatio=Math.max(0,survivalRatio);
		fleet.units().forEach(unit => {if(unit.type.type == type) unit.count(Math.round(unit.count()*survivalRatio*roundingTolerance)/roundingTolerance)});
	}

	return fleet;
}
function unitType(type,culture,power,speed,cost)
{
	var type = {};
	type.type = type; //TODO: Differentiate between troop role and combat type
	type.speed = speed;
	type.culture= culture;
	type.power = power;
	type.cost = cost;
	return type;
}
function Unit(type, owner, count)
{
	var unit = {};
	unit.type = type;
	unit.owner = owner;
	unit.count = ko.observable(count);
	unit.power = ko.pureComputed(function (){
		return unit.count()*unit.type.power;
	});
	unit.copy = function (){
		return Unit(unit.type,unit.owner,unit.count());
	}
	return unit;
}

function MovingFleet(fleet,position,destination)
{
	var mf = {};
	mf.position = {};
	mf.position.x = ko.observable(position.x);
	mf.position.y = ko.observable(position.y);
	mf.fleet = fleet;
	mf.destination={};
	mf.destination.x = ko.observable(destination.x);
	mf.destination.y = ko.observable(destination.y);
	
	mf.move = function (){
		distanceLeft = Math.sqrt(
			Math.pow(mf.position.x()-mf.destination.x(),2)
			+Math.pow(mf.position.y()-mf.destination.y(),2));
		if(distanceLeft < mf.fleet.speed())
			mf.position=mf.destination;
		else{
			var dx = mf.fleet.speed()*(mf.destination.x()-mf.position.x())/distanceLeft
			var dy = mf.fleet.speed()*(mf.destination.y()-mf.position.y())/distanceLeft
			mf.position.x(mf.position.x()+dx);
			mf.position.y(mf.position.y()+dy);
		}
	}

	return mf;
}

//TODO: require carriers for troops
function Order(owner,fleet,origin,destination)
{
	var order = {};
	order.owner = owner;
	order.fleet = fleet;
	order.origin = origin;
	order.destination = destination;
	order.midpoint = {
		x:order.origin.position.x/2+order.destination.x/2,
		y:order.origin.position.y/2+order.destination.y/2
	};
	return order;
}