var config = {
	goblins:4,
	keyGoblins:2,
	swordGoblins:2,
	trolls: 4,
	fireElementals: 10,
	lockedDoors:8,
	weakWalls: 8,
	chests: 8,
	stairs: ["Fire Maze", "Goblin Town"],
	fire: 4,
	wells: 4,
	keys: 4,
	picks: 4,
	buckets: 4,
	swords: 4,
	shields: 1,
	potions: 2,
	// more permenant:
	itemLimit: 3
}

const levels = {
	"Test": {
		goblins:0,
		keyGoblins:0,
		swordGoblins:0,
		trolls: 0,
		fireElementals: 1,
		lockedDoors:0,
		weakWalls: 0,
		chests: 0,
		stairs: ["Troll Tunnel", "Goblin Town"],
		fire: 20,
		webs: 20,
		spiders: 1,
		wells: 0,
		keys: 0,
		picks: 0,
		buckets: 0,
		swords: 0,
		potions: 0,
	},
	"Spider Den": {
		goblins:4,
		keyGoblins:0,
		swordGoblins:4,
		trolls: 0,
		fireElementals: 0,
		spiders: 10,
		lockedDoors:0,
		weakWalls: 0,
		chests: 0,
		stairs: ["Troll Tunnel", "Fire Maze"],
		fire: 0,
		webs: 10,
		wells: 0,
		keys: 0,
		picks: 0,
		torches: 4,
		buckets: 0,
		swords: 0,
		potions: 0,
	},
	"Fire Maze": {
		goblins:3,
		keyGoblins:0,
		swordGoblins:3,
		trolls: 0,
		fireElementals: 20,
		lockedDoors:4,
		weakWalls: 4,
		chests: 8,
		stairs: ["Spider Den", "Goblin Town"],
		fire: 20,
		wells: 4,
		keys: 4,
		picks: 2,
		buckets: 4,
		swords: 2,
		potions: 2,
	},
	"Goblin Town": {
		goblins:4,
		keyGoblins:4,
		swordGoblins:4,
		trolls: 2,
		fireElementals: 1,
		lockedDoors:8,
		weakWalls: 8,
		chests: 8,
		stairs: ["Fire Maze", "Troll Tunnel"],
		fire: 4,
		wells: 4,
		keys: 4,
		picks: 4,
		buckets: 4,
		swords: 4,
		shields: 0,
		potions: 2,
	},
	"Troll Tunnel": {
		goblins:4,
		keyGoblins:2,
		swordGoblins:2,
		trolls: 12,
		lockedDoors:4,
		weakWalls: 4,
		chests: 8,
		stairs: ["Fire Maze", "Goblin Town"],
		fire: 0,
		wells: 0,
		keys: 4,
		picks: 4,
		buckets: 4,
		swords: 4,
		shields: 1,
		potions: 2,
	}
	
}

