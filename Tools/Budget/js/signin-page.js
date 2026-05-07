import { startClientHandshake } from '../auth-export/js/srpClient.js';
import { budgetApi } from './budget-api.js';
import { clearAuthMode, isGuestUsername, readLocalBudget, setGuestMode, setUserMode } from './budget-storage.js';

function $(id) {
    return document.getElementById(id);
}

function setStatus(message, kind = '') {
    const status = $('signin-status');
    status.textContent = message || '';
    status.className = 'status' + (kind ? ' ' + kind : '');
}

function setOverwriteStatus(message, kind = '') {
    const status = $('overwrite-status');
    status.textContent = message || '';
    status.className = 'status' + (kind ? ' ' + kind : '');
}

function goToBudget() {
    window.location.href = 'budget.html';
}

function updateOverwriteButtonState() {
    const phrase = $('overwrite-confirm-text').value.trim().toUpperCase();
    const confirmed = $('overwrite-confirm-checkbox').checked;
    $('overwrite-button').disabled = !(phrase === 'OVERWRITE' && confirmed);
}

async function signInWithCredentials(username, password) {
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

    return result;
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
        await signInWithCredentials(username, password);

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

async function handleOverwrite(event) {
    event.preventDefault();

    const username = $('signin-username').value.trim();
    const password = $('signin-password').value;
    const localBudget = readLocalBudget();

    if (isGuestUsername(username)) {
        setOverwriteStatus('Guest mode cannot overwrite database storage.', 'error');
        return;
    }

    if (username === '' || password === '') {
        setOverwriteStatus('Enter the account username and password first.', 'error');
        return;
    }

    if (localBudget.length === 0) {
        setOverwriteStatus('No local budget data was found in this browser to upload.', 'error');
        return;
    }

    const lastCheck = window.confirm(
        'Final check: overwrite the database budget for ' + username + ' with the local budget stored in this browser?'
    );
    if (!lastCheck) {
        setOverwriteStatus('Overwrite cancelled.', 'error');
        return;
    }

    try {
        setOverwriteStatus('Signing in and replacing the DB budget...');
        await signInWithCredentials(username, password);
        await budgetApi.saveBudget(localBudget);
        $('signin-password').value = '';
        setUserMode();
        setStatus('Signed in successfully.', 'ok');
        setOverwriteStatus('Database budget replaced with the local browser copy.', 'ok');
        goToBudget();
    } catch (error) {
        clearAuthMode();
        setOverwriteStatus(error.message || 'Unable to replace the database budget.', 'error');
    }
}

$('signin-form').addEventListener('submit', handleSignin);
$('guest-button').addEventListener('click', handleGuestMode);
$('overwrite-form').addEventListener('submit', handleOverwrite);
$('overwrite-confirm-text').addEventListener('input', updateOverwriteButtonState);
$('overwrite-confirm-checkbox').addEventListener('change', updateOverwriteButtonState);

redirectIfAlreadySignedIn();