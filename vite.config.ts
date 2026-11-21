import {defineConfig} from 'vite';
import {createGiftsApi} from './server/gifts-api.mjs';

// The Mini App and its same-origin API are served at the domain root.
export default defineConfig({
 base: '/',
 build: {outDir:'dist', target:'es2022'},
 plugins:[{
  name:'local-gifts-api',
  configureServer(server) {
   const gifts = createGiftsApi({botToken:'',webhookSecret:'',databaseUrl:'',databasePath:'data/gifts.sqlite'});
   server.middlewares.use((req,res,next) => {
    if (!req.url?.startsWith('/api/gifts')) return next();
    const url = new URL(req.url,'http://localhost');
    if (!gifts.handle(req,res,url.pathname,url.searchParams)) next();
   });
   server.httpServer?.once('close',() => gifts.close());
  },
 }],
});
