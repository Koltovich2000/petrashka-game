import {useEffect,useRef,useState,type ReactNode,type PointerEvent,type CSSProperties} from 'react';
import type {Hit} from './body';
import {reactions} from './body';
import {PixelAvatar,type AvatarLayer} from './PixelAvatar';
import {getSoundContext,isSoundMuted,prepareRangeShot,playRangeShot} from './sound';
import {useRangeMotion} from './useRangeMotion';
import {limit} from './rangePhysics';
import {anchorRangeMark,RANGE_BALANCE,freshRange,regrowPart,hitRange,rangePart,type RangePart,type Source} from './rangeDamage';
import {floorFraction,floorReserve,rangeFloor,resolveContacts,wallInset,type BodyBox,type Contact} from './rangeContacts';
import {useRangePieces} from './useRangePieces';
import {useRangeTraps} from './useRangeTraps';
import {playBatImpact,playImpactRecording,playSawCloth,playTrapRecording,preloadTrapRecordings} from './rangeTrapSound';
import {makeRangeBurst,RangeBursts,RangeTrapActors,RangeTrapPanel,type RangeBurstEffect} from './RangeTrapEffects';
import {poopFlightTime,RangePoopProjectile,RangePoopSplat,type PoopThrow} from './RangePoopEffects';
import type {Outfit} from './wardrobe';
import type {HairWetness} from './hair';
import './range.css';

type Weapon='pistol'|'bat'|'hand';
type DamageType='hole'|'bruise'|'tear'|'scratch'|'splat';
type Damage={
 id:number;
 type:DamageType;
 bodyPart:Hit;
 createdAt:number;
 expiresAt:number;
 layer:AvatarLayer;
 x:number;
 y:number;
 strength?:number;
 trap?:boolean;
};
type Target=Pick<Damage,'bodyPart'|'layer'|'x'|'y'>&{clientX?:number;clientY?:number;aimX?:number;aimY?:number};

const weapons=[{id:'pistol',name:'Пистолет',action:'Выстрелить'},{id:'bat',name:'Бита',action:'Ударить битой'},{id:'hand',name:'Рука',action:'Подбросить'},{id:'poop',name:'Говно',action:'Бросить говно'}] as const;
const poopWeaponIndex=weapons.findIndex(weapon=>weapon.id==='poop');
const timedTrapRecordings={saw:'saw-motor',fan:'fan',weight:'weight-fall'} as const;
type TimedTrap=keyof typeof timedTrapRecordings;
const timedTraps=Object.keys(timedTrapRecordings) as TimedTrap[];
type AvatarBox=[x:number,y:number,width:number,height:number];
const jointBounds:Record<AvatarLayer,AvatarBox>={
 head:[21,-3,58,58],torso:[32,46,36,29],
 'right-arm':[29,50,9,21],'left-arm':[62,50,9,21],
 'right-forearm':[27,70,10,12],'left-forearm':[63,70,10,12],
 'right-leg':[35,70,14,16],'left-leg':[51,70,14,16],
 'right-shin':[27,83,22,18],'left-shin':[51,83,22,18],
};
const collisionLayers=Object.keys(jointBounds) as AvatarLayer[];
const arenaStyle={
 '--range-wall-inset':`${wallInset*100}%`,
 '--range-floor-inset':`max(${(1-floorFraction)*100}%,${floorReserve}px)`,
} as CSSProperties;
const fragmentBounds:Partial<Record<RangePart,AvatarBox>>={
 'right-arm':[27,50,11,32],'left-arm':[62,50,11,32],
 'right-leg':[27,70,22,32],'left-leg':[51,70,22,32],
};

function hitName(part:RangePart):Hit{return part==='torso'?'belly':part.endsWith('leg')?'legs':part as Hit;}

