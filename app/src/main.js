import { PROFESSIONS, ITEMS, LOCATIONS, EVENTS, PACES, RATIONS, DEFAULT_NAMES } from './data.js';
import { createGame, transition, serializeGame, deserializeGame } from './engine.js';

const SAVE_KEY = 'the-portland-trail:v1';
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const saveStatus = document.querySelector('#save-status');
const newJourneyHeader = document.querySelector('#new-journey-header');
const eventDialog = document.querySelector('#event-dialog');
const replaceDialog = document.querySelector('#replace-dialog');

const resourceLabels = {
  money: 'Cash', food: 'Food', fuel: 'Fuel', ammo: 'Seed bombs',
  parts: 'Repair supplies', kombucha: 'Kombucha', nft: 'NFTs',
};
const resourceIds = ['money', 'food', 'fuel', 'ammo', 'parts', 'kombucha', 'nft'];
const abilityLabels = {
  influencer: 'Run a collab', dev: 'Salvage parts',
  prepper: 'Scout for food', barista: 'Brew coffee',
};

let savedState = null;
let state = null;
let screen = 'title';
let selectedProfession = PROFESSIONS[0]?.id ?? null;
let flash = '';
let storageWarning = '';
let returnFocus = null;
let lastEventToken = null;
const shopQuantities = Object.fromEntries(ITEMS.map(item => [item.id, 1]));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function asset(path) {
  if (!path) return './assets/travel.jpg';
  return `./${String(path).replace(/^\.\/?/, '').replace(/^\//, '')}`;
}

function image(path, alt, className = '') {
  return `<img class="${className}" src="${escapeHtml(asset(path))}" alt="${escapeHtml(alt)}" loading="eager" />`;
}

function button(label, action, className = 'button button-quiet', extra = '') {
  return `<button type="button" class="${className}" data-action="${escapeHtml(action)}" ${extra}>${escapeHtml(label)}</button>`;
}

function setNotice(message, persistent = false) {
  if (persistent) storageWarning = message;
  else flash = message;
  const current = flash || storageWarning;
  notice.textContent = current;
  notice.hidden = !current;
  const dialogError = eventDialog.querySelector('.dialog-error');
  if (dialogError && eventDialog.open) {
    dialogError.textContent = message || '';
    dialogError.hidden = !message;
  }
}

function readSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const restored = deserializeGame(raw);
    if (!restored) {
      setNotice('This browser has an unreadable saved journey. You can start a new one; the old data has not been changed.', true);
      return null;
    }
    return restored;
  } catch {
    setNotice('Browser storage is unavailable. You can still play, but this journey may not resume after you leave.', true);
    return null;
  }
}

function saveGame() {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(state));
    savedState = state;
    storageWarning = '';
    saveStatus.textContent = 'Journey saved';
  } catch {
    saveStatus.textContent = 'Playing without a save';
    setNotice('Your browser could not save this journey. You can keep playing here, but progress may be lost when you close the tab.', true);
  }
}

function stateAction(action) {
  if (!state) return;
  const result = transition(state, action);
  if (result.error) {
    returnFocus = null;
    setNotice(result.error);
    return;
  }
  flash = '';
  state = result.state;
  saveGame();
  render();
}

function profession() {
  return PROFESSIONS.find(item => item.id === state?.profession);
}

function location() {
  return LOCATIONS.find(item => item.id === state?.locationId) ?? LOCATIONS[0];
}

function nextLocation() {
  return [...LOCATIONS].sort((a, b) => a.miles - b.miles).find(item => item.miles > state.distance);
}

function pendingEvent() {
  return EVENTS.find(item => item.id === state?.pendingEvent?.id);
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US');
}

function renderResource(id, compact = false) {
  const value = state.inventory?.[id] ?? 0;
  const label = resourceLabels[id];
  const icon = `<img src="./assets/resource-${id}.png" alt="" class="resource-icon" loading="eager" />`;
  return `<div class="resource ${compact ? 'resource-compact' : ''}" title="${escapeHtml(label)}: ${escapeHtml(value)}">${icon}<span class="resource-name">${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong></div>`;
}

function renderResources(compact = false) {
  return `<div class="resources ${compact ? 'resources-compact' : ''}" aria-label="Supplies">${resourceIds.map(id => renderResource(id, compact)).join('')}</div>`;
}

