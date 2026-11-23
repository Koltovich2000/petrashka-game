import {useEffect,useImperativeHandle,useLayoutEffect,useRef,useState,type CSSProperties,type Ref} from 'react';
import type {Location} from './activities';
import {dogPointAt,dogRoute,measureDogRoute,type GroundPoint} from './dogNavigation';
import {dogIsSleepingAt,dogVisitAt,dogVisitDuration} from './dogSchedule';
import {unlockSound} from './sound';
import {playRoomSound,prepareRoomSound} from './roomSoundEffects';

type DogArtProps={sitting?:boolean;barking?:boolean;barkKey?:number;happy?:boolean;angry?:boolean;preview?:boolean};

export function DogArt({sitting=false,barking=false,barkKey,happy=false,angry=false,preview=false}:DogArtProps){
 return <svg className="dog-art" viewBox="0 0 84 62" shapeRendering="crispEdges" aria-hidden="true">
  <g stroke="#2d2035" strokeWidth="2.6" strokeLinejoin="miter">
   <path className="dog-tail" fill="#b46b3c"
    d="M28 39H21L15 35 10 29V21L13 18H16L19 22 17 26 19 30 25 32H30Z"/>
   {sitting
    ? <path fill="#af653b" d="M37 39H29L22 44 20 50V54L23 56H39L42 53V47Z"/>
    : <>
     <path className="dog-leg dog-leg-back" fill="#a45b35"
      d="M35 42L30 49 31 53 38 55 42 51 39 45ZM52 42L54 50 58 54H63L64 50 59 43Z"/>
     <path className="dog-leg dog-leg-front" fill="#e69a54"
      d="M28 43L25 48 20 51V55L25 56 31 51 35 46ZM45 43V49L48 56 53 57 56 54 54 49 53 44Z"/>
    </>}
   <path fill="#d78a46" d="M26 37L33 32 43 31 54 33 60 39 56 46 50 49H36L28 46 24 42Z"/>
   <path fill="#f3ae63" stroke="none" d="M28 38L34 34H45L49 37 44 41H30L26 40Z"/>
   <path fill="#f3cea0" stroke="none" d="M37 44H51L53 47 49 49H38Z"/>
   {sitting&&<path fill="#e69a54" d="M46 43H53L55 50 55 54 53 57H47L44 54Z"/>}
   <path fill="#773ca3" d="M40 31L46 30 57 36 61 39 57 46 50 45 42 41 36 36Z"/>
   <path fill="#b967d3" stroke="none" d="M38 35L41 33 48 39 55 42H58L57 44 52 43 44 40Z"/>
   <path fill="#ffda64" strokeWidth="1.8" d="M55 44H59L62 47V51L59 54H55L52 51V47Z"/>
   <path fill="#fff1a7" stroke="none" d="M55 47h3v3h-3z"/>

   <g className="dog-head">
   <path fill="#a45932" d="M65 11L70 8 74 11 76 16 73 22 67 22Z"/>
   <path fill="#df9452" d="M40 15L46 10 53 8 62 8 70 11 76 17 78 24 82 28 81 33 77 37 68 41 58 41 49 38 43 34 39 28Z"/>
   <path fill="#f5b269" stroke="none" d="M43 16L50 12 60 11 65 13 61 15 52 15 46 21Z"/>
   <path fill="#95502e" d="M44 15L37 14 33 16 27 23 23 27 24 33 29 36 35 36 40 33 44 27 46 20Z"/>
   <path fill="#b86b3d" stroke="none" d="M37 17L42 17 42 20 36 21 29 27 26 28 27 25Z"/>

   {happy?<path d="M52 26L56 22H60L64 26M67 22L70 19H73L76 22" fill="none" strokeWidth="2.5"/>:<>
   <path fill="#f8e3cf" strokeWidth="2" d="M53 19L57 16H62L67 20 68 26 65 30 60 32H56L52 29 50 24Z"/>
   <path fill="#f8e3cf" strokeWidth="2" d="M67 16L70 14H73L77 18 78 23 75 27H71L67 24 65 20Z"/>
   <path fill="#352437" stroke="none" d="M57 19H62L66 22V27L62 31H57L54 28V23ZM70 16H73L76 19V23L74 26H70L68 23V19Z"/>
   <path fill="#fff7eb" stroke="none" d="M57 21h3v3h-3zm4 5h2v2h-2zm9-8h3v3h-3zm4 4h2v2h-2z"/>
   </>}
   <path fill="#6d392a" stroke="none" d={angry
    ?'M49 13L52 13 64 21 62 25 49 17ZM66 19L74 12 77 13 77 16 68 23Z'
    :'M50 16L54 12 59 11 61 13 57 14 53 17ZM66 12L69 11 73 12 74 14 71 14 68 13Z'}/>

   <path fill="#f9d1a2" strokeWidth="1.75" d="M54 31L59 27H67L73 24H77L81 27V31L78 34H73L69 38 63 39 58 37 53 34Z"/>
   <path fill="#3e2839" stroke="none" d="M73 25H79L81 27 80 30H77L73 28Z"/>
   {barking
    ?<path fill="#613145" strokeWidth="1.5" d="M61 33H72L77 36 75 42 69 44 63 41 59 36Z"/>
    :<path fill="#4a2837" strokeWidth="1.5" d="M60 33L64 35H70L76 32 75 38 71 41H66L62 38Z"/>}
   <path fill="#ef8392" strokeWidth="1.7" d={barking
    ?'M66 39L72 38 75 40 75 44 71 46 67 45 65 42Z'
    :'M67 37L72 35 75 39 76 43 73 46H70L67 43 66 40Z'}/>
   <path fill="#b8516e" stroke="none" d="M70 38H72L74 42H72Z"/>
   <path fill="#f6b985" stroke="none" d="M54 31h2v2h-2zm4 1h2v1h-2z"/>
   </g>
  </g>
  {angry&&<path fill="none" stroke="#ff737f" strokeWidth="2.5" d="M30 2V7H24M36 2V7H42M24 13H30V18M42 13H36V18"/>}
  {(preview||barking)&&<g key={barkKey} className="dog-bark-rays" fill="#ffd46a">
   <path d="M75 5L77 1H80L79 7 76 10 74 9ZM79 11L83 9 84 12 81 14H79Z"/>
   {preview&&<path d="M4 23V18L7 15 9 17 7 20V23ZM4 14L7 11 12 10 14 12 10 13 7 16Z" fill="#ffd8a1"/>}
  </g>}
 </svg>;
}

