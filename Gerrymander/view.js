var View = function (game){
	var view = {};
	view.game = game;
	
	view.currentBlock = ko.observable();

	view.currentPartyChange = ko.observable();
	view.currentConstitChange = ko.observable();
	view.currentZoning = ko.observable();
	
	view.playerName = ko.observable(config.playerNames[0]);
	view.playerConstit = ko.observable();
	view.playerParty = ko.observable();
	
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
		if(view.currentBlock().contents().map(c=>c.name).indexOf("HQ")!=-1) return[];
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
		if(view.currentBlock().contents().map(c=>c.name).indexOf("HQ")!=-1) return [];
		return game.parties()
			.filter(p=>view.currentBlock().party()!=p)
			.sort((a,b)=>view.cheapCampaigns().indexOf(b)-view.cheapCampaigns().indexOf(a));
		/*
		var b = view.currentBlock();
		return adjacents.map(adj=>
			(b.x+adj[0]>9 || b.x+adj[0]<0 || b.y+adj[1]>9 || b.y+adj[1]<0)? undefined:game.squares()[b.x+adj[0]]()[b.y+adj[1]] 
		)
		.filter(c=>c)
		.filter(block=>block.contents().filter(c=>c.name=="park").length==0)
		.map(block=>block.party())
		.filter((block,index,array)=>array.indexOf(block)!=index) //only keep duplicates
		.filter((block,index,array)=>array.indexOf(block)==index) //remove additional duplicates
		.filter(party=>party!=b.party());
		*/

	});
	view.cheapCampaigns = ko.pureComputed(function (){
		var b = view.currentBlock();
		if(!b)return [];
		return adjacents.map(adj=>
			(b.x+adj[0]>9 || b.x+adj[0]<0 || b.y+adj[1]>9 || b.y+adj[1]<0)? undefined:game.squares()[b.x+adj[0]]()[b.y+adj[1]] 
		)
		.filter(c=>c)
		.filter(block=>block.contents().filter(c=>c.name=="park").length==0)
		.map(block=>block.party())
		.filter((block,index,array)=>array.indexOf(block)!=index) //only keep duplicates
		.filter((block,index,array)=>array.indexOf(block)==index) //remove additional duplicates
		.filter(party=>party!=b.party())
		.sort((a,b)=>a==game.currentPlayer().party()?-1:b==game.currentPlayer().party()?1:0);

	})
	view.campaignCost = ko.pureComputed(function (){
		return 2 * (view.cheapCampaigns().indexOf(view.currentPartyChange())!=-1?1:2);
	});
	view.unclaimedConstits = ko.pureComputed(function (){
		return game.constits().filter(c=>game.players().map(p=>p.constit()).indexOf(c)==-1)
	});
	view.gerryMander = function (){
		if(!view.currentBlock() || !view.currentConstitChange() 
			|| !game.currentPlayer() || !game.currentPlayer().readyStaff()) return;
		return game.gerryMander(view.currentBlock(),view.currentConstitChange());
	};
	view.build = function (){
		if(!view.currentBlock() || !view.currentZoning()) return;
		game.build(view.currentBlock(),view.currentZoning());
	}
	view.zone = function (){
		game.zone();
	}
	view.redistrict = function (){
		if(!view.currentBlock())return;
		var b = view.currentBlock()
		var districtA = game.blockConstits()[b.x][b.y];
		var districtB = ([[-1,0],[1,0],[0,-1],[0,1]])
			.map(dir=>game.blockConstits()[b.x+dir[0]][b.y+dir[1]])
			.filter(c=>c)
			.filter(c=>c!=districtA)
			.sort((a,b)=>game.constitSize()[b.name] - game.constitSize()[a.name])[0];
		if(!districtB || game.constitSize()[districtB.name]+ game.constitSize()[districtA.name] <24) return;
		game.redistrict(districtA,districtB);
	}
	view.endTurn = function (){
		game.endTurn();
	}
	view.startGame = function (){
		if(game.players().length <2){
			console.log("Not enough Players!");
			return;
		}
		game.endTurn(true,true);
	}
	view.campaign = function (){
		if(!view.currentBlock() || !view.currentPartyChange() 
			|| !game.currentPlayer() || game.currentPlayer().readyStaff()<2) return;
		if(view.currentBlock().contents().map(c=>c.name).indexOf("HQ")!=-1) return;
		game.campaign(view.currentBlock(),view.currentPartyChange());
	}
	view.headquarters = function (){
		if(!view.currentBlock()
			|| !game.currentPlayer() || game.currentPlayer().readyStaff()<1) return;
		var block = view.currentBlock();
		if(game.currentPlayer().constit() != game.blockConstits()[block.x][block.y]){
			console.log("not allowed to headquarters outside of your constit");
			return;
		}
		var action = "create";
		var oldLocation = game.blockConstits()[block.x][block.y].blocks()
			.map(b=>game.squares()[b[0]]()[b[1]])
			.filter(block=>block.contents().map(c=>c.name).indexOf('HQ')!=-1)[0];
		if(oldLocation) action = "move";
		if(block.contents().filter(c=>c.name=="HQ").length) action = "remove";

		game.headquarters(action,block,oldLocation);
	}
	view.setCurrentBlock = function (block){
		view.currentBlock(block);
	}
	view.addPlayer = function (){
		if(game.players().map(p=>p.name()).indexOf(view.playerName())!=-1){
			console.log(view.playerName()," already exists!");
			return;
		}
		game.addPlayer(view.playerName(),view.playerConstit(),view.playerParty());
		view.suggestNextPlayer();
	}
	view.suggestNextPlayer = function (){
		view.playerName(config.playerNames
			.filter(n=>game.players().map(p=>p.name()).indexOf(n)==-1)[0]);
		var constits = view.unclaimedConstits().sort((a,b)=>{
			var aParty = game.constitControl()[a.name];
			var bParty = game.constitControl()[b.name];
			if(aParty == "none") return 1;
			if(bParty == "none") return -1;
			var aPlayerCount = game.players().map(p=>p.party()).filter(party=>party==aParty).length;
			var bPlayerCount = game.players().map(p=>p.party()).filter(party=>party==bParty).length;
			if(aPlayerCount != bPlayerCount) return  aPlayerCount-bPlayerCount;
			var toReturn = 0;
			if(game.partyPower()[aParty.name].length!=game.partyPower()[bParty.name].length)
				toReturn =  game.partyPower()[bParty.name].length-game.partyPower()[aParty.name].length;
			else if(game.constitControlRank()[a.name]!=game.constitControlRank()[b.name])
				toReturn=  game.constitControlRank()[b.name]-game.constitControlRank()[a.name];
			else toReturn = game.election()[b.name][bParty.name]-game.election()[a.name][aParty.name];
			return toReturn;
		});
		console.log(constits);
		view.playerConstit(constits[0]);
		view.playerParty(game.constitControl()[constits[0].name]);
	}
	view.undo = function (){
		var action = game.undo();
		view.currentBlock(action && action.block);
	}
	return view;
}