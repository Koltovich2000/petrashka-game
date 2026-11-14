import {ToiletScene,type ToiletPhase} from './ToiletScene';
import {BathScene,type BathPhase} from './BathScene';
import {RoomObjects} from './RoomObjects';
import {activities,type ActivityKind,type FurnitureId,type Location} from './activities';
import {HygieneEffects} from './HygieneEffects';
import type {Action,Game} from './game';
import type {CareMode} from './HomeScreen';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { PixelAvatar } from './PixelAvatar';
import type { Outfit } from './wardrobe';
import { bodyPart, reactions, type Hit } from './body';
import { sound, unlockSound, muteSound, isSoundMuted } from './sound';
import {playHitSound,prepareHitSound,stopHitSound} from './hitSound';
import { haptic } from './telegram';
const locations=[{id:'room',label:'Комната',icon:'🛏️'},{id:'bathroom',label:'Ванная',icon:'🛁'},{id:'hallway',label:'Прихожая',icon:'🚪'}] as const;
type Phase='idle'|'dragging'|'falling'|'landed'|'getting-up'|'walking'|'reacting';
type Motion={x:number;y:number;vx:number;vy:number;tilt:number;phase:Phase;elapsed:number;direction:number};
const resting=():Motion=>({x:0,y:0,vx:0,vy:0,tilt:0,phase:'idle',elapsed:0,direction:1});
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
interface Props {
 foodTray?:ReactNode;
 game:Game;onActivity:(kind:ActivityKind)=>void;onMove:(id:FurnitureId,x:number,y:number)=>void;
 active:boolean; hygiene:number; onWake:()=>void; outfit:Outfit; onRestart:()=>void; state:string; status:string; speech:string;
 effect:string; gain:string; particles:string[]; sleeping:boolean; day:number;
 onBusy:(busy:boolean)=>void; careMode:CareMode|null; onCare:(action:Action)=>void; canSleep:boolean; canPet:boolean;
}
export function Room(p:Props){
 const [location,setLocation]=useState(()=>{try{const saved=localStorage.getItem('petrashka:location');return locations.some(l=>l.id===saved)?saved!:'room';}catch{return 'room';}});
 const stage=useRef<HTMLElement>(null);const actor=useRef<HTMLDivElement>(null);const m=useRef(resting());const [motion,setMotion]=useState(resting);
 const [muted,setMuted]=useState(isSoundMuted);const [hitCount,setHitCount]=useState(0);
 const [deathChoice,setDeathChoice]=useState<'restart'|'potion'|null>(null);
 const [hit,setHit]=useState<Hit>('head');
 const props=useRef(p);props.current=p;
 const target=useRef({x:0,y:0});const pointer=useRef<{id:number;startX:number;startY:number;offsetX:number;offsetY:number;dragged:boolean;stroked?:boolean;part:Hit|null}|null>(null);
 const hold=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);const suppressClick=useRef(false);const raf=useRef(0);
 function bounds(){const r=stage.current!.getBoundingClientRect();const size=actor.current!.offsetWidth;return {limit:Math.max(0,(r.width-size)/2),top:-Math.max(0,r.height-size-110),r};}
 function reset(){clearTimeout(hold.current);pointer.current=null;m.current=resting();target.current={x:0,y:0};setMotion({...m.current});props.current.onBusy(false);}
 useEffect(()=>{if(!p.active)reset();},[p.active]);
 function begin(){const ptr=pointer.current;if(!ptr)return;ptr.dragged=true;suppressClick.current=true;m.current.phase='dragging';m.current.elapsed=0;props.current.onBusy(true);haptic();sound('lift');}
 function down(e:PointerEvent<HTMLButtonElement>){if(e.button!==0 || p.careMode==='feed' || pointer.current || (m.current.phase!=='idle'&&m.current.phase!=='reacting')||p.sleeping||p.game.study||p.game.roomAction||p.game.restUntil!==null||p.state==='faint')return;
  prepareHitSound();e.currentTarget.setPointerCapture(e.pointerId);suppressClick.current=false;
  const r=e.currentTarget.getBoundingClientRect();const zone=(e.target as HTMLElement).closest<HTMLElement>('[data-body]')?.dataset.body as Hit|undefined;
  pointer.current={part:zone??bodyPart((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height),id:e.pointerId,startX:e.clientX,startY:e.clientY,offsetX:m.current.x-e.clientX,offsetY:m.current.y-e.clientY,dragged:false};target.current={x:m.current.x,y:m.current.y};if(!p.careMode||p.careMode==='sleep')hold.current=setTimeout(begin,300);
 }
 function move(e:PointerEvent<HTMLButtonElement>){const ptr=pointer.current;if(!ptr||ptr.id!==e.pointerId)return;
  if(!ptr.dragged&&p.careMode&&p.careMode!=='sleep')return;
  const dx=e.clientX-ptr.startX;const dy=e.clientY-ptr.startY;
  if(!ptr.dragged&&ptr.part==='head'&&p.canPet&&Math.abs(dx)>Math.abs(dy)*1.6&&Math.abs(dy)<24){
   clearTimeout(hold.current);
   if(Math.abs(dx)>=24)ptr.stroked=true;
   return;
  }
  if(ptr.stroked)return;
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
  if(!ptr.dragged && e.type==='pointerup'){touchCharacter(ptr.part,ptr.stroked);}
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 }
 function touchCharacter(part:Hit|null,stroked=false){
  if(!part||p.sleeping||p.game.study||p.game.roomAction||p.game.restUntil!==null||p.state==='faint')return;
  if(p.careMode==='wash'&&location==='bathroom'){
   p.onCare(p.careMode);return;
  }
  if(stroked&&!p.careMode){p.onCare('pet');return;}
  if(!p.careMode)react(part);
 }
 function react(part:Hit|null){if(!part||(m.current.phase!=='idle'&&m.current.phase!=='reacting')||props.current.sleeping||props.current.game.study||props.current.game.roomAction||props.current.game.restUntil!==null||props.current.state==='faint')return;setHitCount(n=>n+1);playHitSound();setHit(part);m.current.phase='reacting';m.current.elapsed=0;suppressClick.current=true;props.current.onBusy(true);setMotion({...m.current});haptic();}
 useEffect(()=>{let previous=performance.now();
  const frame=(now:number)=>{const dt=Math.min((now-previous)/1000,.032);previous=now;const s=m.current;s.elapsed+=dt;
   if(s.phase==='reacting'&&s.elapsed>1.3){m.current=resting();props.current.onBusy(false);}
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
  const resize=new ResizeObserver(()=>{if(m.current.phase!=='idle')reset();});if(stage.current)resize.observe(stage.current);
  return()=>{cancelAnimationFrame(raf.current);clearTimeout(hold.current);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',visibility);resize.disconnect();};
 },[]);
 const motionPhase=useRef<Phase>('idle');
 useEffect(()=>{if(p.sleeping||p.game.study||p.game.roomAction||p.game.restUntil!==null||p.state==='faint')reset();},[p.sleeping,p.state,p.game.roomAction?.id,p.game.study?.started,p.game.restUntil]);
 useEffect(()=>{if(p.game.roomAction)select(activities[p.game.roomAction.kind].location,true);},[p.game.roomAction?.id]);

 const activeAction=p.game.roomAction;
 const actionKind=activeAction?.kind;
 const {study, restUntil, economy, updated}=p.game;
 const statusEnd=study?.ends ?? activeAction?.ends ?? restUntil ?? economy.shift?.ends;
 const statusLabel=study?'Петрашка учится':actionKind?activities[actionKind].name:restUntil!==null?'Петрашка отдыхает':'Петрашка работает';
 const secondsLeft=statusEnd===undefined?0:Math.max(0,Math.ceil((statusEnd-updated)/1000));
 const showActivity=p.state!=='faint'&&secondsLeft>0;
 const elapsed=activeAction?Math.max(0,updated-activeAction.started):0;
 const bathPhase:BathPhase|null=actionKind==='bath'?(elapsed<1500?'approach':elapsed<4300?'fill':'soak'):null;
 const toiletPhase:ToiletPhase|null=actionKind==='toilet'?(elapsed<1500?'approach':elapsed<2900?'open':'use'):null;
 const approaching=activeAction&&elapsed<1500;
 const objectPoint=actionKind&&p.game.furniture[actionKind as FurnitureId];
 const activityX=objectPoint?objectPoint.x:actionKind==='bath'?.66:actionKind==='toilet'?.24:actionKind==='computer'?.73:p.sleeping?.23:.5;
 const activityY=(stage.current?.clientHeight??0)*(objectPoint?objectPoint.y-.90:actionKind==='bath'?-.21:actionKind==='toilet'?-.27:actionKind==='computer'?-.10:p.sleeping?-.12:0);
 const activityOffset=(stage.current?.clientWidth??0)*(activityX-.5);
 const busy=motion.phase!=='idle';const phaseText={idle:actionKind?activities[actionKind].name+'…':p.speech,dragging:'А-а-а! Осторожнее! 😳',falling:'Ой, падаю!',landed:'Упс… Я в порядке!', 'getting-up':'Сейчас, сейчас… встаю!',walking:'Топ-топ… обратно в центр',reacting:reactions[hit].text}[motion.phase];
 useEffect(()=>{if(p.careMode==='wash')select('bathroom');if(p.careMode==='sleep')select('room');},[p.careMode]);
 function select(id:string,force=false){if(!force&&p.game.roomAction)return;reset();setLocation(id);try{localStorage.setItem('petrashka:location',id);}catch{/* The location is cosmetic; gameplay remains available. */}}
 return <><section ref={stage} className={'room photo-room '+(p.sleeping?'night':'')+(p.foodTray?' feeding':'')+(bathPhase?' bath-phase-'+bathPhase:'')+(toiletPhase?' toilet-phase-'+toiletPhase:'')} aria-label="Комната Петрашки" data-location={location}>
 <RoomObjects game={p.game} location={location as Location} onActivity={p.onActivity} onSleep={()=>p.onCare('sleep')} onWake={p.onWake} onMove={p.onMove}/>
 <div className="location-photo pixel-location" role="img" aria-label={locations.find(l=>l.id===location)!.label}/>
 {p.sleeping&&<button className="wake-button" onClick={p.onWake}>☀ Разбудить</button>}
 <span className="scene-day">День {p.day}</span>
 {bathPhase&&location==='bathroom'&&<BathScene phase={bathPhase}/>}
 {toiletPhase&&location==='bathroom'&&<ToiletScene phase={toiletPhase} visit={activeAction?.toiletVisit==='poop'?'poop':'pee'} outfit={p.outfit}/>}
 {(bathPhase||toiletPhase)&&showActivity&&<div className="bath-countdown">
  <strong>{toiletPhase?(toiletPhase==='approach'?'Идёт к унитазу':toiletPhase==='open'?'Поднимает крышку':'В туалете'):bathPhase==='approach'?'Идёт к ванне':bathPhase==='fill'?'Набирает воду':'Моется'}</strong>
  <span role="timer" aria-label={toiletPhase?'До конца посещения туалета':'До конца купания'}>{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</span>
 </div>}
 {p.state!=='faint'&&!showActivity&&(busy||p.sleeping||['hungry','sick','dirty','tired','sad'].includes(p.state)||p.speech!==p.status)&&<div className="speech" aria-live="polite">{phaseText}</div>}
 <button className="sound-toggle" aria-label={muted?'Включить звук':'Выключить звук'} onClick={()=>{setMuted(!muted);muteSound(!muted);if(!muted)stopHitSound();else unlockSound();}}>{muted?'🔇':'🔊'}</button>
 {p.state==='faint'&&<section className="death-message" aria-label="Петрашка погиб">
  <strong>Ваш персонаж погиб</strong>
  {deathChoice==='restart'?<>
   <p>Деньги, дни, смены и одежда сбросятся. Новая игра начнётся с переезда в Москву.</p>
   <button onClick={()=>{reset();p.onRestart();}}>Подтвердить новую игру</button>
   <button onClick={()=>setDeathChoice(null)}>Назад</button>
  </>:<>
   <button onClick={()=>setDeathChoice('restart')}>Начать игру заново</button>
   <button onClick={()=>setDeathChoice('potion')}>🧪 Выпить зелье</button>
   {deathChoice==='potion'&&<p role="status">Покупка зелья пока недоступна. Для оплаты нужны Telegram Stars.</p>}
  </>}
 </section>}
 <HygieneEffects hygiene={p.hygiene} floor/>
 <div className="floor-shadow" aria-hidden="true" style={{transform:`translateX(calc(-50% + ${motion.x}px)) scale(${Math.max(.45,1+motion.y/400)})`,opacity:Math.max(.15,.55+motion.y/500)} as CSSProperties}/>
 <div ref={actor} className={'actor-position motion-'+motion.phase+(actionKind?' activity-'+actionKind:'')+(p.sleeping?' activity-sleep':'')+(p.state==='faint'?' is-dead':'')} style={{'--x':`${motion.x+activityOffset}px`,'--y':`${motion.y+activityY}px`,'--tilt':`${motion.tilt}deg`,'--direction':motion.direction,'--hit-x':`${(reactions[hit].cell%3)*50}%`,'--hit-y':`${Math.floor(reactions[hit].cell/3)*50}%`} as CSSProperties}>
 {showActivity&&!bathPhase&&!toiletPhase&&<div className="actor-activity">
  <strong>{statusLabel}</strong>
  <span role="timer" aria-label="Осталось">{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</span>
 </div>}
 <button disabled={p.state==='faint'} className={`mascot ${p.state} ${busy?'':p.effect}`} aria-label="Петрашка: нажмите на часть тела для реакции или удерживайте и перетащите" onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={e=>e.preventDefault()} onClick={e=>{if(e.detail===0&&(!busy||motion.phase==='reacting'))touchCharacter(((e.target as HTMLElement).closest<HTMLElement>('[data-body]')?.dataset.body as Hit)??'head');}}>
 <span key={p.effect==='pet'?`pet-${p.game.cares}`:hitCount} className="layered-character" role="img" aria-label={`Петрашка: ${busy?phaseText:p.status}`}><PixelAvatar outfit={p.outfit} state={p.state} pose={approaching?'walking':actionKind??motion.phase} hit={hit} hygiene={p.hygiene}/></span>
 {(!busy||motion.phase==='reacting')&&(['head','belly','legs','right-arm','left-arm','right-foot','left-foot'] as Hit[]).map(part=><span key={part} data-body={part} className={'body-zone zone-'+part} aria-hidden="true"/>)}</button>
 {p.foodTray&&<span className="feed-mouth-target" aria-hidden="true"/>}
 <HygieneEffects hygiene={p.hygiene}/>
 {actionKind==='computer'&&<span className="screen-spark" aria-hidden="true">✦</span>}
 {actionKind==='tray'&&<span className="toilet-spark" aria-hidden="true">· · ·</span>}
 {motion.phase==='dragging'&&<span className="fright" aria-hidden="true">!</span>}
 </div>
 {!busy&&(p.sleeping||p.effect)&&<div key={p.effect==='pet'?p.game.cares:p.effect} className={'particles '+p.effect} aria-hidden="true">{p.particles.map((symbol,i)=><span key={i}>{symbol}</span>)}</div>}
 {!busy&&p.gain&&<div className="effect-gain" role="status">{p.gain}</div>}
 {p.foodTray}
 <nav className="locations" aria-label="Локации">{locations.map(l=><button key={l.id} aria-pressed={location===l.id} disabled={Boolean(activeAction)} onClick={()=>select(l.id)}><span>{l.icon}</span>{l.label}</button>)}</nav></section></>;
}
