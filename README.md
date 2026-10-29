# 택배 수리 접수 데모

https://xiaomisupport.site

고객·제품 정보 → 동의·성명 입력 서명 → 최종 확인 → 체험 완료의 정적 웹 데모입니다. 서버/API, 이메일 발송, 브라우저 저장 기능은 없습니다. 입력 내용은 현재 DOM에서만 사용하며 완료·새로고침·페이지 이탈 시 초기화합니다. CSP의 connect-src/form-action도 none으로 제한합니다.

배포는 기존 GitHub Pages와 CNAME을 사용합니다. demo.mjs, demo.css, demo-terms.mjs와 index.html이 데모 파일입니다. 개인정보 대신 가상 정보로 테스트해 주세요.

이전 교육 게임은 training.html에서 사용할 수 있습니다. 이전 서버 구현 PR은 이 데모 배포에 포함되지 않습니다.
