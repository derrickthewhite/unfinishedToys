let selectedCardIndex = null;
let swapCardIndex = null;
let AIpause = 1000;

function handleCardClick(cardIndex) {
    if (selectedCardIndex === null) {
        selectedCardIndex = cardIndex;
    } else if (swapCardIndex === null) {
        swapCardIndex = cardIndex;
        swapCards(selectedCardIndex, swapCardIndex);
        selectedCardIndex = null;
        swapCardIndex = null;
    }
	    displayGame(gameState);
}

function swapCards(index1, index2) {
    const currentPlayer = gameState.currentPlayer;
    const playerHand = gameState[currentPlayer].hand;
    [playerHand[index1], playerHand[index2]] = [playerHand[index2], playerHand[index1]];
}

function handleBoardClick(layerIndex, rowIndex, colIndex) {
	if (selectedCardIndex === null) return;

	const currentPlayer = gameState.currentPlayer;
	const card = gameState[currentPlayer].hand[selectedCardIndex];

	if (gameState.board[layerIndex][rowIndex][colIndex] === null) {
		
		const move = {
			card: card,
			spot: [layerIndex, rowIndex, colIndex],
			player: currentPlayer
		};
		gameState.board[layerIndex][rowIndex][colIndex] = card;
		gameState[currentPlayer].hand.splice(selectedCardIndex, 1);
		gameState.lastMove = [layerIndex, rowIndex, colIndex];
		
		if (gameState.deck.length > 0) {
			const topCard = gameState.deck.pop();
			gameState[currentPlayer].hand.push(topCard);
		}
		const completions = checkCompletion(layerIndex, rowIndex, colIndex);
		move.completions = completions;
		if (completions.length > 0) {
			completions.forEach(completion => {
				const score = calculateScore(completion.cards);
				gameState[currentPlayer].score += score;
			});
		}
		
		gameState.moves.push(move);
		
		gameState.currentPlayer = gameState.currentPlayer === 'player1' ? 'player2' : 'player1';
		selectedCardIndex = null;
		displayGame(gameState);
		
		if(gameState.aiActive){
			setTimeout(aiMakeMove, AIpause);
		}
	}
}

function createSVGShape(shape, color) {
    switch (shape) {
        case 'circle':
            return `<svg width="40" height="40"><circle cx="20" cy="20" r="16" fill="${color}" /></svg>`;
        case 'square':
            return `<svg width="40" height="40"><rect x="8" y="8" width="24" height="24" fill="${color}" /></svg>`;
        case 'bar':
            return `<svg width="40" height="40"><rect x="5" y="15" width="30" height="10" fill="${color}" /></svg>`;
        case 'triangle':
            return `<svg width="40" height="40"><polygon points="20,5 35,35 5,35" fill="${color}" /></svg>`;
        default:
            return '';
    }
}

function getMoveScoresHTML(completions) {
	if(!completions) return '';
    let scores = completions.map(completion => {
        let score = calculateScore(completion.cards);
        let cardsHTML = completion.cards.map(card => 
            `<div class="card inline">${createSVGShape(card.shape, card.color)}<span>${card.number}</span></div>`
        ).join('');
        return `<div class="score-block">
                    <div class="cards">${cardsHTML}
                    <h2 class="score inline">(${score})</h2>
				</div>
                </div>`;
    }).join('');
    return `<div class="scores"><h2>Scores:</h2>${scores}</div>`;
}

function displayEndGamePanel() {
    const overlay = document.createElement('div');
    overlay.id = 'overlay';

    const panel = document.createElement('div');
    panel.id = 'end-game-panel';

    const player1Score = gameState.player1.score;
    const aiScore = gameState.player2.score;

    let winnerText = 'It\'s a tie!';
    if (player1Score > aiScore) {
        winnerText = 'Player 1 wins!';
    } else if (aiScore > player1Score) {
        winnerText = 'Player 2 wins!';
    }

    const winnerMessage = document.createElement('h2');
    winnerMessage.innerText = winnerText;

    const player1ScoreMessage = document.createElement('p');
    player1ScoreMessage.innerText = `Player 1 Score: ${player1Score}`;

    const aiScoreMessage = document.createElement('p');
    aiScoreMessage.innerText = `Player 2 Score: ${aiScore}`;
	
	const newGameButton = document.createElement('button');
	newGameButton.innerHTML = `New Game`;
	newGameButton.onclick = () => {
		document.body.removeChild(document.getElementById("overlay"));
		document.body.removeChild(document.getElementById("end-game-panel"));

		newGame();
	}

    panel.appendChild(winnerMessage);
    panel.appendChild(player1ScoreMessage);
    panel.appendChild(aiScoreMessage);
    panel.appendChild(newGameButton);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
}

