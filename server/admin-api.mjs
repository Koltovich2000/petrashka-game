import {adminLabels} from '../src/adminTypes.ts';
import {parseGiftWish} from '../src/giftWish.ts';
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
  const maximum=field==='balance'||field==='xp'?Number.MAX_SAFE_INTEGER:100;
  return !Object.hasOwn(adminLabels,field)||!Number.isSafeInteger(value)||value<0||value>maximum;
 }))return null;
 return {kind:'edit',values:Object.fromEntries(fields.map(field=>[field,body.values[field]]))};
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
   }
   if(req.method==='POST'&&(player||path==='/api/admin/gifts')){
    const body=await readCommand(req);
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
