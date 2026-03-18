	var dice = function (){
		return ([1,2,3]).map(a=>Math.floor(Math.random()*6)+1).reduce((a,b)=>a+b);
	}
	var die = function (){
		return Math.floor(Math.random()*6)+1
	}
	var sizeModifiers = [2,3,5,7,10,15];
	for(var i = 6;i<=100;i++) sizeModifiers[i]=sizeModifiers[i-6]*10;
	sizeModifiers.getModifier = function (point){
		return Math.round(Math.log(point)/Math.log(10)*6)-2;
	}
	
	var guids = [];
	var getGuid = function (){
		var result = "0";
		while(result.length <10 && guids.indexOf(result)!=-1)
			result =Math.random().toString(36).slice(2)
		guids.push(result);
		return result;
	}
	
	//REGION STATISTICS
	{
		var conceptPhase = function (target){
			var conceptRoll;
			var days=0;
			do {conceptRoll = dice(); days++}
			while(conceptRoll >target && conceptRoll < Math.min(target+10,17))
			return {
				roll:conceptRoll,
				success: conceptRoll <= target,
				days: days
			}
		}
		var prototypePhase = function (target){
			var prototypeRoll = dice();
			return {
				roll:prototypeRoll,
				success: prototypeRoll <= target,
				crit: prototypeRoll <= Math.min(Math.max(target-10, 4),6)
			}
		}
		var conceptExpections = function (runs){
			var result = [];
			for(var i = 4;i<=17;i++)
				result[i] = chanceOfSuccess(i,runs)
			return result
		}
		var diceOdds = function (){
			var odds = new Array(20).fill(0);
			for(var i =0;i<6;i++)
			for(var j=0;j<6; j++)
			for(var k=0;k<6; k++)
				odds[i+j+k+3]++
			return odds.map(a=>a/216);
		}
		var rollUnderOdds = function (){
			var odds = diceOdds();
			for(var i = 4;i<=18;i++)
				odds[i] = odds[i]+odds[i-1];
			odds[3]=0;
			return odds;
		}
		var rollOverOdds = function (){
			var odds = rollUnderOdds();
			var result = [];
			for(var i = 4;i<=18;i++)
				result[i] = odds[20-i]
			return result;

		}
		expectedTimeForConcept = function (){
			var result = [];
			var underOdds = rollUnderOdds();
			var overOdds = rollOverOdds();
			for(var i = 4;i<=17;i++)
				result[i] = 1/(underOdds[Math.max(i,4)]+overOdds[Math.min(i+10,17)])
			return result;

		}
		var numAttempts = function (){
			var result = [];
			var conceptOdds = conceptExpections(100);
			var prototypeOdds = rollUnderOdds();
			var conceptTime = expectedTimeForConcept();
			for(var i = 4;i<=17;i++){
				var p = prototypeOdds[i];
				var c = conceptOdds[i];
				var timeRatio = conceptTime[i]/90;
				result[i] = (Math.log(p-p*c) - Math.log(timeRatio +1 -p*c))/Math.log(1-p);
			}
			return result
		}
		var prototypeExpectations = function (runs){
			var result = [];
			for(var i = 4;i<=17;i++)
				result[i] = runsForSuccess(i,runs)
			return result
		}
		var runsForSuccess = function (target, runs){
			var record = [];
			for(var i = 0;i<runs;i++){
				var count = 1;
				while(dice()>target) count++;
				record.push(count)
			}
			return record.reduce((a,b)=>a+b)/record.length;
			
		}
		var chanceOfSuccess = function (target,runs){
			var successes = 0;
			for(var i = 0;i<runs;i++)
				if(dice()<=target)successes++;
			return successes/runs;
		}
	}
	//END REGION
	var researchManager = function (randomGenerator){
		var manager = {};
		manager.teams = [];
		manager.targetDifficulty = 8; //TODO: change this!
		manager.fundingCap = 0;
		
		randomGenerator = randomGenerator?randomGenerator:Math;
		
		manager.fundsSpentTotal = 0;
		
		manager.addTeam = function(techs,funding){
			var team = researchTeam(randomGenerator);
			team.techsResearched = techs;
			team.techCount = techs.length;
			team.borrowedTech = techs.length;
			team.fundingChunk = funding;
			manager.teams.push(team);
			
			team.baseCity = data.cities.generateCity();
			team.name = team.baseCity.split(',')[0] + " "+ manager.teams.map(team=>team.baseCity).filter(city=>city==team.baseCity).length
			console.log(team.name +" was created");
		}
		manager.shareTechnology = function (tech){
			manager.teams.forEach(team=>{
				if(team.techsResearched.map(a=>a.guid).indexOf(tech.guid)==-1)
					{team.techsResearched.push(tech); team.borrowedTech++}
			});
		}
		manager.runCycle = function (days,date){
			var newTechs = manager.teams.reduce((soFar,team)=>soFar.concat(team.DoResearch(days,team.fundingChunk, manager.targetDifficulty,date)),[]); 
			newTechs = newTechs.filter(tech=>tech.type!="NP").map(tech => JSON.parse(JSON.stringify(tech)));
			manager.teams.forEach(team=>team.debug(days));
			newTechs.forEach(tech=>manager.shareTechnology(tech))
			var teamsToAdd = 0;
			for(team of manager.teams){
				if(team.getFunding(team.financeSkill,team.fundingChunk,team.techCount<team.techsResearched.length,team.techsResearched.length))
				{
					if(team.fundingChunk<manager.fundingCap)
						team.fundingChunk = sizeModifiers[sizeModifiers.getModifier(team.fundingChunk)+1];
					else{
						team.fundingChunk = manager.fundingCap/2;
						teamsToAdd++;
					}
				}
				team.techCount = team.techsResearched;
			}
			if(teamsToAdd){
				var techs = manager.teams[0].techsResearched.filter(tech=>tech.type!="NP").map(tech => JSON.parse(JSON.stringify(tech)));
				for(var i =0;i<teamsToAdd;i++)manager.addTeam(techs,manager.fundingCap);
			}
		}
		manager.parachronicTechs = function (){
			return manager.teams[0].parachronicTechs();
		}
		manager.debuggedParachronicTechs = function (){
			return manager.teams.reduce((soFar,team)=>soFar.concat(team.debuggedParachronicTechs()),[]).filter((code,index,array)=>array.indexOf(code)==index);
		}
		manager.parachronicTechsByDate =function(){
			return manager.teams.reduce((sofar,team)=>sofar.concat(team.techsResearched),[])
				.filter(tech=>tech.type!="NP")
				.filter((tech,index,array)=>array.findIndex(a=>tech.guid == a.guid)==index);
		}
		return manager;
	}
	var attemptsPerTargetNumber  = numAttempts().map(a=>Math.max(1,Math.floor(a)))
	var researchTeam = function(randomGenerator){
		var team = {};
		
		randomGenerator = randomGenerator?randomGenerator:Math;
		
		team.conceptsToResearch = [];
		team.discardedConcepts = [];
		team.techsResearched=[];
		team.techsDebugged = [];
		
		team.daysResearched = 0;
		team.fundsSpent = 0;
		team.teamSize = 6;
		team.teamSalary = 25e3; // 25k
		team.daySalary = team.teamSalary/30;
		team.prototypeValue = 10e6; // 10 million
		
		team.parachronicLikelihood = 0;
		team.parachronicLikelihoodStep = .05;
		
		team.testingSkill = 10;
		team.testingSkillPractice = 0; //in days
		team.week = 7;
		
		//Finance attributes
		team.financeSkill = 16;
		team.fundingChunk = 1e6;
		team.techCount = 0;
		team.borrowedTech = 0;
		
		
		team.stepsToparachronic =[
			{
				name:"Basic Theory",
				code:"BT",
				prereqs:[]
			},
			{
				name:"Sending",
				code:"S",
				prereqs:["BT"]
			},
			{
				name:"Listening",
				code:"L",
				prereqs:["BT"]
			},
			{
				name:"First Conveyor",
				code:"FC",
				prereqs:["BT","L","S"]
			},
			{
				name:"World Discovery",
				code:"WC",
				prereqs:["BT","L","S","FC"]
			},
		];
		team.getResearchType = function (){
			
			if(team.prototypeValue >= 10e6 && randomGenerator.random()<team.parachronicLikelihood){
				var options = team.stepsToparachronic.filter(a=>a.prereqs.length<=team.parachronicTechs().length)
				return options[Math.floor(randomGenerator.random()*options.length)]
			}
			else {
				return "NP" // non-parachronic
			}
		}
		team.parachronicTechs = function (){
			return team.techsResearched.filter(tech=>tech.type!="NP").map(tech=>tech.type.code).filter((tech,index,array)=>array.indexOf(tech)==index)
		}
		team.debuggedParachronicTechs = function (){
			return team.techsDebugged.filter(tech=>tech.type!="NP").map(tech=>tech.type.code).filter((tech,index,array)=>array.indexOf(tech)==index)
		}
		team.debug = function (days){
			if(team.techsResearched.filter(a=>a.type!="NP").legnth>0)
				team.testingSkillPractice+=days
			if(team.testingSkillPractice>50 && team.testingSkill < 13) team.testingSkill=13
			var toTest = team.techsResearched.filter(tech=>(tech.majorBugs || tech.minorBugs) && tech.type!="NP")
			toTest.forEach(tech=> 
			{
				tech.testingTime +=days
				while(tech.testingTime > team.week){
					tech.testingTime-=team.week;
					if(tech.majorBugs>0){
						if(randomGenerator.dice() <= team.testingSkill -3)
							tech.majorBugs--;
					}
					else if(tech.minorBugs >0){
						if(randomGenerator.dice() <= team.testingSkill -3)
							tech.minorBugs--;
					}
					else{
						team.techsDebugged.push(tech);
					}
				}
			})
		}
		team.DoResearch = function(days, funds,target,date){
			var daysSpent = 0;
			var newProjects = [];
			date = date?date:0;
			while(team.conceptsToResearch.length<3 && daysSpent<days){
				daysSpent++;
				var concepts= Array(team.teamSize).fill(0)
					.map(a=>randomGenerator.dice())
					.filter(roll=>roll <=target || roll >= Math.min(target+10,17))
					.map(roll=>{return {
						guid: getGuid(),
						roll:roll,
						success:roll <=target,
						cost:team.prototypeValue*randomGenerator.dice()/10,
						manDays:randomGenerator.dice()*90/10,
						prototypes:0,
						majorBugs: Math.floor(die()/2),
						minorBugs: die(),
						type:team.getResearchType(),
						testingTime:0
					}})
				team.conceptsToResearch=team.conceptsToResearch.concat(concepts);
			}
			team.daysResearched+=(days-daysSpent)*team.teamSize;
			team.fundsSpent += funds - days*team.teamSize*team.daySalary ;
			while(team.conceptsToResearch.length 
				&& team.conceptsToResearch[0].manDays < team.daysResearched 
				&& team.conceptsToResearch[0].cost < team.fundsSpent + (team.daysResearched - team.conceptsToResearch[0].manDays)*team.daySalary)
			{
				var idea = team.conceptsToResearch[0]
				if(idea.type!="NP" && team.parachronicTechs().indexOf(idea.type.code)!=-1){
					team.conceptsToResearch.shift();
					continue;
				}
				idea.prototypes++;
				team.daysResearched -= idea.manDays;
				team.fundsSpent -= idea.cost;
				if(team.fundsSpent<0){
					team.daysResearched += Math.ceil(team.fundsSpent/team.daySalary) // adding a negative
					team.fundsSpent = 0;
				} 
				
				var modifier = (idea.type!="NP" && idea.type.prereqs.length < team.debuggedParachronicTechs())?-2:0;
				if(randomGenerator.dice()<=target +modifier && team.conceptsToResearch[0].success){
					team.techsResearched.push(team.conceptsToResearch.shift());
					if(idea.type=="NP"){
						//team.parachronicLikelihood+=team.parachronicLikelihoodStep;
						// never get to a value of 1
						team.parachronicLikelihood = 1-(1-team.parachronicLikelihood)*(1-team.parachronicLikelihoodStep);
					}
					console.log(team.name + " Built A "+(idea.type=="NP"?"project":idea.type.code));
					idea.date = date;
					idea.team = team.name;
					newProjects.push(idea);
				}
				else if(idea.prototypes >= attemptsPerTargetNumber[target]){
					idea.date = date;
					team.discardedConcepts.push(team.conceptsToResearch.shift());
				}
			}
			if(team.conceptsToResearch.length==0){
				days = Math.floor(team.daysResearched/team.teamSize);
				team.daysResearched = 0;
				if(days)
					newProjects.concat(team.DoResearch(days, 0, target));
			}
			return newProjects;
			
		}
		team.getFunding = function(skill, currentsize, workingPrototype, totalPrototypes){
			var roll = randomGenerator.dice()
			currentsize = sizeModifiers.getModifier(currentsize) - sizeModifiers.getModifier(500e3);
			var pastRecordBonus = sizeModifiers.getModifier(totalPrototypes);
			//console.log("funding rolled "+roll +"  vs " + (skill -currentsize +(workingPrototype?4:-4)+pastRecordBonus), "prototypes built:"+totalPrototypes)
			if(roll<=skill -currentsize +(workingPrototype?4:-4)+Math.floor(totalPrototypes/5)){
				return true;
			}
			else return false;
		}
		return team;
	}
	
	