function renderParty() {
  return `<section class="party-section" aria-labelledby="party-heading">
    <div class="section-heading"><h2 id="party-heading">The crew</h2><span>${state.party.filter(member => member.status !== 'Deceased').length} traveling</span></div>
    <div class="party-list">${state.party.map(member => {
      const health = Math.max(0, Math.min(100, Number(member.health) || 0));
      return `<div class="traveler ${member.status === 'Deceased' ? 'traveler-deceased' : ''}">
        <div class="traveler-top"><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.status)}</span></div>
        <div class="health-track" role="meter" aria-label="${escapeHtml(member.name)} health" aria-valuenow="${health}" aria-valuemin="0" aria-valuemax="100"><span style="width:${health}%"></span></div>
      </div>`;
    }).join('')}</div>
  </section>`;
}

function renderMobileParty() {
  const living = state.party.filter(member => member.status !== 'Deceased').length;
  return `<section class="mobile-party" aria-labelledby="crew-glance-heading"><div class="section-heading"><h2 id="crew-glance-heading">The crew</h2><span>${living} traveling</span></div><div class="mobile-party-list">${state.party.map(member => {
    const health = Math.max(0, Math.min(100, Number(member.health) || 0));
    return `<div class="mobile-traveler ${member.status === 'Deceased' ? 'traveler-deceased' : ''}" title="${escapeHtml(member.name)}: ${escapeHtml(member.status)}, ${health} health"><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.status)}</span><div class="health-track" role="meter" aria-label="${escapeHtml(member.name)} health" aria-valuenow="${health}" aria-valuemin="0" aria-valuemax="100"><span style="width:${health}%"></span></div></div>`;
  }).join('')}</div></section>`;
}

function renderJournal() {
  const entries = [...(state.journal ?? [])].reverse().slice(0, 6);
  return `<section class="journal" aria-labelledby="journal-heading"><div class="section-heading"><h2 id="journal-heading">Road notes</h2><span>Latest first</span></div>
    <ol>${entries.length ? entries.map(entry => `<li><span>Day ${escapeHtml(entry.day)}</span><p>${escapeHtml(entry.text)}</p></li>`).join('') : '<li><p>The journal is still clean. Give it a day.</p></li>'}</ol>
  </section>`;
}

function renderTitle() {
  const resumeText = savedState?.phase === 'ended' ? 'View saved ending' : 'Resume journey';
  return `<section class="title-screen" id="top">
    <div class="title-art">${image('assets/title.jpg', 'A scruffy van stacked high for the long drive to Portland', 'title-image')}</div>
    <div class="title-copy"><p class="title-kicker">A road trip of dubious judgment</p>
      <h1>The Portland<br />Trail<span class="title-period">.</span></h1>
      <p class="title-deck">Five travelers. One overburdened van. A thousand miles of detours, bad decisions, and surprisingly expensive snacks.</p>
      <div class="title-actions">${button('Start a new journey', 'new', 'button button-primary button-large')}${savedState ? button(resumeText, 'resume', 'button button-outline button-large') : ''}</div>
      <p class="title-footnote">Every choice sticks. The road rarely does.</p>
    </div>
  </section>`;
}

function startingSupplies(inventory) {
  return ['money', 'food', 'fuel', 'ammo', 'parts', 'kombucha', 'nft']
    .filter(id => Number(inventory?.[id]) > 0)
    .map(id => `<span>${escapeHtml(resourceLabels[id])} <strong>${escapeHtml(inventory[id])}</strong></span>`).join('');
}

function renderProfessionSetup() {
  return `<section class="setup-screen" id="top"><div class="setup-head"><span class="step-mark">1 / 2</span><p class="overline">Before the wheels turn</p><h1>Who booked this trip?</h1><p>Pick your background. Your training may help. Your baggage definitely will.</p></div>
    <div class="profession-grid" role="radiogroup" aria-label="Choose a background">${PROFESSIONS.map((item, index) => {
      const selected = selectedProfession === item.id;
      return `<button type="button" class="profession-card ${selected ? 'is-selected' : ''}" role="radio" aria-checked="${selected}" data-profession="${escapeHtml(item.id)}" tabindex="${selected ? '0' : '-1'}">
        <span class="profession-card-top"><span class="profession-number">0${index + 1}</span><img src="./assets/portrait-${escapeHtml(item.id)}.png" alt="" class="profession-portrait" /></span>
        <strong>${escapeHtml(item.name)}</strong><span class="profession-description">${escapeHtml(item.description)}</span>
        <span class="profession-ability"><b>Specialty</b>${escapeHtml(item.ability)}</span>
        <span class="profession-start"><b>Starting kit</b>${startingSupplies(item.inventory)}</span>
      </button>`;
    }).join('')}</div>
    <div class="setup-footer">${button('Continue to the crew', 'names', 'button button-primary button-large')}</div>
  </section>`;
}

