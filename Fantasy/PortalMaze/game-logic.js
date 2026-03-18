function movefromTo(from,to) {
	let previousParty = getParty();
	roomItems[from].forEach(item => {
		if(creatureFollowTarget[item] && inventory.includes(creatureFollowTarget[item])) {
			roomItems[to].unshift(item);
			roomItems[from] = roomItems[from].filter(i => i !== item);
		}
	});
	currentLocation= to;
	let newPartyMembers = getParty().filter(member => !previousParty.includes(member));

	newPartyMembers.forEach(member => messages.push({
		text: "The " + member +  " joins your party ("+creatureFollowTarget[member]+ " " + emojiMap[creatureFollowTarget[member]]+")" ,
		icon: emojiMap[member]
	}))

	showLocation(to, true);
}
	
function countHands() {
	return 2 + inventory.reduce((sofar, item) => sofar - handsRequired[item], 0) + getParty().reduce((sofar, item) => sofar + followHands[item],0);
}
function getParty () {
	if(!roomItems[currentLocation])return [];
	return roomItems[currentLocation].filter(item => creatureFollowTarget[item] && inventory.includes(creatureFollowTarget[item]));
}

function showLocation(location, add) {
  const locationDiv = document.getElementById("location");
  const doorsDiv = document.getElementById("doors");
  const visitedDiv = document.getElementById("visited-list");
  const movesDiv = document.getElementById("moves");
  const inventoryDiv = document.getElementById("inventory");
  const itemsDiv = document.getElementById("room-items");
  const partyDiv = document.getElementById("party");
  const victoryDiv = document.getElementById("victory-message");

  if (add) {
	moveCount++;
  }
  visited.add(location);
  seen.add(location);
  maze[location].forEach(portal => seen.add(portal));

  locationDiv.textContent = `${emojiMap[location]}You are in ${location} ${emojiMap[location]}`;
  doorsDiv.innerHTML = "";
  victoryDiv.innerHTML = "";
  
  partyDiv.innerHTML = "<strong>Party:</strong> ";
  itemsDiv.innerHTML = "<strong>Items in room:</strong> ";

  roomItems[location].forEach(item => {
	if (objectItems.includes(item)) {
	  const btn = document.createElement("button");
	  //btn.textContent = `${item}${emojiMap[item]}(${handsRequired[item]})`;
	  
	btn.className = "item";

	const icon = document.createElement("div");
	icon.className = "door-icon";
	icon.textContent = emojiMap[item] || "🔮";

	const label = document.createElement("div");
	label.className = "door-label";
	label.textContent = item;
	
	const hands = document.createElement("div")
	hands.textContent = "("+handsRequired[item]+" hands)"

	btn.appendChild(icon);
	btn.appendChild(label);
	btn.appendChild(hands);

	  
	  
	  btn.onclick = () => {
		if(countHands() - handsRequired[item] < 0) return;
		inventory.push(item);
		roomItems[location] = roomItems[location].filter(i => i !== item);
		showLocation(location);
	  };
	  doorsDiv.appendChild(btn);
	  itemsDiv.appendChild(document.createTextNode(" "));
	} 
	else if(creatureFollowTarget[item] && inventory.includes(creatureFollowTarget[item])){
		partyDiv.appendChild(document.createTextNode(item+emojiMap[item] + " ("+creatureFollowTarget[item]+")"));
	}
	else {
			const button = document.createElement("div");
			button.className = "item";

			const icon = document.createElement("div");
			icon.className = "door-icon";
			icon.textContent = emojiMap[item] || "🚧";

			const label = document.createElement("div");
			label.className = "door-label";
			label.textContent = item;

			button.appendChild(icon);
			button.appendChild(label);
			button.onclick = () =>  { 
				if(blockingItems.includes(item))
					showModal(emojiMap[item], blockingMessages[item],undefined,"Unblockers: "+unblockingOptions[item].map(u => emojiMap[u]));
				else {
					showModal(emojiMap[item], followerMessages[item], undefined, "Follows: "+followOptions[item].map(f => emojiMap[f]));
				}
			};
			doorsDiv.appendChild(button);
	}
  });

  maze[location].forEach(destination => {
	const button = document.createElement("div");
	const blocked = blockedPortals[location]?.[destination];
	button.className = "door" + (blocked ? " blocked" : "");

	const icon = document.createElement("div");
	icon.className = "door-icon";
	icon.textContent = emojiMap[destination] || "🔮";

	const label = document.createElement("div");
	label.className = "door-label";
	const accessInfo = visited.has(destination) ? ` (${maze[destination].length})` : "";
	label.textContent = destination + accessInfo;

	button.appendChild(icon);
	button.appendChild(label);

	if (!blocked) {
	  button.onclick = () => {
		   movefromTo(location, destination);
		}
	}
	else if (inventory.includes(portalUnblockers[blocked+"-"+location])) {
	  const blockerNote = document.createElement("div");
	  blockerNote.style.fontSize = "12px";
	  blockerNote.textContent = blocked + "-"+portalUnblockers[blocked+"-"+location];
	  button.appendChild(blockerNote);
	  button.className = "door";
	  button.onclick = () => {
		movefromTo(location, destination);
	  }
	} else if (roomItems[location].includes(portalUnblockers[blocked+"-"+location])) {
	  const blockerNote = document.createElement("div");
	  blockerNote.style.fontSize = "12px";
	  blockerNote.textContent = blocked + "-"+portalUnblockers[blocked+"-"+location];
	  button.appendChild(blockerNote);
	  button.className = "door";
	  button.onclick = () => {
	   movefromTo(location, destination);
		}
	}
	else {
	  const blockerNote = document.createElement("div");
	  blockerNote.style.fontSize = "12px";
	  blockerNote.textContent = blocked + emojiMap[blocked];
	  //blockerNote.textContent = "blocked"; //hide what needs to be done
	  button.appendChild(blockerNote);
	}

	doorsDiv.appendChild(button);
  });

  inventoryDiv.innerHTML = `<strong>Inventory: (${countHands()})</strong> `;
  inventory.forEach(item => {
	const btn = document.createElement("button");
	btn.textContent = item+emojiMap[item];
	btn.onclick = () => {
	  roomItems[location].push(item);
	  inventory.splice(inventory.indexOf(item), 1);
	  showLocation(location);
	};
	inventoryDiv.appendChild(btn);
	inventoryDiv.appendChild(document.createTextNode(" "));
  });

  if (inventory.length === 0) inventoryDiv.innerHTML += "empty";

  const sortedNames = [...locationNames].sort((a,b) => {
	if(visited.has(a) && !visited.has(b)) return -1;
	if(!visited.has(a) && visited.has(b)) return 1;
	if(seen.has(a) && !seen.has(b)) return -1;
	if(!seen.has(a) && seen.has(b)) return 1;
	return a.localeCompare(b);
  });
  visitedDiv.innerHTML = "<strong>Places:</strong><br>" + sortedNames.map(name => {
	const cls = visited.has(name) ? "visited" : seen.has(name)? "seen": "unvisited";
	return `<span class="${cls}">${name}</span>`;
  }).join(", ");
  
  movesDiv.innerHTML = "<strong>Moves:</strong>"+moveCount;
  showNextMessage();

  if (visited.size === numLocations) {
	victoryDiv.innerHTML = `<p>🎉 Congratulations! You've visited all ${locationNames.length} places using ${moveCount} portals.</p>` +
	  `<button id="reset-button" onclick="location.reload()">Play Again</button>`;
  }
}

