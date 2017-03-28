			function ConstructionType(name,effects,inventor)
			{
				var self = this;
				self.name = name;
				self.effects = effects;
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
				self.activateRequirements = countRequirements('use','consumes',self.isMachine?{'operator':1}:{});
				self.buildRequirements = countRequirements('create','consumes',self.isMachine?{'builders':1}:{'miners':1});
				self.maintainRequirements = countRequirements('maintain','consumes',{});
				self.useOutput = countRequirements('use','produces',{});
				self.limited = 0;
				for(var effect of effects)
				{
					if(effect.action == 'limits' && effect.trigger == 'use')
					{
						if(!self.limited)self.limited=effect.quantity;
						else self.limited*=effect.quantity;
					}
				}
			}
			
			function Construction (type,player,number)
			{
				var self = this;
				self.name = type.name;
				self.player=player;
				self.type = type;
				self.number = ko.observable(number?number:0);
				
				self.toActivate= ko.observable(0);
				self.toBuild= ko.observable(0);
				
				self.activateCount = ko.pureComputed(()=>Number(self.toActivate()));
				self.buildCount = ko.pureComputed(()=>Number(self.toBuild()));
				
				self.cost = ko.pureComputed(function (){
					var result = [];
					if(self.buildCount())
					for(var i in self.type.buildRequirements)
					{
						result.push({resource:i,value:self.type.buildRequirements[i]*self.buildCount()});
					}
					if(self.activateCount())
					for(var i in self.type.activateRequirements)
					{
						result.push({resource:i,value:self.type.activateRequirements[i]*self.activateCount()});
					}
					return result;
				});
				self.output = ko.pureComputed(function (){
					var result = [];
					result.push({resource:self.name,value:self.buildCount()});
					if(!self.type.isMachine) 
						result[0].value += self.activateCount();
					else for(var i in self.type.useOutput)
					{
						result.push({resource:i,value:self.type.useOutput[i]*self.activateCount()})
					}
					return result;
				});
			}
