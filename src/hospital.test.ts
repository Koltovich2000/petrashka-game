import assert from 'node:assert/strict';
import test from 'node:test';
import {act,advance,fresh,parseSave} from './game';
import {applyClothing} from './economy';
import {buyFurniture,startActivity} from './activities';
import {dischargeHospital,dischargeHospitalWithoutLosses,hospitalQuote,hospitalRules} from './hospital';
import {defaultOutfit,starterCloset} from './wardrobe';

const hour=hospitalRules.hour;
const funded=(balance:number)=>({...fresh(0),economy:{balance,xp:5000}});

test('hospital bills full hours once and freezes needs across reloads',()=>{
 const admitted=advance({...funded(10_000),health:0},0);
 const before=advance(admitted,hour-1);
 assert.equal(before.economy.balance,10_000);
 const charged=parseSave(JSON.stringify(admitted),52*hour);
 assert.deepEqual([charged.hospital?.cost,charged.hospital?.balanceSpent,charged.economy.balance],[5200,0,10_000]);
 assert.equal(hospitalQuote(charged,charged.hospital!).cash,5200);
 const loaded=parseSave(JSON.stringify(charged),52*hour);
 assert.deepEqual(loaded,charged);
 assert.deepEqual([loaded.food,loaded.mood,loaded.energy],[100,100,100]);
});

test('liquidation is only applied at discharge, sells cheapest first and returns the change',()=>{
 let game=buyFurniture(funded(10_000),'yoga');
 game=applyClothing(game,'top',1);
 game=applyClothing(game,'shoes',2);
 const admitted=advance({...game,health:0,economy:{...game.economy,balance:0}},0);
 const first=advance(admitted,9*hour);
 assert.deepEqual(hospitalQuote(first,first.hospital!).sales.map(({price})=>price),[950]);
 assert.equal(first.closet?.outfit.top,1);
 const paid=dischargeHospital(first,0,900,0);
 assert.equal(paid.economy.balance,50);
 assert.deepEqual(paid.closet?.outfit,defaultOutfit);
 assert.ok(paid.closet?.owned.shoes.includes(2));
 const all=advance(first,500*hour);
 assert.deepEqual(hospitalQuote(all,all.hospital!).sales.map(({price})=>price),[950,1100,1800]);
 assert.notEqual(all.furniture.yoga,undefined);
 assert.deepEqual(parseSave(JSON.stringify(all),500*hour),all);
 const noMoney=dischargeHospital(all,0,50_000,0);
 assert.equal(noMoney.furniture.yoga,undefined);
 assert.equal(noMoney.economy.balance,0);
 assert.equal(noMoney.medicalDebt,0);
 assert.ok(noMoney.closet?.owned.top.includes(defaultOutfit.top));
});

test('an unpaid remainder is written off, stale quotes cannot be charged and protection lasts six hours',()=>{
 const start=advance({...funded(0),health:0,closet:starterCloset({...defaultOutfit,top:2})},96*hour);
 assert.equal(hospitalQuote(start,start.hospital!).writtenOff,9600);
 assert.equal(start.hospital?.sales.length,0);
 assert.equal(dischargeHospital(start,1,9600,0),start);
 assert.equal(dischargeHospital(start,0,9500,0),start);
 assert.equal(dischargeHospital(start,0,9600,20),start);
 const home=dischargeHospital(start,0,9600,0);
 assert.equal(dischargeHospital(home,0,9600,0),home);
 assert.deepEqual([home.health,home.energy,home.food,home.mood,home.hygiene],[50,30,30,20,30]);
 assert.equal(home.medicalDebt,0);assert.equal(home.economy.balance,0);
 assert.equal(home.protectedUntil,102*hour);
 const weak={...home,food:0,energy:0,health:1,exhaustionClock:3*hour};
 assert.equal(advance(weak,101*hour).hospital,null);
 assert.ok(advance(weak,102*hour).hospital);
 assert.equal(act(start,'sleep',96*hour).sleepUntil,null);
 assert.equal(startActivity(start,'computer',96*hour).roomAction,null);
});

test('discharge without losses preserves current balance and inventory and restores sales from a legacy stay',()=>{
 const equipped=applyClothing(buyFurniture(funded(10_000),'yoga'),'top',1);
 const start=advance({...equipped,health:0},120*hour);
 const home=dischargeHospitalWithoutLosses(start,0);
 assert.equal(home.hospital,null);
 assert.deepEqual(home.economy,equipped.economy);
 assert.deepEqual(home.furniture,equipped.furniture);
 assert.deepEqual(home.closet,equipped.closet);
 const legacy=advance({...funded(75),health:0},15*hour);
 const recovered=dischargeHospitalWithoutLosses({...legacy,hospital:{...legacy.hospital!,balanceSpent:450,
  sales:[{kind:'clothing',category:'top',index:1,name:'Футболка',price:950}]}},0);
 assert.equal(recovered.economy.balance,525);
 assert.deepEqual(recovered.closet?.owned.top,[defaultOutfit.top,1]);
 assert.equal(recovered.closet?.paid.top?.[1],950);
});

test('a long absence only checks the first 12 hours for admission',()=>{
 const fundedPlayer=funded(5_000);
 const healthy=advance(fundedPlayer,96*hour,true);
 assert.deepEqual([healthy.health,healthy.food,healthy.energy,healthy.hospital,healthy.economy.balance],[100,46,46,null,5_000]);
 const exhausted={...fundedPlayer,health:38,food:0,energy:0};
 const returning=advance(exhausted,96*hour,true);
 assert.deepEqual([returning.health,returning.hospital,returning.updated],[8,null,96*hour]);
 assert.ok(advance(exhausted,96*hour).hospital);
 const critical={...exhausted,health:30};
 const hospitalized=advance(critical,96*hour,true);
 assert.equal(hospitalized.hospital?.startedAt,12*hour);
 assert.equal(hospitalized.hospital?.billedHours,84);
});
