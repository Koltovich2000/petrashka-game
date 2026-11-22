import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent,type RefObject} from 'react';
import type {AvatarLayer} from './PixelAvatar';
import {limit} from './rangePhysics';
import type {Contact,resolveContacts} from './rangeContacts';
import {joltRig,loosePose,restRig,restSprings,rigStep} from './rangeRig';

type Motion='idle'|'held'|'flying'|'returning';
type Grip={id:number;x:number;y:number;t:number;layer:AvatarLayer;anchorX:number;anchorY:number;surface:SVGGElement};
type Resolver=(dx:number,dy:number,vx:number,vy:number)=>ReturnType<typeof resolveContacts>;
export type TrapMotion={
 launch:(vx:number,vy:number,spin:number)=>void;
 gust:(dt:number,surge:boolean)=>void;
 press:(speed:number)=>void;
};
type FrameEffect=(now:number,dt:number,motion:TrapMotion)=>boolean;
export function useRangeMotion(stage:RefObject<HTMLDivElement|null>,actor:RefObject<HTMLDivElement|null>,
 onImpact:(collision:Contact,trapDriven:boolean)=>void,resolve:Resolver,onFrame:FrameEffect){
 const [motion,setMotion]=useState<Motion>('idle');
 const [rig,setRig]=useState(restRig);
 const [squeezeAxis,setSqueezeAxis]=useState<'horizontal'|'vertical'>('vertical');
 const springs=useRef<ReturnType<typeof restSprings>>(null);
 springs.current??=restSprings();
 const desired=useRef(restRig());
 const active=useRef<Motion>('idle');
 const position=useRef({x:0,y:0,vx:0,vy:0});
 const drag=useRef<Grip|null>(null);
 const frame=useRef(0),settleAt=useRef(0),returnAt=useRef(0);
 const roll=useRef({angle:0,speed:0});
 const trapDriven=useRef(false);
 const resolver=useRef(resolve);
 resolver.current=resolve;
 const impacts=useRef(onImpact);impacts.current=onImpact;
 const effect=useRef(onFrame);effect.current=onFrame;
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
  if(active.current==='idle'||!stage.current||!actor.current)return;
  const grip=drag.current;
  const matrix=grip?.surface.getScreenCTM();
  if(grip&&matrix){
   // Keep the touched point under the pointer as the rest of the body swings.
   const point=new DOMPoint(grip.anchorX,grip.anchorY).matrixTransform(matrix);
   if(Number.isFinite(point.x)&&Number.isFinite(point.y)){
    const body=actor.current.getBoundingClientRect();
    actor.current.style.setProperty('--range-grip-x',`${point.x-body.left}px`);
    actor.current.style.setProperty('--range-grip-y',`${point.y-body.top}px`);
    move(grip.x-point.x,grip.y-point.y,0,0);
   }
  }else move(0,0,0,0);
 }
 useLayoutEffect(confine);
 function targetVelocity(vx:number,vy:number){
  desired.current=loosePose(vx,vy,roll.current.angle,roll.current.speed,springs.current!.squash.value,drag.current?.layer);
 }
 function impact(c:Contact){
  if(c.speed<140){
   if(active.current==='held'&&c.boundary)impacts.current(c,trapDriven.current);
   return;
  }
  const horizontal=c.side==='left'||c.side==='right';
  const sign=horizontal?(c.side==='left'?1:-1):c.x<(stage.current?.clientWidth??1)/2?1:-1;
  const impulse=limit(c.speed/19,8,90);
  setSqueezeAxis(horizontal?'horizontal':'vertical');
  joltRig(springs.current!,c.layer??c.part,impulse,sign,!horizontal);
  if(active.current==='flying'&&c.speed>330){
   roll.current.speed=limit(roll.current.speed*(horizontal?-.67:.65)+sign*impulse*2.7,-780,780);
  }
  impacts.current(c,trapDriven.current);
 }
 function levelRoll(){
  const tilt=springs.current!.tilt;
  tilt.value-=Math.round(tilt.value/360)*360;
  roll.current={angle:0,speed:0};
 }
 function releaseGrip(){
  const held=drag.current;
  drag.current=null;
  if(held&&actor.current?.hasPointerCapture(held.id))actor.current.releasePointerCapture(held.id);
 }
 function startTrapFlight(){
  if(active.current!=='flying')mode('flying');
  trapDriven.current=true;
  settleAt.current=performance.now()+1450;
 }
 const trapMotion:TrapMotion={
  launch(vx,vy,spin){
   releaseGrip();
   startTrapFlight();
   const p=position.current;
   p.vx=limit(p.vx*.6+vx,-1950,1950);
   p.vy=limit(Math.min(p.vy,210)+vy,-1500,1700);
   roll.current.speed=limit(roll.current.speed+spin,-760,760);
   joltRig(springs.current!,'torso',31,Math.sign(vx)||1,true);
  },
  gust(dt,surge){
   if(active.current==='held')return;
   startTrapFlight();
   const p=position.current;
   p.vx=limit(p.vx+1920*dt+(surge?700:0),-1120,1120);
   p.vy=limit(p.vy-1050*dt-(surge?250:0),-950,950);
   roll.current.speed=limit(roll.current.speed+630*dt+(surge?410:0),-600,600);
  },
  press(speed){
   releaseGrip();
   startTrapFlight();
   position.current.vx*=.25;
   position.current.vy=speed;
   roll.current.speed*=.3;
   setSqueezeAxis('vertical');
   const squash=springs.current!.squash;
   squash.value=-.31;
   squash.velocity=0;
  },
 };
 function startLoop(){
  if(frame.current)return;
  let last=performance.now();
  const step=(now:number)=>{
   frame.current=0;
   if(!stage.current||!actor.current)return;
   const dt=limit((now-last)/1000,0,.04);last=now;
   const engage=effect.current(now,dt,trapMotion);
   if(active.current==='flying'){
    const p=position.current;
    p.vy+=1500*dt;
    roll.current.angle+=roll.current.speed*dt;
    roll.current.speed*=Math.exp(-1.55*dt);
    const contacts=move(p.vx*dt,p.vy*dt,p.vx,p.vy);
    for(const contact of contacts){
     if(contact.side==='left'||contact.side==='right')p.vx*=-.38;
     else if(contact.side==='ceiling')p.vy=Math.abs(p.vy)*.32;
     else{p.vy=p.vy<65?0:-p.vy*.29;p.vx*=.68;}
     impact(contact);
    }
    targetVelocity(p.vx,p.vy);
    if(now>settleAt.current){mode('returning');returnAt.current=now;levelRoll();desired.current=restRig();}
   }else if(active.current==='held'){
    if(drag.current&&now-drag.current.t>42){
     const decay=Math.exp(-dt*12);
     position.current.vx*=decay;position.current.vy*=decay;
    }
    targetVelocity(position.current.vx,position.current.vy);
   }else if(active.current==='returning'){
    const f=1-Math.exp(-dt*10);
    move(-position.current.x*f,-position.current.y*f,0,0);
    if(now-returnAt.current>600){place(0,0);position.current.vx=position.current.vy=0;trapDriven.current=false;mode('idle');}
   }
   const {rig:next,moving}=rigStep(springs.current!,desired.current,dt);
   if(active.current!=='idle'||moving)setRig(next);
   else setRig(current=>Object.values(current).some(value=>value!==0)?restRig():current);
   if(active.current!=='idle'||moving||engage)frame.current=requestAnimationFrame(step);
  };
  frame.current=requestAnimationFrame(step);
 }
 function grab(event:PointerEvent<HTMLDivElement>,layer:AvatarLayer,anchorX:number,anchorY:number){
  if(drag.current)return;
  const surface=actor.current?.querySelector<SVGGElement>(`[data-avatar-layer="${layer}"]`);
  if(!surface)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,t:performance.now(),layer,anchorX,anchorY,surface};
  levelRoll();trapDriven.current=false;
  position.current.vx=position.current.vy=0;targetVelocity(0,0);mode('held');startLoop();
 }
 function dragMove(event:PointerEvent<HTMLDivElement>){
  const held=drag.current;if(!held||held.id!==event.pointerId)return;
  const now=performance.now(),dt=Math.max(8,now-held.t),dx=event.clientX-held.x,dy=event.clientY-held.y;
  const vx=limit(dx/dt*1000,-2800,2800),vy=limit(dy/dt*1000,-2800,2800);
  position.current.vx=vx;position.current.vy=vy;
  move(dx,dy,vx,vy).forEach(impact);
  targetVelocity(vx,vy);
  held.x=event.clientX;held.y=event.clientY;held.t=now;
 }
 function release(event:PointerEvent<HTMLDivElement>,cancel=false){
  const held=drag.current;if(!held||held.id!==event.pointerId)return;
  drag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(cancel){reset();return;}
  if(performance.now()-held.t>112)position.current.vx=position.current.vy=0;
  const tilt=springs.current!.tilt;
  roll.current={angle:tilt.value,speed:limit(tilt.velocity*.66-position.current.vx*.12,-460,460)};
  mode('flying');settleAt.current=performance.now()+1600;startLoop();
 }
 function reset(){
  releaseGrip();roll.current={angle:0,speed:0};trapDriven.current=false;
  springs.current=restSprings();desired.current=restRig();setRig(restRig());
  place(0,0);position.current.vx=position.current.vy=0;mode('idle');startLoop();
 }
 function kick(layer:AvatarLayer,direction:number,strength:number){
  setSqueezeAxis('horizontal');
  joltRig(springs.current!,layer,strength,direction,false);
  startLoop();
 }
 useEffect(()=>{
  const hide=()=>{if(document.hidden){releaseGrip();levelRoll();trapDriven.current=false;active.current='idle';desired.current=restRig();cancelAnimationFrame(frame.current);frame.current=0;springs.current=restSprings();setRig(restRig());setMotion('idle');place(0,0);position.current.vx=position.current.vy=0;}};
  const observer=new ResizeObserver(confine);
  if(stage.current)observer.observe(stage.current);
  document.addEventListener('visibilitychange',hide);
  return ()=>{observer.disconnect();cancelAnimationFrame(frame.current);document.removeEventListener('visibilitychange',hide);};
 },[]);
 const {tilt,squash,...joints}=rig;
 function onWeaponChange(keepMotion:boolean){
  if(!keepMotion&&!trapDriven.current){reset();return;}
  if(!drag.current)return;
  releaseGrip();
  mode('flying');settleAt.current=performance.now()+1600;startLoop();
 }
 return {motion,tilt,squeezeAxis,squash,joints,grab,dragMove,release,reset,kick,startLoop,onWeaponChange};
}
