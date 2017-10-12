
var painter ={};
painter.context = {
	background:'#9999ff',
	widthMethod: "window",
	width: .9,
	heightMethod:"pixels",
	height: 100
};
function setup (context){
	painter.canvas = document.getElementById("painter");
	painter.ctx = painter.canvas.getContext("2d");
	painter.peices = [];
	painter.time = 0;

	painter.context = context;
	if(!painter.context.background)painter.context.background = '#9999ff';
}

painter.runGraphics = function()
{
	setup(painter.context);

	setInterval(tick,1000);
}

function tick()
{
	if(painter.context.widthMethod == "window")
		painter.canvas.width = Math.floor(window.innerWidth*painter.context.width);
	else
		painter.canvas.width = painter.context.width;
	if(painter.context.heightMethod == "window")
		painter.canvas.height = Math.floor(window.innerHeight*painter.context.height);
	else
		painter.canvas.height = painter.context.height;
	painter.move(painter.time);
	painter.draw();
	painter.time++;
}

painter.draw = function ()
{
	painter.ctx.fillStyle = painter.context.background;
	painter.ctx.fillRect(0,0,painter.canvas.scrollWidth,painter.canvas.scrollHeight);
	for(var i in painter.peices)
		painter.peices[i].draw(0,0,0,painter.time,painter.ctx);
};
painter.newPiece = function (x,y,rotation,type,draw)
{
	// draw : x,y,r,t,ctx => draws piece on board OR
	// draw is an image
	var result = {x:x,y:y, rotation:rotation};
	if(type=='image')result.draw = function (x,y,r,t,ctx){painter.drawRotatedImage(painter.ctx,draw,result.x+x,result.y+y,result.rotation+r);};
	else result.draw = function (x,y,r,t,ctx){draw(result.x+x,result.y+x,result.rotation+r,t,ctx);}
	return result;
};

painter.move = function (time){
// do nothing, place holder to be overwritten
};

painter.drawRotatedImage = function (ctx,draw,x,y,angle)
{
	console.log(draw);
	// save the current co-ordinate system
	// before we screw with it
	ctx.save();

	// move to the middle of where we want to draw our image
	ctx.translate(x, y);

	// rotate around that point, converting our
	// angle from degrees to radians
	ctx.rotate(angle * Math.PI/180);

	// draw it up and to the left by half the width
	// and height of the image
	var image = draw;
	ctx.drawImage(image, -(image.width/2), -(image.height/2));

	// and restore the co-ords to how they were when we began
	ctx.restore();
}