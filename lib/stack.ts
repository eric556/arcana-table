import {controlledCards,controller} from './shared-cards';
import {activeType,faceName,act,logEntry,uid,type Player,type TableTarget,type StackDestination,type StackEntry,type Table} from './game';

export const STACK_DESTINATIONS:StackDestination[]=['graveyard','battlefield','exile','hand','command','library'];
export function defaultResolution(entry:StackEntry):StackDestination{if(entry.kind==='spell'&&!entry.card?.faceDown&&entry.card?.data.layout==='adventure'&&entry.card.back)return 'exile';return entry.kind==='ability'||/Instant|Sorcery/.test(entry.card?activeType(entry.card):'')?'graveyard':'battlefield';}
export type StackCommand = {type:'ability';label:string;description?:string;sourceCardId?:string;target?:TableTarget}|{type:'target';entryId?:string;cardId?:string;target?:TableTarget}|{type:'attach';cardId:string;target?:TableTarget}|{type:'pass';revision:number}|{type:'finish';entryId:string;revision:number;to:StackDestination;outcome:'resolve'|'counter'};
const changed=(t:Table)=>{t.stack.revision++;t.stack.passes=[];};
export function targetExists(t:Table,target:TableTarget):boolean {
  if(!target||typeof target!=='object')return false;
  const p=t.players.find(p=>p.id===target.ownerId);
  return !!p&&(target.kind==='player'||target.kind==='card'&&controlledCards(t,p.id).some(c=>c.uid===target.cardId));
}
export function targetLabel(t:Table,target:TableTarget):string {
  const p=t.players.find(p=>p.id===target.ownerId);
  if(target.kind==='player')return p?.name??'Player left';
  const card=controlledCards(t,target.ownerId).find(c=>c.uid===target.cardId);
  return card?`${card.faceDown?'Face-down card':faceName(card)} · ${p?.name}`:'Card left the battlefield';
}
export function pruneAttachments(t:Table):void {
  t.attachments=(t.attachments??[]).filter(a=>targetExists(t,a.target)&&controlledCards(t,a.ownerId).some(c=>c.uid===a.cardId));
}
function canAttach(t:Table,ownerId:string,cardId:string,target:TableTarget):boolean {
  if(!targetExists(t,target))return false;
  const seen=new Set([`${ownerId}:${cardId}`]);let next:TableTarget|undefined=target;
  while(next?.kind==='card'){
    const key=`${next.ownerId}:${next.cardId}`;if(seen.has(key))return false;seen.add(key);
    const current:TableTarget=next;next=t.attachments.find(a=>a.ownerId===current.ownerId&&a.cardId===current.cardId)?.target;
  }
  return true;
}


