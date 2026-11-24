import {resetMulliganCards,tidyBattlefield,revealOwnedCards,arrangeLayer,applyTokenAction,applyTokenCombat,act,activeType,advanceTurn,applyCombatGesture,card,emptyPlayer,logEntry,newTable,pruneCombat,publicPlayer,shuffle,uid,validatePublic,ZONES,type Action,type Format,type Player,type Table,type TableTarget,type Zone,type CombatGesture} from './game';
import {applyStackCommand,applyPendingStackMoves,syncStack,type StackCommand} from './stack';
import {setPermanentController,applySharedCommand,applySharedPending,acknowledgeShared,controller,exileCards,exileLibrary,type SharedCommand,type ExileOptions} from './shared-cards';

export type RoomCommand=
 |{kind:'action';action:Action;expected?:Record<string,Zone>}
 |{kind:'deck';player:Player}
 |{kind:'stack';command:StackCommand}|{kind:'shared';command:SharedCommand}
 |{kind:'combat';command:CombatGesture}|{kind:'turn';phase?:number}
 |{kind:'castTarget';uid:string;target:TableTarget;expected:Record<string,Zone>}
 |{kind:'exile';source:Zone;uid?:string;options:ExileOptions}
 |{kind:'endPermission';uid:string}|{kind:'announce';message:string};
