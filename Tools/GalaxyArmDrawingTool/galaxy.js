const canvas = document.getElementById('galaxyCanvas');
const ctx = canvas.getContext('2d');

const drawStarArms = true;
const drawStarBulge = false;

const armOffset = 520 + bulgeAdjust;
const bendPoint = .15;
const regressPoint = .2;

const armRotMod = .3;

let seed = 1;

function seededRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function drawStar(x, y, starColor) {
    ctx.fillStyle = starColor; // Color of the star based on galaxyColor
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2); // Adjust the radius (here 1) for star size
    ctx.fill();
}

function drawNebula(x, y, nebulaColor, nebulaSize) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, nebulaSize);
    gradient.addColorStop(0, `${nebulaColor}80`); // Center color with opacity
    gradient.addColorStop(1, `${nebulaColor}00`); // Edge color transparent
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, nebulaSize, 0, Math.PI * 2); // Larger radius for a cloudy effect
    ctx.fill();
}

function drawSpiralCurve(ctx, width, shadowBlur, centerX, centerY, armAngle, armSharpness, radius, armRadiusCoefficient, thetaStep) {
    ctx.save();
    ctx.strokeStyle = '#444444'
    ctx.lineWidth = width;
	
	ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = 'white';
	
    ctx.beginPath();

	let strokeCounter = 0;
	
	const armRotation = .55 - armRotMod;
    for (let theta = 0; theta < Math.PI * 2 * armRotation; theta += thetaStep) {
		//const truncatedTheta = Math.min(theta, Math.PI *2 * .5);
		const truncatedTheta = 
			theta > Math.PI*2 * regressPoint? (Math.PI*2*bendPoint + (Math.PI*2*regressPoint - Math.PI*2*bendPoint)/2 + (theta - Math.PI*2 * regressPoint)/4) :
			theta > Math.PI*2 * bendPoint? (Math.PI*2 *bendPoint + theta)/2 : theta;
        const armRadius = armRadiusCoefficient * radius * Math.exp(armSharpness * truncatedTheta) -armOffset;
        const x = centerX + (armRadius) * Math.cos(theta + armAngle);
        const y = centerY + (armRadius) * Math.sin(theta + armAngle);

        if (theta === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
		if(strokeCounter++ %500 ==0){
			ctx.stroke();
			const adjustment = (Math.PI *2 * armRotation - theta)/(Math.PI*2 * armRotation)
			const baseValue = 180
			ctx.lineWidth = width * adjustment;
			ctx.strokeStyle = `rgb(${baseValue*adjustment},${baseValue*adjustment},${baseValue*adjustment})`;
			ctx.beginPath();
		}
		
    }

    ctx.stroke();
    ctx.restore();
}

function drawSpiralArm(centerX, centerY, radius, armAngle, armSharpness, armRotations, starDensity, armRadiusCoefficient, starFuzziness, thetaStep, galaxyColor, nebulaDensity, nebulaColor, nebulaSize) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
	
	thetaStep = thetaStep/3;
	starFuzziness = starFuzziness * 2

    const armDensity = 1; // Set arm density to 1 for maximum density
	
	var count = 0;
    // Draw spiral arms
    for (let theta = 0; theta <= Math.PI * 2 * armRotations; theta += thetaStep) {
		//const truncatedTheta = Math.min(theta, Math.PI *2 * .5);
		const truncatedTheta = 
			theta > Math.PI*2 * regressPoint? (Math.PI*2*bendPoint + (Math.PI*2*regressPoint - Math.PI*2*bendPoint)/2 + (theta - Math.PI*2 * regressPoint)/4) :
			theta > Math.PI*2 * bendPoint? (Math.PI*2 *bendPoint + theta)/2 : theta;
        const armRadius = armRadiusCoefficient * radius * Math.exp(armSharpness * truncatedTheta) -armOffset;

        // Scatter factor decreases as theta increases
        const scatterFactor = Math.PI/8> theta? 
		.6:
		(Math.PI * 2 * armRotations - theta) / (Math.PI * 2 * armRotations);
        const fuzzX = seededRandom() * starFuzziness * scatterFactor - starFuzziness * scatterFactor / 2;
        const fuzzY = seededRandom() * starFuzziness * scatterFactor - starFuzziness * scatterFactor / 2;
		
		if(count++ %100 == 0) {
			console.log(theta, scatterFactor, Math.PI/8> theta);
		}
		
        const x = centerX + (armRadius) * Math.cos(theta + armAngle) + fuzzX;
        const y = centerY + (armRadius) * Math.sin(theta + armAngle) + fuzzY;
        if (seededRandom() < starDensity * armDensity *scatterFactor) {
            drawStar(x, y, galaxyColor); // Draw star with galaxyColor
        }

        if (seededRandom() < nebulaDensity * armDensity * scatterFactor) {
            drawNebula(x, y, nebulaColor, nebulaSize); // Draw nebula with nebulaColor
        }

        //ctx.lineTo(x, y);
    }

    //ctx.strokeStyle = galaxyColor;
    //ctx.stroke();
}