function WeaponArt({weapon,firing=false}:{weapon:Weapon;firing?:boolean}){
 return <svg viewBox="0 0 96 74" aria-hidden="true" shapeRendering="crispEdges">
  {weapon==='hand'?<path d="M28 40V20H36V36H39V10H47V36H50V14H58V38H61V24H69V48L59 66H33L18 48V39H25L33 47Z" fill="#ffc18d" stroke="#38223b" strokeWidth="3"/>:weapon==='pistol'?<>
   <path d="M21 29H83V47H65L60 52H52L46 70H29L33 46H21Z" fill="#22243b" stroke="#0d1020" strokeWidth="3"/>
   <path d="M21 29H83V41H21Z" fill="#7c89aa" stroke="#191c32" strokeWidth="3"/>
   <path d="M26 32H77M74 34V40M68 34V40" fill="none" stroke="#b9c5dd" strokeWidth="2"/>
   <path d="M50 45H60L57 51H49M39 50L34 64H43L47 50Z" fill="#454c6c" stroke="#101426" strokeWidth="2"/>
   {firing&&<path className="range-muzzle" d="M21 34 11 32 14 25 6 27 6 17 1 25 2 35 0 43 10 39 15 45 15 38Z" fill="#fff4c1" stroke="#ff9d46" strokeWidth="2"/>}
  </>:<>
   <path d="M8 12H15L79 57H84L91 63 86 71 78 67 75 62 6 23V15Z" fill="#b9764b" stroke="#26192a" strokeWidth="3"/>
   <path d="m9 14 6 1 37 27M15 22l22 15" fill="none" stroke="#fac481" strokeWidth="3"/>
   <path d="m69 52 10 5 5 8-5 2-8-7-6-4Z" fill="#4c3455"/>
   <path d="m68 55 4 2m1 2 4 2m1 2 4 2" stroke="#e49394" strokeWidth="2"/>
  </>}
 </svg>;
}

function DamageMark({damage}:{damage:Damage}){
 const {x,y, type,id}=damage;
 if(type==='splat'){
  const scale=damage.strength??1;
  const bottom=anchorRangeMark(damage.layer,x,y+7*scale);
  return <RangePoopSplat id={id} x={x} y={y} scale={scale}
   slide={{x:(bottom.x-x)/scale,y:Math.max(1.6,bottom.y-y)/scale}}/>;
 }
 return <g transform={`translate(${x} ${y}) scale(${damage.strength??1})`} data-damage-id={id} data-damage-type={type} data-trap-damage={damage.trap||undefined} pointerEvents="none" strokeWidth=".7">
  {type==='hole'?<>
   <path d="m-4-2 2-.4-.3-2 2.2 1.2 2-1.2.2 2 2.1.7-1.1 1.7 1 2.1-2 .25-.5 1.5-1.8-1.1-2.2.75.3-2-2-1Z" fill="#222037" stroke="#f0bd92"/>
   <path d="m-1.5-1 2.3-.6 1.3 1.2-1 2-2-.3Z" fill="#151221" stroke="none"/>
  </>:type==='tear'?<>
   <path d="m-5-2 3 .2 1-2 1.1 2.2 3.9-.6-2.5 2 2.9 1.3-4-.1-.9 2.1-1.6-1.4-2.5.8 1.2-2.1Z" fill={damage.trap?'#6a1939':'#23203a'} stroke={damage.trap?'#f1aac0':'#b79cbc'}/>
   {damage.trap&&<path d="M-5-4-1-2m4 0 2-1M-4 3l2-1m4 2 2-2M-2 0l4-1" stroke="#ff526e" fill="none"/>}
  </>:type==='scratch'?<>
   <path d="M-5 1-2-2-1-4M-2 3 1 0 3-3M1 4l4-4" stroke="#841638" strokeWidth="1.45" fill="none"/>
   <path d="M-4 1-2-1M-1 3 1 1m1 3 2-2" stroke="#ff3d61" fill="none"/>
  </>
  :<>
   <path d="M-4-1h1v-2h5v1h2v4H2v1h-5V2h-1Z" fill={damage.trap?'#ab4767':'#8053a1'} fillOpacity=".85" stroke="#50365f"/>
   <path d="M-2-1h3v1h-3Z" fill={damage.trap?'#fc8c9c':'#bd83c4'} stroke="none"/>
  </>}
 </g>;
}

