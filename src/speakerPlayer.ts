export const speakerTracks=Array.from({length:10},(_,index)=>`/assets/music/speaker-${String(index+1).padStart(2,'0')}.m4a`);
const fadeSeconds=1.5;
const musicVolume=.38;

export function shuffledSpeakerTracks(last:string|null,random=Math.random){
 const tracks=[...speakerTracks];
 for(let i=tracks.length-1;i>0;i--){
  const j=Math.floor(random()*(i+1));
  [tracks[i],tracks[j]]=[tracks[j],tracks[i]];
 }
 if(tracks[0]===last)[tracks[0],tracks[1]]=[tracks[1],tracks[0]];
 return tracks;
}

type Deck={audio:HTMLAudioElement;source:MediaElementAudioSourceNode;gain:GainNode;track:string};
export class SpeakerPlayer {
 private decks:Deck[];
 private current=0;
 private queue:string[]=[];
 private last:string|null=null;
 private running=false;
 private transitioning=false;
 private fading=false;
 private generation=0;
 private transitionTimer:ReturnType<typeof setTimeout>|undefined;
 constructor(private context:AudioContext,private onChange:(playing:boolean,error?:string)=>void){
  this.decks=Array.from({length:2},(_,index)=>{
   const audio=new Audio();
   audio.preload='none';audio.setAttribute('playsinline','');
   const source=context.createMediaElementSource(audio),gain=context.createGain();
   gain.gain.value=0;source.connect(gain).connect(context.destination);
   audio.ontimeupdate=()=>{if(index===this.current)this.update();};
   audio.onended=()=>{if(index===this.current)this.ended();};
   audio.onerror=()=>{
    if(this.running)this.stop('Не удалось загрузить песню. Нажми колонку, чтобы попробовать снова.');
   };
   return {audio,source,gain,track:''};
  });
 }
 private nextTrack(){
  if(!this.queue.length)this.queue=shuffledSpeakerTracks(this.last);
  return this.queue.shift()!;
 }
 private prepare(deck:Deck){
  deck.track=this.nextTrack();
  deck.audio.preload='auto';deck.audio.src=deck.track;deck.audio.load();
 }
 start(){
  this.stop();
  const generation=this.generation;
  this.queue=shuffledSpeakerTracks(this.last);
  this.current=0;this.running=true;
  this.prepare(this.decks[0]);this.prepare(this.decks[1]);
  this.decks[0].gain.gain.setValueAtTime(musicVolume,this.context.currentTime);
  this.onChange(true);
  void this.context.resume().catch(()=>{if(generation===this.generation)this.stop('Не удалось включить звук. Нажми колонку ещё раз.');});
  void this.decks[0].audio.play().then(()=>{
   if(this.running&&generation===this.generation)this.last=this.decks[0].track;
  }).catch(()=>{if(generation===this.generation)this.stop('Не удалось включить песню. Нажми колонку ещё раз.');});
  // Unlock both media elements during the user's gesture for mobile WebViews.
  void this.decks[1].audio.play().then(()=>{
   if(generation===this.generation&&this.current===0&&!this.transitioning){this.decks[1].audio.pause();this.decks[1].audio.currentTime=0;}
  }).catch(()=>{});
 }
 private update(){
  const deck=this.decks[this.current];
  if(!this.running||this.transitioning||!Number.isFinite(deck.audio.duration))return;
  const remaining=deck.audio.duration-deck.audio.currentTime;
  if(remaining>0&&remaining<=fadeSeconds)this.transition(remaining);
 }
 private transition(duration:number){
  if(!this.running||this.transitioning)return;
  this.transitioning=true;
  const generation=this.generation;
  const old=this.decks[this.current],next=this.decks[1-this.current];
  next.audio.currentTime=0;
  void next.audio.play().then(()=>{
   if(!this.running||generation!==this.generation)return;
   this.last=next.track;this.fading=true;
   const remaining=old.audio.duration-old.audio.currentTime;
   duration=Number.isFinite(remaining)&&remaining>0?Math.min(duration,remaining):.15;
   const at=this.context.currentTime;
   old.gain.gain.cancelScheduledValues(at);next.gain.gain.cancelScheduledValues(at);
   old.gain.gain.setValueAtTime(old.gain.gain.value,at);
   next.gain.gain.setValueAtTime(0,at);
   old.gain.gain.linearRampToValueAtTime(0,at+duration);
   next.gain.gain.linearRampToValueAtTime(musicVolume,at+duration);
   this.transitionTimer=setTimeout(()=>this.finishTransition(),duration*1000);
  }).catch(()=>{if(generation===this.generation)this.stop('Не удалось включить следующую песню. Нажми колонку ещё раз.');});
 }
 private finishTransition(){
  if(!this.running||!this.transitioning||!this.fading)return;
  clearTimeout(this.transitionTimer);this.transitionTimer=undefined;
  const old=this.decks[this.current];old.audio.pause();
  this.current=1-this.current;this.transitioning=false;this.fading=false;
  this.decks[this.current].gain.gain.cancelScheduledValues(this.context.currentTime);
  this.decks[this.current].gain.gain.setValueAtTime(musicVolume,this.context.currentTime);
  old.gain.gain.cancelScheduledValues(this.context.currentTime);old.gain.gain.setValueAtTime(0,this.context.currentTime);
  this.prepare(old);
 }
 private ended(){
  if(!this.running)return;
  if(this.transitioning)this.finishTransition();
  else this.transition(.15);
 }
 stop(error?:string){
  this.running=false;this.transitioning=false;this.fading=false;this.generation++;
  clearTimeout(this.transitionTimer);this.transitionTimer=undefined;
  for(const deck of this.decks){
   deck.audio.pause();deck.gain.gain.cancelScheduledValues(this.context.currentTime);
   deck.gain.gain.setValueAtTime(0,this.context.currentTime);
   deck.audio.removeAttribute('src');deck.audio.load();deck.track='';
  }
  this.onChange(false,error);
 }
 dispose(){
  this.stop();
  for(const deck of this.decks){deck.audio.ontimeupdate=deck.audio.onended=deck.audio.onerror=null;deck.source.disconnect();deck.gain.disconnect();}
 }
}
