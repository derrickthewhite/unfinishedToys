const inputString = `
Table: FantasyWorld
[@DominatingTerrain]+[@Inhabitants]
[@DominatingTerrain] and [@DominatingTerrain]
[@MysticForce] Magic+[@Inhabitants]
[@MysticForce] Magic+[@DominatingTerrain]
[@MysticForce] Magic and [@MysticForce] Magic
[@Inhabitants] and [@Inhabitants]
[@Inhabitants]

Table: MysticForce
Air
Fire
Earth
Water
Light
Dark
Life
Death
Wood
Metal

Table: DominatingTerrain
Waterfalls
Caves
Spires
Oceans
Lakes
Mountains
Clouds
Deserts
Weather
Movement

Table: Inhabitants
Humans [@TL]
Classic Races [@TL]
2:Custom Races [@TL]

Table: TL
TL 0 
3: TL 0 [@SpecialBonus]
TL 1
3: TL 1 [@SpecialBonus]
2: TL 2
2: TL 2 [@SpecialBonus]
4: TL 3
4: TL 3 [@SpecialBonus]
6: TL 4 
3: TL 4 [@SpecialBonus]

Table: SpecialBonus
roll: 1d6+1
0-2:Racial Boosts
3:Specialized Magic
4:Heavy Magic
5:Mystic Beasts
6:Light Magic
7-10:Mystic Tecnology

Table: SpaceCampaign
[@tone] [@activity] [@aliens] [@Society]

Table:tone
Action-Adventure
Horror
Romance
Space Opera
Surreal
Thriller
Travelogue
Wonder

Table:activity
Exploring new Places
Colony Alpha
Space Colonies
Survivors and Refugees
Starship Troopers
Ace Pilots
Commanding a Ship
Space Patrol
Bounty Hunters
Criminals
Espionauge
Merchants
Prospectors

Table:aliens
One Speicies
A few Aliens
Many Aliens

Table: Society
Anarchy
Alliance
Federation
Corporate
Empire

Table: Magic
[!{1d6-4} MagicLimits >> implode] [@2 PowerTypes >> implode]

Table: PowerTypes
Conjuring [@Conjuration] 
[@MindCreation] Illusion
[!{1d4} MindMagic >> implode]
[!{max(1,1d6-3)} ESP >> implode]
[@EnergyManip]
[@ObjectAnimation]
[!{max(min(1d4,1d4,1d4),min(1d4,1d4,1d4))} Healing >> implode]
[@Transformation]
Fate Manipulation

Table: Transformation
Elemental Transmutation
Organic into (Dead) Organic (and elemental)
Monstrous Twisting of Life
Change Substances Properties
Transform Like into Like
Full Transformations

Table: ObjectAnimation
[@MindCreation] Undead
[@MindCreation] Golems
Animate [@MindCreation] Class of Objects
Animate [@MindCreation] Objects

Table: MindCreation
Mindless 
Programable
Soul Bound
Simple Minded
Mysteriously Motivated
Person-like

Table: MindMagic
Mind Reading
Emotion Influencing
Body Puppetry
Mind Rewriting
Mind Commanding
Mind Movement

Table: MagicLimits
Time Consuming
Fleeting
Trapping Heavy
Energy Intensive
Connection Requiring
Corrupting
Non-Portable
Substance Consuming

Table: EnergyManip
5: [@{1d6} EnergyManipTypes >> implode]
Full Energy Manipulation

Table: EnergyManipTypes
[|Limited TK|Full TK|[@MindCreation] TK]
Blasts of [|Fire|Ice|Pure Energy|Electricty|Kinetic Energy]
Energy Storage ([|Biological|Magical|Mechanical|Raw (fire,electricty)])
[|Ponderous|Slow|Fast] Movement of Raw Matter

Table: ESP
Distant Vision
Future Prediction
Past Viewing
Question Revealing
Death Speaking

Table: Conjuration
Elemental Substances
Substances
Shaped Elemental Substances
Organic Items
Shaped Ectoplasm
[@MindCreation] Mystic Creatures
[@MindCreation] Natural Creatures 

Table: Healing
1:Immortality
4:Disease Curing
2:Unwellness Curing
4:Wound Regeneration   

Table: WindowDressing
Insubstantiality
Gates
Demons

; AlienLife.ipt
; created 12/18/2015 4:09:15 PM

Table: BizarreLife
10:A Humanoid [@AnimalInspiration]
7: Halfway between a [@AnimalInspiration] and a [@AnimalInspiration]
5:A talking [@AnimalInspiration] but [@AntatomicalChange]
1:a [@AnimalInspiration] centauroid
10:a highly evolved [@animalInspiration] but [@AntatomicalChange]
3: People who turn into [|[@animalInspiration]|[@AnimalGroups]][| Monsters |s]

Table: AnimalInspiration
5:[@MamalianPredator]
5:[@MammalianHerbivore]
2:[@Birds]
5:[@Arthropods]
5:[@Dinosaurs]
5:[@SoftBodied]
5:[@ScaledThings]
5:[@OtherMammals]

Table: AntatomicalChange
with [|More|Fewer] Legs
with more arms
with [|More|Less] Fur
4:it [|Flies|Swims|Burrows|Climbs]
with more spikes
its cuter and [@AntatomicalChange]
[|Bigger|Smaller]
[|Beefer|Scrawnier]
slimier
Brightly Colored
with more eyes
it walks upright

Table: AnimalGroups
Predator
Large Herbivore
Small Vertabrate
Dinosaurs
Bug
Fish

Table: ScaledThings
Frog
Salamander
Flat Fish
Glow Fish
Fish
Shark
Lizard
Snake


;no, these are not all dinosuars
;they are however all prehistoric reptiles
Table: Dinosaurs
Sauropod (long neck)
T-rex
Allosaurus
Velociraptor
Triceretops (Three horns)
Stegosaurus (spiked tail)
Ankylosaurus  (armored back)
Hardosaur (things on heads)
Ichthosaur (fish shaped)
Mausosuar (crocdile shaped)
Pleisosaur (long necked sea creature)
Pteradactyl (flying)
Dimotrodon (sailed back)

Table: SoftBodied
Octopus
Cuttlefish
Squid
JellyFish 
Clam
Snail 
Slug
Coral
Parasite of [@AnimalInspiration]
Worm
Leech
Starfish
Sea Urchin
 

Table: Arthropods
Termite
Ant
Beetle
Fly
Butterfly
Preying Mantis
Dragon Fly
Spider
Scorpion
Lobster
Centipede
FireFly
Wood Louse (rolly polly)

Table: Birds
Hummingbird
Chicken
Sparrow
Hawk
Sea Bird
Moa
Penguin

Table: MammalianHerbivore
Bull
Deer
Boar
gazelle
Elk
Moose
Elephant
Hippo
Rhino
Bison
Beaver
Armadillo
Rabbit
Rat
Goat
Sheep 
Kangaroo

Table: MamalianPredator
Wolf
Dog
Fox
Coyote
Tiger
Lion
Cat
Panther
Oceolot
Wild Cat
Badger
Raccoon
Weasle
Skunk
Civet
Hyena
Bear
Panda

Table: OtherMammals
Shrew
Baboon
Monkey
Gorilla
Chimpanzee
Aardavark
Hedgehog
Bat
`;

var dispayedTables = `
Magic
FantasyWorld
SpaceCampaign
BizarreLife
`