function showNextMessage() {
	if(messages.length){
		let message = messages.shift();
		showModal(message.icon, message.text)
	  }	
}

function showModal(icon = "", text = "", imageUrl = "", bottom="" ) {
	const modal = document.getElementById("game-modal");
	const iconDiv = document.getElementById("modal-icon");
	const textDivTop = document.getElementById("modal-text-top");
	const textDivBottom = document.getElementById("modal-text-bottom");
	const image = document.getElementById("modal-image");
	const closeButton = document.getElementById("modal-close-button");
  
	iconDiv.textContent = icon;
	textDivTop.textContent = text;
	textDivBottom.textContent = bottom;
  
	if (imageUrl) {
	  image.src = imageUrl;
	  image.style.display = "block";
	} else {
	  image.style.display = "none";
	}
  
	modal.classList.remove("hidden");
  
	function closeModal() {
	  modal.classList.add("hidden");
	  document.removeEventListener("keydown", handleKey);
	  showNextMessage();
	}
  
	function handleKey(e) {
	  if (e.code === "Space") {
		closeModal();
	  }
	}
  
	closeButton.onclick = closeModal;
	document.addEventListener("keydown", handleKey);
  }

  function createOptionDisplay(options) {

	const container = document.createElement("div");
	container.className = "follow-options";
	keys = Object.keys(options).sort();

	for (const key of keys) {
		const items = options[key];
		const keyRow = document.createElement("div");
		keyRow.className = "follow-row";
	
		// Creature name and emoji
		const keyLabel = document.createElement("div");
		keyLabel.className = "follow-creature";
		keyLabel.innerHTML = `<strong>${key} ${emojiMap[key] || ""}</strong>: `;
		keyRow.appendChild(keyLabel);
	
		// Each item that can make the creature follow
		const itemList = document.createElement("div");
		itemList.className = "follow-items";
	
		items.forEach(item => {
		  const itemSpan = document.createElement("span");
		  itemSpan.className = "follow-item";
		  itemSpan.textContent = `${item} ${emojiMap[item] || ""}`;
		  itemList.appendChild(itemSpan);
		});
	
		keyRow.appendChild(itemList);
		container.appendChild(keyRow);
  
	  }
	  return container;
  }

  function closeModal() {
	const modal = document.getElementById("game-modal");
	modal.classList.add("hidden");
	showNextMessage();
  }

  function handleKey(e) {
	if (e.code === "Space") {
		e.stopPropagation()
	  	closeModal();
	}
  }

  let listenerAdded = false;
  function displayInModal(container) {

	const modal = document.getElementById("game-modal");
	const textDivTop = document.getElementById("modal-text-top");
	const textDivBottom = document.getElementById("modal-text-bottom");
	const iconDiv = document.getElementById("modal-icon");	
	const closeButton = document.getElementById("modal-close-button");

	modal.classList.remove("hidden");

	textDivTop.innerHTML = "";
	textDivBottom.innerHTML = "";
	iconDiv.innerHTML = "";
	textDivTop.appendChild(container);

	if(!listenerAdded){
		closeButton.addEventListener("click", closeModal);
		document.addEventListener("keydown", handleKey);
		listenerAdded= true;
	}
	closeButton.focus();
  }
  

  function displayFollowOptions() {
	const container = createOptionDisplay (followOptions);
	displayInModal(container);
  }

  function displayUnblockOptions() {
	const container = createOptionDisplay (unblockingOptions);
	displayInModal(container);

  }