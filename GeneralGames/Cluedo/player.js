function Player(name){
	
	var player = {};
	player.name = name;
	
	player.initialize = function (possibleCards,playerNames,cards){}
	player.observe = function (player,requestedCards,passers,rejector,card){};
	player.respond = function (player,requestedCards,passers,possibleCards){};
	player.guess = function (){};
	
	return player;
}

function IdiotPlayer(name){
	var player = {};
	player.name = name;
	
	player.initialize = function (possibleCards,playerNames,cards){
		player.possibleCards = possibleCards.filter(card => cards.map(c=>c.name).indexOf(card.name)==-1);
		player.categories = [...new Set(possibleCards.map(card => card.category))]
	}
	player.observe = function (active,requestedCards,passers,rejector,card){
		if(card == "none") {
			player.possibleCards= requestedCards; 
		}
		else if(card != "unknown")
			player.possibleCards = player.possibleCards.filter(c => card.name != c.name);
	};
	player.respond = function (active,requestedCards,passers,possibleCards){
		return possibleCards[Math.floor(Math.random()*(possibleCards.length))];
	};
	player.guess = function (){
		var result = [];
		for(var category of player.categories)
		{
			var possibleForCategory = player.possibleCards.filter(card => category==card.category);
			result.push(possibleForCategory[Math.floor(Math.random()*(possibleForCategory.length))]);
		}
		if(result.length == player.possibleCards.length) result.accusation = true;
		return result;
	};
	
	return player;

}

function playerCardMatrix(name){
	var self = {};
	self.name = name;
	self.players = [];
	self.observationsSinceGuess= 0;
	
	self.initialize = function (possibleCards,playerNames,cards){
		self.possibleCards = possibleCards;
		self.categories = [...new Set(possibleCards.map(card => card.category))];
		self.players = playerNames;
		
		self.halts = [];
		self.cardStatus = possibleCards.reduce((out,card)=>{out[card.name]=cards.map(c=>c.name).indexOf(card.name)!=-1?self.name:"unknown";return out;},{});
		self.playerCardMatrix = {};
		playerNames.forEach(player => self.playerCardMatrix[player]=possibleCards.map(card => card.name).reduce((out,a)=>{out[a]="unknown"; return out},[]),[]);
		
		self.playerCardMatrix[self.name] = self.playerCardMatrix[self.name].map(a=>"No");
		for(var card of cards) markCardLocation(card.name,self.name);
		
		
		
	};
	var markCardLocation = function (card,owner){
		for(var player of self.players) self.playerCardMatrix[player][card]="No";
		 self.playerCardMatrix[owner][card]="Yes";
		 self.cardStatus[card]= owner;
	}
	var updateHalts = function ()
	{
		var updated = false;
		for(var halt of self.halts)
		{
			var eliminatedCards = halt.cards.filter(card => self.playerCardMatrix[halt.rejector][card]=="No");
			if(eliminatedCards.length)halt.cards = halt.cards.filter(card => self.playerCardMatrix[halt.rejector][card]!="No");
			if(halt.cards.length ==1 && self.playerCardMatrix[halt.rejector][halt.cards[0]] != "Yes")
				markCardLocation(halt.cards[0],halt.rejector);
			updated = updated || eliminatedCards.length;
		}
		return updated;
	}
	var numericElimination = function (){
		var updated = false;
		
		var solutions = self.possibleCards.map(card => {return {card: card.name, isSolution: self.players.reduce((out,player)=>out && self.playerCardMatrix[player][card.name]=="No",true) }}).filter(card => card.isSolution);
		solutions = solutions.filter(solution => self.cardStatus[solution.card]!="solution");
		solutions.forEach(solution=>{self.cardStatus[solution.card] = "solution";});
		
		for(var i= 0; i< self.players.length;i++)
		{
			var player = self.players[i];
			var maxCards = Math.ceil((self.possibleCards.length-self.categories.length)/self.players.length) 
				- (i >= self.players.length-(self.possibleCards.length-self.categories.length)%self.players.length ? 1:0);
			var knownCards = self.possibleCards.map(card => card.name).filter(card => self.cardStatus=='Yes');
			var deadCards = self.possibleCards.map(card => card.name).filter(card => self.cardStatus=='No');
			if(knownCards.length == maxCards && self.possibleCards.length != deadCards.length +knownCards.length)
			{
				updated = true;
				self.possibleCards.map(card => card.name).forEach(
					card => self.playerCardMatrix[player][card] = self.playerCardMatrix[player][card]=="Yes"?"Yes":"No"
				);
			}
		}
		//TODO: category elimination
		for(var category of self.categories)
		{
			var cards = self.possibleCards.filter(card => card.category == category).filter(card => ["unknown","solution"].indexOf(self.cardStatus[card.name])!=-1);
			if(cards.length == 1 && self.cardStatus[cards[0].name]!="solution")
			{
				self.cardStatus[cards[0].name] = "solution";
			}
		}
		return updated;
	}
	self.report = function  (){
		console.log(self.name);
		console.log("cards still in doubt",self.possibleCards.map(card =>card.name).filter(card => self.cardStatus[card]=="unknown"));
		console.log("cards known",self.possibleCards.map(card =>card.name).filter(card => self.cardStatus[card]!="unknown"&& self.cardStatus!="halt"));
		console.log("card matrix",self.playerCardMatrix);
		console.log("card status",self.cardStatus);
		console.log("halts",self.halts);
		console.log("----------------------");

	}
	self.observe = function (active,requestedCards,passers,rejector,evidenceRevealed){
		self.observationsSinceGuess++;
		for(var passer of passers)
			for(var card of requestedCards)
				self.playerCardMatrix[passer][card.name]="No";
		
		if(rejector!="none" && rejector!="game"){
			self.halts.push({cards:requestedCards.map(c=>c.name).filter(card => self.playerCardMatrix[rejector][card]!="No"),rejector:rejector});
			self.halts[self.halts.length-1].cards.forEach(card=> {if(self.playerCardMatrix[rejector][card]=="unknown")self.playerCardMatrix[rejector][card] ="halt"});
		}
		
		if(evidenceRevealed != "unknown" && evidenceRevealed!="none")
			markCardLocation(evidenceRevealed.name,rejector);
		
		//TODO: check for inferences
		//TODO: run until not more info!
		//check all halts for elimination
		
		do {
			//console.log(self.possibleCards.map(card =>card.name).filter(card => self.cardStatus[card]=="solution"));
		}while (updateHalts()==true || numericElimination()==true);
		if(self.possibleCards.map(card =>card.name).filter(card => self.cardStatus[card]=="solution").length == self.categories.length)
		{
			//console.log("Eureka!",self.observationsSinceGuess);
		}
	};
	self.respond = function (active,requestedCards,passers,possibleCards){
		return possibleCards[Math.floor(Math.random()*(possibleCards.length))];
	};
	self.guess = function (){
		self.observationsSinceGuess=0;
		var result = [];
		var solutionCards = self.possibleCards.filter(card => self.cardStatus[card.name]=="solution")
		var possibleCards = self.possibleCards.filter(card => self.cardStatus[card.name]=="unknown");
		if(solutionCards.length == self.categories.length) 
		{
			solutionCards.accusation = true;
			return solutionCards;
		}
		for(var category of self.categories)
		{
			var possibleForCategory = possibleCards.concat(solutionCards).filter(card => category==card.category);
			result.push(possibleForCategory[Math.floor(Math.random()*(possibleForCategory.length))]);
		}
		return result;
	};
	
	return self;
}

