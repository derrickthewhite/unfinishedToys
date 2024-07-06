// Helper functions to generate random names and values for planets and species
function generateRandomPlanetName() {
    const prefixes = ['Xa', 'Ze', 'Ti', 'Lo', 'Br', 'Mo', 'Ke', 'Qu', 'Va', 'Ni'];
    const suffixes = ['lia', 'nus', 'tor', 'mir', 'ris', 'ran', 'ber', 'cus', 'gon', 'tum'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return prefix + suffix;
}

function generateRandomSpeciesName() {
    const prefixes = ['Xeno', 'Hydro', 'Pyro', 'Geo', 'Bio', 'Cryo', 'Electro', 'Nucleo', 'Astro', 'Chrono'];
    const bases = ['therm', 'tox', 'phyt', 'therm', 'synth', 'gen', 'morph', 'troph', 'plasm', 'germ'];
    const suffixes = ['a', 'um', 'is', 'es', 'on', 'us', 'ae', 'ix', 'or', 'ium'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const base = bases[Math.floor(Math.random() * bases.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return prefix + base + suffix;
}

// Classes for the game
class Planet {
    constructor(name, temperature, pressure, oxygenLevel, biologyClass, biologyScale, parasites, predators) {
        this.name = name;
        this.temperature = temperature;
        this.pressure = pressure;
        this.oxygenLevel = oxygenLevel;
        this.biologyClass = biologyClass;
        this.biologyScale = biologyScale;
        this.parasites = parasites;
        this.predators = predators;
        this.colony = null;
    }

    establishColony(species) {
        if (!this.colony) {
            this.colony = new Colony(species, this);
        }
    }

    calculateHabitability(species) {
        let habitability = 0;
        habitability += Math.abs(this.temperature - species.idealTemperature) * 2;
        habitability += Math.abs(this.pressure - species.idealPressure) * 2;
        habitability += Math.abs(this.oxygenLevel - species.idealOxygenLevel) * 2;
        if (this.biologyClass !== species.biologyClass) {
            habitability += 10;
        }
        habitability += Math.abs(this.biologyScale - species.biologyScale) * 2;
        habitability += this.predators * 2;
        return habitability;
    }

    getParasiteScore(species) {
        if (this.biologyClass === species.biologyClass) {
            return Math.max(0, 10 - Math.abs(this.biologyScale - species.biologyScale));
        }
        return 0;
    }

    toString() {
        return `${this.name} - Temp: ${this.temperature}, Pressure: ${this.pressure}, Oxygen: ${this.oxygenLevel}, Bio Class: ${this.biologyClass}, Bio Scale: ${this.biologyScale}, Parasites: ${this.parasites}, Predators: ${this.predators}`;
    }
}

class Species {
    constructor(name, idealTemperature, idealPressure, idealOxygenLevel, biologyClass, biologyScale) {
        this.name = name;
        this.idealTemperature = idealTemperature;
        this.idealPressure = idealPressure;
        this.idealOxygenLevel = idealOxygenLevel;
        this.biologyClass = biologyClass;
        this.biologyScale = biologyScale;
    }

    toString() {
        return `${this.name} - Ideal Temp: ${this.idealTemperature}, Ideal Pressure: ${this.idealPressure}, Ideal Oxygen: ${this.idealOxygenLevel}, Bio Class: ${this.biologyClass}, Bio Scale: ${this.biologyScale}`;
    }
}

class Colony {
    constructor(species, planet) {
        this.species = species;
        this.planet = planet;
        this.size = 1;
        this.workDone = 0;
        this.contributesToEconomy = false;
    }

    upgrade(workUnits) {
        this.workDone += workUnits;
        let upgradeThreshold = this.getUpgradeThreshold();
        if (this.workDone >= upgradeThreshold) {
            this.size += 1;
            this.workDone -= upgradeThreshold;
        }
    }

    getUpgradeThreshold() {
        return Math.min(10000, 100 * Math.pow(this.size, 2));
    }

    toString() {
        return `Colony on ${this.planet.name} - Size: ${this.size}, Work Done: ${this.workDone}/${this.getUpgradeThreshold()}, Contributes to Economy: ${this.contributesToEconomy}`;
    }
}

class Empire {
    constructor(species) {
        this.species = species;
        this.colonies = [];
        this.economySpendTargets = [];
        this.interstellarEconomy = 0;
        this.worldsExplored = 0;
        this.planetsDiscovered = [];
        this.worldsToExplorePerTurn = 0;
    }

    addColony(planet, contributesToEconomy = false) {
        if (planet.colony && planet.colony.species !== this.species) {
            console.log(`Planet ${planet.name} already has a colony of another species.`);
            return;
        }

        if (!planet.colony) {
            planet.establishColony(this.species);
            planet.colony.contributesToEconomy = contributesToEconomy;
        }

        this.colonies.push(planet.colony);
    }

    getTotalPopulation() {
        return this.colonies.reduce((total, colony) => total + colony.size, 0);
    }

    addEconomySpendTarget(colony) {
        if (this.colonies.includes(colony) && !this.economySpendTargets.includes(colony)) {
            this.economySpendTargets.push(colony);
        } else {
            console.log(`Colony is not part of the empire or already in spend targets.`);
        }
    }

    removeEconomySpendTarget(colony) {
        const index = this.economySpendTargets.indexOf(colony);
        if (index !== -1) {
            this.economySpendTargets.splice(index, 1);
        } else {
            console.log(`Colony is not in the economy spend targets.`);
        }
    }

    setWorldsToExplorePerTurn(number) {
        this.worldsToExplorePerTurn = number;
    }

    exploreWorlds() {
        let worldsExploredThisTurn = 0;

        while (this.worldsToExplorePerTurn > 0 && this.interstellarEconomy > 0) {
            this.worldsExplored += 1;
            this.worldsToExplorePerTurn -= 1;
            this.interstellarEconomy -= 1;
            worldsExploredThisTurn += 1;

            if (this.worldsExplored % 100 === 0) {
                const newPlanet = generateRandomPlanet();
                this.planetsDiscovered.push(newPlanet);
            }
        }

        return worldsExploredThisTurn;
    }

    takeTurn() {
        // Each colony contributes either to its own upgrade or to the interstellar economy
        this.colonies.forEach(colony => {
            if (colony.contributesToEconomy) {
                this.interstellarEconomy += Math.floor(colony.size / 2);
            } else {
                colony.upgrade(colony.size);
            }
        });

        // Spend interstellar economy on upgrading target colonies
        this.economySpendTargets.forEach(colony => {
            if (this.interstellarEconomy > 0) {
                const workUnitsNeeded = colony.getUpgradeThreshold() - colony.workDone;
                const workUnitsToSpend = Math.min(this.interstellarEconomy, workUnitsNeeded);
                colony.upgrade(workUnitsToSpend);
                this.interstellarEconomy -= workUnitsToSpend;
            }
        });

        // Explore worlds
        const worldsExploredThisTurn = this.exploreWorlds();
        console.log(`Explored ${worldsExploredThisTurn} new worlds this turn.`);
		
		// Refresh the selected colony details if one is selected
		if (selectedColony) {
			displayColonyDetails(selectedColony);
		}
		
		updateEmpireSummary();
		updateColonyList();
		updateWorkList();
		document.getElementById('economy-status').textContent = `Economy: ${empire.economy}`;
    }
}

// Helper functions to generate random planets and species
function generateRandomPlanet() {
    const name = generateRandomPlanetName();
    const temperature = Math.floor(Math.random() * 5) + 1;
    const pressure = Math.floor(Math.random() * 5) + 1;
    const oxygenLevel = Math.floor(Math.random() * 5) + 1;
    const biologyClass = ['D', 'G', 'H', 'Q'][Math.floor(Math.random() * 4)];
    const biologyScale = Math.floor(Math.random() * 10) + 1;
    const parasites = Math.floor(Math.random() * 10) + 1;
    const predators = Math.floor(Math.random() * 10) + 1;
    return new Planet(name, temperature, pressure, oxygenLevel, biologyClass, biologyScale, parasites, predators);
}

function generateRandomSpecies() {
    const name = generateRandomSpeciesName();
    const idealTemperature = Math.floor(Math.random() * 5) + 1;
    const idealPressure = Math.floor(Math.random() * 5) + 1;
    const idealOxygenLevel = Math.floor(Math.random() * 5) + 1;
    const biologyClass = ['D', 'G', 'H', 'Q'][Math.floor(Math.random() * 4)];
    const biologyScale = Math.floor(Math.random() * 10) + 1;
    return new Species(name, idealTemperature, idealPressure, idealOxygenLevel, biologyClass, biologyScale);
}

// Initialize the empire and three colonies with specific sizes
let empire = new Empire(generateRandomSpecies());

let planet1 = generateRandomPlanet();
let planet2 = generateRandomPlanet();
let planet3 = new Planet(
    generateRandomPlanetName(),
    empire.species.idealTemperature,
    empire.species.idealPressure,
    empire.species.idealOxygenLevel,
    empire.species.biologyClass,
    empire.species.biologyScale,
    Math.floor(Math.random() * 10) + 1, // Random parasites
    Math.floor(Math.random() * 10) + 1  // Random predators
);

planet1.establishColony(empire.species);
planet2.establishColony(empire.species);
planet3.establishColony(empire.species);

planet1.colony.size = 50;
planet2.colony.size = 5;
planet3.colony.size = 1;

empire.colonies.push(planet1.colony);
empire.colonies.push(planet2.colony);
empire.colonies.push(planet3.colony);

// Initialize five uncolonized planets
for (let i = 0; i < 5; i++) {
    let newPlanet = generateRandomPlanet();
    empire.planetsDiscovered.push(newPlanet);
}

let selectedColony = null;

// Display empire summary and colonies list
updateEmpireSummary();
updateColonyList();
updateUncolonizedPlanetsList();

// Display empire summary
function updateEmpireSummary() {
    let summary = `
        <h2>Empire: ${empire.species.name}</h2>
        <p>Total Population: ${empire.getTotalPopulation()}</p>
        <p>Interstellar Economy: ${empire.interstellarEconomy}</p>
        <p>Worlds Explored: ${empire.worldsExplored}</p>
    `;
    document.getElementById('empire-summary').innerHTML = summary;
}

// Display colonies list using planet names
function updateColonyList() {
    let colonyList = document.getElementById('colony-list');
    colonyList.innerHTML = '';
    empire.colonies.forEach((colony, index) => {
        let colonyItem = document.createElement('li');
        colonyItem.textContent = `Colony on ${colony.planet.name}: Size ${colony.size}`;
        colonyItem.addEventListener('click', () => displayColonyDetails(colony));
        colonyList.appendChild(colonyItem);
    });
}

// Display colony details including planet stats and habitability score
function displayColonyDetails(colony) {
	selectedColony = colony;
    let habitabilityScore = colony.planet.calculateHabitability(colony.species);
    let details = `
        <h2>Colony Details</h2>
        <p>Species: ${colony.species.name}</p>
        <p>Size: ${colony.size}</p>
        <p>Work Done: ${colony.workDone}/${colony.getUpgradeThreshold()}</p>
        <p>Contributes to Economy: ${colony.contributesToEconomy}
            <button onclick="toggleEconomyContribution(${empire.colonies.indexOf(colony)})">Toggle</button>
        </p>
        <button onclick="addToWorkList(empire.colonies[${empire.colonies.indexOf(colony)}])">Add to Work List</button>
        <h3>Planet Stats</h3>
        <p>Name: ${colony.planet.name}</p>
        <p>Temperature: ${colony.planet.temperature}</p>
        <p>Pressure: ${colony.planet.pressure}</p>
        <p>Oxygen Level: ${colony.planet.oxygenLevel}</p>
        <p>Biology Class: ${colony.planet.biologyClass}</p>
        <p>Biology Scale: ${colony.planet.biologyScale}</p>
        <p>Parasites: ${colony.planet.parasites}</p>
        <p>Predators: ${colony.planet.predators}</p>
        <h3>Habitability Score</h3>
        <p>${habitabilityScore}</p>
    `;
    document.getElementById('planet-details').innerHTML = details;
}

// Update the work list display
function updateWorkList() {
    let workList = document.getElementById('work-list');
    workList.innerHTML = '';
    empire.economySpendTargets.forEach((target, index) => {
        let workItem = document.createElement('li');
        workItem.textContent = `Colony on ${target.planet.name}: Size ${target.size}`;
        workItem.addEventListener('click', () => removeFromWorkList(index));
        workList.appendChild(workItem);
    });
}

// Add a colony to the work list
function addToWorkList(colony) {
    if (!empire.economySpendTargets.includes(colony)) {
        empire.economySpendTargets.push(colony);
        updateWorkList();
    }
}

// Remove a colony from the work list
function removeFromWorkList(index) {
    empire.economySpendTargets.splice(index, 1);
    updateWorkList();
}

// Display uncolonized planets list
function updateUncolonizedPlanetsList() {
    let planetList = document.getElementById('uncolonized-planet-list');
    planetList.innerHTML = '';
    empire.planetsDiscovered.forEach((planet, index) => {
        let planetItem = document.createElement('li');
        planetItem.textContent = `${planet.name} - Temp: ${planet.temperature}, Pressure: ${planet.pressure}, Oxygen: ${planet.oxygenLevel}`;
        planetItem.addEventListener('click', () => displayPlanetDetails(planet));
        planetList.appendChild(planetItem);
    });
}

// Display uncolonized planet details
function displayPlanetDetails(planet) {
    let habitabilityScore = planet.calculateHabitability(empire.species);
    let details = `
        <h2>Planet Details</h2>
        <p>Name: ${planet.name}</p>
        <p>Temperature: ${planet.temperature}</p>
        <p>Pressure: ${planet.pressure}</p>
        <p>Oxygen Level: ${planet.oxygenLevel}</p>
        <p>Biology Class: ${planet.biologyClass}</p>
        <p>Biology Scale: ${planet.biologyScale}</p>
        <p>Parasites: ${planet.parasites}</p>
        <p>Predators: ${planet.predators}</p>
        <h3>Theoretical Habitability Score</h3>
        <p>${habitabilityScore}</p>
    `;
    document.getElementById('planet-details').innerHTML = details;
}

// Toggle economy contribution
function toggleEconomyContribution(index) {
    let colony = empire.colonies[index];
    colony.contributesToEconomy = !colony.contributesToEconomy;
    displayColonyDetails(colony);
}

// Handle take turn
document.getElementById('take-turn').addEventListener('click', () => {
    let exploreWorlds = parseInt(document.getElementById('explore-worlds').value);
    empire.setWorldsToExplorePerTurn(exploreWorlds);
    empire.takeTurn();
    updateEmpireSummary();
    updateColonyList();
    document.getElementById('economy-status').textContent = `Economy used for exploring ${exploreWorlds} worlds.`;
});

// Initialize interface
updateEmpireSummary();
updateColonyList();
updateUncolonizedPlanetsList();
updateWorkList();
