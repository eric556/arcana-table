'use client';
import {Eye,EyeOff,ChevronDown} from 'lucide-react';
import {CardArt} from './card-art';
import {LABELS,type Card,type Zone,type Table} from '@/lib/game';
export function revealGroups(table:Table){return table.players.map(p=>({owner:p.id,name:p.name,cards:[...p.revealedLibrary.map(card=>({card,zone:'library' as Zone})),...(p.revealedCards??[])].filter((x,i,a)=>a.findIndex(y=>y.card.uid===x.card.uid)===i)})).filter(g=>g.cards.length);}
export function FloatingReveals({table,viewerId,onClose,onStop,onInspect}:{table:Table;viewerId:string;onClose:()=>void;onStop:()=>void;onInspect:(c:Card,owner:string,zone:Zone)=>void}){
 const groups=revealGroups(table),count=groups.reduce((n,g)=>n+g.cards.length,0);
 return <section className="floating-stack floating-reveals" aria-label="Revealed cards"><header><Eye/><h2>Revealed <span>{count}</span></h2><button className="icon-btn" aria-label="Minimize reveals" onClick={onClose}><ChevronDown/></button></header><div className="reveal-popup-body">{groups.map(g=><section className="reveal-owner-group" key={g.owner}><p>{g.name} <small>visible to everyone</small></p><div className="reveal-popup-cards">{g.cards.map(({card,zone})=><div key={card.uid}><button className="reveal-popup-card" onClick={()=>onInspect(card,g.owner,zone)} aria-label={`Inspect revealed ${card.data.name}`}><CardArt card={card} reveal/></button><small>{LABELS[zone]}</small></div>)}</div></section>)}</div><footer><span>Cards stay in their zones.</span>{groups.some(g=>g.owner===viewerId)&&<button className="btn quiet" onClick={onStop}><EyeOff/>Stop my reveal</button>}</footer></section>;
}
