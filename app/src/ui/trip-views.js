// The journey screen: a fixed shell of regions (spec 9.1) and one function per region. Each function turns the
// model the controller assembled from the engine into HTML. Nothing here decides a rule: labels, details,
// reasons, numbers and the ending text all come from the engine's read-only functions.

import { SUPPLY_IDS, escapeHtml, formatNumber, idFor, optionButton, picture, signed, supplyLabel } from './views.js';

/**
 * @typedef {Object} TripModel
 * @property {object} state                 the journey as it is drawn (before the action during a drive)
 * @property {boolean} playing              true while the drive plays
 * @property {object[]} options             availableActions(state)
 * @property {object | null} forecast       forecast(state); null after the end
 * @property {object | null} summary        summarize(state) once the journey has ended
 * @property {object | null} shop           the shop's rows, plan and Auto-buy, in phase shop
 * @property {object[]} paces               paceOptions(state)
 * @property {object[]} rations             rationOptions(state)
 * @property {string[]} notes               the journal lines of the latest action
 * @property {object | null} lastLeg        the receipt of the last drive
 * @property {boolean} routeOpen            whether the list of stops is open
 * @property {{ resources: string[], party: string[], atmosphere: boolean }} cue   what just changed
 * @property {string} professionName
 * @property {string} weather               weatherName(state)
 * @property {object | null} stop           currentStop(state)
 * @property {object | undefined} next      nextStop(state.distance)
 * @property {object} region                regionAt(state.distance)
 * @property {{ id: string, name: string, health: number, status: object, band: string, epitaph: string }[]} crew
 * @property {{ id: string, name: string, shortName: string, miles: number, kind: string }[]} stops
 * @property {number} goal                  the miles to Portland
 * @property {{ score: number, rank: string, professionName: string, day: number, survivors: number,
 *   current: boolean }[]} records         the best journeys to show at the end, best first
 * @property {boolean} canShare             whether the browser offers to share
 */

/** The shell. The latest-notes region is a polite live region; the regions themselves never move. */
export const TRIP_SHELL = `<div class="game-screen" id="top">
  <div class="game-topline" data-region="topline"></div>
  <div class="game-layout">
    <div class="game-main game-upper">
      <div data-region="scene"></div>
      <div class="latest-notes" data-region="notes" aria-live="polite"></div>
      <div data-region="route"></div>
      <div data-region="leg"></div>
    </div>
    <aside class="game-side" aria-label="Supplies and crew">
      <div data-region="supplies"></div>
      <div data-region="crew"></div>
    </aside>
    <div class="game-main game-lower">
      <div data-region="actions"></div>
      <div data-region="settings"></div>
      <div data-region="journal"></div>
    </div>
  </div>
</div>`;

/** Every region's HTML for this model. */
export function tripRegions(model) {
  return {
    topline: topline(model),
    scene: scene(model),
    notes: notes(model),
    route: route(model),
    leg: leg(model),
    supplies: supplies(model),
    crew: crew(model),
    actions: actions(model),
    settings: settings(model),
    journal: journal(model),
  };
}

const ended = model => model.state.phase === 'ended' && !model.playing;

/**
 * The scene a journey shows: the ending's art, the stop's art, or the road's.
 * @param {{ phase: string, outcome: string | null }} state
 * @param {{ scene: string } | null} stop     currentStop(state)
 * @param {{ scene: string }} region           regionAt(state.distance)
 */
export function sceneIdOf(state, stop, region) {
  if (state.phase === 'ended') return state.outcome === 'won' ? 'victory' : 'loss';
  return stop ? stop.scene : region.scene;
}

const STOP_KINDS = { shop: 'Supplies', rest: 'Rest stop', explore: 'Explore', destination: 'Destination' };
const pad = (value, length) => String(Math.floor(value)).padStart(length, '0');

// --- Top line --------------------------------------------------------------------------------------------

function topline(model) {
  const { state } = model;
  const right = ended(model) ? 'Final record' : `${escapeHtml(model.weather)} · Day ${formatNumber(state.day)}`;
  return `<span>${escapeHtml(model.professionName)} expedition</span><span>${right}</span>`;
}

