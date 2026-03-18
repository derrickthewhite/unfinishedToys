var ages = [];
var deaths = 0;
var splits =0;
for(var i = 0;i<100;i++){
	ages[i]=i<=80?10:0;
}
function countPeople(ages){
	return ages.reduce((a,b)=>a+b);
}
function ageOfIndex(ages,index){
	var sofar = 0;
	for(var i =0;i<ages.length;i++){
		sofar+=ages[i];
		if(sofar>=index)return i;
	}
	return -1;
}
function runYear(ages){
	var count = countPeople(ages);
	var toSplit = 0;
	for(var i=0;i<count;i++)
	{
		if(Math.random()<=.02)toSplit++;
	}
	for(var i =0;i<toSplit;i++){
		var index = Math.floor(Math.random()*count);
		var age = ageOfIndex(ages,index);
		ages[age]-=1;
		ages[Math.floor(age/2)]+=1;
		ages[Math.ceil(age/2)]+=1;
		splits++;
	}
	for(var i =ages.length-1;i>=0;i--)
		ages[i+1]=ages[i];
	ages[0]=0;
	for(var i=70;i<ages.length;i++){
		//*
		for(var j = ages[i];j>0;j--)
			//if(Math.random()*30 < i-70)
			if(i>80)
			{
				ages[i]--;
				deaths++;
			}
			//*/
		if(i>100) delete ages[i];
		ages.length=101;
	}
	if(countPeople(ages)>5000){
		for(var i=0;i<ages.length;i++)
			if(Math.random()>.5)ages[i]=Math.ceil(ages[i]/2);
			else Math.floor(ages[i]/2);
	}
}
for(var i=0;i<5;i++)runYear(ages);