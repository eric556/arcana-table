import {ZONES,type Format,type Player} from './game';

export type SavedSeat={code:string;token:string;player:Player;format:Format;connection?:{turnURL?:string;turnUser?:string;turnPassword?:string}};
type SeatStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
// This tab stores its seat credential and last rendered view.
// Reconnect replaces that view with a fresh authoritative host snapshot.
export function readSeat(storage:SeatStorage):SavedSeat|null {
  try{
    const s=JSON.parse(storage.getItem('arcana-seat')??'null');
    if(!s||! /^[a-f0-9]{16}$/.test(s.code)||typeof s.token!=='string'||s.token.length<20||typeof s.player?.id!=='string'||!ZONES.every(z=>Array.isArray(s.player.zones?.[z])))return null;
    return {...s,format:s.format==='60-card'?'60-card':s.format==='commander'?'commander':s.player.life===20?'60-card':'commander'};
  }catch{return null;}
}
export function saveSeat(storage:SeatStorage,seat:SavedSeat):void {
  // Do not swallow quota/storage errors: refreshing must stop if saving fails.
  storage.setItem('arcana-seat',JSON.stringify(seat));
  storage.removeItem(FRESH_START_KEY);
}

export const FRESH_START_KEY='arcana-fresh-start';
export function wantsFreshStart(storage:SeatStorage):boolean {try{return storage.getItem(FRESH_START_KEY)==='1';}catch{return false;}}
export function forgetRoom(session:SeatStorage,local:SeatStorage,options:{hostKey:string;hostCode?:string;seat?:{code:string;token:string}|null}):void {
 const seat=options.seat??readSeat(session);let failed=false;
 const attempt=(fn:()=>void)=>{try{fn();}catch{failed=true;}};
 // A guest may share this browser with an unrelated host tab. Forget only the
 // selected room; this tab's fresh-start marker suppresses other host recovery.
 attempt(()=>session.setItem(FRESH_START_KEY,'1'));
 for(const key of ['arcana-seat','arcana-rejoin-once','arcana-resume-host'])attempt(()=>session.removeItem(key));
 if(seat)attempt(()=>session.removeItem(`arcana-outbox-v9-${seat.code}-${seat.token}`));
 if(options.hostCode)attempt(()=>{const raw=local.getItem(options.hostKey);if(raw&&JSON.parse(raw)?.code===options.hostCode)local.removeItem(options.hostKey);});
 if(failed)throw new Error('This game was reset, but browser storage prevented clearing some recovery data.');
}
