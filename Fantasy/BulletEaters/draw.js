function createArtist() {
	var artist = {
		imageLibrary: [],
		currentExplorationMap: ko.observable()
	};
	artist.draw = ()=> {
		//TODO: find way to trigger when current faction changes
		artist.currentExplorationMap(
			results.teamNavigation.currentTeam()?
			results.teamNavigation.currentTeam().explorationMap():
			results.factionManager.currentFaction().explorationMap()
		)
		artist.drawMoveMap();
		artist.drawBigMap();
	}
	artist.getImage = (url) => {
		if (artist.imageLibrary[url])return artist.imageLibrary[url];
		var img = new Image()
		img.src = url;
		artist.imageLibrary[url] = img;
		return img;
	}
	artist.drawBattleMap= function () {
			var canvas = document.getElementById("battleMap");
			var frame = document.getElementById('battleCanvasFrame');

			if(!canvas) return;
			//TODO: best way to accomodate this
			canvas.width = camera.width-25;
			canvas.height = camera.height-50;
			frame.width = camera.width;
			frame.height = camera.height;
			if(canvas.getContext){
				var ctx = canvas.getContext('2d');
				ctx.fillStyle="#eeeeee";
				ctx.fillRect(0,0,camera.width,camera.height);
				
				var battleground = results.battleground;
				if(battleground.active()){
					var scale = battleMapConfig.scale;
					var unitGrid = battleground.unitGrid();
					for(var i = 0; i< unitGrid.length; i++) {
						var left = i*scale;
						if(unitGrid[i].description != "..."){
							if((unitGrid[i-1] && unitGrid[i-1].description== "...") || (unitGrid[i+1] && unitGrid[i+1].description == "...")){
								ctx.beginPath();
								ctx.arc( i*scale+scale/2, scale/2, scale/2, 0, 2 * Math.PI, false);
								ctx.fillStyle = 'green';
								ctx.fill();
							}
							if(unitGrid[i+1].description != "...")
							{
								ctx.fillStyle = 'green';
								ctx.fillRect(i*scale+scale/2, 0, scale, scale);
							}
						}
						ctx.fillStyle = 'black';
						ctx.fillText(unitGrid[i].description,left+scale/2-5,scale/2+5);
						for(var u = 0; u < unitGrid[i].length; u++) {
							var unit = unitGrid[i][u];
							ctx.drawImage(artist.getImage(unit.svg()), left, (u+1)*scale, scale, scale);
							if(unit.gear().length) 
								ctx.drawImage(artist.getImage(unit.gear()[0].svg), left+scale/2, (u+1.5)*scale, scale*2/3, scale*2/3);
							var healthRatio = unit.currentHp()/unit.maxHp();
							//TODO: use actual math?
							var healthColor = "#008800";
							if(healthRatio <= 0 ) healthColor = "#000000"
							else if (healthRatio<=.25) healthColor = "#ff0000"
							else if (healthRatio<=.5 ) healthColor = "#ff8800"
							else if (healthRatio<=.75) healthColor = "#ffff00"
							else if (healthRatio<=.95) healthColor = "#88ff00"
							ctx.beginPath();
							ctx.arc( (i+.83)*scale, (u+1.16)*scale, scale/6, 0, 2 * Math.PI, false);
							ctx.fillStyle = healthColor;
							ctx.fill();
							if(battleground.currentUnit() == unit) {
								ctx.beginPath();
								ctx.arc( i*scale+scale/2, (u+1)*scale + scale/2, scale/2, 0, 2 * Math.PI, false);
								ctx.strokeStyle = 'red';
								ctx.stroke();
							}
							if(battleground.targetOptions().length){
								if(battleground.targetOptions().includes(unit)){
									artist.drawCrossHairs(ctx, i, u+1, scale);
								}
								//TODO: a way to just ask the battleground if a target is valid
							} else if (battleground.canTarget(battleground.currentUnit(), undefined, unit)){
								artist.drawCrossHairs(ctx, i, u+1, scale);
							}
						}
						if(battleground.canTarget(battleground.currentUnit(), undefined, unitGrid[i].description)){
							artist.drawCrossHairs(ctx, i, 0, scale);
						}
					}
				}
			}else {
				document.getElementById("error").innerHTML = "you are using a very old browser that can't run this program!"
			}
		}
	artist.drawCrossHairs = function(ctx,x,y,scale) {
		ctx.beginPath();
		ctx.arc( x*scale+scale/2, (y)*scale + scale/2, scale/2, 0, 2 * Math.PI, false);
		ctx.strokeStyle = 'red';
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x*scale+scale/2, (y)*scale)
		ctx.lineTo(x*scale+scale/2, (y+1)*scale)
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x*scale+scale, (y+.5)*scale)
		ctx.lineTo(x*scale, (y+.5)*scale)
		ctx.stroke();
	}
	artist.drawMoveMap = function(){
		var canvas = document.getElementById("moveMap");
		var frame = document.getElementById('moveCanvasFrame');
		var config = results.config;
		
		var scale = camera.scale;
		canvas.width = camera.width;
		canvas.height = camera.height;
		frame.width = camera.width;
		frame.height = camera.height;

		if(canvas.getContext)
		{
			var ctx = canvas.getContext('2d');
			ctx.fillStyle="#eeeeee";
			ctx.fillRect(0,0,camera.width,camera.height);
			for(var tile of results.map.reduce((a,sofar) => sofar.concat(a),[]))
			{
				//if(tile.exploration == "none")
				if(artist.currentExplorationMap().getStatus(tile) == "none")
					ctx.strokeStyle = "#881111";
				if(artist.currentExplorationMap().getStatus(tile) == "seen")
					ctx.strokeStyle = "#11ff11";
				if(artist.currentExplorationMap().getStatus(tile) == "explored")
					ctx.strokeStyle = "#111111";
				ctx.lineWidth = 1;
				if(tile.type == "cave") artist.drawCave(ctx,tile,scale,true);
				if(tile.type == "passageV") artist.drawPassageV(ctx,tile,scale,true);
				if(tile.type == "passageH") artist.drawPassageH(ctx,tile,scale,true);
				if(tile.type == "corner") artist.drawCorner(ctx,tile,scale,true);
				if(tile.contents && tile.contents.length && 
					(artist.currentExplorationMap().getStatus(tile) == "seen" 
						|| artist.currentExplorationMap().getStatus(tile) == "explored"
					)
				){
					ctx.fillStyle = ctx.strokeStyle
					ctx.fillText(tile.name,tile.x*scale+5 -camera.x,tile.y*scale + scale/2- camera.y - 8);
					ctx.fillText(tile.contentSummary(tile),tile.x*scale+5 -camera.x,tile.y*scale + scale/2- camera.y);
					ctx.fillText(tile.environmentSummary(tile),tile.x*scale+5 -camera.x,tile.y*scale + scale/2 + 8- camera.y);
					
					var teams = artist.currentExplorationMap().features(tile).filter(f => f.featureType== "Team");
					for(var teamIndex in teams) {
						var team = teams[teamIndex];
						ctx.drawImage(
							artist.getImage(team.svg()), 
							tile.x*scale+5 -camera.x + (teamIndex*scale/5), 
							tile.y*scale + scale/2 + 8- camera.y, 
							scale/5, 
							scale/5
						)
					}
					var structures = artist.currentExplorationMap().features(tile).filter(f => f.featureType== "Structure");
					for(var structureIndex in structures) {
						var structure = structures[structureIndex];
						ctx.drawImage(
							artist.getImage(structure.svg()), 
							tile.x*scale+5 -camera.x + (structureIndex*scale/5), 
							tile.y*scale + scale/2 + 16- camera.y, 
							scale/5, 
							scale/5
						)
					}
					var terrains = artist.currentExplorationMap().features(tile).filter(f => f.featureType== "Terrain" || (f.featureType == "Passage" && f.name()=="Portal"));
					for(var terrainsIndex in terrains) {
						var terrain = terrains[terrainsIndex];
						ctx.drawImage(
							artist.getImage(terrain.svg()), 
							tile.x*scale+5 -camera.x + (terrainsIndex*scale/5), 
							tile.y*scale + scale/2 + 24- camera.y, 
							scale/5, 
							scale/5
						)
					}

					ctx.fillStyle = "#eeeeee";
				}
			}
			ctx.strokeStyle = "#111188";
			ctx.lineWidth = 3;
			if(results.mapNavigation.currentTile()){
				ctx.strokeRect(
					results.mapNavigation.currentTile().x*scale -camera.x - scale/8,
					results.mapNavigation.currentTile().y*scale -camera.y - scale/8,
					scale*5/4,
					scale*5/4
				);
			}
		} else {
			document.getElementById("error").innerHTML = "you are using a very old browser that can't run this program!"
		}
	}
	artist.drawBigMap = function(){
		var canvas = document.getElementById("bigMap");
		var frame = document.getElementById('canvasFrame');
		var config = results.config;
		
		var scale = config.scale();
		canvas.width = scale*config.width();
		canvas.height = scale*config.height();
		frame.width = scale*config.width();
		frame.height = scale*config.height();

		if(canvas.getContext)
		{
			var ctx = canvas.getContext('2d');
			ctx.fillStyle="#eeeeee";
			ctx.fillRect(0,0,scale*config.width(),scale*config.height());
			for(var tile of results.map.reduce((a,sofar) => sofar.concat(a),[]))
			{
				if(artist.currentExplorationMap().getStatus(tile) == "none")
					ctx.strokeStyle = "#881111";
				if(artist.currentExplorationMap().getStatus(tile) == "seen")
					ctx.strokeStyle = "#11ff11";
				if(artist.currentExplorationMap().getStatus(tile) == "explored")
					ctx.strokeStyle = "#111111";

				ctx.lineWidth = 1;
				if(tile.type == "cave") artist.drawCave(ctx,tile,scale,false);
				if(tile.type == "passageV") artist.drawPassageV(ctx,tile,scale,false);
				if(tile.type == "passageH") artist.drawPassageH(ctx,tile,scale,false);
				if(tile.type == "corner") artist.drawCorner(ctx,tile,scale,false);
				//TODO: possibly remove this?
				if(false)ctx.strokeText(tile.name,tile.x*scale+5,tile.y*scale + scale/2);
			}
			ctx.strokeStyle = "#ff0000";
			ctx.strokeRect(
				camera.x/camera.scale*scale,
				camera.y/camera.scale*scale,
				camera.width/camera.scale*scale,
				camera.height/camera.scale*scale,
			)
		} else {
			document.getElementById("error").innerHTML = "you are using a very old browser that can't run this program!"
		}

	}
	artist.drawCave = function(ctx, tile, scale, useCamera){
		var camX = useCamera?camera.x:0;
		var camY = useCamera?camera.y:0;
		ctx.strokeRect(
			tile.x*scale -camX,
			tile.y*scale -camY,
			scale,
			scale
		);
	}
	artist.drawPassageV = function(ctx,tile,scale,useCamera) {
		var camX = useCamera?camera.x:0;
		var camY = useCamera?camera.y:0;
			if(artist.currentExplorationMap().getStatus(tile) == "seen"){
			ctx.strokeRect(
				tile.x*scale + scale/4 - camX,
				tile.y*scale - camY,
				scale/2,
				scale/3
			);
			ctx.strokeRect(
				tile.x*scale + scale/4 - camX,
				tile.y*scale +scale*2/3 - camY,
				scale/2,
				scale/3
			);
		}
		else if(artist.currentExplorationMap().getStatus(tile) == "explored" && tile.layout == "open"){
			ctx.strokeRect(
				tile.x*scale + scale/4 - camX,
				tile.y*scale - camY,
				scale/2,
				scale
			);
		}
	}

	artist.drawPassageH = function(ctx,tile,scale,useCamera) {
		var camX = useCamera?camera.x:0;
		var camY = useCamera?camera.y:0;
		if(artist.currentExplorationMap().getStatus(tile) == "seen"){
			ctx.strokeRect(
				tile.x*scale - camX,
				tile.y*scale + scale/4 -camY,
				scale/3,
				scale/2
			);
			ctx.strokeRect(
				tile.x*scale + scale*2/3- camX,
				tile.y*scale + scale/4 -camY,
				scale/3,
				scale/2
			);
		}
		else if(artist.currentExplorationMap().getStatus(tile) == "explored" && tile.layout == "open"){
			ctx.strokeRect(
				tile.x*scale - camX,
				tile.y*scale + scale/4 -camY,
				scale,
				scale/2
			);
		}
	}
	artist.drawCorner = function(ctx,tile,scale,useCamera){
		var camX = useCamera?camera.x:0;
		var camY = useCamera?camera.y:0;
		if(artist.currentExplorationMap().getStatus(tile) === "none" || artist.currentExplorationMap().getStatus(tile) == "partial") return;
		if(tile.layout == "open\\"){
			ctx.beginPath();
			ctx.moveTo(
				tile.x*scale-scale/6 - camX,
				tile.y*scale  - camY
			);
			ctx.lineTo(
				tile.x*scale + scale - camX,
				tile.y*scale + scale + scale/6  - camY
			)
			ctx.moveTo(
				tile.x*scale - camX,
				tile.y*scale-scale/6  - camY
			);
			ctx.lineTo(
				tile.x*scale + scale + scale/6 - camX,
				tile.y*scale + scale  - camY
			)
			ctx.stroke();
		}
		if(tile.layout == "open/"){
			ctx.beginPath();
			ctx.moveTo(
				tile.x*scale + scale+scale/6 - camX,
				tile.y*scale - camY
			);
			ctx.lineTo(
				tile.x*scale - camX,
				tile.y*scale + scale + scale/6 - camY
			)
			ctx.stroke();
			ctx.moveTo(
				tile.x*scale + scale - camX,
				tile.y*scale-scale/6 - camY
				);
			ctx.lineTo(
				tile.x*scale - scale/6 - camX,
				tile.y*scale + scale  - camY
			)
			ctx.stroke();
		}
	}
	artist.centerCameraOnTile = function(tile) {
		//TODO: should camera be part of artist?
		if(tile.x){
			camera.x = tile.x*camera.scale - camera.width/2 + camera.scale/2;
			camera.y = tile.y*camera.scale - camera.height/2 + camera.scale/2;
		}
	}
	return artist;
}
