import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {openGameStore} from './game-store.mjs';
import {createNotifications,notificationAppUrl} from './notifications.mjs';
import {notificationTexts} from './notification-store.mjs';
import {fresh,advance} from '../src/game.ts';
import {createAppServer} from './index.mjs';
import {issueGameSession} from './game-session.mjs';

const hour=3_600_000,day=24*hour;
const appUrl='https://t.me/test_bot/play';
async function setup(t){
 const directory=await mkdtemp(join(tmpdir(),'petrashka-notifications-'));
 const path=join(directory,'game.sqlite');
 let now=1_800_000_000_000;
 let store=await openGameStore(path);
 const db=new DatabaseSync(path);
 const sent=[];
 let response;
 const workers=[];
 function worker(){
  const service=createNotifications({getStore:async()=>store,botToken:'test-token',appUrl,clock:()=>now,
   fetchApi:async(_url,request)=>{
    const message=JSON.parse(request.body);
    sent.push(message);
    if(response instanceof Error)throw response;
    return {ok:!response,json:async()=>response??{ok:true,result:{message_id:sent.length}}};
   }});
  workers.push(service);return service;
 }
 const service=worker();
 t.after(async()=>{for(const worker of workers)await worker.stop();await store.close();db.close();await rm(directory,{recursive:true,force:true});});
 return {
  service,sent,db,worker,
  get store(){return store;},get now(){return now;},
  time(value){now=value;},elapse(ms){now+=ms;},fail(value){response=value;},
  async restart(){await service.stop();await store.close();store=await openGameStore(path);return worker();},
  async save(patch={},lastSeen=now,id='123'){
   await store.change(id,()=>({state:{...fresh(now),...patch},events:[]}),{activeAt:lastSeen});
   await store.notifications.observe(id,now);
  },
  async allow(id='123'){await store.notifications.grant(id,true,now);},
  rows(){return db.prepare('SELECT * FROM petrashka_notification_queue ORDER BY created_at,id').all();},
  async run(){await service.run();now+=2000;},
 };
}

test('permission is required, welcome waits for the complete tour, opt-out survives later grants',async t=>{
 const f=await setup(t);
 await f.save();await f.run();assert.equal(f.sent.length,0);
 await f.store.notifications.preference('123',true,f.now);
 await f.run();assert.equal(f.sent.length,0);
 await f.save({tourSection:'tasks'});await f.allow();await f.run();assert.equal(f.sent.length,0);
 await f.save();await f.run();
 assert.equal(f.sent[0].text,notificationTexts.welcome);
 assert.deepEqual(f.sent[0].reply_markup,{inline_keyboard:[[{text:'🎮 Играть',url:appUrl}]]});
 await f.run();assert.equal(f.sent.length,1);
 await f.store.notifications.preference('123',false,f.now);
 await f.allow();assert.equal((await f.service.status('123')).enabled,false);
 await f.save({food:0});await f.run();assert.equal(f.sent.length,1);
 const restarted=await f.restart();await restarted.run();assert.equal(f.sent.length,1);
});

test('20 percent warnings merge, remain quiet during activity, and rearm only above 30',async t=>{
 const f=await setup(t);await f.save();await f.allow();await f.run();
 await f.save({food:20,energy:20,hygiene:20,mood:20});await f.run();
 assert.equal(f.sent.length,1);
 f.elapse(61_000);await f.run();
 assert.equal(f.sent.length,2);
 assert.equal(f.sent[1].text,['food','energy','hygiene','mood'].map(stat=>notificationTexts[stat][0]).join('\n\n'));
 await f.run();assert.equal(f.sent.length,2);
 await f.save({food:30,energy:30,hygiene:30,mood:30});
 await f.save({food:20,energy:20,hygiene:20,mood:20});f.elapse(61_000);await f.run();
 assert.equal(f.rows().filter(row=>row.kind==='stats').length,1);
 await f.save({food:31,energy:31,hygiene:31,mood:31});
 await f.save({food:20,energy:20,hygiene:20,mood:20});f.elapse(61_000);await f.run();
 assert.equal(f.rows().filter(row=>row.kind==='stats').length,2);
 assert.equal(f.sent.length,2); // welcome + warning exhausted the rolling ordinary limit
});

