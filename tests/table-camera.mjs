import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const js=ts.transpileModule(await readFile(new URL('../lib/table-camera.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {zoomAt,fitRect,boardPosition,cardPoint,matRect,occupiedRect,unionRects,projectRect,clipRect,unclippedBoardRect,AREA_SIZE,TABLE_SIZE,SEATS,CORE_FIELD,CARD_SIZE,territoryRect,seatCardPoint,orientPoint,unorientPosition}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const scale of [.1,.22,.5,1,1.65]){
 const camera={x:-320,y:150,zoom:.7},anchor={x:415,y:260},next=zoomAt(camera,scale,anchor.x,anchor.y);
 near((anchor.x-next.x)/next.zoom,(anchor.x-camera.x)/camera.zoom);
 near((anchor.y-next.y)/next.zoom,(anchor.y-camera.y)/camera.zoom);
 const pos={x:.73,y:.21},r={left:48,top:86,width:1056*scale,height:394*scale};
 const pointer={x:r.left+(1056-132)*scale*pos.x+66*scale,y:r.top+(394-184)*scale*pos.y+92*scale};
 const drop=boardPosition(pointer.x,pointer.y,r,scale,132,184);near(drop.x,pos.x);near(drop.y,pos.y);
 assert.deepEqual(boardPosition(-100,-100,r,scale,132,184),{x:0,y:0});
 assert.deepEqual(boardPosition(9999,9999,r,scale,132,184),{x:1,y:1});
}
const view={width:900,height:500},rect={x:80,y:1010,width:1120,height:760},fit=fitRect(view,rect,24);
near(fit.x+(rect.x+rect.width/2)*fit.zoom,view.width/2);near(fit.y+(rect.y+rect.height/2)*fit.zoom,view.height/2);
assert.ok(rect.width*fit.zoom<=view.width-48);assert.ok(rect.height*fit.zoom<=view.height-48);
const mobile=fitRect({width:390,height:240},{x:0,y:0,width:2720,height:1860},20);assert.ok(2720*mobile.zoom<=350);assert.ok(1860*mobile.zoom<=200);
console.log('PASS camera anchor, player framing, scaled drop placement, and edge bounds and mobile overview at five zoom levels');

for(const scale of [.025,.1,.5,1,1.65])for(const pos of [{x:0,y:0,space:'area'},{x:.91,y:.93,space:'area'},{x:.5,y:.5,space:'area'},{x:1,y:1,space:'area'}]){
 const point=cardPoint(pos),r={left:-500,top:250,width:AREA_SIZE.width*scale,height:AREA_SIZE.height*scale};
 const dropped=boardPosition(r.left+(point.x+66)*scale,r.top+(point.y+92)*scale,r,scale,132,184,'area');near(dropped.x,pos.x);near(dropped.y,pos.y);assert.equal(dropped.space,'area');
}
const old=cardPoint({x:.7,y:.2});near(old.x,CORE_FIELD.x+.7*(CORE_FIELD.width-132));near(old.y,CORE_FIELD.y+.2*(CORE_FIELD.height-184));
const far={x:.98,y:.02,space:'area'},farPoint=seatCardPoint(SEATS[2],far),bounds=occupiedRect(SEATS[2],[far]);
assert.ok(bounds.x<=SEATS[2].x+farPoint.x);assert.ok(bounds.y<=SEATS[2].y+farPoint.y);assert.ok(bounds.x+bounds.width>=SEATS[2].x+farPoint.x+132);
assert.deepEqual(occupiedRect(SEATS[0],[]),matRect(SEATS[0]));
for(const viewport of [{width:390,height:350},{width:844,height:230},{width:1200,height:700}]){
 const r=unionRects(SEATS.map(s=>({x:s.x,y:s.y,...AREA_SIZE}))),fit=fitRect(viewport,r,20);assert.ok(r.width*fit.zoom<=viewport.width-40+.001);assert.ok(r.height*fit.zoom<=viewport.height-40+.001);
}
for(let i=0;i<SEATS.length;i++)for(let j=i+1;j<SEATS.length;j++){const a=territoryRect(SEATS[i]),b=territoryRect(SEATS[j]);assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
const slots=Array.from({length:100},(_,i)=>cardPoint(undefined,i));assert.equal(new Set(slots.map(p=>`${p.x},${p.y}`)).size,100);for(const p of slots){assert.ok(p.x>=0&&p.y>=0&&p.x+132<=AREA_SIZE.width&&p.y+184<=AREA_SIZE.height);}
console.log('PASS expanded-area drag round trips, saved mat positions, occupied framing, 4-seat mobile overview, non-overlapping territories, and 100-card overflow layout');

for(const zoom of [.025,.05,.11,.3,1,1.65])for(const pan of [{x:170,y:-220},{x:-6200,y:-4700},{x:-300,y:80}]){
 const camera={...pan,zoom},view={width:390,height:680},area=projectRect({...SEATS[0],...AREA_SIZE},camera),clipped=clipRect(area,view);
 if(!clipped)continue;assert.ok(clipped.width<=view.width&&clipped.height<=view.height);
 const clientRect={left:clipped.x+17,top:clipped.y+91};
 const full=unclippedBoardRect(clientRect,area.x-clipped.x,area.y-clipped.y,AREA_SIZE.width,AREA_SIZE.height,zoom);
 near(full.left,area.x+17);near(full.top,area.y+91);near(full.width,area.width);
 const pos={x:.61,y:.23,space:'area'},point=cardPoint(pos),pointer={x:full.left+(point.x+66)*zoom,y:full.top+(point.y+92)*zoom};
 const dropped=boardPosition(pointer.x,pointer.y,full,zoom,132,184,'area');near(dropped.x,pos.x);near(dropped.y,pos.y);
}
assert.equal(clipRect({x:800,y:100,width:50,height:50},{width:390,height:680},160),null);
assert.ok(clipRect({x:450,y:100,width:50,height:50},{width:390,height:680},160));
console.log('PASS viewport projection, offscreen paint culling, and clipped battlefield drops preserve world positions at six zoom levels');

const rows=Array.from({length:18},(_,i)=>cardPoint(undefined,i));
assert.equal(new Set(rows.map(p=>p.y)).size,3);
for(let i=0;i<rows.length;i++){
 const p=rows[i];assert.ok(p.x>=CORE_FIELD.x&&p.y>=CORE_FIELD.y&&p.x+CARD_SIZE.width<=CORE_FIELD.x+CORE_FIELD.width&&p.y+CARD_SIZE.height<=CORE_FIELD.y+CORE_FIELD.height);
 for(const q of rows.slice(i+1))assert.ok(p.x+CARD_SIZE.width<=q.x||q.x+CARD_SIZE.width<=p.x||p.y+CARD_SIZE.height<=q.y||q.y+CARD_SIZE.height<=p.y);
}
console.log('PASS three complete non-overlapping rows fit on the default mat');

const mats=SEATS.map(matRect);
near(mats[0].y-(mats[1].y+mats[1].height),80);
near(mats[2].x-(mats[1].x+mats[1].width),80);
for(const seat of SEATS){
 const region=territoryRect(seat),mat=matRect(seat);
 assert.ok(region.x<=mat.x&&region.y<=mat.y&&region.x+region.width>=mat.x+mat.width&&region.y+region.height>=mat.y+mat.height);
 assert.ok(region.width>mat.width*2&&region.height>mat.height*1.9);
 const placed=Array.from({length:100},(_,i)=>seatCardPoint(seat,undefined,i));
 assert.equal(new Set(placed.map(p=>`${p.x},${p.y}`)).size,100);
 for(const p of placed)assert.ok(seat.x+p.x>=region.x&&seat.y+p.y>=region.y&&seat.x+p.x+132<=region.x+region.width&&seat.y+p.y+184<=region.y+region.height);
 for(const zoom of [.1,.25,.6,1.2])for(const position of [{x:.3,y:.4,space:'area'},{x:0,y:1,space:'area'},{x:.9,y:.2,space:'area'}]){
  const point=seatCardPoint(seat,position),rect={left:-150,top:210,width:AREA_SIZE.width*zoom,height:AREA_SIZE.height*zoom};
  const drop=unorientPosition(boardPosition(rect.left+(point.x+66)*zoom,rect.top+(point.y+92)*zoom,rect,zoom,132,184,'area'),seat.facing);
  near(drop.x,position.x);near(drop.y,position.y);
 }
}
console.log('PASS compact facing mats, separate exterior territories, 100-card overflow, and rotated drag round trips');
