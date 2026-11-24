import type { CardData, Player } from './game';
import { card, emptyPlayer, shuffle } from './game';
import { parseDeck } from './deck-parser';
export { parseDeck } from './deck-parser';
const DATA_CACHE='arcana-card-data-v1';
const ART_CACHE='arcana-card-art-v1';
const memory=new Map<string,CardData>();
const artMemory=new Map<string,Promise<string>>();
const artRetries=new Map<string,Promise<string>>();
const artListeners=new Map<string,Set<()=>void>>();
export function subscribeArt(url:string,listener:()=>void){
  const listeners=artListeners.get(url)??new Set<()=>void>();
  listeners.add(listener);artListeners.set(url,listeners);
  return ()=>{listeners.delete(listener);if(!listeners.size)artListeners.delete(url);};
}
let apiQueue:Promise<unknown>=Promise.resolve(),artQueue:Promise<unknown>=Promise.resolve();
let lastRequest=0,blockedUntil=0;
const delay=(n:number)=>new Promise(r=>setTimeout(r,n));
export function normalizeCard(c:any):CardData {const front=c.card_faces?.[0];return {layout:c.layout,faces:c.card_faces?.map((f:any)=>({name:f.name,type:f.type_line??"",text:f.oracle_text??"",mana:f.mana_cost})),keywords:c.keywords,id:c.id,name:c.name,image:c.image_uris?.normal??front?.image_uris?.normal,backImage:c.card_faces?.[1]?.image_uris?.normal,type:c.type_line,text:c.oracle_text??c.card_faces?.map((f:any)=>`${f.name}\n${f.oracle_text??''}`).join('\n\n'),mana:c.mana_cost??front?.mana_cost,power:c.power,toughness:c.toughness,artist:c.artist??front?.artist,scryfall:c.scryfall_uri};}
const dataKey=(name:string)=>new Request(`${location.origin}/__card_cache__/${encodeURIComponent(name.toLowerCase())}`);
async function readCard(name:string){const k=name.toLowerCase();if(memory.has(k))return memory.get(k);try {const r=await (await caches.open(DATA_CACHE)).match(dataKey(k));if(r){const c=await r.json() as CardData;memory.set(k,c);return c as CardData;}}catch{}return undefined;}
async function saveCard(c:CardData,alias?:string){for(const k of new Set([c.name.toLowerCase(),c.name.split(' // ')[0].toLowerCase(),...(c.faces??[]).map(f=>f.name.toLowerCase()),alias?.toLowerCase()].filter(Boolean) as string[])){memory.set(k,c);try{await (await caches.open(DATA_CACHE)).put(dataKey(k),new Response(JSON.stringify(c),{headers:{'Content-Type':'application/json'}}));}catch{}}}
export async function seedCards(cards:CardData[]){await Promise.all(cards.map(c=>saveCard(c)));}
function apiRequest(identifiers:{name:string}[]):Promise<any>{
  const run=async()=>{const request=async()=>{let last=lastRequest,block=blockedUntil;try{last=Math.max(last,Number(localStorage.getItem('arcana-api-last'))||0);block=Math.max(block,Number(localStorage.getItem('arcana-api-block'))||0);}catch{}
    if(Date.now()<block)throw new Error('Scryfall asked us to pause. Please wait a minute before importing again.');
    await delay(Math.max(0,650-(Date.now()-last)));lastRequest=Date.now();try{localStorage.setItem('arcana-api-last',String(lastRequest));}catch{}
    const r=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({identifiers}),signal:AbortSignal.timeout(25000)});
    if(r.status===429){const retry=r.headers.get('Retry-After');const seconds=retry&&Number.isFinite(Number(retry))?Number(retry):60;blockedUntil=Date.now()+Math.max(60000,seconds*1000);try{localStorage.setItem('arcana-api-block',String(blockedUntil));}catch{}throw new Error('Scryfall rate limit reached. Import stopped; please wait at least a minute.');}
    if(!r.ok)throw new Error(`Scryfall could not load these cards (${r.status}). Please try again later.`);return r.json();};
    return navigator.locks? navigator.locks.request('arcana-scryfall-api',request):request();};
  const p=apiQueue.then(run);apiQueue=p.catch(()=>{});return p;
}
export async function importDeck(text:string,title:string,player:Player,onProgress:(s:string)=>void):Promise<Player>{
  const lines=parseDeck(text);const names=[...new Set(lines.map(l=>l.name))];const resolved=new Map<string,CardData>();const missing:string[]=[];
  for(const name of names){const cached=await readCard(name);if(cached&&(!cached.backImage||cached.layout))resolved.set(name,cached);else missing.push(name);}
  for(let i=0;i<missing.length;i+=75){
    onProgress(`Finding cards · ${Math.min(i+75,missing.length)} of ${missing.length}`);
    const batch=missing.slice(i,i+75);
    // Collection lookup can reject combined names even when each face is indexed.
    // Ask for the first face, then verify the complete requested name below.
    const queries=[...new Set(batch.map(name=>name.split(' // ')[0]))];
    const result=await apiRequest(queries.map(name=>({name})));
    for(const raw of result.data??[]){
      const c=normalizeCard(raw);await saveCard(c);
      for(const name of batch){const key=name.toLowerCase();
        if(c.name.toLowerCase()===key||c.name.split(' // ')[0].toLowerCase()===key||c.faces?.some(f=>f.name.toLowerCase()===key))resolved.set(name,c);
      }
    }
    const unresolved=batch.filter(name=>!resolved.has(name));
    if(unresolved.length)throw new Error(`Cards not found: ${unresolved.join(', ')}. Check the spelling and try again.`);
  }
  const p=emptyPlayer(player.name,player.life===20?'60-card':'commander',player.id);p.life=player.life;p.poison=player.poison;p.damage={...player.damage};p.deckName=title.trim().slice(0,80)||'Imported deck';
  for(const line of lines)for(let i=0;i<line.count;i++)p.zones[line.zone].push(card(resolved.get(line.name)!));p.zones.library=shuffle(p.zones.library);onProgress('Deck ready');return p;
}
function loadArt(url:string,retry=false):Promise<string>{
  if(!url.startsWith('/')&&!/^https:\/\/cards\.scryfall\.io\//.test(url))return Promise.reject(new Error('Unsupported image source'));
  const previous=artMemory.get(url);
  const p=(async()=>{
    // Wait for an existing download before evicting it, so it cannot overwrite the retry.
    if(retry)await previous?.catch(()=>{});
    let cache:Cache|undefined;
    try{
      cache=await caches.open(ART_CACHE);
      if(retry)await cache.delete(url);
      else {const hit=await cache.match(url);if(hit)return URL.createObjectURL(await hit.blob());}
    }catch{}
    const fetchArt=async()=>{
      await delay(120);
      const r=await fetch(url,{signal:AbortSignal.timeout(20000),...(retry?{cache:'reload' as const}:{})});
      if(!r.ok)throw new Error('Card art unavailable');
      const b=await r.blob();
      try{await cache?.put(url,new Response(b,{headers:{'Content-Type':b.type}}));}catch{}
      return URL.createObjectURL(b);
    };
    const pending=artQueue.then(fetchArt);artQueue=pending.catch(()=>{});return pending;
  })();
  artMemory.set(url,p);
  p.catch(()=>{if(artMemory.get(url)===p)artMemory.delete(url);});
  return p;
}
export function cachedArt(url:string):Promise<string>{
  if(artMemory.has(url))return artMemory.get(url)!;
  if(url.startsWith('/'))return Promise.resolve(url);
  return loadArt(url);
}
export function retryArt(url:string):Promise<string>{
  const pending=artRetries.get(url);if(pending)return pending;
  const previous=artMemory.get(url);
  const p=loadArt(url,true);artRetries.set(url,p);
  for(const listener of artListeners.get(url)??[])listener();
  const finish=()=>{artRetries.delete(url);void previous?.then(src=>{if(src.startsWith('blob:'))URL.revokeObjectURL(src);},()=>{});};
  p.then(finish,finish);
  return p;
}
export async function cacheStats(){try{const a=await (await caches.open(ART_CACHE)).keys();return a.length;}catch{return 0;}}
