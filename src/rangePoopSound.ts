import {isSoundMuted} from './sound';
import {poopFlightTime} from './RangePoopEffects';

type Kind='hit'|'throw'|'miss';
const clips={
 miss:[[0.0, 1.28], [1.3, 1.34], [2.66, 1.0], [3.68, 0.64], [4.34, 1.3]],
 hit:[[0,.30],[.32,.35],[.69,.41],[1.12,1.32],[2.46,.46],[2.94,.51],[3.47,.30]],
 throw:[[0,.59],[.61,.67],[1.30,.51],[1.83,.78],[2.63,.72]],
} as const;
const recordings=new Map<Kind,Promise<AudioBuffer>>();
const previous:Partial<Record<Kind,number>>={};
const active=new Set<AudioBufferSourceNode>();
let generation=0;

function load(kind:Kind,audio:AudioContext){
 let task=recordings.get(kind);
 if(!task){
  task=fetch(`/assets/audio/range-poop-${kind}.wav`).then(async response=>{
   if(!response.ok)throw new Error('Poop recording unavailable');
   return audio.decodeAudioData(await response.arrayBuffer());
  }).catch(error=>{recordings.delete(kind);throw error;});
  recordings.set(kind,task);
 }
 return task;
}

export function preparePoopSounds(audio:AudioContext){
 for(const kind of ['hit','throw','miss'] as const)void load(kind,audio).catch(()=>{});
}

export function stopPoopSounds(){
 generation++;
 for(const source of active)source.stop();
 active.clear();
}

export function playPoopSound(kind:Kind,audio:AudioContext,output:AudioNode){
 if(isSoundMuted()||document.hidden)return;
 const count=clips[kind].length,last=previous[kind];
 let index=Math.floor(Math.random()*(last===undefined?count:count-1));
 if(last!==undefined&&index>=last)index++;
 previous[kind]=index;
 const requestedAt=performance.now(),requestedGeneration=generation;
 void load(kind,audio).then(buffer=>{
  if(generation!==requestedGeneration||document.hidden||isSoundMuted()||audio.state==='closed'||performance.now()-requestedAt>180)return;
  const [offset,duration]=clips[kind][index];
  const source=audio.createBufferSource(),gain=audio.createGain();
  source.buffer=buffer;
  // Fit the whoosh to the projectile's flight, with its natural start intact.
  if(kind==='throw')source.playbackRate.value=duration/(poopFlightTime/1000);
  gain.gain.value=kind==='miss'?.9:kind==='hit'?.8:.55;
  source.connect(gain).connect(output);active.add(source);
  source.onended=()=>{active.delete(source);source.disconnect();gain.disconnect();};
  source.start(audio.currentTime,offset,duration);
 }).catch(()=>{});
}
