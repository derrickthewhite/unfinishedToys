//Math.seedrandom("derrick");
function copy(struct){
	return JSON.parse(JSON.stringify(struct));
}
function randomElement (array){
	return array[Math.floor(Math.random()*array.length)];
}
function arraySort(array){
	
	for(var i =0;i<100;i++)
	{
		var a= Math.floor(Math.random()*array.length);
		var b= Math.floor(Math.random()*array.length);
		var temp = array[a];
		array[a]=array[b];
		array[b] = temp;
	}
}
function CluedoGame(){
	var game = {};
	
	game.cards = [];
	game.categories = [];
	game.solution = [];
	game.players = [];
	game.currentPlayer = 0;
	game.playerCards = {};
	game.initialize = function (players,categoryNumbers){
		
		game.cards = [];
		for(var category in categoryNumbers)
		{
			game.categories.push(category);
			for(var i =0;i<categoryNumbers[category];i++)
				game.cards.push({category:category,name:category+"_"+i});
			game.solution.push(
				game.cards.filter(a=>a.category==category)[
					Math.floor(game.cards.filter(a=>a.category==category).length*Math.random())
				]
			);
		}
		var deck = game.cards.filter(a=>game.solution.indexOf(a)==-1)
		shuffleCards(deck);
		game.players = players;
		game.players.forEach(player=>game.playerCards[player.name]=[]);
		nextPlayer= game.players.length-1;
		for(var card of deck)
		{
			game.playerCards[game.players[nextPlayer].name].push(card);
			nextPlayer= (nextPlayer+game.players.length-1)%game.players.length;
		}
		game.currentPlayer = 0;
		
		for(var player of game.players){
			player.initialize(copy(game.cards),game.players.map(p=>p.name),copy(game.playerCards[player.name]));
		}
	}
	
	game.playRound= function (roundNumber)
	{
		var report ={};
		activePlayer = game.players[game.currentPlayer];
		var guess = activePlayer.guess();
		if(guess.accusation == true) {
			if(guess.filter(card => game.solution.map(c=>c.name).indexOf(card.name)!=-1).length == game.solution.length)
				return {victory:activePlayer.name};
			else for(player of game.players)
				player.observe(activePlayer.name,guess,[],"game","unknown");
		}
		var passers = [];
		var response = "none"; //TODO: make sure this can't be the name of a card!
		var rejector = "none"; //TODO: make sure this can't be the name of a player!
		for(var i =1;i < game.players.length;i++)
		{
			var evaluator = game.players[(i+game.currentPlayer)%game.players.length];
			var matches = game.playerCards[evaluator.name].filter(a=>guess.map(g=>g.name).indexOf(a.name)!=-1);
			if(matches.length>0)
			{
				response = matches.length==1
					?matches[0]
					:evaluator.respond(game.currentPlayer.name,guess,passers,matches);
				rejector=evaluator.name;
				break;
			}
			else passers.push(evaluator.name);
		}
		//console.log(roundNumber,activePlayer.name,guess.map(card=>card.name),passers,rejector,response); //TODO: LOG TO BETTER LOCATION
		if(rejector=="none")report.goodGuess=activePlayer.name;
		for(var player of game.players)
		{
			player.observe(activePlayer.name,guess,passers,rejector,(player== activePlayer || player.name == rejector? response: "unknown"));
		}
		game.currentPlayer = (game.currentPlayer+1)%game.players.length;
		return report;
	}
	
	function shuffleCards (deck){
		for(var i = 0;i<deck.length;i++){
			var a = Math.floor(Math.random()*deck.length);
			var b = Math.floor(Math.random()*deck.length);
			var temp = deck[a];
			deck[a] = deck[b];
			deck[b]=temp;
		}
	}
	
	return game;
}

function runGame()
{
	//Math.seedrandom("chelsea");
	var game = CluedoGame();
	var players = ["Adam","Benjamin","Christopher"];
	players = players.map(name =>IdiotPlayer(name));
	/*
	players.push(CategoryPlayer("Bond"));
	players.push(CategoryPlayer('Spymaster'));
	players.push(CategoryPlayer('Kingman'));
	players.push(CategoryPlayer('Mari'));
	*/
	/*
	players.push(playerCardMatrix("Einstein"));
	players.unshift(playerCardMatrix('Heisenburg'));
	players.unshift(playerCardMatrix('Newton'));
	players.unshift(playerCardMatrix('Euclid'));
	*/
	
	
	players.push(MostInfoPlayer('Edmundson'));
	
	arraySort(players);

	
	game.initialize(players,{"red":9,"yellow":6,"blue":6});
	
	var result = {winner:"none",rounds:0,previousGuesses:[]};
	for(var i = 0;i<200;i++)
	{
		var report= game.playRound(i);
		
		if(report.goodGuess)
			result.previousGuesses.push(report.goodGuess);
		if(report.victory){
			result.winner = report.victory;
			result.rounds = i;
			return result;
		}
	}
	console.log("grrrr!");
	console.log(game.solution.map(card => card.name));
	console.log(game.playerCards);
	game.players.forEach(player=>player.report());
	return result;
}

function runGames(){
	
	var victories = [];
	var correctGuesses = [];
	for(var i =0;i<500;i++)
	{
		Math.seedrandom(i+1000);
		var report =runGame();
		if(report.winner=="none")console.log(i," was the empty id");
		if(!victories[report.winner])victories[report.winner]=0;
		victories[report.winner]++;
		for(guess of report.previousGuesses)
		{
			if(!correctGuesses[guess])correctGuesses[guess]=0;
			correctGuesses[guess]++;
		}
		if(i%10==0)console.log(i);

	}
	console.log(victories,correctGuesses);
}