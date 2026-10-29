import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {validate,receipt,documentHtml} from './lib/intake.mjs';
import {checkPassword} from './lib/security.mjs';
import {Store} from './lib/store.mjs';
export function configuration(env=process.env){
  const port=Number(env.PORT||3000),origin=env.PUBLIC_ORIGIN||`http://localhost:${port}`;
  const hash=env.ADMIN_PASSWORD_HASH||'',key=env.DATA_ENCRYPTION_KEY||'',retention=Number(env.RETENTION_DAYS);
  const configured=/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(hash)&&/^[a-f0-9]{64}$/i.test(key)&&Number.isInteger(retention)&&retention>=1&&retention<=3650;
  const secure=env.COOKIE_SECURE!=='false';
  if(!secure&&!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))throw new Error('Production requires secure cookies and HTTPS.');
  if(secure&&new URL(origin).protocol!=='https:')throw new Error('PUBLIC_ORIGIN must use HTTPS.');
  return {port,origin,hash,key,retention,secure,configured,enabled:configured&&env.INTAKE_ENABLED==='true',dir:resolve(env.DATA_DIR||'data')};
}
export function createApp(config,{renderPdf}={}){
  const store=config.configured?new Store(config.dir,Buffer.from(config.key,'hex'),config.retention):null;
  const sessions=new Map(),rates=new Map();let browser,rendering=false,loggingIn=false;
  const files={'/':['index.html','text/html; charset=utf-8'],'/admin':['admin.html','text/html; charset=utf-8'],'/intake.mjs':['intake.mjs','text/javascript; charset=utf-8'],'/admin.mjs':['admin.mjs','text/javascript; charset=utf-8'],'/terms.mjs':['terms.mjs','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
  function limit(req,kind,max){const now=Date.now();for(const[k,v]of rates)if(v.until<now)rates.delete(k);const key=kind+req.socket.remoteAddress;let item=rates.get(key);if(!item){item={n:0,until:now+600000};rates.set(key,item);}return ++item.n>max;}
  function session(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sqm_session='))?.slice(12);if(!token)return null;const key=createHash('sha256').update(token).digest('hex');const s=sessions.get(key);if(!s||s.until<Date.now()){sessions.delete(key);return null;}return {...s,key};}
  function cookie(res,token,age){res.setHeader('Set-Cookie',`sqm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${config.secure?'; Secure':''}`);}
  async function body(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>24000)throw new Error('입력 내용이 너무 깁니다.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString());}
  async function pdf(record){if(renderPdf)return renderPdf(record);const {chromium}=await import('playwright');browser??=await chromium.launch({headless:true});const context=await browser.newContext({javaScriptEnabled:false});try{const page=await context.newPage();await page.route('**/*',r=>r.abort());await page.setContent(documentHtml(record.data,record.id,new Date(record.created)),{waitUntil:'load',timeout:15000});return await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,timeout:20000});}finally{await context.close();}}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(config.secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      const url=new URL(req.url,config.origin),path=url.pathname;
      if(req.method==='GET'&&files[path]){const[f,t]=files[path];const bytes=await readFile(fileURLToPath(new URL('./public/'+f,import.meta.url)));res.writeHead(200,{'Content-Type':t});return res.end(bytes);}
      if(req.method==='GET'&&path==='/api/status')return json(res,200,{ready:config.enabled,retentionDays:config.configured?config.retention:null});
      if(!store)return json(res,503,{error:'서버 설정을 준비 중입니다. 상담 담당자에게 문의해 주세요.'});
      if(['POST','PATCH','DELETE'].includes(req.method)&&(req.headers.origin!==config.origin||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')))return json(res,403,{error:'페이지를 새로고침한 뒤 다시 시도해 주세요.'});
      if(req.method==='POST'&&path==='/api/intake'){
        if(!config.enabled)return json(res,503,{error:'현재 온라인 접수를 받지 않습니다.'});
        if(limit(req,'intake',30))return json(res,429,{error:'요청이 많습니다. 10분 후 다시 시도해 주세요.'});
        const key=req.headers['idempotency-key'];if(typeof key!=='string'||!/^[a-f0-9-]{36}$/i.test(key))return json(res,400,{error:'접수 식별자가 잘못되었습니다.'});
        let data;try{data=validate(await body(req));}catch(e){return json(res,400,{error:e instanceof SyntaxError?'입력 형식을 확인해 주세요.':e.message});}
        data.onlineRetentionDays=config.retention;
        try{return json(res,201,{id:store.save(key,data,receipt())});}catch(e){if(e.message==='CONFLICT')return json(res,409,{error:'이미 저장된 신청과 내용이 다릅니다. 관리자에게 문의해 주세요.'});throw e;}
      }
      if(req.method==='POST'&&path==='/api/login'){
        if(limit(req,'login',8)||loggingIn)return json(res,429,{error:'로그인 시도가 많습니다. 10분 후 다시 시도해 주세요.'});
        loggingIn=true;try{const input=await body(req);if(!await checkPassword(input.password,config.hash))return json(res,401,{error:'비밀번호가 올바르지 않습니다.'});}finally{loggingIn=false;}
        const now=Date.now();for(const[k,v]of sessions)if(v.until<now)sessions.delete(k);if(sessions.size>1000)return json(res,503,{error:'잠시 후 다시 시도해 주세요.'});
        const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');sessions.set(createHash('sha256').update(token).digest('hex'),{csrf,until:now+1800000});cookie(res,token,1800);return json(res,200,{csrf});
      }
      if(path.startsWith('/api/admin')||path==='/api/logout'){
        const auth=session(req);if(!auth)return json(res,401,{error:'로그인이 필요합니다.'});
        if(req.method!=='GET'&&req.headers['x-csrf-token']!==auth.csrf)return json(res,403,{error:'로그인을 다시 해주세요.'});
        if(req.method==='GET'&&path==='/api/admin/session')return json(res,200,{csrf:auth.csrf});
        if(req.method==='POST'&&path==='/api/logout'){sessions.delete(auth.key);cookie(res,'',0);return json(res,200,{ok:true});}
        if(req.method==='GET'&&path==='/api/admin/requests'){const page=Math.max(0,Math.min(10000,Number.parseInt(url.searchParams.get('page')||'0')||0));return json(res,200,store.list(page));}
        const match=path.match(/^\/api\/admin\/requests\/(SQM-[A-F0-9-]{36})(\/pdf)?$/);
        if(match){const id=match[1],record=store.get(id);if(!record)return json(res,404,{error:'접수 내역이 없거나 보관기간이 지났습니다.'});
          if(req.method==='GET'&&match[2]){if(rendering)return json(res,503,{error:'다른 PDF를 생성 중입니다. 잠시 후 다시 시도해 주세요.'});rendering=true;try{const bytes=await pdf(record);res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${id}.pdf"`});return res.end(bytes);}finally{rendering=false;}}
          if(req.method==='GET')return json(res,200,record);
          if(req.method==='PATCH'&&!match[2]){const input=await body(req);if(!['new','reviewing','completed'].includes(input.status))return json(res,400,{error:'잘못된 상태입니다.'});store.status(id,input.status);return json(res,200,{ok:true});}
          if(req.method==='DELETE'&&!match[2]){store.delete(id);return json(res,200,{ok:true});}
        }
      }
      return json(res,404,{error:'페이지를 찾을 수 없습니다.'});
    }catch(e){return json(res,e instanceof SyntaxError?400:500,{error:e instanceof SyntaxError?'입력 형식을 확인해 주세요.':'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'});}
  });
  server.requestTimeout=30000;server.headersTimeout=15000;
  store?.purge();const timer=setInterval(()=>store?.purge(),3600000);timer.unref();
  return {server,store,close:async()=>{clearInterval(timer);await new Promise(r=>server.close(r));await browser?.close();store?.close();}};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){const config=configuration();const app=createApp(config);app.server.listen(config.port,()=>console.log(`Repair intake listening on ${config.port}; enabled=${Boolean(config.enabled)}`));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await app.close();process.exit(0);});}
