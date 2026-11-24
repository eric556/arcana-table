export type Format = "commander" | "60-card";
export type Zone = "library" | "hand" | "battlefield" | "graveyard" | "exile" | "command" | "sideboard" | "stack";
export const ZONES: Zone[] = ["library", "hand", "battlefield", "graveyard", "exile", "command", "sideboard", "stack"];
export const LABELS: Record<Zone, string> = {library:"Library",hand:"Hand",battlefield:"Battlefield",graveyard:"Graveyard",exile:"Exile",command:"Command zone",sideboard:"Sideboard",stack:"Stack"};
export type CardFace = {name:string;type:string;text:string;mana?:string};
export type CardData = {layout?:string;faces?:CardFace[];keywords?:string[];id:string;name:string;image?:string;backImage?:string;type:string;text?:string;mana?:string;power?:string;toughness?:string;artist?:string;scryfall?:string};
export type BoardPosition = {x:number;y:number;space?:'area'};
export function cleanPosition(raw:unknown):BoardPosition|undefined {
 const p=raw as BoardPosition|undefined;return p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y)),...(p.space==='area'?{space:'area' as const}:{})}:undefined;
}
export type Card = {layer?:number;commanderTax?:number;movePermission?:string;exilePileId?:string;permission?:import('./shared-cards').PlayPermission;controllerId?:string;exileGroup?:string;exileNote?:string;position?:BoardPosition;uid:string;data:CardData;tapped:boolean;counters:number;namedCounters?:Record<string,number>;roomDoors?:number;classLevel?:number;faceDown:boolean;back:boolean;token?:boolean;tokenCount?:number};
export type LibraryView = {id:string;ids:string[];revealed:boolean};
export type CardMove = {uid:string;to:Zone;bottom?:boolean;faceDown?:boolean};
export type Player = {revealed?:{id:string;targets:{uid:string;zone:Zone}[]};privateCards?:Record<string,CardData>;completedShared?:string[];libraryView?:LibraryView;id:string;name:string;deckName:string;life:number;poison:number;damage:Record<string,number>;zones:Record<Zone,Card[]>};
export type PublicPlayer = Omit<Player,"zones"|"libraryView"|"privateCards"|"completedShared"|"revealed"> & {revealId?:string;revealedCards?:{card:Card;zone:Zone}[];revealedLibrary:Card[];zones:Record<Zone,Card[]>;counts:Record<Zone,number>;connected:boolean};
export type LogEntry = {id:string;text:string;time:number};
export type AttackAssignment = {cardId:string;targetId:string;targetCardId?:string};
export type Attack = AttackAssignment & {attackerId:string};
export type Block = {blockerId:string;cardId:string;attackerCardId:string};
export type CombatGesture = {type:'attack';cardId:string;targetId?:string;targetCardId?:string;combatId:string}|{type:'finishAttackers';combatId:string}|{type:'editAttackers';combatId:string}|{type:'finishBlockers';combatId:string}|{type:'editBlockers';combatId:string}|{type:'block';cardId:string;attackerCardId?:string;combatId:string};
export type StackDestination = 'battlefield'|'graveyard'|'exile'|'hand'|'command'|'library';
export type TableTarget = {kind:"player";ownerId:string}|{kind:"card";ownerId:string;cardId:string};
export type Attachment = {ownerId:string;cardId:string;target:TableTarget};
export type StackEntry = {controllerId?:string;targets?:TableTarget[];id:string;ownerId:string;kind:'spell'|'ability';label:string;description?:string;cardId?:string;card?:Card;sourceName?:string;sourceCard?:Card;respondsTo?:string;pending?:{id:string;actorId:string;to:StackDestination;outcome:'resolve'|'counter'}};
export type Table = {sharedRequests?:import('./shared-cards').SharedRequest[];remoteActions?:import('./shared-cards').RemoteCardAction[];attachments:Attachment[];format:Format;players:PublicPlayer[];turn:string;turnNumber:number;phase:number;combat:{id:string;attackersLocked?:boolean;defendersDone?:string[];attacks:Attack[];blocks:Block[]};stack:{revision:number;entries:StackEntry[];passes:string[]};log:LogEntry[]};
export const PHASES = ["Beginning", "Main 1", "Combat", "Main 2", "Ending"];
export const uid = () => { const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
export function emptyPlayer(name:string,format:Format,id=uid()):Player {return {id,name,deckName:"No deck loaded",life:format==="commander"?40:20,poison:0,damage:{},zones:Object.fromEntries(ZONES.map(z=>[z,[] as Card[]])) as Record<Zone,Card[]>};}
export function card(data:CardData):Card {return {uid:uid(),data,tapped:false,counters:0,faceDown:false,back:false};}
export function shuffle<T>(list:T[]):T[] {const a=[...list];for(let i=a.length-1;i>0;i--){const n=new Uint32Array(1);let v:number;const limit=2**32-(2**32%(i+1));do{crypto.getRandomValues(n);v=n[0];}while(v>=limit);const j=v%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function viewedLibraryCards(p:Player):Card[] {
  const ids=new Set(p.libraryView?.ids??[]);
  return p.zones.library.filter(c=>ids.has(c.uid));
}
export function publicPlayer(p:Player,connected=true):PublicPlayer {
  // Private look sessions and their card IDs are omitted from shared views.
  const {libraryView,privateCards,completedShared,revealed,...publicBase}=p;
  const revealedLibrary=libraryView?.revealed?viewedLibraryCards(p).map(c=>({...c,data:{...c.data},faceDown:false})):[];
  return {...publicBase,damage:{...p.damage},connected,revealedLibrary,revealId:revealed?.id,revealedCards:(revealed?.targets??[]).flatMap(x=>{const c=p.zones[x.zone].find(c=>c.uid===x.uid);return c?[{zone:x.zone,card:{...c,data:{...c.data},faceDown:false}}]:[];}),counts:Object.fromEntries(ZONES.map(z=>[z,p.zones[z].length])) as Record<Zone,number>,zones:Object.fromEntries(ZONES.map(z=>[z,["library","hand","sideboard"].includes(z)?[]:p.zones[z].map(c=>({...c,...(c.faceDown?{roomDoors:undefined,classLevel:undefined}:{}),data:c.faceDown?{id:"hidden",name:"Face-down card",type:"Hidden"}:{...c.data}}))])) as Record<Zone,Card[]>};
}
export function newTable(p:Player,format:Format):Table {return {attachments:[],format,players:[publicPlayer(p)],turn:p.id,turnNumber:1,phase:0,combat:{id:uid(),attacks:[],blocks:[]},stack:{revision:0,entries:[],passes:[]},log:[]};}
export function hasFaces(c:Card):boolean {return !!c.data.backImage||(c.data.faces?.length??0)>1;}
export function isRoom(c:Card):boolean {return c.data?.layout==='split'&&/\bRoom\b/.test(c.data?.type??'');}
export function faceLabel(c:Card,back:boolean):string {return isRoom(c)?back?'Right door':'Left door':c.data.layout==='adventure'?back?'Adventure':'Permanent':!c.data.backImage&&hasFaces(c)?back?'Right half':'Left half':back?'Back':'Front';}
export function backFaceLabel(c:Card):string {if(isRoom(c))return 'Room · two doors';if(c.data.layout==='adventure')return 'Permanent + Adventure';if(c.data.layout==='split')return 'Choose a half';return c.data.layout==='modal_dfc'?'Either face playable':c.data.layout==='transform'||c.data.layout==='double_faced_token'?'Transforms / two faces':'Two faces';}
export function cleanNamedCounters(raw:unknown):Record<string,number> {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 return Object.fromEntries(Object.entries(raw).slice(0,64).flatMap(([name,value])=>{
  const key=name.trim().slice(0,64);
  return key&&!['__proto__','constructor','prototype'].includes(key)&&typeof value==='number'&&Number.isSafeInteger(value)&&value>0?[[key,value]]:[];
 }));
}
export function faceName(c:Card):string {return hasFaces(c)?(c.data.faces?.[c.back?1:0]?.name??c.data.name.split(' // ')[c.back?1:0]??c.data.name):c.data.name;}
export function activeType(c:Card):string {return hasFaces(c)?(c.data.faces?.[c.back?1:0]?.type??c.data.type.split(' // ')[c.back?1:0]??c.data.type):c.data.type;}
export type ProgressStage={value:number;label:string;text:string;cost?:string};
export function roman(n:number):string {if(n<1||n>20)return String(n);const pairs:[number,string][]=[[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let out='';for(const [v,label] of pairs)while(n>=v){out+=label;n-=v;}return out;}
const romanNumber=(s:string)=>{const values:Record<string,number>={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};return [...s].reduce((n,c,i)=>n+(values[c]<(values[s[i+1]]??0)?-values[c]:values[c]),0);};
export function progressInfo(c:Card):{kind:'saga'|'class'|'leveler';value:number;min:number;max:number;stages:ProgressStage[]}|null {
 if(c.faceDown)return null;
 const type=activeType(c),text=c.data.faces?.[c.back?1:0]?.text??c.data.text??'';
 const counter=(name:string)=>Object.entries(c.namedCounters??{}).filter(([k])=>k.toLowerCase()===name.toLowerCase()).reduce((n,[,v])=>Math.min(Number.MAX_SAFE_INTEGER,n+v),0);
 if(/\bSaga\b/.test(type)){
  const matches=[...text.matchAll(/^([IVXLCDM]+(?:,\s*[IVXLCDM]+)*)\s*[—–-]\s*/gm)];
  const stages=matches.flatMap((m,i)=>m[1].split(/,\s*/).map(label=>({value:romanNumber(label),label,text:text.slice(m.index!+m[0].length,matches[i+1]?.index??text.length).trim()}))).filter(s=>s.value>0&&s.value<=20).sort((a,b)=>a.value-b.value);
  return {kind:'saga',value:counter('Lore'),min:0,max:stages.length>0?Math.max(...stages.map(s=>s.value)):3,stages};
 }
 if(/\bClass\b/.test(type)){
  const matches=[...text.matchAll(/^(.*?):\s*Level\s+(\d+)\s*$/gmi)];
  const stages:ProgressStage[]=[{value:1,label:'1',text:text.slice(0,matches[0]?.index??text.length).trim()},...matches.map((m,i)=>({value:Number(m[2]),label:m[2],cost:m[1],text:text.slice(m.index!+m[0].length,matches[i+1]?.index??text.length).trim()})).filter(s=>s.value>1&&s.value<=20)];
  return {kind:'class',value:c.classLevel??1,min:1,max:stages.length>1?Math.max(...stages.map(s=>s.value)):3,stages};
 }
 if(/\bLevel up\b/i.test(text)){
  const matches=[...text.matchAll(/^LEVEL\s+(\d+)(?:[-–](\d+)|\+)?\s*$/gm)];
  const stages:ProgressStage[]=[{value:0,label:'0',text:text.slice(0,matches[0]?.index??text.length).trim()},...matches.map((m,i)=>({value:Number(m[1]),label:m[0].trim().replace('LEVEL ',''),text:text.slice(m.index!+m[0].length,matches[i+1]?.index??text.length).trim()}))];
  return {kind:'leveler',value:counter('Level'),min:0,max:Number.MAX_SAFE_INTEGER,stages};
 }
 return null;
}
function enterProgress(c:Card){const info=progressInfo(c);if(info?.kind==='saga'&&!Object.keys(c.namedCounters??{}).some(k=>k.toLowerCase()==='lore'))c.namedCounters={...c.namedCounters,Lore:1};if(info?.kind==='class')c.classLevel=1;}
export function playDestination(c:Card):Zone {return activeType(c).includes('Land')&&!c.faceDown?'battlefield':'stack';}
export function advanceTurn(table:Table,phase?:number):Table {
  const t=structuredClone(table);
  if(typeof phase==='number'&&Number.isFinite(phase))t.phase=Math.max(0,Math.min(4,Math.floor(phase)));
  else {
    const live=t.players.filter(p=>p.connected),i=live.findIndex(p=>p.id===t.turn);
    t.turn=live[(i+1)%live.length]?.id??t.turn;t.turnNumber++;t.phase=0;
    t.log.unshift(logEntry(`Turn passed to ${t.players.find(p=>p.id===t.turn)?.name}.`));
  }
  // A fresh ID prevents an open editor or delayed packet from restoring an earlier combat.
  if(t.phase!==table.phase||t.turnNumber!==table.turnNumber)t.combat={id:uid(),attacks:[],blocks:[]};
  return t;
}
const fieldFor=(t:Table,id:string)=>t.players.flatMap(p=>p.zones.battlefield.filter(c=>(c.controllerId??p.id)===id));
export function validAttackTarget(t:Table,a:AttackAssignment):boolean {return t.players.some(p=>p.id===a.targetId)&&(!a.targetCardId||fieldFor(t,a.targetId).some(c=>c.uid===a.targetCardId&&!c.faceDown&&activeType(c).includes('Planeswalker')));}
export function combatDefenders(t:Table):string[]{return [...new Set(t.combat.attacks.map(a=>a.targetId))];}
export function combatReady(t:Table):boolean {const defenders=combatDefenders(t);return t.phase===2&&!!t.combat.attackersLocked&&defenders.length>0&&defenders.every(id=>t.combat.defendersDone?.includes(id));}
export function pruneCombat(t:Table):void {
  const attacks=t.combat.attacks,blocks=t.combat.blocks;
  t.combat.attacks=t.combat.attacks.filter(a=>t.phase===2&&a.attackerId===t.turn&&a.targetId!==a.attackerId&&validAttackTarget(t,a)&&fieldFor(t,a.attackerId).some(c=>c.uid===a.cardId));
  t.combat.blocks=t.combat.blocks.filter(b=>t.combat.attacks.some(a=>a.cardId===b.attackerCardId&&a.targetId===b.blockerId)&&fieldFor(t,b.blockerId).some(c=>c.uid===b.cardId));
  const changed=new Set([...attacks.filter(a=>!t.combat.attacks.includes(a)).map(a=>a.targetId),...blocks.filter(b=>!t.combat.blocks.includes(b)).map(b=>b.blockerId)]);
  t.combat.defendersDone=t.combat.attackersLocked?(t.combat.defendersDone??[]).filter(id=>combatDefenders(t).includes(id)&&!changed.has(id)):[];
}
export function declareAttackers(table:Table,actor:string,assignments:unknown,combatId:string):Table {
  if(table.phase!==2||table.turn!==actor||table.combat.attackersLocked||table.combat.id!==combatId||!Array.isArray(assignments)||assignments.length>500)return table;
  const p=table.players.find(p=>p.id===actor);if(!p)return table;
  const seen=new Set<string>(),attacks:Attack[]=[];
  for(const a of assignments){
    if(!a||typeof a.cardId!=='string'||typeof a.targetId!=='string'||seen.has(a.cardId)||!fieldFor(table,actor).some(c=>c.uid===a.cardId)||a.targetId===actor||!validAttackTarget(table,a))return table;
    seen.add(a.cardId);attacks.push({attackerId:actor,cardId:a.cardId,targetId:a.targetId,...(a.targetCardId?{targetCardId:a.targetCardId}:{})});
  }
  if(attacks.length===table.combat.attacks.length&&attacks.every(a=>table.combat.attacks.some(b=>a.cardId===b.cardId&&a.targetId===b.targetId&&a.targetCardId===b.targetCardId&&a.attackerId===b.attackerId)))return table;
  const t=structuredClone(table);t.combat.attacks=attacks;
  pruneCombat(t);
  const groups=t.players.map(target=>({target,n:attacks.filter(a=>a.targetId===target.id).reduce((n,a)=>n+tokenCount(fieldFor(t,actor).find(c=>c.uid===a.cardId)!),0)})).filter(g=>g.n);
  t.log.unshift(logEntry(groups.length?`${p.name} declared ${groups.map(({target,n})=>`${n} attacker${n===1?'':'s'} toward ${target.name}`).join(', ')}.`:`${p.name} cleared their attackers.`));
  return t;
}
export function applyCombatGesture(table:Table,actor:string,raw:unknown):{table:Table;error?:string}{
  const reject=(error:string)=>({table,error});
  if(!raw||typeof raw!=='object')return reject('Choose a battlefield card.');
  const a=raw as CombatGesture;
  if(table.phase!==2||a.combatId!==table.combat.id)return reject('Combat changed. Pick up the card again during combat.');
  const p=table.players.find(p=>p.id===actor&&p.connected);
  if(!p)return reject('Your seat is disconnected.');
  if(a.type==='finishAttackers'||a.type==='editAttackers'){
    if(table.turn!==actor)return reject('Only the attacking player can finish or edit attackers.');
    if(a.type==='finishAttackers'&&table.combat.attackersLocked)return {table};
    const t=structuredClone(table);t.combat.attackersLocked=a.type==='finishAttackers';t.combat.defendersDone=[];
    if(a.type==='editAttackers'){t.combat.blocks=[];t.combat.id=uid();}
    t.log.unshift(logEntry(a.type==='finishAttackers'?`${p.name} finished declaring attackers. Defenders may assign blockers.`:`${p.name} reopened attackers. Block assignments were cleared.`));return {table:t};
  }
  if(a.type==='finishBlockers'||a.type==='editBlockers'){
    if(!table.combat.attackersLocked)return reject('Wait for the attacking player to finish declaring attackers.');
    if(!combatDefenders(table).includes(actor))return reject('Only a player being attacked can confirm their blockers.');
    const done=table.combat.defendersDone??[],finishing=a.type==='finishBlockers';
    if(done.includes(actor)===finishing)return {table};
    const t=structuredClone(table);t.combat.defendersDone=finishing?[...done,actor]:done.filter(id=>id!==actor);
    t.log.unshift(logEntry(finishing?`${p.name} finished declaring blockers.`:`${p.name} is editing their blockers.`));
    if(combatReady(t))t.log.unshift(logEntry('All defenders are done declaring. Resolve any responses, then apply combat damage manually.'));
    return {table:t};
  }
  const c=fieldFor(table,actor).find(c=>c.uid===a.cardId);
  if(!p||!c)return reject('Use a card from your own battlefield.');
  if(a.type==='attack'){
    if(table.turn!==actor)return reject('Only the attacking player can assign attackers.');
    if(table.combat.attackersLocked)return reject('Choose Edit attackers before changing attacks. This clears existing blocks.');
    if(a.targetId!==undefined&&(a.targetId===actor||!validAttackTarget(table,{cardId:a.cardId,targetId:a.targetId,targetCardId:a.targetCardId})))return reject('Drop the attacker on another player or a planeswalker they control.');
    const assignments=table.combat.attacks.filter(x=>x.cardId!==a.cardId).map(({cardId,targetId,targetCardId})=>({cardId,targetId,targetCardId}));
    if(a.targetId)assignments.push({cardId:a.cardId,targetId:a.targetId,targetCardId:a.targetCardId});
    return {table:declareAttackers(table,actor,assignments,a.combatId)};
  }
  if(a.type==='block'){
    if(!table.combat.attackersLocked)return reject('Wait for the attacking player to finish declaring attackers.');
    const attack=table.combat.attacks.find(x=>x.cardId===a.attackerCardId&&x.targetId===actor);
    if(a.attackerCardId!==undefined&&!attack)return reject('Block an attacker that is attacking you.');
    const t=structuredClone(table);t.combat.defendersDone=(t.combat.defendersDone??[]).filter(id=>id!==actor);t.combat.blocks=t.combat.blocks.filter(b=>!(b.blockerId===actor&&b.cardId===a.cardId));
    if(attack)t.combat.blocks.push({blockerId:actor,cardId:a.cardId,attackerCardId:attack.cardId});
    const attackingCard=attack?t.players.find(p=>p.id===attack.attackerId)?.zones.battlefield.find(c=>c.uid===attack.cardId):undefined;
    t.log.unshift(logEntry(attack?`${p.name} blocked ${attackingCard?.data.name??'an attacker'} with ${c.faceDown?'a face-down card':c.data.name}.`:`${p.name} removed ${c.faceDown?'a face-down card':c.data.name} from blocking.`));
    return {table:t};
  }
  return reject('Unknown combat action.');
}
export const MAX_TOKEN_COUNT=9999;
export function tokenCount(c:Card|undefined):number {return c?.token&&Number.isSafeInteger(c.tokenCount)?Math.max(1,Math.min(MAX_TOKEN_COUNT,c.tokenCount!)):1;}
export type TokenAction={type:'tokenCopy'|'tokenSplit';uid:string;count:number};
// These operations run on the host's transaction clone, never a guest projection.
function splitTokens(players:Player[],table:Table,id:string,count:number):Card {
 const owner=players.find(p=>p.zones.battlefield.some(c=>c.uid===id)),source=owner?.zones.battlefield.find(c=>c.uid===id);
 if(!owner||!source?.token||count<1||count>=tokenCount(source))throw new Error('Choose fewer tokens than the stack contains.');
 if(owner.zones.battlefield.length>=1000)throw new Error('Remove unused cards before splitting more stacks.');
 if(table.attachments.some(a=>a.cardId===id||a.target.kind==='card'&&a.target.cardId===id))throw new Error('Detach cards before splitting this token stack.');
 const next={...structuredClone(source),uid:uid(),tokenCount:count};source.tokenCount=tokenCount(source)-count;
 if(next.position)next.position={...next.position,x:Math.min(.95,next.position.x+.045),y:Math.min(.95,next.position.y+.025)};
 owner.zones.battlefield.push(next);
 const attack=table.combat.attacks.find(a=>a.cardId===id);if(attack)table.combat.attacks.push({...attack,cardId:next.uid});
 return next;
}
export function applyTokenAction(players:Player[],table:Table,actor:string,a:TokenAction):void {
 if(!Number.isSafeInteger(a.count)||a.count<1||a.count>MAX_TOKEN_COUNT)throw new Error('Choose between 1 and 9,999 tokens.');
 const owner=players.find(p=>p.zones.battlefield.some(c=>c.uid===a.uid)),source=owner?.zones.battlefield.find(c=>c.uid===a.uid);
 if(!owner||!source?.token||(source.controllerId??owner.id)!==actor)throw new Error('Choose a token you control on the battlefield.');
 if(a.type==='tokenSplit')splitTokens(players,table,a.uid,a.count);
 else {
  const controller=players.find(p=>p.id===actor)!;if(controller.zones.battlefield.length>=1000)throw new Error('Remove unused cards before creating more stacks.');
  controller.zones.battlefield.push({...card(structuredClone(source.data)),token:true,tokenCount:a.count,back:source.back,faceDown:source.faceDown,...(source.position?{position:{...source.position,x:Math.min(.95,source.position.x+.045),y:Math.min(.95,source.position.y+.025)}}:{})});
 }
 table.log.unshift(logEntry(`${table.players.find(p=>p.id===actor)?.name} ${a.type==='tokenSplit'?'split off':'created'} ${a.count} ${source.faceDown?'face-down token':faceName(source)} token${a.count===1?'':'s'}.`));
}
export function applyTokenCombat(players:Player[],table:Table,actor:string,command:CombatGesture):Table {
 const checked=applyCombatGesture(table,actor,command);if(checked.error)throw new Error(checked.error);
 if(command.type!=='block'||!command.attackerCardId)return checked.table;
 const t=structuredClone(table),c={...command};
 const find=(id:string)=>players.flatMap(p=>p.zones.battlefield).find(x=>x.uid===id);
 if(tokenCount(find(c.attackerCardId!)!)>1)c.attackerCardId=splitTokens(players,t,c.attackerCardId!,1).uid;
 if(tokenCount(find(c.cardId)!)>1)c.cardId=splitTokens(players,t,c.cardId,1).uid;
 t.players=players.map(p=>publicPlayer(p,table.players.find(x=>x.id===p.id)?.connected??true));
 const result=applyCombatGesture(t,actor,c);if(result.error)throw new Error(result.error);return result.table;
}
// Layer ranks are shared visual state; ordering never changes card positions.
export function layerRanks(cards:Card[]):Map<string,number>{return new Map(cards.map((c,i)=>({c,i})).sort((a,b)=>Number(activeType(a.c).includes('Land'))-Number(activeType(b.c).includes('Land'))||a.i-b.i).map(({c},i)=>({c,i})).sort((a,b)=>(a.c.layer??a.i)-(b.c.layer??b.i)||a.i-b.i).map(({c},i)=>[c.uid,i]));}
export function arrangeLayer(players:Pick<Player,'id'|'zones'>[],actor:string,a:{uid:string;direction:'front'|'back'|'forward'|'backward'}):boolean{
 const found=players.flatMap(p=>p.zones.battlefield.map(c=>({c,owner:p.id}))).find(x=>x.c.uid===a.uid);
 if(!found||!['front','back','forward','backward'].includes(a.direction))return false;
 const seat=found.c.controllerId??found.owner;
 if(seat!==actor&&found.c.movePermission!==actor)return false;
 const cards=players.flatMap(p=>p.zones.battlefield.filter(c=>(c.controllerId??p.id)===seat)),ranks=layerRanks(cards);
 cards.sort((a,b)=>ranks.get(a.uid)!-ranks.get(b.uid)!);
 const index=cards.findIndex(c=>c.uid===a.uid),[card]=cards.splice(index,1);
 const to=a.direction==='front'?cards.length:a.direction==='back'?0:a.direction==='forward'?Math.min(index+1,cards.length):Math.max(0,index-1);
 cards.splice(to,0,card);cards.forEach((c,i)=>c.layer=i);return true;
}
export function revealOwnedCards(p:Player,ids:string[]){
 const targets=ZONES.flatMap(zone=>p.zones[zone].filter(c=>ids.includes(c.uid)).map(c=>({uid:c.uid,zone})));
 const merged=new Map([...(p.revealed?.targets??[]),...targets].map(x=>[x.uid,x]));
 if(targets.length)p.revealed={id:uid(),targets:[...merged.values()]};
}
// Group land faces by basic land types, then by the mana their text produces.
export function landTidyGroup(c:Card){
 const type=activeType(c),text=c.data.faces?.[c.back?1:0]?.text??c.data.text??'',types=['Plains','Island','Swamp','Mountain','Forest'],colors=['W','U','B','R','G'];
 const typed=types.flatMap((t,i)=>new RegExp('\\b'+t+'\\b').test(type)?[colors[i]]:[]);
 const mana=[...text.matchAll(/\badd\s+([^.;\n]+)/gi)].map(m=>m[1]).join(' ');
 const produced=/any (?:one )?color|any combination of colors/i.test(mana)?colors:colors.filter(k=>mana.includes('{'+k+'}'));
 const group=typed.length?typed:produced;
 return group.length?group.map(k=>colors.indexOf(k)).join(''):'5';
}
export function tidyBattlefield(players:Pick<Player,'id'|'zones'>[],actor:string,attachments:Attachment[]=[]){
 const attached=new Set(attachments.map(a=>a.cardId));
 const cards=players.flatMap(p=>p.zones.battlefield.filter(c=>(c.controllerId??p.id)===actor&&!attached.has(c.uid)));
 const creatures=cards.filter(c=>/\bCreature\b/.test(activeType(c))),lands=cards.filter(c=>!creatures.includes(c)&&/\bLand\b/.test(activeType(c))),other=cards.filter(c=>!creatures.includes(c)&&!lands.includes(c));
 lands.sort((a,b)=>landTidyGroup(a).localeCompare(landTidyGroup(b))||Number(!/\bBasic\b/.test(activeType(a)))-Number(!/\bBasic\b/.test(activeType(b)))||faceName(a).localeCompare(faceName(b)));
 const first=creatures.length<=8?creatures.length:Math.max(8,Math.ceil(creatures.length/2));
 const rows=[creatures.slice(0,first),[...creatures.slice(first),...other],lands];
 let layer=0;rows.forEach((row,y)=>{
  const widest=Math.max(132,...row.map(c=>isRoom(c)&&!c.faceDown?184:132)),offsets=[0];
  for(let i=1;i<row.length;i++)offsets.push(offsets[i-1]+(y!==2?156:faceName(row[i])===faceName(row[i-1])?48:landTidyGroup(row[i])===landTidyGroup(row[i-1])?90:156));
  const scale=Math.min(1,(1056-widest)/Math.max(1,offsets.at(-1)!));
  row.forEach((c,i)=>{c.position={x:offsets[i]*scale/924,y:y/2};c.layer=layer++;});
 });
}
export type Action = TokenAction|{type:"revealCards";ids:string[]}|{type:"hideCards";ids?:string[]}|{type:"playableExile";uid:string;faceDown?:boolean}|{type:"endExilePlay";uid:string}|{type:"layer";uid:string;direction:"front"|"back"|"forward"|"backward"}|{type:"commanderTax";uid:string;amount:number}|{type:"progress";uid:string;value:number}|{type:"scry"|"surveil";count:number;expected:string[];top:string[];other:string[]}|{type:"position";uid:string;position:BoardPosition}|{type:"arrange"}|{type:"roomDoor";uid:string;door:0|1;unlocked:boolean}|{type:"namedCounter";uid:string;name:string;amount:number;set?:boolean}|{type:"viewTop";count:number;reveal?:boolean}|{type:"setLibraryReveal";revealed:boolean}|{type:"finishLibraryView"}|{type:"moveMany";moves:CardMove[];finishView?:boolean}|{type:"draw"|"mill";count?:number}|{type:"shuffle"|"mulligan"|"untap"}|{type:"move";uid:string;to:Zone;bottom?:boolean;back?:boolean;faceDown?:boolean;position?:BoardPosition}|{type:"tap"|"flip"|"faceDown"|"counter"|"remove";uid:string;amount?:number}|{type:"life"|"poison";amount:number}|{type:"damage";target:string;amount:number}|{type:"token";name:string;stats?:string;count?:number;keywords?:string;abilities?:string}|{type:"rename";name:string};
// Reset only this player's play area. Foreign-owned permanents stay in their owner's deck.
export function resetMulliganCards(player:Player,actor=player.id):Player {
 let next=structuredClone(player);
 const returning=[...(actor===player.id?[...next.zones.hand,...next.zones.graveyard,...next.zones.exile]:[]),...next.zones.battlefield.filter(c=>(c.controllerId??player.id)===actor)];
 const tokens=new Set(returning.filter(c=>c.token).map(c=>c.uid));
 for(const z of ['hand','battlefield','graveyard','exile'] as const)next.zones[z]=next.zones[z].filter(c=>!tokens.has(c.uid));
 const moves=returning.filter(c=>!c.token).map(c=>({uid:c.uid,to:'library' as const}));
 for(let i=0;i<moves.length;i+=500)next=act(next,{type:'moveMany',moves:moves.slice(i,i+500)}).player;
 if(actor===player.id)delete next.revealed;
 return act(next,{type:'shuffle'}).player;
}
export function act(player:Player,a:Action):{player:Player;message:string} {
  if(a.type==='scry'||a.type==='surveil'){
    const unchanged={player,message:''};
    if(!Number.isSafeInteger(a.count)||a.count<0||!Array.isArray(a.expected)||!Array.isArray(a.top)||!Array.isArray(a.other))return unchanged;
    const expected=player.zones.library.slice(0,a.count).map(c=>c.uid),chosen=[...a.top,...a.other];
    if(a.expected.length!==expected.length||a.expected.some((id,i)=>id!==expected[i])||chosen.length!==expected.length||new Set(chosen).size!==chosen.length||chosen.some(id=>!expected.includes(id)))return unchanged;
    if(a.count===0)return unchanged;
    const moves:CardMove[]=[...a.top.map(uid=>({uid,to:'library' as const})),...a.other.map(uid=>({uid,to:a.type==='scry'?'library' as const:'graveyard' as const,bottom:a.type==='scry'}))];
    const next=moves.length?act(player,{type:'moveMany',moves,finishView:true}).player:structuredClone(player);
    delete next.libraryView;
    if(a.type==='surveil')next.zones.graveyard.forEach(c=>{if(a.other.includes(c.uid))c.faceDown=false;});
    return {player:next,message:`${player.name} ${a.type==='scry'?'scried':'surveilled'} ${a.count}: ${a.top.length} on top, ${a.other.length} ${a.type==='scry'?'on bottom':'to graveyard'}.`};
  }
  if(a.type==='mulligan'){
   const next=resetMulliganCards(player);next.zones.hand=next.zones.library.splice(0,7);
   return {player:next,message:`${player.name} shuffled their hand, battlefield, graveyard, and exile into their library and drew ${next.zones.hand.length} cards.`};
  }
  const p=structuredClone(player);let msg="";
  const locate=(id:string)=>{for(const z of ZONES){const c=p.zones[z].find(c=>c.uid===id);if(c)return {c,z};}return null;};
  if(a.type==="layer")arrangeLayer([p],p.id,a);
  if(a.type==="position"){const c=p.zones.battlefield.find(c=>c.uid===a.uid),position=cleanPosition(a.position);if(!c||!position)return {player,message:""};c.position=position;}
  if(a.type==="arrange")tidyBattlefield([p],p.id);
  if(a.type==='revealCards'){revealOwnedCards(p,a.ids);msg=`revealed ${a.ids.length} selected card(s)`;}
  if(a.type==='hideCards'){if(a.ids&&p.revealed)p.revealed.targets=p.revealed.targets.filter(x=>!a.ids!.includes(x.uid));else {delete p.revealed;if(p.libraryView)p.libraryView.revealed=false;}msg='ended a card reveal';}
  if(a.type==='playableExile'){
   const found=locate(a.uid);if(!found||found.z==='stack')return {player,message:''};
   const next=act(p,{type:'move',uid:a.uid,to:'exile',faceDown:a.faceDown??found.c.faceDown}).player,c=next.zones.exile.find(c=>c.uid===a.uid);
   if(c){c.permission={playerId:p.id,kind:'play',look:true,note:'Playable from exile · timing is manual'};if(!c.faceDown)revealOwnedCards(next,[c.uid]);else if(next.revealed)next.revealed.targets=next.revealed.targets.filter(x=>x.uid!==c.uid);}
   return {player:next,message:`${p.name} moved a card to playable exile.`};
  }
  if(a.type==='endExilePlay'){const c=p.zones.exile.find(c=>c.uid===a.uid);if(c){delete c.permission;delete c.exilePileId;delete c.exileNote;}msg='returned a card to regular exile';}
  if(a.type==="viewTop") {
    if(!Number.isFinite(a.count)||a.count<1)return {player,message:""};
    const n=Math.min(Math.floor(a.count),p.zones.library.length);
    if(!n)return {player,message:""};
    p.libraryView={id:uid(),ids:p.zones.library.slice(0,n).map(c=>c.uid),revealed:!!a.reveal};
    msg=`${a.reveal?"revealed":"looked at"} the top ${n} card${n===1?"":"s"} of their library${a.reveal?"":" privately"}`;
  }
  if(a.type==="setLibraryReveal"&&p.libraryView) {
    p.libraryView.revealed=a.revealed;
    const n=viewedLibraryCards(p).length;
    msg=a.revealed?`revealed ${n} viewed library card${n===1?"":"s"}`:"stopped revealing their library cards";
  }
  if(a.type==="finishLibraryView") {
    if(p.libraryView?.revealed)msg="stopped revealing their library cards";
    delete p.libraryView;
  }
  if(a.type==="moveMany") {
    // Validate the whole batch before removing anything; stale or duplicated selections are no-ops.
    if(!a.moves.length||a.moves.length>500||new Set(a.moves.map(m=>m.uid)).size!==a.moves.length)return {player,message:""};
    const located=a.moves.map(m=>({move:m,found:locate(m.uid)}));
    if(located.some(x=>!x.found||!ZONES.includes(x.move.to)))return {player,message:""};
    const removed=new Set(a.moves.map(m=>m.uid));
    for(const z of ZONES)p.zones[z]=p.zones[z].filter(c=>!removed.has(c.uid));
    const top:Card[]=[],bottom:Card[]=[];
    const counts=new Map<string,number>();
    for(const {move:m,found} of located) {
      const c=found!.c;if(found!.z==="command"||m.to==="command")c.commanderTax??=0;
      if(m.to!==found!.z){delete c.movePermission;delete c.exilePileId;delete c.permission;delete c.exileGroup;delete c.exileNote;if(m.to!=="battlefield"&&m.to!=="stack")delete c.controllerId;}if(typeof m.faceDown==='boolean')c.faceDown=m.faceDown;else if(m.to==='graveyard')c.faceDown=false;
      if(m.to!=="battlefield"){c.tapped=false;c.counters=0;delete c.namedCounters;delete c.position;delete c.layer;delete c.classLevel;}
      if(isRoom(c)){
        if(m.to==='battlefield'&&found!.z!=='battlefield')c.roomDoors=found!.z==='stack'?(c.back?2:1):0;
        else if(m.to!=='battlefield')delete c.roomDoors;
      }
      if(m.to!=="battlefield"&&m.to!=="stack")c.back=false;
      if(m.to==='battlefield'&&c.data.layout==='adventure')c.back=false;
      if(m.to==='battlefield'&&found!.z!=='battlefield')enterProgress(c);
      if(["library","hand","sideboard"].includes(m.to))c.faceDown=false;
      if(m.to==="library")(m.bottom?bottom:top).push(c);else p.zones[m.to].push(c);
      const target=m.to==="library"?(m.bottom?"the bottom of their library":"the top of their library"):LABELS[m.to].toLowerCase();
      counts.set(target,(counts.get(target)??0)+1);
    }
    // In both groups, first listed is closest to the top. Do not reverse via repeated unshift.
    p.zones.library=[...top,...p.zones.library,...bottom];
    if(a.finishView)delete p.libraryView;
    msg=`moved ${Array.from(counts,([to,n])=>`${n} card${n===1?"":"s"} to ${to}`).join(", ")}`;
  }
  if(a.type==="draw"||a.type==="mill") {const n=Math.min(Math.max(1,a.count??1),p.zones.library.length);const cards=p.zones.library.splice(0,n);p.zones[a.type==="draw"?"hand":"graveyard"].push(...cards);msg=`${a.type==="draw"?"drew":"milled"} ${n} card${n===1?"":"s"}`;}
  if(a.type==="shuffle") {if(p.revealed)p.revealed.targets=p.revealed.targets.filter(x=>x.zone!=="library");delete p.libraryView;p.zones.library=shuffle(p.zones.library);msg="shuffled their library";}
  if(a.type==="untap") {p.zones.battlefield.filter(c=>!c.controllerId||c.controllerId===p.id).forEach(c=>c.tapped=false);msg="untapped their battlefield";}
  if(a.type==="move") {const found=locate(a.uid);if(!found)return {player,message:""};const {c,z}=found;if(z==="command"||a.to==="command")c.commanderTax??=0;if(a.to!==z){delete c.movePermission;delete c.exilePileId;delete c.permission;delete c.exileGroup;delete c.exileNote;if(a.to!=="battlefield"&&a.to!=="stack")delete c.controllerId;}if(typeof a.faceDown==='boolean')c.faceDown=a.faceDown;else if(a.to==='graveyard')c.faceDown=false;if(a.to==="battlefield"&&a.position)c.position=cleanPosition(a.position);p.zones[z]=p.zones[z].filter(x=>x.uid!==a.uid);if(a.to!=="battlefield"){c.tapped=false;c.counters=0;delete c.namedCounters;delete c.position;delete c.layer;delete c.classLevel;}if(typeof a.back==="boolean"&&hasFaces(c))c.back=a.back;if(isRoom(c)){if(a.to==='battlefield'&&z!=='battlefield')c.roomDoors=z==='stack'?(c.back?2:1):0;else if(a.to!=='battlefield')delete c.roomDoors;}if(a.to!=="battlefield"&&a.to!=="stack"||a.to==='battlefield'&&c.data.layout==='adventure')c.back=false;if(a.to==='battlefield'&&z!=='battlefield')enterProgress(c);const concealed=["hand","library","sideboard"].includes(z)||c.faceDown;const knownName=concealed&&["hand","library","sideboard"].includes(a.to)?"a card":c.faceDown?"a face-down card":faceName(c);if(["hand","library","sideboard"].includes(a.to))c.faceDown=false;if(a.to==="library"&&!a.bottom)p.zones.library.unshift(c);else p.zones[a.to].push(c);msg=`moved ${knownName} to ${LABELS[a.to].toLowerCase()}${a.to==="library"?(a.bottom?" (bottom)":" (top)"):""}`;}
  if(["tap","flip","faceDown","counter","remove"].includes(a.type)&&"uid" in a) {const found=locate(a.uid);if(!found)return {player,message:""};const {c,z}=found;const privateZone=["hand","library","sideboard"].includes(z);if(a.type==="tap")c.tapped=!c.tapped;if(a.type==="flip")c.back=!c.back;if(a.type==="faceDown"){c.faceDown=!c.faceDown;if(!privateZone&&!c.faceDown)revealOwnedCards(p,[c.uid]);else if(p.revealed)p.revealed.targets=p.revealed.targets.filter(x=>x.uid!==c.uid);}if(a.type==="counter")c.counters=Math.max(0,Math.min(999,c.counters+(a.amount??1)));if(a.type==="remove"&&c.token)p.zones[z]=p.zones[z].filter(x=>x.uid!==c.uid);msg=privateZone?"":`${a.type==="tap"?(c.tapped?"tapped":"untapped"):a.type==="flip"?"turned over":a.type==="counter"?"changed counters on":a.type==="remove"?"removed":"changed visibility of"} ${c.faceDown?"a face-down card":faceName(c)}`;}
  if(a.type==='commanderTax'){
    const found=locate(a.uid);
    if(!found||(found.z!=='command'&&found.c.commanderTax===undefined)||!Number.isSafeInteger(a.amount)||a.amount%2!==0)return {player,message:''};
    found.c.commanderTax=Math.max(0,Math.min(100000,(found.c.commanderTax??0)+a.amount));
    msg=`set commander tax for ${faceName(found.c)} to {${found.c.commanderTax}}`;
  }
  if(a.type==='progress'){
    const c=p.zones.battlefield.find(c=>c.uid===a.uid),info=c?progressInfo(c):null;
    if(!c||!info||!Number.isSafeInteger(a.value)||a.value<info.min||a.value>info.max)return {player,message:''};
    if(info.kind==='class')c.classLevel=a.value;
    else {const name=info.kind==='saga'?'Lore':'Level';c.namedCounters=Object.fromEntries(Object.entries(c.namedCounters??{}).filter(([k])=>k.toLowerCase()!==name.toLowerCase()));if(a.value)c.namedCounters[name]=a.value;}
    msg=`set ${faceName(c)} to ${info.kind==='saga'?'chapter':'level'} ${info.kind==='saga'?roman(a.value):a.value}`;
  }
  if(a.type==='roomDoor'){
    const found=locate(a.uid);
    if(!found||found.z!=='battlefield'||!isRoom(found.c)||found.c.faceDown||![0,1].includes(a.door)||typeof a.unlocked!=='boolean')return {player,message:''};
    const bit=1<<a.door;found.c.roomDoors=a.unlocked?(found.c.roomDoors??0)|bit:(found.c.roomDoors??0)&~bit;
    msg=`${a.unlocked?'unlocked':'locked'} ${faceName({...found.c,back:a.door===1})}`;
  }
  if(a.type==='namedCounter'){
   const found=locate(a.uid),name=a.name.trim().slice(0,64);
   if(!found||!name||['__proto__','constructor','prototype'].includes(name)||!Number.isSafeInteger(a.amount))return {player,message:''};
   const {c,z}=found,values=cleanNamedCounters(c.namedCounters),key=Object.keys(values).find(k=>k.toLowerCase()===name.toLowerCase())??name;
   if(!(key in values)&&Object.keys(values).length>=64)return {player,message:''};
   const value=Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,a.set?a.amount:(values[key]??0)+a.amount));
   if(value)values[key]=value;else delete values[key];c.namedCounters=values;
   msg=['hand','library','sideboard'].includes(z)?'':`set ${key} counters on ${c.faceDown?'a face-down card':faceName(c)} to ${value}`;
  }
  if(a.type==="life"||a.type==="poison"){if(!Number.isSafeInteger(a.amount))return {player,message:""};p[a.type]=Math.max(a.type==="life"?-999:0,Math.min(a.type==="life"?999:Number.MAX_SAFE_INTEGER,p[a.type]+a.amount));msg=`set ${a.type} to ${p[a.type]}`;}
  if(a.type==="damage"){if(!Number.isSafeInteger(a.amount)||["__proto__","constructor","prototype"].includes(a.target))return {player,message:""};const before=p.damage[a.target]??0;const after=Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,before+a.amount));const delta=after-before;p.damage[a.target]=after;p.life=Math.max(-999,Math.min(999,p.life-delta));msg=`updated commander damage by ${delta}; life is now ${p.life}`;}
  if(a.type==="token"){
    if(a.count!==undefined&&(!Number.isSafeInteger(a.count)||a.count<1||a.count>MAX_TOKEN_COUNT))return {player,message:""};
    const seen=new Set<string>(),keywords=(a.keywords??'').slice(0,500).split(/[,\n]+/).map(k=>k.trim().slice(0,80)).filter(k=>{const key=k.toLowerCase();if(!k||seen.has(key))return false;seen.add(key);return true;}).slice(0,40);
    const abilities=(a.abilities??'').trim().slice(0,3000),text=[keywords.join(', '),abilities].filter(Boolean).join('\n');
    p.zones.battlefield.push({...card({id:uid(),name:a.name.trim().slice(0,80)||"Token",type:"Token",power:(a.stats??'').split("/")[0]?.trim().slice(0,8)||undefined,toughness:(a.stats??'').split("/")[1]?.trim().slice(0,8)||undefined,...(keywords.length?{keywords}:{}),...(text?{text}:{})}),token:true,tokenCount:Math.max(1,Math.min(MAX_TOKEN_COUNT,Math.floor(a.count??1)))});msg=`created ${a.count??1} × ${a.name.trim().slice(0,80)||"a token"}`;
  }
  if(a.type==="rename"){p.name=a.name.trim().slice(0,24)||"Planeswalker";}
  // Zone entry remains part of the move/log, but tokens do not persist in
  // graveyard or exile. Apply this before publishing local or host state so
  // single moves, batches, mill, shared exile and stack resolution agree.
  for(const zone of ['graveyard','exile'] as const)p.zones[zone]=p.zones[zone].filter(c=>!c.token);
  if(p.revealed){p.revealed.targets=p.revealed.targets.filter(x=>p.zones[x.zone].some(c=>c.uid===x.uid));if(!p.revealed.targets.length)delete p.revealed;}
  if(p.libraryView){
    const remaining=new Set(p.zones.library.map(c=>c.uid));
    p.libraryView.ids=p.libraryView.ids.filter(id=>remaining.has(id));
    // Moving or drawing a revealed card never exposes the next unseen card.
    if(!p.libraryView.ids.length)delete p.libraryView;
  }
  return {player:p,message:msg?`${p.name} ${msg}.`:""};
}
export function logEntry(text:string):LogEntry{return {id:uid(),text:text.slice(0,250),time:Date.now()};}
export function validatePublic(raw:unknown,id:string):PublicPlayer {
  if(!raw||typeof raw!=="object")throw new Error("Invalid player");const r=raw as PublicPlayer;
  const num=(n:unknown,min=0,max=999)=>typeof n==="number"&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):min;
  const str=(s:unknown,n:number)=>typeof s==="string"?s.slice(0,n):"";
  const safeURL=(s:unknown)=>typeof s==="string"&&/^https:\/\/(cards\.scryfall\.io|scryfall\.com)\//.test(s)?s.slice(0,500):undefined;
  const p:PublicPlayer={id,name:str(r.name,24)||"Planeswalker",deckName:str(r.deckName,80),life:num(r.life,-999),poison:num(r.poison,0,Number.MAX_SAFE_INTEGER),damage:{},connected:true,revealedLibrary:[],counts:{} as PublicPlayer["counts"],zones:{} as PublicPlayer["zones"]};
  for(const [k,v] of Object.entries(r.damage??{}).slice(0,8))if(!["__proto__","constructor","prototype"].includes(k))p.damage[str(k,80)]=num(v,0,Number.MAX_SAFE_INTEGER);
  const cleanCard=(c:Card):Card=>({...((Number.isSafeInteger(c.layer)&&c.layer!>=0)?{layer:num(c.layer,0,10000)}:{}),...((typeof c.commanderTax==='number'&&Number.isSafeInteger(c.commanderTax))?{commanderTax:num(c.commanderTax,0,100000)}:{}),uid:str(c.uid,80),movePermission:str(c.movePermission,80)||undefined,exilePileId:str(c.exilePileId,80)||undefined,controllerId:str(c.controllerId,80)||undefined,exileGroup:str(c.exileGroup,80)||undefined,exileNote:str(c.exileNote,240)||undefined,permission:c.permission&&typeof c.permission.playerId==='string'&&['play','cast','none'].includes(c.permission.kind)?{playerId:str(c.permission.playerId,80),look:!!c.permission.look,kind:c.permission.kind,note:str(c.permission.note,240)}:undefined,...(cleanPosition(c.position)?{position:cleanPosition(c.position)}:{}),...(typeof c.classLevel==='number'&&Number.isSafeInteger(c.classLevel)&&!c.faceDown?{classLevel:num(c.classLevel,1,20)}:{}),tapped:!!c.tapped,counters:num(c.counters),...(Object.keys(cleanNamedCounters(c.namedCounters)).length?{namedCounters:cleanNamedCounters(c.namedCounters)}:{}),...(isRoom(c)&&!c.faceDown&&c.roomDoors!==undefined?{roomDoors:num(c.roomDoors,0,3)}:{}),faceDown:!!c.faceDown,back:!!c.back,token:!!c.token,...(c.token?{tokenCount:tokenCount(c)}:{}),data:c.faceDown?{id:"hidden",name:"Face-down card",type:"Hidden"}:{id:str(c.data?.id,80),layout:str(c.data?.layout,40)||undefined,name:str(c.data?.name,160),type:str(c.data?.type,200),text:str(c.data?.text,4000),mana:str(c.data?.mana,200),power:str(c.data?.power,12),toughness:str(c.data?.toughness,12),image:safeURL(c.data?.image),backImage:safeURL(c.data?.backImage),artist:str(c.data?.artist,100),scryfall:safeURL(c.data?.scryfall),keywords:Array.isArray(c.data?.keywords)?c.data.keywords.slice(0,80).map(k=>str(k,80)):undefined,faces:Array.isArray(c.data?.faces)?c.data.faces.slice(0,5).map(f=>({name:str(f.name,160),type:str(f.type,200),text:str(f.text,4000),mana:str(f.mana,200)})):undefined}});
  for(const z of ZONES){
    p.counts[z]=num(r.counts?.[z],0,500);
    p.zones[z]=["hand","library","sideboard"].includes(z)?[]:(Array.isArray(r.zones?.[z])?r.zones[z].slice(0,500):[]).map(cleanCard);
    if(!["hand","library","sideboard"].includes(z))p.counts[z]=p.zones[z].length;
  }
  p.revealId=str(r.revealId,80)||undefined;
  p.revealedCards=(Array.isArray(r.revealedCards)?r.revealedCards:[]).slice(0,500).filter(x=>x&&ZONES.includes(x.zone)&&x.card).map(x=>({zone:x.zone,card:cleanCard(x.card)}));
  p.revealedLibrary=(Array.isArray(r.revealedLibrary)?r.revealedLibrary.slice(0,p.counts.library):[]).map(cleanCard);
  return p;
}

