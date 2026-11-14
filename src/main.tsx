import {beds,buyBed,openBusiness,collectBusiness} from './property';
import {StudyScreen} from './StudyScreen';
import {startStudy,courses,skills} from './study';
import {Shop} from './Shop';
import {startActivity,activityReason,buyFurniture,moveFurniture,activities,type ActivityKind,type FurnitureId} from './activities';
import {savePreset,sameOutfit,type Closet} from './wardrobe';
import type {FoodId} from './balance';
import {PlayerBar} from './PlayerBar';
import {GameIcon} from './GameIcon';
import {Intro} from './Intro';
import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { act, advance, beginIntro, beginTutorial, blocked, feed, wake, hygieneStage, hygieneMessage, KEY, parseSave, type Action, type Game } from './game';
import { authenticateTelegram, initTelegram, inTelegram, haptic, onTelegramLifecycle } from './telegram';
import './style.css';
import './redesign.css';
import { getSoundContext, sound } from './sound';
import { Wardrobe } from './WardrobeScreen';
import { catalog,parseOutfit,starterCloset,wardrobeKey,type Category } from './wardrobe';
import { HomeScreen,stats } from './HomeScreen';
import {Work} from './Work';
import {applyClothing,startShift,claimSalary,rubles,jobAvailable,playerLevel,professions,type Minutes} from './economy';
const DevPanel=import.meta.env.DEV?lazy(()=>import('./DevPanel').then(m=>({default:m.DevPanel}))):null;
const tabs=[{id:'wardrobe',label:'Гардероб'},{id:'room',label:'Главная'},{id:'work',label:'Работа'},{id:'study',label:'Учёба'},{id:'shop',label:'Магазин'}] as const;
type Screen=typeof tabs[number]['id'];
function App({playerId}: {playerId?: string}){
 const suffix=playerId?`:telegram:${playerId}`:'';
 const saveKey=KEY+suffix;
 const locationKey='petrashka:location'+suffix;
 const [salaryGain,setSalaryGain]=useState('');
 useEffect(()=>{if(!salaryGain)return;const timer=setTimeout(()=>setSalaryGain(''),2600);return()=>clearTimeout(timer);},[salaryGain]);
 const [wardrobeDirty,setWardrobeDirty]=useState(false);
 const [pendingScreen,setPendingScreen]=useState<Screen|null>(null);
 const [presetName,setPresetName]=useState('Мой образ');
 const [presetError,setPresetError]=useState('');
 const [screen,setScreen]=useState<Screen>('room');
 const [storageError,setStorageError]=useState(false);
 const [game,setGame]=useState<Game>(()=>{
  try{
   const loaded=parseSave(localStorage.getItem(saveKey));
   if(!playerId&&loaded.introCompleted&&!loaded.closet)loaded.closet=starterCloset(parseOutfit(localStorage.getItem(wardrobeKey)));
   return loaded;
  }catch{return beginIntro();}
 });
 const closet=game.closet??starterCloset();
 useEffect(()=>{const active=closet.presets.find(p=>p.id===closet.activePreset);if(active&&!sameOutfit(active.outfit,closet.outfit))setWardrobeDirty(true);},[closet]);
 useEffect(()=>{if(!wardrobeDirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[wardrobeDirty]);
 const level=playerLevel(game.economy.xp);
 const away=useRef(false);
 const ref=useRef(game); const [motionBusy,setMotionBusy]=useState(false);
 const [activityNotice,setActivityNotice]=useState<{x:number;y:number}|null>(null);
 const bathroomBusy=game.roomAction?.kind==='bath'||game.roomAction?.kind==='toilet';
 useEffect(()=>{
  if(!bathroomBusy){setActivityNotice(null);return;}
  if(!activityNotice)return;
  const timer=setTimeout(()=>setActivityNotice(null),1600);
  return()=>clearTimeout(timer);
 },[activityNotice,bathroomBusy]);
 function blockBathroomClick(event:MouseEvent<HTMLDivElement>){
  const action=ref.current.roomAction?.kind;
  if(action!=='bath'&&action!=='toilet')return;
  const target=event.target as Element;
  if(target.closest('.dev-tools,.dev-tools-toggle'))return;
  event.preventDefault();
  event.stopPropagation();
  const box=target.getBoundingClientRect();
  const x=event.detail?event.clientX:box.left+box.width/2;
  const y=event.detail?event.clientY:box.top+box.height/2;
  setActivityNotice({x:Math.min(window.innerWidth-100,Math.max(100,x)),y:Math.max(54,y)});
 }
 const [gain,setGain]=useState(''); const [effect,setEffect]=useState(''); const [toast,setToast]=useState(''); const [help,setHelp]=useState(false); const effectTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 function save(g:Game){ref.current=g;setGame(g);try{localStorage.setItem(saveKey,JSON.stringify(g));setStorageError(false);}catch{setStorageError(true);}}
 useEffect(()=>{
  let telegramInactive=false;
  const tick=()=>{if(document.hidden||telegramInactive)return;const prev=ref.current;if(!prev.introCompleted)return;const next=advance(prev,Date.now(),away.current);away.current=false;save(next);
   if(prev.economy.shift&&!next.economy.shift&&next.economy.balance>prev.economy.balance){const message='+'+rubles(next.economy.balance-prev.economy.balance);setSalaryGain(message);setToast('Смена завершена! '+message);if(prev.tutorial===1)setScreen('room');}
   else if(prev.study&&!next.study&&next.health>0)setToast(skills[prev.study.skill]+' · +'+courses[prev.study.course].xp+' XP игрока');
   else if(prev.roomAction&&!next.roomAction)setToast('Завершено: '+activities[prev.roomAction.kind].name.toLowerCase());
   else if(prev.health>0&&next.health===0)setToast('Ваш персонаж погиб - начните заново');
   else if(hygieneStage(prev.hygiene)!==hygieneStage(next.hygiene))setToast(hygieneMessage(next.hygiene));
  };
  const leave=()=>{if(!away.current&&ref.current.introCompleted)save(advance(ref.current));away.current=true;};
  const visibility=()=>{if(document.hidden)leave();else tick();};
  const unsubscribe=onTelegramLifecycle(
   ()=>{telegramInactive=false;tick();},
   ()=>{telegramInactive=true;leave();},
  );
  tick();const timer=setInterval(tick,1000);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',leave);
  window.addEventListener('pageshow',tick);
  const sync=(e:StorageEvent)=>{if(e.key===saveKey && e.newValue){const next=parseSave(e.newValue);ref.current=next;setGame(next);}};
  window.addEventListener('storage',sync);
  return()=>{
   clearInterval(timer);clearTimeout(effectTimer.current);unsubscribe?.();
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pagehide',leave);
   window.removeEventListener('pageshow',tick);
   window.removeEventListener('storage',sync);
  };
 },[saveKey]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t);},[toast]);

 function interact(action:Action,foodId?:FoodId){
  if(action==='wash'){roomActivity('bath');return;}
  const current=advance(ref.current);if(blocked(current,action))return;
  const next=action==='feed'?feed(current,foodId??(current.tutorial===2?'noodles':'free')):act(current,action);if(next.cares===current.cares)return;save(next);haptic();sound(action);setEffect(action);
  const changes=stats.filter(s=>next[s.key]!==current[s.key]).map(s=>`${s.icon} ${next[s.key]>current[s.key]?'+':''}${next[s.key]-current[s.key]}%`);
  setGain(action==='sleep'?`☾ Сон: +${beds[next.bed].energy} энергии в час`:changes.join(' · ')||(action==='pet'?'':'Уже на максимуме'));
  clearTimeout(effectTimer.current);effectTimer.current=setTimeout(()=>{setEffect('');setGain('');},2400);
  setToast({feed:'Петрашка поел! 🍔',pet:'Петрашка чувствует твою любовь! 💜',sleep:'Сладких снов, Петрашка! 🌙',heal:'Петрашке стало лучше! 💚',wash:'Чистый и свежий! 🫧',play:'Вот это поиграли! ⚽'}[action]);
 }
 function roomActivity(kind:ActivityKind){const current=advance(ref.current);const reason=activityReason(current,kind);if(reason){setToast(reason);return;}save(startActivity(current,kind));haptic();if(kind==='toilet')getSoundContext();else sound(kind==='bath'?'wash':'play');setToast(activities[kind].name+'…');}
 function updateCloset(next:Closet){save({...advance(ref.current),closet:next});setWardrobeDirty(false);}
 function navigate(next:Screen){if(screen==='wardrobe'&&next!==screen&&wardrobeDirty){setPendingScreen(next);setPresetName(closet.presets.find(p=>p.id===closet.activePreset)?.name??'Мой образ');setPresetError('');return;}setScreen(next);}
 function saveBeforeLeaving(){const c=ref.current.closet??starterCloset();const next=savePreset(c,presetName,c.activePreset??undefined);if(next===c){setPresetError(c.presets.length>=3?'Можно сохранить не более 3 образов':'Укажите название');return;}updateCloset(next);setScreen(pendingScreen!);setPendingScreen(null);}
 function workStart(minutes:Minutes){save(startShift(ref.current,minutes));}
 function collectSalary(){const previous=ref.current;const next=claimSalary(previous);if(next.economy.balance>previous.economy.balance){const message='+'+rubles(next.economy.balance-previous.economy.balance);setSalaryGain(message+' · +'+(next.economy.xp-previous.economy.xp)+' XP');setToast('Зарплата получена! '+message);haptic();}save(next);}
 function hire(id:string){
  const current=advance(ref.current);
  const job=professions.find(p=>p.id===id);
  if(!job||current.health===0||current.economy.shift||current.study||!jobAvailable(job,current))return;
  save({...current,economy:{...current.economy,jobId:id}});
  setToast('Новая профессия: '+job.name);
 }
 function selectClothing(category:Category,index:number){
  const current=advance(ref.current);
  const next=applyClothing(current,category,index);
  if(next===current)return;
  if(!sameOutfit((current.closet??starterCloset()).outfit,(next.closet??starterCloset()).outfit))setWardrobeDirty(true);
  save(next);
  if(next.economy.balance<current.economy.balance)setToast('Куплено: '+catalog[category][index].name);
 }
 function restart(){
  if(ref.current.health!==0)return;
  clearTimeout(effectTimer.current);
  setScreen('room');
  setEffect('');setGain('');setSalaryGain('');setToast('');setHelp(false);setMotionBusy(false);setWardrobeDirty(false);setPendingScreen(null);
  save(beginIntro());
  try{
   if(!playerId)localStorage.removeItem(wardrobeKey);
   localStorage.removeItem(locationKey);
  }catch{setStorageError(true);}
  window.scrollTo(0,0);
 }
 function finishIntro(){
  if(ref.current.introCompleted)return;
  save(beginTutorial());
  setToast('Пора искать работу…');
  window.scrollTo(0,0);
 }
 if(!game.introCompleted)return <Intro onFinish={finishIntro} storageError={storageError}/>;
 const salaryReady=Boolean(game.economy.shift&&game.updated>=game.economy.shift.ends);
 return <div className={`game-shell modern${bathroomBusy?' bath-locked':''}`} onClickCapture={blockBathroomClick}>
 {bathroomBusy&&activityNotice&&<div className="bath-notice" role="status" style={{left:activityNotice.x,top:activityNotice.y}}>{game.roomAction?.kind==='toilet'?'Ваш персонаж в туалете':'Ваш персонаж моется'}</div>}
 {DevPanel&&!inTelegram&&<Suspense fallback={null}><DevPanel game={game} onChange={save}/></Suspense>}
 <PlayerBar level={level} xp={game.economy.xp} balance={game.economy.balance} salary={salaryGain} onHelp={()=>setHelp(true)}/>
 <div className="game-pages">{tabs.map(tab=><main key={tab.id} hidden={screen!==tab.id} className="app game-page">
  {tab.id==='room'&&<>
   <HomeScreen locationKey={locationKey} active={screen==='room'} game={game} outfit={closet.outfit} effect={effect} gain={gain} motionBusy={motionBusy} interact={interact} setMotionBusy={setMotionBusy} restart={restart} onWake={()=>save(wake(ref.current))} onWork={()=>setScreen('work')} onActivity={roomActivity} onMove={(id,x,y)=>save(moveFurniture(ref.current,id,x,y))}/>
  </>}
  {tab.id==='wardrobe'&&<Wardrobe closet={closet} balance={game.economy.balance} level={level} onSelect={selectClothing} onCloset={updateCloset}/>}
  {tab.id==='study'&&<StudyScreen game={game} onStart={(course,skill)=>save(startStudy(ref.current,course,skill))}/>}
  {tab.id==='shop'&&<Shop game={game} onBuy={id=>save(buyFurniture(advance(ref.current),id))} onBed={id=>save(buyBed(ref.current,id))} onOpenBusiness={id=>save(openBusiness(ref.current,id))} onCollectBusiness={id=>save(collectBusiness(ref.current,id))}/>}
  {tab.id==='work'&&<Work active={screen==='work'} game={game} onHire={hire} onStart={workStart} onClaim={collectSalary}/>}
 </main>)}</div>
 <nav className="bottom-nav" aria-label="Разделы игры"><div>{tabs.map(tab=><button key={tab.id} disabled={tab.id==='study'?(game.tutorial<5||level<2):game.tutorial<5&&(tab.id==='wardrobe'||tab.id==='shop'||(tab.id==='work'&&game.tutorial!==1))} aria-current={screen===tab.id?'page':undefined} onClick={()=>navigate(tab.id)}>
  <GameIcon name={tab.id}/>{tab.label}
  {tab.id==='work'&&salaryReady&&<span className="salary-dot" aria-label="Зарплата готова"/>}
 </button>)}</div></nav>
 {pendingScreen&&<div className="overlay"><section className="modal" role="dialog" aria-label="Сохранить образ перед выходом"><h2>Сохранить изменения образа?</h2><p>Одежда уже надета. Можно также сохранить её в выбранный образ или новый слот.</p><input aria-label="Название сохраняемого образа" maxLength={32} value={presetName} onChange={e=>setPresetName(e.target.value)}/>{presetError&&<p role="status">{presetError}</p>}<div className="preset-actions"><button onClick={saveBeforeLeaving}>Сохранить и перейти</button><button onClick={()=>{setWardrobeDirty(false);setScreen(pendingScreen);setPendingScreen(null);}}>Перейти без сохранения образа</button><button onClick={()=>setPendingScreen(null)}>Остаться</button></div></section></div>}
 <div className={'toast '
+(toast||storageError?'visible':'')} role="status">{storageError?'Не удалось сохранить прогресс':toast}</div>
 {help&&<div className="overlay" onClick={()=>setHelp(false)}><section className="modal" role="dialog" aria-modal="true" aria-label="Как играть"><button className="round close" autoFocus onClick={()=>setHelp(false)}>✕</button><h2>Забота — это просто 💜</h2><p>Под комнатой можно переключать локации. Коротко нажми на голову, живот, руки, ноги или ступни — Петрашка отреагирует. Правая и левая стороны считаются со стороны персонажа. Чтобы погладить, используй кнопку «Погладить». Зажми Петрашку мышью или пальцем и потяни: он испугается и начнёт раскачиваться. Отпусти — он упадёт на живот, встанет и вернётся в центр. Пока он спит или без сознания, поднимать его нельзя. Падение не отнимает здоровье.</p><p>Корми, гладь, мой, лечи Петрашку, играй с ним и укладывай спать. Сон продолжается до кнопки «Разбудить». Во сне потребности заморожены, скорость восстановления энергии зависит от кровати.</p><p>За 10 минут бодрствования: −1 сытости и энергии, −0,5 настроения и гигиены. За одно отсутствие учитываются максимум 12 часов. При длительном истощении здоровье теряется на 2 в час после первых двух часов; офлайн оно не падает ниже 30.</p><p>При гигиене ≤50 мокнут штаны и нельзя начинать смену; ≤20 появляется запах; ≤10 — какашки. Ванна за 2 минуты добавляет 40% гигиены и 4 настроения, расходуя 2 энергии. При полной гигиене бонусов нет. Игра добавляет 20% настроения и расходует 10% энергии.</p><p>Показатели над комнатой показывают текущее состояние Петрашки. Гардероб доступен снизу: пять категорий, по десять вещей. Каждое третье поглаживание даёт +1 настроения до 70. Перезарядка: покормить и поиграть — 30 сек., лечение — 60 сек. Сон доступен без перезарядки. Перезарядки сохраняются после закрытия игры.</p><p>Время идёт и без тебя. При здоровье 0% Петрашка погибает. Нажми «Начать заново», чтобы начать новую игру. Лекарство помогает только живому персонажу.</p><p className="muted">Прогресс хранится только в этом браузере или Telegram на этом устройстве. Очистка данных удалит сохранение.</p></section></div>}</div>;
}
function TelegramEntry(){
 const [playerId,setPlayerId]=useState<string>();
 const [error,setError]=useState('');
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{initTelegram();},[]);
 useEffect(()=>{
  const controller=new AbortController();
  authenticateTelegram(controller.signal).then(id=>{
   if(!controller.signal.aborted)setPlayerId(id);
  }).catch((reason:Error)=>{
   if(!controller.signal.aborted)setError(reason.message);
  });
  return()=>controller.abort();
 },[attempt]);
 if(playerId)return <App key={playerId} playerId={playerId}/>;
 return <main className="app intro-illustrated telegram-entry">
  <section className="modal">
   <h2>Вход через Telegram</h2>
   <p role="status">{error||'Подтверждаем ваш профиль…'}</p>
   {error&&<button onClick={()=>{setError('');setAttempt(attempt+1);}}>Повторить</button>}
  </section>
 </main>;
}

createRoot(document.getElementById('root')!).render(inTelegram?<TelegramEntry/>:<App/>);
