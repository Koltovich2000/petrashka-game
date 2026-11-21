import {activities,activityReason,computerReward,BALL_RETURN_GAIN,type ActivityKind,type FurnitureId,type Location} from './activities';
import {useEffect,useRef,useState} from 'react';
import {blocked,feeling,gameDay,foodReason,hygieneMessage,type Action,type Game,type Stat} from './game';
import {TUTORIAL,tutorialRewards,type FoodId} from './balance';
import {FoodTray} from './FoodTray';
import {Room} from './Room';
import {GameIcon} from './GameIcon';
import {PixelIcon} from './PixelIcon';
import type {Outfit} from './wardrobe';

const labels={dirty:'Хочу тёплый душ и пену!',happy:'Как же хорошо, что ты здесь!',normal:'Побудешь со мной немного?',sleep:'Тсс… Петрашке снятся облака',sick:'Мне бы немного лекарства…',hungry:'Кажется, пора перекусить!',tired:'Можно я немного посплю?',sad:'Обнимашки всё исправят',faint:'Петрашка в больнице'};
export const stats:{key:Stat;label:string;icon:string;color:string}[]=[
 {key:'health',label:'Здоровье',icon:'♥',color:'#ed526b'},
 {key:'food',label:'Сытость',icon:'🍔',color:'#ffa83f'},
 {key:'mood',label:'Настроение',icon:'☺',color:'#9bd65a'},
 {key:'energy',label:'Энергия',icon:'ϟ',color:'#ffc05a'},
 {key:'hygiene',label:'Гигиена',icon:'🫧',color:'#61c9ee'},
];
const actions=[
 ['feed','Покормить'],['play','Поиграть'],
] as const;
export type CareMode=typeof actions[number][0];
const playOptions=[{id:'ball',name:'Мячик'},{id:'computer',name:'Компьютер'}] as const;
const tutorialTexts=[
 'Покорми Петрашку бесплатным бутербродом.',
 'Купи учебную лапшу за '+TUTORIAL.noodlePrice+' ₽ и покорми Петрашку.',
 'Открой «Ванную», нажми на ванну и доведи гигиену до 100% мочалкой.',
 'Вернись в «Комнату» и нажми на кровать.',
];

interface Props {
 onActivity:(kind:ActivityKind,dogMessAt?:number)=>void;onCancelActivity:()=>void;onMove:(id:FurnitureId,x:number,y:number)=>void;
 onWashStroke:(id:string)=>void;onBallReturn:(id:string)=>void;
 location:Location;onLocationChange:(location:Location)=>void; active:boolean; game:Game; outfit:Outfit; effect:string; gain:string; eatenFood:FoodId|null;
 motionBusy:boolean; interact:(action:Action,food?:FoodId)=>void; setMotionBusy:(busy:boolean)=>void; onWake:()=>void;
}