const sitAt=7400,resumeAt=10_800,barkAt=8750;
const reactionMs=1000;
type DogReaction='bark'|'happy';
export type DogHeader={head:()=>GroundPoint|undefined;deflect:()=>boolean;cancel:()=>void};
export type DogBallPartner={preparePass:(fromX:number,flightMs:number)=>DogHeader|undefined};
const obstacleSelector='.placed-furniture,[data-dog-obstacle]';
const movementTime=(elapsed:number)=>elapsed-Math.max(0,Math.min(elapsed,resumeAt)-sitAt);

export function Dog({updated,wallTime,location,active,ballPartner}:{updated:number;wallTime:number;location:Location;active:boolean;ballPartner:Ref<DogBallPartner>}){
 useEffect(()=>{
  for(const kind of ['dog-bark','dog-happy'] as const)void prepareRoomSound(kind).catch(()=>{});
  window.addEventListener('pointerdown',unlockSound,{once:true});
  return()=>window.removeEventListener('pointerdown',unlockSound);
 },[]);
 if(dogIsSleepingAt(wallTime))return <NightDog location={location} active={active}/>;
 const visit=dogVisitAt(updated);
 if(!active||location!==visit.location)return null;
 return <DogVisit key={visit.index} elapsed={visit.elapsed} reverse={visit.index%8>=4} location={location} ballPartner={ballPartner}/>;
}

