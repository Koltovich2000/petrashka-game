import {useEffect,useRef,useState} from 'react';
import {TUTORIAL} from './balance';
import {dailyDay,dailyStart,newDaily,tasks,type DailyReward} from './dailyTasks';
import {rubles} from './economy';
import type {Game} from './game';
import {GameIcon} from './GameIcon';
import type {PollState,WorldState} from './world';
import './game-events.css';

const moscowDate=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});

export function useWorldClock(serverNow?:number){
 const [now,setNow]=useState(serverNow??Date.now());
 useEffect(()=>{
  const offset=(serverNow??Date.now())-Date.now();
  function tick(){setNow(Date.now()+offset);}
  tick();
  const timer=window.setInterval(tick,1000);
  return()=>window.clearInterval(timer);
 },[serverNow]);
 return now;
}

export function remainingTime(endsAt:number,now:number){
 const seconds=Math.max(0,Math.ceil((endsAt-now)/1000));
 const hours=Math.floor(seconds/3600);
 const minutes=String(Math.floor(seconds/60)%60).padStart(2,'0');
 const remainder=String(seconds%60).padStart(2,'0');
 return hours?`${hours}:${minutes}:${remainder}`:`${minutes}:${remainder}`;
}

export function DailyNotebook({game,serverNow,onClose,onClaim}:{game:Game;serverNow?:number;onClose:()=>void;onClaim:(reward:DailyReward)=>Promise<boolean>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const now=useWorldClock(serverNow);
 const day=dailyDay(now);
 const daily=game.daily?.day===day?game.daily:game.daily?null:newDaily(day,game,false);
 const pending=game.dailyRewards??[];
 const earlier=pending.filter(reward=>reward.day!==day);
 const [claiming,setClaiming]=useState(false);
 const [feedback,setFeedback]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 async function claim(reward:DailyReward){
  if(claiming)return;
  setClaiming(true);setFeedback('');
  try{
   const saved=await onClaim(reward);
   setFeedback(saved?`Получено ${rubles(tasks[reward.id].reward)}.`:'Не удалось получить награду. Попробуй ещё раз.');
  }finally{setClaiming(false);}
 }
 return <dialog ref={dialog} className="event-dialog task-notebook" aria-labelledby="daily-title" onClose={onClose}>
  <header><h2 id="daily-title"><GameIcon name="tasks"/> Задания на день</h2>
   <button type="button" className="event-close" aria-label="Закрыть тетрадь" onClick={()=>dialog.current?.close()}>×</button></header>
  <p className="task-reset">{moscowDate.format(dailyStart(day))} · Обновление в 12:00 МСК</p>
  {game.tutorial<TUTORIAL.done&&<p>Задания начнут засчитываться после обучения.</p>}
  {feedback&&<p role="status">{feedback}</p>}
  {daily?<ol>{daily.ids.map(id=>{
   const task=tasks[id];
   const count=daily.counts[id]??0;
   const available=pending.some(reward=>reward.day===day&&reward.id===id);
   const atReset=id==='healthy'||id==='noSleep';
   return <li key={id}>
    <span className="task-tier">{['Лёгкое','Среднее','Сложное'][task.tier]}</span>
    <strong>{task.title}</strong>
    {!atReset&&<progress aria-label={task.title} value={count} max={task.target}/>}
    <div><span>{count>=task.target?(available?'✓ Выполнено':'✓ Награда получена'):atReset?'Проверка в 12:00 МСК':`${count} / ${task.target}`}</span><b>+{rubles(task.reward)}</b></div>
    {available&&<button type="button" disabled={claiming} onClick={()=>void claim({day,id})}>Забрать деньги</button>}
   </li>;
  })}</ol>:<p role="status">Обновляем задания…</p>}
  {earlier.length>0&&<section aria-label="Награды за прошлые дни">
   <h3>Награды за прошлые дни</h3>
   <ul className="past-task-rewards">{earlier.map(reward=><li key={`${reward.day}:${reward.id}`}>
    <strong>{tasks[reward.id].title}</strong>
    <div><span>{moscowDate.format(dailyStart(reward.day))}</span><b>+{rubles(tasks[reward.id].reward)}</b></div>
    <button type="button" disabled={claiming} onClick={()=>void claim(reward)}>Забрать деньги</button>
   </li>)}</ul>
  </section>}
 </dialog>;
}

export function PollResults({poll}:{poll:PollState}){
 const total=poll.counts?.reduce((sum,value)=>sum+value,0)??0;
 return <ul className="poll-results">{poll.options.map((option,index)=>{
  const votes=poll.counts?.[index]??0;
  return <li key={option}>
   <div><strong>{option}{poll.choice===index?' ✓':''}</strong><span>{votes} · {total?Math.round(votes/total*100):0}%</span></div>
   <progress aria-label={option} max={Math.max(1,total)} value={votes}/>
  </li>;
 })}</ul>;
}

export function WorldNotice({world,onVote}:{world:WorldState;onVote:(id:string,choice:number)=>Promise<boolean>}){
 const poll=world.poll;
 const now=useWorldClock(world.now);
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 const done=Boolean(poll&&now>=poll.endsAt);
 const total=poll?.counts?.reduce((sum,value)=>sum+value,0)??0;
 const winners=done&&total>0&&poll?.options.filter((_,index)=>poll.counts?.[index]===Math.max(...poll.counts!));
 function show(){setOpen(true);dialog.current?.showModal();}
 async function vote(index:number){
  if(!poll||busy||done)return;
  setBusy(true);setError('');
  try{if(!await onVote(poll.id,index))setError('Голос не сохранён. Обнови голосование и попробуй снова.');}
  finally{setBusy(false);}
 }
 if(!world.paused&&!poll)return null;
 return <section className="world-events" aria-label="Объявления игры">
  {world.paused&&<p className="world-paused" role="status">Петрашка поставил на паузу игру</p>}
  {poll&&<button type="button" className="world-poll-button" onClick={show}>
   <strong>{done?'Итоги голосования':'Голосование'}</strong>
   <span>{done&&winners?winners.join(' · '):poll.question}</span>
   {!done&&<time>{remainingTime(poll.endsAt,now)}</time>}
  </button>}
  {poll&&<dialog ref={dialog} className="event-dialog" aria-labelledby="poll-title" onClose={()=>{setOpen(false);setError('');}}>
   {open&&<>
    <header><h2 id="poll-title">{done?'Итоги голосования':'Голосование'}</h2>
     <button type="button" className="event-close" aria-label="Закрыть голосование" onClick={()=>dialog.current?.close()}>×</button></header>
    <p className="poll-question">{poll.question}</p>
    {!done&&<p className="poll-time">До окончания <time>{remainingTime(poll.endsAt,now)}</time></p>}
    {poll.counts?<PollResults poll={poll}/>:done?<p role="status">Подводим итоги…</p>:
     <div className="poll-options">{poll.options.map((option,index)=><button type="button" key={option} disabled={busy} onClick={()=>void vote(index)}>{option}</button>)}</div>}
    {error&&!done&&poll.choice===null&&<p role="alert">{error}</p>}
   </>}
  </dialog>}
 </section>;
}