// Only redacted public stack-zone cards enter this shared order. Private zones are never read.
export function syncStack(t:Table):void {
  let dirty=false;const seen=new Set<string>();
  for(const entry of t.stack.entries){
    const targets=(entry.targets??[]).filter(target=>targetExists(t,target));
    if(targets.length!==(entry.targets?.length??0)){entry.targets=targets;dirty=true;}
  }
  t.stack.entries=t.stack.entries.filter(entry=>{
    if(entry.kind==='ability')return true;
    const key=`${entry.ownerId}:${entry.cardId}`;if(seen.has(key)){dirty=true;return false;}seen.add(key);
    const p=t.players.find(p=>p.id===entry.ownerId),c=p?.zones.stack.find(c=>c.uid===entry.cardId);
    if(c){if(entry.card?.back!==c.back||entry.card?.faceDown!==c.faceDown)dirty=true;entry.controllerId=controller(c,p!.id);entry.card=structuredClone(c);entry.label=c.faceDown?'Face-down spell':faceName(c);return true;}
    dirty=true;
    const target=entry.targets?.[0];
    if(entry.pending?.outcome==='resolve'&&entry.pending.to==='battlefield'&&entry.cardId&&/\bAura\b/.test(entry.card?activeType(entry.card):'')&&target&&p?.zones.battlefield.some(c=>c.uid===entry.cardId)&&canAttach(t,entry.controllerId??entry.ownerId,entry.cardId,target)){
      t.attachments=t.attachments.filter(a=>a.ownerId!==(entry.controllerId??entry.ownerId)||a.cardId!==entry.cardId);
      t.attachments.push({ownerId:entry.controllerId??entry.ownerId,cardId:entry.cardId,target});
    }
    const actor=t.players.find(p=>p.id===entry.pending?.actorId)?.name;
    t.log.unshift(logEntry(entry.pending?`${actor??p?.name??'A player'} ${entry.pending.outcome==='counter'?'countered':'resolved'} ${entry.label}.`:`${p?.name??'A player'} removed ${entry.label} from the stack.`));
    return false;
  });
  for(const p of t.players)for(const c of p.zones.stack){
    if(t.stack.entries.some(e=>e.kind==='spell'&&e.ownerId===p.id&&e.cardId===c.uid))continue;
    const entry:StackEntry={id:uid(),ownerId:p.id,controllerId:controller(c,p.id),kind:'spell',cardId:c.uid,card:structuredClone(c),label:c.faceDown?'Face-down spell':faceName(c),respondsTo:t.stack.entries[0]?.id};
    t.stack.entries.unshift(entry);dirty=true;t.log.unshift(logEntry(`${t.players.find(p=>p.id===entry.controllerId)?.name??p.name} added ${entry.label} to the stack.`));
  }
  pruneAttachments(t);
  if(dirty)changed(t);
}

