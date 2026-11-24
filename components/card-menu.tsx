'use client';
import {RulesText} from './rules-text';
import {CommanderTaxItems} from './command-zone-menu';
import {useRef,useState} from 'react';
import {Skull,Sun,ArrowDownToLine,ArrowUp,ArrowDown,Crown,Layers,Eye,EyeOff,RotateCw,MoreHorizontal,Plus,Minus,X as XIcon} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuSub,DropdownMenuSubTrigger,DropdownMenuSubContent} from '@/components/ui/dropdown-menu';
import {tokenCount,faceName,faceLabel,hasFaces,progressInfo,roman,playDestination,type Card,type Zone,type Action} from '@/lib/game';
export type CardMenuPoint={x:number;y:number;source?:HTMLElement};
export function CardMenu({controlRecipients,onOfferControl,onControlRequest,onReturnControl,onTokens,card,zone,own=true,point,onClose,onAction,onInspect,onStack,canPlay=false,castOnly=false,onAccess,onRevoke,onMoveRequest,onRevokeMove,canMove=false,onReveal}:{controlRecipients?:{id:string;name:string}[];onOfferControl?:(id:string)=>void;onControlRequest?:()=>void;onReturnControl?:()=>void;onTokens?:(card:Card)=>void;card:Card;zone:Zone;own?:boolean;point?:CardMenuPoint;onClose?:()=>void;onAction:(a:Action)=>void;onInspect?:()=>void;onStack?:()=>void;canPlay?:boolean;castOnly?:boolean;onAccess?:()=>void;onRevoke?:()=>void;onMoveRequest?:()=>void;onRevokeMove?:()=>void;canMove?:boolean;onReveal?:()=>void}){
 const [open,setOpen]=useState(false),skipFocus=useRef(false);
 const run=(fn:()=>void)=>{skipFocus.current=true;setOpen(false);onClose?.();fn();};
 const progress=zone==='battlefield'?progressInfo(card):null;
 const castFace=(back:boolean)=>run(()=>onAction({type:'move',uid:card.uid,to:playDestination({...card,back,faceDown:false}),back,faceDown:false}));
 const move=(to:Zone,bottom=false)=>run(()=>onAction({type:'move',uid:card.uid,to,bottom}));
 return <DropdownMenu open={point?true:open} onOpenChange={value=>{setOpen(value);if(!value)onClose?.();}} modal={false}>
  <DropdownMenuTrigger asChild>{point?<button className="card-menu-anchor" tabIndex={-1} aria-hidden="true" style={{left:point.x,top:point.y}}/>:<button className="btn quiet card-quick-actions" aria-label={`Quick actions for ${faceName(card)}`}><MoreHorizontal/>Quick actions</button>}</DropdownMenuTrigger>
  <DropdownMenuContent className="library-context-menu card-context-menu" aria-label={`Actions for ${faceName(card)}`} side="bottom" align="start" sideOffset={3} collisionPadding={10} onPointerUpCapture={e=>{if(e.button!==0){e.preventDefault();e.stopPropagation();}}} onCloseAutoFocus={e=>{if(point||skipFocus.current){e.preventDefault();if(!skipFocus.current&&point?.source?.isConnected)point.source.focus({preventScroll:true});skipFocus.current=false;}}}>
   <DropdownMenuLabel>{faceName(card)}{!own&&<small>{canPlay?'Owner approved play permission':'Opponent’s card'}</small>}</DropdownMenuLabel>
   {own&&zone==='hand'&&<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'revealCards',ids:[card.uid]}))}><Eye/>Reveal to table</DropdownMenuItem>}
   {own&&zone==='hand'&&<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'hideCards',ids:[card.uid]}))}><EyeOff/>Stop revealing this card</DropdownMenuItem>}
   {own&&zone!=='stack'&&!(zone==='exile'&&card.permission?.kind&&card.permission.kind!=='none')&&<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'playableExile',uid:card.uid}))}><Sun/>Move to playable exile</DropdownMenuItem>}
   {zone==='exile'&&(own||canPlay)&&card.permission?.kind&&card.permission.kind!=='none'&&<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'endExilePlay',uid:card.uid}))}><Sun/>Return to owner’s regular exile</DropdownMenuItem>}
   {(own||canPlay)&&zone!=='stack'&&<>
    {zone==='battlefield'?<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'tap',uid:card.uid}))}><RotateCw/>{card.tapped?'Untap':'Tap'}<kbd>T</kbd></DropdownMenuItem>:hasFaces(card)&&card.data.id!=='hidden'?<>
     {[false,true].map(back=>{const face={...card,back},land=playDestination(face)==='battlefield';return <DropdownMenuItem key={String(back)} disabled={castOnly&&land} className="cast-face-menu-item" aria-label={`${land?'Play':'Cast'} ${faceName(face)}`} onSelect={()=>castFace(back)}><Layers/><span><strong>{land?'Play':'Cast'} {faceName(face)}</strong><small>{faceLabel(card,back)}{face.data.faces?.[back?1:0]?.mana&&<> · <RulesText text={face.data.faces[back?1:0].mana!}/></>}</small></span></DropdownMenuItem>;})}
    </>:<DropdownMenuItem disabled={castOnly&&playDestination({...card,faceDown:false})==='battlefield'} onSelect={()=>castFace(card.back)}><Layers/>{playDestination(card)==='stack'?(zone==='command'?'Cast commander':'Cast this face'):'Play land'}<kbd>C</kbd></DropdownMenuItem>}
    {own&&card.data.backImage&&<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'flip',uid:card.uid}))}><RotateCw/>Flip card<kbd>F</kbd></DropdownMenuItem>}
    {own&&progress&&<><DropdownMenuItem disabled={progress.value>=progress.max} onSelect={()=>run(()=>onAction({type:'progress',uid:card.uid,value:progress.value+1}))}><ArrowUp/>{progress.kind==='saga'?`Advance to chapter ${roman(progress.value+1)}`:`Level up to ${progress.value+1}`}</DropdownMenuItem><DropdownMenuItem disabled={progress.value<=progress.min} onSelect={()=>run(()=>onAction({type:'progress',uid:card.uid,value:progress.value-1}))}><ArrowDown/>{progress.kind==='saga'?'Remove a lore counter':'Go down one level'}</DropdownMenuItem></>}
    {own&&<>
    <DropdownMenuSeparator/>
    {zone!=='graveyard'&&<DropdownMenuItem onSelect={()=>move('graveyard')}><Skull/>Send to graveyard<kbd>G</kbd></DropdownMenuItem>}
    {zone!=='exile'&&<DropdownMenuItem onSelect={()=>move('exile')}><Sun/>Exile<kbd>E</kbd></DropdownMenuItem>}
    {zone!=='hand'&&<DropdownMenuItem onSelect={()=>move('hand')}><ArrowDownToLine/>Return to hand<kbd>H</kbd></DropdownMenuItem>}
    {zone!=='battlefield'&&<DropdownMenuItem onSelect={()=>move('battlefield')}><Layers/>Move to battlefield<kbd>B</kbd></DropdownMenuItem>}
    <DropdownMenuItem onSelect={()=>move('library')}><ArrowUp/>Put on top of library</DropdownMenuItem>
    <DropdownMenuItem onSelect={()=>move('library',true)}><ArrowDown/>Put on bottom of library</DropdownMenuItem>
    {zone!=='command'&&<DropdownMenuItem onSelect={()=>move('command')}><Crown/>Move to command zone</DropdownMenuItem>}
    <DropdownMenuItem onSelect={()=>run(()=>onAction({type:'faceDown',uid:card.uid}))}><EyeOff/>{card.faceDown?'Turn face up':'Turn face down'}</DropdownMenuItem>
    {zone!=='battlefield'&&<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'move',uid:card.uid,to:'stack',faceDown:true}))}><EyeOff/>Cast face down</DropdownMenuItem>}
    {zone!=='exile'&&<DropdownMenuItem onSelect={()=>run(()=>onAction({type:'move',uid:card.uid,to:'exile',faceDown:true}))}><EyeOff/>Exile face down</DropdownMenuItem>}
    </>}
    <DropdownMenuSeparator/>
   </>}
   {zone==='battlefield'&&own&&<><DropdownMenuSeparator/><DropdownMenuItem onSelect={()=>run(()=>onAction({type:'namedCounter',uid:card.uid,name:'+1/+1',amount:1}))}><Plus/>Add +1/+1 counter</DropdownMenuItem><DropdownMenuItem disabled={!(card.namedCounters?.['+1/+1']??0)} onSelect={()=>run(()=>onAction({type:'namedCounter',uid:card.uid,name:'+1/+1',amount:-1}))}><Minus/>Remove +1/+1 counter</DropdownMenuItem>{onInspect&&<DropdownMenuItem onSelect={()=>run(onInspect)}><Layers/>Manage counters…</DropdownMenuItem>}</>}
   {zone==='battlefield'&&(own||canMove)&&<DropdownMenuSub><DropdownMenuSubTrigger><Layers/>Layer</DropdownMenuSubTrigger><DropdownMenuSubContent className="library-context-menu">{([['front','Bring to front'],['forward','Bring forward'],['backward','Send backward'],['back','Send to back']] as const).map(([direction,label])=><DropdownMenuItem key={direction} onSelect={()=>run(()=>onAction({type:'layer',uid:card.uid,direction}))}>{label}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>}
   {own&&card.token&&zone==='battlefield'&&<><DropdownMenuSeparator/><DropdownMenuItem onSelect={()=>run(()=>onAction({type:'tokenCopy',uid:card.uid,count:1}))}><Layers/>Copy token</DropdownMenuItem>{onTokens&&<DropdownMenuItem onSelect={()=>run(()=>onTokens(card))}><Layers/>Copy / split tokens… ({tokenCount(card)})</DropdownMenuItem>}</>}
   {own&&(zone==='command'||card.commanderTax!==undefined)&&<CommanderTaxItems card={card} onAction={a=>run(()=>onAction(a))}/>}
   {zone==='battlefield'&&own&&onOfferControl&&!!controlRecipients?.length&&<DropdownMenuSub><DropdownMenuSubTrigger><Layers/>Offer control to…</DropdownMenuSubTrigger><DropdownMenuSubContent className="library-context-menu"><DropdownMenuLabel>They must accept first</DropdownMenuLabel>{controlRecipients.map(p=><DropdownMenuItem key={p.id} onSelect={()=>run(()=>onOfferControl(p.id))}>{p.name}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>}
   {onControlRequest&&<DropdownMenuItem onSelect={()=>run(onControlRequest)}><Layers/>Ask to take control</DropdownMenuItem>}
   {onReturnControl&&<DropdownMenuItem onSelect={()=>run(onReturnControl)}><Layers/>Return control to owner</DropdownMenuItem>}
   {onMoveRequest&&!own&&!canMove&&zone==='battlefield'&&<DropdownMenuItem onSelect={()=>run(onMoveRequest)}><Layers/>Ask to move this card</DropdownMenuItem>}
   {canMove&&!own&&zone==='battlefield'&&<><DropdownMenuLabel>Owner allowed you to move this card</DropdownMenuLabel><DropdownMenuItem onSelect={()=>move('graveyard')}><Skull/>Send to owner’s graveyard</DropdownMenuItem><DropdownMenuItem onSelect={()=>move('exile')}><Sun/>Exile<kbd>E</kbd></DropdownMenuItem><DropdownMenuItem onSelect={()=>move('hand')}><ArrowDownToLine/>Return to owner’s hand</DropdownMenuItem></>}
   {onRevokeMove&&<DropdownMenuItem onSelect={()=>run(onRevokeMove)}><XIcon/>Stop sharing movement</DropdownMenuItem>}
   {onReveal&&!own&&<DropdownMenuItem onSelect={()=>run(onReveal)}><Eye/>{card.faceDown?'Reveal to everyone':'Turn face down'}</DropdownMenuItem>}
   {onAccess&&['library','battlefield','exile','graveyard'].includes(zone)&&<DropdownMenuItem onSelect={()=>run(onAccess)}><Sun/>{own?'Exile / share this card…':canPlay?'Change access…':zone==='battlefield'?'Ask to exile this card…':'Ask to play this card…'}</DropdownMenuItem>}
   {onRevoke&&<DropdownMenuItem onSelect={()=>run(onRevoke)}><XIcon/>End play / look permission</DropdownMenuItem>}
   {zone==='stack'&&onStack&&<DropdownMenuItem onSelect={()=>run(onStack)}><Layers/>Open shared stack</DropdownMenuItem>}
   {onInspect&&<DropdownMenuItem onSelect={()=>run(onInspect)}><Eye/>Card details<kbd>V</kbd></DropdownMenuItem>}
  </DropdownMenuContent>
 </DropdownMenu>;
}