function renderNamesSetup() {
  return `<section class="setup-screen setup-names" id="top"><div class="setup-head"><span class="step-mark">2 / 2</span><p class="overline">Passenger manifest</p><h1>Name the five travelers.</h1><p>They will all fit in the van. Personal space is another matter.</p></div>
    <form id="names-form" class="names-form"><div class="name-fields">${DEFAULT_NAMES.map((name, index) => `<label class="name-field"><span>Traveler ${index + 1}</span><input name="traveler-${index}" type="text" value="${escapeHtml(name)}" maxlength="32" autocomplete="off" required /></label>`).join('')}</div>
      <div class="setup-footer"><button type="button" class="button button-quiet" data-action="back-professions">Back to backgrounds</button><button type="submit" class="button button-primary button-large">Pack the van</button></div>
    </form>
  </section>`;
}

function renderScene() {
  const place = location();
  const upcoming = nextLocation();
  const isEnded = state.phase === 'ended';
  const isShop = state.phase === 'shop';
  const isAtStart = isShop && place?.id === 'start_city' && state.distance === 0;
  let sceneImage = 'assets/travel.jpg';
  let heading = 'The open road';
  let description = upcoming ? `${formatNumber(Math.max(0, upcoming.miles - state.distance))} miles to ${upcoming.name}.` : 'Portland is on the horizon.';
  if (isEnded) {
    sceneImage = state.outcome === 'won' ? 'assets/victory.jpg' : 'assets/loss.jpg';
    heading = state.outcome === 'won' ? 'You made it to Portland.' : 'The road won this round.';
    description = state.outcome === 'won' ? 'Against the odds, the van and at least some of its passengers made the city.' : 'The journey ends here, but the story deserves one more telling.';
  } else if (state.phase === 'location') {
    sceneImage = place?.image || 'assets/landmark.jpg';
    heading = place?.name || 'A stop along the way';
    description = place?.description || '';
  } else if (isShop) {
    sceneImage = isAtStart ? 'assets/departure.jpg' : (place?.image || 'assets/rest-stop.jpg');
    heading = isAtStart ? 'Stock up before departure.' : `Supplies at ${place?.shortName || place?.name}`;
    description = isAtStart ? 'Every mile starts with the choices you make in the parking lot.' : 'Spend carefully. The next stop may be farther than it looks.';
  }
  const sceneAlt = isEnded ? 'Illustrated journey ending' : isShop ? 'Illustrated roadside supply stop' : state.phase === 'travel' ? 'A loaded van crossing the Pacific Northwest' : `Illustration of ${heading}`;
  return `<section class="scene-panel" aria-labelledby="scene-heading"><div class="scene-image-wrap">${image(sceneImage, sceneAlt, 'scene-image')}
      <div class="scene-image-vignette"></div><div class="scene-stamp"><span>THE PORTLAND TRAIL</span><b>${String(state.day).padStart(2, '0')} / ${String(Math.floor(state.distance)).padStart(4, '0')}</b></div></div>
    <div class="scene-body"><div class="scene-text"><p class="scene-overline">${isEnded ? 'Journey complete' : isShop ? 'Supply stop' : state.phase === 'location' ? 'You have arrived' : 'Day ' + escapeHtml(state.day) + ' on the road'}</p>
      <h1 id="scene-heading">${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></div>${renderPrimaryAction()}</div>
  </section>`;
}

