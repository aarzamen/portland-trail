// The Portland Trail - Game Constants
const CONSTANTS = {
    INITIAL_PARTY_SIZE: 5,
    MAX_PARTY_NAME_LENGTH: 15,
    MAX_HEALTH: 100,
    
    DAILY_FOOD_CONSUMPTION: {
        bare: 0.5,
        meager: 1,
        filling: 2,
    },
    
    DAILY_FUEL_CONSUMPTION: {
        slow: 1,
        normal: 2,
        fast: 3,
    },
    
    PACE_SPEED_MULTIPLIER: {
        slow: 10,
        normal: 20,
        fast: 30,
    },
    
    TOTAL_DISTANCE: 1000, // Simplified for web version
};

const PROFESSIONS = {
    influencer: {
        id: 'influencer',
        name: 'Social Media Influencer',
        description: 'Starts with more "connections" (money) but less practical skills.',
        startingMoney: 2000,
        startingFood: 20,
        startingFuel: 15,
        specialAbility: 'Can occasionally get free supplies by "collabing". Loses health without Wi-Fi.'
    },
    dev: {
        id: 'dev',
        name: 'Gig Economy Developer',
        description: 'Good at fixing things, but needs constant third-wave coffee.',
        startingMoney: 1200,
        startingFood: 30,
        startingFuel: 20,
        specialAbility: 'Uses less spare parts for repairs. Starts with 1 "Pixelated Ape JPEG".'
    },
    prepper: {
        id: 'prepper',
        name: 'Doomsday Prepper (Portland Edition)',
        description: 'Starts with more food and artisanal "survival" gear.',
        startingMoney: 800,
        startingFood: 100,
        startingFuel: 25,
        specialAbility: 'Better odds at "foraging". Complains if rations are not "filling".'
    },
    barista: {
        id: 'barista',
        name: 'Artisanal Barista',
        description: 'Knows how to make a mean pour-over, which boosts morale.',
        startingMoney: 1000,
        startingFood: 50,
        startingFuel: 20,
        specialAbility: 'Can brew "morale boosting" coffee once a day (small health boost).'
    }
};

const ITEMS = {
    food: { name: 'Sustainably Sourced Kale Chips', basePrice: 25, unit: 'bag' },
    fuel: { name: 'Bio-Diesel Canister', basePrice: 60, unit: 'canister' },
    ammo: { name: 'Seed Bombs', basePrice: 15, unit: 'pack of 5' },
    parts: { name: 'Washi Tape & Vintage Screwdrivers', basePrice: 35, unit: 'set' },
    kombucha: { name: 'Locally Brewed Artisanal Kombucha', basePrice: 20, unit: 'bottle' },
    nft: { name: 'Pixelated Sasquatch JPEG', basePrice: 400, unit: 'JPEG (on reclaimed wood USB)' }
};

const LOCATIONS = [
    {
        id: 'start_city',
        name: 'Your Shared Artist Co-op (Parents\' Guest Room)',
        description: 'The journey to Portland begins. Time to escape the communal kombucha SCOBY.',
        distanceFromStart: 0,
        activities: ['shop'],
        imageUrl: 'images/location_start_city.jpeg'
    },
    {
        id: 'first_stop',
        name: 'Forgotten Highway Rest Stop',
        description: 'A good place to find lukewarm coffee and question your life choices.',
        distanceFromStart: 200,
        activities: ['rest', 'hunt'],
        imageUrl: 'images/location_first_stop.jpeg'
    },
    {
        id: 'sketchy_motel',
        name: 'Irony-Laden Roadside Motel',
        description: 'The Wi-Fi is "vintage" (i.e., non-existent), but the photo ops are priceless.',
        distanceFromStart: 350,
        activities: ['rest', 'shop'],
        imageUrl: 'images/location_sketchy_motel.jpeg'
    },
    {
        id: 'viral_landmark',
        name: 'Obscure Roadside Attraction (Now Viral)',
        description: 'Everyone is here taking "authentic" selfies for their feed. So. Many. Influencers.',
        distanceFromStart: 470,
        activities: ['talk'],
        imageUrl: 'images/location_viral_landmark.jpeg'
    },
    {
        id: 'crypto_meetup',
        name: 'DeFi "Community Node" (Gas Station Backroom)',
        description: 'They speak in acronyms and promise riches through "decentralized avocado toast futures". Mostly just confusing.',
        distanceFromStart: 670,
        activities: ['talk', 'shop'],
        imageUrl: 'images/location_crypto_bro_meetup.jpeg'
    },
    {
        id: 'food_truck_fest',
        name: 'Artisanal Food Cart Pod',
        description: 'Gourmet "foraged" snacks and $18 vegan tacos. A culinary oasis, or a financial trap?',
        distanceFromStart: 750,
        activities: ['shop', 'rest'],
        imageUrl: 'images/location_food_truck_fest.jpeg'
    },
    {
        id: 'portland',
        name: 'Portland (The Dream of the 90s is Alive)',
        description: 'You made it! Or did you? The rent is high, but the vibes are... vibey.',
        distanceFromStart: 1000,
        isFinalDestination: true,
        imageUrl: 'images/location_final_destination.jpeg'
    }
];

