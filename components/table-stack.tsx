'use client';
import {RulesText} from './rules-text';
import {useState,type CSSProperties} from 'react';
import {Check,Layers,Zap,LoaderCircle,ChevronDown} from 'lucide-react';
import {CardArt} from './card-art';
import {activeType,LABELS,type StackEntry,type Table} from '@/lib/game';
import {defaultResolution,targetLabel,type StackCommand} from '@/lib/stack';
import type {useTableDrag} from './use-table-drag';

export function TableStack({table,viewerId,drag,onCommand,onInspect,onAbility,onAdvanced,onRetry}:{table:Table;viewerId:string;drag:ReturnType<typeof useTableDrag>;onCommand:(c:StackCommand)=>void;onInspect:(entry:StackEntry)=>void;onAbility:()=>void;onAdvanced:()=>void;onRetry?:()=>void}){
 const [fanned,setFanned]=useState(false);
 const entries=table.stack.entries,top=entries[0],busy=entries.some(e=>e.pending),owner=table.players.find(p=>p.id===top?.ownerId),disabled=busy;
 const pending=entries.find(e=>e.pending),pendingOwner=table.players.find(p=>p.id===pending?.ownerId);
 const shown=[...entries].reverse();
 const resolve=()=>{if(top)onCommand({type:'finish',entryId:top.id,revision:table.stack.revision,to:defaultResolution(top),outcome:'resolve'});};
 return <aside className={`table-stack ${entries.length?'has-stack':'empty-stack'} ${drag.item?'stack-droppable':''}`} aria-label="Shared stack on the table" {...drag.dropProps({kind:'stack'})}>
  <div className="table-stack-heading"><Layers/><h2>STACK</h2><span>{entries.length}</span><button className="text-btn" onClick={onAbility} title="Add a custom ability"><Zap/>Ability</button></div>
  <p className="table-stack-hint">{drag.item?.kind==='card'?'Drop here to add to the stack':'Drag here to cast · drag onto cards to target'}</p>
  <div className={`stack-pile ${fanned?'is-fanned':''}`} style={{'--stack-depth':Math.min(entries.length,6)} as CSSProperties}>
   {!top?<div className="stack-drop-outline"><Layers/><strong>Drop a card here</strong><span>Spells from your hand<br/>Abilities from your battlefield</span></div>:shown.map((entry,i)=>{
    const isTop=entry.id===top.id,art=entry.card??entry.sourceCard;
    return <button key={entry.id} className={`physical-stack-card ${isTop?'top-stack-card':''} ${entry.kind==='ability'?'ability-stack-card':''}`} style={{'--card-index':Math.min(i,5),'--card-z':i+1} as CSSProperties} {...drag.draggableProps({kind:'stack',entryId:entry.id,revision:table.stack.revision},()=>onInspect(entry))} onClick={()=>onInspect(entry)} aria-label={`${entry.label}, ${isTop?'top of stack':'waiting'}, controlled by ${table.players.find(p=>p.id===(entry.controllerId??entry.ownerId))?.name}`} title={`${entry.label} · drag onto a target, Resolve, or its owner’s zone`}>
     {art?<CardArt card={art}/>:<div className="ability-card-face"><Zap/><strong><RulesText text={entry.label}/></strong><p><RulesText text={entry.description||'Apply this ability manually.'}/></p></div>}
     <span className="physical-stack-owner">{table.players.find(p=>p.id===(entry.controllerId??entry.ownerId))?.name}</span>{entry.kind==='ability'&&<span className="physical-ability-label"><Zap/>ABILITY</span>}{(entry.targets?.length??0)>0&&<span className="physical-target-count">{entry.targets!.length} target{entry.targets!.length===1?'':'s'}</span>}{isTop&&<span className="physical-stack-top">RESOLVES NEXT</span>}
    </button>;
   })}
  </div>
  {entries.length>1&&<button className="text-btn spread-stack" onClick={()=>setFanned(!fanned)}><ChevronDown/>{fanned?'Gather cards':'Spread cards'}</button>}
  {top&&<div className="stack-resolution" {...(drag.item?.kind==='stack'?drag.dropProps({kind:'resolve'}):{})}>
   <strong className="resolve-card-name">{top.label}</strong>
   {!!top.targets?.length&&<div className="stack-targets"><span>TARGETS</span>{top.targets.map((target,i)=><div key={i}>{target.kind==='card'&&table.players.find(p=>p.id===target.ownerId)?.zones.battlefield.find(c=>c.uid===target.cardId)&&<div className="target-thumbnail"><CardArt card={table.players.find(p=>p.id===target.ownerId)!.zones.battlefield.find(c=>c.uid===target.cardId)!}/></div>}<span>{targetLabel(table,target)}</span>{(top.controllerId??top.ownerId)===viewerId&&!busy&&<button className="text-btn" aria-label={`Remove target ${targetLabel(table,target)}`} onClick={()=>onCommand({type:'target',entryId:top.id,target})}>×</button>}</div>)}{top.card&&activeType(top.card).includes('Aura')&&<small>Attaches to the first target on resolution</small>}</div>}
   <button className="btn gold resolve-top" disabled={disabled} onClick={resolve}>{busy?<LoaderCircle className="spin"/>:<Check/>}{busy?'Resolving…':'Resolve top card'}</button>
   {pending&&<div className="resolution-recovery" role="status"><span>Waiting for {pendingOwner?.name??'the owner'} to confirm {pending.label} → {LABELS[pending.pending!.to]}{!pendingOwner?.connected?' · disconnected':''}.</span><button className="btn quiet" onClick={onRetry}>Retry resolution</button><small>If it keeps waiting, that player can use Reconnect.</small></div>}
   <span>{top.kind==='ability'?'Remove ability · apply its effect yourselves':`${defaultResolution(top)==='battlefield'?table.players.find(p=>p.id===(top.controllerId??top.ownerId))?.name:owner?.name} → ${LABELS[defaultResolution(top)]}`}</span>
   
   <button className="text-btn" disabled={busy||table.stack.passes.includes(viewerId)} onClick={()=>onCommand({type:'pass',revision:table.stack.revision})}>{table.stack.passes.includes(viewerId)?'✓ You have no response':'I have no response'}</button>
   <div className="stack-ready-dots">{table.players.filter(p=>p.connected).map(p=><span key={p.id} className={table.stack.passes.includes(p.id)?'ready':''} title={`${p.name}${table.stack.passes.includes(p.id)?': no response':': deciding'}`}>{p.name.slice(0,1)}</span>)}</div>
  </div>}
  <button className="text-btn stack-more" onClick={onAdvanced}>More stack actions</button>
 </aside>;
}
