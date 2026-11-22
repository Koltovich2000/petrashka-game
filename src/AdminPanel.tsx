import {useRef,useState,type FormEvent} from 'react';
import {advance,type Game,type Stat} from './game';
import type {AdminValues} from './gameCommands';
import {businessKeys} from './property';

const stats:Record<Stat,string>={
 health:'Здоровье',food:'Сытость',mood:'Настроение',energy:'Энергия',hygiene:'Гигиена',
};
const economy={balance:'Деньги (₽)',xp:'Опыт (XP)'} as const;
const statKeys=Object.keys(stats) as Stat[];
const economyKeys=Object.keys(economy) as (keyof typeof economy)[];
type Field=Stat|keyof typeof economy;
type Changes=Partial<Record<Field,string>>;

export function AdminPanel({game,local,error,onSet,onChange}:{
 game:Game;
 local:boolean;
 error:string;
 onSet:(values:AdminValues)=>Promise<boolean>;
 onChange:(update:(current:Game)=>Game)=>void;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [draft,setDraft]=useState<Changes>({});
 const [saving,setSaving]=useState(false);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(saving)return;
  setSaving(true);
  try{
   const saved=await onSet(Object.fromEntries(Object.entries(draft).map(([field,value])=>[field,Number(value)])));
   if(saved)dialog.current?.close();
  }finally{setSaving(false);}
 }

 function input(key:Field,label:string,value:number,max:number){
  return <label key={key}>{label}
   <input type="number" inputMode="numeric" value={draft[key]??Math.floor(value)} required
    min={0} max={max} step={1} onChange={e=>setDraft({...draft,[key]:e.currentTarget.value})}/>
  </label>;
 }

 function simulate(hours:number){
  onChange(current=>{
   const end=current.updated+hours*3600000;
   const next=advance(current,end,true);
   const offset=current.updated-end;
   const action=next.roomAction;
   const shiftedAction=action&&(action.ends===null
    ?{...action,started:action.started+offset}
    :{...action,started:action.started+offset,ends:action.ends+offset});
   const roomAction=shiftedAction?.cleanupDogMessAt!==undefined
    ?{...shiftedAction,cleanupDogMessAt:shiftedAction.cleanupDogMessAt+offset}:shiftedAction;
   const dogCare=next.dogCare&&{...next.dogCare,startedAt:next.dogCare.startedAt+offset,
    nextMessAt:next.dogCare.nextMessAt+offset,lastFedAt:next.dogCare.lastFedAt+offset,
    diedAt:next.dogCare.diedAt===null?null:next.dogCare.diedAt+offset,
    messes:next.dogCare.messes.map(mess=>({...mess,at:mess.at+offset}))};
   return {
    ...next,updated:current.updated,born:next.born+offset,
    freeFoodAt:Math.max(0,next.freeFoodAt+offset),
    cooldowns:Object.fromEntries(Object.entries(next.cooldowns).map(([key,time])=>[key,Math.max(0,time+offset)])) as Game['cooldowns'],
    restUntil:next.restUntil===null?null:next.restUntil+offset,
    businesses:Object.fromEntries(businessKeys.flatMap(id=>next.businesses[id]===undefined?[]:[[id,Math.max(0,next.businesses[id]+offset)]])),
    roomAction,dogCare,
    hospital:next.hospital&&{...next.hospital,startedAt:Math.max(0,next.hospital.startedAt+offset)},
    protectedUntil:Math.max(0,next.protectedUntil+offset),
   };
  });
  dialog.current?.close();
 }

 return <>
  <button type="button" className="dev-tools-toggle" onClick={()=>{setDraft({});dialog.current?.showModal();}}>Админ-панель</button>
  <dialog ref={dialog} className="modal dev-tools admin-dialog" aria-labelledby="admin-title">
   <button type="button" className="round close" aria-label="Закрыть админ-панель" onClick={()=>dialog.current?.close()}>✕</button>
   <h2 id="admin-title">Админ-панель</h2>
   <p>Ручные настройки твоего сохранения.</p>
   <form onSubmit={submit}>
    {statKeys.map(key=>input(key,stats[key],game[key],Number.MAX_SAFE_INTEGER))}
    {economyKeys.map(key=>input(key,economy[key],game.economy[key],Number.MAX_SAFE_INTEGER))}
    {error&&<p role="alert">{error}</p>}
    <button type="submit" className="gold-button" disabled={saving||Object.keys(draft).length===0}>{saving?'Сохраняем…':'Сохранить настройки'}</button>
   </form>
   {local&&<div className="time-tools">
    {[1,8,24].map(hours=><button key={hours} type="button" onClick={()=>simulate(hours)}>Прошло {hours} ч.</button>)}
   </div>}
  </dialog>
 </>;
}
