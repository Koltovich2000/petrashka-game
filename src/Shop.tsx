import {useState,type FormEvent} from 'react';
import {TUTORIAL} from './balance';
import {furnitureCatalog,activities,locationIds,locationLabels,type FurnitureId} from './activities';
import {maxCharacterNameLength,parseCharacterName} from './characterName';
import {playerLevel,rubles} from './economy';
import type {Game} from './game';
import {FurnitureArt} from './FurnitureArt';
import {dogFoodPrice,dogReclaimPrice} from './dogSchedule';
import {DogArt} from './Dog';

interface Props {
 game: Game;
 onBuy: (id: FurnitureId) => void;
 onAdoptDog: (name: string) => Promise<boolean>;
 onSurrenderDog: () => Promise<boolean>;
 onReclaimDog: () => Promise<boolean>;
 onBuyDogFood: () => void;
}

export function Shop({game,onBuy,onAdoptDog,onSurrenderDog,onReclaimDog,onBuyDogFood}:Props) {
 const [dogName,setDogName]=useState('');
 const [dogPending,setDogPending]=useState(false);
 const [confirmSurrender,setConfirmSurrender]=useState(false);
 const name=parseCharacterName(dogName);
 const level=playerLevel(game.economy.xp);
 const canShop=game.health>0&&game.tutorial>=TUTORIAL.done;
 const sheltered=game.dogCare?.sheltered===true;
 const canReclaim=game.economy.balance>=dogReclaimPrice;

 async function updateDog(action:()=>Promise<boolean>){
  if(!canShop||dogPending)return false;
  setDogPending(true);
  try{return await action();}
  finally{setDogPending(false);}
 }

 async function adopt(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if(!name||game.dog||sheltered)return;
  if(await updateDog(()=>onAdoptDog(name)))setDogName('');
 }

 return <section className="shop-screen">
  <div className="screen-heading"><h1>Магазин</h1></div>
  <h2>Питомец</h2>
  <div className="furniture-catalog">
   <article className="dog-adoption">
    <DogArt preview/>
    <h3>{(game.dog||sheltered)&&game.dogCare?.name ? <bdi>{game.dogCare.name}</bdi> : 'Собака'}</h3>
    {game.dog ? <>
     <p>Собака дома</p>
     {confirmSurrender?<div className="dog-shelter-actions" role="group" aria-label="Подтверждение возврата">
      <p>Забрать собаку обратно можно за {rubles(dogReclaimPrice)}.</p>
      <button type="button" disabled={!canShop||dogPending} onClick={async()=>{if(await updateDog(onSurrenderDog))setConfirmSurrender(false);}}>Подтвердить возврат</button>
      <button type="button" disabled={dogPending} onClick={()=>setConfirmSurrender(false)}>Отмена</button>
     </div>:<button type="button" disabled={!canShop} onClick={()=>setConfirmSurrender(true)}>Сдать в приют</button>}
    </> : sheltered ? <>
     <p>Собака в приюте</p>
     <button type="button" disabled={!canShop||!canReclaim||dogPending} onClick={()=>void updateDog(onReclaimDog)}>Выкупить · {rubles(dogReclaimPrice)}</button>
    </> : <form onSubmit={adopt}>
     <label htmlFor="dog-name">Имя собаки</label>
     <input id="dog-name" type="text" value={dogName} onChange={event=>setDogName(event.target.value)} maxLength={maxCharacterNameLength} autoComplete="off" disabled={!canShop||dogPending} required/>
     <button type="submit" disabled={!name||!canShop||dogPending}>Приютить бесплатно</button>
    </form>}
   </article>
   {game.dog&&<article>
    <h3>Корм для собаки</h3>
    <p>Одна порция восстанавливает сытость до 100%. Через 48 часов без еды сытость падает до нуля. Ещё через 24 часа собаку заберут в приют.</p>
    <p>Порций дома: {game.dogFood??0}</p>
    <button type="button" disabled={!canShop||game.economy.balance<dogFoodPrice} onClick={onBuyDogFood}>Купить корм · {rubles(dogFoodPrice)}</button>
   </article>}
  </div>
  <h2>Обустроить квартиру</h2>
  <p className="muted">Покупки сразу появляются в нужной комнате. Нажми «Обустроить» в комнате, чтобы передвинуть предмет.</p>
  {locationIds.map(location=><section className="shop-room" key={location}>
   <h3>{locationLabels[location]}</h3>
   <div className="furniture-catalog">{furnitureCatalog.filter(item=>item.location===location).map(item=>{
    const owned=Boolean(game.furniture[item.id]);
    const needsPet=item.id==='tray'&&!game.dog;
    const locked=level<item.level;
    const poor=game.economy.balance<item.price;
    const activity='art' in item ? null : activities[item.id];
    const label=owned ? '✓ Куплено'
     : needsPet ? 'Сначала приютите питомца'
     : locked ? `С уровня ${item.level} · ${rubles(item.price)}`
     : poor ? `Нужно ${rubles(item.price)}`
     : `Купить · ${rubles(item.price)}`;
    return <article key={item.id}>
     <FurnitureArt kind={item.id}/>
     <h4>{item.name}</h4>
     {item.id==='hallSpeaker'&&<p>Случайный плейлист с плавными переходами. Нажми колонку в зале, чтобы включить или выключить музыку.</p>}
     {activity&&<p>{activity.minutes} мин. · ⚡ −{activity.energy} · 🍔 −{activity.food} · 🫧 −{activity.hygiene} · ☺ +{activity.mood}{activity.fitness>0&&` · Физподготовка +${activity.fitness} XP`}</p>}
     <button type="button" disabled={!canShop||owned||needsPet||locked||poor} onClick={()=>onBuy(item.id)}>{label}</button>
    </article>;
   })}</div>
  </section>)}
  <p className="muted">Физподготовка: {game.fitnessXP} XP. Первые 3 тренировки за день дают полный опыт, следующие — половину. Новый день начинается в 00:00 по Москве.</p>
 </section>;
}
