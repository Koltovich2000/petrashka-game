import {useLayoutEffect,useRef,type CSSProperties} from 'react';

type Point={x:number;y:number};
export const poopFlightTime=460;

function PoopPixels({face=true}:{face?:boolean}){
 return <>
  <path d="M-11 5H-8V1H-5V-3H-2V-6H0V-10H4V-7H6V-3H8V1H10V5H12V9H9V11H-9V9H-12V5Z" fill="#824326" stroke="#382033" strokeWidth="1.5"/>
  <path d="M1-7H3V-4H-2V-2H5V0H-5V3H8V5H-8V7H10V9H-9V5H-7V1H-4V-3H0Z" fill="#be7440"/>
  {face&&<>
   <path d="M-4 3H-2V5H-4ZM3 3H5V5H3Z" fill="#fff5dc"/>
   <path d="M-2 7H3V8H-2Z" fill="#3c2230"/>
  </>}
 </>;
}

export function RangePoopIcon(){
 return <svg viewBox="-14 -13 28 26" aria-hidden="true" shapeRendering="crispEdges"><PoopPixels/></svg>;
}

export type PoopThrow={
 id:number;from:Point;aim:Point;arc:number;miss:boolean;
 follow:()=>Point|undefined;finish:()=>void;
};

export function RangePoopProjectile({shot}:{shot:PoopThrow}){
 const node=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const projectile=node.current!;
  const started=performance.now();
  const duration=shot.miss?poopFlightTime+155:poopFlightTime;
  let frame=0;
  function draw(now:number){
   const elapsed=Math.min(duration,Math.max(0,now-started));
   const position=elapsed/poopFlightTime;
   const target=(shot.miss?undefined:shot.follow())??shot.aim;
   // Preserve the launch arc even when a trap moves the target mid-flight.
   const correction=Math.min(1,position)**3;
   const x=shot.from.x+(shot.aim.x-shot.from.x)*position+(target.x-shot.aim.x)*correction;
   const y=shot.from.y+(shot.aim.y-shot.from.y)*position-4*shot.arc*position*(1-position)+(target.y-shot.aim.y)*correction;
   const turn=shot.from.x<shot.aim.x?1:-1;
   const tilt=(.5-Math.min(1,position))*48*turn;
   projectile.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${tilt}deg)`;
   if(elapsed<duration)frame=requestAnimationFrame(draw);
   else shot.finish();
  }
  draw(started);
  return()=>cancelAnimationFrame(frame);
 },[shot]);
 return <span ref={node} className="range-poop-projectile" data-result={shot.miss?'miss':'hit'} aria-hidden="true">
  <svg viewBox="-14 -13 28 26" shapeRendering="crispEdges"><PoopPixels face={false}/></svg>
 </span>;
}

const spray=[
 {x:-9,y:-4,size:1.55},{x:-5,y:-9,size:1.3},{x:1,y:-11,size:1.4},
 {x:8,y:-6,size:1.7},{x:10,y:2,size:1.3},{x:-8,y:5,size:1.2},
];

export function RangePoopSplat({id,x,y,scale,slide}:{id:number;x:number;y:number;scale:number;slide:Point}){
 const drift={'--splat-x':`${slide.x}px`,'--splat-y':`${slide.y}px`} as CSSProperties;
 return <g transform={`translate(${x} ${y}) scale(${scale})`} data-damage-id={id} data-damage-type="splat" pointerEvents="none">
  <g className="range-poop-stain">
   <path d="M-6-2H-4V-3H0V-2H3V-1H6V2H3V4H1V3H-3V2H-6Z" fill="#693724" stroke="#482820" strokeWidth=".75"/>
   <path d="M-4-1H-1V0H3V2H0V1H-4Z M5-4h2v2H5Z M-7 3h2v2h-2Z" fill="#ad6940"/>
   <path className="range-poop-trail" pathLength="1" d={`M0 1Q${slide.x-1} ${slide.y*.55} ${slide.x} ${slide.y+1}`} fill="none" stroke="#875032" strokeWidth="3" strokeLinecap="round"/>
   {spray.map(({x,y,size})=><rect key={x} className="range-poop-droplet" x={-size/2} y={-size/2} width={size} height={size}
    fill="#bd7746" stroke="none" style={{'--particle-x':`${x}px`,'--particle-y':`${y}px`,'--particle-spin':'75deg','--particle-opacity':1} as CSSProperties}/>)}
   <g className="range-poop-slide" style={drift}>
    <g className="range-poop-squash" strokeWidth="1" shapeRendering="crispEdges">
     <g transform="scale(.4)"><PoopPixels face={false}/></g>
    </g>
   </g>
  </g>
 </g>;
}
