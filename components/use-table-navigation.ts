'use client';
import {useEffect,useRef,useState,type PointerEvent,type MouseEvent,type RefObject} from 'react';
import {zoomAt,type Camera} from '@/lib/table-camera';
type Point={x:number;y:number};
type Gesture={camera:Camera;points:Point[];mode:'pan'|'pinch'|'scroll';scroller?:HTMLElement;scrollLeft?:number};
// All contacts are observed in capture phase, including contacts over cards.
// A second contact owns the gesture until every finger has been lifted.
export function useTableNavigation(viewport:RefObject<HTMLDivElement|null>,camera:RefObject<Camera>,update:(c:Camera)=>void,cancelCard:()=>void,panMode:boolean){
 const contacts=useRef(new Map<number,Point>()),gesture=useRef<Gesture|null>(null),hand=useRef<{node:HTMLElement;start:Point;left:number}|null>(null),space=useRef(false),suppressUntil=useRef(0);
 const [panning,setPanning]=useState(false);
 const point=(e:PointerEvent)=>({x:e.clientX,y:e.clientY});
 const capture=(id:number)=>{try{viewport.current?.setPointerCapture(id);}catch{}};
 const release=(id:number)=>{try{if(viewport.current?.hasPointerCapture(id))viewport.current.releasePointerCapture(id);}catch{}};
 const reset=()=>{for(const id of contacts.current.keys())release(id);contacts.current.clear();gesture.current=null;hand.current=null;space.current=false;setPanning(false);};
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,textarea,select,[role="dialog"],[role="menu"],button'))return;if(e.code==='Space'){space.current=true;e.preventDefault();}};const up=(e:KeyboardEvent)=>{if(e.code==='Space')space.current=false;};const blur=()=>{cancelCard();reset();};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};},[]);
 const begin=(e:PointerEvent<HTMLDivElement>)=>{
  if(e.button!==0&&e.button!==1)return;
  const target=e.target as HTMLElement;
  const interactive=target.closest('button,a,input,[data-table-card],[role="menu"]');
  contacts.current.set(e.pointerId,point(e));
  if(e.pointerType==='touch'&&contacts.current.size>=2){
   cancelCard();hand.current=null;gesture.current={camera:camera.current,points:[...contacts.current.values()],mode:'pinch'};
   for(const id of contacts.current.keys())capture(id);
  }else if(panMode||space.current||e.button===1||!interactive){
   // A keyboard-picked card still uses an ordinary tap to select its drop zone.
   if(target.closest('[data-keyboard-card="true"]'))return;
   cancelCard();gesture.current={camera:camera.current,points:[point(e)],mode:'pan'};capture(e.pointerId);
  }else{
   const scroller=e.pointerType==='touch'?target.closest<HTMLElement>('.hand-viewport'):null;
   hand.current=scroller&&scroller.scrollWidth>scroller.clientWidth+1?{node:scroller,start:point(e),left:scroller.scrollLeft}:null;
   return;
  }
  e.preventDefault();e.stopPropagation();suppressUntil.current=Date.now()+500;setPanning(true);
 };
 const move=(e:PointerEvent<HTMLDivElement>)=>{
  if(!contacts.current.has(e.pointerId))return;contacts.current.set(e.pointerId,point(e));
  if(!gesture.current&&hand.current){const h=hand.current,dx=e.clientX-h.start.x,dy=e.clientY-h.start.y;if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5){cancelCard();gesture.current={camera:camera.current,points:[h.start],mode:'scroll',scroller:h.node,scrollLeft:h.left};capture(e.pointerId);}}
  const start=gesture.current;if(!start)return;e.preventDefault();e.stopPropagation();suppressUntil.current=Date.now()+500;
  const current=[...contacts.current.values()];
  if(start.mode==='scroll'){start.scroller!.scrollLeft=start.scrollLeft!-(current[0].x-start.points[0].x);return;}
  if(current.length>=2&&start.points.length>=2){const center=(p:Point[])=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}),a=center(start.points),b=center(current),distance=(p:Point[])=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),r=viewport.current!.getBoundingClientRect();const next=zoomAt(start.camera,start.camera.zoom*distance(current)/Math.max(1,distance(start.points)),a.x-r.left,a.y-r.top);update({...next,x:next.x+b.x-a.x,y:next.y+b.y-a.y});}
  else update({...start.camera,x:start.camera.x+current[0].x-start.points[0].x,y:start.camera.y+current[0].y-start.points[0].y});
 };
 const end=(e:PointerEvent<HTMLDivElement>)=>{
  if(!contacts.current.has(e.pointerId))return;const consumed=!!gesture.current;
  contacts.current.delete(e.pointerId);release(e.pointerId);hand.current=null;
  if(consumed){e.preventDefault();e.stopPropagation();suppressUntil.current=Date.now()+500;gesture.current=contacts.current.size?{camera:camera.current,points:[...contacts.current.values()],mode:'pan'}:null;setPanning(!!contacts.current.size);}
 };
 const cancel=(e:PointerEvent<HTMLDivElement>)=>{if(e.pointerType==='mouse'&&!gesture.current){reset();return;}if(gesture.current){e.stopPropagation();suppressUntil.current=Date.now()+500;}cancelCard();reset();};
 const click=(e:MouseEvent<HTMLDivElement>)=>{if(panMode||space.current||Date.now()<suppressUntil.current){e.preventDefault();e.stopPropagation();}};
 return {panning,handlers:{onPointerDownCapture:begin,onPointerMoveCapture:move,onPointerUpCapture:end,onPointerCancelCapture:cancel,onClickCapture:click}};
}
