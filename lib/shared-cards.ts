import {revealOwnedCards,cleanPosition,logEntry,act,activeType,faceName,publicPlayer,shuffle,uid,ZONES,type BoardPosition,type Action,type Card,type CardData,type Player,type Table,type TableTarget,type Zone} from './game';
export type PlayPermission={playerId:string;look:boolean;kind:'play'|'cast'|'none';note:string};
export type ExileOptions={moveToExile?:boolean;pile?:'owner'|'requester';count:number;faceDown:boolean;look:boolean;permission:'play'|'cast'|'none';note:string;mode:'top'|'nonland'|'spell';playerId:string};
export type ApprovedPlay={to:'battlefield'|'stack';position?:BoardPosition;target?:TableTarget;back?:boolean};
export type SharedRequest={kind?:'move'|'control'|'offerControl';approverId?:string;expectedControllerId?:string;position?:BoardPosition;afterApproval?:ApprovedPlay;id:string;ownerId:string;requesterId:string;source:Zone;cardId?:string;options:ExileOptions;approved?:boolean};
export type RemoteCardAction={id:string;ownerId:string;actorId:string;action:Action;target?:TableTarget};
export type SharedCommand={type:'offerControl';uid:string;recipientId:string}|{type:'requestControl';uid:string;position?:BoardPosition}|{type:'returnControl';uid:string}|{type:'requestMove';uid:string}|{type:'revokeMove';uid:string}|{type:'exileVisibility';uid:string;faceDown:boolean}|{type:'request';ownerId:string;source:Zone;cardId?:string;options:ExileOptions;afterApproval?:ApprovedPlay}|{type:'decide';id:string;approved:boolean}|{type:'cancel';id:string}|{type:'cardAction';uid:string;action:Action;target?:TableTarget};
export function findCard(t:Table,id:string){for(const p of t.players)for(const zone of ZONES){const c=p.zones[zone].find(c=>c.uid===id);if(c)return {card:c,ownerId:p.id,zone};}return undefined;}
export const controller=(c:Card,ownerId:string)=>c.controllerId??ownerId;
export const controlledCards=(t:Table,id:string)=>t.players.flatMap(p=>p.zones.battlefield.filter(c=>controller(c,p.id)===id));
export function exileSeat(c:Card,ownerId:string){return c.permission&&c.permission.kind!=='none'?c.permission.playerId:c.exilePileId??ownerId;}
export function exileHand(t:Table,viewer:Player){return t.players.flatMap(p=>(p.id===viewer.id?viewer.zones.exile:p.zones.exile).filter(c=>c.permission?.playerId===viewer.id&&c.permission.kind!=='none').map(c=>({card:hydratePrivate(c,p.id,viewer),owner:p.id})));}
export function projection(t:Table):Table {const result=structuredClone(t);for(const p of result.players){p.zones.battlefield=controlledCards(t,p.id).map(c=>({...c}));p.counts.battlefield=p.zones.battlefield.length;p.zones.exile=t.players.flatMap(owner=>owner.zones.exile.filter(c=>exileSeat(c,owner.id)===p.id));p.counts.exile=p.zones.exile.length;}return result;}
export function playable(c:Card,zone:Zone,id:string){return ['exile','graveyard'].includes(zone)&&c.permission?.playerId===id&&c.permission.kind!=='none';}
export function canRemote(t:Table,actorId:string,a:Action):boolean {
 if(!('uid' in a))return false;const f=findCard(t,a.uid);if(!f)return false;
 if(f.zone==='exile'&&f.card.permission?.playerId===actorId&&a.type==='faceDown')return true;
 if(f.zone==='battlefield'&&f.card.movePermission===actorId&&controller(f.card,f.ownerId)!==actorId)return a.type==='position'||a.type==='move'&&['battlefield','graveyard','exile','hand','library','command'].includes(a.to);
 if(playable(f.card,f.zone,actorId))return a.type==='move'&&['stack','battlefield'].includes(a.to);
 if(f.zone!=='battlefield'||controller(f.card,f.ownerId)!==actorId)return false;
 return ['tap','flip','faceDown','counter','namedCounter','position','progress','roomDoor','remove','commanderTax'].includes(a.type)||a.type==='move'&&['graveyard','exile','hand','library','command','battlefield'].includes(a.to);
}
function requestTargetExists(t:Table,target:TableTarget):boolean {
 return !!target&&typeof target==='object'&&t.players.some(p=>target.kind==='player'?p.id===target.ownerId:target.kind==='card'&&p.zones.battlefield.some(c=>c.uid===target.cardId&&controller(c,p.id)===target.ownerId));
}
export function applySharedCommand(table:Table,actor:string,raw:unknown):{table:Table;error?:string}{
 const reject=(error:string)=>({table,error});const p=table.players.find(p=>p.id===actor&&p.connected);if(!p||!raw||typeof raw!=='object')return reject('Reconnect before requesting cards.');const a=raw as SharedCommand;
 if(a.type==='offerControl'){
  const f=findCard(table,a.uid),recipient=table.players.find(p=>p.id===a.recipientId&&p.connected);
  if(!f||f.zone!=='battlefield'||controller(f.card,f.ownerId)!==actor)return reject('You may only offer a permanent you currently control.');
  if(!recipient||recipient.id===actor)return reject('Choose another connected player.');
  if((table.sharedRequests??[]).some(r=>r.kind==='offerControl'&&r.cardId===a.uid&&r.approverId===recipient.id))return reject('This player already has an offer for that card.');
  if((table.sharedRequests??[]).filter(r=>r.requesterId===actor).length>=8)return reject('Finish or cancel your existing requests first.');
  const t=structuredClone(table);(t.sharedRequests??=[]).push({id:uid(),kind:'offerControl',ownerId:f.ownerId,approverId:recipient.id,expectedControllerId:actor,requesterId:actor,source:'battlefield',cardId:a.uid,options:{count:1,faceDown:false,look:false,permission:'none',note:'Accept to take control; ownership stays with the original owner.',mode:'top',playerId:recipient.id}});return {table:t};
 }
 if(a.type==='requestControl'){
  const f=findCard(table,a.uid),current=f?controller(f.card,f.ownerId):undefined;
  if(!f||f.zone!=='battlefield'||current===actor||!table.players.find(p=>p.id===current)?.connected)return reject('Choose a permanent controlled by another connected player.');
  const position=a.position===undefined?undefined:cleanPosition(a.position);if(a.position!==undefined&&!position)return reject('Choose a position on your battlefield.');
  if((table.sharedRequests??[]).some(r=>r.kind==='control'&&r.cardId===a.uid&&r.requesterId===actor))return reject('Your control request is already waiting for approval.');
  if((table.sharedRequests??[]).filter(r=>r.requesterId===actor).length>=8)return reject('Finish your pending requests first.');
  const t=structuredClone(table);(t.sharedRequests??=[]).push({id:uid(),kind:'control',ownerId:f.ownerId,approverId:current,expectedControllerId:current,requesterId:actor,source:'battlefield',cardId:a.uid,position,options:{count:1,faceDown:false,look:false,permission:'none',note:'Control changes; ownership stays with the original owner.',mode:'top',playerId:actor}});return {table:t};
 }
 if(a.type==='requestMove'){
  const f=findCard(table,a.uid);if(!f||f.zone!=='battlefield'||f.ownerId===actor||!table.players.find(p=>p.id===f.ownerId)?.connected)return reject('Choose another player’s battlefield card while they are connected.');
  if(f.card.movePermission===actor)return reject('You already have permission to move this card.');
  if((table.sharedRequests??[]).some(r=>r.kind==='move'&&r.cardId===a.uid&&r.requesterId===actor))return reject('Your request is already waiting for approval.');
  if((table.sharedRequests??[]).filter(r=>r.requesterId===actor).length>=8)return reject('Finish your pending requests first.');
  const t=structuredClone(table);(t.sharedRequests??=[]).push({id:uid(),kind:'move',ownerId:f.ownerId,requesterId:actor,source:'battlefield',cardId:a.uid,options:{count:1,faceDown:false,look:false,permission:'none',note:'Move this card until permission is revoked or it leaves the battlefield.',mode:'top',playerId:actor}});return {table:t};
 }
 if(a.type==='request'){
  const owner=table.players.find(p=>p.id===a.ownerId&&p.connected),o=a.options;
  if(!owner||owner.id===actor||!o||!['library','graveyard','exile','battlefield'].includes(a.source)||!['top','nonland','spell'].includes(o.mode)||!['play','cast','none'].includes(o.permission)||o.moveToExile!==undefined&&typeof o.moveToExile!=='boolean'||o.pile!==undefined&&!['owner','requester'].includes(o.pile)||typeof o.faceDown!=='boolean'||typeof o.look!=='boolean'||typeof o.note!=='string'||o.note.length>240||!Number.isSafeInteger(o.count)||o.count<1||o.count>500)return reject('Choose a player, source, and valid number of cards.');
  if(a.source!=='library'&&!owner.zones[a.source].some(c=>c.uid===a.cardId))return reject('That card has moved.');
  let afterApproval:ApprovedPlay|undefined;
  if(a.afterApproval!==undefined){
   const play=a.afterApproval;
   if(!play||!['graveyard','exile'].includes(a.source)||!['battlefield','stack'].includes(play.to)||o.permission==='none'||o.moveToExile||play.back!==undefined&&typeof play.back!=='boolean')return reject('Invalid requested play.');
   const position=play.position===undefined?undefined:cleanPosition(play.position);
   if(play.position!==undefined&&(!position||play.to!=='battlefield'))return reject('Choose a battlefield position.');
   if(play.target!==undefined&&(play.to!=='stack'||!requestTargetExists(table,play.target)))return reject('That target has left the battlefield.');
   afterApproval={to:play.to,...(position?{position}:{}),...(play.target?{target:structuredClone(play.target)}:{}),...(play.back!==undefined?{back:play.back}:{})};
  }

  if(a.source==='library'&&!owner.counts.library)return reject('That library is empty.');
  if(a.source!=='library'&&(table.sharedRequests??[]).some(r=>r.requesterId===actor&&r.ownerId===owner.id&&r.source===a.source&&r.cardId===a.cardId))return reject('Your request for this card is already waiting for approval.');
  if((table.sharedRequests??[]).filter(r=>r.requesterId===actor).length>=8)return reject('Finish or cancel your existing requests first.');
  const t=structuredClone(table);(t.sharedRequests??=[]).push({id:uid(),ownerId:owner.id,requesterId:actor,source:a.source,cardId:a.source==='library'?undefined:a.cardId,...(afterApproval?{afterApproval}:{}),options:{...o,playerId:actor}});return {table:t};
 }
 if(a.type==='decide'||a.type==='cancel'){
  const request=table.sharedRequests?.find(r=>r.id===a.id);if(!request)return reject('This request is no longer pending.');
  if(a.type==='decide'?(request.approverId??request.ownerId)!==actor:request.requesterId!==actor)return reject('Only the relevant player may answer this request.');
  if(a.type==='decide'&&a.approved&&(request.kind==='control'||request.kind==='offerControl')){const f=findCard(table,request.cardId!);if(!f||f.zone!=='battlefield'||controller(f.card,f.ownerId)!==request.expectedControllerId)return reject('This permanent moved or changed controllers. Send a new control request.');}
  if(a.type==='decide'&&a.approved&&request.afterApproval){
   const f=findCard(table,request.cardId!);
   if(!f||f.ownerId!==request.ownerId||f.zone!==request.source)return reject('That card moved. Ask for a new play request.');
   if(request.afterApproval.target&&!requestTargetExists(table,request.afterApproval.target))return reject('The requested target moved. Ask for a new play request.');
  }
  if(request.approved)return reject('This request is being applied.');const t=structuredClone(table);
  if(a.type==='decide'&&a.approved)t.sharedRequests!.find(r=>r.id===a.id)!.approved=true;else t.sharedRequests=t.sharedRequests!.filter(r=>r.id!==a.id);return {table:t};
 }
 if(a.type==='cardAction'){
  if(!a.action||!('uid' in a.action)||a.action.uid!==a.uid||!canRemote(table,actor,a.action))return reject('Ask the owner for permission to play this card first.');
  if(a.target&&!(a.target.kind==='player'&&table.players.some(p=>p.id===a.target!.ownerId)||a.target.kind==='card'&&table.players.some(p=>p.zones.battlefield.some(c=>c.uid===(a.target as {cardId:string}).cardId&&controller(c,p.id)===a.target!.ownerId))))return reject('That target has left the battlefield.');
  const f=findCard(table,a.uid)!;
  if((table.remoteActions??[]).some(r=>'uid' in r.action&&r.action.uid===a.uid))return reject('Wait for this card’s current move to finish.');
  const t=structuredClone(table);(t.remoteActions??=[]).push({id:uid(),ownerId:f.ownerId,actorId:actor,action:structuredClone(a.action),target:a.target?structuredClone(a.target):undefined});return {table:t};
 }
 return reject('Unknown shared-card action.');
}
export function exileCards(player:Player,ids:string[],options:ExileOptions):Player {
 let p=player;const group=uid();for(const id of ids){p=act(p,{type:'move',uid:id,to:'exile',faceDown:options.faceDown}).player;const c=p.zones.exile.find(c=>c.uid===id);if(c){if(!c.faceDown)revealOwnedCards(p,[c.uid]);else if(p.revealed)p.revealed.targets=p.revealed.targets.filter(x=>x.uid!==c.uid);c.permission={playerId:options.playerId,look:options.look,kind:options.permission,note:options.note};c.exileGroup=group;c.exileNote=options.note;c.exilePileId=options.pile==='requester'?options.playerId:undefined;}}
 return p;
}
export function exileLibrary(player:Player,o:ExileOptions):Player {
 let ids=player.zones.library.slice(0,o.count).map(c=>c.uid);
 if(o.mode!=='top') {const i=player.zones.library.findIndex(c=>o.mode==='nonland'?!/\bLand\b/.test(activeType(c)):/\bInstant\b|\bSorcery\b/.test(c.data.type+' '+(c.data.faces??[]).map(f=>f.type).join(' ')));ids=player.zones.library.slice(0,i<0?player.zones.library.length:i+1).map(c=>c.uid);}
 let p=exileCards(player,ids,o);
 // Wand of Wonder keeps only the matching card exiled; the preceding cards
 // are shuffled back without broadcasting their identities.
 if(o.mode==='spell'){
  const match=ids.length?player.zones.library.find(c=>c.uid===ids.at(-1)):undefined;
  const keep=match&&/\bInstant\b|\bSorcery\b/.test(match.data.type+' '+(match.data.faces??[]).map(f=>f.type).join(' '))?match.uid:undefined;
  const returned=ids.filter(id=>id!==keep);if(returned.length)p=act(p,{type:'moveMany',moves:returned.map(uid=>({uid,to:'library'}))}).player;
  p=act(p,{type:'shuffle'}).player;
 }
 return p;
}
export function applySharedPending(player:Player,t:Table):Player|undefined {
 const requests=(t.sharedRequests??[]).filter(r=>r.ownerId===player.id&&r.approved),actions=(t.remoteActions??[]).filter(r=>r.ownerId===player.id);if(!requests.length&&!actions.length)return;
 let p=player;const done=new Set(p.completedShared??[]);
 for(const r of requests){if(done.has(r.id))continue;p=structuredClone(p);
  if(r.kind==='control'||r.kind==='offerControl'){const c=p.zones.battlefield.find(c=>c.uid===r.cardId);if(c&&controller(c,p.id)===r.expectedControllerId){setPermanentController(c,p.id,r.options.playerId,t,r.position);}}
  else if(r.kind==='move'){const c=p.zones.battlefield.find(c=>c.uid===r.cardId);if(c)c.movePermission=r.requesterId;}
  else if(r.source==='library')p=exileLibrary(p,r.options);
  else {const c=p.zones[r.source].find(c=>c.uid===r.cardId);if(c){if(r.source==='battlefield'||r.options.moveToExile)p=exileCards(p,[c.uid],r.options);else {c.permission={playerId:r.requesterId,look:r.options.look,kind:r.options.permission,note:r.options.note};if(r.source==='exile'){c.exilePileId=r.options.pile==='requester'?r.requesterId:undefined;c.faceDown=r.options.faceDown;if(!c.faceDown)revealOwnedCards(p,[c.uid]);else if(p.revealed)p.revealed.targets=p.revealed.targets.filter(x=>x.uid!==c.uid);}}}}
  if(r.afterApproval&&p.zones[r.source].some(c=>c.uid===r.cardId)){
   const play=r.afterApproval;
   p=act(p,{type:'move',uid:r.cardId!,to:play.to,faceDown:false,back:play.back,position:play.position}).player;
   const moved=p.zones[play.to].find(c=>c.uid===r.cardId);
   if(moved){moved.controllerId=r.requesterId;if(play.to==='battlefield')t.log.unshift(logEntry(`${t.players.find(x=>x.id===r.requesterId)?.name??'A player'} played ${faceName(moved)} from ${r.source} onto their battlefield with the owner’s approval.`));}
  }
  done.add(r.id);
 }
 for(const r of actions){if(done.has(r.id))continue;
  const current=structuredClone(t);current.players=current.players.map(x=>x.id===p.id?publicPlayer(p):x);
  if(canRemote(current,r.actorId,r.action)){
   const a=r.action;if(a.type==='move'){
    const f=findCard(current,a.uid)!;const casting=playable(f.card,f.zone,r.actorId);
    const actual=ZONES.flatMap(z=>p.zones[z]).find(c=>c.uid===a.uid)!;
    // Land/cast distinctions are checked using the private identity, never
    // exposed to other players merely to validate the choice.
    const face={...actual,back:typeof a.back==='boolean'?a.back:actual.back,faceDown:false};
    if(casting&&(a.to==='battlefield'&&!/\bLand\b/.test(activeType(face))||a.to==='battlefield'&&actual.permission?.kind==='cast')){done.add(r.id);continue;}
    p=act(p,{...a,...(casting?{faceDown:false}:{})}).player;
    const moved=p.zones[a.to].find(c=>c.uid===a.uid);if(moved&&['stack','battlefield'].includes(a.to)&&casting)moved.controllerId=r.actorId;
   }else p=act(p,a).player;
  }done.add(r.id);
 }
 p={...p,completedShared:[...done].slice(-512)};return p;
}
export function acknowledgeShared(t:Table,owner:string,ids:string[]){const done=new Set(ids);t.sharedRequests=(t.sharedRequests??[]).filter(r=>r.ownerId!==owner||!done.has(r.id));t.remoteActions=(t.remoteActions??[]).filter(r=>r.ownerId!==owner||!done.has(r.id));}
export function hydratePrivate(c:Card,ownerId:string,viewer:Player):Card {if(ownerId===viewer.id){const own=ZONES.flatMap(z=>viewer.zones[z]).find(x=>x.uid===c.uid);return own?{...c,data:own.data}:c;}const data=viewer.privateCards?.[`${ownerId}:${c.uid}`];return c.faceDown&&(c.permission?.look&&c.permission.playerId===viewer.id||c.controllerId===viewer.id)&&data?{...c,data}:c;}
export function privateViews(p:Player){return ZONES.flatMap(z=>p.zones[z]).filter(c=>c.faceDown&&(c.permission?.look&&c.permission.playerId!==p.id||c.controllerId&&c.controllerId!==p.id)).map(c=>({to:c.controllerId??c.permission!.playerId,uid:c.uid,data:c.data}));}

