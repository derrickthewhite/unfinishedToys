var config = {
	goblins:4,
	keyGoblins:2,
	swordGoblins:2,
	trolls: 8,
	lockedDoors:8,
	weakWalls: 8,
	chests: 8,
	stairs: 2,
	fire: 4,
	wells: 4,
	keys: 4,
	picks: 4,
	buckets: 4,
	swords: 4,
	shields: 1,
	potions: 2,
}

function randomChestItem() {
	
	/*
		Potions (+1 heart)
		Picks (let you knock down walls)
		Buckets (let you put out fires)
		Keys (let you open doors)
	*/
	var options = [
		"Potion",
		"Sword",
		"Pick",
		"Bucket",
		"Key"
	]
	var itemName = options[Math.floor(Math.random()*options.length)];
	
	return {
		name: itemName,
		icon: "assets/"+itemName+".svg"
	}
}

function placeObjects(objectTemplate, count){
	for(var i = 0; i< count; i++){
		placeObject(objectTemplate);
	}
}
function placeObject(objectTemplate) {
	var object = JSON.parse(JSON.stringify(objectTemplate));
	var coords = randomUnobstructedLocation();
	object.x = coords.x;
	object.y = coords.y;
	objects.push(object)
}

function placeDoorInWall(doorTemplate) {
	var door = JSON.parse(JSON.stringify(doorTemplate));
	
	door.x =  Math.floor(Math.random()*16+1)
	door.y =  Math.floor(Math.random()*16+1)
	
	var moveDirections = ["Up","Down","Left","Right"]
		.filter(dir=> !wallMove(door.x, door.y, dir));
	var moveDirection = moveDirections[Math.floor(Math.random()* moveDirections.length)];
	
	// Mostly coppied from locked doors -- this should probably be the base
	if(["Left","Right"].includes(moveDirection)){
		door.orient = "horiz";
		door.className= "Vertdoor"
	} 
	else {
		door.orient = "verti";
		door.className = "Horzdoor";
	}
	if(moveDirection == "Left")door.x = door.x-1;
	if(moveDirection == "Up")door.y = door.y-1;
	
	tX = Math.floor(door.x/9);
	tY = Math.floor(door.y/9);
	let maze = mazes[tX][tY];
	let x = door.x - tX*9;
	let y=door.y -tY*9;
	maze[door.orient][y][x] = false;

	doors.push(door);
}