function renderPrimaryAction() {
  if (state.phase === 'ended') return `<div class="primary-action">${button('Start another journey', 'new', 'button button-primary button-large')}</div>`;
  if (state.phase === 'shop') {
    const start = location()?.id === 'start_city' && state.distance === 0;
    return `<div class="primary-action">${button(start ? 'Leave for Portland' : 'Return to the road', start ? 'depart' : 'leaveShop', 'button button-primary button-large')}</div>`;
  }
  if (state.phase === 'location') return `<div class="primary-action">${button('Keep driving', 'depart', 'button button-primary button-large')}</div>`;
  const next = nextLocation();
  return `<div class="primary-action">${button(next ? `Drive toward ${next.shortName || next.name}` : 'Keep driving', 'travel', 'button button-primary button-large')}</div>`;
}

function renderTripStrip() {
  const next = nextLocation();
  const percent = Math.max(0, Math.min(100, state.distance / 10));
  return `<section class="trip-strip" aria-label="Trip progress"><div class="trip-numbers"><div><span>Distance</span><strong>${formatNumber(state.distance)} <small>/ 1,000 mi</small></strong></div><div><span>Day</span><strong>${formatNumber(state.day)}</strong></div><div><span>Next stop</span><strong>${escapeHtml(next?.shortName || next?.name || 'Portland')}</strong></div></div>
    <div class="route-track" role="progressbar" aria-valuemin="0" aria-valuemax="1000" aria-valuenow="${Math.floor(state.distance)}" aria-label="Miles traveled"><span style="width:${percent}%"></span></div>
    <div class="route-endpoints"><span>Departure</span><span>Portland</span></div></section>`;
}

function renderShop() {
  return `<section class="activity-panel" aria-labelledby="shop-heading"><div class="section-heading"><h2 id="shop-heading">Roadside supplies</h2><span>Cash: $${formatNumber(state.inventory.money)}</span></div>
    <p class="panel-intro">Buy what the van can carry. Prices are shown per unit.</p>
    <div class="shop-list">${ITEMS.map(item => {
      const quantity = shopQuantities[item.id] || 1;
      const total = Number(item.price) * quantity;
      const affordable = Number(state.inventory.money) >= total;
      return `<div class="shop-item"><div class="shop-item-copy"><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p><span>${escapeHtml(item.unit)} · ${escapeHtml(resourceLabels[item.id] || item.id)} owned: ${formatNumber(state.inventory[item.id])}</span></div>
        <div class="shop-item-controls"><label>Qty<select data-shop-quantity="${escapeHtml(item.id)}" aria-label="Quantity of ${escapeHtml(item.name)} to buy">${[1, 5, 10].map(count => `<option value="${count}" ${count === quantity ? 'selected' : ''}>${count}</option>`).join('')}</select></label>
        <button type="button" class="button button-shop" data-buy="${escapeHtml(item.id)}" ${affordable ? '' : 'disabled aria-describedby="shop-unaffordable"'}><b>$${formatNumber(total)}</b><span>${affordable ? 'Buy' : 'Need more cash'}</span></button></div></div>`;
    }).join('')}</div><p id="shop-unaffordable" class="visually-hidden">You do not have enough cash for this item.</p>
    ${Number(state.inventory.nft) > 0 ? `<div class="shop-trade"><p>Ready to unload that pixelated Sasquatch?</p><button type="button" class="button button-outline" data-use-item="nft">Sell one NFT for $50</button></div>` : ''}</section>`;
}

function renderRouteControls() {
  const paceOptions = Object.entries(PACES).map(([id, entry]) => `<option value="${escapeHtml(id)}" ${state.pace === id ? 'selected' : ''}>${escapeHtml(entry.name)} · ${escapeHtml(entry.miles)} mi / ${escapeHtml(entry.fuel)} fuel</option>`).join('');
  const rationOptions = Object.entries(RATIONS).map(([id, entry]) => `<option value="${escapeHtml(id)}" ${state.rations === id ? 'selected' : ''}>${escapeHtml(entry.name)} · ${escapeHtml(entry.food)} food / traveler</option>`).join('');
  return `<section class="activity-panel route-settings" aria-labelledby="settings-heading"><div class="section-heading"><h2 id="settings-heading">On the road</h2><span>${escapeHtml(state.weather || 'Weather unknown')}</span></div>
    <div class="setting-fields"><label><span>Driving pace</span><select id="pace-select" aria-label="Driving pace">${paceOptions}</select></label><label><span>Daily rations</span><select id="rations-select" aria-label="Daily rations">${rationOptions}</select></label></div>
    <p class="panel-intro">Pace spends fuel. Rations use food for each living traveler.</p></section>`;
}