function drawBulge(centerX, centerY, starFuzziness, bulgeRadius, bulgeDensity, galaxyColor, nebulaDensity, nebulaColor, nebulaSize) {
	const flatFactor = .9;
    // Draw central bulge
    const bulgeRadiusSquared = bulgeRadius * bulgeRadius;
    for (let x = -bulgeRadius; x <= bulgeRadius; x++) {
        for (let y = -bulgeRadius; y <= bulgeRadius; y++) {
            if (x * x + y * y * flatFactor <= bulgeRadiusSquared) {
                const fuzzX = seededRandom() * starFuzziness - starFuzziness / 2;
                const fuzzY = (seededRandom() * starFuzziness - starFuzziness / 2) / flatFactor;
                const bx = centerX + x + fuzzX;
                const by = centerY + y + fuzzY;

                if (seededRandom() < bulgeDensity) {
                    drawStar(bx, by, galaxyColor); // Draw star with galaxyColor
                }

                if (seededRandom() < nebulaDensity) {
                    drawNebula(bx, by, nebulaColor, nebulaSize); // Draw nebula with nebulaColor
                }
            }
        }
    }
}

function generateArms(controlPrefix) {
    const armCount = parseInt(document.getElementById(`armCount${controlPrefix}`).value);
    const armSharpness = parseFloat(document.getElementById(`armSharpness${controlPrefix}`).value);
    const armRotations = parseFloat(document.getElementById(`armRotations${controlPrefix}`).value) -armRotMod;
    const starDensity = parseFloat(document.getElementById(`starDensity${controlPrefix}`).value);
    const galaxyColor = document.getElementById(`galaxyColor${controlPrefix}`).value;
    const seedInput = parseInt(document.getElementById(`seedInput${controlPrefix}`).value);
    const armRadiusCoefficient = parseFloat(document.getElementById(`armRadiusCoefficient${controlPrefix}`).value);
    const starFuzziness = parseFloat(document.getElementById(`starFuzziness${controlPrefix}`).value);
    const bulgeRadius = parseFloat(document.getElementById(`bulgeRadius${controlPrefix}`).value);
    const bulgeDensity = parseFloat(document.getElementById(`bulgeDensity${controlPrefix}`).value);
    const thetaStep = parseFloat(document.getElementById(`thetaStep${controlPrefix}`).value);
    const nebulaDensity = parseFloat(document.getElementById(`nebulaDensity${controlPrefix}`).value);
    const bulgeNebulaDensity = parseFloat(document.getElementById(`bulgeNebulaDensity${controlPrefix}`).value);
    const nebulaColor = document.getElementById(`nebulaColor${controlPrefix}`).value;
    const nebulaSize = document.getElementById(`nebulaSize${controlPrefix}`).value;

    // Set seed based on user input or use default seed
    seed = isNaN(seedInput) ? seed : seedInput;

    const centerX = canvas.width / 2 ;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;
	

    // Draw the spiral arms
    for (let i = 0; i < armCount; i++) {
        const armAngle = (i / armCount) * Math.PI * 2;
        drawSpiralArm(centerX, centerY, radius, armAngle, armSharpness, armRotations, starDensity, armRadiusCoefficient, starFuzziness, thetaStep, galaxyColor, nebulaDensity, nebulaColor, nebulaSize);
    }
} 

