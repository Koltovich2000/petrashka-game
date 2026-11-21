import type {RangePart} from './rangeDamage';
export type Box={x:number;y:number;w:number;h:number};
export type Contact={side:'left'|'right'|'floor'|'ceiling';speed:number;part:RangePart;x:number;y:number};
export type BodyBox=Box&{part:RangePart};
export function rangeObstacles(w:number,h:number):Box[]{return [{x:60/800*w,y:453/700*h,w:82/800*w,h:92/700*h},{x:660/800*w,y:436/700*h,w:92/800*w,h:109/700*h}];}
// Sweeping prevents a fast pointer from passing through an obstacle.
export function sweep(a:Box,b:Box,dx:number,dy:number){
 const axis=(p:number,size:number,q:number,other:number,d:number)=>d===0?[0,Infinity]:d>0?[(q-p-size)/d,(q+other-p)/d]:[(q+other-p)/d,(q-p-size)/d];
 if(dx===0&&(a.x>=b.x+b.w||a.x+a.w<=b.x))return null;
 if(dy===0&&(a.y>=b.y+b.h||a.y+a.h<=b.y))return null;
 const [tx,xx]=axis(a.x,a.w,b.x,b.w,dx),[ty,yy]=axis(a.y,a.h,b.y,b.h,dy);
 const t=Math.max(tx,ty);
 if(t<0||t>1||t>Math.min(xx,yy))return null;
 return {t,side:tx>ty?(dx>0?'right':'left'):(dy>0?'floor':'ceiling')} as {t:number;side:Contact['side']};
}
export function resolveContacts(boxes:BodyBox[],dx:number,dy:number,vx:number,vy:number,w:number,h:number){
 const walls:Box[]=[{x:-10000,y:-10000,w:10000,h:20000},{x:w,y:-10000,w:10000,h:20000},{x:0,y:-10000,w,h:10000},{x:0,y:h*.91,w,h:10000}];
 let best=1,contact:Contact|undefined;
 for(const a of boxes)for(const b of [...walls,...rangeObstacles(w,h)]){
  const hit=sweep(a,b,dx,dy);if(!hit||hit.t>best)continue;
  best=hit.t;const x=a.x+dx*best,y=a.y+dy*best;
  contact={side:hit.side,part:a.part,speed:Math.abs(hit.side==='left'||hit.side==='right'?vx:vy),x:hit.side==='left'?x:hit.side==='right'?x+a.w:Math.max(x,Math.min(x+a.w,b.x+b.w/2)),y:hit.side==='ceiling'?y:hit.side==='floor'?y+a.h:Math.max(y,Math.min(y+a.h,b.y+b.h/2))};
 }
 return {dx:dx*best,dy:dy*best,contact};
}
