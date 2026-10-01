// The Portland Trail - Main Game Logic
class PortlandTrailGame {
    constructor() {
        this.gameState = {
            phase: 'start',
            profession: null,
            party: [],
            inventory: {
                money: 0,
                food: 0,
                fuel: 0,
                ammo: 0,
                parts: 0,
                kombucha: 0,
                nft: 0
            },
            currentLocationIndex: 0,
            distanceTraveled: 0,
            daysElapsed: 0,
            weather: 'Clear',
            pace: 'normal',
            rations: 'meager',
            eventLog: [],
            gameOver: false,
            gameWon: false,
            currentEvent: null
        };
        
        this.shopCart = {};
        this.selectedProfession = null;
        this.init();
    }

    init() {
        this.showScreen('start');
        this.loadGameState();
    }

    // Screen Management
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${screenId}-screen`).classList.add('active');
        
        if (screenId !== 'start' && screenId !== 'game-over' && screenId !== 'setup' && screenId !== 'character') {
            this.showHud();
        } else {
            this.hideHud();
        }
        
        this.gameState.phase = screenId;
    }

    showHud() {
        const hud = document.getElementById('hud');
        hud.classList.add('active');
        this.updateHud();
    }

    hideHud() {
        document.getElementById('hud').classList.remove('active');
    }

    updateHud() {
        document.getElementById('hud-money').textContent = `$${this.gameState.inventory.money}`;
        document.getElementById('hud-food').textContent = `${this.gameState.inventory.food} bags`;
        document.getElementById('hud-fuel').textContent = `${this.gameState.inventory.fuel} canisters`;
        document.getElementById('hud-days').textContent = Math.floor(this.gameState.daysElapsed);

        const partyStatus = document.getElementById('party-status');
        partyStatus.innerHTML = '';
        
        this.gameState.party.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'party-member';
            memberDiv.textContent = `${member.name}: ${member.health}%`;
            
            if (member.health <= 0) {
                memberDiv.classList.add('dead');
            } else if (member.health < 30) {
                memberDiv.classList.add('injured');
            } else if (member.status === 'Sick') {
                memberDiv.classList.add('sick');
            } else {
                memberDiv.classList.add('healthy');
            }
            
            partyStatus.appendChild(memberDiv);
        });
    }

    // Game State Management
    saveGameState() {
        localStorage.setItem('portlandTrailSaveGame', JSON.stringify(this.gameState));
    }

    loadGameState() {
        const saved = localStorage.getItem('portlandTrailSaveGame');
        if (saved) {
            try {
                const loadedState = JSON.parse(saved);
                // Validate loaded state has required properties
                if (loadedState.phase && loadedState.inventory) {
                    this.gameState = { ...this.gameState, ...loadedState };
                }
            } catch (e) {
                console.warn('Failed to load save game:', e);
            }
        }
    }

    // Profession Selection
    selectProfession(professionId) {
        document.querySelectorAll('.profession-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.querySelector(`[data-profession="${professionId}"]`);
        selectedCard.classList.add('selected');
        
        this.selectedProfession = professionId;
        document.getElementById('select-profession').disabled = false;
    }

    confirmProfession() {
        if (!this.selectedProfession) return;
        
        this.gameState.profession = PROFESSIONS[this.selectedProfession];
        this.showScreen('character');
    }

    // Character Creation
    randomizeName(inputId) {
        const randomName = GEN_Z_NAMES[Math.floor(Math.random() * GEN_Z_NAMES.length)];
        document.getElementById(inputId).value = randomName;
    }

    startAdventure() {
        // Collect party names
        const partyNames = [];
        for (let i = 1; i <= CONSTANTS.INITIAL_PARTY_SIZE; i++) {
            const name = document.getElementById(`char${i}`).value.trim() || `Traveler ${i}`;
            partyNames.push(name);
        }

        // Initialize party
        this.gameState.party = partyNames.map((name, index) => ({
            id: `member_${index}`,
            name: name,
            health: CONSTANTS.MAX_HEALTH,
            status: 'Healthy'
        }));

        // Set starting resources based on profession
        const prof = this.gameState.profession;
        this.gameState.inventory = {
            money: prof.startingMoney,
            food: prof.startingFood,
            fuel: prof.startingFuel,
            ammo: 0,
            parts: 0,
            kombucha: 0,
            nft: prof.id === 'dev' ? 1 : 0
        };

        this.addLogEntry('The journey to Portland begins!');
        this.showScreen('shop');
        this.updateShop(true); // Initial shop
    }

    // Shop System
    updateShop(isInitial = false) {
        document.getElementById('shop-title').textContent = isInitial ? 
            '► Initial Supply Purchase (You MUST buy supplies!)' : 
            '► Artisanal Supply Emporium';
        
        document.getElementById('shop-money').textContent = `Money: $${this.gameState.inventory.money}`;
        
        // Reset shop cart
        this.shopCart = {};
        Object.keys(ITEMS).forEach(itemId => {
            document.getElementById(`${itemId}-quantity`).textContent = '0';
        });
        
        this.updateShopTotal();
    }

    changeQuantity(itemId, change) {
        if (!this.shopCart[itemId]) this.shopCart[itemId] = 0;
        
        this.shopCart[itemId] = Math.max(0, this.shopCart[itemId] + change);
        document.getElementById(`${itemId}-quantity`).textContent = this.shopCart[itemId];
        
        this.updateShopTotal();
    }

    updateShopTotal() {
        let total = 0;
        Object.keys(this.shopCart).forEach(itemId => {
            const quantity = this.shopCart[itemId] || 0;
            const price = ITEMS[itemId].basePrice;
            total += quantity * price;
        });
        
        document.getElementById('total-cost').textContent = `Total: $${total}`;
        
        // Check if player can afford
        const canAfford = total <= this.gameState.inventory.money;
        document.querySelector('.shop-summary .game-btn').disabled = !canAfford;
    }

    completePurchase() {
        let total = 0;
        
        // Calculate total and update inventory
        Object.keys(this.shopCart).forEach(itemId => {
            const quantity = this.shopCart[itemId] || 0;
            const price = ITEMS[itemId].basePrice;
            total += quantity * price;
            this.gameState.inventory[itemId] += quantity;
        });
        
        this.gameState.inventory.money -= total;
        
        if (total > 0) {
            this.addLogEntry(`Purchased supplies for $${total}`);
        }
        
        this.saveGameState();
        this.showScreen('travel');
        this.updateTravel();
    }

    leaveShop() {
        this.showScreen('travel');
        this.updateTravel();
    }

    // Travel System
    updateTravel() {
        const currentLocation = LOCATIONS[this.gameState.currentLocationIndex];
        const nextLocationIndex = Math.min(this.gameState.currentLocationIndex + 1, LOCATIONS.length - 1);
        const nextLocation = LOCATIONS[nextLocationIndex];
        
        document.getElementById('current-location').textContent = 
            `En route from ${currentLocation.name} to ${nextLocation.name}`;
        
        document.getElementById('weather-display').textContent = 
            `Weather: ${this.gameState.weather}`;
        
        // Update progress bar
        const progress = Math.min((this.gameState.distanceTraveled / CONSTANTS.TOTAL_DISTANCE) * 100, 100);
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('progress-marker').style.left = `${Math.min(progress, 95)}%`;
        
        document.getElementById('distance-info').textContent = 
            `Distance: ${this.gameState.distanceTraveled}/${CONSTANTS.TOTAL_DISTANCE} miles`;
        
        // Update pace and rations
        document.querySelector(`input[name="pace"][value="${this.gameState.pace}"]`).checked = true;
        document.querySelector(`input[name="rations"][value="${this.gameState.rations}"]`).checked = true;
        
        this.updateEventLog();
    }

    travelDay() {
        // Check if we have fuel
        if (this.gameState.inventory.fuel < 1) {
            this.showEvent({
                title: 'Out of Fuel!',
                description: 'Your van has run out of bio-diesel. You\'re stranded!',
                type: 'critical',
                outcome: () => {
                    this.gameOver('You ran out of fuel and are stranded on the highway. Game Over.');
                    return 'Stranded without fuel.';
                }
            });
            return;
        }

        // Update pace and rations from form
        this.gameState.pace = document.querySelector('input[name="pace"]:checked').value;
        this.gameState.rations = document.querySelector('input[name="rations"]:checked').value;

        // Calculate daily consumption
        const fuelConsumption = CONSTANTS.DAILY_FUEL_CONSUMPTION[this.gameState.pace];
        const foodConsumption = CONSTANTS.DAILY_FOOD_CONSUMPTION[this.gameState.rations] * this.gameState.party.length;
        const distance = CONSTANTS.PACE_SPEED_MULTIPLIER[this.gameState.pace];

        // Check if we have enough food
        if (this.gameState.inventory.food < foodConsumption) {
            this.addLogEntry('Not enough food! Party members are getting weak.', 'warning');
            // Reduce health for insufficient food
            this.gameState.party.forEach(member => {
                member.health = Math.max(0, member.health - 10);
            });
        } else {
            this.gameState.inventory.food -= foodConsumption;
        }

        // Consume fuel
        this.gameState.inventory.fuel -= fuelConsumption;

        // Update distance and days
        this.gameState.distanceTraveled += distance;
        this.gameState.daysElapsed += 1;

        // Randomly change weather (20% chance)
        if (Math.random() < 0.2) {
            const weatherOptions = ['Clear', 'Perfect Drizzle', 'Heavy Rain', 'Foggy', 'Overcast', 'Sunny'];
            this.gameState.weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
            this.addLogEntry(`Weather changed to: ${this.gameState.weather}`);
        }

        // Random event chance (30%)
        if (Math.random() < 0.3) {
            this.triggerRandomEvent();
        } else {
            this.addLogEntry(`Traveled ${distance} miles. ${this.getRandomTravelMessage()}`);
        }

        // Check if reached next location
        this.checkLocationArrival();

        // Check win condition
        if (this.gameState.distanceTraveled >= CONSTANTS.TOTAL_DISTANCE) {
            this.gameWin();
            return;
        }

        // Check lose conditions
        this.checkGameOverConditions();

        this.updateTravel();
        this.updateHud();
        this.saveGameState();
    }

    getRandomTravelMessage() {
        const messages = [
            'The van makes concerning noises, but keeps going.',
            'Someone spotted a "COEXIST" bumper sticker. Morale up.',
            'Passed three coffee shops in one mile. Must be close to Portland.',
            'The playlist is getting pretentious. Good sign.',
            'Stopped to take a photo of some "authentic" graffiti.',
            'Debated whether that food truck was "too mainstream".',
            'Everyone is getting increasingly excited about Portland.',
            'The artisanal snacks are holding up well.'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    rest() {
        this.gameState.daysElapsed += 1;
        
        // Consume extra food for resting
        const foodConsumption = 3 * this.gameState.party.length;
        if (this.gameState.inventory.food >= foodConsumption) {
            this.gameState.inventory.food -= foodConsumption;
        }
        
        // Improve health
        this.gameState.party.forEach(member => {
            member.health = Math.min(CONSTANTS.MAX_HEALTH, member.health + 15);
            if (member.status === 'Sick' && member.health > 50) {
                member.status = 'Healthy';
            }
        });
        
        this.addLogEntry('Rested for a day. Everyone feels better!', 'success');
        this.updateTravel();
        this.updateHud();
        this.saveGameState();
    }

    hunt() {
        const success = Math.random() > 0.6; // 40% success rate
        
        if (success) {
            const foundFood = Math.floor(Math.random() * 20) + 5;
            this.gameState.inventory.food += foundFood;
            this.addLogEntry(`Successfully foraged ${foundFood} bags of... questionable berries.`, 'success');
        } else {
            this.addLogEntry('Foraging unsuccessful. Found only disappointment.', 'warning');
        }
        
        this.gameState.daysElapsed += 0.5;
        this.updateTravel();
        this.updateHud();
        this.saveGameState();
    }

    // Location System
    checkLocationArrival() {
        // Check if we've passed the next location
        const nextLocationIndex = this.gameState.currentLocationIndex + 1;
        if (nextLocationIndex < LOCATIONS.length) {
            const nextLocation = LOCATIONS[nextLocationIndex];
            if (this.gameState.distanceTraveled >= nextLocation.distanceFromStart) {
                this.gameState.currentLocationIndex = nextLocationIndex;
                this.showLocation();
            }
        }
    }

    showLocation() {
        const location = LOCATIONS[this.gameState.currentLocationIndex];
        
        // Display location image if available
        const locationImageContainer = document.getElementById('location-image');
        if (location.imageUrl) {
            locationImageContainer.innerHTML = `<img src="${location.imageUrl}" alt="${location.name}" />`;
        } else {
            locationImageContainer.innerHTML = '';
        }
        
        document.getElementById('location-name').textContent = location.name;
        document.getElementById('location-description').textContent = location.description;
        
        this.addLogEntry(`Arrived at ${location.name}`);
        this.showScreen('location');
    }

    departLocation() {
        this.addLogEntry('Continuing on the trail...');
        this.showScreen('travel');
        this.updateTravel();
    }

    restAtLocation() {
        this.rest();
    }

    huntAtLocation() {
        this.hunt();
    }

    visitShop() {
        this.showScreen('shop');
        this.updateShop(false);
    }

    talkToLocals() {
        const dialogues = [
            'A grizzled old timer mutters about "the good old days of dial-up".',
            'Someone tries to sell you a timeshare for a virtual reality cabin.',
            'You overhear heated debate about whether tabs or spaces are superior.',
            'A child asks if your van has "Fortnite installed". You sigh.',
            'Someone offers you "artisanal, gluten-free, locally sourced" trail mix for $25.',
            'A local explains the deep cultural significance of their food truck.',
            'Someone passionately describes their startup idea for disrupting disruption.',
            'You learn about seventeen different coffee brewing methods.'
        ];
        
        const randomDialogue = dialogues[Math.floor(Math.random() * dialogues.length)];
        this.addLogEntry(`Local: "${randomDialogue}"`);
    }

    // Event System
    triggerRandomEvent() {
        const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        this.showEvent(event);
    }

    showEvent(event) {
        this.gameState.currentEvent = event;
        
        // Display event image if available
        const eventImageContainer = document.getElementById('event-image');
        if (event.imageUrl) {
            eventImageContainer.innerHTML = `<img src="${event.imageUrl}" alt="${event.title}" />`;
        } else {
            eventImageContainer.innerHTML = '';
        }
        
        document.getElementById('event-title').textContent = event.title;
        document.getElementById('event-description').textContent = event.description;
        
        const choicesContainer = document.getElementById('event-choices');
        const continueButton = document.getElementById('event-continue');
        
        choicesContainer.innerHTML = '';
        continueButton.style.display = 'none';
        
        if (event.type === 'choice' && event.choices) {
            event.choices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.className = 'game-btn';
                button.textContent = choice.text;
                button.onclick = () => this.resolveEvent(choice.outcome);
                choicesContainer.appendChild(button);
            });
        } else {
            continueButton.style.display = 'block';
        }
        
        document.getElementById('event-modal').classList.add('active');
    }

    resolveEvent(outcomeFunction) {
        const message = outcomeFunction(this.gameState);
        this.addLogEntry(message);
        
        this.closeEvent();
        
        // Check for game over after event
        this.checkGameOverConditions();
        
        this.updateTravel();
        this.updateHud();
        this.saveGameState();
    }

    closeEvent() {
        if (this.gameState.currentEvent && this.gameState.currentEvent.type === 'auto') {
            const message = this.gameState.currentEvent.outcome(this.gameState);
            this.addLogEntry(message);
        }
        
        this.gameState.currentEvent = null;
        document.getElementById('event-modal').classList.remove('active');
    }

    // Game Over Conditions
    checkGameOverConditions() {
        // Check if all party members are dead
        const livingMembers = this.gameState.party.filter(member => member.health > 0);
        if (livingMembers.length === 0) {
            this.gameOver('All party members have died. Your journey to Portland ends here.');
            return;
        }

        // Check if stranded (no fuel and no money)
        if (this.gameState.inventory.fuel <= 0 && this.gameState.inventory.money < 60) {
            this.gameOver('You ran out of fuel and money. Stranded on the highway to Portland.');
            return;
        }

        // Check starvation
        if (this.gameState.inventory.food <= 0 && this.gameState.inventory.money < 25) {
            this.gameOver('Your party has starved. The hipster dream dies hungry.');
            return;
        }
    }

    gameOver(message) {
        this.gameState.gameOver = true;
        this.gameState.gameWon = false;
        
        document.getElementById('game-over-message').textContent = message;
        this.showFinalStats();
        this.showScreen('game-over');
        
        // Clear save game
        localStorage.removeItem('portlandTrailSaveGame');
    }

    gameWin() {
        this.gameState.gameOver = true;
        this.gameState.gameWon = true;
        
        // Show win image
        const gameOverImageContainer = document.getElementById('game-over-image');
        gameOverImageContainer.innerHTML = '<img src="images/static_game_over_win.jpeg" alt="Game Over - Victory" />';
        
        document.getElementById('game-over-ascii').innerHTML = `
 ██████╗ ██████╗ ███╗   ██╗ ██████╗ ██████╗  █████╗ ████████╗███████╗██╗
██╔════╝██╔═══██╗████╗  ██║██╔════╝ ██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║
██║     ██║   ██║██╔██╗ ██║██║  ███╗██████╔╝███████║   ██║   ███████╗██║
██║     ██║   ██║██║╚██╗██║██║   ██║██╔══██╗██╔══██║   ██║   ╚════██║╚═╝
╚██████╗╚██████╔╝██║ ╚████║╚██████╔╝██║  ██║██║  ██║   ██║   ███████║██╗
 ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ████ ╚═╝   ╚══════╝╚═╝`;
        
        document.getElementById('game-over-message').textContent = 
            'You made it to Portland! The dream of artisanal coffee and vintage vinyl is now reality. Welcome to hipster paradise!';
        
        this.showFinalStats();
        this.showScreen('game-over');
        
        // Clear save game
        localStorage.removeItem('portlandTrailSaveGame');
    }

    showFinalStats() {
        const livingMembers = this.gameState.party.filter(member => member.health > 0);
        const finalStats = document.getElementById('final-stats');
        
        finalStats.innerHTML = `
            <h3>Journey Statistics</h3>
            <div class="stat-row"><span>Distance Traveled:</span><span>${this.gameState.distanceTraveled} miles</span></div>
            <div class="stat-row"><span>Days on Trail:</span><span>${Math.floor(this.gameState.daysElapsed)}</span></div>
            <div class="stat-row"><span>Money Remaining:</span><span>$${this.gameState.inventory.money}</span></div>
            <div class="stat-row"><span>Survivors:</span><span>${livingMembers.length}/${this.gameState.party.length}</span></div>
            <div class="stat-row"><span>Profession:</span><span>${this.gameState.profession?.name || 'Unknown'}</span></div>
            <div class="stat-row"><span>Final Weather:</span><span>${this.gameState.weather}</span></div>
        `;
    }

    // Logging System
    addLogEntry(message, type = 'normal') {
        this.gameState.eventLog.push({
            day: Math.floor(this.gameState.daysElapsed),
            message: message,
            type: type
        });
        
        // Keep only last 20 entries
        if (this.gameState.eventLog.length > 20) {
            this.gameState.eventLog = this.gameState.eventLog.slice(-20);
        }
        
        this.updateEventLog();
    }

    updateEventLog() {
        const logContainer = document.getElementById('log-entries');
        if (!logContainer) return;
        
        logContainer.innerHTML = '';
        
        this.gameState.eventLog.slice(-10).forEach(entry => {
            const logDiv = document.createElement('div');
            logDiv.className = `log-entry ${entry.type}`;
            logDiv.textContent = `Day ${entry.day}: ${entry.message}`;
            logContainer.appendChild(logDiv);
        });
        
        logContainer.scrollTop = logContainer.scrollHeight;
    }
}

// Global Game Instance
let game;

// Global Functions (called from HTML)
function startNewGame() {
    game = new PortlandTrailGame();
    game.showScreen('setup');
}

function loadGame() {
    const saved = localStorage.getItem('portlandTrailSaveGame');
    if (saved) {
        game = new PortlandTrailGame();
        game.loadGameState();
        
        // Resume from saved phase
        if (game.gameState.phase === 'travel') {
            game.showScreen('travel');
            game.updateTravel();
        } else if (game.gameState.phase === 'location') {
            game.showLocation();
        } else {
            game.showScreen('travel');
            game.updateTravel();
        }
    } else {
        alert('No saved game found!');
    }
}

function showCredits() {
    alert('The Portland Trail\n\nA satirical homage to the classic Oregon Trail\nFeaturing hipster culture, tech industry absurdities, and artisanal suffering\n\nCreated with love (and excessive coffee) 2024');
}

// Profession Selection
document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers for profession cards
    document.querySelectorAll('.profession-card').forEach(card => {
        card.addEventListener('click', function() {
            const profession = this.dataset.profession;
            if (game) {
                game.selectProfession(profession);
            }
        });
    });
});

// Functions called from HTML
function confirmProfession() {
    if (game) game.confirmProfession();
}

function randomizeName(inputId) {
    if (game) game.randomizeName(inputId);
}

function startAdventure() {
    if (game) game.startAdventure();
}

function changeQuantity(itemId, change) {
    if (game) game.changeQuantity(itemId, change);
}

function completePurchase() {
    if (game) game.completePurchase();
}

function leaveShop() {
    if (game) game.leaveShop();
}

function travelDay() {
    if (game) game.travelDay();
}

function rest() {
    if (game) game.rest();
}

function hunt() {
    if (game) game.hunt();
}

function departLocation() {
    if (game) game.departLocation();
}

function restAtLocation() {
    if (game) game.restAtLocation();
}

function huntAtLocation() {
    if (game) game.huntAtLocation();
}

function visitShop() {
    if (game) game.visitShop();
}

function talkToLocals() {
    if (game) game.talkToLocals();
}

function closeEvent() {
    if (game) game.closeEvent();
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    game = new PortlandTrailGame();
});