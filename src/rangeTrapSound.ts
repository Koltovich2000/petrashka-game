import {isSoundMuted} from './sound';

export function playSawCloth(audio:AudioContext,output:AudioNode){
 const time=audio.currentTime,duration=.29;
 const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);
 const samples=buffer.getChannelData(0);
 // Grainy, uneven bursts give the cloth sound a different attack from the steady motor.
 for(let i=0;i<samples.length;i++){
  const t=i/audio.sampleRate;
  const grain=.40+.42*Math.abs(Math.sin(t*1980)+Math.sin(t*2910))*.5;
  samples[i]=(Math.random()*2-1)*grain;
 }
 const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),volume=audio.createGain();
 source.buffer=buffer;
 filter.type='bandpass';filter.Q.value=.75;
 filter.frequency.setValueAtTime(3150,time);
 filter.frequency.exponentialRampToValueAtTime(1120,time+duration);
 volume.gain.setValueAtTime(.001,time);
 volume.gain.linearRampToValueAtTime(.49,time+.014);
 volume.gain.exponentialRampToValueAtTime(.09,time+.085);
 volume.gain.linearRampToValueAtTime(.32,time+.112);
 volume.gain.exponentialRampToValueAtTime(.001,time+duration);
 source.connect(filter).connect(volume).connect(output);
 source.start(time);
 source.onended=()=>{source.disconnect();filter.disconnect();volume.disconnect();};
}
const volume={'saw-motor':1.65,fan:1,'weight-fall':1,'weight-impact':1,'spikes-first':.66,'spikes-repeat':.85};
const wallClips=['wall-hit-1','wall-hit-2','wall-hit-3','wall-hit-4','wall-hit-5','wall-hit-6','wall-hit-7'] as const;
const batClips=['bat-hit-1','bat-hit-2','bat-hit-3'] as const;
type Recording=keyof typeof volume|typeof wallClips[number]|typeof batClips[number];
const downloads=new Map<Recording,Promise<ArrayBuffer>>();
const decoded=new Map<Recording,Promise<AudioBuffer>>();
let lastWallClip=-1;

function download(kind:Recording){
 let task=downloads.get(kind);
 if(!task){
  task=fetch(`/assets/audio/range-${kind}.wav`).then(response=>{
   if(!response.ok)throw new Error('Trap sound unavailable');
   return response.arrayBuffer();
  }).catch(error=>{downloads.delete(kind);throw error;});
  downloads.set(kind,task);
 }
 return task;
}

export function preloadTrapRecordings(){
 for(const kind of [...Object.keys(volume) as (keyof typeof volume)[],...wallClips,...batClips])void download(kind).catch(()=>{});
}

export function playImpactRecording(audio:AudioContext,output:AudioNode){
 const choices=lastWallClip<0?wallClips.length:wallClips.length-1;
 let index=Math.floor(Math.random()*choices);
 if(lastWallClip>=0&&index>=lastWallClip)index++;
 lastWallClip=index;
 playTrapRecording(audio,output,wallClips[index]);
}

function recordingVolume(kind:Recording){
 return Object.hasOwn(volume,kind)?volume[kind as keyof typeof volume]:.82;
}

export function playBatImpact(audio:AudioContext,output:AudioNode){
 return playTrapRecording(audio,output,batClips[Math.floor(Math.random()*batClips.length)]);
}

export function playTrapRecording(audio:AudioContext,output:AudioNode,kind:Recording){
 let task=decoded.get(kind);
 if(!task){
  task=download(kind).then(data=>audio.decodeAudioData(data.slice(0)))
   .catch(error=>{decoded.delete(kind);downloads.delete(kind);throw error;});
  decoded.set(kind,task);
 }
 const start=performance.now();
 let playing:{source:AudioBufferSourceNode;gain:GainNode}|undefined;
 let stopped=false;
 void task.then(buffer=>{
  if(stopped||isSoundMuted()||audio.state==='closed')return;
  const elapsed=(performance.now()-start)/1000;
  const followAnimation=kind==='saw-motor'||kind==='weight-fall';
  // The fan recording opens with its switch click, so play it from the first sample.
  const offset=followAnimation?elapsed:0;
  const deadline=followAnimation||kind==='fan'?buffer.duration:.3;
  if(elapsed>=deadline)return;
  const source=audio.createBufferSource(),gain=audio.createGain();
  source.buffer=buffer;gain.gain.value=recordingVolume(kind);
  source.connect(gain).connect(output);
  playing={source,gain};
  source.onended=()=>{playing=undefined;source.disconnect();gain.disconnect();};
  source.start(audio.currentTime,offset);
 }).catch(()=>{});
 return ()=>{
  if(stopped)return;
  stopped=true;
  if(!playing)return;
  const time=audio.currentTime;
  playing.gain.gain.setTargetAtTime(.001,time,.012);
  playing.source.stop(time+.045);
 };
}

