# The Portland Trail - A Satirical Oregon Trail Game

A modern, satirical take on the classic Oregon Trail game, themed around Portland hipster culture and millennial/Gen-Z experiences. This static web game captures the absurdity of modern urban migration with pixel art aesthetics and terminal-style UI.

## 🎮 Game Features

### Recently Updated (Latest Fixes)
- **Consistent Image Sizing**: All game images now maintain consistent sizing throughout the entire game
  - Title, travel, location, event, and game over screens all use 450px max height (350px min)
  - Event modal images use 400px max height for better fit
  - Mobile responsive sizes adjusted proportionally (320px/280px/240px)
- **Improved Spacing**: Enhanced spacing around all game elements
  - Consistent 20-30px margins around images
  - Section spacing increased to 40-50px for better visual separation
  - Screen padding increased for better content framing
- **Enhanced Image Display**: Main title image now displays larger and more prominently
- **Improved Typography**: Subtitle text reduced to be more proportional with the game interface
- **Fixed Van Direction**: Travel progress marker now shows a rightward-facing vehicle (🚙)
- **Corrected Location System**: Fixed distance tracking to use cumulative distance from start
- **Enhanced State Management**: Improved game state updates with proper HUD synchronization
- **Dynamic Weather System**: Weather now changes randomly during travel (20% chance)
- **Better Progress Display**: Travel screen now shows "from X to Y" location information

### Currently Implemented Features
- **Character Creation**: Choose from 4 satirical professions (Social Media Influencer, Gig Economy Developer, Doomsday Prepper, Artisanal Barista)
- **Resource Management**: Manage money, food (kale chips), fuel (bio-diesel), and specialty items (NFTs, kombucha)
- **Party System**: Travel with up to 5 party members with individual health tracking
- **Location-Based Travel**: Journey through 7 unique locations from "Your Shared Artist Co-op" to Portland
- **Random Events**: 10 satirical events with choice-based and automatic outcomes
- **Shopping System**: Buy supplies at various locations with dynamic pricing
- **Save/Load System**: Persistent game state using localStorage
- **Pixel Art Integration**: All events, locations, and screens feature custom pixel art
- **Responsive Design**: Works on desktop and mobile devices
- **Terminal Aesthetic**: Green-on-black retro styling with pixelated fonts

### Satirical Content Themes
- Portland hipster culture and stereotypes
- Social media and influencer economy
- NFT/crypto culture mockery
- Millennial/Gen-Z lifestyle satire
- Sustainable living parody
- Gig economy commentary

### Visual Assets Integration
- **Event Images**: Each random event displays contextual pixel art
- **Location Images**: Visual representation of each stop on the journey
- **Static Screens**: Start screen, travel screen, and game over screens
- **Win/Loss States**: Different images for victory vs. defeat

## 🗂️ File Structure

```
/
├── index.html              # Main game interface with all screens
├── css/
│   └── style.css          # Terminal aesthetic styling and responsive design
├── js/
│   ├── constants.js       # Game data (professions, items, locations, events)
│   └── game.js           # Core game logic and state management
└── images/
    ├── event_*.jpeg       # Event-specific pixel art (10 files)
    ├── location_*.jpeg    # Location-specific images (7 files)
    └── static_*.jpeg      # Static screen backgrounds (3 files)
```

## 🎯 Game Mechanics

### Resource Management
- **Money**: Used for purchasing supplies and making choices
- **Food**: Consumed daily based on rations setting (bare/meager/filling)
- **Fuel**: Consumed daily based on travel pace (slow/normal/fast)
- **Special Items**: NFTs, kombucha, spare parts with unique uses

### Travel System
- **Pace Control**: Affects fuel consumption and random event frequency
- **Rations Control**: Affects food consumption and party health
- **Weather System**: Dynamic weather affects travel conditions
- **Distance Tracking**: 1000 miles total journey with location milestones

### Event System
- **Random Encounters**: 10% chance per travel day
- **Choice Events**: Player decisions affect outcomes
- **Automatic Events**: Immediate consequences
- **Critical Events**: Can end the game (pandemic, total party death)

### Health & Survival
- **Party Health**: Individual tracking for all 5 members
- **Status Effects**: Sick, injured, or deceased states
- **Game Over Conditions**: All party dead, no fuel/money, starvation

## 🖼️ Image Assets

### Event Images (10)
- `event_tiktok_distraction.jpeg` - Social media addiction event
- `event_nft_auction.jpeg` - NFT investment opportunity
- `event_van_breakdown.jpeg` - Vehicle repair scenario
- `event_good_weather.jpeg` - Favorable travel conditions
- `event_bad_weather.jpeg` - Climate change heatwave
- `event_found_supplies.jpeg` - Free box discovery & food poisoning
- `event_starlink_disruption.jpeg` - Internet outage
- `event_covid_death.jpeg` - Pandemic game over
- `event_van_breakdown.jpeg` - Transportation failure
- Various other satirical encounters

