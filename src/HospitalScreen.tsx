import {useEffect,useRef,useState} from 'react';
import {rubles} from './economy';
import type {Game} from './game';
import {hospitalQuote,hospitalRules,type Hospital} from './hospital';
import {PixelAvatar} from './PixelAvatar';
import {defaultOutfit} from './wardrobe';
import {hospitalAdController,type HospitalAds} from './hospitalAds';
import './hospital.css';

function HospitalScene(){
 return <svg viewBox="0 0 640 326" role="img" aria-label="Петрашка на больничной койке. Рядом врач и монитор сердцебиения" className="hospital-art">
  <path fill="#252f50" d="M0 0H640V326H0z"/><path fill="#17223a" d="M0 246H640V326H0z"/>
  <path fill="#34466a" d="M0 42H640V50H0zM0 179H640V186H0zM0 238H640V246H0z"/>
  <path fill="#768baf" stroke="#121e35" strokeWidth="6" d="M42 69H183V151H42z"/>
  <path fill="#c3d9eb" d="M52 79H173V140H52z"/><path stroke="#6d86ae" strokeWidth="6" d="M112 79V140M52 111H173"/>
  <path fill="#101827" stroke="#7294b9" strokeWidth="5" d="M417 71H553V137H417z"/>
  <path fill="#5a7797" d="M480 140H490V202H480zM456 202H514V211H456z"/>
  <path className="hospital-pulse" fill="none" stroke="#8dffbb" strokeWidth="3" d="M427 107H455L463 98L470 115L480 82L491 122L499 107H543"/>
  <g stroke="#20243f" strokeWidth="5" strokeLinejoin="round">
   <path fill="#d5e0ee" d="M349 202L365 171H406L425 199L419 245H357z"/>
   <path fill="#e6ae88" d="M367 144H402V170L393 184H373L364 170z"/>
   <path fill="#eef6ff" d="M360 144V130L369 117H398L408 130V147H360z"/>
   <path fill="#5dc7bd" d="M369 163H399V176L389 182H374z"/>
   <path stroke="#cf596a" d="M384 123V140M376 131H392"/>
   <path stroke="#84a5c5" d="M381 194L389 236M397 192L389 214"/>
   <path fill="#7b91b0" d="M62 227H75V283H62zM387 227H400V283H387z"/>
   <path fill="#b2cae4" d="M71 214L118 177H339L396 217V250H71z"/>
   <path fill="#eff5ff" d="M80 212L117 182H205L164 223H80z"/>
  </g>
  <svg x="111" y="137" width="85" height="85" viewBox="0 0 85 85" className="hospital-head">
   <PixelAvatar outfit={defaultOutfit} state="sleep" viewBox="21 -3 58 58"/>
  </svg>
  <path fill="#86b4d7" stroke="#20314c" strokeWidth="5" d="M159 217L197 184H340L397 219V249H157z"/>
  <path fill="none" stroke="#b9d8ed" strokeWidth="5" d="M174 219H386M195 188L161 219"/>
 </svg>;
}

function durationLabel(ms:number){
 const minutes=Math.floor(ms/60_000);
 const days=Math.floor(minutes/1440);
 const hours=Math.floor(minutes/60)%24;
 return [days>0&&days+' д.',hours>0&&hours+' ч.',minutes%60+' мин.'].filter(Boolean).join(' ');
}

