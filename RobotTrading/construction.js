function ConstructionType(name,effects,inventor)
{
	var self = this;
	self.name = name;
	//TODO: will we eventually want to pass in functions?
	self.effects = JSON.parse(JSON.stringify(effects)); 
	self.id = getID();
	self.inventor = inventor;
	
	self.isMachine = false;
	for(var i of effects)
		if (i.machine) self.isMachine=true;
	self.useName = self.isMachine?"Activate":"Burn";
	
	function countRequirements(trigger,action,existing)
	{
		var result = {};
		for(var i in existing)result[i]=existing[i];
		for(var effect of effects)
		{
			if(effect.trigger == trigger && effect.action == action)
			{
				if(!result[effect.target])result[effect.target]=0;
				result[effect.target]+=effect.quantity;
			}
			if(result[effect.target]==0)delete result[effect.target]
		}
		return result;
	}
	self.activateRequirements = countRequirements('use','consumes',self.isMachine?{'operators':1}:{});
	self.buildRequirements = countRequirements('create','consumes',self.isMachine?{'builders':1}:{'miners':1});
	self.maintainRequirements = countRequirements('maintain','consumes',{});
	self.useOutput = countRequirements('use','produces',{});
	self.score = 1+self.effects.filter(a=>a.trigger=="score").map(a=>a.quantity).reduce((a,b)=>a+b,0);
	self.limited = 0;
	for(var effect of effects)
	{
		if(effect.action == 'limits' && effect.trigger == 'use')
		{
			if(!self.limited)self.limited=effect.quantity;
			else self.limited*=effect.quantity;
		}
	}
	self.free = Object.keys(self.activateRequirements).length==0;
}
function ConstructionWrapperView (construction){ //TODO: better name
	
	var wrapper = {};
	var type = construction.type;
	wrapper.type = type;
	wrapper.toActivate= ko.observable(0);
	wrapper.toBuild= ko.observable(0);
	
	wrapper.activateCount = ko.pureComputed(()=>Number(wrapper.toActivate()));
	wrapper.buildCount = ko.pureComputed(()=>Number(wrapper.toBuild()));
	wrapper.buildChange = ko.pureComputed(()=>{
		return [{
			resource:construction.name,
			value:wrapper.buildCount()
		}];
	});
	
	wrapper.number =ko.pureComputed(function (){
		return construction.number();
	});
	
	wrapper.cost = ko.pureComputed(function (){
		var result = [];
		if(wrapper.buildCount())
		for(var i in type.buildRequirements)
		{
			result.push({resource:i,value:type.buildRequirements[i]*wrapper.buildCount()});
		}
		if(wrapper.activateCount())
		{
			for(var i in type.activateRequirements)
			{
				result.push({resource:i,value:type.activateRequirements[i]*wrapper.activateCount()});
			}
		}
		return result;
	});
	//TODO: distinguish between activates and builds, and possibly between activates and burns
	wrapper.output = ko.pureComputed(function (){
		var result = [];
		if(!type.isMachine) 
			result.push({resource:type.name,value:wrapper.activateCount()});
		else for(var i in type.useOutput)
		{
			result.push({resource:i,value:type.useOutput[i]*wrapper.activateCount()})
		}
		return result;
	});
	wrapper.expectedChange = ko.pureComputed(function (){
		return wrapper.buildCount() -(type.isMachine?0:wrapper.toActivate());
	});
	return wrapper;
}

function Construction (type,player,number)
{
	var self = this;
	self.name = type.name;
	self.player=player;
	self.type = type;
	self.number = ko.observable(number?number:0);
	
	self.score = ko.pureComputed(function (){
		return self.number()*self.type.score;
	})
}
