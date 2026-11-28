import {useEffect,useRef,useState} from 'react';
import {getSoundContext,isSoundMuted} from './sound';
import {onTelegramLifecycle} from './telegram';
import {SpeakerPlayer} from './speakerPlayer';

export function useSpeaker(owned:boolean){
 const player=useRef<SpeakerPlayer|null>(null);
 const [playing,setPlaying]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  const stop=()=>player.current?.stop();
  const visibility=()=>{if(document.hidden)stop();};
  const mute=()=>{if(isSoundMuted())stop();};
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',stop);window.addEventListener('blur',stop);
  window.addEventListener('petrashka-sound-change',mute);
  const unsubscribe=onTelegramLifecycle(()=>{},stop);
  return()=>{
   document.removeEventListener('visibilitychange',visibility);
   window.removeEventListener('pagehide',stop);window.removeEventListener('blur',stop);
   window.removeEventListener('petrashka-sound-change',mute);unsubscribe?.();
   player.current?.dispose();player.current=null;
  };
 },[]);
 useEffect(()=>{if(!owned)player.current?.stop();},[owned]);
 function toggle(){
  if(!owned)return;
  if(playing){player.current?.stop();return;}
  const audio=getSoundContext();
  if(!audio){setError('Включи звук в игре, затем нажми колонку.');return;}
  player.current??=new SpeakerPlayer(audio,(value,message)=>{setPlaying(value);setError(message??'');});
  player.current.start();
 }
 return {playing,error,toggle};
}
