/**
 * What the spell parser knows beyond each object's own `synonyms`. Everything here ships in the bundle,
 * so matching works offline. It is plain data, kept apart from the parser so it is easy to extend: add a
 * word to a list and it works. `tools/check-spells.mjs` validates every id and flags a word listed twice.
 *
 * Three tiers, from most to least certain, and the rule for each is "would the player be happy with the
 * result?":
 *  - SYNONYMS: the same thing, or a kind of it (a poodle is a dog). The spell lands silently.
 *  - NEAR: Blockspell has no model of the word, but one of its things is a fair stand-in (a horse is a lot
 *    like a cow). The spell lands that and says so, so it never passes a cow off as a horse.
 *  - CATEGORIES: a word for a whole kind ("food"). Casting it summons a random member.
 * Anything else is "no spell for that", with suggestions. A wrong guess is worse than an honest "no".
 */

/** Same thing, or a kind of it: lands silently. Keyed by object id; entries are comma separated. */
export const SYNONYMS: Record<string, string> = {
  // animals
  cat: 'house cat, tabby, kittycat, pussycat, puss, siamese, persian cat, tom cat, kitties',
  dog: 'puppy dog, labrador, retriever, golden retriever, poodle, bulldog, husky, beagle, dalmatian, corgi, chihuahua, german shepherd, terrier, mutt, pug, doberman, collie, rottweiler, sheepdog, dogs',
  mouse: 'hamster, gerbil, mousie, field mouse, house mouse, vole',
  bird: 'parrot, eagle, owl, hawk, pigeon, dove, crow, raven, seagull, gull, swan, penguin, flamingo, peacock, canary, budgie, finch, hummingbird, woodpecker, falcon, cardinal, blue jay, magpie, vulture, stork, pelican, toucan, ostrich, emu, heron, cockatoo, parakeet, nightingale, swallow, wren, seabird, birds',
  fish: 'cat food, fish food, shark, goldfish, tuna, clownfish, eel, koi, carp, catfish, swordfish, stingray, seahorse, guppy, piranha, angelfish, pike, bass, cod, sea creature',
  rabbit: 'easter bunny, jackrabbit, bunnies, rabbits',
  frog: 'newt, salamander, tree frog, froggie, amphibian',
  cow: 'moo, milk cow, dairy cow, bovine, buffalo, bison, yak, steer, farm animal',
  pig: 'piggie, pigs, farm pig, sow, porker',
  chicken: 'turkey, chickens, poultry, hens, roosters, pullet, bantam',
  duck: 'goose, geese, gosling, ducks, waterfowl, mallard duck',
  bear: 'panda, polar bear, black bear, bear cub, panda bear, bears',
  sheep: 'flock, wool, merino, sheeps, ram',
  turtle: 'sea turtle, turtles, tortoises',
  monkey: 'orangutan, baboon, lemur, gibbon, capuchin, monkeys, apes',
  robot: 'mech, mecha, transformer, robo, tin man, robots',
  dragon: 'wyrm, komodo dragon, dragons, dragonling',
  hero: 'player, character, stranger, myself, people, dude, lady, folk, humans',

  // toys and small things
  ball: 'football, soccer ball, basketball, baseball, tennis ball, volleyball, golf ball, marble, bowling ball, rugby ball, ping pong ball, dodgeball, beachball, balls, softball',
  balloon: 'balloons, helium, party balloons, birthday balloon, water balloon',
  bone: 'dog food, kibble, dog biscuit, dog chow, pet food, puppy food, dog treats, dog snack, rawhide, puppy treat, pet treat, bones, dog dinner, dog biscuits, pup food, doggie treat, dog snacks, pet snack, dog meal, dog dish',
  box: 'cardboard, container, case, bin, packet, shoe box, boxes, tub',
  bubble: 'foam, soap suds, suds, bubbles, bubble wrap, soapy bubble, bubble ball',
  coin: 'dollar, cash, penny, nickel, quarter, dime, medal, cent, coins, euro, change, loot, buck, currency, medallion',
  gift: 'presents, gift wrap, birthday present, christmas present, wrapped box, goodie bag, gift bag',
  candle: 'tea light, candles, birthday candle, wax candle, taper candle, wick, votive, candle stick, menorah',
  mirror: 'looking glass mirror, hand mirror, magic mirror, reflection',
  key: 'keychain, key ring, passkey, lockpick, master key, car key, house keys, key card, keycard',
  book: 'diary, journal, comic, comic book, magazine, spellbook, spell book, bible, dictionary, manual, textbook, storybook, story book, encyclopedia, atlas, paperback, hardcover, grimoire',
  mug: 'glass, teacup, teapot, kettle, tea, coffee, cocoa, hot chocolate, latte, espresso, cappuccino, goblet, tankard, stein, tumbler, cup of tea, cup of coffee, drinking glass, mugs, cups, chai',
  bottle: 'milk, glass of milk, jar, potion, vial, canteen, juice, soda, cola, wine, beer, lemonade, water bottle, flagon, decanter, carafe, thermos, perfume, milk bottle, bottles, drink, beverage, elixir, tonic, medicine, jug, pitcher',
  vase: 'flower pot, flowerpot, planter, ceramic, plant pot, amphora, clay pot, china vase',
  pillow: 'blanket, sleeping bag, mattress, plush, plushie, stuffed animal, stuffed toy, quilt, duvet, bean bag, beanbag, comforter',
  umbrella: 'parasol, brolly, rain umbrella, sunshade, beach umbrella',
  lantern: 'flashlight, lightbulb, light bulb, bulb, spotlight, lamp post, street lamp, streetlight, floor lamp, table lamp, desk lamp, nightlight, lamps, headlamp',
  torch: 'flare, firebrand, burning torch, wall torch, tiki, matchstick, match, lighter, flame torch',
  piano: 'organ, synthesizer, synth, harpsichord, electric piano, xylophone, accordion, harp, keytar, pianoforte, baby grand',
  hammer: 'mallet, sledgehammer, gavel, claw hammer, mace, war hammer, warhammer, mjolnir, thor hammer',
  sword: 'blade, katana, sabre, saber, broadsword, rapier, dagger, knife, cutlass, machete, scimitar, longsword, lightsaber, light saber, claymore, excalibur, cleaver, kitchen knife, steak knife',
  axe: 'ax, hatchet, tomahawk, woodaxe, battle axe, battleaxe, war axe, double axe, lumberjack axe, wood axe, felling axe, splitting axe, fire axe, hand axe, throwing axe, viking axe',
  pickaxe: 'pick axe, pick, mattock, mining pick, miners pick, pickax, ice axe, ice pick, icepick',
  chainsaw: 'chain saw, saw, handsaw, buzzsaw, buzz saw, power saw, circular saw, hacksaw, jigsaw, band saw, bandsaw, table saw, wood saw',
  bucket: 'pail, sand bucket, watering can, bucket of water',

  // food
  apple: 'apple fruit, fruit, fruits',
  banana: 'monkey food, bananas, banana peel, bunch of bananas',
  carrot: 'rabbit food, bunny food, carrots, vegetable, vegetables, veg, veggie, veggies, radish, turnip, parsnip',
  cake: 'cupcake, muffin, brownie, cheesecake, birthday cake, wedding cake, layer cake, cakes, torte, gateau, pie, apple pie, cherry pie, pumpkin pie, tart, strudel, eclair, fruitcake, pound cake',
  pizza: 'pizzas, pepperoni, margherita, calzone, pizza slice, cheese pizza, slice of pizza, pizza pie',
  bread: 'bun, bagel, croissant, pretzel, roll, rolls, breadstick, sourdough, brioche, ciabatta, bread roll, naan, breads',
  cookie: 'cookies, cracker, oreo, shortbread, gingerbread, gingerbread man, wafer, macaron, sugar cookie, biscuits',
  cheese: 'mouse food, rat food, mozzarella, parmesan, gouda, feta, camembert, cheddar cheese, nacho cheese, cheese block, cheese slice, cream cheese',
  steak: 'sausage, bacon, pork chop, ribs, bbq, barbecue, kebab, turkey leg, roast, chop, lamb chop, meatball, roast beef, sirloin, jerky, beef, pork',
  egg: 'eggs, omelette, omelet, scrambled egg, fried egg, eggshell, easter egg, dino egg, chicken egg, duck egg',
  watermelon: 'melons, honeydew, honeydew melon',
  honey: 'bear food, jam, syrup, maple syrup, jelly, nectar, marmalade, molasses, peanut butter',
  donut: 'donuts, doughnuts, glazed, cruller, beignet, churro',
  icecream: 'banana split, ice cream cone, popsicle, ice lolly, frozen yogurt, froyo, sorbet, milkshake, ice cream sundae, soft serve, ice creams, ice cream scoop, frozen treat, slushie, smoothie',
  burger: 'hot dog, hotdog, taco, burrito, wrap, fries, french fries, nachos, sub sandwich, panini, quesadilla, fast food, cheeseburgers, hamburgers, sandwiches, club sandwich, hoagie, falafel, gyro',
  pumpkin: 'pumpkins, jack o lantern, halloween pumpkin, zucchini, marrow, courgette, butternut',
  mushroom: 'toadstool, shroom, fungus, mushrooms, truffle, magic mushroom, fungi, button mushroom, champignon, puffball, shiitake, portobello, morel, chanterelle, fly agaric',

  // nature
  fire: 'wildfire, fireplace, spark, ember, embers, burning flame, firepit, hearth',
  water: 'lake, pond, puddle, splash, sea, ocean, river, stream, creek, rain water, wave, waves, tide, waterfall, drink of water, h2o, liquid, swimming pool, pool of water, flood, moat, brook, lagoon, aqua, fountain',
  rock: 'stone, boulder, pebble, rocks, cobblestone, gravel, granite, slab, rubble, stones, meteor, meteorite, asteroid, flint, slate, sandstone, limestone, rock pile, boulders, stone block, pile of rocks',
  tree: 'oak, pine, trees, sapling, palm tree, palm, fir, maple, birch, willow, cedar, redwood, evergreen, apple tree, christmas tree, jungle tree, forest, woods, orchard, bamboo, elm, beech, cherry tree, sequoia, spruce, grove',
  ice: 'ice cube, ice block, iceberg, ice sheet, glacier, icicle, ice chunk, hail, frozen water, ice floe',
  cloud: 'raincloud, storm cloud, rain, cumulus, thundercloud, fog, mist, haze, storm, thunderstorm, drizzle, rainstorm, thunder, nimbus, cirrus',
  sun: 'sunshine, sunny, sunlight, daylight, sunrise, sunset, solar, daystar, morning sun',
  star: 'stars, twinkle, shooting star, starlight, comet, supernova, nova, north star, polaris, constellation, falling star, sparkle',
  snowman: 'snowmen, snow man, frosty, snow person, snowperson, olaf, snow golem, yeti',
  snowball: 'snow ball, snow, snowflake, snow pile, snowdrift, snowbank',
  bush: 'grass, lawn, shrub, hedge, shrubbery, bushes, thicket, hedgerow, brush, foliage, fern, ivy, vine, vines, moss, topiary, boxwood, hedges, greenery, weed, weeds',
  flower: 'daisy, rose, tulip, flowers, blossom, lily, orchid, sunflower, poppy, daffodil, petal, bouquet, lotus, marigold, dandelion, bloom, wildflower, carnation, iris, pansy, lilac, jasmine, hibiscus, peony, buttercup, blossoms, posy',
  cactus: 'cacti, saguaro, prickly pear, succulent, aloe, aloe vera, agave, barrel cactus, spiky plant, yucca',
  log: 'tree trunk, firewood, stump, trunk, wood log, logs, driftwood, branch, twig, stick, sticks, kindling, tree stump, woodpile, tree branch, fallen tree',
  lava: 'magma, molten rock, volcano, volcanic, lava flow, molten lava, eruption, lava pool, lava pit, igneous',
  crystal: 'gem, gemstone, diamond, jewel, ruby, emerald, sapphire, amethyst, quartz, topaz, opal, gems, jewels, precious stone, geode, shard, crystals, obsidian, jade, onyx, amber, garnet, crystal ball',
  seed: 'bird food, bird feed, chicken feed, duck food, parrot food, pinecone, pine cone, bean, beans, pea, peas, grain, kernel, seedling, birdseed, bird seed, nuts, peanut, almond, walnut, chestnut, hazelnut, cashew, pistachio, sunflower seed, pumpkin seed, spore, wheat, oat, barley, rice grain',
  haystack: 'cow food, horse food, sheep food, cattle feed, animal feed, fodder, livestock feed, hay bale, hay stack, straw bale, bale of hay, pile of hay',

  // structures
  plank: 'planks, two by four, 2x4, floorboard, wooden beam, wood board, boards, plywood, wood piece, piece of wood, wood slab, gangplank, diving board',
  bridge: 'footbridge, walkway, rope bridge, overpass, drawbridge, pontoon, causeway, viaduct, stone bridge, wooden bridge, suspension bridge, arch bridge, aqueduct, gangway, catwalk, plank bridge, log bridge, stepping stones',
  crate: 'wooden crate, chest, shipping crate, packing crate, cargo crate, storage crate, wooden box, toy chest, strongbox, lockbox, coffer, casket, pirate chest, supply crate, loot box, lootbox, mystery box',
  rope: 'cord, lasso, hanging rope, string, twine, cable, tether, lariat, yarn, thread, leash, climbing rope, jump rope, skipping rope, lifeline',
  ladder: 'stepladder, step ladder, climbing ladder, fire ladder, ladders, rope ladder, scaffold, scaffolding',
  stairs: 'staircase, steps, stairway, stair, step, flight of stairs, spiral staircase, stone steps, wooden steps, stairwell',
  ramp: 'slope, incline, wedge, skate ramp, launch ramp, jump ramp, loading ramp, wheelchair ramp, inclined plane',
  wall: 'brick wall, barrier, bricks, brick, stone wall, castle wall, partition, barricade wall, rampart, parapet, battlements, retaining wall, cinder block, concrete block, block, blocks, lego brick',
  fence: 'picket, paling, picket fence, farm fence, wooden fence, garden fence, fencing, stockade, wire fence, barricade',
  door: 'doorway, wooden door, front door, back door, trapdoor, trap door, hatch, door frame, doorframe, barn door, garage door, castle gate, dungeon door, magic door, locked door, screen door, saloon door, sliding door',
  barrel: 'keg, cask, wine barrel, beer barrel, rum barrel, wooden barrel, powder barrel, hogshead, vat, rain barrel, oil barrel, steel drum, metal drum',
  anvil: 'anvils, smithing block, blacksmith anvil, ingot, ton weight',
  tnt: 'dynamite, explosives, stick of dynamite, dynamite box, dynamite stick, tnt block, tnt crate, sticks of dynamite, c4, plastic explosive',
  bomb: 'grenade, cannonball, cartoon bomb, time bomb, timebomb, land mine, landmine, mine, firecracker, nuke, nuclear bomb, atom bomb, smoke bomb, stink bomb, cherry bomb, depth charge, bombs',
  chair: 'seat, stool, wooden chair, armchair, rocking chair, throne, recliner, dining chair, office chair, deck chair, high chair, bar stool, footstool, kitchen chair, folding chair, camping chair, lawn chair',
  hut: 'cabin, shack, cottage, house, home, shed, lodge, bungalow, barn, farmhouse, treehouse, tree house, dog house, doghouse, playhouse, clubhouse, hideout, lean to, outhouse, chalet',
  tent: 'teepee, tipi, yurt, wigwam, camping tent, circus tent, camp tent, gazebo, canopy',
  bench: 'sofa, couch, loveseat, settee, park seat, picnic bench, picnic table, ottoman, pew, church pew',
  scarecrow: 'scare crow, straw dummy, field guardian',
  beacon: 'lighthouse, signal light, watchtower fire, bonfire pit, fire basket, fire bowl, firebowl',
  trampoline: 'trampolene, bounce pad, bouncy castle, bounce house, jump pad, jumppad, jumping pad, bouncy pad, bouncing mat, tramp, bouncy house',
  magnet: 'horseshoe magnet, electromagnet, bar magnet, fridge magnet, lodestone, magnet block, magnets',
  spring: 'coil, coil spring, springboard, slinky, bedspring, spiral spring, bouncy spring, leaf spring, jack in the box',
  fan: 'electric fan, blower, ventilator, desk fan, propeller, ceiling fan, wind machine, leaf blower, wind turbine, pinwheel',

  // vehicles
  rocket: 'spaceship, missile, space rocket, firework, rocket ship, rocketship, space ship, shuttle, space shuttle, apollo, saturn v, starship, booster, rocket booster, bottle rocket, sky rocket, skyrocket, roman candle, space capsule',
  car: 'automobile, auto, taxi, sedan, racecar, race car, jeep, suv, limo, limousine, ambulance, police car, sports car, supercar, convertible, coupe, hatchback, minivan, cab, hot rod, hotrod, muscle car, formula one, f1 car, racing car, rally car, cars, golf cart, go kart, gokart, kart, dune buggy, buggy, bumper car, delorean, ferrari, lamborghini, porsche, tesla, beetle',
  boat: 'ship, sailboat, sail boat, canoe, raft, rowboat, dinghy, yacht, ferry, kayak, gondola, steamboat, steamship, speedboat, motorboat, powerboat, fishing boat, trawler, tugboat, cruise ship, battleship, warship, galleon, pirate ship, viking ship, longship, lifeboat, houseboat, barge, schooner, catamaran, jet ski, submarine, vessel, sailing ship, boats, ships',
  helicopter: 'chopper, heli, copter, whirlybird, gunship, rescue helicopter, police helicopter, army helicopter, apache, black hawk, blackhawk, chinook, quadcopter, drone, helicopters',
  jetpack: 'rocket pack, jet pack, rocketpack, jet boots, rocket boots, flying pack, backpack rocket, rocket backpack, thruster pack, hover pack, rocket belt',
  wing: 'angel wings, angel wing, feather wings, feather wing, bird wings, fairy wings, butterfly wings, bat wings, dragon wings, icarus wings',
  airplane: 'plane, aeroplane, jet, biplane, aircraft, airliner, boeing, airbus, concorde, fighter jet, fighter plane, bomber, warplane, spitfire, seaplane, floatplane, cessna, propeller plane, passenger plane, cargo plane, private jet, jet plane, paper plane, paper airplane, toy plane, planes, airplanes',
  ufo: 'flying saucer, saucer, alien ship, spacecraft, alien spaceship, alien craft, mothership, mother ship, flying disc, ufos, unidentified flying object',
  kite: 'diamond kite, paper kite, kites, box kite, stunt kite, dragon kite, delta kite',
  parachute: 'chute, paraglider, skydiving chute, parachutes, parasail',
  skateboard: 'skate board, skate, longboard, cruiser board, penny board, pennyboard, skate deck, skateboards',
  hotairballoon: 'air balloon, blimp, zeppelin, airship, dirigible, balloon ride, hindenburg, observation balloon, goodyear blimp',
  train: 'locomotive, choo choo, steam engine, steam train, railway, railroad, rail car, railcar, freight train, passenger train, bullet train, maglev, monorail, tram, trolley car, streetcar, subway, metro, thomas the tank engine, tank engine, diesel train, toy train, train set, caboose, boxcar, trains',
};

