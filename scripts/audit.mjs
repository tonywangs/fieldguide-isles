import { execFileSync } from 'node:child_process';
import { readFile,writeFile,lstat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
const inventory=[];
for(const file of files) {
  assert.ok(!file.endsWith('.log') || file === 'results/tests.log',`Excluded publication log: ${file}`);
  assert.ok(!/(^|\/)(\.env|node_modules|\.agents|\.codex)(\/|$)/.test(file),`Unexpected file: ${file}`);
  assert.ok((await lstat(file)).isFile(),`Only regular files allowed: ${file}`);
  if(file==='results/artifacts.json') continue; // Its own content hash is intentionally not recursive.
  const content=await readFile(file);
  assert.ok(content.length<=10*1024*1024,`File exceeds 10 MiB: ${file}`);
  inventory.push({file,bytes:content.length,sha256:createHash('sha256').update(content).digest('hex')});
}
const runtime=inventory.filter(({file})=>file==='index.html'||file==='style.css'||file.startsWith('src/')||file.startsWith('assets/'));
const report={description:'Inventory excludes this report itself to avoid a recursive hash. Bounds below include the report.',runtimeFiles:runtime.length,runtimeBytes:runtime.reduce((a,r)=>a+r.bytes,0),files:inventory};
const output=JSON.stringify(report,null,2)+'\n';
const totalBytes=inventory.reduce((a,r)=>a+r.bytes,0)+Buffer.byteLength(output),fileCount=inventory.length+1;
assert.ok(Buffer.byteLength(output)<=10*1024*1024);assert.ok(totalBytes<=32*1024*1024,'Tree exceeds 32 MiB');assert.ok(fileCount<=1000,'Tree exceeds 1,000 files');
await writeFile('results/artifacts.json',output);
console.log(JSON.stringify({fileCount,totalBytes,runtimeFiles:runtime.length,runtimeBytes:report.runtimeBytes,maxFileBytes:Math.max(Buffer.byteLength(output),...inventory.map(r=>r.bytes)),limits:'10 MiB per file; 32 MiB total; 1,000 files'},null,2));
