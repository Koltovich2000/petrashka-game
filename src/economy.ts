import {canEquipClothing,clothingLevel,clothingPrice,defaultOutfit,starterCloset,type Category} from './wardrobe';
import {type Game} from './game';
import {TUTORIAL,xpProgress} from './balance';
export type Economy={balance:number;xp:number};
export const newEconomy=():Economy=>({balance:500,xp:0});
export const playerLevel=(xp:number)=>xpProgress(xp).level;
export const rubles=(n:number)=>`${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
export function parseEconomy(value:unknown):Economy{
 const base=newEconomy();
 if(!value||typeof value!=='object')return base;
 const {balance,xp}=value as Economy;
 return {balance:Number.isSafeInteger(balance)&&balance>=0?balance:base.balance,xp:Number.isSafeInteger(xp)&&xp>=0?xp:0};
}

export function applyClothing(game:Game,category:Category,index:number):Game{
 if(game.tutorial<TUTORIAL.done||game.hospital||!canEquipClothing(category,index))return game;
 const closet=game.closet??starterCloset();
 const outfit={...closet.outfit,[category]:index};
 if(index===defaultOutfit[category]||closet.owned[category].includes(index)){
  return {...game,closet:{...closet,outfit}};
 }
 if(playerLevel(game.economy.xp)<clothingLevel(index))return game;
 const price=clothingPrice(category,index);
 if(game.economy.balance<price)return game;
 return {
  ...game,
  economy:{...game.economy,balance:game.economy.balance-price},
  closet:{...closet,outfit,owned:{...closet.owned,[category]:[...closet.owned[category],index]},
   paid:{...closet.paid,[category]:{...closet.paid[category],[index]:price}}},
 };
}
