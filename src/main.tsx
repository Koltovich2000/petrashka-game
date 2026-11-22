import {beds} from './property';
import {Shop} from './Shop';
import {activityReason,activities,computerXP,isLocation,type ActivityKind,type Location} from './activities';
import {TUTORIAL,type FoodId} from './balance';
import {PlayerBar} from './PlayerBar';
import {DailyNotebook,WorldNotice} from './GameEvents';
import {hairWetness} from './hair';
import {GameIcon} from './GameIcon';
import {Intro} from './Intro';
import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {blocked, hygieneStage, hygieneMessage, parseSave, LAST_INTRO_SCENE, type Action } from './game';
import { authenticateTelegram, initTelegram, inTelegram, haptic, onTelegramLifecycle, type TelegramProfile } from './telegram';
import './style.css';
import './redesign.css';
import { getSoundContext, sound } from './sound';
import {playRoomSound} from './roomSoundEffects';
import { Wardrobe } from './WardrobeScreen';
import { catalog,starterCloset,type Category } from './wardrobe';
import { HomeScreen,stats } from './HomeScreen';
import {RangeScreen} from './RangeScreen';
import {GiftsScreen} from './GiftsScreen';
import {rubles,playerLevel} from './economy';
import {useGameState} from './useGameState';
import {HospitalScreen} from './HospitalScreen';
import {hospitalRules} from './hospital';
import {defaultCharacterName,parseCharacterName} from './characterName';
const AdminPanel=lazy(()=>import('./AdminPanel').then(m=>({default:m.AdminPanel})));
const AdminDashboard=lazy(()=>import('./AdminDashboard').then(m=>({default:m.AdminDashboard})));
const tabs=[{id:'wardrobe',label:'Гардероб'},{id:'range',label:'Полигон'},{id:'room',label:'Главная'},{id:'shop',label:'Магазин'},{id:'gifts',label:'Подарки'}] as const;
function App({profile}: {profile?:TelegramProfile}){
 const playerId=profile?.id;
 const localAdmin=import.meta.env.DEV&&!inTelegram;
 const suffix=playerId?`:telegram:${playerId}`:'';
 const locationKey='petrashka:location'+suffix;
 const [location,setLocation]=useState<Location>(()=>{
  try{const saved=localStorage.getItem(locationKey);return isLocation(saved)?saved:'room';}
  catch{return 'room';}
 });
 const locationRef=useRef(location);
 function changeLocation(next:Location){
  locationRef.current=next;
  setLocation(next);
  try{localStorage.setItem(locationKey,next);}catch{/* The current scene is still available. */}
 }

 const [screen,setScreen]=useState<typeof tabs[number]['id']>('room');
 const [notebook,setNotebook]=useState(false);
 const {game,current:ref,ready,error,commit,send,key,world,needsCharacterName,nameError,clearNameError}=useGameState(profile,locationRef);
 const closet=game.closet??starterCloset();
 const level=playerLevel(game.economy.xp);
 const wetness=hairWetness(game);
 const [motionBusy,setMotionBusy]=useState(false);
 const [activityNotice,setActivityNotice]=useState<{x:number;y:number;text:string;id:number}|null>(null);
 const noticeId=useRef(0);
 const activityBusy=Boolean(game.roomAction||game.restUntil!==null||game.sleepUntil!==null);
 function noticeOnClick(event:MouseEvent<HTMLDivElement>){
  const current=ref.current;
  if(current.health===0)return;
  const target=event.target as Element;
  if(screen==='range'||screen==='gifts'||target.closest('.player-bar,.world-events,.event-dialog,.bottom-nav,.locations,.range-tab,.cancel-activity,.wake-button,.sound-toggle,.dev-tools,.dev-tools-toggle,.bath-sponge,.scene-pass-ball,.room-dog,.dog-care-panel'))return;
  const kind=current.roomAction?.kind;
  if(kind==='bath'){event.preventDefault();event.stopPropagation();return;}
  const text=kind==='toilet'?'Ваш персонаж в туалете':kind==='tray'?'Ваш персонаж проверяет лоток':
   kind?'Ваш персонаж '+activities[kind].name.toLowerCase():current.restUntil!==null?'Ваш персонаж отдыхает':
   current.sleepUntil!==null?'Ваш персонаж спит':'';
  if(!text)return;
  if(kind==='toilet'){event.preventDefault();event.stopPropagation();}
  const box=target.getBoundingClientRect();
  const x=event.detail?event.clientX:box.left+box.width/2;
  const y=event.detail?event.clientY:box.top+box.height/2;
  const locationNav=target.closest('.photo-room')?.querySelector('.locations')?.getBoundingClientRect();
  if(locationNav&&y>=locationNav.top-48)return;
  const margin=Math.min(145,window.innerWidth/2);
  setActivityNotice({x:Math.min(window.innerWidth-margin,Math.max(margin,x)),y:Math.max(8,y),text,id:++noticeId.current});
 }
 const [eatenFood,setEatenFood]=useState<FoodId|null>(null);
 const [gain,setGain]=useState(''); const [effect,setEffect]=useState(''); const [toast,setToast]=useState(''); const [help,setHelp]=useState(false); const effectTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{
  let telegramInactive=false;
  async function tick(){
   if(document.hidden||telegramInactive)return;
   const update=await send({kind:'sync'});
   if(!update)return;
   const {before:prev,state:next}=update;
   if(next.hospital)return;
   if(prev.roomAction&&!next.roomAction){
    const kind=prev.roomAction.kind;
    setToast(kind==='clean'?'Уборка завершена.':kind==='computer'
     ?'Игра завершена · +'+computerXP+' XP'
     :'Завершено: '+activities[kind].name.toLowerCase());
   }
   else if(!prev.accidentActive&&next.accidentActive)setToast('Ой… На полу какашки!');
   else if(hygieneStage(prev.hygiene)!==hygieneStage(next.hygiene))setToast(hygieneMessage(next.hygiene));
  }
  const visibility=()=>{if(!document.hidden)void tick();};
  const unsubscribe=onTelegramLifecycle(
   ()=>{telegramInactive=false;void tick();},
   ()=>{telegramInactive=true;},
  );
  void tick();
  const timer=window.setInterval(tick,profile?3000:1000);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pageshow',visibility);
  const sync=(e:StorageEvent)=>{if(!profile&&e.key===key&&e.newValue){
   // A storage listener displays the other tab's state without writing it back.
   commit(parseSave(e.newValue),false);
  }};
  window.addEventListener('storage',sync);
  return()=>{
   clearInterval(timer);clearTimeout(effectTimer.current);unsubscribe?.();
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pageshow',visibility);
   window.removeEventListener('storage',sync);
  };
 },[key]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t);},[toast]);

 async function interact(action:Action,foodId?:FoodId){
  if(blocked(ref.current,action))return;
  getSoundContext();
  const dish=foodId??(ref.current.tutorial===TUTORIAL.noodles?'noodles':'free');
  const update=await send({kind:'care',action,food:dish});
  if(!update||update.state.cares===update.before.cares)return;
  const {before,state}=update;
  setEatenFood(action==='feed'?dish:null);
  if(action==='sleep')changeLocation('room');
  haptic();
  if(action==='feed')playRoomSound('eating');
  else sound(action);
  setEffect(action);
  const changes=stats.filter(stat=>state[stat.key]!==before[stat.key]).map(stat=>`${stat.icon} ${state[stat.key]>before[stat.key]?'+':''}${state[stat.key]-before[stat.key]}%`);
  setGain(action==='sleep'?`☾ Сон: +${beds[state.bed].energy} энергии в час`:changes.join(' · ')||(action==='pet'?'':'Уже на максимуме'));
  clearTimeout(effectTimer.current);effectTimer.current=setTimeout(()=>{setEffect('');setGain('');setEatenFood(null);},2400);
  setToast({feed:'Петрашка поел! 🍔',pet:'Петрашка чувствует твою любовь! 💜',sleep:'Сладких снов, Петрашка! 🌙',heal:'Петрашке стало лучше! 💚',wash:'Чистый и свежий! 🫧',play:'Вот это поиграли! ⚽'}[action]);
 }
 async function roomActivity(kind:ActivityKind,dogMessAt?:number){
  const reason=activityReason(ref.current,kind,locationRef.current,dogMessAt);
  if(reason){setToast(reason);return;}
  getSoundContext();
  const update=await send({kind:'activity',activity:kind,dogMessAt});
  if(!update||update.state.roomAction?.kind!==kind||update.state.roomAction?.id===update.before.roomAction?.id)return;
  haptic();
  if(kind!=='toilet')sound(kind==='bath'||kind==='clean'?'wash':'play');
  setToast(kind==='bath'||kind==='yoga'||kind==='dumbbells'?'':activities[kind].name+'…');
 }
 async function washStroke(id:string){
  const update=await send({kind:'wash',id});
  if(update&&update.state.tutorial!==update.before.tutorial){haptic();sound('wash');}
 }
 async function ballReturned(id:string){
  const update=await send({kind:'ball',id});
  const ball=update?.state.roomAction;
  if(ball?.kind==='ball'&&ball.id===id)haptic();
 }
 async function cancelCurrentActivity(){
  const update=await send({kind:'cancel'});
  if(!update||(!update.before.roomAction&&update.before.restUntil===null)||update.state.roomAction||update.state.restUntil!==null)return;
  setActivityNotice(null);
  setToast(update.before.roomAction?.ends===null?'Занятие завершено':'Занятие отменено');
 }
 async function selectClothing(category:Category,index:number){
  const update=await send({kind:'clothing',category,index});
  if(update&&update.state.economy.balance<update.before.economy.balance)setToast('Куплено: '+catalog[category][index].name);
 }
 async function finishIntro(characterName:string){
  const update=await send({kind:'intro',characterName});
  if(!update?.state.introCompleted)return;
  if(!update.before.introCompleted)setToast('Первый день в Москве');
  window.scrollTo(0,0);
 }
 async function hospitalNotice(notice:number,discharge:boolean){
  const result=await send({kind:discharge?'discharge':'notice',notice});
  if(discharge&&result&&!result.state.hospital){
   changeLocation('room');setScreen('room');setHelp(false);setMotionBusy(false);setEatenFood(null);setEffect('');setGain('');setToast('');
  }
 }
 if(!ready)return <main className="app"><p role="status">{error||'Загружаем твоё сохранение…'}</p>{error&&<button onClick={()=>void send({kind:'sync'})}>Повторить</button>}</main>;
 const announcements=world&&<WorldNotice world={world} onVote={async(pollId,choice)=>Boolean(await send({kind:'vote',pollId,choice}))}/>;
 const dashboard=profile?.isAdmin&&<Suspense fallback={null}><AdminDashboard token={profile.gameToken}/></Suspense>;
 if(!game.introCompleted||needsCharacterName)return <>{announcements}
  <div inert={world?.paused&&!needsCharacterName}>
   <Intro index={needsCharacterName?LAST_INTRO_SCENE:game.introScene??0}
    onNext={()=>void send({kind:'introNext',scene:game.introScene??0})} onFinish={finishIntro} error={error}
    requireName={Boolean(profile)} renaming={needsCharacterName} nameError={nameError} onNameChange={clearNameError}/>
  </div>
  {dashboard&&<div className="modern admin-entry">{dashboard}</div>}
 </>;
 if(game.hospital)return <>{announcements}<div inert={world?.paused}><HospitalScreen game={game} hospital={game.hospital} error={error} onNotice={hospitalNotice}/></div>{dashboard&&<div className="modern admin-entry">{dashboard}</div>}</>;
 return <div className={`game-shell modern${activityBusy?' activity-busy':''}`} onClickCapture={noticeOnClick}>
 {activityBusy&&activityNotice&&<div key={activityNotice.id} className="activity-notice" role="status"
  data-below={activityNotice.y<100} style={{left:activityNotice.x,top:activityNotice.y}}
  onAnimationEnd={()=>setActivityNotice(notice=>notice?.id===activityNotice.id?null:notice)}>{activityNotice.text}</div>}
 {dashboard}
 {localAdmin&&<Suspense fallback={null}>
  <AdminPanel game={game} local={localAdmin} error={error}
   onSet={async values=>{
    const update=await send({kind:'admin',values});
    if(update)setToast('Настройки сохранены');
    return Boolean(update);
   }}
   onChange={update=>{if(localAdmin)commit(update(ref.current));}}/>
 </Suspense>}
 <PlayerBar name={parseCharacterName(game.characterName)??defaultCharacterName} level={level} xp={game.economy.xp} balance={game.economy.balance} wetness={wetness} onHelp={()=>setHelp(true)} onTasks={screen==='room'?()=>setNotebook(true):undefined} taskReward={Boolean(game.dailyRewards?.length)}/>
 {announcements}
 {notebook&&<DailyNotebook game={game} serverNow={world?.now} onClose={()=>setNotebook(false)}
  onClaim={async reward=>{
   const result=await send({kind:'dailyClaim',...reward});
   return Boolean(result&&!result.state.dailyRewards?.some(item=>item.day===reward.day&&item.id===reward.id));
  }}/>}
 <div className="game-pages">{tabs.map(tab=><main key={tab.id} hidden={screen!==tab.id} inert={world?.paused&&(tab.id==='room'||tab.id==='shop'||tab.id==='wardrobe')} className="app game-page" data-screen={tab.id}>
  {tab.id==='room'&&<>
   <HomeScreen location={location} onLocationChange={changeLocation} active={screen==='room'} game={game} outfit={closet.outfit} effect={effect} gain={gain} eatenFood={eatenFood} motionBusy={motionBusy} interact={interact} setMotionBusy={setMotionBusy} onWake={()=>void send({kind:'wake'})} onActivity={roomActivity} onCancelActivity={cancelCurrentActivity} onWashStroke={washStroke} onBallReturn={ballReturned} onFeedDog={()=>void send({kind:'feedDog'})} onMove={(id,x,y)=>void send({kind:'move',id,x,y})}/>
  </>}
  {tab.id==='wardrobe'&&<Wardrobe closet={closet} balance={game.economy.balance} level={level} wetness={wetness} onSelect={selectClothing}/>}
  {tab.id==='shop'&&<Shop game={game} onAdoptDog={async dogName=>{
   getSoundContext();
   return Boolean((await send({kind:'adopt',dogName}))?.state.dog);
  }} onSurrenderDog={async()=>(await send({kind:'surrenderDog'}))?.state.dogCare?.sheltered===true}
   onReclaimDog={async()=>Boolean((await send({kind:'reclaimDog'}))?.state.dog)}
   onBuyDogFood={()=>void send({kind:'buyDogFood'})} onBuy={id=>void send({kind:'buyFurniture',id})}/>}
  {tab.id==='range'&&screen==='range'&&<RangeScreen outfit={closet.outfit} wetness={wetness}/>}
  {tab.id==='gifts'&&<GiftsScreen active={screen==='gifts'}/>}
 </main>)}</div>
 <nav className="bottom-nav" aria-label="Разделы игры"><div>{tabs.map(tab=><button key={tab.id} className={tab.id==='range'?'range-tab':undefined} disabled={game.tutorial<TUTORIAL.done&&(tab.id==='wardrobe'||tab.id==='shop')} aria-current={screen===tab.id?'page':undefined} onClick={()=>setScreen(tab.id)}>
  <GameIcon name={tab.id}/>{tab.label}
 </button>)}</div></nav>
 <div className={'toast '
+(toast||error?'visible':'')} role="status">{error||toast}</div>
 {help&&<div className="overlay" onClick={()=>setHelp(false)}><section className="modal" role="dialog" aria-modal="true" aria-label="Как играть"><button className="round close" autoFocus onClick={()=>setHelp(false)}>✕</button><h2>Забота — это просто 💜</h2><p>Под комнатой можно переключать локации. Коротко нажми на голову, живот, руки, ноги или ступни — Петрашка отреагирует. Правая и левая стороны считаются со стороны персонажа. Чтобы погладить, проведи пальцем или мышью по его голове. Зажми Петрашку ниже головы и потяни: он испугается и начнёт раскачиваться. Отпусти — он упадёт на живот, встанет и вернётся в центр. Пока он спит или без сознания, поднимать его нельзя. Падение не отнимает здоровье.</p><p>Корми, гладь, мой Петрашку, играй с ним и укладывай спать. Сон продолжается до кнопки «Разбудить». Во сне потребности заморожены, скорость восстановления энергии зависит от кровати.</p><p>За 10 минут бодрствования: −1 сытости и энергии, −0,5 настроения и гигиены. За одно отсутствие учитываются максимум 12 часов. При длительном истощении здоровье теряется на 2 в час после первых двух часов.</p><p>При гигиене ≤50 мокнут штаны; ≤20 появляется запах; ≤10 — какашки. Движение мочалкой туда и обратно даёт +1 к гигиене. В прихожей коснись мяча в воздухе или на полу, чтобы вернуть его. Каждый возврат даёт +1 к настроению. Оба занятия можно продолжать при 100% и остановить кнопкой «Закончить». Начало мытья стоит 2 энергии, начало игры в мяч — 10 энергии. За компьютером в комнате Петрашка играет 10 минут и получает до {activities.computer.mood} пунктов настроения и {computerXP} XP.</p><p>Показатели над комнатой показывают текущее состояние Петрашки. Гардероб доступен снизу: пять категорий, по десять вещей. Каждое третье поглаживание даёт +1 настроения до 70. Перезарядка: кормление и мячик — 30 сек. Сон доступен без перезарядки. Перезарядки сохраняются после закрытия игры.</p><p>Время идёт и без тебя. При здоровье 0% Петрашка попадает в больницу. Лечение стоит {rubles(hospitalRules.rate)} за полный час.</p>{playerId&&<p className="muted">Твой Telegram ID: <strong>{playerId}</strong></p>}<p className="muted">{profile?'Прогресс хранится на сервере и привязан к твоему аккаунту Telegram.':'В браузере прогресс и тестовая госпитализация сохраняются на этом устройстве.'}</p></section></div>}</div>;
}
function TelegramEntry(){
 const [profile,setProfile]=useState<TelegramProfile>();
 const [error,setError]=useState('');
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{initTelegram();},[]);
 useEffect(()=>{
  const controller=new AbortController();
  authenticateTelegram(controller.signal).then(user=>{
   if(!controller.signal.aborted)setProfile(user);
  }).catch((reason:Error)=>{
   if(!controller.signal.aborted)setError(reason.message);
  });
  return()=>controller.abort();
 },[attempt]);
 if(profile)return <App key={profile.id} profile={profile}/>;
 return <main className="app intro-illustrated telegram-entry">
  <section className="modal">
   <h2>Вход через Telegram</h2>
   <p role="status">{error||'Подтверждаем ваш профиль…'}</p>
   {error&&<button onClick={()=>{setError('');setAttempt(attempt+1);}}>Повторить</button>}
  </section>
 </main>;
}

createRoot(document.getElementById('root')!).render(inTelegram?<TelegramEntry/>:<App/>);