function checkGameEnd() {
    if (gameState.deck.length === 0 && gameState.player1.hand.length === 0 && gameState.player2.hand.length === 0) {
        displayEndGamePanel();
		return true;
    }
	return false;
}

function displayGame(gameState) {
	if(checkGameEnd())return true;
	const boardDiv = document.getElementById('board');
	const playersDiv = document.getElementById('players');
	boardDiv.innerHTML = '';
	playersDiv.innerHTML = '';

	// Display board
	const boardContainer = document.createElement('div');
	boardContainer.innerHTML = '<h2>Board</h2>';
	
	const twistButton = document.createElement('button');
	twistButton.innerHTML = `twist`;
	twistButton.onclick = () =>  { gameState.twisted = ! gameState.twisted; displayGame(gameState);}
	boardContainer.appendChild(twistButton);
	
	/*
	gameState.board.forEach((layer, layerIndex) => {
		const layerDiv = document.createElement('div');
		layerDiv.classList.add('board-layer');
		layer.forEach((row, rowIndex) => {
			const rowDiv = document.createElement('div');
			rowDiv.classList.add('row');
			row.forEach((cell, colIndex) => {
				const cellDiv = document.createElement('div');
				cellDiv.classList.add('card');
				if (cell) {
					cellDiv.innerHTML = createSVGShape(cell.shape, cell.color) + `<span>${cell.number}</span>`;
				}
				if(layerIndex == gameState.lastMove[0] && rowIndex == gameState.lastMove[1] && colIndex ==gameState.lastMove[2]){
					cellDiv.style.backgroundColor = "#ffaa88";
				}
				cellDiv.onclick = () => handleBoardClick(layerIndex, rowIndex, colIndex);
				rowDiv.appendChild(cellDiv);
			});
			layerDiv.appendChild(rowDiv);
		});
		boardContainer.appendChild(layerDiv);
	});
	*/
	for(let i = 0; i< 4; i++){
		const layerDiv = document.createElement('div');
		layerDiv.classList.add('board-layer');
		for(let j  = 0; j<4; j++) {
			const rowDiv = document.createElement('div');
			rowDiv.classList.add('row');
			for(let k = 0; k< 4; k++){
				let cell = !gameState.twisted?gameState.board[i][j][k]:gameState.board[j][i][k];
				const cellDiv = document.createElement('div');
				cellDiv.classList.add('card');
				if (cell) {
					cellDiv.innerHTML = createSVGShape(cell.shape, cell.color) + `<span>${cell.number}</span>`;
				}
				//TODO: double check this when moving!
				let layerIndex =i, rowIndex = j, colIndex = k;
				if(gameState.twisted) layerIndex =j, rowIndex = i, colIndex = k;
				if(layerIndex == gameState.lastMove[0] && rowIndex == gameState.lastMove[1] && colIndex ==gameState.lastMove[2]){
					cellDiv.style.backgroundColor = "#ffaa88";
				}
				if(gameState.showScores && selectedCardIndex != null && gameState.board[layerIndex][rowIndex][colIndex] == null){
					card = gameState[gameState.currentPlayer].hand[selectedCardIndex];
					gameState.board[layerIndex][rowIndex][colIndex] = card;
					const completions = checkCompletion(layerIndex,rowIndex,colIndex);
					const score = completions.reduce((acc, comp) => acc + calculateScore(comp.cards), 0);
					gameState.board[layerIndex][rowIndex][colIndex] = null;
					cellDiv.innerHTML = score;
				}
				cellDiv.onclick = () => handleBoardClick(layerIndex, rowIndex, colIndex);
				rowDiv.appendChild(cellDiv);
			}
			layerDiv.appendChild(rowDiv);
		}
		boardContainer.appendChild(layerDiv);
	}
	boardDiv.appendChild(boardContainer);

	// Display players' hands and scores
	['player1', 'player2'].forEach(playerKey => {
		const player = gameState[playerKey];
		const playerDiv = document.createElement('div');
		if(playerKey == gameState.currentPlayer) {
			playerDiv.style.border = "2px solid blue";
		}
		playerDiv.innerHTML = `<h2>${playerKey.charAt(0).toUpperCase() + playerKey.slice(1)}: ${player.score} points</h2>`;
		const handDiv = document.createElement('div');
		handDiv.classList.add('hand');
		player.hand.forEach((card, cardIndex) => {
			const cardDiv = document.createElement('div');
			cardDiv.classList.add('card');
			cardDiv.innerHTML = createSVGShape(card.shape, card.color) + `<span>${card.number}</span>`;
			cardDiv.onclick = () => handleCardClick(cardIndex, player);
			if(cardIndex == selectedCardIndex && player.id == gameState.currentPlayer){
				cardDiv.style. border = "solid blue 2px";
			}
			handDiv.appendChild(cardDiv);
		});
		playerDiv.appendChild(handDiv);
		playersDiv.appendChild(playerDiv);
		
	});

	// Display remaining cards in deck
	const deckDiv = document.createElement('div');
	deckDiv.innerHTML = `<h2>Cards Left: ${gameState.deck.length}</h2>`;
	playersDiv.appendChild(deckDiv);
	
	const lastScoreDiv = document.createElement('div');
	lastScoreDiv.innerHTML = getMoveScoresHTML(gameState.moves.slice(-1)[0]?.completions);
	playersDiv.appendChild(lastScoreDiv);
	
	const AIDiv = document.createElement('div');
	AIDiv.innerHTML = `<span>AI player?</span>`;
	const AIcheckBox = document.createElement('input');
	AIcheckBox.type = "checkbox";
	AIcheckBox.checked = gameState.aiActive;
	AIcheckBox.onclick = () => {
		gameState.aiActive = !gameState.aiActive; 
		displayGame(gameState);
		if(gameState.currentPlayer == "player2" && gameState.aiActive){
			setTimeout(aiMakeMove, AIpause);
		}
	}
	AIDiv.appendChild(AIcheckBox);
	playersDiv.appendChild(AIDiv);
	
	const twoAIDiv = document.createElement('div');
	twoAIDiv.innerHTML = `<span>AI only?</span>`;
	const twoAIcheckBox = document.createElement('input');
	twoAIcheckBox.type = "checkbox";
	twoAIcheckBox.checked = gameState.aiOnly;
	twoAIcheckBox.onclick = () => {
		gameState.aiOnly = !gameState.aiOnly; 
		displayGame(gameState);
		if(gameState.aiOnly){
			setTimeout(aiMakeMove, AIpause);
		}
	}
	twoAIDiv.appendChild(twoAIcheckBox);
	playersDiv.appendChild(twoAIDiv);
	
	playersDiv.appendChild(createAILevelSelector());
	
	const showScoreDiv = document.createElement('div');
	showScoreDiv.innerHTML = `<span>Show Scores?</span>`;
	const showScoreCheckbox = document.createElement('input');
	showScoreCheckbox.type = "checkbox";
	showScoreCheckbox.checked = gameState.showScores;
	showScoreCheckbox.onclick = () => {
		gameState.showScores = !gameState.showScores; 
		displayGame(gameState);
	}
	showScoreDiv.appendChild(showScoreCheckbox);
	playersDiv.appendChild(showScoreDiv);
	
	const newGameButton = document.createElement('button');
	newGameButton.innerHTML = `New Game`;
	newGameButton.onclick = newGame;
	playersDiv.appendChild(newGameButton);
	
	const handSizeDiv = document.createElement('div');
	handSizeDiv.innerHTML = `<span>Hand Size:</span>`
	const handSizeInput = document.createElement('input');
	handSizeInput.type= "number";
	handSizeInput.value = gameState.handsize;
	handSizeInput.id = "handsize";
	handSizeInput.min = 1;
	handSizeInput.max = 32;
	handSizeDiv.appendChild(handSizeInput);
	playersDiv.appendChild(handSizeDiv);
	
	
	const gameplayDescriptionDiv = document.createElement('div');
	gameplayDescriptionDiv.innerHTML = `
	<h4>Player Turn:</h4>
    <p>The current player selects a card from their hand.</p>
    <p>The player places the selected card on an empty cell on the board.</p>
    <p>If placing the card completes a row, column, or stack, it is scored immediately.</p>
    <p>The player draws a new card from the deck to maintain a hand of 4 cards (if there are cards left in the deck).</p>
    <p>The turn ends, and the other player takes their turn.</p>
	<h4>Completing Rows, Columns, or Stacks:</h4>
		<p>After placing a card, check for any completed rows, columns, or stacks.</p>
		<p>A completed set consists of four cards in a row, column, or stack.</p>
		<p>Points are awarded based on the attributes of the completed set of four cards:</p>
		<ul>
			<li>4 points if all cards are the same shape.</li>
			<li>4 points if all cards are the same color.</li>
			<li>4 points if all cards have the same number.</li>
			<li>4 points if all cards have different shapes.</li>
			<li>4 points if all cards have different colors.</li>
			<li>3 points if all cards have different numbers.</li>
			<li>6 points if all cards have different numbers in sequential order (ascending or descending).</li>
		</ul>
	<p>If multiple criteria are met, points for each criterion are added together. For example, a set of cards that are all red and all different shapes scores 8 points.</p>
	`;
	playersDiv.appendChild(gameplayDescriptionDiv);

}
function setAILevel(level) {
    gameState.aiLevel = level;
}
function createAILevelSelector() {
    const aiLevelDiv = document.createElement('div');
    aiLevelDiv.id = 'ai-level-selector';

    const label = document.createElement('label');
    label.htmlFor = 'aiLevel';
    label.innerText = 'Choose AI Level: ';
    aiLevelDiv.appendChild(label);

    const select = document.createElement('select');
    select.id = 'aiLevel';
    select.onchange = function () {
        setAILevel(this.value);
    };

    const easyOption = document.createElement('option');
    easyOption.value = 'easy';
    easyOption.innerText = 'Easy';
    select.appendChild(easyOption);

    const mediumOption = document.createElement('option');
    mediumOption.value = 'medium';
    mediumOption.innerText = 'Medium';
    mediumOption.selected = true;
    select.appendChild(mediumOption);

    const hardOption = document.createElement('option');
    hardOption.value = 'hard';
    hardOption.innerText = 'Hard';
    select.appendChild(hardOption);
	
	select.value = gameState.aiLevel;

    aiLevelDiv.appendChild(select);

    return aiLevelDiv;
}

