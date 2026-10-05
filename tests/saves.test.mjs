import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/engine.js';
import { encode,decode,validate,saveLocal,loadLocal,SAVE_KEY,MAX_SAVE_BYTES } from '../src/saves.js';
import { driver,campaign } from './helpers.mjs';

test('versioned saves round-trip setup, exploration, active battle, and ending including RNG',() => {
  const d=driver('cindermoth',0xffffffff);
  const states=[newGame(1),d.state]; d.go('clover');d.step({type:'encounter'});d.step({type:'strike'});states.push(d.state,campaign('pebblefin',99).state);
  for(const s of states) assert.deepEqual(decode(encode(s)),s);
});
test('malformed, oversized, unsupported, extra-key and inconsistent imports are rejected atomically',() => {
  const d=driver('spriglet',42);d.go('clover');d.step({type:'encounter'});
  const current=d.state, snapshot=encode(current);
  const mutations=[
    s=>s.version=2, s=>s.version='1', s=>s.rng=0, s=>s.seed=-1, s=>s.phase='victory',
    s=>s.location='__proto__', s=>s.visited=[], s=>s.visited.push('lighthouse'),s=>s.visited.push('clover'),
    s=>s.seen=['not-a-species'],s=>s.seen.push('bellray'),s=>s.seen=[],s=>s.visited=['quay','grove','clover'],s=>s.victories=100,s=>s.roster.push(s.roster[0]),s=>s.roster[0].hp=999,s=>s.roster[0].hp=-1,s=>s.roster[0].hp=1.5,
    s=>s.roster[0].energy=6,s=>s.roster[0].id='constructor',s=>s.party=['bellray'],s=>s.party=[],s=>s.active='bellray',s=>s.active=null,
    s=>s.beacons=['glass'],s=>s.beacons=['grove','forge','glass'],s=>s.battle=null,s=>s.battle.kind='final',s=>s.battle.node='forge',
    s=>s.battle.enemy.hp=0,s=>s.battle.enemy.hp=33,s=>s.battle.enemy.maxHp=110,s=>s.battle.enemy.power=99,s=>s.battle.enemy.id='bellray',
    s=>s.battle.intent='skip',s=>s.battle.round=0,s=>s.battle.round=1000,s=>s.phase='explore',s=>s.victories=-1,s=>s.defeats=Infinity,
    s=>s.turns=1e15,s=>s.journal=[],s=>s.journal=['x'.repeat(513)],s=>s.journal=[{}],s=>s.journal=['\u0000'],s=>s.journal=Array(13).fill('x'),
    s=>s.unknown=true,s=>s.roster[0].unknown=1,s=>s.battle.unknown=1,s=>delete s.rng,
  ];
  for(const mutate of mutations) {const changed=structuredClone(current);mutate(changed);assert.throws(()=>decode(JSON.stringify(changed)),String(mutate));assert.equal(encode(current),snapshot);}
  for(const raw of ['','{','null','[]','"hello"','42','true','{"__proto__":{}}',' '.repeat(MAX_SAVE_BYTES+1),'💥'.repeat(MAX_SAVE_BYTES/3)]) assert.throws(()=>decode(raw));
  assert.throws(()=>validate({...newGame(),roster:[null]}));
});
test('hostile journal text remains text and fits the bounded schema',() => {
  const s=newGame();s.journal=['<img src=x onerror="globalThis.pwned=true">','</script><script>alert(1)</script>'];
  assert.deepEqual(decode(encode(s)).journal,s.journal);
});
test('unavailable or full storage is reported; corrupt existing data is never replaced by loading',() => {
  for(const storage of [undefined,{setItem(){throw new Error('quota');},getItem(){throw new Error('disabled');}}]) {
    assert.equal(saveLocal(newGame(),storage).ok,false); assert.ok(loadLocal(storage).error);
  }
  const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  assert.equal(loadLocal(storage).state,null);assert.equal(saveLocal(newGame(42),storage).ok,true);assert.deepEqual(loadLocal(storage).state,newGame(42));
  data.set(SAVE_KEY,'bad JSON');assert.ok(loadLocal(storage).error);assert.equal(data.get(SAVE_KEY),'bad JSON');
});