test('critical events and polls bypass the ordinary cap and are sent once',async t=>{
 const f=await setup(t);await f.save();await f.allow();await f.run();
 await f.save({food:20},f.now-61_000);f.elapse(61_000);await f.run();assert.equal(f.sent.length,2);
 await f.save({food:0,energy:0,hygiene:0,mood:0});f.elapse(61_000);await f.run();
 assert.equal(f.sent.length,3);
 assert.equal(f.sent[2].text,['food','energy','hygiene','mood'].map(stat=>notificationTexts[stat][1]).join('\n\n'));
 await f.run();assert.equal(f.sent.length,3);
 await f.store.world.createPoll({id:'test-poll',question:'Go?',options:['Yes','No'],duration:hour},()=>f.now);
 await f.run();assert.equal(f.sent[3].text,notificationTexts.poll);
 await f.run();assert.equal(f.sent.length,4);
});

test('offline inspection preserves saved state and uses the existing 12 hour cap',async t=>{
 const f=await setup(t);await f.save();await f.allow();await f.run();
 const saved=JSON.parse((await f.store.player('123')).state);
 f.elapse(2*day);await f.run();
 assert.equal(f.sent.at(-1).text,notificationTexts.absence);
 assert.equal(f.sent.some(message=>message.text.includes('обои')),false); // food stays 46 with the offline cap
 assert.equal(advance(saved,f.now,true).food,46);
 assert.deepEqual(JSON.parse((await f.store.player('123')).state),saved);
 await f.run();assert.equal(f.sent.filter(message=>message.text===notificationTexts.absence).length,1);
 await f.save();f.elapse(2*day);await f.run();
 assert.equal(f.sent.filter(message=>message.text===notificationTexts.absence).length,2);
});

test('sleep, hospitalization and global pause suppress stat warnings',async t=>{
 const f=await setup(t);await f.save();await f.allow();await f.run();
 await f.save({food:0,hygiene:0,mood:0,sleepUntil:0});f.elapse(hour);await f.run();assert.equal(f.sent.length,1);
 await f.save({food:0,health:0,sleepUntil:null});await f.run();assert.equal(f.sent.length,1);
 await f.save({food:0});await f.store.world.setPause(true,()=>f.now);await f.run();assert.equal(f.sent.length,1);
 await f.store.world.setPause(false,()=>f.now);f.elapse(61_000);await f.run();assert.equal(f.sent.length,2);
});

test('a deleted or finished poll is removed from the waiting queue',async t=>{
 const f=await setup(t);await f.save();await f.allow();await f.run();
 await f.store.world.createPoll({id:'removed',question:'Go?',options:['Yes','No'],duration:hour},()=>f.now);
 await f.store.notifications.observe('123',f.now);
 await f.store.world.removePoll('removed',()=>f.now);await f.run();
 assert.equal(f.sent.length,1);
 assert.equal(f.rows().find(row=>row.kind==='poll').status,'cancelled');
});

test('two workers and a restart do not send the same event twice',async t=>{
 const f=await setup(t);await f.save();await f.allow();
 const second=f.worker();
 await Promise.all([f.service.run(),second.run()]);
 assert.equal(f.sent.length,1);
 const restarted=await f.restart();f.elapse(2000);await restarted.run();assert.equal(f.sent.length,1);
});

test('429 is retried after retry_after, explicit server failures back off, 403 disables delivery',async t=>{
 const f=await setup(t);await f.save();await f.allow();
 f.fail({ok:false,error_code:429,parameters:{retry_after:10}});await f.run();assert.equal(f.sent.length,1);
 f.fail(undefined);await f.run();assert.equal(f.sent.length,1);
 f.elapse(11_000);await f.run();assert.equal(f.sent.length,2);assert.equal(f.rows()[0].status,'sent');
 await f.save({food:0});f.elapse(61_000);f.fail({ok:false,error_code:500});await f.run();
 assert.equal(f.rows().find(row=>row.kind==='stats').status,'pending');
 f.fail(undefined);f.elapse(12_000);await f.run();assert.equal(f.rows().find(row=>row.kind==='stats').status,'sent');
 await f.save({food:31});await f.save({food:0});f.elapse(61_000);f.fail({ok:false,error_code:403});await f.run();
 assert.equal((await f.service.status('123')).granted,false);
 const count=f.sent.length;await f.run();assert.equal(f.sent.length,count);
});

test('uncertain network delivery is recorded and not retried after restart',async t=>{
 const f=await setup(t);await f.save();await f.allow();f.fail(new Error('socket timeout'));
 await f.run();assert.equal(f.rows()[0].status,'unknown');
 const restarted=await f.restart();f.elapse(60_000);f.fail(undefined);await restarted.run();assert.equal(f.sent.length,1);
});

