'use client';
import {useState} from 'react';
import symbols from '@/lib/card-symbols.json';
function SymbolImage({token}:{token:string}){
 const [failed,setFailed]=useState(false),symbol=(symbols as Record<string,{image:string;english:string}>)[token];
 if(!symbol||failed)return <>{token}</>;
 return <img className="rules-symbol" src={symbol.image.replace(/^\//,'')} alt={token} title={symbol.english} width={18} height={18} draggable={false} onError={()=>setFailed(true)}/>;
}
export function RulesText({text}:{text:string}){return <>{text.split(/(\{[^{}\n]+\})/g).map((part,i)=>part.startsWith('{')?<SymbolImage key={i} token={part}/>:part)}</>;}
