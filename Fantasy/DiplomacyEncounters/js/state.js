var DE = DE || {};

DE.mergeStuffGold = function (state) {
	if (!state.mission) return state.player.gold;
	return state.player.gold + (state.mission.stuff.gold || 0);
};
