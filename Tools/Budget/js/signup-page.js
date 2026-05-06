import { buildSignupPayload } from '../auth-export/js/srpClient.js';
import { budgetApi } from './budget-api.js';

function $(id) {
    return document.getElementById(id);
}

function setStatus(message, kind = '') {
    const status = $('signup-status');
    status.textContent = message || '';
    status.className = 'status' + (kind ? ' ' + kind : '');
}

async function handleSignup(event) {
    event.preventDefault();

    const username = $('signup-username').value.trim();
    const password = $('signup-password').value;
    const inviteKey = $('signup-invite-key').value;

    if (username === '' || password === '' || inviteKey === '') {
        setStatus('Username, password, and invite key are required.', 'error');
        return;
    }

    try {
        setStatus('Creating account...');
        const payload = await buildSignupPayload(username, password);
        await budgetApi.signup(payload.username, payload.salt, payload.verifier, inviteKey);
        $('signup-password').value = '';
        setStatus('Account created. Return to sign in.', 'ok');
    } catch (error) {
        setStatus(error.message || 'Unable to create account.', 'error');
    }
}

$('signup-form').addEventListener('submit', handleSignup);