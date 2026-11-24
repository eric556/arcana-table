'use client';
import {CombatControls} from './combat-controls';
import {Swords,Shield} from 'lucide-react';
import type {ReactNode} from 'react';
import {tokenCount,type Card,type Table,type CombatGesture} from '@/lib/game';
import type {DropTarget} from '@/lib/table-gestures';
import type {useTableDrag} from './use-table-drag';

export function CombatArena({table,viewerId,renderCard,dropProps,onCommand}:{onCommand?:(command:CombatGesture)=>void;table:Table;viewerId:string;renderCard:(c:Card,owner:string)=>ReactNode;dropProps:ReturnType<typeof useTableDrag>['dropProps']}){
 if(table.phase!==2)return null;
 const ownTurn=table.turn===viewerId;
 const ready=table.players.flatMap(p=>p.zones.battlefield.filter(c=>(c.controllerId??p.id)===viewerId&&!table.combat.attacks.some(a=>a.cardId===c.uid)&&!table.combat.blocks.some(b=>b.cardId===c.uid)));
 return <section className="combat-arena" aria-label="Combat cards">
  <CombatControls table={table} viewerId={viewerId} onCommand={onCommand}/>
  <div className="combat-arena-heading"><Swords/><strong>{ownTurn?'Drag attackers onto a player or planeswalker':table.combat.attackersLocked?'Drag blockers onto attacking cards':'Waiting for attackers to be confirmed'}</strong><small>Drag back to your battlefield to undo</small></div>
  {ready.length>0&&<div className="combat-ready"><strong>{ownTurn?'Your available attackers':'Your available blockers'}</strong><div>{ready.map(c=><div key={c.uid}>{renderCard(c,viewerId)}</div>)}</div></div>}
  {(ownTurn||table.combat.attacks.length>0)&&<div className="combat-lanes">{table.players.map(defender=>{
   const attacks=table.combat.attacks.filter(a=>a.targetId===defender.id);if(!attacks.length&&(!ownTurn||defender.id===viewerId))return null;
   return <section className="combat-lane" key={defender.id} {...dropProps({kind:'player',ownerId:defender.id})} aria-label={`Attacking ${defender.name}`}>
    <div className="combat-lane-title"><Swords/><strong>Attacking {defender.id===viewerId?'you':defender.name}</strong><span>{attacks.reduce((n,a)=>n+tokenCount(table.players.flatMap(p=>p.zones.battlefield).find(c=>c.uid===a.cardId)!),0)}</span></div>
    <div className="combat-pairs">{!attacks.length&&<span className="block-drop-hint">Drop attackers here</span>}{attacks.map(a=>{
     const attacker=table.players.flatMap(p=>p.zones.battlefield).find(c=>c.uid===a.cardId);if(!attacker)return null;
     const blockers=table.combat.blocks.filter(b=>b.attackerCardId===a.cardId).flatMap(b=>{const c=table.players.flatMap(p=>p.zones.battlefield).find(c=>c.uid===b.cardId);return c?[{card:c,owner:b.blockerId}]:[];});
     return <div className={`combat-pair ${blockers.length?'has-blockers':''}`} key={a.cardId}>
      <div className="combat-attacker">{a.targetCardId&&<small>Attacking {table.players.flatMap(p=>p.zones.battlefield).find(c=>c.uid===a.targetCardId)?.data.name??'planeswalker'}</small>}{renderCard(attacker,a.attackerId)}</div>
      <div className="combat-blockers" {...dropProps({kind:'card',cardId:a.cardId,ownerId:a.attackerId} satisfies DropTarget)}>{blockers.map(b=><div className="combat-blocker" key={b.card.uid}>{renderCard(b.card,b.owner)}</div>)}{!blockers.length&&<span className="block-drop-hint"><Shield/>{defender.id===viewerId?tokenCount(attacker)>1?'Drop blocker · splits 1 token':'Drop blocker':`${tokenCount(attacker)} unblocked`}</span>}</div>
     </div>;
    })}</div>
   </section>;
  })}</div>}
 </section>;
}
