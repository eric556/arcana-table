import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-mulligan-'));
try{
 const names=['game','stack','shared-cards','authority'];for(const name of names){let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;for(const dep of names)js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);await writeFile(join(dir,`${name}.mjs`),js);}
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),a=await import(pathToFileURL(join(dir,'authority.mjs')));
 const mk=name=>g.card({id:g.uid(),name,type:'Creature'});
 const p=g.emptyPlayer('Mulligan','commander');p.zones.library=Array.from({length:10},(_,i)=>mk('Library '+i));p.zones.hand=Array.from({length:7},(_,i)=>mk('Hand '+i));
 p.zones.battlefield=[{...mk('Field'),tapped:true,back:true,faceDown:true,counters:4,namedCounters:{Shield:2},position:{x:20,y:30},classLevel:3,roomDoors:3}, {...mk('Token'),token:true,tokenCount:20}];
 for(const z of ['graveyard','exile','command','sideboard','stack'])p.zones[z]=[mk(z)];
 p.zones.exile[0].faceDown=true;p.zones.exile[0].permission={playerId:'other',look:true,kind:'play',note:'Until end of turn'};
 const before=structuredClone(p),expected=[...p.zones.library,...p.zones.hand,p.zones.battlefield[0],...p.zones.graveyard,...p.zones.exile].map(c=>c.uid).sort();
 const result=g.act(p,{type:'mulligan'}).player;
 assert.deepEqual(p,before);assert.equal(result.zones.hand.length,7);assert.equal(result.zones.library.length,13);assert.equal(result.zones.battlefield.length,0);
 const shuffled=[...result.zones.hand,...result.zones.library];assert.deepEqual(shuffled.map(c=>c.uid).sort(),expected);
 const returned=shuffled.find(c=>c.uid===p.zones.battlefield[0].uid);assert.equal(returned.tapped,false);assert.equal(returned.back,false);assert.equal(returned.faceDown,false);assert.equal(returned.counters,0);for(const key of ['namedCounters','position','classLevel'])assert.equal(returned[key],undefined);
 for(const z of ['graveyard','exile'])assert.equal(result.zones[z].length,0);
 const exiled=shuffled.find(c=>c.uid===p.zones.exile[0].uid);assert.equal(exiled.faceDown,false);assert.equal(exiled.permission,undefined);
 for(const z of ['command','sideboard','stack'])assert.deepEqual(result.zones[z],p.zones[z]);
 console.log('PASS full hand, battlefield, graveyard and exile reset, seven dealt, state cleared, tokens vanish, other zones unchanged');
 const short=g.emptyPlayer('Short','60-card');short.zones.battlefield=[mk('Only card')];const small=g.act(short,{type:'mulligan'}).player;assert.equal(small.zones.hand.length,1);assert.equal(small.zones.library.length,0);assert.equal(small.zones.battlefield.length,0);
 for(const zone of ['graveyard','exile']){const q=g.emptyPlayer(zone,'commander');q.zones[zone]=Array.from({length:9},()=>mk(zone));const n=g.act(q,{type:'mulligan'}).player;assert.equal(n.zones.hand.length,7);assert.equal(n.zones.library.length,2);assert.equal(n.zones[zone].length,0);}
 console.log('PASS battlefield-only and undersized decks draw all available cards without duplicates');
 const opponent=g.emptyPlayer('Other','commander'),borrowed=mk('Borrowed'),loaned=mk('Loaned');borrowed.controllerId=p.id;opponent.zones.battlefield=[borrowed,mk('Other field')];loaned.controllerId=opponent.id;p.zones.battlefield.push(loaned);
 let room=a.createAuthority(p,'commander');room.players.push(opponent);a.refresh(room);room.table.combat.attacks=[{cardId:p.zones.battlefield[0].uid,attackerId:p.id,targetId:opponent.id}];room.table.attachments=[{cardId:borrowed.uid,ownerId:p.id,target:{kind:'card',cardId:p.zones.battlefield[0].uid,ownerId:p.id}}];
 const envelope={id:g.uid(),sequence:1,command:{kind:'action',action:{type:'mulligan'}}};const r=a.reduceCommand(room,p.id,envelope);assert.equal(r.error,undefined);room=r.room;
 const me=room.players.find(x=>x.id===p.id),other=room.players.find(x=>x.id===opponent.id);assert.deepEqual(me.zones.battlefield.map(c=>c.uid),[loaned.uid]);assert.equal(other.zones.library[0].uid,borrowed.uid);assert.equal(other.zones.library[0].controllerId,undefined);assert.equal(other.zones.battlefield.length,1);assert.equal(other.zones.hand.length,0);assert.equal(room.table.attachments.length,0);assert.equal(room.table.combat.attacks.length,0);
 assert.deepEqual(a.reduceCommand(room,p.id,envelope).room.players,room.players,'retry must not deal again');
 const snapshot=a.snapshot(room,opponent.id);assert.equal(snapshot.table.players.find(x=>x.id===p.id).counts.hand,7);assert.equal(snapshot.table.players.find(x=>x.id===p.id).zones.hand.length,0);
 console.log('PASS host authority, replay safety, ownership, public hand privacy, attachment and combat cleanup');
}finally{await rm(dir,{recursive:true,force:true});}
