interface WebApp { initData:string; colorScheme:'light'|'dark'; ready():void; expand():void; onEvent(name:string,cb:()=>void):void; offEvent(name:string,cb:()=>void):void; isVersionAtLeast(v:string):boolean; setHeaderColor(c:string):void; setBackgroundColor(c:string):void; HapticFeedback?:{impactOccurred(style:'light'):void}; }
declare global { interface Window { Telegram?:{WebApp:WebApp} } }
export const telegram=window.Telegram?.WebApp;
export const inTelegram=Boolean(telegram?.initData);
export function haptic(){if(inTelegram&&telegram?.isVersionAtLeast('6.1'))telegram.HapticFeedback?.impactOccurred('light');}
