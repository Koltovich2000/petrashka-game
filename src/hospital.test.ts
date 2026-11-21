import assert from 'node:assert/strict';
import test from 'node:test';
import {act,advance,fresh,parseSave} from './game';
import {applyClothing} from './economy';
import {buyFurniture,startActivity} from './activities';
import {acknowledgeHospital,dischargeHospital,hospitalRules} from './hospital';
import {defaultOutfit,starterCloset} from './wardrobe';

const hour=hospitalRules.hour;
const funded=(balance:number)=>({...fresh(0),economy:{balance,xp:5000}});

test('hospital bills full hours once and freezes needs across reloads',()=>{
 const admitted=advance({...funded(10_000),health:0},0);
 const before=advance(admitted,hour-1);
 assert.equal(before.economy.balance,10_000);
 const charged=parseSave(JSON.stringify(admitted),52*hour);
 assert.deepEqual([charged.hospital?.cost,charged.hospital?.balanceSpent,charged.economy.balance],[5200,5200,4800]);
 const loaded=parseSave(JSON.stringify(charged),52*hour);
 assert.deepEqual(loaded,charged);
 assert.deepEqual([loaded.food,loaded.mood,loaded.energy],[100,100,100]);
});

test('liquidation waits for the full price, sells cheapest first and restores free clothes',()=>{
 let game=buyFurniture(funded(10_000),'yoga');
 game=applyClothing(game,'top',1);
 game=applyClothing(game,'shoes',2);
 const admitted=advance({...game,health:0,economy:{...game.economy,balance:0}},0);
 assert.equal(advance(admitted,hour).hospital?.sales.length,0);
 const first=advance(admitted,2*hour);
 assert.deepEqual(first.hospital?.sales.map(({price})=>price),[120]);
 assert.deepEqual(first.closet?.outfit,defaultOutfit);
 assert.ok(first.closet?.owned.shoes.includes(2));
 const all=advance(first,500*hour);
 assert.deepEqual(all.hospital?.sales.map(({price})=>price),[120,160,7500]);
 assert.equal(all.furniture.yoga,undefined);
 assert.ok(all.closet?.owned.top.includes(defaultOutfit.top));
 assert.deepEqual(parseSave(JSON.stringify(all),500*hour),all);
});

test('no assets is recoverable, hospital notice steps are retry-safe and protection lasts six hours',()=>{
 const start=advance({...funded(0),health:0,closet:starterCloset({...defaultOutfit,top:2})},96*hour);
 assert.equal(start.hospital?.debt,9600);
 assert.equal(start.hospital?.sales.length,0);
 assert.equal(dischargeHospital(start,0),start);
 const summary=acknowledgeHospital(start,0);
 assert.equal(acknowledgeHospital(summary,0),summary);
 const home=dischargeHospital(summary,1);
 assert.deepEqual([home.health,home.energy,home.food,home.mood,home.hygiene],[50,30,30,20,30]);
 assert.equal(home.medicalDebt,9600);assert.equal(home.economy.balance,0);
 assert.equal(home.protectedUntil,102*hour);
 const weak={...home,food:0,energy:0,health:1,exhaustionClock:3*hour};
 assert.equal(advance(weak,101*hour).hospital,null);
 assert.ok(advance(weak,102*hour).hospital);
 assert.equal(act(start,'sleep',96*hour).sleepUntil,null);
 assert.equal(startActivity(start,'computer',96*hour).roomAction,null);
});

test('a long absence detects the actual critical tick and bills the remaining weeks',()=>{
 const unattended={...fresh(0),health:28,food:0,energy:0};
 const returning=advance(unattended,24*21*hour,true);
 assert.equal(returning.hospital?.startedAt,16*hour);
 assert.equal(returning.hospital?.billedHours,24*21-16);
});