export function HomeScreen({location,onLocationChange,active,game,outfit,effect,gain,eatenFood,motionBusy,interact,setMotionBusy,onWake,onActivity,onCancelActivity,onWashStroke,onBallReturn,onMove}:Props){
 const [mode,setMode]=useState<CareMode|null>(null);
 const [recovering,setRecovering]=useState<Set<Stat>>(()=>new Set());
 const previousGame=useRef(game);
 const recoveryTimers=useRef(new Map<Stat,number>());
 useEffect(()=>{
  const previous=previousGame.current;
  previousGame.current=game;
  if(!active)return;
  const gains=stats.filter(({key})=>game[key]>previous[key]);
  if(!gains.length)return;
  setRecovering(current=>new Set([...current,...gains.map(({key})=>key)]));
  for(const {key} of gains){
   window.clearTimeout(recoveryTimers.current.get(key));
   const timer=window.setTimeout(()=>{
    recoveryTimers.current.delete(key);
    setRecovering(current=>{
     const next=new Set(current);
     next.delete(key);
     return next;
    });
   },1400);
   recoveryTimers.current.set(key,timer);
  }
 },[active,game]);
 useEffect(()=>{
  const timers=recoveryTimers.current;
  return()=>{timers.forEach(timer=>window.clearTimeout(timer));timers.clear();};
 },[]);
 const tutorialFeeding=game.tutorial===0||game.tutorial===TUTORIAL.noodles;
 const state=feeling(game);
 const sleeping=game.sleepUntil!==null;
 useEffect(()=>{if(!active||sleeping||state==='faint'||game.roomAction)setMode(null)},[active,sleeping,state,game.roomAction]);
 const particles=({heal:['✚','✦','✚'],wash:['🫧','🫧','💧'],play:['⚽','✦','★'],pet:['♥','♥','✦']} as Record<string,string[]>)[effect]??[];
 const execute=(action:Action)=>{
  if(action==='feed'||action==='play'||blocked(game,action))return;
  interact(action);
  setMode(null);
 };
 function feedAtMouth(id:FoodId){
  if(mode!=='feed'||motionBusy||foodReason(game,id))return;
  interact('feed',id);
  setMode(null);
 }
 const playReason=playOptions.map(({id})=>activityReason(game,id));
 const playTray=mode==='play'&&!game.roomAction&&<div className="scene-food scene-play" role="group" aria-label="Выбор игры">
  <div className="scene-food-grid">
   {playOptions.map(({id,name},index)=>{
    const reason=playReason[index];
    const option=activities[id];
    return <button key={id} type="button" disabled={motionBusy||Boolean(reason)} title={reason||name} onClick={()=>{onActivity(id);setMode(null);}}>
     <span className="food-picture"><GameIcon name={id}/></span><strong>{name}</strong>
     <small>{id==='ball'?`+${BALL_RETURN_GAIN} ☺ за возврат`:`+${option.mood} ☺ · +${computerReward.money} ₽ · +${computerReward.xp} XP`} · −{option.energy} ⚡</small>
     {reason&&<span className="play-reason">{reason}</span>}
    </button>;
   })}
  </div>
 </div>;
 return <div className="home-layout" data-tutorial={game.tutorial}>
  {game.tutorial<TUTORIAL.done&&<aside className="tutorial-card" role="status">
   <strong>{game.tutorial+1} / {TUTORIAL.done} · {tutorialTexts[game.tutorial]}</strong>
   <p>+{tutorialRewards[game.tutorial].xp} XP{tutorialRewards[game.tutorial].money>0&&' · +'+tutorialRewards[game.tutorial].money+' ₽'}</p>
  </aside>}

  <section className="stat-deck" aria-label="Показатели Петрашки">{stats.map(stat=><div key={stat.key} className="stat-card" data-recovering={recovering.has(stat.key)||undefined}>
   <PixelIcon kind={stat.key}/><div><span>{stat.label}</span><strong>{Math.floor(game[stat.key])}%</strong></div>
   <progress aria-label={stat.label} value={game[stat.key]} max={100} style={{accentColor:stat.color}}/>
  </div>)}</section>
  <Room playTray={playTray} location={location} onLocationChange={onLocationChange} onEnterRoom={()=>{setMode(null);onLocationChange('room');}} foodTray={mode==='feed'&&!blocked(game,'feed')?<FoodTray game={game} onFeed={feedAtMouth}/>:null} game={game} onActivity={onActivity} onCancelActivity={onCancelActivity} onWashStroke={onWashStroke} onBallReturn={onBallReturn} onMove={onMove} hygiene={game.hygiene} onWake={onWake} active={active} outfit={outfit} state={state} status={labels[state]} speech={game.tutorial===0?'Ну всё, я в Москве. Денег ноль. И жрать хочется. Надо что-то придумать.':game.tutorial===TUTORIAL.noodles?'Теперь хватит на лапшу. Надо поесть.':game.floorMess[location]?'Надо убрать какашки с пола.':hygieneMessage(game.hygiene)||labels[state]} effect={effect} gain={gain} eatenFood={eatenFood} particles={particles} sleeping={sleeping} day={gameDay(game)} onBusy={setMotionBusy} careMode={mode} onCare={execute} canSleep={!blocked(game,'sleep')} canPet={!blocked(game,'pet')}/>
  <section className="quick-care" aria-label="Действия">
   <div className="quick-actions">
    {actions.map(([key,label])=>{
     const reason=key==='play'?(playReason[0]===playReason[1]?playReason[0]:''):blocked(game,key);
     return <button key={key} className={tutorialFeeding&&key==='feed'?'care-tutorial-target':undefined}
      aria-pressed={mode===key} disabled={motionBusy||Boolean(reason)}
      title={reason||label} onClick={()=>setMode(mode===key?null:key)}>
      <GameIcon name={key}/><strong>{label}</strong>{reason&&<small>{reason}</small>}
     </button>;
    })}
   </div>
  </section>
 </div>;
}
