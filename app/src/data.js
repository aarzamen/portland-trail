// Content and every number of The Portland Trail. Nothing in this file computes anything.
//
// Sentences with {slots} are templates. The engine fills them from the numbers in this file, so a
// sentence never repeats a number. A slot written {one|many} takes its word from the number filled
// just before it: 'after {parts} repair {kit|kits}' reads '1 repair kit' or '2 repair kits'.
//
// Numbers marked (T) are the ones the balance pass may retune.

export const DEFAULT_NAMES = ['Kale', 'Juniper', 'Rowan', 'Birch', 'Echo'];

export const NAME_POOL = [
  'Kale',
  'Juniper',
  'Rowan',
  'Birch',
  'Echo',
  'Sage',
  'Fern',
  'Wren',
  'Indigo',
  'Moss',
  'River',
  'Clementine',
  'Atlas',
  'Zephyr',
  'Linden',
  'Sorrel',
  'Aspen',
  'Marigold',
  'Huck',
  'Tansy',
  'Cedar',
  'Opal',
  'Finch',
  'Bodhi',
];

export const RULES = {
  goalMiles: 1000,
  journalLimit: 200,
  eventChance: 0.3, // (T) per driving day
  starvationDamage: 9, // (T)
  sickDamage: 3, // (T) per day while sick
  roadRest: { heal: 6 }, // (T)
  stopRest: { heal: 12 }, // (T) default for a stop whose `rest` gives no number
  forage: { damage: 3, sickChance: 0.15, prepperBonus: 4 }, // (T)
  push: { miles: 10, damage: 6 }, // (T)
  hitchhike: { chance: 0.55, fuel: 4, damage: 10 }, // (T)
  luggage: { fuel: 6 },
  heat: { days: 2, foodMultiplier: 1.5, travelDamage: 2 }, // (T)
  drizzle: { days: 2, heal: 1, bonusMiles: 20, bonusFuel: 2 },
  healthBands: { good: 65, worn: 35 },
  supplies: { fuelFloor: 24, foodFloor: 40, bufferDays: 2, parts: 2, kombucha: 2, reserveCash: 100 },
  parDay: 21,
  rentPerDay: 65,
  score: { survivor: 200, cashPerPoint: 5, earlyDay: 15, lateDay: 10, lossMilesPerPoint: 5 },
};

// Limits on what a player may type or order. They are part of the save format, not of the balance.
export const LIMITS = { name: 32, epitaph: 60, order: 1000 };

export const PACES = {
  slow: { name: 'Scenic', miles: 50, milesPerFuel: 25, wear: 1 }, // wear (T)
  normal: { name: 'Steady', miles: 80, milesPerFuel: 20, wear: 4 },
  fast: { name: 'Floor it', miles: 110, milesPerFuel: 16, wear: 7 },
};

export const RATIONS = {
  bare: { name: 'Bare', food: 0.25, health: -3 }, // health (T)
  meager: { name: 'Meager', food: 0.5, health: -1 },
  filling: { name: 'Filling', food: 1, health: 2 },
};

export const WEATHER = { clear: 'Clear', drizzle: 'Perfect drizzle', heat: 'Heatwave' };

