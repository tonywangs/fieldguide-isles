import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SPECIES, STARTERS, NODES, BEACONS } from '../src/data.js';
import { act, newGame, random, damage, multiplier, available, member } from '../src/engine.js';
import { encode,decode,validate } from '../src/saves.js';
import { driver,campaign } from './helpers.mjs';
const hash = s => createHash('sha256').update(JSON.stringify(s)).digest('hex');

test('independently calculated damage, elemental matrix, rounding and guarding',() => {
  // Neutral strike = 11. Strong leaf burst = floor(11 × 1.6 × 1.5) = 26.
  assert.equal(damage(11,'leaf','tide'),11);
  assert.equal(damage(11,'leaf','tide',true),26);
  assert.equal(damage(11,'leaf','ember',true),13); // floor(13.2)
  assert.equal(damage(12,'ember','ember',true),19); // floor(19.2)
  assert.equal(damage(6,'tide','ember',true,1,true),8); // floor(7 × 1.6 × 1.5 × .5)
  assert.equal(damage(6,'tide','leaf',true,-1),6); // floor(5 × 1.6 × .75)
  assert.equal(damage(0,'tide','tide'),1);
  for (const a of ['leaf','ember','tide']) for (const b of ['leaf','ember','tide']) {
    assert.equal(multiplier(a,b),a === b ? 1 : ({leaf:'tide',ember:'leaf',tide:'ember'})[a] === b ? 1.5 : .75);
  }
});
test('xorshift32 known sequence; states and callers are not mutated',() => {
  const s = newGame(1); const expected = [270369,67634689,2647435461,307599695,2398689233];
  for (const n of expected) { random(s); assert.equal(s.rng,n); }
  const original = newGame(1), copy = structuredClone(original);
  const action = {type:'choose',id:'spriglet'}; const next = act(original,action);
  assert.deepEqual(original,copy); assert.notEqual(next,original); assert.deepEqual(action,{type:'choose',id:'spriglet'});
});
test('invalid, stale and repeated inputs do not bypass gates or advance RNG',() => {
  let s = newGame(8);
  for (const action of [null,{}, {type:'strike'},{type:'choose',id:'__proto__'},{type:'move',to:'lighthouse'}]) assert.equal(act(s,action),s);
  s = act(s,{type:'choose',id:'spriglet'});
  for (const action of [{type:'choose',id:'pebblefin'},{type:'move',to:'hearth'},{type:'encounter'},{type:'swap',id:'bellray',out:'spriglet'}]) assert.equal(act(s,action),s);
  s = act(s,{type:'move',to:'clover'}); assert.equal(act(s,{type:'move',to:'clover'}),s);
  s = act(s,{type:'encounter'}); assert.equal(act(s,{type:'encounter'}),s);
  assert.equal(act(s,{type:'move',to:'quay'}),s);
});
test('battle order, energy exhaustion, free strike and exact guard example',() => {
  const d = driver('spriglet',1); d.go('clover'); d.step({type:'encounter'});
  // First RNG state is 270369: surge. Second is 67634689: variance -1.
  d.step({type:'guard'});
  assert.equal(member(d.state).hp,44); // floor((6 - 1) × 1.6 × 1 × .5) = 4
  assert.equal(member(d.state).energy,5);
  d.step({type:'burst'}); assert.equal(member(d.state).energy,3);
  // 17 damage against same element leaves 15. Finish gives no enemy retaliation.
  const hp = member(d.state).hp, rng = d.state.rng;
  d.step({type:'burst'}); assert.equal(d.state.phase,'explore'); assert.equal(member(d.state).hp,hp); assert.equal(d.state.rng,rng);
  d.step({type:'encounter'});
  const before = d.state; assert.equal(act(before,{type:'burst'}),before);
  d.step({type:'strike'}); assert.equal(member(d.state).energy,1);
  d.step({type:'guard'}); assert.equal(member(d.state).energy,3);
});
test('friendship threshold is deterministic; full party uses reserves; swapping and switching',() => {
  const d = driver(); d.go('clover'); d.step({type:'encounter'});
  d.step({type:'befriend'}); assert.equal(d.state.roster.length,1); assert.equal(d.state.battle.enemy.hp,32);
  d.step({type:'strike'}); assert.equal(d.state.battle.enemy.hp,21);
  d.step({type:'strike'}); assert.equal(d.state.battle.enemy.hp,10);
  d.step({type:'befriend'}); assert.equal(d.state.roster.length,2);
  d.go('quay'); d.step({type:'rest'}); d.go('grove'); d.bout();
  d.go('hearth'); d.step({type:'rest'}); d.go('kiln'); d.bout(true);
  assert.equal(d.state.party.length,3);
  d.go('hearth'); d.step({type:'rest'}); d.go('lantern'); d.bout(true);
  assert.equal(d.state.party.length,3); assert.equal(d.state.roster.length,4); assert.ok(!d.state.party.includes('cindermoth'));
  d.step({type:'swap',out:'spriglet',id:'cindermoth'}); assert.equal(d.state.active,'cindermoth');
  d.step({type:'encounter'}); const turn = d.state.turns;
  d.step({type:'switch',id:'fernwhorl'}); assert.equal(d.state.turns,turn+1); assert.equal(d.state.active,'fernwhorl');
  assert.equal(act(d.state,{type:'switch',id:'fernwhorl'}),d.state);
  assert.equal(act(d.state,{type:'befriend'}),d.state); // Already owned.
  d.step({type:'flee'}); assert.equal(d.state.phase,'explore');
});
test('defeat heals all companions at shelter, preserves progress, and retry works',() => {
  const d = driver('pebblefin',4); d.go('clover'); d.step({type:'encounter'});
  while (d.state.phase === 'battle') d.step({type:'guard'});
  assert.equal(d.state.defeats,1); assert.equal(d.state.location,'quay'); assert.equal(member(d.state).hp,52);
  assert.ok(d.state.seen.includes('fernwhorl'));
  d.go('clover'); d.bout(true); assert.ok(d.state.party.includes('fernwhorl'));
});
test('all 13 map nodes reachable in their authored progression; gates enforced',() => {
  let s = act(newGame(),{type:'choose',id:'spriglet'});
  for (let stage=0;stage<=3;stage++) {
    s = {...s,beacons:BEACONS.slice(0,stage)};
    const seen = new Set(), queue = ['quay'];
    while (queue.length) { const id=queue.shift(); if (seen.has(id)) continue; seen.add(id); queue.push(...available({...s,location:id})); }
    for (const n of Object.values(NODES)) assert.equal(seen.has(n.id),n.area<=stage,`${stage}: ${n.id}`);
  }
  const d=driver(); d.go('clover');d.bout(true);d.go('grove');d.bout();d.go('hearth');d.step({type:'rest'});d.go('forge');d.bout();d.go('tidecamp');d.step({type:'rest'});d.go('lighthouse');
  assert.equal(act(d.state,{type:'encounter'}),d.state);
});
test('300 legal winning campaigns: each starter, seeds 1–100; reload after every action',() => {
  const records=[];
  for (const starter of STARTERS) for (let seed=1;seed<=100;seed++) {
    const d=campaign(starter,seed,true);
    assert.equal(d.state.beacons.length,3); assert.equal(d.state.party.length,3);
    const replay = d.actions.reduce(act,newGame(seed)); assert.deepEqual(replay,d.state);
    records.push({starter,seed,actions:d.actions.length,turns:d.state.turns,hash:hash(d.state)});
  }
  const expected=JSON.parse(readFileSync(new URL('../results/campaigns.json',import.meta.url),'utf8'));
  assert.deepEqual(records,expected);
});
test('seeded state-machine exploration: save/replay, legal and invalid inputs, bounded resources',() => {
  for(let seed=1;seed<=40;seed++) {
    let chooser=seed, s=act(newGame(seed),{type:'choose',id:STARTERS[seed%3]}), replay=structuredClone(s);
    for(let i=0;i<350;i++) {
      chooser=(Math.imul(chooser,1664525)+1013904223)>>>0;
      const choices=[{type:'rest'},{type:'encounter'},{type:'guard'},{type:'strike'},{type:'burst'},{type:'befriend'},{type:'flee'},{type:'switch',id:s.party[chooser%s.party.length]},{type:'move',to:available(s)[chooser%Math.max(1,available(s).length)]},{type:'choose',id:'spriglet'}];
      const action=choices[chooser%choices.length];
      s=decode(encode(act(s,action))); replay=act(replay,action); assert.deepEqual(s,replay); validate(s);
      for(const c of s.roster) {assert.ok(c.hp>=0 && c.hp<=SPECIES[c.id].hp);assert.ok(c.energy>=0 && c.energy<=5);}
    }
  }
});

