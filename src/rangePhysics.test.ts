import test from 'node:test';
import assert from 'node:assert/strict';
import {flightStep,springStep} from './rangePhysics';
import {rangeFloor,type BodyBox} from './rangeContacts';
import {rangeTraps,trapBox,trapContact} from './rangeTraps';
import {joltRig,loosePose,restRig,restSprings,rigStep} from './rangeRig';
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
test('тело повисает за удерживаемую конечность, а колени сгибаются при сжатии',()=>{
 assert.ok(loosePose(0,0,0,0,0,'right-shin').tilt>110);
 assert.ok(loosePose(0,0,0,0,0,'left-forearm').tilt< -35);
 const folded=loosePose(0,0,0,0,-.3);
 assert.ok(folded.waist>10&&folded['right-shin']< -35&&folded['left-shin']>35);
 const springs=restSprings();
 joltRig(springs,'right-shin',75,1,true);
 const hit=rigStep(springs,restRig(),1/30);
 assert.ok(Math.abs(hit.rig['right-shin'])>Math.abs(hit.rig['left-shin']));
 assert.ok(hit.rig.squash<0);
 for(let i=0;i<180;i++)rigStep(springs,restRig(),1/30);
 assert.ok(Object.values(springs).every(joint=>Math.abs(joint.value)<.002));
});
test('ловушки сохраняют геометрию сцены и возвращаются в исходное положение',()=>{
 const stage={width:370,height:510},aim={x:185,y:305};
 const floor=rangeFloor(stage.height);
 for(const [kind,{duration}] of Object.entries(rangeTraps)){
  const trap=kind as keyof typeof rangeTraps;
  if(trap!=='weight')assert.deepEqual(trapBox(trap,0,stage,aim),trapBox(trap,duration,stage,aim));
 }
 const spikes=trapBox('spikes',110,stage,aim);
 assert.ok(spikes.h>0);
 assert.equal(spikes.y+spikes.h,floor);
 const weight=trapBox('weight',620,stage,aim);
 assert.ok(trapBox('weight',0,stage,aim).y<0);
 assert.equal(weight.y+weight.h,floor);
});
test('движущаяся ловушка ловит встречное тело даже без пересечения в конце кадра',()=>{
 const before={x:190,y:83,w:26,h:26},after={...before,x:86};
 const oldParts:BodyBox[]=[{part:'torso',x:52,y:85,w:21,h:23}];
 const parts:BodyBox[]=[{...oldParts[0],x:230}];
 const contact=trapContact(after,before,parts,oldParts);
 assert.equal(contact?.part,'torso');
 assert.ok(contact.at>0&&contact.at<1);
 assert.equal(trapContact(after,before,[{...parts[0],y:130}],[{...oldParts[0],y:130}]),undefined);
});
test('ловушка различает бедро и голень при расчёте места попадания',()=>{
 const thigh={part:'right-leg',layer:'right-leg',x:60,y:10,w:20,h:18} satisfies BodyBox;
 const shin={part:'right-leg',layer:'right-shin',x:50,y:42,w:20,h:18} satisfies BodyBox;
 const before={x:97,y:44,w:16,h:16},after={...before,x:41};
 assert.equal(trapContact(after,before,[thigh,shin],[thigh,shin])?.layer,'right-shin');
});
