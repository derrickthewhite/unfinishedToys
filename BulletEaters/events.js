function tick() {
	if(camera.moveX!=0 || camera.moveY!=0){
		camera.x += camera.moveX;
		camera.y += camera.moveY;
		draw();
	}
	setTimeout(tick,100);
}
function moveSpeed(ratio) {
	var moveSpeed = 30;
	return Math.ceil(moveSpeed*(Math.pow(2,1-ratio)-1))
}
function attatchCanvasListeners () {
	var scrollmargin = 100;
	var moveMap = document.getElementById("moveMap");
	var bigMap = document.getElementById("bigMap");
	moveMap.addEventListener("mousemove", (mouseEvent)=>{
		if(results.battleground.active()) {
			camera.moveX=0;
			camera.moveY=0;
			return;
		}
		if(mouseEvent.offsetX < scrollmargin) camera.moveX= -moveSpeed((mouseEvent.offsetX)/scrollmargin);
		else if(mouseEvent.offsetX > camera.width -scrollmargin) camera.moveX= moveSpeed((camera.width - mouseEvent.offsetX)/scrollmargin)
		else camera.moveX = 0;
		
		if(mouseEvent.offsetY < scrollmargin) camera.moveY=-moveSpeed((mouseEvent.offsetY)/scrollmargin)
		else if(mouseEvent.offsetY > camera.height -scrollmargin) camera.moveY= moveSpeed((camera.width - mouseEvent.offsetY)/scrollmargin)
		else camera.moveY=0;
	});
	moveMap.addEventListener("mouseleave", () => {
		camera.moveX=0;
		camera.moveY=0;
	});
	moveMap.addEventListener("click", (mouseEvent) => {
		var tileX = Math.floor((mouseEvent.offsetX + camera.x)/camera.scale)
		var tileY = Math.floor((mouseEvent.offsetY + camera.y)/camera.scale)
		var tile = results.map[tileX] && results.map[tileX][tileY];
		results.mapNavigation.onTileClick(tile);
		draw();
	});
	bigMap.addEventListener("click", (mouseEvent) => {
		camera.x = mouseEvent.offsetX/results.config.scale()*camera.scale -camera.width/2;
		camera.y = mouseEvent.offsetY/results.config.scale()*camera.scale -camera.height/2;
		draw();
	});
}