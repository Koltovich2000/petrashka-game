import test from 'node:test';
import assert from 'node:assert/strict';
import {SpeakerPlayer,shuffledSpeakerTracks,speakerTracks} from './speakerPlayer';
import {fresh,parseSave} from './game';
import {buyFurniture,moveFurniture} from './activities';
import {playerLevel} from './economy';

class FakeAudio {
 static all:FakeAudio[]=[];
 src='';preload='';currentTime=0;duration=100;paused=true;
 onended:(()=>void)|null=null;ontimeupdate:(()=>void)|null=null;onerror:(()=>void)|null=null;
 constructor(){FakeAudio.all.push(this);}
 setAttribute(){}load(){}removeAttribute(){this.src='';}
 play(){this.paused=false;return Promise.resolve();}
 pause(){this.paused=true;}
}
function setup(t:any){
 const original=globalThis.Audio;FakeAudio.all=[];
 globalThis.Audio=FakeAudio as unknown as typeof Audio;
 t.after(()=>{globalThis.Audio=original;});
 const ramps:number[][]=[];
 const context={currentTime:0,destination:{},resume:async()=>{},
  createMediaElementSource(){return {connect(node:any){return node;},disconnect(){}};},
  createGain(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(value:number){this.value=value;},
   linearRampToValueAtTime(value:number,at:number){ramps.push([value,at]);}},connect(node:any){return node;},disconnect(){}};},
 } as unknown as AudioContext;
 const states:{playing:boolean;error?:string}[]=[];
 const player=new SpeakerPlayer(context,(playing,error)=>states.push({playing,error}));
 t.after(()=>player.dispose());
 return {player,states,ramps,audios:FakeAudio.all};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('speaker shuffle includes every song once and avoids the preceding song at the start',()=>{
 for(let i=0;i<20;i++){
  const tracks=shuffledSpeakerTracks(speakerTracks[0]);
  assert.equal(tracks.length,10);assert.equal(new Set(tracks).size,10);
  assert.notEqual(tracks[0],speakerTracks[0]);
  assert.deepEqual([...tracks].sort(),[...speakerTracks].sort());
 }
});

test('speaker starts a different song from zero after stop and releases both streams',async t=>{
 const {player,states,audios}=setup(t);
 assert.ok(audios.every(audio=>!audio.src));
 player.start();await flush();
 const first=audios[0].src;assert.equal(audios[0].paused,false);assert.equal(audios[1].paused,true);
 audios[0].currentTime=42;
 player.stop();assert.ok(audios.every(audio=>audio.paused&&!audio.src));
 player.start();await flush();assert.notEqual(audios[0].src,first);
 // Loading a new source resets time in a real HTMLAudioElement.
 assert.equal(states.at(-1)?.playing,true);
});

test('speaker overlaps adjacent tracks and ramps both gains, then prepares the next stream',async t=>{
 const {player,audios,ramps}=setup(t);
 player.start();await flush();
 audios[0].currentTime=98.8;
 const second=audios[1].src;
 audios[0].ontimeupdate?.();await flush();
 assert.equal(audios[1].paused,false);assert.equal(audios[1].currentTime,0);
 assert.ok(ramps.some(([value,time])=>value===0&&Math.abs(time-1.2)<.001));
 assert.ok(ramps.some(([value,time])=>value>0&&Math.abs(time-1.2)<.001));
 audios[0].onended?.();
 assert.equal(audios[0].paused,true);assert.equal(audios[1].src,second);
 assert.notEqual(audios[0].src,second);
});

test('speaker stops on stream errors and ignores asynchronous playback after cancellation',async t=>{
 const {player,audios,states}=setup(t);
 player.start();player.stop();await flush();
 assert.equal(states.at(-1)?.playing,false);assert.ok(audios.every(audio=>audio.paused));
 player.start();await flush();audios[0].onerror?.();
 assert.equal(states.at(-1)?.playing,false);assert.ok(states.at(-1)?.error);
 assert.ok(audios.every(audio=>audio.paused&&!audio.src));
});

test('speaker purchase enforces price and level and survives saving and moving',()=>{
 const game={...fresh(0),economy:{balance:5000,xp:0}};
 assert.equal(buyFurniture(game,'hallSpeaker'),game);
 const ready={...game,economy:{balance:5000,xp:300}};
 assert.ok(playerLevel(ready.economy.xp)>=3);
 const bought=buyFurniture(ready,'hallSpeaker');
 assert.equal(bought.economy.balance,2800);assert.equal(bought.furnitureCosts.hallSpeaker,2200);
 assert.equal(buyFurniture(bought,'hallSpeaker'),bought);
 const moved=moveFurniture(bought,'hallSpeaker',.75,.8);
 const loaded=parseSave(JSON.stringify(moved),0);
 assert.deepEqual(loaded.furniture.hallSpeaker,moved.furniture.hallSpeaker);
});
