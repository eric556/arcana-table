'use client';
import {Fragment,useRef,useState,type ReactNode} from 'react';
import {Crown,Plus,Minus,Eye,MoreHorizontal,Layers} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator} from '@/components/ui/dropdown-menu';
import {faceName,hasFaces,playDestination,type Card,type Action} from '@/lib/game';
export function CommanderTaxItems({card,onAction}:{card:Card;onAction:(a:Action)=>void}){
 const tax=card.commanderTax??0;
 return <><DropdownMenuLabel>Commander tax: +{tax} mana<small>Adjust manually after casting from command.</small></DropdownMenuLabel><DropdownMenuItem disabled={tax>=100000} onSelect={()=>onAction({type:'commanderTax',uid:card.uid,amount:2})}><Plus/>Increase tax by 2</DropdownMenuItem><DropdownMenuItem disabled={!tax} onSelect={()=>onAction({type:'commanderTax',uid:card.uid,amount:-2})}><Minus/>Decrease tax by 2</DropdownMenuItem></>;
}
export function CommandZoneMenu({children,cards,onAction,onBrowse}:{children:ReactNode;cards:Card[];onAction:(a:Action)=>void;onBrowse:()=>void}){
 const [open,setOpen]=useState(false),openingDialog=useRef(false);
 return <DropdownMenu open={open} onOpenChange={setOpen} modal={false}><div className="library-dock" onContextMenu={e=>{e.preventDefault();setOpen(true);}} onKeyDown={e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();setOpen(true);}}}>
 {children}<DropdownMenuTrigger asChild><button type="button" className="library-menu-button" aria-label="Command zone actions" title="Command zone actions · or right-click"><MoreHorizontal/><span>Command</span></button></DropdownMenuTrigger>
 <DropdownMenuContent className="library-context-menu command-context-menu" side="top" align="end" sideOffset={12} collisionPadding={12} onPointerUpCapture={e=>{if(e.button!==0){e.preventDefault();e.stopPropagation();}}} onCloseAutoFocus={e=>{if(openingDialog.current){e.preventDefault();openingDialog.current=false;}}}>
 <DropdownMenuLabel><Crown/> Command zone</DropdownMenuLabel>
 {cards.map(card=><Fragment key={card.uid}><DropdownMenuSeparator/><DropdownMenuLabel>{faceName(card)}</DropdownMenuLabel>{(hasFaces(card)?[false,true]:[false]).map(back=>{const face={...card,back,faceDown:false},to=playDestination(face);return <DropdownMenuItem key={String(back)} onSelect={()=>onAction({type:'move',uid:card.uid,to,back,faceDown:false})}><Layers/><span>{to==='stack'?'Cast':'Play'} {hasFaces(card)?faceName(face):'commander'}<small>{face.data.faces?.[back?1:0]?.mana??face.data.mana??''} · tax +{card.commanderTax??0}</small></span></DropdownMenuItem>;})}<CommanderTaxItems card={card} onAction={onAction}/></Fragment>)}
 {!cards.length&&<DropdownMenuLabel>No cards in the command zone</DropdownMenuLabel>}
 <DropdownMenuSeparator/><DropdownMenuItem onSelect={()=>{openingDialog.current=true;setOpen(false);onBrowse();}}><Eye/>View command zone</DropdownMenuItem>
 </DropdownMenuContent></div></DropdownMenu>;
}
