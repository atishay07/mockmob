import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
const file='artifacts/question-factory/execution-2026-10-07/staging/bootstrap.sql';
createServer((req,res)=>{
 if(req.url==='/capture'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<title>Save staging screenshot</title><form method="post" action="/capture"><label>Screenshot name <select name="name"><option>admin-calibration</option><option>admin-published</option><option>student-retrieval</option></select></label><label>Screenshot data <textarea name="data"></textarea></label><button>Save screenshot</button></form>');return;}
 if(req.url==='/capture'&&req.method==='POST'){
  let body='';req.on('data',chunk=>{body+=chunk;if(body.length>8000000)req.destroy();});req.on('end',()=>{const form=new URLSearchParams(body),name=form.get('name');
   if(!['admin-calibration','admin-published','student-retrieval'].includes(name)){res.writeHead(400);res.end('Invalid screenshot name');return;}
   const bytes=Buffer.from(form.get('data')||'','base64');if(bytes[0]!==255||bytes[1]!==216){res.writeHead(400);res.end('JPEG screenshot required');return;}
   writeFileSync('artifacts/question-factory/execution-2026-10-07/staging/'+name+'.jpg',bytes);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<title>Screenshot saved</title><p>Saved staging/'+name+'.jpg</p>');
  });return;
 }
 if(['/signin-admin','/signin-student'].includes(req.url)){
  const identity=JSON.parse(readFileSync('.cache/factory-staging-auth.json','utf8'))[req.url.slice(8)];
  const target=new URL('http://localhost:3101/auth/callback');
  target.searchParams.set('token_hash',identity.token_hash);target.searchParams.set('type',identity.type);
  res.writeHead(302,{Location:target.href,'Cache-Control':'no-store'});res.end();return;
 }
 if(req.url!=='/bootstrap'){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
 const sql=readFileSync(file,'utf8').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 res.end('<title>MockMob empty staging migration</title><pre>'+sql+'</pre>');
}).listen(3490,'127.0.0.1',()=>console.log('Staging artifacts available at http://localhost:3490/bootstrap'));
