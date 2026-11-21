import {useState} from 'react';
import {categories,categoryKeys,wardrobeItems,defaultOutfit,clothingPrice,clothingLevel,type Category,type Closet} from './wardrobe';
import {GameIcon} from './GameIcon';
import {PixelAvatar} from './PixelAvatar';
import {rubles} from './economy';
import type {HairWetness} from './hair';

interface Props {
 closet:Closet;
 balance:number;
 level:number;
 wetness:HairWetness;
 onSelect:(category:Category,index:number)=>void;
}

export function Wardrobe({closet,balance,level,wetness,onSelect}:Props){
 const [category,setCategory]=useState<Category>('top');
 const [preview,setPreview]=useState<number|null>(null);
 const available=(index:number)=>closet.owned[category].includes(index)||level>=clothingLevel(index);
 const items=wardrobeItems(category);
 const fittingItems=items.filter(item=>available(item.index));
 const fitted=fittingItems.some(item=>item.index===preview)?preview:null;
 const outfit=fitted===null?closet.outfit:{...closet.outfit,[category]:fitted};
 const removable=category==='hat'||category==='accessory';
 const worn=closet.outfit[category];
 function browse(direction:number){
  const length=fittingItems.length;
  if(!length)return;
  const current=fittingItems.findIndex(item=>item.index===(fitted??worn));
  const next=current<0?(direction>0?0:length-1):(current+direction+length)%length;
  setPreview(fittingItems[next].index);
 }
 const crops={top:'23 46 54 29',pants:'28 71 44 22',shoes:'24 87 52 17',hat:'17 -5 66 42',accessory:'24 13 54 63'};
 const icons={top:'wardrobe',pants:'pants',shoes:'shoes',hat:'hat',accessory:'accessory'};
 const names={top:'Верх',pants:'Низ',shoes:'Обувь',hat:'Головные уборы',accessory:'Аксессуары'};
 return <section className="wardrobe-screen" aria-label="Гардероб">
  <div className="screen-heading"><h1><GameIcon name="wardrobe"/> Гардероб</h1></div>
  <div className="wardrobe-preview"><PixelAvatar outfit={outfit} wetness={wetness}/><button className="fitting-arrow previous" aria-label="Предыдущая вещь" disabled={!fittingItems.length} onClick={()=>browse(-1)}>‹</button><button className="fitting-arrow next" aria-label="Следующая вещь" disabled={!fittingItems.length} onClick={()=>browse(1)}>›</button></div>
  <nav className="wardrobe-tabs" aria-label="Категории одежды">{categoryKeys.map(key=><button key={key} aria-pressed={category===key} onClick={()=>{setCategory(key);setPreview(null);}}><GameIcon name={icons[key]}/>{names[key]}</button>)}</nav>
  <div className="wardrobe-caption"><h2>{categories[category]}</h2>{worn!==defaultOutfit[category]&&<button onClick={()=>{onSelect(category,defaultOutfit[category]);setPreview(null);}}>{removable?'Снять':'Вернуть базовые'}</button>}</div>
  <div className="clothes-grid">{items.map(item=>{
   const {index}=item;
   const owned=closet.owned[category].includes(index),locked=!available(index),price=clothingPrice(index);
   return <article key={item.name} className={'clothing-card'+(worn===index?' worn':'')+(fitted===index?' fitting':'')}>
    <button type="button" className="clothing-preview" disabled={locked} aria-pressed={fitted===index} onClick={()=>setPreview(index)}>
     <div className={'item-preview item-'+category}><PixelAvatar outfit={{...defaultOutfit,[category]:index}} viewBox={crops[category]}/></div>
     <strong>{item.name}</strong>
    </button>
    {fitted===index&&worn!==index?<button type="button" className={owned?'clothing-buy':'clothing-buy purchase'} onClick={()=>{onSelect(category,index);setPreview(null);}} disabled={balance<price&&!owned}>{owned?'Надеть':'🛒 Купить '+rubles(price)}</button>:
     <span>{worn===index?'✓ Надето':locked?'🔒 Ур. '+clothingLevel(index):owned?'В гардеробе':rubles(price)}</span>}
   </article>;
  })}</div>
 </section>;
}
