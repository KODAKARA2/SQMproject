import {randomBytes,scrypt as scryptCb,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCb);
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await scrypt(password,salt,64)).toString('hex');}
export async function checkPassword(password,stored){
  if(typeof password!=='string'||password.length>256)return false;
  const [salt,hash]=stored.split(':');const derived=await scrypt(password,salt,64);const expected=Buffer.from(hash,'hex');
  return derived.length===expected.length&&timingSafeEqual(derived,expected);
}
export function encrypt(value,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const content=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),content]);}
export function decrypt(value,key){const buf=Buffer.from(value),decipher=createDecipheriv('aes-256-gcm',key,buf.subarray(0,12));decipher.setAuthTag(buf.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)),decipher.final()]).toString('utf8'));}
