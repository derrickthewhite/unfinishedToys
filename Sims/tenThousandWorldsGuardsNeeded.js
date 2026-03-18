function guardsNeeded(x){
if(x==0)return 0;
var n = Math.floor(Math.log(x)/Math.log(2));
var r = x - Math.pow(2,n);
console.log(x,"breaks into",n," and ",r);


return (10-n)*Math.pow(2,n) - 2*r+ guardsNeeded(r);
}