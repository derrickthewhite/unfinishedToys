function createApiModule() {
	const apiBase = new URL('../api', import.meta.url).toString().replace(/\/$/, '');

	async function request(path, method, payload) {
		const response = await fetch(apiBase + path, {
			method: method || 'GET',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
			},
			body: payload ? JSON.stringify(payload) : undefined,
		});

		let data;
		try {
			data = await response.json();
		} catch (error) {
			throw new Error('Invalid server response.');
		}

		if (!response.ok || !data.ok) {
			throw new Error(data.error || 'Request failed.');
		}

		return data.data;
	}

	return {
		signup: (username, salt, verifier, inviteKey) => request('/auth/signup', 'POST', {
			username,
			salt,
			verifier,
			invite_key: inviteKey,
		}),
		signinStart: (username) => request('/auth/signin/start', 'POST', { username }),
		signinFinish: (username, clientPublic, clientProof) => request('/auth/signin/finish', 'POST', {
			username,
			client_public: clientPublic,
			client_proof: clientProof,
		}),
		signout: () => request('/auth/signout', 'POST'),
		me: () => request('/auth/me', 'GET'),
		test: () => request('/auth/test', 'GET'),
	};
}

export const api = createApiModule();