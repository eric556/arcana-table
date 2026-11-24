'use client';
import {useState,type ReactNode} from 'react';
import {Search,Skull,Sun,X,SlidersHorizontal,BookOpen,Lock,Shuffle} from 'lucide-react';
import {librarySearchCards} from '@/lib/library-search';
import type {Card} from '@/lib/game';
export function FloatingZone({label,zone,cards,renderCard,onClose,onManage,onShuffle}:{label:string;zone:'graveyard'|'exile'|'library';cards:Card[];renderCard:(card:Card)=>ReactNode;onClose:()=>void;onManage:()=>void;onShuffle?:()=>void}){
 const [query,setQuery]=useState('');
 const matching=(zone==='library'?librarySearchCards(cards):cards).filter(c=>c.data.name.toLowerCase().includes(query.toLowerCase()));
 const Icon=zone==='library'?BookOpen:zone==='graveyard'?Skull:Sun;
 return <section className="floating-zone-browser" aria-label={label} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
  <header><Icon/><h2>{label} <span>{cards.length}</span></h2><button className="icon-btn" onClick={onManage} aria-label="Manage zone cards" title="Bulk moves and permissions"><SlidersHorizontal/></button><button className="icon-btn" onClick={onClose} aria-label="Close zone panel"><X/></button></header>
  {zone==='library'&&<p className="zone-private-note"><Lock/>Alphabetical · Only you can see your library</p>}
  <div className="zone-fan-search"><Search/><input aria-label="Search open zone" placeholder="Find a card…" value={query} onChange={e=>setQuery(e.target.value)}/><span>Drag to play</span></div>
  <div className="zone-play-cards">{matching.map(c=><div className="zone-play-card" key={c.uid}>{renderCard(c)}<span title={c.data.name}>{c.data.name}</span></div>)}{!matching.length&&<p className="zone-play-empty">{query?'No matching cards.':'No cards here yet.'}</p>}</div>
  {onShuffle&&<footer className="zone-play-footer"><button className="btn gold" onClick={onShuffle}><Shuffle/>Shuffle &amp; close</button></footer>}
 </section>;
}
