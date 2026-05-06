import { createBudgetViewModel } from './budget-model.js';
import { resolveBudgetStorage } from './budget-storage.js';

async function initializeBudgetPage() {
    const storage = await resolveBudgetStorage();
    if (!storage) {
        window.location.replace('index.html');
        return;
    }

    const budget = createBudgetViewModel(storage);
    await budget.load();
    if (budget.months().length === 0) {
        budget.addMonth();
    }

    ko.applyBindings(budget, document.getElementById('display'));
    document.getElementById('signout-button').addEventListener('click', () => {
        void budget.signOut();
    });
    document.body.classList.remove('app-loading');
}

initializeBudgetPage().catch((error) => {
    alert(error.message || 'Unable to open the budget app right now.');
    window.location.replace('index.html');
});