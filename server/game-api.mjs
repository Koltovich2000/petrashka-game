import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {advance,beginIntro,parseSave} from '../src/game.ts';
import {isLocation} from '../src/activities.ts';
import {runGameCommand} from '../src/gameCommands.ts';
import {gameSessionId} from './game-session.mjs';
import {openGameStore} from './game-store.mjs';
import {adminLabels} from '../src/adminTypes.ts';
import {playerLevel} from '../src/economy.ts';

function history(before,after,at){
 const h=after.hospital,prev=before.hospital;
 if(!h)return prev?[{key:`${prev.startedAt}:discharge`,type:'discharge',at,debt:prev.debt}]:[];
 const events=[];
 if(!prev)events.push({key:`${h.startedAt}:admit`,type:'admit',at:h.startedAt});
 if(h.billedHours>(prev?.billedHours??0))events.push({key:`${h.startedAt}:bill:${h.billedHours}`,type:'bill',at,
  hours:h.billedHours-(prev?.billedHours??0),cost:h.cost-(prev?.cost??0),paid:h.balanceSpent-(prev?.balanceSpent??0),debt:h.debt});
 for(let i=prev?.sales.length??0;i<h.sales.length;i++)events.push({key:`${h.startedAt}:sale:${i}`,type:'sale',at,asset:h.sales[i]});
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

export function createGameApi({botToken,admins,databasePath=process.env.GAME_DB_PATH||resolve('data/game.sqlite'),
 databaseUrl=process.env.GAME_DATABASE_URL||process.env.GIFTS_DATABASE_URL,clock=Date.now}){
 let database;
 let loggedFirstSave=false;
 const getStore=()=>database??=openGameStore(databasePath,databaseUrl).catch(error=>{database=undefined;throw error;});
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return {
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
  },
  async players(search,page){
   const now=clock();
   const result=await (await getStore()).players(search,page,now-86_400_000);
   return {...result,players:result.players.map(row=>summarize(row,readState(row.state,now)))};
  },
  async player(id){
   const row=await (await getStore()).player(id);
   const now=clock();
   return row?describe(row,advance(readState(row.state,now),now,true)):null;
  },
  async journal(page){return (await getStore()).journal(page);},
  async editPlayer(id,adminId,operationId,request){
   const at=clock();
   const store=await getStore();
   const state=await store.change(id,raw=>{
    const previous=readState(raw,at);
    const settled=advance(previous,at,true);
    const next={...settled,economy:{...settled.economy}};
    if(request.kind==='credit'){
     const balance=next.economy.balance+request.amount;
     if(!Number.isSafeInteger(balance))throw conflict('balance_limit');
     next.economy.balance=balance;
    }else{
     for(const [field,value] of Object.entries(request.values)){
      if(isEconomy(field))next.economy[field]=value;
      else if(!next.introCompleted||(field==='health'&&next.hospital))throw conflict('player_state_changed');
      else next[field]=value;
     }
    }
    const state=advance(next,at,true);
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
    const at=clock();
    const store=await getStore();
    const action=body.command.kind==='admin'?{id:randomUUID(),adminId:id,at,request:'legacy-edit'}:undefined;
    const state=await store.change(id,raw=>{
     const previous=readState(raw,at);
     const settled=advance(previous,at,true);
     const state=runGameCommand(settled,body.command,at,body.location,admin);
     const events=[...history(previous,settled,at),...history(settled,state,at)];
     return {state,events,details:action?{kind:'edit',changes:changes(fieldsOf(settled),fieldsOf(state))}:undefined};
    },{activeAt:at,action});
    if(!loggedFirstSave){
     loggedFirstSave=true;
     console.info('Game progress saved: first successful player write since startup');
    }
    return json(res,200,{state});
   }catch(error){console.error('Game state transaction failed',error);return json(res,503,{error:'game_state_unavailable'});}
  },
  close(){return database?.then(store=>store.close()).catch(()=>{});},
 };
}
