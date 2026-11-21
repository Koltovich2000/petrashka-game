import {useEffect,useState,type CSSProperties} from 'react';
import {FurnitureArt} from './FurnitureArt';
import {HygieneEffects} from './HygieneEffects';
import {PixelAvatar} from './PixelAvatar';
import type {Outfit} from './wardrobe';
import type {HairWetness} from './hair';
import {yogaFrame,type YogaPose} from './yoga';

const poseLabels:Record<YogaPose,string>={tree:'Поза дерева',warrior:'Поза воина',child:'Поза ребёнка'};

export function YogaScene({started,seed,stored,outfit,hygiene,wetness}:{started:number;seed:number;stored:{x:number;y:number};outfit:Outfit;hygiene:number;wetness:HairWetness}){
 const [elapsed,setElapsed]=useState(()=>Math.max(0,Date.now()-started));
 const {phase,start,duration,pose}=yogaFrame(elapsed,seed);
 const boundary=start+duration;
 useEffect(()=>{
  const timer=window.setTimeout(()=>setElapsed(Math.max(boundary,Date.now()-started)),Math.max(0,started+boundary-Date.now()));
  return()=>window.clearTimeout(timer);
 },[started,boundary]);

 const walking=phase==='walk-to-mat'||phase==='carry';
 const carrying=phase==='carry';
 const storedMat=phase==='walk-to-mat'||phase==='pick-up';
 const mirrored=phase==='walk-to-mat'?stored.x<.5:carrying&&stored.x>.5;
 const style={
  '--stored-x':`${stored.x*100}%`,'--stored-y':`${stored.y*100}%`,
  '--yoga-duration':`${duration}ms`,'--yoga-delay':`${start-elapsed}ms`,
 } as CSSProperties;
 return <div className="yoga-scene" data-phase={phase} data-mirrored={mirrored} style={style}>
  {storedMat&&<div className="yoga-stored-roll" data-dog-obstacle><FurnitureArt kind="yoga"/></div>}
  {(phase==='unroll'||phase==='practice')&&<div className="yoga-ground-mat" data-dog-obstacle>
   <svg viewBox="0 0 360 86" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
    <path d="M39 4H321L357 73V80L353 84H7L3 80V73Z" fill="#4d266e" stroke="#2b193c" strokeWidth="3"/>
    <path d="M39 4H321L357 73H3Z" fill="#9d5ac8" stroke="#38204d" strokeWidth="3"/>
    <path d="M41 8H319L351 69H9Z" fill="#b87bdc"/>
    <path d="M53 10L22 69M66 10L40 69M294 10L320 69M307 10L338 69" stroke="#deabe9" strokeWidth="4"/>
    <path d="M72 22H288M66 35H294M58 49H302M51 63H309" stroke="#8444ad" strokeOpacity=".28"/>
   </svg>
   {phase==='unroll'&&<div className="yoga-moving-roll"><FurnitureArt kind="yoga"/></div>}
  </div>}
  <div className="yoga-staged-character" role="img" aria-label={pose?poseLabels[pose]:'Петрашка расстилает коврик'}>
   <div key={pose??'setup'} className="yoga-avatar">
    <PixelAvatar outfit={outfit} hygiene={hygiene} wetness={wetness} state={pose==='child'?'sleep':'happy'} pose={carrying?'carry':walking?'walking':phase} yogaPose={pose??undefined}/>
   </div>
   {carrying&&<div className="yoga-carried-roll"><FurnitureArt kind="yoga"/></div>}
   <HygieneEffects hygiene={hygiene}/>
  </div>
 </div>;
}
