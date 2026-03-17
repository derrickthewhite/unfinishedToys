const unitData = {
    "Space Knight": {
        name: "Space Knight",
        image: "Assets/space_knight.svg",
        currentHP: 10,
        maxHP: 10,
        maxMove: 5,
        currentMove: 5,
        speed: 6,
        HT: 11,
        currentFP: 11,
        maxFP: 11,
        maxAttacks: 1,
		currentAttacks:1,
        attacks: [
            { name: "Force Sword", skill: 18, damage: "8d6+8", range: "1-2", type: "Melee", image: "Assets/force_sword.svg" },
            { name: "Punch", skill: 14, damage: "1d6", range: "0", type: "Melee", image: "Assets/punch.svg" }
        ],
        defenses: [
            { name: "Dodge", skill: 10, penalty: 0, defendRanged: true, image: "Assets/dodge.svg" },
            { name: "Block", skill: 14, penalty: -4, defendRanged: true, image: "Assets/block.svg" },
            { name: "Sword Parry", skill: 14, penalty: -2, defendRanged: false, image: "Assets/sword_parry.svg" }
        ]
    },
    "Gaunt": {
        name: "Gaunt",
        image: "Assets/gaunt.svg",
        currentHP: 20,
        MaxHP: 20,
        maxMove: 4,
        currentMove: 0,
        speed: 4,
        HT: 13,
        currentFP: 0,
        maxFP: 0,
        maxAttacks: 1,
		currentAttacks:0,
        attacks: [
            { name: "Bite", skill: 15, damage: "8d6-1", range: "0", type: "Melee", image: "Assets/bite.svg" },
            { name: "Punch", skill: 14, damage: "1d6", range: "0", type: "Melee", image: "Assets/punch.svg" }
        ],
        defenses: [
            { name: "Dodge", skill: 10, penalty: 0, defendRanged: true, image: "Assets/dodge.svg" },
            { name: "Hand Parry", skill: 12, penalty: -4, defendRanged: false, image: "Assets/hand_parry.svg" }
        ]
    },
    "Gunslinger": {
        name: "Gunslinger",
        image: "Assets/gunslinger.svg",
        currentHP: 11,
        MaxHP: 11,
        maxMove: 7,
        currentMove: 0,
        speed: 6,
        HT: 11,
        currentFP: 11,
        maxFP: 11,
        maxAttacks: 1,
		currentAttacks:0,
        attacks: [
            { name: "Pistol", skill: 20, damage: "4d6", range: "100/200", type: "Ranged", image: "Assets/pistol.svg" },
            { name: "Punch", skill: 14, damage: "1d6", range: "0", type: "Melee", image: "Assets/punch.svg" }
        ],
        defenses: [
            { name: "Dodge", skill: 10, penalty: 0, defendRanged: true, image: "Assets/dodge.svg" },
            { name: "Hand Parry", skill: 12, penalty: -4, defendRanged: false, image: "Assets/hand_parry.svg" }
        ]
    }
};

const terrainData = {
    "Tree": { image: "Assets/tree.svg", effects: ["blocking"] },
    "Bush": { image: "Assets/bush.svg", effects: ["bad footing"] },
    "Rock": { image: "Assets/rock.svg", effects: ["blocking"] },
    "Pillar": { image: "Assets/pillar.svg", effects: ["elevated"] }
};
