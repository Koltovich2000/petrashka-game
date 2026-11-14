import type {ActivityKind,FurnitureId} from './activities';
import {useEffect,useState} from 'react';
import {blocked,feeling,gameDay,foodReason,hygieneMessage,type Action,type Game,type Stat} from './game';
import type {FoodId} from './balance';
import {FoodTray} from './FoodTray';
import {Room} from './Room';
import {GameIcon} from './GameIcon';
import {PixelIcon} from './PixelIcon';
import type {Outfit} from './wardrobe';

const labels={dirty:'Хочу тёплый душ и пену!',happy:'Как же хорошо, что ты здесь!',normal:'Побудешь со мной немного?',sleep:'Тсс… Петрашке снятся облака',sick:'Мне бы немного лекарства…',hungry:'Кажется, пора перекусить!',tired:'Можно я немного посплю?',sad:'Обнимашки всё исправят',faint:'Петрашка погиб'};
export const stats:{key:Stat;label:string;icon:string;color:string}[]=[
 {key:'health',label:'Здоровье',icon:'♥',color:'#ed526b'},
 {key:'food',label:'Сытость',icon:'🍔',color:'#ffa83f'},
 {key:'mood',label:'Настроение',icon:'☺',color:'#9bd65a'},
 {key:'energy',label:'Энергия',icon:'ϟ',color:'#ffc05a'},
 {key:'hygiene',label:'Гигиена',icon:'🫧',color:'#61c9ee'},
];
const actions=[
 ['feed','Покормить'],['pet','Погладить'],['play','Поиграть'],['wash','Помыть'],['sleep','Уложить спать'],['heal','Вылечить'],
] as const;
export type CareMode='feed'|'wash'|'sleep';
const tutorialTexts=[
 '1 / 5 · Покорми Петрашку бесплатным бутербродом. +15 XP',
 '2 / 5 · Открой «Работа» и заверши смену с листовками. 15 секунд · +250 ₽ · +30 XP',
 '3 / 5 · Купи учебную лапшу за 100 ₽ и покорми Петрашку. +15 XP',
 '4 / 5 · Помой Петрашку в ванной. Первый душ: 2 минуты, до 100% · +15 XP',
 '5 / 5 · Уложи Петрашку спать. Потребности замрут до пробуждения. +25 XP и +100 ₽',
];

interface Props {
 onActivity:(kind:ActivityKind)=>void;onMove:(id:FurnitureId,x:number,y:number)=>void;
 active:boolean; game:Game; outfit:Outfit; effect:string; gain:string;
 motionBusy:boolean; interact:(action:Action,food?:FoodId)=>void; setMotionBusy:(busy:boolean)=>void; restart:()=>void; onWake:()=>void; onWork:()=>void;
}

export function HomeScreen({active,game,outfit,effect,gain,motionBusy,interact,setMotionBusy,restart,onWake,onWork,onActivity,onMove}:Props){
 const [mode,setMode]=useState<CareMode|null>(null);
 const [actionPage,setActionPage]=useState(0);
 const page=actionPage;
 useEffect(()=>{if(game.tutorial<5)setActionPage(game.tutorial>=3?1:0);},[game.tutorial]);
 const tutorialAction=game.tutorial===0||game.tutorial===2?'feed':game.tutorial===3?'wash':game.tutorial===4?'sleep':null;
 const state=feeling(game);
 const sleeping=game.sleepUntil!==null;
 useEffect(()=>{if(!active||sleeping||state==='faint')setMode(null)},[active,sleeping,state]);
 const particles=sleeping?['z','Z','z']:({feed:['🍔','✦','✦'],heal:['✚','✦','✚'],wash:['🫧','🫧','💧'],play:['⚽','✦','★'],pet:['♥','♥','✦']} as Record<string,string[]>)[effect]??[];
 const execute=(action:Action)=>{
  if(action==='feed'||blocked(game,action))return;
  interact(action);
  setMode(null);
 };
 function choose(action:Action){
  if(action==='play'||action==='heal'||action==='pet'){execute(action);return;}
  setMode(mode===action?null:action);
 }
 function feedAtMouth(id:FoodId){
  if(mode!=='feed'||motionBusy||foodReason(game,id))return;
  interact('feed',id);
  setMode(null);
 }
 const hint=mode==='wash'?'Нажми на Петрашку в ванной.':mode==='sleep'?'Нажми на кровать или перетащи к ней Петрашку.':effect==='play'?'Петрашка играет!':null;
 return <div className="home-layout" data-tutorial={game.tutorial}>
  {game.tutorial<5&&<aside className="tutorial-card" role="status"><strong>{tutorialTexts[game.tutorial]}</strong>{game.tutorial===1&&<button onClick={onWork}>Перейти к работе →</button>}<p>{game.tutorial===0?'Ну всё, я в Москве. Денег ноль. И жрать хочется. Надо что-то придумать.':game.tutorial===2?'О, 250 рублей! Правда, я уже задолбался. Надо поесть.':'Потребности во время обучения не убывают.'}</p></aside>}

  <section className="stat-deck" aria-label="Показатели Петрашки">{stats.map(stat=><div key={stat.key} className="stat-card">
   <PixelIcon kind={stat.key}/><div><span>{stat.label}</span><strong>{Math.floor(game[stat.key])}%</strong></div>
   <progress aria-label={stat.label} value={game[stat.key]} max={100} style={{accentColor:stat.color}}/>
  </div>)}</section>
  <Room foodTray={mode==='feed'&&!blocked(game,'feed')?<FoodTray game={game} onFeed={feedAtMouth}/>:null} game={game} onActivity={onActivity} onMove={onMove} hygiene={game.hygiene} onWake={onWake} active={active} outfit={outfit} state={state} status={labels[state]} speech={game.tutorial===0?'Ну всё, я в Москве. Денег ноль. И жрать хочется. Надо что-то придумать.':game.tutorial===2?'О, 250 рублей! Правда, я уже задолбался. Надо поесть.':hygieneMessage(game.hygiene)||labels[state]} effect={effect} gain={gain} particles={particles} sleeping={sleeping} day={gameDay(game)} onBusy={setMotionBusy} onRestart={restart} careMode={mode} onCare={execute} canSleep={!blocked(game,'sleep')} canPet={!blocked(game,'pet')}/>
  <section className="quick-care" aria-label="Действия">
   {hint&&<p className="care-hint" role="status">{hint}</p>}
   <div className="quick-actions">
    <button type="button" className="care-arrow care-arrow-left" aria-label="Предыдущие действия" aria-controls="care-action-pages"
     disabled={page===0} onClick={()=>{setActionPage(0);setMode(null);}}>
     <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    <div className="care-viewport">
     <div className={`care-track ${page===1?'care-track-next':''}`} id="care-action-pages">
      {[0,1].map(index=><div className="care-page" key={index} inert={page!==index} aria-hidden={page!==index}>
       {actions.slice(index*3,index*3+3).map(([key,label])=>{
        const reason=blocked(game,key);
        return <button key={key} className={tutorialAction===key?'care-tutorial-target':undefined} aria-pressed={mode===key} disabled={motionBusy||Boolean(reason)} title={reason||label} onClick={()=>choose(key)}>
         <GameIcon name={key}/><strong>{label}</strong>{reason&&<small>{reason}</small>}
        </button>;
       })}
      </div>)}
     </div>
    </div>
    <button type="button" className="care-arrow" aria-label="Следующие действия" aria-controls="care-action-pages"
     disabled={page===1} onClick={()=>{setActionPage(1);setMode(null);}}>
     <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
   </div>
  </section>
 </div>;
}
