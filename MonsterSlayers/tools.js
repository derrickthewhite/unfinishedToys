function dice (n)
{
	var result = n;
	for(var i =0;i<n;i++)
		result+=Math.floor(Math.random()*6);
	return result;
}