import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {validate,terms,VERSION,documentHtml} from '../lib/intake.mjs';
const data=validate({name:'검증용 고객',phone:'010-0000-0000',emergency:'',email:'',postcode:'00000',address:'테스트 전용 주소',model:'한글 출력 확인 제품',serial:'TEST-ONLY',symptoms:'충전 후에도 전원이 켜지지 않습니다.\n'.repeat(60),signer:'검증용 고객',confirm:true,storageConsent:true,version:VERSION,consents:Object.fromEntries(terms.map(t=>[t.id,true]))});
data.onlineRetentionDays=90;
await mkdir('test-output',{recursive:true});
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({javaScriptEnabled:false});await page.setContent(documentHtml(data,'SQM-TEST-ONLY'));const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length<10000)throw new Error('Invalid PDF output');await writeFile('test-output/sample.pdf',bytes);console.log('Synthetic PDF generated successfully.');}finally{await browser.close();}