const RANDOM_EVENTS = [
    {
        id: 'tiktok_distraction',
        title: 'Existential Doomscrolling Spiral',
        description: 'A party member got lost in a curated feed of unattainable lifestyles and cat videos. You lose half a day and they lose 5 health from despair.',
        imageUrl: 'images/event_tiktok_distraction.jpeg',
        type: 'auto',
        outcome: (gameState) => {
            const partyMemberIndex = Math.floor(Math.random() * gameState.party.length);
            gameState.party[partyMemberIndex].health = Math.max(0, gameState.party[partyMemberIndex].health - 5);
            gameState.daysElapsed += 0.5;
            return `${gameState.party[partyMemberIndex].name} lost time and hope to doomscrolling.`;
        }
    },
    {
        id: 'nft_auction',
        title: 'Pop-Up NFT "Art" Fair',
        description: 'An impromptu NFT "art" fair blocks the trail. Do you invest your precious crypto (if you have any)?',
        imageUrl: 'images/event_nft_auction.jpeg',
        type: 'choice',
        choices: [
            {
                text: 'Invest (if you have an NFT)',
                outcome: (gameState) => {
                    if (gameState.inventory.nft > 0) {
                        const success = Math.random() > 0.7;
                        gameState.inventory.nft--;
                        if (success) {
                            gameState.inventory.money += 800;
                            return 'NFT investment was a visionary move! Richer!';
                        } else {
                            gameState.inventory.money = Math.max(0, gameState.inventory.money - 150);
                            return 'NFT "art" turned out to be worthless. Shocking. Poorer.';
                        }
                    }
                    return 'No NFTs to "invest". Probably for the best.';
                }
            },
            {
                text: 'Scoff and wait it out',
                outcome: (gameState) => {
                    gameState.daysElapsed += 0.2;
                    return 'Waited out the NFT fair with performative cynicism.';
                }
            }
        ]
    },
    {
        id: 'food_poisoning',
        title: 'Food Poisoning from Foraged Berries',
        description: 'A party member confidently ate some "wild-harvested" berries. It was a mistake. They lose significant health.',
        imageUrl: 'images/event_found_supplies.jpeg',
        type: 'auto',
        outcome: (gameState) => {
            const victimIndex = Math.floor(Math.random() * gameState.party.length);
            const victimName = gameState.party[victimIndex].name;
            gameState.party[victimIndex].health = Math.max(0, gameState.party[victimIndex].health - 30);
            gameState.party[victimIndex].status = 'Sick';
            return `${victimName} got severe food poisoning from mystery berries. Health critical!`;
        }
    },
    {
        id: 'van_breakdown',
        title: 'Vehicle "Quirk" (Breakdown)',
        description: 'Your quirky vehicle has developed a "charming" new noise, followed by silence. It needs washi tape and positive affirmations (spare parts).',
        imageUrl: 'images/event_van_breakdown.jpeg',
        type: 'choice',
        choices: [
            {
                text: 'Use Spare Parts & Good Vibes',
                outcome: (gameState) => {
                    if (gameState.inventory.parts > 0) {
                        gameState.inventory.parts--;
                        return 'Vehicle fixed with spare parts and hope.';
                    }
                    gameState.daysElapsed += 1;
                    return 'No spare parts! Wasted a day trying to manifest repairs.';
                }
            },
            {
                text: 'Try "percussive encouragement" (kick it)',
                outcome: (gameState) => {
                    const success = Math.random() > 0.8;
                    if (success) {
                        gameState.daysElapsed += 0.1;
                        return 'Kicking it (gently) actually worked!';
                    } else {
                        gameState.daysElapsed += 0.5;
                        return 'Kicking it just made it sadder. And wasted time.';
                    }
                }
            }
        ]
    },
    {
        id: 'good_weather',
        title: 'Perfect Portland-esque Drizzle',
        description: 'A light, refreshing drizzle (the good kind) and clear roads. You make excellent time, and the mood is contemplative.',
        imageUrl: 'images/event_good_weather.jpeg',
        type: 'auto',
        outcome: (gameState) => {
            gameState.distanceTraveled += 15;
            gameState.weather = 'Perfect Drizzle';
            return 'Perfect moody weather! Made extra progress.';
        }
    },
    {
        id: 'bad_weather',
        title: 'Unexpected Heatwave (Climate Change, Probably)',
        description: 'An unseasonal, oppressive heatwave slows you down and makes everyone irritable.',
        imageUrl: 'images/event_bad_weather.jpeg',
        type: 'auto',
        outcome: (gameState) => {
            gameState.daysElapsed += 0.5;
            gameState.party.forEach(member => {
                member.health = Math.max(0, member.health - 5);
            });
            gameState.weather = 'Scorching Hot';
            return 'Unexpected heatwave! Everyone is grumpy and slightly less healthy.';
        }
    },
    {
        id: 'found_supplies',
        title: 'Abandoned Free Box!',
        description: 'You stumble upon a "Free Box" on the roadside, filled with surprisingly useful (and some weird) items!',
        imageUrl: 'images/event_found_supplies.jpeg',
        type: 'auto',
        outcome: (gameState) => {
            const foundFood = Math.floor(Math.random() * 15) + 3;
            const foundFuel = Math.floor(Math.random() * 3) + 1;
            gameState.inventory.food += foundFood;
            gameState.inventory.fuel += foundFuel;
            return `Found ${foundFood} kale chips and ${foundFuel} bio-diesel in a free box! Score!`;
        }
    },
    {
        id: 'wifi_outage',
        title: 'Local ISP Outage!',
        description: 'The one coffee shop with "free Wi-Fi" for miles has an outage. All your navigation and social media validation capabilities are gone!',
        imageUrl: 'images/event_starlink_disruption.jpeg',
        type: 'auto',
        outcome: (gameState) => {
            gameState.daysElapsed += 0.5;
            gameState.party.forEach(member => {
                member.health = Math.max(0, member.health - 2);
            });
            gameState.weather = 'Overcast (and Annoying)';
            return 'Local ISP outage! Forced to stop and wait. Lost half a day and some sanity.';
        }
    },
    {
        id: 'pandemic_death',
        title: 'Sudden Pandemic Relapse',
        description: 'Despite all precautions, a virulent new strain of The Virus has caught up with you. Your Portland journey ends here.',
        imageUrl: 'images/event_covid_death.jpeg',
        type: 'critical',
        outcome: (gameState) => {
            gameState.party.forEach(member => {
                member.health = 0;
                member.status = 'Deceased';
            });
            gameState.gameOver = true;
            gameState.gameWon = false;
            return 'The entire party has succumbed to The Virus. GAME OVER.';
        }
    }
];

const GEN_Z_NAMES = [
    'Kale', 'Juniper', 'Rowan', 'Birch', 'Echo', 'River', 'Sage', 'Wren',
    'Jasper', 'Astrid', 'Orion', 'Luna', 'Finnian', 'Clementine', 'Bodhi', 'Willow',
    'Ezra', 'Aurora', 'Silas', 'Hazel', 'Atticus', 'Olive', 'Felix', 'Poppy',
    'Milo', 'Iris', 'Leo', 'Nova', 'Oscar', 'Ruby', 'Hugo', 'Skye',
    'Theo', 'Ivy', 'Axel', 'Zara', 'Ronan', 'Phoebe', 'Elliot', 'Lyra'
];