// --- Scene -----------------------------------------------------------------------------------------------

// Stops whose scene stirs briefly after an arrival or an activity there.
const ATMOSPHERE = {
  mushroom_market: 'leaves',
  first_stop: 'leaves',
  river_ferry: 'rain',
  forest_camp: 'embers',
  food_truck_fest: 'steam',
  bookshop: 'rain',
};

/** A section heading with its small note on the right. */
function heading(id, title, aside = '') {
  return `<div class="section-heading"><h2 id="${id}">${title}</h2>${aside ? `<span>${aside}</span>` : ''}</div>`;
}

function roadStage(model) {
  const { state, region } = model;
  const light = ['morning', 'daylight', 'dusk'][(state.day - 1) % 3];
  const weather = { drizzle: 'rain', heat: 'heat' }[state.weather.id] ?? 'clear';
  const sign = model.playing ? 'Rolling on' : region.name;
  const counter = model.playing ? '+0 mi' : escapeHtml(model.weather);
  const classes = `road-stage region-${escapeHtml(region.id)} light-${light} weather-${weather}`;
  const label = `${escapeHtml(region.name)}, ${escapeHtml(model.weather)}`;
  return `<div class="${classes}${model.playing ? ' is-driving' : ''}" aria-label="${label}">
    ${picture(sceneIdOf(state, null, region), '', 'road-backdrop')}
    <div class="road-clouds" aria-hidden="true"></div>
    <div class="road-light"></div>
    <div class="road-mist"></div>
    <div class="road-surface"><div class="road-stripes"></div></div>
    <div class="road-verge"></div>
    <div class="road-rain"></div>
    <div class="road-dust" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="road-speed-lines" aria-hidden="true"></div>
    <div class="road-van">
      <img class="van-cutout" src="./assets/sprites/van.png" alt="Your loaded van on the road" />
      <span class="van-shadow"></span>
    </div>
    <div class="road-sign"><span>${escapeHtml(sign)}</span><strong data-drive-distance>${counter}</strong></div>
  </div>`;
}

function atmosphere(model) {
  const kind = model.stop ? ATMOSPHERE[model.stop.id] : null;
  if (!kind) return '';
  const spans = Array.from({ length: 6 }, (_, index) => `<span style="--i:${index}"></span>`).join('');
  const active = model.cue.atmosphere ? ' is-active' : '';
  return `<div class="scene-atmosphere atmosphere-${kind}${active}" aria-hidden="true">${spans}</div>`;
}

/** The art, overline, heading and text for the phase. */
function sceneText(model) {
  const { state, stop, summary } = model;
  if (model.playing) {
    return {
      overline: `Day ${formatNumber(state.day)} on the road`,
      heading: 'Making a little progress.',
      text: 'The scenery changes. The snack situation deteriorates.',
    };
  }
  if (ended(model)) {
    const won = summary.outcome === 'won';
    return {
      art: sceneIdOf(state, stop, model.region),
      alt: won ? 'The van rolls into Portland' : 'The end of the road',
      overline: won ? 'Journey complete' : 'Journey over',
      heading: summary.heading,
      text: summary.line,
    };
  }
  if (state.phase === 'shop') {
    const start = state.distance === 0;
    return {
      art: sceneIdOf(state, stop, model.region),
      alt: start ? 'The van loaded outside the co-op' : `The shop at ${stop.name}`,
      overline: 'Supply stop',
      heading: start ? 'Stock up before departure.' : `Supplies at ${stop.shortName}`,
      text: start
        ? 'Every mile starts with the choices you make in the parking lot.'
        : 'Spend carefully. The next stop may be farther than it looks.',
    };
  }
  if (state.phase === 'location') {
    return {
      art: sceneIdOf(state, stop, model.region),
      alt: stop.name,
      overline: 'You have arrived',
      heading: stop.name,
      text: stop.description,
    };
  }
  const ahead = model.forecast?.nextStop;
  return {
    overline: `Day ${formatNumber(state.day)} on the road`,
    heading: model.region.name,
    text: ahead ? `${formatNumber(ahead.away)} miles to ${ahead.name}.` : 'Portland is on the horizon.',
  };
}

