import { SPECIES, STARTERS, AREAS, NODES, EDGES, BEACONS } from './data.js';
import { newGame, act, member, available, objective, multiplier, damage } from './engine.js';
import { encode, decode, loadLocal, saveLocal, MAX_SAVE_BYTES } from './saves.js';
const $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { /* The storage adapter reports this honestly. */ }
const loaded = loadLocal(storage);
let state = loaded.state || newGame();
let overwriteStored = !loaded.preserve;
$('storage-status').textContent = loaded.error || (loaded.state ? 'Journey restored from this device' : 'Choose a companion to begin.');
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2),value);
    else if (key === 'disabled') node.disabled = value;
    else node.setAttribute(key,value);
  }
  for (const child of children.flat(Infinity)) if (child != null) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
function button(text, action, props = {}) {
  return el('button', { text, 'data-key': JSON.stringify(action), onclick: () => dispatch(action), ...props });
}
function portrait(id, cls = '') { return el('img',{src:`assets/${id}.svg`,alt:SPECIES[id].name,class:`creature ${cls}`,width:'160',height:'160'}); }
function badge(id) { return el('span',{class:`badge ${SPECIES[id].element}`,text:SPECIES[id].element}); }
function persist() {
  if (!overwriteStored) return;
  const result = saveLocal(state,storage);
  $('storage-status').textContent = result.message;
}
function dispatch(action) {
  const next = act(state,action);
  if (next === state) return;
  state = next; persist(); render();
}
function render() {
  const focusKey = document.activeElement?.getAttribute('data-key');
  $('objective').replaceChildren(el('span',{class:'objective-label',text:state.phase === 'ending' ? 'JOURNEY COMPLETE' : 'YOUR NEXT CHAPTER'}), el('span',{text:objective(state)}), el('span',{class:'beacon-count',text:`${state.beacons.length} / 3 beacons`}));
  const game = $('game'); game.replaceChildren();
  if (state.phase === 'choose') renderChoose(game);
  else {
    const layout = el('div',{class:'game-layout'});
    const left = el('div',{class:'journey-column'});
    if (state.phase === 'battle') renderBattle(left);
    else if (state.phase === 'ending') renderEnding(left);
    else renderWorld(left);
    layout.append(left,renderParty()); game.append(layout);
    game.append(renderJournal(),renderGuide());
  }
  if (focusKey) {
    const target = [...game.querySelectorAll('[data-key]')].find(e => e.getAttribute('data-key') === focusKey && !e.disabled && e.getAttribute('aria-disabled') !== 'true');
    (target || game.querySelector('h2')).focus({preventScroll:true});
  }
}
function title(text, props = {}) { return el('h2',{text,tabindex:'-1',...props}); }
function renderChoose(game) {
  game.append(el('div',{class:'section-heading'},el('div',{},el('p',{class:'eyebrow',text:'01 / A FRIEND FOR THE ROAD'}),title('Every journey starts with a companion.')),el('p',{text:'No wrong choice. A whole archipelago ahead.'})));
  game.append(el('div',{class:'starter-grid'}, STARTERS.map((id,i) => el('article',{class:`starter-card ${SPECIES[id].element}`},el('div',{class:'card-top'},el('span',{class:'entry-number',text:`NO. 0${i+1}`}),badge(id)),portrait(id,'starter-art'),el('h3',{text:SPECIES[id].name}),el('p',{text:SPECIES[id].text}),el('p',{class:'stats',text:`${SPECIES[id].hp} health · ${SPECIES[id].power} strike · 5 energy`}),button(`Choose ${SPECIES[id].name}`,{type:'choose',id},{class:'primary'})))));
  game.append(el('div',{class:'welcome-note'},el('span',{class:'note-icon','aria-hidden':'true',text:'✧'}),el('p',{},el('strong',{text:'Take the scenic route. '}),'A short, quiet adventure with no timers, no purchases, and no lost progress after defeat. Open “How to play” for your keeper’s handbook.')));
}
function renderWorld(parent) {
  const node = NODES[state.location], area = AREAS[node.area];
  const panel = el('section',{class:'world-panel','aria-label':'Island exploration'});
  panel.append(el('div',{class:'section-heading'},el('div',{},el('p',{class:'eyebrow',text:`ISLE 0${node.area+1} / 03`}),title(area.name)),el('span',{class:'area-subtitle',text:area.subtitle})));
  panel.append(renderMap(area));
  const paths = available(state).filter(id => NODES[id].area !== node.area);
  if (paths.length) panel.append(el('div',{class:'bridge-actions'},paths.map(to => button(`Cross bridge to ${NODES[to].name}`,{type:'move',to}))));
  panel.append(el('div',{class:'map-legend',text:'● You are here     ··· Connected paths     ◇ Beacon     ⌂ Shelter'}));
  const place = el('div',{class:'place'},el('div',{},el('p',{class:'eyebrow',text:node.kind === 'camp' ? 'A PLACE TO REST' : 'FIELD NOTES'}),el('h3',{text:node.name}),el('p',{text:node.text})));
  const actions = el('div',{class:'actions'});
  if (node.kind === 'camp') actions.append(button('Rest at shelter',{type:'rest'},{class:'primary'}));
  if (node.species) {
    const locked = node.kind === 'final' && (state.beacons.length !== 3 || state.party.length !== 3);
    actions.append(button(node.kind === 'final' ? 'Enter the final encounter' : `Approach ${SPECIES[node.species].name}`,{type:'encounter'},{class:'primary',disabled:locked}));
    if (locked) actions.append(el('p',{text:'The lighthouse needs all three beacons and a party of three.'}));
    if (state.beacons.includes(node.id)) actions.append(el('span',{class:'lit-label',text:'✧ Beacon alight'}));
  }
  place.append(actions); panel.append(place); parent.append(panel);
}
function renderMap(area) {
  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = (tag,attrs) => { const e = document.createElementNS(ns,tag); Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v)); return e; };
  const map = svgEl('svg',{viewBox:'0 0 580 380',class:`island-map area-${NODES[state.location].area}`,'aria-label':`${area.name} paths. Select a connected place to travel.`});
  const bg = svgEl('image',{href:'assets/island.svg',width:580,height:380}); map.append(bg);
  for (const [a,b] of EDGES) if (NODES[a].area === NODES[state.location].area && NODES[b].area === NODES[state.location].area) {
    map.append(svgEl('path',{d:`M ${NODES[a].x} ${NODES[a].y} Q ${(NODES[a].x+NODES[b].x)/2+12} ${(NODES[a].y+NODES[b].y)/2+20} ${NODES[b].x} ${NODES[b].y}`,class:'trail'}));
  }
  for (const n of area.nodes) {
    const current = n.id === state.location, reachable = available(state).includes(n.id);
    const g = svgEl('g',{transform:`translate(${n.x},${n.y})`,class:`map-node${current ? ' current' : ''}${reachable ? ' reachable' : ''}`,role:'button',tabindex:reachable ? '0':'-1','aria-disabled':String(!reachable),'aria-label':current ? `${n.name}, current location` : `Travel to ${n.name}`,'data-key':JSON.stringify({type:'move',to:n.id})});
    g.append(svgEl('circle',{r:current ? 27:22,class:'node-ring'}));
    const symbol = svgEl('text',{'text-anchor':'middle',y:'7',class:'node-symbol'}); symbol.textContent = current ? '●' : state.beacons.includes(n.id) ? '✧' : ({camp:'⌂',wild:'❋',beacon:'◇',final:'♜'})[n.kind]; g.append(symbol);
    const label = svgEl('text',{'text-anchor':'middle',y:'43',class:'node-label'}); label.textContent = n.name; g.append(label);
    const go = () => { if (reachable) dispatch({type:'move',to:n.id}); };
    g.addEventListener('click',go); g.addEventListener('keydown',e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); map.append(g);
  }
  return map;
}
function health(hp,max,label) { return el('div',{class:'health'},el('meter',{min:'0',max:String(max),value:String(hp),'aria-label':`${label} health`}),el('span',{text:`${hp} / ${max} HP`})); }
function renderBattle(parent) {
  const b = state.battle, c = member(state), enemy = b.enemy;
  const burstDamage = damage(SPECIES[c.id].power,SPECIES[c.id].element,SPECIES[enemy.id].element,true);
  const panel = el('section',{class:'battle-panel','aria-label':'Battle'});
  panel.append(el('div',{class:'section-heading'},el('div',{},el('p',{class:'eyebrow',text:b.kind === 'final' ? 'THE LIGHTHOUSE / FINAL ENCOUNTER' : 'A FRIENDLY BOUT'}),title(`Round ${b.round}`)),el('span',{class:'badge',text:'You act first'})));
  panel.append(el('div',{class:'battle-stage'},el('div',{class:'fighter ally'},el('p',{class:'eyebrow',text:'YOUR COMPANION'}),portrait(c.id),el('h3',{text:SPECIES[c.id].name}),badge(c.id),health(c.hp,SPECIES[c.id].hp,SPECIES[c.id].name),el('p',{class:'energy',text:`${c.energy} / 5 energy`})),el('span',{class:'versus','aria-hidden':'true',text:'✧'}),el('div',{class:'fighter enemy'},el('p',{class:'eyebrow',text:b.kind === 'final' ? 'THE GREAT BELLRAY' : 'WILD COMPANION'}),portrait(enemy.id),el('h3',{text:SPECIES[enemy.id].name}),badge(enemy.id),health(enemy.hp,enemy.maxHp,`Wild ${SPECIES[enemy.id].name}`),el('p',{class:'intent',text:`Next: ${b.intent === 'surge' ? 'elemental surge' : 'plain tap'}`}))));
  const owned = !!member(state,enemy.id);
  panel.append(el('div',{class:'battle-controls'},button(`Strike · ${SPECIES[c.id].power} damage`,{type:'strike'},{class:'primary'}),button(`Burst · ${burstDamage} damage · 2 energy`,{type:'burst'},{disabled:c.energy < 2}),button('Guard · recover 2 energy',{type:'guard'}),button(owned ? 'Already your friend' : enemy.hp <= enemy.maxHp/2 ? 'Befriend · guaranteed' : 'Befriend · needs ≤16 HP',{type:'befriend'},{disabled:owned || b.kind === 'final'})));
  panel.append(el('p',{class:'battle-tip',text:`Burst match-up: ${SPECIES[c.id].element} → ${SPECIES[enemy.id].element} ×${multiplier(SPECIES[c.id].element,SPECIES[enemy.id].element)}. Guard halves the next hit. Switching uses a turn.`}));
  if (b.kind !== 'final') panel.append(button('Retreat safely',{type:'flee'},{class:'quiet retreat'}));
  parent.append(panel);
}
function renderParty() {
  const panel = el('aside',{class:'party-panel','aria-label':'Your companions'});
  panel.append(el('p',{class:'eyebrow',text:'GOOD COMPANY'}),title('Your party'),el('p',{class:'muted',text:`${state.party.length} / 3 companions · ${state.roster.length-state.party.length} in reserve`}));
  for (const id of state.party) {
    const c = member(state,id), current = id === state.active;
    const card = el('article',{class:`party-card${current ? ' active' : ''}`},portrait(id),el('div',{},el('h3',{text:SPECIES[id].name}),badge(id),health(c.hp,SPECIES[id].hp,SPECIES[id].name),el('p',{class:'energy',text:`${c.energy} / 5 energy${current ? ' · Leading' : ''}`})));
    if (!current && state.phase !== 'ending') card.append(button(state.phase === 'battle' ? `Switch to ${SPECIES[id].name}` : `Lead with ${SPECIES[id].name}`,{type:state.phase === 'battle' ? 'switch':'lead',id},{disabled:!c.hp,class:'small'}));
    panel.append(card);
  }
  for (let i=state.party.length;i<3;i++) panel.append(el('div',{class:'empty-slot',text:'+ A friend you haven’t met yet'}));
  const reserves = state.roster.filter(c => !state.party.includes(c.id));
  if (reserves.length) {
    panel.append(el('h3',{text:'At the field station'}));
    for (const c of reserves) {
      const box = el('div',{class:'reserve'},el('strong',{text:SPECIES[c.id].name}));
      if (state.phase === 'explore') {
        const select = el('select',{'aria-label':`Companion to replace with ${SPECIES[c.id].name}`},state.party.map(id => el('option',{value:id,text:SPECIES[id].name})));
        box.append(select,el('button',{text:`Bring ${SPECIES[c.id].name}`,'data-key':`reserve-${c.id}`,onclick:() => dispatch({type:'swap',id:c.id,out:select.value})}));
      } else box.append(el('p',{text:'Change your party while exploring.'}));
      panel.append(box);
    }
  }
  panel.append(el('div',{class:'party-note'},el('span',{'aria-hidden':'true',text:'⌂ '}),'Shelters restore all friends for free. A tired party always finds its way home.'));
  return panel;
}
function renderJournal() {
  return el('section',{class:'journal','aria-label':'Recent field notes'},el('p',{class:'eyebrow',text:'IN THE MARGIN'}),el('h2',{text:'Field notes'}),el('div',{'aria-live':'polite','aria-atomic':'true',class:'latest-note',text:state.journal.at(-1)}),el('details',{},el('summary',{text:'Earlier notes'}),el('ol',{},state.journal.slice(0,-1).map(text => el('li',{text})))));
}
function renderGuide() {
  return el('details',{class:'field-guide'},el('summary',{text:`Creature field guide · ${state.seen.length} / 6 discovered`}),el('div',{class:'guide-grid'},Object.keys(SPECIES).map(id => state.seen.includes(id) ? el('article',{},portrait(id),el('h3',{text:SPECIES[id].name}),badge(id),el('p',{text:SPECIES[id].text}),el('small',{text:member(state,id) ? 'Befriended' : 'Discovered'})) : el('article',{class:'unknown'},el('span',{text:'?'}),el('p',{text:'An unwritten page'})))));
}
function renderEnding(parent) {
  parent.append(el('section',{class:'ending'},el('p',{class:'eyebrow',text:'THE LAST PAGE / A NEW BEGINNING'}),el('img',{src:'assets/lighthouse.svg',alt:'A lit lighthouse sends warm rays across three peaceful islands',width:'480',height:'280'}),title('A light to find each other.'),el('p',{text:'The great Bellray’s song carries over the sea. In the grove, a leaf uncurls. At the old kiln, a warm tail flickers. Every small beacon answers.'}),el('p',{text:'Mara closes your field guide, smiling. “A keeper doesn’t collect the islands. A keeper makes friends with them.”'}),el('p',{class:'ending-stats',text:`3 beacons alight · ${state.roster.length} friends · ${state.turns} battle turns`}),el('p',{text:'Your journey is complete. Export this field guide to keep it, or begin again with another companion and seed.'})));
}
$('help-open').onclick = () => $('help').showModal();
$('help-close').onclick = () => $('help').close();
$('reset-open').onclick = () => $('reset').showModal();
$('reset-cancel').onclick = () => $('reset').close();
$('reset-confirm').onclick = () => {
  try { const next = newGame(Number($('seed').value)); state = next; overwriteStored = true; persist(); render(); $('seed-error').textContent = ''; $('reset').close(); }
  catch (error) { $('seed-error').textContent = error.message; }
};
$('export').onclick = () => {
  const blob = new Blob([encode(state)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const link = el('a',{href:url,download:`fieldguide-isles-${state.seed}.json`});
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  $('transfer-status').textContent = 'Save exported. Keep the JSON file to restore or transfer this journey.';
};
$('import').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > MAX_SAVE_BYTES) throw new Error('Save exceeds the 32 KiB limit. Your current progress has not changed.');
    const next = decode(await file.text()); // Do not replace anything until all checks pass.
    state = next; overwriteStored = true; persist(); render();
    $('transfer-status').textContent = 'Save imported. Your journey is ready to continue.';
  } catch (error) { $('transfer-status').textContent = error.message; }
  finally { event.target.value = ''; }
};
render();