function renderActions() {
  if (state.phase === 'shop' || state.phase === 'ended') return '';
  const activities = location()?.activities ?? [];
  const atLocation = state.phase === 'location';
  const can = name => !atLocation || activities.includes(name);
  const choiceButton = (label, action, explanation, available = true) => available ? `<div class="activity"><button type="button" class="button button-action" data-action="${action}">${escapeHtml(label)}</button><p>${escapeHtml(explanation)}</p></div>` : '';
  const availableItems = ITEMS.filter(item => ['kombucha', 'ammo'].includes(item.id) && Number(state.inventory[item.id]) > 0);
  const ability = profession();
  const cooldown = ability?.id === 'barista' ? 1 : 4;
  const daysUntilAbility = Math.max(0, cooldown - (state.day - Number(state.flags?.lastAbilityDay ?? -99)));
  const abilityBlocked = daysUntilAbility > 0 || (ability?.id === 'barista' && Number(state.inventory.food) < 1) || (ability?.id === 'influencer' && state.flags?.wifiDownDay === state.day);
  const abilityReason = daysUntilAbility > 0 ? `Ready in ${daysUntilAbility} ${daysUntilAbility === 1 ? 'day' : 'days'}.` : ability?.id === 'barista' && Number(state.inventory.food) < 1 ? 'Needs 1 food.' : ability?.id === 'influencer' && state.flags?.wifiDownDay === state.day ? 'Wi-Fi is out today.' : '';
  const canTalk = atLocation && can('talk') && !(state.flags?.talked ?? []).includes(state.locationId);
  return `<section class="activity-panel" aria-labelledby="actions-heading"><div class="section-heading"><h2 id="actions-heading">What now?</h2><span>Every choice has a cost</span></div>
    <div class="activity-grid">
      ${choiceButton('Rest', 'rest', 'Take a day to recover. The crew still needs supplies.', can('rest'))}
      ${choiceButton('Forage', 'forage', 'Search nearby. Time and energy are not free.', can('forage'))}
      ${choiceButton('Talk to locals', 'talk', 'Hear what this place offers. One conversation per stop.', canTalk)}
      ${choiceButton('Visit the shop', 'openShop', 'Top up supplies before the next stretch.', atLocation && can('shop'))}
      ${ability && can('ability') ? `<div class="activity"><button type="button" class="button button-action" data-action="ability" ${abilityBlocked ? 'disabled' : ''}>${escapeHtml(abilityLabels[ability.id] || 'Use your specialty')}</button><p>${escapeHtml(abilityBlocked ? abilityReason + ' ' + ability.ability : ability.ability)}</p></div>` : ''}
    </div>
    ${availableItems.length ? `<div class="item-actions"><h3>Use a supply</h3><div>${availableItems.map(item => `<button type="button" class="button button-item" data-use-item="${escapeHtml(item.id)}"><span>${escapeHtml(item.name)} <b>${formatNumber(state.inventory[item.id])}</b></span><small>${escapeHtml(item.description)}</small></button>`).join('')}</div></div>` : ''}
  </section>`;
}

function renderTrip() {
  const ending = state.phase === 'ended';
  return `<div class="game-screen" id="top"><div class="game-topline"><span>${escapeHtml(profession()?.name || 'The crew')} expedition</span><span>${ending ? 'Final record' : `${escapeHtml(state.weather || 'Road weather')} / Day ${formatNumber(state.day)}`}</span></div>
    <div class="game-layout"><div class="main-column">${renderScene()}${renderTripStrip()}${renderResources(true)}${renderMobileParty()}${state.phase === 'shop' ? renderShop() : ending ? renderEnding() : `${renderActions()}${renderRouteControls()}`}</div>
    <aside class="field-journal" aria-label="Field journal"><div class="journal-cover"><span class="journal-mark">✳</span><span>Field journal<br />No. ${String(state.day).padStart(3, '0')}</span></div>${renderResources()}${renderParty()}${renderJournal()}</aside></div></div>`;
}

