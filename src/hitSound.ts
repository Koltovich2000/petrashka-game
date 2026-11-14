import {getSoundContext} from './sound';

const voiceUrls=Array.from({length:5},(_,i)=>`/assets/audio/voice-${i+1}.wav`);
const impactUrls=Array.from({length:3},(_,i)=>`/assets/audio/impact-${i+1}.wav`);

let loaded:Promise<AudioBuffer[]>|undefined;
let active:AudioBufferSourceNode[]=[];
let generation=0;

function load(context:AudioContext){
 loaded??=Promise.all([...voiceUrls,...impactUrls].map(async url=>{
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Failed to load ${url}`);
  return context.decodeAudioData(await response.arrayBuffer());
 })).catch(error=>{loaded=undefined;throw error;});
 return loaded;
}

export function prepareHitSound(){
 const context=getSoundContext();
 if(context)void load(context).catch(()=>{});
}

export function stopHitSound(){
 generation++;
 for(const source of active){
  source.stop();
  source.disconnect();
 }
 active=[];
}

export function playHitSound(){
 stopHitSound();
 const context=getSoundContext();
 if(!context)return;

 const request=generation;
 const voice=Math.floor(Math.random()*voiceUrls.length);
 const impact=voiceUrls.length+Math.floor(Math.random()*impactUrls.length);
 void load(context).then(buffers=>{
  if(request!==generation)return;
  const start=context.currentTime+.005;
  for(const index of [voice,impact]){
   const source=context.createBufferSource();
   source.buffer=buffers[index];
   source.connect(context.destination);
   source.onended=()=>{
    source.disconnect();
    active=active.filter(node=>node!==source);
   };
   active.push(source);
   source.start(start);
  }
 }).catch(()=>{});
}
