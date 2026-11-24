import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
await mkdir('node_modules/.cache',{recursive:true});const dir=await mkdtemp(join(process.cwd(),'node_modules/.cache/arcana-rooms-'));
try{
 for(const [folder,name] of [['lib','game'],['lib','shared-cards'],['lib','abilities'],['lib','stack'],['lib','cards'],['lib','deck-parser'],['components','card-faces'],['components','rules-text']]){
  let js=ts.transpileModule(await readFile(new URL(`../${folder}/${name}.${folder==='components'?'tsx':'ts'}`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  for(const dep of ['game','abilities','stack','deck-parser','card-art','rules-text','shared-cards'])js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`).replaceAll(`'@/lib/${dep}'`,`'./${dep}.mjs'`);
  js=js.replace("import symbols from '@/lib/card-symbols.json';","const symbols="+await readFile(new URL('../lib/card-symbols.json',import.meta.url),'utf8')+";");
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 await writeFile(join(dir,'card-art.mjs'),"import React from 'react';export const CardArt=({card,reveal})=>React.createElement('div',{'data-testid':'art'},card.faceDown&&!reveal?'Card back':card.data.name);");
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),s=await import(pathToFileURL(join(dir,'stack.mjs'))),a=await import(pathToFileURL(join(dir,'abilities.mjs'))),{normalizeCard}=await import(pathToFileURL(join(dir,'cards.mjs'))),{CardFaces,CardFaceControls}=await import(pathToFileURL(join(dir,'card-faces.mjs')));
 const raw=JSON.parse(await readFile(new URL('./fixtures/scryfall-multiface.json',import.meta.url),'utf8'));
 const roomData=normalizeCard(raw.find(c=>c.name.startsWith('Charred Foyer'))),adventureData=normalizeCard(raw.find(c=>c.name.startsWith('Decadent Dragon')));
 const setup=data=>{const p=g.emptyPlayer('Tester','commander');p.zones.hand=[g.card(data)];return p;};
 const cast=(p,back)=>g.act(p,{type:'move',uid:p.zones.hand[0].uid,to:'stack',back}).player;
 const resolve=(p,to,outcome='resolve')=>{const table=g.newTable(p,'commander');s.syncStack(table);const top=table.stack.entries[0];const result=s.applyStackCommand(table,p.id,{type:'finish',entryId:top.id,revision:table.stack.revision,to:to??s.defaultResolution(top),outcome});assert.equal(result.error,undefined);return s.applyPendingStackMoves(p,result.table);};
 let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
 check('live Scryfall Rooms and Adventures offer both halves without a back image',()=>{
  for(const data of [roomData,adventureData]){assert.ok(!data.backImage);assert.ok(g.hasFaces(g.card(data)));assert.equal(data.faces.length,2);}
  assert.ok(g.isRoom(g.card(roomData)));assert.equal(g.backFaceLabel(g.card(adventureData)),'Permanent + Adventure');
 });
 check('casting the Adventure atomically selects its name, rules and instant type',()=>{
  const p=cast(setup(adventureData),true),c=p.zones.stack[0];assert.ok(c.back);assert.equal(g.faceName(c),'Expensive Taste');assert.equal(g.activeType(c),'Instant — Adventure');assert.match(a.faceText(c),/Exile the top two cards/);
  const t=g.newTable(p,'commander');s.syncStack(t);assert.equal(t.stack.entries[0].label,'Expensive Taste');assert.equal(s.defaultResolution(t.stack.entries[0]),'exile');
 });
 check('a resolved Adventure moves to exile and the permanent can be cast from there',()=>{
  let p=resolve(cast(setup(adventureData),true));assert.equal(p.zones.exile.length,1);assert.equal(p.zones.stack.length,0);const c=p.zones.exile[0];assert.equal(c.back,false);
  p=g.act(p,{type:'move',uid:c.uid,to:'stack',back:false}).player;const t=g.newTable(p,'commander');s.syncStack(t);assert.equal(t.stack.entries[0].label,'Decadent Dragon');assert.equal(s.defaultResolution(t.stack.entries[0]),'battlefield');p=resolve(p);assert.equal(p.zones.battlefield[0].uid,c.uid);assert.equal(p.zones.battlefield[0].back,false);
 });
 check('countering an Adventure goes to graveyard rather than adventure exile',()=>{const p=resolve(cast(setup(adventureData),true),'graveyard','counter');assert.equal(p.zones.graveyard.length,1);assert.equal(p.zones.exile.length,0);});
 check('each Room door casts as itself and enters with exactly that door unlocked',()=>{
  for(const back of [false,true]){const p=cast(setup(roomData),back),t=g.newTable(p,'commander');s.syncStack(t);assert.equal(t.stack.entries[0].label,back?'Warped Space':'Charred Foyer');assert.equal(s.defaultResolution(t.stack.entries[0]),'battlefield');assert.equal(resolve(p).zones.battlefield[0].roomDoors,back?2:1);}
 });
 check('Room doors unlock and lock independently without flipping or duplicating the card',()=>{
  let p=resolve(cast(setup(roomData),false));const id=p.zones.battlefield[0].uid;
  p=g.act(p,{type:'roomDoor',uid:id,door:1,unlocked:true}).player;assert.equal(p.zones.battlefield[0].roomDoors,3);
  p=g.act(p,{type:'roomDoor',uid:id,door:0,unlocked:false}).player;assert.equal(p.zones.battlefield[0].roomDoors,2);
  p=g.act(p,{type:'roomDoor',uid:id,door:1,unlocked:false}).player;assert.equal(p.zones.battlefield[0].roomDoors,0);assert.equal(p.zones.battlefield.length,1);assert.equal(p.zones.battlefield[0].back,false);
 });
 check('Room doors survive public validation and seat recovery while hidden cards stay redacted',()=>{
  let p=resolve(cast(setup(roomData),true));const id=p.zones.battlefield[0].uid;p=g.act(p,{type:'roomDoor',uid:id,door:0,unlocked:true}).player;
  const pub=g.validatePublic(JSON.parse(JSON.stringify(g.publicPlayer(p))),p.id);assert.equal(pub.zones.battlefield[0].roomDoors,3);assert.equal(g.reconcileSeat(setup(roomData),pub,g.seatLayout(p)).zones.battlefield[0].roomDoors,3);
  const hidden=g.publicPlayer(g.act(p,{type:'faceDown',uid:id}).player);assert.ok(!JSON.stringify(hidden).includes('Charred Foyer'));assert.ok(!JSON.stringify(hidden).includes('roomDoors'));assert.equal(g.reconcileSeat(p,g.validatePublic(hidden,p.id),g.seatLayout(p)).zones.battlefield[0].roomDoors,3);
 });
 check('zone moves and batch moves reset doors; direct battlefield entry has both locked',()=>{
  let p=resolve(cast(setup(roomData),true));const id=p.zones.battlefield[0].uid;
  p=g.act(p,{type:'move',uid:id,to:'exile'}).player;assert.equal(p.zones.exile[0].roomDoors,undefined);
  p=g.act(p,{type:'move',uid:id,to:'battlefield'}).player;assert.equal(p.zones.battlefield[0].roomDoors,0);
  p=g.act(p,{type:'roomDoor',uid:id,door:0,unlocked:true}).player;p=g.act(p,{type:'moveMany',moves:[{uid:id,to:'graveyard'}]}).player;assert.equal(p.zones.graveyard[0].roomDoors,undefined);
  p=g.act(p,{type:'moveMany',moves:[{uid:id,to:'battlefield'}]}).player;assert.equal(p.zones.battlefield[0].roomDoors,0);
  const stacked=cast(setup(roomData),true);assert.equal(g.act(stacked,{type:'moveMany',moves:[{uid:stacked.zones.stack[0].uid,to:'battlefield'}]}).player.zones.battlefield[0].roomDoors,2);
 });
 check('invalid door actions cannot change ordinary cards, private cards or a nonexistent door',()=>{
  const p=setup(roomData),id=p.zones.hand[0].uid;assert.deepEqual(g.act(p,{type:'roomDoor',uid:id,door:0,unlocked:true}).player,p);
  const field=resolve(cast(p,false));for(const door of [-1,2,NaN])assert.deepEqual(g.act(field,{type:'roomDoor',uid:id,door,unlocked:true}).player,field);
  const permanent=resolve(cast(setup(adventureData),false));assert.deepEqual(g.act(permanent,{type:'roomDoor',uid:permanent.zones.battlefield[0].uid,door:0,unlocked:true}).player,permanent);
 });
 check('Room ability suggestions include all unlocked doors and exclude locked ones',()=>{
  const c=g.card({...roomData,faces:[{...roomData.faces[0],text:'Whenever a creature enters, draw a card.'},{...roomData.faces[1],text:'{T}: Add one mana.'}]});c.roomDoors=0;assert.equal(a.abilityChoices(c).length,0);c.roomDoors=1;assert.equal(a.abilityChoices(c).length,1);c.roomDoors=2;assert.equal(a.abilityChoices(c)[0].kind,'Activated');c.roomDoors=3;assert.equal(a.abilityChoices(c).length,2);
 });
 check('changing the selected Adventure face invalidates stale stack resolution',()=>{
  let p=cast(setup(adventureData),true);const t=g.newTable(p,'commander');s.syncStack(t);const revision=t.stack.revision;p=g.act(p,{type:'flip',uid:p.zones.stack[0].uid}).player;t.players[0]=g.publicPlayer(p);s.syncStack(t);assert.ok(t.stack.revision>revision);assert.equal(s.defaultResolution(t.stack.entries[0]),'battlefield');
 });
 check('the inspector presents one shared artwork and readable rules for both halves',()=>{
  for(const data of [roomData,adventureData]){const html=renderToStaticMarkup(React.createElement(CardFaces,{card:g.card(data),own:true}));assert.equal((html.match(/data-testid="art"/g)??[]).length,1);for(const f of data.faces)assert.ok(html.includes(f.name));assert.equal((html.match(/<details open/g)??[]).length,2);}
 });
 check('Room controls expose independent state, and Adventure casting exposes both choices',()=>{
  const c=resolve(cast(setup(roomData),true)).zones.battlefield[0];const html=renderToStaticMarkup(React.createElement(CardFaceControls,{card:c,zone:'battlefield',editable:true,onAction:()=>{}}));assert.match(html,/Unlock Charred Foyer/);assert.match(html,/Lock Warped Space/);assert.match(html,/aria-pressed="false"/);assert.match(html,/aria-pressed="true"/);
  const readonly=renderToStaticMarkup(React.createElement(CardFaceControls,{card:c,zone:'battlefield',editable:false,onAction:()=>{}}));assert.equal((readonly.match(/disabled=""/g)??[]).length,2);
  const adventure=renderToStaticMarkup(React.createElement(CardFaceControls,{card:g.card(adventureData),zone:'hand',editable:true,onAction:()=>{}}));assert.match(adventure,/Permanent · Decadent Dragon/);assert.match(adventure,/Adventure · Expensive Taste/);
  const hidden=renderToStaticMarkup(React.createElement(CardFaceControls,{card:{...c,faceDown:true},zone:'battlefield',editable:false,onAction:()=>{}}));assert.equal(hidden,'');
 });
 console.log(`${passed} Room and Adventure regressions passed using captured Scryfall card data.`);
}finally{await rm(dir,{recursive:true,force:true});}
