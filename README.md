# Tripnote Japan

`japan-travel/tripnote.html`을 메인으로 옮긴 여행 일정·예산 플래너입니다. PC 예산표, 모바일 카드, 엔·원 환산, 브라우저 저장·백업과 하단 AI 여행 상담을 제공합니다.

## Vercel에서 실행

1. 이 `intel051/japan` 저장소를 Vercel 프로젝트에 연결합니다. 프레임워크는 **Other**, 별도 빌드 명령은 필요 없습니다.
2. 환경 변수 **GEMINI_API_KEY**에 Gemini API 키를 넣고 Production에 적용한 뒤 재배포합니다. 기존 프로젝트에 이미 설정되어 있으면 그대로 사용합니다.
3. 모델 기본값은 **gemini-3.5-flash-lite**입니다. `GEMINI_MODEL` 환경 변수로 변경할 수 있습니다.
4. Vercel 배포 주소에서 질문 예시 하나를 선택해 실제 답변을 확인합니다.

API 키는 `api/gemini.js`에서만 읽습니다. `.env`나 API 키를 HTML 또는 GitHub에 올리지 마세요. 검색 도구 사용과 모델 호출에는 Gemini 계정의 요금·할당량이 적용됩니다.

**GitHub Pages는 `/api/gemini`를 실행하지 않습니다.** GitHub Pages에서는 플래너를 사용할 수 있지만 AI 상담은 Vercel 배포 주소에서 사용하세요. API URL을 입력하는 별도 설정은 필요 없습니다.

## 데이터 이전

여행은 해당 주소의 브라우저 저장소(`tripnote-html-v1`)에 저장됩니다. 기존 `japan-travel` 주소와 새 `japan`/Vercel 주소는 브라우저 저장 영역이 다를 수 있습니다. 이전 화면에서 백업 다운로드 → 새 화면에서 백업 가져오기로 옮기세요. 여행 원본과 환전 데이터는 그대로 유지하며 상담에 전송할 때는 선택한 여행의 날짜·일정·전체 예산·환율만 추립니다.

AI는 일정을 자동 변경하지 않고 조언을 제공합니다. 저장하지 않은 변경은 참고하지 않으니 최신 일정을 상담하려면 먼저 여행 저장 후 AI의 여행 목록을 새로고침하세요. 대화는 현재 화면 메모리에만 유지되며 새로고침하면 사라집니다.

## 프롬프트·화면 수정

- `index.html`: 메인 Tripnote 및 AI 질문 영역
- `assets/travel-ai.js`: 안전한 Markdown 표시, 상담 요청·중단·오류 처리
- `assets/travel-ai.css`: 모바일/PC 상담 디자인. `strong`에 굵은 글씨와 파란 배경 적용
- `lib/travel-prompt.js`: 여행 상담 시스템 프롬프트, 저장 여행 데이터 제한
- `api/gemini.js`: 서버 API와 Google 검색 출처 처리, 45초 요청 시간 제한

## 로컬 확인

Node.js 22 이상에서 `npm start`, `npm test`로 실행합니다. 로컬 실제 AI 호출은 `GEMINI_API_KEY=... npm start`처럼 환경 변수를 설정해야 합니다. 키 없이도 화면과 검증·오류 처리를 확인할 수 있습니다.
