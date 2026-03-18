function Diplomacy(factions){
	var diplomacy = {};
	diplomacy.factionRelations = {};
	for(faction of factions){
		diplomacy.factionRelations[faction.name] = [];
		for(neighbor of factions){
			// warring, hostile, freindly, allied, unified
			if(faction.name != neighbor.name)diplomacy.factionRelations[faction.name][neighbor.name]='warring'; 
			else diplomacy.factionRelations[faction.name][neighbor.name]='unified'; 
		}
	}
	diplomacy.possibleStatus = ['warring', 'hostile', 'freindly', 'allied', 'unified',"empty"];
	diplomacy.status = function (factionList){
		if(!factionList.length)return "empty";
		var sofar = diplomacy.possibleStatus.indexOf(diplomacy.factionRelations[factionList[0]][factionList[0]]);
		for(var faction of factionList)
			for(var neighbor of factionList){
				sofar = Math.min(sofar,diplomacy.possibleStatus.indexOf(diplomacy.factionRelations[faction][neighbor]));
			}
		return diplomacy.possibleStatus[sofar];
	}
	return diplomacy;
}