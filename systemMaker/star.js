function Star(mass,age,orbit){
	
	var star = {};
	
	star.mass = ko.observable(mass);
	star.age = ko.observable(age);
	star.orbit = ko.observable(orbit);
	star.guid = makeGUID();
	
	star.size = ko.pureComputed(function (){
		var result = extrapolateFromTable(lookup.starSize,'mass',star.mass());
		if(result == undefined)
		{
			console.log(lookup.starSize.map(s => s.mass).indexOf(star.mass()));
			for(var i in star) 
				if(typeof star[i] === "function")
				if(i != "size") console.log(i,star[i]());
				else console.log(i,star[i], typeof star[i]);
		}
		return result;
	});
	
	star.drawnRadius = ko.pureComputed(function (){
		//TODO: include stages!
		return star.mass()*200;
	});
	star.drawnColor = ko.pureComputed(function (){
		switch (star.size().starclass[0]){
		case 'M': return "red";
		case 'K': return "orange";
		case 'G': return "yellow";
		case 'F': return "white";
		case 'G': return "blue";
		}
		return "purple";
	});
	
	star.stage = ko.pureComputed(function (){
			var size = star.size();
			var age = star.age();
			if(size.mspan==0 || size.mspan> age) return "main";
			if(size.sspan == 0) return "white dwarf";
			if(size.sspan==0 || size.mspan+size.sspan > age) return "subgiant";
			if(size.mspan+size.sspan+size.gspan > age) return "giant";
			return "white dwarf";
	});
	
	star.luminosity = ko.pureComputed(function (){
		var size = star.size();
		if(size.lmax== 0) return size.lmin;
		var stage = star.stage();
		
		if(stage == "main")
		{
			return size.lmin + (size.lmax-size.lmin)*(star.age()/size.mspan);
		}
		if(stage == "white dwarf") return .0005;
		if(stage == 'subgiant') return size.lmax;
		if (stage == 'giant') return size.lmax*25;

	});
	
	star.displayPosition = function (distance){
		//TODO: make 700+100 a changeable and important number in index.html (planetStart and planetRange)
		//TODO: combine with planet view distance code
		var range = Math.log(star.outerLimit())-Math.log(star.innerLimit());
		var num =  display.planetRange* (Math.log(distance) - Math.log(star.innerLimit()))/range+display.planetStart;
		return num;
	}
	star.snowLine = ko.pureComputed(function (){
		return Math.pow(star.size().lmin,.5)*4.85;
	});
	star.hotHabitableZone = ko.pureComputed(function (){
		return Math.pow(278 * Math.pow(star.luminosity(),.25)/320,2)
	});
	star.coldHabitableZone = ko.pureComputed(function (){
		return Math.pow(278 * Math.pow(star.luminosity(),.25)/240,2)
	});
	
	star.radius = ko.pureComputed(function (){
		return 155000 * Math.pow(star.luminosity(),.5)/Math.pow(star.size().temp,2);
	});
	star.innerLimit = ko.pureComputed(function (){
		return Math.max(.1*star.mass(),.01*Math.pow(star.size().lmin,.5));
	});
	star.outerLimit = ko.pureComputed(function (){
		return star.mass()*40;
	});
	return star;
}