/**
 * Near matches. Blockspell has no model of the word, but one of its things is a fair stand-in, so the spell
 * lands that and says so ("No horse yet, so here's a cow, its closest cousin"). Keyed by object id.
 */
export const NEAR: Record<string, string> = {
  sheep: 'goat, llama, alpaca',
  cow: 'horse, pony, donkey, mule, deer, moose, elk, camel, giraffe, rhino, rhinoceros, hippo, hippopotamus, elephant, zebra, reindeer, antelope',
  dog: 'wolf, fox, coyote, jackal, hyena, dingo, werewolf',
  cat: 'lion, tiger, leopard, cheetah, panther, jaguar, puma, cougar, lynx, bobcat',
  bear: 'raccoon, badger, wolverine, sloth, koala',
  mouse: 'squirrel, chipmunk, guinea pig, bat, beaver, otter, mole, hedgehog, porcupine, skunk, weasel, ferret, meerkat, rat',
  bird: 'bee, butterfly, bumblebee, wasp, hornet, ladybug, dragonfly, moth, firefly, insect, bug, phoenix, pterodactyl, griffin, pegasus',
  fish: 'whale, dolphin, orca, octopus, squid, jellyfish, starfish, crab, lobster, shrimp, seal, walrus, narwhal, clam, oyster',
  dragon: 'dinosaur, dino, t rex, trex, tyrannosaurus, raptor, velociraptor, lizard, crocodile, alligator, croc, gecko, iguana, chameleon, godzilla, triceratops, stegosaurus, brontosaurus, snake, serpent, cobra, python, viper, anaconda, hydra, kaiju, monster, demon, ogre, troll',
  robot: 'golem, mannequin, cyborg',
  hero: 'wizard, knight, pirate, princess, prince, king, queen, ninja, astronaut, farmer, doctor, teacher, soldier, cowboy, witch, elf, dwarf, baby, child, boy, girl, man, woman, kid',
  ball: 'planet, globe, pearl, bauble, ornament, snow globe, eyeball, pinball',
  apple: 'pear, peach, plum, cherry, strawberry, grape, grapes, mango, pineapple, kiwi, berries, berry, blueberry, raspberry, orange, lemon, lime, tomato, apricot, coconut, avocado, citrus',
  carrot: 'potato, broccoli, lettuce, cucumber, corn, onion, garlic, pepper, celery, cabbage, spinach, eggplant, beet, salad',
  cookie: 'candy, sweets, chocolate, lollipop, gum, marshmallow, toffee, caramel, fudge, candy cane, jelly bean, gummy bear, popcorn, crisps, chips',
  pizza: 'pasta, spaghetti, noodles, lasagna, macaroni, ravioli, sushi, rice, curry, dumpling, quiche, pancake, pancakes, waffle, waffles',
  cheese: 'butter, yogurt, cream, tofu',
  donut: 'pretzel ring, life ring, lifebuoy, hula hoop',
  steak: 'ham, drumstick, chicken leg, chicken wing, chicken wings, brisket, meatloaf',
  mug: 'bowl, soup, stew, broth, plate, dish',
  bucket: 'cauldron, saucepan, frying pan, wok, stockpot, basin',
  seed: 'houseplant, sprout, shoot',
  lantern: 'light, glowstick, glow stick, led light, neon sign',
  torch: 'fireball, flamethrower, blowtorch, sparkler',
  piano: 'guitar, violin, trumpet, flute, saxophone, clarinet, trombone, drums, drum kit, tambourine, bongo, cymbal, cello, ukulele, banjo, mandolin, lute, bagpipes, harmonica, recorder, whistle, instrument, jukebox, radio, stereo, speaker, boombox, record player',
  book: 'paper, scroll, letter, map, note, notes, envelope, postcard, poster, ticket, folder, notepad, parchment, tablet',
  coin: 'gold, nugget, crown, tiara, necklace, bracelet, pendant, trophy, badge, jewelry, jewellery, piggy bank',
  vase: 'pot, pottery, urn, cookie jar',
  pillow: 'doll, rag doll, puppet, plush toy, soft toy, mattress, bed',
  gift: 'party popper, popper, confetti, pinata, surprise, christmas cracker',
  mirror: 'window, windowpane, pane, lens, magnifying glass, telescope, binoculars, glasses, spectacles, sunglasses, screen, tv, television, monitor',
  hammer: 'wrench, spanner, pliers, screwdriver, toolbox, club, baseball bat, crowbar, drill, shovel, spade, rake, pitchfork, broom, mop, paddle, oar, nail, screw',
  sword: 'spear, lance, halberd, trident, javelin, scissors, shears, sickle, scythe, bow, crossbow, arrow, boomerang, shuriken, slingshot, cannon, gun, pistol, rifle, blaster, whip, wand, magic wand, staff',
  umbrella: 'hat, cap, helmet, cloak, cape, raincoat, poncho, awning, straw hat, top hat, cowboy hat, wizard hat',
  tent: 'igloo, shelter, cave',
  bench: 'table, desk, workbench, counter, shelf, bookshelf, cabinet, drawer, wardrobe, closet, cupboard, dresser, bookcase, stool bench',
  chair: 'saddle, swing, wheelchair, bleachers',
  plank: 'dock, pier, jetty, boardwalk, deck, platform, stage, sign, signpost, signboard, plaque, chalkboard, blackboard, whiteboard, beam',
  box: 'suitcase, luggage, briefcase, backpack, bag, sack, handbag, purse, basket, cage, lunchbox, mailbox, toy block, jewelry box',
  crate: 'coffin, trash can, garbage can, dumpster, wheelbarrow, cart, wagon, pallet, kennel, coop, hutch, safe, vault',
  rope: 'chain, ribbon, belt, strap, bungee, zip line, tightrope, tentacle, beanstalk, hose, cable',
  ladder: 'jungle gym, monkey bars, fire escape, step stool',
  ramp: 'slide, playground slide, water slide, half pipe, roller coaster, dune, sand dune, mound, hill',
  wall: 'pillar, column, post, obelisk, monolith, sculpture, monument, gravestone, tombstone, shield, bunker, dam, tile, concrete, castle, fort, fortress, tower, turret',
  door: 'portal, gateway, entrance, exit, archway, arch, elevator, curtain, shutters, turnstile, fridge, refrigerator, oven',
  barrel: 'tank, silo, canister, gas cylinder, pipe, tube, chimney, smokestack, gas can, jerry can, fuel tank, water tank',
  fire: 'lightning, lightning bolt, thunderbolt, furnace, forge, heater',
  water: 'bath, bathtub, aquarium, fish tank, drop, raindrop, tear, dew, oil, ink, paint, slime, goo, mud',
  rock: 'mountain, cliff, statue, gargoyle, coal, ore, salt, sugar, shell, seashell, fossil, skull',
  tree: 'leaf, leaves, bonsai, jungle, rainforest',
  star: 'moon, crescent moon, full moon, galaxy, nebula, sky, night sky, fireworks, glitter, sparkles',
  cloud: 'wind, tornado, hurricane, cyclone, blizzard, smoke, steam, dust cloud, cotton candy, candy floss',
  sun: 'summer, daybreak, dawn, noon, sunbeam, ray of light, glow',
  skateboard: 'rollerblades, roller skates, ice skates, snowboard, surfboard, hoverboard, scooter, kick scooter, bicycle, bike, unicycle, tricycle, sled, sledge, toboggan, skis, ski',
  car: 'truck, van, bus, lorry, pickup, pickup truck, fire truck, fire engine, tractor, bulldozer, army tank, motorcycle, motorbike, moped, quad bike, atv, tuk tuk, rickshaw, carriage, stagecoach, chariot, camper van, caravan, trailer, monster truck, dump truck, forklift, steamroller',
  boat: 'submarine, hovercraft, pedalo, lifeboat, surfboard boat, ark, noahs ark, titanic',
  rocket: 'shuttle craft, lunar lander, moon lander, space probe, satellite, torpedo, missile launcher, rocket launcher, bazooka',
  helicopter: 'drone, quadcopter, gyrocopter, autogyro, whirlygig',
  airplane: 'glider, hang glider, hang gliding, paraglider craft, flying wing, stealth bomber',
  ufo: 'alien, martian, space invader, flying disc, frisbee, disc',
  hotairballoon: 'balloon basket, gondola balloon, weather balloon, spy balloon',
  train: 'tram car, trolley, cable car, rollercoaster car, rail cart, minecart, mine cart',
};