// Each background's `ability` holds its numbers, the description template (`text`), the journal
// line (`result`) and, where it applies, the sentence that refuses it: `offline` on the day of a
// Wi-Fi outage, `lacking` when its cost cannot be paid.
export const PROFESSIONS = [
  {
    id: 'influencer',
    name: 'Social Media Influencer',
    description: 'A ring light, a following, and almost no practical skills.',
    ability: {
      label: 'Run a collab',
      cooldown: 4,
      money: 45,
      food: 2,
      text: 'Collab once every {cooldown} days for ${money} and {food} food. A Wi-Fi outage blocks it that day.',
      result: 'A brand collab paid ${money} and {food} food.',
      offline: 'The Wi-Fi outage blocks your collab today.',
    },
    inventory: { money: 2000, food: 20, fuel: 15, ammo: 0, parts: 0, kombucha: 0, nft: 0 },
  },
  {
    id: 'dev',
    name: 'Gig Economy Developer',
    description: 'Can fix a van with fewer parts; owns a suspicious JPEG.',
    ability: {
      label: 'Salvage parts',
      cooldown: 4,
      parts: 2,
      repairCost: 1,
      text:
        'Salvage {parts} repair kits once every {cooldown} days. ' +
        'Breakdown repairs cost {repairCost} kit instead of 2.',
      result: 'Salvaged {parts} repair {part|parts} from discarded gadgets.',
    },
    inventory: { money: 1200, food: 30, fuel: 20, ammo: 0, parts: 0, kombucha: 0, nft: 1 },
  },
  {
    id: 'prepper',
    name: 'Doomsday Prepper (Portland Edition)',
    description: 'The van is full of kale chips and artisanal survival gear.',
    ability: {
      label: 'Scout for food',
      cooldown: 4,
      food: 6,
      damage: 3,
      text:
        'Foraging finds {forageBonus} extra food. ' +
        'Scout for {food} food once every {cooldown} days, costing {damage} health per survivor.',
      result: 'Scouted {food} food; each survivor lost {damage} health.',
    },
    inventory: { money: 800, food: 100, fuel: 25, ammo: 2, parts: 2, kombucha: 0, nft: 0 },
  },
  {
    id: 'barista',
    name: 'Artisanal Barista',
    description: 'Knows everyone’s coffee order and keeps the group moving.',
    ability: {
      label: 'Brew coffee',
      cooldown: 1,
      foodCost: 1,
      heal: 5,
      text: 'Brew once a day: spend {foodCost} food to restore {heal} health to every living traveler.',
      result: 'A careful brew restored {heal} health to every survivor.',
      lacking: 'Brewing coffee needs {foodCost} food.',
    },
    inventory: { money: 1000, food: 50, fuel: 20, ammo: 0, parts: 0, kombucha: 2, nft: 0 },
  },
];

// `max` is what the van can hold: it limits purchases and gains. Prices and yields are (T).
export const ITEMS = [
  {
    id: 'food',
    name: 'Sustainably Sourced Kale Chips',
    short: 'Food',
    price: 4,
    max: 100,
    unit: 'bag',
    text: 'One unit of food for the road.',
  },
  {
    id: 'fuel',
    name: 'Bio-Diesel Canister',
    short: 'Fuel',
    price: 12,
    max: 40,
    unit: 'canister',
    text: 'One canister of fuel. Steady driving covers {miles} miles on it.',
  },
  {
    id: 'ammo',
    name: 'Seed Bombs',
    short: 'Seeds',
    price: 18,
    max: 6,
    unit: 'pack',
    yield: [2, 6],
    text: 'Scatter on the road for {min} to {max} food at once.',
  },
  {
    id: 'parts',
    name: 'Washi Tape & Vintage Screwdrivers',
    short: 'Repairs',
    price: 15,
    max: 6,
    unit: 'set',
    text: 'Repair the van during a breakdown.',
  },
  {
    id: 'kombucha',
    name: 'Locally Brewed Kombucha',
    short: 'Kombucha',
    price: 16,
    max: 6,
    unit: 'bottle',
    heal: 10,
    text: 'Restores {heal} health to each living traveler and cures sickness.',
  },
  {
    id: 'nft',
    name: 'Pixelated Sasquatch JPEG',
    short: 'NFTs',
    price: 80,
    max: 5,
    unit: 'JPEG',
    resale: 50,
    text: 'Trade at the NFT fair or sell for ${resale} at a shop.',
  },
];

// Cash is a supply but not an item: it has no price and no maximum.
export const MONEY = { id: 'money', label: 'Cash' };

