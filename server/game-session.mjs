import {createHmac,timingSafeEqual} from 'node:crypto';

const sign=(body,secret)=>createHmac('sha256',secret).update('petrashka-game:'+body).digest('base64url');

export function issueGameSession(id,secret,now=Date.now()){
 const body=id+'.'+(now+12*3_600_000);
 return body+'.'+sign(body,secret);
}

export function gameSessionId(authorization,secret,now=Date.now()){
 if(!secret||typeof authorization!=='string')return null;
 const parts=/^Bearer ([1-9]\d{0,19})\.(\d{1,15})\.([\w-]{43})$/.exec(authorization);
 if(!parts)return null;
 const [,id,expires,signature]=parts;
 if(Number(expires)<=now)return null;
 return timingSafeEqual(Buffer.from(signature),Buffer.from(sign(id+'.'+expires,secret)))?id:null;
}
