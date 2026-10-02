// Play thousands of seeded journeys with three bots through the real engine and count how each one
// ends (spec section 3.11). The bots act only through `availableActions` and `transition`; they read
// the state and the forecast to decide, as a player reads the screen.
//
//   node scripts/balance.mjs [seeds per background]      (from app/; default 2000)
//
// `play(seed, profession, bot)` plays one journey; `measure(seeds)` plays every bot with every
// background over the same seeds and returns the tallies the table prints.
import { pathToFileURL } from 'node:url';
import { availableActions, createGame, forecast, seedFromText, summarize, transition } from '../src/engine.js';
import { EVENTS, PROFESSIONS, RATIONS } from '../src/data.js';

const MAX_STEPS = 1500;
const EVENT_BY_ID = new Map(EVENTS.map(event => [event.id, event]));

// --- Helpers a bot may use: what is on offer, and what the screen shows ------------------------

const living = state => state.party.filter(member => member.health > 0);
const meanHealth = state => {
  const crew = living(state);
  return crew.reduce((sum, member) => sum + member.health, 0) / Math.max(1, crew.length);
};
const lowestHealth = state => Math.min(...living(state).map(member => member.health));

/** The enabled option with this key, or undefined. */
const enabled = (options, key) => options.find(option => option.key === key && option.enabled);

/** The first enabled option among these keys, in the order given. */
const firstOf = (options, keys) => keys.map(key => enabled(options, key)).find(Boolean);

/** The choice an `event:<id>` option answers with, from the encounter's data. */
function choiceOf(state, option) {
  const event = EVENT_BY_ID.get(state.pendingEvent?.id);
  return event?.choices.find(choice => `event:${choice.id}` === option.key);
}

/** The first enabled answer to the encounter that is open to every background. */
const firstOpenAnswer = (state, options) => options.find(option => option.enabled && !choiceOf(state, option)?.only);

/**
 * Whether the van has enough food to reach the next shop (or Portland) at these rations, with
 * `spareDays` of food left over. Asked of the forecast on a copy; nothing is changed.
 */
function foodLasts(state, rations, spareDays = 1) {
  const spare = RATIONS[rations].food * living(state).length * spareDays;
  const trial = { ...state, rations, inventory: { ...state.inventory, food: state.inventory.food - spare } };
  return trial.inventory.food >= 0 && forecast(trial).shortfall.food === 0;
}

/** A setting changed through transition, or nothing when it is already set. */
const setting = (state, type, field, value) => (state[field] === value ? null : { type, [field]: value });

/** The last resorts for a dry tank, in the bot's order of preference. */
const lastResort = (options, keys) => firstOf(options, keys)?.action;

// --- The bots ---------------------------------------------------------------------------------

/**
 * @typedef {Object} Bot
 * @property {string} id
 * @property {string} label
 * @property {(state: any, memory: any) => import('../src/engine/actions.js').Action} choose
 *   the next action to send to transition
 */

/** Drives on the starting supplies; when dry trades the luggage, then pushes. */
const neverShops = {
  id: 'never-shops',
  label: 'Never shops',
  choose(state) {
    const options = availableActions(state);
    if (state.pendingEvent) return firstOpenAnswer(state, options).action;
    return enabled(options, 'travel')?.action ?? lastResort(options, ['tradeLuggage', 'push', 'hitchhike']);
  },
};

/**
 * Auto-buy at every shop, Steady pace, Meager rations. Never rests, eats, forages, talks or uses an
 * item or the ability. Takes the first enabled answer to an encounter that is not reserved for one
 * background. When dry: the luggage, then pushing.
 */
const autopilot = {
  id: 'autopilot',
  label: 'Autopilot',
  choose(state, memory) {
    const options = availableActions(state);
    if (state.pendingEvent) return firstOpenAnswer(state, options).action;
    const settings = setting(state, 'setPace', 'pace', 'normal') ?? setting(state, 'setRations', 'rations', 'meager');
    if (settings) return settings;
    if (state.phase === 'shop' && !memory.shopped.has(state.distance)) {
      memory.shopped.add(state.distance);
      return { type: 'autoPurchase' };
    }
    if (state.phase === 'location' && !memory.shopped.has(state.distance) && enabled(options, 'openShop')) {
      return { type: 'openShop' };
    }
    return enabled(options, 'travel')?.action ?? lastResort(options, ['tradeLuggage', 'push', 'hitchhike']);
  },
};

// The careful bot's answers to each encounter, best first. It treats, repairs and pays when it can,
// doses or quarantines in the outbreak, and takes its own background's answer where one helps.
const CAREFUL_ANSWERS = {
  nft_auction: ['invest', 'consult', 'wait'],
  food_poisoning: ['treat', 'ride'],
  van_breakdown: ['repair', 'tow', 'kick'],
  pandemic_death: ['kombucha', 'quarantine', 'push_on'],
  ebike_convoy: ['trade', 'wait', 'honk'],
  sasquatch: ['photo', 'leave', 'chase'],
  toll_troll: ['pay', 'ford', 'riddle'],
  brunch_line: ['post', 'wait', 'detour'],
  petition_gauntlet: ['call', 'donate', 'sign'],
};
const CAREFUL = { restBelow: 70, kombuchaBelow: 40, restsPerStop: 3, brewBelow: 95, scoutAbove: 50 };

