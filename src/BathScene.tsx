import {useRef,useState,type PointerEvent} from 'react';
import {AvatarHeadArt} from './AvatarHeadArt';
import {advanceBathStroke,type BathStroke} from './bathScrub';

type Point={x:number;y:number};
const spongeRest={x:.89,y:.566};
const onPetrashka=({x,y}:Point)=>((x-.792)/.112)**2+((y-.436)/.122)**2<=1;

export function BathScene({onScrub,onFinish}: {onScrub:()=>void;onFinish:()=>void}) {
 const [rubbing,setRubbing]=useState(false);
 return <><div className="bath-scene-backdrop" aria-hidden="true"/><svg className={`bath-scene-art${rubbing?' bath-rubbing':''}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
   <g className="bath-head-bob">
    <svg x="690" y="325" width="204" height="204" overflow="hidden">
     <AvatarHeadArt className="bath-smile" wetness={4}/>
     <AvatarHeadArt className="bath-surprise" expression={2} wetness={4}/>
    </svg>
    <g className="bath-foam-crown" fill="#f1fbff" stroke="#b6c6ed" strokeWidth="2">
     <circle cx="757" cy="342" r="11"/><circle cx="772" cy="331" r="16"/><circle cx="792" cy="319" r="18"/><circle cx="811" cy="331" r="15"/><circle cx="827" cy="342" r="10"/>
    </g>
   </g>
   <g className="bath-lather" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <g className="bath-lather-left">
     <path d="M730 532 683 482 717 365" stroke="#532d47" strokeWidth="22"/>
     <path d="M730 532 683 482 717 365" stroke="#ffbf91" strokeWidth="16"/>
     <path d="M715 372 728 355" stroke="#ffcd9e" strokeWidth="19"/>
     <path d="M719 357h19" stroke="#f4faff" strokeWidth="12"/>
    </g>
    <g className="bath-lather-right">
     <path d="M851 533 891 479 852 363" stroke="#532d47" strokeWidth="22"/>
     <path d="M851 533 891 479 852 363" stroke="#ffbf91" strokeWidth="16"/>
     <path d="M853 371 839 354" stroke="#ffcd9e" strokeWidth="19"/>
     <path d="M829 356h17" stroke="#f4faff" strokeWidth="12"/>
    </g>
   </g>
   <g fill="#f2faff" stroke="#bbd3ed" strokeWidth="2">
    {[{x:720,r:17},{x:745,r:20},{x:775,r:18},{x:801,r:20},{x:831,r:19},{x:861,r:17}].map(p=><circle key={p.x} cx={p.x} cy={523+(p.x-720)*.16} r={p.r}/>)}
   </g>
   <g fill="#f5faff66" stroke="#fff" strokeWidth="1.6">
    <circle className="bath-bubble" cx="727" cy="390" r="7"/><circle className="bath-bubble bath-bubble-late" cx="865" cy="370" r="10"/>
    <circle className="bath-bubble" cx="803" cy="303" r="6"/>
   </g>
 </svg>
 <BathSponge onScrub={onScrub} onContact={setRubbing}/>
 <button type="button" className="cancel-activity bath-finish" onClick={onFinish}>Закончить</button>
 </>;
}

function BathSponge({onScrub,onContact}:{onScrub:()=>void;onContact:(rubbing:boolean)=>void}){
 const scene=useRef<HTMLDivElement>(null);
 const gesture=useRef<{id:number;stroke:BathStroke|null}|null>(null);
 const [position,setPosition]=useState(spongeRest);
 const [held,setHeld]=useState(false);

 function grab(event:PointerEvent<HTMLButtonElement>){
  if(event.button!==0||gesture.current)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  gesture.current={id:event.pointerId,stroke:null};
  setHeld(true);
 }
 function move(event:PointerEvent<HTMLButtonElement>){
  const drag=gesture.current,field=scene.current?.getBoundingClientRect();
  if(!drag||drag.id!==event.pointerId||!field?.width||!field.height)return;
  const point={x:(event.clientX-field.left)/field.width,y:(event.clientY-field.top)/field.height};
  setPosition({x:Math.max(.05,Math.min(.95,point.x)),y:Math.max(.05,Math.min(.91,point.y))});
  const contact=onPetrashka(point);
  onContact(contact);
  if(!contact){drag.stroke=null;return;}
  const cursor={x:event.clientX-field.left,y:event.clientY-field.top};
  drag.stroke??={start:cursor,direction:null,peak:0};
  const distance=Math.max(14,Math.min(28,field.width*.045));
  if(advanceBathStroke(drag.stroke,cursor,distance))onScrub();
 }
 function release(event:PointerEvent<HTMLButtonElement>){
  if(gesture.current?.id!==event.pointerId)return;
  gesture.current=null;
  setHeld(false);
  setPosition(spongeRest);
  onContact(false);
 }
 return <div ref={scene} className="bath-sponge-layer">
  <button type="button" className="bath-sponge" aria-label="Мочалка" aria-description="Проведи мочалкой по Петрашке туда и обратно" data-held={held}
   style={{left:`${position.x*100}%`,top:`${position.y*100}%`}}
   onPointerDown={grab} onPointerMove={move} onPointerUp={release} onPointerCancel={release}
   onLostPointerCapture={release} onClick={event=>{if(event.detail===0)onScrub();}}>
   <svg viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true">
    <path d="M7 7H25V10H29V22H25V25H7V22H3V10H7Z" fill="#ffc34e" stroke="#40233b" strokeWidth="2"/>
    <path d="M8 10H25V12H15V14H6V12H8Z" fill="#ffed98"/>
    <path d="M4 20H10V22H23V19H28V22H25V25H7V22H4Z" fill="#e38a3b"/>
    <path d="M10 15h2v2h-2zm5 3h3v2h-3zm5-5h2v2h-2zm4 3h2v2h-2z" fill="#bf703a"/>
   </svg>
  </button>
 </div>;
}
