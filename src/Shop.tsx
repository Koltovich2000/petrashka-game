import {TUTORIAL} from './balance';
import {useState} from 'react';
import {furnitureCatalog, activities, locationLabels, type FurnitureId} from './activities';
import {playerLevel, rubles} from './economy';
import type {Game} from './game';
import {FurnitureArt} from './FurnitureArt';
import {DogArt} from './Dog';
import {
 availableBeds, beds, bedReason, businesses, businessKeys, businessHours, businessIncome, businessReason,
 type Business, type BedUpgrade,
} from './property';

interface Props {
 game: Game;
 onBuy: (id: FurnitureId) => void;
 onAdoptDog: () => void;
 onBed: (id: BedUpgrade) => void;
 onOpenBusiness: (id: Business) => void;
 onCollectBusiness: (id: Business) => void;
}

export function Shop({game, onBuy, onAdoptDog, onBed, onOpenBusiness, onCollectBusiness}: Props) {
 const [view, setView] = useState<'home' | 'business'>('home');
 return <section className="shop-screen">
  <div className="screen-heading"><h1>Магазин</h1></div>
  <div className="shop-sections" aria-label="Разделы магазина">
   <button aria-pressed={view === 'home'} onClick={() => setView('home')}>Для квартиры</button>
   <button aria-pressed={view === 'business'} onClick={() => setView('business')}>Бизнес</button>
  </div>
  {view === 'home' ? <>
   <h2>Кровати</h2>
   <p>Установлена {beds[game.bed].name.toLowerCase()} · +{beds[game.bed].energy} энергии в час сна</p>
   <div className="furniture-catalog">{availableBeds.map(id => {
    const bed = beds[id], reason = bedReason(game, id);
    return <article key={id}>
     <h2>{bed.name}</h2><p>+{bed.energy} энергии в час сна · {rubles(bed.price)}</p>
     <button disabled={Boolean(reason)} onClick={() => onBed(id)}>{game.bed === id ? 'Установлена' : reason || 'Купить и установить'}</button>
    </article>;
   })}</div>
   <h2>Питомец</h2>
   <div className="furniture-catalog"><article className="dog-adoption">
    <DogArt sitting/><h2>Собака</h2>
    <button disabled={game.dog||game.health===0||game.tutorial<TUTORIAL.done} onClick={onAdoptDog}>{game.dog?'✓ Собака дома':'Приютить бесплатно'}</button>
   </article></div>
   <h2>Предметы для квартиры</h2>
   <div className="furniture-catalog">{furnitureCatalog.map(item => {
    const owned = Boolean(game.furniture[item.id]);
    const locked = playerLevel(game.economy.xp) < item.level;
    const poor = game.economy.balance < item.price;
    const needsPet = item.id==='tray'&&!game.dog;
    const a = activities[item.id];
    return <article key={item.id}>
     <FurnitureArt kind={item.id}/><h2>{item.name}</h2>
     <p>{locationLabels[item.location]} · Ур. {item.level}</p>
     <p>{a.minutes} мин. · ⚡ −{a.energy} · 🍔 −{a.food} · 🫧 −{a.hygiene} · ☺ +{a.mood}{a.fitness > 0 ? ` · Физподготовка +${a.fitness} XP` : ''}</p>
     <button disabled={owned || needsPet || locked || poor || game.tutorial < TUTORIAL.done} onClick={() => onBuy(item.id)}>
      {owned ? '✓ Куплено' : needsPet ? 'Сначала приютите питомца' : locked ? `С уровня ${item.level}` : poor ? `Нужно ${rubles(item.price)}` : `Купить · ${rubles(item.price)}`}
     </button>
    </article>;
   })}</div>
   <p className="muted">Физподготовка: {game.fitnessXP} XP. Первые 3 тренировки за день дают полный опыт, следующие — половину. Новый день начинается в 00:00 по Москве.</p>
  </> : <>
   <h2>Свой бизнес</h2>
   <p>Доход копится до {businessHours} часов, в том числе во сне и при закрытой игре.</p>
   <div className="furniture-catalog">{businessKeys.map(id => {
    const item = businesses[id];
    const owned = Object.hasOwn(game.businesses, id);
    const income = businessIncome(game, id);
    const reason = businessReason(game, id);
    return <article key={id}>
     <h2>{item.name}</h2><p>Открытие {rubles(item.price)} · прибыль {rubles(item.profit)} / ч</p>
     {owned
      ? <button disabled={income === 0 || game.health <= 0} onClick={() => onCollectBusiness(id)}>Забрать {rubles(income)}</button>
      : <button disabled={Boolean(reason)} onClick={() => onOpenBusiness(id)}>{reason || 'Открыть бизнес'}</button>}
    </article>;
   })}</div>
  </>}
 </section>;
}