// Only opaque instance IDs go to the host; this layout is returned solely to
// the same authenticated seat, never included in shared table snapshots.
export type SeatLayout = Record<Zone,string[]>;
export const seatLayout=(p:Player):SeatLayout=>Object.fromEntries(ZONES.map(z=>[z,p.zones[z].map(c=>c.uid)])) as SeatLayout;
export function validateLayout(raw:unknown,p:PublicPlayer):SeatLayout|undefined {
 if(!raw||typeof raw!=='object')return;
 const layout=raw as SeatLayout,seen=new Set<string>();
 for(const z of ZONES){const ids=layout[z];if(!Array.isArray(ids)||ids.length!==p.counts[z]||ids.length>500)return;
  for(const id of ids){if(typeof id!=='string'||id.length>100||seen.has(id))return;seen.add(id);}
  if(p.zones[z].some((c,i)=>ids[i]!==c.uid))return;
 }
 return structuredClone(layout);
}
export function reconcileSeat(local:Player,accepted:PublicPlayer,layout:SeatLayout):Player {
 const known=new Map(ZONES.flatMap(z=>local.zones[z]).map(c=>[c.uid,c]));
 for(const z of ZONES)for(const c of accepted.zones[z]){
  const original=known.get(c.uid);
  if(c.data.id==='hidden'&&!original)throw new Error('Recovery needs a private card missing from this tab. Keep the original player tab open.');
  known.set(c.uid,{...c,...(c.data.id==='hidden'&&original?.classLevel!==undefined?{classLevel:original.classLevel}:{}),...(c.data.id==='hidden'&&original?.roomDoors!==undefined?{roomDoors:original.roomDoors}:{}),data:c.data.id==='hidden'?original!.data:c.data});
 }
 const zones=Object.fromEntries(ZONES.map(z=>[z,layout[z].map(id=>{
  const c=known.get(id);if(!c)throw new Error('Recovery needs private cards missing from this tab. Reconnect from the original player tab.');return structuredClone(c);
 })])) as Record<Zone,Card[]>;
 return {...local,name:accepted.name,deckName:accepted.deckName,life:accepted.life,poison:accepted.poison,damage:{...accepted.damage},zones,libraryView:accepted.revealedLibrary.length?{id:uid(),ids:accepted.revealedLibrary.map(c=>c.uid),revealed:true}:undefined};
}