// A stop offers the activities it lists. `rest`, `forage` (a range of food), `meal`, `talk` and
// `prices` (this stop's own prices) hold the numbers for them. Rest heal numbers are (T).
export const LOCATIONS = [
  {
    id: 'start_city',
    name: "Your Shared Artist Co-op (Parents' Guest Room)",
    shortName: 'Artist Co-op',
    miles: 0,
    description: 'Leave the communal kombucha SCOBY behind. The van may be held together by stickers.',
    activities: ['shop'],
    scene: 'departure',
  },
  {
    id: 'mushroom_market',
    name: 'Mosswood Mushroom Market',
    shortName: 'Mushroom Market',
    miles: 100,
    description: 'Locally foraged mushrooms, hand-whittled spoons, and one extremely credentialed raccoon.',
    activities: ['shop', 'talk'],
    scene: 'mushroom-market',
    talk: {
      gain: { food: 8 },
      line: 'A mushroom grower trades a recipe for {food} food. These ones have actual labels.',
    },
  },
  {
    id: 'first_stop',
    name: 'Forgotten Highway Rest Stop',
    shortName: 'Rest Stop',
    miles: 200,
    description: 'Lukewarm coffee and a map whose best road is a dotted line.',
    activities: ['rest', 'forage'],
    scene: 'rest-stop',
    rest: { heal: 12 },
    forage: [6, 10],
  },
  {
    id: 'river_ferry',
    name: 'Last Cast River Ferry',
    shortName: 'River Ferry',
    miles: 280,
    description: 'The ferry runs on river time. The captain calls every delay a mindfulness exercise.',
    activities: ['rest', 'talk'],
    scene: 'river-ferry',
    rest: { heal: 12 },
    talk: {
      gain: { parts: 1 },
      line: 'The ferry captain gives you {parts} repair {part|parts} and an unsolicited knot lesson.',
    },
  },
  {
    id: 'sketchy_motel',
    name: 'Irony-Laden Roadside Motel',
    shortName: 'Roadside Motel',
    miles: 350,
    description: 'The Wi-Fi is vintage. So are the stains.',
    activities: ['rest', 'shop'],
    scene: 'motel',
    rest: { heal: 30, cost: 45, label: 'Rent a room' },
  },
  {
    id: 'viral_landmark',
    name: 'Obscure Roadside Attraction (Now Viral)',
    shortName: 'Viral Landmark',
    miles: 470,
    description: 'Everyone is taking an authentic selfie at exactly the same angle.',
    activities: ['talk', 'forage'],
    scene: 'landmark',
    forage: [4, 8],
    talk: {
      gain: { money: 65 },
      line: 'A tourist buys your authentic road photos for ${money}.',
    },
  },
  {
    id: 'forest_camp',
    name: 'Rainy Cedar Campground',
    shortName: 'Forest Camp',
    miles: 570,
    description: 'A quiet grove, a smoky fire, and a communal tarp with a surprisingly elaborate governance structure.',
    activities: ['rest', 'forage', 'talk'],
    scene: 'forest-camp',
    rest: { heal: 16 },
    forage: [12, 18],
    talk: {
      heal: 8,
      line: 'Campfire stories restore {heal} health to each survivor. Nobody checks their phone.',
    },
  },
  {
    id: 'crypto_meetup',
    name: 'DeFi Community Node (Gas Station Backroom)',
    shortName: 'Crypto Meetup',
    miles: 670,
    description: 'They promise avocado-toast futures and refuse to explain where the money comes from.',
    activities: ['talk', 'shop'],
    scene: 'crypto',
    talk: {
      gain: { fuel: 3 },
      line: 'A crypto founder pays you {fuel} fuel to listen to a pitch.',
    },
  },
  {
    id: 'food_truck_fest',
    name: 'Artisanal Food Cart Pod',
    shortName: 'Food Carts',
    miles: 750,
    description: 'An oasis of excellent tacos and alarming prices.',
    activities: ['shop', 'meal'],
    scene: 'food-carts',
    meal: {
      costEach: 8,
      heal: 12,
      label: 'Eat at the carts',
      line: 'Excellent tacos at alarming prices: ${cost} for the crew. Survivors recovered {heal} health.',
    },
    prices: { food: 6 },
  },
  {
    id: 'bookshop',
    name: 'Last Chapter Roadside Bookshop',
    shortName: 'Bookshop',
    miles: 870,
    description: 'Used books, emergency snacks, and a resident cat who has rejected your manuscript.',
    activities: ['shop', 'talk'],
    scene: 'bookshop',
    talk: {
      gain: { money: 45 },
      line: 'The bookseller pays ${money} for your road journal. The cat remains unconvinced.',
    },
  },
  {
    id: 'portland',
    name: 'Portland (The Dream of the 90s is Alive)',
    shortName: 'Portland',
    miles: 1000,
    description: 'You made it. The rent is high, but the story is yours.',
    activities: [],
    scene: 'victory',
  },
];

// The road between stops: its heading, its scene and what foraging beside it can find.
export const REGIONS = [
  { id: 'foothills', from: 0, to: 200, name: 'Into the foothills', scene: 'road-forest', forage: [8, 12] },
  { id: 'river', from: 200, to: 350, name: 'Along the river', scene: 'road-river', forage: [10, 14] },
  {
    id: 'pines',
    from: 350,
    to: 570,
    name: 'The long way through the pines',
    scene: 'road-forest',
    forage: [8, 12],
  },
  { id: 'forest', from: 570, to: 750, name: 'Deep in Cascadia', scene: 'road-forest', forage: [10, 16] },
  {
    id: 'outskirts',
    from: 750,
    to: 870,
    name: 'The outskirts of somewhere',
    scene: 'road-forest',
    forage: [5, 9],
  },
  { id: 'city', from: 870, to: 1000, name: 'Portland is getting closer', scene: 'road-city', forage: [3, 6] },
];

