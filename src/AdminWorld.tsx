import {useEffect,useRef,useState,type FormEvent} from 'react';
import {PollResults,remainingTime,useWorldClock} from './GameEvents';
import {pollLimits,type WorldState} from './world';

export type WorldCommand={kind:'pause';paused:boolean}|{kind:'poll';id:string;question:string;options:string[];minutes:number}|{kind:'removePoll';id:string}|{kind:'manualVotes';id:string;counts:number[]};
function ManualVotes({poll,busy,submit}:{poll:NonNullable<WorldState['poll']>;busy:boolean;submit:(command:WorldCommand)=>Promise<boolean>}){
 const [counts,setCounts]=useState(()=>poll.options.map((_,i)=>String(poll.manualCounts?.[i]??0)));
 const [dirty,setDirty]=useState(false);
 useEffect(()=>{
  if(!dirty)setCounts(poll.options.map((_,i)=>String(poll.manualCounts?.[i]??0)));
 },[poll,dirty]);
 const valid=counts.every(value=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)<=1_000_000);
 return <form className="admin-edit" onSubmit={async event=>{
  event.preventDefault();
  if(valid&&await submit({kind:'manualVotes',id:poll.id,counts:counts.map(Number)}))setDirty(false);
 }}>
  <h3>Добавленные вручную голоса</h3>
  <p>Укажи количество дополнительных голосов за каждый вариант. Они прибавляются к голосам игроков. Повторное сохранение задаёт указанное количество.</p>
  {poll.options.map((option,index)=><label key={index}>{option}
   <input type="number" min={0} max={1_000_000} step={1} inputMode="numeric" required disabled={busy} value={counts[index]}
    onChange={event=>{setDirty(true);setCounts(values=>values.map((value,i)=>i===index?event.target.value:value));}}/>
  </label>)}
  <button type="submit" disabled={busy||!valid||!dirty}>Сохранить голоса</button>
 </form>;
}

type Props={world?:WorldState;busy:boolean;submit:(command:WorldCommand)=>Promise<boolean>;refresh:()=>void};

export function AdminWorld({world,busy,submit,refresh}:Props){
 const now=useWorldClock(world?.now);
 const [question,setQuestion]=useState('');
 const [options,setOptions]=useState(['','']);
 const [minutes,setMinutes]=useState('10');
 const [removeId,setRemoveId]=useState<string>();
 const draftId=useRef<{key:string;id:string}|undefined>(undefined);
 const poll=world?.poll;
 const active=Boolean(world&&poll&&poll.endsAt>world.now);
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
   <div className="admin-poll-heading">
    <h3>{active?'Текущее голосование':'Итоги последнего голосования'}</h3>
    <button type="button" className="admin-remove" aria-label="Удалить голосование" title="Удалить голосование"
     disabled={busy} onClick={()=>setRemoveId(poll.id)}>×</button>
   </div>
   <p>{poll.question}</p>
   {active&&<p>До окончания {remainingTime(poll.endsAt,now)}</p>}
   <PollResults poll={poll}/>
   {active&&<ManualVotes key={poll.id} poll={poll} busy={busy} submit={submit}/>}
   <button type="button" disabled={busy} onClick={refresh}>Обновить результаты</button>
   {removeId===poll.id&&<>
    <p>Удалить голосование у всех игроков?</p>
    <div className="admin-inline">
     <button type="button" className="admin-remove" disabled={busy} onClick={async()=>{
      if(await submit({kind:'removePoll',id:poll.id}))setRemoveId(undefined);
     }}>Удалить</button>
     <button type="button" disabled={busy} onClick={()=>setRemoveId(undefined)}>Отмена</button>
    </div>
   </>}
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
