import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {hashPassword} from '../lib/security.mjs';
const password=randomBytes(18).toString('base64url');
const hash=await hashPassword(password),key=randomBytes(32).toString('hex');
await writeFile('.env',`PORT=3000\nPUBLIC_ORIGIN=https://xiaomisupport.site\nADMIN_PASSWORD_HASH=${hash}\nDATA_ENCRYPTION_KEY=${key}\nDATA_DIR=./data\nRETENTION_DAYS=90\nINTAKE_ENABLED=false\nCOOKIE_SECURE=true\n`,{flag:'wx',mode:0o600});
console.log('Created .env. Keep the encryption key backed up separately.');
console.log('Initial administrator password (save in your password manager): '+password);
console.log('Review hosting, origin, retention and consent text before enabling intake. Never share .env or this password in a public repository.');
