'use client';
import {cloneElement,isValidElement,useEffect,useRef,useState,type ButtonHTMLAttributes,type CSSProperties,type ReactElement,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import type {Card} from '@/lib/game';
import {handLayout} from '@/lib/hand-layout';
export function FanHand({cards,mobile,renderCard,empty,tableMode=false,label="Your hand cards",dragging=false}:{label?:string;cards:Card[];mobile:boolean;renderCard:(card:Card)=>ReactNode;empty:ReactNode;tableMode?:boolean;dragging?:boolean}){
 const root=useRef<HTMLDivElement>(null),scrollport=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:680,compact:false,short:false}),[open,setOpen]=useState(false),[hovered,setHovered]=useState<string|null>(null),[focused,setFocused]=useState<string|null>(null),[held,setHeld]=useState<string|null>(null),[edges,setEdges]=useState({left:false,right:false});
 const layout=handLayout(cards.length,size.width,size.compact,mobile,tableMode?(mobile?104:size.short?116:148):undefined,tableMode);
 const expanded=mobile||open||!!focused||!!held||dragging,active=held??hovered??focused;
 const updateEdges=()=>{const s=scrollport.current;if(s)setEdges({left:s.scrollLeft>1,right:s.scrollLeft+s.clientWidth<s.scrollWidth-2});};
 useEffect(()=>{
  const node=root.current;if(!node)return;
  const measure=()=>{const next={width:node.clientWidth,compact:window.innerHeight<850,short:window.innerHeight<780};setSize(old=>old.width===next.width&&old.compact===next.compact&&old.short===next.short?old:next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);window.addEventListener('resize',measure);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[]);
 useEffect(()=>{const end=(e:Event)=>{setHeld(null);const r=root.current?.getBoundingClientRect(),p=e as PointerEvent;if(e.type!=='pointerup'||!r||p.clientX<r.left||p.clientX>r.right||p.clientY<r.top-88||p.clientY>r.bottom){setOpen(false);setHovered(null);setFocused(null);}};window.addEventListener('pointerup',end,true);window.addEventListener('dragend',end);window.addEventListener('blur',end);return()=>{window.removeEventListener('pointerup',end,true);window.removeEventListener('dragend',end);window.removeEventListener('blur',end);};},[]);
 useEffect(()=>{if(!dragging)setHeld(null);},[dragging]);
 useEffect(()=>{updateEdges();},[layout.stageWidth,size.width,cards.length]);
 useEffect(()=>{const node=root.current;if(!node)return;const wheel=(e:WheelEvent)=>{if(e.ctrlKey||e.metaKey)return;const s=scrollport.current;if(!s)return;e.preventDefault();e.stopPropagation();setOpen(true);setHovered(null);const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;s.scrollLeft+=delta*(e.deltaMode===1?16:e.deltaMode===2?s.clientWidth:1);};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[]);
 const scroll=(direction:number)=>{const s=scrollport.current;if(s){setOpen(true);setHovered(null);s.scrollLeft+=direction*Math.max(layout.cardWidth,s.clientWidth*.65);}};
 return <div ref={root} className={`arena-hand stable-hand ${mobile?'touch-hand':''} ${layout.overflow?'scrolling-hand':''} ${tableMode?'floating-fan':''} ${cards.length?'has-cards':''}`} data-expanded={expanded} data-dragging={dragging||undefined} onPointerEnter={e=>{if(e.pointerType==='mouse')setOpen(true);}} onPointerLeave={()=>{setOpen(false);setHovered(null);}} style={{'--hand-card-width':`${layout.cardWidth}px`,'--hand-span':`${layout.stageWidth}px`,'--hand-visible-span':`${Math.min(size.width,layout.spread)}px`} as CSSProperties} aria-label={label}>
  <div ref={scrollport} className="hand-viewport" onScroll={updateEdges}><div className="hand-fan" style={{width:layout.stageWidth}}>{cards.map((card,i)=>{
   const p=layout.positions[i],node=renderCard(card);
   if(!isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(node))return node;
   const button=node as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
   return <div key={card.uid} className="hand-slot" data-active={active===card.uid||undefined} style={{left:p.x,width:p.hitWidth,'--hand-angle':`${p.angle}deg`,'--hand-y':`${p.y}px`,'--hand-index':i+1} as CSSProperties} onPointerMove={e=>{if(e.pointerType==='mouse'&&!held&&!dragging)setHovered(card.uid);}} onPointerEnter={e=>{if(e.pointerType==='mouse'&&!held&&!dragging)setHovered(card.uid);}} onFocusCapture={e=>{if((e.target as HTMLElement).matches(':focus-visible')){setFocused(card.uid);setOpen(true);const s=scrollport.current;if(s){if(p.x<s.scrollLeft)s.scrollLeft=Math.max(0,p.x-24);else if(p.x+layout.cardWidth>s.scrollLeft+s.clientWidth)s.scrollLeft=p.x+layout.cardWidth-s.clientWidth+24;}}}} onBlurCapture={()=>setFocused(null)}>
    {cloneElement(button,{className:'hand-card-hit',onPointerDown:e=>{if(e.button===0){setHeld(card.uid);setOpen(true);}button.props.onPointerDown?.(e);},onDragStart:e=>{button.props.onDragStart?.(e);const art=e.currentTarget.querySelector<HTMLElement>('.hand-card-visual');if(art)e.dataTransfer.setDragImage(art,layout.cardWidth/2,layout.cardWidth*.7);}},<span className={`${button.props.className??'game-card'} hand-card-visual`} aria-hidden="true">{button.props.children}</span>)}
   </div>;
  })}{!cards.length&&empty}</div></div>
  {layout.overflow&&<div className="hand-scroll-controls"><button aria-label="Scroll hand left" disabled={!edges.left} onClick={()=>scroll(-1)}><ChevronLeft/></button><span>Scroll hand</span><button aria-label="Scroll hand right" disabled={!edges.right} onClick={()=>scroll(1)}><ChevronRight/></button></div>}
 </div>;
}
