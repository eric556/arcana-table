import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-deck-import-'));
const globals=['fetch','caches','location','localStorage','navigator'];
const original=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
try {
 for(const name of ['deck-parser','cards','game','stack']){
  let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const dep of ['game','stack','deck-parser'])js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const {parseDeck}=await import(pathToFileURL(join(dir,'deck-parser.mjs')));
 const {importDeck}=await import(pathToFileURL(join(dir,'cards.mjs')));
 const {emptyPlayer}=await import(pathToFileURL(join(dir,'game.mjs')));
 const text=await readFile(new URL('./fixtures/zuko-export.txt',import.meta.url),'utf8');
 const multiface=[
  ['Bloodsoaked Insight // Sanguine Morass','modal_dfc'],
  ['Charred Foyer // Warped Space','split'],
  ['Decadent Dragon // Expensive Taste','adventure'],
  ['Legion Leadership // Legion Stronghold','modal_dfc'],
  ['Sundering Eruption // Volcanic Fissure','modal_dfc'],
  ['The Legend of Roku // Avatar Roku','transform'],
 ];
 let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
 await check('all six reported failures normalize to canonical full card names',()=>{
  const lines=parseDeck(text);
  assert.deepEqual(lines.filter(c=>c.name.includes('/')).map(c=>c.name),multiface.map(([name])=>name));
  assert.equal(lines.reduce((n,c)=>n+c.count,0),100);
  assert.equal(lines.length,95);
  assert.equal(lines.find(c=>c.name==='Mountain').count,4);
  assert.equal(lines.find(c=>c.name==='Plains').count,2);
  assert.equal(lines.find(c=>c.name==='Swamp').count,2);
  assert.ok(lines.every(c=>!/[()*]/.test(c.name)));
 });
 await check('single and double slashes normalize with or without surrounding whitespace',()=>{
  for(const separator of [' / ','/',' // ','//',' /  ','\t/\t']){
   assert.equal(parseDeck(`1 Bloodsoaked Insight${separator}Sanguine Morass (MH3) 252 *F*`)[0].name,multiface[0][0]);
  }
 });
 await check('commander markers, sections, front-only names and ordinary punctuation survive',()=>{
  const lines=parseDeck("// Commander\n1 Fire Lord Zuko (TLA) 221\nDeck\n1 Decadent Dragon\n1 Dragonhawk, Fate's Tempest (PBLB) 132p\n1 Charred Foyer/Warped Space *CMDR*\nSB: 2 Wear / Tear [DGM]\n# comment\nMaybeboard\n1 Sol Ring");
  assert.deepEqual(lines,[{name:'Fire Lord Zuko',count:1,zone:'command'},{name:'Decadent Dragon',count:1,zone:'library'},{name:"Dragonhawk, Fate's Tempest",count:1,zone:'library'},{name:'Charred Foyer // Warped Space',count:1,zone:'command'},{name:'Wear // Tear',count:2,zone:'sideboard'}]);
 });
 const cache=new Map(),local=new Map(),requests=[];
 Object.defineProperty(globalThis,'location',{value:{origin:'https://arcana.test'},configurable:true});
 Object.defineProperty(globalThis,'localStorage',{value:{getItem:key=>local.get(key),setItem:(key,value)=>local.set(key,value)},configurable:true});
 Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
 Object.defineProperty(globalThis,'caches',{value:{open:async()=>({match:async key=>cache.get(key.url)?.clone(),put:async(key,value)=>cache.set(key.url,value)})},configurable:true});
 // Controlled Scryfall-shaped responses: no live API or artwork requests in this regression.
 const catalog=new Map();
 for(const line of parseDeck(text))catalog.set(line.name,{id:line.name,name:line.name,layout:'normal',type_line:'Test card',oracle_text:'Test rules.',image_uris:{normal:'https://cards.scryfall.io/normal/test.jpg'}});
 for(const [name,layout] of multiface){
  const doubleSided=['modal_dfc','transform'].includes(layout);
  catalog.set(name,{id:name,name,layout,type_line:'Test front // Test back',card_faces:name.split(' // ').map((face,i)=>({name:face,type_line:`Test face ${i}`,oracle_text:`Rules for ${face}`,...(doubleSided?{image_uris:{normal:`https://cards.scryfall.io/normal/${encodeURIComponent(face)}.jpg`}}:{})})),...(!doubleSided?{image_uris:{normal:'https://cards.scryfall.io/normal/shared.jpg'}}:{})});
 }
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.scryfall.com/cards/collection');
  const {identifiers}=JSON.parse(options.body);requests.push(identifiers);
  assert.ok(identifiers.length<=75);
  const data=[],not_found=[];
  for(const id of identifiers){const card=!id.name.includes(' // ')?[...catalog.values()].find(c=>c.name===id.name||c.card_faces?.some(f=>f.name===id.name)):undefined;if(card)data.push(card);else not_found.push(id);}
  return new Response(JSON.stringify({data,not_found}));
 };
 const originalPlayer=emptyPlayer('Importer','commander');
 let player;
 await check('the entire pasted deck imports as 100 distinct cards in two API batches',async()=>{
  player=await importDeck(text,'Zuko',originalPlayer,()=>{});
  assert.equal(player.zones.library.length,100);
  assert.equal(new Set(player.zones.library.map(c=>c.uid)).size,100);
  assert.deepEqual(requests.map(batch=>batch.length),[75,20]);
  assert.ok(requests.flat().every(id=>!id.name.includes('/')));
  assert.equal(originalPlayer.zones.library.length,0);
 });
 await check('double-sided, Room and Adventure metadata is retained without splitting cards',()=>{
  for(const [name,layout] of multiface){const matches=player.zones.library.filter(c=>c.data.name===name);assert.equal(matches.length,1);const {data}=matches[0];assert.equal(data.layout,layout);assert.equal(data.faces.length,2);assert.deepEqual(data.faces.map(f=>f.name),name.split(' // '));assert.ok(data.faces.every(f=>f.text.startsWith('Rules for ')));assert.equal(!!data.backImage,['modal_dfc','transform'].includes(layout));}
 });
 await check('reimporting either slash spelling reuses the same cached card data',async()=>{
  const count=requests.length;
  const again=await importDeck(text.replaceAll(' / ',' // '),'Zuko again',originalPlayer,()=>{});
  assert.equal(again.zones.library.length,100);assert.equal(requests.length,count);
 });
 await check('a correct first face cannot silently substitute for an incorrect second half',async()=>{
  await assert.rejects(importDeck('1 Charred Foyer / Wrong Door','Wrong half',originalPlayer,()=>{}),/Cards not found: Charred Foyer \/\/ Wrong Door/);
 });
 await check('an unknown card still fails clearly and leaves the original deck intact',async()=>{
  await assert.rejects(importDeck('1 This Card Does Not Exist / Neither Does This','Bad deck',player,()=>{}),/Cards not found: This Card Does Not Exist \/\/ Neither Does This/);
  assert.equal(player.zones.library.length,100);
 });
 console.log(`${passed} deck import regressions passed.`);
} finally {
 for(const [key,descriptor] of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 await rm(dir,{recursive:true,force:true});
}
