'use client';
import {useEffect,useId,useState} from 'react';
import {Minus,Plus,X} from 'lucide-react';
import {Input} from '@/components/ui/input';
import type {Action,Card,Player,PublicPlayer} from '@/lib/game';

export function CounterAmount({label,value,onSet}:{label:string;value:number;onSet:(n:number)=>void}){
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const apply=()=>{const n=Number(draft);if(draft.trim()&&Number.isSafeInteger(n)&&n>=0){if(n!==value)onSet(n);}else setDraft(String(value));};
 return <div className="counter-amount"><button className="icon-btn" aria-label={`Remove one ${label}`} disabled={value===0} onClick={()=>onSet(Math.max(0,value-1))}><Minus/></button><Input aria-label={`${label} amount`} inputMode="numeric" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={apply} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/><button className="icon-btn" aria-label={`Add one ${label}`} disabled={value===Number.MAX_SAFE_INTEGER} onClick={()=>onSet(value+1)}><Plus/></button></div>;
}
export function CardCounters({card,editable,onAction}:{card:Card;editable:boolean;onAction:(a:Action)=>void}){
 const [name,setName]=useState('+1/+1'),[amount,setAmount]=useState('1');const suggestions=useId();
 const count=Number(amount),valid=!!name.trim()&&amount.trim()!==''&&Number.isSafeInteger(count)&&count>0;
 const entries=Object.entries(card.namedCounters??{}).filter(([,n])=>n>0);
 return <section className="card-counter-editor" aria-label="Card counters"><h3>Counters</h3>
  {card.counters>0&&<div className="named-counter-row"><strong>Unnamed</strong>{editable?<CounterAmount label="unnamed counters" value={card.counters} onSet={n=>onAction({type:'counter',uid:card.uid,amount:n-card.counters})}/>:<b>{card.counters}</b>}</div>}
  {entries.map(([label,n])=><div className="named-counter-row" key={label}><strong>{label}</strong>{editable?<><CounterAmount label={label} value={n} onSet={amount=>onAction({type:'namedCounter',uid:card.uid,name:label,amount,set:true})}/><button className="icon-btn" aria-label={`Remove all ${label} counters`} onClick={()=>onAction({type:'namedCounter',uid:card.uid,name:label,amount:0,set:true})}><X/></button></>:<b>{n}</b>}</div>)}
  {!entries.length&&!card.counters&&<p className="counter-note">No counters on this card.</p>}
  {editable&&<form className="add-counter-form" onSubmit={e=>{e.preventDefault();if(valid)onAction({type:'namedCounter',uid:card.uid,name,amount:count});}}><label className="form-label">Counter name<Input list={suggestions} maxLength={64} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. +1/+1, shield, charge"/></label><datalist id={suggestions}>{['+1/+1','-1/-1','Loyalty','Shield','Charge','Stun','Lore','Oil','Time'].map(v=><option key={v} value={v}/>)}</datalist><label className="form-label">Amount to add<Input inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="btn gold" disabled={!valid} type="submit"><Plus/>Add counters</button></form>}
 </section>;
}
export function PlayerTrackers({player,opponents,commander,onAction}:{player:Player;opponents:PublicPlayer[];commander:boolean;onAction:(a:Action)=>void}){
 return <div className="player-trackers"><section><h3>Poison counters</h3><CounterAmount label="poison" value={player.poison} onSet={n=>onAction({type:'poison',amount:n-player.poison})}/><p className="counter-note">Track poison separately from life.</p></section>{commander&&<section><h3>Commander damage received</h3><p className="counter-note">Adding commander damage also reduces your life. Reducing it restores that much life.</p>{!opponents.length&&<p className="counter-note">Each opponent appears here when they join.</p>}{opponents.map(p=><div className="commander-damage-row" key={p.id}><div><strong>{p.name}</strong><small>{p.connected?'Commander damage to you':'Disconnected · damage kept'}</small></div><CounterAmount label={`commander damage from ${p.name}`} value={player.damage[p.id]??0} onSet={n=>onAction({type:'damage',target:p.id,amount:n-(player.damage[p.id]??0)})}/></div>)}</section>}</div>;
}
