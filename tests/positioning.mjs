import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-placement-'));
try{
 for(const name of ['game','stack','abilities','table-gestures','shared-cards']){
  let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const dep of ['game','stack','abilities','shared-cards'])js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),{tableGesture}=await import(pathToFileURL(join(dir,'table-gestures.mjs')));
 let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
 let p=g.emptyPlayer('Owner','commander');const c=g.card({id:'creature',name:'Creature',type:'Creature'});c.tapped=true;c.counters=3;p.zones.battlefield=[c];
 const t=g.newTable(p,'commander'),item={kind:'card',cardId:c.uid,ownerId:p.id,combatId:t.combat.id},target={kind:'zone',zone:'battlefield',ownerId:p.id,position:{x:.71,y:.34}};
 check('moving a permanent repositions it without recreating or resetting it',()=>{const r=tableGesture(t,p,item,target);assert.equal(r.action.type,'position');p=g.act(p,r.action).player;assert.deepEqual(p.zones.battlefield[0].position,target.position);assert.equal(p.zones.battlefield[0].tapped,true);assert.equal(p.zones.battlefield[0].counters,3);assert.equal(p.zones.battlefield[0].uid,c.uid);});
 check('positions survive host sanitization and reconnect, including face-down cards',()=>{for(const faceDown of [false,true]){const local=structuredClone(p);local.zones.battlefield[0].faceDown=faceDown;const pub=g.validatePublic(g.publicPlayer(local),p.id);const restored=g.reconcileSeat(local,pub,g.seatLayout(local));assert.deepEqual(pub.zones.battlefield[0].position,target.position);assert.deepEqual(restored.zones.battlefield[0].position,target.position);if(faceDown)assert.equal(pub.zones.battlefield[0].data.name,'Face-down card');}});
 check('leaving the battlefield clears placement for single and batch moves',()=>{assert.equal(g.act(p,{type:'move',uid:c.uid,to:'graveyard'}).player.zones.graveyard[0].position,undefined);assert.equal(g.act(p,{type:'moveMany',moves:[{uid:c.uid,to:'hand'}]}).player.zones.hand[0].position,undefined);});
 check('land drops remember their spot while spells still use the stack',()=>{for(const type of ['Land','Instant']){const local=g.emptyPlayer('Owner','commander',p.id),card=g.card({id:type,name:type,type});local.zones.hand=[card];const r=tableGesture(t,local,{...item,cardId:card.uid},target);const moved=g.act(local,r.action).player;assert.equal(moved.zones[type==='Land'?'battlefield':'stack'].length,1);assert.deepEqual(moved.zones[type==='Land'?'battlefield':'stack'][0].position,type==='Land'?target.position:undefined);}});
 check('positions are bounded and invalid coordinates cannot corrupt the board',()=>{assert.deepEqual(g.act(p,{type:'position',uid:c.uid,position:{x:-3,y:2}}).player.zones.battlefield[0].position,{x:0,y:1});for(const x of [NaN,Infinity,'bad'])assert.deepEqual(g.act(p,{type:'position',uid:c.uid,position:{x,y:0}}).player,p);});
 check('opponents cannot reposition cards and tidy preserves card state',()=>{assert.equal(tableGesture(t,p,{...item,ownerId:'opponent'},target).kind,'invalid');const tidy=g.act(p,{type:'arrange'}).player;assert.deepEqual(tidy.zones.battlefield[0].position,{x:0,y:0});assert.equal(tidy.zones.battlefield[0].tapped,true);assert.equal(tidy.zones.battlefield[0].counters,3);});
 check('expanded placement survives sanitization and reconnect without exposing face-down identity',()=>{const position={x:.94,y:.08,space:'area'};let local=g.act(p,{type:'position',uid:c.uid,position}).player;local.zones.battlefield[0].faceDown=true;assert.deepEqual(local.zones.battlefield[0].position,position);const pub=g.validatePublic(g.publicPlayer(local),p.id);assert.deepEqual(pub.zones.battlefield[0].position,position);assert.equal(pub.zones.battlefield[0].data.name,'Face-down card');assert.deepEqual(g.reconcileSeat(local,pub,g.seatLayout(local)).zones.battlefield[0].position,position);});
 console.log(`${passed} free-placement regressions passed.`);
}finally{await rm(dir,{recursive:true,force:true});}
