function giftEligible(){
 if(!game||game.stage!==3||game.review||game.pending||game.intro)return false;
 if(game.rounds.length!==24||new Set(game.rounds).size!==24||game.log.length!==24)return false;
 if(!game.log.every((l,i)=>l.id===game.rounds[i]&&l.chosen===question(l.id)?.answer))return false;
 return [0,1,2].every(i=>game.history[i]?.log?.length===24);
}
function giftMarkup(){
 const date=game.giftAt?new Date(game.giftAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):"기존 저장 기록";
 return `<section class="gift" aria-label="최종 평가 만점 보상"><div class="eyebrow">PERFECT SCORE · 100%</div><h2>만점 달성! 선물 코드를 확인하세요.</h2><p>${esc(game.name)}님 · 최종 평가 24/24<br><small>코드 확인 기록: ${esc(date)} (한국 시간)</small></p><label for="gift-code">Gift 코드</label><input id="gift-code" readonly value="윤서현최강짱짱화이팅" spellcheck="false"><button class="primary" id="copy-gift">코드 복사하기</button><p id="copy-status" role="status" aria-live="polite"></p><p class="gift-note"><b>선물은 최초 인증자에게 지급됩니다.</b><br>이 결과 화면과 코드를 담당자에게 보여 주세요. 만점자 모두에게 코드가 표시되며, 최초 인증 여부는 담당자가 확인합니다.</p></section>`;
}
function bindGift(){
 const button=document.querySelector("#copy-gift");if(!button)return;
 button.onclick=async()=>{
  const field=document.querySelector("#gift-code"),status=document.querySelector("#copy-status");
  status.textContent="코드를 복사하고 있어요.";
  try{await navigator.clipboard.writeText(field.value);status.textContent="코드를 복사했어요. 담당자에게 결과 화면과 함께 인증해 주세요.";}
  catch{field.focus();field.select();status.textContent="코드를 선택했어요. 길게 누르거나 Ctrl+C로 복사해 주세요.";}
 };
}
