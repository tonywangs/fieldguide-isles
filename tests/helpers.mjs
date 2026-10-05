import assert from 'node:assert/strict';
import { act, newGame, available, member } from '../src/engine.js';
import { validate, encode, decode } from '../src/saves.js';

export function driver(starter = 'spriglet', seed = 1, reload = false) {
  let state = newGame(seed);
  const actions = [];
  const step = action => {
    const next = act(state,action);
    assert.notEqual(next,state,`Illegal action: ${JSON.stringify(action)} in ${state.phase} at ${state.location}`);
    validate(next); actions.push(action); state = reload ? decode(encode(next)) : next; return state;
  };
  step({type:'choose',id:starter});
  const go = to => {
    const queue = [[state.location]], seen = new Set(); let found;
    while (queue.length) {
      const p = queue.shift(), id = p.at(-1);
      if (id === to) { found = p; break; }
      if (seen.has(id)) continue; seen.add(id);
      for (const next of available({...state,location:id})) queue.push([...p,next]);
    }
    assert.ok(found,`No path to ${to}`);
    for (const id of found.slice(1)) step({type:'move',to:id});
  };
  const bout = (befriend = false) => {
    step({type:'encounter'});
    let limit = 100;
    while (state.phase === 'battle' && limit-- > 0) {
      if (befriend && !member(state,state.battle.enemy.id)) {
        step({type:state.battle.enemy.hp <= 16 ? 'befriend':'strike'});
      } else step({type:member(state).energy >= 2 ? 'burst':'strike'});
    }
    assert.ok(limit > 0,'Battle did not terminate');
  };
  return {get state(){return state;},actions,step,go,bout};
}
export function campaign(starter,seed,reload = false) {
  const d = driver(starter,seed,reload);
  d.go('clover'); d.bout(true);
  d.go('quay'); d.step({type:'rest'});
  d.go('grove'); d.bout();
  d.go('hearth'); d.step({type:'rest'});
  d.go('kiln'); d.bout(true);
  d.go('hearth'); d.step({type:'rest'});
  d.go('forge'); d.bout();
  d.go('tidecamp'); d.step({type:'rest'});
  d.go('glass'); d.bout();
  d.go('tidecamp'); d.step({type:'rest'});
  d.go('lighthouse'); d.bout();
  assert.equal(d.state.phase,'ending',`${starter}, seed ${seed} did not win`);
  assert.equal(d.state.defeats,0);
  return d;
}
