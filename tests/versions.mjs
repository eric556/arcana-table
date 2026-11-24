import assert from 'node:assert/strict';import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {EventEmitter} from 'node:events';import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-version-'));
try{
 const names=['game','stack','shared-cards','authority','network'];for(const name of names){let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;for(const dep of names)js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);await writeFile(join(dir,`${name}.mjs`),js);}
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),{RoomNetwork,RoomVersionError,ROOM_PROTOCOL}=await import(pathToFileURL(join(dir,'network.mjs')));
 assert.equal(ROOM_PROTOCOL,9);
 class Wire extends EventEmitter{open=true;send(){}close(){if(this.open){this.open=false;this.emit('close');}}}
 for(const hostProtocol of [8,10]){const wire=new Wire(),errors=[];const n=new RoomNetwork(()=>{},()=>{},()=>{},e=>errors.push(e),undefined,undefined,{getItem:()=>null,setItem(){},removeItem(){}});n.makePeer=async()=>({connect:()=>wire,destroy(){}});const joined=n.join('0123456789abcdef',g.emptyPlayer('Guest','commander'),g.uid()).catch(e=>e);await Promise.resolve();wire.emit('open');wire.emit('data',JSON.stringify({type:'error',code:'ROOM_VERSION_MISMATCH',hostProtocol}));const error=await joined;assert.ok(error instanceof RoomVersionError);assert.equal(error.updateSide,hostProtocol<9?'host':'guest');assert.match(error.message,/Refresh all players/);assert.equal(errors.length,1);assert.equal(n.ownId,'');n.close();}
 console.log('PASS current protocol 9 and incompatible-host recovery errors');
}finally{await rm(dir,{recursive:true,force:true});}
