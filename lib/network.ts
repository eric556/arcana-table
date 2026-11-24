import type {Peer,DataConnection} from 'peerjs';
import {uid,logEntry,type Player,type Table,type Format,type Action,type Zone,type CombatGesture} from './game';
import type {StackCommand} from './stack';
import type {SharedCommand} from './shared-cards';
import {createAuthority,importPlayer,refresh,reduceCommand,snapshot,type Authority,type Envelope,type RoomCommand,type Snapshot} from './authority';
export type NetworkOptions={turnURL?:string;turnUser?:string;turnPassword?:string};
export const ROOM_PROTOCOL=9;
export const COMMAND_ACK_TIMEOUT_MS=20000;
export const HOST_KEY='arcana-host-room-v9';
export type HostCheckpoint={protocol:9;code:string;room:Authority;seats:[string,string][];options:NetworkOptions};
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function readHost(storage:StorageLike):HostCheckpoint|null {try{const c=JSON.parse(storage.getItem(HOST_KEY)??'null');return c?.protocol===ROOM_PROTOCOL&&/^[a-f0-9]{16}$/.test(c.code)&&c.room?.hostId&&Array.isArray(c.room.players)&&Array.isArray(c.seats)?c:null;}catch{return null;}}
export class RoomVersionError extends Error {
 readonly code='ROOM_VERSION_MISMATCH';readonly updateSide:'host'|'guest'|'both';
 constructor(readonly hostProtocol?:number,readonly guestProtocol=ROOM_PROTOCOL){super('This room uses a different Arcana version. Refresh all players and start a new room on the latest version.');this.name='RoomVersionError';this.updateSide=hostProtocol===undefined?'both':hostProtocol<guestProtocol?'host':'guest';}
}
export class RoomNetwork {
 peer?:Peer;connections=new Map<string,DataConnection>();seats=new Map<string,string>();table?:Table;isHost=false;ownId='';code='';closed=false;connection?:DataConnection;
 private room?:Authority;private options:NetworkOptions={};private localPlayer?:Player;
 private epoch='';private received=-1;private outbox:Envelope[]=[];private nextSequence=1;private journalKey='';private retry?:ReturnType<typeof setInterval>;
 private waiters=new Map<string,{resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();private seenReceipts=new Set<string>();
 constructor(private onTable:(t:Table)=>void,private onStatus:(s:string)=>void,private onIdentity:(id:string)=>void,private onError:(s:string)=>void,private onPlayer?:(p:Player)=>void,private storage?:StorageLike,private journal?:StorageLike){}
 // Reject UI waits without discarding journaled commands: reconnect can replay
 // the same sequence exactly once, even if only the acknowledgement was lost.
 private finishWaiter(id:string,error?:Error){const w=this.waiters.get(id);if(!w)return;clearTimeout(w.timer);this.waiters.delete(id);if(error)w.reject(error);else w.resolve();}
 private rejectWaiters(message:string){for(const id of this.waiters.keys())this.finishWaiter(id,new Error(message));}
 get hasPendingDeck(){return this.outbox.some(e=>e.command.kind==='deck');}
 private hostStorage(){return this.storage??localStorage;}
 private clientStorage(){return this.journal??sessionStorage;}
 private persist(room:Authority,seats=this.seats){this.hostStorage().setItem(HOST_KEY,JSON.stringify({protocol:ROOM_PROTOCOL,code:this.code,room,seats:[...seats],options:this.options}));}
 private saveOutbox(outbox=this.outbox,nextSequence=this.nextSequence){this.clientStorage().setItem(this.journalKey,JSON.stringify({outbox,nextSequence,epoch:this.epoch}));}
  async makePeer(id:string|undefined,options:NetworkOptions){const {Peer}=await import('peerjs');const iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];if(options.turnURL)iceServers.push({urls:options.turnURL,username:options.turnUser,credential:options.turnPassword});const peer=id?new Peer(id,{debug:0,config:{iceServers}}):new Peer({debug:0,config:{iceServers}});this.peer=peer;
    peer.on('error',e=>{if(!this.closed){this.onStatus('Connection issue');this.onError(e.type==='unavailable-id'?'This room is still hosted in another tab. Close that host tab, wait a moment, and resume again.':e.type==='peer-unavailable'?'The host could not be found. Check the table code and ask the host to keep their tab open.':'Could not connect. Some networks need a TURN relay; open Connection settings to configure one.');}});
    peer.on('disconnected',()=>{if(!this.closed){this.onStatus('Reconnecting signaling…');try{peer.reconnect();}catch{}}});
    return new Promise<Peer>((resolve,reject)=>{const timeout=setTimeout(()=>{peer.destroy();reject(new Error('Connection timed out. Check your connection or try a TURN relay in Connection settings.'));},15000);peer.once('open',()=>{clearTimeout(timeout);resolve(peer);});peer.once('error',e=>{clearTimeout(timeout);reject(e);});});
  }
 async host(p:Player,format:Format,options:NetworkOptions={},resume?:HostCheckpoint){
  this.isHost=true;this.ownId=resume?.room.hostId??p.id;this.code=resume?.code??uid().replaceAll('-','').slice(0,16);this.options=resume?.options??options;
  this.room=resume?structuredClone(resume.room):createAuthority(p,format);this.seats=new Map(resume?.seats??[]);
  this.room.table.players.forEach(p=>p.connected=p.id===this.ownId);this.room.revision++;
  this.onStatus(resume?'Resuming hosted room…':'Opening table…');const peer=await this.makePeer(`arcana-${this.code}`,this.options);
  if(this.closed){peer.destroy();throw new Error('Connection canceled.');}try{this.persist(this.room);}catch{peer.destroy();throw new Error('Could not save the hosted room. Free browser storage and try again.');}peer.on('connection',c=>this.accept(c));this.onIdentity(this.ownId);this.onStatus('Hosting');this.broadcast();return this.code;
 }
 private accept(c:DataConnection){let bound:string|undefined;let messages=0,windowStart=Date.now();const timer=setTimeout(()=>{if(!bound)c.close();},10000);
  c.on('data',raw=>{if(this.closed)return;try{
   if(typeof raw!=='string'||raw.length>4000000)return;const m=JSON.parse(raw);
   if(Date.now()-windowStart>60000){windowStart=Date.now();messages=0;}if(++messages>1000){c.close();return;}
   if(m.type==='hello'&&!bound){
    if(m.protocol!==ROOM_PROTOCOL){c.send(JSON.stringify({type:'error',code:'ROOM_VERSION_MISMATCH',hostProtocol:ROOM_PROTOCOL,message:new RoomVersionError().message}));return;}
    if(typeof m.token!=='string'||m.token.length<20||m.token.length>100)return;
    const seats=new Map(this.seats);let id=seats.get(m.token);const previous=id?this.connections.get(id):undefined;
    if(previous?.open&&!m.reclaim){c.send(JSON.stringify({type:'error',message:'This seat is already connected. Use Reconnect saved seat to replace that connection.'}));return;}
    const room=structuredClone(this.room!);
    if(!id){if(room.players.length>=4){c.send(JSON.stringify({type:'error',message:'This table is full (4 players).'}));return;}id=uid();const p=importPlayer(m.player,id,room.table.format);room.players.push(p);room.sequences[id]=0;seats.set(m.token,id);room.table.log.unshift(logEntry(`${p.name} joined the table.`));refresh(room);}
    room.table.players.find(p=>p.id===id)!.connected=true;room.revision++;this.persist(room,seats);this.room=room;this.seats=seats;bound=id;clearTimeout(timer);this.connections.set(id,c);
    if(previous&&previous!==c){try{previous.send(JSON.stringify({type:'seatReplaced'}));}catch{}setTimeout(()=>previous.close(),250);}
    c.send(JSON.stringify({type:'welcome',id,protocol:ROOM_PROTOCOL}));this.broadcast();return;
   }
   if(!bound||this.connections.get(bound)!==c)return;
   if(m.type==='command')this.receive(bound,m.envelope,c);
   if(m.type==='sync')this.sendSnapshot(bound,c);
   // Seat snapshots sent by clients have no authority and are never applied.
  }catch(e){try{c.send(JSON.stringify({type:bound?'commandError':'error',message:e instanceof Error?e.message:'Invalid room message.'}));}catch{}}});
  c.on('close',()=>{clearTimeout(timer);if(!this.closed&&bound&&this.connections.get(bound)===c){this.connections.delete(bound);const room=structuredClone(this.room!);const p=room.table.players.find(p=>p.id===bound);if(p){p.connected=false;room.revision++;try{this.persist(room);this.room=room;this.broadcast();}catch{this.onError('Could not save the room. Free browser storage before continuing.');}}}});c.on('error',()=>{});
 }
 async join(code:string,p:Player,token:string,options:NetworkOptions={},reclaim=false){
  this.code=code.trim().replace(/^arcana-/,'');if(!/^[a-f0-9]{16}$/.test(this.code))throw new Error('Enter the 16-character table code from your host.');this.localPlayer=p;
  this.journalKey=`arcana-outbox-v9-${this.code}-${token}`;
  const saved=JSON.parse(this.clientStorage().getItem(this.journalKey)??'null');if(saved){this.outbox=saved.outbox??[];this.nextSequence=saved.nextSequence??1;this.epoch=saved.epoch??'';}
  this.saveOutbox();this.onStatus('Joining table…');const peer=await this.makePeer(undefined,options);if(this.closed){peer.destroy();throw new Error('Connection canceled.');}
  // PeerJS JSON mode rejects messages >= 16,300 bytes. Binary mode chunks
  // our JSON strings and reassembles them before emitting data on both ends.
  const c=peer.connect(`arcana-${this.code}`,{reliable:true,serialization:'binary'});this.connection=c;
  return new Promise<void>((resolve,reject)=>{
   let joined=false,failed=false;const fail=(e:Error)=>{if(failed)return;failed=true;clearTimeout(timer);this.onStatus('Could not join');this.onError(e.message);reject(e);c.close();};
   const timer=setTimeout(()=>fail(new Error('Could not reach the host. Ask them to resume the room, or check Connection settings.')),20000);
   c.on('open',()=>c.send(JSON.stringify({type:'hello',protocol:ROOM_PROTOCOL,token,reclaim,player:p})));
   c.on('data',raw=>{try{if(failed||this.closed||typeof raw!=='string'||raw.length>12000000)return;const m=JSON.parse(raw);
    if(m.type==='welcome'){if(m.protocol!==ROOM_PROTOCOL){fail(new RoomVersionError(m.protocol));return;}this.ownId=m.id;this.onIdentity(m.id);}
    if(m.type==='snapshot'&&this.ownId){this.acceptSnapshot(m.snapshot);if(!joined){joined=true;clearTimeout(timer);this.onStatus('Connected');this.retry=setInterval(()=>this.flush(),2000);resolve();}this.flush();}
    if(m.type==='seatReplaced'){this.onStatus('Seat opened in another tab');this.onError('This seat was reconnected elsewhere. Continue there or reconnect here.');this.close();return;}
    if(m.type==='commandError'){const message=m.message??'The host could not apply this action. Reconnect to retry.';if(typeof m.id==='string')this.finishWaiter(m.id,new Error(message));else this.rejectWaiters(message);this.onError(message);}
    if(m.type==='error')fail(m.code==='ROOM_VERSION_MISMATCH'?new RoomVersionError(m.hostProtocol):new Error(m.message??'Could not join.'));
   }catch(e){if(!joined)fail(e instanceof Error?e:new Error('Invalid snapshot.'));else this.onError(e instanceof Error?e.message:'Could not restore the table.');}});
   c.on('close',()=>{clearTimeout(timer);clearInterval(this.retry);if(failed)return;if(!joined){failed=true;reject(new Error(this.closed?'Connection canceled.':'The host closed the connection.'));}else if(!this.closed){this.rejectWaiters('Host disconnected. Your pending actions are saved; reconnect to finish them.');this.onStatus('Host disconnected');this.onError('Actions are saved. Ask the host to resume the room, then reconnect.');}});
   c.on('error',()=>{if(!joined)fail(new Error('Connection failed. Check the room code or TURN settings.'));else {const message='Could not send or receive the host update. Your pending actions are saved; reconnect to finish them.';this.rejectWaiters(message);this.onError(message);}});
  });
 }
 private acceptSnapshot(s:Snapshot){
  if(s.player.id!==this.ownId||!Number.isSafeInteger(s.revision)||!Number.isSafeInteger(s.accepted))throw new Error('Invalid seat snapshot.');
  if(this.epoch&&s.epoch!==this.epoch)throw new Error('This is a different room session. Leave this seat and join again.');
  if(s.revision<this.received)return;this.epoch=s.epoch;
  if(!this.isHost){const remaining=this.outbox.filter(e=>e.sequence>s.accepted),next=Math.max(this.nextSequence,s.accepted+1);this.saveOutbox(remaining,next);this.outbox=remaining;this.nextSequence=next;}
  this.received=s.revision;this.localPlayer=s.player;this.table=s.table;this.onPlayer?.(s.player);this.onTable(s.table);
  for(const r of s.receipts){const waiter=this.waiters.get(r.id);if(r.error&&!this.seenReceipts.has(r.id))this.onError(r.error);this.seenReceipts.add(r.id);if(waiter)this.finishWaiter(r.id,r.error?new Error(r.error):undefined);}
 }
 private sendSnapshot(id:string,c:DataConnection){if(c.open&&this.room)c.send(JSON.stringify({type:'snapshot',snapshot:snapshot(this.room,id)}));}
 private broadcast(){if(!this.room||this.closed)return;for(const [id,c] of this.connections)this.sendSnapshot(id,c);this.acceptSnapshot(snapshot(this.room,this.ownId));}
 private receive(actor:string,e:Envelope,c?:DataConnection){
  if(!this.room||this.closed)return;
  const result=reduceCommand(this.room,actor,e);
  if(result.room!==this.room){try{this.persist(result.room);}catch{const message='The host could not save this action. Free browser storage and reconnect to retry.';if(c)c.send(JSON.stringify({type:'commandError',id:e.id,message}));else {this.onError(message);this.finishWaiter(e.id,new Error(message));}return;}this.room=result.room;this.broadcast();}
  else if(c)this.sendSnapshot(actor,c);
 }
 private flush(){if(this.closed||!this.connection?.open)return;try{for(const e of this.outbox)this.connection.send(JSON.stringify({type:'command',envelope:e}));}catch{const message='Could not send to the host. Pending actions are saved; reconnect to finish them.';this.rejectWaiters(message);this.onError(message);}}
 submit(command:RoomCommand):Promise<void>{
  if(this.closed||!this.ownId||!this.isHost&&!this.connection?.open)return Promise.reject(new Error('Reconnect before changing the table.'));
  if(command.kind==='deck'&&this.hasPendingDeck)return Promise.reject(new Error('A deck import is already saved and waiting for the host. Reconnect to finish it before importing another deck.'));
  const sequence=this.isHost?(this.room!.sequences[this.ownId]??0)+1:this.nextSequence;const e={id:uid(),sequence,command:structuredClone(command)};
  if(!this.isHost){if(this.outbox.length>=100)return Promise.reject(new Error('Reconnect to finish your pending actions first.'));try{this.saveOutbox([...this.outbox,e],sequence+1);}catch{return Promise.reject(new Error('Could not save the action. Free browser storage and try again.'));}this.outbox.push(e);this.nextSequence++;}
  const promise=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>this.finishWaiter(e.id,new Error(command.kind==='deck'?'Your deck is saved for sending, but the host has not confirmed it. Reconnect to finish this import.': 'The host has not confirmed this action. It is saved; reconnect to finish it.')),COMMAND_ACK_TIMEOUT_MS);this.waiters.set(e.id,{resolve,reject,timer});});if(this.isHost)this.receive(this.ownId,e);else this.flush();return promise;
 }
 request(command:RoomCommand){void this.submit(command).catch(e=>this.onError(e.message));}
 expected(ids:string[]):Record<string,Zone>{const result:Record<string,Zone>={};for(const id of ids)for(const p of [this.localPlayer,...(this.table?.players??[])])if(p)for(const [z,cards] of Object.entries(p.zones))if(cards.some(c=>c.uid===id))result[id]=z as Zone;return result;}
 requestAction(action:Action){const ids='uid' in action?[action.uid]:action.type==='moveMany'?action.moves.map(m=>m.uid):[];this.request({kind:'action',action,expected:this.expected(ids)});}
 requestSync(_p?:Player){if(this.isHost)this.broadcast();else if(this.connection?.open)this.connection.send(JSON.stringify({type:'sync'}));else this.onError('Reconnect to restore the latest host state.');}
 requestTurn(phase?:number){this.request({kind:'turn',phase});}
 requestCombatGesture(command:CombatGesture){this.request({kind:'combat',command});}
 requestStack(command:StackCommand){this.request({kind:'stack',command});}
 requestShared(command:SharedCommand){this.request({kind:'shared',command});}
 close(){this.closed=true;clearInterval(this.retry);for(const c of this.connections.values())c.close();this.connection?.close();this.peer?.destroy();this.rejectWaiters('Connection closed. Saved actions will be retried when you reconnect.');}
}
