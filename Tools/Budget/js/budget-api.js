import { api as authApi } from '../auth-export/js/api.js';

const apiBase = new URL('../auth-export/api', import.meta.url).toString().replace(/\/$/, '');

async function request(path, method = 'GET', payload) {
    const response = await fetch(apiBase + path, {
        method,
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

export const budgetApi = {
    signup: authApi.signup,
    signinStart: authApi.signinStart,
    signinFinish: authApi.signinFinish,
    signout: authApi.signout,
    me: authApi.me,
    test: authApi.test,
    loadBudget: () => request('/budget/data', 'GET'),
    saveBudget: (budget) => request('/budget/data', 'POST', { budget }),
};