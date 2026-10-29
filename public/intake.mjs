import {terms,VERSION} from './terms.mjs';
const $=s=>document.querySelector(s),form=$('#intake');
let requestKey=crypto.randomUUID(),submittedBody=null;
for(const [i,t]of terms.entries()){
  const section=document.createElement('section');section.className='consent';
  const title=document.createElement('h3');title.textContent=`${i+1}. ${t.title}`;
  const text=document.createElement('p');text.className='term-text';text.textContent=t.text;
  const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=t.question;group.append(legend);
  for(const [value,label]of [['yes','동의함'],['no','동의하지 않음']]){const el=document.createElement('label');el.className='radio';const input=document.createElement('input');input.type='radio';input.name=t.id;input.value=value;input.required=true;el.append(input,document.createTextNode(label));group.append(el);}
  section.append(title,text,group);$('#terms').append(section);
}
try{const res=await fetch('/api/status');if(!res.ok)throw new Error();const status=await res.json();$('#fields').disabled=!status.ready;$('#availability').textContent=status.ready?'휴대폰에서도 작성할 수 있습니다. 제품의 모델명과 S/N을 미리 준비해 주세요.':'현재 온라인 접수를 준비 중입니다. 상담 담당자에게 문의해 주세요.';$('#retention').textContent=status.retentionDays?`이 사이트의 신청서는 접수일부터 ${status.retentionDays}일 동안 서버에 저장되며, 비밀번호로 로그인한 담당자가 확인하고 PDF로 내려받을 수 있습니다. 보관기간이 지나면 사이트에서 자동 삭제됩니다. 센터가 내려받은 사본은 센터의 보관 정책에 따라 관리됩니다.`:'접수 시작 전 보관기간이 안내됩니다.';}catch{$('#availability').textContent='접수 서버에 연결하지 못했습니다. 잠시 후 새로고침해 주세요.';}
form.addEventListener('submit',async event=>{
  event.preventDefault();const data=Object.fromEntries(new FormData(form));data.consents=Object.fromEntries(terms.map(t=>[t.id,data[t.id]==='yes']));data.confirm=form.elements.confirm.checked;data.storageConsent=form.elements.storageConsent.checked;data.version=VERSION;
  if(!submittedBody&&terms.some(t=>!data.consents[t.id])){$('#form-error').textContent='택배 수리에 필요한 동의 사항을 확인해 주세요. 동의가 어려운 경우 상담 담당자에게 문의해 주세요.';return;}
  if(!submittedBody&&data.name.trim()!==data.signer.trim()){$('#form-error').textContent='신청인 성명과 서명에 입력한 성명이 일치해야 합니다.';form.elements.signer.focus();return;}
  // Freeze retries after an ambiguous network failure to preserve idempotency.
  submittedBody??=JSON.stringify(data);$('#fields').disabled=true;$('#form-error').textContent='';$('#submit').textContent='안전하게 저장하고 있습니다…';
  try{
    const res=await fetch('/api/intake',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},body:submittedBody});const result=await res.json();
    if(!res.ok){if(res.status===400){submittedBody=null;$('#fields').disabled=false;}throw new Error(result.error||'저장하지 못했습니다.');}
    form.reset();form.hidden=true;$('#availability').hidden=true;$('#receipt').textContent=result.id;$('#success').hidden=false;$('#success').focus();submittedBody=null;
  }catch(e){$('#form-error').textContent=(e instanceof TypeError?'연결이 끊겼습니다. 아래 버튼으로 같은 신청을 다시 확인해 주세요.':e.message);if(submittedBody){$('#fields').disabled=false;for(const el of form.elements)if(el!==$('#submit')&&el.tagName!=='FIELDSET')el.disabled=true;$('#submit').disabled=false;$('#submit').textContent='같은 신청 저장 확인하기';}else{$('#submit').textContent='수리 의뢰서 제출하기 →';}}
});
