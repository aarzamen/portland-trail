export const DEFAULT_NAMES = ['Kale', 'Juniper', 'Rowan', 'Birch', 'Echo'];

export const PROFESSIONS = [
  { id: 'influencer', name: 'Social Media Influencer', description: 'A ring light, a following, and almost no practical skills.', ability: 'Collab once every four days for $45 and 2 food. A Wi-Fi outage blocks it that day.', inventory: { money: 2000, food: 20, fuel: 15, ammo: 0, parts: 0, kombucha: 0, nft: 0 } },
  { id: 'dev', name: 'Gig Economy Developer', description: 'Can fix a van with fewer parts; owns a suspicious JPEG.', ability: 'Salvage 2 repair parts once every four days. Breakdown repairs cost 1 part instead of 2.', inventory: { money: 1200, food: 30, fuel: 20, ammo: 0, parts: 0, kombucha: 0, nft: 1 } },
  { id: 'prepper', name: 'Doomsday Prepper (Portland Edition)', description: 'The van is full of kale chips and artisanal survival gear.', ability: 'Foraging finds 4 extra food. Scout for 6 food once every four days, costing 3 health per survivor.', inventory: { money: 800, food: 100, fuel: 25, ammo: 2, parts: 2, kombucha: 0, nft: 0 } },
  { id: 'barista', name: 'Artisanal Barista', description: 'Knows everyone’s coffee order and keeps the group moving.', ability: 'Brew once per day: spend 1 food to restore 5 health to every living traveler.', inventory: { money: 1000, food: 50, fuel: 20, ammo: 0, parts: 0, kombucha: 2, nft: 0 } },
];

export const ITEMS = [
  { id: 'food', name: 'Sustainably Sourced Kale Chips', price: 4, unit: 'bag', description: 'One unit of food for the road.' },
  { id: 'fuel', name: 'Bio-Diesel Canister', price: 12, unit: 'canister', description: 'One unit of fuel. A normal travel day uses four.' },
  { id: 'ammo', name: 'Seed Bombs', price: 8, unit: 'pack', description: 'Use on the road for a guaranteed 8 food.' },
  { id: 'parts', name: 'Washi Tape & Vintage Screwdrivers', price: 15, unit: 'set', description: 'Repair the van during a breakdown.' },
  { id: 'kombucha', name: 'Locally Brewed Kombucha', price: 14, unit: 'bottle', description: 'Restore 10 health to each living traveler.' },
  { id: 'nft', name: 'Pixelated Sasquatch JPEG', price: 80, unit: 'JPEG', description: 'Trade at the NFT fair or sell for $50 at a shop.' },
];

export const PACES = {
  slow: { name: 'Scenic', miles: 50, fuel: 2 },
  normal: { name: 'Steady', miles: 80, fuel: 4 },
  fast: { name: 'Floor it', miles: 110, fuel: 7 },
};

export const RATIONS = {
  bare: { name: 'Bare', food: 0.25 },
  meager: { name: 'Meager', food: 0.5 },
  filling: { name: 'Filling', food: 1 },
};

export const LOCATIONS = [
  { id: 'start_city', name: "Your Shared Artist Co-op (Parents' Guest Room)", shortName: 'Artist Co-op', miles: 0, description: 'Leave the communal kombucha SCOBY behind. The van may be held together by stickers.', activities: ['shop'], image: 'assets/departure.jpg' },
  { id: 'first_stop', name: 'Forgotten Highway Rest Stop', shortName: 'Rest Stop', miles: 200, description: 'Lukewarm coffee and a map whose best road is a dotted line.', activities: ['rest', 'forage'], image: 'assets/rest-stop.jpg' },
  { id: 'sketchy_motel', name: 'Irony-Laden Roadside Motel', shortName: 'Roadside Motel', miles: 350, description: 'The Wi-Fi is vintage. So are the stains.', activities: ['rest', 'shop'], image: 'assets/motel.jpg' },
  { id: 'viral_landmark', name: 'Obscure Roadside Attraction (Now Viral)', shortName: 'Viral Landmark', miles: 470, description: 'Everyone is taking an authentic selfie at exactly the same angle.', activities: ['talk', 'forage'], image: 'assets/landmark.jpg' },
  { id: 'crypto_meetup', name: 'DeFi Community Node (Gas Station Backroom)', shortName: 'Crypto Meetup', miles: 670, description: 'They promise avocado-toast futures and refuse to explain where the money comes from.', activities: ['talk', 'shop'], image: 'assets/crypto.jpg' },
  { id: 'food_truck_fest', name: 'Artisanal Food Cart Pod', shortName: 'Food Carts', miles: 750, description: 'An oasis of excellent tacos and alarming prices.', activities: ['shop', 'rest'], image: 'assets/food-carts.jpg' },
  { id: 'portland', name: 'Portland (The Dream of the 90s is Alive)', shortName: 'Portland', miles: 1000, description: 'You made it. The rent is high, but the story is yours.', activities: [], image: 'assets/victory.jpg' },
];

export const EVENTS = [
  { id: 'tiktok_distraction', title: 'Existential Doomscrolling Spiral', description: 'A traveler loses a little hope to a carefully curated feed.', type: 'auto', image: 'assets/doomscrolling.jpg', choices: [] },
  { id: 'nft_auction', title: 'Pop-Up NFT “Art” Fair', description: 'An impromptu fair blocks the road. Someone offers a lot of money for a JPEG.', type: 'choice', image: 'assets/nft.jpg', choices: [{ id: 'invest', label: 'Trade one NFT' }, { id: 'wait', label: 'Scoff and wait it out' }] },
  { id: 'food_poisoning', title: 'Food Poisoning from Foraged Berries', description: 'Someone was very confident about the berries. They should not have been.', type: 'auto', image: 'assets/illness.jpg', choices: [] },
  { id: 'van_breakdown', title: 'Vehicle “Quirk” (Breakdown)', description: 'A charming new noise becomes silence. The van needs repair.', type: 'choice', image: 'assets/breakdown.jpg', choices: [{ id: 'repair', label: 'Use repair supplies' }, { id: 'kick', label: 'Try percussive encouragement' }] },
  { id: 'good_weather', title: 'Perfect Portland-esque Drizzle', description: 'The roads clear and your contemplative mood improves.', type: 'auto', image: 'assets/travel.jpg', choices: [] },
  { id: 'bad_weather', title: 'Unexpected Heatwave', description: 'The heat slows every traveler and tests everyone’s patience.', type: 'auto', image: null, choices: [] },
  { id: 'found_supplies', title: 'Abandoned Free Box!', description: 'Useful supplies sit beside a handwritten “please take” sign.', type: 'auto', image: 'assets/free-box.jpg', choices: [] },
  { id: 'wifi_outage', title: 'Local ISP Outage!', description: 'The one coffee shop with Wi-Fi for miles goes dark.', type: 'auto', image: 'assets/wifi.jpg', choices: [] },
  { id: 'pandemic_death', title: 'Sudden Pandemic Relapse', description: 'A devastating outbreak ends the journey.', type: 'critical', image: 'assets/illness.jpg', choices: [] },
];
