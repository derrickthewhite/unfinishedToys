document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('auth');
    const dashboardSection = document.getElementById('dashboard');
    const gameSection = document.getElementById('game');
    const boardElement = document.getElementById('board');
    const turnStatus = document.getElementById('turnStatus');
    const gameStatus = document.getElementById('gameStatus');

    let currentUser = null;
    let currentGameId = null;
    let gameState = null;

    function showSection(section) {
        authSection.style.display = 'none';
        dashboardSection.style.display = 'none';
        gameSection.style.display = 'none';
        section.style.display = 'block';
    }

    async function postData(url = '', data = {}) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }

    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const result = await postData('/auth/signup', { username, password });
        if (result.message) {
            alert(result.message);
        } else {
            alert(result.error);
        }
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const result = await postData('/auth/login', { username, password });
        if (result.message) {
            currentUser = username;
            showSection(dashboardSection);
        } else {
            alert(result.error);
        }
    });

    document.getElementById('createGame').addEventListener('click', async () => {
        const result = await postData('/game/creategame', {});
        if (result.gameId) {
            currentGameId = result.gameId;
            gameStatus.innerText = `Game created. Game ID: ${currentGameId}`;
        } else {
            alert(result.error);
        }
    });

    document.getElementById('joinGameForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const gameId = document.getElementById('joinGameId').value;
        const result = await postData(`/game/joingame/${gameId}`, { username: currentUser });
        if (result.message) {
            currentGameId = gameId;
            showSection(gameSection);
            initializeBoard();
        } else {
            alert(result.error);
        }
    });

    function initializeBoard() {
        boardElement.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = i;
                cell.dataset.col = j;
                cell.addEventListener('click', () => handleCellClick(i, j));
                boardElement.appendChild(cell);
            }
        }
        updateBoard();
    }

    function handleCellClick(row, col) {
        // Handle cell click for moving cards (to be implemented)
    }

    function updateBoard() {
        if (gameState) {
            // Update board based on gameState (to be implemented)
        }
    }

    showSection(authSection);
});