function placeObjects(objectTemplate, count){
	for(var i = 0; i< count; i++){
		placeObject(objectTemplate);
	}
}
function placeObjectAt(objectTemplate, coords){
	var object = JSON.parse(JSON.stringify(objectTemplate));
	object.x = coords.x;
	object.y = coords.y;
	objects.push(object)
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

function populateMaze(levelName) {
	
	//if(levelName == undefined) levelName = "Goblin Town";
	if(levelName == undefined) levelName = "Fire Maze";
	//if(levelName == undefined) levelName = "Spider Den";
	let level = levels[levelName];
	if(!level) level = config;
	
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
			resources: [
				{
					name: "Torch",
					loyalty: "object",
					icon: "assets/Torch.svg",
					resource: true,
					description: "Portable Fire",
					weaponType: "fire",
					weaponDamage: 1
				},
				{
					name: "Shield",
					loyalty: "object",
					icon: "assets/Shield.svg",
					resource: true,
					description: "In a fight, take one less damage",
					weaponType: "physical-armor",
					weaponDamage: 1
				},
				{
					name: "Bucket",
					loyalty: "object",
					icon: "assets/Bucket.svg",
					resource: true,
					description: "allow you to put out fire when full"
				}
			]
		};
	}
	
	characters.push(protagonist);
	
	for(var i = 0; i<level.goblins; i++) {
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
	for(var i = 0; i<level.keyGoblins; i++) {
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
	
	for(var i = 0; i<level.swordGoblins; i++) {
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
				{
					name: "Sword",
					weaponDamage: 1,
					weaponType: "physical"
				}
			],
			hearts: 1
		};
		characters.push(goblin);
	}
	
	for(var i = 0; i<level.trolls; i++) {
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
			maxHearts: 2,
			liveLoyalty: "goblin",
			liveIcon: "assets/Troll.svg",
			regenerates: true,
			hearts: 2,
			description: "A Troll. An enemy that regenerates when killed"
		};
		characters.push(troll);
	}
	
		for(var i = 0; i<level.trolls; i++) {
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
			maxHearts: 2,
			liveLoyalty: "goblin",
			liveIcon: "assets/Troll.svg",
			regenerates: true,
			hearts: 2,
			description: "A Troll. An enemy that regenerates when killed"
		};
		characters.push(troll);
	}
	
	for(var i = 0; i<level.fireElementals; i++) {
		var coords = randomUnobstructedLocation();
		var elemental = {
			name: "Fire Elemental",
			loyalty: "goblin",
			icon: "assets/FireElemental.svg",
			x: coords.x,
			y: coords.y,
			lastX: 0,
			lastY: 0,
			doors: [],
			hearts: 1,
			description: "A Fire Elemental. Only damaged by water",
			damageType: "fire",
			vulnerable: ["water"],
			ignores: ["physical", "fire"]
		}
		characters.push(elemental);
	}
	
	for(var i = 0; i<level.spiders; i++) {
		var coords = randomUnobstructedLocation();
		var elemental = {
			name: "Spider",
			loyalty: "goblin",
			icon: "assets/spider.svg",
			x: coords.x,
			y: coords.y,
			lastX: 0,
			lastY: 0,
			doors: [],
			hearts: 2,
			description: "A Spider",
			ignores: ["web"]
		}
		characters.push(elemental);
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
	
	for(var i = 0; i< level.lockedDoors; i++) {
		placeDoorInWall({
			icon: "assets/Lock.svg",
			name: "locked Door"
		})
	}
	
	// weak wall doors!
	for(var i =0; i< level.weakWalls; i++) {
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
	
	for(var i =0; i<level.chests; i++) {
		placeObject({
			name: "Chest",
			loyalty: "object",
			icon: "assets/Treasure.svg",
			description: "A box containing the precious and shining"
		})
	}
	
	for(var stairLocation of level.stairs) {
		placeObject({
			name: "Stairs",
			destination: stairLocation,
			loyalty: "object",
			icon: "assets/Stairs.svg",
			description: "staircase to "+ stairLocation
		});
	}

	
	placeObjects({
		name: "Fire",
		loyalty: "hazard",
		icon: "assets/Fire.svg",
		damageType: "fire",
		hearts: 1,
		description: "A raging fire. Does 1 damage. Can be put out with a bucket of water"
	},level.fire);
	
	placeObjects({
		name: "Web",
		loyalty: "hazard",
		icon: "assets/Web.svg",
		damageType: "web",
		hearts: 1,
		description: "A sticky web. Does 1 damage"
	},level.webs);
	
	
	for(var i = 0; i< 4; i++) {
		let quadrants = [{x:0,y:0}, {x:1,y:0},{x:0,y:1},{x:1,y:1}];
		placeObjectAt({
			name: "Lever",
			loyalty: "object",
			icon: "assets/Lever.svg",
			color: ["green","yellow","blue","purple"][i],
			maze: quadrants[i]
		}, randomUnobstructedQuadrantLocation(quadrants[i].x, quadrants[i].y));
	}
	
	placeObjects({
		name: "Well",
		loyalty: "object",
		icon: "assets/Well.svg",
		description: "refill your bucket here"
	},level.wells);
	
	placeObjects({
		name: "Pick",
		loyalty: "object",
		icon: "assets/Pick.svg",
		resource: true,
		description: "allow you to break through weak walls",
		weaponType: "physical",
		weaponDamage: 1
	},level.picks);
	
	placeObjects({
		name: "Bucket",
		loyalty: "object",
		icon: "assets/Bucket.svg",
		resource: true,
		description: "allow you to put out fire when full"
	},level.buckets);
	
	placeObjects({
		name: "Key",
		loyalty: "object",
		icon: "assets/Key.svg",
		resource: true,
		description: "Opens doors!"
	},level.keys);
	
	placeObjects({
		name: "Torch",
		loyalty: "object",
		icon: "assets/Torch.svg",
		resource: true,
		description: "Portable Fire",
		weaponType: "fire",
		weaponDamage: 1
	},level.torches);
	
	placeObjects({
		name: "Sword",
		loyalty: "object",
		icon: "assets/Sword.svg",
		resource: true,
		description: "In a fight, take one less damage",
		weaponType: "physical",
		weaponDamage: 2
	},level.swords);
	
	placeObjects({
		name: "Shield",
		loyalty: "object",
		icon: "assets/Shield.svg",
		resource: true,
		description: "In a fight, take one less damage",
		weaponType: "physical-armor",
		weaponDamage: 1
	},level.shields);
	
	placeObjects({
		name: "Potion",
		loyalty: "object",
		icon: "assets/Potion.svg",
		description: "Heal one damage. not able to carry right now"
	},level.potions);
}