const nightBarkDuration=5_000;
const nightWalkDuration=1_300;
type NightDogState={room:'room'|'hallway';phase:'sleeping'|'barking'|'leaving'};
const nightDogStyle={'--night-walk-duration':`${nightWalkDuration}ms`} as CSSProperties;

function NightDog({location,active}:{location:Location;active:boolean}){
 const [dog,setDog]=useState<NightDogState>({room:'room',phase:'sleeping'});
 const timers=useRef<{calm:number;arrive:number}|null>(null);
 const visible=active&&dog.room===location;
 const audible=visible&&dog.phase==='barking';
 useEffect(()=>()=>{
  if(!timers.current)return;
  window.clearTimeout(timers.current.calm);
  window.clearTimeout(timers.current.arrive);
 },[]);
 useEffect(()=>{
  if(!audible)return;
  let stop=playRoomSound('dog-bark');
  const repeat=window.setInterval(()=>{
   stop?.();
   stop=playRoomSound('dog-bark');
  },1000);
  return()=>{window.clearInterval(repeat);stop?.();};
 },[audible]);

 function wake(){
  if(timers.current||dog.phase!=='sleeping')return;
  unlockSound();
  const {room}=dog;
  setDog({room,phase:'barking'});
  const calm=window.setTimeout(()=>setDog({room,phase:'leaving'}),nightBarkDuration);
  const arrive=window.setTimeout(()=>{
   timers.current=null;
   setDog({room:room==='room'?'hallway':'room',phase:'sleeping'});
  },nightBarkDuration+nightWalkDuration);
  timers.current={calm,arrive};
 }

 if(!visible)return null;
 const sleeping=dog.phase==='sleeping',barking=dog.phase==='barking';
 return <button type="button" className="night-dog" data-location={dog.room} data-pose={dog.phase}
  style={nightDogStyle} disabled={!sleeping} aria-label={sleeping?'Собака спит. Разбудить':barking?'Собака сердито лает':'Собака уходит'} onClick={wake}>
  {sleeping?<SleepingDogArt/>:<DogArt sitting={barking} barking={barking} angry={barking}/>}
 </button>;
}

function SleepingDogArt(){
 return <>
  <svg className="dog-art" viewBox="0 0 84 62" shapeRendering="crispEdges" aria-hidden="true">
   <g className="sleeping-dog-body" stroke="#2d2035" strokeWidth="2.6" strokeLinejoin="miter">
    <path fill="#b46b3c" d="M22 49H12L6 44V38L10 34H14L17 38 14 42 17 45H25Z"/>
    <path fill="#d78a46" d="M11 45L15 34 24 27 37 25 48 28 59 37 62 47 54 54H21L14 51Z"/>
    <path fill="#f3ae63" stroke="none" d="M16 38L25 30 36 28 46 31 50 35 33 33 21 41Z"/>
    <path fill="#af653b" d="M27 37L23 43 26 49 34 50H42L45 53 42 56H32L24 54 20 48 21 41Z"/>
    <path fill="#773ca3" d="M48 34L56 35 59 40 56 48 49 50 44 47 50 42Z"/>
    <path fill="#f3ae63" d="M48 48L56 46 60 49H68L71 53 67 56H48L44 53Z"/>
    <path fill="#df9452" d="M50 35L54 28 63 26H70L75 31 77 40 82 44V50L78 54H64L56 50 51 45Z"/>
    <path fill="#f9d1a2" strokeWidth="1.75" d="M66 45L71 41H77L81 44V49L77 53H67L63 50Z"/>
    <path fill="#95502e" d="M57 30L51 29 44 34 41 41 43 48 48 50 54 46 58 38Z"/>
    <path fill="none" d="M61 39L64 42H67L70 39"/>
    <path fill="#3e2839" stroke="none" d="M75 43H80L82 45 80 48H77L74 46Z"/>
    <path fill="#ffda64" strokeWidth="1.5" d="M53 47H57L59 50 57 53H53L51 50Z"/>
   </g>
  </svg>
  <span className="sleeping-dog-z" aria-hidden="true">z<span>Z</span></span>
 </>;
}

