import {randomUUID} from 'node:crypto';
import {terms, VERSION} from '../public/terms.mjs';
export {terms, VERSION};
const limits={name:50,phone:30,emergency:30,email:150,postcode:10,address:300,model:120,serial:120,symptoms:3000,signer:50};
export function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('입력 형식을 확인해 주세요.');
  if(input.website) throw new Error('요청을 처리할 수 없습니다.');
  if(input.version!==VERSION) throw new Error('안내 내용이 변경되었습니다. 페이지를 새로고침해 주세요.');
  const result={};
  for(const [key,max] of Object.entries(limits)){
    if(typeof input[key]!=='string'||input[key].length>max) throw new Error('입력 항목의 길이나 형식을 확인해 주세요.');
    result[key]=input[key].trim();
  }
  for(const key of ['name','phone','address','model','serial','symptoms','signer']) if(!result[key]) throw new Error('필수 항목을 모두 입력해 주세요.');
  for(const key of ['phone','emergency']) if(result[key]&&!/^[+\d()\s-]{7,30}$/.test(result[key])) throw new Error('연락처 형식을 확인해 주세요.');
  if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('이메일 형식을 확인해 주세요.');
  if(result.signer!==result.name||input.confirm!==true) throw new Error('신청인 성명과 서명 확인란을 확인해 주세요.');
  if(input.storageConsent!==true) throw new Error('온라인 신청서 저장 및 담당자 열람에 동의해 주세요.');
  if(!terms.every(t=>input.consents?.[t.id]===true)) throw new Error('택배 수리에 필요한 동의 사항을 확인해 주세요. 동의가 어려운 경우 상담 담당자에게 문의해 주세요.');
  return {...result,consents:Object.fromEntries(terms.map(t=>[t.id,true])),version:VERSION,storageConsent:true,termsSnapshot:structuredClone(terms)};
}
export function receipt(){ return 'SQM-'+randomUUID().toUpperCase(); }
export function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function documentHtml(data,id,date=new Date()){
  const e=escapeHtml;
  const rows=[['성명',data.name,'연락처',data.phone],['비상 연락처',data.emergency||'-','이메일',data.email||'-'],['제품명 / 모델명',data.model,'시리얼 번호 (S/N)',data.serial]];
  const time=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'long',timeStyle:'medium'}).format(date);
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>서비스센터 택배 수리 의뢰서</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:11px/1.55 'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#172333}h1{font-size:23px;border-bottom:3px solid #f56600;padding-bottom:12px}h2{font-size:15px;margin:20px 0 8px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd4dc;padding:7px;text-align:left;overflow-wrap:anywhere}th{background:#f1f4f7;width:16%}section{border:1px solid #ccd4dc;padding:10px;margin:8px 0;break-inside:avoid}h3{margin:0 0 6px;font-size:12px;color:#b94c00}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:5px 0}.muted{color:#596675}.sign{padding:12px;border:2px solid #24374a;break-inside:avoid}</style><h1>서비스센터 택배 수리 의뢰서</h1><p class="muted">접수번호: ${e(id)}\n작성일시: ${e(time)} (한국시간)</p><h2>1. 고객 및 제품 정보</h2><table>${rows.map(r=>`<tr><th>${r[0]}</th><td>${e(r[1])}</td><th>${r[2]}</th><td>${e(r[3])}</td></tr>`).join('')}<tr><th>수령 주소</th><td colspan="3">${e(data.postcode)} ${e(data.address)}</td></tr><tr><th>고장 증상 및 요청 사항</th><td colspan="3"><p>${e(data.symptoms)}</p></td></tr></table><h2>2. 주요 동의 사항</h2>${(data.termsSnapshot || terms).map((t,i)=>`<section><h3>${i+1}. ${e(t.title)}</h3><p>${e(t.text)}</p><p><strong>${e(t.question)} — 동의함</strong></p><p>성명 입력 서명: ${e(data.signer)}</p></section>`).join('')}<div class="sign"><p>본인은 상기 작성 내용이 사실과 다름없음을 확인하며, 제반 동의 사항을 충분히 숙지하고 택배 수리를 의뢰합니다.</p><p><strong>신청인 (성명 입력 서명): ${e(data.signer)}</strong></p><p>고객이 각 동의 항목을 선택하고 성명을 입력하여 제출한 전자 작성본입니다.</p></div><p>온라인 저장 및 담당자 열람 동의: 동의함. 사이트 보관기간: ${e(data.onlineRetentionDays || "설정 확인 필요")}일. 다운로드 사본은 센터 보관 정책에 따릅니다.</p><h2>3. 기기 잠금 해제 안내</h2><p>휴대폰이나 태블릿은 택배 발송 전 초기화 후 입고해 주세요. 초기화가 불가능한 경우에는 센터가 안내한 별도 경로로 잠금 해제 정보를 전달해 주세요. 이 온라인 신청서에는 잠금 비밀번호를 수집하지 않습니다.</p><p class="muted">동의 문구 버전: ${e(data.version || VERSION)}</p></html>`;
}

