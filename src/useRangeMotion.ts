import {useEffect,useRef,useState,type PointerEvent,type RefObject} from 'react';
import type {AvatarJoints,AvatarLayer} from './PixelAvatar';
import {flightStep,limit,springStep,type Spring,type Collision} from './rangePhysics';

type Motion='idle'|'held'|'flying'|'returning';
type Rig={tilt:number;squash:number}&Record<Exclude<AvatarLayer,'torso'>,number>;
const restRig=():Rig=>({tilt:0,squash:0,head:0,'right-arm':0,'left-arm':0,'right-forearm':0,'left-forearm':0,'right-leg':0,'left-leg':0});
const keys=Object.keys(restRig()) as (keyof Rig)[];
type Resolver=(x:number,y:number,vx:number,vy:number)=>{x:number;y:number;vx:number;vy:number;collisions:import('./rangePhysics').Collision[]};
export function useRangeMotion(stage:RefObject<HTMLDivElement|null>,actor:RefObject<HTMLDivElement|null>,onImpact:(collision:Collision)=>void,resolve?:Resolver){
 const [motion,setMotion]=useState<Motion>('idle');
 const [offset,setOffset]=useState({x:0,y:0});
 const [rig,setRig]=useState(restRig);
 const [squeezeAxis,setSqueezeAxis]=useState<'horizontal'|'vertical'>('vertical');
 const springs=useRef(Object.fromEntries(keys.map(key=>[key,{value:0,velocity:0}])) as Record<keyof Rig,Spring>);
 const desired=useRef(restRig());
 const active=useRef<Motion>('idle');
 const position=useRef({x:0,y:0,vx:0,vy:0});
 const drag=useRef<{id:number;x:number;y:number;t:number}|null>(null);
 const frame=useRef(0),settleAt=useRef(0),returnAt=useRef(0);
 const resolver=useRef(resolve);
 resolver.current=resolve;
 const impacts=useRef(onImpact);impacts.current=onImpact;
 function mode(next:Motion){active.current=next;setMotion(next);}
 function bounds(){
  const room=stage.current!,body=actor.current!;
  return {left:-room.clientWidth/2+body.clientWidth*.27,right:room.clientWidth/2-body.clientWidth*.27,
   top:-room.clientHeight*.9+body.clientHeight*.98,bottom:room.clientHeight*.1-body.clientHeight*.03};
 }
 function targetVelocity(vx:number,vy:number){
  desired.current={...restRig(),tilt:limit(-vx*.014,-32,32),head:limit(vx*.019,-32,32),
   'right-arm':limit(vx*.024-vy*.012,-65,65),'left-arm':limit(vx*.024+vy*.012,-65,65),
   'right-forearm':limit(vx*.03+Math.abs(vy)*.01,-75,75),'left-forearm':limit(vx*.03-Math.abs(vy)*.01,-75,75),
   'right-leg':limit(vx*.019+vy*.008,-38,38),'left-leg':limit(vx*.019-vy*.008,-38,38)};
 }
 function impact(c:Collision){
  if(c.speed<140)return;
  setSqueezeAxis(c.side==='left'||c.side==='right'?'horizontal':'vertical');
  const impulse=limit(c.speed/35,5,65),sign=c.side==='left'?-1:1;
  springs.current.squash.velocity-=limit(c.speed*.002,1,5);
  springs.current.tilt.velocity+=sign*impulse*8;
  springs.current.head.velocity-=sign*impulse*12;
  springs.current['right-forearm'].velocity+=impulse*10;
  springs.current['left-forearm'].velocity-=impulse*10;
  impacts.current(c);
 }
 function startLoop(){
  if(frame.current)return;
  let last=performance.now();
  const step=(now:number)=>{
   frame.current=0;
   if(!stage.current||!actor.current)return;
   const dt=Math.min(.04,(now-last)/1000);last=now;
   if(active.current==='flying'){
    const p=position.current;
    const flight=resolver.current?resolver.current(p.x+p.vx*dt,p.y+(p.vy+1500*dt)*dt,p.vx,p.vy+1500*dt):flightStep(p,bounds(),dt);position.current=flight;setOffset({x:flight.x,y:flight.y});
    targetVelocity(flight.vx,flight.vy);
    flight.collisions.forEach(impact);
    if(now>settleAt.current){mode('returning');returnAt.current=now;desired.current=restRig();}
   }else if(active.current==='held'){
    if(drag.current&&now-drag.current.t>65){position.current.vx*=.85;position.current.vy*=.85;targetVelocity(position.current.vx,position.current.vy);}
   }else if(active.current==='returning'){
    const f=1-Math.exp(-dt*10);position.current.x*=1-f;position.current.y*=1-f;
    setOffset({x:position.current.x,y:position.current.y});
    if(now-returnAt.current>600){position.current={x:0,y:0,vx:0,vy:0};setOffset({x:0,y:0});mode('idle');}
   }
   let moving=false;const next=restRig();
   for(const key of keys){const spring=springStep(springs.current[key],desired.current[key],dt);springs.current[key]=spring;next[key]=spring.value;
    if(Math.abs(spring.value-desired.current[key])>.03||Math.abs(spring.velocity)>.03)moving=true;}
   setRig(next);
   if(active.current!=='idle'||moving)frame.current=requestAnimationFrame(step);
  };
  frame.current=requestAnimationFrame(step);
 }
 function grab(event:PointerEvent<HTMLDivElement>){
  if(drag.current)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,t:performance.now()};
  position.current.vx=position.current.vy=0;mode('held');startLoop();
 }
 function dragMove(event:PointerEvent<HTMLDivElement>){
  const held=drag.current;if(!held||held.id!==event.pointerId)return;
  const now=performance.now(),dt=Math.max(8,now-held.t),dx=event.clientX-held.x,dy=event.clientY-held.y;
  const vx=limit(dx/dt*1000,-2800,2800),vy=limit(dy/dt*1000,-2800,2800),b=bounds();
  const x=position.current.x+dx,y=position.current.y+dy;
  const next=resolver.current?resolver.current(x,y,vx,vy):{x:limit(x,b.left,b.right),y:limit(y,b.top,b.bottom),vx,vy,collisions:[]};
  next.collisions.forEach(impact);
  position.current={x:next.x,y:next.y,vx,vy};
  setOffset({x:position.current.x,y:position.current.y});targetVelocity(vx,vy);
  drag.current={id:held.id,x:event.clientX,y:event.clientY,t:now};
 }
 function release(event:PointerEvent<HTMLDivElement>,cancel=false){
  const held=drag.current;if(!held||held.id!==event.pointerId)return;
  drag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(cancel){reset();return;}
  if(performance.now()-held.t>100)position.current.vx=position.current.vy=0;
  mode('flying');settleAt.current=performance.now()+1600;startLoop();
 }
 function reset(){
  drag.current=null;position.current={x:0,y:0,vx:0,vy:0};setOffset({x:0,y:0});desired.current=restRig();mode('idle');startLoop();
 }
 function kick(direction:number){
  springs.current.tilt.velocity+=direction*120;springs.current.head.velocity-=direction*180;startLoop();
 }
 useEffect(()=>{
  const hide=()=>{if(document.hidden){drag.current=null;active.current='idle';desired.current=restRig();cancelAnimationFrame(frame.current);frame.current=0;for(const key of keys)springs.current[key]={value:0,velocity:0};setRig(restRig());setMotion('idle');setOffset({x:0,y:0});position.current={x:0,y:0,vx:0,vy:0};}};
  document.addEventListener('visibilitychange',hide);
  return ()=>{cancelAnimationFrame(frame.current);document.removeEventListener('visibilitychange',hide);};
 },[]);
 const {tilt,squash,...joints}=rig;
 return {position,motion,offset,tilt,squeezeAxis,squash:limit(squash,-.24,.13),joints:joints as AvatarJoints,grab,dragMove,release,reset,kick};
}
