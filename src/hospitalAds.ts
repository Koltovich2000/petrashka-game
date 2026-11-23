export type HospitalAds={blockId:string;watched:number;pending:boolean};

type AdController={show():Promise<{done:boolean;error:boolean}>};
type AdsunSdk={init(options:{blockId:string}):AdController};

declare global {
 interface Window {Adsun?:AdsunSdk}
}

let sdkLoading:Promise<AdsunSdk>|undefined;

export async function hospitalAdController(blockId:string){
 if(!window.Adsun&&!sdkLoading){
  sdkLoading=new Promise<AdsunSdk>((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://api.adsun.io/sdk.js';
   script.async=true;
   const timer=window.setTimeout(failed,10_000);
   function failed(){
    window.clearTimeout(timer);
    script.remove();
    reject(new Error('Adsun SDK unavailable'));
   }
   script.onerror=failed;
   script.onload=()=>{
    if(!window.Adsun){failed();return;}
    window.clearTimeout(timer);
    resolve(window.Adsun);
   };
   document.head.append(script);
  }).catch((error:unknown)=>{
   sdkLoading=undefined;
   throw error;
  });
 }
 const sdk=window.Adsun??await sdkLoading;
 if(!sdk)throw new Error('Adsun SDK unavailable');
 return sdk.init({blockId});
}
