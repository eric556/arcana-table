import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-edge-'));
try{
 await writeFile(join(dir,'react.mjs'),'export const useEffect=f=>{globalThis.cleanup=f();};');
 for(const [folder,name] of [['lib','drag-edge-pan'],['components','use-drag-edge-pan']]){
  const src=await readFile(new URL(`../${folder}/${name}.ts`,import.meta.url),'utf8');
  await writeFile(join(dir,`${name}.mjs`),ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'react'","'./react.mjs'").replace("'@/lib/drag-edge-pan'","'./drag-edge-pan.mjs'"));
 }
 const {dragEdgeVelocity:v}=await import(pathToFileURL(join(dir,'drag-edge-pan.mjs')));
 const bounds={left:20,right:420,top:50,bottom:650};
 assert.deepEqual(v({x:220,y:350},bounds),{x:0,y:0});
 assert.deepEqual(v({x:19,y:350},bounds),{x:0,y:0});
 assert.equal(v({x:220,y:650},bounds).y,-520);
 assert.equal(v({x:20,y:350},bounds).x,520);
 assert.equal(v({x:420,y:50},bounds).y,520);
 assert.ok(Math.abs(v({x:220,y:640},bounds).y)>Math.abs(v({x:220,y:600},bounds).y));
 assert.deepEqual(v({x:0,y:0},{left:0,right:0,top:0,bottom:0}),{x:0,y:0});
 console.log('PASS all four edges, smooth acceleration, outside viewport and degenerate bounds');
 const {useDragEdgePan}=await import(pathToFileURL(join(dir,'use-drag-edge-pan.mjs')));
 const listeners=new Map(),frames=new Map();let id=0,over='board';
 const eventTarget={addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
 globalThis.document={...eventTarget,elementFromPoint:()=>({closest:s=>over==='hand'&&s==='.hand-and-zones'?{}:over==='controls'&&s.startsWith('.player-bar')?{}:null})};
 globalThis.window=eventTarget;
 globalThis.requestAnimationFrame=f=>{frames.set(++id,f);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const camera={current:{x:0,y:0,zoom:.4}},view={current:{getBoundingClientRect:()=>bounds,contains:()=>over!=='outside'}};
 const run=t=>{const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(t));};
 useDragEdgePan(view,camera,c=>camera.current=c,true);
 const move=(name,x,y)=>listeners.get(name)({clientX:x,clientY:y});
 over='hand';move('dragover',220,640);assert.equal(frames.size,0);
 over='board';move('dragover',220,350);run(10);assert.equal(frames.size,0);
 over='hand';move('dragover',220,640);run(100);run(116);assert.ok(camera.current.y<0);assert.equal(camera.current.zoom,.4);
 const y=camera.current.y;run(132);assert.ok(camera.current.y<y,'stationary pointer continues panning');
 listeners.get('drop')();assert.equal(frames.size,0);
 over='board';move('pointermove',25,350);run(200);run(216);assert.ok(camera.current.x>0,'touch move pans left edge');
 over='controls';move('pointermove',25,350);assert.equal(frames.size,0);
 over='board';move('dragover',220,640);listeners.get('pointercancel')();assert.equal(frames.size,0);
 move('dragover',220,640);listeners.get('blur')();assert.equal(frames.size,0);
 globalThis.cleanup();assert.equal(listeners.size,0);assert.equal(frames.size,0);
 useDragEdgePan(view,camera,c=>camera.current=c,false);assert.equal(listeners.size,0);
 console.log('PASS native and touch drag, leave-hand arming, stationary hold, controls, drop/cancel/blur cleanup and inactive state');
}finally{await rm(dir,{recursive:true,force:true});}
