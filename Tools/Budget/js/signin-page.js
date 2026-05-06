import { startClientHandshake } from '../auth-export/js/srpClient.js';
import { budgetApi } from './budget-api.js';
import { clearAuthMode, isGuestUsername, setGuestMode, setUserMode } from './budget-storage.js';

function $(id) {
    return document.getElementById(id);
}

function setStatus(message, kind = '') {
    const status = $('signin-status');
    status.textContent = message || '';
    status.className = 'status' + (kind ? ' ' + kind : '');
}

function goToBudget() {
    window.location.href = 'budget.html';
}

async function redirectIfAlreadySignedIn() {
    try {
        await budgetApi.me();
        setUserMode();
        goToBudget();
    } catch (error) {
        clearAuthMode();
    }
}

async function handleSignin(event) {
    event.preventDefault();

    const username = $('signin-username').value.trim();
    const password = $('signin-password').value;

    if (isGuestUsername(username)) {
        setGuestMode();
        setStatus('Opening guest mode.', 'ok');
        goToBudget();
        return;
    }

    if (username === '' || password === '') {
        setStatus('Username and password are required unless you sign in as guest.', 'error');
        return;
    }

    try {
        setStatus('Signing in...');
        const start = await budgetApi.signinStart(username);
        const resolvedUsername = String(start.username || username);
        const handshake = await startClientHandshake(resolvedUsername, password, start);
        const result = await budgetApi.signinFinish(
            resolvedUsername,
            handshake.clientPublic,
            handshake.clientProof
        );

        if ((result.server_proof || '') !== handshake.expectedServerProof) {
            throw new Error('Unable to verify server auth proof.');
        }

        $('signin-password').value = '';
        setUserMode();
        setStatus('Signed in successfully.', 'ok');
        goToBudget();
    } catch (error) {
        clearAuthMode();
        setStatus(error.message || 'Unable to sign in.', 'error');
    }
}

function handleGuestMode() {
    $('signin-username').value = 'guest';
    setGuestMode();
    goToBudget();
}

$('signin-form').addEventListener('submit', handleSignin);
$('guest-button').addEventListener('click', handleGuestMode);

redirectIfAlreadySignedIn();