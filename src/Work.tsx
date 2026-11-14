import {skills} from './study';
import {useEffect,useRef,useState} from 'react';
import type {Game} from './game';
import {GameIcon} from './GameIcon';
import {jobAvailable,jobUnlockReason,professions,rubles,shiftPay,shiftXP,workReason,shiftCost,type Minutes,type Profession} from './economy';


interface Props{
 active:boolean;
 game:Game;
 onHire:(id:string)=>void;
 onStart:(minutes:Minutes)=>void;
 onClaim:()=>void;
}
const descriptions:Record<string,string>={
 cashier:'Сканируй покупки и принимай оплату.',
 bartender:'Готовь напитки и общайся с гостями.',
 logistics:'Планируй маршруты и координируй доставки.',
 courier:'Доставляй заказы по городу и зарабатывай первые деньги.',
 leaflets:'Знакомь прохожих с новыми местами и событиями города.',
 loader:'Помогай перевозить вещи и принимать поставки.',
 seller:'Обслуживай гостей и принимай заказы.',
 editor:'Разрабатывай приложения и решай задачи.',
 blogger:'Управляй командой и проектами.',
};
function requirement(job:Profession){
 const parent=professions.find(item=>item.id===job.parent);
 return [
  `Уровень ${job.level}`,
  parent && `завершённая смена «${parent.name}»`,
  job.skillRequired && `«${skills[job.skill]}» ${job.skillRequired}`,
 ].filter(Boolean).join(' · ');
}

export function Work({active,game,onHire,onStart,onClaim}:Props){
 const {economy}=game;
 const {shift}=economy;
 const [selected,setSelected]=useState(economy.jobId);
 const [sheet,setSheet]=useState(false);
 const [minutes,setMinutes]=useState<Minutes>(10);
 const dialog=useRef<HTMLDialogElement>(null);
 const job=professions.find(item=>item.id===selected)??professions[0];
 const canWork=jobAvailable(job,game);
 const reason=workReason(game,minutes,job),cost=shiftCost(game,job,minutes);
 const left=shift?Math.max(0,Math.ceil((shift.ends-game.updated)/1000)):0;
 useEffect(()=>{if(!active)setSheet(false);},[active]);
 useEffect(()=>{
  if(sheet&&active&&!dialog.current?.open)dialog.current?.showModal();
  if((!sheet||!active)&&dialog.current?.open)dialog.current.close();
 },[sheet,active]);

 function nodes(parent?:string){
  return <ul>{professions.filter(item=>item.parent===parent).map(item=>{
   const available=jobAvailable(item,game);
   const complete=economy.completedJobs.includes(item.id);
   const current=item.id===economy.jobId;
   return <li key={item.id}>
    <button className={`job-node ${current?'current':available?'available':'locked'}`} onClick={()=>{setSelected(item.id);setSheet(true);}}>
     <span className="job-icon" aria-hidden="true">{['cashier','bartender','logistics'].includes(item.id)?item.icon:<GameIcon name={item.id}/>}</span>
     <strong>{item.name}</strong>
     <small>{current?'Текущая':available?'Доступна':'🔒 Закрыта'} · Ур. {item.level}</small>
     <b>{rubles(item.hourly)} / ч</b>
     {complete&&<span className="job-check" aria-label="Есть завершённая смена">✓</span>}
    </button>
    {professions.some(child=>child.parent===item.id)&&nodes(item.id)}
   </li>;
  })}</ul>;
 }

 return <section className="career-screen" aria-label="Работа">
  <div className="screen-heading"><h1><GameIcon name="work"/> Карьера</h1></div>
  {shift&&<div className="shift-summary">
   <strong>{professions.find(item=>item.id===shift.profession)?.name}</strong>
   {left>0?<p>До конца смены: {Math.floor(left/60)}:{String(left%60).padStart(2,'0')} · {rubles(shift.pay)}</p>:<>
    <p>Смена окончена. +{rubles(shift.pay)} и +{shiftXP(shift.minutes)} XP</p>
    <button className="gold-button" onClick={onClaim}>Забрать зарплату</button>
   </>}
  </div>}
  {game.hygiene<=50&&<p className="hygiene-warning" role="status">Штаны намокли. Помойся: для работы гигиена должна быть выше 50%.</p>}
  {game.tutorial===1&&<p className="tutorial-card">Обучение · выбери «Листовки». Первая смена — 15 секунд, награда 250 ₽ и 30 XP.</p>}
  <div className="job-tree" aria-label="Дерево профессий">{nodes()}</div>
  <dialog ref={dialog} className="job-sheet" aria-labelledby="job-title" onClose={()=>setSheet(false)} onClick={e=>{if(e.target===e.currentTarget)setSheet(false);}}>
   <div className="job-sheet-content">
    <button className="sheet-close" aria-label="Закрыть карточку профессии" onClick={()=>setSheet(false)}>✕</button>
    <div className="job-banner" aria-hidden="true">{['cashier','bartender','logistics'].includes(job.id)?job.icon:<GameIcon name={job.id}/>}</div>
    <h2 id="job-title">{job.name}</h2>
    <p>{descriptions[job.id]}</p>
    <dl className="job-facts"><div><dt>Доход за час</dt><dd>{rubles(job.hourly)}</dd></div><div><dt>Опыт за смену</dt><dd>+{game.tutorial===1?30:shiftXP(minutes)} XP</dd></div><div><dt>Уровень профессии</dt><dd>{job.level}</dd></div></dl>
    <p className="job-requirement">{canWork?requirement(job):jobUnlockReason(job,game)}</p><p>Профильный навык: {skills[job.skill]}.</p>
    {canWork&&economy.jobId!==job.id&&<button className="gold-button" disabled={Boolean(shift)||game.health===0} onClick={()=>onHire(job.id)}>Устроиться на работу</button>}
    {canWork&&economy.jobId===job.id&&!shift&&<>
     <div hidden={game.tutorial===1} className="shift-durations" aria-label="Длительность смены">{([10,20,30] as const).map(value=><button key={value} aria-pressed={minutes===value} onClick={()=>setMinutes(value)}>{value} мин.<br/>{rubles(shiftPay(job,value))}</button>)}</div>
     <button className="gold-button" disabled={Boolean(reason)} onClick={()=>{onStart(minutes);setSheet(false);}}>{game.tutorial===1?'Учебная смена · 15 сек.':'Начать смену'}</button>
     {reason&&<p role="status">{reason}</p>}
     <p>Расход: ⚡ {cost.energy} · 🍔 {cost.food} · 🫧 {cost.hygiene} · ☺ {cost.mood}. Фоновый расход во время смены выключен.</p>
    </>}
    {shift&&canWork&&<p>Сначала заверши текущую смену.</p>}
   </div>
  </dialog>
 </section>;
}
