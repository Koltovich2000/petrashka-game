import {useEffect,useRef,useState} from 'react';

type Controller={loadAd:()=>Promise<unknown>;showAd:()=>Promise<unknown>|void};
type Tads={init:(options:{widgetId:number;type:'static';debug:boolean;onAdsNotFound:()=>void})=>Controller};
declare global{interface Window{tads?:Tads}}
let loading:Promise<Tads>|undefined;
function loadSdk(){
 if(window.tads)return Promise.resolve(window.tads);
 if(!loading)loading=new Promise<Tads>((resolve,reject)=>{
  const script=document.createElement('script');
  const timer=window.setTimeout(failed,12_000);
  function failed(){window.clearTimeout(timer);script.remove();reject(new Error('TADS unavailable'));}
  script.src='https://w.tads.me/widget.js';script.async=true;script.onerror=failed;
  script.onload=()=>{window.clearTimeout(timer);if(window.tads)resolve(window.tads);else failed();};
  document.head.append(script);
 }).catch((error:unknown)=>{loading=undefined;throw error;});
 return loading;
}

export function TadsBanner({enabled}:{enabled:boolean}){
 const [widgetId,setWidgetId]=useState<number>();
 const [visible,setVisible]=useState(false);
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!enabled)return;
  const abort=new AbortController();
  void fetch('/api/config',{signal:abort.signal}).then(async response=>{
   if(!response.ok)return;
   const config=await response.json();
   if(!abort.signal.aborted&&Number.isSafeInteger(config.tadsWidgetId)&&config.tadsWidgetId>0)setWidgetId(config.tadsWidgetId);
  }).catch(()=>{});
  return()=>abort.abort();
 },[enabled]);
 useEffect(()=>{
  if(!enabled||!widgetId)return;
  let cancelled=false,started=false,noAd=false;
  const hide=()=>{noAd=true;if(!cancelled)setVisible(false);};
  async function start(){
   if(cancelled||started||document.hidden)return;
   started=true;
   try{
    const sdk=await loadSdk();
    if(cancelled||!host.current)return;
    const controller=sdk.init({widgetId:widgetId!,type:'static',debug:false,onAdsNotFound:hide});
    await controller.loadAd();
    if(cancelled)return;
    await controller.showAd();
    if(!cancelled&&!noAd)setVisible(true);
   }catch{hide();}
  }
  void start();document.addEventListener('visibilitychange',start);
  return()=>{cancelled=true;document.removeEventListener('visibilitychange',start);};
 },[enabled,widgetId]);
 if(!enabled||!widgetId)return null;
 return <aside className="tads-banner" hidden={!visible} aria-label="Реклама">
  <span className="tads-banner-label">Реклама</span>
  <div ref={host} id={`tads-container-${widgetId}`}/>
 </aside>;
}
