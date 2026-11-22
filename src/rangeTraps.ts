import {rangeFloor,sweep,type BodyBox,type Box} from './rangeContacts';
import {limit} from './rangePhysics';

export const rangeTraps={
 spikes:{name:'Шипы',duration:2000},
 weight:{name:'Гиря',duration:850},
 fan:{name:'Вентилятор',duration:5000},
 saw:{name:'Пила',duration:1550},
} as const;
export type TrapKind=keyof typeof rangeTraps;
export type TrapStrike=Exclude<TrapKind,'fan'>;
export type TrapAim={x:number;y:number};
export type ArenaSize={width:number;height:number};
export type TrapContact={part:BodyBox['part'];layer?:BodyBox['layer'];x:number;y:number;at:number};
export const weightFallDuration=620;
export const weightPressDuration=180;

export function trapBox(kind:TrapKind,elapsed:number,{width,height}:ArenaSize,aim:TrapAim):Box {
 const floor=rangeFloor(height);
 if(kind==='spikes'){
  const depth=Math.min(88,height*.17);
  const rise=limit(Math.min(elapsed/110,(rangeTraps.spikes.duration-elapsed)/140),0,1);
  return {x:width*.33,y:floor-depth*rise,w:width*.49,h:depth*rise};
 }
 if(kind==='weight'){
  const size=limit(width*.24,50,112);
  const drop=Math.min(1,Math.max(0,elapsed/weightFallDuration))**1.8;
  return {x:limit(aim.x-size/2,1,width-size-1),y:-size+floor*drop,w:size,h:size};
 }
 if(kind==='fan'){
  const size=limit(width*.19,50,100);
  const travel=limit(Math.min(elapsed/180,(rangeTraps.fan.duration-elapsed)/170),0,1);
  return {x:-size+(size+3)*travel,y:floor-Math.min(height*.32,size*1.65),w:size,h:size};
 }
 const size=limit(width*.20,51,100);
 const travel=limit(Math.min(elapsed/720,(rangeTraps.saw.duration-elapsed)/690),0,1);
 const reach=limit(aim.x-size*.7,width*.10,width*.64);
 return {x:width+3-(width+3-reach)*travel,y:limit(aim.y-size/2,height*.14,floor-size),w:size,h:size};
}

function intersects(a:Box,b:Box){
 return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
}

// Both bodies may travel in a single frame, so check the relative sweep for fast throws.
export function trapContact(box:Box,previous:Box,parts:BodyBox[],oldParts:BodyBox[]):TrapContact|undefined{
 if(box.h<1||box.w<1)return;
 let first:TrapContact|undefined;
 for(const part of parts){
  const before=oldParts.find(item=>item.part===part.part&&item.layer===part.layer)??part;
  const dx=box.x-previous.x-(part.x-before.x),dy=box.y-previous.y-(part.y-before.y);
  const hit=sweep(previous,before,dx,dy);
  const at=hit?.t??(intersects(box,part)||intersects(previous,before)?1:Infinity);
  if(!Number.isFinite(at)||(first&&at>=first.at))continue;
  const x=before.x+(part.x-before.x)*at,y=before.y+(part.y-before.y)*at;
  const trapX=previous.x+(box.x-previous.x)*at,trapY=previous.y+(box.y-previous.y)*at;
  first={part:part.part,layer:part.layer,x:limit(trapX+box.w/2,x,x+part.w),y:limit(trapY+box.h/2,y,y+part.h),at};
 }
 return first;
}
