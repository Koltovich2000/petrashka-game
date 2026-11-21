import test from 'node:test';
import assert from 'node:assert/strict';
import {freshRange,hitRange,rangeParts,RANGE_BALANCE} from './rangeDamage';
import {floorFraction,rangeObstacles,resolveContacts} from './rangeContacts';
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
test('контакт выбирает часть',()=>{
 const c=resolveContacts([{part:'head',x:1,y:30,w:20,h:20},{part:'left-arm',x:45,y:60,w:10,h:30}],-10,0,500,0,200,300);
 assert.equal(c.contacts[0]?.part,'head');
 assert.equal(c.dx,-1);
});
test('быстрое движение к углу удерживает персонажа внутри стен и над полом',()=>{
 const width=400,height=500;
 const torso={part:'torso' as const,x:180,y:395,w:40,h:45};
 const result=resolveContacts([torso],-1000,1000,-2800,2800,width,height);
 assert.equal(torso.x+result.dx,0);
 assert.equal(torso.y+torso.h+result.dy,height*floorFraction);
 assert.deepEqual(result.contacts.map(contact=>contact.side),['floor','left']);
});
test('кадр позы возвращает уже пересекающие пол и стену части в игровое поле',()=>{
 const width=400,height=500;
 const leg={part:'left-leg' as const,x:385,y:434,w:27,h:37};
 const result=resolveContacts([leg],0,0,0,0,width,height);
 assert.equal(leg.x+leg.w+result.dx,width);
 assert.equal(leg.y+leg.h+result.dy,height*floorFraction);
 assert.deepEqual(result.contacts,[]);
});
test('быстрое перетаскивание не проходит через предметы',()=>{
 const width=400,height=500;
 const [obstacle]=rangeObstacles(width,height);
 const arm={part:'right-arm' as const,x:90,y:obstacle.y+8,w:20,h:18};
 const result=resolveContacts([arm],-180,0,-2800,0,width,height);
 assert.equal(arm.x+result.dx,obstacle.x+obstacle.w);
 assert.equal(result.contacts[0]?.part,'right-arm');
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
