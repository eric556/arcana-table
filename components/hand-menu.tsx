'use client';
import {useRef,useState} from 'react';
import {Layers,Eye,ArrowDownToLine,Shuffle,RotateCcw,Upload} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator} from '@/components/ui/dropdown-menu';
import type {Action} from '@/lib/game';
export function HandMenu({count,libraryCount,battlefieldCount=0,graveyardCount=0,exileCount=0,onAction,onHand,onDeck}:{count:number;libraryCount:number;battlefieldCount?:number;graveyardCount?:number;exileCount?:number;onAction:(a:Action)=>void;onHand:()=>void;onDeck:()=>void}){
 const [open,setOpen]=useState(false),openingDialog=useRef(false);
 const show=(callback:()=>void)=>{openingDialog.current=true;setOpen(false);callback();};
 return <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
  <DropdownMenuTrigger asChild><button className="btn quiet hand-menu-trigger" aria-label={`Hand and deck actions, ${count} cards in hand`} title="Hand and deck actions"><Layers/><span>Cards</span><b>{count}</b></button></DropdownMenuTrigger>
  <DropdownMenuContent className="library-context-menu" align="end" side="bottom" sideOffset={8} collisionPadding={12} onCloseAutoFocus={e=>{if(openingDialog.current){e.preventDefault();openingDialog.current=false;}}}>
   <DropdownMenuLabel>Your cards · {count} in hand</DropdownMenuLabel>
   <DropdownMenuItem onSelect={()=>show(onHand)}><Eye/>View hand</DropdownMenuItem>
   <DropdownMenuItem disabled={!libraryCount} onSelect={()=>onAction({type:'draw'})}><ArrowDownToLine/>Draw a card<kbd>D</kbd></DropdownMenuItem>
   {!count&&libraryCount>0&&<DropdownMenuItem onSelect={()=>onAction({type:'draw',count:7})}><Layers/>Draw opening seven</DropdownMenuItem>}
   <DropdownMenuSeparator/>
   <DropdownMenuItem disabled={!libraryCount} onSelect={()=>onAction({type:'shuffle'})}><Shuffle/>Shuffle library<kbd>S</kbd></DropdownMenuItem>
   <DropdownMenuItem disabled={!count&&!libraryCount&&!battlefieldCount&&!graveyardCount&&!exileCount} onSelect={()=>onAction({type:'mulligan'})}><RotateCcw/>Mulligan · fresh 7</DropdownMenuItem>
   <DropdownMenuSeparator/>
   <DropdownMenuItem onSelect={()=>show(onDeck)}><Upload/>Import / replace deck</DropdownMenuItem>
  </DropdownMenuContent>
 </DropdownMenu>;
}