/**
 * Generic words that name a whole kind of thing. Casting one summons a random member, so it is never
 * wrong. Keyed by the word (singular); the value lists object ids.
 */
export const CATEGORIES: Record<string, string[]> = {
  animal: ['cat', 'mouse', 'bird', 'fish', 'rabbit', 'frog', 'cow', 'pig', 'chicken', 'duck', 'bear', 'sheep', 'turtle', 'monkey', 'dragon', 'dog'],
  pet: ['cat', 'dog', 'rabbit', 'mouse', 'bird', 'fish', 'turtle', 'frog'],
  creature: ['cat', 'dragon', 'frog', 'monkey', 'robot', 'bear', 'bird', 'dog'],
  critter: ['mouse', 'frog', 'bird', 'rabbit', 'turtle', 'cat'],
  beast: ['dragon', 'bear', 'cow', 'pig', 'monkey'],
  food: ['apple', 'banana', 'carrot', 'cake', 'pizza', 'bread', 'cookie', 'cheese', 'steak', 'egg', 'watermelon', 'donut', 'icecream', 'burger', 'honey'],
  snack: ['cookie', 'donut', 'apple', 'banana', 'cheese', 'icecream', 'cake'],
  meal: ['pizza', 'burger', 'steak', 'bread', 'egg'],
  dinner: ['pizza', 'burger', 'steak'],
  lunch: ['burger', 'pizza', 'bread', 'cheese'],
  breakfast: ['egg', 'bread', 'banana', 'honey', 'donut'],
  dessert: ['cake', 'icecream', 'donut', 'cookie', 'honey'],
  sweet: ['cake', 'cookie', 'donut', 'icecream', 'honey'],
  vehicle: ['car', 'boat', 'helicopter', 'airplane', 'rocket', 'train', 'skateboard', 'ufo', 'hotairballoon'],
  machine: ['car', 'helicopter', 'rocket', 'robot', 'airplane', 'train'],
  tool: ['hammer', 'axe', 'pickaxe', 'chainsaw', 'bucket'],
  weapon: ['sword', 'axe', 'hammer', 'bomb', 'tnt'],
  toy: ['ball', 'balloon', 'kite', 'skateboard', 'trampoline', 'bubble', 'bone'],
  plant: ['tree', 'flower', 'bush', 'cactus', 'mushroom'],
  building: ['hut', 'tent'],
  furniture: ['chair', 'bench', 'pillow'],
  explosive: ['bomb', 'tnt'],
};

