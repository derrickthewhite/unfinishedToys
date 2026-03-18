let boxes = [];
let selectedSettlementBox = null;
let currentSettlement = null;
let resourceBoxes = [];
let recipeBoxes = [];

// Create a box function
function createBox(x, y, width = 100, height = 100, text = "", settlement = null) {
    const group = new Konva.Group({
        x,
        y,
        draggable: true,
        width,
        height
    });

    const box = new Konva.Rect({
        width,
        height,
        fill: 'lightblue',
        stroke: 'black',
        strokeWidth: 2,
    });

    const label = new Konva.Text({
        text,
        fontSize: 16,
        fill: 'black',
        width,
        align: 'center',
        y: height / 2 - 10
    });

    group.add(box);
    group.add(label);
    layer.add(group);

    boxes.push({ group, box, settlement });

    group.on('dblclick', () => {
        if (selectedSettlementBox === group) {
            selectedSettlementBox = null;
			currentSettlement = null;
            box.strokeWidth(2);
            box.stroke('black');
            clearResourceBoxes();
            clearRecipeBoxes();
        } else {
            if (selectedSettlementBox) {
                selectedSettlementBox.children[0].strokeWidth(2);
                selectedSettlementBox.children[0].stroke('black');
            }
            selectedSettlementBox = group;
			currentSettlement = settlement;
            box.strokeWidth(5);
            box.stroke('blue');
            showRecipes(settlement);
            showResources(settlement);
        }
        layer.batchDraw();
    });

    group.on('dragend', (e) => {
        const draggedBox = e.target;
        boxes.forEach(targetBox => {
            if (targetBox.group !== draggedBox && haveIntersection(draggedBox, targetBox.group)) {
                console.log('Box dropped into another box', draggedBox, targetBox.group);
            }
        });
    });

    layer.batchDraw();
}

function haveIntersection(r1, r2) {
    const r1Box = r1.getClientRect();
    const r2Box = r2.getClientRect();
    return (
        r1Box.x < r2Box.x + r2Box.width &&
        r1Box.x + r1Box.width > r2Box.x &&
        r1Box.y < r2Box.y + r2Box.height &&
        r1Box.y + r1Box.height > r2Box.y
    );
}

function showRecipes(settlement) {
    clearRecipeBoxes();
    if (!settlement) return;

    let yOffset = 500;
    settlement.recipes.forEach(recipe => {
        const recipeBox = new Konva.Group({
            x: 500,
            y: yOffset,
            width: 200,
            height: 120,
            draggable: true
        });

        const rect = new Konva.Rect({
            width: 200,
            height: 120,
            fill: 'lightgreen',
            stroke: 'black',
            strokeWidth: 2,
        });

        const text = new Konva.Text({
            text: `${recipe.name} (x${recipe.quantity})`,
            fontSize: 14,
            fill: 'black',
            width: 200,
            align: 'center',
            y: 10,
        });

        const inputsText = new Konva.Text({
            text: `In: ${Object.entries(recipe.inputs).map(([k, v]) => `${v} ${k}`).join(', ')}`,
            fontSize: 12,
            fill: 'black',
            width: 200,
            align: 'left',
            y: 40,
        });

        const outputsText = new Konva.Text({
            text: `Out: ${Object.entries(recipe.outputs).map(([k, v]) => `${v} ${k}`).join(', ')}`,
            fontSize: 12,
            fill: 'black',
            width: 200,
            align: 'left',
            y: 70,
        });

        recipeBox.add(rect);
        recipeBox.add(text);
        recipeBox.add(inputsText);
        recipeBox.add(outputsText);

        layer.add(recipeBox);
        recipeBoxes.push({recipeBox, recipe});

        yOffset += 140;
    });

    layer.batchDraw();
}

function clearRecipeBoxes() {
    recipeBoxes.forEach(box => box.recipeBox.destroy());
    recipeBoxes = [];
    layer.batchDraw();
}

if (typeof settlements !== 'undefined') {
    settlements.forEach((settlement, index) => {
        const name = `${settlement.name}`;
        const humans = settlement.getResources()["Humans"] || 0;
        createBox(150 + index * 120, 150, 120, 80, `${name}\nHumans: ${humans}`, settlement);
    });
}
