import {PresetPanel} from './PresetPanel';
import {useEffect,useRef,useState} from 'react';
import {categories,categoryKeys,catalog,defaultOutfit,clothingPrice,clothingLevel,type Category,type Closet} from './wardrobe';
import {GameIcon} from './GameIcon';
import {PixelAvatar} from './PixelAvatar';
import {rubles} from './economy';

interface Props {
 closet:Closet;
 balance:number;
 level:number;
 onCloset:(closet:Closet)=>void;
 onSelect:(category:Category,index:number)=>void;
}

export function Wardrobe({closet,balance,level,onSelect,onCloset}:Props){
 const [category,setCategory]=useState<Category>('top');
 const [preview,setPreview]=useState<number|null>(null);
 const details=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(preview!==null)details.current?.scrollIntoView({block:'nearest'});},[preview]);
 const item=preview===null?null:catalog[category][preview];
 const outfit=preview===null?closet.outfit:{...closet.outfit,[category]:preview};
 const removable=category==='hat'||category==='accessory';
 const worn=closet.outfit[category];
 const ownsPreview=preview!==null&&closet.owned[category].includes(preview);
 const locked=preview!==null&&level<clothingLevel(preview);
 const price=preview===null?0:clothingPrice(preview);
 function browse(direction:number){
  const length=catalog[category].length;
  setPreview(((preview??worn)+direction+length)%length);
 }
 const crops={top:'23 46 54 29',pants:'28 71 44 22',shoes:'24 87 52 17',hat:'17 -5 66 42',accessory:'24 13 54 63'};
 const icons={top:'wardrobe',pants:'pants',shoes:'shoes',hat:'hat',accessory:'accessory'};
 const names={top:'Верх',pants:'Низ',shoes:'Обувь',hat:'Головные уборы',accessory:'Аксессуары'};
 return <section className="wardrobe-screen" aria-label="Гардероб">
  <div className="screen-heading"><h1><GameIcon name="wardrobe"/> Гардероб</h1></div>
  <div className="wardrobe-preview"><PixelAvatar outfit={outfit}/><button className="fitting-arrow previous" aria-label="Предыдущая вещь" onClick={()=>browse(-1)}>‹</button><button className="fitting-arrow next" aria-label="Следующая вещь" onClick={()=>browse(1)}>›</button></div>
  <PresetPanel closet={closet} onChange={onCloset}/>
  <nav className="wardrobe-tabs" aria-label="Категории одежды">{categoryKeys.map(key=><button key={key} aria-pressed={category===key} onClick={()=>{setCategory(key);setPreview(null);}}><GameIcon name={icons[key]}/>{names[key]}</button>)}</nav>
  <div className="wardrobe-caption"><h2>{categories[category]}</h2><small>{closet.owned[category].length} / {catalog[category].length}</small>{worn!==defaultOutfit[category]&&<button onClick={()=>{onSelect(category,defaultOutfit[category]);setPreview(null);}}>{removable?'Снять':'Вернуть базовые'}</button>}</div>
  {item&&preview!==null&&<div ref={details} className="shift-card outfit-details">
   <strong>{item.name}</strong>
   {ownsPreview?<button disabled={worn===preview} onClick={()=>{onSelect(category,preview);setPreview(null);}}>{worn===preview?'✓ Надето':'Надеть'}</button>:
    <button disabled={locked||balance<price} onClick={()=>{onSelect(category,preview);setPreview(null);}}>{locked?'Откроется на уровне '+clothingLevel(preview):balance<price?'Нужно '+rubles(price):'Купить и надеть · '+rubles(price)}</button>}
  </div>}
  <div className="clothes-grid">{catalog[category].map((item,index)=>{
   const owned=closet.owned[category].includes(index);
   return <button key={item.name} className={worn===index?'worn':undefined} aria-pressed={preview===index} onClick={()=>setPreview(index)}>
    <div className={'item-preview item-'+category}><PixelAvatar outfit={{...defaultOutfit,[category]:index}} viewBox={crops[category]}/></div>
    <strong>{item.name}</strong><span>{worn===index?'✓ Надето':owned?'В гардеробе':level<clothingLevel(index)?'🔒 Ур. '+clothingLevel(index):rubles(clothingPrice(index))}</span>
   </button>;
  })}</div>
 </section>;
}
