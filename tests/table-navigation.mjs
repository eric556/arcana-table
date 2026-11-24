import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-navigation-'));
try{
 await writeFile(join(dir,'react.mjs'),`export const useRef=v=>({current:v});export const useState=v=>[v,()=>{}];export const useEffect=()=>{};`);
 for(const [name,folder] of [['use-table-navigation','components'],['table-camera','lib'],['hand-layout','lib']]){
  const js=ts.transpileModule(await readFile(new URL(`../${folder}/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'react'","'./react.mjs'").replace("'@/lib/table-camera'","'./table-camera.mjs'");await writeFile(join(dir,`${name}.mjs`),js);
 }
 const {useTableNavigation}=await import(pathToFileURL(join(dir,'use-table-navigation.mjs'))),{handLayout}=await import(pathToFileURL(join(dir,'hand-layout.mjs')));
 const setup=()=>{const captures=new Set(),view={setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),getBoundingClientRect:()=>({left:0,top:0})},camera={current:{x:0,y:0,zoom:1}},calls={cancel:0},h=useTableNavigation({current:view},camera,c=>camera.current=c,()=>calls.cancel++,false).handlers;return {h,camera,captures,calls};};
 const event=(id,x,y,interactive=false,scroll=null)=>({button:0,pointerType:'touch',pointerId:id,clientX:x,clientY:y,target:{closest:s=>s==='.hand-viewport'?scroll:s==='[data-keyboard-card="true"]'?null:interactive?{}:null},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
 {
  const {h,camera,calls,captures}=setup(),first=event(1,100,100,true);h.onPointerDownCapture(first);assert.equal(first.stopped,undefined);assert.equal(calls.cancel,0);
  const second=event(2,200,100,true);h.onPointerDownCapture(second);assert.equal(second.stopped,true);assert.equal(calls.cancel,1);assert.deepEqual([...captures],[1,2]);
  const move=event(2,250,100,true);h.onPointerMoveCapture(move);assert.equal(move.stopped,true);assert.equal(camera.current.zoom,1.5);assert.equal(camera.current.x,-50);assert.equal(camera.current.y,-50);
  const up=event(2,250,100,true);h.onPointerUpCapture(up);assert.equal(up.stopped,true);
  h.onPointerMoveCapture(event(1,120,130,true));assert.deepEqual(camera.current,{x:-30,y:-20,zoom:1.5});h.onPointerUpCapture(event(1,120,130,true));assert.equal(captures.size,0);
  const click=event(1,120,130,true);h.onClickCapture(click);assert.equal(click.stopped,true);
  console.log('PASS pinch starts over cards, cancels card drag, preserves anchor, continues as pan, and suppresses release clicks');
 }
 {
  const {h,camera}=setup();h.onPointerDownCapture(event(1,10,20));h.onPointerMoveCapture(event(1,40,80));assert.deepEqual(camera.current,{x:30,y:60,zoom:1});h.onPointerUpCapture(event(1,40,80));console.log('PASS one finger pans empty felt');
 }
 {
  const {h,calls,camera}=setup(),scroll={scrollWidth:900,clientWidth:390,scrollLeft:100};h.onPointerDownCapture(event(1,100,100,true,scroll));h.onPointerMoveCapture(event(1,60,105,true,scroll));assert.equal(scroll.scrollLeft,140);assert.equal(calls.cancel,1);assert.equal(camera.current.zoom,1);h.onPointerDownCapture(event(2,200,100,true,scroll));h.onPointerMoveCapture(event(2,240,100,true,scroll));assert.ok(camera.current.zoom>1);console.log('PASS oversized hand swipes horizontally and a second finger takes over zoom');
 }
 {
  const {h,camera,captures}=setup();h.onPointerDownCapture(event(1,10,20));h.onPointerDownCapture(event(2,100,20,true));h.onPointerCancelCapture(event(2,100,20,true));assert.equal(captures.size,0);const before={...camera.current};h.onPointerMoveCapture(event(1,90,90));assert.deepEqual(camera.current,before);console.log('PASS cancelled gestures release every contact and cannot keep moving the table');
 }
 {const {h,calls}=setup();const e={...event(1,10,20,true),pointerType:'mouse'};h.onPointerDownCapture(e);h.onPointerCancelCapture(e);assert.equal(calls.cancel,0);console.log('PASS native mouse drag pointer cancellation does not cancel the card drag');}
 for(const mobile of [false,true]){const width=mobile?390:1000,cardWidth=mobile?104:148,hand=handLayout(7,width,false,mobile,cardWidth,true);assert.equal(hand.overflow,false);assert.ok(hand.positions[0].angle<0);assert.ok(hand.positions[6].angle>0);assert.ok(hand.positions[0].y>hand.positions[3].y);assert.ok(hand.positions[1].x-hand.positions[0].x<cardWidth);assert.ok(hand.positions[6].x+cardWidth<=width);}
 for(const mobile of [false,true]){const h=handLayout(30,mobile?390:1000,false,mobile,mobile?104:148,true);assert.ok(h.step>=(mobile?40:60));for(let i=0;i<h.positions.length-1;i++)assert.ok(h.positions[i].x+h.positions[i].hitWidth<=h.positions[i+1].x+.01);assert.ok(h.positions.at(-1).x+h.cardWidth<=h.stageWidth);}
 assert.equal(handLayout(30,390,false,true,104,true).overflow,true);console.log('PASS desktop and mobile hands overlap in a shallow arc, with large hands retaining their card size');
}finally{await rm(dir,{recursive:true,force:true});}
