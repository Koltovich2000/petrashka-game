import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent,type RefObject} from 'react';
import type {AvatarJoints,AvatarLayer} from './PixelAvatar';
import {limit,springStep,type Spring} from './rangePhysics';
import type {Contact,resolveContacts} from './rangeContacts';

type Motion='idle'|'held'|'flying'|'returning';
type Rig={tilt:number;squash:number}&Record<Exclude<AvatarLayer,'torso'>,number>;
const restRig=():Rig=>({tilt:0,squash:0,head:0,'right-arm':0,'left-arm':0,'right-forearm':0,'left-forearm':0,'right-leg':0,'left-leg':0});
const keys=Object.keys(restRig()) as (keyof Rig)[];
type Resolver=(dx:number,dy:number,vx:number,vy:number)=>ReturnType<typeof resolveContacts>;
export function useRangeMotion(stage:RefObject<HTMLDivElement|null>,actor:RefObject<HTMLDivElement|null>,onImpact:(collision:Contact)=>void,resolve:Resolver){
 const [motion,setMotion]=useState<Motion>('idle');
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
 function place(x:number,y:number){
  position.current.x=x;
  position.current.y=y;
  // Pointer events can arrive faster than React paints. Keep the SVG measurements
  // in the same position as the physics before resolving the next event.
  if(actor.current)actor.current.style.translate=`${x}px ${y}px`;
 }
 function move(dx:number,dy:number,vx:number,vy:number){
  const result=resolver.current(dx,dy,vx,vy);
  const p=position.current;
  if(result.dx||result.dy)place(p.x+result.dx,p.y+result.dy);
  return result.contacts;
 }
 function confine(){
  if(active.current!=='idle'&&stage.current&&actor.current)move(0,0,0,0);
 }
 useLayoutEffect(confine);
 function targetVelocity(vx:number,vy:number){
  desired.current={...restRig(),tilt:limit(-vx*.014,-32,32),head:limit(vx*.019,-32,32),
   'right-arm':limit(vx*.024-vy*.012,-65,65),'left-arm':limit(vx*.024+vy*.012,-65,65),
   'right-forearm':limit(vx*.03+Math.abs(vy)*.01,-75,75),'left-forearm':limit(vx*.03-Math.abs(vy)*.01,-75,75),
   'right-leg':limit(vx*.019+vy*.008,-38,38),'left-leg':limit(vx*.019-vy*.008,-38,38)};
 }
 function impact(c:Contact){
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
    p.vy+=1500*dt;
    const contacts=move(p.vx*dt,p.vy*dt,p.vx,p.vy);
    for(const contact of contacts){
     if(contact.side==='left'||contact.side==='right')p.vx*=-.38;
     else if(contact.side==='ceiling')p.vy=Math.abs(p.vy)*.32;
     else{p.vy=p.vy<65?0:-p.vy*.24;p.vx*=.68;}
     impact(contact);
    }
    targetVelocity(p.vx,p.vy);
    if(now>settleAt.current){mode('returning');returnAt.current=now;desired.current=restRig();}
   }else if(active.current==='held'){
    if(drag.current&&now-drag.current.t>65){position.current.vx*=.85;position.current.vy*=.85;targetVelocity(position.current.vx,position.current.vy);}
   }else if(active.current==='returning'){
    const f=1-Math.exp(-dt*10);
    move(-position.current.x*f,-position.current.y*f,0,0);
    if(now-returnAt.current>600){place(0,0);position.current.vx=position.current.vy=0;mode('idle');}
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
  const vx=limit(dx/dt*1000,-2800,2800),vy=limit(dy/dt*1000,-2800,2800);
  position.current.vx=vx;position.current.vy=vy;
  move(dx,dy,vx,vy).forEach(impact);
  targetVelocity(vx,vy);
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
  const held=drag.current;
  drag.current=null;
  if(held&&actor.current?.hasPointerCapture(held.id))actor.current.releasePointerCapture(held.id);
  place(0,0);position.current.vx=position.current.vy=0;desired.current=restRig();mode('idle');startLoop();
 }
 function kick(direction:number){
  springs.current.tilt.velocity+=direction*120;springs.current.head.velocity-=direction*180;startLoop();
 }
 useEffect(()=>{
  const hide=()=>{if(document.hidden){drag.current=null;active.current='idle';desired.current=restRig();cancelAnimationFrame(frame.current);frame.current=0;for(const key of keys)springs.current[key]={value:0,velocity:0};setRig(restRig());setMotion('idle');place(0,0);position.current.vx=position.current.vy=0;}};
  const observer=new ResizeObserver(confine);
  if(stage.current)observer.observe(stage.current);
  document.addEventListener('visibilitychange',hide);
  return ()=>{observer.disconnect();cancelAnimationFrame(frame.current);document.removeEventListener('visibilitychange',hide);};
 },[]);
 const {tilt,squash,...joints}=rig;
 return {motion,tilt,squeezeAxis,squash:limit(squash,-.24,.13),joints:joints as AvatarJoints,grab,dragMove,release,reset,kick};
}