export function RangeScreen({outfit,wetness}:{outfit:Outfit;wetness:HairWetness}){
 const [selected,setSelected]=useState(0);
 const [health,setHealth]=useState(freshRange);
 const ledger=useRef(health);
 const [growing,setGrowing]=useState<string[]>([]);
 const [spawning,setSpawning]=useState(false);
 const [fading,setFading]=useState(false);
 const collapsing=useRef(false);
 const replacementQueued=useRef(false);
 const fragments=useRangePieces((p)=>{
  if(collapsing.current)return;
  after(()=>{
   if(collapsing.current)return;
   fragments.remove(p.id);
   ledger.current=regrowPart(ledger.current,p.part);setHealth(ledger.current);
   setGrowing(parts=>[...parts,p.part]);
   after(()=>setGrowing(parts=>parts.filter(part=>part!==p.part)),600);
  },RANGE_BALANCE.regrowDelay);
 });
 const [emotion,setEmotion]=useState('scared');
 const emotionAt=useRef(-Infinity);
 const [damages,setDamages]=useState<Damage[]>([]);
 const [poopThrows,setPoopThrows]=useState<PoopThrow[]>([]);
 const [swing,setSwing]=useState<{id:number;target:Target}|null>(null);
 const actor=useRef<HTMLDivElement>(null);
 const rig=useRef<HTMLDivElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const impactAt=useRef(0);
 const surfaceTouchAt=useRef(-Infinity);
 const [surfaceTouch,setSurfaceTouch]=useState<(Pick<Contact,'side'|'x'|'y'>&{id:number})|null>(null);
 const [bursts,setBursts]=useState<RangeBurstEffect[]>([]);
 const cameraShake=useRef<Animation|null>(null);
 const dodgeAnimation=useRef<Animation|null>(null);
 const surfaces=useRef<Partial<Record<AvatarLayer,SVGGElement>>>({});
 function surface(layer:AvatarLayer){
  const cached=surfaces.current[layer];
  if(cached?.isConnected)return cached;
  const node=actor.current?.querySelector<SVGGElement>(`[data-avatar-layer="${layer}"]`);
  if(node)surfaces.current[layer]=node;
  return node;
 }
 function measure(layer:AvatarLayer,fragment=false){
  const m=surface(layer)?.getScreenCTM();
  if(!m)return;
  const bounds=(fragment?fragmentBounds[rangePart(layer)]:undefined)??jointBounds[layer];
  const [x,y,w,h]=bounds;
  // Transform the local rectangle without measuring hidden frames of the head atlas.
  return {left:m.a*x+m.c*y+m.e+Math.min(0,m.a*w)+Math.min(0,m.c*h),
   top:m.b*x+m.d*y+m.f+Math.min(0,m.b*w)+Math.min(0,m.d*h),
   width:Math.abs(m.a*w)+Math.abs(m.c*h),height:Math.abs(m.b*w)+Math.abs(m.d*h),
   viewBox:fragment?bounds.join(' '):''};
 }
 const traps=useRangeTraps(stage,bodyBoxes,(kind,hit,part,repeat)=>{
  const target=collisionTarget(hit.layer??hit.part,limit(hit.x,part.x,part.x+part.w),limit(hit.y,part.y,part.y+part.h));
  if(!target||!register(target,kind))return;
  burst(kind,hit.x,hit.y);
  if(kind!=='weight')impactSound(kind==='spikes'?(repeat?'spikes-repeat':'spikes-first'):kind);
 },()=>{
  stopTrapSound('weight');
  impactSound('weight-impact');
 });
 const physics=useRangeMotion(stage,actor,(collision,trapDriven)=>{
  if(collision.boundary&&collision.side!=='ceiling'&&physics.motion==='held'&&performance.now()-surfaceTouchAt.current>=145){
   surfaceTouchAt.current=performance.now();
   const id=++sequence.current;
   setSurfaceTouch({id,side:collision.side,x:collision.x,y:collision.y});
   after(()=>setSurfaceTouch(current=>current?.id===id?null:current),240);
  }
  if(collision.speed<RANGE_BALANCE.collisionMinSpeed||performance.now()-impactAt.current<RANGE_BALANCE.collisionDelay)return;
  impactAt.current=performance.now();
  const target=collisionTarget(collision.layer??collision.part,collision.x,collision.y);
  const heavy=trapDriven&&collision.speed>=515;
  if(target&&register(target,'collision',undefined,heavy)){
   impactSound('collision');
   if(heavy)burst('collision',collision.x,collision.y);
  }
 },(dx,dy,vx,vy)=>{
  const arena=stage.current;
  return arena?resolveContacts(bodyBoxes(),dx,dy,vx,vy,arena.clientWidth,arena.clientHeight):{dx:0,dy:0,contacts:[]};
 },traps.update);

 function bodyBoxes():BodyBox[]{
  const arena=stage.current;
  const body=actor.current;
  if(!arena||!body)return [];
  const room=arena.getBoundingClientRect();
  const left=room.left+arena.clientLeft,top=room.top+arena.clientTop;
  const stroke=body.clientWidth*.014;
  return collisionLayers.flatMap(layer=>{
   const part=rangePart(layer);
   if(ledger.current.detached.has(part))return [];
   const bounds=measure(layer);
   return bounds&&bounds.width&&bounds.height?[{
    x:bounds.left-left-stroke,y:bounds.top-top-stroke,
    w:bounds.width+stroke*2,h:bounds.height+stroke*2,part,layer,
   }]:[];
  });
 }
 function collisionTarget(layer:AvatarLayer,x:number,y:number):Target|undefined{
  const arena=stage.current,body=actor.current;
  const matrix=surface(layer)?.getScreenCTM();
  if(!arena||!body||!matrix)return;
  const room=arena.getBoundingClientRect(),box=body.getBoundingClientRect();
  const clientX=x+room.left+arena.clientLeft,clientY=y+room.top+arena.clientTop;
  const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
  return {x:point.x,y:point.y,layer,bodyPart:hitName(rangePart(layer)),aimX:(clientX-box.left)/box.width*100,aimY:(clientY-box.top)/box.height*104};
 }

 const [reaction,setReaction]=useState<{id:number;part:Hit;target:Target}|null>(null);
 const sequence=useRef(0);
 const timers=useRef(new Set<number>());
 const reactionTimer=useRef<number>(undefined);
 const output=useRef<GainNode>(null);
 const trapSounds=useRef<Partial<Record<TimedTrap,()=>void>>>({});
 const weapon=weapons[selected];

 useEffect(()=>{
  const pending=timers.current;
  preloadTrapRecordings();
  const removeExpired=()=>{
   setDamages(current=>current.filter(damage=>damage.expiresAt>performance.now()));
   if(document.hidden)timedTraps.forEach(stopTrapSound);
  };
  document.addEventListener('visibilitychange',removeExpired);
  return ()=>{
   pending.forEach(timer=>window.clearTimeout(timer));
   pending.clear();

   document.removeEventListener('visibilitychange',removeExpired);
   cameraShake.current?.cancel();
   dodgeAnimation.current?.cancel();
   timedTraps.forEach(stopTrapSound);
   output.current?.disconnect();
   output.current=null;
  };
 },[]);
 useEffect(()=>{
  for(const kind of timedTraps)if(!traps.active.has(kind))stopTrapSound(kind);
 },[traps.active]);

 function after(callback:()=>void,delay:number){
  const timer=window.setTimeout(()=>{timers.current.delete(timer);callback();},delay);
  timers.current.add(timer);
  return timer;
 }

 function rangeAudio(){
  const audio=getSoundContext();
  if(!audio)return;
  if(!output.current){output.current=audio.createGain();output.current.connect(audio.destination);}
  return {audio,output:output.current};
 }
 function stopTrapSound(kind:TimedTrap){
  trapSounds.current[kind]?.();
  delete trapSounds.current[kind];
 }
 function impactSound(kind:'collision'|'weight-impact'|'saw'|'spikes-first'|'spikes-repeat'){
  const sound=rangeAudio();
  if(!sound)return;
  if(kind==='saw')playSawCloth(sound.audio,sound.output);
  else if(kind==='collision')playImpactRecording(sound.audio,sound.output);
  else playTrapRecording(sound.audio,sound.output,kind);
 }
 function burst(kind:RangeBurstEffect['kind'],x:number,y:number){
  const id=++sequence.current;
  const next=makeRangeBurst(id,kind,x,y);
  setBursts(current=>[...current.slice(-5),next]);
  after(()=>setBursts(current=>current.filter(effect=>effect.id!==id)),770);
  if(!stage.current?.animate||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const amount=kind==='weight'?5:kind==='saw'?3:2;
  cameraShake.current?.cancel();
  cameraShake.current=stage.current.animate([
   {translate:'0 0'},{translate:`-${amount}px ${amount}px`},{translate:`${amount}px -${amount}px`},
   {translate:`-${amount/2}px ${amount/2}px`},{translate:'0 0'},
  ],{duration:kind==='weight'?300:210,easing:'ease-out'});
 }
 function register(target:Target,source:Source,id=`hit-${++sequence.current}`,heavyCollision=false){
  if(collapsing.current)return false;
  const part=rangePart(target.layer),previous=ledger.current;
  const next=hitRange(previous,part,source,id);
  if(next===previous)return false;
  const room=stage.current!.getBoundingClientRect();
  const fresh=[...next.detached].filter(p=>!previous.detached.has(p));
  const pieces=fresh.map(p=>{
   const b=measure(p,true)!;
   return {id:++sequence.current,part:p,x:b.left-room.left,y:b.top-room.top,w:b.width,h:b.height,vx:(target.x<50?-1:1)*160,vy:-140,angle:0,spin:target.x<50?-90:90,viewBox:b.viewBox};
  });
  fragments.add(pieces,room.width,room.height);
  if(fresh.includes('torso')){
   collapsing.current=true;
   after(restore,source==='pistol'?RANGE_BALANCE.pistolCollapseDelay:0);
  }
  ledger.current=next;setHealth(next);
  const blade=source==='spikes'||source==='saw';
  const enhanced=blade||source==='weight'||heavyCollision;
  const exposed=part==='head'||(part.endsWith('-arm')&&target.y>62);
  const type=source==='pistol'?'hole':blade?(exposed?'scratch':'tear'):source==='bat'&&part==='torso'?'tear':'bruise';
  addDamage(target,type,enhanced?1.32:1,enhanced);
  if(source==='weight'){
   addDamage({x:50,y:59,layer:'torso',bodyPart:'belly'},'tear',1.25,true,false);
  }
  if(performance.now()-emotionAt.current>=RANGE_BALANCE.emotionDelay){
   emotionAt.current=performance.now();setEmotion(['scared','pain','angry'][Math.floor(Math.random()*3)]);
  }
  return true;
 }
 function restore(){
  timers.current.forEach(t=>window.clearTimeout(t));timers.current.clear();
  collapsing.current=false;replacementQueued.current=false;setFading(false);setGrowing([]);setSpawning(true);
  ledger.current=freshRange();setHealth(ledger.current);setDamages([]);setSwing(null);setReaction(null);setBursts([]);setSurfaceTouch(null);
  setPoopThrows([]);
  cameraShake.current?.cancel();
  dodgeAnimation.current?.cancel();
  fragments.reset();physics.reset();setEmotion('scared');emotionAt.current=-Infinity;impactAt.current=0;
  after(()=>setSpawning(false),550);
 }
 function addDamage(target:Target,type:DamageType,strength=1,trap=false,react=true){
  const id=++sequence.current,createdAt=performance.now();
  const anchor=anchorRangeMark(target.layer,target.x,target.y,strength);
  const damage:Damage={...target,...anchor,id,type,trap,createdAt,expiresAt:createdAt+RANGE_BALANCE.markLifetime};
  setDamages(current=>[...current,damage]);
  function expire(){
   const remaining=damage.expiresAt-performance.now();
   if(remaining>0){after(expire,remaining);return;}
   setDamages(current=>current.filter(mark=>mark.id!==id));
  }
  after(expire,RANGE_BALANCE.markLifetime);
  if(!react)return;
  setReaction({id,part:target.bodyPart,target});
  if(reactionTimer.current!==undefined){window.clearTimeout(reactionTimer.current);timers.current.delete(reactionTimer.current);}
  reactionTimer.current=after(()=>{reactionTimer.current=undefined;setReaction(null);},360);
 }
 function throwPoop(target:Target){
  const arena=stage.current;
  if(!arena||collapsing.current)return;
  const anchor=anchorRangeMark(target.layer,target.x,target.y);
  function follow(){
   if(ledger.current.detached.has(rangePart(target.layer)))return;
   const matrix=surface(target.layer)?.getScreenCTM();
   if(!matrix||!arena)return;
   const {x,y}=new DOMPoint(anchor.x,anchor.y).matrixTransform(matrix);
   const bounds=arena.getBoundingClientRect();
   return {x:x-bounds.left-arena.clientLeft,y:y-bounds.top-arena.clientTop};
  }
  const aim=follow();
  if(!aim)return;
  const id=++sequence.current,miss=Math.random()>=.7;
  const width=arena.clientWidth,height=arena.clientHeight;
  const side=aim.x<width*.68?-1:1;
  const from={x:width*(side<0?.92:.08),y:rangeFloor(height)-13};
  if(miss)after(()=>{
   if(!rig.current||collapsing.current)return;
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const lean=side*(reduced?14:28),angle=side*(reduced?7:17);
   dodgeAnimation.current?.cancel();
   dodgeAnimation.current=rig.current.animate([
    {translate:'0px 0px',rotate:'0deg',offset:0},
    {translate:`${lean}px 10px`,rotate:`${angle}deg`,offset:.24},
    {translate:`${lean}px 10px`,rotate:`${angle}deg`,offset:.64},
    {translate:'0px 0px',rotate:'0deg',offset:1},
   ],{duration:480,easing:'ease-in-out'});
  },poopFlightTime*.43);
  setPoopThrows(current=>[...current,{id,from,aim,arc:limit(Math.abs(aim.x-from.x)*.22,26,78),miss,follow,finish:()=>{
   setPoopThrows(shots=>shots.filter(shot=>shot.id!==id));
   if(!miss&&!collapsing.current&&follow())addDamage(target,'splat',1,false,false);
  }}]);
 }
 function attack(target:Target){
  if(weapon.id==='hand')return;
  if(weapon.id==='poop'){throwPoop(target);return;}
  const id=++sequence.current,kind=weapon.id;
  const sound=rangeAudio();
  if(kind==='pistol')prepareRangeShot();
  setSwing({id,target});
  after(()=>setSwing(current=>current?.id===id?null:current),kind==='bat'?360:260);
  after(()=>{
   const hit=target.clientX===undefined?target:at(target.clientX,target.clientY!);
   if(hit){register(hit,kind,`weapon-${id}`);physics.kick(hit.layer,hit.x<50?-1:1,kind==='bat'?50:26);}
   if(sound&&!isSoundMuted()){
    if(kind==='pistol')playRangeShot(sound.output);
    else if(hit)playBatImpact(sound.audio,sound.output);
   }
  },kind==='bat'?145:90);
 }

 function selectWeapon(index:number){
  if(index===selected)return;
  setSelected(index);
  setSwing(null);
  physics.onWeaponChange(traps.active.size>0);
 }

 function at(clientX:number,clientY:number){
  const element=document.elementFromPoint(clientX,clientY);
  if(!actor.current?.contains(element))return;
  const group=element?.closest<SVGGElement>('[data-avatar-layer]');
  if(!group)return;
  const layer=group.getAttribute('data-avatar-layer') as AvatarLayer;
  if(ledger.current.detached.has(rangePart(layer)))return;
  const matrix=group.getScreenCTM();if(!matrix)return;
  const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
  const box=actor.current.getBoundingClientRect();
  return {x:point.x,y:point.y,layer,bodyPart:hitName(rangePart(layer)),clientX,clientY,aimX:(clientX-box.left)/box.width*100,aimY:(clientY-box.top)/box.height*104};
 }
 function aim(event:PointerEvent<HTMLDivElement>){
  if(event.button!==0)return;
  const target=at(event.clientX,event.clientY);if(!target)return;
  if(weapon.id==='hand'){physics.grab(event,target.layer,target.x,target.y);getSoundContext();}else attack(target);
 }
 const decals:Partial<Record<AvatarLayer,ReactNode[]>>={};
 for(const damage of damages)(decals[damage.layer]??=[]).push(<DamageMark key={damage.id} damage={damage}/>);
 const holding=weapon.id==='hand'&&physics.motion==='held';
 const weaponPosition=holding?{left:'var(--range-grip-x, 50%)',top:'var(--range-grip-y, 58%)'}:swing&&{
  left:`${swing.target.aimX??swing.target.x}%`,top:`${(swing.target.aimY??swing.target.y)/104*100}%`,
 };
 return <section className="range-screen" aria-label="Полигон">
  <div ref={stage} className="range-stage" style={arenaStyle}>
   <RangeBackdrop/>
   <div className="range-boundaries" aria-hidden="true"/>
   {surfaceTouch&&<div key={surfaceTouch.id} className="range-contact" data-side={surfaceTouch.side} aria-hidden="true"
    style={{'--contact-x':`${surfaceTouch.x}px`,'--contact-y':`${surfaceTouch.y}px`} as CSSProperties}/>}
   <RangeTrapPanel active={traps.active} poopSelected={weapon.id==='poop'} selectPoop={()=>selectWeapon(poopWeaponIndex)} activate={kind=>{
    if(!traps.start(kind))return;
    const sound=rangeAudio();
    if(sound&&kind!=='spikes'){
     stopTrapSound(kind);
     trapSounds.current[kind]=playTrapRecording(sound.audio,sound.output,timedTrapRecordings[kind]);
    }
    physics.startLoop();
   }}/>
   {reaction&&<span className="range-reaction" key={`label-${reaction.id}`}>{reactions[reaction.part].text}</span>}
   <div ref={actor} className={`range-actor range-motion-${physics.motion}`} onPointerDown={aim} onPointerMove={physics.dragMove} onPointerUp={event=>physics.release(event)} onPointerCancel={event=>physics.release(event,true)} onLostPointerCapture={event=>physics.release(event,true)}>
    <div ref={rig} className={`range-avatar-rig ${spawning?'range-spawn':''} ${growing.map(p=>'range-grow-'+p).join(' ')} ${Array.from(health.detached).map(p=>'range-cut-'+p).join(' ' )}`} style={{transform:`rotate(${physics.tilt}deg) scale(${physics.squeezeAxis==='horizontal'?1+physics.squash:1-physics.squash*.65},${physics.squeezeAxis==='vertical'?1+physics.squash:1-physics.squash*.65})`}}>
     <PixelAvatar rangeFaces outfit={outfit} wetness={wetness} pose="range" state={emotion} hit={reaction?.part} decals={decals} joints={physics.joints}/>
    </div>
    {weapon.id!=='poop'&&weaponPosition&&<div key={swing?.id??'hand'} className="range-floating-weapon" data-weapon={weapon.id} style={weaponPosition} aria-hidden="true">
     <span className={holding?'range-weapon-art':`range-weapon-art range-attack-${weapon.id}`}>
      <WeaponArt weapon={weapon.id} firing={weapon.id==='pistol'}/>
     </span>
    </div>}
    {reaction&&<span key={`impact-${reaction.id}`} className="range-impact" style={{left:`${reaction.target.aimX??reaction.target.x}%`,top:`${(reaction.target.aimY??reaction.target.y)/104*100}%`}}>✦</span>}
   </div>
   {poopThrows.map(shot=><RangePoopProjectile key={shot.id} shot={shot}/>)}
   <RangeTrapActors active={traps.active} nodes={traps.nodes}/>
   {fragments.shown.map(piece=><div key={piece.id} className={"range-piece"+(fading?" range-old-fade":"")} data-part={piece.part} onPointerDown={e=>{e.stopPropagation();fragments.nudge(piece.id);}} style={{left:piece.x,top:piece.y,width:piece.w,height:piece.h,transform:`rotate(${piece.angle}deg)`}}>
    <PixelAvatar rangeFaces outfit={outfit} wetness={wetness} pose="range" state={piece.part==='head'?'detached':emotion} viewBox={piece.viewBox} joints={{}}/>
   </div>)}
   <RangeBursts bursts={bursts}/>
   <div className="range-selector" role="group" aria-label="Выбор оружия">
    <button type="button" aria-label="Предыдущее оружие" onClick={()=>selectWeapon((selected+weapons.length-1)%weapons.length)}>‹</button>
    <button className="range-keyboard-attack" type="button" disabled={weapon.id==='hand'} onClick={()=>attack({x:50,y:60,layer:'torso',bodyPart:'belly'})} aria-label={`${weapon.action} в центр туловища`}>{weapon.name}</button>
    <button type="button" aria-label="Следующее оружие" onClick={()=>selectWeapon((selected+1)%weapons.length)}>›</button>
   </div>
  </div>
 </section>;
}

function RangeBackdrop(){
 return <svg className="range-backdrop" viewBox="0 0 800 700" preserveAspectRatio="none" aria-hidden="true">
  <defs>
   <linearGradient id="range-metal" x2="0" y2="1"><stop stopColor="#141729"/><stop offset="1" stopColor="#393052"/></linearGradient>
   <radialGradient id="range-light"><stop stopColor="#b287e4" stopOpacity=".4"/><stop offset="1" stopColor="#9671d0" stopOpacity="0"/></radialGradient>
   <pattern id="range-hazard" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="15" height="30" fill="#e5ad44"/><rect x="15" width="15" height="30" fill="#30273e"/></pattern>
  </defs>
  <path d="M0 0H800V700H0Z" fill="url(#range-metal)"/>
  {Array.from({length:7},(_,i)=><g key={i} stroke="#65527e" strokeOpacity=".35"><path d={`M${80+i*110} 0V520M0 ${65+i*65}H800`}/>{[90,250,430].map(y=><circle key={y} cx={85+i*110} cy={y} r="3" fill="#121528"/>)}</g>)}
  <path d="M0 520H800V700H0Z" fill="#211e36"/>
  {Array.from({length:9},(_,i)=><path key={i} d={`M${240+i*40} 520 ${-400+i*200} 700M0 ${530+i*i*3}H800`} stroke="#67557f" strokeOpacity=".4"/>)}
  <path d="M40 0V515M760 0V515" stroke="#101526" strokeWidth="30"/>
  <path d="M40 35V210M760 35V210" stroke="url(#range-hazard)" strokeWidth="20"/>
  <path d="M90 660 235 570H565L710 660" fill="none" stroke="url(#range-hazard)" strokeWidth="9"/>
  {[210,400,590].map(x=><g key={x}><ellipse cx={x} cy="310" rx="150" ry="300" fill="url(#range-light)"/><path d={`M${x-24} 8h48l6 18h-60Z`} fill="#38334e" stroke="#80709c" strokeWidth="3"/><path d={`M${x-23} 27h46`} stroke="#ffe1bd" strokeWidth="5"/></g>)}
  {[125,685].map(x=><g key={x} stroke="#8a70af" fill="none" opacity=".65"><circle cx={x} cy="320" r="37" strokeWidth="4"/><circle cx={x} cy="320" r="23" strokeWidth="3"/><path d={`M${x-47} 320h94M${x} 273v94`}/><circle cx={x} cy="320" r="5" fill="#a28ac7"/></g>)}
  <g fill="#9b83ba" fontSize="15" fontFamily="monospace">{[180,160,140,120,100,80].map((n,i)=><g key={n}><path d={`M167 ${110+i*63}h15`} stroke="#9b83ba" strokeWidth="2"/><text x="190" y={115+i*63}>{n}</text></g>)}<text x="610" y="180">ПОЛИГОН</text><text x="605" y="205" fontSize="10">ТЕСТОВАЯ ЗОНА</text></g>
  <path d="M60 453H142V545H60Z" fill="#302b46" stroke="#776589" strokeWidth="4"/><path d="M60 453H142M60 540H142" stroke="url(#range-hazard)" strokeWidth="12"/>
  <path d="M660 436H752V499H660ZM702 500V545M674 545H730" fill="#27243d" stroke="#8b73a3" strokeWidth="5"/>
  <path d="M676 454h58M676 467h40M676 480h49" stroke="#a085c2" strokeWidth="4"/>
 </svg>;
}