function setsUpThree(layerIndex, rowIndex, colIndex) {
    const board = gameState.board;
    const size = 4;

    let rowCount = 0;
    for (let i = 0; i < size; i++) {
        if (board[layerIndex][rowIndex][i] !== null) {
            rowCount++;
        }
    }

    let colCount = 0;
    for (let i = 0; i < size; i++) {
        if (board[layerIndex][i][colIndex] !== null) {
            colCount++;
        }
    }

    let stackCount = 0;
    for (let i = 0; i < size; i++) {
        if (board[i][rowIndex][colIndex] !== null) {
            stackCount++;
        }
    }
    return (rowCount === 3?1:0)+( colCount === 3 ? 1: 0) + (stackCount === 3? 1:0);
}

function checkCompletion(layerIndex, rowIndex, colIndex) {
	const board = gameState.board;
	const size = 4;
	const completions = [];

	// Check row completion
	let rowComplete = true;
	const rowCards = [];
	for (let i = 0; i < size; i++) {
		if (board[layerIndex][rowIndex][i] === null) {
			rowComplete = false;
		}
		rowCards.push(board[layerIndex][rowIndex][i]);
	}
	if (rowComplete) completions.push({ type: 'row', cards: rowCards });

	// Check column completion
	let colComplete = true;
	const colCards = [];
	for (let i = 0; i < size; i++) {
		if (board[layerIndex][i][colIndex] === null) {
			colComplete = false;
		}
		colCards.push(board[layerIndex][i][colIndex]);
	}
	if (colComplete) completions.push({ type: 'column', cards: colCards });

	// Check stack completion
	let stackComplete = true;
	const stackCards = [];
	for (let i = 0; i < size; i++) {
		if (board[i][rowIndex][colIndex] === null) {
			stackComplete = false;
		}
		stackCards.push(board[i][rowIndex][colIndex]);
	}
	if (stackComplete) completions.push({ type: 'stack', cards: stackCards });

	return completions;
}

