import type {RangePart} from './rangeDamage';
import {limit} from './rangePhysics';
export type Box={x:number;y:number;w:number;h:number};
export type Contact={side:'left'|'right'|'floor'|'ceiling';speed:number;part:RangePart;x:number;y:number};
export type BodyBox=Box&{part:RangePart};
export const floorFraction=.91;
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
const horizontal=(side:Contact['side'])=>side==='left'||side==='right';
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

export function resolveContacts(boxes:BodyBox[],dx:number,dy:number,vx:number,vy:number,w:number,h:number){
 const contacts:Contact[]=[];
 if(!boxes.length)return {dx:0,dy:0,contacts};
 const floor=h*floorFraction;
 const obstacles=rangeObstacles(w,h);
 const walls:Box[]=[{x:-w,y:0,w,h:floor},{x:w,y:0,w,h:floor},{x:0,y:-h,w,h},{x:0,y:floor,w,h}];
 const surfaces=[...walls,...obstacles];
 let movedX=0,movedY=0;
 function shift(x:number,y:number){
  if(!x&&!y)return;
  movedX+=x;movedY+=y;
  boxes=boxes.map(box=>({...box,x:box.x+x,y:box.y+y}));
 }
 function confine(){
  const left=-Math.min(...boxes.map(box=>box.x));
  const right=w-Math.max(...boxes.map(box=>box.x+box.w));
  const top=-Math.min(...boxes.map(box=>box.y));
  const bottom=floor-Math.max(...boxes.map(box=>box.y+box.h));
  shift(limit(0,left,right),limit(0,top,bottom));
 }

 // A pose change can move a joint into a surface even when the pointer is stationary.
 confine();
 for(const obstacle of obstacles){
  const inside=boxes.filter(box=>overlaps(box,obstacle));
  if(!inside.length)continue;
  const options=[
   {x:obstacle.x-Math.max(...inside.map(box=>box.x+box.w)),y:0},
   {x:obstacle.x+obstacle.w-Math.min(...inside.map(box=>box.x)),y:0},
   {x:0,y:obstacle.y-Math.max(...inside.map(box=>box.y+box.h))},
   {x:0,y:obstacle.y+obstacle.h-Math.min(...inside.map(box=>box.y))},
  ];
  options.sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y));
  const clear=options.find(({x,y})=>boxes.every(box=>{
   const moved={...box,x:box.x+x,y:box.y+y};
   return moved.x>=0&&moved.y>=0&&moved.x+moved.w<=w&&moved.y+moved.h<=floor&&!overlaps(moved,obstacle);
  }));
  if(clear)shift(clear.x,clear.y);
 }

 // Keep the remaining motion along a wall or the floor instead of stopping both axes.
 for(let pass=0;pass<2&&(dx||dy);pass++){
  let best=1,contact:Contact|undefined;
  for(const a of boxes)for(const b of surfaces){
   const hit=sweep(a,b,dx,dy);if(!hit||hit.t>best)continue;
   best=hit.t;
   const x=a.x+dx*best,y=a.y+dy*best;
   contact={side:hit.side,part:a.part,speed:Math.abs(horizontal(hit.side)?vx:vy),
    x:hit.side==='left'?x:hit.side==='right'?x+a.w:limit(b.x+b.w/2,x,x+a.w),
    y:hit.side==='ceiling'?y:hit.side==='floor'?y+a.h:limit(b.y+b.h/2,y,y+a.h)};
  }
  shift(dx*best,dy*best);
  if(!contact)break;
  contacts.push({...contact,x:contact.x-movedX,y:contact.y-movedY});
  dx=horizontal(contact.side)?0:dx*(1-best);
  dy=horizontal(contact.side)?dy*(1-best):0;
 }
 confine();
 return {dx:movedX,dy:movedY,contacts:contacts.map(contact=>({...contact,x:contact.x+movedX,y:contact.y+movedY}))};
}
