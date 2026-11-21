import test from 'node:test';
import assert from 'node:assert/strict';
import {flightStep,springStep} from './rangePhysics';
const bounds={left:-200,right:200,top:-350,bottom:40};
test('бросок отскакивает от стены, теряет скорость и остаётся в поле',()=>{
 const slow=flightStep({x:198,y:-100,vx:300,vy:0},bounds,1/60);
 const fast=flightStep({x:198,y:-100,vx:2400,vy:0},bounds,1/60);
 assert.equal(fast.x,200);assert.ok(fast.vx<0&&Math.abs(fast.vx)<2400);
 assert.ok(fast.collisions[0].speed>slow.collisions[0].speed*5);
 let flight={x:0,y:-200,vx:2800,vy:-2800};
 for(let i=0;i<600;i++){
  flight=flightStep(flight,bounds,1/60);
  assert.ok(flight.x>=bounds.left&&flight.x<=bounds.right&&flight.y>=bounds.top&&flight.y<=bounds.bottom);
 }
});
test('сустав сохраняет инерцию, раскачивается после рывка и затухает',()=>{
 let spring={value:0,velocity:0};
 for(let i=0;i<8;i++)spring=springStep(spring,60,1/60);
 const moving=spring;
 spring=springStep(spring,-60,1/120);
 assert.ok(spring.value>moving.value,'при смене направления сустав ещё движется по инерции');
 for(let i=0;i<360;i++)spring=springStep(spring,0,1/60);
 assert.ok(Math.abs(spring.value)<.001&&Math.abs(spring.velocity)<.001);
 for(const dt of [1/120,1/60,1/25,.1]){
  let joint={value:0,velocity:900};
  for(let t=0;t<4;t+=dt)joint=springStep(joint,0,dt);
  assert.ok(Number.isFinite(joint.value)&&Math.abs(joint.value)<.001);
 }
});
