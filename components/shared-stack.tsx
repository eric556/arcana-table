'use client';
import {RulesText} from './rules-text';
import {activeType,faceName,playDestination,hasFaces} from '@/lib/game';
import {useEffect,useState} from 'react';
import {Layers,Zap,Check,ArrowDown,LoaderCircle} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {abilityChoices} from '@/lib/abilities';
import {CardArt} from './card-art';
import {LABELS,type Card,type Player,type Table,type StackEntry,type StackDestination,type Zone} from '@/lib/game';
import {STACK_DESTINATIONS,targetLabel,defaultResolution,type StackCommand} from '@/lib/stack';

function Destination({value,onChange}:{value:StackDestination;onChange:(v:StackDestination)=>void}){
 return <Select value={value} onValueChange={v=>onChange(v as StackDestination)}><SelectTrigger className="choice" aria-label="Destination when this spell resolves"><SelectValue/></SelectTrigger><SelectContent>{STACK_DESTINATIONS.map(z=><SelectItem key={z} value={z}>{z==='library'?'Library · top':LABELS[z]}</SelectItem>)}</SelectContent></Select>;
}

function EntryRow({entry,index,table,onCommand,onInspect}:{entry:StackEntry;index:number;table:Table;onCommand:(c:StackCommand)=>void;onInspect:(c:Card,owner:string)=>void}){
 const suggested=defaultResolution(entry);
 const [destination,setDestination]=useState<StackDestination>(suggested);
 useEffect(()=>setDestination(suggested),[entry.id,entry.card?.back,suggested]);
 const owner=table.players.find(p=>p.id===(entry.controllerId??entry.ownerId)),waiting=table.stack.entries.some(e=>e.pending);
 const disabled=waiting;
 const finish=(outcome:'resolve'|'counter')=>onCommand({type:'finish',entryId:entry.id,revision:table.stack.revision,to:outcome==='counter'?'graveyard':destination,outcome});
 return <article className={`stack-entry ${index===0?'stack-entry-top':''}`}>
  <div className="stack-entry-heading"><span>{index===0?'TOP · RESOLVES NEXT':`${index+1} · WAITING`}</span><span>{entry.kind==='spell'?'SPELL':'ABILITY'} · {owner?.name??'Player'}</span></div>
  <div className="stack-entry-body">
   {entry.card?<button className="stack-card-art" onClick={()=>onInspect(entry.card!,entry.ownerId)} aria-label={`Inspect ${entry.label}`}><CardArt card={entry.card}/></button>:<div className="stack-ability-art"><Zap/></div>}
   <div className="stack-entry-text"><h3><RulesText text={entry.label}/></h3>{entry.sourceName&&<p className="stack-source">Source: {entry.sourceName}</p>}{entry.description&&<p className="stack-description"><RulesText text={entry.description}/></p>}{!!entry.targets?.length&&<p className="stack-source">Targets: {entry.targets.map(t=>targetLabel(table,t)).join('; ')}</p>}{entry.card&&<p className="stack-source">{activeType(entry.card)}</p>}{!owner?.connected&&<p className="stack-source">Owner disconnected</p>}{entry.pending&&<p className="stack-pending" role="status"><LoaderCircle className="spin"/>Moving card to {LABELS[entry.pending.to].toLowerCase()}…</p>}</div>
  </div>
  {!entry.pending&&<div className="stack-entry-actions">{index===0&&<>{entry.kind==='spell'&&<label><span>Resolve to</span><Destination value={destination} onChange={setDestination}/></label>}<button className="btn gold" disabled={disabled} onClick={()=>finish('resolve')}><Check/>{entry.kind==='ability'?'Resolve ability':'Resolve spell'}</button></>}<button className="text-btn" disabled={disabled} onClick={()=>finish('counter')}>{entry.kind==='ability'?'Counter / remove ability':'Counter → graveyard'}</button></div>}
 </article>;
}

export function StackPanel({table,viewerId,onCommand,onRespond,onAbility,onInspect}:{table:Table;viewerId:string;onCommand:(c:StackCommand)=>void;onRespond:()=>void;onAbility:()=>void;onInspect:(c:Card,owner:string)=>void}){
 const entries=table.stack.entries,passed=table.stack.passes.includes(viewerId);
 return <div className="stack-panel">
  <div className="stack-toolbar"><button className="btn gold" onClick={onRespond}><Layers/>{entries.length?'Respond with a spell':'Cast a spell'}</button><button className="btn quiet" onClick={onAbility}><Zap/>Add ability</button>{entries.length>0&&<button className="btn quiet" disabled={passed||entries.some(e=>e.pending)} onClick={()=>onCommand({type:'pass',revision:table.stack.revision})}><Check/>{passed?'No response noted':'No response'}</button>}</div>
  {entries.length>0&&<div className="stack-readiness" aria-label="Players ready to resolve">{table.players.filter(p=>p.connected).map(p=><span key={p.id} className={table.stack.passes.includes(p.id)?'has-passed':''}>{table.stack.passes.includes(p.id)&&<Check/>}{p.id===viewerId?'You':p.name}{table.stack.passes.includes(p.id)?' · no response':' · deciding'}</span>)}</div>}
  <div className="stack-entry-list">{entries.map((entry,index)=><EntryRow key={entry.id} entry={entry} index={index} table={table} onCommand={onCommand} onInspect={onInspect}/>)}{!entries.length&&<div className="stack-empty"><Layers/><h3>The stack is clear</h3><p>Cast a spell or add an ability for everyone to respond to.</p></div>}</div>
  {entries.length>1&&<p className="stack-order-note"><ArrowDown/>Resolve from top to bottom, one item at a time.</p>}
  <p className="note">Anyone can resolve or counter after the table agrees. “No response” is a signal, not an automatic pass of priority. Adding a response resets these signals. Resolving abilities removes the entry; apply their effects yourselves.</p>
 </div>;
}

