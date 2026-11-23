const moscowClock=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});

export function moscowMinuteOfDay(timestamp:number){
 const parts=moscowClock.formatToParts(timestamp);
 const hour=Number(parts.find(part=>part.type==='hour')?.value);
 const minute=Number(parts.find(part=>part.type==='minute')?.value);
 return hour*60+minute;
}

export function roomLighting(timestamp:number){
 const minutes=moscowMinuteOfDay(timestamp);
 if(minutes>=18*60||minutes<8*60+30)return 'night';
 if(minutes>=17*60)return 'sunset';
 if(minutes>=15*60)return 'golden';
 if(minutes>=10*60)return 'day';
 return 'morning';
}
