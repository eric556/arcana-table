'use client';
import {useEffect,useRef,useState,type DragEvent,type KeyboardEvent,type MouseEvent,type PointerEvent} from 'react';
import {boardPosition,unclippedBoardRect,unorientPosition} from '@/lib/table-camera';
import type {DragItem,DropTarget} from '@/lib/table-gestures';

const MIME='text/arcana-drag';
const locatedTarget=(element:Element|null,x:number,y:number,item:DragItem|null=null):DropTarget|null=>{
 let node=element?.closest('[data-table-drop]');
 try{
  const raw=node?.getAttribute('data-table-drop');if(!raw||!node)return null;
  let target:DropTarget=JSON.parse(raw);
  // The held card is transparent to its own drop: use its battlefield plane,
  // even when another permanent is underneath it. IDs also cover borrowed cards.
  if(item?.kind==='card'&&target.kind==='card'&&target.cardId===item.cardId){
   node=node.closest('.player-territory')?.querySelector('[data-board-canvas]')??null;
   const boardTarget=node?.getAttribute('data-table-drop');if(!node||!boardTarget)return null;
   target=JSON.parse(boardTarget);
  }
  if(target.kind==='zone'&&target.zone==='battlefield'&&node.hasAttribute('data-board-canvas')){
   const r=node.getBoundingClientRect(),element=node as HTMLElement,scale=Number(node.getAttribute('data-board-scale'))||r.width/Math.max(1,element.offsetWidth),w=Number(node.getAttribute('data-board-card-width'))||96,h=Number(node.getAttribute('data-board-card-height'))||134;
   const worldWidth=Number(node.getAttribute('data-board-width')),worldHeight=Number(node.getAttribute('data-board-height'));
   const board=worldWidth&&worldHeight?unclippedBoardRect(r,Number(node.getAttribute('data-board-offset-x'))||0,Number(node.getAttribute('data-board-offset-y'))||0,worldWidth,worldHeight,scale):r;
   return {...target,position:unorientPosition(boardPosition(x,y,board,scale,w,h,node.getAttribute('data-board-space')==='area'?'area':undefined),node.getAttribute('data-board-facing')==='true')};
  }
  return target;
 }catch{return null;}
};
const targetKey=(t:DropTarget)=>JSON.stringify(t.kind==='zone'?{kind:t.kind,zone:t.zone,ownerId:t.ownerId}:t);
const targetAt=(x:number,y:number,item:DragItem|null)=>locatedTarget(document.elementFromPoint(x,y),x,y,item);
export function useTableDrag(onDrop:(item:DragItem,target:DropTarget)=>void){
 const [item,setItem]=useState<DragItem|null>(null),[hover,setHover]=useState(''),[pointer,setPointer]=useState<{x:number;y:number}|null>(null),[keyboard,setKeyboard]=useState(false);
 const nativeDragging=useRef(false);
 const active=useRef<DragItem|null>(null),touch=useRef<{item:DragItem;pointerId:number;x:number;y:number;moving:boolean}|null>(null),ignoreClick=useRef(false);
 const pendingTap=useRef<{key:string;time:number;timer:ReturnType<typeof setTimeout>}|null>(null);
 const clearTap=()=>{if(pendingTap.current)clearTimeout(pendingTap.current.timer);pendingTap.current=null;};
 useEffect(()=>()=>clearTap(),[]);
 const begin=(next:DragItem)=>{clearTap();active.current=next;setItem(next);};
 const cancel=()=>{nativeDragging.current=false;clearTap();active.current=null;touch.current=null;setItem(null);setHover('');setPointer(null);setKeyboard(false);};
 const finish=(next:DragItem,target:DropTarget)=>{cancel();onDrop(next,target);};
 const draggableProps=(next:DragItem,onTap?:()=>void,onDoubleTap?:()=>void)=>({
  draggable:true,
  'data-table-card':true,
  'data-card-dragging':!!pointer&&!!item&&(item.kind==='card'&&next.kind==='card'?item.cardId===next.cardId:item.kind==='stack'&&next.kind==='stack'&&item.entryId===next.entryId)||undefined,
  onDragStart:(e:DragEvent<HTMLElement>)=>{e.stopPropagation();begin(next);nativeDragging.current=true;setKeyboard(false);e.dataTransfer.setData(MIME,JSON.stringify(next));if(next.kind==='card')e.dataTransfer.setData('text/arcana-card',next.cardId);e.dataTransfer.effectAllowed='move';},
  onDragEnd:()=>{ignoreClick.current=true;cancel();setTimeout(()=>{ignoreClick.current=false;},0);},
  onKeyDown:(e:KeyboardEvent<HTMLElement>)=>{if(e.key===' '){e.preventDefault();e.stopPropagation();begin(next);setKeyboard(true);}if(e.key==='Escape')cancel();},
  onClickCapture:(e:MouseEvent<HTMLElement>)=>{if(ignoreClick.current){e.preventDefault();e.stopPropagation();}},
  onPointerDown:(e:PointerEvent<HTMLElement>)=>{if(e.pointerType==='mouse'||keyboard)return;touch.current={item:next,pointerId:e.pointerId,x:e.clientX,y:e.clientY,moving:false};},
  onPointerMove:(e:PointerEvent<HTMLElement>)=>{const start=touch.current;if(!start||start.pointerId!==e.pointerId)return;if(!start.moving&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>16){start.moving=true;e.currentTarget.setPointerCapture(e.pointerId);begin(start.item);}if(start.moving){e.preventDefault();setPointer({x:e.clientX,y:e.clientY});const t=targetAt(e.clientX,e.clientY,start.item);setHover(t?targetKey(t):'');}},
  onPointerUp:(e:PointerEvent<HTMLElement>)=>{const start=touch.current;if(!start||start.pointerId!==e.pointerId)return;if(start.moving){e.preventDefault();ignoreClick.current=true;const t=targetAt(e.clientX,e.clientY,start.item);if(t)finish(start.item,t);else cancel();setTimeout(()=>{ignoreClick.current=false;},350);}else if(onTap){e.preventDefault();ignoreClick.current=true;touch.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(onDoubleTap){
      const key=JSON.stringify(next),previous=pendingTap.current;
      if(previous&&previous.key===key&&Date.now()-previous.time<300){clearTap();onDoubleTap();}
      else {clearTap();pendingTap.current={key,time:Date.now(),timer:setTimeout(()=>{pendingTap.current=null;onTap();},300)};}
    }else onTap();setTimeout(()=>{ignoreClick.current=false;},350);}touch.current=null;},
  onPointerCancel:(e:PointerEvent<HTMLElement>)=>{if(e.pointerType==='mouse'&&nativeDragging.current)return;cancel();},
 });
 const dropProps=(target:DropTarget)=>{
  const key=targetKey(target);
  return {
   'data-table-drop':key,
   'data-drop-hover':hover===key||undefined,
   onDragOver:(e:DragEvent<HTMLElement>)=>{if(active.current||e.dataTransfer.types.includes(MIME)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';const resolved=locatedTarget(e.currentTarget,e.clientX,e.clientY,active.current);setHover(resolved?targetKey(resolved):'');}},
   onDragLeave:(e:DragEvent<HTMLElement>)=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setHover(old=>old===key?'':old);},
   onDrop:(e:DragEvent<HTMLElement>)=>{e.preventDefault();e.stopPropagation();let next=active.current;try{const raw=e.dataTransfer.getData(MIME);if(raw)next=JSON.parse(raw);}catch{}const resolved=next?locatedTarget(e.currentTarget,e.clientX,e.clientY,next):null;if(next&&resolved)finish(next,resolved);else cancel();},
   onClickCapture:(e:MouseEvent<HTMLElement>)=>{if(ignoreClick.current){e.preventDefault();e.stopPropagation();return;}if(keyboard&&active.current&&(e.target as HTMLElement).closest('[data-table-drop]')===e.currentTarget){e.preventDefault();e.stopPropagation();const resolved=locatedTarget(e.currentTarget,e.clientX,e.clientY,active.current);if(resolved)finish(active.current,resolved);else cancel();}},
  };
 };
 return {item,pointer,keyboard,draggableProps,dropProps,cancel,pickUp:(next:DragItem)=>{begin(next);setKeyboard(true);}};
}
