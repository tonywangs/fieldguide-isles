import { SPECIES, STARTERS, NODES, BEACONS, SAVE_VERSION, MAX_ENERGY, neighbors } from './data.js';
export const SAVE_KEY = 'fieldguide-isles:v1';
export const MAX_SAVE_BYTES = 32768;
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o,k));
const list = (a, allowed, max) => Array.isArray(a) && a.length <= max && new Set(a).size === a.length && a.every(v => allowed.includes(v));
const fail = () => { throw new Error('Invalid or inconsistent save. Your current progress has not changed.'); };
export function validate(s) {
  if (!exact(s, ['version','seed','rng','phase','location','visited','seen','roster','party','active','beacons','battle','victories','defeats','turns','journal'])) fail();
  if (s.version !== SAVE_VERSION) throw new Error('Unsupported save version. This game accepts version 1 only.');
  if (!integer(s.seed,1,0xffffffff) || !integer(s.rng,1,0xffffffff) || !['choose','explore','battle','ending'].includes(s.phase)) fail();
  if (!Object.hasOwn(NODES,s.location) || !list(s.visited,Object.keys(NODES),13) || !s.visited.includes('quay') || !s.visited.includes(s.location)) fail();
  if (!list(s.beacons,BEACONS,3) || !s.beacons.every((v,i) => v === BEACONS[i]) || !s.beacons.every(id => s.visited.includes(id))) fail();
  if (s.visited.some(id => NODES[id].area > s.beacons.length)) fail();
  if (s.visited[0] !== 'quay' || s.visited.slice(1).some((id,i) => !neighbors(id).some(n => s.visited.slice(0,i+1).includes(n)))) fail();
  if (!list(s.seen,Object.keys(SPECIES),6) || !list(s.party,Object.keys(SPECIES),3)) fail();
  if (!Array.isArray(s.roster) || s.roster.length > 6 || new Set(s.roster.map(c => c?.id)).size !== s.roster.length) fail();
  for (const c of s.roster) {
    if (!exact(c,['id','hp','energy']) || !Object.hasOwn(SPECIES,c.id) || !integer(c.hp,0,SPECIES[c.id].hp) || !integer(c.energy,0,MAX_ENERGY) || !s.seen.includes(c.id)) fail();
  }
  if (!s.party.every(id => s.roster.some(c => c.id === id))) fail();
  if (![s.victories,s.defeats,s.turns].every(n => integer(n,0,1000000000)) || s.victories < s.beacons.length || s.victories + s.defeats > s.turns) fail();
  const discoveries = new Set([s.roster[0]?.id,...s.visited.map(id => NODES[id].species)].filter(Boolean));
  if (s.seen.length !== discoveries.size || !s.seen.every(id => discoveries.has(id))) fail();
  // Journal is plain text only. No imported string is ever interpreted as markup.
  if (!Array.isArray(s.journal) || s.journal.length < 1 || s.journal.length > 12 || !s.journal.every(t => typeof t === 'string' && t.length <= 512 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t))) fail();
  if (s.phase === 'choose') {
    if (s.roster.length || s.party.length || s.active !== null || s.beacons.length || s.battle !== null || s.seen.length || s.visited.length !== 1 || s.location !== 'quay' || s.rng !== s.seed || s.turns || s.victories || s.defeats) fail();
  } else {
    if (!s.roster.length || !STARTERS.includes(s.roster[0].id) || s.party.length !== Math.min(3,s.roster.length) || !s.party.includes(s.active) || !s.roster.find(c => c.id === s.active)?.hp) fail();
    if (s.roster.length > s.victories + 1) fail();
  }
  if (s.phase === 'ending' && (s.beacons.length !== 3 || s.party.length !== 3 || s.location !== 'lighthouse' || s.victories < 4)) fail();
  if (s.phase === 'battle') {
    const b = s.battle, node = NODES[s.location];
    if (!exact(b,['node','kind','enemy','round','intent']) || b.node !== s.location || b.kind !== node.kind || !node.species || !['wild','beacon','final'].includes(b.kind)) fail();
    if (!exact(b.enemy,['id','hp','maxHp','power']) || b.enemy.id !== node.species || !s.seen.includes(b.enemy.id)) fail();
    const boss = b.kind === 'final';
    if (b.enemy.maxHp !== (boss ? 110 : 32) || b.enemy.power !== (boss ? 12 : 6) || !integer(b.enemy.hp,1,b.enemy.maxHp) || !integer(b.round,1,s.turns+1) || !['tap','surge'].includes(b.intent)) fail();
    if (boss && (s.beacons.length !== 3 || s.party.length !== 3)) fail();
  } else if (s.battle !== null) fail();
  return s;
}
export function decode(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error('Save exceeds the 32 KiB limit. Your current progress has not changed.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('This is not valid JSON. Your current progress has not changed.'); }
  validate(parsed);
  return structuredClone(parsed);
}
export function encode(s) { validate(s); return JSON.stringify(s,null,2); }
export function saveLocal(s, storage) {
  try { storage.setItem(SAVE_KEY,encode(s)); return { ok: true, message: 'Saved on this device' }; }
  catch { return { ok: false, message: 'Device saving unavailable. Export a JSON save to keep your progress.' }; }
}
export function loadLocal(storage) {
  let raw;
  try { raw = storage.getItem(SAVE_KEY); }
  catch { return { state: null, preserve: false, error: 'Device saving unavailable. Play in memory and export a JSON save to keep your progress.' }; }
  try { return { state: raw === null ? null : decode(raw), preserve: false, error: null }; }
  catch { return { state: null, preserve: true, error: 'Stored save could not be loaded. It has been left untouched. Import a backup, or begin a new journey.' }; }
}
