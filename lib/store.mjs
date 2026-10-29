import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {encrypt,decrypt} from './security.mjs';
export class Store {
  constructor(dir,key,retention){
    mkdirSync(dir,{recursive:true,mode:0o700});this.key=key;this.retention=retention;
    this.db=new DatabaseSync(join(dir,'intake.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, digest TEXT NOT NULL, created INTEGER NOT NULL, status TEXT NOT NULL, payload BLOB NOT NULL)');
  }
  purge(){this.db.prepare('DELETE FROM requests WHERE created < ?').run(Date.now()-this.retention*86400000);}
  save(key,data,id){
    this.purge();const digest=createHmac('sha256',this.key).update(JSON.stringify(data)).digest('hex');
    const prior=this.db.prepare('SELECT id,digest FROM requests WHERE request_key=?').get(key);
    if(prior){if(prior.digest!==digest)throw new Error('CONFLICT');return prior.id;}
    this.db.prepare('INSERT INTO requests VALUES (?,?,?,?,?,?)').run(id,key,digest,Date.now(),'new',encrypt(data,this.key));return id;
  }
  list(page=0){this.purge();return {total:this.db.prepare('SELECT count(*) AS n FROM requests').get().n,items:this.db.prepare('SELECT * FROM requests ORDER BY created DESC LIMIT 30 OFFSET ?').all(page*30).map(r=>{const d=decrypt(r.payload,this.key);return {id:r.id,created:r.created,status:r.status,name:d.name,phone:d.phone,model:d.model};})};}
  get(id){this.purge();const r=this.db.prepare('SELECT * FROM requests WHERE id=?').get(id);return r?{id:r.id,created:r.created,status:r.status,data:decrypt(r.payload,this.key)}:null;}
  status(id,value){return this.db.prepare('UPDATE requests SET status=? WHERE id=?').run(value,id).changes>0;}
  delete(id){return this.db.prepare('DELETE FROM requests WHERE id=?').run(id).changes>0;}
  close(){this.db.close();}
}
