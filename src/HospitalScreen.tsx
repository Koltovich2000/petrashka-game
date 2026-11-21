import {useEffect,useRef,useState} from 'react';
import {rubles} from './economy';
import {FurnitureArt} from './FurnitureArt';
import type {Game} from './game';
import {hospitalRules,type Hospital} from './hospital';
import {PixelAvatar} from './PixelAvatar';
import {defaultOutfit} from './wardrobe';
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

function SoldAsset({asset}:{asset:Hospital['sales'][number]}){
 if(asset.kind==='furniture')return <FurnitureArt kind={asset.id}/>;
 if(asset.kind==='clothing'){
  const crops={top:'23 46 54 29',pants:'28 71 44 22',shoes:'24 87 52 17',hat:'17 -5 66 42',accessory:'24 13 54 63'};
  return <PixelAvatar outfit={{...defaultOutfit,[asset.category]:asset.index}} viewBox={crops[asset.category]}/>;
 }
 return <svg viewBox="0 0 80 38" aria-hidden="true"><path fill="#acc4e0" stroke="#252743" strokeWidth="3" d="M4 5H12V17H74V34H66V30H12V34H4z"/><path fill="#d5e0ee" d="M12 16H31V24H12z"/><path fill="#687ed4" d="M32 17H73V25H32z"/></svg>;
}

function durationLabel(ms:number){
 const minutes=Math.floor(ms/60_000);
 return minutes<60?`${minutes} мин.`:`${Math.floor(minutes/60)} ч. ${minutes%60} мин.`;
}

export function HospitalScreen({game,hospital,error,onNotice}:{game:Game;hospital:Hospital;error:string;onNotice:(notice:number,discharge:boolean)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false);
 const sale=hospital.sales[hospital.notice-1];
 const summary=hospital.notice>hospital.sales.length;
 const title=summary?'Петрашка снова дома!':sale?'Пришлось продать имущество!':'Петрашка попал в больницу!';
 useEffect(()=>{const modal=dialog.current;if(modal&&!modal.open)modal.showModal();},[]);
 async function next(){
  if(busy)return;
  setBusy(true);
  await onNotice(hospital.notice,summary);
  setBusy(false);
 }
 return <main className="app hospital-screen">
  <h1>Больница</h1>
  <HospitalScene/>
  <dialog ref={dialog} className="hospital-dialog" aria-labelledby="hospital-title" onCancel={event=>event.preventDefault()}>
   <h2 id="hospital-title">{title}</h2>
   {summary?<>
    <dl className="hospital-totals">
     <div><dt>В больнице</dt><dd>{durationLabel(game.updated-hospital.startedAt)}</dd></div>
     <div><dt>Стоимость лечения</dt><dd className="medical-cost">{rubles(hospital.cost)}</dd></div>
     <div><dt>Списано с баланса</dt><dd className="medical-cost">−{rubles(hospital.balanceSpent)}</dd></div>
     {hospital.debt>0&&<div><dt>Медицинский долг</dt><dd>{rubles(hospital.debt)}</dd></div>}
     <div><dt>Осталось на балансе</dt><dd>{rubles(game.economy.balance)}</dd></div>
    </dl>
    {hospital.sales.length>0&&<ul className="hospital-sales">{hospital.sales.map((item,index)=><li key={index}>{item.name} · {rubles(item.price)}</li>)}</ul>}
   </>:sale?<>
    <p>Чтобы оплатить лечение Петрашки, больница была вынуждена продать некоторые его вещи.</p>
    <div key={hospital.notice} className={'hospital-sold-art'+(busy?' leaving':'')}><SoldAsset asset={sale}/></div>
    <p><strong>{sale.name}</strong> · продано за {rubles(sale.price)}</p>
   </>:<>
    <p>Состояние Петрашки стало критическим. Врачи подключили его к системе жизнеобеспечения и спасли ему жизнь. Но лечение оказалось платным!</p>
    <p>{hospital.cost>0?<span className="medical-cost">Медицинские расходы · {rubles(hospital.cost)}</span>:<>Стоимость лечения · {rubles(hospitalRules.rate)} за полный час</>}</p>
   </>}
   {error&&<p role="alert">{error}</p>}
   <button type="button" className="hospital-next" disabled={busy} onClick={next}>{summary?'Забрать Петрашку домой':sale?'Далее':'Продолжить'}</button>
  </dialog>
 </main>;
}
