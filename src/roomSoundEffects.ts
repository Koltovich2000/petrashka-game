import {getSoundContext,isSoundMuted} from './sound';

const effects={
 footstep:{file:'room-footsteps',duration:.225,gain:.5},
 sponge:{file:'bath-sponge',duration:.285,gain:.62},
 eating:{file:'eating-first-crunch',duration:1.32,gain:.68},
 ball:{file:'room-ball-contacts',duration:.52,gain:.74},
 'dog-bark':{file:'dog-touch-bark',duration:1,gain:.68},
 'dog-happy':{file:'dog-touch-puppy',duration:1,gain:.64},
} as const;
type Effect=keyof typeof effects;
const downloads=new Map<Effect,Promise<ArrayBuffer>>();
const recordings=new Map<Effect,Promise<AudioBuffer>>();
const nextClip:Partial<Record<Effect,number>>={};

export function prepareRoomSound(kind:Effect){
 let cached=downloads.get(kind);
 if(!cached){
  cached=fetch(`/assets/audio/${effects[kind].file}.wav`).then(response=>{
   if(!response.ok)throw new Error('Room sound unavailable');
   return response.arrayBuffer();
  }).catch(error=>{downloads.delete(kind);throw error;});
  downloads.set(kind,cached);
 }
 return cached;
}

export function playRoomSound(kind:Effect,ambient=false){
 if(document.hidden)return;
 const audio=getSoundContext(!ambient);
 if(!audio||ambient&&audio.state!=='running')return;
 const at=performance.now();
 let recording=recordings.get(kind);
 if(!recording){
  recording=prepareRoomSound(kind).then(data=>audio.decodeAudioData(data.slice(0)))
   .catch(error=>{recordings.delete(kind);downloads.delete(kind);throw error;});
  recordings.set(kind,recording);
 }
 let stopped=false;
 let playing:AudioBufferSourceNode|undefined;
 void recording.then(buffer=>{
  if(stopped||isSoundMuted()||document.hidden||performance.now()-at>100)return;
  const effect=effects[kind];
  const count=Math.round(buffer.duration/effect.duration);
  if(!count)return;
  const index=kind==='ball'||kind==='dog-happy'?Math.floor(Math.random()*count):(nextClip[kind]??0)%count;
  nextClip[kind]=index+1;
  const source=audio.createBufferSource(),gain=audio.createGain();
  source.buffer=buffer;gain.gain.value=effect.gain;
  source.connect(gain).connect(audio.destination);
  playing=source;
  source.onended=()=>{playing=undefined;source.disconnect();gain.disconnect();};
  source.start(0,index*effect.duration,effect.duration);
 }).catch(()=>{});
 return ()=>{
  if(stopped)return;
  stopped=true;
  playing?.stop();
 };
}
