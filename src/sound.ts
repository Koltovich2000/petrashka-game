let context:AudioContext|undefined;
let muted=false;
export function isSoundMuted(){return muted;}
export function muteSound(value:boolean){muted=value;if(typeof window!=='undefined')window.dispatchEvent(new Event('petrashka-sound-change'));}
export function getSoundContext(unlock=true){if(muted)return;if(unlock)unlockSound();return context;}
export function unlockSound(){try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{}}
export function sound(kind:string){if(muted)return;unlockSound();if(!context)return;const c=context;const start=c.currentTime;const osc=c.createOscillator();const gain=c.createGain();const tones:Record<string,number>={lift:620,fall:90,pet:660,sleep:220,wash:820,play:550,heal:740};const f=tones[kind]??360;osc.type=kind==='fall'?'triangle':'sine';osc.frequency.setValueAtTime(f,start);osc.frequency.exponentialRampToValueAtTime(kind==='lift'?1000:Math.max(45,f*.45),start+.18);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.09,start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+.23);osc.connect(gain);gain.connect(c.destination);osc.start(start);osc.stop(start+.25);osc.onended=()=>{osc.disconnect();gain.disconnect();};}

let toiletPeeRecording:Promise<AudioBuffer>|undefined;
function loadToiletPee(audio:AudioContext){
 toiletPeeRecording??=fetch('/assets/audio/toilet-pee-whistle-loop.m4a').then(response=>{
  if(!response.ok)throw new Error('Toilet sound unavailable');
  return response.arrayBuffer();
 }).then(data=>audio.decodeAudioData(data)).catch(error=>{toiletPeeRecording=undefined;throw error;});
 return toiletPeeRecording;
}

export function prepareToiletPeeSound(){
 if(!muted&&context)void loadToiletPee(context).catch(()=>{});
}

export function playToiletSound(){
 const audio=getSoundContext();
 if(!audio)return;
 const bufferReady=loadToiletPee(audio);
 let source:AudioBufferSourceNode|undefined;
 let disposed=false;
 function stopSource(){
  const playing=source;
  source=undefined;
  if(playing){playing.stop();playing.disconnect();}
 }
 const sync=()=>{
  if(document.hidden||muted){stopSource();return;}
  void bufferReady.then(buffer=>{
   if(disposed||source||muted||document.hidden)return;
   const player=audio.createBufferSource();
   player.buffer=buffer;
   player.loop=true;
   player.connect(audio.destination);
   source=player;
   player.start();
  }).catch(()=>{});
 };
 sync();
 document.addEventListener('visibilitychange',sync);
 return ()=>{
  disposed=true;
  document.removeEventListener('visibilitychange',sync);
  stopSource();
 };
}

let rangeShot:Promise<AudioBuffer>|undefined;
export function prepareRangeShot(){
 const audio=getSoundContext();
 if(!audio)return;
 rangeShot??=fetch('/assets/audio/range-pistol-single.wav').then(response=>{
  if(!response.ok)throw new Error('Shot unavailable');
  return response.arrayBuffer();
 }).then(data=>audio.decodeAudioData(data)).catch(error=>{rangeShot=undefined;throw error;});
 void rangeShot.catch(()=>{});
}
export function playRangeShot(output:AudioNode){
 prepareRangeShot();
 const audio=getSoundContext();
 if(!audio)return;
 void rangeShot?.then(buffer=>{
  if(muted)return;
  const source=audio.createBufferSource();source.buffer=buffer;
  const volume=audio.createGain();volume.gain.value=.65;
  source.connect(volume).connect(output);source.onended=()=>{source.disconnect();volume.disconnect();};source.start();
 }).catch(()=>{});
}