function calculateScore(cards) {
	const shapes = cards.map(card => card.shape);
	const colors = cards.map(card => card.color);
	const numbers = cards.map(card => card.number);

	const uniqueShapes = new Set(shapes).size;
	const uniqueColors = new Set(colors).size;
	const uniqueNumbers = new Set(numbers).size;

	const orderedNumbers = [1,2,3,4];
	const reversedNumbers = orderedNumbers.slice().reverse();

	let score = 0;

	if (uniqueShapes === 1) score += 4;
	if (uniqueColors === 1) score += 4;
	if (uniqueNumbers === 1) score += 4;
	if (uniqueShapes === 4) score += 4;
	if (uniqueColors === 4) score += 4;
	if (uniqueNumbers === 4) score += 3;
	if (JSON.stringify(numbers) === JSON.stringify(orderedNumbers) || JSON.stringify(numbers) === JSON.stringify(reversedNumbers)) score += 3;

	return score;
}


// Shuffle and create game state functions
function initializeGame(cards) {
	const shuffledCards = shuffleArray(cards);
	gameState.handsize = document.getElementById("handsize")?document.getElementById("handsize") .value: 8;
	
	if(gameState.handsize < 1) gameState.handsize = 1;
	if(gameState.handsize > 32) gameState.handsize = 32;

	const player1 = {
		hand: shuffledCards.slice(0, gameState.handsize),
		score: 0,
		id: "player1"
	};

	const player2 = {
		hand: shuffledCards.slice(gameState.handsize, gameState.handsize*2),
		score: 0,
		id: "player2"
	};

	const remainingDeck = shuffledCards.slice(gameState.handsize*2);

	const board = create3DArray();

	gameState.player1 = player1;
	gameState.player2 = player2;
	gameState.currentPlayer= 'player1',
	gameState.board= board,
	gameState.deck= remainingDeck,
	gameState.lastMove= [0,0,0],
	gameState.moves= [];
}