// Encounters. `type` is 'auto' (one Continue button), 'choice', or 'critical' (a choice list shown
// as a critical moment). `weight` sets how often an encounter is picked among those whose `where`
// range of miles contains the van; an encounter without `where` can happen anywhere.
//
// A choice may carry:
//   only       the one background that sees it
//   needs      what it costs, as { resource id: amount }. The amount is a number, or the name of
//              one of the encounter's own numbers. Needs are checked, then spent.
//   lacking    the refusal when a need is not met; {need} and {have} are the amounts
//   offline    the refusal on the day of a Wi-Fi outage, for a choice that needs a signal
//   result     the journal line; `otherwise` is the line when the choice's roll goes badly
//
// Every other number on an encounter is (T), unless a comment says it is spelled out in a sentence.
// The effects live in engine/events.js, looked up by id.
export const EVENTS = [
  {
    id: 'tiktok_distraction',
    title: 'Existential Doomscrolling Spiral',
    description: 'A traveler loses a little hope to a carefully curated feed.',
    type: 'auto',
    scene: 'doomscrolling',
    weight: 12,
    damage: 8,
    choices: [],
    result: '{name} lost {damage} health to doomscrolling.',
  },
  {
    id: 'nft_auction',
    title: 'Pop-Up NFT “Art” Fair',
    description: 'An impromptu fair blocks the road. Someone offers a lot of money for a JPEG.',
    type: 'choice',
    scene: 'nft',
    weight: 9,
    winChance: 0.4,
    win: 220,
    lose: 15,
    consultFee: 60,
    choices: [
      {
        id: 'invest',
        label: 'Trade one NFT',
        needs: { nft: 1 },
        lacking: 'You need an NFT to trade.',
        result: 'The JPEG sold for ${money}.',
      },
      {
        id: 'consult',
        label: 'Offer to audit their smart contract',
        only: 'dev',
        result: 'You found the bug. It was the entire contract. They paid ${money} anyway.',
      },
      {
        id: 'wait',
        label: 'Scoff and wait it out',
        result: 'You waited out the fair with performative cynicism.',
      },
    ],
  },
  {
    id: 'food_poisoning',
    title: 'Food Poisoning from Foraged Berries',
    description: 'Someone was very confident about the berries. They should not have been.',
    type: 'choice',
    scene: 'illness',
    weight: 10,
    treatedDamage: 8,
    damage: 22,
    choices: [
      {
        id: 'treat',
        label: 'Open the emergency kombucha',
        needs: { kombucha: 1 },
        lacking: 'You have no kombucha to open.',
        result: '{name} lost {damage} health and a bottle of kombucha to mystery berries.',
      },
      {
        id: 'ride',
        label: 'Let nature take its course',
        result: '{name} lost {damage} health to mystery berries and is now sick.',
      },
    ],
  },
  {
    id: 'van_breakdown',
    title: 'Vehicle “Quirk” (Breakdown)',
    description: 'A charming new noise becomes silence. The van needs repair.',
    type: 'choice',
    scene: 'breakdown',
    weight: 12,
    towCost: 90,
    kickChance: 0.45,
    kickDamage: 5,
    choices: [
      {
        // The developer repairs with the `repairCost` of that background's ability instead.
        id: 'repair',
        label: 'Use repair supplies',
        needs: { parts: 2 },
        lacking: 'The repair takes {need} repair {kit|kits}; you have {have}.',
        result: 'The van runs again after {parts} repair {kit|kits}.',
      },
      {
        id: 'tow',
        label: 'Pay a tow truck',
        needs: { money: 'towCost' },
        lacking: 'The tow costs ${need}; you have ${have}.',
        result: 'A tow truck named Destiny hauled the van to a mechanic for ${money}.',
      },
      {
        id: 'kick',
        label: 'Try percussive encouragement',
        result: 'A gentle kick worked. Nobody understands why.',
        otherwise: 'The kick cost a day and {damage} health per survivor.',
      },
    ],
  },
  {
    // The drizzle's own numbers are RULES.drizzle.
    id: 'good_weather',
    title: 'Perfect Portland-esque Drizzle',
    description: 'The roads clear and your contemplative mood improves.',
    type: 'auto',
    scene: 'travel',
    weight: 9,
    choices: [],
    atStop: 'Arriving early saved {fuel} fuel before the next stretch.',
    onRoad: 'Clear roads add {miles} miles.',
  },
  {
    // How long the heat lasts and what it does each day are RULES.heat.
    id: 'bad_weather',
    title: 'Unexpected Heatwave',
    description: 'The heat slows every traveler and tests everyone’s patience.',
    type: 'auto',
    scene: 'heatwave',
    weight: 10,
    damage: 6,
    choices: [],
    result: 'The heatwave costs every survivor {damage} health and will last {days} more days.',
  },
  {
    id: 'found_supplies',
    title: 'Abandoned Free Box!',
    description: 'Useful supplies sit beside a handwritten “please take” sign.',
    type: 'auto',
    scene: 'free-box',
    weight: 9,
    food: 8,
    fuel: 2,
    choices: [],
    result: 'The free box held {food} food and {fuel} fuel.',
  },
  {
    id: 'wifi_outage',
    title: 'Local ISP Outage!',
    description: 'The one coffee shop with Wi-Fi for miles goes dark.',
    type: 'auto',
    scene: 'wifi',
    weight: 9,
    damage: 3,
    influencerDamage: 8,
    choices: [],
    result: 'The Wi-Fi outage drained the party’s spirit.',
  },
  {
    // Two results spell out `kombuchaCost` and `quarantineDays` in words ("Two bottles", "Two days"):
    // a change to either number needs the sentence changed with it.
    id: 'pandemic_death',
    title: 'Sudden Pandemic Relapse',
    description: 'A devastating outbreak catches up with the van.',
    type: 'critical',
    scene: 'outbreak',
    weight: 2,
    kombuchaCost: 2,
    dosedDamage: 6,
    quarantineDays: 2,
    quarantineDamage: 8,
    worstDamage: 45,
    damage: 15,
    choices: [
      {
        id: 'kombucha',
        label: 'Dose everyone with kombucha',
        needs: { kombucha: 'kombuchaCost' },
        lacking: 'Dosing everyone takes {need} {bottle|bottles} of kombucha; you have {have}.',
        result: 'Two bottles of kombucha and a lot of confidence held the outbreak to {damage} health each.',
      },
      {
        id: 'quarantine',
        label: 'Quarantine in the van',
        result: 'Two days of quarantine cost {damage} health each and most of the snacks.',
      },
      {
        id: 'push_on',
        label: 'Drive through it',
        result: 'You drove through it. {name} took the worst of it; everyone else is sick.',
      },
    ],
  },
  {
    id: 'ebike_convoy',
    title: 'E-Bike Convoy Claims the Lane',
    description: 'Forty riders, one lane, and a shared belief that the van is the problem.',
    type: 'choice',
    scene: 'bike-convoy',
    weight: 7,
    where: { from: 100, to: 870 },
    fuel: 2,
    heal: 2,
    honkChance: 0.5,
    damage: 4,
    tips: 35,
    choices: [
      {
        id: 'wait',
        label: 'Crawl along behind them',
        result: 'You idled behind the convoy for an hour. It cost {fuel} fuel; the fresh air was free.',
      },
      {
        id: 'honk',
        label: 'Honk, apologetically',
        result: 'They parted like a slow, judgmental sea.',
        otherwise:
          "An organizer explained the van's carbon footprint for forty minutes. " + 'Everyone lost {damage} health.',
      },
      {
        id: 'trade',
        label: 'Offer a round of pour-overs',
        only: 'barista',
        needs: { food: 2 },
        lacking: 'A round of pour-overs takes {need} food; you have {have}.',
        result: 'The convoy tipped ${money} for roadside pour-overs and waved you through.',
      },
    ],
  },
  {
    id: 'sasquatch',
    title: 'Blurry Shape in the Treeline',
    description: 'Something tall crosses the road ahead and stops to look at the van.',
    type: 'choice',
    scene: 'road-forest',
    weight: 6,
    where: { from: 350, to: 750 },
    photo: 25,
    viralPhoto: 120,
    damage: 10,
    nftChance: 0.35,
    heal: 3,
    choices: [
      {
        id: 'photo',
        label: 'Take the photo',
        result: 'The photo sold for ${money}. The shape was a tall man named Greg.',
      },
      {
        id: 'chase',
        label: 'Chase it for the content',
        result: '{name} lost {damage} health in the brush and came back with an authenticated Sasquatch JPEG.',
        otherwise: '{name} lost {damage} health in the brush. The shape declined to comment.',
      },
      {
        id: 'leave',
        label: 'Leave it its privacy',
        result: 'You left it alone. Everyone feels {heal} health better about themselves.',
      },
    ],
  },
  {
    id: 'toll_troll',
    title: 'Toll Under the Bridge',
    description: 'A man in a reflective vest has installed himself beneath the overpass with a card reader.',
    type: 'choice',
    scene: 'road-river',
    weight: 6,
    where: { from: 200, to: 350 },
    toll: 30,
    riddleChance: 0.5,
    fine: 50,
    damage: 3,
    fordDamage: 6,
    choices: [
      {
        id: 'pay',
        label: 'Pay the toll',
        needs: { money: 'toll' },
        lacking: 'The toll is ${need}; you have ${have}.',
        result: 'You paid ${money}. He gave you a receipt printed on birch bark.',
      },
      {
        id: 'riddle',
        label: 'Answer his riddle instead',
        result: 'The answer was “gentrification.” He let you through.',
        otherwise: 'Wrong. The fine was ${money} and {damage} health each for the lecture.',
      },
      {
        id: 'ford',
        label: 'Ford the creek like it is 1848',
        only: 'prepper',
        result: 'The van forded the creek. {name} lost {damage} health to wet socks.',
      },
    ],
  },
  {
    id: 'brunch_line',
    title: 'Brunch Line Across the Highway',
    description: 'The line for a new brunch spot has crossed two lanes and is still growing.',
    type: 'choice',
    scene: 'road-city',
    weight: 6,
    where: { from: 870, to: 1000 },
    fuel: 2,
    food: 6,
    detourFuel: 3,
    sponsor: 40,
    choices: [
      {
        id: 'wait',
        label: 'Wait it out',
        result:
          'Two hours later the line moved. It cost {fuel} fuel; ' + 'someone handed you {food} food in leftovers.',
      },
      {
        id: 'detour',
        label: 'Take the long way around',
        result: 'The detour cost {fuel} fuel and passed three more brunch lines.',
      },
      {
        id: 'post',
        label: 'Post about the line',
        only: 'influencer',
        offline: 'The Wi-Fi is out today. The post will have to wait.',
        result: 'Your post about the line got you waved through and ${money} in sponsored hash browns.',
      },
    ],
  },
  {
    // The `donate` label and result spell out `donation` ("$20", "Twenty dollars"):
    // a change to the number needs both changed with it.
    id: 'petition_gauntlet',
    title: 'Sidewalk Petition Gauntlet',
    description: 'Clipboards approach from both sides. Every cause is urgent and none of them are the same.',
    type: 'choice',
    scene: 'city-street',
    weight: 6,
    where: { from: 750, to: 1000 },
    damage: 3,
    donation: 20,
    choices: [
      {
        id: 'sign',
        label: 'Sign everything',
        result: 'Eleven signatures later, everyone is {damage} health more tired and on nine mailing lists.',
      },
      {
        id: 'donate',
        label: 'Give $20 to make it stop',
        needs: { money: 'donation' },
        lacking: 'Silence costs ${need}; you have ${have}.',
        result: 'Twenty dollars bought silence and a tote bag.',
      },
      {
        id: 'call',
        label: 'Take a very important call',
        only: 'dev',
        result: "You paced in a circle saying “let's circle back” until they left.",
      },
    ],
  },
];

