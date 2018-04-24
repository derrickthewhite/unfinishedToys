function ArtificialIntelligence(){
	var ai = {};
	
	ai.buildInfrastructure = function (constructions,target){
		//Increase capabilities in target the most!
		
		var machines = constructions.filter(c=>c.type.isMachine);
		
		var startingSupply = machines
			.filter(c=>c.type.free)
			.map(c=>c.outputForNumber(c.number()))
			.reduce((a,b)=>a.concat(b),[])
			.reduce((out,a)=>{
				if(!out[a.resource])out[a.resource]=0;
				out[a.resource]+=a.value;
				return out;
			},{});
		var burnableGoods = constructions.filter(c=>!c.type.isMachine)
			.map(c=>{return {resource:c.name,value:c.number()}});
		var startingSupplyArray = Object.keys(startingSupply)
			.map(k=>{return {resource:k,value:startingSupply[k]}});
		var usefulMachines = machines
			.filter(c=>c.type.useOutput[target] || c.type.useOutput['manipulator']);
		

		var usefulMachineCosts = usefulMachines.map(m=>{return {
			cost:manipulatorCost({name:m.type.name,attribute:"buildRequirements"},constructions),
			output:m.type.useOutput[target]?m.type.useOutput[target]:0+
				m.type.useOutput['manipulator']?m.type.useOutput['manipulator']:0,
			name:m.type.name
		}});
		
		var manipUseShortCuts = {};
		var tools = machines.filter(m=>!m.type.free)
			.map(m=>{
				var output = manipulatorCost({name:m.type.name,attribute:"useOutput"},constructions);
				var activation = manipulatorCost({name:m.type.name,attribute:"activateRequirements"},constructions);
				//TODO: why is manipulator always 0?
				var primaryOutput = Object.keys(output).sort((a,b)=>output[b]-output[a])[1];
				return {
					product: primaryOutput,
					ratio:output[primaryOutput]/activation.manipulator,
					name:m.name,
					tool:m
				}
			});
		
		usefulMachineCosts.forEach(m=>{
			m.cost.effectiveManip = 0;
			Object.keys(m.cost)
				.filter(resource=>config.manipUses.indexOf(resource)!=-1)
				.forEach(resource=>{
					var shortCut = tools.filter(t=>t.product == resource)
						.sort((a,b)=>a.ratio-b.ratio)[0];
					if(shortCut){
						m.cost[resource]/=shortCut.ratio;
					}
					m.cost.effectiveManip+=m.cost[resource];
				});
		})
		usefulMachineCosts.sort((a,b)=>b.cost.effectiveManip - a.cost.effectiveManip);
		var haveResources = true;
		while(haveResources){
			var toBuild = cheapestMachine(usefulMachines,burnableGoods,constructions);
			console.log(toBuild,burnableGoods);
			for(consuming in toBuild.burn){
				burnableGoods.filter(existing=>existing.resource==consuming).forEach((existing,index)=>{
					//THERE SHOULD NOT BE MORE THAN 1!
					existing.value-= toBuild.burn[consuming];
				});
			}
			console.log(toBuild,burnableGoods);
			haveResources = false;
		}
		
		return usefulMachines;
	}
	
	var cheapestMachine = function (usefulMachines,existingResources,constructions,target){
		var presentCosts = usefulMachines.map(m=>{
			var cost = JSON.parse(JSON.stringify(m.type.buildRequirements));
			var burn = {};
			for(var resource of existingResources){
				if(cost[resource.resource]){
					burn[resource.resource] = Math.min(cost[resource.resource],resource.value);
					cost[resource.resource]-=burn[resource.resource];
				}
			}
			var manipCost = manipulatorCost(cost,constructions);
			return {
				name:m.name,
				cost:manipCost,
				burn:burn,
				output:m.type.useOutput,
				ratio:m.type.useOutput[target]/manipCost.manipulators
			};
		});
		var immediateCosts = presentCosts.map(c=>{
			var shortCuts = ai.costWithShortcuts(c.cost,constructions);
			return {
					cost:shortCuts.cost,
					tools:shortCuts.tools,
					name:c.name,
					burn: c.burn
			}
		}).sort((a,b)=>{
			return a.cost.minimumManip !=b.cost.minimumManip
				?a.cost.minimumManip -b.cost.minimumManip
				:a.cost.ratio -b.cost.ratio
		});
		return immediateCosts[0];
	}
	
	ai.costWithShortcuts = function (cost,constructions){
		//TODO: memory on those machines and tools!
		//TODO: make version that minimizes activations, not total ratio
			// possibly may have to make all versions good at a given product and sort them!
		var tools = constructions.filter(c=>c.type.isMachine).filter(m=>!m.type.free)
			.map(m=>{
				var output = manipulatorCost({name:m.type.name,attribute:"useOutput"},constructions);
				var activation = manipulatorCost({name:m.type.name,attribute:"activateRequirements"},constructions);
				//TODO: why is manipulator always 0?
				var primaryOutput = Object.keys(output).sort((a,b)=>output[b]-output[a])[1];
				return {
					product: primaryOutput,
					minimum:activation.manipulator,
					ratio:output[primaryOutput]/activation.manipulator,
					name:m.name,
					tool:m
				}
			});
		var effectiveCost = {manipulator:0,minimumManip:0};
		var toolsUsed = [];
		Object.keys(cost)
			.filter(resource=>config.manipUses.indexOf(resource)!=-1)
			.forEach(resource=>{
				var shortCut = tools.filter(t=>t.product == resource)
					.sort((a,b)=>a.ratio-b.ratio)[0];
				effectiveCost[resource]=cost[resource]/(shortCut?shortCut.ratio:1);
				effectiveCost.manipulator+=effectiveCost[resource];
				effectiveCost.minimumManip+=shortCut
					?shortCut.minimum*Math.ceil(cost[resource]/(shortCut.ratio*shortCut.minimum))
					:effectiveCost[resource];
				if(shortCut)toolsUsed.push(shortCut);
			});
		return {cost:effectiveCost,tools:toolsUsed};
	};
	
	var manipulatorCost = function (toEval,constructions){
		var result = {
			manipulator:0,
			trades:0
		}
		config.manipUses.forEach(use=>result[use]=0);
		
		if(toEval && toEval.name && toEval.attribute){
			var construction = constructions.filter(c=>c.type.name == toEval.name)[0];
			if(!construction) toEval = undefined;
			else toEval = construction.type[toEval.attribute];
		}
		if(!toEval) result.trades++;
		else{
			for(var i in toEval){
				if(config.manipUses.indexOf(i)!=-1){
					result[i]+=toEval[i];
					result.manipulator+=toEval[i];
				}
				else if(i=="manipulator")
					result.manipulator+=toEval[i];
				else{
					//TODO: should this always be buildRequirements?
					var subCost = manipulatorCost({name:i,attribute:"buildRequirements"},constructions);
					Object.keys(subCost).forEach(key=>{
						if(!result[key])result[key]=0;
						result[key]+=subCost[key]*toEval[i];
					})
				}
			}
		}
		return result;
	}
	
	return ai;
}
var ai = ArtificialIntelligence();