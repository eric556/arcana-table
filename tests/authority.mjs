import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-authority-'));
try{
 const names=['game','stack','shared-cards','authority'];for(const name of names){let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;for(const dep of names)js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);await writeFile(join(dir,`${name}.mjs`),js);}
 const {projection:awaitProjection}=await import(pathToFileURL(join(dir,'shared-cards.mjs')));
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),a=await import(pathToFileURL(join(dir,'authority.mjs')));
 const mk=(name,type='Creature')=>g.card({id:g.uid(),name,type});
 const p=name=>{const p=g.emptyPlayer(name,'commander');p.zones.hand=[mk(`${name} secret hand`,'Instant'),mk(`${name} aura`,'Enchantment — Aura')];p.zones.library=Array.from({length:8},(_,i)=>mk(`${name} secret ${i}`));p.zones.battlefield=[mk(`${name} creature`)];return p;};
 const host=p('Host'),guest=p('Guest'),third=p('Third');let room=a.createAuthority(host,'commander');room.players.push(guest,third);a.refresh(room);
 const send=(id,command)=>{const e={id:g.uid(),sequence:(room.sequences[id]??0)+1,command};const r=a.reduceCommand(room,id,e);room=r.room;return {...r,envelope:e};};
 const own=id=>room.players.find(p=>p.id===id);let count=0;const test=(name,f)=>{f();count++;console.log('PASS '+name);};
 test('layers are authoritative, permission checked, replay safe and survive snapshots',()=>{
  const extra=mk('Layer neighbor'),stolen=mk('Borrowed layer');own(host.id).zones.battlefield.push(extra);stolen.controllerId=host.id;own(guest.id).zones.battlefield.push(stolen);a.refresh(room);
  const card=own(host.id).zones.battlefield[0],action={type:'layer',uid:card.uid,direction:'front'};
  assert.ok(send(guest.id,{kind:'action',action}).error);
  const result=send(host.id,{kind:'action',action});assert.equal(result.error,undefined);assert.equal(own(host.id).zones.battlefield[0].layer,2);
  room=a.reduceCommand(room,host.id,result.envelope).room;assert.equal(own(host.id).zones.battlefield[0].layer,2);
  assert.equal(send(host.id,{kind:'action',action:{...action,uid:stolen.uid,direction:'front'}}).error,undefined);assert.equal(own(guest.id).zones.battlefield.find(c=>c.uid===stolen.uid).layer,2);
  assert.equal(g.validatePublic(room.table.players.find(p=>p.id===guest.id),guest.id).zones.battlefield.find(c=>c.uid===stolen.uid).layer,2);
  own(host.id).zones.battlefield[0].movePermission=guest.id;a.refresh(room);assert.equal(send(guest.id,{kind:'action',action:{...action,direction:'back'}}).error,undefined);assert.equal(own(host.id).zones.battlefield[0].layer,0);
  assert.ok(send(host.id,{kind:'action',action:{...action,direction:'oops'}}).error);
  assert.equal(send(host.id,{kind:'action',action:{type:'move',uid:extra.uid,to:'graveyard'}}).error,undefined);assert.equal(own(host.id).zones.graveyard.find(c=>c.uid===extra.uid).layer,undefined);
  delete own(host.id).zones.battlefield[0].movePermission;own(guest.id).zones.battlefield=own(guest.id).zones.battlefield.filter(c=>c.uid!==stolen.uid);a.refresh(room);
 });
 test('commander tax is per card, persistent, owner controlled and replay safe',()=>{
  const commanders=[mk('Commander one'),mk('Commander two')];own(host.id).zones.command.push(...commanders);a.refresh(room);
  const action={type:'commanderTax',uid:commanders[0].uid,amount:2};
  assert.ok(send(guest.id,{kind:'action',action}).error);
  const change=send(host.id,{kind:'action',action});assert.equal(change.error,undefined);
  room=a.reduceCommand(room,host.id,change.envelope).room;
  assert.equal(own(host.id).zones.command[0].commanderTax,2);assert.equal(own(host.id).zones.command[1].commanderTax,undefined);
  send(host.id,{kind:'action',action:{type:'move',uid:commanders[0].uid,to:'stack'}});
  const top=room.table.stack.entries[0];assert.equal(top.card.commanderTax,2);
  send(host.id,{kind:'stack',command:{type:'finish',entryId:top.id,revision:room.table.stack.revision,to:'battlefield',outcome:'resolve'}});
  for(const to of ['graveyard','exile','command'])send(host.id,{kind:'action',action:{type:'move',uid:commanders[0].uid,to}});
  const restored=a.snapshot(JSON.parse(JSON.stringify(room)),host.id);assert.equal(restored.player.zones.command.find(c=>c.uid===commanders[0].uid).commanderTax,2);
  const pub=g.validatePublic(g.publicPlayer(own(host.id)),host.id);assert.equal(pub.zones.command.find(c=>c.uid===commanders[0].uid).commanderTax,2);
  for(let i=0;i<2;i++)send(host.id,{kind:'action',action:{...action,amount:-2}});
  assert.equal(own(host.id).zones.command.find(c=>c.uid===commanders[0].uid).commanderTax,0);
  assert.ok(send(host.id,{kind:'action',action:{...action,amount:1}}).error);
 });
 test('each seat receives its private cards and a redacted shared table',()=>{for(const id of [host.id,guest.id,third.id]){const view=a.snapshot(room,id);for(const other of room.players.filter(p=>p.id!==id)){assert.ok(!JSON.stringify(view).includes(`${other.name} secret`));assert.equal(view.table.players.find(p=>p.id===other.id).zones.hand.length,0);}}});
 test('draw replay and reconnect replay cannot draw twice',()=>{const r=send(guest.id,{kind:'action',action:{type:'draw'}});const size=own(guest.id).zones.hand.length;const twice=a.reduceCommand(structuredClone(room),guest.id,r.envelope);assert.equal(twice.duplicate,true);assert.equal(twice.room.players.find(p=>p.id===guest.id).zones.hand.length,size);assert.equal(size,3);});
 test('sequence gaps do not apply a future command',()=>{const r=a.reduceCommand(room,guest.id,{id:g.uid(),sequence:room.sequences[guest.id]+2,command:{kind:'action',action:{type:'draw'}}});assert.equal(r.gap,true);assert.equal(r.room,room);});
 test('cast and target are one transaction; invalid target rolls the move back',()=>{const card=own(guest.id).zones.hand[1];const bad=send(guest.id,{kind:'castTarget',uid:card.uid,target:{kind:'card',ownerId:host.id,cardId:'missing'},expected:{[card.uid]:'hand'}});assert.ok(bad.error);assert.ok(own(guest.id).zones.hand.some(c=>c.uid===card.uid));assert.equal(room.table.stack.entries.length,0);const ok=send(guest.id,{kind:'castTarget',uid:card.uid,target:{kind:'card',ownerId:host.id,cardId:host.zones.battlefield[0].uid},expected:{[card.uid]:'hand'}});assert.equal(ok.error,undefined);assert.equal(room.table.stack.entries[0].targets[0].cardId,host.zones.battlefield[0].uid);});
 test('resolution is atomic even with the owner offline; a competing resolution is stale',()=>{room.table.players.find(p=>p.id===guest.id).connected=false;const top=room.table.stack.entries[0],command={kind:'stack',command:{type:'finish',entryId:top.id,revision:room.table.stack.revision,to:'battlefield',outcome:'resolve'}};assert.equal(send(host.id,command).error,undefined);assert.equal(room.table.stack.entries.length,0);assert.ok(own(guest.id).zones.battlefield.some(c=>c.uid===top.cardId));assert.equal(room.table.attachments.length,1);assert.ok(send(third.id,command).error);assert.equal(own(guest.id).zones.battlefield.filter(c=>c.uid===top.cardId).length,1);room.table.players.find(p=>p.id===guest.id).connected=true;});
 test('stale move preconditions cannot retrieve a card from its new zone',()=>{const c=own(guest.id).zones.hand[0];send(guest.id,{kind:'action',action:{type:'move',uid:c.uid,to:'graveyard'},expected:{[c.uid]:'hand'}});assert.ok(send(guest.id,{kind:'action',action:{type:'move',uid:c.uid,to:'stack'},expected:{[c.uid]:'hand'}}).error);assert.ok(own(guest.id).zones.graveyard.some(x=>x.uid===c.uid));});
 test('opponent exile needs owner approval, then reveals identity only to the grantee',()=>{const options={count:1,faceDown:true,look:true,permission:'cast',note:'Until next turn',mode:'top',playerId:guest.id};send(guest.id,{kind:'shared',command:{type:'request',ownerId:host.id,source:'library',options}});const request=room.table.sharedRequests[0];assert.equal(own(host.id).zones.exile.length,0);assert.ok(send(third.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}}).error);assert.equal(send(host.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}}).error,undefined);assert.equal(room.table.sharedRequests.length,0);const c=own(host.id).zones.exile[0];assert.equal(a.snapshot(room,guest.id).player.privateCards[`${host.id}:${c.uid}`].name,c.data.name);assert.ok(!JSON.stringify(a.snapshot(room,third.id)).includes(c.data.name));assert.equal(room.table.players[0].zones.exile[0].data.id,'hidden');});
 test('borrowed spell keeps owner and controller distinct, including while owner offline',()=>{const c=own(host.id).zones.exile[0];room.table.players[0].connected=false;assert.equal(send(guest.id,{kind:'action',action:{type:'move',uid:c.uid,to:'stack'}}).error,undefined);assert.equal(room.table.stack.entries[0].controllerId,guest.id);assert.equal(room.table.stack.entries[0].ownerId,host.id);const top=room.table.stack.entries[0];send(guest.id,{kind:'stack',command:{type:'finish',entryId:top.id,revision:room.table.stack.revision,to:'battlefield',outcome:'resolve'}});assert.equal(own(host.id).zones.battlefield.find(x=>x.uid===c.uid).controllerId,guest.id);send(guest.id,{kind:'action',action:{type:'move',uid:c.uid,to:'graveyard'}});assert.ok(own(host.id).zones.graveyard.some(x=>x.uid===c.uid));assert.ok(!own(guest.id).zones.graveyard.some(x=>x.uid===c.uid));room.table.players[0].connected=true;});
 test('malformed actions and unapproved control are rejected without mutation',()=>{for(const action of [{type:'draw',count:-1},{type:'move',uid:host.zones.battlefield[0].uid,to:'hand'},{type:'namedCounter',uid:guest.zones.battlefield[0].uid,name:'__proto__',amount:1},{type:'moveMany',moves:[null]}]){const before=JSON.stringify(room.players);assert.ok(send(guest.id,{kind:'action',action}).error);assert.equal(JSON.stringify(room.players),before);}});
 test('fresh decks have server IDs and cannot overwrite life or permissions',()=>{const deck=p('Injected');deck.life=999;deck.zones.hand[0].permission={playerId:third.id,kind:'cast',look:true,note:''};const id=deck.zones.hand[0].uid;send(guest.id,{kind:'deck',player:deck});assert.equal(own(guest.id).life,40);assert.notEqual(own(guest.id).zones.hand[0].uid,id);assert.equal(own(guest.id).zones.hand[0].permission,undefined);});
 test('two faces, Saga counters, and Class levels survive authoritative snapshots',()=>{const d=p('Faces');d.zones.hand=[g.card({id:'modal',name:'Front // Back',type:'Creature',layout:'modal_dfc',faces:[{name:'Front',type:'Creature',text:''},{name:'Back',type:'Creature',text:''}]}),g.card({id:'saga',name:'Saga',type:'Enchantment — Saga',text:'I — Test\nII — Test'}),g.card({id:'class',name:'Class',type:'Enchantment — Class',text:'Test\n{1}: Level 2\nTest'})];send(guest.id,{kind:'deck',player:d});const [face,saga,klass]=own(guest.id).zones.hand;send(guest.id,{kind:'action',action:{type:'move',uid:face.uid,to:'stack',back:true}});const top=room.table.stack.entries[0];send(host.id,{kind:'stack',command:{type:'finish',entryId:top.id,revision:room.table.stack.revision,to:'battlefield',outcome:'resolve'}});for(const c of [saga,klass])send(guest.id,{kind:'action',action:{type:'move',uid:c.uid,to:'battlefield'}});for(const c of [saga,klass])send(guest.id,{kind:'action',action:{type:'progress',uid:c.uid,value:2}});const view=a.snapshot(room,guest.id);assert.equal(view.player.zones.battlefield.find(c=>c.uid===face.uid).back,true);assert.equal(view.player.zones.battlefield.find(c=>c.uid===saga.uid).namedCounters.Lore,2);assert.equal(view.player.zones.battlefield.find(c=>c.uid===klass.uid).classLevel,2);});
 test('movement permission requires approval, never changes control or grants private look, and can be revoked',()=>{
  const card=own(host.id).zones.battlefield[0];card.faceDown=true;a.refresh(room);
  assert.ok(send(third.id,{kind:'action',action:{type:'position',uid:card.uid,position:{x:.7,y:.3}}}).error);
  assert.equal(send(third.id,{kind:'shared',command:{type:'requestMove',uid:card.uid}}).error,undefined);
  let request=room.table.sharedRequests.find(r=>r.kind==='move');assert.ok(request);assert.equal(own(host.id).zones.battlefield[0].movePermission,undefined);
  assert.ok(send(guest.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}}).error);
  send(host.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}});
  assert.equal(send(third.id,{kind:'action',action:{type:'position',uid:card.uid,position:{x:.7,y:.3}}}).error,undefined);
  const moved=own(host.id).zones.battlefield[0];assert.deepEqual(moved.position,{x:.7,y:.3});assert.equal(moved.controllerId,undefined);
  assert.equal(a.snapshot(room,third.id).player.privateCards[`${host.id}:${card.uid}`],undefined);
  assert.ok(send(third.id,{kind:'action',action:{type:'tap',uid:card.uid}}).error);
  assert.ok(send(third.id,{kind:'shared',command:{type:'revokeMove',uid:card.uid}}).error);
  send(host.id,{kind:'shared',command:{type:'revokeMove',uid:card.uid}});
  assert.ok(send(third.id,{kind:'action',action:{type:'position',uid:card.uid,position:{x:.1,y:.2}}}).error);
  send(third.id,{kind:'shared',command:{type:'requestMove',uid:card.uid}});request=room.table.sharedRequests.find(r=>r.kind==='move');send(host.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}});
  send(third.id,{kind:'action',action:{type:'move',uid:card.uid,to:'graveyard'}});assert.equal(own(host.id).zones.graveyard.find(c=>c.uid===card.uid).movePermission,undefined);
 });
 test('borrowed exile is displayed at the requester’s pile while preserving custody and selective visibility',()=>{
  const options={pile:'requester',count:2,faceDown:true,look:false,permission:'play',note:'Test exile',mode:'top',playerId:third.id};
  send(third.id,{kind:'shared',command:{type:'request',ownerId:host.id,source:'library',options}});
  const request=room.table.sharedRequests[0];send(host.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}});
  const exiled=own(host.id).zones.exile.filter(c=>c.exilePileId===third.id);assert.equal(exiled.length,2);
  const shared=awaitProjection(room.table);assert.equal(shared.players.find(p=>p.id===third.id).zones.exile.length,2);assert.equal(shared.players.find(p=>p.id===host.id).zones.exile.length,0);
  assert.equal(own(third.id).zones.exile.length,0);assert.equal(a.snapshot(room,third.id).player.privateCards[`${host.id}:${exiled[0].uid}`],undefined);
  assert.ok(send(guest.id,{kind:'shared',command:{type:'exileVisibility',uid:exiled[0].uid,faceDown:false}}).error);
  assert.equal(send(third.id,{kind:'shared',command:{type:'exileVisibility',uid:exiled[0].uid,faceDown:false}}).error,undefined);
  assert.ok(JSON.stringify(a.snapshot(room,guest.id)).includes(exiled[0].data.name));assert.ok(!JSON.stringify(a.snapshot(room,guest.id)).includes(exiled[1].data.name));
  send(third.id,{kind:'action',action:{type:'move',uid:exiled[0].uid,to:'stack'}});assert.equal(room.table.stack.entries[0].ownerId,host.id);assert.equal(room.table.stack.entries[0].controllerId,third.id);assert.equal(own(host.id).zones.stack[0].exilePileId,undefined);
 });
 test('host accepts expanded-area placement and sends the same position to every seat',()=>{const c=own(third.id).zones.battlefield[0],position={x:.95,y:.04,space:'area'};assert.equal(send(third.id,{kind:'action',action:{type:'position',uid:c.uid,position}}).error,undefined);const saved=JSON.parse(JSON.stringify(room));for(const id of [host.id,guest.id,third.id]){const view=a.snapshot(saved,id);assert.deepEqual(view.table.players.find(p=>p.id===third.id).zones.battlefield.find(x=>x.uid===c.uid).position,position);}assert.ok(send(guest.id,{kind:'action',action:{type:'position',uid:c.uid,position:{x:.1,y:.1,space:'area'}}}).error);assert.ok(send(third.id,{kind:'action',action:{type:'position',uid:c.uid,position:{...position,space:'unbounded'}}}).error);});
 test('taking control requires approval, preserves ownership/state/attachments, and is replay safe',()=>{
  const creature=mk('Control target'),aura=mk('Attached aura','Enchantment — Aura');creature.tapped=true;creature.counters=3;creature.namedCounters={Charge:2};own(host.id).zones.battlefield.push(creature,aura);a.refresh(room);
  room.table.attachments.push({ownerId:host.id,cardId:aura.uid,target:{kind:'card',ownerId:host.id,cardId:creature.uid}});
  const position={x:.62,y:.48,space:'area'};
  assert.equal(send(guest.id,{kind:'shared',command:{type:'requestControl',uid:creature.uid,position}}).error,undefined);let request=room.table.sharedRequests.find(r=>r.kind==='control');
  assert.equal(own(host.id).zones.battlefield.find(c=>c.uid===creature.uid).controllerId,undefined);
  assert.ok(send(third.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}}).error);
  const approved=send(host.id,{kind:'shared',command:{type:'decide',id:request.id,approved:true}});assert.equal(approved.error,undefined);room=a.reduceCommand(room,host.id,approved.envelope).room;
  const stolen=own(host.id).zones.battlefield.find(c=>c.uid===creature.uid);assert.equal(stolen.controllerId,guest.id);assert.equal(stolen.tapped,true);assert.equal(stolen.counters,3);assert.deepEqual(stolen.namedCounters,{Charge:2});assert.deepEqual(stolen.position,position);assert.equal(own(guest.id).zones.battlefield.some(c=>c.uid===creature.uid),false);
  assert.ok(awaitProjection(room.table).players.find(p=>p.id===guest.id).zones.battlefield.some(c=>c.uid===creature.uid));assert.equal(room.table.attachments.find(x=>x.cardId===aura.uid).target.ownerId,guest.id);
  assert.ok(send(host.id,{kind:'action',action:{type:'tap',uid:creature.uid}}).error);assert.equal(send(guest.id,{kind:'action',action:{type:'tap',uid:creature.uid}}).error,undefined);assert.equal(send(guest.id,{kind:'action',action:{type:'namedCounter',uid:creature.uid,name:'Charge',amount:1}}).error,undefined);
  room.table.phase=2;room.table.turn=guest.id;assert.equal(send(guest.id,{kind:'combat',command:{type:'attack',cardId:creature.uid,targetId:third.id,combatId:room.table.combat.id}}).error,undefined);
  assert.equal(send(guest.id,{kind:'stack',command:{type:'ability',label:'Borrowed ability',sourceCardId:creature.uid}}).error,undefined);
  const restored=a.snapshot(JSON.parse(JSON.stringify(room)),guest.id);assert.equal(restored.table.players.find(p=>p.id===host.id).zones.battlefield.find(c=>c.uid===creature.uid).controllerId,guest.id);
  // Returning control needs no extra permission from the owner, but only the controller may do it.
  assert.ok(send(third.id,{kind:'shared',command:{type:'returnControl',uid:creature.uid}}).error);
  assert.equal(send(guest.id,{kind:'shared',command:{type:'returnControl',uid:creature.uid}}).error,undefined);assert.equal(own(host.id).zones.battlefield.find(c=>c.uid===creature.uid).controllerId,undefined);assert.ok(!room.table.combat.attacks.some(c=>c.cardId===creature.uid));assert.equal(room.table.attachments.find(x=>x.cardId===aura.uid).target.ownerId,host.id);
 });
 test('current controllers approve subsequent control changes and stale approvals cannot steal a moved card',()=>{
  const c=mk('Control chain');own(host.id).zones.battlefield.push(c);a.refresh(room);
  const request=actor=>{assert.equal(send(actor,{kind:'shared',command:{type:'requestControl',uid:c.uid}}).error,undefined);return room.table.sharedRequests.find(r=>r.kind==='control'&&r.cardId===c.uid&&r.requesterId===actor);};
  let r=request(guest.id);send(host.id,{kind:'shared',command:{type:'decide',id:r.id,approved:false}});assert.equal(own(host.id).zones.battlefield.find(x=>x.uid===c.uid).controllerId,undefined);
  r=request(guest.id);send(host.id,{kind:'shared',command:{type:'decide',id:r.id,approved:true}});r=request(third.id);assert.equal(r.approverId,guest.id);assert.ok(send(host.id,{kind:'shared',command:{type:'decide',id:r.id,approved:true}}).error);assert.equal(send(guest.id,{kind:'shared',command:{type:'decide',id:r.id,approved:true}}).error,undefined);
  r=request(guest.id);send(third.id,{kind:'action',action:{type:'move',uid:c.uid,to:'graveyard'}});assert.ok(send(third.id,{kind:'shared',command:{type:'decide',id:r.id,approved:true}}).error);assert.ok(own(host.id).zones.graveyard.some(x=>x.uid===c.uid&&!x.controllerId));assert.equal(own(third.id).zones.graveyard.some(x=>x.uid===c.uid),false);
 });
 test('face-down control changes share private identity only with the new controller',()=>{
  const c=mk('Hidden control identity');c.faceDown=true;own(host.id).zones.battlefield.push(c);a.refresh(room);
  send(guest.id,{kind:'shared',command:{type:'requestControl',uid:c.uid}});const r=room.table.sharedRequests.find(r=>r.cardId===c.uid);send(host.id,{kind:'shared',command:{type:'decide',id:r.id,approved:true}});
  assert.equal(a.snapshot(room,guest.id).player.privateCards[`${host.id}:${c.uid}`].name,c.data.name);assert.ok(!JSON.stringify(a.snapshot(room,third.id)).includes(c.data.name));
  send(guest.id,{kind:'shared',command:{type:'returnControl',uid:c.uid}});assert.equal(a.snapshot(room,guest.id).player.privateCards[`${host.id}:${c.uid}`],undefined);
 });
 test('offered control requires the recipient, supports decline/cancel and survives reconnect',()=>{
  const c=mk('Offered card');c.faceDown=true;own(host.id).zones.battlefield.push(c);a.refresh(room);
  const offer={type:'offerControl',uid:c.uid,recipientId:guest.id};
  assert.ok(send(third.id,{kind:'shared',command:offer}).error);
  assert.ok(send(host.id,{kind:'shared',command:{...offer,recipientId:host.id}}).error);
  const start=()=>{assert.equal(send(host.id,{kind:'shared',command:offer}).error,undefined);return room.table.sharedRequests.find(r=>r.kind==='offerControl'&&r.cardId===c.uid);};
  let req=start();assert.equal(req.approverId,guest.id);assert.equal(req.requesterId,host.id);assert.equal(own(host.id).zones.battlefield.find(x=>x.uid===c.uid).controllerId,undefined);assert.equal(a.snapshot(room,guest.id).player.privateCards[`${host.id}:${c.uid}`],undefined);
  assert.ok(send(host.id,{kind:'shared',command:{type:'decide',id:req.id,approved:true}}).error);
  assert.ok(send(third.id,{kind:'shared',command:{type:'decide',id:req.id,approved:true}}).error);
  assert.equal(send(guest.id,{kind:'shared',command:{type:'decide',id:req.id,approved:false}}).error,undefined);
  req=start();assert.equal(send(host.id,{kind:'shared',command:{type:'cancel',id:req.id}}).error,undefined);
  req=start();room=JSON.parse(JSON.stringify(room));assert.ok(a.snapshot(room,guest.id).table.sharedRequests.some(r=>r.id===req.id));
  const accepted=send(guest.id,{kind:'shared',command:{type:'decide',id:req.id,approved:true}});assert.equal(accepted.error,undefined);room=a.reduceCommand(room,guest.id,accepted.envelope).room;
  assert.equal(own(host.id).zones.battlefield.find(x=>x.uid===c.uid).controllerId,guest.id);assert.ok(!own(guest.id).zones.battlefield.some(x=>x.uid===c.uid));assert.equal(a.snapshot(room,guest.id).player.privateCards[`${host.id}:${c.uid}`].name,c.data.name);assert.ok(!JSON.stringify(a.snapshot(room,third.id)).includes(c.data.name));
 });
 test('stale offers cannot transfer a moved or newly controlled card',()=>{
  const c=mk('Stale offer');own(host.id).zones.battlefield.push(c);a.refresh(room);
  send(host.id,{kind:'shared',command:{type:'offerControl',uid:c.uid,recipientId:guest.id}});const req=room.table.sharedRequests.find(r=>r.cardId===c.uid);
  send(host.id,{kind:'action',action:{type:'move',uid:c.uid,to:'graveyard'}});assert.ok(send(guest.id,{kind:'shared',command:{type:'decide',id:req.id,approved:true}}).error);
  send(host.id,{kind:'shared',command:{type:'cancel',id:req.id}});
 });
 test('offered and borrowed cards go to their original owner on death or renewed exile',()=>{
  for(const to of ['graveyard','exile']){const c=mk('Returns to owner '+to);own(host.id).zones.battlefield.push(c);a.refresh(room);
   send(host.id,{kind:'shared',command:{type:'offerControl',uid:c.uid,recipientId:guest.id}});const req=room.table.sharedRequests.find(r=>r.cardId===c.uid);send(guest.id,{kind:'shared',command:{type:'decide',id:req.id,approved:true}});
   assert.equal(send(guest.id,{kind:'action',action:{type:'move',uid:c.uid,to}}).error,undefined);
   const returned=own(host.id).zones[to].find(x=>x.uid===c.uid);assert.ok(returned);assert.equal(returned.controllerId,undefined);assert.equal(returned.permission,undefined);assert.equal(returned.exilePileId,undefined);assert.ok(!own(guest.id).zones[to].some(x=>x.uid===c.uid));assert.ok(awaitProjection(room.table).players.find(p=>p.id===host.id).zones[to].some(x=>x.uid===c.uid));
  }
 });
 console.log(`${count} authority regressions passed.`);
}finally{await rm(dir,{recursive:true,force:true});}
