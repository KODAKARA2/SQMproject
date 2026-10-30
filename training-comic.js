(() => {
  const app = document.querySelector("#app");
  const labels = {start:"QA 감독과 교육강사가 상담 퀴즈를 준비하는 모습",correct:"QA 감독의 엄지 척과 교육강사의 정답 환호",wrong:"오답 표지를 든 QA 감독과 놀란 교육강사",result:"트로피를 들고 완주를 축하하는 QA 감독과 교육강사"};
  function panel(scene) {
    const el = document.createElement("div");
    el.className = "comic-panel comic-" + scene;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", labels[scene]);
    return el;
  }
  function decorate() {
    const desk = app.querySelector(".desk");
    if (desk) desk.replaceWith(panel("start"));
    const result = app.querySelector(".result-main");
    if (result && !result.querySelector(".comic-panel")) {
      const scene = result.querySelector(".eyebrow")?.textContent.trim();
      result.querySelector("h1")?.before(panel(/^CHAPTER \d+$/.test(scene) ? "start" : "result"));
    }
    const feedback = app.querySelector(".feedback");
    if (feedback && !feedback.querySelector(".comic-panel")) {
      const copy = document.createElement("div");
      while (feedback.firstChild) copy.append(feedback.firstChild);
      const row = document.createElement("div");
      row.className = "comic-feedback";
      row.append(panel(feedback.classList.contains("wrong") ? "wrong" : "correct"), copy);
      feedback.append(row);
    }
  }
  new MutationObserver(decorate).observe(app, {childList:true, subtree:true});
  decorate();
})();