// How a traveler can die: the journal line and the epitaph the headstone starts with.
export const DEATHS = {
  starvation: {
    line: '{name} has died of hunger, three miles from a farm-to-table bistro.',
    epitaph: 'Would have preferred the tasting menu.',
  },
  rations: { line: '{name} has died of thin rations.', epitaph: 'Peaked at the last full meal.' },
  road: { line: '{name} has died of the road itself.', epitaph: 'Died as they lived: in the middle seat.' },
  heat: { line: '{name} has died of heat, still wearing the beanie.', epitaph: 'Refused to take off the beanie.' },
  illness: { line: '{name} has died of a sickness nobody treated.', epitaph: 'Said it was probably allergies.' },
  doomscrolling: { line: '{name} has died of doomscrolling.', epitaph: 'Scrolled to the end of the feed.' },
  food_poisoning: { line: '{name} has died of mystery berries.', epitaph: 'Was very confident about the berries.' },
  breakdown: {
    line: '{name} has died of percussive maintenance.',
    epitaph: 'Kicked the van. The van kicked back.',
  },
  wifi: { line: '{name} has died offline.', epitaph: 'Could not live without a signal.' },
  pandemic: { line: '{name} has died in the outbreak.', epitaph: 'Should have brought more kombucha.' },
  forage: { line: '{name} has died foraging.', epitaph: 'Lost a fight with a blackberry bush.' },
  scout: { line: '{name} has died scouting ahead.', epitaph: 'Went ahead. Stayed there.' },
  push: { line: '{name} has died pushing the van.', epitaph: 'Pushed the van. The van did not push back.' },
  hitchhike: { line: '{name} has died walking for fuel.', epitaph: 'Went for gas. Found peace instead.' },
  ebike: { line: '{name} has died of a lecture.', epitaph: 'Was told about their carbon footprint.' },
  sasquatch: { line: '{name} has died chasing a blurry shape.', epitaph: 'Got the content. Lost the plot.' },
  toll: { line: '{name} has died of wet socks.', epitaph: 'Forded the creek. Mostly.' },
  petitions: { line: '{name} has died of civic exhaustion.', epitaph: 'Signed one petition too many.' },
  unknown: { line: '{name} has died.', epitaph: 'The road keeps its reasons.' },
};

