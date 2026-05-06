import { budgetApi } from './budget-api.js';

export const LOCAL_BUDGET_KEY = 'derrickthewhite.com/budgetApp';

const AUTH_MODE_KEY = 'derrickthewhite.com/budgetAuthMode';

function safeParseBudget(raw) {
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

export function isGuestUsername(username) {
    return String(username || '').trim().toLowerCase() === 'guest';
}

export function setGuestMode() {
    sessionStorage.setItem(AUTH_MODE_KEY, 'guest');
}

export function setUserMode() {
    sessionStorage.setItem(AUTH_MODE_KEY, 'user');
}

export function clearAuthMode() {
    sessionStorage.removeItem(AUTH_MODE_KEY);
}

export function getAuthMode() {
    return sessionStorage.getItem(AUTH_MODE_KEY);
}

export function readLocalBudget() {
    return safeParseBudget(localStorage.getItem(LOCAL_BUDGET_KEY));
}

function writeLocalBudget(budget) {
    localStorage.setItem(LOCAL_BUDGET_KEY, JSON.stringify(budget));
}

function createGuestStorage() {
    return {
        isGuest: true,
        async loadBudget() {
            return readLocalBudget();
        },
        async saveBudget(budget) {
            writeLocalBudget(budget);
        },
        async signOut() {
            clearAuthMode();
        },
    };
}

function createRemoteStorage() {
    return {
        isGuest: false,
        async loadBudget() {
            const result = await budgetApi.loadBudget();
            let budget = Array.isArray(result.budget) ? result.budget : [];

            if (budget.length === 0) {
                const legacyBudget = readLocalBudget();
                if (legacyBudget.length > 0) {
                    await budgetApi.saveBudget(legacyBudget);
                    budget = legacyBudget;
                }
            }

            return budget;
        },
        async saveBudget(budget) {
            await budgetApi.saveBudget(budget);
        },
        async signOut() {
            await budgetApi.signout();
            clearAuthMode();
        },
    };
}

export async function resolveBudgetStorage() {
    if (getAuthMode() === 'guest') {
        return createGuestStorage();
    }

    try {
        await budgetApi.me();
        setUserMode();
        return createRemoteStorage();
    } catch (error) {
        clearAuthMode();
        return null;
    }
}