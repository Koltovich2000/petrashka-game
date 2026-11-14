import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyTelegramInitData} from './telegram-auth.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {
 '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
 '.webp':'image/webp', '.svg':'image/svg+xml', '.wav':'audio/wav', '.mp3':'audio/mpeg',
 '.woff2':'font/woff2', '.ico':'image/x-icon', '.json':'application/json',
};

function json(res, status, data) {
 res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}

export function createAppServer({botToken = process.env.TELEGRAM_BOT_TOKEN} = {}) {
 return createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  let path;
  try {
   path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  } catch {return json(res,400,{error:'invalid_path'});}

  if (path === '/healthz' && req.method === 'GET') return json(res,200,{ok:true});
  if (path === '/api/telegram/auth') {
   if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return json(res,405,{error:'method_not_allowed'});
   }
   if (req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res,415,{error:'expected_json'});
   if (!botToken) return json(res,503,{error:'telegram_auth_not_configured'});
   let size = 0;
   const chunks = [];
   try {
    for await (const chunk of req.iterator({destroyOnReturn:false})) {
     size += chunk.length;
     if (size > 16_384) {
      res.setHeader('Connection','close');
      return json(res,413,{error:'payload_too_large'});
     }
     chunks.push(chunk);
    }
    const {initData} = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const user = verifyTelegramInitData(initData,botToken);
    return user ? json(res,200,{user}) : json(res,401,{error:'invalid_or_expired_init_data'});
   } catch {
    return json(res,400,{error:'invalid_json'});
   }
  }

  if (path === '/api' || path.startsWith('/api/')) return json(res,404,{error:'not_found'});
  if (req.method !== 'GET' && req.method !== 'HEAD') {
   res.setHeader('Allow','GET, HEAD');
   return json(res,405,{error:'method_not_allowed'});
  }
  const file = resolve(dist, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(resolve(dist)+sep) || path.includes('\0') || path.includes('\\')) return json(res,404,{error:'not_found'});
  const info = await stat(file).catch(()=>null);
  if (!info?.isFile()) return json(res,404,{error:'not_found'});
  res.writeHead(200,{
   'Content-Type':types[extname(file)] ?? 'application/octet-stream',
   'Content-Length':info.size,
   'Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const port = Number(process.env.PORT || 3000);
 createAppServer().listen(port,'0.0.0.0',()=>console.log(`Petrashka listening on ${port}`));
}
