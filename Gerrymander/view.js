var View = function (game){
	var view = {};
	view.game = game;
	
	view.currentBlock = ko.observable();

	view.currentPartyChange = ko.observable();
	view.currentConstitChange = ko.observable();
	view.currentZoning = ko.observable();
	
	view.colorMode = ko.observable("constituencies");//constituencies, parties
	view.blockDisplay = ko.pureComputed (function (){
		var result = [];
		for(var i = 0;i<10;i++){
			result.push([]);
		}
		for(var i = 0;i<10;i++)
		for(var j = 0; j<10;j++)
			result[j][i] = game.squares()[i]()[j]
		
		return result;
	});
	view.possibleBuildings = ko.pureComputed(function (){
		if(!view.currentBlock() || !view.currentBlock().contents().filter(c=>c.name=="zone").length)
			return[];
		var base = ["church","park","housing","newspaper","resturants"];
		return base;
	});
	view.possibleConstitChanges = ko.pureComputed(function (){
		if(!view.currentBlock())return [];
		var b = view.currentBlock();
		if(game.constitSize() [game.blockConstits()[b.x][b.y].name]<=8) return [];
		if(!game.blockConstits()[b.x][b.y].canLoose([b.x,b.y])) return [];
		return adjacents.map(adj=>
			(b.x+adj[0]>9 || b.x+adj[0]<0 || b.y+adj[1]>9 || b.y+adj[1]<0)? undefined:game.blockConstits()[b.x+adj[0]][b.y+adj[1]] 
		)
		.filter(c=>c)
		.filter((constit,index,array)=>array.indexOf(constit)==index)
		.filter(c=>game.blockConstits()[b.x][b.y].name!=c.name)
		.filter(c=> game.constitSize()[c.name] <12);
	});
	view.possiblePartyChanges = ko.pureComputed(function (){
		if(!view.currentBlock())return [];
		var b = view.currentBlock();
		return adjacents.map(adj=>
			(b.x+adj[0]>9 || b.x+adj[0]<0 || b.y+adj[1]>9 || b.y+adj[1]<0)? undefined:game.squares()[b.x+adj[0]]()[b.y+adj[1]] 
		)
		.filter(c=>c)
		.map(block=>block.party())
		.filter((block,index,array)=>array.indexOf(block)!=index) //only keep duplicates
		.filter((block,index,array)=>array.indexOf(block)==index) //remove additional duplicates
		.filter(party=>party!=b.party());

	});
	view.gerryMander = function (){
		if(!view.currentBlock() || !view.currentConstitChange() 
			|| !game.currentParty() || !game.currentParty().readyStaff()) return;
		return game.gerryMander(view.currentBlock(),view.currentConstitChange());
	};
	view.build = function (){
		if(!view.currentBlock() || !view.currentZoning()) return;
		game.build(view.currentBlock(),view.currentZoning());
	}
	view.zone = function (){
		game.zone();
	}
	view.endTurn = function (){
		game.endTurn();
	}
	view.campaign = function (){
		if(!view.currentBlock() || !view.currentPartyChange() 
			|| !game.currentParty() || game.currentParty().readyStaff()<2) return;
		game.campaign(view.currentBlock(),view.currentPartyChange());
	}
	view.setCurrentBlock = function (block){
		view.currentBlock(block);
	}
	view.undo = function (){
		var action = game.undo();
		view.currentBlock(action && action.block);
	}
	return view;
}