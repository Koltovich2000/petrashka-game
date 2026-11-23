import {adminLabels,statKeys} from '../src/adminTypes.ts';
import {parseGiftWish} from '../src/giftWish.ts';
import {pollLimits} from '../src/world.ts';
import {gameSessionId} from './game-session.mjs';

const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const operationId=new RegExp(`^${uuid}$`,'i');
const giftId=new RegExp(`^gift:${uuid}$`,'i');

function reply(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}

async function readCommand(req){
 if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Object.assign(new Error('Expected JSON'),{status:415,code:'expected_json'});
 const chunks=[];
 let bytes=0;
 for await(const chunk of req.iterator({destroyOnReturn:false})){
  bytes+=chunk.length;
  if(bytes>8192){
   req.resume();
   throw Object.assign(new Error('Request too large'),{status:413,code:'payload_too_large'});
  }
  chunks.push(chunk);
 }
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch{throw Object.assign(new Error('Invalid JSON'),{status:400,code:'invalid_json'});}
}

function playerCommand(body){
 if(typeof body?.operationId!=='string'||!operationId.test(body.operationId))return null;
 if(body.kind==='credit'&&Number.isSafeInteger(body.amount)&&body.amount>0)return {kind:'credit',amount:body.amount};
 if(body.kind!=='edit'||!body.values||typeof body.values!=='object'||Array.isArray(body.values))return null;
 const fields=Object.keys(body.values).sort();
 if(!fields.length||fields.some(field=>{
  const value=body.values[field];
  return !Object.hasOwn(adminLabels,field)||!Number.isSafeInteger(value)||value<0;
 }))return null;
 return {kind:'edit',values:Object.fromEntries(fields.map(field=>[field,body.values[field]]))};
}

function worldCommand(body){
 if(body?.kind==='pause'&&typeof body.paused==='boolean')return {kind:'pause',paused:body.paused};
 if(body?.kind==='removePoll'&&typeof body.id==='string'&&operationId.test(body.id))return {kind:'removePoll',id:body.id};
 if(body?.kind!=='poll'||typeof body.id!=='string'||!operationId.test(body.id)||
  typeof body.question!=='string'||!Array.isArray(body.options)||body.options.length<2||
  body.options.length>pollLimits.options||!Number.isSafeInteger(body.minutes)||
  body.minutes<1||body.minutes>pollLimits.maxMinutes)return null;
 const question=body.question.trim();
 const options=body.options.map(value=>typeof value==='string'?value.trim():'');
 if(!question||question.length>pollLimits.question||options.some(option=>!option||option.length>pollLimits.option)||
  new Set(options.map(option=>option.toLowerCase())).size!==options.length)return null;
 return {kind:'poll',id:body.id,question,options,duration:body.minutes*60_000};
}

function giftCommand(body){
 if(typeof body?.giftId!=='string'||!giftId.test(body.giftId))return null;
 if(body.kind==='remove'||body.kind==='reset')return {kind:body.kind};
 if(body.kind==='move'&&Number.isSafeInteger(body.position)&&body.position>0)return {kind:'move',position:body.position};
 if(body.kind!=='edit'||(body.anonymous===undefined&&body.wish===undefined))return null;
 if(body.anonymous!==undefined&&typeof body.anonymous!=='boolean')return null;
 const wish=body.wish===undefined?undefined:parseGiftWish(body.wish);
 return wish===null?null:{kind:'edit',anonymous:body.anonymous,wish};
}

export function createAdminApi({botToken,admins,game,gifts}){
 return async function handle(req,res,path,params){
  const adminId=gameSessionId(req.headers.authorization,botToken);
  if(!adminId)return reply(res,401,{error:'expired_session'});
  if(!admins.has(adminId))return reply(res,403,{error:'admin_required'});
  const requested=Number(params.get('page'));
  const page=Number.isSafeInteger(requested)&&requested>0?requested:1;
  const player=/^\/api\/admin\/players\/([1-9]\d{0,19})$/.exec(path)?.[1];

  try{
   if(req.method==='GET'){
    if(path==='/api/admin/players'){
     const search=(params.get('q')??'').trim();
     if(search.length>80||search.includes('\0'))return reply(res,400,{error:'invalid_search'});
     return reply(res,200,await game.players(search,page));
    }
    if(player){
     const found=await game.player(player);
     return found?reply(res,200,{player:found}):reply(res,404,{error:'player_not_found'});
    }
    if(path==='/api/admin/journal')return reply(res,200,await game.journal(page));
    if(path==='/api/admin/gifts')return reply(res,200,await gifts.adminPage(page));
    if(path==='/api/admin/world')return reply(res,200,await game.world(adminId));
   }
   if(req.method==='POST'&&(player||path==='/api/admin/players/adjust'||path==='/api/admin/gifts'||path==='/api/admin/world')){
    const body=await readCommand(req);
    if(path==='/api/admin/world'){
     const command=worldCommand(body);
     if(!command)return reply(res,400,{error:'invalid_world_command'});
     return reply(res,200,await game.changeWorld(adminId,command));
    }
    if(path==='/api/admin/players/adjust'){
     if(typeof body?.operationId!=='string'||!operationId.test(body.operationId)||
      !Number.isSafeInteger(body.delta)||body.delta===0||!Array.isArray(body.fields)||!body.fields.length||
      body.fields.length>statKeys.length||body.fields.some(field=>!statKeys.includes(field))||
      new Set(body.fields).size!==body.fields.length)return reply(res,400,{error:'invalid_admin_command'});
     return reply(res,200,await game.adjustPlayers(adminId,body.operationId,{delta:body.delta,fields:statKeys.filter(field=>body.fields.includes(field))}));
    }
    if(player){
     const command=playerCommand(body);
     if(!command)return reply(res,400,{error:'invalid_admin_command'});
     const updated=await game.editPlayer(player,adminId,body.operationId,command);
     return updated?reply(res,200,{player:updated}):reply(res,404,{error:'player_not_found'});
    }
    const command=giftCommand(body);
    if(!command)return reply(res,400,{error:'invalid_gift_command'});
    return await gifts.moderate(body.giftId,command)?reply(res,200,{ok:true}):reply(res,404,{error:'gift_not_found'});
   }
   return reply(res,404,{error:'not_found'});
  }catch(error){
   if(!error.status)console.error('Admin request failed',error.code??error.name);
   return reply(res,error.status??503,{error:error.status?error.code:'admin_service_unavailable'});
  }
 };
}