export function HospitalScreen({game,hospital,error,paymentPending,ads,onPayDebt,onStartAd,onCancelAd,onSync}:{
 game:Game;hospital:Hospital;error:string;paymentPending:boolean;
 ads?:HospitalAds;
 onPayDebt:(startedAt:number,cost:number,balance:number)=>Promise<boolean>;
 onStartAd:(startedAt:number)=>Promise<string|undefined>;
 onCancelAd:(attempt:string)=>Promise<void>;
 onSync:()=>Promise<unknown>;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const inProgress=useRef(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const quote=hospitalQuote(game,hospital);
 useEffect(()=>{const modal=dialog.current;if(modal&&!modal.open)modal.showModal();},[]);

 async function payDebt(){
  if(inProgress.current||paymentPending)return;
  inProgress.current=true;setBusy(true);setMessage('');
  try{
   if(!await onPayDebt(hospital.startedAt,hospital.cost,game.economy.balance))setMessage('Проверь расчёт и нажми ещё раз.');
  }finally{
   inProgress.current=false;setBusy(false);
  }
 }

 async function watchAd(){
  if(inProgress.current||paymentPending||!ads||ads.pending)return;
  inProgress.current=true;setBusy(true);setMessage('');
  let attempt:string|undefined;
  try{
   const controller=await hospitalAdController(ads.blockId);
   if(!dialog.current)return;
   attempt=await onStartAd(hospital.startedAt);
   if(!attempt){
    setMessage('Не удалось начать просмотр. Попробуй ещё раз.');
    return;
   }
   const modal=dialog.current;
   if(!modal)return;
   modal.close();
   const result=await controller.show();
   if(!result.done||result.error){
    await onCancelAd(attempt);
    setMessage('Просмотр не завершён. Попробуй ещё раз.');
   }else await onSync();
  }catch{
   if(attempt)await onCancelAd(attempt);
   setMessage('Реклама сейчас недоступна. Попробуй позже.');
  }finally{
   const modal=dialog.current;
   if(modal?.isConnected&&!modal.open)modal.showModal();
   inProgress.current=false;setBusy(false);
  }
 }

 return <main className="app hospital-screen">
  <h1>Больница</h1>
  <HospitalScene/>
  <dialog ref={dialog} className="hospital-dialog" aria-labelledby="hospital-title" onCancel={event=>event.preventDefault()}>
   <h2 id="hospital-title">Выписка Петрашки</h2>
   <p>Лечение стоит {rubles(hospitalRules.rate)} за полный час. Выбери способ выписки.</p>
   <dl className="hospital-totals">
    <div><dt>В больнице</dt><dd>{durationLabel(game.updated-hospital.startedAt)}</dd></div>
    {hospital.cost!==quote.due&&<div><dt>Стоимость лечения</dt><dd>{rubles(hospital.cost)}</dd></div>}
    <div><dt>Долг к оплате</dt><dd className="medical-cost">{rubles(quote.due)}</dd></div>
    <div><dt>Баланс сейчас</dt><dd>{rubles(game.economy.balance)}</dd></div>
    <div><dt>Спишется с баланса за лечение</dt><dd>{rubles(quote.cash)}</dd></div>
    <div><dt>Баланс после оплаты долга</dt><dd>{rubles(quote.balanceAfter)}</dd></div>
   </dl>
   {quote.sales.length>0&&<section aria-labelledby="hospital-sales-title">
    <h3 id="hospital-sales-title">Вещи, которые продадутся при оплате долга</h3>
    <ul className="hospital-sales">{quote.sales.map(item=><li key={item.kind==='clothing'?item.category+item.index:item.id}>
     {item.name} · {rubles(item.price)}
    </li>)}</ul>
   </section>}
   {quote.writtenOff>0&&<p>При оплате долга остаток в {rubles(quote.writtenOff)} спишется после выписки.</p>}
   {(hospital.balanceSpent>0||hospital.sales.length>0)&&<p>
    Ранее списано {rubles(hospital.balanceSpent)}{hospital.sales.length>0&&' и продано: '+hospital.sales.map(item=>item.name).join(', ')}.
    Выписка без потерь вернёт эти деньги и вещи.
   </p>}
   {hospital.cost>0&&<p>Посмотри {hospitalRules.ads} рекламы, чтобы выписаться и сохранить баланс и вещи.</p>}
   {!ads&&hospital.cost>0&&<p className="muted">Реклама пока недоступна.</p>}
   {paymentPending&&<p role="status">Ждём подтверждение предыдущей оплаты от Telegram.</p>}
   {ads?.pending&&!busy&&!paymentPending&&<p role="status">Ждём подтверждение просмотра. Если оно не придёт, попробуй ещё раз, когда кнопка станет доступна.</p>}
   {message&&!paymentPending&&!ads?.pending&&<p role="status">{message}</p>}
   {error&&<p role="alert">{error}</p>}
   <div className="hospital-actions">
    <button type="button" className="hospital-next" disabled={busy||paymentPending} onClick={()=>void payDebt()}>Оплатить долг</button>
    {hospital.cost>0&&<button type="button" className="hospital-ad" disabled={busy||paymentPending||!ads||ads.pending}
     onClick={()=>void watchAd()}>Смотреть рекламу · {ads?.watched??0}/{hospitalRules.ads}</button>}
   </div>
  </dialog>
 </main>;
}
