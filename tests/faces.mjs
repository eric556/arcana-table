import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-faces-'));
try {
 for(const name of ['game','stack','abilities','table-gestures','cards','deck-parser' ,'shared-cards','private-cards']){
  let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const dep of ['game','stack','abilities','table-gestures','deck-parser' ,'shared-cards','private-cards'])js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),s=await import(pathToFileURL(join(dir,'stack.mjs'))),a=await import(pathToFileURL(join(dir,'abilities.mjs'))),{normalizeCard}=await import(pathToFileURL(join(dir,'cards.mjs'))),{tableGesture}=await import(pathToFileURL(join(dir,'table-gestures.mjs')));
 let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
 const data=normalizeCard({id:'twofaces',name:'Front Spell // Back Creature',type_line:'Sorcery // Creature',card_faces:[{name:'Front Spell',type_line:'Sorcery',oracle_text:'Draw a card.',image_uris:{normal:'https://cards.scryfall.io/normal/front/a.jpg'}},{name:'Back Creature',type_line:'Creature',oracle_text:'Whenever this creature attacks, draw a card.',image_uris:{normal:'https://cards.scryfall.io/normal/back/a.jpg'}}]});
 const original=g.emptyPlayer('Player','commander');original.zones.hand=[g.card(data)];const id=original.zones.hand[0].uid;
 const back=g.act(original,{type:'flip',uid:id}).player;
 check('Scryfall faces retain their independent text and names',()=>{assert.equal(a.faceText(back.zones.hand[0]),'Whenever this creature attacks, draw a card.');assert.equal(g.faceName(back.zones.hand[0]),'Back Creature');assert.equal(g.activeType(back.zones.hand[0]),'Creature');});
 let cast=g.act(back,{type:'move',uid:id,to:'stack'}).player;let table=g.newTable(cast,'commander');s.syncStack(table);
 check('a chosen back face survives hand to stack and sets its resolution destination',()=>{assert.equal(cast.zones.stack[0].back,true);assert.equal(table.stack.entries[0].label,'Back Creature');assert.equal(s.defaultResolution(table.stack.entries[0]),'battlefield');assert.equal(original.zones.hand[0].back,false);});
 check('resolving and recovering a back-face permanent preserves its face',()=>{const top=table.stack.entries[0];const pending=s.applyStackCommand(table,cast.id,{type:'finish',entryId:top.id,revision:table.stack.revision,to:'battlefield',outcome:'resolve'}).table;const moved=s.applyPendingStackMoves(cast,pending);assert.equal(moved.zones.battlefield[0].back,true);assert.equal(moved.zones.stack.length,0);const pub=g.validatePublic(g.publicPlayer(moved),moved.id);const restored=g.reconcileSeat(original,pub,g.seatLayout(moved));assert.equal(restored.zones.battlefield[0].back,true);assert.equal(g.faceName(pub.zones.battlefield[0]),'Back Creature');});
 check('batch movement keeps a chosen face on the stack',()=>{assert.equal(g.act(back,{type:'moveMany',moves:[{uid:id,to:'stack'}]}).player.zones.stack[0].back,true);});
 check('battlefield flipping keeps tap state, counters, and card identity',()=>{let p=g.act(back,{type:'move',uid:id,to:'battlefield'}).player;p=g.act(p,{type:'tap',uid:id}).player;p=g.act(p,{type:'counter',uid:id,amount:2}).player;p=g.act(p,{type:'flip',uid:id}).player;assert.equal(p.zones.battlefield[0].back,false);assert.equal(p.zones.battlefield[0].tapped,true);assert.equal(p.zones.battlefield[0].counters,2);assert.equal(p.zones.battlefield[0].uid,id);});
 check('selecting a face in the cast picker applies atomically',()=>{const p=g.act(original,{type:'move',uid:id,to:'stack',back:true}).player;assert.equal(p.zones.stack[0].back,true);});
 check('spell/land cards use the chosen face for play routing',()=>{const c=g.card({...data,type:'Sorcery // Land',faces:[data.faces[0],{name:'Back Land',type:'Land',text:'{T}: Add mana.'}]});assert.equal(g.playDestination(c),'stack');c.back=true;assert.equal(g.playDestination(c),'battlefield');const p=g.emptyPlayer('Land test','commander');p.zones.hand=[c];const t=g.newTable(p,'commander');assert.equal(tableGesture(t,p,{kind:'card',cardId:c.uid,ownerId:p.id,combatId:t.combat.id},{kind:'zone',zone:'battlefield',ownerId:p.id}).action.to,'battlefield');});
 check('changing a stack face invalidates a stale resolve action',()=>{const revision=table.stack.revision;cast=g.act(cast,{type:'flip',uid:id}).player;table.players[0]=g.publicPlayer(cast);s.syncStack(table);assert.ok(table.stack.revision>revision);assert.equal(s.defaultResolution(table.stack.entries[0]),'graveyard');});
 check('moving out of play resets the face, and face-down snapshots hide both sides',()=>{assert.equal(g.act(back,{type:'move',uid:id,to:'graveyard'}).player.zones.graveyard[0].back,false);const p=g.act(cast,{type:'faceDown',uid:id}).player;const publicData=JSON.stringify(g.publicPlayer(p));assert.ok(!publicData.includes('Back Creature'));assert.ok(!publicData.includes('Front Spell'));});
 console.log(`${passed} double-faced card regressions passed.`);
} finally {await rm(dir,{recursive:true,force:true});}