function renderEnding() {
  const survivors = state.party.filter(member => member.status !== 'Deceased');
  return `<section class="ending-panel" aria-labelledby="ending-heading"><p class="overline">The final record</p><h2 id="ending-heading">${state.outcome === 'won' ? 'The city is yours.' : 'The trip is over.'}</h2>
    <div class="ending-stats"><div><strong>${formatNumber(state.distance)}</strong><span>miles traveled</span></div><div><strong>${formatNumber(state.day)}</strong><span>days on the road</span></div><div><strong>${survivors.length}</strong><span>survivors</span></div></div>
    <p>${survivors.length ? `Still standing: ${survivors.map(member => escapeHtml(member.name)).join(', ')}.` : 'No one survived the trip.'}</p></section>`;
}

function renderEventDialog() {
  const current = pendingEvent();
  if (!current || !state.pendingEvent) {
    if (eventDialog.open) eventDialog.close();
    lastEventToken = null;
    return;
  }
  const controls = current.type === 'choice'
    ? (current.choices ?? []).map(choice => {
      let needs = '';
      if (current.id === 'van_breakdown' && choice.id === 'repair') {
        const cost = state.profession === 'dev' ? 1 : 2;
        if (Number(state.inventory.parts) < cost) needs = `Need ${cost} repair ${cost === 1 ? 'supply' : 'supplies'}`;
      }
      if (current.id === 'nft_auction' && choice.id === 'invest' && Number(state.inventory.nft) < 1) needs = 'Need one NFT';
      return `<button type="button" class="button button-dialog" data-event-choice="${escapeHtml(choice.id)}" ${needs ? 'disabled' : ''}><span>${escapeHtml(choice.label)}</span>${needs ? `<small>${escapeHtml(needs)}</small>` : ''}</button>`;
    }).join('')
    : `<button type="button" class="button button-primary" data-event-choice="">${current.type === 'critical' ? 'Face what happens' : 'Continue'}</button>`;
  eventDialog.innerHTML = `${current.image ? `<div class="event-art">${image(current.image, `Illustration for ${current.title}`, 'event-image')}</div>` : '<div class="event-art event-art-text"><span>Weather alert</span><strong>☀</strong></div>'}
    <div class="dialog-inner"><p class="overline">${current.type === 'critical' ? 'Critical moment' : 'Road encounter'}</p><h2 id="event-title">${escapeHtml(current.title)}</h2><p>${escapeHtml(current.description)}</p><p class="dialog-error" role="alert" hidden></p><div class="dialog-actions">${controls}</div></div>`;
  if (!eventDialog.open) {
    eventDialog.showModal();
    lastEventToken = state.pendingEvent.token;
    eventDialog.querySelector('[data-event-choice]')?.focus();
  } else if (lastEventToken !== state.pendingEvent.token) {
    lastEventToken = state.pendingEvent.token;
    eventDialog.querySelector('[data-event-choice]')?.focus();
  }
}

function render() {
  app.innerHTML = screen === 'title' ? renderTitle() : screen === 'profession' ? renderProfessionSetup() : screen === 'names' ? renderNamesSetup() : state ? renderTrip() : renderTitle();
  newJourneyHeader.hidden = !state || screen !== 'game';
  if (!state) saveStatus.textContent = savedState ? 'Journey on file' : 'Local game';
  if (!flash && !storageWarning) setNotice('');
  if (screen === 'game') renderEventDialog();
  else if (eventDialog.open) eventDialog.close();
  if (returnFocus) {
    const target = returnFocus;
    returnFocus = null;
    if (!state?.pendingEvent) requestAnimationFrame(() => {
      const match = app.querySelector(target);
      const fallback = match?.dataset.buy ? app.querySelector(`[data-shop-quantity="${CSS.escape(match.dataset.buy)}"]`) : app.querySelector('.primary-action button');
      (match && !match.disabled ? match : fallback)?.focus();
    });
  }
}

function startNewJourney() {
  if (state || savedState) {
    replaceDialog.showModal();
    replaceDialog.querySelector('[data-confirm="cancel"]')?.focus();
  } else {
    screen = 'profession';
    render();
    app.focus();
  }
}

