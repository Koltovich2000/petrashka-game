import {useEffect,useRef,useState,type ReactNode,type PointerEvent} from 'react';
import type {Hit} from './body';
import {reactions} from './body';
import {PixelAvatar,type AvatarLayer} from './PixelAvatar';
import {getSoundContext,isSoundMuted,playRangeSound,prepareRangeShot,playRangeShot} from './sound';
import {useRangeMotion} from './useRangeMotion';
import type {Collision} from './rangePhysics';
import {rangeParts as rangePartsList,RANGE_BALANCE,freshRange,regrowPart,hitRange,rangePart} from './rangeDamage';
import {resolveContacts} from './rangeContacts';
import {useRangePieces} from './useRangePieces';
import type {Outfit} from './wardrobe';
import type {HairWetness} from './hair';
import './range.css';

type Weapon='pistol'|'bat'|'hand';
type DamageType='hole'|'bruise'|'tear';
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
 bend?:number;
};
type Target=Pick<Damage,'bodyPart'|'layer'|'x'|'y'>&{clientX?:number;clientY?:number;aimX?:number;aimY?:number};

const weapons=[{id:'pistol',name:'Пистолет',action:'Выстрелить'},{id:'bat',name:'Бита',action:'Ударить битой'},{id:'hand',name:'Рука',action:'Подбросить'}] as const;

