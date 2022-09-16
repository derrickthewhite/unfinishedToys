function Player(name,constit,party,staff,readyStaff,score){
	var player = {};
	
	//TODO: computed vs. stored?
	staff = staff?staff:4;
	readyStaff = readyStaff?readyStaff:0;
	score = score?score:0;
	
	player.name = ko.observable(name);
	player.party = ko.observable(party);
	player.constit = ko.observable(constit);
	
	player.staff = ko.observable(staff); 
	player.readyStaff = ko.observable(readyStaff);
	player.score = ko.observable(score);
	
	player.save = function (){
		var save = {};
		save.name = player.name();
		save.party = player.party().name;
		save.constit = player.constit().name;
		
		save.staff = player.staff();
		save.readyStaff = player.readyStaff();
		save.score = player.score()
		return save;
	}
	
	return player;
}
function constituency (name,color,blocks){
	var constituency = {};
	
	constituency.name = name;
	constituency.color = color;
	constituency.blocks = ko.observableArray(blocks);
	
	constituency.canLoose = function(location){
		var blocks = constituency.blocks()
		var toRemove = blocks.filter(loc=>loc[0]==location[0] && loc[1]==location[1])[0]
		if(!toRemove)return false;
		var remaining = blocks.slice()
		remaining.splice(blocks.indexOf(toRemove),1);
		var connected = [remaining.pop()];
		
		while(remaining.length>0){
			
			var found = false;
			for(var i =0;i<remaining.length && !found;i++)
				for(var j =0;j<connected.length && !found;j++){
					var a = remaining[i];
					var b = connected[j]
					if((Math.abs(a[0]-b[0])==1 && a[1]==b[1]) 
						|| (Math.abs(a[1]-b[1])==1 && a[0]==b[0])){
						remaining.splice(i,1);
						connected.push(a);
						found = true;
					}
				}
			if(!found){
				return false;
			}
		}
		return true;
	}
	constituency.save = function (){
		var save = {};
		save.name = constituency.name;
		save.color = constituency.color;
		save.blocks = constituency.blocks();
		return save;
	}
	return constituency;
}
function square(x,y,party){
	var square = {};
	
	square.x = x;
	square.y = y;
	square.party = ko.observable(party);
	square.contents = ko.observableArray();
	
	square.save = function (){
		var save = {};
		
		save.x = square.x;
		save.y=square.y;
		save.party = square.party().name;
		save.contents = square.contents();
		return save;
	}
	
	return square;
}
function Party(name,icon,momentum){
	momentum = momentum?momentum:0
	var party = {};
	party.name = name;
	party.icon = icon;
	party.momentum = ko.observable(momentum);
	
	party.save = function (){
		var save = {}
		save.name = party.name;
		save.icon = party.icon;
		save.momentum = party.momentum();
		return save;
	}
	return party;
}