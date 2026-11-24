import type {BoardPosition} from './game';
export type Camera={x:number;y:number;zoom:number};
export type Rect={x:number;y:number;width:number;height:number};
export const AREA_SIZE={width:3600,height:2800};
export const TABLE_SIZE={width:4960,height:4010};
export type Seat={x:number;y:number;facing?:boolean;right?:boolean};
export const MAT_SIZE={width:1120,height:970};
export const MAT_ORIGIN={x:1240,y:915};
export const CARD_SIZE={width:132,height:184};
export const CORE_FIELD={x:MAT_ORIGIN.x+32,y:MAT_ORIGIN.y+122,width:1056,height:604};
export const SEATS:Seat[]=[{x:80,y:1130},{x:80,y:80,facing:true},{x:1280,y:80,facing:true,right:true},{x:1280,y:1130,right:true}];
// Mats meet at the center. Overflow extends outward into separate territories.
export function territoryRect(seat:Seat):Rect{const center={x:2480,y:2005};const x=seat.right?center.x:seat.x,y=seat.facing?seat.y:center.y;return {x,y,width:seat.right?seat.x+AREA_SIZE.width-x:center.x-x,height:seat.facing?center.y-y:seat.y+AREA_SIZE.height-y};}
export function orientPoint(point:{x:number;y:number},facing=false,width=CARD_SIZE.width,height=CARD_SIZE.height){return facing?{x:AREA_SIZE.width-width-point.x,y:AREA_SIZE.height-height-point.y}:point;}
export function unorientPosition(position:BoardPosition,facing=false):BoardPosition{return facing?{...position,x:1-position.x,y:1-position.y}:position;}
const overflowSlots:{x:number;y:number}[]=[];
for(let y=80;y+CARD_SIZE.height<AREA_SIZE.height-80;y+=204)for(let x=80;x+CARD_SIZE.width<AREA_SIZE.width-80;x+=148){
 if(x+CARD_SIZE.width>MAT_ORIGIN.x-24&&x<MAT_ORIGIN.x+MAT_SIZE.width+24&&y+CARD_SIZE.height>MAT_ORIGIN.y-24&&y<MAT_ORIGIN.y+MAT_SIZE.height+24)continue;
 overflowSlots.push({x,y});
}
// Place additional cards nearest the mat first; retain a stable layout as cards arrive.
overflowSlots.sort((a,b)=>Math.hypot(a.x-1800,a.y-1400)-Math.hypot(b.x-1800,b.y-1400));
export function cardPoint(position:BoardPosition|undefined,index=0){
 if(position?.space==='area')return {x:position.x*(AREA_SIZE.width-CARD_SIZE.width),y:position.y*(AREA_SIZE.height-CARD_SIZE.height)};
 if(position)return {x:CORE_FIELD.x+position.x*(CORE_FIELD.width-CARD_SIZE.width),y:CORE_FIELD.y+position.y*(CORE_FIELD.height-CARD_SIZE.height)};
 if(index<18)return {x:CORE_FIELD.x+(index%6)*(CORE_FIELD.width-CARD_SIZE.width)/5,y:CORE_FIELD.y+Math.floor(index/6)*(CORE_FIELD.height-CARD_SIZE.height)/2};
 return overflowSlots[(index-18)%overflowSlots.length];
}
export function seatCardPoint(seat:Seat,position:BoardPosition|undefined,index=0){
 if(position||index<18)return orientPoint(cardPoint(position,index),seat.facing);
 const region=territoryRect(seat),slots=overflowSlots.map(p=>orientPoint(p,seat.facing)).filter(p=>seat.x+p.x>=region.x+24&&seat.y+p.y>=region.y+24&&seat.x+p.x+CARD_SIZE.width<=region.x+region.width-24&&seat.y+p.y+CARD_SIZE.height<=region.y+region.height-24);
 return slots[(index-18)%slots.length];
}
export function matRect(seat:Seat):Rect{return {x:seat.x+MAT_ORIGIN.x,y:seat.y+MAT_ORIGIN.y,...MAT_SIZE};}
export function occupiedRect(seat:Seat,positions:(BoardPosition|undefined)[]):Rect{
 const mat=matRect(seat);let left=mat.x,top=mat.y,right=left+mat.width,bottom=top+mat.height;
 positions.forEach((position,i)=>{const p=seatCardPoint(seat,position,i);left=Math.min(left,seat.x+p.x-32);top=Math.min(top,seat.y+p.y-32);right=Math.max(right,seat.x+p.x+CARD_SIZE.width+32);bottom=Math.max(bottom,seat.y+p.y+CARD_SIZE.height+64);});
 return {x:left,y:top,width:right-left,height:bottom-top};
}
export function unionRects(rects:Rect[]):Rect{const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));return {x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y};}
export function zoomAt(camera:Camera,zoom:number,x:number,y:number):Camera {const z=Math.max(.025,Math.min(1.65,zoom)),ratio=z/camera.zoom;return {zoom:z,x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio};}
export function fitRect(view:{width:number;height:number},rect:Rect,padding=32):Camera {const zoom=Math.max(.025,Math.min(1.2,Math.min((view.width-padding*2)/rect.width,(view.height-padding*2)/rect.height)));return {zoom,x:view.width/2-(rect.x+rect.width/2)*zoom,y:view.height/2-(rect.y+rect.height/2)*zoom};}
export function boardPosition(x:number,y:number,rect:{left:number;top:number;width:number;height:number},scale:number,cardWidth=96,cardHeight=134,space?:'area'):BoardPosition{const w=cardWidth*scale,h=cardHeight*scale;return {x:Math.max(0,Math.min(1,(x-rect.left-w/2)/Math.max(1,rect.width-w))),y:Math.max(0,Math.min(1,(y-rect.top-h/2)/Math.max(1,rect.height-h))),...(space?{space}:{})};}

// Project only visible objects; never rasterize the entire world as one texture.
export function projectRect(rect:Rect,camera:Camera):Rect{return {x:camera.x+rect.x*camera.zoom,y:camera.y+rect.y*camera.zoom,width:rect.width*camera.zoom,height:rect.height*camera.zoom};}
export function clipRect(rect:Rect,view:{width:number;height:number},padding=0):Rect|null{const x=Math.max(-padding,rect.x),y=Math.max(-padding,rect.y),right=Math.min(view.width+padding,rect.x+rect.width),bottom=Math.min(view.height+padding,rect.y+rect.height);return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;}
// A clipped hit area still reports coordinates relative to its complete battlefield.
export function unclippedBoardRect(rect:{left:number;top:number},offsetX:number,offsetY:number,width:number,height:number,scale:number){return {left:rect.left+offsetX,top:rect.top+offsetY,width:width*scale,height:height*scale};}
