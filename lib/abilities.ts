import {isRoom,type Card} from './game';

export type AbilityChoice = {label:string;text:string;kind:'Activated'|'Triggered'|'Text'};
export function faceText(card:Card):string {
  if(card.faceDown)return '';
  const face=card.data.faces?.[card.back?1:0];if(face)return face.text;
  const text=card.data.text??'',names=card.data.name.split(' // ');
  // Older cached multi-face records contain labelled paragraphs. Reuse those
  // rather than refetching a deck or mixing abilities from both faces.
  if(names.length>1){const name=names[card.back?1:0],start=text.indexOf(`${name}\n`);if(start>=0){const rest=text.slice(start+name.length+1);const end=rest.indexOf(`\n\n${names[1]}\n`);return end>=0?rest.slice(0,end):rest;}}
  return text;
}
export function faceType(card:Card):string {return card.data.faces?.[card.back?1:0]?.type??card.data.type;}
export function isAttachment(card:Card):boolean {return !card.faceDown&&/\b(Aura|Equipment|Fortification)\b/.test(faceType(card));}

// Suggestions from Oracle text, never an executable rules parser. Preserve the
// original paragraph and modal bullets so players can read and choose the effect.
export function abilityChoices(card:Card):AbilityChoice[] {
  const paragraphs:string[]=[];
  const text=isRoom(card)&&card.roomDoors!==undefined&&!card.faceDown?(card.data.faces??[]).filter((_,i)=>((card.roomDoors??0)&(1<<i))!==0).map(f=>f.text).join('\n'):faceText(card);
  for(const line of text.split(/\n+/).map(s=>s.trim()).filter(Boolean)){
    if(/^•/.test(line)&&paragraphs.length)paragraphs[paragraphs.length-1]+='\n'+line;
    else paragraphs.push(line);
  }
  return paragraphs.flatMap(text=>{
    const plain=text.replace(/\([^)]*\)/g,'').trim();
    const activated=/:/.test(plain)&&!/[“"].*:/.test(plain)||/^(Equip|Fortify|Cycling|Typecycling|Transmute|Unearth|Ninjutsu|Reinforce|Scavenge|Embalm|Eternalize|Level up|Outlast|Crew|Saddle)\b/i.test(plain);
    const triggered=/^(?:(?:[^—]+) — )?(When|Whenever|At)\b/i.test(plain);
    if(!activated&&!triggered)return [];
    return [{label:plain.split('\n')[0].slice(0,150),text,kind:activated?'Activated' as const:'Triggered' as const}];
  });
}
