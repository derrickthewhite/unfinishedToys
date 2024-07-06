function createGroupNavigation() {
	var groupNav = {
		currentGroup: ko.observable(),
		units: ko.observableArray([]),
		gear: ko.observableArray([])
	}
	groupNav.updateGroupDisplay = function () {
		if(groupNav.currentGroup()){
			groupNav.units(groupNav.currentGroup().contents().filter(feature => feature.featureType == "Unit"));
			groupNav.gear(groupNav.currentGroup().contents().filter(feature => feature.featureType == "Gear" || feature.featureType == "GearStack"));
		} else {
			groupNav.units([]);
			groupNav.gear([]);
		}
	}
	groupNav.transferUnit = function (unit){
		//make transfering conditional on diplomacy
		results.teamNavigation.currentTeam().units.push(unit);
		groupNav.currentGroup().contents(groupNav.currentGroup().contents().filter(a=> a!= unit));
		groupNav.updateGroupDisplay();
	}
	groupNav.unitActions = ko.pureComputed(() => {
		if(!results.teamNavigation.currentTeam()) return [];
		return groupNav.currentGroup().units().map(unit => {
			return results.teamNavigation.currentTeam().faction() == groupNav.currentGroup().faction()?
			[{
				name:"Transfer",
				svg: "assets/transfer.svg",
				click: () => {results.groupNavigation.transferUnit(unit)}
			}]
			: []
		});
	});
	groupNav.dailyUnitActions = ko.pureComputed(() => {
		//if(!results.teamNavigation.currentTeam()) return [];
		// this might not need a current team... I suspect its base management!
		return groupNav.currentGroup().units().map(unit => {
			var result = [
				results.library.activities.doNothing,
				results.library.activities.move
			];
			//if(unit.currentHp() < unit.maxHp()) {
				result.push(results.library.activities.heal);
			//}
			return result;
		})
	})
	groupNav.pickUp = function (object) {
		//make picking it up conditional on diplomacy
		results.teamNavigation.currentTeam().loot.push(object);
		groupNav.gear.remove(object);
		groupNav.currentGroup().contents(groupNav.currentGroup().contents().filter(item => item != object));
		groupNav.updateGroupDisplay();
	}
	groupNav.exit = function (){
		groupNav.currentGroup(undefined);
		groupNav.updateGroupDisplay();
	}
	return groupNav;
}

function registerGroupNav() {
	ko.components.register("group-nav", {
		viewModel: function (params) {
			this.groupNavigation = params.groupNav;
			this.root = params.root;
		},
		template: `<div data-bind="with:groupNavigation" class = "navigationPane">
			<div class="panelLable">Group Navigation</div>
			<div data-bind="with:currentGroup">
				<h3>
				<span data-bind="text:name"></span>
				<img data-bind="attr:{src:svg}" class="referenceIcon"></img>
				<button data-bind="click:$parent.exit">Exit</button>
				</h3>
				<span data-bind="if: featureType == 'Team'">
					<div>Stealth: <span data-bind="text:stealth().toFixed(2)"></span></div>
					<div data-bind="foreach: stealthComponents" class="statBreakdown">
						<div class="statItem">
							<span data-bind="text:name"></span>
							<span data-bind="text:value.toFixed(2)"></span>
						</div>
					</div>
					<div>Per: <span data-bind="text:per().toFixed(2)"></span></div>
					<div data-bind="foreach: perComponents" class="statBreakdown">
						<div class="statItem">
							<span data-bind="text:name"></span>
							<span data-bind="text:value.toFixed(2)"></span>
						</div>
					</div>
				</span>
				<unit-list params="units: $parent.units, actions: $parent.unitActions, style: '', edit: true "></unit-list>
				<div data-bind="foreach: $parent.gear">
					<div>
						<span data-bind="text:name"></span>
						<span data-bind="if:types.includes('weapon')">
							<!-- TODO: weapon types served more gracefully-->
							<span data-bind="text:weaponTypes.join(',')"></span>
							[<span data-bind="text:damage"></span>]
						</span>
						<button data-bind="click:$parents[1].pickUp">pick up</button>
					</div>
				</div>
				<div>Supplies:</div>
				<div data-bind="foreach: supply.getSupplies()">
					<div>
						<span data-bind="text:name"></span>
						:
						<img data-bind="attr:{src:svg}" class="smallIcon"></></img>
						<span data-bind="text:amount"></span>
						<button data-bind="click:() =>$parent.supply.transferSupply(name,1,$root.teamNavigation.currentTeam().supply)">transfer</button>
						<button data-bind="click:()=>$parent.supply.transferSupply(name,5,$root.teamNavigation.currentTeam().supply)">transfer 5</button>
					</div>
				</div>
			</div>
		</div>	`
	});
}