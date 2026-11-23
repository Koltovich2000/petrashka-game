import {useEffect,useRef,useState,type CSSProperties,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {GameIcon} from './GameIcon';
import type {TourSection} from './tutorial';
import './tutorial.css';

type GuideStep={
 target:string;
 text:string;
 destination?:string;
 scrub?:boolean;
};

const sectionInfo={
 room:{title:'Главная',text:'Здесь ты заботишься о Петрашке. Переключай комнаты, чтобы накормить его, помыть, уложить спать или поиграть.'},
 wardrobe:{title:'Гардероб',text:'Примеряй и меняй одежду Петрашки. Здесь же можно купить новые вещи за игровые рубли.'},
 range:{title:'Полигон',text:'Испытай оружие и ловушки на Петрашке. Эффекты полигона действуют только здесь.'},
 shop:{title:'Магазин',text:'Здесь можно обустраивать квартиру. Купи мебель или оборудование, а затем расставь их по комнатам. Здесь же можно приютить собаку и купить ей корм.'},
 gifts:{title:'Подарки',text:'Подарок — это благодарность Петрашке за игру. Можно добавить пожелание, которое увидят при открытии подарка.'},
 tasks:{title:'Ежедневные задания',text:'Каждые 12 часов, в 00:00 и 12:00 МСК, здесь появляются три задания. Выполни задание и забери награду в блокноте.'},
} satisfies Record<TourSection,{title:string;text:string}>;

export function sectionGuide(section:TourSection):GuideStep{
 return section==='tasks'
  ?{target:'.player-tasks',text:'Открой блокнот с заданиями'}
  :{target:`[data-guide-tab="${section}"]`,text:`Нажми «${sectionInfo[section].title}»`};
}

type Spot={focus:DOMRect;target:DOMRect;end:DOMRect|null;viewportWidth:number};

export function TutorialSpotlight({root,step}:{root:RefObject<HTMLDivElement|null>;step:GuideStep}){
 const {target:selector,destination,text,scrub}=step;
 const [spot,setSpot]=useState<Spot|null>(null);
 const [dragging,setDragging]=useState(false);

 useEffect(()=>{
  const shell=root.current;
  if(!shell)return;
  let target:HTMLElement|null=null;
  let frame=0;
  setSpot(null);
  setDragging(false);

  function measure(){
   if(!shell)return;
   const next=shell.querySelector<HTMLElement>(selector);
   if(next!==target){
    if(target)resize.unobserve(target);
    target=next;
    if(next){
     resize.observe(next);
     next.scrollIntoView({block:'nearest',inline:'nearest'});
     next.focus({preventScroll:true});
    }
   }
   if(!target||!target.getClientRects().length){setSpot(null);return;}
   const bounds=target.getBoundingClientRect();
   const field=destination?target.closest('.photo-room'):null;
   const end=destination?shell.querySelector(destination)?.getBoundingClientRect()??null:null;
   setSpot({target:bounds,focus:field?.getBoundingClientRect()??bounds,end,viewportWidth:window.innerWidth});
  }
  function refresh(){
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(measure);
  }
  function allows(event:Event){
   return target!==null&&event.target instanceof Node&&target.contains(event.target);
  }
  function prevent(event:Event){
   event.preventDefault();
   event.stopImmediatePropagation();
  }
  function pointerDown(event:PointerEvent){
   if(!allows(event)){prevent(event);return;}
   if(destination)setDragging(true);
  }
  function pointerEnd(){setDragging(false);}
  function click(event:Event){if(!allows(event))prevent(event);}
  function keydown(event:KeyboardEvent){
   if(event.metaKey||event.ctrlKey||event.altKey)return;
   if(event.key==='Tab'){
    prevent(event);
    target?.focus({preventScroll:true});
   }else if(!allows(event))prevent(event);
  }
  function focus(event:FocusEvent){if(!allows(event))target?.focus({preventScroll:true});}
  const resize=new ResizeObserver(refresh);
  resize.observe(shell);
  const mutation=new MutationObserver(refresh);
  mutation.observe(shell,{childList:true,subtree:true});
  measure();
  window.addEventListener('resize',refresh);
  window.addEventListener('scroll',refresh,true);
  document.addEventListener('pointerdown',pointerDown,true);
  document.addEventListener('pointerup',pointerEnd,true);
  document.addEventListener('pointercancel',pointerEnd,true);
  document.addEventListener('click',click,true);
  document.addEventListener('keydown',keydown,true);
  document.addEventListener('focusin',focus,true);
  return()=>{
   cancelAnimationFrame(frame);
   resize.disconnect();
   mutation.disconnect();
   window.removeEventListener('resize',refresh);
   window.removeEventListener('scroll',refresh,true);
   document.removeEventListener('pointerdown',pointerDown,true);
   document.removeEventListener('pointerup',pointerEnd,true);
   document.removeEventListener('pointercancel',pointerEnd,true);
   document.removeEventListener('click',click,true);
   document.removeEventListener('keydown',keydown,true);
   document.removeEventListener('focusin',focus,true);
  };
 },[root,selector,destination]);

 if(typeof document==='undefined')return null;
 const bounds=spot?.target;
 const x=bounds?bounds.left+bounds.width/2:0;
 const y=bounds?bounds.top+bounds.height/2:0;
 const end=spot?.end;
 const hintHalf=spot?Math.min(130,(spot.viewportWidth-24)/2):0;
 const hintLeft=spot&&end?spot.focus.left+spot.focus.width/2:x;
 const above=Boolean(bounds&&!end&&bounds.top>98);
 const hint=spot&&bounds?{
  left:Math.max(hintHalf+8,Math.min(spot.viewportWidth-hintHalf-8,hintLeft)),
  top:end?Math.max(8,spot.focus.top+10):above?bounds.top-9:bounds.bottom+9,
 }:undefined;
 const handStyle={left:x,top:y,
  '--guide-dx':end?`${end.left+end.width/2-x}px`:'0px',
  '--guide-dy':end?`${end.top+end.height/2-y}px`:'0px',
 } as CSSProperties;
 return createPortal(<div className="tutorial-spotlight" data-waiting={!spot||undefined}>
  {spot&&<div className="tutorial-cutout" data-scene={Boolean(end)||undefined}
   style={{left:spot.focus.left-3,top:spot.focus.top-3,width:spot.focus.width+6,height:spot.focus.height+6}} aria-hidden="true"/>}
  <div className="tutorial-hint" data-above={above||undefined} style={hint} role="status">{text}</div>
  {spot&&!dragging&&<div className="tutorial-hand" data-motion={end?(scrub?'scrub':'drag'):'tap'} style={handStyle} aria-hidden="true">
   <GameIcon name="point"/>
  </div>}
 </div>,document.body);
}

export function TourDialog({section,busy,error,onContinue}:{section:TourSection;busy:boolean;error:string;onContinue:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const {title,text}=sectionInfo[section];
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className="event-dialog poll-dialog tour-dialog" aria-labelledby="tour-title" aria-describedby="tour-description"
  onCancel={event=>event.preventDefault()}>
  <div className="poll-card">
   <h2 id="tour-title" className="poll-title"><GameIcon name={section}/>{title}</h2>
   <p id="tour-description">{text}</p>
   {error&&<p role="alert">{error}</p>}
   <button type="button" className="poll-ok" autoFocus disabled={busy} onClick={onContinue}>
    {section==='tasks'?'Начать играть':'Дальше'}
   </button>
  </div>
 </dialog>;
}
