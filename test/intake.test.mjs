import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {validate,VERSION,terms,documentHtml} from '../lib/intake.mjs';
import {hashPassword,checkPassword,encrypt,decrypt} from '../lib/security.mjs';
import {Store} from '../lib/store.mjs';
import {createApp,configuration} from '../server.mjs';
const valid=()=>({name:'테스트고객',phone:'010-1234-5678',emergency:'',email:'',postcode:'12345',address:'가상시 가상로 123',model:'테스트 제품',serial:'TEST123',symptoms:'전원이 켜지지 않음',signer:'테스트고객',confirm:true,storageConsent:true,version:VERSION,consents:Object.fromEntries(terms.map(t=>[t.id,true]))});
test('required consent, signature, lengths and version are enforced by the server',()=>{
  assert.equal(validate(valid()).name,'테스트고객');
  for(const patch of [{signer:'다른 이름'},{storageConsent:false},{confirm:false},{consents:{}},{version:'old'},{symptoms:'x'.repeat(3001)},{name:''},{email:'bad-email'},{phone:'<script>'}])assert.throws(()=>validate({...valid(),...patch}));
});
test('PDF HTML escapes customer values and includes stored consent and signature',()=>{const data=validate(valid());data.symptoms='<script>alert(1)</script>';data.termsSnapshot[0].title='저장 당시 동의 제목';data.onlineRetentionDays=45;const html=documentHtml(data,'SQM-TEST');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('성명 입력 서명'));assert.ok(html.includes('저장 당시 동의 제목'));assert.ok(html.includes('45일'));for(const t of terms.slice(1))assert.ok(html.includes(t.title));});
test('password verification and authenticated encryption reject wrong credentials or tampering',async()=>{const hash=await hashPassword('a secure test password');assert.ok(await checkPassword('a secure test password',hash));assert.equal(await checkPassword('wrong',hash),false);const key=randomBytes(32),encrypted=encrypt(valid(),key);assert.equal(decrypt(encrypted,key).name,'테스트고객');encrypted[30]^=1;assert.throws(()=>decrypt(encrypted,key));});
test('database persists encrypted submissions and idempotency across restarts, purges expired requests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sqm-store-')),key=randomBytes(32);let store;
 try{store=new Store(dir,key,90);const data=validate(valid());store.save('key',data,'receipt');store.close();store=new Store(dir,key,90);assert.equal(store.get('receipt').data.name,data.name);assert.equal(store.save('key',data,'different'),'receipt');assert.throws(()=>store.save('key',{...data,name:'다른 사람'},'different'));store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');const bytes=await readFile(join(dir,'intake.sqlite'));assert.equal(bytes.includes(Buffer.from(data.name)),false);store.db.prepare('UPDATE requests SET created=?').run(Date.now()-91*86400000);store.purge();assert.equal(store.get('receipt'),null);}finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
test('production configuration refuses insecure cookies and fails closed without credentials',()=>{assert.throws(()=>configuration({PUBLIC_ORIGIN:'https://example.com',COOKIE_SECURE:'false'}));assert.equal(configuration({PUBLIC_ORIGIN:'https://example.com'}).enabled,false);});
test('HTTP workflow protects all records and PDFs, stores once, handles CSRF, status, deletion and logout',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sqm-http-'));
 const config={configured:true,enabled:true,secure:false,origin:'http://localhost',hash:await hashPassword('test-password'),key:randomBytes(32).toString('hex'),retention:90,dir};
 let renders=0;const app=createApp(config,{renderPdf:async()=>{renders++;return Buffer.from('%PDF-test');}});
 // Exercise the real HTTP request handler without a network socket (restricted CI).
 const request=(path,method='GET',data,extra={})=>new Promise((done,reject)=>{
   const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);
   Object.assign(req,{url:path,method,headers:{origin:config.origin,'content-type':'application/json',...extra},socket:{remoteAddress:'127.0.0.1'}});
   const headers=new Map();const res={status:200,setHeader(k,v){headers.set(k.toLowerCase(),v);},writeHead(status,h){this.status=status;for(const[k,v]of Object.entries(h||{}))this.setHeader(k,v);},end(content){done({status:this.status,headers:{get:k=>headers.get(k.toLowerCase())},json:async()=>JSON.parse(String(content))});}};
   Promise.resolve(app.server.listeners('request')[0](req,res)).catch(reject);
 });
 try{
  for(const path of ['/api/admin/requests','/api/admin/requests/SQM-00000000-0000-0000-0000-000000000000/pdf'])assert.equal((await request(path)).status,401);
  assert.equal(renders,0);
  assert.equal((await request('/api/intake','POST',valid(),{origin:'https://evil.test','idempotency-key':randomUUID()})).status,403);
  const key=randomUUID();const response=await request('/api/intake','POST',valid(),{'idempotency-key':key});assert.equal(response.status,201);const {id}=await response.json();
  assert.equal((await(await request('/api/intake','POST',valid(),{'idempotency-key':key})).json()).id,id);
  assert.equal((await request('/api/login','POST',{password:'wrong'})).status,401);
  const login=await request('/api/login','POST',{password:'test-password'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);const {csrf}=await login.json();const auth={cookie,'x-csrf-token':csrf};
  const list=await(await request('/api/admin/requests','GET',undefined,auth)).json();assert.equal(list.total,1);assert.equal(list.items[0].name,'테스트고객');
  const detail=await(await request(`/api/admin/requests/${id}`,'GET',undefined,auth)).json();assert.equal(detail.data.termsSnapshot.length,5);
  const pdf=await request(`/api/admin/requests/${id}/pdf`,'GET',undefined,auth);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(renders,1);
  assert.equal((await request(`/api/admin/requests/${id}`,'PATCH',{status:'completed'},{cookie})).status,403);
  assert.equal((await request(`/api/admin/requests/${id}`,'PATCH',{status:'completed'},auth)).status,200);
  assert.equal((await request(`/api/admin/requests/${id}`,'DELETE',{},auth)).status,200);
  assert.equal((await request(`/api/admin/requests/${id}`,'GET',undefined,auth)).status,404);
  assert.equal((await request('/api/logout','POST',{},auth)).status,200);
  assert.equal((await request('/api/admin/requests','GET',undefined,auth)).status,401);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
