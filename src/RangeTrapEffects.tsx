import {memo,type CSSProperties,type RefObject} from 'react';
import {rangeTraps,type TrapKind,type TrapStrike} from './rangeTraps';

const kinds=Object.keys(rangeTraps) as TrapKind[];
const teeth=Array.from({length:8},(_,index)=>index);
const sawTeeth=Array.from({length:12},(_,index)=>index*30);
const windLines=Array.from({length:8},(_,index)=>index);

const TrapArt=memo(function TrapArt({kind,icon=false}:{kind:TrapKind;icon?:boolean}){
 return <svg viewBox={kind==='spikes'&&!icon?'0 0 192 64':'0 0 64 64'} preserveAspectRatio={kind==='spikes'?'none':undefined} aria-hidden="true" shapeRendering="crispEdges">
  {kind==='spikes'&&<>
   {(icon?teeth.slice(0,3):teeth).map(i=><g key={i} transform={`translate(${i*(icon?20:24)} 0)`}>
    <path d="M1 55 10 5 13 3 19 55Z" fill="#7584a4" stroke="#1b1729" strokeWidth="2"/>
    <path d="M4 54 11 8 13 13 10 55Z" fill="#e1eaff"/>
    <path d="M13 21 17 51H13Z" fill="#505979"/>
   </g>)}
   <path d={icon?'M1 54H63V63H1Z':'M0 54H192V63H0Z'} fill="#3c354f" stroke="#1b1729" strokeWidth="2"/>
   <path d={icon?'M2 57h60':'M0 57h192'} stroke="#a285a5" strokeWidth="2"/>
  </>}
  {kind==='weight'&&<>
   <path d="M18 22V12L24 5H40L46 12V22H40V14L37 11H27L24 14V22Z" fill="#6b7896" stroke="#1b1729" strokeWidth="3"/>
   <path d="M9 29 18 20H46L55 29 62 47 57 59H7L2 47Z" fill="#333954" stroke="#181325" strokeWidth="3"/>
   <path d="M9 33 20 24H44L52 33 57 46H7Z" fill="#555e7d"/>
   <path d="M15 35 23 27H38M14 48H49" fill="none" stroke="#a0adc2" strokeWidth="2"/>
   <path d="M23 33H41V43H23Z" fill="#dda16d" stroke="#30283c" strokeWidth="2"/>
  </>}
  {kind==='fan'&&<>
   <path d="M4 57H60V63H4Z M13 49H51V57H13Z" fill="#545571" stroke="#1c1729" strokeWidth="2"/>
   <path d="M11 5H53L61 13V49L53 57H11L3 49V13Z" fill="#60647e" stroke="#171426" strokeWidth="3"/>
   <path d="M21 11H43L54 22V40L43 51H21L10 40V22Z" fill="#201e34" stroke="#939cb5" strokeWidth="2"/>
   <g className={icon?undefined:'range-fan-blades'} style={{transformOrigin:'32px 31px'}}>
    <path d="M31 28 24 24 24 16 31 12 38 14 40 22 35 31ZM35 31 45 30 51 35 49 42 43 47 36 44 31 33ZM31 34 27 43 19 45 13 39 15 31 22 27 32 29Z" fill="#7baab6" stroke="#192537" strokeWidth="2"/>
    <path d="M29 26H35L38 30V34L34 37H29L26 33V29Z" fill="#b9dde5" stroke="#151b2d" strokeWidth="2"/>
   </g>
   <path d="M8 11h4m40 0h4M8 51h4m40 0h4" stroke="#c4ccde" strokeWidth="2"/>
  </>}
  {kind==='saw'&&<g className={icon?undefined:'range-saw-disc'} style={{transformOrigin:'32px 32px'}}>
   {sawTeeth.map(angle=><path key={angle} d="M24 13 25 3 32 2 38 13Z" fill="#b1bbd3" stroke="#21182c" strokeWidth="2" transform={`rotate(${angle} 32 32)`}/>)}
   <path d="M20 9H44L55 20V44L44 55H20L9 44V20Z" fill="#8694b6" stroke="#1b1729" strokeWidth="2.5"/>
   <path d="M22 14H42L50 22V42L42 50H22L14 42V22Z" fill="#b6c1d9" stroke="#e1e8fc" strokeWidth="2"/>
   <path d="M27 21H37L43 27V37L37 43H27L21 37V27Z" fill="#64718f"/>
   <path d="M29 26H35L38 29V35L35 38H29L26 35V29Z" fill="#28273f" stroke="#1b1729" strokeWidth="2"/>
  </g>}
 </svg>;
});

