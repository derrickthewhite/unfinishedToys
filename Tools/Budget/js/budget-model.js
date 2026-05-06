function formatDollars(amountStr) {
    const num = parseFloat(amountStr);
    if (Number.isNaN(num)) {
        return '$0.00';
    }

    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatPercent(value, fromFraction = true) {
    let num = parseFloat(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
        return '0%';
    }

    if (fromFraction) {
        num *= 100;
    }

    return num.toFixed(2) + '%';
}

function normalizeColor(value) {
    const raw = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
        return raw.toUpperCase();
    }

    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
        return ('#' + raw).toUpperCase();
    }

    return '#FADADD';
}

export function createBudgetViewModel(storage) {
    let budget;
    let history = [];
    let redoHistory = [];

    function Entry(data) {
        const entry = {};
        entry.name = ko.observable(data?.name || '');
        entry.amount = ko.observable(Number(data?.amount) || 0);
        entry.edit = ko.observable(data ? false : true);
        entry.toggleEdit = function () {
            if (entry.edit()) {
                void budget.save();
            }
            entry.edit(!entry.edit());
        };
        entry.save = () => ({
            name: entry.name(),
            amount: entry.amount(),
        });

        entry.clearZero = () => {
            if (entry.amount() === 0 || entry.amount() === '0') {
                entry.amount('');
            }
        };

        return entry;
    }

    function Category(data) {
        const category = {};
        category.name = ko.observable(data?.name || 'New Category');
        category.entries = ko.observableArray((data?.entries || []).map((entry) => new Entry(entry)));
        category.expected = ko.observable(data?.expected ? data.expected : 0);
        category.collapsed = ko.observable(data ? Boolean(data.collapsed) : false);
        category.editName = ko.observable(false);
        category.customColor = ko.observable(normalizeColor(data?.customColor));
        category.total = ko.pureComputed(() => {
            return category.entries().reduce((soFar, amount) => soFar + Number(amount.amount()), 0);
        });
        category.newExpense = function () {
            const expense = new Entry();
            expense.name('');
            category.entries.push(expense);
        };
        category.save = () => ({
            name: category.name(),
            entries: category.entries().map((entry) => entry.save()),
            expected: category.expected(),
            collapsed: category.collapsed(),
            customColor: category.customColor(),
        });
        category.deleteEntry = (entry) => {
            if (confirm('Are you sure you want to delete this expense: ' + entry.name() + ' for $' + entry.amount())) {
                category.entries.remove(entry);
                void budget.save();
            }
        };
        category.toggleEditName = () => {
            if (category.editName()) {
                void budget.save();
            }
            category.editName(!category.editName());
        };
        category.toggleCollapsed = () => {
            category.collapsed(!category.collapsed());
        };
        category.clearExpected = () => {
            category.expected('');
        };

        return category;
    }

    function Month(data) {
        const month = {
            name: ko.observable(data?.name || 'New Month'),
            income: ko.observableArray((data?.income || []).map((entry) => new Entry(entry))),
            expenses: ko.observableArray((data?.expenses || []).map((category) => new Category(category))),
            editName: ko.observable(false),
            editIncome: ko.observable(false),
            editExpectedExpense: ko.observable(false),
            expectedIncome: ko.observable(data?.expectedIncome || 0),
            expectedExpenses: ko.observable(data?.expectedExpenses || 0),
            incomeCollapsed: ko.observable(true),
        };

        month.totalExpense = ko.pureComputed(() => {
            return month.expenses().reduce((soFar, category) => soFar + category.total(), 0);
        });

        month.totalIncome = ko.pureComputed(() => {
            return month.income().reduce((soFar, entry) => soFar + Number(entry.amount()), 0);
        });

        month.toggleEditIncome = () => {
            if (month.editIncome()) {
                void budget.save();
            }
            month.editIncome(!month.editIncome());
        };
        month.toggleEditExpenses = () => {
            if (month.editExpectedExpense()) {
                void budget.save();
            }
            month.editExpectedExpense(!month.editExpectedExpense());
        };

        month.newCategory = () => {
            const category = new Category();
            month.expenses.push(category);
        };

        month.newIncome = () => {
            const income = new Entry();
            income.name('new income');
            month.income.push(income);
        };

        month.deleteIncome = (entry) => {
            month.income.remove(entry);
            void budget.save();
        };

        month.deleteCategory = (category) => {
            if (confirm('Are you sure you want to delete this whole Category: ' + category.name())) {
                month.expenses.remove(category);
                void budget.save();
            }
        };

        month.toggleEditName = () => {
            if (month.editName()) {
                void budget.save();
            }
            month.editName(!month.editName());
        };

        month.toggleIncomeCollapsed = () => {
            month.incomeCollapsed(!month.incomeCollapsed());
        };

        month.save = () => ({
            name: month.name(),
            income: month.income().map((entry) => entry.save()),
            expenses: month.expenses().map((expense) => expense.save()),
            expectedIncome: month.expectedIncome(),
            expectedExpenses: month.expectedExpenses(),
        });

        month.moveExpenseUp = function (expense) {
            const expenses = month.expenses();
            const index = expenses.indexOf(expense);
            if (index > 0) {
                expenses.splice(index, 1);
                expenses.splice(index - 1, 0, expense);
                month.expenses.valueHasMutated();
                void budget.save();
            }
        };
        month.moveExpenseDown = function (expense) {
            const expenses = month.expenses();
            const index = expenses.indexOf(expense);
            if (index >= 0 && index < expenses.length - 1) {
                expenses.splice(index, 1);
                expenses.splice(index + 1, 0, expense);
                month.expenses.valueHasMutated();
                void budget.save();
            }
        };

        return month;
    }

    function snapshotMonths() {
        return budget.months().map((month) => month.save());
    }

    function serializeMonths() {
        return JSON.stringify(snapshotMonths());
    }

    function applyMonths(parsedMonths) {
        budget.months((parsedMonths || []).map((month) => new Month(month)));
        budget.currentMonth(budget.months()[budget.months().length - 1]);
    }

    async function persistSnapshot(options = {}) {
        const { recordHistory = true, clearRedo = true } = options;
        const budgetStruct = snapshotMonths();
        const budgetString = JSON.stringify(budgetStruct);

        if (recordHistory && history[history.length - 1] !== budgetString) {
            history.push(budgetString);
        }
        if (clearRedo) {
            redoHistory = [];
        }

        await storage.saveBudget(budgetStruct);
    }

    budget = {
        months: ko.observableArray([]),
        currentMonth: ko.observable(),
        monthsCollapsed: ko.observable(true),
        formatDollars,
        formatPercent,
        async load() {
            const parsed = await storage.loadBudget();
            applyMonths(Array.isArray(parsed) ? parsed : []);
            history = [];
            redoHistory = [];

            if (budget.months().length > 0) {
                history.push(serializeMonths());
            }
        },
        async save(options) {
            try {
                await persistSnapshot(options);
            } catch (error) {
                alert(error.message || 'Unable to save the budget right now.');
            }
        },
        async signOut() {
            try {
                await storage.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                alert(error.message || 'Unable to sign out right now.');
            }
        },
    };

    budget.addMonth = function () {
        const month = new Month();
        budget.months.push(month);
        budget.currentMonth(month);
        void budget.save();
    };
    budget.deleteMonth = function (month) {
        if (confirm('Are you sure you want to delete this whole Month of ' + month.name())) {
            budget.months.remove(month);
            budget.currentMonth(budget.months()[budget.months().length - 1]);
            void budget.save();
        }
    };
    budget.copyMonth = function () {
        const month = new Month();

        month.expectedIncome(budget.currentMonth().expectedIncome());
        month.expectedExpenses(budget.currentMonth().expectedExpenses());
        budget.currentMonth().expenses().forEach((category) => {
            const copiedCategory = new Category({
                name: category.name(),
                expected: category.expected(),
                customColor: category.customColor(),
            });
            month.expenses.push(copiedCategory);
        });

        budget.months.push(month);
        budget.currentMonth(month);
        void budget.save();
    };

    budget.toggleMonthsCollapsed = function () {
        budget.monthsCollapsed(!budget.monthsCollapsed());
    };

    budget.undo = async function () {
        if (history.length > 1) {
            const currentState = history.pop();
            const historicalState = history[history.length - 1];
            redoHistory.push(currentState);
            applyMonths(JSON.parse(historicalState));
            await budget.save({ recordHistory: false, clearRedo: false });
        }
    };

    budget.redo = async function () {
        if (redoHistory.length > 0) {
            const data = redoHistory.pop();
            applyMonths(JSON.parse(data));
            if (history[history.length - 1] !== data) {
                history.push(data);
            }
            await budget.save({ recordHistory: false, clearRedo: false });
        }
    };

    return budget;
}