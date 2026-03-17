async function downloadMaze() {
  const data = {
    maze,
    locationNames,
    roomItems,
    blockedPortals,
    portalUnblockers,
    creatureFollowTarget,
    currentLocation,
    inventory,
    visited: Array.from(visited),
    seen: Array.from(seen),
    moveCount
  };

  const json = JSON.stringify(data, null, 2);

  // Try modern file picker first
  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: "maze.json",
        types: [{
          description: "JSON Files",
          accept: { "application/json": [".json"] }
        }]
      });

      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("User cancelled save dialog.");
        return;
      }
      console.warn("showSaveFilePicker failed, falling back:", err);
    }
  }

  // Fallback: use blob + anchor click
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "maze.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


function uploadMaze(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
	reset(data);
    } catch (err) {
      alert("Invalid or corrupted maze file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function reset(data){
      maze = data.maze;
      locationNames = data.locationNames;
      roomItems = data.roomItems;
      blockedPortals = data.blockedPortals;
      portalUnblockers = data.portalUnblockers;
      creatureFollowTarget = data.creatureFollowTarget;
      currentLocation = data.currentLocation;
      inventory = data.inventory;
      visited = new Set(data.visited);
      seen = new Set(data.seen);
      moveCount = data.moveCount;
	  
	  creaturesThatFollow = Object.keys(followOptions);

      showLocation(currentLocation);

      startingPosition = JSON.parse(JSON.stringify(data));
    
}
