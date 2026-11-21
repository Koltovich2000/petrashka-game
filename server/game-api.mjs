import {resolve} from 'node:path';
import {advance,beginIntro,parseSave} from '../src/game.ts';
import {isLocation} from '../src/activities.ts';
import {runGameCommand} from '../src/gameCommands.ts';
import {gameSessionId} from './game-session.mjs';
import {openGameStore} from './game-store.mjs';

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

export function createGameApi({botToken,admins,databasePath=process.env.GAME_DB_PATH||resolve('data/game.sqlite'),
 databaseUrl=process.env.GAME_DATABASE_URL||process.env.GIFTS_DATABASE_URL,clock=Date.now}){
 let database;
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return {
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
    database??=openGameStore(databasePath,databaseUrl).catch(error=>{database=undefined;throw error;});
    const store=await database;
    const state=await store.change(id,raw=>{
     const at=clock();
     const loaded=raw?JSON.parse(raw):null;
     const previous=loaded
      ?loaded.version===4?loaded:parseSave(raw,at)
      :beginIntro(at);
     const settled=advance(previous,at,true);
     const state=runGameCommand(settled,body.command,at,body.location,admin);
     const events=[...history(previous,settled,at),...history(settled,state,at)];
     return {state,events};
    });
    return json(res,200,{state});
   }catch(error){console.error('Game state transaction failed',error);return json(res,503,{error:'game_state_unavailable'});}
  },
  close(){void database?.then(store=>store.close()).catch(()=>{});},
 };
}