/** Whether the careful bot uses its background's ability now. */
function abilityWanted(state) {
  switch (state.profession) {
    case 'prepper': // Scouting costs health: only when food is short and the crew can take it.
      return !foodLasts(state, 'meager', 1) && lowestHealth(state) > CAREFUL.scoutAbove;
    case 'barista': // A brew costs food: only when someone needs it and the food reaches the next shop.
      return lowestHealth(state) < CAREFUL.brewBelow && foodLasts(state, state.rations, 2);
    default: // A collab and a salvage cost nothing.
      return true;
  }
}

/**
 * Auto-buy for Filling rations; Filling while the food lasts to the next shop, Meager otherwise,
 * Bare when even Meager falls short. Talks, eats at the carts, uses the ability, opens kombucha
 * when anyone is sick or under 40, rests at stops while mean health is under 70, scatters seed
 * bombs and forages when food runs short. When dry: the luggage, then walking for fuel, then pushing.
 */
const careful = {
  id: 'careful',
  label: 'Careful',
  choose(state, memory) {
    const options = availableActions(state);
    if (state.pendingEvent) {
      const keys = (CAREFUL_ANSWERS[state.pendingEvent.id] ?? []).map(id => `event:${id}`);
      return (firstOf(options, ['event:continue', ...keys]) ?? options.find(option => option.enabled)).action;
    }
    const pace = setting(state, 'setPace', 'pace', 'normal');
    if (pace) return pace;
    const here = state.distance;

    if (state.phase === 'shop') {
      if (!memory.shopped.has(here)) {
        const plan = setting(state, 'setRations', 'rations', 'filling');
        if (plan) return plan;
        memory.shopped.add(here);
        return { type: 'autoPurchase' };
      }
    }

    const crew = living(state);
    const ailing = crew.some(member => member.sick || member.health < CAREFUL.kombuchaBelow);
    const kombucha = ailing && enabled(options, 'useItem:kombucha');
    if (kombucha) return kombucha.action;

    if (state.phase === 'location') {
      const visit = firstOf(options, ['talk', 'meal']);
      if (visit) return visit.action;
      const rests = memory.rests.get(here) ?? 0;
      const rest = enabled(options, 'rest');
      if (rest && meanHealth(state) < CAREFUL.restBelow && rests < CAREFUL.restsPerStop) {
        memory.rests.set(here, rests + 1);
        return rest.action;
      }
    }

    const ability = enabled(options, 'ability');
    if (ability && abilityWanted(state)) return ability.action;

    if (state.phase === 'location' && !memory.shopped.has(here) && enabled(options, 'openShop')) {
      return { type: 'openShop' };
    }

    const hungry = !foodLasts(state, 'meager', 0);
    const seeds = hungry && enabled(options, 'useItem:ammo');
    if (seeds) return seeds.action;
    const forage = hungry && meanHealth(state) > CAREFUL.scoutAbove && enabled(options, 'forage');
    if (forage) return forage.action;

    const rations = ['filling', 'meager'].find(id => foodLasts(state, id)) ?? 'bare';
    const ration = setting(state, 'setRations', 'rations', rations);
    if (ration) return ration;

    return enabled(options, 'travel')?.action ?? lastResort(options, ['tradeLuggage', 'hitchhike', 'push']);
  },
};

export const BOTS = [neverShops, autopilot, careful];

// --- One journey ------------------------------------------------------------------------------

/**
 * Play one journey to its end.
 * @param {number} seed
 * @param {string} profession
 * @param {Bot} bot
 * @returns {{ outcome: 'won'|'lost'|'unfinished', cause: string, day: number, alive: number, score: number,
 *   money: number, outbreak: boolean }}
 *   `cause` is the cause of the last death of a lost journey; '' otherwise.
 */
export function play(seed, profession, bot) {
  let state = createGame({ profession, seed });
  const memory = { shopped: new Set(), rests: new Map() };
  let outbreak = false;
  let lastCause = '';
  for (let step = 0; step < MAX_STEPS && !state.outcome; step++) {
    if (state.pendingEvent?.id === 'pandemic_death') outbreak = true;
    const action = bot.choose(state, memory);
    const result = transition(state, action);
    // A refused Auto-buy is a shop with nothing to add; anything else refused is a fault in the bot.
    if (result.error && action.type !== 'autoPurchase') {
      throw new Error(`${bot.id} sent ${JSON.stringify(action)} and was refused: ${result.error}`);
    }
    const before = state;
    state = result.state;
    state.party.forEach((member, index) => {
      if (member.health === 0 && before.party[index].health > 0) lastCause = member.death.cause;
    });
  }
  const summary = summarize(state);
  return {
    outcome: state.outcome ?? 'unfinished',
    cause: state.outcome === 'won' ? '' : lastCause || 'none',
    day: state.day,
    alive: summary.survivors.length,
    score: summary.score,
    money: state.inventory.money,
    outbreak,
  };
}