/**
 * Words in a modifier position that carry no spell. They are dropped silently instead of showing
 * "Blockspell doesn't know that word", because a cute cat is just a cat.
 */
export const FLUFF = new Set(
  (
    'cute pretty beautiful lovely nice happy sad fancy old new young little pet fluffy furry soft hard good bad best ' +
    'real fake normal regular simple plain awesome amazing cool great special magic magical lucky cozy cosy ' +
    'strong tough smart clever funny silly weird strange crazy wild friendly adult ' +
    'slice piece pile pair bunch bowl plate glass cup bag herd flock group set lot bit heap stack dozen ' +
    'fresh ripe raw cooked baked fried boiled grilled roasted sliced chopped whole half ' +
    'type kind sort style shaped shape form like with some thing things stuff item object'
  ).split(' '),
);

/** Extra adjective words, keyed by adjective id (merged with each adjective's own synonyms). */
export const ADJECTIVE_WORDS: Record<string, string> = {
  red: 'maroon, burgundy, cherry, ruby, rose, strawberry, tomato, rust, rusty',
  orange: 'tangerine, amber, peach, apricot, copper, coral, salmon',
  yellow: 'lemon, banana, sunny, mustard, blonde, blond, canary',
  green: 'emerald, olive, mint, grassy, leafy, jade, sage',
  blue: 'azure, sky blue, sapphire, cobalt, indigo, ocean, blueberry',
  cyan: 'aqua, aquamarine, turquoise, teal',
  purple: 'violet, lavender, lilac, plum, grape, mauve, amethyst',
  pink: 'magenta, rose pink, hot pink, fuchsia, bubblegum, blush, flamingo',
  white: 'snowy, ivory, cream, milky, pearl, pale, albino',
  black: 'ebony, jet black, charcoal, midnight, pitch black, onyx, inky, sooty',
  grey: 'ash, slate, smoky, dull, concrete, pewter, graphite',
  brown: 'chocolate, tan, beige, mahogany, chestnut, caramel, khaki, bronze, cocoa, muddy',
  golden: 'goldenrod, gold colored, solid gold, pure gold, yellow gold',
  rainbow: 'multicolor, multi colored, technicolor, kaleidoscope, psychedelic, iridescent, prism, spectrum',
  frozen: 'ice, snow, ice cold, freezing, arctic, polar, snowy, wintry, glacial, chill, chilled',
  ghostly: 'ghost like, ghostlike, eerie, creepy, ethereal, translucent, clear, glassy, wispy, undead, shadowy',
  angry: 'cross, annoyed, hostile, fierce, ferocious, savage, wicked, nasty, scary, dangerous, monstrous, villainous',
  fast: 'lightning fast, supersonic, nimble, brisk, hasty, speeding, racing, sprinting, zooming, high speed',
  slow: 'sloth, crawling, creeping, plodding, lethargic, drowsy, tired, dozy, unhurried, dopey',
  sticky: 'glued, clingy, syrupy, tarry, viscous, gloopy, goopy, gunky, jammy',
  metal: 'robot, iron, aluminium, aluminum, bronze, titanium, brass, armored, armoured, mechanical, cyber, cybernetic, industrial',
  magnetic: 'attracting, charged, electromagnetic, ferromagnetic',
  explosive: 'blasting, detonating, combustible, dynamite, tnt',
  glowing: 'glow in the dark, lit up, illuminated, fluorescent, sparkling, glittery, glittering, gleaming, twinkling, dazzling, brilliant, flashing, light up',
  slippery: 'greased, lubricated, soapy, waxy, smooth, silky, sleek',
  alive: 'lifelike, moving, animate, awake, awakened, bewitched, possessed, cursed, charmed, spellbound',
  heavy: 'hefty, leaden, ponderous, bulky, hulking, solid, thick, stocky, ton',
  light: 'airy, buoyant, floaty, featherlight, feather light, ultralight, thin, slight, delicate, flimsy, gossamer, puffy',
  flying: 'soaring, gliding, flapping, fluttering, aerial, in the air, zero gravity, antigravity, weightless',
  bouncy: 'boingy, boing, bouncing, stretchy, squishy, squashy, hopping, jumping, jumpy, leaping',
  wet: 'moist, dripping, sopping, soaking, sodden, saturated, waterlogged, rainy, drippy, splashy, underwater, submerged, dewy',
  flaming: 'fire, ablaze, aflame, burnt, burned, charred, scorched, smoking, smoldering, smouldering, red hot, fire breathing, alight, ignited',
  hot: 'heated, boiling, steaming, steamy, sizzling, searing, roasting, blistering, sweltering, spicy, piping hot, overheated, feverish, volcanic',
  wooden: 'made of wood, made from wood, timber, oak, pine, bamboo, rustic, woody, carved',
  tasty: 'scrumptious, delectable, appetizing, appetising, mouthwatering, flavorful, savory, savoury, sweet, juicy, succulent, yum, gourmet, delish',
  tiny: 'minuscule, minute, teensy, weeny, teeny weeny, itsy bitsy, pocket sized, bite sized, nano, micro, pygmy, diminutive, petite, shrunken',
  small: 'lil, puny, undersized, modest, miniature small, pint sized, half size, junior, smaller, smallish',
  big: 'bigger, biggish, sizeable, sizable, substantial, grand, wide, broad, vast, oversized, outsized, extra large, xl, super size, supersize, hulking, towering, mighty',
  giant: 'gargantuan, immense, mountainous, monumental, titan, ginormous, humungous, astronomical, skyscraper sized, house sized, mega giant, ultra, supergiant',
};
