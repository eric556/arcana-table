import type {Table} from './game';
import {findCard,playable,type SharedCommand} from './shared-cards';
import type {DragItem,DropTarget} from './table-gestures';
// Store the requested drop so owner approval completes it atomically.
export function zonePlayRequest(table:Table,actor:string,item:DragItem,target:DropTarget):SharedCommand|null{
 if(item.kind!=='card'||item.ownerId!==actor)return null;
 const found=findCard(table,item.cardId);
 if(!found||found.ownerId===actor||!['graveyard','exile'].includes(found.zone)||playable(found.card,found.zone,actor))return null;
 const playTarget=target.kind==='stack'||target.kind==='player'&&target.ownerId===actor||target.kind==='zone'&&target.ownerId===actor&&['battlefield','stack'].includes(target.zone)||target.kind==='card'&&table.players.some(p=>p.zones.battlefield.some(c=>c.uid===target.cardId));
 if(!playTarget)return null;
 const to=target.kind==='stack'||target.kind==='card'||target.kind==='zone'&&target.zone==='stack'?'stack':'battlefield';
 return {type:'request',afterApproval:{to,back:found.card.back,...(target.kind==='card'?{target:{kind:'card',ownerId:target.ownerId,cardId:target.cardId} as const}:{}),...(to==='battlefield'&&target.kind==='zone'&&target.position?{position:target.position}:{})},ownerId:found.ownerId,source:found.zone,cardId:found.card.uid,options:{count:1,faceDown:found.card.faceDown,look:true,permission:'play',mode:'top',playerId:actor,pile:'owner',moveToExile:false,note:`Play from ${found.zone} · timing is manual`}};
}
