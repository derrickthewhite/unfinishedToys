import { api } from './api.js';
import { buildSignupPayload, startClientHandshake } from './srpClient.js';

function $(id) {
	return document.getElementById(id);
}

function setStatus(element, message, kind = '') {
	element.textContent = message || '';
	element.className = 'status' + (kind ? ' ' + kind : '');
}

function renderUser(user) {
	const currentUser = $('current-user');
	if (!user) {
		currentUser.textContent = 'Not signed in';
		return;
	}

	currentUser.textContent = 'Signed in as ' + user.username + ' (id ' + user.id + ')';
}

async function refreshCurrentUser() {
	try {
		const result = await api.me();
		renderUser(result.user);
	} catch (error) {
		renderUser(null);
	}
}

async function handleSignup(event) {
	event.preventDefault();
	const status = $('signup-status');

	try {
		const username = $('signup-username').value.trim();
		const password = $('signup-password').value;
		const inviteKey = $('signup-invite-key').value;

		if (username === '' || password === '' || inviteKey === '') {
			throw new Error('Username, password, and invite key are required.');
		}

		setStatus(status, 'Creating account...');
		const payload = await buildSignupPayload(username, password);
		await api.signup(payload.username, payload.salt, payload.verifier, inviteKey);
		$('signup-password').value = '';
		setStatus(status, 'Account created. You can now sign in.', 'ok');
	} catch (error) {
		setStatus(status, error.message, 'error');
	}
}

async function handleSignin(event) {
	event.preventDefault();
	const status = $('signin-status');

	try {
		const username = $('signin-username').value.trim();
		const password = $('signin-password').value;

		if (username === '' || password === '') {
			throw new Error('Username and password are required.');
		}

		setStatus(status, 'Signing in...');
		const start = await api.signinStart(username);
		const handshake = await startClientHandshake(String(start.username || username), password, start);
		const result = await api.signinFinish(
			String(start.username || username),
			handshake.clientPublic,
			handshake.clientProof
		);

		if ((result.server_proof || '') !== handshake.expectedServerProof) {
			throw new Error('Unable to verify server auth proof.');
		}

		$('signin-password').value = '';
		setStatus(status, 'Signed in successfully.', 'ok');
		renderUser(result.user);
	} catch (error) {
		setStatus(status, error.message, 'error');
	}
}

async function handleSignout() {
	const status = $('signin-status');

	try {
		await api.signout();
		setStatus(status, 'Signed out.', 'ok');
		renderUser(null);
	} catch (error) {
		setStatus(status, error.message, 'error');
	}
}

async function handleDiagnostics() {
	const output = $('diagnostics-output');

	try {
		const result = await api.test();
		output.textContent = JSON.stringify(result.report, null, 2);
	} catch (error) {
		output.textContent = error.message;
	}
}

$('signup-form').addEventListener('submit', handleSignup);
$('signin-form').addEventListener('submit', handleSignin);
$('signout-button').addEventListener('click', handleSignout);
$('diagnostics-button').addEventListener('click', handleDiagnostics);

refreshCurrentUser();