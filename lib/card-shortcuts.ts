import {playDestination,type Card,type Zone,type Action} from './game';
import {controller,playable} from './shared-cards';
export function cardShortcut(key:string,c:Card,zone:Zone,owner:string,actor:string):Action|undefined{
 const own=zone==='battlefield'?controller(c,owner)===actor:owner===actor;
 const movable=own||(zone==='battlefield'&&c.movePermission===actor);
 if(zone==='stack')return;
 if(key==='t'&&zone==='battlefield'&&own)return {type:'tap',uid:c.uid};
 if(key==='f'&&own&&c.data.backImage)return {type:'flip',uid:c.uid};
 if(key==='c'&&zone!=='battlefield'&&(own||playable(c,zone,actor))){const to=playDestination({...c,faceDown:false});if(!own&&c.permission?.kind==='cast'&&to==='battlefield')return;return {type:'move',uid:c.uid,to,faceDown:false};}
 const to=({g:'graveyard',e:'exile',h:'hand',b:'battlefield'} as const)[key as 'g'|'e'|'h'|'b'];
 if(to&&to!==zone&&movable&&(own||to!=='battlefield'))return {type:'move',uid:c.uid,to};
}
export function blockShortcuts(e:{repeat:boolean;isComposing:boolean;ctrlKey:boolean;metaKey:boolean;altKey:boolean},editing:boolean){return editing||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey;}
