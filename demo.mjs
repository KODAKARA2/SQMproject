import {terms} from './demo-terms.mjs';
const $=s=>document.querySelector(s),form=$('#intake'),panels=[...document.querySelectorAll('.panel')];let step=0;
const fields={name:'성명',phone:'연락처',emergency:'비상 연락처',email:'이메일',postcode:'우편번호',address:'수령 주소',model:'제품명 / 모델명',serial:'시리얼 번호 (S/N)',symptoms:'고장 증상 및 요청 사항',signer:'성명 입력 서명'};
for(const [i,t]of terms.entries()){
 const section=document.createElement('section');section.className='consent';const details=document.createElement('details');details.open=true;
 const summary=document.createElement('summary');summary.textContent=`${i+1}. ${t.title}`;const text=document.createElement('p');text.className='term-text';text.textContent=t.text;details.append(summary,text);
 const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=t.question;group.append(legend);
 for(const[value,label]of [['yes','동의함'],['no','동의하지 않음']]){const el=document.createElement('label');el.className='radio';const input=document.createElement('input');Object.assign(input,{type:'radio',name:t.id,value,required:true});el.append(input,document.createTextNode(label));group.append(el);}
 section.append(details,group);$('#terms').append(section);
}
function show(n,focus=true){step=n;panels.forEach((p,i)=>p.hidden=i!==n);document.querySelectorAll('.progress li').forEach((p,i)=>{p.classList.toggle('done',i<n);if(i===n)p.setAttribute('aria-current','step');else p.removeAttribute('aria-current');});$('#error').textContent='';if(focus)panels[n].querySelector('h2').focus();}
function check(){for(const el of panels[step].querySelectorAll('input,textarea')){el.setCustomValidity('');if(el.required&&el.type!=='checkbox'&&el.type!=='radio'&&!el.value.trim())el.setCustomValidity('이 항목을 입력해 주세요.');if(!el.reportValidity())return false;}if(step===1){if(terms.some(t=>form.elements[t.id].value!=='yes')){$('#error').textContent='택배 수리 진행에는 각 항목의 동의가 필요합니다. 동의하지 않는 경우 상담 안내로 연결되는 흐름이며, 데모에서는 여기서 중단할 수 있습니다.';return false;}const signer=form.elements.signer;if(signer.value.trim()!==form.elements.name.value.trim()){signer.setCustomValidity('신청인 성명과 동일하게 입력해 주세요.');signer.reportValidity();return false;}}return true;}
function review(){const root=$('#review');root.replaceChildren();for(const [key,label]of Object.entries(fields)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=form.elements[key].value.trim()||'입력하지 않음';root.append(dt,dd);}$('#consent-summary').textContent='5개 안내 항목 동의 확인 · 성명 입력 서명 확인';}
document.querySelectorAll('.next').forEach(b=>b.addEventListener('click',()=>{if(check()){if(step===1)review();show(step+1);}}));
document.querySelectorAll('.back').forEach(b=>b.addEventListener('click',()=>show(step-1)));
form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',e=>{e.target.setCustomValidity?.('');$('#error').textContent='';});
function clear(){form.reset();for(const el of form.elements)el.setCustomValidity?.('');$('#review').replaceChildren();$('#consent-summary').textContent='';$('#error').textContent='';}
$('#finish').addEventListener('click',()=>{clear();form.hidden=true;$('.progress').hidden=true;$('#sample').hidden=true;$('#success').hidden=false;$('#success').focus();});
$('#restart').addEventListener('click',()=>{clear();$('#success').hidden=true;form.hidden=false;$('.progress').hidden=false;$('#sample').hidden=false;show(0);});
$('#sample').addEventListener('click',()=>{clear();const sample={name:'홍길동',phone:'010-0000-0000',emergency:'',email:'demo@example.com',postcode:'00000',address:'체험용 가상 주소 123, 데모동 101호',model:'Xiaomi Robot Vacuum 5',serial:'DEMO-SN-000001',symptoms:'[체험용 예시] 충전 후에도 전원이 켜지지 않습니다.'};for(const[k,v]of Object.entries(sample))form.elements[k].value=v;show(0);});
window.addEventListener('pagehide',clear);window.addEventListener('pageshow',e=>{if(e.persisted){clear();$('#success').hidden=true;form.hidden=false;$('.progress').hidden=false;$('#sample').hidden=false;show(0,false);}});
clear();show(0,false);$('#fields').disabled=false;$('#sample').disabled=false;
