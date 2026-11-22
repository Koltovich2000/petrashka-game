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
export type Closet={outfit:Outfit;owned:Record<Category,number[]>;paid:Partial<Record<Category,Record<number,number>>>;presets:OutfitPreset[];activePreset:string|null};
export const categoryKeys=Object.keys(categories) as Category[];
// Keep the original item IDs for saved ownership, purchase prices and hospital sale history.
const retired:Record<Category,ReadonlySet<number>>={
 top:new Set([3,4,7,8,9]),
 pants:new Set([1,3,4,5,9]),
 shoes:new Set([4,5,6,7,8]),
 hat:new Set([0,1,2,3,4,5,8,9]),
 accessory:new Set([0,2,4,7,9]),
};
export const canEquipClothing=(category:Category,index:number)=>
 index===defaultOutfit[category]||Boolean(catalog[category][index]&&!retired[category].has(index));
export function wardrobeItems(category:Category){
 return catalog[category].map((item,index)=>({...item,index})).filter(item=>canEquipClothing(category,item.index));
}
function availableOutfit(outfit:Outfit):Outfit{
 let result=outfit;
 for(const category of categoryKeys)if(!canEquipClothing(category,outfit[category])){
  if(result===outfit)result={...outfit};
  result[category]=defaultOutfit[category];
 }
 return result;
}
export function refreshClosetOutfits(closet:Closet|null):Closet|null{
 if(!closet)return null;
 const outfit=availableOutfit(closet.outfit);
 const presets=closet.presets.map(preset=>{
  const fitted=availableOutfit(preset.outfit);
  return fitted===preset.outfit?preset:{...preset,outfit:fitted};
 });
 return outfit===closet.outfit&&presets.every((preset,index)=>preset===closet.presets[index])
  ?closet:{...closet,outfit,presets};
}
export function starterCloset(outfit=defaultOutfit):Closet {
 return {
  outfit:{...availableOutfit(outfit)},presets:[],activePreset:null,paid:{},
  owned:Object.fromEntries(categoryKeys.map(key=>[key,[...new Set([defaultOutfit[key],outfit[key]].filter(index=>index>=0))]])) as Closet['owned'],
 };
}
export function parseCloset(raw:unknown,migrateOwnership=false):Closet|null {
 if(!raw||typeof raw!=='object')return null;
 const saved=raw as Partial<Closet>;
 const result=starterCloset(parseOutfit(JSON.stringify(saved.outfit)));
 for(const category of categoryKeys){
  const owned=saved.owned?.[category];
  if(Array.isArray(owned))result.owned[category]=[...new Set([...result.owned[category],...owned.filter(i=>Number.isInteger(i)&&i>=0&&i<catalog[category].length)])];
  for(const index of result.owned[category]){
   if(index===defaultOutfit[category])continue;
   const price=saved.paid?.[category]?.[index]??(migrateOwnership&&Array.isArray(owned)&&owned.includes(index)?80+index*40:0);
   if(Number.isSafeInteger(price)&&price>0)(result.paid[category]??={})[index]=price;
  }
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
const wardrobePrices:Record<Category,Partial<Record<number,number>>>={
 top:{1:950,2:1450,5:2300,6:5200},
 pants:{2:850,6:2000,7:3150,8:3500},
 shoes:{1:700,2:1100,3:1700,9:650},
 hat:{6:4800,7:2400},
 accessory:{1:650,3:6200,5:1100,6:2600,8:1900},
};
export function clothingPrice(category:Category,index:number){
 if(index===defaultOutfit[category])return 0;
 return wardrobePrices[category][index]??Infinity;
}
export const clothingLevel=(index:number)=>1+Math.floor(index/3);

export function removePurchasedClothing(closet:Closet,category:Category,index:number):Closet{
 const paid={...closet.paid};
 const remaining={...paid[category]};
 delete remaining[index];
 if(Object.keys(remaining).length)paid[category]=remaining;
 else delete paid[category];
 const replace=(outfit:Outfit)=>outfit[category]===index?{...outfit,[category]:defaultOutfit[category]}:outfit;
 const woreSoldItem=closet.outfit[category]===index;
 return {...closet,outfit:woreSoldItem?{...defaultOutfit}:closet.outfit,activePreset:woreSoldItem?null:closet.activePreset,paid,
  owned:{...closet.owned,[category]:closet.owned[category].filter(item=>item!==index)},
  presets:closet.presets.map(preset=>({...preset,outfit:replace(preset.outfit)}))};
}

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
