import {furnitureCatalog,type FurnitureId} from './activities';
import {beds,type BedUpgrade} from './property';
import {catalog,categoryKeys,defaultOutfit,removePurchasedClothing,type Category} from './wardrobe';
import type {Game} from './game';

export const hospitalRules={hour:3_600_000,rate:100,protection:6*3_600_000,
 recovery:{health:50,energy:30,food:30,mood:20,hygiene:30}} as const;

type Asset={name:string;price:number}&(
 {kind:'clothing';category:Category;index:number}|{kind:'furniture';id:FurnitureId}|{kind:'bed';id:BedUpgrade}
);
export type Hospital={status:'hospitalized';startedAt:number;billedHours:number;balanceSpent:number;cost:number;debt:number;sales:Asset[];notice:number};

const legacyFurniturePrices={yoga:7500,dumbbells:18000,tray:35000};
const legacyBedPrices={comfort:15000,premium:35000};

export function admit(game:Game,at:number):Game{
 return {...game,health:0,updated:at,roomAction:null,sleepUntil:null,restUntil:null,
  hospital:{status:'hospitalized',startedAt:at,billedHours:0,balanceSpent:0,cost:0,debt:0,sales:[],notice:0}};
}

function assets(game:Game):Asset[]{
 const items:Asset[]=[];
 for(const item of furnitureCatalog)if(game.furniture[item.id]){
  const price=game.furnitureCosts[item.id]??('art' in item?item.price:legacyFurniturePrices[item.id]);
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
 const billedHours=Math.floor((now-previous.startedAt)/hospitalRules.hour);
 if(billedHours<=previous.billedHours)return {...game,updated:now};
 const newCost=(billedHours-previous.billedHours)*hospitalRules.rate;
 const payment=Math.min(game.economy.balance,newCost);
 let next:Game={...game,updated:now,economy:{...game.economy,balance:game.economy.balance-payment}};
 let debt=previous.debt+newCost-payment;
 const sales=[...previous.sales];
 if(debt>0)for(const asset of assets(next)){
  if(asset.price>debt)break;
  next=removeAsset(next,asset);
  sales.push(asset);debt-=asset.price;
 }
 return {...next,hospital:{...previous,billedHours,cost:previous.cost+newCost,balanceSpent:previous.balanceSpent+payment,debt,sales}};
}

export function acknowledgeHospital(game:Game,notice:number):Game{
 const h=game.hospital;
 return h&&notice===h.notice&&notice<=h.sales.length?{...game,hospital:{...h,notice:notice+1}}:game;
}

export function dischargeHospital(game:Game,notice:number):Game{
 const h=game.hospital;
 if(!h||notice!==h.notice||h.notice!==h.sales.length+1)return game;
 const absence=game.updated-h.startedAt;
 const businesses={...game.businesses};
 for(const id of Object.keys(businesses) as (keyof Game['businesses'])[])businesses[id]=Math.min(game.updated,businesses[id]!+absence);
 return {...game,...hospitalRules.recovery,hospital:null,businesses,
  medicalDebt:game.medicalDebt+h.debt,protectedUntil:game.updated+hospitalRules.protection,
  accidentActive:false,exhaustionClock:0,baseClock:0,freeFoodAt:game.updated};
}

export function parseHospital(raw:unknown,updated:number):Hospital|null{
 if(!raw||typeof raw!=='object')return null;
 const value=raw as Hospital;
 const amounts=[value.billedHours,value.cost,value.balanceSpent,value.debt,value.notice];
 if(value.status!=='hospitalized'||!Number.isSafeInteger(value.startedAt)||value.startedAt<0||value.startedAt>updated||
  amounts.some(n=>!Number.isSafeInteger(n)||n<0)||!Array.isArray(value.sales))return null;
 const sales=value.sales.filter(asset=>asset&&typeof asset.name==='string'&&Number.isSafeInteger(asset.price)&&asset.price>0&&(
  (asset.kind==='furniture'&&furnitureCatalog.some(item=>item.id===asset.id))||
  (asset.kind==='bed'&&(asset.id==='comfort'||asset.id==='premium'))||
  (asset.kind==='clothing'&&Object.hasOwn(catalog,asset.category)&&catalog[asset.category][asset.index])
  ));
 return {...value,sales,notice:Math.min(value.notice,sales.length+1)};
}