export function setPermanentController(c:Card,ownerId:string,next:string,t:Table,position?:BoardPosition):void {
 if(next===ownerId)delete c.controllerId;else c.controllerId=next;
 delete c.movePermission;delete c.position;delete c.layer;if(position)c.position=position;
 // A change of control removes a permanent from combat, even when it returns
 // to the active player during that same combat.
 const affected=new Set([...t.combat.attacks.filter(a=>a.cardId===c.uid||a.targetCardId===c.uid).map(a=>a.targetId),...t.combat.blocks.filter(b=>b.cardId===c.uid||b.attackerCardId===c.uid).map(b=>b.blockerId)]);
 t.combat.defendersDone=(t.combat.defendersDone??[]).filter(id=>!affected.has(id));
 t.combat.attacks=t.combat.attacks.filter(a=>a.cardId!==c.uid);
 t.combat.blocks=t.combat.blocks.filter(b=>b.cardId!==c.uid&&b.attackerCardId!==c.uid);
 for(const attachment of t.attachments){if(attachment.cardId===c.uid)attachment.ownerId=next;if(attachment.target.kind==='card'&&attachment.target.cardId===c.uid)attachment.target.ownerId=next;}
 for(const entry of t.stack.entries)for(const target of entry.targets??[])if(target.kind==='card'&&target.cardId===c.uid)target.ownerId=next;
 t.log.unshift(logEntry(`${t.players.find(p=>p.id===next)?.name??'A player'} took control of ${c.faceDown?'a face-down permanent':faceName(c)}.`));
}
