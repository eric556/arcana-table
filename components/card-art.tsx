'use client';
import { useEffect, useState } from 'react';
import { Hexagon } from 'lucide-react';
import { cachedArt, retryArt, subscribeArt } from '@/lib/cards';
import {activeType,faceName,type Card} from '@/lib/game';
export function CardArt({card:c,reveal=false,allowRetry=false}:{card:Card;reveal?:boolean;allowRetry?:boolean}){
 const src=c.back&&c.data.backImage?c.data.backImage:c.data.image;
 const [image,setImage]=useState<string|undefined>(src?.startsWith('/')?src:undefined);const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let live=true,attempt=0;
  const load=()=>{
   const current=++attempt;setFailed(false);setImage(undefined);
   if(src&&(!c.faceDown||reveal))cachedArt(src).then(v=>{if(live&&current===attempt)setImage(v);}).catch(()=>{if(live&&current===attempt)setFailed(true);});
  };
  load();
  const unsubscribe=src&&(!c.faceDown||reveal)?subscribeArt(src,load):undefined;
  return()=>{live=false;unsubscribe?.();};
 },[src,c.faceDown,reveal]);
 if(c.faceDown&&!reveal)return <div className="card-back"><Hexagon/><span>ARCANA</span><i/></div>;
 if(image&&!failed)return <img src={image} alt={faceName(c)} draggable={false} onError={()=>setFailed(true)}/>;
 const fallback=<div className={`card-fallback ${c.token?'token-art':''}`}><span>{c.token?'TOKEN':failed||!src?'ART UNAVAILABLE':'LOADING ART'}</span><Hexagon/><strong>{faceName(c)}</strong><small>{activeType(c)}</small>{c.token&&!!c.data.keywords?.length&&<span className="token-keywords">{c.data.keywords.join(', ')}</span>}{c.token&&c.data.text&&c.data.text!==c.data.keywords?.join(', ')&&<span className="token-ability-marker">Has abilities</span>}{c.data.power&&<b>{c.data.power}/{c.data.toughness}</b>}</div>;
 if(!allowRetry||!failed||!src)return fallback;
 return <div className="retryable-art">{fallback}<button type="button" className="art-retry" aria-label={`Retry artwork for ${faceName(c)}`} onClick={()=>{void retryArt(src).catch(()=>{});}}>Retry artwork</button></div>;
}
