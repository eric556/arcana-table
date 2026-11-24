import {ZONES,type Card,type Player,type Table} from './game';
import {findCard,hydratePrivate} from './shared-cards';
import type {DragItem} from './table-gestures';
export function dragPreview(item:DragItem|null,table:Table,viewer:Player):{card:Card;reveal:boolean}|null{
 if(!item)return null;
 if(item.kind==='stack'){const entry=table.stack.entries.find(e=>e.id===item.entryId),card=entry?.card??entry?.sourceCard;return card?{card,reveal:false}:null;}
 // Own hands and libraries intentionally do not exist in the public snapshot.
 for(const zone of ZONES){const card=viewer.zones[zone].find(c=>c.uid===item.cardId);if(card)return {card:zone==='library'?{...card,faceDown:true}:card,reveal:zone==='exile'&&!!card.permission?.look&&card.permission.playerId===viewer.id};}
 const found=findCard(table,item.cardId);if(!found)return null;
 return {card:hydratePrivate(found.card,found.ownerId,viewer),reveal:found.zone==='exile'&&!!found.card.permission?.look&&found.card.permission.playerId===viewer.id};
}
