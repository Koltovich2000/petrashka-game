import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {advance,beginIntro,parseSave,setAdminStat} from '../src/game.ts';
import {isLocation} from '../src/activities.ts';
import {runGameCommand,settleGame} from '../src/gameCommands.ts';
import {gameSessionId} from './game-session.mjs';
import {openGameStore} from './game-store.mjs';
import {adminLabels} from '../src/adminTypes.ts';
import {playerLevel} from '../src/economy.ts';
import {gameTime} from '../src/world.ts';
import {characterNameKey,parseCharacterName} from '../src/characterName.ts';
import {hospitalQuote} from '../src/hospital.ts';
import {hospitalCheckoutActive,hospitalPayments} from './hospital-payments.mjs';
import {hospitalAdsConfig,hospitalAdsStatus,startHospitalAd,cancelHospitalAd,matchesRewardSecret,recordHospitalAd} from './hospital-ads.mjs';
import {createNotifications} from './notifications.mjs';

function history(before,after,at,method='rubles'){
 const h=after.hospital,prev=before.hospital;
 if(!h){
  if(!prev)return [];
  const quote=method==='rubles'?hospitalQuote(before,prev):null;
  const sales=quote?.sales.map((asset,i)=>({key:`${prev.startedAt}:sale:${prev.sales.length+i}`,type:'sale',at,asset}))??[];
  return [...sales,{key:`${prev.startedAt}:discharge`,type:'discharge',at,method,cash:quote?.cash??0,writtenOff:quote?.writtenOff??0}];
 }
 const events=[];
 if(!prev)events.push({key:`${h.startedAt}:admit`,type:'admit',at:h.startedAt});
 if(h.billedHours>(prev?.billedHours??0))events.push({key:`${h.startedAt}:bill:${h.billedHours}`,type:'bill',at,
  hours:h.billedHours-(prev?.billedHours??0),cost:h.cost-(prev?.cost??0)});
 return events;
}

const fields=Object.keys(adminLabels);
const isEconomy=field=>field==='balance'||field==='xp';
const fieldsOf=state=>Object.fromEntries(fields.map(field=>[field,isEconomy(field)?state.economy[field]:state[field]]));
const changes=(before,after)=>Object.fromEntries(fields.flatMap(field=>before[field]===after[field]?[]:
 [[field,{before:before[field],after:after[field]}]]));
const readState=(raw,at)=>{
 const loaded=raw?JSON.parse(raw):null;
 return loaded?loaded.version===4?loaded:parseSave(raw,at):beginIntro(at);
};
const summarize=(row,state)=>({id:row.id,name:row.display_name,lastSeen:Number(row.last_seen_at),
 level:playerLevel(state.economy.xp),balance:state.economy.balance});
const describe=(row,state)=>({...summarize(row,state),values:fieldsOf(state),introCompleted:state.introCompleted,hospitalized:Boolean(state.hospital)});
function conflict(code){return Object.assign(new Error(code),{status:409,code});}

