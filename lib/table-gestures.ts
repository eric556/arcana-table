import {activeType,playDestination,type BoardPosition,type Action,type Card,type CombatGesture,type Player,type StackDestination,type Table,type TableTarget,type Zone} from './game';
import {defaultResolution,STACK_DESTINATIONS,targetExists,type StackCommand} from './stack';
import {isAttachment} from './abilities';

export type DragItem={kind:'card';cardId:string;ownerId:string;combatId:string}|{kind:'stack';entryId:string;revision:number};
export type DropTarget={kind:'playableExile';ownerId:string}|{kind:'player';ownerId:string}|{kind:'card';cardId:string;ownerId:string}|{kind:'zone';zone:Zone;ownerId:string;position?:BoardPosition}|{kind:'stack'}|{kind:'resolve'};
export type TableGesture={kind:'move';action:Action}|{kind:'combat';command:CombatGesture}|{kind:'stack';command:StackCommand}|{kind:'castTarget';cardId:string;target:TableTarget}|{kind:'ability';card:Card;target?:TableTarget}|{kind:'invalid';error:string};

// The focused battlefield never changes card ownership or the shared stack.
export function tableGesture(t:Table,p:Player,item:DragItem,target:DropTarget):TableGesture{
 const invalid=(error:string):TableGesture=>({kind:'invalid',error});
 const isTarget=target.kind==='player'||target.kind==='card';
 if(isTarget&&!targetExists(t,target))return invalid('That target has left the battlefield.');
 if(item.kind==='stack'){
  const entry=t.stack.entries.find(e=>e.id===item.entryId);
  if(!entry||item.revision!==t.stack.revision)return invalid('The stack changed. Pick up the card again.');
  if(isTarget){
   if((entry.controllerId??entry.ownerId)!==p.id)return invalid('Only the controller can choose this spell or ability’s targets.');
   return {kind:'stack',command:{type:'target',entryId:entry.id,target}};
  }
  const top=t.stack.entries[0]?.id===entry.id;
  if(target.kind==='resolve'){
   if(!top)return invalid('Resolve the top card first.');
   return {kind:'stack',command:{type:'finish',entryId:entry.id,revision:item.revision,to:defaultResolution(entry),outcome:'resolve'}};
  }
  const zone=target.kind==='zone'?target.zone:undefined;
  if(!zone||!STACK_DESTINATIONS.includes(zone as StackDestination)||!('ownerId' in target))return invalid('Drop on a target, Resolve, or the owner’s destination zone.');
  if((zone==='battlefield'?(entry.controllerId??entry.ownerId):entry.ownerId)!==target.ownerId)return invalid('Use this card’s owner’s destination zone.');
  if(!top&&!['graveyard','exile'].includes(zone))return invalid('Resolve the top card first.');
  return {kind:'stack',command:{type:'finish',entryId:entry.id,revision:item.revision,to:zone as StackDestination,outcome:top?'resolve':'counter'}};
 }
 if(item.ownerId!==p.id)return invalid('You can move only your own cards.');
 const from=(Object.keys(p.zones) as Zone[]).find(z=>p.zones[z].some(c=>c.uid===item.cardId));
 const c=from?p.zones[from].find(c=>c.uid===item.cardId):undefined;
 if(!from||!c)return invalid('That card has moved. Pick it up again.');
 // Combat targets win over attachment / ability gestures, and never move cards.
 if(from==='battlefield'&&t.phase===2){
  if(t.turn===p.id&&((target.kind==='player'||target.kind==='zone'&&target.zone==='battlefield')&&target.ownerId!==p.id))return {kind:'combat',command:{type:'attack',cardId:c.uid,targetId:target.ownerId,combatId:item.combatId}};
  if(target.kind==='card'){
   const hit=t.players.flatMap(p=>p.zones.battlefield).find(c=>c.uid===target.cardId);
   if(t.turn===p.id&&target.ownerId!==p.id&&hit&&!hit.faceDown&&activeType(hit).includes('Planeswalker'))return {kind:'combat',command:{type:'attack',cardId:c.uid,targetId:target.ownerId,targetCardId:target.cardId,combatId:item.combatId}};
   const attack=t.combat.attacks.find(a=>a.cardId===target.cardId&&a.attackerId===target.ownerId);
   if(t.turn!==p.id&&attack)return {kind:'combat',command:{type:'block',cardId:c.uid,attackerCardId:attack.cardId,combatId:item.combatId}};
  }
 }
 if(target.kind==='zone'&&target.ownerId!==p.id)return invalid('Move cards only to your own zones.');
 if(target.kind==='stack'||target.kind==='zone'&&target.zone==='stack'){
  if(from==='battlefield')return {kind:'ability',card:c};
  return {kind:'move',action:{type:'move',uid:c.uid,to:'stack'}};
 }
 if(isTarget){
  if(target.kind==='card'&&target.ownerId===p.id&&target.cardId===c.uid)return invalid('Choose another card as the target.');
  if(from==='stack')return {kind:'stack',command:{type:'target',cardId:c.uid,target}};
  if(from!=='battlefield')return {kind:'castTarget',cardId:c.uid,target};
  if(target.kind==='card'||target.ownerId!==p.id){
   if(isAttachment(c))return {kind:'stack',command:{type:'attach',cardId:c.uid,target}};
   if(target.kind==='card'){
    const attack=t.combat.attacks.find(a=>a.cardId===target.cardId&&a.attackerId===target.ownerId&&a.targetId===p.id);
    if(attack)return {kind:'combat',command:{type:'block',cardId:c.uid,attackerCardId:attack.cardId,combatId:item.combatId}};
   }
   return {kind:'ability',card:c,target};
  }
 }
 if(target.kind==='zone'&&target.zone==='exile'&&from==='exile'&&c.permission?.kind!=='none'&&c.permission?.playerId===p.id)return {kind:'move',action:{type:'endExilePlay',uid:c.uid}};
 const zone=target.kind==='player'?'battlefield':target.kind==='zone'?target.zone:undefined;
 if(!zone)return invalid('Drop on a target, the stack, or one of your zones.');
 if(zone==='battlefield'&&from==='battlefield'){
  if(t.attachments.some(a=>a.cardId===c.uid&&a.ownerId===p.id))return {kind:'stack',command:{type:'attach',cardId:c.uid}};
  if(t.combat.attacks.some(a=>a.cardId===c.uid&&a.attackerId===p.id))return {kind:'combat',command:{type:'attack',cardId:c.uid,combatId:item.combatId}};
  if(t.combat.blocks.some(b=>b.cardId===c.uid&&b.blockerId===p.id))return {kind:'combat',command:{type:'block',cardId:c.uid,combatId:item.combatId}};
 }
 if(zone==='battlefield'&&from==='battlefield'&&target.kind==='zone'&&target.position)return {kind:'move',action:{type:'position',uid:c.uid,position:target.position}};
 return {kind:'move',action:{type:'move',uid:c.uid,...(target.kind==='zone'&&target.zone==='battlefield'&&target.position?{position:target.position}:{}),to:zone==='battlefield'&&['hand','command','graveyard','exile'].includes(from)?playDestination(c):zone}};
}
