export type EdgePoint={x:number;y:number};
export type EdgeBounds={left:number;top:number;right:number;bottom:number};
// Screen pixels per second: speed is independent of table zoom and refresh rate.
export function dragEdgeVelocity(p:EdgePoint,r:EdgeBounds):EdgePoint{
 if(p.x<r.left||p.x>r.right||p.y<r.top||p.y>r.bottom)return {x:0,y:0};
 const axis=(v:number,min:number,max:number)=>{const band=Math.min(72,(max-min)/4);if(band<=0)return 0;const near=Math.max(0,1-(v-min)/band),far=Math.max(0,1-(max-v)/band);return 520*(near*near-far*far);};
 return {x:axis(p.x,r.left,r.right),y:axis(p.y,r.top,r.bottom)};
}