function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

function create3DArray() {
	const card3DArray = [];

	for (let i = 0; i < 4; i++) {
		const layer = [];
		for (let j = 0; j < 4; j++) {
			const row = [];
			for (let k = 0; k < 4; k++) {
				row.push(null);
			}
			layer.push(row);
		}
		card3DArray.push(layer);
	}

	return card3DArray;
}


function aiMakeMove() {
	//const aiPlayer = gameState.player2;
	const aiPlayer = gameState[gameState.currentPlayer];
	let bestScore = -1;
	const bestMoves = [];

	for (let cardIndex = 0; cardIndex < aiPlayer.hand.length; cardIndex++) {
		const card = aiPlayer.hand[cardIndex];
		for (let layerIndex = 0; layerIndex < 4; layerIndex++) {
			for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
				for (let colIndex = 0; colIndex < 4; colIndex++) {
					if (gameState.board[layerIndex][rowIndex][colIndex] === null) {
						gameState.board[layerIndex][rowIndex][colIndex] = card;
						const completions = checkCompletion(layerIndex, rowIndex, colIndex);
						const tripples = setsUpThree(layerIndex,rowIndex,colIndex);
						let score = completions.reduce((acc, comp) => acc + calculateScore(comp.cards), 0);
						if(gameState.aiLevel == "hard") score+=(tripples ===0? 0: tripples == 2? -.5: -1);
						if(gameState.aiLevel == "medium") score+=(tripples %2 ==0? 0: -1);
						gameState.board[layerIndex][rowIndex][colIndex] = null;

						if (score > bestScore) {
							bestScore = score;
							bestMoves.length = 0;
							bestMoves.push({ cardIndex, layerIndex, rowIndex, colIndex });
						} else if (score === bestScore) {
							bestMoves.push({ cardIndex, layerIndex, rowIndex, colIndex });
						}
					}
				}
			}
		}
	}

	if (bestMoves.length > 0) {
		const bestMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
		const { cardIndex, layerIndex, rowIndex, colIndex } = bestMove;
		const move = {
			card: aiPlayer.hand[cardIndex],
			spot: [layerIndex, rowIndex, colIndex],
			player: gameState.currentPlayer
		}
		
		gameState.board[layerIndex][rowIndex][colIndex] = aiPlayer.hand[cardIndex];
		gameState.lastMove = [layerIndex, rowIndex, colIndex];
		aiPlayer.hand.splice(cardIndex, 1);
		

		if (gameState.deck.length > 0) {
			const topCard = gameState.deck.pop();
			aiPlayer.hand.push(topCard);
		}

		const completions = checkCompletion(layerIndex, rowIndex, colIndex);
		if (completions.length > 0) {
			completions.forEach(completion => {
				const score = calculateScore(completion.cards);
				aiPlayer.score += score;
			});
		}
		move.completions = completions;
		gameState.moves.push(move);

		gameState.currentPlayer = ['player1', 'player2'].filter(p => p!= gameState.currentPlayer)[0];
		displayGame(gameState);
		
		if(gameState.aiOnly){
			setTimeout(aiMakeMove, AIpause);
		}
	}
}

// Create cards
const cards = [];

const numbers = [1, 2, 3, 4];
const colors = ['red', 'green', 'blue', 'black'];
const shapes = ['circle', 'square', 'triangle', 'bar'];

const gameState = {
	player1: undefined,
	player2: undefined,
	currentPlayer: '',
	board: undefined,
	deck: undefined,
	lastMove: [0,0,0],
	moves: [],
	aiActive: true,
	aiOnly: false,
	twist: false,
	showScores: false,
	aiLevel: "easy"
};

function newGame () {
	cards.splice(0,cards.length)
	for (let number of numbers) {
		for (let color of colors) {
			for (let shape of shapes) {
				cards.push({ number, color, shape });
			}
		}
	}

	// Initialize game and display it
	initializeGame(cards);
	
	displayGame(gameState);
}

newGame();
