class Settlement {
    constructor(id, name, description = "A thriving settlement.") {
        this.id = id;
        this.name = name;
        this.description = description;
        this.resources = {};
        this.spending = [];
        this.recipes = [];
    }

    addResource(name, amount) {
        if (this.resources[name]) {
            this.resources[name] += amount;
        } else {
            this.resources[name] = amount;
        }
    }

    getResources() {
        return this.resources;
    }

    addSpending(resource, target, recipe) {
        this.spending.push({ resource, target, recipe });
    }

    addRecipe(recipe) {
        this.recipes.push(recipe);
    }
}

class Recipe {
    constructor(name, quantity, inputs, outputs) {
        this.name = name;
        this.quantity = quantity;
        this.inputs = inputs;
        this.outputs = outputs;
    }
}

// Define settlements with specific resources
const settlements = [
    new Settlement(1, "Orbit"),
    new Settlement(2, "Port"),
    new Settlement(3, "Mine")
];

// Define global recipes
const globalRecipes = [
    new Recipe("Work", 1, { "Humans": 1 }, { "Labor": 1 }),
    new Recipe("Agriculture", 1, { "Labor": 1, "Land": 1, "Water": 1 }, { "Food": 4 })
];

// Assign specific resources to settlements
settlements[0].addResource("Humans", 1000);
settlements[0].addResource("Food", 5000);
settlements[0].addResource("Water", 5000);
settlements[0].addResource("Housing", 1000);
settlements[0].addResource("Land", 0);
settlements[0].addResource("Electronic Chips", 5000);
settlements[0].addResource("Homeworld Credits", 1000000);
settlements[0].addResource("Labor", 0);

settlements[1].addResource("Humans", 1000);
settlements[1].addResource("Food", 0);
settlements[1].addResource("Water", 1000000);
settlements[1].addResource("Housing", 1000);
settlements[1].addResource("Land", 1000);
settlements[1].addResource("Electronic Chips", 1000);
settlements[1].addResource("Homeworld Credits", 1000000);
settlements[1].addResource("Labor", 0);

settlements[2].addResource("Humans", 1000);
settlements[2].addResource("Food", 0);
settlements[2].addResource("Water", 10000);
settlements[2].addResource("Housing", 1000);
settlements[2].addResource("Land", 1000);
settlements[2].addResource("Electronic Chips", 1000);
settlements[2].addResource("Homeworld Credits", 1000000);
settlements[2].addResource("Labor", 0);

// Assign global recipes to settlements
settlements.forEach(settlement => {
    globalRecipes.forEach(recipe => {
        settlement.addRecipe(new Recipe(recipe.name, 0, recipe.inputs, recipe.outputs));
    });
});

console.log(settlements, globalRecipes);
