'use client';
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Copy,Layers} from 'lucide-react';
import {tokenCount,type Card,type Action} from '@/lib/game';
export function TokenTools({card,onAction,onClose}:{card?:Card;onAction:(a:Action)=>void;onClose:()=>void}){
 const [quantity,setQuantity]=useState('1');const n=Number(quantity),valid=Number.isInteger(n)&&n>=1&&n<=9999,count=card?tokenCount(card):0;
 return <Dialog open={!!card} onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="arcana-dialog token-tools"><DialogHeader><DialogTitle>{card?.faceDown?'Face-down tokens':card?.data.name} · ×{count}</DialogTitle><DialogDescription>Move or tap a stack as one. Split it before changing individual tokens.</DialogDescription></DialogHeader>
 <label className="form-label">Number of tokens<input type="number" min="1" max="9999" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
 <button className="btn gold" disabled={!valid} onClick={()=>{if(card&&valid){onAction({type:'tokenCopy',uid:card.uid,count:n});onClose();}}}><Copy/>Create {valid?n:''} {n===1?'copy':'copies'}</button>
 <p className="token-field-hint">Creates a new stack, untapped and without counters. Name, power/toughness and abilities are copied.</p>
 <button className="btn quiet" disabled={!valid||n>=count} onClick={()=>{if(card&&valid&&n<count){onAction({type:'tokenSplit',uid:card.uid,count:n});onClose();}}}><Layers/>Split off {valid?n:''} · leave {valid?Math.max(0,count-n):count}</button>
 <p className="token-field-hint">Split tokens keep their counters, tapped state and attack assignment. Blocking a stack automatically separates one token; the rest stay grouped.</p>
 </DialogContent></Dialog>;
}
