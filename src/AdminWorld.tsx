import {useEffect,useRef,useState,type FormEvent} from 'react';
import {PollResults,remainingTime,useWorldClock} from './GameEvents';
import {pollLimits,type WorldState} from './world';

export type WorldCommand={kind:'pause';paused:boolean}|{kind:'poll';id:string;question:string;options:string[];minutes:number};
type Props={world?:WorldState;busy:boolean;submit:(command:WorldCommand)=>Promise<boolean>;refresh:()=>void};

export function AdminWorld({world,busy,submit,refresh}:Props){
 const now=useWorldClock(world?.now);
 const [question,setQuestion]=useState('');
 const [options,setOptions]=useState(['','']);
 const [minutes,setMinutes]=useState('10');
 const draftId=useRef<{key:string;id:string}|undefined>(undefined);
 const poll=world?.poll;
 const active=Boolean(poll&&poll.endsAt>now);
 useEffect(()=>{
  if(!active)return;
  const timer=window.setInterval(refresh,5000);
  return()=>window.clearInterval(timer);
 },[active,refresh]);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const values={question:question.trim(),options:options.map(option=>option.trim()),minutes:Number(minutes)};
  const key=JSON.stringify(values);
  if(draftId.current?.key!==key)draftId.current={key,id:crypto.randomUUID()};
  if(await submit({kind:'poll',id:draftId.current.id,...values})){
   draftId.current=undefined;
   setQuestion('');setOptions(['','']);setMinutes('10');
  }
 }
 if(!world)return <p role="status">Загружаем настройки…</p>;
 return <>
  <div className="admin-edit">
   <h3>Пауза для всех игроков</h3>
   <p role="status">{world.paused?'Игра на паузе':'Игра идёт'}</p>
   <button type="button" disabled={busy} onClick={()=>void submit({kind:'pause',paused:!world.paused})}>
    {world.paused?'Возобновить игру':'Поставить игру на паузу'}
   </button>
  </div>
  {poll&&<div className="admin-edit">
   <h3>{active?'Текущее голосование':'Итоги последнего голосования'}</h3>
   <p>{poll.question}</p>
   {active&&<p>До окончания {remainingTime(poll.endsAt,now)}</p>}
   <PollResults poll={poll}/>
   <button type="button" disabled={busy} onClick={refresh}>Обновить результаты</button>
  </div>}
  {!active&&<form className="admin-edit" onSubmit={create}>
   <h3>Новое голосование</h3>
   <label>Вопрос<input value={question} onChange={event=>setQuestion(event.target.value)} required maxLength={pollLimits.question} disabled={busy}/></label>
   {options.map((option,index)=><label key={index}>Вариант {index+1}
    <input value={option} required maxLength={pollLimits.option} disabled={busy}
     onChange={event=>setOptions(options.map((text,i)=>i===index?event.target.value:text))}/>
   </label>)}
   <div className="admin-inline">
    {options.length<pollLimits.options&&<button type="button" disabled={busy} onClick={()=>setOptions([...options,''])}>Добавить вариант</button>}
    {options.length>2&&<button type="button" disabled={busy} onClick={()=>setOptions(options.slice(0,-1))}>Убрать последний</button>}
   </div>
   <label>Длительность, мин<input type="number" inputMode="numeric" min={1} max={pollLimits.maxMinutes} required
    value={minutes} onChange={event=>setMinutes(event.target.value)} disabled={busy}/></label>
   <button type="submit" className="gold-button" disabled={busy||!question.trim()||options.some(option=>!option.trim())}>
    Отправить всем игрокам
   </button>
  </form>}
 </>;
}