function CategoryPlayer(name){
	
	var self = playerCardMatrix(name);
	self.name = name;

	self.guess = function (){
		self.observationsSinceGuess=0;
		var result = [];
		var solutionCards = self.possibleCards.filter(card => self.cardStatus[card.name]=="solution")
		var unknownCards = self.possibleCards.filter(card => self.cardStatus[card.name]=="unknown");
		var personalCards = self.possibleCards.filter(card => self.cardStatus[card.name]==self.name);
		
		if(solutionCards.length == self.categories.length) 
		{
			solutionCards.accusation = true;
			return solutionCards;
		}
		var chosenCategoryToSolve = false;
		for(var category of self.categories)
		{
			if(solutionCards.map(card=>card.category).indexOf(category)!=-1)
				result.push(solutionCards.filter(card => card.category==category)[0]);
			else if (chosenCategoryToSolve && personalCards.filter(card => card.category==category).length)
				result.push(randomElement(personalCards.filter(card => card.category == category)));
			else{
				chosenCategoryToSolve=true;
				result.push(randomElement(unknownCards.filter(card => category==card.category)));
			}
		}
		if(result.indexOf(undefined)!=-1) console.log(result,solutionCards,unknownCards,personalCards);
		return result;
	};
	
	return self;
}

function MostInfoPlayer(name){
	
	var self = playerCardMatrix(name);
	self.name = name;

	self.guess = function (){
		self.observationsSinceGuess=0;
		var result = [];
		var solutionCards = self.possibleCards.filter(card => self.cardStatus[card.name]=="solution")
		var unknownCards = self.possibleCards.filter(card => self.cardStatus[card.name]=="unknown");
		var weights = unknownCards.map( card => {return {card:card,
			weight:self.players.reduce((output,playerName) => 
				{ return output + (self.playerCardMatrix[playerName][card.name] == "unknown"?1:0)},0)}});
		
		var mysteriousCards = weights.filt
		
		if(solutionCards.length == self.categories.length) 
		{
			solutionCards.accusation = true;
			return solutionCards;
		}
	};
	
	return self;
}