function editHex(clickedHex) {
	if(editMode =="terrain"	&& selectedTerrain){
		terrain.push({
			...terrainData[selectedTerrain],
			q: clickedHex.q,
			r: clickedHex.r,
			image: loadImage(terrainData[selectedTerrain].image, drawGrid)
		});
	} 	
	
	if(editMode === "unit" && unitToAdd){
		units.push({
			...unitData[unitToAdd],
			q: clickedHex.q,
			r: clickedHex.r,
			image: loadImage(unitData[unitToAdd].image, drawGrid)
		});
	} 

}