// --- Many journeys ----------------------------------------------------------------------------

/** The seed of sample `n`: hashed, so that samples do not share their first rolls. */
export const sampleSeed = n => seedFromText(`balance-${n}`);

/**
 * Play every bot with every background over `seeds` seeds each.
 * @param {number} seeds  seeds per background
 * @returns {Record<string, Record<string, { journeys: number, wins: number, winRate: number,
 *   losses: Record<string, number>, meanDay: number, meanAlive: number, meanScore: number, meanCash: number,
 *   outbreaks: number, outbreakLosses: number }>>}  by bot id, then by background id
 */
export function measure(seeds) {
  const results = {};
  for (const bot of BOTS) {
    results[bot.id] = {};
    for (const { id: profession } of PROFESSIONS) {
      const tally = { journeys: 0, wins: 0, losses: {}, day: 0, alive: 0, score: 0, cash: 0, outbreaks: 0, lost: 0 };
      for (let n = 1; n <= seeds; n++) {
        const run = play(sampleSeed(n), profession, bot);
        tally.journeys += 1;
        tally.day += run.day;
        tally.alive += run.alive;
        tally.score += run.score;
        tally.cash += run.money;
        if (run.outbreak) tally.outbreaks += 1;
        if (run.outcome === 'won') {
          tally.wins += 1;
        } else {
          tally.losses[run.cause] = (tally.losses[run.cause] ?? 0) + 1;
          if (run.outbreak) tally.lost += 1;
        }
      }
      const mean = total => total / tally.journeys;
      results[bot.id][profession] = {
        journeys: tally.journeys,
        wins: tally.wins,
        winRate: mean(tally.wins),
        losses: tally.losses,
        meanDay: mean(tally.day),
        meanAlive: mean(tally.alive),
        meanScore: mean(tally.score),
        meanCash: mean(tally.cash),
        outbreaks: tally.outbreaks,
        outbreakLosses: tally.lost,
      };
    }
  }
  return results;
}

/**
 * Whether Auto-buy with the default settings, at the start, leaves each background able to reach
 * the next shop: by background id, the forecast's shortfall after buying.
 * @returns {Record<string, { fuel: number, food: number }>}
 */
export function startingShortfalls() {
  const shortfalls = {};
  for (const { id } of PROFESSIONS) {
    const bought = transition(createGame({ profession: id, seed: sampleSeed(0) }), { type: 'autoPurchase' });
    shortfalls[id] = forecast(bought.state).shortfall;
  }
  return shortfalls;
}

// --- The table --------------------------------------------------------------------------------

const percent = share => `${(share * 100).toFixed(1)}%`;

/** The measurements as Markdown: one table per bot. */
export function formatTables(results, seeds) {
  const lines = [];
  for (const bot of BOTS) {
    lines.push(`### ${bot.label} (${seeds} seeds per background)`, '');
    lines.push('| background | won | losses by last cause of death | mean day | mean alive | mean score | mean cash |');
    lines.push('|---|---:|---|---:|---:|---:|---:|');
    let outbreaks = 0;
    let outbreakLosses = 0;
    for (const [profession, row] of Object.entries(results[bot.id])) {
      const causes = Object.entries(row.losses)
        .sort((first, second) => second[1] - first[1])
        .map(([cause, count]) => `${cause} ${percent(count / row.journeys)}`)
        .join(', ');
      lines.push(
        `| ${profession} | ${percent(row.winRate)} | ${causes || '—'} | ${row.meanDay.toFixed(1)} | ` +
          `${row.meanAlive.toFixed(2)} | ${Math.round(row.meanScore)} | $${Math.round(row.meanCash)} |`,
      );
      outbreaks += row.outbreaks;
      outbreakLosses += row.outbreakLosses;
    }
    const rates = Object.values(results[bot.id]).map(row => row.winRate * 100);
    const spread = Math.max(...rates) - Math.min(...rates);
    const outbreakShare = outbreaks ? percent(outbreakLosses / outbreaks) : '—';
    lines.push(
      '',
      `Spread between backgrounds: ${spread.toFixed(1)} points. ` +
        `Outbreak met in ${outbreaks} journeys; ${outbreakLosses} of them lost (${outbreakShare}).`,
      '',
    );
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const seeds = Number(process.argv[2]) || 2000;
  const started = Date.now();
  const results = measure(seeds);
  console.log(formatTables(results, seeds));
  const shortfalls = startingShortfalls();
  const reach = Object.entries(shortfalls)
    .map(([id, { fuel, food }]) => `${id} fuel ${fuel}, food ${food}`)
    .join('; ');
  console.log(`Shortfall to the next shop after Auto-buy at the start: ${reach}.`);
  console.log(`Measured in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
}
