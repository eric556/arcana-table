'use client';
import {useEffect,useId,useState} from 'react';
import {createPortal} from 'react-dom';
import type {StackEntry} from '@/lib/game';
type Line={path:string;x:number;y:number;index:number};
// Read rendered positions so arrows track each viewer's independent camera.
export function StackTargetLines({entry}:{entry?:StackEntry}){
 const [lines,setLines]=useState<Line[]>([]),id=useId().replace(/:/g,'');
 useEffect(()=>{
  if(!entry?.targets?.length){setLines([]);return;}
  const root=document.querySelector('.real-table-app');if(!root)return;
  let raf=0,last='';
  const measure=()=>{raf=0;
   const source=root.querySelector<HTMLElement>(`[data-stack-entry="${CSS.escape(entry.id)}"]`),view=root.querySelector('.table-viewport');
   const visible=(node:Element|null)=>{if(!node)return null;const r=node.getBoundingClientRect();return r.width&&r.height?r:null;};
   const a=visible(source),clip=visible(view),next:Line[]=[];
   if(a&&clip){const scroll=source?.closest('.floating-stack-cards')?.getBoundingClientRect();if(!scroll||a.right>scroll.left&&a.left<scroll.right){
    entry.targets!.forEach((target,index)=>{
     const node=target.kind==='card'?root.querySelector(`[data-board-card="${CSS.escape(target.cardId)}"]`):root.querySelector(`[data-player-target="${CSS.escape(target.ownerId)}"]`),b=visible(node);
     if(!b||b.right<clip.left||b.left>clip.right||b.bottom<clip.top||b.top>clip.bottom)return;
     const center={x:b.left+b.width/2,y:b.top+b.height/2},from={x:a.left+a.width/2,y:a.top+a.height/2};
     const dx=center.x-from.x,dy=center.y-from.y,length=Math.hypot(dx,dy);if(length<4)return;
     const edge=(w:number,h:number)=>Math.min(w/2/Math.max(.001,Math.abs(dx/length)),h/2/Math.max(.001,Math.abs(dy/length)));
     const start=edge(a.width,a.height)+4,end=edge(b.width,b.height)+7;
     const sx=from.x+dx/length*start,sy=from.y+dy/length*start,ex=center.x-dx/length*end,ey=center.y-dy/length*end;
     const bend=Math.min(110,length*.15),mx=(sx+ex)/2-dy/length*bend,my=(sy+ey)/2+dx/length*bend;
     next.push({path:`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`,x:ex,y:ey,index:index+1});
    });
   }}
   const key=JSON.stringify(next);if(key!==last){last=key;setLines(next);}
  };
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(measure);};
  const observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
  const resize=new ResizeObserver(schedule);resize.observe(root);
  root.addEventListener('animationend',schedule);root.addEventListener('transitionend',schedule);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);schedule();
  return()=>{root.removeEventListener('animationend',schedule);root.removeEventListener('transitionend',schedule);observer.disconnect();resize.disconnect();cancelAnimationFrame(raf);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);};
 },[entry]);
 if(!entry||!lines.length)return null;
 return createPortal(<svg className="stack-target-lines" aria-label={`Targets of ${entry.label}`} role="img"><title>{entry.label} targets</title><defs><marker id={`target-${id}`} markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 1 1 L 11 6 L 1 11 L 4 6 Z" fill="#c5a2ff"/></marker></defs>{lines.map(line=><g key={line.index}><path className="target-line-shadow" d={line.path}/><path className="target-line" d={line.path} markerEnd={`url(#target-${id})`}/>{lines.length>1&&<g transform={`translate(${line.x},${line.y-13})`}><circle r="10"/><text textAnchor="middle" dy=".35em">{line.index}</text></g>}</g>)}</svg>,document.body);
}
