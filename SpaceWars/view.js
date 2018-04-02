function View(game,activePlayer){
	var view = {};

	view.drawMode = false;
	view.moveMode = false; //TODO: don't allow changes when move mode is false!
	view.currentPlanet= ko.observable();
	view.currentMovingFleet = ko.observable();
	view.currentOrder= ko.observable();
	view.workingFleet= Fleet("",[],"Ground"); //working Fleet is used to create orders
	view.workingProduction = ko.observable();
	view.activePlayer= ko.observable();
	view.viewMode = ko.observable("planet");
	view.clickMode = ko.observable("display");
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
		var activeFleet = view.currentPlanet().fleets().filter(a=>a.owner()==view.activePlayer())[0];
		if(!activeFleet)return;
		for(var i = 0;i<activeFleet.units().length;i++){
			view.workingFleet.units()[i].count(activeFleet.units()[i].count());
		}
		view.clickMode("destination");
	}
	view.events.systemClick= function (planet){ 
		var activeFleet = planet.fleets().filter(a=>a.owner()==view.activePlayer())[0]; 
		if(!activeFleet)view.workingFleet.units([]);
		else view.workingFleet.units(activeFleet.units().map(a=>Unit(a.type,a.owner,0)));
		view.viewMode("planet");
		view.currentPlanet(planet);
	}
	view.events.fleetClick = function (fleet){
		view.currentMovingFleet(fleet);
		view.viewMode("fleet");
	}
	view.events.orderClick = function (order){
		view.currentOrder(order);
		view.viewMode("order");
	}
	view.setProductionForAllMyPlanets = function (){
		var productionChanges = [];
		for(var planet of game.galaxy()){
			if(planet.owner() == view.activePlayer() && planet.culture.units.indexOf(view.workingProduction())!=-1)
				productionChanges.push(productionChange(planet,view.workingProduction()));
		}
		game.addProductionChanges(productionChanges);
		view.draw();
	}
	view.setProductionForCurrentPlanet = function (){
		if(view.currentPlanet().owner() == view.activePlayer())
		{
			game.addProductionChanges(productionChange(view.currentPlanet(),view.workingProduction()));
		}
	}
	view.click = function (event){
		var position = {x:event.offsetX-config.map.border,y:event.offsetY-config.map.border};
		var scale = config.map.scale;
		var location = {x:Math.floor(position.x/scale),y:Math.floor(position.y/scale)};
		location.planet = game.getPlanetAtPosition(location);
		location.objects = game.getObjectsAtPosition(location);
		if(view.clickMode()=="destination")
		{
			view.currentPlanet().orders.push(Order(view.activePlayer(),Fleet(view.activePlayer(),view.workingFleet.units()),view.currentPlanet(),location));
			view.draw();
			view.events.systemClick(view.currentPlanet()); //TODO: odd, but does the job!
			view.clickMode('select');
		}
		else if(location.objects.planets.length) view.events.systemClick(location.objects.planets[0]);
		else if(location.objects.orders.length) view.events.orderClick(location.objects.orders[0]);
		else if(location.objects.fleets.length) view.events.fleetClick(location.objects.fleets[0]);
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
				var xCorr=planet.position.x*scale+config.map.border;
				var yCorr=planet.position.y*scale+config.map.border
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
				if(order.owner!=view.activePlayer())continue;
				ctx.fillStyle = order.owner.color;
				ctx.strokeStyle = order.owner.color;
				ctx.strokeStyle = '10px';
				ctx.beginPath();
				ctx.moveTo(order.origin.position.x*scale+config.map.border+scale/2,
					order.origin.position.y*scale+config.map.border+scale/2);
				ctx.lineTo(order.destination.x*scale+config.map.border+scale/2,
					order.destination.y*scale+config.map.border+scale/2);
				ctx.stroke();
				
				ctx.rect(order.midpoint.x*scale+config.map.border+scale/4,
					order.midpoint.y*scale+config.map.border+scale/4,scale/2,scale/2);
				ctx.fill();
				ctx.fillStyle = "white";
				ctx.fillText(
					order.fleet.infoString(),
					order.midpoint.x*scale+config.map.border+scale/4,
					order.midpoint.y*scale+config.map.border+scale/2);
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