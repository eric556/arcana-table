import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-touch-'));
try {
 // Exercise hook event transitions without a browser or synthetic native clicks.
 await writeFile(join(dir,'react.mjs'),`let slots=[],i=0;export const useEffect=()=>{};export const reset=()=>{slots=[];i=0};export const render=()=>{i=0};export const useRef=v=>{const n=i++;return slots[n]??(slots[n]={current:v})};export const useState=v=>{const n=i++;if(!(n in slots))slots[n]=v;return [slots[n],v=>slots[n]=typeof v==='function'?v(slots[n]):v]};`);
 const js=ts.transpileModule(await readFile(new URL('../components/use-table-drag.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'react'","from './react.mjs'").replace("'@/lib/table-camera'","'./table-camera.mjs'");
 await writeFile(join(dir,'table-camera.mjs'),ts.transpileModule(await readFile(new URL('../lib/table-camera.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 await writeFile(join(dir,'drag.mjs'),js);
 const state=await import(pathToFileURL(join(dir,'react.mjs'))),{useTableDrag}=await import(pathToFileURL(join(dir,'drag.mjs')));
 const card={kind:'card',cardId:'card1',ownerId:'seat1',combatId:'combat1'},target={kind:'zone',zone:'stack',ownerId:'seat1'};
 const element={setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){},getAttribute:()=>JSON.stringify(target),closest(){return this;}};
 globalThis.document={elementFromPoint:()=>element};
 let passed=0;
 const setup=()=>{state.reset();const calls={tap:0,drops:[]};const render=()=>{state.render();return useTableDrag((...a)=>calls.drops.push(a));};return {calls,render};};
 const event=(x=0,y=0)=>({pointerType:'touch',pointerId:1,clientX:x,clientY:y,currentTarget:element,target:element,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
 const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
 check('a touch tap with finger movement opens details without relying on a click',()=>{const {calls,render}=setup();const p=render().draggableProps(card,()=>calls.tap++);p.onPointerDown(event());p.onPointerMove(event(10,3));p.onPointerUp(event(10,3));assert.equal(calls.tap,1);assert.equal(calls.drops.length,0);const click=event();p.onClickCapture(click);assert.equal(click.stopped,true);});
 check('a deliberate drag moves the card and does not open details',()=>{const {calls,render}=setup();const p=render().draggableProps(card,()=>calls.tap++);p.onPointerDown(event());p.onPointerMove(event(0,40));p.onPointerUp(event(0,40));assert.equal(calls.tap,0);assert.deepEqual(calls.drops,[[card,target]]);});
 check('native hand scrolling cancels the touch without opening details',()=>{const {calls,render}=setup();const p=render().draggableProps(card,()=>calls.tap++);p.onPointerDown(event());p.onPointerCancel(event());p.onPointerUp(event());assert.equal(calls.tap,0);assert.equal(calls.drops.length,0);});
 check('tap-to-place finishes the held card instead of opening another inspector',()=>{const {calls,render}=setup();render().pickUp(card);const api=render(),p=api.draggableProps(card,()=>calls.tap++);p.onPointerDown(event());p.onPointerUp(event());api.dropProps(target).onClickCapture(event());assert.equal(calls.tap,0);assert.deepEqual(calls.drops,[[card,target]]);});
 check('mouse pointers keep their existing click-to-inspect path',()=>{const {calls,render}=setup();const p=render().draggableProps(card,()=>calls.tap++),e={...event(),pointerType:'mouse'};p.onPointerDown(e);p.onPointerUp(e);p.onClickCapture(e);assert.equal(calls.tap,0);assert.equal(e.stopped,undefined);});
 check('native mouse drag survives pointercancel and drops exactly once',()=>{const {calls,render}=setup(),data=new Map(),transfer={types:['text/arcana-drag'],setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)??''};const e={...event(),pointerType:'mouse',dataTransfer:transfer},p=render().draggableProps(card);p.onDragStart(e);p.onPointerCancel(e);assert.deepEqual(render().item,card);render().dropProps(target).onDrop(e);p.onDragEnd();assert.deepEqual(calls.drops,[[card,target]]);assert.equal(render().item,null);});
 check('drag preview follows the touch and dims only the held card until drop',()=>{const {calls,render}=setup();const p=render().draggableProps(card);p.onPointerDown(event(10,20));p.onPointerMove(event(70,110));let api=render();assert.deepEqual(api.pointer,{x:70,y:110});assert.equal(api.draggableProps(card)['data-card-dragging'],true);assert.equal(api.draggableProps({...card,cardId:'other'})['data-card-dragging'],undefined);p.onPointerMove(event(90,150));assert.deepEqual(render().pointer,{x:90,y:150});p.onPointerUp(event(90,150));api=render();assert.equal(api.pointer,null);assert.equal(api.item,null);assert.equal(calls.drops.length,1);});
 check('cancelling a drag for pinch navigation clears the preview without dropping',()=>{const {calls,render}=setup();const p=render().draggableProps(card);p.onPointerDown(event());p.onPointerMove(event(0,40));render().cancel();p.onPointerUp(event(0,40));assert.equal(render().pointer,null);assert.equal(calls.drops.length,0);});
 check('touch drops on a clipped, zoomed battlefield retain the full-area coordinates',()=>{
  const {calls,render}=setup(),zone={kind:'zone',zone:'battlefield',ownerId:'seat1'};
  const attrs={'data-table-drop':JSON.stringify(zone),'data-board-canvas':'true','data-board-space':'area','data-board-scale':'.5','data-board-offset-x':'-600','data-board-offset-y':'-300','data-board-width':'3600','data-board-height':'2800','data-board-card-width':'132','data-board-card-height':'184'};
  const canvas={closest(){return this},hasAttribute:k=>k in attrs,getAttribute:k=>attrs[k]??null,offsetWidth:390,getBoundingClientRect:()=>({left:20,top:100,width:390,height:680})};
  document.elementFromPoint=()=>canvas;
  try{const p=render().draggableProps(card);p.onPointerDown(event());p.onPointerMove(event(250,400));p.onPointerUp(event(250,400));const pos=calls.drops[0][1].position;assert.equal(pos.space,'area');assert.ok(Math.abs(pos.x-(250+580-33)/(1800-66))<1e-9);assert.ok(Math.abs(pos.y-(400+200-46)/(1400-92))<1e-9);}finally{document.elementFromPoint=()=>element;}
 });
 check('self drops reposition on the battlefield for touch, mouse and keyboard, including borrowed reversed cards',()=>{
  for(const mode of ['touch','mouse','keyboard'])for(const facing of [false,true]){
   const {calls,render}=setup(),zone={kind:'zone',zone:'battlefield',ownerId:'other-seat'};
   const attrs={'data-table-drop':JSON.stringify(zone),'data-board-canvas':'true','data-board-space':'area','data-board-scale':'.5','data-board-offset-x':'-600','data-board-offset-y':'-300','data-board-width':'3600','data-board-height':'2800','data-board-card-width':'132','data-board-card-height':'184','data-board-facing':String(facing)};
   const canvas={closest(){return this},hasAttribute:k=>k in attrs,getAttribute:k=>attrs[k]??null,offsetWidth:390,getBoundingClientRect:()=>({left:20,top:100,width:390,height:680})};
   const self={...element,closest:selector=>selector==='.player-territory'?{querySelector:()=>canvas}:self,getAttribute:()=>JSON.stringify({kind:'card',cardId:card.cardId,ownerId:'other-seat'})};
   document.elementFromPoint=()=>self;
   try{
    if(mode==='touch'){const p=render().draggableProps(card);p.onPointerDown(event());p.onPointerMove(event(250,400));p.onPointerUp(event(250,400));}
    else {render().pickUp(card);const props=render().dropProps({kind:'card',cardId:card.cardId,ownerId:'other-seat'}),e={...event(250,400),currentTarget:self,target:self,dataTransfer:{types:[],getData:()=>JSON.stringify(card)}};if(mode==='mouse')props.onDrop(e);else props.onClickCapture(e);}
    assert.equal(calls.drops.length,1);const target=calls.drops[0][1];assert.equal(target.kind,'zone');assert.equal(target.zone,'battlefield');assert.equal(target.ownerId,'other-seat');
    const x=(250+580-33)/(1800-66),y=(400+200-46)/(1400-92);assert.ok(Math.abs(target.position.x-(facing?1-x:x))<1e-9);assert.ok(Math.abs(target.position.y-(facing?1-y:y))<1e-9);
   }finally{document.elementFromPoint=()=>element;}
  }
 });
 check('other cards remain attachment targets and self drops without a battlefield cancel',()=>{
  for(const self of [false,true]){
   const {calls,render}=setup(),target={kind:'card',cardId:self?card.cardId:'another-card',ownerId:'seat1'};
   const node={...element,closest:s=>s==='.player-territory'?null:node,getAttribute:()=>JSON.stringify(target)};document.elementFromPoint=()=>node;
   try{const p=render().draggableProps(card);p.onPointerDown(event());p.onPointerMove(event(20,40));p.onPointerUp(event(20,40));assert.equal(calls.drops.length,self?0:1);if(!self)assert.deepEqual(calls.drops[0][1],target);}finally{document.elementFromPoint=()=>element;}
  }
 });
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 {
  const {calls,render}=setup();let doubles=0;const p=render().draggableProps(card,()=>calls.tap++,()=>doubles++);
  p.onPointerDown(event());p.onPointerUp(event());assert.equal(calls.tap,0);
  p.onPointerDown(event());p.onPointerUp(event());await pause(320);
  assert.equal(doubles,1);assert.equal(calls.tap,0);passed++;console.log('PASS touch double-tap toggles once without opening details');
 }
 {
  const {calls,render}=setup();const p=render().draggableProps(card,()=>calls.tap++,()=>assert.fail('unexpected double tap'));
  p.onPointerDown(event());p.onPointerUp(event());await pause(320);assert.equal(calls.tap,1);passed++;console.log('PASS one battlefield tap still opens details after the double-tap window');
 }
 {
  const {calls,render}=setup();const p=render().draggableProps(card,()=>calls.tap++,()=>assert.fail('unexpected double tap'));
  p.onPointerDown(event());p.onPointerUp(event());p.onPointerDown(event());p.onPointerMove(event(0,40));p.onPointerUp(event(0,40));await pause(320);
  assert.equal(calls.tap,0);assert.equal(calls.drops.length,1);passed++;console.log('PASS dragging cancels a pending single-tap inspector');
 }
 console.log(`${passed} touch event regressions passed. Actual device rendering remains unverified.`);
} finally {delete globalThis.document;await rm(dir,{recursive:true,force:true});}
