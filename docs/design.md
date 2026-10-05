# Fieldguide Isles: bounded game design

A quiet, original creature adventure, with three connected areas, six species, a traveling party of three, six total roster slots (one per species), and one final encounter. The lighthouse guardian is a larger Bellray, not a seventh species. A campaign can be completed in a few dozen deliberate actions; no timer, accounts, purchases, procedural maze, grinding, or network service is involved.

## Existing work and scope

Sources inspected on 2026-10-05:

- [Pokémon Showdown simulator documentation](https://github.com/smogon/pokemon-showdown/blob/master/sim/README.md) exposes battle simulation separately from its interface. This project likewise separates its deterministic transition engine from its DOM renderer, but implements a much smaller, unrelated ruleset.
- [Tuxemon](https://github.com/Tuxemon/Tuxemon) is an established open-source monster-fighting RPG. Creature recruitment, exploration, and turn-based combat are existing genre conventions. Fieldguide Isles makes no novelty claim and imports none of Tuxemon's assets or code.

All code, names, dialogue, map geometry, and SVG illustrations in this repository were authored for this project. The familiar genre is the starting point; a modest campaign that works entirely on a local computer is the deliverable.

## World and progression

| Area | Shelter | Encounters | Beacon | Next path |
| --- | --- | --- | --- | --- |
| Clover Quay | Field station | Fernwhorl, Spriglet | Grove beacon / Fernwhorl | Cinder Reach |
| Cinder Reach | Hearth shelter | Kilnkit, Cindermoth | Ember beacon / Kilnkit | Glasswater Isle |
| Glasswater Isle | Tide shelter | Pebblefin, Bellray | Tide beacon / Bellray | Lighthouse |

The 13 location nodes and 16 undirected edges are explicit in `src/data.js`. Crossing into area N requires N lit beacons. A creature is discovered by visiting its location. Encounters start only when the player chooses to approach; all remain available after retreat or defeat. Lighting a beacon by victory **or** friendship permanently opens the next area. Repeating an already-lit beacon gives no extra progression.

The final encounter requires all three beacons and a party of three. No recruitment rolls or consumables exist: any unowned ordinary creature at 16 HP or less accepts friendship. Newly recruited companions arrive fully rested. When three are traveling, further companions enter the reserve. Any reserve member can replace a party member outside battle, provided someone in the resulting party can fight. Shelters heal the entire roster for free. The ending is terminal; export it or explicitly start a new journey.

### A reproducible winning route

For any starter: recruit Fernwhorl at the Clover patch; rest at the Field station; clear the Grove beacon; rest at Hearth shelter; recruit Kilnkit at the Old kiln; rest; clear the Ember beacon; rest at Tide shelter; clear the Tide beacon; rest; enter the lighthouse. Use strikes until a recruitable enemy has ≤16 HP, then befriend it. In other bouts use burst whenever energy permits, otherwise strike. The engine automatically sends in a healthy party member when the leader tires.

`tests/helpers.mjs` expresses this route using legal actions and graph search. It is verified for **seeds 1–100 for each starter**, not asserted as a mathematical proof for every 32-bit seed. Independently of combat luck, defeat preserves every unlock and returns all companions to full strength; no resource can be permanently exhausted. Players can retry, recruit additional species, change the leader, and exploit element matchups.

## Battle specification (save/rules version 1)

All transitions live in `src/engine.js`; there is no DOM, clock, or global random generator in that module. `act(state, action)` returns a new state for a legal action, or the exact original object for an invalid action. It does not mutate its arguments. Each input is one deliberate action; holding Space or clicking a still-valid action repeatedly can take multiple turns. Stale inputs (such as encounter during battle or move to the same location) do nothing.

### Stats

| Species | Element | Max HP | Strike power |
| --- | --- | ---: | ---: |
| Spriglet | Leaf | 48 | 11 |
| Cindermoth | Ember | 44 | 12 |
| Pebblefin | Tide | 52 | 10 |
| Fernwhorl | Leaf | 48 | 11 |
| Kilnkit | Ember | 44 | 12 |
| Bellray | Tide | 52 | 10 |

Every companion has 5 maximum energy. Ordinary enemies have 32 HP and 6 power; the final Bellray has 110 HP and 12 power. Species stats apply to recruited companions, not to their encounter HP/power.

### Turn order and costs

1. The player acts first. Strike costs nothing. Burst costs 2 energy; insufficient energy is an invalid action, so the enemy does not get a free hit. Guard recovers 2 energy up to 5. Switching to a different healthy party member consumes a turn and the enemy hits the incoming member. You may not switch to a tired or reserved member.
2. Victory or successful recruitment ends the encounter immediately; the enemy gets no final attack and no further randomness is consumed. A failed friendship attempt above half health consumes the turn. Attempting to recruit an owned creature or the final guardian is invalid. Recruitment costs no item or energy, and is guaranteed at half HP or below.
3. Otherwise the enemy executes its displayed intent: a neutral tap or elemental surge. A guard halves this hit only. A tired player companion is automatically replaced by the first healthy party member, in party order. If nobody is healthy, the whole roster is healed at that area's shelter; all beacons and discoveries survive.
4. If battle continues, increase the round and draw the next intent. An ordinary retreat ends battle without an enemy turn. The final encounter has no retreat action, but defeat still recovers safely.

Outside battle, moving, resting, choosing a starter, changing the leader, and exchanging reserve members consume no battle turns or randomness. Health and energy persist between encounters until shelter rest; there is no passive regeneration.

### Damage

```
max(1, floor((power + variance) × attackFactor × guardFactor))
```

- Player variance is always 0; enemy variance is −1, 0, or +1, drawn uniformly from the seeded generator.
- Strike/tap: attack factor 1, regardless of elements.
- Burst/surge: attack factor `1.6 × elementMultiplier`.
- Guard factor is 0.5 when guarding, otherwise 1.
- Leaf beats Tide; Tide beats Ember; Ember beats Leaf. Strong element multiplier = 1.5, weak = 0.75, same = 1.
- Damage subtracts from current HP and clamps at 0. Surplus damage does not carry to the next companion.

Examples calculated independently of the engine: an 11-power Leaf burst against Tide deals `floor(11 × 1.6 × 1.5) = 26`. Against Ember it deals `floor(11 × 1.6 × .75) = 13`. A guarded 6-power Tide surge with +1 variance against Ember deals `floor(7 × 1.6 × 1.5 × .5) = 8`.

### Randomness and replay

A nonzero 32-bit integer seed initializes xorshift32. Each draw performs XOR shifts left 13, unsigned right 17, left 5, stores the result as an unsigned integer, and divides by 2³². The zero seed/state is rejected. At encounter creation one draw chooses surge if `< .35`, otherwise tap. Every enemy turn draws variance with `floor(draw × 3) − 1`; if the battle continues, a further draw chooses the next intent. Defeat does not draw a next intent. Player actions never roll damage or recruitment. Save files preserve the generator state exactly.

`results/campaigns.json` holds SHA-256 hashes of `JSON.stringify(finalState)` for all 300 fixed campaigns. `results/example-replay.json` includes one full legal action sequence. `npm test` checks committed hashes rather than overwriting them. `node scripts/campaigns.mjs` is an explicit fixture regeneration command, intended only after reviewing rules changes.

## Limits

This is a small authored game, not a general-purpose RPG engine. There are no levels, inventory, audio, animations, multiplayer, cloud saves, custom names, or postgame exploration. The finite map uses labeled destinations, not free movement. Automated browser campaigns and screenshot review do not substitute for human playtesting or assistive-technology testing. Balance is deliberately forgiving; claims about challenge, accessibility, and enjoyment require human evaluation.