function hitName(part:import('./rangeDamage').RangePart):Hit{return part==='torso'?'belly':part.endsWith('leg')?'legs':part as Hit;}

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
 return <g transform={`translate(${x} ${y}) scale(${damage.strength??1})`} data-damage-id={id} data-damage-type={type} strokeWidth=".7">
  {type==='hole'?<>
   <path d="m-4-2 2-.4-.3-2 2.2 1.2 2-1.2.2 2 2.1.7-1.1 1.7 1 2.1-2 .25-.5 1.5-1.8-1.1-2.2.75.3-2-2-1Z" fill="#222037" stroke="#f0bd92"/>
   <path d="m-1.5-1 2.3-.6 1.3 1.2-1 2-2-.3Z" fill="#151221" stroke="none"/>
  </>:type==='tear'?
   <path d="m-5-2 3 .2 1-2 1.1 2.2 3.9-.6-2.5 2 2.9 1.3-4-.1-.9 2.1-1.6-1.4-2.5.8 1.2-2.1Z" fill="#23203a" stroke="#b79cbc"/>
  :<>
   <path d="M-4-1h1v-2h5v1h2v4H2v1h-5V2h-1Z" fill="#8053a1" fillOpacity=".85" stroke="#50365f"/>
   <path d="M-2-1h3v1h-3Z" fill="#bd83c4" stroke="none"/>
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
 const [swing,setSwing]=useState<{id:number;weapon:Weapon;target:Target}|null>(null);
 const actor=useRef<HTMLDivElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const impactAt=useRef(0);
 function measure(part:import('./rangeDamage').RangePart){
  const group=actor.current?.querySelector<SVGGElement>(`[data-avatar-layer="${part}"]`),m=group?.getScreenCTM();
  if(!m)return;
  const b={head:[21,-3,58,58],torso:[32,46,36,29],'right-arm':[27,50,11,32],'left-arm':[62,50,11,32],'right-leg':[27,70,22,32],'left-leg':[51,70,22,32]}[part];
  const pts=[[b[0],b[1]],[b[0]+b[2],b[1]],[b[0],b[1]+b[3]],[b[0]+b[2],b[1]+b[3]]].map(p=>new DOMPoint(...p).matrixTransform(m));
  const left=Math.min(...pts.map(p=>p.x)),top=Math.min(...pts.map(p=>p.y));
  return {left,top,width:Math.max(...pts.map(p=>p.x))-left,height:Math.max(...pts.map(p=>p.y))-top,viewBox:b.join(' ')};
 }
 const physics=useRangeMotion(stage,actor,collision=>{
  if(collision.speed<RANGE_BALANCE.collisionMinSpeed||performance.now()-impactAt.current<RANGE_BALANCE.collisionDelay)return;
  impactAt.current=performance.now();
  const group=actor.current?.querySelector<SVGGElement>(`[data-avatar-layer="${collision.part}"]`);
  if(!group)return;
  const matrix=group.getScreenCTM();
  if(!matrix)return;
  const room=stage.current!.getBoundingClientRect();
  const point=new DOMPoint((collision.x??0)+room.left,(collision.y??0)+room.top).matrixTransform(matrix.inverse());
  register({x:point.x,y:point.y,layer:collision.part!,bodyPart:hitName(collision.part!)},'collision');
 },(x,y,vx,vy)=>{
  const room=stage.current!.getBoundingClientRect();
  const boxes=rangePartsList.flatMap(part=>{
   if(ledger.current.detached.has(part))return [];
   const b=measure(part);
   return b?[{x:b.left-room.left,y:b.top-room.top,w:b.width,h:b.height,part}]:[];
  });
  const result=resolveContacts(boxes,x-physics.position.current.x,y-physics.position.current.y,vx,vy,room.width,room.height);
  return {x:physics.position.current.x+result.dx,y:physics.position.current.y+result.dy,
   vx:result.contact&&(result.contact.side==='left'||result.contact.side==='right')?-vx*.38:vx,
   vy:result.contact&&(result.contact.side==='floor'||result.contact.side==='ceiling')?-vy*.28:vy,collisions:result.contact?[result.contact]:[]};
 });

 const [reaction,setReaction]=useState<{id:number;part:Hit;target:Target}|null>(null);
 const sequence=useRef(0);
 const timers=useRef(new Set<number>());
 const reactionTimer=useRef<number>(undefined);
 const output=useRef<GainNode>(null);
 const weapon=weapons[selected];

 useEffect(()=>{
  const pending=timers.current;
  const removeExpired=()=>{
   setDamages(current=>current.filter(damage=>damage.expiresAt>performance.now()));

  };
  document.addEventListener('visibilitychange',removeExpired);
  return ()=>{
   pending.forEach(timer=>window.clearTimeout(timer));
   pending.clear();

   document.removeEventListener('visibilitychange',removeExpired);
   output.current?.disconnect();
  };
 },[]);

 function after(callback:()=>void,delay:number){
  const timer=window.setTimeout(()=>{timers.current.delete(timer);callback();},delay);
  timers.current.add(timer);
  return timer;
 }

 function register(target:Target,source:import('./rangeDamage').Source,id=`hit-${++sequence.current}`){
  if(collapsing.current)return;
  const part=rangePart(target.layer),previous=ledger.current;
  const next=hitRange(previous,part,source,id);
  if(next===previous)return;
  const room=stage.current!.getBoundingClientRect();
  const fresh=[...next.detached].filter(p=>!previous.detached.has(p));
  const pieces=fresh.map(p=>{
   const group=actor.current!.querySelector<SVGGElement>(`[data-avatar-layer="${p}"]`)!;
   const b=measure(p)!;
   return {id:++sequence.current,part:p,x:b.left-room.left,y:b.top-room.top,w:b.width,h:b.height,vx:(target.x<50?-1:1)*160,vy:-140,angle:0,spin:target.x<50?-90:90,viewBox:b.viewBox};
  });
  fragments.add(pieces,room.width,room.height);
  if(fresh.includes('torso')){
   collapsing.current=true;
   after(()=>restore(true),source==='pistol'?RANGE_BALANCE.pistolCollapseDelay:0);
  }
  ledger.current=next;setHealth(next);
  addDamage(target,source==='pistol'?'hole':source==='bat'&&part==='torso'?'tear':'bruise');
  if(source==='collision'){const audio=getSoundContext();if(audio){if(!output.current){output.current=audio.createGain();output.current.connect(audio.destination);}playRangeSound(audio,output.current,'bat');}}
  if(performance.now()-emotionAt.current>=RANGE_BALANCE.emotionDelay){
   emotionAt.current=performance.now();setEmotion(['scared','pain','angry'][Math.floor(Math.random()*3)]);
  }
 }
 function restore(drop=false){
  timers.current.forEach(t=>window.clearTimeout(t));timers.current.clear();
  collapsing.current=false;replacementQueued.current=false;setFading(false);setGrowing([]);setSpawning(drop);
  ledger.current=freshRange();setHealth(ledger.current);setDamages([]);setSwing(null);setReaction(null);
  fragments.reset();physics.reset();setEmotion('scared');emotionAt.current=-Infinity;impactAt.current=0;
  if(drop)after(()=>setSpawning(false),550);
 }
 function addDamage(target:Target,type:DamageType,strength=1,bend?:number){
  const id=++sequence.current,createdAt=performance.now();
  const damage:Damage={...target,id,type,strength,bend,createdAt,expiresAt:createdAt+RANGE_BALANCE.markLifetime};
  setDamages(current=>[...current,damage]);
  function expire(){
   const remaining=damage.expiresAt-performance.now();
   if(remaining>0){after(expire,remaining);return;}
   setDamages(current=>current.filter(mark=>mark.id!==id));
  }
  after(expire,RANGE_BALANCE.markLifetime);
  setReaction({id,part:target.bodyPart,target});
  if(reactionTimer.current!==undefined){window.clearTimeout(reactionTimer.current);timers.current.delete(reactionTimer.current);}
  reactionTimer.current=after(()=>{reactionTimer.current=undefined;setReaction(null);},360);
 }
 function attack(target:Target){
  if(weapon.id==='hand')return;
  const id=++sequence.current,kind=weapon.id;
  const audio=getSoundContext();
  if(audio&&!output.current){output.current=audio.createGain();output.current.connect(audio.destination);}
  if(kind==='pistol')prepareRangeShot();
  setSwing({id,weapon:kind,target});
  after(()=>setSwing(current=>current?.id===id?null:current),440);
  after(()=>{
   const hit=target.clientX===undefined?target:at(target.clientX,target.clientY!);
   if(hit){register(hit,kind,`weapon-${id}`);physics.kick(hit.x<50?-1:1);}
   if(audio&&output.current&&!isSoundMuted()){
    if(kind==='pistol')playRangeShot(output.current);else playRangeSound(audio,output.current,kind);
   }
  },kind==='bat'?145:90);
 }

 function changeWeapon(direction:number){
  setSelected(index=>(index+direction+weapons.length)%weapons.length);
  setSwing(null);
  physics.reset();
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
  const box=actor.current.getBoundingClientRect();
  return {x:point.x,y:point.y,layer,bodyPart:hitName(rangePart(layer)),clientX,clientY,aimX:(clientX-box.left)/box.width*100,aimY:(clientY-box.top)/box.height*104};
 }
 function aim(event:PointerEvent<HTMLDivElement>){
  if(event.button!==0)return;
  const target=at(event.clientX,event.clientY);if(!target)return;
  if(weapon.id==='hand'){physics.grab(event);getSoundContext();}else attack(target);
 }
 const decals:Partial<Record<AvatarLayer,ReactNode[]>>={};
 for(const damage of damages)(decals[damage.layer]??=[]).push(<DamageMark key={damage.id} damage={damage}/>);
 const joints={...physics.joints};
 for(const damage of damages){
  if(!damage.bend)continue;
  const side=damage.layer.startsWith('right')?'right':'left';
  if(damage.bodyPart==='head')joints.head=(physics.joints.head??0)+damage.bend;
  else if(damage.bodyPart.endsWith('-arm')){
   joints[`${side}-arm`]=(physics.joints[`${side}-arm`]??0)+(side==='right'?-20:20);
   joints[`${side}-forearm`]=(physics.joints[`${side}-forearm`]??0)+(side==='right'?-damage.bend:damage.bend);
  }else if(damage.bodyPart==='legs')joints[damage.layer]=(physics.joints[damage.layer]??0)+20;
 }
 const weaponAnimating=swing?.weapon===weapon.id;
 const target:Pick<Target,'x'|'y'|'aimX'|'aimY'>=weaponAnimating?swing.target:{x:50,y:60};
 return <section className="range-screen" aria-label="Полигон">
  <div className="range-heading"><h1>Полигон</h1><button onClick={()=>restore()}>Восстановить</button></div>
  <div ref={stage} className="range-stage">
   <RangeBackdrop/>
   {reaction&&<span className="range-reaction" key={`label-${reaction.id}`}>{reactions[reaction.part].text}</span>}
   <div ref={actor} className={`range-actor range-motion-${physics.motion}`} style={{translate:`${physics.offset.x}px ${physics.offset.y}px`}} onPointerDown={aim} onPointerMove={physics.dragMove} onPointerUp={event=>physics.release(event)} onPointerCancel={event=>physics.release(event,true)} onLostPointerCapture={event=>physics.release(event,true)}>
    <div className={`range-avatar-rig ${spawning?'range-spawn':''} ${growing.map(p=>'range-grow-'+p).join(' ')} ${Array.from(health.detached).map(p=>'range-cut-'+p).join(' ' )}`} style={{transform:`rotate(${physics.tilt}deg) scale(${physics.squeezeAxis==='horizontal'?1+physics.squash:1-physics.squash*.45},${physics.squeezeAxis==='vertical'?1+physics.squash:1-physics.squash*.45})`}}>
     <PixelAvatar rangeFaces outfit={outfit} wetness={wetness} pose="range" state={emotion} hit={reaction?.part} decals={decals} joints={joints}/>
    </div>
    <div className="range-floating-weapon" data-weapon={weapon.id} style={{left:`${target.aimX??target.x}%`,top:`${(target.aimY??target.y)/104*100}%`}} aria-hidden="true">
     <span key={weaponAnimating?swing.id:weapon.id} className={weaponAnimating?`range-weapon-art range-attack-${weapon.id}`:'range-weapon-art'}>
      <WeaponArt weapon={weapon.id} firing={weaponAnimating&&weapon.id==='pistol'}/>
     </span>
    </div>
    {reaction&&<span key={`impact-${reaction.id}`} className="range-impact" style={{left:`${reaction.target.aimX??reaction.target.x}%`,top:`${(reaction.target.aimY??reaction.target.y)/104*100}%`}}>✦</span>}
   </div>
   {fragments.shown.map(piece=><div key={piece.id} className={"range-piece"+(fading?" range-old-fade":"")} data-part={piece.part} onPointerDown={e=>{e.stopPropagation();fragments.nudge(piece.id);}} style={{left:piece.x,top:piece.y,width:piece.w,height:piece.h,transform:`rotate(${piece.angle}deg)`}}>
    <PixelAvatar rangeFaces outfit={outfit} wetness={wetness} pose="range" state={piece.part==='head'?'detached':emotion} viewBox={piece.viewBox} joints={{}}/>
   </div>)}
  </div>
  <div className="range-selector" role="group" aria-label="Выбор оружия">
   <button type="button" aria-label="Предыдущее оружие" onClick={()=>changeWeapon(-1)}>‹</button>
   <button className="range-keyboard-attack" type="button" disabled={weapon.id==='hand'} onClick={()=>attack({x:50,y:60,layer:'torso',bodyPart:'belly'})} aria-label={`${weapon.action} в центр туловища`}>{weapon.name}</button>
   <button type="button" aria-label="Следующее оружие" onClick={()=>changeWeapon(1)}>›</button>
  </div>
  <p className="range-hint">{weapon.id==='hand'?'Потяни персонажа и отпусти. Быстрый бросок — сильнее удар':'Нажми на персонажа, чтобы выбрать точку удара'}</p>
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