export function createGameApi({botToken,admins,databasePath=process.env.GAME_DB_PATH?.trim()||resolve('data/game.sqlite'),
 databaseUrl=process.env.GAME_DATABASE_URL||process.env.GIFTS_DATABASE_URL,clock=Date.now,
 hospitalAdBlockId=process.env.HOSPITAL_ADSUN_BLOCK_ID?.trim(),
 hospitalAdRewardSecret=process.env.HOSPITAL_ADSUN_REWARD_SECRET?.trim(),notificationOptions={}}){
 let database;
 let loggedFirstSave=false;
 const ads=hospitalAdsConfig(hospitalAdBlockId,hospitalAdRewardSecret);
 const getStore=()=>database??=openGameStore(databasePath,databaseUrl).catch(error=>{database=undefined;throw error;});
 const notifications=createNotifications({getStore,botToken,clock,...notificationOptions});
 async function changeHospitalState(id,apply,method='stars'){
  const store=await getStore();
  const {now:at,pauses}=await store.world.snapshot(clock);
  const gameAt=gameTime(at,pauses);
  let value;
  await store.change(id,raw=>{
   const previous=readState(raw,gameAt);
   const settled=settleGame(previous,gameAt,pauses,at);
   const change=apply(settled,at);
   value=change.value;
   return {state:change.state,events:[...history(previous,settled,at),...history(settled,change.state,at,method)]};
  },{existingOnly:method==='ads'});
  return value;
 }
 const worldState=snapshot=>({
  now:snapshot.now,paused:snapshot.pauses.at(-1)?.end===null,
  poll:snapshot.poll,
 });
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return {
  notifications,
  hospitalPayments:hospitalPayments(changeHospitalState),
  async hospitalAdReward(req,res,params){
   if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{error:'method_not_allowed'});}
   if(!botToken||!ads)return json(res,503,{error:'ads_unavailable'});
   if(!matchesRewardSecret(ads,params.get('key'))||params.get('block')!==ads.blockId)return json(res,403,{error:'forbidden'});
   const id=params.get('userid')??'';
   const timestamp=Number(params.get('timestamp'));
   if(!/^[1-9]\d{0,15}$/.test(id)||!Number.isSafeInteger(timestamp)||timestamp<=0)return json(res,400,{error:'invalid_reward'});
   try{
    await changeHospitalState(id,(state,at)=>({
     state:hospitalCheckoutActive(state,at)?state:recordHospitalAd(state,at,timestamp),
    }),'ads');
    return json(res,200,{ok:true});
   }catch(error){
    console.error('Hospital ad reward transaction failed',error.code??error.name);
    return json(res,503,{error:'game_state_unavailable'});
   }
  },
  async world(adminId){
   const store=await getStore();
   return worldState(await store.world.snapshot(clock,adminId,true));
  },
  async changeWorld(adminId,command){
   const store=await getStore();
   if(command.kind==='pause')await store.world.setPause(command.paused,clock);
   else if(command.kind==='removePoll')await store.world.removePoll(command.id,clock);
   else if(command.kind==='manualVotes'){
    if(!await store.world.setManualVotes(command.id,command.counts,adminId,clock))throw conflict('poll_closed');
   }
   else if(!await store.world.createPoll(command,clock))throw conflict('poll_already_running');
   return worldState(await store.world.snapshot(clock,adminId,true));
  },
  async logStorage(){
   const source=databaseUrl?'PostgreSQL':`SQLite ${resolve(databasePath)}`;
   try{
    const store=await getStore();
    console.info(`Game storage: ${source}; saved players: ${await store.savedPlayerCount()}`);
   }catch(error){
    console.error(`Game storage unavailable: ${source}`,error.code??error.name);
   }
  },
  async rememberProfile(profile){
   await (await getStore()).rememberProfile(profile.id,profile.displayName,clock());
   if(profile.allowsWrite)await notifications.grant(profile.id,true,profile.authDate*1000);
  },
  async players(search,page){
   const now=clock();
   const result=await (await getStore()).players(search,page,now-86_400_000);
   return {...result,players:result.players.map(row=>summarize(row,readState(row.state,now)))};
  },
  async player(id){
   const store=await getStore();
   const {now,pauses}=await store.world.snapshot(clock);
   const gameAt=gameTime(now,pauses);
   const row=await store.player(id);
   return row?describe(row,settleGame(readState(row.state,gameAt),gameAt,pauses,now)):null;
  },
  async journal(page){return (await getStore()).journal(page);},
  async adjustPlayers(adminId,id,request){
   const store=await getStore();
   const {now:at,pauses}=await store.world.snapshot(clock);
   const gameAt=gameTime(at,pauses);
   const action={adminId,id,at,request:JSON.stringify(request)};
   return store.changeAll(action,raw=>{
    const previous=readState(raw,gameAt);
    const settled=settleGame(previous,gameAt,pauses,at);
    const next={...settled};
    for(const field of request.fields){
     if(field==='health'&&next.hospital)continue;
     const value=Math.max(0,next[field]+request.delta);
     if(value>Number.MAX_SAFE_INTEGER)throw conflict('stat_limit');
     if(value!==next[field])setAdminStat(next,field,value);
    }
    const state=advance(next,gameAt,true);
    return {state,changed:request.fields.some(field=>settled[field]!==state[field]),
     events:[...history(previous,settled,at),...history(settled,state,at)]};
   });
  },
  async editPlayer(id,adminId,operationId,request){
   const store=await getStore();
   const {now:at,pauses}=await store.world.snapshot(clock);
   const gameAt=gameTime(at,pauses);
   const state=await store.change(id,raw=>{
    const previous=readState(raw,gameAt);
    const settled=settleGame(previous,gameAt,pauses,at);
    const next={...settled,economy:{...settled.economy}};
    if(request.kind==='credit'){
     const balance=next.economy.balance+request.amount;
     if(!Number.isSafeInteger(balance))throw conflict('balance_limit');
     next.economy.balance=balance;
    }else{
     for(const [field,value] of Object.entries(request.values)){
      if(isEconomy(field))next.economy[field]=value;
      else if(field==='health'&&next.hospital)throw conflict('player_state_changed');
      else setAdminStat(next,field,value);
     }
    }
    const state=advance(next,gameAt,true);
    return {state,events:[...history(previous,settled,at),...history(settled,state,at)],details:{
     kind:request.kind,amount:request.amount,changes:changes(fieldsOf(settled),fieldsOf(state)),
    }};
   },{action:{id:operationId,adminId,at,request:JSON.stringify(request)}});
   const row=state&&await store.player(id);
   return row?describe(row,state):null;
  },
  async handle(req,res){
   if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'method_not_allowed'});}
   if(!botToken)return json(res,503,{error:'game_server_not_configured'});
   const id=gameSessionId(req.headers.authorization,botToken,clock());
   if(!id)return json(res,401,{error:'expired_session'});
   if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'expected_json'});
   let body;
   try{
    const chunks=[];
    let bytes=0;
    for await(const chunk of req.iterator({destroyOnReturn:false})){
     bytes+=chunk.length;
     if(bytes>65_536){res.setHeader('Connection','close');return json(res,413,{error:'payload_too_large'});}
     chunks.push(chunk);
    }
    body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   }catch{return json(res,400,{error:'invalid_json'});}
   if(!body?.command||typeof body.command.kind!=='string'||!isLocation(body.location))return json(res,400,{error:'invalid_command'});
   const admin=admins.has(id);
   if(body.command.kind==='admin'&&!admin)return json(res,403,{error:'admin_required'});
   try{
    const store=await getStore();
    const command=body.command;
    if(command.kind==='notifications'){
     if(typeof command.enabled!=='boolean')return json(res,400,{error:'invalid_notification_preference'});
     await notifications.preference(id,command.enabled);
    }
    if(command.kind==='vote'){
     if(typeof command.pollId!=='string'||command.pollId.length!==36||!Number.isInteger(command.choice)||command.choice<0||command.choice>5){
      return json(res,400,{error:'invalid_vote'});
     }
     if(!await store.world.vote(id,command.pollId,command.choice,clock))return json(res,409,{error:'poll_closed'});
    }
    const snapshot=await store.world.snapshot(clock,id);
    const {now:at,pauses}=snapshot;
    const gameAt=gameTime(at,pauses);
    const paused=pauses.at(-1)?.end===null;
    const action=command.kind==='admin'&&!paused?{id:randomUUID(),adminId:id,at,request:'legacy-edit'}:undefined;
    let needsCharacterName=false;
    let hospitalAdAttempt;
    const state=await store.change(id,(raw,registeredName)=>{
     const previous=readState(raw,gameAt);
     const settled=settleGame(previous,gameAt,pauses,at);
     const paymentPending=hospitalCheckoutActive(settled,at);
     const blocked=paused&&command.kind!=='dailyClaim'||command.kind==='discharge'&&paymentPending;
     let state=settled;
     if(command.kind==='hospitalAdCancel')state=cancelHospitalAd(settled,command.attempt);
     else if(command.kind==='hospitalAdStart'){
      if(ads&&!paused&&!paymentPending){
       const started=startHospitalAd(settled,command.startedAt,at);
       state=started.state;
       hospitalAdAttempt=started.attempt;
      }
     }else if(!blocked&&command.kind!=='vote')state=runGameCommand(settled,command,gameAt,body.location,admin,at,pauses);
     if(settled.hospital&&!state.hospital)delete state.hospitalAdProgress;
     let nameKey;
     if(command.kind==='intro'&&!registeredName){
      const name=parseCharacterName(settled.introCompleted?command.characterName:state.characterName);
      if(name&&state.introCompleted){
       if(settled.introCompleted)state={...state,characterName:name};
       nameKey=characterNameKey(name);
      }
     }
     needsCharacterName=state.introCompleted&&!registeredName&&!nameKey;
     const events=[...history(previous,settled,at),...history(settled,state,at)];
     return {state,events,nameKey,details:action?{kind:'edit',changes:changes(fieldsOf(settled),fieldsOf(state))}:undefined};
    },{activeAt:at,action});
    if(!loggedFirstSave){
     loggedFirstSave=true;
     console.info('Game progress saved: first successful player write since startup');
    }
    await notifications.observe(id);
    const notificationStatus=await notifications.status(id);
    const {hospitalInvoice:_invoice,hospitalReceipts:_receipts,hospitalAdProgress:_adProgress,lastHospitalAdReward:_adReward,...publicState}=state;
    return json(res,200,{state:publicState,needsCharacterName,world:worldState(snapshot),
     notifications:notificationStatus,hospitalPaymentPending:hospitalCheckoutActive(state,at),hospitalAds:hospitalAdsStatus(state,ads,at),hospitalAdAttempt});
   }catch(error){
    if(error.code==='character_name_taken')return json(res,409,{error:error.code});
    console.error('Game state transaction failed',error);
    return json(res,503,{error:'game_state_unavailable'});
   }
  },
  async close(){await notifications.stop();await database?.then(store=>store.close()).catch(()=>{});},
 };
}