// Ending ranks. Each list is ordered so that the first match wins. Thresholds are (T).
export const RANKS = {
  won: [
    {
      min: 1300,
      title: 'Portland Royalty',
      line: 'A studio apartment, a standing brunch reservation, and opinions about bridges.',
    },
    { min: 1050, title: 'Certified Local', line: 'You already complain about how much the city has changed.' },
    { min: 800, title: 'Convincing Transplant', line: 'The lease is signed. The houseplants are aspirational.' },
    { min: 550, title: 'Couch Surfer', line: "You made it. Your friends' sofa is less sure." },
    { min: 0, title: 'Technically Arrived', line: 'Portland counts it. Barely.' },
  ],
  lost: [
    {
      minMiles: 700,
      title: 'Roadside Legend',
      line: 'They will tell stories about the van that almost made it.',
    },
    { minMiles: 0, title: 'Cautionary Tale', line: 'Somewhere, a parent is saying “I told you so.”' },
  ],
};

// Button labels and details, by action type. `rest` and `useItem` have one entry for each case.
// A stop's own `rest.label` or `meal.label` replaces the label here; the ability's label and
// description are on its background.
export const ACTION_TEXT = {
  travel: {
    label: 'Drive toward {stop}',
    startLabel: 'Leave for Portland',
    detail: '{miles} miles today for {fuel} fuel.',
  },
  rest: {
    road: { label: 'Rest by the road', detail: '+{heal} health each. Costs a day of food.' },
    stop: {
      label: 'Rest here',
      detail: '+{heal} health each and cures sickness. Costs a day of food.',
      paidDetail: 'Costs ${cost} and a day of food. +{heal} health each and cures sickness.',
    },
  },
  forage: { label: 'Forage', detail: '{min} to {max} food for a day and {damage} health each.' },
  meal: { detail: '${cost} for the crew. +{heal} health each, no day lost.' },
  talk: { label: 'Talk to locals', detail: 'Hear what this place offers. One conversation per stop.' },
  openShop: { label: 'Visit the shop', detail: 'Top up supplies before the next stretch.' },
  leaveShop: { label: 'Back to {stop}', detail: '' },
  useItem: {
    ammo: { label: 'Scatter seed bombs', detail: '{min} to {max} food, right now.' },
    kombucha: { label: 'Share the kombucha', detail: '+{heal} health each and cures sickness.' },
  },
  sellNft: { label: 'Sell one NFT for ${resale}', detail: '' },
  push: { label: 'Push the van', detail: '{miles} miles for a day and {damage} health each.' },
  hitchhike: {
    label: 'Send someone for fuel',
    detail: "A day's walk. Sometimes they come back with {fuel} fuel.",
  },
  tradeLuggage: { label: 'Trade the roof luggage', detail: '{fuel} fuel from a passing collector. Once only.' },
};

