function View(activePlayer){
	var view = {};

	view.drawMode = false;
	view.currentPlanet= ko.observable();
	view.currentFleet= ko.observable();
	view.workingFleet= Fleet("",[],"Ground");
	view.activePlayer= ko.observable();
	view.viewMode = ko.observable("planet");
	view.clickMode = ko.observable("display");
	view.activePlayer(activePlayer);

	view.planetProductionOptions = ko.pureComputed(function (){
		if(!view.currentPlanet())return [];
		return view.currentPlanet().culture.units.concat({name:"peace"});
	})
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
		view.currentFleet(fleet);
		view.viewMode("fleet");
	}
	view.events.orderClick = function (order){
		view.currentFleet(order.fleet);
		view.viewMode("fleet");
	}
	view.setForAllMyUnits = function (){
		for(var planet of game.galaxy()){
			if(planet.owner() == view.currentPlanet().owner())
				planet.currentProduction(view.currentPlanet().currentProduction());
		}
	}
	view.click = function (event){
		var position = {x:event.offsetX,y:event.offsetY};
		var scale = config.map.scale;
		var location = {x:Math.floor(position.x/scale),y:Math.floor(position.y/scale)};
		location.planet = game.getPlanetAtLocation(location);
		location.objects = game.getObjectsAtLocation(location);
		if(view.clickMode()=="destination")
		{
			view.currentPlanet().orders.push(Order(view.activePlayer(),Fleet(view.activePlayer(),view.workingFleet.units()),view.currentPlanet(),location));
			view.events.systemClick(view.currentPlanet()); //TODO: odd, but does the job!
			view.clickMode('select');
		}
		else if(location.objects.planets.length) view.events.systemClick(location.objects.planets[0]);
		else if(location.objects.orders.length) view.events.orderClick(location.objects.orders[0]);
		else if(location.objects.fleets.length) view.events.fleetClick(location.objects.fleets[0]);
	}
	
	//TODO: make this function need to be less public and called everywhere!
	view.draw = function(){
		var canvas = document.getElementById('display');
		var frame = document.getElementById('canvasFrame');
		var scale = config.map.scale;
		canvas.width = scale*config.map.x;
		canvas.height = scale*config.map.y;
		frame.width = scale*config.map.x;
		frame.height = scale*config.map.y;

		if(canvas.getContext)
		{
			var ctx = canvas.getContext('2d');
			ctx.fillStyle="black";
			ctx.fillRect(0,0,scale*config.map.x,scale*config.map.y);
			var scale = config.map.scale;
			for(var planet of game.galaxy())
			{
				ctx.fillStyle = planet.owner().color;
				ctx.strokeStyle = planet.culture.color;
				ctx.lineWidth  = 2;
				ctx.beginPath();
				ctx.arc(
					planet.location.x*scale + scale/2,
					planet.location.y*scale +scale/2, 
					scale/2,
					0,
					Math.PI*2
				);
				ctx.fill();
				ctx.stroke();
				ctx.fillStyle = "white";
				ctx.fillText(planet.production,planet.location.x*scale + scale/4,planet.location.y*scale+scale*3/4);
				ctx.fillText(planet.infoString(),planet.location.x*scale + scale,planet.location.y*scale +scale);
				ctx.fillText(planet.name(),planet.location.x*scale + scale,planet.location.y*scale +scale+10);
			}
			for(var order of game.orders()){
				ctx.fillStyle = order.owner.color;
				ctx.strokeStyle = order.owner.color;
				ctx.strokeStyle = '10px';
				ctx.beginPath();
				ctx.moveTo(order.origin.location.x*scale+scale/2,order.origin.location.y*scale+scale/2);
				ctx.lineTo(order.destination.x*scale+scale/2,order.destination.y*scale+scale/2);
				ctx.stroke();
				
				ctx.rect(order.midpoint.x*scale+scale/4,order.midpoint.y*scale+scale/4,scale/2,scale/2);
				ctx.fill();
				ctx.fillStyle = "white";
				ctx.fillText(order.fleet.infoString(),order.midpoint.x*scale+scale/4,order.midpoint.y*scale+scale/2);
			}
			for(var movingFleet of game.movingFleets()){
				ctx.fillStyle = movingFleet.fleet.owner().color;
				ctx.strokeStyle = movingFleet.fleet.owner().color;
				ctx.beginPath();
				ctx.moveTo(movingFleet.position.x()*scale+scale/2,movingFleet.position.y()*scale+scale/2);
				ctx.lineTo(movingFleet.destination.x()*scale+scale/2,movingFleet.destination.y()*scale+scale/2);
				ctx.stroke();
				

				ctx.rect(movingFleet.position.x()*scale+scale/4,movingFleet.position.y()*scale+scale/4,scale/2,scale/2);
				ctx.fill();
				ctx.fillStyle = "white";
				ctx.fillText(movingFleet.fleet.infoString(),movingFleet.position.x()*scale+scale/4,movingFleet.position.y()*scale+scale/2);

			}
		} else {
		  document.getElementById("error").innerHTML = "you are using a very old browser that can't run this program!"
		}
	}
	
	return view;
}