function generateBulge(controlPrefix) {
    const armCount = parseInt(document.getElementById(`armCount${controlPrefix}`).value);
    const armSharpness = parseFloat(document.getElementById(`armSharpness${controlPrefix}`).value);
    const armRotations = parseFloat(document.getElementById(`armRotations${controlPrefix}`).value);
    const starDensity = parseFloat(document.getElementById(`starDensity${controlPrefix}`).value);
    const galaxyColor = document.getElementById(`galaxyColor${controlPrefix}`).value;
    const seedInput = parseInt(document.getElementById(`seedInput${controlPrefix}`).value);
    const armRadiusCoefficient = parseFloat(document.getElementById(`armRadiusCoefficient${controlPrefix}`).value);
    const starFuzziness = parseFloat(document.getElementById(`starFuzziness${controlPrefix}`).value);
    const bulgeRadius = parseFloat(document.getElementById(`bulgeRadius${controlPrefix}`).value);
    const bulgeDensity = parseFloat(document.getElementById(`bulgeDensity${controlPrefix}`).value);
    const thetaStep = parseFloat(document.getElementById(`thetaStep${controlPrefix}`).value);
    const nebulaDensity = parseFloat(document.getElementById(`nebulaDensity${controlPrefix}`).value);
    const bulgeNebulaDensity = parseFloat(document.getElementById(`bulgeNebulaDensity${controlPrefix}`).value);
    const nebulaColor = document.getElementById(`nebulaColor${controlPrefix}`).value;
    const nebulaSize = document.getElementById(`nebulaSize${controlPrefix}`).value;

    // Set seed based on user input or use default seed
    seed = isNaN(seedInput) ? seed : seedInput;

    const centerX = canvas.width / 2 ;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;

    // Draw the central bulge once
    drawBulge(centerX, centerY, starFuzziness, bulgeRadius, bulgeDensity, galaxyColor, bulgeNebulaDensity, nebulaColor, nebulaSize);

}

function generateGalaxyBackground(){
    const armCount = parseInt(document.getElementById(`armCount${1}`).value);
    const armSharpness = parseFloat(document.getElementById(`armSharpness${1}`).value);
    const armRadiusCoefficient = parseFloat(document.getElementById(`armRadiusCoefficient${1}`).value);
	    const thetaStep = parseFloat(document.getElementById(`thetaStep${1}`).value);


    const centerX = canvas.width / 2 ;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;
	if(drawStarBulge) {
		ctx.save();
		ctx.shadowBlur = 100;
		ctx.shadowColor = '#444444';
		ctx.fillStyle = 'white';
		
		ctx.beginPath();
		ctx.arc(centerX, centerY, 160 - bulgeAdjust, 0, Math.PI * 2);
		ctx.fill();


		ctx.beginPath();
		ctx.arc(centerX, centerY, 160-bulgeAdjust, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.fillStyle = "black";
		ctx.beginPath();
		ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.restore();
	}

	const glows = [[70,50],[70,100], [70,200]];
	for(let pass = 0; pass< glows.length && drawStarArms; pass++)
		for (let i = 0; i < armCount; i++) {
			const armAngle = (i / armCount) * Math.PI * 2;
			drawSpiralCurve(ctx, glows[pass][0], glows[pass][1], centerX, centerY, armAngle, armSharpness, radius, armRadiusCoefficient, thetaStep)
		}
	ctx.shadowBlur = 0;
}

function generateGalaxy() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	//generateGalaxyBackground();
	
	for(var i = 1;i <= galaxyLayerCount; i++){
		if(drawStarArms) generateArms(''+i);
		if(drawStarBulge) generateBulge(''+i);
		console.log("generated layer " +i)
	}


	/*
	const centerX = canvas.width / 2 ;
    const centerY = canvas.height / 2;

	ctx.fillStyle = "black";
	ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
	*/
}

generateGalaxy();
