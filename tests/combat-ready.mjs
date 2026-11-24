import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
await mkdir('node_modules/.cache',{recursive:true});
const dir=await mkdtemp(join(process.cwd(),'node_modules/.cache/combat-ready-'));
try {
 const modules=['game','stack','shared-cards','authority','combat-controls'];
 for(const name of modules){const ui=name==='combat-controls';let js=ts.transpileModule(await readFile(new URL(`../${ui?'components':'lib'}/${name}.${ui?'tsx':'ts'}`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;for(const dep of modules)js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`).replaceAll(`'@/lib/${dep}'`,`'./${dep}.mjs'`);await writeFile(join(dir,`${name}.mjs`),js);}
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),a=await import(pathToFileURL(join(dir,'authority.mjs'))),{CombatControls}=await import(pathToFileURL(join(dir,'combat-controls.mjs')));
 const card=(name,type='Creature')=>g.card({id:g.uid(),name,type});
 const players=['Attacker','Bob','Cara','Observer'].map(name=>g.emptyPlayer(name,'commander'));
 const [host,bob,cara,observer]=players;host.zones.battlefield=[card('One'),card('Two')];bob.zones.battlefield=[card('Blocker')];cara.zones.battlefield=[card('Walker','Planeswalker')];
 let room=a.createAuthority(host,'commander');room.players.push(...players.slice(1));a.refresh(room);room.table=g.advanceTurn(room.table,2);
 const send=(id,command)=>{const envelope={id:g.uid(),sequence:(room.sequences[id]??0)+1,command};const r=a.reduceCommand(room,id,envelope);room=r.room;return {...r,envelope};};
 const combat=(id,type,extra={})=>send(id,{kind:'combat',command:{type,combatId:room.table.combat.id,...extra}});
 const html=id=>renderToStaticMarkup(React.createElement(CombatControls,{table:room.table,viewerId:id,onCommand:()=>{}}));
 assert.ok(combat(bob.id,'finishBlockers').error);
 combat(host.id,'attack',{cardId:host.zones.battlefield[0].uid,targetId:bob.id});combat(host.id,'attack',{cardId:host.zones.battlefield[1].uid,targetId:cara.id,targetCardId:cara.zones.battlefield[0].uid});
 combat(host.id,'finishAttackers');assert.deepEqual(g.combatDefenders(room.table),[bob.id,cara.id]);assert.equal(g.combatReady(room.table),false);
 assert.ok(combat(observer.id,'finishBlockers').error);assert.ok(combat(host.id,'finishBlockers').error);
 assert.match(html(bob.id),/I am done declaring/);assert.doesNotMatch(html(observer.id),/I am done declaring/);assert.match(html(host.id),/0\/2 defenders ready/);
 combat(bob.id,'block',{cardId:bob.zones.battlefield[0].uid,attackerCardId:host.zones.battlefield[0].uid});combat(bob.id,'finishBlockers');assert.equal(g.combatReady(room.table),false);assert.match(html(bob.id),/Edit my blockers/);
 room.table.players.find(p=>p.id===cara.id).connected=false;a.refresh(room);assert.equal(g.combatReady(room.table),false);assert.match(html(bob.id),/Cara \(disconnected\)/);assert.ok(combat(cara.id,'finishBlockers').error);room.table.players.find(p=>p.id===cara.id).connected=true;
 const finished=combat(cara.id,'finishBlockers');assert.equal(finished.error,undefined);assert.equal(g.combatReady(room.table),true);assert.match(html(host.id),/All defenders are done declaring/);assert.match(html(host.id),/Ready to resolve combat/);
 const logCount=()=>room.table.log.filter(x=>x.text.startsWith('All defenders are done')).length;assert.equal(logCount(),1);
 room=a.reduceCommand(room,cara.id,finished.envelope).room;combat(cara.id,'finishBlockers');assert.equal(logCount(),1);
 room=JSON.parse(JSON.stringify(room));for(const p of players){const view=a.snapshot(room,p.id);assert.equal(g.combatReady(view.table),true);assert.deepEqual(view.table.combat.defendersDone,[bob.id,cara.id]);}
 combat(host.id,'finishAttackers');assert.equal(g.combatReady(room.table),true);
 console.log('PASS all attacked players, including planeswalker defenders and zero-block defenders, must confirm; replay and reconnect retain readiness');
 const control=structuredClone(room.table),{setPermanentController}=await import(pathToFileURL(join(dir,'shared-cards.mjs')));setPermanentController(control.players.find(p=>p.id===bob.id).zones.battlefield[0],bob.id,observer.id,control);assert.equal(g.combatReady(control),false);assert.deepEqual(control.combat.defendersDone,[cara.id]);
 combat(bob.id,'editBlockers');assert.equal(g.combatReady(room.table),false);assert.deepEqual(room.table.combat.defendersDone,[cara.id]);combat(bob.id,'finishBlockers');
 combat(bob.id,'block',{cardId:bob.zones.battlefield[0].uid});assert.equal(g.combatReady(room.table),false);assert.deepEqual(room.table.combat.defendersDone,[cara.id]);
 combat(bob.id,'block',{cardId:bob.zones.battlefield[0].uid,attackerCardId:host.zones.battlefield[0].uid});combat(bob.id,'finishBlockers');
 send(bob.id,{kind:'action',action:{type:'move',uid:bob.zones.battlefield[0].uid,to:'graveyard'}});assert.equal(g.combatReady(room.table),false);assert.deepEqual(room.table.combat.defendersDone,[cara.id]);
 const stale=room.table.combat.id;combat(host.id,'editAttackers');assert.deepEqual(room.table.combat.defendersDone,[]);assert.equal(room.table.combat.blocks.length,0);assert.ok(combat(cara.id,'finishBlockers',{combatId:stale}).error);
 const next=g.advanceTurn(room.table,3);assert.equal(g.combatReady(next),false);assert.deepEqual(next.combat.attacks,[]);
 const empty=g.advanceTurn(g.newTable(host,'commander'),2);const locked=g.applyCombatGesture(empty,host.id,{type:'finishAttackers',combatId:empty.combat.id}).table;assert.equal(g.combatReady(locked),false);
 console.log('PASS changing blocks, removing blockers, reopening attackers, and changing phases invalidate the appropriate confirmations');
} finally {await rm(dir,{recursive:true,force:true});}
