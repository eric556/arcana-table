import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-placement-'));
try{
 for(const name of ['game','stack','abilities','table-gestures','shared-cards','card-shortcuts']){
  let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const dep of ['game','stack','abilities','shared-cards'])js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),{tableGesture}=await import(pathToFileURL(join(dir,'table-gestures.mjs')));
 let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
 const {cardShortcut,blockShortcuts}=await import(pathToFileURL(join(dir,'card-shortcuts.mjs')));
 const c=g.card({id:'a',name:'Creature',type:'Creature'});
 check('hover moves and tapping are limited to controlled cards',()=>{for(const [key,to] of [['g','graveyard'],['e','exile'],['h','hand']]){assert.equal(cardShortcut(key,c,'battlefield','me','me').to,to);assert.equal(cardShortcut(key,c,'battlefield','other','me'),undefined);}assert.equal(cardShortcut('t',c,'battlefield','me','me').type,'tap');assert.equal(cardShortcut('t',c,'hand','me','me'),undefined);});
 check('stolen cards follow their controller and move permission stays limited',()=>{c.controllerId='me';assert.equal(cardShortcut('t',c,'battlefield','other','me').type,'tap');assert.equal(cardShortcut('g',c,'battlefield','other','other'),undefined);delete c.controllerId;c.movePermission='me';assert.equal(cardShortcut('g',c,'battlefield','other','me').to,'graveyard');assert.equal(cardShortcut('t',c,'battlefield','other','me'),undefined);});
 check('casting respects play permissions and uses selected face',()=>{assert.equal(cardShortcut('c',c,'exile','other','me'),undefined);c.permission={playerId:'me',kind:'cast',look:true,note:''};assert.equal(cardShortcut('c',c,'exile','other','me').to,'stack');c.data.type='Land';assert.equal(cardShortcut('c',c,'exile','other','me'),undefined);c.permission.kind='play';assert.equal(cardShortcut('c',c,'exile','other','me').to,'battlefield');assert.equal(cardShortcut('g',c,'exile','other','me'),undefined);});
 check('stack cards cannot bypass shared resolution',()=>{for(const key of ['g','e','h','b','t','c','f'])assert.equal(cardShortcut(key,c,'stack','me','me'),undefined);});
 check('typing, modifiers, held keys and composition suppress shortcuts',()=>{const event={repeat:false,isComposing:false,ctrlKey:false,metaKey:false,altKey:false};assert.equal(blockShortcuts(event,false),false);assert.equal(blockShortcuts(event,true),true);for(const key of Object.keys(event))assert.equal(blockShortcuts({...event,[key]:true},false),true);});
 console.log(`${passed} shortcut regressions passed.`);
}finally{await rm(dir,{recursive:true,force:true});}
