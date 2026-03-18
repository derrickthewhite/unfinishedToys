		function starLine(ctx,star,starIndex,color,lineName){
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(star.displayPosition(star[lineName]()), starIndex*100);
			ctx.lineTo(star.displayPosition(star[lineName]()), starIndex*100+100);
			ctx.stroke();
		}
		function drawCurrentSystem () {
			
			var canvas = document.getElementById("systemCanvas");
			var frame = document.getElementById("systemFrame");
			if(!canvas) return;
			canvas.width = 800;
			canvas.height = 100 * root.currentSystem().stars().length;
			frame.width = 800;
			frame.height = 100 * root.currentSystem().stars().length;
			if(canvas.getContext){
				var ctx = canvas.getContext('2d');
				ctx.fillStyle = root.display.spaceIsBlack()?"#010101": "#fefefe";
				ctx.fillRect(0,0,800,300);
			
				for(var starIndex = 0; starIndex < root.currentSystem().stars().length; starIndex++) {
					var star = root.currentSystem().stars()[starIndex];
					ctx.fillStyle = root.display.spaceIsBlack()?"#010101": "#fefefe";
					ctx.fillRect(0,100*starIndex,800,100);
					ctx.fillStyle = star.drawnColor();
					ctx.beginPath();
					ctx.arc(50-star.drawnRadius(), 100*starIndex+50, star.drawnRadius(), 0, Math.PI*2);
					ctx.fill();
					if(star == root.currentStar()){
						ctx.strokeStyle = star.drawnColor() == "white"? "#aaaaff": "white";
						ctx.lineWidth = 4;
						ctx.beginPath();
						ctx.arc(50-star.drawnRadius(), 100*starIndex+50, star.drawnRadius(), 0, Math.PI*2);
						ctx.stroke();
					} else if (!root.display.spaceIsBlack()) {
						ctx.strokeStyle = "black";
						ctx.lineWidth = 1;
						ctx.beginPath();
						ctx.arc(50-star.drawnRadius(), 100*starIndex+50, star.drawnRadius(), 0, Math.PI*2);
						ctx.stroke();
					}
					if(root.currentPlanet().orbit().center() == star){
						ctx.strokeStyle = root.display.spaceIsBlack()?"white":"black";
						ctx.lineWidth = 5;
						var displaceDistance = star.displayPosition(root.currentPlanet().orbit().distance());
						ctx.beginPath();
						ctx.arc(displaceDistance, starIndex*100+50, 50, 0, Math.PI*2);
						ctx.stroke();
					}
					if(root.currentPlanet().isMoon()){
						var moon = root.currentPlanet();
						if(moon.orbit().center().orbit().center() == star){
							ctx.strokeStyle = root.display.spaceIsBlack()?"white":"black";
							ctx.lineWidth = 3;
							var displaceDistance = star.displayPosition(moon.orbit().center().orbit().distance());
							ctx.beginPath();
							ctx.arc(displaceDistance + moon.orbit().distance()*10, starIndex*100+75, 20, 0, Math.PI*2);
							ctx.stroke();
						}
					}
					for(var planet of root.currentSystem().planets()) {
						if(planet.orbit().center() == star){
							ctx.fillStyle = planet.drawnColor();
							var displaceDistance = star.displayPosition(planet.orbit().distance());
							if(planet.type() =="asteroid") {
								ctx.beginPath();
								ctx.arc(displaceDistance-7, starIndex*100+50-7, 5, 0, Math.PI*2);
								ctx.fill();
								ctx.beginPath();
								ctx.arc(displaceDistance-7, starIndex*100+50+7, 5, 0, Math.PI*2);
								ctx.fill();
								ctx.beginPath();
								ctx.arc(displaceDistance+7, starIndex*100+50-7, 5, 0, Math.PI*2);
								ctx.fill();
								ctx.beginPath();
								ctx.arc(displaceDistance+7, starIndex*100+50+7, 5, 0, Math.PI*2);
								ctx.fill();
							} else {
								ctx.beginPath();
								ctx.arc(displaceDistance, starIndex*100+50, planet.drawnRadius(), 0, Math.PI*2);
								ctx.fill();
								if(!root.display.spaceIsBlack()) {
									ctx.beginPath();
									ctx.strokeStyle = "black";
									ctx.lineWidth = 1;
									ctx.arc(displaceDistance, starIndex*100+50, planet.drawnRadius(), 0, Math.PI*2);
									ctx.stroke();
								}
							}
							if(planet.settlementType() !== "none") {
								ctx.fillStyle = planet.settlementType()=="homeworld"?"green":
									planet.settlementType() == "colony"? "white":"grey";
								var x = displaceDistance+planet.drawnRadius()
								var y = starIndex*100+ 40 - planet.drawnRadius()
								ctx.fillRect(x,y, 10, 10);
								ctx.strokeStyle = "blue";
								ctx.lineWidth = .75;
								ctx.strokeText(planet.populationRating(), x+2 ,y+8)
								if(!root.display.spaceIsBlack()) {
									ctx.strokeStyle= "black";
									ctx.lineWidth = .5;
									ctx.strokeRect(x,y, 10, 10);
								}
							}
							if(planet.type() =="giant")
							{
								var settlementTypes = planet.moons().map(m => m.settlementType()).filter(type => type != "none");
								if(settlementTypes.length) {
									ctx.fillStyle = settlementTypes.includes("homeworld")?"green":
									settlementTypes.includes("colony")? "white":"grey";
									var x = displaceDistance+planet.drawnRadius()
									var y = starIndex*100+ 40 - planet.drawnRadius()
									ctx.fillRect(displaceDistance+planet.drawnRadius(), starIndex*100+ 40 - planet.drawnRadius(), 10, 10);
									var population = planet.moons().map(m => m.population()).reduce((sofar,a) => sofar+a,0).toFixed(0).length;
									ctx.strokeStyle = "blue";
									ctx.lineWidth = .75;
									ctx.strokeText(population, x+2 ,y+8)
								}
							}
							for(var moon of root.currentSystem().planets()) {
								if(moon.orbit().center() == planet){
									ctx.fillStyle = moon.drawnColor();
									var displaceDistance = star.displayPosition(planet.orbit().distance());
									ctx.beginPath();
									ctx.arc(displaceDistance + moon.orbit().distance()*10, starIndex*100+75, moon.drawnRadius(), 0, Math.PI*2);
									ctx.fill();
									if(!root.display.spaceIsBlack()) {
										ctx.beginPath();
										ctx.strokeStyle = "black";
										ctx.lineWidth = 1;
										ctx.arc(displaceDistance + moon.orbit().distance()*10, starIndex*100+75, moon.drawnRadius(), 0, Math.PI*2);
										ctx.stroke();
									}
								}
							}
						}
					}
					starLine(ctx,star,starIndex, root.display.spaceIsBlack()?"white": "black","snowLine");
					starLine(ctx,star,starIndex,"green","hotHabitableZone");
					starLine(ctx,star,starIndex,"green","coldHabitableZone");
					starLine(ctx,star,starIndex,"red","innerLimit");
					starLine(ctx,star,starIndex,"red","outerLimit");
					for(var neighborStar of root.currentSystem().stars()){
						//TODO: factor this to one code block
						if(star != neighborStar && neighborStar.orbit().center() == star){
							ctx.strokeStyle = neighborStar.drawnColor();
							ctx.lineWidth = 1;
							ctx.beginPath();
							ctx.moveTo(star.displayPosition(neighborStar.orbit().minDistance()), starIndex*100);
							ctx.lineTo(star.displayPosition(neighborStar.orbit().maxDistance()), starIndex*100+100);
							ctx.stroke();
							
							ctx.fillStyle = neighborStar.drawnColor();
							var displaceDistance = star.displayPosition(neighborStar.orbit().distance());
							ctx.beginPath();
							ctx.arc(displaceDistance, starIndex*100+50, 20, 0, Math.PI*2);
							ctx.fill();
							if(neighborStar == root.currentStar()){
								ctx.strokeStyle = neighborStar.drawnColor() == "white" || root.display.spaceIsBlack()? "#aaaaff": "white";
								ctx.lineWidth = 4;
								var displaceDistance = star.displayPosition(neighborStar.orbit().distance());
								ctx.beginPath();
								ctx.arc(displaceDistance, starIndex*100+50, 20, 0, Math.PI*2);
								ctx.stroke();
							}
						}
						if(star != neighborStar && star.orbit().center() == neighborStar){
							ctx.strokeStyle = neighborStar.drawnColor();
							ctx.lineWidth = 1;
							ctx.beginPath();
							ctx.moveTo(star.displayPosition(star.orbit().minDistance()), starIndex*100);
							ctx.lineTo(star.displayPosition(star.orbit().maxDistance()), starIndex*100+100);
							ctx.stroke();
							
							ctx.fillStyle = neighborStar.drawnColor();
							var displaceDistance = star.displayPosition(star.orbit().distance());
							ctx.beginPath();
							ctx.arc(displaceDistance, starIndex*100+50, 20, 0, Math.PI*2);
							ctx.fill();
							if(neighborStar == root.currentStar()){
								ctx.strokeStyle = neighborStar.drawnColor() == "white"? "#aaaaff": "white";
								ctx.lineWidth = 4;
								var displaceDistance = star.displayPosition(star.orbit().distance());
								ctx.beginPath();
								ctx.arc(displaceDistance, starIndex*100+50, 20, 0, Math.PI*2);
								ctx.stroke();
							}

						}
					}
				}
			}
		}
		
		function drawGalaxy(){
			var canvas = document.getElementById("sectorCanvas");
			var frame = document.getElementById("sectorFrame");
			if(!canvas) return;
			canvas.width = 500;
			canvas.height = 500;
			frame.width = 500;
			frame.height = 500;
			
			var ctx = canvas.getContext('2d');
			if(!canvas.getContext) return;

			ctx.save();
			ctx.translate(0, 0);
			ctx.fillStyle = root.display.spaceIsBlack()?"#010101": "#fefefe";
			ctx.fillRect(0,0, 500,500);
			
			for(var system of root.cosmos.systems()){
				ctx.fillStyle = system.stars()[0].drawnColor();
				ctx.beginPath();
				ctx.arc(system.location.x()*5, system.location.y()*5, 2, 0 , Math.PI*2);
				ctx.fill();
				if(!root.display.spaceIsBlack()) {
					ctx.beginPath();
					ctx.strokeStyle = "black";
					ctx.lineWidth = 1;
					ctx.arc(system.location.x()*5, system.location.y()*5, 2, 0 , Math.PI*2);
					ctx.stroke();
				}
				if(system.isHabitable()){
					ctx.fillStyle = "green"
					ctx.beginPath();
					ctx.arc(system.location.x()*5+5, system.location.y()*5+5, 1, 0 , Math.PI*2);
					ctx.fill();
				}
			}
			ctx.strokeStyle = "gray";
			ctx.lineWidth = 1;
			for(var x =0; x< 500; x+=25) {
				ctx.beginPath();
				ctx.moveTo(0,x);
				ctx.lineTo(500,x);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(x,0);
				ctx.lineTo(x, 500);
				ctx.stroke();
			}
			
			var currentSystem = root.currentSystem();
			ctx.strokeStyle = root.display.spaceIsBlack()?"white":"black";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(currentSystem.location.x()*5, currentSystem.location.y()*5, 15, 0 , Math.PI*2);
			ctx.stroke();

			ctx.restore();
		}
		function drawCurrentPlanet () {
			var canvas = document.getElementById("planetCanvas");
			var frame = document.getElementById("planetFrame");
			if(!canvas) return;
			if(!canvas.getContext) return;
			var ctx = canvas.getContext('2d');

			canvas.width = 300;
			canvas.height = 300;
			frame.width = 300;
			frame.height = 300;

			ctx.fillStyle = root.display.spaceIsBlack()?"#111111": "#e0e0e0";
			ctx.fillRect(0,0, 300,300);
			var planet = root.currentPlanet();
			ctx.fillStyle = planet.drawnColor();
			if(planet.type() =="asteroid") {
				var displaceDistance = planet.orbit().distance()*30+15;
				ctx.beginPath();
				ctx.arc(150-7, 150-7, 5, 0, Math.PI*2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(150-7, 150+7, 5, 0, Math.PI*2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(150+7, 150-7, 5, 0, Math.PI*2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(150+7, 150+7, 5, 0, Math.PI*2);
				ctx.fill();
			} else {
				ctx.beginPath();
				var radius = planet.isMoon()?planet.drawnRadius()*25: planet.drawnRadius()*5;
				ctx.arc(150,150,radius, 0, Math.PI*2);
				ctx.fill();
				
				if(!root.display.spaceIsBlack() && planet.drawnColor() == "white") {
					ctx.beginPath();
					ctx.strokeStyle = "black";
					ctx.lineWidth = 1;
					ctx.arc(150,150,radius, 0, Math.PI*2);
					ctx.stroke();
				}

			}
			if(planet.type() == "terrestrial"){
				if (planet.tectonics() != "None") {
					var baseWidth = planet.size()*4;
					var height = planet.tectonics() == "Extreme"? 10:
						planet.tectonics() == "Heavy"? 9:
						planet.tectonics() == "Moderate"? 7:5;
					ctx.lineWidth = planet.tectonics() == "Extreme"? 3:
						planet.tectonics() == "Heavy"? 3:
						planet.tectonics() == "Moderate"? 2:1;
					ctx.strokeStyle= planet.tectonics() == "Extreme"? "red" : "black";
					ctx.beginPath();
					ctx.moveTo(150-baseWidth*3,150+height);
					ctx.lineTo(150-baseWidth*2,150);
					ctx.lineTo(150-baseWidth*1,150+height);
					ctx.lineTo(150+0,150-3);
					ctx.lineTo(150+baseWidth*1,150+height);
					ctx.lineTo(150+baseWidth*2,150);
					ctx.lineTo(150+baseWidth*3,150+height);
					ctx.stroke();
				}
				if(planet.vulcanism() != "None") {
					var baseWidth = planet.size()*4;
					var height = planet.vulcanism() == "Extreme"? 10:
						planet.vulcanism() == "Heavy"? 9:
						planet.vulcanism() == "Moderate"? 7:5;
					ctx.lineWidth = planet.vulcanism() == "Extreme"? 3:
						planet.vulcanism() == "Heavy"? 3:
						planet.vulcanism() == "Moderate"? 2:1;
					ctx.strokeStyle= planet.vulcanism() == "Extreme"? "red" : "black";
					ctx.beginPath();
					ctx.moveTo(150 - baseWidth*5, 150 - height*2)
					ctx.lineTo(150 - baseWidth*4, 150 - height*3)
					ctx.lineTo(150 - baseWidth*3, 150 - height*2)
					ctx.stroke();
					ctx.beginPath();
					ctx.moveTo(150 - baseWidth*5, 150 + height*2)
					ctx.lineTo(150 - baseWidth*4, 150 + height)
					ctx.lineTo(150 - baseWidth*3, 150 + height*2)
					ctx.stroke();
					ctx.beginPath();
					ctx.moveTo(150 + baseWidth*5, 150 - height)
					ctx.lineTo(150 + baseWidth*4, 150 - height*2)
					ctx.lineTo(150 + baseWidth*3, 150 - height)
					ctx.stroke();
					ctx.beginPath();
					ctx.moveTo(150 + baseWidth*5, 150 + height*3)
					ctx.lineTo(150 + baseWidth*4, 150 + height*2)
					ctx.lineTo(150 + baseWidth*3, 150 + height*3)
					ctx.stroke();
				}
			}

			//Moons
			for(var moon of root.currentSystem().planets()) {
				if(moon.orbit().center() == planet) {
					ctx.fillStyle = moon.drawnColor();
					if(moon.type() =="asteroid") {
						var displaceDistance = moon.orbit().distance()*30+15;
						ctx.beginPath();
						ctx.arc(displaceDistance-7, 200-7, 5, 0, Math.PI*2);
						ctx.fill();
						ctx.beginPath();
						ctx.arc(displaceDistance-7, 200+7, 5, 0, Math.PI*2);
						ctx.fill();
						ctx.beginPath();
						ctx.arc(displaceDistance+7, 200-7, 5, 0, Math.PI*2);
						ctx.fill();
						ctx.beginPath();
						ctx.arc(displaceDistance+7, 200+7, 5, 0, Math.PI*2);
						ctx.fill();
					} else {
						ctx.beginPath();
						ctx.arc(moon.orbit().distance()*30+15, 200, moon.drawnRadius()*5, 0 , Math.PI*2);
						ctx.fill();
					}
					if(moon.settlementType() !== "none") {
						ctx.fillStyle = moon.settlementType()=="homeworld"?"green":
							moon.settlementType() == "colony"? "white":"grey";
						ctx.fillRect(moon.orbit().distance()*30+15+moon.drawnRadius()*5, 190 - moon.drawnRadius()*5, 10, 10);
					}
				}
			}
			ctx.restore();
		}
		function sectorCanvasClick(koContext, event) {
			var x = event.offsetX;
			var y = event.offsetY;
			handleSectorSelection(x,y)
		}
		function systemCanvasClick(koContext, event) {
			var x = event.offsetX;
			var y = event.offsetY;
			handleSystemSelection(x,y)
		}
		function planetCanvasClick(koContext, event) {
			var x = event.offsetX;
			var y = event.offsetY;
			handlePlanetSelection(x,y)
		}
		function canvasTouch (koContext, event) {
			//TODO: touch screen!
			console.log("canvas touch", event);
		}
		function handleSectorSelection(x,y){
			//selecting system?
			//TODO: get closest, not first
			for(var system of root.cosmos.systems()){
				if(distance (x,y, system.location.x()*5, system.location.y()*5 ) <=4){
					root.currentSystem(system);
					root.currentStar(system.stars()[0]);
					root.currentPlanet(system.planets()[0]);
					draw();
					return;
				}
			}
		}
		function handlePlanetSelection (x,y) {
			for(var planet of root.currentSystem().planets()){
				var radius = planet.type() == "asteroid" ? 15: planet.drawnRadius();
				if(!planet.orbit().center().displayPosition ){ //this is a moon
					if(planet.orbit().center() == root.currentPlanet() && distance(x,y,planet.orbit().distance()*30+15,200) <= radius*5){
						root.currentPlanet(planet)
						draw();
						return;
					}
				}
			}
		}
		function handleSystemSelection(x,y){
			//selecting planet?
			for(var planet of root.currentSystem().planets()){
				var radius = planet.type() == "asteroid" ? 15: planet.drawnRadius();
				if(planet.orbit().center().displayPosition ){ //this is not a moon
					var displayPosition = planet.orbit().center().displayPosition(planet.orbit().distance());
					var starIndex = root.currentSystem().stars().indexOf(planet.orbit().center());
					if(distance(x,y, displayPosition ,50 +starIndex*100) <= radius){
						root.currentPlanet(planet)
						draw();
						return;
					}
				}
			}
			// selecting star?
			for(var star of root.currentSystem().stars()){
				var starIndex = root.currentSystem().stars().indexOf(star);
				//if(distance(x,y, 50 - star.drawnRadius() ,50 +starIndex*100) <= star.drawnRadius()){
				if(x<50 && starIndex*100 <= y && y <= starIndex*100 +100){
					root.currentStar(star)
					draw();
					return;
				}
				for(var neighborStar of root.currentSystem().stars()){
					if(star!= neighborStar &&(neighborStar.orbit().center() == star || star.orbit().center() == neighborStar)){
						starIndex = root.currentSystem().stars().indexOf(neighborStar);
						var displayPosition = neighborStar.orbit().center() == star?
							neighborStar.displayPosition(neighborStar.orbit().distance()):
							neighborStar.displayPosition(star.orbit().distance());
						if(distance(x,y,displayPosition,50 +100*starIndex) <= 20){
							root.currentStar(star)
							draw();
							return;
						}
					}
				}
			}
		}
		function distance (x1,y1,x2,y2) {
			return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
		}
		function getSelection (x,y) {
			return undefined;
		}
		function draw() {
			drawCurrentSystem();
			drawCurrentPlanet();
			drawGalaxy();
		}
	