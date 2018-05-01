function Game (){
	var game = {};
	game.constits = ko.observableArray([]);
	game.squares = ko.observableArray([]);
	game.parties = ko.observableArray([]);
	
	game.currentParty = ko.observable();
	game.governmentParty = ko.observable();
	
	game.undoAction = ko.observable();
	game.turns = ko.observable(0);
	
	game.blockConstits = ko.pureComputed(function (){
		var result = [];
		for(var i =0;i<10;i++)result.push([]);
		
		game.constits().forEach(c=>c.blocks().forEach(b=>result[b[0]][b[1]] = c));
		return result;
	});
	game.constitSize = ko.pureComputed(function (){
		var result = {};
		game.constits().map(constit=> {
			return {
				name:constit.name,
				size:Object.keys(game.election()[constit.name])
					.reduce((out,a)=>game.election()[constit.name][a]+out,0)
			}
		}).forEach(constit=>result[constit.name]=constit.size);
		return result;
	});
	game.election = ko.pureComputed(function (){
		var results = [];
		
		for(var constit of game.constits()){
			results[constit.name]={}
			for(var p of game.parties())results[constit.name][p.name]=0;
			for(var blockLoc of constit.blocks()){
				var block = game.squares()[blockLoc[0]]()[blockLoc[1]];
				results[constit.name][block.party().name]++;
				results[constit.name][block.party().name]+=block.contents().filter(c=>c.name == "housing").length
				results[constit.name][block.party().name]-=block.contents().filter(c=>c.name == "park").length
			}
		}
		return results;
	});
	game.constitControl = ko.pureComputed(function (){
		var result = [];
		var election = game.election();
		for(var constit in game.election()){
			/*
			var maxParty = Object.keys(election[constit])
				.reduce((a,b)=>election[constit][a]<election[constit][b]?b:a);
			var blockVotes = Object.keys(election[constit])
				.reduce((out,a)=>election[constit][a]+out,0);
			result[constit] = election[constit][maxParty]>blockVotes/2
				?game.parties().filter(p=>p.name == maxParty)[0]
				:"none";
			*/
			var votes = Object.keys(game.election()[constit])
				.map((party)=>{return {name:party,votes:game.election()[constit][party]}})
				.sort((a,b)=>b.votes-a.votes);
			result[constit] = votes[0].votes > votes[1].votes?game.parties().filter(p=>p.name == votes[0].name)[0]:"none";
		}
		return result;
	});
	game.partyPower = ko.pureComputed(function (){
		var partyPower = {};
		for(var p of game.parties())partyPower[p.name]=[];
		var election = game.election();
		for(var constit of game.constits()){
			//true majority
			/*
			var blockVotes = Object.keys(game.election()[constit.name])
				.reduce((out,a)=>game.election()[constit.name][a]+out,0);
			for(var party in election[constit.name]){
				if(election[constit.name][party] > blockVotes/2){
					partyPower[party].push(constit);
				}
			}
			*/
			//plurality
			var votes = Object.keys(game.election()[constit.name])
				.map((party)=>{return {name:party,votes:game.election()[constit.name][party]}})
				.sort((a,b)=>b.votes-a.votes);
			if(votes[0].votes > votes[1].votes)
				partyPower[votes[0].name].push(constit);
		}
		return partyPower;
	});
	game.totalVotes = ko.pureComputed(function (){
		var election = game.election();
		var result = [];
		for(var constit of game.constits()){
			for(var party in election[constit.name]){
				if(!result[party])result[party]=0;
				result[party]+=election[constit.name][party];
			}
		}
		return result;
	});
	game.endTurn = function (keepStaff,noScore){
		game.undoAction(undefined);
		if (game.currentParty() && !keepStaff)
			game.currentParty().readyStaff(0);
		var readyParties = game.parties().filter(p=>p.readyStaff())
			.sort((a,b)=>
				a.score()!=b.score()?b.score()-a.score()
				:game.partyPower()[a.name]!=game.partyPower()[b.name]
					?game.partyPower()[b.name]-game.partyPower()[a.name]
				:game.totalVotes()[b.name]-game.totalVotes()[a.name]
			);
		if(readyParties.length){
			game.currentParty(readyParties[0]);
			game.parties(game.parties().sort((a,b)=>a==game.currentParty()?-1:1));
			game.constits(game.constits().sort((a,b)=>
				game.election()[b.name][game.currentParty().name]
				-game.election()[a.name][game.currentParty().name]
			));
			// assign a zone to be live
			game.assignRandomZoningissue();
		}
		else {
			//hold election
			//put party in power
			//change momentum
			//score points
			//*
			if(!noScore){
				var partiesByPower = Object.keys(game.partyPower()).map(key=>{
					return {party:key,power:game.partyPower()[key].length}
				}).sort((a,b)=>b.power-a.power);
				// majority vs. pluarity
				//if( partiesByPower[0].power > game.constits().length/2)
				if( partiesByPower[0].power > partiesByPower[1].power)
					game.governmentParty(partiesByPower[0])
				else game.governmentParty(undefined);
				if(game.governmentParty())
					game.parties().filter(p=>p.name!=game.governmentParty().party)
						.forEach(p=>p.momentum(p.momentum()+Math.ceil(game.constits().length/game.parties().length)))
				partiesByPower.forEach(partyPower=>{
					var party = game.parties().filter(p=>partyPower.party==p.name)[0];
					party.score(party.score()+partyPower.power);
				});
				game.turns(game.turns()+1);
			}
			//*/
			//ready Staff and pick next player
			game.parties().forEach(p=>p.readyStaff(p.staff()));
			game.endTurn(true,false);
		}
	}
	game.undo = function (){
		if(!game.undoAction())return;
		var action = game.undoAction();
		game.currentParty().readyStaff(action.staff);
		if(action.act == "gerrymander"){
			game.gerryMander(action.block,action.constit);
		}
		if(action.act == "campaign"){
			action.block.party(action.party);
		}
		if(action.act == "build" || action.act == "zone"){
			action.block.contents(action.contents);
		}
		game.currentParty().readyStaff(action.staff);
		return action;
	}
	game.gerryMander = function (block,destination){
		if(!block || !destination 
			|| !game.currentParty() || !game.currentParty().readyStaff()) return;
		var toMove = block;
		var looser = game.blockConstits()[toMove.x][toMove.y]
		game.undoAction({
			act:"gerrymander",
			block:block,
			constit:looser,
			staff:game.currentParty().readyStaff()
		});
		destination.blocks.push([toMove.x,toMove.y]);
		looser.blocks.remove(looser.blocks().filter(b => b[0] == toMove.x && b[1] == toMove.y)[0]);
		game.currentParty().readyStaff(game.currentParty().readyStaff()-1);
	}
	game.campaign = function (block,party){
		if(!block || !party
			|| !game.currentParty() || game.currentParty().readyStaff()<2)
				return;
		game.undoAction({
			act:"campaign",
			block:block,
			party:block.party(),
			staff:game.currentParty().readyStaff()
		});
		block.party(party);
		//TODO: vary cost of campaigning!
		game.currentParty().readyStaff(game.currentParty().readyStaff()-2);

	}
	game.build = function (block,building){
		if(!block || !building
			|| !game.currentParty() || game.currentParty().readyStaff()<1) 
				return;
		// yes, building projects can exceed gerrymander limits
		//if(building=="housing" && game.constitSize()[game.blockConstits()[block.x][block.y].name]>=12) return;
		//if(building=="park" && game.constitSize()[game.blockConstits()[block.x][block.y].name]<=8) return;
		game.undoAction({
			act:"build",
			block:block,
			contents:block.contents(),
			staff:game.currentParty().readyStaff()
		});
		block.contents([{name:building}]);
		game.currentParty().readyStaff(game.currentParty().readyStaff()-1);
	}
	game.zone = function (){
		if(!game.currentParty() || game.currentParty().readyStaff()<1) return;
		var block = game.assignRandomZoningissue();
		game.undoAction({
			act:"zone",
			block:block,
			contents:block.contents(),
			staff:game.currentParty().readyStaff()
		});
		game.currentParty().readyStaff(game.currentParty().readyStaff()-1);
	}
	game.redistrict = function (districtA,districtB){
		console.log(districtA,districtB);
		var blocks = districtA.blocks().concat(districtB.blocks());
		if(blocks.length<24) return;
		
		//blocks.sort((a,b)=>a[0]!=b[0]?a[0]-b[0]:a[1]-b[1]);
		var divisions = [[blocks.pop()],[blocks.splice(Math.floor(blocks.length/2),1)[0]],[blocks.shift()]];
		shuffleArray(blocks);
		console.log("seeds",divisions);
		var divisionIndex = 0;
		cycles = 0;
		while(blocks.length>0 && cycles< 2000 ){
			var a = blocks.pop();
			var matched = false;
			for(var i = 0;i<divisions[divisionIndex].length && !matched; i++){
				var b = divisions[divisionIndex][i];
				if((Math.abs(a[0]-b[0])==1 && a[1]==b[1]) 
					|| (Math.abs(a[1]-b[1])==1 && a[0]==b[0])){
					matched = true;
					divisions[divisionIndex].push(a);
				}
			}
			if(!matched)blocks.unshift(a);
			
			if(cycles++%20==19)divisionIndex++;
			
			divisionIndex = (divisionIndex+1)%divisions.length;
		}
		var constits = game.constits();
		constits = constits.filter(c=>c != districtA && c != districtB);
		divisions.forEach(d=>constits.push(constituency(config.constitNames[nextName++],getRandomColor(),d)));
		game.constits(constits);
	}
	game.assignRandomZoningissue= function (){
		var x = Math.floor(Math.random()*game.squares().length);
		var y = Math.floor(Math.random()*game.squares()[x]().length);
		
		game.squares()[x]()[y].contents.push({name:"zone"});
		return game.squares()[x]()[y];
	}
	game.init= function (){
		game.constits(constits.map(c=>constituency(c.name,c.color,c.blocks)));
		for(var i =0;i<config.numParties;i++)
			game.parties.push(new Party(config.partyNames[i],config.partyIcons[i]));
		var partyDeck = [];
		while(partyDeck.length < 100){
			game.parties().forEach(p=>partyDeck.push(p));
		}
		shuffleArray(partyDeck);
		for(var i = 0;i<10;i++){
			game.squares.push(ko.observableArray([]));
			for(var j =0;j<10;j++)game.squares()[i]()[j]=square(i,j,partyDeck[i*10+j]);
		}
		game.endTurn(true,true);
	}
	return game;
}