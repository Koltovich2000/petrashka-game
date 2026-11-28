import {furnitureCatalog,type FurnitureId} from './activities';
import {beds,type BedUpgrade} from './property';
import {catalog,categoryKeys,defaultOutfit,removePurchasedClothing,starterCloset,type Category} from './wardrobe';
import type {Game} from './game';

export const hospitalRules={hour:3_600_000,rate:100,ads:3,protection:6*3_600_000,
 recovery:{health:50,energy:30,food:30,mood:20,hygiene:30}} as const;

type Asset={name:string;price:number}&(
 {kind:'clothing';category:Category;index:number}|{kind:'furniture';id:FurnitureId}|{kind:'bed';id:BedUpgrade}
);
export type Hospital={status:'hospitalized';startedAt:number;billedHours:number;cost:number;balanceSpent:number;sales:Asset[]};

const legacyFurniturePrices:Partial<Record<FurnitureId,number>>={yoga:7500,dumbbells:18000,tray:35000,entryKitchen:4200};
const legacyBedPrices={comfort:15000,premium:35000};

export function admit(game:Game,at:number):Game{
 return {...game,health:0,updated:at,roomAction:null,sleepUntil:null,restUntil:null,
  hospital:{status:'hospitalized',startedAt:at,billedHours:0,cost:0,balanceSpent:0,sales:[]}};
}

function assets(game:Game):Asset[]{
 const items:Asset[]=[];
 for(const item of furnitureCatalog)if(game.furniture[item.id]){
  const price=game.furnitureCosts[item.id]??legacyFurniturePrices[item.id]??item.price;
  if(price>0)items.push({kind:'furniture',id:item.id,name:item.name,price});
 }
 if(game.bed!=='standard'){
  const item=beds[game.bed],price=game.bedPurchasePrice??legacyBedPrices[game.bed];
  if(price>0)items.push({kind:'bed',id:game.bed,name:item.name,price});
 }
 const closet=game.closet;
 if(closet)for(const category of categoryKeys)for(const index of closet.owned[category]){
  const price=closet.paid[category]?.[index];
  if(index!==defaultOutfit[category]&&price&&price>0)items.push({kind:'clothing',category,index,name:catalog[category][index].name,price});
 }
 return items.sort((a,b)=>a.price-b.price);
}

function removeAsset(game:Game,asset:Asset):Game{
 switch(asset.kind){
 case 'clothing':return {...game,closet:removePurchasedClothing(game.closet!,asset.category,asset.index)};
 case 'bed':return {...game,bed:'standard',bedPurchasePrice:null};
 case 'furniture':{
  const furniture={...game.furniture},furnitureCosts={...game.furnitureCosts};
  delete furniture[asset.id];delete furnitureCosts[asset.id];
  return {...game,furniture,furnitureCosts};
 }
 }
}

export function billHospital(game:Game,now:number):Game{
 const previous=game.hospital!;
 const billedHours=Math.max(previous.billedHours,Math.floor((now-previous.startedAt)/hospitalRules.hour));
 const cost=previous.cost+(billedHours-previous.billedHours)*hospitalRules.rate;
 return {...game,updated:now,hospital:{...previous,billedHours,cost}};
}

export function hospitalQuote(game:Game,hospital:Hospital){
 const soldValue=hospital.sales.reduce((sum,item)=>sum+item.price,0);
 const due=Math.max(0,hospital.cost-hospital.balanceSpent-soldValue);
 const cash=Math.min(game.economy.balance,due);
 let remaining=due-cash;
 const sales:Asset[]=[];
 if(remaining>0)for(const asset of assets(game)){
  sales.push(asset);
  remaining-=asset.price;
  if(remaining<=0)break;
 }
 return {due,cash,sales,writtenOff:Math.max(0,remaining),
  balanceAfter:game.economy.balance-cash+Math.max(0,-remaining)};
}

function recover(game:Game,hospital:Hospital):Game{
 const absence=game.updated-hospital.startedAt;
 const businesses={...game.businesses};
 for(const id of Object.keys(businesses) as (keyof Game['businesses'])[])businesses[id]=Math.min(game.updated,businesses[id]!+absence);
 return {...game,...hospitalRules.recovery,hospital:null,businesses,
  protectedUntil:game.updated+hospitalRules.protection,
  accidentActive:false,exhaustionClock:0,baseClock:0,freeFoodAt:game.updated};
}

export function dischargeHospital(game:Game,startedAt:number,cost:number,balance:number):Game{
 const hospital=game.hospital;
 if(!hospital||hospital.startedAt!==startedAt||hospital.cost!==cost||game.economy.balance!==balance)return game;
 const quote=hospitalQuote(game,hospital);
 const paid=quote.sales.reduce<Game>(removeAsset,game);
 return recover({...paid,economy:{...paid.economy,balance:quote.balanceAfter}},hospital);
}

function restoreAsset(game:Game,asset:Asset):Game{
 if(asset.kind==='bed')return {...game,bed:asset.id,bedPurchasePrice:asset.price};
 if(asset.kind==='furniture'){
  const item=furnitureCatalog.find(item=>item.id===asset.id);
  if(!item||game.furniture[asset.id])return game;
  return {...game,furniture:{...game.furniture,[asset.id]:{x:item.x,y:item.y}},
   furnitureCosts:{...game.furnitureCosts,[asset.id]:asset.price}};
 }
 const {category,index}=asset;
 const closet=game.closet??starterCloset();
 if(closet.owned[category].includes(index))return game;
 return {...game,closet:{...closet,owned:{...closet.owned,[category]:[...closet.owned[category],index]},
  paid:{...closet.paid,[category]:{...closet.paid[category],[index]:asset.price}}}};
}

export function dischargeHospitalWithoutLosses(game:Game,startedAt:number):Game{
 const hospital=game.hospital;
 if(!hospital||hospital.startedAt!==startedAt)return game;
 const restored=hospital.sales.reduce<Game>(restoreAsset,game);
 const balance=Math.min(Number.MAX_SAFE_INTEGER,restored.economy.balance+hospital.balanceSpent);
 return recover({...restored,economy:{...restored.economy,balance}},hospital);
}

export function parseHospital(raw:unknown,updated:number):Hospital|null{
 if(!raw||typeof raw!=='object')return null;
 const value=raw as Hospital;
 const {status,startedAt,billedHours,cost,balanceSpent}=value;
 const amounts=[billedHours,cost,balanceSpent];
 if(status!=='hospitalized'||!Number.isSafeInteger(startedAt)||startedAt<0||startedAt>updated||
  amounts.some(n=>!Number.isSafeInteger(n)||n<0)||!Array.isArray(value.sales))return null;
 const sales=value.sales.filter(asset=>asset&&typeof asset.name==='string'&&Number.isSafeInteger(asset.price)&&asset.price>0&&(
  (asset.kind==='furniture'&&furnitureCatalog.some(item=>item.id===asset.id))||
  (asset.kind==='bed'&&(asset.id==='comfort'||asset.id==='premium'))||
  (asset.kind==='clothing'&&Object.hasOwn(catalog,asset.category)&&catalog[asset.category][asset.index])
  ));
 return {status,startedAt,billedHours,cost,balanceSpent,sales};
}
