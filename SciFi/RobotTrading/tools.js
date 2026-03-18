var startingID = 10000;
function getID ()
{
	return startingID++;
}
function capitalize(s){
	return s[0].toUpperCase()+s.slice(1);
}