import {randomUUID} from 'node:crypto';

export function notificationAppUrl(value){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='t.me'||!/^\/[a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)?$/.test(url.pathname))return null;
  if(url.pathname.split('/').length===2&&!url.searchParams.has('startapp'))return null;
  return url.href;
 }catch{return null;}
}

export function createNotifications({getStore,botToken,appUrl=process.env.TELEGRAM_MINI_APP_URL,clock=Date.now,fetchApi=fetch}){
 const url=notificationAppUrl(appUrl);
 const configured=Boolean(botToken&&url);
 const owner=randomUUID();
 let timer,running,stopped=false,cursor='';
 async function tick(){
  if(!configured||stopped)return;
  const database=await getStore();
  const store=database.notifications;
  if(!await store.acquire(owner,clock()))return;
  let nextAt=clock()+1100;
  try{
   await database.world.snapshot(clock);
   cursor=await store.scan(cursor,clock());
   const entry=await store.claim(owner,clock());
   if(!entry)return;
   let response,data;
   try{
    response=await fetchApi('https://api.telegram.org/bot'+botToken+'/sendMessage',{
     method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(7000),
     body:JSON.stringify({chat_id:entry.player_id,text:entry.text,
      reply_markup:{inline_keyboard:[[{text:'🎮 Играть',url}]]}}),
    });
    data=await response.json();
   }catch{
    // Telegram has no sendMessage idempotency key. An uncertain delivery must not be retried.
    await store.finish(entry.id,'unknown',clock(),{errorCode:'delivery_unknown'});
    return;
   }
   if(response.ok&&data.ok===true){
    await store.finish(entry.id,'sent',clock(),{messageId:data.result?.message_id??null});return;
   }
   const code=Number(data.error_code||response.status);
   if(code===403){
    await store.grant(entry.player_id,false,clock());
    await store.finish(entry.id,'failed',clock(),{errorCode:'403'});return;
   }
   if(code===429){
    const seconds=Number(data.parameters?.retry_after);
    nextAt=clock()+(Number.isFinite(seconds)&&seconds>0?seconds:60)*1000+1000;
    await store.finish(entry.id,'pending',nextAt,{errorCode:'429'});return;
   }
   if(code===401)nextAt=clock()+5*60_000;
   if(data.ok===false&&(code===401||code>=500)&&entry.attempts<5){
    const retryAt=code===401?nextAt:clock()+Math.min(300_000,5000*2**entry.attempts);
    await store.finish(entry.id,'pending',retryAt,{errorCode:String(code)});return;
   }
   await store.finish(entry.id,'failed',clock(),{errorCode:String(code)});
  }finally{await store.release(owner,nextAt);}
 }
 function run(){
  if(!running)running=tick().catch(error=>console.error('Notification worker failed',error.code??error.name)).finally(()=>{running=undefined;});
  return running;
 }
 return {
  configured,
  run,
  start(){
   if(timer||!configured)return;
   stopped=false;timer=setInterval(run,1100);timer.unref();void run();
  },
  async stop(){stopped=true;clearInterval(timer);timer=undefined;await running;},
  async status(id){return {...await (await getStore()).notifications.status(id),configured};},
  async preference(id,enabled){return {...await (await getStore()).notifications.preference(id,enabled,clock()),configured};},
  async grant(id,allowed,at=clock()){await (await getStore()).notifications.grant(id,allowed,at);},
  async observe(id){await (await getStore()).notifications.observe(id,clock());},
  async telegramUpdate(update){
   const message=update?.message;
   const started=/^\/start(?:@\w+)?(?:\s|$)/.test(message?.text??'');
   if((message?.write_access_allowed||started)&&message.chat?.type==='private'&&message.chat.id===message.from?.id&&Number.isSafeInteger(message.from.id)&&Number.isSafeInteger(message.date)){
    await (await getStore()).notifications.grant(String(message.from.id),true,Number(message.date)*1000);
   }
   const member=update?.my_chat_member;
   if(member?.chat?.type==='private'&&Number.isSafeInteger(member.chat.id)&&Number.isSafeInteger(member.date)){
    const status=member.new_chat_member?.status;
    if(status==='kicked')await (await getStore()).notifications.grant(String(member.chat.id),false,Number(member.date)*1000);
   }
  },
 };
}
