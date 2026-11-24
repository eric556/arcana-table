import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-reset-'));
try{
 for(const name of ['game','room-session']){const source=await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll("'./game'","'./game.mjs'");await writeFile(join(dir,`${name}.mjs`),js);}
 const g=await import(pathToFileURL(join(dir,'game.mjs'))),s=await import(pathToFileURL(join(dir,'room-session.mjs')));
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const session=storage(),local=storage(),seat={code:'0123456789abcdef',token:g.uid(),player:g.emptyPlayer('Player','commander'),format:'commander'};
 const hostKey='arcana-host-room-v9',outbox=`arcana-outbox-v9-${seat.code}-${seat.token}`;
 s.saveSeat(session,seat);session.setItem(outbox,'pending deck');session.setItem('arcana-rejoin-once',seat.code);session.setItem('arcana-resume-host','1');local.setItem(hostKey,JSON.stringify({code:'different-room'}));local.setItem('art-cache','keep');session.setItem('unrelated','keep');
 s.forgetRoom(session,local,{hostKey});assert.equal(s.readSeat(session),null);for(const k of [outbox,'arcana-rejoin-once','arcana-resume-host'])assert.equal(session.getItem(k),null);assert.equal(s.wantsFreshStart(session),true);assert.equal(local.getItem(hostKey),JSON.stringify({code:'different-room'}));assert.equal(local.getItem('art-cache'),'keep');assert.equal(session.getItem('unrelated'),'keep');console.log('PASS guest reset removes pending actions and reconnect markers without deleting other rooms or caches');
 local.setItem(hostKey,JSON.stringify({code:seat.code}));s.forgetRoom(session,local,{hostKey,hostCode:seat.code});assert.equal(local.getItem(hostKey),null);assert.equal(s.wantsFreshStart(session),true);console.log('PASS host reset discards only its matching checkpoint and keeps fresh-start choice on reload');
 s.saveSeat(session,seat);assert.equal(s.wantsFreshStart(session),false);assert.equal(s.readSeat(session).code,seat.code);console.log('PASS deliberately joining another room enables recovery for the new seat');
}finally{await rm(dir,{recursive:true,force:true});}
