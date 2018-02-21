//From stack overflow
//TODO: move shuffleArray to a different location?
var shuffleArray = function (array)
{
	var currentIndex = array.length, temporaryValue, randomIndex;
	// While there remain elements to shuffle...
	while (0 !== currentIndex) {

		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}
	return array;
}
var initializeHabitat = function (config,types){
	var habitat = {};
	habitat.creaturesByPosition = {};
	habitat.creatures = [];
	habitat.removedCreatureIds = [];
	habitat.run = true;
	
	habitat.randomPosition = function (){
		var rx = Math.random();
		var ry = Math.random();
		return Position(Math.floor(rx*habitat.canvas.dimensions.x),Math.floor(ry*habitat.canvas.dimensions.y));

	}
	habitat.positionIsValid = function(position)
	{
		//TODO: should be in habitat or in position file?
		return position.x>=0 
			&& position.y>=0 
			&& position.x < habitat.canvas.dimensions.x 
			&& position.y < habitat.canvas.dimensions.y;
	}
	habitat.eatIfEdible = function (predator,prey){
		var recipe = predator.type.consumes().filter(a => prey.type.name() == a.name)[0];
		if(recipe)
		{
			//TODO: make sure we know which habitat!
			habitat.removeCreatureFromLists(prey);
			predator.energy += prey.energy* recipe.effeciency()/100;
			return true;
		}
		return false;
	}
	habitat.removeCreatureFromLists = function (creature){
		habitat.removedCreatureIds[creature.id] = true;
		habitat.creaturesByPosition[creature.position.hash()]=habitat.creaturesByPosition[creature.position.hash()].filter(a => a.id != creature.id);
	}
	habitat.addCreature = function (creature){
		habitat.creatures.push(creature);
		if(!habitat.creaturesByPosition[creature.position.hash()])habitat.creaturesByPosition[creature.position.hash()]=[];
		habitat.creaturesByPosition[creature.position.hash()].push(creature);
	}
	habitat.flushRemovedCreatures = function (){
		habitat.creatures = habitat.creatures.filter(a => !habitat.removedCreatureIds[a.id]);
		habitat.removedCreatureIds = [];
	}
	habitat.generateAndTakeMovement = function (creature){
		//generate move direction
		do{
			var position = generatePositionChange(creature.position,1);
		} while (!habitat.positionIsValid(position))
		// move creature in mapkey
		habitat.moveCreature(creature,position);
	}
	habitat.moveCreature = function (creature,position){
		if(!habitat.creaturesByPosition[creature.position.hash()])
			habitat.creaturesByPosition[creature.position.hash()]=[];
		habitat.creaturesByPosition[creature.position.hash()]=habitat.creaturesByPosition[creature.position.hash()].filter(a => a.id != creature.id);
		if(!habitat.creaturesByPosition[position.hash()])
			habitat.creaturesByPosition[position.hash()]=[];
		habitat.creaturesByPosition[position.hash()].push(creature);
		creature.position=position;
	}
	habitat.eatingAction = function (creature){
		//TODO: possible to eat everything? perhaps a limit on how much at a time?
		//TODO: intelligent selection of food
		for(neighbor of habitat.creaturesByPosition[creature.position.hash()])
			{
				if(habitat.eatIfEdible(creature,neighbor)) break;
				if(habitat.eatIfEdible(neighbor,creature)) break;
			}
	}
	habitat.growCreature = function (creature)
	{
		//TODO: shade competition other than "first Created!"
		habitat.creaturesByPosition[creature.position.hash()].sort((a,b)=> a.id < b.id ? -1:1);
		if(creature.type.growth() && habitat.creaturesByPosition[creature.position.hash()][0] == creature){
			creature.energy += creature.type.growth();
		}

	}
	habitat.reproduceCreatureIfViable = function(creature)
	{
		if(creature.type.reproductionPoint() <= creature.energy)
		{
			var counter = 0;
			do{
				var position = generatePositionChange(creature.position,creature.type.reproductiveScatter.generateDistance());
			}while (!habitat.positionIsValid(position) && counter++ < 1000)
			if(counter>=1000) position = Position(creature.position.x,creature.position.y);
			
			var baby = Creature(creature.type,position, creature.type.startingStorage(),habitat.numTicks());
			habitat.addCreature(baby);
			creature.energy -= creature.type.reproductionCost();
		}
	}
	habitat.upkeepAndStarvation = function (creature)
	{
		creature.energy-=creature.type.upkeep();
		if(creature.energy<0)habitat.removeCreatureFromLists(creature);
	}
	habitat.tick = function (){
		//shuffle creatures
		shuffleArray(habitat.creatures);
		for(var creature of habitat.creatures)
		{
			if(habitat.removedCreatureIds[creature.id])continue;
			
			creature.type.move.generateDistance(); //TODO: seperate move from creature type without spamming data!
			for(var move =0;move<creature.type.move.distance();move++)
			{
				//move phase
				habitat.generateAndTakeMovement(creature);
				//eat phase
				habitat.eatingAction(creature);
			}
		}
		habitat.flushRemovedCreatures();
		//TODO: prevent new creatures from taking a turn?-- they are added and run in the same loop
		for(var creature of habitat.creatures)
		{
			//growth phase
			habitat.growCreature(creature);
			//upkeep phase
			habitat.upkeepAndStarvation(creature);
			//reproduction phase
			habitat.reproduceCreatureIfViable(creature);
		}
		habitat.flushRemovedCreatures();
		habitat.numTicks(habitat.numTicks()+1);
		
		if(habitat.run)window.setTimeout(habitat.tick,habitat.tickTime);
	}


	habitat.canvas = {};
	habitat.canvas.dimensions = config.dimensions;
	habitat.canvas.scale = config.scale;
	habitat.tickTime = config.tickTime;
	habitat.numTicks = ko.observable(0);

	if(config.seed)Math.seedrandom(config.seed);
	for(var i in config.creatureCounts)
	{
		//TODO: input validation!
		for(var creatureCount = 0; creatureCount< config.creatureCounts[i];creatureCount++ )
		{
			if(!types.byName()[i]) {
				console.log("bad creature type given! "+i+" does not exist in creature config!");
				continue;
			}
			var creature = new Creature(types.byName()[i],habitat.randomPosition(),types.byName()[i].reproductionPoint()- types.byName()[i].reproductionCost());
			habitat.addCreature(creature);
		}
	}
	
	return habitat;
}
