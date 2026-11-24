// Keep each card readable; large hands scroll instead of shrinking to thumbnails.
export function handLayout(count:number,width:number,compact=false,mobile=false,overrideWidth?:number,fan=false){
 const cardWidth=overrideWidth??(mobile?120:compact?116:width>=720?144:128);
 const gutter=mobile?12:40;
 const step=mobile&&!fan?cardWidth+12:Math.max(mobile?40:60,Math.min(cardWidth*.66,(Math.max(width,cardWidth+2*gutter)-2*gutter-cardWidth)/Math.max(1,count-1)));
 const spread=count?cardWidth+Math.max(0,count-1)*step:0;
 const stageWidth=Math.max(width,spread+gutter*2);
 const left=(stageWidth-spread)/2;
 return {cardWidth,stageWidth,spread,step,overflow:stageWidth>width+1,positions:Array.from({length:count},(_,i)=>{
  const offset=count>1?(i-(count-1)/2)/((count-1)/2):0;
  return {hitWidth:i===count-1?cardWidth:step,x:mobile&&!fan?gutter+i*step:left+i*step,angle:mobile&&!fan?0:offset*Math.min(7,(count-1)*1.2),y:mobile&&!fan?0:Math.round(offset*offset*(fan?24:14))};
 })};
}
