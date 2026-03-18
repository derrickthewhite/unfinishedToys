var cities = function (randomGenerator){
	var cities = {};
	
	randomGenerator = randomGenerator?randomGenerator:Math;
	
	cities.cities = ["Shanghai","Beijing","Guangzhou, Guangdong","Shenzhen, Guangdong","Tianjin,","Wuhan, Hubei","Dongguan,Guangdong","Chengdu, Sichuan","Foshan,Guangdong","Chongqing","Nanjing, Jiangsu","Shenyang, Liaoning","Hangzhou, Zhejiang","Xi'an, Shaanxi","Harbin, Heilongjiang","Suzhou,Jiangsu","Qingdao,Shandong","Dalian,Liaoning","Zhengzhou, Henan","Shantou,Guangdong","Jinan, Shandong","Changchun, Jilin","Kunming, Yunnan","Changsha, Hunan","Taiyuan, Shanxi","Xiamen,Fujian","Hefei, Anhui","Shijiazhuang, Hebei","Urumqi, Xinjiang","Fuzhou, Fujian","Wuxi,Jiangsu","Zhongshan,Guangdong","Wenzhou,Zhejiang","Nanning, Guangxi","Nanchang, Jiangxi","Ningbo,Zhejiang","Guiyang, Guizhou","Lanzhou, Gansu","Zibo,Shandong","Changzhou,Jiangsu","Xuzhou,Jiangsu","Tangshan,Hebei","Baotou,Inner Mongolia","Huizhou,Guangdong","Yantai,Shandong","Shaoxing,Zhejiang","Liuzhou,Guangxi","Nantong,Jiangsu","Luoyang,Henan","Yangzhou,Jiangsu","Hong Kong"]
	
	var numNukedCities = function (){
		if(randomGenerator.random()<.8) return 1 + numNukedCities();
		return 0;
	}
	cities.nukedCities = new Array(numNukedCities()).fill(0).map(a=>
		cities.cities[Math.floor(randomGenerator.random()*cities.cities.length)]
	);
	cities.standingCities = cities.cities.filter(city=>cities.nukedCities.indexOf(city)==-1);
	
	cities.baseCities = new Array(Math.round(randomGenerator.dice()/3)).fill(0).map(a=>cities.standingCities[Math.floor(randomGenerator.random()*cities.standingCities.length)]);
	
	cities.generateCity = function (){
		return cities.standingCities[Math.floor(Math.random()*cities.standingCities.length)];
	}
	return cities;
}