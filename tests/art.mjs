import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'arcana-art-'));
const original={fetch:globalThis.fetch,caches:globalThis.caches,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
try {
 for(const name of ['cards','game','stack','deck-parser']){
  let js=ts.transpileModule(await readFile(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const dep of ['game','stack','deck-parser'])js=js.replaceAll(`'./${dep}'`,`'./${dep}.mjs'`);
  await writeFile(join(dir,`${name}.mjs`),js);
 }
 const saved=new Map(),bodies=new Map(),revoked=[],requests=[];let active=0,maxActive=0,fail=false,storageFails=false;
 globalThis.caches={open:async()=>{if(storageFails)throw Error('Storage unavailable');return {match:async url=>saved.get(url)?.clone(),put:async(url,response)=>saved.set(url,response),delete:async url=>saved.delete(url)};}};
 URL.createObjectURL=blob=>{const url=`blob:test-${bodies.size}`;bodies.set(url,blob);return url;};URL.revokeObjectURL=url=>revoked.push(url);
 globalThis.fetch=async(url,options)=>{active++;maxActive=Math.max(maxActive,active);requests.push({url,options,time:Date.now()});await new Promise(r=>setTimeout(r,5));active--;if(fail)throw Error('Offline');return new Response('fresh '+url,{headers:{'Content-Type':'image/jpeg'}});};
 const {cachedArt,retryArt,subscribeArt}=await import(pathToFileURL(join(dir,'cards.mjs')));
 const front='https://cards.scryfall.io/normal/front/test.jpg',back='https://cards.scryfall.io/normal/back/test.jpg';
 let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
 await check('a cached image loads without downloading',async()=>{saved.set(front,new Response('broken old image'));const src=await cachedArt(front);assert.equal(await bodies.get(src).text(),'broken old image');assert.equal(requests.length,0);});
 await check('retry evicts only the selected face and bypasses the browser cache',async()=>{saved.set(back,new Response('good back image'));const old=await cachedArt(front),src=await retryArt(front);assert.equal(await bodies.get(src).text(),'fresh '+front);assert.equal(await saved.get(back).clone().text(),'good back image');assert.equal(requests.length,1);assert.equal(requests[0].options.cache,'reload');assert.ok(revoked.includes(old));assert.equal(await cachedArt(front),src);});
 await check('repeated clicks and subscribed card copies share one retry',async()=>{const count=requests.length;let notified=0,copy;const unsubscribe=subscribeArt(front,()=>{notified++;copy=cachedArt(front);});const a=retryArt(front),b=retryArt(front);assert.equal(a,b);assert.equal(copy,a);await a;assert.equal(notified,1);assert.equal(requests.length,count+1);unsubscribe();await retryArt(front);assert.equal(notified,1);});
 await check('failed retries remain retryable without poisoning the queue',async()=>{fail=true;await assert.rejects(retryArt(front),/Offline/);assert.equal(saved.has(front),false);fail=false;const src=await retryArt(front);assert.equal(await bodies.get(src).text(),'fresh '+front);});
 await check('front and back retry independently through the serial rate-limited queue',async()=>{const count=requests.length;await Promise.all([retryArt(front),retryArt(back)]);assert.equal(maxActive,1);assert.equal(requests.length,count+2);assert.ok(requests[count+1].time-requests[count].time>=110);});
 await check('retry works without persistent cache access',async()=>{storageFails=true;assert.ok((await retryArt(front)).startsWith('blob:'));storageFails=false;});
 await check('bundled artwork can also be reloaded',async()=>{const url='/cards/test.jpg';assert.equal(await cachedArt(url),url);const src=await retryArt(url);assert.equal(await cachedArt(url),src);assert.equal(requests.at(-1).url,url);assert.equal(requests.at(-1).options.cache,'reload');});
 await check('retry still rejects unapproved remote image sources',async()=>{const count=requests.length;await assert.rejects(retryArt('https://example.com/art.jpg'),/Unsupported/);assert.equal(requests.length,count);});
 console.log(`${passed} artwork recovery regressions passed.`);
} finally {globalThis.fetch=original.fetch;globalThis.caches=original.caches;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;await rm(dir,{recursive:true,force:true});}
