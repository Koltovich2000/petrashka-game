import {useRef,useState,type RefObject} from 'react';
import type {Location} from './activities';
import {beginIntro,KEY,parseSave,type Game} from './game';
import {runGameCommand,type GameCommand} from './gameCommands';
import type {WorldState} from './world';
import type {TelegramProfile} from './telegram';
import type {HospitalAds} from './hospitalAds';
import type {NotificationStatus} from './NotificationSettings';
import {parseOutfit,starterCloset,wardrobeKey} from './wardrobe';

export function useGameState(profile:TelegramProfile|undefined,location:RefObject<Location>){
 const key=KEY;
 const [game,setGame]=useState(()=>{
  if(profile)return beginIntro();
  try{
   const loaded=parseSave(localStorage.getItem(key),Date.now(),true);
   return loaded.introCompleted&&!loaded.closet?{...loaded,closet:starterCloset(parseOutfit(localStorage.getItem(wardrobeKey)))}:loaded;
  }catch{return beginIntro();}
 });
 const [world,setWorld]=useState<WorldState>();
 const [hospitalPaymentPending,setHospitalPaymentPending]=useState(false);
 const [hospitalAds,setHospitalAds]=useState<HospitalAds>();
 const [notifications,setNotifications]=useState<NotificationStatus>();
 const [needsCharacterName,setNeedsCharacterName]=useState(false);
 const [nameError,setNameError]=useState('');
 const [ready,setReady]=useState(!profile),[error,setError]=useState('');
 const current=useRef(game),pending=useRef(0);
 const queue=useRef<Promise<unknown>>(Promise.resolve());

 function commit(state:Game,persist=true){
  current.current=state;
  setGame(state);
  try{if(!profile&&persist)localStorage.setItem(key,JSON.stringify(state));setError('');return true;}
  catch{setError('Не удалось сохранить прогресс');return false;}
 }

 async function send(command:GameCommand):Promise<{before:Game;state:Game;hospitalAdAttempt?:string}|null>{
  if(!profile){
   const before=current.current,state=runGameCommand(before,command,Date.now(),location.current,import.meta.env.DEV);
   if(!commit(state)&&command.kind==='admin')return null;
   return {before,state};
  }
  if(command.kind==='sync'&&pending.current>0)return null;
  if(command.kind==='intro')setNameError('');
  const scene=location.current;
  pending.current++;
  const task=queue.current.then(async()=>{
   const before=current.current;
   const controller=new AbortController();
   const timeout=window.setTimeout(()=>controller.abort(),12_000);
   try{
    const response=await fetch('/api/game',{
     method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${profile.gameToken}`},
     body:JSON.stringify({command,location:scene}),signal:controller.signal,
    });
    if(response.status===401){setError('Сессия истекла. Открой игру заново через Telegram.');return null;}
    if(response.status===403){setError('Для этого действия нужен доступ администратора.');return null;}
    if(response.status===409&&command.kind==='vote'){setError('Голосование уже завершилось.');return null;}
    if(response.status===409&&command.kind==='intro'){
     const failure=await response.json();
     if(failure.error==='character_name_taken'){
      setNameError('Это имя уже занято. Придумай другое.');
      return null;
     }
    }
    if(!response.ok)throw new Error('Game state unavailable');
    const {state,world,needsCharacterName,hospitalPaymentPending:paymentPending,hospitalAds,hospitalAdAttempt,notifications}=await response.json() as
     {state:Game;world?:WorldState;needsCharacterName?:boolean;hospitalPaymentPending?:boolean;hospitalAds?:HospitalAds;hospitalAdAttempt?:string;notifications?:NotificationStatus};
    setWorld(world);
    setHospitalPaymentPending(Boolean(paymentPending));
    setHospitalAds(hospitalAds);
    setNotifications(notifications);
    setNeedsCharacterName(Boolean(needsCharacterName));
    setReady(true);
    commit(state);
    return {before,state,hospitalAdAttempt};
   }catch{setError('Связь с сервером игры прервалась.');return null;}
   finally{window.clearTimeout(timeout);}
  }).finally(()=>{pending.current--;});
  queue.current=task;
  return task;
 }

 return {game,current,ready,error,commit,send,key,world,hospitalPaymentPending,hospitalAds,notifications,needsCharacterName,nameError,clearNameError:()=>setNameError('')};
}
