import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-stack-'));
try{
 for(const name of ['game','stack' ,'shared-cards']){
  const source=await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll("from './shared-cards'","from './shared-cards.mjs'").replaceAll("from './game'","from './game.mjs'").replaceAll("from './stack'","from './stack.mjs'");
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),s=await import(pathToFileURL(join(dir,'stack.mjs')));
 let passed=0;const check=(name,f)=>{f();passed++;console.log(`PASS ${name}`);};
 const mk=(name,type='Instant')=>g.card({id:g.uid(),name,type});
 const player=(name)=>{const p=g.emptyPlayer(name,'commander');p.zones.hand=[mk(`${name} spell`),mk(`${name} PRIVATE hand`)];p.zones.library=[mk(`${name} PRIVATE library`)];p.zones.sideboard=[mk(`${name} PRIVATE sideboard`)];p.zones.battlefield=[mk(`${name} permanent`,'Creature'),{...mk(`${name} PRIVATE morph`,'Creature'),faceDown:true}];return p;};
 const cast=p=>g.act(p,{type:'move',uid:p.zones.hand[0].uid,to:'stack'}).player;
 const setup=()=>{const p=cast(player('Alice')),q=player('Bob'),t=g.newTable(p,'commander');t.players.push(g.publicPlayer(q));s.syncStack(t);return {p,q,t};};
 const finish=(t,actor,to='graveyard',outcome='resolve',entryId=t.stack.entries[0].id)=>s.applyStackCommand(t,actor,{type:'finish',entryId,revision:t.stack.revision,to,outcome});
 check('casting routes instants, sorceries, and permanents through stack while lands play directly',()=>{for(const type of ['Instant','Sorcery','Artifact Creature','Enchantment'])assert.equal(g.playDestination(mk('Card',type)),'stack');assert.equal(g.playDestination(mk('Land','Basic Land')),'battlefield');assert.equal(g.playDestination({...mk('Morph','Land'),faceDown:true}),'stack');});
 check('stack projection contains only public spells, with no hidden card identities',()=>{const {p,t}=setup();assert.equal(t.stack.entries.length,1);assert.equal(t.stack.entries[0].label,'Alice spell');assert.ok(!JSON.stringify(t).includes('PRIVATE'));assert.equal(p.zones.hand.length,1);assert.equal(t.players[0].zones.hand.length,0);});
 check('abilities retain their source and do not trigger any game effects',()=>{const {p,t}=setup();const r=s.applyStackCommand(t,p.id,{type:'ability',label:'Draw two',description:'Target Bob',sourceCardId:p.zones.battlefield[0].uid});assert.equal(r.error,undefined);assert.equal(r.table.stack.entries[0].kind,'ability');assert.equal(r.table.stack.entries[0].sourceName,'Alice permanent');assert.deepEqual(r.table.players,t.players);assert.equal(r.table.stack.entries[0].respondsTo,t.stack.entries[0].id);});
 check('ability sources cannot read private zones or another player’s cards',()=>{const {p,q,t}=setup();for(const sourceCardId of [p.zones.hand[0].uid,q.zones.battlefield[0].uid,'missing'])assert.ok(s.applyStackCommand(t,p.id,{type:'ability',label:'Invalid source',sourceCardId}).error);const r=s.applyStackCommand(t,p.id,{type:'ability',label:'Morph ability',sourceCardId:p.zones.battlefield[1].uid});assert.equal(r.table.stack.entries[0].sourceName,'Face-down card');assert.ok(!JSON.stringify(r.table).includes('PRIVATE'));});
 check('malformed abilities and unauthenticated actors are rejected',()=>{const {p,t}=setup();for(const command of [null,{type:'ability',label:''},{type:'ability',label:'x'.repeat(161)},{type:'ability',label:'A',description:123},{type:'finish',entryId:t.stack.entries[0].id,revision:t.stack.revision,to:'hand',outcome:'unknown'}])assert.ok(s.applyStackCommand(t,p.id,command).error);assert.ok(s.applyStackCommand(t,'intruder',{type:'ability',label:'A'}).error);});
 check('readiness signals do not resolve and reset on a response',()=>{const {p,q,t}=setup();let r=s.applyStackCommand(t,q.id,{type:'pass',revision:t.stack.revision});assert.deepEqual(r.table.stack.passes,[q.id]);assert.equal(r.table.stack.entries.length,1);r=s.applyStackCommand(r.table,p.id,{type:'ability',label:'Response'});assert.deepEqual(r.table.stack.passes,[]);assert.equal(r.table.stack.entries.length,2);});
 check('every manual resolution destination moves exactly one owned card once',()=>{for(const to of s.STACK_DESTINATIONS){const {p,q,t}=setup();const before=g.ZONES.flatMap(z=>p.zones[z]).map(c=>c.uid).sort();const r=finish(t,q.id,to);assert.equal(r.error,undefined);assert.equal(r.table.stack.entries.length,1);assert.ok(r.table.stack.entries[0].pending);const moved=s.applyPendingStackMoves(p,r.table);assert.equal(moved.zones.stack.length,0);assert.ok(moved.zones[to].some(c=>c.uid===p.zones.stack[0].uid));assert.deepEqual(g.ZONES.flatMap(z=>moved.zones[z]).map(c=>c.uid).sort(),before);assert.equal(s.applyPendingStackMoves(moved,r.table),moved);assert.equal(s.applyPendingStackMoves(q,r.table),q);r.table.players[0]=g.publicPlayer(moved);s.syncStack(r.table);assert.equal(r.table.stack.entries.length,0);assert.equal(p.zones.stack.length,1);}});
 check('face-down spells do not expose identity in stack or resolution logs',()=>{const {p,q,t}=setup();p.zones.stack[0].faceDown=true;p.zones.stack[0].data.name='PRIVATE morph spell';t.players[0]=g.publicPlayer(p);s.syncStack(t);assert.equal(t.stack.entries[0].label,'Face-down spell');const r=finish(t,q.id,'hand');const moved=s.applyPendingStackMoves(p,r.table);r.table.players[0]=g.publicPlayer(moved);s.syncStack(r.table);assert.ok(!JSON.stringify(r.table).includes('PRIVATE'));});
 check('manual card movement removes its stack entry without touching other entries',()=>{const {p,t}=setup();let r=s.applyStackCommand(t,p.id,{type:'ability',label:'Ability stays'}).table;r.players[0]=g.publicPlayer(g.act(p,{type:'move',uid:p.zones.stack[0].uid,to:'exile'}).player);s.syncStack(r);assert.equal(r.stack.entries.length,1);assert.equal(r.stack.entries[0].label,'Ability stays');});

 // Protocol-8 integration coverage lives in authority.mjs and recovery.mjs.
 console.log(`${passed} stack behavior checks passed.`);
}finally{await rm(dir,{recursive:true,force:true});}
