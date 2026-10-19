# 한광훈 이력서 · 포트폴리오

- 이력서(메인): https://kpo9101.github.io — 위쪽 막대 "PDF"·첫 화면 "이력서 PDF 다운로드"로 `resume.pdf`(직접 제공한 이력서 수정본)를 바로 받음
- 이력서 공유용 링크: https://kpo9101.github.io/resume/ — 이름·직무 카드 메타데이터를 제공하며, 클릭하면 메인 이력서로 이동
- 포트폴리오: https://kpo9101.github.io/portfolio.html
- PDF 화면: https://kpo9101.github.io/pdf.html (버튼 "PDF로 저장" → 인쇄 창에서 대상 "PDF로 저장")
- 편집 화면: https://kpo9101.github.io/edit.html

## 고치는 방법

1. **edit.html**을 열고, 왼쪽에서 페이지를 펼쳐 글·숫자·이미지를 고칩니다. 오른쪽 미리보기에 바로 반영됩니다.
2. **GitHub에 저장**을 누르면 `content.json`이 커밋되고, 1~2분 뒤 사이트와 PDF 화면에 반영됩니다.
3. 처음 한 번은 편집 화면의 **설정**에서 GitHub 토큰(Fine-grained, 이 저장소만, Contents: Read and write)을 넣어야 합니다.

편집 화면 없이 고치려면 이 저장소의 `content.json`을 GitHub 웹에서 직접 수정해도 됩니다.
이력서(`index.html`)는 content.json과 별개인 단일 HTML 파일이라 직접 고칩니다.
내려받기용 이력서를 바꾸려면 새 PDF를 `resume.pdf`로 교체해 main에 올립니다. 현재 파일은 `한광훈_이력서_수정본.pdf` 원본입니다.
`index.html`을 고쳐 main에 올리면 GitHub Actions("이력서 PDF 만들기")가 2~4분 안에 웹 인쇄본 `resume-web.pdf`를 다시 만들어 커밋합니다. 내려받기용 `resume.pdf`는 변경하지 않습니다.
수동으로 다시 만들려면 Actions 탭 → "이력서 PDF 만들기" → Run workflow.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `content.json` | 포트폴리오의 모든 글·숫자·이미지 경로·코드 (고치는 곳은 여기 하나) |
| `index.html` | 웹 이력서 (메인) — 인쇄 스타일이 A4 이력서 레이아웃 |
| `resume/index.html` | 링크 공유용 페이지 — 별도 URL·공유 카드 메타데이터, 방문자는 메인 이력서로 이동 |
| `img/og-resume-20261019.png` | 이력서 링크 공유 미리보기 이미지 (1200×630, 이름·직무 카드) |
| `.github/scripts/resume_share_card.html` | 공유 카드 편집 원본 — 1200×630 크기로 PNG 캡처 후 공유 이미지 교체 |
| `resume.pdf` | 내려받기용 이력서 PDF — 직접 제공한 수정본 원본을 유지하며, 새 이력서는 이 파일을 교체 |
| `resume-web.pdf` | `index.html` 인쇄 레이아웃으로 자동 생성하는 웹 이력서 PDF |
| `.github/workflows/resume-pdf.yml`, `.github/scripts/resume_pdf.py` | `index.html`이 바뀌면 `resume-web.pdf`를 다시 만드는 자동 작업 |
| `portfolio.html` + `pf.css` + `pf.js` | 웹 포트폴리오 — 디자인(`pf.css`)과 화면 그리기·모션(`pf.js`) |
| `pdf.html` + `style.css` + `app.js` | 16:9 PDF용 화면 (넘치는 페이지는 빨갛게 표시) |
| `edit.html`, `editor.js` | 편집 화면 (미리보기는 portfolio.html / pdf.html을 그대로 씀) |
| `diagrams.js` | 구조도 등 고정 다이어그램(SVG) — 웹·PDF 공용 |
| `vendor/gsap/` | 모션 라이브러리 GSAP 3.15 (ScrollTrigger·SplitText·ScrambleText·DrawSVG) |
| `fonts/` | Archivo(영문 제목) · JetBrains Mono(라벨·코드) · Pretendard 전체본(이력서·PDF 화면용). 웹 포트폴리오의 한글 Pretendard는 jsDelivr의 분할본(필요한 글자 묶음만 받음)을 씀 |
| `img/` | 이미지 |

글자 꾸미기: `**굵게**`, `~~취소선~~`, `_{아래첨자}`, Enter로 줄바꿈.

## 웹 포트폴리오 디자인 메모

- 콘셉트: 언리얼 에디터 뷰포트. 그래파이트 바탕 + 옅은 격자, 선택된 액터의 주황 외곽선(강조색), 변환 기즈모의 X(빨강)·Y(초록) 축 색, 좌표·파일명 같은 모노스페이스 라벨.
- 첫 화면: 이름·소개·대표작 바로가기만 두는 단순한 구성.
- 트러블슈팅 01: 두 시설 영역(OBB)을 분리축 정리(SAT)로 실시간 판정하는 캔버스 데모. 커서로 시설 B를 옮기고 클릭하면 45° 회전합니다. AABB는 겹치는데 OBB는 떨어져 있으면 `FALSE POSITIVE FILTERED`가 켜집니다.
- 모션: 화면에 들어올 때 한 번만 짧게 등장(줄 단위 글자 올라옴, 이미지 와이프, 코드 줄 순서 등장, 다이어그램 선 그리기, 수치 카운트업), 문제→해결→결과 진행선은 스크롤에 맞춰 차오름.
- 운영체제의 '동작 줄이기' 설정, 편집 화면 미리보기, 인쇄에서는 모션이 꺼지고 처음부터 끝난 상태로 보입니다.
- 색·글꼴·간격은 `pf.css` 맨 위 `:root`에서 한 번에 바꿀 수 있습니다.
