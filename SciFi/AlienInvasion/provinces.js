// Cleaned and densified South America province data
// Includes simplified polygon paths and adjacency tracking

const provinces = [
  {
    name: "south chile",
    points: [[680,1135],[643,1128],[618,846],[646,846],[677,1133]],
    adjacent: ["north chile", "patagonia"]
  },
  {
    name: "north chile",
    points: [[618,843],[623,840],[647,844],[646,594],[608,592],[618,842]],
    adjacent: ["south chile", "bolivia", "peru", "west argentina"]
  },
  {
    name: "patagonia",
    points: [[685,1129],[697,1130],[712,1114],[724,1077],[753,994],[665,991],[682,1131]],
    adjacent: ["south chile", "south argentina"]
  },
  {
    name: "south argentina",
    points: [[667,989],[750,981],[801,890],[815,837],[647,822],[665,985]],
    adjacent: ["patagonia", "west argentina", "east argentina"]
  },
  {
    name: "west argentina",
    points: [[653,811],[816,832],[775,775],[782,677],[648,657],[652,809]],
    adjacent: ["north chile", "south argentina", "east argentina", "bolivia"]
  },
  {
    name: "east argentina",
    points: [[789,677],[776,774],[816,831],[887,814],[916,752],[885,704],[791,676]],
    adjacent: ["south argentina", "west argentina", "paraguay", "uraguay"]
  },
  {
    name: "uraguay",
    points: [[903,659],[885,706],[937,726],[976,643],[924,623],[902,658]],
    adjacent: ["east argentina", "paraguay", "north Brazil"]
  },
  {
    name: "paraguay",
    points: [[744,640],[760,593],[840,620],[840,685],[743,668]],
    adjacent: ["east argentina", "west argentina", "interior", "bolivia"]
  },
  {
    name: "bolivia",
    points: [[647,656],[740,668],[762,593],[794,533],[727,489],[692,528],[645,596]],
    adjacent: ["north chile", "west argentina", "paraguay", "peru", "interior"]
  },
  {
    name: "peru",
    points: [[606,587],[524,460],[601,390],[726,487],[645,595]],
    adjacent: ["north chile", "bolivia", "ecuador"]
  },
  {
    name: "ecuador",
    points: [[522,458],[598,390],[591,346],[514,334],[521,453]],
    adjacent: ["peru", "columbia"]
  },
  {
    name: "columbia",
    points: [[515,332],[580,206],[718,172],[791,192],[751,264],[675,274],[591,346]],
    adjacent: ["ecuador", "venezuela", "amazonia"]
  },
  {
    name: "venezuela",
    points: [[792,193],[752,265],[827,313],[921,298],[938,229],[849,195]],
    adjacent: ["columbia", "guianas", "amazon coast"]
  },
  {
    name: "guianas",
    points: [[928,272],[1029,266],[1021,329],[934,325],[918,296]],
    adjacent: ["venezuela", "amazon coast"]
  },
  {
    name: "north Brazil",
    points: [[977,643],[1031,609],[1058,543],[988,491],[923,621]],
    adjacent: ["uraguay", "interior", "central brazil"]
  },
  {
    name: "central brazil",
    points: [[987,492],[1057,379],[1142,417],[1056,542]],
    adjacent: ["north Brazil", "amazon coast"]
  },
  {
    name: "amazon coast",
    points: [[1142,416],[1208,329],[1104,277],[1030,266],[1021,327],[935,324],[917,298],[833,315],[999,468],[1058,378]],
    adjacent: ["guianas", "venezuela", "central brazil"]
  },
  {
    name: "amazonia",
    points: [[793,529],[927,402],[831,316],[752,266],[675,274],[590,346],[597,390],[726,485]],
    adjacent: ["columbia", "interior"]
  },
  {
    name: "interior",
    points: [[795,529],[766,592],[840,620],[840,689],[884,704],[909,643],[921,622],[999,468],[928,406]],
    adjacent: ["bolivia", "amazonia", "north Brazil", "paraguay"]
  }
];
