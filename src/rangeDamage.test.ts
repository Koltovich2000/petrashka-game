import test from 'node:test';
import assert from 'node:assert/strict';
import {freshRange,hitRange,rangeParts,RANGE_BALANCE} from './rangeDamage';
import {resolveContacts} from './rangeContacts';
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
 assert.equal(c.contact?.part,'head');
 assert.equal(c.dx,-1);
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
