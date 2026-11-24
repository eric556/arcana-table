'use client';
import {useState} from 'react';
import {StackTargetLines} from './stack-target-lines';
import {RulesText} from './rules-text';
import {Check,ChevronDown,Layers,LoaderCircle,Zap} from 'lucide-react';
import {CardArt} from './card-art';
import type {StackEntry,Table} from '@/lib/game';
import {defaultResolution,targetLabel,type StackCommand} from '@/lib/stack';
import type {useTableDrag} from './use-table-drag';
export function FloatingStack({table,viewerId,drag,onCommand,onInspect,onAbility,onAdvanced,onClose,onRetry}:{table:Table;viewerId:string;drag:ReturnType<typeof useTableDrag>;onCommand:(c:StackCommand)=>void;onInspect:(e:StackEntry)=>void;onAbility:()=>void;onAdvanced:()=>void;onClose:()=>void;onRetry:()=>void}){
 const [hovered,setHovered]=useState<string|null>(null),[focused,setFocused]=useState<string|null>(null);
 const entries=table.stack.entries,top=entries[0],busy=entries.some(e=>e.pending),passed=table.stack.passes.includes(viewerId);
 const traced=entries.find(e=>e.id===(hovered??focused))??top;
 return <section className="floating-stack" aria-label="Shared stack" {...drag.dropProps({kind:'stack'})}>
  <header><Layers/><h2>Stack <span>{entries.length}</span></h2><button className="text-btn" onClick={onAbility}><Zap/>Ability</button><button className="icon-btn" aria-label="Minimize stack" onClick={onClose}><ChevronDown/></button></header>
  <StackTargetLines entry={traced}/><div className="floating-stack-body">
   {top?<><p className="stack-arrival" role="status" key={top.id}>{table.players.find(p=>p.id===(top.controllerId??top.ownerId))?.name} · <strong><RulesText text={top.label}/></strong></p>
    <div className="floating-stack-cards" aria-label="Stack cards, next to resolve first">{entries.map((entry,i)=>{const art=entry.card??entry.sourceCard;return <div className="floating-stack-slot" key={entry.id}><span>{i===0?'RESOLVES NEXT':`THEN ${i+1}`}</span><button data-stack-entry={entry.id} className={`floating-stack-card ${traced?.id===entry.id&&entry.targets?.length?'tracing-targets':''}`} onPointerEnter={e=>{if(e.pointerType==='mouse')setHovered(entry.id);}} onPointerLeave={()=>setHovered(null)} onFocus={()=>setFocused(entry.id)} onBlur={()=>setFocused(null)} aria-label={`${entry.label}, ${i===0?'top of stack':'waiting'}`} {...drag.draggableProps({kind:'stack',entryId:entry.id,revision:table.stack.revision},()=>onInspect(entry))} onClick={()=>onInspect(entry)}>{art?<CardArt card={art}/>:<div className="ability-card-face"><Zap/><strong><RulesText text={entry.label}/></strong></div>}{entry.kind==='ability'&&<span className="floating-ability-label">Ability</span>}</button></div>;})}</div>
    {!!traced?.targets?.length&&<p className="floating-stack-targets">{traced===top?'Target':'Selected target'}: {traced.targets.map((t,i)=>`${traced.targets!.length>1?`${i+1}. `:''}${targetLabel(table,t)}`).join(' · ')}</p>}
   </>:<div className="floating-stack-empty"><Layers/><p>Drag a card here to cast.<br/>Or add an ability from a permanent.</p></div>}
  </div>
  <footer>
   {top&&<><div className="floating-stack-controls"><button className="btn quiet" disabled={busy||passed} onClick={()=>onCommand({type:'pass',revision:table.stack.revision})}>{passed?<Check/>:null}{passed?'No response ✓':'No response'}</button><button className="btn gold" disabled={busy} {...(drag.item?.kind==='stack'?drag.dropProps({kind:'resolve'}):{})} onClick={()=>onCommand({type:'finish',entryId:top.id,revision:table.stack.revision,to:defaultResolution(top),outcome:'resolve'})}>{busy?<LoaderCircle className="spin"/>:<Check/>}{busy?'Resolving…':'Resolve top card'}</button></div>
   <div className="floating-stack-readiness">{table.players.filter(p=>p.connected).map(p=><span key={p.id} className={table.stack.passes.includes(p.id)?'ready':''}>{p.id===viewerId?'You':p.name}{table.stack.passes.includes(p.id)?' ✓':' …'}</span>)}</div>
   {busy&&<button className="text-btn" onClick={onRetry}>Retry resolution</button>}</>}
   <button className="text-btn floating-stack-more" onClick={onAdvanced}>More stack actions</button>
  </footer>
 </section>;
}
