let context:AudioContext|undefined;
let muted=false;
export function isSoundMuted(){return muted;}
export function muteSound(value:boolean){muted=value;}
export function getSoundContext(){if(muted)return;unlockSound();return context;}
export function unlockSound(){try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{}}
export function sound(kind:string){if(muted)return;unlockSound();if(!context)return;const c=context;const start=c.currentTime;const osc=c.createOscillator();const gain=c.createGain();const tones:Record<string,number>={lift:620,fall:90,feed:420,pet:660,sleep:220,wash:820,play:550,heal:740};const f=tones[kind]??360;osc.type=kind==='fall'?'triangle':'sine';osc.frequency.setValueAtTime(f,start);osc.frequency.exponentialRampToValueAtTime(kind==='lift'?1000:Math.max(45,f*.45),start+.18);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.09,start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+.23);osc.connect(gain);gain.connect(c.destination);osc.start(start);osc.stop(start+.25);osc.onended=()=>{osc.disconnect();gain.disconnect();};}

export function playToiletSound(visit: 'pee' | 'poop') {
 const audio = getSoundContext();
 if (!audio) return;
 const output = audio.createGain();
 output.connect(audio.destination);

 function play() {
  if (muted || document.hidden) return;
  const time = audio!.currentTime;
  if (visit === 'pee') {
   const noise = audio!.createBuffer(1, audio!.sampleRate * 3, audio!.sampleRate);
   const samples = noise.getChannelData(0);
   for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (.65 + .35 * Math.sin(i / 380));
   const source = audio!.createBufferSource();
   const filter = audio!.createBiquadFilter();
   filter.type = 'bandpass';
   filter.frequency.value = 1450;
   source.buffer = noise;
   source.connect(filter).connect(output);
   output.gain.setValueAtTime(.001,time);
   output.gain.linearRampToValueAtTime(.16,time+.16);
   output.gain.linearRampToValueAtTime(.001,time+2.9);
   source.onended=()=>{source.disconnect();filter.disconnect();};
   source.start();
  } else {
   const oscillator = audio!.createOscillator();
   oscillator.type = 'sawtooth';
   oscillator.frequency.setValueAtTime(100 + Math.random()*35,time);
   oscillator.frequency.exponentialRampToValueAtTime(42,time+.3);
   output.gain.setValueAtTime(.001,time);
   output.gain.linearRampToValueAtTime(.08,time+.05);
   output.gain.exponentialRampToValueAtTime(.001,time+.38);
   oscillator.connect(output);
   oscillator.onended=()=>oscillator.disconnect();
   oscillator.start();
   oscillator.stop(time+.4);
  }
 }
 play();
 const timer = window.setInterval(play, visit === 'pee' ? 3400 : 6200);
 return () => {window.clearInterval(timer);output.disconnect();};
}

export function playDogBark(){
 const audio=context;
 if(muted||document.hidden||!audio||audio.state!=='running')return;
 for(const [delay,pitch] of [[0,245],[.25,205]]){
  const time=audio.currentTime+delay;
  const voice=audio.createOscillator();
  const rasp=audio.createBufferSource();
  const noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.18),audio.sampleRate);
  const samples=noise.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  rasp.buffer=noise;
  voice.type='sawtooth';
  voice.frequency.setValueAtTime(pitch*.7,time);
  voice.frequency.exponentialRampToValueAtTime(pitch,time+.045);
  voice.frequency.exponentialRampToValueAtTime(pitch*.54,time+.17);
  const filter=audio.createBiquadFilter(),raspGain=audio.createGain(),output=audio.createGain();
  filter.type='bandpass';filter.frequency.value=720;filter.Q.value=.8;
  raspGain.gain.value=.28;
  output.gain.setValueAtTime(.001,time);
  output.gain.exponentialRampToValueAtTime(.16,time+.025);
  output.gain.exponentialRampToValueAtTime(.001,time+.18);
  rasp.connect(raspGain).connect(filter);voice.connect(filter);filter.connect(output).connect(audio.destination);
  rasp.start(time);voice.start(time);voice.stop(time+.18);
  voice.onended=()=>{voice.disconnect();rasp.disconnect();raspGain.disconnect();filter.disconnect();output.disconnect();};
 }
}

export function playRangeSound(audio:AudioContext,output:AudioNode,weapon:'pistol'|'bat'){
 const pistol=weapon==='pistol';
 const start=audio.currentTime;
 const duration=pistol?.095:.135;
 const source=audio.createBufferSource();
 const noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);
 const samples=noise.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 source.buffer=noise;
 const filter=audio.createBiquadFilter();
 filter.type=pistol?'bandpass':'lowpass';
 filter.frequency.setValueAtTime(pistol?3200:640,start);
 filter.frequency.exponentialRampToValueAtTime(pistol?340:85,start+duration);
 const envelope=audio.createGain();
 envelope.gain.setValueAtTime(pistol?.5:.7,start);
 envelope.gain.exponentialRampToValueAtTime(.001,start+duration);
 source.connect(filter).connect(envelope).connect(output);
 source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();};
 source.start(start);
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
  const volume=audio.createGain();volume.gain.value=.9;
  source.connect(volume).connect(output);source.onended=()=>{source.disconnect();volume.disconnect();};source.start();
 }).catch(()=>{});
}