### Location Images (7)
- `location_start_city.jpeg` - Parents' guest room departure
- `location_first_stop.jpeg` - Highway rest stop
- `location_sketchy_motel.jpeg` - Ironic roadside motel
- `location_viral_landmark.jpeg` - Instagram-famous attraction
- `location_crypto_bro_meetup.jpeg` - Gas station DeFi meetup
- `location_food_truck_fest.jpeg` - Artisanal food cart pod
- `location_final_destination.jpeg` - Portland arrival

### Static Screens (3)
- `static_start_screen.jpeg` - Game title and introduction
- `static_travel_screen.jpeg` - Journey background
- `static_game_over_win.jpeg` - Victory screen
- `static_game_over_loss.jpeg` - Defeat screen

## 🚀 How to Play

1. **Start**: Click "Begin Your Hipster Odyssey"
2. **Setup**: Choose profession and allocate starting resources
3. **Character Creation**: Name your 5 party members
4. **Travel**: Set pace and rations, then travel between locations
5. **Events**: Make choices during random encounters
6. **Shopping**: Buy supplies at various stops
7. **Survive**: Reach Portland with at least one party member alive

## 🎨 Technical Features

### Frontend Technologies
- **HTML5**: Semantic structure with screen-based navigation
- **CSS3**: Advanced styling with CSS Grid, Flexbox, and animations
- **Vanilla JavaScript**: ES6+ features, modular architecture
- **LocalStorage**: Persistent save/load functionality

### Responsive Design
- Mobile-first approach
- Flexible grid layouts
- Scalable typography and images
- Touch-friendly button sizing

### Performance Features
- Efficient image rendering with `image-rendering: pixelated`
- Lazy loading considerations for large pixel art assets
- Minimal dependencies (no external libraries)

## 🎯 Game Balance

### Profession Balance
- **Influencer**: High money, low practical skills, Wi-Fi dependency
- **Developer**: Moderate resources, repair bonuses, NFT starter
- **Prepper**: High food/fuel, foraging bonuses, quality complaints
- **Barista**: Balanced stats, daily morale boost ability

### Difficulty Scaling
- Resource scarcity increases with distance
- Event frequency adjustable via pace settings
- Multiple win/loss conditions create varied outcomes

## 🔮 Future Enhancement Ideas

### Potential Features Not Yet Implemented
- **Multiplayer Support**: Shared party management
- **Achievement System**: Portland culture milestone tracking
- **Extended Storylines**: Multiple ending paths
- **Mini-Games**: Coffee brewing, urban foraging challenges
- **Social Media Integration**: Share journey progress
- **Audio System**: Chiptune soundtrack and sound effects
- **Inventory Expansion**: More satirical items and interactions
- **Weather System Enhancement**: Seasonal and climate effects

### Technical Improvements
- **Performance Optimization**: Image compression and caching
- **Accessibility Features**: Screen reader support, keyboard navigation
- **Progressive Web App**: Offline functionality, app-like experience
- **Analytics Integration**: Player behavior tracking
- **Localization**: Multiple language support

## 🌐 Deployment

To deploy this static website:

1. **Local Testing**: Open `index.html` in any modern web browser
2. **Web Hosting**: Upload all files to any static hosting service
3. **CDN Integration**: Consider CDN for image asset delivery
4. **HTTPS**: Ensure secure connections for localStorage functionality

### Recommended Hosting Platforms
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
- Traditional web hosting

## 🎨 Design Philosophy

This game combines:
- **Nostalgic Gameplay**: Classic Oregon Trail mechanics
- **Modern Commentary**: Satirical take on contemporary culture
- **Retro Aesthetics**: Terminal-style UI with pixel art
- **Accessibility**: Simple controls, clear visual hierarchy
- **Humor**: Self-aware comedy throughout the experience

The Portland Trail successfully bridges the gap between classic gaming nostalgia and modern cultural satire, creating an engaging experience that both entertains and comments on contemporary urban life.

## 📝 Credits

- **Original Concept**: Based on the classic Oregon Trail educational game
- **Satirical Adaptation**: Portland hipster culture interpretation
- **Pixel Art**: Custom illustrations for all game events and locations
- **Development**: Static web implementation with modern standards
- **Cultural References**: Portland, millennial, and Gen-Z lifestyle elements

---

*"The dream of the 90s is alive in Portland... if you can afford the rent!"*