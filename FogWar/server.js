const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const users = {}; // Store user data
const games = {}; // Store game data

const PORT = 3000;

// Utility function to send JSON responses
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Utility function to send HTML/JS/CSS files
function sendFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end('Internal Server Error');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

// User authentication: sign up and login
function handleAuth(req, res) {
    const { pathname, query } = url.parse(req.url, true);

    if (pathname === '/auth/signup' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const { username, password } = JSON.parse(body);
            if (users[username]) {
                sendResponse(res, 400, { error: 'User already exists' });
            } else {
                users[username] = { password };
                sendResponse(res, 200, { message: 'User signed up' });
            }
        });
    } else if (pathname === '/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const { username, password } = JSON.parse(body);
            if (users[username] && users[username].password === password) {
                sendResponse(res, 200, { message: 'Login successful' });
            } else {
                sendResponse(res, 401, { error: 'Invalid credentials' });
            }
        });
    } else {
        sendResponse(res, 404, { error: 'Not found' });
    }
}

// Game management: create and join games
function handleGame(req, res) {
    const { pathname, query } = url.parse(req.url, true);

    if (pathname === '/game/creategame' && req.method === 'POST') {
        const gameId = crypto.randomBytes(16).toString('hex');
        games[gameId] = {
            players: [],
            board: Array(5).fill(null).map(() => Array(5).fill(null)),
            turn: 0,
        };
        sendResponse(res, 200, { gameId });
    } else if (pathname.startsWith('/game/joingame') && req.method === 'POST') {
        const gameId = pathname.split('/')[3];
        if (games[gameId]) {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                const { username } = JSON.parse(body);
                if (games[gameId].players.length < 2) {
                    games[gameId].players.push(username);
                    sendResponse(res, 200, { message: 'Joined game' });
                } else {
                    sendResponse(res, 400, { error: 'Game is full' });
                }
            });
        } else {
            sendResponse(res, 404, { error: 'Game not found' });
        }
    } else {
        sendResponse(res, 404, { error: 'Not found' });
    }
}

// Serve static files
function handleStatic(req, res) {
    const { pathname } = url.parse(req.url, true);
    const extname = path.extname(pathname);
    let contentType = 'text/html';
	console.log("handling static request", pathname);

    switch (extname) {
        case '.js':
            contentType = 'application/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
    }

    const filePath = path.join(__dirname, "public", pathname === '/' ? 'index.html' : pathname);
	console.log("file path", filePath);
    fs.exists(filePath, exists => {
        if (exists) {
            sendFile(res, filePath, contentType);
        } else {
            res.writeHead(404);
            res.end('File not found');
        }
    });
}

// Main request handler
function requestHandler(req, res) {
    const { pathname } = url.parse(req.url, true);

    if (pathname.startsWith('/auth')) {
        handleAuth(req, res);
    } else if (pathname.startsWith('/game')) {
        handleGame(req, res);
    } else {
        handleStatic(req, res);
    }
}

// Create HTTP server
const server = http.createServer(requestHandler);

// Start server
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
