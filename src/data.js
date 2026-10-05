// All names, descriptions, map geometry and artwork are original to this game.
export const SPECIES = Object.freeze({
  spriglet: { name: 'Spriglet', element: 'leaf', hp: 48, power: 11, color: '#83ae73', text: 'A little seed courier. It leaves a trail of clover wherever it naps.' },
  cindermoth: { name: 'Cindermoth', element: 'ember', hp: 44, power: 12, color: '#ed986b', text: 'A warm-winged night wanderer. Its lantern spots never burn the leaves.' },
  pebblefin: { name: 'Pebblefin', element: 'tide', hp: 52, power: 10, color: '#78b9c9', text: 'A patient tide-pool swimmer with a pebble tucked behind each fin.' },
  fernwhorl: { name: 'Fernwhorl', element: 'leaf', hp: 48, power: 11, color: '#b3bd70', text: 'A fern-shelled spiral crawler. It remembers every footstep in the grove.' },
  kilnkit: { name: 'Kilnkit', element: 'ember', hp: 44, power: 12, color: '#d79887', text: 'A small clay fox that warms abandoned nests with its many bright tails.' },
  bellray: { name: 'Bellray', element: 'tide', hp: 52, power: 10, color: '#9faedc', text: 'A floating ray whose glassy antenna rings when the sea fog gathers.' }
});
export const STARTERS = ['spriglet', 'cindermoth', 'pebblefin'];
export const AREAS = [
  { name: 'Clover Quay', subtitle: 'Where the little journeys begin', color: '#acc896', nodes: [
    { id: 'quay', name: 'Field station', x: 100, y: 215, kind: 'camp', text: 'Mara, the keeper, hands you a blank field guide. “Three beacons have gone quiet. Meet the island creatures, earn their trust, and bring the light home.”' },
    { id: 'clover', name: 'Clover patch', x: 270, y: 130, kind: 'wild', species: 'fernwhorl', text: 'Curled fronds rustle beneath a carpet of clover. A patient Fernwhorl waits for you.' },
    { id: 'nursery', name: 'Seed nursery', x: 285, y: 290, kind: 'wild', species: 'spriglet', text: 'Tiny footprints lead between the seed pots. Spriglet peeks over a leaf.' },
    { id: 'grove', name: 'Grove beacon', x: 460, y: 180, kind: 'beacon', species: 'fernwhorl', text: 'A fern spiral guards the first beacon. Complete a friendly bout or earn its trust to relight it.' }
  ] },
  { name: 'Cinder Reach', subtitle: 'Warm stone beneath a copper sky', color: '#d9b18b', nodes: [
    { id: 'hearth', name: 'Hearth shelter', x: 100, y: 215, kind: 'camp', text: 'A kettle hums on the warm stones. Every traveler is welcome to rest here.' },
    { id: 'kiln', name: 'Old kiln', x: 270, y: 130, kind: 'wild', species: 'kilnkit', text: 'Three tails glow in the kiln doorway. Kilnkit tilts its head at your field guide.' },
    { id: 'lantern', name: 'Lantern garden', x: 285, y: 290, kind: 'wild', species: 'cindermoth', text: 'Warm wings drift above the garden, lighting flowers that bloom only at dusk.' },
    { id: 'forge', name: 'Ember beacon', x: 460, y: 180, kind: 'beacon', species: 'kilnkit', text: 'The second beacon has a little clay guardian. A friendly challenge will wake its glow.' }
  ] },
  { name: 'Glasswater Isle', subtitle: 'Listen for a bell beneath the waves', color: '#9fc5cb', nodes: [
    { id: 'tidecamp', name: 'Tide shelter', x: 100, y: 215, kind: 'camp', text: 'Wind chimes mark a safe place to rest. Beyond the sand, the lighthouse stands silent.' },
    { id: 'pool', name: 'Pebble pools', x: 260, y: 100, kind: 'wild', species: 'pebblefin', text: 'Smooth stones circle a deep pool. Pebblefin breaks the surface with a gentle splash.' },
    { id: 'bells', name: 'Bell shallows', x: 265, y: 280, kind: 'wild', species: 'bellray', text: 'A clear note rings over the shallows. Bellray rises from the mist.' },
    { id: 'glass', name: 'Tide beacon', x: 425, y: 125, kind: 'beacon', species: 'bellray', text: 'The last small beacon sleeps inside a shell. Its guardian asks for one final friendly bout.' },
    { id: 'lighthouse', name: 'The lighthouse', x: 475, y: 285, kind: 'final', species: 'bellray', text: 'The great Bellray is tangled in the lighthouse fog. Three lit beacons and three companions can guide it home.' }
  ] }
];
export const EDGES = [['quay','clover'],['quay','nursery'],['clover','grove'],['nursery','grove'],['grove','hearth'],['hearth','kiln'],['hearth','lantern'],['kiln','forge'],['lantern','forge'],['forge','tidecamp'],['tidecamp','pool'],['tidecamp','bells'],['pool','glass'],['bells','glass'],['glass','lighthouse'],['bells','lighthouse']];
export const NODES = Object.fromEntries(AREAS.flatMap((area, index) => area.nodes.map(node => [node.id, { ...node, area: index }])));
export const BEACONS = ['grove', 'forge', 'glass'];
export const neighbors = id => EDGES.flatMap(([a,b]) => a === id ? [b] : b === id ? [a] : []);
export const MAX_ENERGY = 5;
export const SAVE_VERSION = 1;
