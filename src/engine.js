import { SPECIES, STARTERS, NODES, BEACONS, neighbors, MAX_ENERGY, SAVE_VERSION } from './data.js';

export function newGame(seed = 2026) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Seed must be an integer from 1 to 4294967295.');
  return { version: SAVE_VERSION, seed, rng: seed, phase: 'choose', location: 'quay', visited: ['quay'], seen: [], roster: [], party: [], active: null, beacons: [], battle: null, victories: 0, defeats: 0, turns: 0, journal: ['The islands are waiting. Choose your first companion.'] };
}
export function random(s) {
  let x = s.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
export function multiplier(attacker, defender) {
  if (attacker === defender) return 1;
  return ({ leaf: 'tide', tide: 'ember', ember: 'leaf' })[attacker] === defender ? 1.5 : 0.75;
}
export function damage(power, attacker, defender, burst = false, variance = 0, guard = false) {
  return Math.max(1, Math.floor((power + variance) * (burst ? 1.6 * multiplier(attacker, defender) : 1) * (guard ? 0.5 : 1)));
}
export const member = (s, id = s.active) => s.roster.find(c => c.id === id);
const log = (s, message) => { s.journal.push(message); s.journal = s.journal.slice(-12); };
const see = (s, id) => { if (!s.seen.includes(id)) s.seen.push(id); };
const heal = s => s.roster.forEach(c => { c.hp = SPECIES[c.id].hp; c.energy = MAX_ENERGY; });
function award(s, recruited = false) {
  const b = s.battle;
  if (b.kind === 'beacon' && !s.beacons.includes(b.node)) {
    s.beacons.push(b.node); log(s, `${NODES[b.node].name} is alight. A bridge through the mist opens.`);
  }
  if (b.kind === 'final') {
    s.phase = 'ending'; log(s, 'The fog unravels. Bellray rings out across all three islands. The lighthouse is awake, and every path leads home.');
  } else {
    s.phase = 'explore';
    if (!recruited) log(s, `${SPECIES[b.enemy.id].name} bows. A friendly bout, a new page in your guide.`);
  }
  s.victories++; s.battle = null;
}
function enemyTurn(s, guard = false) {
  const b = s.battle, c = member(s);
  const variance = Math.floor(random(s) * 3) - 1;
  const dealt = damage(b.enemy.power, SPECIES[b.enemy.id].element, SPECIES[c.id].element, b.intent === 'surge', variance, guard);
  c.hp = Math.max(0, c.hp - dealt);
  log(s, `${SPECIES[b.enemy.id].name} uses ${b.intent}: ${dealt} damage to ${SPECIES[c.id].name}${guard ? ' (guarded)' : ''}.`);
  if (!c.hp) {
    const next = s.party.find(id => member(s, id).hp > 0);
    if (next) { s.active = next; log(s, `${SPECIES[next].name} steps in for your tired companion.`); }
    else {
      s.defeats++; s.battle = null; s.phase = 'explore';
      s.location = ['quay','hearth','tidecamp'][NODES[s.location].area];
      if (!s.visited.includes(s.location)) s.visited.push(s.location);
      heal(s); s.active = s.party[0];
      log(s, 'Your companions are tired. The keeper brings you to shelter, fully rested. Beacons and discoveries are safe; try again.');
      return;
    }
  }
  b.round++;
  b.intent = random(s) < 0.35 ? 'surge' : 'tap';
}
export function available(s) {
  return neighbors(s.location).filter(id => NODES[id].area <= s.beacons.length);
}
export function objective(s) {
  if (s.phase === 'choose') return 'Choose a companion to begin your field guide.';
  if (s.phase === 'ending') return 'The lighthouse is awake. Your first field guide is complete.';
  if (s.beacons.length < 3) return `Relight the ${NODES[BEACONS[s.beacons.length]].name.toLowerCase()}. Challenge its guardian or befriend it.`;
  if (s.party.length < 3) return 'Befriend creatures until you have three companions in your party.';
  return 'Rest at the Tide shelter, then guide the great Bellray home at the lighthouse.';
}

// Pure transition API: a valid action returns a new state; an invalid action returns
// the exact original object and never advances the random generator or turn count.
export function act(state, action) {
  if (!action || typeof action.type !== 'string') return state;
  const s = structuredClone(state);
  if (action.type === 'choose' && s.phase === 'choose' && STARTERS.includes(action.id)) {
    s.roster.push({ id: action.id, hp: SPECIES[action.id].hp, energy: MAX_ENERGY });
    s.party.push(action.id); s.active = action.id; see(s, action.id); s.phase = 'explore';
    log(s, `${SPECIES[action.id].name} joins you. Follow the paths to the Grove beacon. Rest at any shelter for free.`);
    return s;
  }
  if (s.phase === 'explore') {
    const node = NODES[s.location];
    if (action.type === 'move' && available(s).includes(action.to)) {
      s.location = action.to;
      if (!s.visited.includes(action.to)) s.visited.push(action.to);
      const target = NODES[action.to]; if (target.species) see(s, target.species);
      log(s, target.text); return s;
    }
    if (action.type === 'rest' && node.kind === 'camp') {
      heal(s); log(s, 'A quiet moment at shelter. All companions recover full health and 5 energy.'); return s;
    }
    if (action.type === 'lead' && s.party.includes(action.id) && member(s, action.id).hp > 0) {
      s.active = action.id; log(s, `${SPECIES[action.id].name} takes the lead.`); return s;
    }
    if (action.type === 'swap' && s.party.includes(action.out) && !s.party.includes(action.id) && member(s, action.id)) {
      // Do not permit a party with nobody able to fight.
      const next = s.party.map(id => id === action.out ? action.id : id);
      if (!next.some(id => member(s, id).hp > 0)) return state;
      s.party = next;
      if (s.active === action.out) s.active = member(s, action.id).hp > 0 ? action.id : next.find(id => member(s,id).hp > 0);
      log(s, `${SPECIES[action.id].name} joins the traveling party. ${SPECIES[action.out].name} rests in the field guide.`); return s;
    }
    if (action.type === 'encounter' && node.species && (node.kind !== 'final' || (s.beacons.length === 3 && s.party.length === 3))) {
      const boss = node.kind === 'final';
      s.phase = 'battle'; see(s, node.species);
      s.battle = { node: node.id, kind: node.kind, enemy: { id: node.species, hp: boss ? 110 : 32, maxHp: boss ? 110 : 32, power: boss ? 12 : 6 }, round: 1, intent: random(s) < 0.35 ? 'surge' : 'tap' };
      log(s, boss ? 'The great Bellray calls from the fog. Calm it together.' : `${SPECIES[node.species].name} approaches. Lower its health to 16 or less to befriend it.`); return s;
    }
  }
  if (s.phase !== 'battle') return state;
  const b = s.battle, c = member(s);
  if (action.type === 'flee' && b.kind !== 'final') {
    s.battle = null; s.phase = 'explore'; log(s, 'You step back. The creature will be here when you are ready.'); return s;
  }
  if (action.type === 'switch' && s.party.includes(action.id) && action.id !== s.active && member(s, action.id).hp > 0) {
    s.active = action.id; log(s, `${SPECIES[action.id].name} steps forward. Switching uses your turn.`);
  } else if (action.type === 'befriend' && b.kind !== 'final' && !member(s, b.enemy.id)) {
    if (b.enemy.hp <= Math.floor(b.enemy.maxHp / 2)) {
      const id = b.enemy.id;
      s.roster.push({ id, hp: SPECIES[id].hp, energy: MAX_ENERGY });
      if (s.party.length < 3) s.party.push(id);
      log(s, `${SPECIES[id].name} trusts you and joins ${s.party.includes(id) ? 'your party' : 'your reserve (party full)'}.`);
      s.turns++; award(s, true); return s;
    }
    log(s, 'Not yet: lower the creature to half health before offering friendship.');
  } else if (action.type === 'strike' || action.type === 'burst') {
    const burst = action.type === 'burst';
    if (burst && c.energy < 2) return state;
    if (burst) c.energy -= 2;
    const dealt = damage(SPECIES[c.id].power, SPECIES[c.id].element, SPECIES[b.enemy.id].element, burst);
    b.enemy.hp = Math.max(0, b.enemy.hp - dealt);
    log(s, `${SPECIES[c.id].name} uses ${burst ? 'elemental burst' : 'strike'}: ${dealt} damage${burst ? ` (×${multiplier(SPECIES[c.id].element, SPECIES[b.enemy.id].element)} element)` : ''}.`);
    if (!b.enemy.hp) { s.turns++; award(s); return s; }
  } else if (action.type === 'guard') {
    c.energy = Math.min(MAX_ENERGY, c.energy + 2); log(s, `${SPECIES[c.id].name} guards, restoring 2 energy (maximum 5).`);
  } else return state;
  s.turns++; enemyTurn(s, action.type === 'guard'); return s;
}