export type Envelope={id:string;sequence:number;command:RoomCommand};
export type Authority={epoch:string;revision:number;hostId:string;players:Player[];table:Table;sequences:Record<string,number>;receipts:Record<string,{sequence:number;id:string;error?:string}[]>};
export type Snapshot={epoch:string;revision:number;player:Player;table:Table;accepted:number;receipts:{sequence:number;id:string;error?:string}[]};
const fail=(text:string):never=>{throw new Error(text);};
const str=(v:unknown,max=160)=>typeof v==='string'&&v.length>0&&v.length<=max;
const int=(v:unknown,min=-100000,max=100000)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const bool=(v:unknown)=>v===undefined||typeof v==='boolean';
const ids=(v:unknown)=>Array.isArray(v)&&v.length<=500&&v.every(x=>str(x,80));
export function validAction(raw:unknown):raw is Action {
 if(!raw||typeof raw!=='object')return false;const a=raw as any;
 if('uid' in a&&!str(a.uid,80))return false;
 if(['tap','flip','faceDown','remove'].includes(a.type))return str(a.uid,80);
 if(a.type==='commanderTax')return str(a.uid,80)&&int(a.amount)&&a.amount%2===0;
 if(a.type==='counter')return str(a.uid,80)&&(a.amount===undefined||int(a.amount));
 if(['life','poison'].includes(a.type))return int(a.amount);
 if(a.type==='damage')return str(a.target,80)&&!['__proto__','constructor','prototype'].includes(a.target)&&int(a.amount);
 if(['shuffle','mulligan','untap','arrange','finishLibraryView'].includes(a.type))return true;
 if(['draw','mill'].includes(a.type))return a.count===undefined||int(a.count,0,500);
 if(a.type==='viewTop')return int(a.count,1,500)&&bool(a.reveal);
 if(a.type==='setLibraryReveal')return typeof a.revealed==='boolean';
 if(['scry','surveil'].includes(a.type))return int(a.count,0,500)&&ids(a.expected)&&ids(a.top)&&ids(a.other);
 if(a.type==='namedCounter')return str(a.uid,80)&&str(a.name,64)&&!['__proto__','constructor','prototype'].includes(a.name)&&int(a.amount)&&bool(a.set);
 if(a.type==='progress')return str(a.uid,80)&&int(a.value,0,100000);
 if(a.type==='roomDoor')return str(a.uid,80)&&[0,1].includes(a.door)&&typeof a.unlocked==='boolean';
 if(a.type==='layer')return str(a.uid,80)&&['front','back','forward','backward'].includes(a.direction);
 if(a.type==='revealCards')return ids(a.ids)&&a.ids.length>0;
 if(a.type==='hideCards')return a.ids===undefined||ids(a.ids);
 if(a.type==='playableExile')return str(a.uid,80)&&bool(a.faceDown);
 if(a.type==='endExilePlay')return str(a.uid,80);
 if(a.type==='position')return str(a.uid,80)&&a.position&&(a.position.space===undefined||a.position.space==='area')&&[a.position.x,a.position.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1);
 if(a.type==='move')return str(a.uid,80)&&ZONES.includes(a.to)&&bool(a.bottom)&&bool(a.back)&&bool(a.faceDown)&&(a.position===undefined||validAction({type:'position',uid:a.uid,position:a.position}));
 if(a.type==='moveMany')return Array.isArray(a.moves)&&a.moves.length>0&&a.moves.length<=500&&new Set(a.moves.map((m:any)=>m?.uid)).size===a.moves.length&&a.moves.every((m:any)=>m&&validAction({...m,type:'move'}))&&bool(a.finishView);
 if(a.type==='rename')return str(a.name,24);
 if(a.type==='tokenCopy'||a.type==='tokenSplit')return str(a.uid,80)&&int(a.count,1,9999);
 if(a.type==='token')return str(a.name,80)&&(a.stats===undefined||typeof a.stats==='string'&&a.stats.length<=40)&&(a.count===undefined||int(a.count,1,9999))&&(a.keywords===undefined||typeof a.keywords==='string'&&a.keywords.length<=1000)&&(a.abilities===undefined||typeof a.abilities==='string'&&a.abilities.length<=4000);
 return false;
}
// New decks are data, never a replacement for a seat's game state. Instance IDs
// and all control/permission metadata are created by the authority.
export function importPlayer(raw:unknown,id:string,format:Format):Player {
 if(!raw||typeof raw!=='object')return fail('Invalid deck.');const r=raw as Player;
 if(!r.zones||!ZONES.every(z=>Array.isArray(r.zones[z]))||ZONES.reduce((n,z)=>n+r.zones[z].length,0)>500)return fail('A deck must contain at most 500 cards.');
 const p=emptyPlayer(typeof r.name==='string'?r.name.slice(0,24):'Planeswalker',format,id);p.deckName=typeof r.deckName==='string'?r.deckName.slice(0,80):'Imported deck';
 for(const z of ZONES){p.zones[z]=r.zones[z].map(c=>{if(!c?.data||!str(c.data.name,160))return fail('Invalid card data.');const safe=validatePublic({zones:{exile:[{...c,faceDown:false}]}} as any,id).zones.exile[0];return card(safe.data);});}
 return p;
}
export function createAuthority(p:Player,format:Format):Authority {const own=structuredClone(p);delete own.privateCards;return {epoch:uid(),revision:0,hostId:p.id,players:[own],table:newTable(own,format),sequences:{[p.id]:0},receipts:{}};}
export function refresh(r:Authority){r.table.players=r.players.map(p=>publicPlayer(p,r.table.players.find(x=>x.id===p.id)?.connected??true));pruneCombat(r.table);syncStack(r.table);r.table.log=r.table.log.slice(0,80);}
export function snapshot(r:Authority,id:string):Snapshot {
 const p=structuredClone(r.players.find(p=>p.id===id)??fail('Seat not found.'));p.privateCards={};delete p.completedShared;
 for(const owner of r.players)for(const c of ZONES.flatMap(z=>owner.zones[z]))if(owner.id!==id&&c.faceDown&&(c.permission?.look&&c.permission.playerId===id||c.controllerId===id))p.privateCards[`${owner.id}:${c.uid}`]=structuredClone(c.data);
 return {epoch:r.epoch,revision:r.revision,player:p,table:structuredClone(r.table),accepted:r.sequences[id]??0,receipts:structuredClone(r.receipts[id]??[])};
}
function settle(r:Authority){
 const targets=(r.table.remoteActions??[]).filter(a=>a.target);
 const approvedTargets=(r.table.sharedRequests??[]).filter(x=>x.approved&&x.afterApproval?.target).map(x=>({actorId:x.requesterId,cardId:x.cardId!,target:x.afterApproval!.target!}));
 r.players=r.players.map(p=>applyPendingStackMoves(applySharedPending(p,r.table)??p,r.table));
 for(const p of r.players){acknowledgeShared(r.table,p.id,p.completedShared??[]);delete p.completedShared;}
 refresh(r);
 for(const x of approvedTargets){const result=applyStackCommand(r.table,x.actorId,{type:'target',cardId:x.cardId,target:x.target});if(result.error)fail(result.error);r.table=result.table;}
 for(const x of targets)if('uid' in x.action){const result=applyStackCommand(r.table,x.actorId,{type:'target',cardId:x.action.uid,target:x.target});if(result.error)fail(result.error);r.table=result.table;}
}

