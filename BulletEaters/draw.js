function draw() {
	drawMoveMap();
	drawBigMap();
}
function drawMoveMap(){
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
			if(tile.exploration == "none")
				ctx.strokeStyle = "#881111";
			if(tile.exploration == "seen")
				ctx.strokeStyle = "#11ff11";
			if(tile.exploration == "explored")
				ctx.strokeStyle = "#111111";
			ctx.lineWidth = 1;
			if(tile.type == "cave") drawCave(ctx,tile,scale,true);
			if(tile.type == "passageV") drawPassageV(ctx,tile,scale,true);
			if(tile.type == "passageH") drawPassageH(ctx,tile,scale,true);
			if(tile.type == "corner") drawCorner(ctx,tile,scale,true);
			if(tile.contents && tile.contents.length && (tile.exploration == "seen" || tile.exploration == "explored")){
				ctx.fillStyle = ctx.strokeStyle
				ctx.fillText(tile.name,tile.x*scale+5 -camera.x,tile.y*scale + scale/2- camera.y - 8);
				ctx.fillText(tile.contentSummary(tile),tile.x*scale+5 -camera.x,tile.y*scale + scale/2- camera.y);
				ctx.fillText(tile.environmentSummary(tile),tile.x*scale+5 -camera.x,tile.y*scale + scale/2 + 8- camera.y);

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
function drawBigMap(){
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
			if(tile.exploration == "none")
				ctx.strokeStyle = "#881111";
			if(tile.exploration == "seen")
				ctx.strokeStyle = "#11ff11";
			if(tile.exploration == "explored")
				ctx.strokeStyle = "#111111";

			ctx.lineWidth = 1;
			if(tile.type == "cave") drawCave(ctx,tile,scale,false);
			if(tile.type == "passageV") drawPassageV(ctx,tile,scale,false);
			if(tile.type == "passageH") drawPassageH(ctx,tile,scale,false);
			if(tile.type == "corner") drawCorner(ctx,tile,scale,false);
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
function drawCave(ctx, tile, scale, useCamera){
	var camX = useCamera?camera.x:0;
	var camY = useCamera?camera.y:0;
	ctx.strokeRect(
		tile.x*scale -camX,
		tile.y*scale -camY,
		scale,
		scale
	);
}
function drawPassageV(ctx,tile,scale,useCamera) {
	var camX = useCamera?camera.x:0;
	var camY = useCamera?camera.y:0;
		if(tile.exploration == "seen"){
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
	else if(tile.exploration == "explored" && tile.layout == "open"){
		ctx.strokeRect(
			tile.x*scale + scale/4 - camX,
			tile.y*scale - camY,
			scale/2,
			scale
		);
	}
}

function drawPassageH(ctx,tile,scale,useCamera) {
	var camX = useCamera?camera.x:0;
	var camY = useCamera?camera.y:0;
	if(tile.exploration == "seen"){
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
	else if(tile.exploration == "explored" && tile.layout == "open"){
		ctx.strokeRect(
			tile.x*scale - camX,
			tile.y*scale + scale/4 -camY,
			scale,
			scale/2
		);
	}
}
function drawCorner(ctx,tile,scale,useCamera){
	var camX = useCamera?camera.x:0;
	var camY = useCamera?camera.y:0;
	if(tile.exploration === "none" || tile.exploration == "partial") return;
	if(tile.layout == "open\\" || tile.exploration === "seen"){
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
	if(tile.layout == "open/" || tile.exploration === "seen"){
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
function centerCameraOnTile(tile) {
	if(tile.x){
		camera.x = tile.x*camera.scale - camera.width/2 + camera.scale/2;
		camera.y = tile.y*camera.scale - camera.height/2 + camera.scale/2;
	}
}