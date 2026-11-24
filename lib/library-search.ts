import type {Card} from './game';
// A search is a catalogue, never a view of the library's current draw order.
export function librarySearchCards(cards:readonly Card[]):Card[]{
 return [...cards].sort((a,b)=>a.data.name.localeCompare(b.data.name,'en',{sensitivity:'base',numeric:true})||a.uid.localeCompare(b.uid));
}