function validateBorrowed(r:Authority,actor:string,a:Action){
 if(a.type!=='move')return;
 const owner=r.players.find(p=>ZONES.some(z=>p.zones[z].some(c=>c.uid===a.uid)));
 if(!owner||owner.id===actor)return;
 const card=[...owner.zones.exile,...owner.zones.graveyard].find(c=>c.uid===a.uid);
 if(card&&a.to==='battlefield'&&(card.permission?.kind==='cast'||!/\bLand\b/.test(activeType({...card,back:a.back??card.back,faceDown:false}))))fail('Cast this spell to the stack first. Only an approved land can be played directly.');
}
function applyAction(r:Authority,actor:string,a:Action){
 if(!validAction(a))fail('Invalid card action.');if(a.type==='tokenCopy'||a.type==='tokenSplit'){applyTokenAction(r.players,r.table,actor,a);refresh(r);return;}validateBorrowed(r,actor,a);
 if(a.type==='layer'){if(!arrangeLayer(r.players,actor,a))fail('Only the controller or a player with movement permission may change layers.');refresh(r);return;}
 if(a.type==='arrange'){tidyBattlefield(r.players,actor,r.table.attachments);refresh(r);return;}
 if(a.type==='endExilePlay'){const owner=r.players.find(p=>p.zones.exile.some(c=>c.uid===a.uid)),c=owner?.zones.exile.find(c=>c.uid===a.uid);if(!c||owner!.id!==actor&&c.permission?.playerId!==actor)fail('Only the owner or permitted player may end exile play.');delete c!.permission;delete c!.exilePileId;delete c!.exileNote;refresh(r);return;}
 const own=r.players.find(p=>p.id===actor)!;
 if(a.type==='revealCards'&&a.ids.some(id=>!ZONES.some(z=>own.zones[z].some(c=>c.uid===id))))fail('You can only reveal your own cards.');
 if(a.type==='moveMany'){
  const local=a.moves.filter(m=>ZONES.some(z=>own.zones[z].some(c=>c.uid===m.uid)));
  if(local.some(m=>own.zones.battlefield.some(c=>c.uid===m.uid&&controller(c,actor)!==actor)))fail('Only this permanent’s controller may move it.');
  for(const m of a.moves.filter(m=>!local.includes(m)))applyAction(r,actor,{type:'move',...m});
  if(local.length)applyLocal({...a,moves:local});return;
 }
 if('uid' in a){const owner=r.players.find(p=>ZONES.some(z=>p.zones[z].some(c=>c.uid===a.uid)));if(!owner)fail('That card has moved.');if(owner!.id!==actor){const result=applySharedCommand(r.table,actor,{type:'cardAction',uid:a.uid,action:a});if(result.error)fail(result.error);r.table=result.table;settle(r);return;}
  const c=own.zones.battlefield.find(c=>c.uid===a.uid);if(c&&controller(c,actor)!==actor)fail('Only this permanent’s controller may move it.');
 }
 if(a.type==='mulligan')r.players=r.players.map(owner=>owner.id!==actor&&owner.zones.battlefield.some(c=>controller(c,owner.id)===actor)?resetMulliganCards(owner,actor):owner);
 if(a.type==='untap')for(const owner of r.players.filter(p=>p.id!==actor))for(const c of owner.zones.battlefield.filter(c=>controller(c,owner.id)===actor)){c.tapped=false;}
 if(a.type==='token'&&ZONES.reduce((n,z)=>n+own.zones[z].length,0)>=1000)fail('Remove unused tokens before creating more.');
 applyLocal(a);
 function applyLocal(action:Action){const result=act(r.players.find(p=>p.id===actor)!,action);r.players=r.players.map(p=>p.id===actor?result.player:p);if(result.message)r.table.log.unshift(logEntry(result.message));refresh(r);}
}
function checkExpected(r:Authority,expected?:Record<string,Zone>){if(expected===undefined)return;if(!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).length>500)fail('Invalid move precondition.');for(const [id,z] of Object.entries(expected!)){if(!ZONES.includes(z)||!r.players.some(p=>p.zones[z].some(c=>c.uid===id)))fail('That card has moved since you selected it. Review the table and try again.');}}
function execute(r:Authority,actor:string,c:RoomCommand){
 if(!c||typeof c!=='object'||!r.table.players.some(p=>p.id===actor&&p.connected))fail('Reconnect before acting.');
 const p=r.players.find(p=>p.id===actor)!;
 switch(c.kind){
 case 'action':checkExpected(r,c.expected);applyAction(r,actor,c.action);break;
 case 'castTarget':checkExpected(r,c.expected);applyAction(r,actor,{type:'move',uid:c.uid,to:'stack',faceDown:false});{const x=applyStackCommand(r.table,actor,{type:'target',cardId:c.uid,target:c.target});if(x.error)fail(x.error);r.table=x.table;}break;
 case 'deck':{const deck=importPlayer(c.player,actor,r.table.format);p.zones=deck.zones;p.zones.library=shuffle(p.zones.library);p.deckName=deck.deckName;delete p.libraryView;delete p.revealed;r.table.log.unshift(logEntry(`${p.name} loaded ${p.deckName}.`));break;}
 case 'stack':{const x=applyStackCommand(r.table,actor,c.command);if(x.error)fail(x.error);r.table=x.table;break;}
 case 'shared':{
 if(c.command?.type==='returnControl'){const command=c.command,owner=r.players.find(p=>p.zones.battlefield.some(c=>c.uid===command.uid)),card=owner?.zones.battlefield.find(c=>c.uid===command.uid);if(!owner||!card||controller(card,owner.id)!==actor||owner.id===actor)fail('Only the current controller can return this permanent.');setPermanentController(card!,owner!.id,owner!.id,r.table);break;}
 if(c.command?.type==='revokeMove'||c.command?.type==='exileVisibility'){
  const command=c.command,owner=r.players.find(p=>ZONES.some(z=>p.zones[z].some(card=>card.uid===command.uid))),card=owner?ZONES.flatMap(z=>owner.zones[z]).find(card=>card.uid===command.uid):undefined;
  if(!owner||!card)fail('That card has moved.');
  if(command.type==='revokeMove'){if(owner!.id!==actor)fail('Only the owner can end this permission.');delete card!.movePermission;}
  else {if(!owner!.zones.exile.some(c=>c.uid===command.uid)||typeof command.faceDown!=='boolean'||owner!.id!==actor&&card!.permission?.playerId!==actor)fail('Ask the owner before revealing this card.');card!.faceDown=command.faceDown;if(!command.faceDown)revealOwnedCards(owner!,[card!.uid]);else if(owner!.revealed)owner!.revealed.targets=owner!.revealed.targets.filter(x=>x.uid!==card!.uid);}
  break;
 }
 if(c.command?.type==='cardAction'){if(!validAction(c.command.action))fail('Invalid card action.');validateBorrowed(r,actor,c.command.action);}const x=applySharedCommand(r.table,actor,c.command);if(x.error)fail(x.error);r.table=x.table;break;}
 case 'combat':{r.table=applyTokenCombat(r.players,r.table,actor,c.command);break;}
 case 'turn':if(actor!==r.hostId&&actor!==r.table.turn)fail('Wait for your turn.');if(c.phase!==undefined&&!int(c.phase,0,4))fail('Invalid phase.');r.table=advanceTurn(r.table,c.phase);break;
 case 'exile':{const o=c.options;if(!o||!int(o.count,1,500)||!['top','nonland','spell'].includes(o.mode)||!['play','cast','none'].includes(o.permission)||o.pile!==undefined&&!['owner','requester'].includes(o.pile)||typeof o.faceDown!=='boolean'||typeof o.look!=='boolean'||typeof o.note!=='string'||o.note.length>240||!r.players.some(p=>p.id===o.playerId)||!['library','exile','graveyard','battlefield'].includes(c.source))fail('Invalid exile options.');let next=p;
 if(c.source==='library')next=exileLibrary(p,o);else {const card=p.zones[c.source].find(x=>x.uid===c.uid);if(!card)fail('That card has moved.');if(c.source==='battlefield')next=exileCards(p,[card!.uid],o);else {card!.permission={playerId:o.playerId,look:o.look,kind:o.permission,note:o.note};card!.exileNote=o.note;if(c.source==='exile'){card!.faceDown=o.faceDown;if(!card!.faceDown)revealOwnedCards(p,[card!.uid]);else if(p.revealed)p.revealed.targets=p.revealed.targets.filter(x=>x.uid!==card!.uid);card!.exilePileId=o.pile==='requester'?o.playerId:undefined;}}}
 r.players=r.players.map(x=>x.id===actor?next:x);break;}
 case 'endPermission':{const card=ZONES.flatMap(z=>p.zones[z]).find(x=>x.uid===c.uid);if(!card)fail('That card has moved.');delete card!.permission;break;}
 case 'announce':if(!str(c.message,240))fail('Invalid announcement.');r.table.log.unshift(logEntry(c.message));break;
 default:fail('Unknown room command.');
 }
 settle(r);
}
// Every accepted sequence, including a rejected command, is checkpointed. A
// replay after any reconnect can never apply that command a second time.
export function reduceCommand(current:Authority,actor:string,e:Envelope):{room:Authority;error?:string;gap?:boolean;duplicate?:boolean}{
 if(!e||!str(e.id,80)||!int(e.sequence,1,Number.MAX_SAFE_INTEGER)||!current.players.some(p=>p.id===actor))return {room:current,error:'Invalid command envelope.'};
 const last=current.sequences[actor]??0;
 if(e.sequence<=last)return {room:current,duplicate:true};
 if(e.sequence!==last+1)return {room:current,gap:true,error:'Waiting for an earlier action.'};
 let r=structuredClone(current),error:string|undefined;
 try{execute(r,actor,e.command);}catch(e){r=structuredClone(current);error=e instanceof Error?e.message:'Invalid action.';}
 r.sequences[actor]=e.sequence;r.receipts[actor]=[...(r.receipts[actor]??[]),{sequence:e.sequence,id:e.id,error}].slice(-100);r.revision++;
 return {room:r,error};
}
