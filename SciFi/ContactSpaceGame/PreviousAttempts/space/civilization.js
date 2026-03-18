var population = function ()
{
    var self = this;

    var count;
    var productionMethods;
    var upkeep;

    var loyaltyCurve;
};

var productionMethod = function ()
{
    var self = this;

    self.inputPerWorker;
    self.outputFunction;
    self.qualityCurve;
};

var resource = function (name,quantity,quality)
{
    var self = this;
    self.name = name;
    self.quantity = quantity;
};


var Province = function ()
{
    // a province is the smallest unit that can be ordered to do something.
    // an empire has a limited number of provinces

    var self = this;

    var population = [];
};


var Empire = function ()
{
    // An empire is the unit that a single player can control
    var self = this;

    self.provinces = [];
};

//region RESOURCE CURVES

var ResourceCurve = function (baseArray,endValue)
{
    // resource curves are more of interfaces than actual structs
    var self = this;

    var totalsCache=[];
    self.getTotal = function (position){
        var result = 0;

        if(totalsCache[position])return totalsCache[position];

        for(var i =0;i<position && i<baseArray.length;i++)
        {
            result+=baseArray[i];
        }

        if(baseArray.length<position)result += endValue*(position-baseArray.length);

        totalsCache[position]=result;
        return result;
    };

    self.getMarginalBenefit = function (position){

        if(position>=baseArray.length) return endValue;
        return baseArray[position];
    };

    self.getBaseValue = function ()
    {
        return endValue
    };

    self.getArray = function (){return baseArray};

    self.newFromOperand = function (combinationMethod,otherCurve,operand,orderFunction)
    {
        var a = baseArray;
        var b = otherCurve.getArray();

        var newArray = [];

            var i =0;
            for(i =0; i<Math.min(a.length, b.length);i++)
            {
                newArray [i] = operand(a[i],b[i]);
            }
            var longer,baseValue;
            if(a.length> b.length)longer=a,baseValue= b.getBaseValue();
            else longer=b,baseValue= a.getBaseValue();
            for(;i<longer.length;i++)
            {
                newArray[i] = operand(longer[i],baseValue);
            }

            newArray = orderFunction(newArray);

            return new ResourceCurve(newArray,operand(endValue, b.getBaseValue()))
    };

    self.newFromInsert = function (otherCurve,orderFunction,tailDeterminingFunc)
    {
        var a = baseArray;
        var b = otherCurve.getArray();

        var newArray = [];

        for(var i =0;i< a.length;i++) newArray[i]=a[i];
        for(var j =0;j< b.length;j++) newArray[i+j]=b[j];

        newArray = orderFunction(newArray);

        return new ResourceCurve(newArray,tailDeterminingFunc(endValue, b.getBaseValue()));
    };

};

//endregion

/*

Thoughts:

    territory with amounts and values

    population units with various methods for production



*/