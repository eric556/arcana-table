import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-library-rules-'));
try{
 const source=await readFile('lib/game.ts','utf8');
 await writeFile(join(dir,'game.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 const g=await import(pathToFileURL(join(dir,'game.mjs')));
 const p=g.emptyPlayer('Player','commander');p.zones.library=['A','B','C','D','E','F'].map(name=>g.card({id:name,name:'PRIVATE '+name,type:'Creature'}));
 const ids=p.zones.library.map(c=>c.uid),names=cs=>cs.map(c=>c.data.id);
 let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
 const command=(type,top,other,count=4)=>({type,count,expected:ids.slice(0,count),top:top.map(i=>ids[i]),other:other.map(i=>ids[i])});
 check('scry preserves untouched middle and exact chosen top and bottom order',()=>{const r=g.act(p,command('scry',[2,0],[3,1]));assert.deepEqual(names(r.player.zones.library),['C','A','E','F','D','B']);assert.equal(r.player.zones.graveyard.length,0);assert.deepEqual(names(p.zones.library),['A','B','C','D','E','F']);assert.ok(!r.message.includes('PRIVATE'));});
 check('surveil sends only chosen cards to graveyard and keeps chosen top order',()=>{const r=g.act(p,command('surveil',[2,0],[3,1]));assert.deepEqual(names(r.player.zones.library),['C','A','E','F']);assert.deepEqual(names(r.player.zones.graveyard),['D','B']);const pub=JSON.stringify(g.publicPlayer(r.player));assert.ok(pub.includes('PRIVATE D'));assert.ok(pub.includes('PRIVATE B'));for(const name of ['A','C','E','F'])assert.ok(!pub.includes('PRIVATE '+name));});
 check('all cards can be kept, bottomed, or surveilled away',()=>{assert.deepEqual(names(g.act(p,command('scry',[3,2,1,0],[])).player.zones.library),['D','C','B','A','E','F']);assert.deepEqual(names(g.act(p,command('scry',[],[3,2,1,0])).player.zones.library),['E','F','D','C','B','A']);assert.deepEqual(names(g.act(p,command('surveil',[],[0,1,2,3])).player.zones.library),['E','F']);});
 check('fewer than N cards uses all remaining cards without inventing or drawing any',()=>{const r=g.act(p,command('scry',[5,4,3],[2,1,0],20));assert.deepEqual(names(r.player.zones.library),['F','E','D','C','B','A']);assert.equal(r.player.zones.hand.length,0);assert.match(r.message,/scried 20/);});
 check('zero is a no-op, while positive N on an empty library still logs the event',()=>{for(const type of ['scry','surveil']){assert.deepEqual(g.act(p,{type,count:0,expected:[],top:[],other:[]}),{player:p,message:''});const empty=g.emptyPlayer('Player','commander');const r=g.act(empty,{type,count:3,expected:[],top:[],other:[]});assert.ok(r.message);assert.equal(r.player.zones.library.length,0);}});
 check('stale top cards, duplicate, missing, and foreign selections are atomic no-ops',()=>{const base=command('scry',[0,1],[2,3]);for(const a of [{...base,expected:[...base.expected].reverse()},{...base,top:[ids[0],ids[0]]},{...base,top:[ids[0]]},{...base,other:[ids[2],ids[5]]},{...base,count:NaN},{...base,count:-1},{...base,count:1.5}])assert.deepEqual(g.act(p,a),{player:p,message:''});const drawn=g.act(p,{type:'draw'}).player;assert.deepEqual(g.act(drawn,base),{player:drawn,message:''});});
 check('completed actions clear previous reveals and never publish kept-card names',()=>{const revealing=g.act(p,{type:'viewTop',count:4,reveal:true}).player;const r=g.act(revealing,command('scry',[1,0],[3,2]));assert.equal(r.player.libraryView,undefined);assert.ok(!JSON.stringify(g.publicPlayer(r.player)).includes('PRIVATE'));});
 check('surveil preserves existing graveyard order and puts incoming cards face up',()=>{const local=structuredClone(p);local.zones.graveyard=[g.card({id:'old',name:'Old',type:'Creature'})];local.zones.library[0].faceDown=true;const r=g.act(local,command('surveil',[1,2,3],[0]));assert.deepEqual(names(r.player.zones.graveyard),['old','A']);assert.equal(r.player.zones.graveyard[1].faceDown,false);});
 console.log(`${passed} scry/surveil rule checks passed.`);
}finally{await rm(dir,{recursive:true,force:true});}
