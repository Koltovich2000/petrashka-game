import {useEffect,useRef,useState,type RefObject} from 'react';
import {rangeFloor,type BodyBox,type Box} from './rangeContacts';
import {limit} from './rangePhysics';
import {rangeTraps,trapBox,trapContact,weightFallDuration,weightPressDuration,type ArenaSize,type TrapAim,type TrapContact,type TrapKind,type TrapStrike} from './rangeTraps';
import type {TrapMotion} from './useRangeMotion';

type Run={start:number;aim:TrapAim;lastHit:number;box?:Box;press?:{start:number;y:number};gusted?:boolean;weightImpacted?:boolean};
const updateOrder=['fan','spikes','saw','weight'] as const;

export function useRangeTraps(stage:RefObject<HTMLDivElement|null>,readParts:()=>BodyBox[],
 onStrike:(kind:TrapStrike,hit:TrapContact,part:BodyBox,repeat:boolean)=>void,onWeightImpact:()=>void){
 const runs=useRef(new Map<TrapKind,Run>());
 const nodes=useRef<Partial<Record<TrapKind,HTMLDivElement|null>>>({});
 const previous=useRef<{size:ArenaSize;parts:BodyBox[]}>(undefined);
 const [active,setActive]=useState<ReadonlySet<TrapKind>>(()=>new Set());

 function stop(){
  runs.current.clear();
  previous.current=undefined;
  setActive(current=>current.size?new Set():current);
 }
 useEffect(()=>{
  const hide=()=>{if(document.hidden)stop();};
  document.addEventListener('visibilitychange',hide);
  return()=>document.removeEventListener('visibilitychange',hide);
 },[]);

 function start(kind:TrapKind){
  const arena=stage.current;
  if(!arena?.clientWidth||!arena.clientHeight||runs.current.has(kind))return false;
  if(!runs.current.size)previous.current=undefined;
  const parts=readParts();
  const target=parts.find(part=>part.part==='torso')??parts[0];
  const aim=target?{x:(target.x+target.w/2)/arena.clientWidth,y:(target.y+target.h/2)/arena.clientHeight}:{x:.5,y:.65};
  runs.current.set(kind,{start:performance.now(),aim,lastHit:-Infinity});
  setActive(new Set(runs.current.keys()));
  return true;
 }

 function update(now:number,dt:number,motion:TrapMotion){
  if(!runs.current.size)return false;
  const arena=stage.current;
  if(!arena||!arena.clientWidth||!arena.clientHeight)return false;
  const size={width:arena.clientWidth,height:arena.clientHeight};
  const parts=readParts();
  const resized=previous.current?.size.width!==size.width||previous.current.size.height!==size.height;
  const oldParts=resized?parts:previous.current!.parts;
  const had=runs.current.size;
  for(const kind of updateOrder){
   const run=runs.current.get(kind);
   if(!run)continue;
   const elapsed=Math.max(0,now-run.start);
   const aim={x:run.aim.x*size.width,y:run.aim.y*size.height};
   const box=trapBox(kind,elapsed,size,aim);
   const previousBox=resized?box:run.box??box;
   if(run.press){
    const age=now-run.press.start;
    const floor=rangeFloor(size.height);
    if(age>=weightPressDuration){
     motion.launch(aim.x<size.width/2?640:-640,-760,aim.x<size.width/2?440:-440);
     runs.current.delete(kind);
     continue;
    }
    const progress=limit(age/(weightPressDuration*.72),0,1);
    const startY=run.press.y*size.height;
    box.y=startY+(floor-box.h-startY)*progress;
    motion.press(limit(size.height*5.2,1250,2500));
   }else if(elapsed>=rangeTraps[kind].duration){
    runs.current.delete(kind);
    continue;
   }else if(kind==='fan'){
    const inStream=parts.some(part=>part.y+part.h>size.height*.24&&part.y<rangeFloor(size.height));
    if(elapsed>=100&&inStream&&!runs.current.get('weight')?.press){
     motion.gust(dt,!run.gusted);
     run.gusted=true;
    }
   }else if((kind==='spikes'&&elapsed<rangeTraps.spikes.duration-125&&now-run.lastHit>=475)
    ||(kind!=='spikes'&&run.lastHit===-Infinity)){
    // Only the cutting disk counts as the saw's contact surface.
    const inset=kind==='saw'?box.w*.1:0;
    const collider=(rect:Box)=>({x:rect.x+inset,y:rect.y+inset,w:rect.w-2*inset,h:rect.h-2*inset});
    const hit=trapContact(collider(box),collider(previousBox),parts,oldParts);
    if(hit){
     const repeat=run.lastHit!==-Infinity;
     run.lastHit=now;
     const part=parts.find(item=>item.part===hit.part&&item.layer===hit.layer)!;
     const side=hit.x<size.width/2?1:-1;
     onStrike(kind,hit,part,repeat);
     switch(kind){
      case 'spikes':motion.launch(side*265,-930,side*320);break;
      case 'saw':{
       const direction=box.x>previousBox.x?1:-1;
       motion.launch(direction*630,-370,direction*410);
       break;
      }
      case 'weight':
       run.press={start:now,y:limit(hit.y-box.h,-box.h,rangeFloor(size.height)-box.h)/size.height};
       motion.press(limit(size.height*5.2,1250,2500));
       break;
     }
    }
   }
   if(kind==='weight'&&!run.weightImpacted&&(run.press||elapsed>=weightFallDuration)){
    run.weightImpacted=true;
    onWeightImpact();
   }
   run.box=box;
   const art=nodes.current[kind];
   if(art){
    art.style.width=box.w+'px';
    art.style.height=box.h+'px';
    art.style.transform=`translate3d(${box.x}px,${box.y}px,0)`;
    if(kind==='weight')art.toggleAttribute('data-pressing',Boolean(run.press));
    if(kind==='saw')art.style.setProperty('--saw-reach',Math.max(0,size.width-box.x-box.w*.45)+'px');
   }
  }
  previous.current={size,parts};
  if(runs.current.size!==had)setActive(new Set(runs.current.keys()));
  return runs.current.size>0;
 }

 return {active,nodes,start,update};
}
