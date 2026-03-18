let activeConnections = new Map();

function showResources(settlement) {
    clearResourceBoxes();
    if (!settlement) return;
    
    const resources = settlement.getResources();
    let yOffset = 300;
    
    for (const [name, amount] of Object.entries(resources)) {
        const resourceBox = new Konva.Group({
            x: 50,
            y: yOffset,
            width: 120,
            height: 40,
            draggable: true
        });

        const rect = new Konva.Rect({
            width: 120,
            height: 40,
            fill: 'lightgray',
            stroke: 'black',
            strokeWidth: 2,
        });

        const text = new Konva.Text({
            text: `${name}: ${amount}`,
            fontSize: 14,
            fill: 'black',
            width: 120,
            align: 'center',
            y: 10,
        });

        resourceBox.add(rect);
        resourceBox.add(text);

        const positions = [
            { x: 60, y: 0 },
            { x: 60, y: 40 },
            { x: 0, y: 20 },
            { x: 120, y: 20 }
        ];

        positions.forEach(pos => {
            const connector = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: 5,
                fill: 'red'
            });
            
            if (!activeConnections.has(connector)) {
                activeConnections.set(connector, []);
            }

            connector.on('mousedown', (e) => {
                e.cancelBubble = true;
                const startPos = connector.getAbsolutePosition();
                
                const tempCircle = new Konva.Circle({
                    x: startPos.x,
                    y: startPos.y,
                    radius: 5,
                    fill: 'red',
                    draggable: true
                });
                
                const tempLine = new Konva.Line({
                    points: [startPos.x, startPos.y, startPos.x, startPos.y],
                    stroke: 'red',
                    strokeWidth: 2
                });
                
                layer.add(tempLine);
                layer.add(tempCircle);
                
                activeConnections.get(connector).push(tempLine);
                
                tempCircle.startDrag();
                
                tempCircle.on('dragmove', () => {
                    tempLine.points([
                        startPos.x, startPos.y,
                        tempCircle.x(), tempCircle.y()
                    ]);
                    layer.batchDraw();
                });
                
                tempCircle.on('dragend', () => {
                    let droppedOnRecipe = false;
                    recipeBoxes.forEach(recipeBox => {
                        if (haveIntersection(tempCircle, recipeBox.recipeBox)) {
                            console.log('Resource connected to recipe', resourceBox, recipeBox);
							console.log("temp cirlce", tempCircle);
							recipeBox.recipeBox.add(tempCircle);
							//todo: reposition on box
							//todo: change what dragging does
                            droppedOnRecipe = true;
							
							currentSettlement.addSpending(name, 0, recipeBox.recipe);
							
							console.log("spending", currentSettlement.spending)
                        }
                    });
                    
                    if (!droppedOnRecipe) {
                        tempCircle.destroy();
                        tempLine.destroy();
                    }
                    layer.batchDraw();
                });
            });

            resourceBox.add(connector);
        });

        layer.add(resourceBox);
        resourceBoxes.push(resourceBox);

        resourceBox.on('dragmove', () => {
            resourceBox.children.forEach((child) => {
                if (child instanceof Konva.Circle) {
                    const lines = activeConnections.get(child) || [];
                    lines.forEach(line => {
                        line.points([
                            child.getAbsolutePosition().x,
                            child.getAbsolutePosition().y,
                            line.points()[2],
                            line.points()[3]
                        ]);
                    });
                }
            });
            layer.batchDraw();
        });

        resourceBox.on('dragend', (e) => {
            const draggedBox = e.target;
            resourceBoxes.forEach(targetResourceBox => {
                if (draggedBox !== targetResourceBox && haveIntersection(draggedBox, targetResourceBox)) {
                    console.log('Resource box dropped onto another resource box', draggedBox, targetResourceBox);
                }
            });
            boxes.forEach(targetBox => {
                if (haveIntersection(draggedBox, targetBox.group)) {
                    console.log('Resource box dropped into settlement box', draggedBox, targetBox.group);
                }
            });
            recipeBoxes.forEach(recipeBox => {
                if (haveIntersection(draggedBox, recipeBox)) {
                    console.log('Resource dropped onto recipe', draggedBox, recipeBox);
                }
            });
        });

        yOffset += 50;
    }
    
    layer.batchDraw();
}

function clearResourceBoxes() {
    resourceBoxes.forEach(box => box.destroy());
    resourceBoxes = [];
    activeConnections.clear();
    layer.batchDraw();
}
