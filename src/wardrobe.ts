export const categories = {top:'Верхняя одежда',pants:'Штаны',shoes:'Обувь',hat:'Головной убор',accessory:'Аксессуары'} as const;
export type Category=keyof typeof categories;
export type Outfit=Record<Category,number>;
export const defaultOutfit:Outfit={top:0,pants:0,shoes:0,hat:-1,accessory:-1};
export const wardrobeKey='petrashka:wardrobe:v1';
export const catalog:Record<Category,{name:string;color:string}[]>={
 top:[['Синий оригинал','#275bde'],['Космо-худи','#774bd0'],['Красный бомбер','#be3b58'],['Джинсовка','#588da9'],['Лесная парка','#587953'],['Морская тельняшка','#eee6d6'],['Золотой свитер','#edb34f'],['Кожаная куртка','#433640'],['Розовый кардиган','#da7ca6'],['Спортивная куртка','#43b7b0']].map(([name,color])=>({name,color})),
 pants:[['Графитовые джоггеры','#454253'],['Синие джинсы','#3c639b'],['Карго хаки','#69714a'],['Бежевые чиносы','#bc9f79'],['Красные спортивные','#a63c51'],['Фиолетовые джоггеры','#754b99'],['Белые брюки','#ddd9df'],['Рваный деним','#779daf'],['Шорты путешественника','#8b6450'],['Чёрные с цепью','#282838']].map(([name,color])=>({name,color})),
 shoes:[['Синие кеды','#2868e5'],['Красные кеды','#d64059'],['Белые кроссовки','#f4eade'],['Чёрные ботинки','#30303f'],['Песочные ботинки','#b18757'],['Фиолетовые хай-топы','#975ad2'],['Мятные кеды','#53bba6'],['Жёлтые сапоги','#e8b731'],['Розовые кроссовки','#df82b2'],['Домашние тапочки','#ac9381']].map(([name,color])=>({name,color})),
 hat:[['Кепка','#e25957'],['Шапка-бини','#8557d2'],['Панама','#e3c184'],['Корона','#ffd24c'],['Ковбойская шляпа','#9e6b48'],['Берет','#ba4c78'],['Космический шлем','#aac8dc'],['Ушки кота','#58445f'],['Цилиндр','#39334d'],['Зимняя ушанка','#7d8aab']].map(([name,color])=>({name,color})),
 accessory:[['Круглые очки','#d9b659'],['Солнцезащитные очки','#34293f'],['Красный шарф','#e14a61'],['Золотая цепь','#efc451'],['Наушники','#874ee3'],['Галстук-бабочка','#e7679f'],['Сумка через плечо','#906c50'],['Медаль звезды','#ffcf3f'],['Бирюзовый браслет','#42c5ba'],['Плащ героя','#a94475']].map(([name,color])=>({name,color}))
};
export function parseOutfit(raw:string|null):Outfit{try{const value=JSON.parse(raw??'null');return Object.fromEntries((Object.keys(categories) as Category[]).map(k=>[k,Number.isInteger(value?.[k])&&value[k]>=(k==='hat'||k==='accessory'?-1:0)&&value[k]<10?value[k]:defaultOutfit[k]])) as Outfit;}catch{return {...defaultOutfit};}}

export type OutfitPreset={id:string;name:string;outfit:Outfit};
export type Closet={outfit:Outfit;owned:Record<Category,number[]>;presets:OutfitPreset[];activePreset:string|null};
export const categoryKeys=Object.keys(categories) as Category[];
export function starterCloset(outfit=defaultOutfit):Closet {
 return {
  outfit:{...outfit},presets:[],activePreset:null,
  owned:Object.fromEntries(categoryKeys.map(key=>[key,[...new Set([defaultOutfit[key],outfit[key]].filter(index=>index>=0))]])) as Closet['owned'],
 };
}
export function parseCloset(raw:unknown):Closet|null {
 if(!raw||typeof raw!=='object')return null;
 const saved=raw as Partial<Closet>;
 const result=starterCloset(parseOutfit(JSON.stringify(saved.outfit)));
 for(const category of categoryKeys){
  const owned=saved.owned?.[category];
  if(Array.isArray(owned))result.owned[category]=[...new Set([...result.owned[category],...owned.filter(i=>Number.isInteger(i)&&i>=0&&i<catalog[category].length)])];
 }
 const seen=new Set<string>();
 if(Array.isArray(saved.presets))for(const p of saved.presets){
  if(result.presets.length>=3)break;
  if(!p||typeof p.id!=='string'||seen.has(p.id)||typeof p.name!=='string')continue;
  const outfit=parseOutfit(JSON.stringify(p.outfit));
  if(categoryKeys.some(k=>outfit[k]!==defaultOutfit[k]&&!result.owned[k].includes(outfit[k])))continue;
  seen.add(p.id);result.presets.push({id:p.id,name:p.name.trim().slice(0,32)||'Мой образ',outfit});
 }
 result.activePreset=result.presets.some(p=>p.id===saved.activePreset)?saved.activePreset!:null;
 return result;
}
export const clothingPrice=(index:number)=>80+index*40;
export const clothingLevel=(index:number)=>1+Math.floor(index/3);

export const sameOutfit=(a:Outfit,b:Outfit)=>categoryKeys.every(k=>a[k]===b[k]);
export function savePreset(c:Closet,name:string,id?:string):Closet{
 const label=name.trim().slice(0,32);if(!label)return c;
 const exists=c.presets.some(p=>p.id===id);
 if((id&&!exists)||(!exists&&c.presets.length>=3))return c;
 const key=id??`outfit-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
 const preset={id:key,name:label,outfit:{...c.outfit}};
 return {...c,activePreset:key,presets:exists?c.presets.map(p=>p.id===key?preset:p):[...c.presets,preset]};
}
export function wearPreset(c:Closet,id:string):Closet{const p=c.presets.find(p=>p.id===id);return p?{...c,outfit:{...p.outfit},activePreset:id}:c;}
export function renamePreset(c:Closet,id:string,name:string):Closet{return name.trim()?{...c,presets:c.presets.map(p=>p.id===id?{...p,name:name.trim().slice(0,32)}:p)}:c;}
export function deletePreset(c:Closet,id:string):Closet{return {...c,presets:c.presets.filter(p=>p.id!==id),activePreset:c.activePreset===id?null:c.activePreset};}
