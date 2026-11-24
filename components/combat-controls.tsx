'use client';
import {Swords,Shield,Check} from 'lucide-react';
import {combatDefenders,combatReady,type CombatGesture,type Table} from '@/lib/game';
export function CombatControls({table,viewerId,onCommand}:{table:Table;viewerId:string;onCommand?:(command:CombatGesture)=>void}){
 if(table.phase!==2)return null;
 const own=table.turn===viewerId,locked=!!table.combat.attackersLocked,defenders=combatDefenders(table),done=table.combat.defendersDone??[],ready=combatReady(table),defending=defenders.includes(viewerId),finished=done.includes(viewerId);
 const waiting=table.players.filter(p=>defenders.includes(p.id)&&!done.includes(p.id));
 return <div className={`combat-controls ${ready?'combat-is-ready':''}`} role="region" aria-label="Combat controls">
  <div><Swords/><strong>{ready?'Ready to resolve combat':locked?'Declare blockers':'Declare attackers'}</strong><span>{ready?'Resolve any responses, then apply damage manually.':locked?defenders.length?finished?'You’re ready. Waiting for the other defenders.':defending?'Drag a blocker onto an incoming attacker, or declare no blocks.':'Waiting for defenders to finish.':'No attacks declared.':own?'Drag onto a player or planeswalker.':'Waiting for attackers to be confirmed.'}</span></div>
  <div className="combat-legend"><span className="attack-key">Attack</span><span className="block-key"><Shield/>Block</span></div>
  {own&&onCommand&&<button className={`btn ${locked?'quiet':'gold'}`} onClick={()=>onCommand({type:locked?'editAttackers':'finishAttackers',combatId:table.combat.id})} title={locked?'Reopen attackers and clear all block assignments and ready status':undefined}>{!locked&&<Check/>}{locked?'Edit attackers':'Done declaring attackers'}</button>}
  {locked&&defending&&onCommand&&<button className={`btn ${finished?'quiet':'gold'}`} onClick={()=>onCommand({type:finished?'editBlockers':'finishBlockers',combatId:table.combat.id})}>{finished?<Shield/>:<Check/>}{finished?'Edit my blockers':'I am done declaring'}</button>}
  {locked&&defenders.length>0&&<div className="combat-readiness" role="status" aria-live="polite">{ready?<><Check/><span>All defenders are done declaring.</span></>:<><span>{defenders.filter(id=>done.includes(id)).length}/{defenders.length} defenders ready</span><span>Waiting for {waiting.map(p=>`${p.id===viewerId?'you':p.name}${p.connected?'':' (disconnected)'}`).join(', ')}.</span></>}</div>}
 </div>;
}
