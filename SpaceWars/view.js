function View(game,activePlayer){
	var view = {};

	view.owner = function (){return view.activePlayer()};
	view.playerType = "VIEW";
	
	view.drawMode = false;
	view.moveMode = false; //TODO: don't allow changes when move mode is false!
	view.currentPlanet= ko.observable();
	view.currentMovingFleet = ko.observable(); //a fleet in deep space -- not a fleet object!
	view.currentOrder= ko.observable(); 
	view.activeFleet = ko.observable(); //the fleet that orders are given too. 
	view.workingFleet= Fleet("",[],"Ground"); //working Fleet is used to create orders
	view.workingProduction = ko.observable();
	view.activePlayer= ko.observable();
	view.viewMode = ko.observable("planet"); //planet, fleet, order
	view.clickMode = ko.observable("display"); //display, destination
	view.activePlayer(activePlayer);

	view.planetProductionOptions = ko.pureComputed(function (){
		if(!view.currentPlanet())return [];
		return view.currentPlanet().culture.units.concat({name:"peace"}); //TODO: better empty unit placeholder
	});
	view.planetProductionChange = ko.pureComputed(function (){
		if(!view.currentPlanet()) return {name:"peace"};
		return game.productionChanges().filter( change => change.planet == view.currentPlanet()).map(change => change.production)[0]
			|| {name:"peace"};
	});
	view.events = {};
	view.setDestination = function (){
		view.clickMode("destination");
	}
	view.sendAll = function (){
		if(!view.activeFleet())return; //TODO: tell player there is no active fleet?
		for(var i = 0;i<view.activeFleet().units().length;i++){
			view.workingFleet.units()[i].count(view.activeFleet().units()[i].count());
		}
		view.clickMode("destination"); //TODO: indicate click mode on screen
	}
	var setActiveFleet = function (fleet){
		if(!fleet || fleet.owner()!=view.activePlayer())fleet = undefined;
		view.activeFleet(fleet);
		if(!fleet || fleet.owner()!=view.activePlayer())view.workingFleet.units([]);
		else view.workingFleet.units(fleet.units().map(a=>Unit(a.type,a.owner,0)));
	}
	view.events.systemClick= function (planet){ 
		//TODO: more than just that first fleet: either select individually or set all fleets
		setActiveFleet(planet.fleets().filter(a=>a.owner()==view.activePlayer())[0]); 
		view.viewMode("planet");
		view.currentPlanet(planet);
	}
	view.events.fleetClick = function (fleet){
		setActiveFleet(fleet.fleet); 
		view.currentMovingFleet(fleet);
		view.viewMode("fleet");
	}
	view.events.orderClick = function (order){
		setActiveFleet(order.fleet);
		view.currentOrder(order);
		view.viewMode("order");
	}
	view.setProductionForAllMyPlanets = function (){
		var productionChanges = [];
		for(var planet of game.galaxy()){
			if(planet.owner() == view.activePlayer() && planet.culture.units.indexOf(view.workingProduction())!=-1)
				game.addProductionChanges(ProductionChange(planet,view.workingProduction()));
		}
		game.addProductionChanges(productionChanges);
		view.draw();
	}
	view.setProductionForCurrentPlanet = function (){
		if(view.currentPlanet().owner() == view.activePlayer())
		{
			game.addProductionChanges(ProductionChange(view.currentPlanet(),view.workingProduction()));
		}
		view.draw();
	}
	view.click = function (event){
		var position = {x:event.offsetX-config.map.border,y:event.offsetY-config.map.border};
		var scale = config.map.scale;
		var location = {
			x:ko.observable(Math.floor(position.x/scale)),
			y:ko.observable(Math.floor(position.y/scale))
		};
		var objects = game.getObjectsAtPosition(location);
		if(view.clickMode()=="destination" && objects.planets.length)
		{
			location.name = game.getPlanetAtPosition(location).name();
			//TODO: should orders be stored away from game until ready for tick?
			//TODO: orders are removed from other orders and have planets as their origins
			//TODO: verify a planet hasn't maxed out its orders!
			var origin = view.viewMode()=="planet"?view.currentPlanet()
				:view.viewMode()=="fleet"?view.currentMovingFleet()
				:view.viewMode()=="order"?view.currentOrder().origin:console.log("UNLISTED VIEW MODE",view.viewMode());
			var order = Order(
				Fleet(view.activePlayer(),view.workingFleet.units()),
				origin,
				location
			);
			if(view.viewMode()=="order")order.removeFromOrigin(view.currentOrder());
			game.addOrder(order);
			view.draw();
			view.events.systemClick(view.currentPlanet()); //TODO: odd, but does the job! TODO: not always a planet!
			view.clickMode('display');
		}
		//TODO: intelligently order objects? how to select something behind one
		else if(objects.planets.length) view.events.systemClick(objects.planets[0]);
		else if(objects.orders.length) view.events.orderClick(objects.orders[0]);
		else if(objects.fleets.length) view.events.fleetClick(objects.fleets[0]);
	}
	
	view.readyToTick = function(){
		view.drawMode=false;
		view.moveMode=false;
		game.readyToTick(activePlayer);
	}
	view.takeTurn = function (){
		view.drawMode=false;
		view.drawMode=false;
		view.draw();
		view.drawMode=true;
		view.moveMode=true;
	}
	//TODO: make this function need to be less public and called everywhere!
	view.draw = function(){
		view.drawMode=false;
		//console.trace();
		//TODO: reduce number of draw calls
		var canvas = document.getElementById('display');
		var frame = document.getElementById('canvasFrame');
		var scale = config.map.scale;
		canvas.width = scale*config.map.x+config.map.border*2;
		canvas.height = scale*config.map.y+config.map.border*2;
		frame.width = scale*config.map.x+config.map.border*2;
		frame.height = scale*config.map.y+config.map.border*2;

		if(canvas.getContext)
		{
			var ctx = canvas.getContext('2d');
			ctx.fillStyle="#222222";
			ctx.fillRect(0,0,scale*config.map.x+config.map.border*2,scale*config.map.y+config.map.border*2);
			ctx.fillStyle="black";
			ctx.fillRect(config.map.border,config.map.border,scale*config.map.x,scale*config.map.y);
			var scale = config.map.scale;
			for(var planet of game.galaxy())
			{
				var xCorr=planet.position.x()*scale+config.map.border;
				var yCorr=planet.position.y()*scale+config.map.border
				ctx.fillStyle = planet.owner().color;
				ctx.strokeStyle = planet.culture.color;
				ctx.lineWidth  = 2;
				ctx.beginPath();
				ctx.arc(
					xCorr + scale/2,
					yCorr +scale/2, 
					scale/2,
					0,
					Math.PI*2
				);
				ctx.fill();
				ctx.stroke();
				ctx.fillStyle = "white";
				ctx.fillText(planet.production,xCorr + scale/4,yCorr+scale*3/4);
				ctx.fillText(planet.infoString(),xCorr + scale,yCorr +scale);
				ctx.fillText(planet.name(),xCorr + scale,yCorr +scale+10);
			}
			for(var order of game.orders()){
				if(order.fleet.owner()!=view.activePlayer())continue;
				ctx.fillStyle = order.fleet.owner().color;
				ctx.strokeStyle = order.fleet.owner().color;
				ctx.strokeStyle = '10px';
				ctx.beginPath();
				ctx.moveTo(order.origin.position.x()*scale+config.map.border+scale/2,
					order.origin.position.y()*scale+config.map.border+scale/2);
				ctx.lineTo(order.destination.x()*scale+config.map.border+scale/2,
					order.destination.y()*scale+config.map.border+scale/2);
				ctx.stroke();
				
				ctx.rect(order.midpoint.x()*scale+config.map.border+scale/4,
					order.midpoint.y()*scale+config.map.border+scale/4,scale/2,scale/2);
				ctx.fill();
				ctx.fillStyle = "white";
				ctx.fillText(
					order.fleet.infoString(),
					order.midpoint.x()*scale+config.map.border+scale/4,
					order.midpoint.y()*scale+config.map.border+scale/2);
			}
			for(var movingFleet of game.movingFleets()){
				ctx.fillStyle = movingFleet.fleet.owner().color;
				ctx.strokeStyle = movingFleet.fleet.owner().color;
				ctx.beginPath();
				ctx.moveTo(movingFleet.position.x()*scale+config.map.border+scale/2,movingFleet.position.y()*scale+config.map.border+scale/2);
				ctx.lineTo(movingFleet.destination.x()*scale+config.map.border+scale/2,movingFleet.destination.y()*scale+config.map.border+scale/2);
				ctx.stroke();
				

				ctx.rect(movingFleet.position.x()*scale+config.map.border+scale/4,movingFleet.position.y()*scale+config.map.border+scale/4,scale/2,scale/2);
				ctx.fill();
				ctx.fillStyle = "white";
				ctx.fillText(movingFleet.fleet.infoString(),movingFleet.position.x()*scale+config.map.border+scale/4,movingFleet.position.y()*scale+config.map.border+scale/2);

			}
		} else {
		  document.getElementById("error").innerHTML = "you are using a very old browser that can't run this program!"
		}
		view.drawMode=true;
	}
	
	view.currentPlanet(game.galaxy()[0]);
	return view;
}