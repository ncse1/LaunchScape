import http from 'node:http';
import {readFile} from 'node:fs/promises';
import handler from './api/campaign.mjs';
const publicFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
const server=http.createServer(async(req,res)=>{
 res.status=n=>{res.statusCode=n;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/campaign'){
  let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>12000)return res.status(413).json({error:'Campaign brief is too large.'});}
  req.body=text;return handler(req,res);
 }
 if(!publicFiles[pathname]||req.method!=='GET'){res.statusCode=404;return res.end('Not found');}
 try{res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL(publicFiles[pathname],import.meta.url)));}catch{res.statusCode=404;res.end('Not found');}
});
server.listen(process.env.PORT||3000,'127.0.0.1',()=>console.log('LaunchScape running on http://localhost:'+(process.env.PORT||3000)));