// What the journal says. Encounters, conversations, meals, abilities and deaths carry their own lines.
export const JOURNAL = {
  start: 'Five travelers pack the van for Portland.',
  won: 'Portland at last. The van and its survivors roll into town.',
  lost: 'The last traveler fell. The road to Portland ends here.',
  arrived: 'Arrived at {stop}.',
  drove: 'Drove {miles} miles to mile {distance}.',
  tankDry: 'The tank is dry.',
  weatherClears: 'The weather clears.',
  shortFood: 'The party ran short of food. Everyone living loses {damage} health.',
  restRoad: 'The party rested for a day. Survivors recovered {heal} health.',
  restStop: 'The party rested for a day. Survivors recovered {heal} health and shook off any sickness.',
  restPaid: 'A night indoors cost ${cost}. Survivors recovered {heal} health and shook off any sickness.',
  foraged: 'Foraged {food} food, at a cost of {damage} health per survivor.',
  forageSick: '{name} ate something that disagreed.',
  bought: 'Bought supplies for ${cost}.',
  autoBought: 'Auto-bought road supplies for ${cost}. The van is stocked.',
  autoBoughtShort: 'Auto-bought road supplies for ${cost}. Cash is tight; essentials came first.',
  soldNft: 'Sold a {name} for ${resale}.',
  seedBombs: 'Seed bombs produced {food} food from a roadside patch.',
  kombucha: 'Kombucha restored {heal} health to every survivor.',
  pushed: 'The crew pushed the van {miles} miles to mile {distance}.',
  hitchhiked: '{name} walked for fuel and came back with {fuel}.',
  hitchhikeFailed: '{name} walked all day and came back with blisters.',
  luggage: 'A passing collector traded {fuel} fuel for the roof luggage. The van looks naked.',
};