test('default and boundary seeds finish for every starter; ending rejects further gameplay',() => {
  for(const starter of STARTERS) for(const seed of [2026,0xffffffff]) {
    const d=campaign(starter,seed);
    for(const action of [{type:'encounter'},{type:'strike'},{type:'move',to:'bells'},{type:'rest'},{type:'choose',id:'spriglet'}]) assert.equal(act(d.state,action),d.state);
  }
});
test('final encounter defeat preserves all beacons, restores the roster, and permits victory on retry',() => {
  const complete=campaign('spriglet',1);
  const beforeFinal=complete.actions.slice(0,complete.actions.findLastIndex(a=>a.type==='encounter'));
  let s=beforeFinal.reduce(act,newGame(1));
  assert.equal(s.location,'lighthouse');s=act(s,{type:'encounter'});
  assert.equal(act(s,{type:'flee'}),s);assert.equal(act(s,{type:'befriend'}),s);
  let limit=200;while(s.phase==='battle' && limit-->0)s=act(s,{type:'guard'});
  assert.ok(limit>0);validate(s);assert.equal(s.defeats,1);assert.equal(s.location,'tidecamp');assert.deepEqual(s.beacons,BEACONS);
  for(const c of s.roster){assert.equal(c.hp,SPECIES[c.id].hp);assert.equal(c.energy,5);}
  for(const to of ['bells','lighthouse'])s=act(s,{type:'move',to});s=act(s,{type:'encounter'});
  limit=40;while(s.phase==='battle' && limit-->0)s=act(s,{type:member(s).energy>=2?'burst':'strike'});
  assert.equal(s.phase,'ending');validate(s);
});