export function StackComposer({player,initialTab,initialSource,onCast,onAbility}:{player:Player;initialTab:'spell'|'ability';initialSource:string;onCast:(c:Card)=>void;onAbility:(c:Extract<StackCommand,{type:'ability'}>)=>void}){
 const [tab,setTab]=useState(initialTab),[zone,setZone]=useState<Zone>('hand'),[query,setQuery]=useState(''),[label,setLabel]=useState(''),[description,setDescription]=useState(''),[source,setSource]=useState(initialSource||'none');
 const cards=player.zones[zone].filter(c=>c.data.name.toLowerCase().includes(query.toLowerCase()));
 const sources=player.zones.battlefield.concat(player.zones.command,player.zones.graveyard,player.zones.exile,player.zones.stack);
 const selectedSource=sources.find(c=>c.uid===source);const options=selectedSource?abilityChoices(selectedSource):[];
 return <Tabs value={tab} onValueChange={v=>setTab(v as 'spell'|'ability')} className="stack-composer">
  <TabsList className="import-tabs"><TabsTrigger value="spell">Spell</TabsTrigger><TabsTrigger value="ability">Ability</TabsTrigger></TabsList>
  <TabsContent value="spell"><div className="stack-cast-filter"><Select value={zone} onValueChange={v=>setZone(v as Zone)}><SelectTrigger className="choice" aria-label="Your zone to cast from"><SelectValue/></SelectTrigger><SelectContent>{(['hand','command','graveyard','exile'] as Zone[]).map(z=><SelectItem key={z} value={z}>{LABELS[z]}</SelectItem>)}</SelectContent></Select><input aria-label="Find a spell" placeholder="Find a spell…" value={query} onChange={e=>setQuery(e.target.value)}/></div><p className="note">Only the card you cast becomes public. Choose legal plays and pay costs yourselves.</p><div className="stack-cast-grid">{cards.map(c=><div key={c.uid}><div className="stack-cast-art"><CardArt card={c} reveal/></div><strong>{faceName(c)}</strong>{(hasFaces(c)?[false,true]:[c.back]).map(back=>{const face={...c,back};return <button key={String(back)} className="btn quiet" onClick={()=>onCast(face)}><Layers/>{playDestination(face)==='battlefield'?'Play':'Cast'} {hasFaces(c)?faceName(face):playDestination(face)==='battlefield'?'land':'to stack'}</button>;})}</div>)}{!cards.length&&<p className="zone-empty">{query?'No matching cards.':'No cards in this zone.'}</p>}</div></TabsContent>
  <TabsContent value="ability"><form className="ability-form" onSubmit={e=>{e.preventDefault();if(label.trim())onAbility({type:'ability',label:label.trim(),description:description.trim(),sourceCardId:source==='none'?undefined:source});}}>
   <label className="form-label">Source (optional)<Select value={source} onValueChange={setSource}><SelectTrigger className="choice" aria-label="Ability source"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">No source / custom ability</SelectItem>{sources.map(c=><SelectItem key={c.uid} value={c.uid}>{c.faceDown?'Face-down card':faceName(c)}</SelectItem>)}</SelectContent></Select></label>
   {options.length>0&&<div className="oracle-ability-options"><span>{selectedSource?.token?'From this token’s abilities':'From this card’s Oracle text'}</span>{options.map((a,i)=><button type="button" className="oracle-ability-choice" key={i} onClick={()=>{setLabel(a.label);setDescription(a.text.slice(0,1000));}}><small>{a.kind}</small><span><RulesText text={a.text}/></span></button>)}</div>}
   <label className="form-label">Ability name<input value={label} onChange={e=>setLabel(e.target.value)} maxLength={160} required placeholder="e.g. Sacrifice: draw a card"/></label>
   <label className="form-label">Effect and targets<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000} rows={4} placeholder="Describe the ability and any targets for the table."/></label>
   <p className="note">The source stays where it is. Tapping, sacrificing, costs, and effects are manual.</p><button className="btn gold full-width" disabled={!label.trim()}><Zap/>Add ability to stack</button>
  </form></TabsContent>
 </Tabs>;
}
