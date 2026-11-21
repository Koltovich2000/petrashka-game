import {useEffect,useRef,useState,type RefObject} from 'react';
import {GameIcon} from './GameIcon';

type Point={x:number;y:number};
type Phase='ready'|'kicking'|'outbound'|'floor'|'returning';
type Kick={foot:'left'|'right';step:'center'|'left'|'right'};
const kickWindup=200;
const returnDuration=720;
const firstKick:Kick={foot:'left',step:'center'};
const receptions:Kick[]=[
 {foot:'right',step:'center'},
 {foot:'left',step:'right'},
 {foot:'right',step:'left'},
 {foot:'left',step:'center'},
];

export function BallScene({actor,round,onReturn}:{actor:RefObject<HTMLDivElement|null>;round:number;onReturn:()=>void}){
 const field=useRef<HTMLDivElement>(null);
 const ball=useRef<HTMLButtonElement>(null);
 const frame=useRef(0);
 const position=useRef<Point>({x:.40,y:.77});
 const phase=useRef<Phase>('ready');
 const [shownPhase,setShownPhase]=useState<Phase>('ready');
 const [kick,setKick]=useState(firstKick);

 function setPhase(next:Phase){phase.current=next;setShownPhase(next);}
 function boot(foot:Kick['foot']):Point{
  const bounds=field.current?.getBoundingClientRect();
  const leg=actor.current?.querySelector<SVGGElement>(`.pose-ball .leg-${foot}`);
  const matrix=leg?.getScreenCTM();
  if(!bounds?.width||!bounds.height||!matrix)return position.current;
  const isLeft=foot==='left';
  const toe=new DOMPoint(isLeft?72:28,98).matrixTransform(matrix);
  const radius=(ball.current?.querySelector('img')?.clientWidth??40)/2;
  return {
   x:(toe.x+(isLeft?1:-1)*radius*.85-bounds.left)/bounds.width,
   y:(toe.y-radius*.52-bounds.top)/bounds.height,
  };
 }
 function show(point:Point){
  position.current=point;
  if(ball.current){
   ball.current.style.left=`${point.x*100}%`;
   ball.current.style.top=`${point.y*100}%`;
  }
 }
 function fly(destination:()=>Point,duration:number,arc:number,arrive:()=>void,prepare?:(elapsed:number)=>void){
  cancelAnimationFrame(frame.current);
  const from=position.current,start=performance.now();
  const lift=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:arc;
  function step(now:number){
   const t=Math.min(1,Math.max(0,(now-start)/duration));
   prepare?.(now-start);
   const to=destination();
   show({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t-4*lift*t*(1-t)});
   if(t<1)frame.current=requestAnimationFrame(step);
   else arrive();
  }
  frame.current=requestAnimationFrame(step);
 }
 function kickOut(){
  const height=field.current?.clientHeight??630;
  const landing={x:.82,y:1-68/Math.max(height,300)};
  setPhase('outbound');
  fly(()=>landing,1450,.225,()=>setPhase('floor'));
 }
 useEffect(()=>{
  show(boot(firstKick.foot));
  const launch=window.setTimeout(()=>{
   setPhase('kicking');
   const start=performance.now();
   function swing(now:number){
    show(boot(firstKick.foot));
    if(now-start<kickWindup){
     frame.current=requestAnimationFrame(swing);
     return;
    }
    kickOut();
   }
   frame.current=requestAnimationFrame(swing);
  },280);
  return()=>{window.clearTimeout(launch);cancelAnimationFrame(frame.current);};
 },[]);

 function sendBack(){
  if(phase.current!=='outbound'&&phase.current!=='floor')return;
  const reception=receptions[round%receptions.length];
  setKick(reception);
  setPhase('returning');
  fly(()=>boot(reception.foot),returnDuration,.19,()=>{
   kickOut();
   onReturn();
  },elapsed=>{
   if(elapsed>=returnDuration-kickWindup&&phase.current==='returning')setPhase('kicking');
  });
 }

 return <div ref={field} className="ball-play-field">
  <button ref={ball} type="button" className="scene-pass-ball" data-phase={shownPhase}
   data-foot={kick.foot} data-step={shownPhase==='returning'||shownPhase==='kicking'?kick.step:'center'}
   aria-label={shownPhase==='floor'?'Вернуть мяч с пола':'Отбить мяч в воздухе'}
   aria-disabled={shownPhase!=='outbound'&&shownPhase!=='floor'}
   onPointerDown={event=>{if(event.button===0)sendBack();}}
   onClick={event=>{if(event.detail===0)sendBack();}}>
   <GameIcon name="ball"/>
  </button>
 </div>;
}