function DogVisit({elapsed,location,reverse,ballPartner}:{elapsed:number;location:Location;reverse:boolean;ballPartner:Ref<DogBallPartner>}){
 const button=useRef<HTMLButtonElement>(null);
 const [initialElapsed]=useState(elapsed);
 const [pose,setPose]=useState<'sit'|'run'>(elapsed>=sitAt&&elapsed<resumeAt?'sit':'run');
 const [barking,setBarking]=useState(false);
 const [reaction,setReaction]=useState<{kind:DogReaction;at:number}|null>(null);
 const [ballPose,setBallPose]=useState<'ready'|'hit'|null>(null);
 const petTimer=useRef<number|undefined>(undefined);
 const headerTimer=useRef<number|undefined>(undefined);
 const pauseUntil=useRef(0);
 const ballPauseUntil=useRef(0);
 const visitEnd=useRef(0);
 const stopVoice=useRef<(()=>void)|undefined>(undefined);

 useEffect(()=>()=>{
  window.clearTimeout(petTimer.current);
  window.clearTimeout(headerTimer.current);
  stopVoice.current?.();
 },[]);
 function pet(){
  const at=performance.now();
  if(ballPauseUntil.current>at)return;
  const kind=Math.random()<.5?'bark':'happy';
  pauseUntil.current=at+reactionMs;
  setReaction({kind,at});
  stopVoice.current?.();
  stopVoice.current=playRoomSound(kind==='bark'?'dog-bark':'dog-happy');
  window.clearTimeout(petTimer.current);
  petTimer.current=window.setTimeout(()=>setReaction(null),reactionMs);
 }
 useImperativeHandle(ballPartner,()=>({
  preparePass(fromX,flightMs){
   const dog=button.current,head=dog?.querySelector<SVGGElement>('.dog-head');
   const now=performance.now(),end=now+flightMs+350;
   if(location!=='hallway'||!dog||!head||dog.style.visibility!=='visible'||visitEnd.current<end||pauseUntil.current>now||ballPauseUntil.current>now)return;
   const box=dog.getBoundingClientRect();
   dog.style.setProperty('--dog-facing',fromX<box.left+box.width/2?'-1':'1');
   stopVoice.current?.();
   setBarking(false);
   ballPauseUntil.current=end;
   setBallPose('ready');
   function cancel(){
    if(ballPauseUntil.current!==end)return;
    window.clearTimeout(headerTimer.current);
    ballPauseUntil.current=0;
    if(dog?.isConnected)setBallPose(null);
   }
   return {
    head:()=>{
     const matrix=head.getScreenCTM();
     if(!head.isConnected||!matrix)return;
     return new DOMPoint(65,13).matrixTransform(matrix);
    },
    deflect:()=>{
     if(!head.isConnected||ballPauseUntil.current!==end)return false;
     setBallPose('hit');
     headerTimer.current=window.setTimeout(cancel,300);
     return true;
    },
    cancel,
   };
  },
 }),[location]);

 useLayoutEffect(()=>{
  const dog=button.current;
  const room=dog?.closest<HTMLElement>('.photo-room');
  if(!dog||!room)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFrame=performance.now(),elapsed=initialElapsed;
  const expires=lastFrame+dogVisitDuration-initialElapsed;
  visitEnd.current=expires;
  const runTime=movementTime(dogVisitDuration);
  let frame=0,replan=0,routeStart=0,width=0,height=0,signature='';
  let position:GroundPoint|undefined;
  let route=measureDogRoute([],1,1);
  let lastPose=initialElapsed>=sitAt&&initialElapsed<resumeAt?'sit':'run';
  let barked=initialElapsed>=barkAt,showBark=false;
  const moved=new MutationObserver(queueMeasure);

  function measure(){
   const rect=room!.getBoundingClientRect();
   width=rect.width;height=rect.height;
   if(!width||!height)return;
   moved.disconnect();
   const objects=Array.from(room!.querySelectorAll<HTMLElement>(obstacleSelector),node=>{
    moved.observe(node,{attributes:true,attributeFilter:['style']});
    const ground=(node.querySelector('.furniture-art')??node).getBoundingClientRect();
    return {left:(ground.left-rect.left)/width,right:(ground.right-rect.left)/width,top:(ground.top-rect.top)/height,bottom:(ground.bottom-rect.top)/height};
   });
   const feet=dog!.offsetWidth*.21;
   const key=JSON.stringify([width,height,feet,objects]);
   if(key===signature)return;
   signature=key;
   routeStart=position?movementTime(elapsed):0;
   route=measureDogRoute(dogRoute(location,objects,width,height,feet,reverse,position),width,height);
  }
  function queueMeasure(){
   if(replan)return;
   replan=requestAnimationFrame(now=>{replan=0;measure();if(!frame)draw(now);});
  }

  function draw(now:number){
   frame=0;
   elapsed=Math.min(dogVisitDuration,elapsed+Math.max(0,now-Math.max(lastFrame,pauseUntil.current,ballPauseUntil.current)));
   lastFrame=now;
   const moving=movementTime(elapsed);
   const next=dogPointAt(route,reduced?.5:(moving-routeStart)/Math.max(1,runTime-routeStart));
   if(next){
    const dx=next.x-(position?.x??next.x);
    if(Math.abs(dx)>.00001)dog!.style.setProperty('--dog-facing',dx<0?'-1':'1');
    dog!.style.setProperty('--dog-x',`${next.x*width}px`);
    dog!.style.setProperty('--dog-y',`${next.y*height}px`);
    dog!.style.visibility='visible';
    position=next;
   }else dog!.style.visibility='hidden';
   const nextPose=reduced||(elapsed>=sitAt&&elapsed<resumeAt)?'sit':'run';
   if(nextPose!==lastPose){lastPose=nextPose;setPose(nextPose);}
   if(!barked&&elapsed>=barkAt){barked=true;stopVoice.current=playRoomSound('dog-bark',true);}
   const currentBark=elapsed>=barkAt&&elapsed<barkAt+700;
   if(currentBark!==showBark){showBark=currentBark;setBarking(currentBark);}
   if(now<expires)frame=requestAnimationFrame(draw);
  }

  measure();
  draw(performance.now());
  const resize=new ResizeObserver(queueMeasure);
  resize.observe(room);
  const changes=new MutationObserver(records=>{
   if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>
    node instanceof Element&&(node.matches(obstacleSelector)||node.querySelector(obstacleSelector)))))queueMeasure();
  });
  changes.observe(room,{subtree:true,childList:true});
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(replan);resize.disconnect();changes.disconnect();moved.disconnect();};
 },[initialElapsed,location,reverse]);

 return <button ref={button} type="button" className="room-dog" aria-label="Погладить собаку"
  data-pose={reaction||ballPose?'sit':pose} data-reaction={reaction?.kind} data-ball-pose={ballPose??undefined}
  onPointerDown={event=>{if(event.isPrimary&&event.button===0)event.currentTarget.setPointerCapture(event.pointerId);}}
  onClick={pet}>
  <DogArt sitting={Boolean(reaction||ballPose)||pose==='sit'} barking={reaction?reaction.kind==='bark':!ballPose&&barking}
   barkKey={reaction?.kind==='bark'?reaction.at:undefined} happy={reaction?.kind==='happy'}/>
  {reaction?.kind==='happy'&&<span key={reaction.at} className="dog-hearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></span>}
 </button>;
}