test('signed initData and authenticated Telegram service messages establish permission',async t=>{
 const f=await setup(t);
 const botToken='notification-auth-test';
 const webhookSecret='notification_webhook_secret_123456789';
 const directory=await mkdtemp(join(tmpdir(),'petrashka-notifications-api-'));
 const server=createAppServer({botToken,game:{databasePath:join(directory,'game.sqlite'),databaseUrl:'',clock:()=>f.now,
  notificationOptions:{appUrl,fetchApi:async()=>{throw new Error('No live sends in tests');}}},gifts:{webhookSecret}});
 t.after(async()=>{server.emit('close');await rm(directory,{recursive:true,force:true});});
 async function request(url,body,headers={}){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);
  Object.assign(req,{url,method:'POST',headers:{'content-type':'application/json',...headers}});
  const result={};await server.listeners('request')[0](req,{setHeader(){},writeHead(code){result.code=code;},end(raw){result.body=JSON.parse(raw);}});return result;
 }
 const command=command=>request('/api/game',{command,location:'room'}, {authorization:'Bearer '+issueGameSession('123',botToken,f.now)});
 assert.equal((await command({kind:'notifications',enabled:true,granted:true})).body.notifications.granted,false);
 const update={message:{date:Math.floor(f.now/1000),from:{id:123},chat:{id:123,type:'private'},text:'/start'}};
 assert.equal((await request('/api/telegram/gifts-webhook',update)).code,403);
 assert.equal((await command({kind:'sync'})).body.notifications.granted,false);
 assert.equal((await request('/api/telegram/gifts-webhook',update,{'x-telegram-bot-api-secret-token':webhookSecret})).code,200);
 assert.equal((await command({kind:'sync'})).body.notifications.granted,true);
 await command({kind:'notifications',enabled:false});
 await request('/api/telegram/gifts-webhook',update,{'x-telegram-bot-api-secret-token':webhookSecret});
 assert.equal((await command({kind:'sync'})).body.notifications.enabled,false);
 const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:456,first_name:'Test',allows_write_to_pm:true})});
 params.sort();const key=createHmac('sha256','WebAppData').update(botToken).digest();
 params.set('hash',createHmac('sha256',key).update([...params].map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
 assert.equal((await request('/api/telegram/auth',{initData:params.toString()})).code,200);
 const status=await request('/api/game',{command:{kind:'sync'},location:'room'},{authorization:'Bearer '+issueGameSession('456',botToken,f.now)});
 assert.equal(status.body.notifications.granted,true);assert.equal(status.body.notifications.enabled,true);
});

test('play button accepts only Telegram Mini App launch URLs',()=>{
 assert.equal(notificationAppUrl(appUrl),appUrl);
 assert.equal(notificationAppUrl('https://t.me/test_bot?startapp'),'https://t.me/test_bot?startapp');
 for(const value of ['https://example.com','https://t.me/test_bot','http://t.me/test_bot/play','javascript:alert(1)'])assert.equal(notificationAppUrl(value),null);
});

test('ordinary limit expires after 24 hours and stale absence reminders are discarded on return',async t=>{
 const f=await setup(t);await f.save();await f.allow();await f.run();
 await f.save({food:20});f.elapse(61_000);await f.run();
 assert.equal(f.sent.length,2);
 await f.save({food:31});await f.save({food:20});f.elapse(61_000);await f.run();
 assert.equal(f.sent.length,2);
 f.elapse(day);
 // Keep this episode low without changing the notification metadata.
 await f.save({food:20},0);await f.run();
 assert.equal(f.sent.length,3);
 f.elapse(2*day);await f.store.notifications.observe('123',f.now);
 assert.ok(f.rows().some(row=>row.kind==='absence'&&row.status==='pending'));
 await f.save();await f.run();
 assert.equal(f.sent.some(message=>message.text===notificationTexts.absence),false);
 assert.equal(f.rows().find(row=>row.kind==='absence').status,'cancelled');
});

test('an in-flight ordinary event remains reserved across a server crash',async t=>{
 const f=await setup(t);await f.save();await f.allow();
 await f.store.notifications.observe('123',f.now);
 await f.store.notifications.acquire('crashed-worker',f.now);
 const claimed=await f.store.notifications.claim('crashed-worker',f.now);
 assert.equal(claimed.kind,'welcome');
 const restarted=await f.restart();f.elapse(31_000);await restarted.run();
 assert.equal(f.sent.length,0);
 assert.equal(f.rows()[0].status,'sending');
});
