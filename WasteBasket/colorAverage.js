function averageColor(colorA, colorB) {
	colorA = colorA.match(/.{2}/g).map(component => parseInt(component, 16));
	colorB = colorB.match(/.{2}/g).map(component => parseInt(component, 16));
	var resultNumbers = [];
	for (var i = 0; i < 3; i++) {
		resultNumbers[i] = (colorA[i] +colorB[i]) / 2;
		resultNumbers[i] = Math.round(resultNumbers[i]);
	}
	return resultNumbers.reduce((output, colorComponent) =>
		output + colorComponent.toString(16), "");
}

function averageColor(colorA, colorB) {
	colorA = parseInt(colorA, 16);
	colorB = parseInt(colorB, 16);
	var componentMasks = [0xFF0000, 0x00FF00, 0x0000FF];
	return componentMasks.map(mask =>
			(((colorA & mask) + (colorB & mask)) / 2) + mask / (0X0000FF * 2) & mask)
		.reduce((output, component) => output + component).toString(16);
}

function generateColor(){
	return ['r','g','b'].map(color=>Math.floor(Math.random()*256).toString(16)).reduce((out,component)=>out+component).padStart(6,0);
}

function compareColorFunctions(){
	
	var a = generateColor();
	var b = generateColor();
	console.log(a,b,averageColor(a,b)==bitwiseAverageColor(a,b),averageColor(a,b),bitwiseAverageColor(a,b))
}