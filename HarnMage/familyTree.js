function generateFamilyTree(){
	var tree;
	
	var people = [];
	
	return tree;
}

function firstChild(){
	return expandingRoll() + expandingRoll()+ 14;
}
function maleMarriageAge() {
	return 14+expandingRoll() + expandingRoll();
}
function marriageGap() {
	return expandingRoll() + expandingRoll() -4;
}
function childGap(age) {
	var mode = age<35? "young": age< 40? "middle": "old"
	var die1 = 6;
	var die2 = 6;
	switch (mode){
		case "young":	
			die1 = 6;
			die2 = 6;
			break;
		case "middle": 
			die1 = 10;
			die2 = 20;
			break;
		case "old": 
			die1 = 10;
			die2 = 20;
			break;
	}
	var a = RollTheDice(1,die1);
	var b = RollTheDice(1,die2);
	var result = Math.min(a,b);
	result == result != 1? result: Math.min(RollTheDice(1,die1), RollTheDice(1,die2));
	return result;
}
function generateEve() {
	var mother = generatePerson(0);
	while(mother.firstChild > Math.min(mother.deathAge-1, mother.infertility)){
		mother = generatePerson(0);
	}
	mother.rank = 0;
	mother.mother = {id:"eve"};
	mother.gender = "F";
	mother.name = "Eve"
	mother.connection=1;
	return mother;
}
function generateAgedPerson(age, currentYear) {
	var person = generatePerson(currentYear -age);
	while(person.deathAge < age) {
		person = generatePerson(currentYear -age);
	}
	return person;
}
function generateHusband(wife, age, currentYear) {
	var age = marriageGap() + age;
	var husband = generateAgedPerson(age, currentYear)
	husband.gender="M";
	husband.name =  maleNames[Math.floor(Math.random()*maleNames.length)] +" outsider";

	return husband;
}
function generateWife(husband, age, currentYear) {
	var age = age -marriageGap();
	var wife = generateAgedPerson(age, currentYear)
	wife.gender="F";
		wife.name =  femaleNames[Math.floor(Math.random()*femaleNames.length)] +" outsider";
	return wife;
}

function generateChildren(mother) {
	var latestChild = mother.firstChild;
	
	while(latestChild <= Math.min(mother.infertility+1, mother.deathAge)){
		//TODO: twins and triplets
		var child = generatePerson(mother.birthYear+latestChild);
		child.gender = RollTheDice(1,2) == 1? "M": "F";
		child.name = child.gender == "M" ? maleNames[Math.floor(Math.random()*maleNames.length)] : femaleNames[Math.floor(Math.random()*femaleNames.length)];
		child.name = child.name + " tree";
		mother.children.push(child);
		latestChild+=childGap(latestChild);
	}
	return mother.children;
}
var nextPersonID = 1000;
function generatePerson(birthYear) {
	var person = {};
	
	person.id = nextPersonID++;
	person.birthYear = birthYear;
	person.deathAge = handleSpread(config.deathDate);
	
	//these only apply to women, but are super useful to just have
	person.infertility = handleSpread(config.infertility);
	person.firstChild = firstChild();
	
	//this only applies to the man, but is nice to generate instantly
	person.firstMarriageGap = marriageGap();
	
	person.children = [];
	person.marriages = [];
	
	return person;
}
function summary(person){
	
	return person.id+" ("+person.gender+ ")" + person.birthYear + " R"+person.rank+"_"+person.connection+" mother:"+person.mother?.id ;
}
function generateFamilyTree(time) {
	var root = generateEve();
	
	var toConsider = [root];
	
	var family = {};
	family.head = root;
	family.list = [];
	family.addMember = function (member) {
		if(member.birthYear < time && member.connection >= -1) toConsider.unshift(member);
		else console.log("not considering ", member.id);
		family.list.push(member);
	};
	
	family.getHeir = function(node, year){
		if(node.birthYear <= year && node.birthYear + node.deathAge >= year) return node;
		
		if(node.gender == "M") {
			
			return node.wife?family.getHeir(node.wife, year): false;
		}
		else {
			for(var child of node.children){
				var childHeir = family.getHeir(child, year);
				if(childHeir) return childHeir;
			}
		}
		return false;
	}
	family.atYear = function (year) {
		return family.list.filter(node => node.birthYear <= year && node.birthYear + node.deathAge >= year);
	}
	family.maritalStatus = function (node, year) {
		if(node.marriages.length == 0) return "Single";
		if(node.marriages[0].date > year) return "Single";
		if(family.isMarried(node, year)) return "Married";
		return "Widowed";
	}
	family.getStatus =function(year) {
		return family.atYear(year)
		.map(node => node.name+" " +node.gender +(year - node.birthYear) + " R"+node.rank +" "+family.maritalStatus(node,year)+ " "+ node.marriages.filter(m => m.date <= year && m.end >= year).map(m=> m.wife.name+"-"+m.husband.name).reduce((sofar,a) => sofar+a,"")+" "+node.children.map(c=>c.name).join(","))
	}
	
	family.isMarried = function (node, age) {
		return node.marriages.filter(m => node.birthYear+age < m.date || node.birthYear + age > m.end).length != 0;
	}
	family.addSpouse = function (node, marriageAge){
			var title = (node.gender == "M"? "wife":"husband");
			var otherTitle = (node.gender == "F"? "wife":"husband");
			var spouse = (node.gender == "M"? generateWife: generateHusband)(node, marriageAge, node.birthYear + marriageAge)
			var marriage = {date:marriageAge + node.birthYear};
			marriage[title] = spouse;
			marriage[otherTitle] = node;
			marriage.end = Math.min(node.birthYear+node.deathAge, spouse.birthYear+spouse.deathAge);
			node.marriages.push(marriage);
			spouse.marriages.push(marriage);
			spouse.firstMarriageGap = spouse.birthYear - node.birthYear;
			//node[title] = spouse;
			//spouse[otherTitle] = node;
			spouse.rank = node.rank
			spouse.connection = node.connection -1;
			family.addMember(spouse);
			console.log("generated "+title+" ("+spouse.id+") for "+ summary(node));
	}
	family.generateSpouses = function (node) {
		var marriageAge = node.firstChild + (node.gender == "M"? node.firstMarriageGap:0);
		if(marriageAge > node.deathAge) return;
		if(!family.isMarried(node, node.birthYear+marriageAge)) {
			family.addSpouse(node, marriageAge);
		}
		var marriageEnd = node.marriages.map(m=>m.end).reduce((sofar,date) => Math.max(sofar, date),Number.NEGATIVE_INFINITY);
		var nextGap = childGap(marriageEnd-node.birthYear);
		console.log("unmarried gap for "+ node.id+ " of "+nextGap);
		while(marriageEnd + nextGap < node.deathAge && marriageEnd + nextGap < 70) {
			family.addSpouse(node, marriageEnd - node.birthYear + nextGap);
			marriageEnd = node.marriages.map(m=>m.end).reduce((sofar,date) => Math.max(sofar, date),Number.NEGATIVE_INFINITY);
			nextGap = childGap(marriageEnd-node.birthYear);
		}
	}
	while(toConsider.length) {
		var current = toConsider.pop();
		family.generateSpouses(current);
		if(current.gender == "F"){
			var children = generateChildren(current);
			for(var child of children){
				child.mother = current;
				child.rank = current.rank +1;
				child.connection = current.connection;
				family.addMember(child);
			}
			console.log(children.length + " born to " + summary(current) + " --- "+children.map(c=>c.id).join(","));
		}

	}
	return family;
}