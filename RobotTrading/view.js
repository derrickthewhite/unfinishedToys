function View(game){
	var view = {};
	view.game = game;
	
	view.statics = {};
	view.statics.manipUses = ['builders','operators','miners'];
	
	for(var use of game.statics.manipUses)
	{
		game[use] = ko.observable(0);
	}
	
	view.activeConstructions = ko.pureComputed(){
		
	}
	
	
	view.plannedTurn = function (){
		
	}
	return view;
}