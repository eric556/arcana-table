'use client';
import {RulesText} from './rules-text';
import {ArrowUp,ArrowDown} from 'lucide-react';
import {progressInfo,roman,type Card,type Action} from '@/lib/game';
export function ProgressBadge({card}:{card:Card}){
 const p=progressInfo(card);if(!p)return null;
 return <span className={`progress-badge ${p.kind}`} title={p.kind==='saga'?`${p.value} lore counters · chapter ${roman(p.value)} of ${roman(p.max)}`:`${p.kind==='class'?'Class level':'Level counters'}: ${p.value}`}>{p.kind==='saga'?`${roman(p.value)} / ${roman(p.max)}`:`Lv ${p.value}`}</span>;
}
export function ProgressControls({card,editable,onAction}:{card:Card;editable:boolean;onAction:(a:Action)=>void}){
 const p=progressInfo(card);if(!p)return null;
 const current=p.kind==='leveler'?Math.max(...p.stages.filter(s=>s.value<=p.value).map(s=>s.value)):p.value;
 const set=(value:number)=>onAction({type:'progress',uid:card.uid,value});
 return <section className="card-progression" aria-label={p.kind==='saga'?'Saga chapters':p.kind==='class'?'Class levels':'Creature levels'}>
  <h3>{p.kind==='saga'?`Saga · chapter ${roman(p.value)}`:`${p.kind==='class'?'Class':'Creature'} · level ${p.value}`}</h3>
  <div className="progress-stages">{p.stages.map((s,i)=><button key={`${s.value}-${i}`} disabled={!editable} aria-pressed={s.value===current} className={`${s.value===current?'current':''} ${p.kind==='class'&&s.value<=p.value?'unlocked':''}`} onClick={()=>set(s.value)}>{p.kind==='saga'?s.label:`Lv ${s.label}`}</button>)}</div>
  {p.stages.filter(s=>p.kind==='class'?s.value<=p.value:s.value===current).map((s,i)=><div className="progress-rules" key={i}><strong>{p.kind==='saga'?`Chapter ${s.label}`:`Level ${s.label}`}{s.cost&&<> · <RulesText text={s.cost}/></>}</strong><p><RulesText text={s.text}/></p></div>)}
  {editable&&<div className="progress-buttons"><button className="btn quiet" disabled={p.value<=p.min} onClick={()=>set(p.value-1)}><ArrowDown/>{p.kind==='saga'?'Remove lore':'Level down'}</button><button className="btn gold" disabled={p.value>=p.max} onClick={()=>set(p.value+1)}><ArrowUp/>{p.kind==='saga'?'Next chapter':'Level up'}</button></div>}
  <small>{p.kind==='saga'?'Lore counters update this tracker. Chapter abilities, transforming, and sacrificing stay manual.':'Pay costs and resolve level abilities manually, then update the level here.'}</small>
 </section>;
}
