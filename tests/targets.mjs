import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-targets-'));
try{
 for(const name of ['game','abilities','stack','table-gestures','cards','deck-parser' ,'shared-cards']){
  let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const dep of ['game','abilities','stack','table-gestures','deck-parser' ,'shared-cards'])js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),s=await import(pathToFileURL(join(dir,'stack.mjs'))),a=await import(pathToFileURL(join(dir,'abilities.mjs'))),{tableGesture}=await import(pathToFileURL(join(dir,'table-gestures.mjs'))),{normalizeCard}=await import(pathToFileURL(join(dir,'cards.mjs')));
 let passed=0;const check=(name,fn)=>{fn();console.log(`PASS ${name}`);passed++;};
 check('custom tokens retain deduplicated keywords and multiline abilities',()=>{
  const p=g.act(g.emptyPlayer('Token owner','commander'),{type:'token',name:'Spirit',stats:'2/3',keywords:'Flying, vigilance, flying',abilities:'{T}: Add one mana of any color.\nWhen this token dies, draw a card.'}).player;
  const c=p.zones.battlefield[0];assert.deepEqual(c.data.keywords,['Flying','vigilance']);assert.equal(c.data.power,'2');assert.equal(c.data.toughness,'3');assert.equal(c.data.text,'Flying, vigilance\n{T}: Add one mana of any color.\nWhen this token dies, draw a card.');
  assert.deepEqual(a.abilityChoices(c).map(x=>x.kind),['Activated','Triggered']);
  const pub=g.validatePublic(JSON.parse(JSON.stringify(g.publicPlayer(p))),p.id);assert.deepEqual(pub.zones.battlefield[0].data.keywords,c.data.keywords);assert.equal(pub.zones.battlefield[0].data.text,c.data.text);
  const choice=a.abilityChoices(c)[0],t=g.newTable(p,'commander');const result=s.applyStackCommand(t,p.id,{type:'ability',label:choice.label,description:choice.text,sourceCardId:c.uid});assert.equal(result.error,undefined);assert.equal(result.table.stack.entries[0].description,choice.text);assert.equal(result.table.players[0].zones.battlefield.length,1);
  const hidden=g.act(p,{type:'faceDown',uid:c.uid}).player;assert.ok(!JSON.stringify(g.publicPlayer(hidden)).includes('Add one mana'));assert.ok(!JSON.stringify(g.publicPlayer(hidden)).includes('vigilance'));
 });
 check('plain tokens stay compatible and custom token text fits peer limits',()=>{
  const p=g.emptyPlayer('Owner','commander');const plain=g.act(p,{type:'token',name:'Soldier',stats:'1/1'}).player.zones.battlefield[0];assert.equal(plain.token,true);assert.equal(plain.data.text,undefined);
  const long=g.act(p,{type:'token',name:'Long',stats:'1/1',keywords:'Flying,'.repeat(200),abilities:'x'.repeat(5000)}).player;const text=long.zones.battlefield[0].data.text;assert.ok(text.length<4000);assert.equal(g.validatePublic(g.publicPlayer(long),p.id).zones.battlefield[0].data.text,text);
 });
 const mk=(name,type='Creature',text='')=>g.card({id:g.uid(),name,type,text});
 const player=name=>{const p=g.emptyPlayer(name,'commander');p.zones.battlefield=[mk(`${name} creature`),mk(`${name} equipment`,'Artifact — Equipment','Equipped creature gets +1/+1.\nEquip {2}'),{...mk(`${name} SECRET`),faceDown:true}];p.zones.hand=[mk(`${name} aura`,'Enchantment — Aura','Enchant creature\nEnchanted creature can’t attack.'),mk(`${name} spell`,'Instant','Destroy target creature.'),mk(`${name} SECRET hand`)];p.zones.library=[mk(`${name} SECRET library`)];return p;};
 let p=player('Alice'),q=player('Bob'),t=g.newTable(p,'commander');t.players.push(g.publicPlayer(q));
 const target={kind:'card',ownerId:q.id,cardId:q.zones.battlefield[0].uid};
 const held=card=>({kind:'card',cardId:card.uid,ownerId:p.id,combatId:t.combat.id});
 check('dropping a hand card on another battlefield casts it with a target without transferring ownership',()=>{
  const r=tableGesture(t,p,held(p.zones.hand[0]),target);assert.equal(r.kind,'castTarget');p=g.act(p,{type:'move',uid:r.cardId,to:'stack'}).player;t.players[0]=g.publicPlayer(p);s.syncStack(t);t=s.applyStackCommand(t,p.id,{type:'target',cardId:r.cardId,target:r.target}).table;
  assert.equal(t.stack.entries[0].ownerId,p.id);assert.deepEqual(t.stack.entries[0].targets,[target]);assert.equal(t.players[1].zones.stack.length,0);assert.ok(!JSON.stringify(t).includes('SECRET'));
 });
 check('aura resolution moves exactly one owned card and tucks it beneath the opponent’s target',()=>{
  const entry=t.stack.entries[0],before=g.ZONES.flatMap(z=>p.zones[z]).map(c=>c.uid).sort();t=s.applyStackCommand(t,q.id,{type:'finish',entryId:entry.id,revision:t.stack.revision,to:'battlefield',outcome:'resolve'}).table;
  p=s.applyPendingStackMoves(p,t);assert.equal(s.applyPendingStackMoves(p,t),p);t.players[0]=g.publicPlayer(p);s.syncStack(t);
  assert.equal(t.stack.entries.length,0);assert.deepEqual(t.attachments,[{ownerId:p.id,cardId:entry.cardId,target}]);assert.ok(p.zones.battlefield.some(c=>c.uid===entry.cardId));assert.equal(q.zones.battlefield.length,3);assert.deepEqual(g.ZONES.flatMap(z=>p.zones[z]).map(c=>c.uid).sort(),before);
 });
 check('equipment can attach to your own or another player’s creature without moving or tapping it',()=>{
  const eq=p.zones.battlefield[1];for(const chosen of [target,{kind:'card',ownerId:p.id,cardId:p.zones.battlefield[0].uid}]){const gesture=tableGesture(t,p,held(eq),chosen);assert.equal(gesture.command.type,'attach');const r=s.applyStackCommand(t,p.id,gesture.command);assert.equal(r.error,undefined);t=r.table;assert.deepEqual(t.attachments.find(x=>x.cardId===eq.uid).target,chosen);assert.equal(p.zones.battlefield[1].tapped,false);}
 });
 check('dragging an attachment home detaches without touching its target',()=>{const r=tableGesture(t,p,held(p.zones.battlefield[1]),{kind:'zone',zone:'battlefield',ownerId:p.id});assert.equal(r.command.type,'attach');assert.equal(r.command.target,undefined);const before=structuredClone(t.players);t=s.applyStackCommand(t,p.id,r.command).table;assert.equal(t.attachments.length,1);assert.deepEqual(t.players,before);});
 check('attachment ownership, target existence, self attachment and attachment cycles are validated',()=>{
  const eq=p.zones.battlefield[1],creature=p.zones.battlefield[0];assert.ok(s.applyStackCommand(t,q.id,{type:'attach',cardId:eq.uid,target}).error);
  assert.ok(s.applyStackCommand(t,p.id,{type:'attach',cardId:eq.uid,target:{...target,cardId:'missing'}}).error);
  assert.ok(s.applyStackCommand(t,p.id,{type:'attach',cardId:eq.uid,target:{kind:'card',ownerId:p.id,cardId:eq.uid}}).error);
  const linked=s.applyStackCommand(t,p.id,{type:'attach',cardId:eq.uid,target:{kind:'card',ownerId:p.id,cardId:creature.uid}}).table;
  assert.ok(s.applyStackCommand(linked,p.id,{type:'attach',cardId:creature.uid,target:{kind:'card',ownerId:p.id,cardId:eq.uid}}).error);
 });
 check('an attachment detaches when its target leaves; zone moves and effects stay manual',()=>{const before=g.ZONES.flatMap(z=>p.zones[z]).length;t.players[1]=g.publicPlayer(g.act(q,{type:'move',uid:target.cardId,to:'graveyard'}).player);s.syncStack(t);assert.equal(t.attachments.length,0);assert.equal(g.ZONES.flatMap(z=>p.zones[z]).length,before);assert.ok(p.zones.battlefield.some(c=>c.data.type.includes('Aura')));t.players[1]=g.publicPlayer(q);s.syncStack(t);assert.equal(t.attachments.length,0);});
 check('multiple spell targets are public, controller-owned, removable, and reset response signals',()=>{
  p=g.act(p,{type:'move',uid:p.zones.hand[0].uid,to:'stack'}).player;t.players[0]=g.publicPlayer(p);s.syncStack(t);const entry=t.stack.entries[0];
  for(const to of [target,{kind:'player',ownerId:q.id}]){const gesture=tableGesture(t,p,{kind:'stack',entryId:entry.id,revision:t.stack.revision},to);assert.equal(gesture.command.type,'target');t=s.applyStackCommand(t,p.id,gesture.command).table;}
  assert.equal(t.stack.entries[0].targets.length,2);assert.ok(s.applyStackCommand(t,q.id,{type:'target',entryId:entry.id,target}).error);
  t=s.applyStackCommand(t,q.id,{type:'pass',revision:t.stack.revision}).table;t=s.applyStackCommand(t,p.id,{type:'target',entryId:entry.id,target}).table;assert.equal(t.stack.entries[0].targets.length,1);assert.equal(t.stack.passes.length,0);
 });
 check('targeting a player never resolves the spell or gives them the caster’s card',()=>{const entry=t.stack.entries[0],r=tableGesture(t,p,{kind:'stack',entryId:entry.id,revision:t.stack.revision},{kind:'player',ownerId:q.id});assert.equal(r.command.type,'target');assert.equal(p.zones.stack.length,1);assert.equal(q.zones.stack.length,0);});
 check('the same target toggles off regardless of property order',()=>{const entry=t.stack.entries[0];const first=s.applyStackCommand(t,p.id,{type:'target',entryId:entry.id,target}).table;const second=s.applyStackCommand(first,p.id,{type:'target',entryId:entry.id,target:{cardId:target.cardId,kind:'card',ownerId:target.ownerId}}).table;assert.ok(!second.stack.entries[0].targets.some(x=>x.kind==='card'));});
 check('targets leaving and returning do not silently reattach an aura to a new object',()=>{const entry=t.stack.entries[0];t=s.applyStackCommand(t,p.id,{type:'target',entryId:entry.id,target}).table;t.players[1]=g.publicPlayer(g.act(q,{type:'move',uid:target.cardId,to:'hand'}).player);s.syncStack(t);assert.ok(!t.stack.entries[0].targets.some(x=>x.kind==='card'));t.players[1]=g.publicPlayer(q);s.syncStack(t);assert.ok(!t.stack.entries[0].targets.some(x=>x.kind==='card'));});
 check('ability source drags offer Oracle text and a target without moving the permanent',()=>{const r=tableGesture(t,p,held(p.zones.battlefield[0]),target);assert.equal(r.kind,'ability');assert.deepEqual(r.target,target);const entry=s.applyStackCommand(t,p.id,{type:'ability',label:'Ability',description:'Effect',sourceCardId:r.card.uid,target:r.target}).table.stack.entries[0];assert.deepEqual(entry.targets,[target]);assert.equal(entry.sourceCard.uid,r.card.uid);});
 check('ability parsing keeps activated, triggered, loyalty and modal text while excluding static and granted text',()=>{
  const c=mk('Ability source','Creature','Flying\nOther creatures get +1/+1.\nEquipped creature has “{T}: Add {G}.”\n{2}, {T}: Draw a card.\nWhenever you draw a card, gain 1 life.\n−2: Choose one —\n• Draw two cards.\n• Create a token.');const choices=a.abilityChoices(c);assert.equal(choices.length,3);assert.equal(choices[0].kind,'Activated');assert.equal(choices[1].kind,'Triggered');assert.match(choices[2].text,/• Create a token/);assert.equal(a.abilityChoices({...c,faceDown:true}).length,0);assert.equal(a.abilityChoices(p.zones.battlefield[1])[0].label,'Equip {2}');const legacy=mk('Day // Night','Creature','Day\n{T}: Add {W}.\n\nNight\nWhenever this attacks, draw a card.');assert.equal(a.abilityChoices(legacy).length,1);assert.equal(a.abilityChoices({...legacy,back:true})[0].kind,'Triggered');
 });
 check('Scryfall normalization and peer redaction preserve per-face text and keywords without extra lookups',()=>{const data=normalizeCard({id:'fixture',name:'Front // Back',type_line:'Creature // Creature',keywords:['Flying'],card_faces:[{name:'Front',type_line:'Creature',oracle_text:'{T}: Add {G}.'},{name:'Back',type_line:'Creature',oracle_text:'Whenever this attacks, draw a card.'}]});const c=g.card(data);assert.match(a.abilityChoices(c)[0].text,/Add/);c.back=true;assert.match(a.abilityChoices(c)[0].text,/Whenever/);const pub=g.validatePublic(g.publicPlayer({...p,zones:{...p.zones,battlefield:[c]}}),p.id);assert.equal(pub.zones.battlefield[0].data.faces.length,2);assert.deepEqual(pub.zones.battlefield[0].data.keywords,['Flying']);c.faceDown=true;assert.ok(!JSON.stringify(g.publicPlayer({...p,zones:{...p.zones,battlefield:[c]}})).includes('Whenever this attacks'));});
 // Protocol-8 integration coverage lives in authority.mjs and recovery.mjs.
 console.log(`${passed} targets behavior checks passed.`);
}finally{await rm(dir,{recursive:true,force:true});}
