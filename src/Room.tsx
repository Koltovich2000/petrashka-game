import {ToiletRearAvatar,ToiletScene,type ToiletPhase} from './ToiletScene';
import {ComputerScene} from './ComputerScene';
import {BathScene} from './BathScene';
import {BallScene} from './BallScene';
import {YogaScene} from './YogaScene';
import {SleepScene} from './SleepScene';
import {Dog,type DogBallPartner} from './Dog';
import type {DogMess} from './dogSchedule';
import {FoodPicture} from './FoodTray';
import type {FoodId} from './balance';
import {HallWindow,RoomWindow} from './RoomWindow';
import {roomLighting} from './roomLighting';
import {RoomObjects} from './RoomObjects';
import {activities,activityLocation,activityReason,locationLabels,BATH_READY_AT,type ActivityKind,type FurnitureId,type Location} from './activities';
import {HygieneEffects,PixelPoop,PixelPuddle} from './HygieneEffects';
import {statLimit,type Action,type Game} from './game';
import {beds} from './property';
import {remainingTime} from './GameEvents';
import type {CareMode} from './HomeScreen';
import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { PixelAvatar } from './PixelAvatar';
import type { Outfit } from './wardrobe';
import {hairWetness} from './hair';
import { advanceHeadStroke, bodyPart, reactions, type HeadStroke, type Hit } from './body';
import { sound, unlockSound, muteSound, isSoundMuted } from './sound';
import {playHitSound,prepareHitSound,stopHitSound} from './hitSound';
import {playRoomSound,prepareRoomSound} from './roomSoundEffects';
import { haptic } from './telegram';
import './room-scenes.css';
const floorMessSlots=[
 {x:.90,row:0},{x:.10,row:0},{x:.795,row:0},{x:.205,row:0},
 {x:.90,row:1},{x:.10,row:1},{x:.795,row:1},{x:.205,row:1},
];
function placeFloorMesses(playerMess:boolean,dogMesses:DogMess[],width:number,height:number){
 const remaining=[...floorMessSlots];
 const size=Math.round(Math.min(34,Math.max(21,width*.09)));
 const front=Math.max(45,height*.1);
 const rowGap=clamp(height*.08,20,size+5);
 const items=[...(playerMess?[null]:[]),...dogMesses];
 return items.map(mess=>{
  const preferred=mess&&remaining.findIndex(slot=>(slot.x<.5)===(mess.x<.5));
  const [slot]=remaining.splice(Math.max(0,preferred??0),1);
  return {mess,x:slot.x,bottom:front+slot.row*rowGap,size};
 });
}
const doorWalkMs=620;
const sleepWalkMs=740;
const toiletWalkMs=1500;
const toiletUseAt=2900;
const dumbbellApproachMs=820;
const dumbbellPickupMs=390;
const dumbbellGripAt=dumbbellApproachMs+dumbbellPickupMs;
const dumbbellReadyAt=dumbbellGripAt+dumbbellPickupMs;
const locations=[{id:'room',icon:'🛏️'},{id:'bathroom',icon:'🛁'},{id:'hallway',icon:'🚪'},{id:'hall',icon:'🧘'}] as const;
type Phase='idle'|'dragging'|'falling'|'landed'|'getting-up'|'walking'|'reacting'|'door';
type Motion={x:number;y:number;vx:number;vy:number;tilt:number;phase:Phase;elapsed:number;direction:number};
const resting=():Motion=>({x:0,y:0,vx:0,vy:0,tilt:0,phase:'idle',elapsed:0,direction:1});
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
interface Props {
 statHud:ReactNode; foodTray?:ReactNode; playTray?:ReactNode; location:Location; onLocationChange:(location:Location)=>void;onEnterRoom:()=>void;
 game:Game;onActivity:(kind:ActivityKind,dogMessAt?:number)=>void;onCancelActivity:()=>void;onMove:(id:FurnitureId,x:number,y:number)=>void;
 onWashStroke:(id:string)=>void;onBallReturn:(id:string)=>void;
 active:boolean; wallTime:number; hygiene:number; onWake:()=>void; outfit:Outfit; state:string; status:string; speech:string;
 speechAction?:{label:string;run:()=>void};
 effect:string; gain:string; particles:string[]; eatenFood:FoodId|null; sleeping:boolean; day:number;
 onBusy:(busy:boolean)=>void; careMode:CareMode|null; onCare:(action:Action)=>void; canSleep:boolean; canPet:boolean;
}
export function Room(p:Props){
 const {location}=p;
 const stage=useRef<HTMLElement>(null);const actor=useRef<HTMLDivElement>(null);const m=useRef(resting());const [motion,setMotion]=useState(resting);
 const dogBallPartner=useRef<DogBallPartner>(null);
 const floorMesses=useRef<HTMLDivElement>(null);
 const [roomSize,setRoomSize]=useState({width:0,height:0});
 const [muted,setMuted]=useState(isSoundMuted);const [hitCount,setHitCount]=useState(0);
 const [hit,setHit]=useState<Hit>('head');
 const [bathArrived,setBathArrived]=useState<string|null>(null);
 const [dumbbellClock,setDumbbellClock]=useState<{id:string;elapsed:number}|null>(null);
 const [toiletClock,setToiletClock]=useState<{id:string;elapsed:number}|null>(null);
 const [sleepWalking,setSleepWalking]=useState(false);
 const wasSleeping=useRef(p.sleeping);
 const props=useRef(p);props.current=p;
 const target=useRef({x:0,y:0});const pointer=useRef<{id:number;startX:number;startY:number;offsetX:number;offsetY:number;dragged:boolean;headStroke:HeadStroke|null;movedOnHead?:boolean;part:Hit}|null>(null);
 const hold=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const raf=useRef(0);
 function bounds(){const r=stage.current!.getBoundingClientRect();const size=actor.current!.offsetWidth;return {limit:Math.max(0,(r.width-size)/2),top:-Math.max(0,r.height-size-110),r};}
 function reset(){clearTimeout(hold.current);pointer.current=null;m.current=resting();target.current={x:0,y:0};setMotion({...m.current});props.current.onBusy(false);}
 function walkToDoor(){
  if(m.current.phase!=='idle'||pointer.current||location!=='hallway')return;
  m.current={...resting(),phase:'door'};
  setMotion({...m.current});p.onBusy(true);
 }
 useEffect(()=>{if(!p.active)reset();},[p.active]);
 useEffect(()=>{
  if(p.active&&!muted)for(const kind of ['footstep','eating'] as const)void prepareRoomSound(kind).catch(()=>{});
 },[p.active,muted]);
 useLayoutEffect(()=>{
  const justStarted=p.sleeping&&!wasSleeping.current;
  wasSleeping.current=p.sleeping;
  setSleepWalking(justStarted);
  if(!justStarted)return;
  const timer=window.setTimeout(()=>setSleepWalking(false),sleepWalkMs);
  return()=>window.clearTimeout(timer);
 },[p.sleeping]);
 function begin(){const ptr=pointer.current;if(!ptr||ptr.part==='head')return;ptr.dragged=true;m.current.phase='dragging';m.current.elapsed=0;props.current.onBusy(true);haptic();sound('lift');}
 function characterPart(e:PointerEvent<HTMLButtonElement>){
  const rect=e.currentTarget.getBoundingClientRect();
  return bodyPart((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);
 }
 function down(e:PointerEvent<HTMLButtonElement>){
  if(e.button!==0 || p.eatenFood || p.careMode==='feed' || pointer.current || (m.current.phase!=='idle'&&m.current.phase!=='reacting')||p.sleeping||p.game.roomAction||p.game.restUntil!==null||p.state==='faint')return;
  const zone=(e.target as HTMLElement).closest<HTMLElement>('[data-body]')?.dataset.body as Hit|undefined;
  const part=zone??characterPart(e);
  if(!part)return;
  prepareHitSound();
  e.currentTarget.setPointerCapture(e.pointerId);
  pointer.current={part,id:e.pointerId,startX:e.clientX,startY:e.clientY,offsetX:m.current.x-e.clientX,offsetY:m.current.y-e.clientY,
   dragged:false,headStroke:part==='head'?{start:{x:e.clientX,y:e.clientY},direction:null}:null};
  target.current={x:m.current.x,y:m.current.y};
  if(part!=='head'&&!p.careMode)hold.current=setTimeout(begin,300);
 }
 function move(e:PointerEvent<HTMLButtonElement>){
  const ptr=pointer.current;
  if(!ptr||ptr.id!==e.pointerId)return;
  if(ptr.part==='head'){
   if(Math.hypot(e.clientX-ptr.startX,e.clientY-ptr.startY)>6)ptr.movedOnHead=true;
   if(characterPart(e)!=='head'||!p.canPet||p.careMode){ptr.headStroke=null;return;}
   const point={x:e.clientX,y:e.clientY};
   ptr.headStroke??={start:point,direction:null};
   if(advanceHeadStroke(ptr.headStroke,point,clamp(e.currentTarget.clientWidth*.1,12,24))){
    if(m.current.phase==='reacting'){m.current=resting();setMotion({...m.current});p.onBusy(false);}
    p.onCare('pet');
   }
   return;
  }
  if(!ptr.dragged&&p.careMode)return;
  if(!ptr.dragged&&Math.hypot(e.clientX-ptr.startX,e.clientY-ptr.startY)>6){clearTimeout(hold.current);begin();}
  if(ptr.dragged){const b=bounds();target.current={x:clamp(e.clientX+ptr.offsetX,-b.limit,b.limit),y:clamp(e.clientY+ptr.offsetY,b.top,0)};}
 }
 function release(e:PointerEvent<HTMLButtonElement>){const ptr=pointer.current;if(!ptr||ptr.id!==e.pointerId)return;clearTimeout(hold.current);pointer.current=null;
  const rect=stage.current?.getBoundingClientRect();
  const atBed=rect&&location==='room'&&e.clientX<rect.left+rect.width*.31&&e.clientX>=rect.left&&e.clientY>rect.top+rect.height*.38&&e.clientY<rect.top+rect.height*.87;
  if(ptr.dragged&&e.type==='pointerup'&&atBed&&p.canSleep){
   reset();p.onCare('sleep');return;
  }
  if(ptr.dragged){m.current.x=target.current.x;m.current.y=target.current.y;m.current.phase='falling';m.current.vx=0;m.current.vy=Math.max(0,m.current.vy);m.current.elapsed=0;setMotion({...m.current});}
  if(!ptr.dragged&&e.type==='pointerup'&&(ptr.part!=='head'||Math.hypot(e.clientX-ptr.startX,e.clientY-ptr.startY)<=6&&!ptr.movedOnHead))touchCharacter(ptr.part);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 }
 function touchCharacter(part:Hit){
  if(!part||p.sleeping||p.game.roomAction||p.game.restUntil!==null||p.state==='faint')return;
  if(!p.careMode)react(part);
 }
 function react(part:Hit|null){if(!part||(m.current.phase!=='idle'&&m.current.phase!=='reacting')||props.current.sleeping||props.current.game.roomAction||props.current.game.restUntil!==null||props.current.state==='faint')return;setHitCount(n=>n+1);playHitSound();setHit(part);m.current.phase='reacting';m.current.elapsed=0;props.current.onBusy(true);setMotion({...m.current});haptic();}
 useEffect(()=>{let previous=performance.now();
  const frame=(now:number)=>{const dt=Math.min((now-previous)/1000,.032);previous=now;const s=m.current;s.elapsed+=dt;
   if(s.phase==='door'&&s.elapsed>=doorWalkMs/1000){reset();props.current.onEnterRoom();}
   else if(s.phase==='reacting'&&s.elapsed>1.3){m.current=resting();props.current.onBusy(false);}
   else if(s.phase==='dragging'){
    s.vx+=(target.current.x-s.x)*95*dt;s.vy+=(target.current.y-s.y)*95*dt;s.vx*=Math.exp(-11*dt);s.vy*=Math.exp(-11*dt);s.x+=s.vx*dt;s.y+=s.vy*dt;s.tilt+=(clamp(-s.vx*.065,-28,28)-s.tilt)*Math.min(1,dt*10);
   }else if(s.phase==='falling'){
    s.vy+=1500*dt;s.y+=s.vy*dt;s.tilt*=Math.exp(-4*dt);
    if(s.y>=0){s.y=0;s.vy=0;s.tilt=0;s.phase='landed';s.elapsed=0;haptic();sound('fall');}
   }else if(s.phase==='landed'&&s.elapsed>.65){s.phase='getting-up';s.elapsed=0;}
   else if(s.phase==='getting-up'&&s.elapsed>.95){s.phase='walking';s.direction=s.x>0?1:-1;s.elapsed=0;}
   else if(s.phase==='walking'){
    const step=95*dt;if(Math.abs(s.x)<=step){m.current=resting();props.current.onBusy(false);}else s.x-=Math.sign(s.x)*step;
   }
   if(s.phase!=='idle'||motionPhase.current!=='idle'){setMotion({...m.current});motionPhase.current=m.current.phase;}
   raf.current=requestAnimationFrame(frame);
  };raf.current=requestAnimationFrame(frame);
  const cancel=()=>reset();window.addEventListener('blur',cancel);const visibility=()=>{if(document.hidden)reset();};document.addEventListener('visibilitychange',visibility);
  const resize=new ResizeObserver(()=>{
   if(m.current.phase!=='idle')reset();
   if(stage.current)setRoomSize({width:stage.current.clientWidth,height:stage.current.clientHeight});
  });if(stage.current)resize.observe(stage.current);
  return()=>{cancelAnimationFrame(raf.current);clearTimeout(hold.current);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',visibility);resize.disconnect();};
 },[]);
 const motionPhase=useRef<Phase>('idle');
 useEffect(()=>{if(p.sleeping||p.game.roomAction||p.game.restUntil!==null||p.state==='faint')reset();},[p.sleeping,p.state,p.game.roomAction?.id,p.game.restUntil]);
 useEffect(()=>{if(p.game.roomAction)select(activityLocation(p.game.roomAction),true);},[p.game.roomAction?.id]);

 const activeAction=p.game.roomAction;
 const actionKind=activeAction?.kind;
 const toiletAction=location==='bathroom'&&actionKind==='toilet'?activeAction:null;
 const toiletId=toiletAction?.id,toiletStarted=toiletAction?.started;
 useLayoutEffect(()=>{
  if(toiletId===undefined||toiletStarted===undefined||!p.active)return;
  const id=toiletId,started=toiletStarted;
  const origin=performance.now()-Math.max(0,props.current.game.updated-started);
  let timer:number|undefined;
  function sync(){
   const elapsed=performance.now()-origin;
   setToiletClock({id,elapsed});
   const next=elapsed<toiletWalkMs?toiletWalkMs:elapsed<toiletUseAt?toiletUseAt:undefined;
   if(next!==undefined)timer=window.setTimeout(sync,next-elapsed);
  }
  sync();
  return()=>window.clearTimeout(timer);
 },[toiletId,toiletStarted,p.active]);
 const bathAction=activeAction?.kind==='bath'?activeAction:null;
 const yogaAction=location==='hall'&&activeAction?.kind==='yoga'&&p.state!=='faint'?activeAction:null;
 const dumbbellAction=location==='hall'&&activeAction?.kind==='dumbbells'&&p.state!=='faint'?activeAction:null;
 const dumbbellElapsed=dumbbellAction&&dumbbellClock?.id===dumbbellAction.id?dumbbellClock.elapsed:0;
 const dumbbellPhase=dumbbellAction?(dumbbellElapsed<dumbbellApproachMs?'approach':dumbbellElapsed<dumbbellGripAt?'reach':dumbbellElapsed<dumbbellReadyAt?'stand':'lift'):null;
 const holdingDumbbells=dumbbellPhase==='stand'||dumbbellPhase==='lift';
 const training=Boolean(yogaAction||dumbbellAction);
 useLayoutEffect(()=>{
  if(!dumbbellAction||!p.active)return;
  const {id,started}=dumbbellAction;
  let timer:number|undefined;
  function sync(){
   const elapsed=Math.max(0,Date.now()-started);
   setDumbbellClock({id,elapsed});
   const next=[dumbbellApproachMs,dumbbellGripAt,dumbbellReadyAt].find(boundary=>boundary>elapsed);
   if(next!==undefined)timer=window.setTimeout(sync,next-elapsed);
  }
  sync();
  return()=>window.clearTimeout(timer);
 },[dumbbellAction,p.active]);
 const bathSoaking=Boolean(bathAction&&location==='bathroom'&&(bathArrived===bathAction.id||Date.now()-bathAction.started>=BATH_READY_AT));
 const bathWalking=Boolean(bathAction&&location==='bathroom'&&!bathSoaking);
 const doorWalking=motion.phase==='door';
 useEffect(()=>{
  if(!bathAction||!p.active||location!=='bathroom')return;
  const foam=new Image();
  foam.src='/assets/bath-foam-room.png';
  const timer=window.setTimeout(()=>setBathArrived(bathAction.id),Math.max(0,bathAction.started+BATH_READY_AT-Date.now()));
  return()=>window.clearTimeout(timer);
 },[bathAction,p.active,location]);
 const asleep=p.sleeping&&!sleepWalking;
 const sceneWalking=bathWalking||doorWalking||sleepWalking||dumbbellPhase==='approach';
 const {restUntil,updated}=p.game;
 const energyLimit=statLimit(p.game,'energy');
 const sleepRecoveryMs=Math.round((energyLimit-p.game.energy)*3_600_000/beds[p.game.bed].energy);
 const wetness=hairWetness(p.game);
 const statusEnd=activeAction?.ends ?? restUntil ?? undefined;
 const statusLabel=actionKind?activities[actionKind].name:'Петрашка отдыхает';
 const secondsLeft=statusEnd===undefined?0:Math.max(0,Math.ceil((statusEnd-updated)/1000));
 const showActivity=p.state!=='faint'&&(activeAction?.ends===null||secondsLeft>0);
 const elapsed=activeAction?Math.max(0,updated-activeAction.started):0;
 const toiletElapsed=toiletClock&&toiletClock.id===toiletId?toiletClock.elapsed:elapsed;
 const toiletPhase:ToiletPhase|null=toiletAction?(toiletElapsed<toiletWalkMs?'approach':toiletElapsed<toiletUseAt?'open':'use'):null;
 const toiletOnFloor=toiletPhase!==null;
 const cleaning=actionKind==='clean';
 const approaching=toiletPhase?toiletPhase==='approach':bathAction?bathWalking:activeAction&&actionKind!=='dumbbells'&&elapsed<(cleaning?650:1500);
 const scrubbing=cleaning&&!approaching;
 const cleanupReason=activityReason(p.game,'clean',location);
 const dogMesses=(p.game.dogCare?.messes??[]).filter(mess=>mess.location===location);
 const hasMesses=Boolean(p.game.floorMess[location]||dogMesses.length);
 const messPositions=placeFloorMesses(Boolean(p.game.floorMess[location]),dogMesses,roomSize.width,roomSize.height);
 const cleanupPoint=cleaning?messPositions.find(point=>point.mess?.at===activeAction?.cleanupDogMessAt):undefined;
 const cleanFacing=cleanupPoint&&cleanupPoint.x<.5?-1:1;
 const objectPoint=actionKind&&actionKind!=='yoga'&&p.game.furniture[actionKind as FurnitureId];
 const roomWidth=stage.current?.clientWidth??0;
 const roomHeight=stage.current?.clientHeight??0;
 const ballStep=clamp(roomWidth*.055,16,42);
 // Leave room for the raised right boot and the ball when stepping toward the left edge.
 const ballX=roomWidth?Math.max(.30,((actor.current?.clientWidth??0)*.36+ballStep+43)/roomWidth):.30;
 const activityX=objectPoint?objectPoint.x:actionKind==='computer'?.76:actionKind==='ball'?ballX:p.sleeping?.23:.5;
 const activityY=cleanupPoint?49-cleanupPoint.bottom:
  roomHeight*(objectPoint?objectPoint.y-.90:actionKind==='computer'?-.08:p.sleeping?-.12:0);
 const activityOffset=cleanupPoint
  ?roomWidth*(cleanupPoint.x-.5)-cleanFacing*(actor.current?.clientWidth??0)*.28
  :roomWidth*(activityX-.5);
 const walkStyle=sceneWalking?{
  '--walk-x':`${dumbbellPhase==='approach'?activityOffset:roomWidth*(sleepWalking?-.28:doorWalking?.365:.21)}px`,
  '--walk-y':`${dumbbellPhase==='approach'?activityY:Math.min(0,55-roomHeight*(doorWalking?.27:.19))}px`,
  '--walk-scale':dumbbellPhase==='approach'?1:doorWalking?.64:.84,
  '--walk-duration':`${dumbbellPhase==='approach'?dumbbellApproachMs:sleepWalking?sleepWalkMs:doorWalking?doorWalkMs:BATH_READY_AT}ms`,
  '--walk-delay':`${dumbbellPhase==='approach'?-dumbbellElapsed:0}ms`,
 } as CSSProperties:undefined;
 const roomStyle=dumbbellPhase?{
  ...walkStyle,'--pickup-duration':`${dumbbellPickupMs}ms`,
  '--pickup-delay':`${Math.min(0,(dumbbellPhase==='stand'?dumbbellGripAt:dumbbellApproachMs)-dumbbellElapsed)}ms`,
 } as CSSProperties:actionKind==='ball'?{'--ball-step-size':`${ballStep}px`} as CSSProperties:toiletOnFloor?{
  '--toilet-walk-duration':`${toiletWalkMs}ms`,'--toilet-walk-delay':`${-toiletElapsed}ms`,
  '--toilet-lift-duration':`${toiletUseAt-toiletWalkMs}ms`,'--toilet-lift-delay':`${-Math.max(0,toiletElapsed-toiletWalkMs)}ms`,
 } as CSSProperties:walkStyle;
 const busy=motion.phase!=='idle';
 const trackMessOverlap=busy||sceneWalking||Boolean(activeAction);
 const messIds=dogMesses.map(mess=>mess.at).join(',');
 useLayoutEffect(()=>{
  const layer=floorMesses.current,mascot=actor.current?.querySelector('.mascot');
  if(!p.active||!hasMesses||!layer||!mascot)return;
  let frame=0;
  function update(){
   const body=mascot!.getBoundingClientRect();
   const bodyInset=body.width*.18;
   const visible=getComputedStyle(mascot!).visibility==='visible';
   const covered=Array.from(layer!.querySelectorAll('button'),button=>{
    const mark=button.getBoundingClientRect();
    return {button,hide:visible&&!button.classList.contains('scrubbing')&&
     mark.right+10>body.left+bodyInset&&mark.left-10<body.right-bodyInset&&
     mark.bottom+10>body.top&&mark.top-10<body.bottom};
   });
   for(const {button,hide} of covered)button.toggleAttribute('data-covered',hide);
   if(trackMessOverlap)frame=requestAnimationFrame(update);
  }
  update();
  return()=>cancelAnimationFrame(frame);
 },[p.active,location,hasMesses,p.game.floorMess[location],messIds,roomSize,trackMessOverlap,asleep]);
 const eatingFood=!busy&&!activeAction&&!p.sleeping&&p.state!=='faint'?p.eatenFood:null;
 const avatarPose=sceneWalking||approaching?'walking':toiletPhase==='open'?'idle':dumbbellPhase==='reach'?'dumbbell-reach':dumbbellPhase==='stand'?'dumbbell-stand':eatingFood?'eating':actionKind??motion.phase;
 function stepSound(event:AnimationEvent<HTMLElement>){
  if(!p.active||muted||event.animationName!=='leg-step'||!(event.target instanceof SVGElement))return;
  const leg=event.target;
  if(!leg.matches('.leg')||!leg.closest('.pose-walking,.pose-carry')||getComputedStyle(leg).visibility!=='visible')return;
  // The left foot starts halfway through the cycle and lands at its first iteration.
  if(event.type==='animationstart'&&!leg.matches('.leg-right'))return;
  playRoomSound('footstep');
 }
 const phaseText={idle:actionKind?activities[actionKind].name+'…':p.speech,dragging:'А-а-а! Осторожнее! 😳',falling:'Ой, падаю!',landed:'Упс… Я в порядке!', 'getting-up':'Сейчас, сейчас… встаю!',walking:'Топ-топ… обратно в центр',reacting:reactions[hit].text,door:'Идёт в комнату'}[motion.phase];
 function select(id:Location,force=false){if(!force&&(p.game.roomAction||m.current.phase==='door'||sleepWalking))return;reset();p.onLocationChange(id);}
 return <><section ref={stage} className={'room photo-room '+(!sceneWalking&&p.playTray?' choosing-play':'')+(sceneWalking?' scene-walk':'')+(sleepWalking?' sleep-walk':'')+(asleep?' sleeping-in-bed':'')+(bathSoaking?' bath-phase-soak':'')+(toiletPhase?' toilet-phase-'+toiletPhase:'')+(actionKind==='computer'&&!approaching?' computer-playing':'')+(actionKind==='ball'?' ball-playing':'')+(yogaAction?' yoga-active':'')} style={roomStyle} aria-label="Комната Петрашки" data-location={location} data-lighting={roomLighting(updated)} data-dumbbells={dumbbellPhase??undefined} onAnimationStart={stepSound} onAnimationIteration={stepSound}>
 <RoomObjects game={p.game} location={location} onActivity={p.onActivity} onSleep={()=>p.onCare('sleep')} onWake={p.onWake} onMove={p.onMove} onDoor={walkToDoor} doorDisabled={busy} holdingDumbbells={holdingDumbbells}/>
 <div className="location-photo pixel-location" role="img" aria-label={locationLabels[location]}/>
 {location==='room'&&<RoomWindow/>}
 {location==='hall'&&<HallWindow/>}
 <div className="room-light" aria-hidden="true"/>
 {p.game.dog&&<Dog updated={updated} wallTime={p.wallTime} location={location} active={p.active} ballPartner={dogBallPartner}/>}
 {asleep&&location==='room'&&<SleepScene outfit={p.outfit} wetness={wetness}/>}
 {asleep&&<div className="sleep-controls">
  <span className="sleep-recovery">{sleepRecoveryMs>0
   ?<>До {energyLimit}% энергии <span role="timer">{remainingTime(updated+sleepRecoveryMs,updated)}</span></>
   :'Энергия восстановилась'}</span>
  <button type="button" className="wake-button" onClick={p.onWake}>☀ Разбудить</button>
 </div>}
 <span className="scene-day">День {p.day}</span>
 {actionKind==='computer'&&!approaching&&<ComputerScene elapsed={elapsed} wetness={wetness}/>}
 {bathSoaking&&bathAction&&p.active&&p.state!=='faint'&&<BathScene key={bathAction.id} onScrub={()=>p.onWashStroke(bathAction.id)} onFinish={p.onCancelActivity}/>}
 {toiletPhase&&<ToiletScene phase={toiletPhase} active={p.active} muted={muted}/>}
 {yogaAction&&p.active&&p.game.furniture.yoga&&<YogaScene key={yogaAction.id} started={yogaAction.started} seed={yogaAction.yogaSeed} stored={p.game.furniture.yoga} outfit={p.outfit} hygiene={p.hygiene} wetness={wetness}/>}
 {toiletPhase&&showActivity&&<div className="bath-countdown">
  <strong>{toiletPhase==='approach'?'Идёт к унитазу':toiletPhase==='open'?'Поднимает крышку':'В туалете'}</strong>
  <span role="timer" aria-label="До конца посещения туалета">{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</span>
  <button type="button" className="cancel-activity" onClick={p.onCancelActivity}>Отменить</button>
 </div>}
 <button className="sound-toggle" aria-label={muted?'Включить звук':'Выключить звук'} onClick={()=>{setMuted(!muted);muteSound(!muted);if(!muted)stopHitSound();else unlockSound();}}>{muted?'🔇':'🔊'}</button>
 {p.statHud}
 {hasMesses&&<div ref={floorMesses} className="floor-messes">{messPositions.map(point=>{
  const {mess,x,bottom,size}=point;
  const reason=mess?activityReason(p.game,'clean',location,mess.at):cleanupReason;
  const label=mess?.kind==='pee'?'Вытереть лужу за собакой':mess?'Убрать кучку за собакой':'Убрать какашки с пола';
  const isScrubbing=scrubbing&&cleanupPoint===point;
  return <button key={mess?.at??'player'} type="button" className={`floor-mess${mess?' dog-mess':''}${isScrubbing?' scrubbing':''}`}
   style={{left:`${x*100}%`,bottom,width:size,height:size}} aria-label={label} title={reason||label}
   disabled={busy||Boolean(reason)} onClick={()=>p.onActivity('clean',mess?.at)}>
   {mess?.kind==='pee'?<PixelPuddle/>:<PixelPoop/>}{isScrubbing&&<><i/><i/></>}
  </button>;
 })}</div>}
 <div className="floor-shadow" aria-hidden="true" style={{transform:toiletOnFloor?undefined:`translate(calc(-50% + ${motion.x+(actionKind==='ball'||actionKind==='dumbbells'?activityOffset:0)}px),${actionKind==='dumbbells'?activityY:0}px) scale(${Math.max(.45,1+motion.y/400)})`,opacity:Math.max(.15,.55+motion.y/500)}}/>
 <div ref={actor} className={'actor-position motion-'+motion.phase+(actionKind?' activity-'+actionKind:'')+(p.sleeping?' activity-sleep':'')+(p.state==='faint'?' is-dead':'')} style={{'--x':`${motion.x+activityOffset}px`,'--y':`${motion.y+activityY}px`,'--tilt':`${motion.tilt}deg`,'--direction':motion.direction,'--clean-facing':cleanFacing,'--hit-x':`${(reactions[hit].cell%3)*50}%`,'--hit-y':`${Math.floor(reactions[hit].cell/3)*50}%`} as CSSProperties}>
 {showActivity&&!bathAction&&!toiletPhase&&<div className={`actor-activity${training?' training-cancel':''}`}>
  {!training&&<><strong>{statusLabel}</strong>
  {activeAction?.kind==='ball'
   ?<span aria-live="polite">Возвраты мяча {activeAction.returns}</span>
   :<span role="timer" aria-label="Осталось">{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</span>}</>}
  <button type="button" className="cancel-activity" onClick={p.onCancelActivity}>{activeAction?.kind==='ball'?'Закончить':'Отменить'}</button>
 </div>}
 {p.state!=='faint'&&!showActivity&&!sceneWalking&&!asleep&&(busy||['hungry','sick','dirty','tired','sad'].includes(p.state)||p.speech!==p.status)&&
  <div className="speech" aria-live="polite">
   {!busy&&p.speechAction?<button type="button" className="speech-action" aria-label={p.speechAction.label} onClick={p.speechAction.run}>{phaseText}</button>:phaseText}
  </div>}
 <button disabled={p.state==='faint'} className={`mascot ${p.state} ${busy?'':p.effect}`} aria-label="Петрашка: проведите по голове туда и обратно, чтобы погладить, или потяните за туловище, чтобы поднять" onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={e=>e.preventDefault()} onClick={e=>{if(e.detail===0&&!busy&&p.canPet&&!p.careMode)p.onCare('pet');}}>
 <span key={dumbbellPhase??(p.effect==='pet'?`pet-${p.game.cares}`:hitCount)} className="layered-character" role="img" aria-label={`Петрашка: ${busy?phaseText:p.status}`}>
  {toiletPhase==='use'?<ToiletRearAvatar outfit={p.outfit} wetness={wetness}/>
   :<PixelAvatar outfit={p.outfit} state={actionKind==='ball'||sleepWalking||eatingFood?'happy':p.state} pose={avatarPose} hit={hit} hygiene={p.hygiene} wetness={wetness}/>}
 </span>
 {eatingFood&&<span className="eating-food" aria-hidden="true">
  <FoodPicture id={eatingFood}/>
  <span className="food-crumbs"><i/><i/><i/><i/></span>
 </span>}
 {(!busy||motion.phase==='reacting')&&(['head','belly','legs','right-arm','left-arm','right-foot','left-foot'] as Hit[]).map(part=><span key={part} data-body={part} className={'body-zone zone-'+part} aria-hidden="true"/>)}</button>
 {p.foodTray&&<span className="feed-mouth-target" aria-hidden="true"/>}
 <HygieneEffects hygiene={p.hygiene}/>
 {actionKind==='computer'&&!approaching&&<span className="screen-spark" aria-hidden="true">✦</span>}
 {actionKind==='tray'&&<span className="toilet-spark" aria-hidden="true">· · ·</span>}
 {motion.phase==='dragging'&&<span className="fright" aria-hidden="true">!</span>}
 </div>
 {p.active&&location==='hallway'&&activeAction?.kind==='ball'&&!approaching&&
  <BallScene key={activeAction.id} actor={actor} dogPartner={dogBallPartner} round={activeAction.returns} onReturn={()=>p.onBallReturn(activeAction.id)}/>}
 {!busy&&!p.sleeping&&p.particles.length>0&&<div key={p.effect==='pet'?p.game.cares:p.effect} className={'particles '+p.effect} aria-hidden="true">{p.particles.map((symbol,i)=><span key={i}>{symbol}</span>)}</div>}
 {!busy&&!p.sleeping&&p.gain&&<div className="effect-gain" role="status">{p.gain}</div>}
 {!sceneWalking&&p.foodTray}
 {!sceneWalking&&p.playTray}
 <nav className="locations" aria-label="Локации">{locations.map(l=><button key={l.id} data-guide-location={l.id} aria-pressed={location===l.id} disabled={Boolean(activeAction)||doorWalking||sleepWalking} onClick={()=>select(l.id)}><span aria-hidden="true">{l.icon}</span>{locationLabels[l.id]}</button>)}</nav></section></>;
}
