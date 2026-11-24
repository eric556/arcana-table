import type {Zone} from "./game";
export type DeckLine={name:string;count:number;zone:Zone};
export function parseDeck(input:string):DeckLine[]{
  if(input.length>100000)throw new Error("This deck list is too large.");
  let zone:Zone="library";const result:DeckLine[]=[];const bad:string[]=[];
  for(const raw of input.split(/\r?\n/)){let line=raw.trim();if(!line)continue;const heading=line.replace(/^[/#\s]+/,"").replace(/[:\s]+$/,"").toLowerCase();
    if(["commander","commanders","command zone"].includes(heading)){zone="command";continue;}
    if(["deck","mainboard","main deck","maindeck"].includes(heading)){zone="library";continue;}
    if(["sideboard","companion"].includes(heading)){zone="sideboard";continue;}
    if(["maybeboard","considering"].includes(heading)){zone="exile";continue;}
    if(line.startsWith("//")||line.startsWith("#"))continue;
    const m=line.match(/^(?:(SB):\s*)?(\d+)x?\s+(.+)$/i);if(!m){bad.push(line);continue;}
    const count=Number(m[2]);if(!count||count>250){bad.push(line);continue;}
    let name=m[3];const isCommander=/\*CMDR\*/i.test(name);name=name.replace(/\s*\*[^*]+\*/g,"").replace(/\s+\[[^\]]+\].*$/,"").replace(/\s+\([A-Za-z0-9_]+\)(?:\s+\S+)?(?:\s+.*)?$/,"").trim();
    // Exports may use one slash for DFCs, Adventures and Rooms; Scryfall uses two.
    // Normalize before lookup so request names, response matching and cache keys agree.
    name=name.replace(/\s*\/{1,2}\s*/g," // ");
    if(zone!=="exile")result.push({name,count,zone:isCommander?"command":m[1]?"sideboard":zone});
  }
  if(bad.length)throw new Error(`Could not read: ${bad.slice(0,3).join("; ")}. Use one card per line, like “1 Sol Ring”.`);
  if(!result.length)throw new Error("Paste a deck list with quantities and card names.");
  if(result.reduce((n,c)=>n+c.count,0)>500)throw new Error("Decks can contain up to 500 cards, including sideboard.");
  return result;
}