app.addEventListener('click', event => {
  const professionTarget = event.target.closest('[data-profession]');
  if (professionTarget) {
    selectedProfession = professionTarget.dataset.profession;
    render();
    app.querySelector(`[data-profession="${CSS.escape(selectedProfession)}"]`)?.focus();
    return;
  }
  const purchase = event.target.closest('[data-buy]');
  if (purchase && !purchase.disabled) {
    returnFocus = `[data-buy="${CSS.escape(purchase.dataset.buy)}"]`;
    return stateAction({ type: 'purchase', cart: { [purchase.dataset.buy]: shopQuantities[purchase.dataset.buy] || 1 } });
  }
  const useItem = event.target.closest('[data-use-item]');
  if (useItem) {
    returnFocus = `[data-use-item="${CSS.escape(useItem.dataset.useItem)}"]`;
    return stateAction({ type: 'useItem', itemId: useItem.dataset.useItem });
  }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  switch (target.dataset.action) {
    case 'new': startNewJourney(); break;
    case 'resume':
      if (savedState) { state = savedState; screen = 'game'; render(); app.focus(); }
      break;
    case 'names': screen = 'names'; render(); app.querySelector('input')?.focus(); break;
    case 'back-professions': screen = 'profession'; render(); app.focus(); break;
    default: {
      if (!state) return;
      const actionType = target.dataset.action;
      returnFocus = `[data-action="${CSS.escape(actionType)}"]`;
      stateAction({ type: actionType });
    }
  }
});

app.addEventListener('keydown', event => {
  const card = event.target.closest('[data-profession]');
  if (!card || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  const index = PROFESSIONS.findIndex(item => item.id === card.dataset.profession);
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
  selectedProfession = PROFESSIONS[(index + direction + PROFESSIONS.length) % PROFESSIONS.length].id;
  render();
  app.querySelector(`[data-profession="${CSS.escape(selectedProfession)}"]`)?.focus();
});

app.addEventListener('change', event => {
  if (event.target.matches('[data-shop-quantity]')) {
    const id = event.target.dataset.shopQuantity;
    const quantity = Number(event.target.value);
    if (![1, 5, 10].includes(quantity) || !ITEMS.some(item => item.id === id)) return;
    shopQuantities[id] = quantity;
    const item = ITEMS.find(entry => entry.id === id);
    const row = event.target.closest('.shop-item');
    const buy = row?.querySelector('[data-buy]');
    if (buy) {
      const affordable = Number(state.inventory.money) >= Number(item.price) * quantity;
      buy.disabled = !affordable;
      buy.querySelector('b').textContent = `$${formatNumber(Number(item.price) * quantity)}`;
      buy.querySelector('span').textContent = affordable ? 'Buy' : 'Need more cash';
      if (affordable) buy.removeAttribute('aria-describedby');
      else buy.setAttribute('aria-describedby', 'shop-unaffordable');
    }
    return;
  }
  if (event.target.id === 'pace-select') { returnFocus = '#pace-select'; stateAction({ type: 'setPace', pace: event.target.value }); }
  if (event.target.id === 'rations-select') { returnFocus = '#rations-select'; stateAction({ type: 'setRations', rations: event.target.value }); }
});

app.addEventListener('submit', event => {
  if (event.target.id !== 'names-form') return;
  event.preventDefault();
  const fields = [...event.target.querySelectorAll('input')];
  const names = fields.map((field, index) => field.value.trim().slice(0, 32) || DEFAULT_NAMES[index]);
  const professionId = selectedProfession || PROFESSIONS[0].id;
  try {
    state = createGame({ profession: professionId, names, seed: Date.now() >>> 0 });
    screen = 'game';
    flash = '';
    saveGame();
    render();
    app.focus();
  } catch {
    setNotice('The journey could not start. Check the traveler names and try again.');
  }
});

eventDialog.addEventListener('click', event => {
  const choice = event.target.closest('[data-event-choice]');
  if (!choice || !state?.pendingEvent) return;
  const action = { type: 'resolveEvent', token: state.pendingEvent.token };
  if (choice.dataset.eventChoice) action.choiceId = choice.dataset.eventChoice;
  returnFocus = '[data-action="travel"], [data-action="depart"], [data-action="new"]';
  stateAction(action);
});

eventDialog.addEventListener('cancel', event => event.preventDefault());
replaceDialog.addEventListener('click', event => {
  const choice = event.target.closest('[data-confirm]');
  if (!choice) return;
  replaceDialog.close();
  if (choice.dataset.confirm === 'replace') {
    state = null;
    screen = 'profession';
    selectedProfession = PROFESSIONS[0]?.id ?? null;
    ITEMS.forEach(item => { shopQuantities[item.id] = 1; });
    render();
    app.focus();
  }
});

newJourneyHeader.addEventListener('click', startNewJourney);

savedState = readSavedGame();
render();
