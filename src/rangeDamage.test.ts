import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorRangeMark,freshRange,hitRange,rangePart,rangeParts,RANGE_BALANCE} from './rangeDamage';
import {floorReserve,rangeFloor,rangeObstacles,resolveContacts,wallInset} from './rangeContacts';
test('все пороги точные',()=>{
 for(const part of rangeParts)for(const source of ['collision','bat','pistol'] as const){
  let s=freshRange();
  for(let i=1;i<=RANGE_BALANCE.thresholds[part][source];i++){s=hitRange(s,part,source,''+i);assert.equal(s.detached.has(part),i===RANGE_BALANCE.thresholds[part][source]);}
 }
});
test('смешивание и повтор',()=>{
 let s=hitRange(freshRange(),'head','pistol','a');
 assert.equal(hitRange(s,'head','pistol','a'),s);
 s=hitRange(s,'head','pistol','b');
 for(let i=0;i<5;i++)s=hitRange(s,'head','bat',''+i);
 assert.ok(s.detached.has('head'));
 assert.equal(hitRange(s,'head','bat','x'),s);
 assert.equal(s.damage['left-arm'],0);
 for(let i=0;i<12;i++)s=hitRange(s,'torso','pistol','t'+i);
 assert.equal(s.detached.size,6);
});
test('ловушки делят запас прочности с оружием без повторного урона за один контакт',()=>{
 let state=hitRange(freshRange(),'head','pistol','shot');
 state=hitRange(state,'head','weight','weight');
 assert.equal(hitRange(state,'head','weight','weight'),state);
 state=hitRange(state,'head','saw','saw');
 state=hitRange(state,'head','spikes','spikes');
 assert.equal(state.damage.head,75+55+44+38);
 assert.equal(state.damage.torso,0);
});
test('след остаётся внутри видимой части тела при попадании в угол хитбокса',()=>{
 assert.deepEqual(anchorRangeMark('head',50,-4,1.32),{x:50,y:13,strength:1.32});
 assert.deepEqual(anchorRangeMark('head',101,24),{x:63,y:24,strength:1});
 assert.deepEqual(anchorRangeMark('right-shin',50,102),{x:43,y:96,strength:.72});
 assert.equal(rangePart('right-shin'),'right-leg');
 assert.deepEqual(anchorRangeMark('left-forearm',72,79),{x:67,y:75.5,strength:.51});
 assert.deepEqual(anchorRangeMark('torso',53,60),{x:53,y:60,strength:1});
});
test('контакт выбирает часть',()=>{
 const width=200,x=20;
 const c=resolveContacts([{part:'head',x,y:30,w:20,h:20},{part:'left-arm',x:45,y:60,w:10,h:30}],-10,0,500,0,width,300);
 assert.equal(c.contacts[0]?.part,'head');
 assert.equal(c.contacts[0]?.boundary,true);
 assert.equal(x+c.dx,width*wallInset);
});
test('быстрое движение к углу удерживает персонажа внутри стен и над полом',()=>{
 const width=400,height=500;
 const torso={part:'torso' as const,x:180,y:395,w:40,h:45};
 const result=resolveContacts([torso],-1000,1000,-2800,2800,width,height);
 assert.ok(Math.abs(torso.x+result.dx-width*wallInset)<.001);
 assert.equal(torso.y+torso.h+result.dy,height-floorReserve);
 assert.deepEqual(result.contacts.map(contact=>contact.side),['floor','left']);
});
test('кадр позы возвращает уже пересекающие пол и стену части в игровое поле',()=>{
 const width=400,height=500;
 const leg={part:'left-leg' as const,x:385,y:434,w:27,h:37};
 const result=resolveContacts([leg],0,0,0,0,width,height);
 assert.equal(leg.x+leg.w+result.dx,width*(1-wallInset));
 assert.equal(leg.y+leg.h+result.dy,rangeFloor(height));
 assert.deepEqual(result.contacts,[]);
});
test('быстрое перетаскивание не проходит через предметы',()=>{
 const width=400,height=500;
 const [obstacle]=rangeObstacles(width,height);
 const arm={part:'right-arm' as const,x:90,y:obstacle.y+8,w:20,h:18};
 const result=resolveContacts([arm],-180,0,-2800,0,width,height);
 assert.equal(arm.x+result.dx,obstacle.x+obstacle.w);
 assert.equal(result.contacts[0]?.part,'right-arm');
 assert.equal(result.contacts[0]?.boundary,false);
});
import {regrowPart} from './rangeDamage';
test('рост восстанавливает только нужную часть',()=>{
 let s=hitRange(freshRange(),'left-arm','bat','a');
 for(let i=0;i<4;i++)s=hitRange(s,'head','pistol',''+i);
 s=regrowPart(s,'head');
 assert.equal(s.damage.head,0);
 assert.equal(s.detached.has('head'),false);
 assert.equal(s.damage['left-arm'],25);
});