function populateMaze() {
	
	if (protagonist === undefined){
		protagonist = {
			name: "protagonist",
			loyalty: "protagonist",
			icon: "assets/protagonist.svg",
			x: Math.floor(Math.random()*9),
			y: Math.floor(Math.random()*9),
			doors: ["locked Door"],
			hearts: 3,
			maxHearts: 3,
			score:0,
			resources: []
		};
	}
	
	characters.push(protagonist);
	
	for(var i = 0; i<config.goblins; i++) {
		var coords = randomUnobstructedLocation();
		var goblin = {
			name: "goblin",
			loyalty: "goblin",
			icon: "assets/Goblin.svg",
			x: coords.x,
			y: coords.y,
			lastX: 0,
			lastY: 0,
			doors: [],
			hearts: 1
		};
		characters.push(goblin);
	}
	for(var i = 0; i<config.keyGoblins; i++) {
		var coords = randomUnobstructedLocation();
		var goblin = {
			name: "key goblin",
			loyalty: "goblin",
			icon: "assets/KeyGoblin.svg",
			x: coords.x,
			y: coords.y,
			lastX: 0,
			lastY: 0,
			doors: ["locked Door"],
			resources: [
				{name: "Key"}
			],
			hearts: 1
		};
		characters.push(goblin);
	}
	
	for(var i = 0; i<config.swordGoblins; i++) {
		var coords = randomUnobstructedLocation();
		var goblin = {
			name: "sword goblin",
			loyalty: "goblin",
			icon: "assets/SwordGoblin.svg",
			x: coords.x,
			y: coords.y,
			lastX: 0,
			lastY: 0,
			doors: ["locked Door"],
			resources: [
				{name: "Sword"}
			],
			hearts: 1
		};
		characters.push(goblin);
	}
	
	for(var i = 0; i<config.trolls; i++) {
		var coords = randomUnobstructedLocation();
		var troll = {
			name: "troll",
			loyalty: "goblin",
			icon: "assets/Troll.svg",
			x: coords.x,
			y: coords.y,
			lastX: 0,
			lastY: 0,
			doors: [],
			hearts: 2
		};
		characters.push(troll);
	}
	
	doors.push({
		name: "tunnel",
		icon: "assets/Tunnel.svg",
		orient: "verti",
		x: 1,
		y: 8,
		open:true,
	});
	doors.push({
		name: "tunnel",
		icon: "assets/Tunnel.svg",
		orient: "verti",
		x: 16,
		y: 8,
		open:true,
	});
	doors.push({
		name: "tunnel",
		icon: "assets/Tunnel.svg",
		orient: "horiz",
		x: 8,
		y: 4,
		open:true,
	});
	doors.push({
		name: "tunnel",
		icon: "assets/Tunnel.svg",
		orient: "horiz",
		x: 8,
		y: 13,
		open:true,
	});
	
	// locked doors to provide shortcuts and not make the game impossible
	// extra blocking doors!
	// this code is for making walls in blocked areas!
	/*
	for(var i = 0; i< config.lockedDoors; i++) {
		var door = {
			x: Math.floor(Math.random()*18),
			y: Math.floor(Math.random()*18),
			icon: "assets/Lock.svg",
			name: "locked Door"
		}
		
		var moves = ["Up","Down","Left","Right"]
			.map(dir=> wallMove(door.x, door.y, dir))
			.filter(m => m);
		var selectedMove = moves[Math.floor(Math.random()* moves.length)];
		
		if(selectedMove.x != door.x){
			door.orient = "horiz";
			door.className= "Vertdoor"
		} 
		else {
			door.orient = "verti";
			door.className = "Horzdoor";
		}
		if(selectedMove.x < door.x)door.x = selectedMove.x
		if(selectedMove.y < door.y)door.y = selectedMove.y
		
		tX = Math.floor(door.x/9);
		tY = Math.floor(door.y/9);
		let maze = mazes[tX][tY];
		let x = door.x - tX*9;
		let y=door.y -tY*9;
		maze[door.orient][y][x] = false;
		
		doors.push(door);
	}
	//*/
	
	for(var i = 0; i< config.lockedDoors; i++) {
		placeDoorInWall({
			icon: "assets/Lock.svg",
			name: "locked Door"
		})
	}
	
	// weak wall doors!
	for(var i =0; i< config.weakWalls; i++) {
		placeDoorInWall({
			icon: "assets/WeakWall.svg",
			name: "weak wall"
		});
		/*
		var wall = {
			x: Math.floor(Math.random()*16+1),
			y: Math.floor(Math.random()*16+1),
			icon: "assets/WeakWall.svg",
			name: "weak wall"
		}
		
		var moveDirections = ["Up","Down","Left","Right"]
			.filter(dir=> !wallMove(wall.x, wall.y, dir));
		var moveDirection = moveDirections[Math.floor(Math.random()* moveDirections.length)];
		
		// Mostly coppied from locked doors -- this should probably be the base
		if(["Left","Right"].includes(moveDirection)){
			wall.orient = "horiz";
			wall.className= "Vertdoor"
		} 
		else {
			wall.orient = "verti";
			wall.className = "Horzdoor";
		}
		if(moveDirection == "Left")wall.x = wall.x-1;
		if(moveDirection == "Up")wall.y = wall.y-1;
		
		tX = Math.floor(wall.x/9);
		tY = Math.floor(wall.y/9);
		let maze = mazes[tX][tY];
		let x = wall.x - tX*9;
		let y=wall.y -tY*9;
		maze[wall.orient][y][x] = false;

		doors.push(wall);
		*/
	}
	
	for(var i =0; i<config.chests; i++) {
		placeObject({
			name: "Chest",
			loyalty: "object",
			icon: "assets/Treasure.svg",
			//contents: [randomChestItem(), randomChestItem()]
			description: "A box containing the precious and shining"
		})
	}
	
	placeObjects({
		name: "Stairs",
		loyalty: "object",
		icon: "assets/Stairs.svg"
	},config.stairs);
	
	placeObjects({
		name: "Fire",
		loyalty: "hazard",
		icon: "assets/Fire.svg",
		hearts: 1,
		description: "A raging fire. Does 1 damage. Can be put out with a bucket of water"
	},config.fire);
	
	
	for(var i = 0; i< 4; i++) {
		placeObject({
			name: "Lever",
			loyalty: "object",
			icon: "assets/Lever.svg",
			color: ["green","yellow","blue","purple"][i],
			maze: [{x:0,y:0}, {x:1,y:0},{x:0,y:1},{x:1,y:1}][i]
		});
	}
	
	placeObjects({
		name: "Well",
		loyalty: "object",
		icon: "assets/Well.svg",
		description: "refill your bucket here"
	},config.wells);
	
	placeObjects({
		name: "Pick",
		loyalty: "object",
		icon: "assets/Pick.svg",
		resource: true,
		description: "allow you to break through weak walls"
	},config.picks);
	
	placeObjects({
		name: "Bucket",
		loyalty: "object",
		icon: "assets/Bucket.svg",
		resource: true,
		description: "allow you to put out fire when full"
	},config.buckets);
	
	placeObjects({
		name: "Key",
		loyalty: "object",
		icon: "assets/Key.svg",
		resource: true,
		description: "Opens doors!"
	},config.keys);
	
	placeObjects({
		name: "Sword",
		loyalty: "object",
		icon: "assets/Sword.svg",
		resource: true,
		description: "In a fight, take one less damage"
	},config.swords);
	
	placeObjects({
		name: "Shield",
		loyalty: "object",
		icon: "assets/Shield.svg",
		resource: true,
		description: "In a fight, take one less damage"
	},config.shields);
	
	placeObjects({
		name: "Potion",
		loyalty: "object",
		icon: "assets/Potion.svg",
		description: "Heal one damage. not able to carry right now"
	},config.potions);
}