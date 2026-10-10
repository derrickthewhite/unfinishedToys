var DE = DE || {};
DE.UNIT_NAMES = {
  "goblin": {
    "first": ["Grik", "Snag", "Bol", "Ruk", "Vex", "Nib", "Kazz", "Droo", "Skit", "Mog", "Yarp", "Feg", "Crag", "Hok", "Zib", "Treg", "Wug", "Prik", "Gash", "Nok", "Skran", "Ubb", "Jek", "Lort", "Blag", "Grak", "Krit", "Snik", "Zob", "Pox", "Grib", "Razz", "Krug", "Sknil", "Brap", "Grip", "Thrak", "Vrak", "Zog", "Plug", "Rot", "Kog", "Snarl", "Skag"],
    "second": ["Long-ears", "Tall-head", "Hole-Digger", "Single-tooth", "Big Nose", "Small-hands", "Long-Legs", "Rock-Chewer", "Mud-Spitter", "Bug-Catcher", "Sneezer", "Sharp-Nails", "Grub-Eater", "Blink-Often", "Rat-Eyes", "Shiny-Grabber", "Snail-Licker", "Loose-Pants", "Crooked-Toe", "Ditch-Napper", "Fat-Cheeks", "Stick-Snapper", "Puddle-Jumper", "Nose-Picker", "Scratch-Head", "Lick-Finger", "Dirt-Sniff", "Bark-Chew", "Long-Tongue", "Flat-Foot", "Eye-Blinker", "Thin-Hands", "Spit-Far", "Shroom-Sniff", "Slime-Wipe", "Big-Belly", "Kettle-Thumper", "Short-Toes", "Bone-Gnawer", "Shin-Kicker", "Twig-Snapper", "Ear-Scratch", "Soup-Eater", "High-Voice", "Short-Nose", "Pebble-Mouth", "Moth-Catcher", "Gravel-Gargler", "Boulder-Love", "Low-Voice", "Pockmark", "Thin-Cheeks", "Spoon-Licker", "Four-Legs", "Crumb-Snatcher", "Thumb-Sucker", "Puddle-Drinker"]
  },
  "squidling": {
    "first": ["Ily", "Vesh", "Quor", "Sill", "Neru", "Ool", "Thess", "Vrin", "Lumu", "Aqq", "Shul", "Peel", "Drow", "Yith", "Moll", "Ril", "Cthu", "Gell", "Wisp", "Nai", "Sora", "Ulm", "Fenth", "Kree", "Sloom", "Shoosh", "Ploom", "Squee", "Squelch", "Plip", "Sloosh", "Thloom", "Shlump", "Smeeth", "Mloof", "Shloom", "Ploosh", "Smush", "Floopf", "Sloof"],
	"second": ["K't", "Qik", "T'k", "K'l", "T'zh", "Q't", "K'sh", "P'k", "T'p", "Q's", "K'ch", "T'kth", "Q'zk", "K'pt", "T'f", "Q'l", "K'v", "T'sk", "Q'p", "K'tz", "Q'k", "T'ch", "K'p", "Q'th", "T's", "K'tt", "Q'z", "T'me", "K'st", "Q'f", "K's", "T'v", "Q'tth", "K'zz", "T'pkr", "Q'ck", "K'tr", "T'shk", "Q'pt", "K'll"]
  },
  "skitter": {
    "first": ["Chik", "Ras", "Tik", "Skree", "Virr", "Klik", "Zizz", "Hiss", "Prak", "Weev", "Nit", "Crik", "Shirr", "Darn", "Burr", "Fritt", "Grit", "Lisk", "Pith", "Rook", "Serr", "Trill", "Urr", "Yick", "Krr", "Strith", "Skrit", "Zirr", "Click", "Chirr", "Pft", "Slik", "Tizz", "Krak", "Rill", "Gnaz", "Shiss", "Vrit", "Whirr", "Thrip", "Skrak", "Pizz", "Zith", "Kreek"],
    "second": ["Chik", "Ras", "Tik", "Skree", "Virr", "Klik", "Zizz", "Hiss", "Prak", "Weev", "Nit", "Crik", "Shirr", "Darn", "Burr", "Fritt", "Grit", "Lisk", "Pith", "Rook", "Serr", "Trill", "Urr", "Yick", "Krr", "Strith", "Skrit", "Zirr", "Click", "Chirr", "Pft", "Slik", "Tizz", "Krak", "Rill", "Gnaz", "Shiss", "Vrit", "Whirr", "Thrip", "Skrak", "Pizz", "Zith", "Kreek"],
  },
  "elf": {
    "first": ["Vaelzyne", "Pharaz", "Syzvrin", "Tirznath", "Drazrin", "Kaelzyn", "Lalvren", "Vaeloth", "Ryrnaeth", "Daelvyn", "Quizrin", "Syzveth", "Ralzyn", "Vornice", "Rhyzid", "Vaeldor", "Lylren", "Landerth", "Phraen", "Syrvyn", "Kaelthor", "Tyzren", "Valdren", "Daeldor", "Rhyzon", "Larithra", "Rylosina", "Quilvra", "Vezilia", "Nozria", "Jaelzira", "Thylys", "Daelphira", "Phyzra", "Tethzira", "Lylyn", "Lylphaer", "Syrlys", "Velzyr", "Vezlyn"],
	"second": ["Obsidian-Vein", "Glow-Throne", "Rock-Lord", "Bright-Vault", "Gem-Hold", "Iron-Root", "Ember-Heart", "Cold-Eye", "Bright-Blade", "Gloom-Shaper", "Death-Monger", "Sword-Breaker", "Chasm-Walker", "Dread-Anchor", "Stone-Dominion", "Void-Crafter", "Basalt-Vein", "Endless-Vein", "Fear-Blade", "Silent-Sovereign", "Grim-Bastion", "Hollow-Crown", "Nether-Mason", "Ember-Forge", "Deep-Caller", "Dusk-Fang", "Shadow-Weaver", "Shattered-Basalt", "Cavern-Hold", "Drake-Fang", "Wyrm-Slayer", "Beast-Rider", "Garnet-Spire", "Ruby-Vault", "Emerald-Vein", "Jade-Chasm", "Spear-Master", "Steel-Anvil", "Crystal-Hollow", "Dread-Edge"]  
	},
  "human": {
    "first": ["James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian", "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon", "Benjamin", "Samuel", "Gregory", "Alexander", "Frank", "Patrick", "Raymond", "Jack", "Dennis", "Jerry", "Tyler", "Aaron", "Jose", "Adam", "Nathan", "Henry", "Zachary", "Douglas", "Peter", "Kyle", "Ethan", "Noah", "Jeremy", "Christian", "Keith", "Roger", "Terry", "Gerald", "Harold", "Sean", "Austin", "Arthur", "Lawrence", "Dylan", "Jesse"],    "second": ["of the Pit", "the Quiet", "Bone-Eye", "Two-Torch", "Red-Salt", "the Bent", "Cave-Born", "of Nine Marks", "the Drowned", "Ash-Tongue", "the Long", "of the Gate","Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle", "Dorothy", "Carol", "Amanda", "Melissa", "Deborah","Barbara", "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle", "Dorothy", "Carol", "Amanda", "Melissa", "Deborah","Barbara", "Susan", "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle", "Dorothy", "Carol", "Amanda", "Melissa", "Deborah"],
	"second": ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez"]
  },
  "undead": {
    "first": ["Marrow", "Grim", "Voss", "Husk", "Nell", "Rattle", "Ulm", "Shade", "Cairn", "Dust", "Wight", "Barrow", "Kel", "Oss", "Thren", "Vault", "Yew", "Pall", "Sere", "Ghast", "Lych", "Moth", "Nox", "Rime"],
    "second": ["the Still", "Bone-Crown", "of the Pit", "Ash-Tongue", "the Quiet", "Grave-Born", "Two-Torch", "the Drowned", "of Nine Marks", "Pale-Hand", "the Bent", "of the Gate"]
  },
  "dragon": {
    "first": ["Vyrm", "Skael", "Orr", "Thrax", "Ember", "Kaldr", "Nith", "Rhuun", "Ashir", "Glaur", "Fyrr", "Zin", "Bale", "Cinder", "Draum", "Heskar", "Ild", "Jorv", "Keth", "Lazur", "Morn", "Pyre", "Sath", "Uld"],
    "second": ["the Red", "Scale-Crown", "of the Deep", "Ash-Tongue", "the Long", "Cave-Born", "Two-Torch", "the Quiet", "of Nine Marks", "Bone-Eye", "the Bent", "of the Gate"]
  },
  "spider": {
    "first": ["Silke", "Vex", "Nare", "Chith", "Loom", "Skara", "Weft", "Ixx", "Purl", "Tess", "Arach", "Goss", "Harrow", "Klik", "Lur", "Mirk", "Nett", "Orb", "Sable", "Trap", "Umbra", "Ven", "Wisp", "Yarne"],
    "second": ["Eight-Eye", "the Quiet", "Web-Born", "of the Warren", "Silk-Hand", "Night-Step", "the Bent", "Cave-Hush", "of Nine Marks", "Ash-Fang", "the Long", "Pit-Spinner"]
  },
  "ooze": {
    "first": ["Glep", "Slur", "Blot", "Mire", "Pudd", "Vlum", "Ogg", "Drip", "Slick", "Glob", "Haze", "Ichor", "Jell", "Klum", "Lard", "Muk", "Nurl", "Plash", "Quag", "Rind", "Seep", "Tallow", "Usk", "Wallow"],
    "second": ["the Slow", "Pit-Born", "of the Drain", "Ash-Film", "the Quiet", "Cave-Drip", "Two-Torch", "the Bent", "of Nine Marks", "Pale-Slide", "the Long", "of the Gate"]
  },
  "tunnelWorm": {
    "first": ["Bore", "Grub", "Wend", "Thrum", "Coil", "Dreg", "Husk", "Norr", "Rift", "Sunk", "Urm", "Vore", "Yawn", "Zurr", "Cleft", "Fathom", "Gorge", "Hollow", "Inch", "Kerr", "Lode", "Maw", "Pike", "Quarry"],
    "second": ["the Deep", "Stone-Gut", "of the Pit", "Ash-Tongue", "the Quiet", "Cave-Born", "Two-Torch", "the Bent", "of Nine Marks", "the Long", "Ore-Eater", "of the Gate"]
  },
  "webWorm": {
    "first": ["Lash", "Snare", "Vell", "Thread", "Kith", "Spool", "Hitch", "Mesh", "Noose", "Reel", "Skein", "Twine", "Umbil", "Warp", "Yarn", "Bind", "Cord", "Draw", "Fetch", "Gird", "Knot", "Loop", "Ply", "Rove"],
    "second": ["Silk-Jaw", "the Quiet", "Web-Born", "of the Warren", "the Bent", "Cave-Hush", "of Nine Marks", "Ash-Line", "the Long", "Pit-Binder", "Two-Torch", "of the Gate"]
  },
  "ghost": {
    "first": ["Wisp", "Echo", "Veil", "Hush", "Pale", "Nim", "Shade", "Lumen", "Moth", "Sere", "Aether", "Breeze", "Chill", "Dusk", "Faint", "Gleam", "Haunt", "Ire", "Lilt", "Murmur", "Pall", "Reed", "Sigh", "Thorn"],
    "second": ["the Still", "of the Gate", "Ash-Tongue", "the Quiet", "the Drowned", "Cave-Born", "Two-Torch", "of Nine Marks", "Pale-Hand", "the Bent", "the Long", "of the Choir"]
  }
};