export function applyStackCommand(table:Table,actor:string,raw:unknown):{table:Table;error?:string}{
  const reject=(error:string)=>({table,error});
  const p=table.players.find(p=>p.id===actor&&p.connected);
  if(!p||!raw||typeof raw!=='object')return reject('Could not apply that stack action.');
  const a=raw as StackCommand;
  if(a.type==='attach'){
    const card=controlledCards(table,actor).find(c=>c.uid===a.cardId);
    if(!card)return reject('Attach only a card from your own battlefield.');
    if(a.target&&!canAttach(table,actor,a.cardId,a.target))return reject('Choose another card or player on the battlefield. Attachments cannot form a loop.');
    const t=structuredClone(table);t.attachments=t.attachments.filter(x=>x.ownerId!==actor||x.cardId!==a.cardId);
    if(a.target)t.attachments.push({ownerId:actor,cardId:a.cardId,target:structuredClone(a.target)});
    t.log.unshift(logEntry(`${p.name} ${a.target?`attached ${card.data.name} to ${targetLabel(t,a.target)}`:`detached ${card.data.name}`}.`));return {table:t};
  }
  if(a.type==='target'){
    const entry=table.stack.entries.find(e=>a.entryId?e.id===a.entryId:e.kind==='spell'&&(e.controllerId??e.ownerId)===actor&&e.cardId===a.cardId);
    if(!entry||(entry.controllerId??entry.ownerId)!==actor)return reject('Only the controller can choose this spell or ability’s targets.');
    if(entry.pending)return reject('This card is already resolving.');
    if(a.target&&!targetExists(table,a.target))return reject('That target has left the battlefield.');
    const t=structuredClone(table),next=t.stack.entries.find(e=>e.id===entry.id)!;
    const same=(x:TableTarget)=>x.kind===a.target?.kind&&x.ownerId===a.target.ownerId&&(x.kind==='player'||a.target.kind==='card'&&x.cardId===a.target.cardId);
    next.targets=a.target?(next.targets??[]).some(same)?next.targets!.filter(x=>!same(x)):[...(next.targets??[]),structuredClone(a.target)].slice(0,32):[];
    changed(t);t.log.unshift(logEntry(`${p.name} updated targets for ${entry.label}${a.target?`: ${targetLabel(t,a.target)}`:''}.`));return {table:t};
  }
  if(a.type==='ability'){
    if(typeof a.label!=='string'||!a.label.trim()||a.label.length>160||a.description!==undefined&&(typeof a.description!=='string'||a.description.length>1000))return reject('Enter an ability name and a description of up to 1,000 characters.');
    if(a.target&&!targetExists(table,a.target))return reject('That target has left the battlefield.');
    if(table.stack.entries.length>=500)return reject('The stack is full. Resolve or remove entries first.');
    const source=a.sourceCardId?controlledCards(table,actor).concat(p.zones.command,p.zones.graveyard,p.zones.exile,p.zones.stack).find(c=>c.uid===a.sourceCardId):undefined;
    if(a.sourceCardId&&!source)return reject('Choose one of your public cards as the ability source.');
    const t=structuredClone(table);t.stack.entries.unshift({id:uid(),ownerId:actor,kind:'ability',targets:a.target?[structuredClone(a.target)]:[],label:a.label.trim(),description:a.description?.trim(),sourceName:source?(source.faceDown?'Face-down card':faceName(source)):undefined,sourceCard:source?structuredClone(source):undefined,respondsTo:t.stack.entries[0]?.id});changed(t);
    t.log.unshift(logEntry(`${p.name} added ability “${a.label.trim()}” to the stack.`));return {table:t};
  }
  if(a.type!=='pass'&&a.type!=='finish')return reject('Unknown stack action.');
  if(a.revision!==table.stack.revision)return reject('The stack changed. Review the latest response and try again.');
  if(!table.stack.entries.length)return reject('The stack is empty.');
  if(a.type==='pass'){
    if(table.stack.passes.includes(actor))return {table};
    const t=structuredClone(table);t.stack.passes.push(actor);return {table:t};
  }
  const entry=table.stack.entries.find(e=>e.id===a.entryId);
  if(!entry||!STACK_DESTINATIONS.includes(a.to)||!['resolve','counter'].includes(a.outcome))return reject('Choose an entry and a valid destination.');
  if(table.stack.entries.some(e=>e.pending))return reject('Wait for the current card move to finish.');
  if(a.outcome==='resolve'&&table.stack.entries[0].id!==entry.id)return reject('Resolve the top entry first.');
  const t=structuredClone(table),next=t.stack.entries.find(e=>e.id===entry.id)!;
  if(entry.kind==='ability'){
    t.stack.entries=t.stack.entries.filter(e=>e.id!==entry.id);
    t.log.unshift(logEntry(`${p.name} ${a.outcome==='counter'?'countered':'resolved'} ability “${entry.label}”.`));
  }else next.pending={id:uid(),actorId:actor,to:a.to,outcome:a.outcome};
  changed(t);return {table:t};
}

// The owner performs the requested move locally; the next public projection acknowledges it.
// Keeping the entry pending until then prevents stale public state from duplicating the card.
export function applyPendingStackMoves(player:Player,table:Table):Player {
  let p=player;
  for(const e of table.stack.entries){
    if(e.ownerId!==p.id||!e.pending||!e.cardId||!p.zones.stack.some(c=>c.uid===e.cardId))continue;
    const original=p.zones.stack.find(c=>c.uid===e.cardId)!;p=act(p,{type:'move',uid:e.cardId,to:e.pending.to}).player;
    if(e.pending.outcome==='resolve'&&e.pending.to==='exile'&&!original.faceDown&&original.data.layout==='adventure'&&original.back){const c=p.zones.exile.find(c=>c.uid===e.cardId);if(c)c.permission={playerId:e.controllerId??p.id,look:false,kind:'cast',note:'Adventure · may cast the permanent from exile; costs and timing are manual'};}
  }
  return p;
}

// An unchanged player is still an acknowledgement: the card may already have
// moved while its previous state packet was lost. Never move it a second time.
export function pendingStackAcknowledgement(player:Player,table:Table):Player|undefined {
  return table.stack.entries.some(e=>e.ownerId===player.id&&e.pending)?applyPendingStackMoves(player,table):undefined;
}
