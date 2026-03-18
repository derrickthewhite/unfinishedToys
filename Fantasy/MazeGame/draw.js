function draw() {
	var ULKey =domMaze("ULMaze", mazes[0][0], "green");
	var URKey =domMaze("URMaze", mazes[1][0], "yellow");
	var LLKey =domMaze("LLMaze", mazes[0][1], "blue");
	var LRKey =domMaze("LRMaze", mazes[1][1], "purple");
	
	var key = [];
	for(var i = 0;i<9;i++){
		key[i]=[];
		key[i+9]=[];
		for(var j = 0;j<9;j++)
		{
			key[i][j] = ULKey[i][j];
			key[i][j+9] = URKey[i][j];
			key[i+9][j] = LLKey[i][j];
			key[i+9][j+9] = LRKey[i][j];
		}
	}
	key[18]=[];
	
	for(var object of objects){
		let image = document.createElement("img");
		image.src = object.icon;
		image.className = "object";
		if(object.name == "Lever"){
			image.style.border = "solid "+object.color+" 1px";
		}
		image.message = object.name+":" +object.description
		image.onclick = () =>  {showDescription(image.message)};
		key[object.y][object.x].appendChild(image);
	}
	
	for(var door of doors){
		if(door.orient == "horiz"){
			var top = key[door.y][door.x];
			var bottom = key[door.y+1][door.x];
			var image = document.createElement("img");
			image.src = door.icon;
			image.className = "Vertdoor";
			top.appendChild(image);
		}
		if(door.orient == "verti"){
			var left = key[door.y][door.x];
			var right = key[door.y][door.x+1];
			var image = document.createElement("img");
			image.src = door.icon;
			image.className = "Horzdoor";
			left.appendChild(image);
		}
	}
	document.getElementById("inventory").replaceChildren();
	var scoreHolder = document.createElement("span");
	var scoreImage = document.createElement("img");
	scoreImage.src= "assets/Treasure.svg";
	var score = document.createElement("span");
	score.className = "score";
	score.innerHTML = ":"+protagonist.score;
	scoreHolder.appendChild(scoreImage);
	scoreHolder.appendChild(score);
	scoreHolder.style.position = "relative";
	document.getElementById("inventory").appendChild(scoreHolder);
	for(var i =0;i < protagonist.maxHearts; i++){
		var image = document.createElement("img");
		if(i<protagonist.hearts){
			image.src = "assets/Heart.svg"
		} else {
			image.src = "assets/EmptyHeart.svg"
		}
		document.getElementById("inventory").appendChild(image);
	}
	for(var resource of protagonist.resources){
		let image = document.createElement("img");
		image.src = resource.icon;
		image.message = resource.name+":" +resource.description
		image.onclick = () =>  {showDescription(image.message)};

		document.getElementById("inventory").appendChild(image);
	}
	for(var character of characters){
		var image = document.createElement("img");
		image.src = character.icon;
		image.className = "character";
		key[character.y][character.x].appendChild(image);
	}
	
	if(protagonist.hearts <= 0) {
		document.getElementById("gameOver").style.display = "";
		document.getElementById("score").innerHTML = "" + protagonist.score;
	} else {
		document.getElementById("gameOver").style.display = "none";
	}
}
function domMaze(element, m, outsideColor) {
	var dom = document.getElementById(element);
	dom.replaceChildren();
	var key = [];
	for(var i = 0; i< m.x; i++){
		key[i] = [];
		for(var j = 0; j< m.y; j++) {
			let div = document.createElement("div");
			dom.appendChild(div);
			key[i][j] = div;
			div.className = "cell";
			div.x = j;
			div.y = i;
			if(!m.horiz[i][j-1])
				div.style.borderLeft = "solid black 1px";
			else
				div.style.paddingLeft = "1px"
			if (m.horiz[i][j-1] === false)
				div.style.borderLeft = "solid red 1px"
				
			if(!m.horiz[i][j])
				div.style.borderRight = "solid black 1px";
			else
				div.style.paddingRight = "1px"
			if(m.horiz[i][j] === false)
				div.style.borderRight = "solid red 1px";
				
			if(!m.verti[i-1] || !m.verti[i-1][j])
				div.style.borderTop = "solid black 1px";
			else
				div.style.paddingTop = "1px"
				
			if(!m.verti[i][j])
				div.style.borderBottom = "solid black 1px";
			else
				div.style.paddingBottom = "1px"
				
			if (m.verti[i][j] === false)
				div.style.borderBottom = "solid red 1px";
			if(m.verti[i-1] && m.verti[i-1][j] === false)
				div.style.borderTop = "solid red 1px";
			
			outsideColor = outsideColor?outsideColor:"green";
			if(i == 0) div.style.borderTop = "solid "+outsideColor+" 1px";
			if(i == m.x-1) div.style.borderBottom = "solid "+outsideColor+" 1px";
			if(j == 0) div.style.borderLeft = "solid "+outsideColor+" 1px";
			if(j == m.y-1) div.style.borderRight = "solid "+outsideColor+" 1px";
		}
		dom.appendChild(document.createElement("br"))
	}
	return key;
}