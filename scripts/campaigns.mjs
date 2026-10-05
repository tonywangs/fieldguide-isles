import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { STARTERS } from '../src/data.js';
import { campaign } from '../tests/helpers.mjs';
const records=[];
for(const starter of STARTERS) for(let seed=1;seed<=100;seed++) {
  const d=campaign(starter,seed,true);
  records.push({starter,seed,actions:d.actions.length,turns:d.state.turns,hash:createHash('sha256').update(JSON.stringify(d.state)).digest('hex')});
}
writeFileSync(new URL('../results/campaigns.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
const example=campaign('spriglet',1);
writeFileSync(new URL('../results/example-replay.json',import.meta.url),JSON.stringify({starter:'spriglet',seed:1,actions:example.actions,finalHash:records[0].hash},null,2)+'\n');
console.log(`Recorded ${records.length} successful deterministic campaigns.`);