/** Under the primary action: why it is blocked, and what driving now would do (F3). */
function forecastView(model, primary) {
  const { forecast } = model;
  if (!forecast || model.playing) return '';
  const reason =
    primary && !primary.enabled
      ? `<p class="primary-reason" id="primary-reason">${escapeHtml(primary.reason)}</p>`
      : '';
  const shop = forecast.nextShop;
  const today = forecast.today;
  const rows = [
    [
      'Today',
      `${formatNumber(today.miles)} mi · ${signed(-today.fuel)} fuel · ${signed(forecast.healthPerDay)} health each`,
    ],
    ['Range', `${formatNumber(forecast.range)} mi on ${formatNumber(model.state.inventory.fuel)} fuel`],
    ['Next fuel', shop ? `${shop.shortName}, ${formatNumber(shop.away)} mi` : 'No shop before Portland'],
  ];
  const short = forecast.shortfall.fuel;
  const warning =
    short > 0
      ? `<p class="forecast-warning">Short ${formatNumber(short)} fuel to reach ${escapeHtml(
          shop?.shortName ?? 'Portland',
        )}.</p>`
      : '';
  const list = rows.map(([term, value]) => `<div><dt>${term}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  return `${reason}<dl class="forecast" aria-label="Forecast">${list}</dl>${warning}`;
}

const AUTO_BUY_NOTES = {
  tight: 'Cash is tight. This buys what you can afford, starting with fuel and food. You may still need more supplies.',
  broke: 'There is not enough cash for a useful top-up. Sell an NFT if you have one, or review your pace and supplies.',
};

function autoBuy(model) {
  const { plan, autoBuy: button } = model.shop;
  const entries = Object.entries(plan.cart).filter(([, quantity]) => quantity > 0);
  const hasOrder = entries.length > 0;
  const title = !hasOrder && plan.complete ? 'The essentials are packed.' : 'Let the van do the math.';
  const items = entries
    .map(
      ([id, quantity]) =>
        `<li><strong>+${formatNumber(quantity)}</strong> ${escapeHtml(supplyLabel(id).toLowerCase())}</li>`,
    )
    .join('');
  const cart = hasOrder ? `<ul class="auto-buy-cart">${items}</ul>` : '';
  const dayWord = plan.travelDays === 1 ? 'day' : 'days';
  const destination = escapeHtml(plan.nextShopName ?? 'Portland');
  const days = `${formatNumber(plan.travelDays)} driving ${dayWord} to ${destination}.`;
  let note = hasOrder ? AUTO_BUY_NOTES.tight : AUTO_BUY_NOTES.broke;
  if (plan.complete) {
    note = `Your current supplies ${hasOrder ? 'plus this top-up cover' : 'cover'} the recommended loadout. ${days}`;
  }
  const label = hasOrder ? 'Auto-buy essentials' : plan.complete ? 'Essentials packed' : 'Not enough cash';
  const option = { key: 'autoPurchase', label, enabled: button.enabled, describedBy: 'auto-buy-note' };
  return `<section class="auto-buy-preview" aria-labelledby="auto-buy-heading">
    <div class="auto-buy-heading"><img src="./assets/sprites/resource-parts.png" alt="" /><div>
      <h2 id="auto-buy-heading">${title}</h2>
      <p>Food and fuel to ${destination}, plus a buffer, repairs and kombucha when cash allows.</p>
    </div></div>
    ${cart}<p class="auto-buy-note" id="auto-buy-note">${note}</p>
    <div class="auto-buy-footer">
      <div class="auto-buy-cost" data-auto-buy-cost="${plan.cost}">
        <strong>$${formatNumber(plan.cost)}</strong><span>$${formatNumber(plan.remainingCash)} left after buying</span>
      </div>
      ${optionButton(option, 'button button-outline')}
    </div>
  </section>`;
}

function scene(model) {
  const { state } = model;
  const onRoad = model.playing || state.phase === 'travel';
  const text = sceneText(model);
  const art = onRoad ? roadStage(model) : picture(text.art, text.alt, 'scene-image');
  const primary = model.options.find(option => option.group === 'primary');
  const large = 'button button-primary button-large';
  let action = '';
  if (model.playing) action = optionButton({ key: 'travel', label: 'On the road…', enabled: false }, large);
  else if (primary)
    action = optionButton(primary.enabled ? primary : { ...primary, describedBy: 'primary-reason' }, large);
  const phaseClass = model.playing ? 'travel' : state.phase;
  const stirring = !onRoad && state.phase === 'location' ? atmosphere(model) : '';
  const stamp = `${pad(state.day, 2)} / ${pad(state.distance, 4)}`;
  const panel = `scene-panel scene-${phaseClass}${onRoad ? ' scene-on-road' : ''}`;
  return `<section class="${panel}" aria-labelledby="scene-heading">
    <div class="scene-image-wrap">${art}${stirring}
      <div class="scene-image-vignette"></div>
      <div class="scene-stamp"><span>THE PORTLAND TRAIL</span><b>${stamp}</b></div>
    </div>
    <div class="scene-body">
      <div class="scene-text">
        <p class="scene-overline">${escapeHtml(text.overline)}</p>
        <h1 id="scene-heading">${escapeHtml(text.heading)}</h1>
        <p>${escapeHtml(text.text)}</p>
      </div>
      ${action ? `<div class="primary-action">${action}${forecastView(model, primary)}</div>` : ''}
    </div>
    ${state.phase === 'shop' && !model.playing ? autoBuy(model) : ''}
  </section>`;
}

// --- Latest notes ----------------------------------------------------------------------------------------

function notes(model) {
  const lines = model.notes.length ? model.notes : ['The journal is still clean. Give it a day.'];
  const items = lines.map(line => `<li>${escapeHtml(line)}</li>`).join('');
  return `<h2 class="visually-hidden">Latest notes</h2><ol class="latest-list">${items}</ol>`;
}

// --- Route -----------------------------------------------------------------------------------------------

// A shop on the map: a small symbol with its words for anyone who cannot see it.
const SHOP_MARK = '<span class="route-shop" role="img" aria-label="supplies">$</span>';
// The van on the route map, thirteen by seven pixels drawn at twice the size: luggage, body, windows, wheels.
const MAP_VAN = `<svg viewBox="0 0 13 7" width="26" height="14" shape-rendering="crispEdges" aria-hidden="true">
  <rect class="map-van-load" x="2" y="0" width="7" height="1" /><rect x="1" y="1" width="10" height="4" />
  <rect x="11" y="2" width="1" height="3" />
  <rect class="map-van-glass" x="2" y="2" width="2" height="1" />
  <rect class="map-van-glass" x="5" y="2" width="2" height="1" />
  <rect class="map-van-glass" x="8" y="2" width="3" height="1" />
  <rect class="map-van-wheel" x="2" y="5" width="2" height="2" />
  <rect class="map-van-wheel" x="8" y="5" width="2" height="2" />
</svg>`;

/** The stops just behind, at and ahead of the van, for the phone's three labels. */
function nearStops(stops) {
  const current = stops.find(stop => stop.current);
  const behind = stops.filter(stop => stop.passed && !stop.current).at(-1);
  const ahead = stops.find(stop => !stop.passed && !stop.current);
  return { behind, current, ahead };
}

function nearLabel(where, stop, fallback) {
  if (!stop) return `<span data-near="${where}">${fallback}</span>`;
  const shop = stop.kind === 'shop' ? '<span class="route-shop">$</span> ' : '';
  return `<span data-near="${where}"><b>${escapeHtml(stop.shortName)}</b>
    <small>${shop}${formatNumber(stop.miles)} mi</small></span>`;
}

/** The third number: the next stop, or where the journey ended once it is over. */
function endOrNext(model) {
  if (!ended(model)) {
    return `<div><span>Next stop</span><strong>${escapeHtml(model.next?.shortName ?? 'Portland')}</strong></div>`;
  }
  const where = model.summary.outcome === 'won' ? 'Portland' : `Mile ${formatNumber(model.state.distance)}`;
  return `<div><span>Ended at</span><strong>${where}</strong></div>`;
}

function route(model) {
  const { state, stops, goal } = model;
  const mile = state.distance;
  const at = miles => `${Math.max(0, Math.min(100, (miles / goal) * 100))}%`;
  const { behind, current, ahead } = nearStops(stops);
  const points = stops
    .map((stop, index) => {
      let where = stop.passed ? ' is-passed' : '';
      if (stop === current) where = ' is-current';
      else if (stop === behind) where += ' is-behind';
      else if (stop === ahead) where += ' is-ahead';
      const lane = index % 2 ? ' lane-low' : ' lane-high';
      const shop = stop.kind === 'shop' ? SHOP_MARK : '';
      return `<li class="route-point kind-${stop.kind}${where}${lane}" data-stop="${escapeHtml(stop.id)}"
        style="--at:${at(stop.miles)}"><span class="route-tick"></span>${shop}<span class="route-label"
        >${escapeHtml(stop.shortName)}<span class="visually-hidden">, mile ${formatNumber(stop.miles)}</span></span
        ></li>`;
    })
    .join('');
  const near = `<div class="route-near" aria-hidden="true">${nearLabel('prev', behind, '')}${nearLabel(
    'current',
    current,
    '<b>On the road</b>',
  )}${nearLabel('next', ahead, '')}</div>`;
  const list = stops
    .map(stop => {
      const where = stop.passed ? ' is-passed' : stop.current ? ' is-current' : '';
      return `<li class="route-stop${where}"><span>${formatNumber(stop.miles)} mi</span>
        <strong>${escapeHtml(stop.shortName)}</strong><small>${STOP_KINDS[stop.kind]}</small></li>`;
    })
    .join('');
  const open = model.routeOpen ? ' open' : '';
  const track = `role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${mile}"`;
  return `<section class="trip-strip" aria-label="Trip progress" data-mile="${mile}">
    <div class="trip-numbers">
      <div><span>Distance</span>
        <strong><b data-trip-distance>${formatNumber(mile)}</b> <small>/ ${formatNumber(goal)} mi</small></strong></div>
      <div><span>Day</span><strong>${formatNumber(state.day)}</strong></div>
      ${endOrNext(model)}
    </div>
    <div class="route-map">
      <div class="route-track" ${track} aria-label="Miles traveled">
        <span data-trip-progress style="width:${at(mile)}"></span></div>
      <ol class="route-points" aria-label="Stops on the map">${points}</ol>
      <span class="route-van" data-route-van style="left:${at(mile)}">${MAP_VAN}</span>
    </div>
    ${near}
    <details class="route-details"${open}>
      <summary data-key="route-list">${stops.length - 2} places along the way</summary><ol>${list}</ol>
    </details>
  </section>`;
}

// --- Last leg --------------------------------------------------------------------------------------------

function leg(model) {
  const { lastLeg } = model;
  if (!lastLeg || model.playing || model.state.phase === 'shop') return '';
  const miles = lastLeg.toDistance - lastLeg.fromDistance;
  // A receipt without miles (saved before the fatal-push fix) is not a stretch of road.
  if (miles <= 0) return '';
  const title = lastLeg.arrived ? `Arrived at ${escapeHtml(lastLeg.arrived)}` : 'Another stretch behind you.';
  return `<section class="last-leg" aria-labelledby="last-leg-heading">
    <div class="last-leg-heading"><h2 id="last-leg-heading">${title}</h2>
      <span>Day ${formatNumber(lastLeg.fromDay)} → ${formatNumber(lastLeg.toDay)}</span></div>
    <div class="leg-receipt"><strong>+${formatNumber(miles)} mi</strong>
      <span>−${formatNumber(lastLeg.fuelUsed)} fuel</span><span>−${formatNumber(lastLeg.foodUsed)} food</span>
      <span>Mile ${formatNumber(lastLeg.toDistance)}</span></div>
  </section>`;
}

// --- Supplies and crew -----------------------------------------------------------------------------------

function supplies(model) {
  const { inventory } = model.state;
  const rows = SUPPLY_IDS.map(id => {
    const changed = model.cue.resources.includes(id) ? ' resource-changed' : '';
    // Food is eaten in fractions; the list shows the whole servings left. The engine keeps the exact amount.
    const amount = id === 'food' ? Math.floor(inventory[id]) : inventory[id];
    const value = id === 'money' ? `$${formatNumber(amount)}` : formatNumber(amount);
    return `<li class="resource${changed}" data-resource="${id}">
      <img src="./assets/sprites/resource-${id}.png" alt="" class="resource-icon" />
      <span class="resource-name">${escapeHtml(supplyLabel(id))}</span><strong>${value}</strong></li>`;
  }).join('');
  return `<section class="supplies-section" aria-labelledby="supplies-heading">
    ${heading('supplies-heading', 'Supplies')}
    <ul class="resources" data-list="supplies">${rows}</ul></section>`;
}

function crew(model) {
  const living = model.crew.filter(member => member.status.id !== 'dead').length;
  const rows = model.crew
    .map(member => {
      const changed = model.cue.party.includes(member.id) ? ' health-changed' : '';
      const dead = member.status.id === 'dead';
      const name = escapeHtml(member.name);
      const words = dead && member.epitaph ? escapeHtml(member.epitaph) : '';
      const epitaph = words ? `<p class="traveler-epitaph">“${words}”</p>` : '';
      const meter = `role="meter" aria-label="${name} health" aria-valuenow="${member.health}"`;
      return `<li class="traveler${dead ? ' traveler-deceased' : ''}${changed}" data-member="${escapeHtml(member.id)}">
        <div class="traveler-top"><strong>${name}</strong><span>${escapeHtml(member.status.label)}</span></div>
        <div class="health" data-band="${member.band}">
          <div class="health-track" ${meter} aria-valuemin="0" aria-valuemax="100">
            <span style="width:${member.health}%"></span></div><b>${member.health}</b>
        </div>${epitaph}
      </li>`;
    })
    .join('');
  return `<section class="party-section" aria-labelledby="party-heading">
    ${heading('party-heading', 'The crew', `${living} traveling`)}
    <ul class="party-list" data-list="crew">${rows}</ul></section>`;
}

// --- Actions, shop and ending ----------------------------------------------------------------------------

/** One action option with its detail, or its reason when it is blocked. */
function activity(option) {
  const id = `detail-${idFor(option.key)}`;
  const note = option.enabled ? option.detail : option.reason;
  const button = optionButton({ ...option, describedBy: note ? id : '' }, 'button button-action');
  const text = note ? `<p id="${id}"${option.enabled ? '' : ' class="activity-reason"'}>${escapeHtml(note)}</p>` : '';
  return `<div class="activity">${button}${text}</div>`;
}

const GROUPS = [
  { groups: ['activity', 'ability'], title: '', className: 'activity-grid' },
  { groups: ['item'], title: 'Use a supply', className: 'activity-grid item-grid' },
  { groups: ['lastResort'], title: 'Last resorts', className: 'activity-grid last-resorts' },
];

function grouped(options) {
  return GROUPS.map(({ groups, title, className }) => {
    const list = options.filter(option => groups.includes(option.group));
    if (!list.length) return '';
    const head = title ? `<h3>${title}</h3>` : '';
    return `<div class="action-group">${head}<div class="${className}">${list.map(activity).join('')}</div></div>`;
  }).join('');
}

function stopActions(model) {
  const waiting = model.options.some(option => option.group === 'event');
  const body = waiting ? '<p class="panel-intro">The road is waiting on a decision.</p>' : grouped(model.options);
  return `<section class="activity-panel" aria-labelledby="actions-heading">
    ${heading('actions-heading', 'What now?', 'Every choice has a cost')}
    ${body}</section>`;
}

function shopRow(row) {
  const id = escapeHtml(row.id);
  const name = escapeHtml(row.name);
  const total = row.price * row.qty;
  const buy = { key: `buy:${row.id}`, enabled: row.buyEnabled, describedBy: row.buyEnabled ? '' : `reason-${id}` };
  const reason = row.buyEnabled ? '' : `<p class="shop-reason" id="reason-${id}">${escapeHtml(row.reason)}</p>`;
  const price = `$${formatNumber(row.price)} a ${escapeHtml(row.unit)}`;
  const stock = `${escapeHtml(supplyLabel(row.id))} ${formatNumber(row.owned)} / ${formatNumber(row.max)}`;
  const step = 'button stepper-button';
  const label = `<b>$${formatNumber(total)}</b><span>Buy ${formatNumber(row.qty)}</span>`;
  return `<div class="shop-item" data-item="${id}">
    <div class="shop-item-copy"><strong>${name}</strong><p>${escapeHtml(row.description)}</p>
      <span>${price} · ${stock}</span></div>
    <div class="shop-item-controls">
      <div class="stepper" role="group" aria-label="Quantity of ${name}">
        <button type="button" class="${step}" data-key="less:${id}" aria-label="One fewer">−</button>
        <input type="text" inputmode="numeric" pattern="[0-9]*" class="stepper-input" data-key="qty:${id}"
          value="${escapeHtml(row.qtyText)}" aria-label="Quantity of ${name} to buy" autocomplete="off" />
        <button type="button" class="${step}" data-key="more:${id}" aria-label="One more">+</button>
        <button type="button" class="${step} stepper-max" data-key="max:${id}"
          aria-label="As many as possible">Max</button>
      </div>
      ${optionButton(buy, 'button button-shop', label)}
    </div>${reason}
  </div>`;
}

function shopActions(model) {
  const others = model.options.filter(option => option.group !== 'primary');
  return `<section class="activity-panel shop-panel" aria-labelledby="shop-heading">
    ${heading('shop-heading', 'Roadside supplies', `Cash: $${formatNumber(model.state.inventory.money)}`)}
    <p class="panel-intro">Buy what the van can carry. Prices are per unit.</p>
    <div class="shop-list">${model.shop.items.map(shopRow).join('')}</div>
    ${others.length ? `<div class="shop-trade">${others.map(activity).join('')}</div>` : ''}</section>`;
}

const plural = (count, one, many) => `${formatNumber(count)} ${count === 1 ? one : many}`;

/** A headstone for a fallen traveler: the name, how and where, the epitaph and an Edit control. */
function headstone(member) {
  const id = escapeHtml(member.id);
  const name = escapeHtml(member.name);
  return `<li class="headstone" data-headstone="${id}">
    <strong class="headstone-name">${name}</strong>
    <span class="headstone-when">Day ${formatNumber(member.day)} · mile ${formatNumber(member.mile)}</span>
    <p class="headstone-line">${escapeHtml(member.line)}</p>
    <p class="headstone-epitaph">“${escapeHtml(member.epitaph)}”</p>
    <button type="button" class="button button-quiet headstone-edit" data-key="epitaph:${id}"
      aria-label="Edit ${name}’s epitaph">Edit epitaph</button>
  </li>`;
}

/** The best journeys on this device, top five: rank, score, background, day and survivors. */
function bestJourneys(records) {
  if (!records.length) return '';
  const rows = records
    .map(
      (entry, index) => `<li${entry.current ? ' class="is-current" aria-current="true"' : ''}>
        <span class="best-place">${index + 1}</span>
        <span class="best-score"><b>${formatNumber(entry.score)}</b> ${escapeHtml(entry.rank)}</span>
        <small>${escapeHtml(entry.professionName)} · day ${formatNumber(entry.day)} ·
          ${plural(entry.survivors, 'survivor', 'survivors')}</small></li>`,
    )
    .join('');
  return `<section class="best-journeys" aria-labelledby="best-heading"><h3 id="best-heading">Best journeys</h3>
    <ol data-list="records">${rows}</ol></section>`;
}

function ending(model) {
  const { summary } = model;
  const survivors = summary.survivors.map(member => escapeHtml(member.name)).join(', ');
  const stat = (value, label) => `<div><strong>${value}</strong><span>${label}</span></div>`;
  const stones = summary.fallen.length
    ? `<section class="headstones" aria-labelledby="headstones-heading">
        <h3 id="headstones-heading">Fallen along the way</h3>
        <ul>${summary.fallen.map(headstone).join('')}</ul></section>`
    : '';
  const rentDays = plural(summary.rentDays, 'day', 'days');
  const rent = `Your $${formatNumber(summary.money)} covers ${rentDays} of Portland rent.`;
  const share = model.canShare
    ? '<button type="button" class="button button-outline" data-key="share">Share</button>'
    : '';
  return `<section class="ending-panel" aria-labelledby="ending-heading" data-outcome="${escapeHtml(summary.outcome)}">
    <p class="overline">The final record</p>
    <h2 id="ending-heading">${escapeHtml(summary.heading)}</h2>
    ${summary.cause ? `<p class="ending-cause">${escapeHtml(summary.cause)}</p>` : ''}
    <div class="ending-stats">${stat(formatNumber(summary.distance), 'miles traveled')}${stat(
      formatNumber(summary.day),
      'days on the road',
    )}${stat(summary.survivors.length, 'survivors')}</div>
    <p>${summary.survivors.length ? `Still standing: ${survivors}.` : 'No one survived the trip.'}</p>
    <div class="ending-score" data-score="${summary.score}">
      <div class="ending-points"><strong>${formatNumber(summary.score)}</strong><span>points</span></div>
      <div class="ending-rank"><b data-rank>${escapeHtml(summary.rank.title)}</b>
        <p>${escapeHtml(summary.rank.line)}</p></div>
    </div>
    <p class="ending-rent" data-rent>${rent}</p>
    ${stones}
    <div class="ending-tools">
      <button type="button" class="button button-outline" data-key="ending-journal">Read the whole journal</button>
      <button type="button" class="button button-outline" data-key="copy-result">Copy result</button>${share}
    </div>
    ${bestJourneys(model.records)}
    <div class="ending-seed"><span data-seed>Seed <b>${escapeHtml(summary.seed)}</b> · the same road again</span>
      <button type="button" class="button button-quiet" data-key="replay">Replay this seed</button></div>
    <div class="ending-actions">
      <button type="button" class="button button-primary button-large" data-key="new">Start another journey</button>
    </div></section>`;
}

function actions(model) {
  if (ended(model)) return ending(model);
  if (model.state.phase === 'shop' && model.shop) return shopActions(model);
  return stopActions(model);
}

// --- Settings and journal --------------------------------------------------------------------------------

/**
 * A setting as a select. The select itself is see-through over a face that shows the chosen option's label and
 * may wrap, so a long label is never cut off on a phone; the select still takes every tap, key and reader.
 */
function select(key, label, options) {
  const list = options
    .map(option => {
      const selected = option.selected ? ' selected' : '';
      return `<option value="${escapeHtml(option.id)}"${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join('');
  const chosen = options.find(option => option.selected) ?? options[0];
  return `<label><span>${label}</span><span class="select-face"><span class="select-text" aria-hidden="true"
    >${escapeHtml(chosen?.label ?? '')}</span><select data-key="${key}">${list}</select></span></label>`;
}

function settings(model) {
  if (ended(model)) return '';
  const fields = select('setPace', 'Driving pace', model.paces) + select('setRations', 'Daily rations', model.rations);
  return `<section class="activity-panel route-settings" aria-labelledby="settings-heading">
    ${heading('settings-heading', 'On the road', escapeHtml(model.weather))}
    <div class="setting-fields">${fields}</div>
    <p class="panel-intro">Pace spends fuel and wears on the crew. Rations use food for each living traveler.</p>
  </section>`;
}

function journal(model) {
  const entries = [...model.state.journal].reverse().slice(0, 6);
  const items = entries.length
    ? entries
        .map(entry => `<li><span>Day ${formatNumber(entry.day)}</span><p>${escapeHtml(entry.text)}</p></li>`)
        .join('')
    : '<li><p>The journal is still clean. Give it a day.</p></li>';
  return `<section class="journal" aria-labelledby="journal-heading">
    ${heading('journal-heading', 'Field journal', 'Latest first')}<ol>${items}</ol>
    <button type="button" class="button button-quiet journal-all" data-key="journal">Read the whole journal</button>
  </section>`;
}
