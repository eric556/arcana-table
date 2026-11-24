'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Eye,Shield,Check} from 'lucide-react';
import {CardArt} from './card-art';
import {type Action,type Card,type Player} from '@/lib/game';
type Group='top'|'other';
type Plan={count:number;cards:Card[];expected:string[];top:string[];other:string[]};
export function LibraryRulePanel({kind,player,onAction,onDone}:{kind:'scry'|'surveil';player:Player;onAction:(action:Action)=>void;onDone:()=>void}){
 const [count,setCount]=useState('2'),[plan,setPlan]=useState<Plan|null>(null),[expanded,setExpanded]=useState<string|null>(null);
 const title=kind==='scry'?'Scry':'Surveil',other=kind==='scry'?'Bottom of library':'Graveyard';
 const n=Number(count),valid=count.trim()!==''&&Number.isSafeInteger(n)&&n>=0;
 const start=()=>{if(!valid)return;const cards=player.zones.library.slice(0,n),ids=cards.map(c=>c.uid);setPlan({count:n,cards,expected:ids,top:ids,other:[]});setExpanded(null);};
 const current=plan?player.zones.library.slice(0,plan.count).map(c=>c.uid):[];
 const stale=!!plan&&(current.length!==plan.expected.length||current.some((id,i)=>id!==plan.expected[i]));
 const place=(id:string,to:Group,before?:string)=>setPlan(p=>{if(!p||id===before||!p.expected.includes(id))return p;const next={...p,top:p.top.filter(x=>x!==id),other:p.other.filter(x=>x!==id)};const index=before?next[to].indexOf(before):-1;next[to].splice(index<0?next[to].length:index,0,id);return next;});
 const shift=(group:Group,index:number,delta:number)=>setPlan(p=>{if(!p)return p;const ids=[...p[group]],to=index+delta;if(to<0||to>=ids.length)return p;[ids[index],ids[to]]=[ids[to],ids[index]];return {...p,[group]:ids};});
 const MIME='text/arcana-library-rule';
 return <div className="library-rule-panel">
  {!plan?<><label className="form-label">Number of cards<input aria-label={`${title} count`} type="number" min="0" step="1" value={count} onChange={e=>setCount(e.target.value)}/></label><p className="note">{player.zones.library.length} cards in your library. {valid&&n>player.zones.library.length?'You will look at all remaining cards.':''}</p><button className="btn gold" disabled={!valid} onClick={start}><Eye/>Look privately</button></>:<>
   <div className="rule-private"><Shield/><span>Only you can see these {plan.cards.length} cards. Nothing moves until you finish.</span></div>
   {stale?<div className="rule-stale" role="alert">Your library changed. Start again before applying these choices.<button className="btn quiet" onClick={()=>setPlan(null)}>Start again</button></div>:<>
    {!plan.cards.length?<p className="note">{plan.count===0?`${title} 0 does nothing.`:'Your library is empty. You can still finish this action.'}</p>:<div className="rule-piles">{(['top','other'] as const).map(group=><section className="rule-pile" key={group} aria-label={group==='top'?'Top of library':other} onDragOver={e=>{if(e.dataTransfer.types.includes(MIME))e.preventDefault();}} onDrop={e=>{e.preventDefault();place(e.dataTransfer.getData(MIME),group);}}>
     <header><strong>{group==='top'?'Top of library':other}</strong><span>{plan[group].length} cards</span></header><p>{group==='top'?'Leftmost is your next draw.':kind==='scry'?'Rightmost becomes the very bottom card.':'These cards become public when you finish.'}</p>
     <div className="rule-cards">{plan[group].map((id,i)=>{const c=plan.cards.find(c=>c.uid===id)!;return <article className="rule-card" key={id} draggable onDragStart={e=>{e.dataTransfer.setData(MIME,id);e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{if(e.dataTransfer.types.includes(MIME)){e.preventDefault();e.stopPropagation();}}} onDrop={e=>{e.preventDefault();e.stopPropagation();place(e.dataTransfer.getData(MIME),group,id);}}>
      <button className="rule-art" onClick={()=>setExpanded(expanded===id?null:id)} aria-label={`Inspect ${c.data.name}`}><CardArt card={c} reveal/></button><strong>{c.data.name}</strong>
      <button className="btn quiet rule-move" onClick={()=>place(id,group==='top'?'other':'top')}>{group==='other'?'Keep on top':kind==='scry'?'To bottom':'To graveyard'}</button>
      <div className="rule-order"><button className="icon-btn" disabled={!i} onClick={()=>shift(group,i,-1)} aria-label={`Move ${c.data.name} earlier`}><ArrowLeft/></button><span>{i+1}</span><button className="icon-btn" disabled={i===plan[group].length-1} onClick={()=>shift(group,i,1)} aria-label={`Move ${c.data.name} later`}><ArrowRight/></button></div>
     </article>;})}{!plan[group].length&&<span className="rule-empty">Drop cards here, or use the buttons beneath each card.</span>}</div>
    </section>)}</div>}
    {expanded&&<div className="rule-inspect"><CardArt card={plan.cards.find(c=>c.uid===expanded)!} reveal/><button className="text-btn" onClick={()=>setExpanded(null)}>Close detail</button></div>}
    <p className="note">Drag cards between groups or use their buttons. Use the arrows to set the order. Related triggers and replacement effects stay manual.</p>
    <button className="btn gold full-width" onClick={()=>{onAction({type:kind,count:plan.count,expected:plan.expected,top:plan.top,other:plan.other});onDone();}}><Check/>Finish {title.toLowerCase()} {plan.count}</button>
   </>}
  </>}
 </div>;
}
