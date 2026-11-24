'use client';
import {useEffect,type RefObject} from 'react';
import type {Camera} from '@/lib/table-camera';
import {dragEdgeVelocity} from '@/lib/drag-edge-pan';

export function useDragEdgePan(viewport:RefObject<HTMLDivElement|null>,camera:RefObject<Camera>,update:(c:Camera)=>void,active:boolean){
 useEffect(()=>{
  const node=viewport.current;if(!active||!node)return;
  let point:{x:number;y:number}|null=null,frame=0,last=0,armed=false;
  const stop=()=>{point=null;last=0;if(frame)cancelAnimationFrame(frame);frame=0;};
  const tick=(now:number)=>{
   frame=0;if(!point)return;
   const v=dragEdgeVelocity(point,node.getBoundingClientRect());
   if(!v.x&&!v.y){last=0;return;}
   const dt=last?Math.min(32,now-last)/1000:0;last=now;
   if(dt)update({...camera.current,x:camera.current.x+v.x*dt,y:camera.current.y+v.y*dt});
   frame=requestAnimationFrame(tick);
  };
  const track=(e:MouseEvent)=>{
   const hit=document.elementFromPoint(e.clientX,e.clientY);
   if(!hit||!node.contains(hit)||hit.closest('.player-bar,.hand-switcher,.hand-scroll-controls,[role="dialog"],[role="menu"]')){stop();return;}
   // Leave the fan first, so picking a card up at the bottom doesn't move the table.
   if(!hit.closest('.hand-and-zones'))armed=true;
   if(!armed)return;
   point={x:e.clientX,y:e.clientY};if(!frame)frame=requestAnimationFrame(tick);
  };
  const leave=(e:DragEvent)=>{if(!e.relatedTarget)stop();};
  document.addEventListener('dragover',track,true);document.addEventListener('pointermove',track,true);
  document.addEventListener('dragleave',leave,true);
  for(const name of ['drop','dragend','pointerup','pointercancel'])document.addEventListener(name,stop,true);
  window.addEventListener('blur',stop);
  return()=>{stop();document.removeEventListener('dragover',track,true);document.removeEventListener('pointermove',track,true);document.removeEventListener('dragleave',leave,true);for(const name of ['drop','dragend','pointerup','pointercancel'])document.removeEventListener(name,stop,true);window.removeEventListener('blur',stop);};
 },[active]);
}
