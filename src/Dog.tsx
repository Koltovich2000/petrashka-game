import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Location} from './activities';
import {dogPointAt,dogRoute,measureDogRoute,type GroundPoint} from './dogNavigation';
import {dogVisitAt,dogVisitDuration} from './dogSchedule';
import {playDogBark,sound,unlockSound} from './sound';

export function DogArt({sitting=false,barking=false}:{sitting?:boolean;barking?:boolean}){
 return <svg className="dog-art" viewBox="0 0 74 57" shapeRendering="crispEdges" aria-hidden="true">
  <g stroke="#2c2037" strokeWidth="2.5" strokeLinejoin="miter">
   <path className="dog-tail" d="M27 32L16 30L8 21H4V26L10 36L25 40Z" fill="#ba7340"/>
   {sitting?<path d="M36 31L31 29L22 33L17 43V49H35L39 45V36Z" fill="#b46b3d"/>:
    <>
     <path className="dog-leg dog-leg-back" d="M27 37H19V48H24L28 45Z M47 37H40V48H45L48 45Z" fill="#8c4f35"/>
     <path className="dog-leg dog-leg-front" d="M32 38H24V50H31L34 47Z M50 38H44V50H51L53 47Z" fill="#e39b56"/>
    </>}
   <path d="M23 30L38 24L51 28L55 38L49 43H24L18 39V35Z" fill="#c77d45"/>
   {sitting&&<path d="M50 36H41L38 47V50H50L53 46Z" fill="#e9a564"/>}
   <path d="M43 24L53 25L56 32L49 39L42 36L37 29Z" fill="#824fb7"/>
   <path d="M43 13L50 10H62L67 15L68 22L72 25L70 34L64 37H50L43 31L40 22Z" fill="#eca86a"/>
   <path d="M43 12L38 11L32 19V30L35 34H40L45 25V17Z" fill="#935239"/>
   <path d="M59 25H67L71 28V33L66 37H54L50 32Z" fill="#ffdbad"/>
   <path d="M66 24H71V28H67L65 26Z" fill="#312436" stroke="none"/>
   <path d="M56 19H60V24H56Z" fill="#342335" stroke="none"/>
   <path d="M57 19H59V21H57Z" fill="#fff2d5" stroke="none"/>
   {barking?<path d="M59 31H69L67 35H61Z" fill="#863c42" strokeWidth="1.5"/>:<path d="M61 31L65 33L68 31" fill="none" strokeWidth="1.5"/>}
   <path d="M49 35H53V39H49Z" fill="#efc65e" strokeWidth="1"/>
  </g>
 </svg>;
}

const sitAt=7400,resumeAt=10_800,barkAt=8750;
const obstacleSelector='.placed-furniture,[data-dog-obstacle]';
const movementTime=(elapsed:number)=>elapsed-Math.max(0,Math.min(elapsed,resumeAt)-sitAt);

export function Dog({updated,location}:{updated:number;location:Location}){
 const visit=dogVisitAt(updated);
 useEffect(()=>{
  window.addEventListener('pointerdown',unlockSound,{once:true});
  return()=>window.removeEventListener('pointerdown',unlockSound);
 },[]);
 if(location!==visit.location)return null;
 return <DogVisit key={visit.index} elapsed={visit.elapsed} reverse={visit.index%8>=4} location={location}/>;
}

function DogVisit({elapsed,location,reverse}:{elapsed:number;location:Location;reverse:boolean}){
 const button=useRef<HTMLButtonElement>(null);
 const [initialElapsed]=useState(elapsed);
 const [pose,setPose]=useState<'sit'|'run'>(elapsed>=sitAt&&elapsed<resumeAt?'sit':'run');
 const [barking,setBarking]=useState(false);
 const [petted,setPetted]=useState(0);
 const petTimer=useRef<number|undefined>(undefined);

 useEffect(()=>()=>window.clearTimeout(petTimer.current),[]);
 function pet(){
  sound('pet');
  setPetted(count=>count+1);
  window.clearTimeout(petTimer.current);
  petTimer.current=window.setTimeout(()=>setPetted(0),1000);
 }

 useLayoutEffect(()=>{
  const dog=button.current;
  const room=dog?.closest<HTMLElement>('.photo-room');
  if(!dog||!room)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start=performance.now()-initialElapsed;
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
   routeStart=position?movementTime(Math.min(dogVisitDuration,performance.now()-start)):0;
   route=measureDogRoute(dogRoute(location,objects,width,height,feet,reverse,position),width,height);
  }
  function queueMeasure(){
   if(replan)return;
   replan=requestAnimationFrame(now=>{replan=0;measure();if(!frame)draw(now);});
  }

  function draw(now:number){
   frame=0;
   const elapsed=Math.min(dogVisitDuration,now-start);
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
   if(!barked&&elapsed>=barkAt){barked=true;playDogBark();}
   const currentBark=elapsed>=barkAt&&elapsed<barkAt+700;
   if(currentBark!==showBark){showBark=currentBark;setBarking(currentBark);}
   if(elapsed<dogVisitDuration)frame=requestAnimationFrame(draw);
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

 return <button ref={button} type="button" className="room-dog" aria-label="Погладить собаку" data-pose={pose} data-petted={petted>0||undefined} onClick={pet}>
  <DogArt sitting={pose==='sit'} barking={barking}/>
  {petted>0&&<span key={petted} className="dog-heart" aria-hidden="true">♥</span>}
 </button>;
}
