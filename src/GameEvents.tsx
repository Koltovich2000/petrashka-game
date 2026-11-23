import {useEffect,useRef,useState} from 'react';
import {TUTORIAL} from './balance';
import {dailyDay,dailyStart,newDaily,nextDailyReset,tasks,type DailyReward} from './dailyTasks';
import {rubles} from './economy';
import type {Game} from './game';
import {GameIcon} from './GameIcon';
import type {PollState,WorldState} from './world';
import './game-events.css';

const moscowDate=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});
const moscowTime=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const votePlural=new Intl.PluralRules('ru-RU');
const voteWords:Record<string,string>={one:'голос',few:'голоса',many:'голосов',other:'голоса'};

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
 const daily=game.daily?.day===day?game.daily:game.daily?null:newDaily(day,game,now);
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
  <p className="task-reset">Задания обновляются каждые 12 часов. Следующее обновление в {moscowTime.format(nextDailyReset(now))} МСК.</p>
  {game.tutorial<TUTORIAL.done&&<p>Задания начнут засчитываться после обучения.</p>}
  {feedback&&<p role="status">{feedback}</p>}
  {daily?<ol>{daily.ids.map(id=>{
   const task=tasks[id];
   const count=daily.counts[id]??0;
   const available=pending.some(reward=>reward.day===day&&reward.id===id);
   return <li key={id}>
    <span className="task-tier">{['Лёгкое','Среднее','Сложное'][task.tier]}</span>
    <strong>{task.title}</strong>
    <progress aria-label={task.title} value={count} max={task.target}/>
    <div><span>{count>=task.target?(available?'✓ Выполнено':'✓ Награда получена'):`${count} / ${task.target}`}</span><b>+{rubles(task.reward)}</b></div>
    {available&&<button type="button" disabled={claiming} onClick={()=>void claim({day,id})}>Забрать деньги</button>}
   </li>;
  })}</ol>:<p role="status">Обновляем задания…</p>}
  {earlier.length>0&&<section aria-label="Награды за прошлые задания">
   <h3>Награды за прошлые задания</h3>
   <ul className="past-task-rewards">{earlier.map(reward=><li key={`${reward.day}:${reward.id}`}>
    <strong>{tasks[reward.id].title}</strong>
    <div><span>{moscowDate.format(dailyStart(reward.day))} · {moscowTime.format(dailyStart(reward.day))}</span><b>+{rubles(tasks[reward.id].reward)}</b></div>
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

type Vote=(id:string,choice:number)=>Promise<boolean>;

function PollNotice({poll,serverNow,playerId,suspended,onVote}:{poll:PollState;serverNow:number;playerId:string;suspended:boolean;onVote:Vote}){
 const now=useWorldClock(serverNow);
 const done=serverNow>=poll.endsAt;
 const waiting=!done&&now>=poll.endsAt;
 const resultKey='petrashka:poll-result:'+playerId;
 const [seenResult,setSeenResult]=useState(()=>{
  try{return localStorage.getItem(resultKey)===poll.id;}catch{return false;}
 });
 const [override,setOverride]=useState<{done:boolean;open:boolean}>();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 const open=override?.done===done?override.open:!done||!seenResult;
 useEffect(()=>{
  const node=dialog.current;
  if(open&&!suspended&&!node?.open)node?.showModal();
  if((!open||suspended)&&node?.open)node.close();
 },[open,suspended]);
 function dismiss(){
  setOverride({done,open:false});
  setError('');
  if(done){
   setSeenResult(true);
   try{localStorage.setItem(resultKey,poll.id);}catch{/* The result remains dismissed for this session. */}
  }
 }
 async function vote(index:number){
  if(busy||done||waiting)return;
  setBusy(true);setError('');
  try{if(!await onVote(poll.id,index))setError('Голос не сохранён. Обнови голосование и попробуй снова.');}
  finally{setBusy(false);}
 }
 const total=poll.totalVotes;
 return <>
  <button type="button" className="world-poll-button" onClick={()=>setOverride({done,open:true})}>
   <strong>{done?'Итоги голосования':'Голосование'}</strong>
   <span>{poll.question}</span>
   {!done&&<time>{remainingTime(poll.endsAt,now)}</time>}
  </button>
  <dialog ref={dialog} className="event-dialog poll-dialog" aria-labelledby="poll-title"
   onCancel={event=>{event.preventDefault();dismiss();}}>
   <div className="poll-card">
    <h2 id="poll-title" className="poll-title"><GameIcon name="megaphone"/>{done?'Итоги голосования':'Голосование'}<GameIcon name="megaphone"/></h2>
    {!done&&<button type="button" className="event-close" aria-label="Закрыть голосование" onClick={dismiss}>×</button>}
    <p className="poll-question" dir="auto">{poll.question}</p>
    {poll.counts?<PollResults poll={poll}/>:waiting?<p role="status">Подводим итоги…</p>:
     <div className="poll-options">{poll.options.map((option,index)=><button type="button" key={option} disabled={busy} onClick={()=>void vote(index)}>{option}</button>)}</div>}
    {error&&!done&&!waiting&&poll.choice===null&&<p role="alert">{error}</p>}
    <footer className="poll-meta">
     <span><GameIcon name="voters"/>{total} {voteWords[votePlural.select(total)]}</span>
     {!done&&<span><GameIcon name="clock"/><time dateTime={new Date(poll.endsAt).toISOString()}>До {moscowTime.format(poll.endsAt)} МСК</time></span>}
    </footer>
    {done&&<button type="button" className="poll-ok" onClick={dismiss}>Ок</button>}
   </div>
  </dialog>
 </>;
}

export function WorldNotice({world,playerId,suspended,onVote}:{world:WorldState;playerId:string;suspended:boolean;onVote:Vote}){
 const {paused,poll,now}=world;
 if(!paused&&!poll)return null;
 return <section className="world-events" aria-label="Объявления игры">
  {paused&&<p className="world-paused" role="status">Петрашка поставил на паузу игру</p>}
  {poll&&<PollNotice key={poll.id} poll={poll} serverNow={now} playerId={playerId} suspended={suspended} onVote={onVote}/>}
 </section>;
}