export function RangeTrapPanel({active,activate}:{active:ReadonlySet<TrapKind>;activate:(kind:TrapKind)=>void}){
 return <div className="range-trap-panel" role="group" aria-label="Ловушки">
  {kinds.map(kind=><button type="button" key={kind} aria-label={kind==='saw'?'Циркулярная пила':undefined}
   data-trap-button={kind} disabled={active.has(kind)} data-running={active.has(kind)||undefined} onClick={()=>activate(kind)}>
   <TrapArt kind={kind} icon/><span>{rangeTraps[kind].name}</span>
  </button>)}
 </div>;
}

export const RangeTrapActors=memo(function RangeTrapActors({active,nodes}:{
 active:ReadonlySet<TrapKind>;nodes:RefObject<Partial<Record<TrapKind,HTMLDivElement|null>>>;
}){
 return <div className="range-trap-actors" aria-hidden="true">
  {active.has('fan')&&<svg className="range-wind" viewBox="0 0 400 560" preserveAspectRatio="none">
   {windLines.map(i=><path key={i} d={`M${18+i%3*32} ${165+i*44}h${24+i%3*12}l12 6h28m13 0h16`}
    style={{'--wind-delay':`${i*-.14}s`} as CSSProperties}/>)}
  </svg>}
  {kinds.map(kind=><div key={kind} className="range-trap-actor" data-trap={kind} hidden={!active.has(kind)} ref={node=>{nodes.current[kind]=node;}}>
   <TrapArt kind={kind}/>
  </div>)}
 </div>;
});

type Particle={x:number;y:number;size:number;alpha:number;color:string;spin:number};
export type RangeBurstEffect={id:number;kind:TrapStrike|'collision';x:number;y:number;particles:Particle[]};

export function makeRangeBurst(id:number,kind:RangeBurstEffect['kind'],x:number,y:number):RangeBurstEffect{
 const count=kind==='weight'?17:13;
 const sparks=kind==='saw'?8:kind==='weight'?5:kind==='spikes'?3:2;
 const reds=['#b7193d','#ff365a','#eb1944','#ff6079'];
 const particles=Array.from({length:count+sparks},(_,i)=>{
  const spark=i>=count,angle=(i/count+Math.random()*.2)*Math.PI*2;
  const speed=(kind==='weight'?112:80)*(.22+Math.random()*.85);
  return {x:Math.cos(angle)*speed,y:Math.sin(angle)*speed*.64-(spark?10:21),size:spark?3+Math.random()*4:5+Math.random()*7,
   alpha:spark?.85:1,color:spark?['#ffe68a','#fff2c7','#ffaa52'][i%3]:reds[i%4],spin:(Math.random()-.5)*410};
 });
 return {id,kind,x,y,particles};
}
export const RangeBursts=memo(function RangeBursts({bursts}:{bursts:RangeBurstEffect[]}){
 return <div className="range-bursts" aria-hidden="true">{bursts.map(burst=><span key={burst.id} className="range-burst" data-burst={burst.kind}
  style={{left:burst.x,top:burst.y}}>
  <span className="range-burst-flash"/>
  <svg className="range-blood-splash" viewBox="0 0 56 48" shapeRendering="crispEdges">
   <path d="M25 14H30V20H36V17H42V23H49V27H40V31H34V38H29V43H24V35H19V32H13V36H8V30H15V25H7V21H18V17H22V9H25Z"
    fill="#e22547" stroke="#861831" strokeWidth="2"/>
   <path d="M24 19H29V24H39V28H29V33H24V29H17V25H24ZM5 9H11V15H5ZM41 7H46V12H41ZM47 34H53V40H47Z" fill="#ff4263"/>
   <path d="M25 23H28V27H25ZM8 10H10V12H8ZM44 8H46V10H44Z" fill="#ff9ba9"/>
  </svg>
  {burst.particles.map((particle,index)=><i key={index} style={{
   '--particle-x':particle.x+'px','--particle-y':particle.y+'px','--particle-spin':particle.spin+'deg',
   '--particle-size':particle.size+'px','--particle-color':particle.color,'--particle-opacity':particle.alpha,
  } as CSSProperties}/>)}
 </span>)}</div>;
});