// Why an action is refused. Each is a sentence the player can act on; none names an internal id.
export const REFUSALS = {
  invalid: 'Choose a valid action.',
  ended: 'This journey has ended. Start a new one to play again.',
  pending: 'Resolve the current encounter first.',
  nothingPending: 'There is no encounter to resolve.',
  stale: 'This encounter is no longer pending.',
  pickChoice: 'Choose one of the available responses.',
  noChoices: 'This encounter has no choices.',
  tankDry: 'The tank is dry. Buy fuel or try a last resort.',
  pace: 'Choose a listed travel pace.',
  rations: 'Choose a listed ration size.',
  noShop: 'There is no shop at this stop.',
  inShop: 'You are already in the shop.',
  notInShop: 'You are not in a shop.',
  order: 'Enter a valid shop order.',
  quantities: 'Use whole, nonnegative quantities for listed items.',
  overMax: 'The van can hold only {max} {name}.',
  overspend: 'You need ${cost}; you have ${money}.',
  autoBuyPhase: 'Auto-buy is available at the supply shop.',
  autoBuyDone: 'The van already has the recommended supplies.',
  autoBuyBroke: 'There is not enough cash to add recommended supplies while keeping your reserve.',
  noRest: 'You cannot rest here.',
  noForage: 'There is nowhere to forage here.',
  cost: 'Costs ${cost}; you have ${money}.',
  noMeal: 'There is nowhere to eat here.',
  mealEaten: 'The crew has already eaten here.',
  noTalk: 'No one here has a story to tell.',
  talked: 'You have already spoken to everyone here.',
  itemPhase: 'This item cannot be used here.',
  noItem: { ammo: 'You have no seed bombs to use.', kombucha: 'You have no kombucha to use.' },
  sellPhase: 'NFTs sell only in a shop.',
  noNft: 'You have no NFTs to sell.',
  abilityPhase: 'Your ability is for the road, not the checkout.',
  cooldown: 'Ready in {days} {day|days}.',
  lastResortPhase: 'Last resorts are for the road, not the checkout.',
  lastResortFuel: 'There is still fuel in the tank. Last resorts wait until it is dry.',
  luggageGone: 'The roof luggage is already gone.',
  epitaphWho: 'Choose one of the travelers.',
  epitaphAlive: '{name} is still alive and needs no epitaph.',
  epitaphText: 'Write an epitaph of 1 to {max} characters, on one line.',
  background: 'Choose one of the four backgrounds.',
  names: 'Enter five names of 1–{max} characters.',
  seed: 'The journey seed must be an integer.',
  save: 'Cannot save an invalid journey.',
};
