'use client';
import {useRef,useState,type ReactNode} from 'react';
import {ArrowDownToLine,Eye,Search,Shuffle,RotateCcw,MoreHorizontal,Layers} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator} from '@/components/ui/dropdown-menu';
import type {Action} from '@/lib/game';
export function LibraryMenu({children,count,handCount,battlefieldCount=0,graveyardCount=0,exileCount=0,onAction,onLook,onSearch,onScry,onSurveil,onExile}:{children:ReactNode;count:number;handCount:number;battlefieldCount?:number;graveyardCount?:number;exileCount?:number;onAction:(action:Action)=>void;onLook:()=>void;onSearch:()=>void;onScry:()=>void;onSurveil:()=>void;onExile:()=>void}){
 const [open,setOpen]=useState(false);const openingDialog=useRef(false);
 const dialog=(show:()=>void)=>{openingDialog.current=true;setOpen(false);show();};
 return <DropdownMenu open={open} onOpenChange={setOpen} modal={false}><div className="library-dock" data-shortcut-library="true" onContextMenu={e=>{e.preventDefault();setOpen(true);}} onKeyDown={e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();setOpen(true);}}}>
  {children}
  <DropdownMenuTrigger asChild><button type="button" className="library-menu-button" aria-label="Library actions" title="Library actions · or right-click the deck"><MoreHorizontal/><span>Library</span></button></DropdownMenuTrigger>
  <DropdownMenuContent className="library-context-menu" side="top" align="end" sideOffset={12} collisionPadding={12} onPointerUpCapture={e=>{if(e.button!==0){e.preventDefault();e.stopPropagation();}}} onCloseAutoFocus={e=>{if(openingDialog.current){e.preventDefault();openingDialog.current=false;}}}>
   <DropdownMenuLabel>Library · {count} cards</DropdownMenuLabel>
   <DropdownMenuItem disabled={!count} onSelect={()=>onAction({type:'draw'})}><ArrowDownToLine/>Draw a card<kbd>D</kbd></DropdownMenuItem>
   <DropdownMenuSeparator/>
   <DropdownMenuItem onSelect={()=>dialog(onScry)}><Eye/>Scry…</DropdownMenuItem>
   <DropdownMenuItem onSelect={()=>dialog(onSurveil)}><Search/>Surveil…</DropdownMenuItem>
   <DropdownMenuItem disabled={!count} onSelect={()=>dialog(onLook)}><Eye/>Look at / reveal top X…</DropdownMenuItem>
   <DropdownMenuItem disabled={!count} onSelect={()=>dialog(onSearch)}><Search/>Search library…</DropdownMenuItem>
   <DropdownMenuItem disabled={!count} onSelect={()=>dialog(onExile)}><Eye/>Exile cards / permissions…</DropdownMenuItem>
   <DropdownMenuItem disabled={!count} onSelect={()=>onAction({type:'mill'})}><Layers/>Mill top card<kbd>M</kbd></DropdownMenuItem>
   <DropdownMenuSeparator/>
   <DropdownMenuItem disabled={!count} onSelect={()=>onAction({type:'shuffle'})}><Shuffle/>Shuffle<kbd>S</kbd></DropdownMenuItem>
   <DropdownMenuItem disabled={!count&&!handCount&&!battlefieldCount&&!graveyardCount&&!exileCount} onSelect={()=>onAction({type:'mulligan'})}><RotateCcw/>Mulligan · fresh 7</DropdownMenuItem>
  </DropdownMenuContent>
 </div></DropdownMenu>;
}
