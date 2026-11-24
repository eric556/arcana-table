import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-play-request-'));
try{
 const names=['game','stack','shared-cards','authority','zone-play-request'];for(const name of names){let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;for(const dep of names)js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);await writeFile(join(dir,`${name}.mjs`),js);}
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),a=await import(pathToFileURL(join(dir,'authority.mjs'))),{zonePlayRequest}=await import(pathToFileURL(join(dir,'zone-play-request.mjs')));
 for(const source of ['graveyard','exile']){
  const owner=g.emptyPlayer('Owner','commander'),guest=g.emptyPlayer('Guest','commander'),card=g.card({id:g.uid(),name:'Secret borrowed spell',type:'Instant'});card.faceDown=source==='exile';owner.zones[source]=[card];
  let room=a.createAuthority(owner,'commander');room.players.push(guest);a.refresh(room);
  const send=(actor,command)=>{const res=a.reduceCommand(room,actor,{id:g.uid(),sequence:(room.sequences[actor]??0)+1,command});room=res.room;return res;};
  const item={kind:'card',cardId:card.uid,ownerId:guest.id,combatId:room.table.combat.id};
  for(const target of [{kind:'stack'},{kind:'player',ownerId:guest.id},{kind:'zone',ownerId:guest.id,zone:'battlefield'}])assert.ok(zonePlayRequest(room.table,guest.id,item,target));
  assert.equal(zonePlayRequest(room.table,guest.id,item,{kind:'zone',ownerId:guest.id,zone:'hand'}),null);
  assert.equal(zonePlayRequest(room.table,guest.id,item,{kind:'zone',ownerId:owner.id,zone:'battlefield'}),null);
  const request=zonePlayRequest(room.table,guest.id,item,{kind:'stack'});assert.equal(request.options.moveToExile,false);assert.equal(request.options.faceDown,card.faceDown);assert.equal(request.source,source);
  assert.equal(send(guest.id,{kind:'shared',command:request}).error,undefined);
  assert.ok(send(guest.id,{kind:'shared',command:request}).error,'repeat drag must not create duplicate requests');
  assert.equal(room.table.sharedRequests.length,1);assert.equal(room.players[0].zones[source].length,1);assert.equal(room.table.stack.entries.length,0);
  if(source==='exile')assert.ok(!JSON.stringify(a.snapshot(room,guest.id)).includes('Secret borrowed spell'));
  assert.ok(send(guest.id,{kind:'action',action:{type:'move',uid:card.uid,to:'stack'}}).error);
  const pending=room.table.sharedRequests[0];assert.ok(send(guest.id,{kind:'shared',command:{type:'decide',id:pending.id,approved:true}}).error);
  assert.equal(send(owner.id,{kind:'shared',command:{type:'decide',id:pending.id,approved:true}}).error,undefined);
  assert.equal(room.players[0].zones[source].length,0,'approval must complete the original drop');
  assert.equal(zonePlayRequest(room.table,guest.id,item,{kind:'stack'}),null,'approved drags take normal play path');
  assert.equal(room.table.stack.entries.length,1);assert.equal(room.table.stack.entries[0].ownerId,owner.id);assert.equal(room.table.stack.entries[0].controllerId,guest.id);
  console.log(`PASS ${source}: drag requests, no duplicates, owner approval, hidden identity, automatic borrowed casting`);
 }

 for(const mode of ['battlefield','target','decline','moved','targetMoved']){
  const owner=g.emptyPlayer('Owner','commander'),guest=g.emptyPlayer('Guest','commander'),card=g.card({id:g.uid(),name:'Borrowed permanent',type:'Creature'}),targetCard=g.card({id:g.uid(),name:'Target',type:'Creature'});owner.zones.graveyard=[card];guest.zones.battlefield=[targetCard];
  let room=a.createAuthority(owner,'commander');room.players.push(guest);a.refresh(room);
  const send=(actor,command)=>{const envelope={id:g.uid(),sequence:(room.sequences[actor]??0)+1,command};const res=a.reduceCommand(room,actor,envelope);room=res.room;return {...res,envelope};};
  const target=mode==='target'||mode==='targetMoved'?{kind:'card',ownerId:guest.id,cardId:targetCard.uid}:{kind:'zone',zone:'battlefield',ownerId:guest.id,position:{x:.2,y:.3}};
  const req=zonePlayRequest(room.table,guest.id,{kind:'card',cardId:card.uid,ownerId:guest.id,combatId:room.table.combat.id},target);
  assert.equal(send(guest.id,{kind:'shared',command:req}).error,undefined);
  const id=room.table.sharedRequests[0].id;
  if(mode==='moved')send(owner.id,{kind:'action',action:{type:'move',uid:card.uid,to:'hand'}});
  if(mode==='targetMoved')send(guest.id,{kind:'action',action:{type:'move',uid:targetCard.uid,to:'graveyard'}});
  const approved=send(owner.id,{kind:'shared',command:{type:'decide',id,approved:mode!=='decline'}});
  if(mode==='moved'||mode==='targetMoved'){assert.ok(approved.error);assert.equal(room.players[0].zones.battlefield.length,0);assert.equal(room.table.stack.entries.length,0);}
  else if(mode==='decline'){assert.equal(approved.error,undefined);assert.equal(room.players[0].zones.graveyard.length,1);assert.equal(room.players[0].zones.battlefield.length,0);assert.equal(room.table.sharedRequests.length,0);}
  else {
   assert.equal(approved.error,undefined);assert.equal(room.players[0].zones.graveyard.length,0);
   if(mode==='battlefield'){const moved=room.players[0].zones.battlefield[0];assert.equal(moved.uid,card.uid);assert.equal(moved.controllerId,guest.id);assert.deepEqual(moved.position,{x:.2,y:.3});}
   else assert.deepEqual(room.table.stack.entries[0].targets,[{kind:'card',ownerId:guest.id,cardId:targetCard.uid}]);
   assert.deepEqual(a.reduceCommand(room,owner.id,approved.envelope).room.players,room.players,'approval retry must not repeat the move');
   assert.equal(room.table.sharedRequests.length,0);
  }
  console.log(`PASS automatic approval: ${mode}`);
 }
}finally{await rm(dir,{recursive:true,force:true});}
