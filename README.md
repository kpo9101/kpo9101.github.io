# 한광훈 포트폴리오

- 사이트: https://kpo9101.github.io
- PDF 화면: https://kpo9101.github.io/pdf.html (버튼 "PDF로 저장" → 인쇄 창에서 대상 "PDF로 저장")
- 편집 화면: https://kpo9101.github.io/edit.html

## 고치는 방법

1. **edit.html**을 열고, 왼쪽에서 페이지를 펼쳐 글·숫자·이미지를 고칩니다. 오른쪽 미리보기에 바로 반영됩니다.
2. **GitHub에 저장**을 누르면 `content.json`이 커밋되고, 1~2분 뒤 사이트와 PDF 화면에 반영됩니다.
3. 처음 한 번은 편집 화면의 **설정**에서 GitHub 토큰(Fine-grained, 이 저장소만, Contents: Read and write)을 넣어야 합니다.

편집 화면 없이 고치려면 이 저장소의 `content.json`을 GitHub 웹에서 직접 수정해도 됩니다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `content.json` | 모든 글·숫자·이미지 경로·코드 (고치는 곳은 여기 하나) |
| `index.html` | 웹 포트폴리오 |
| `pdf.html` | 16:9 PDF용 화면 (넘치는 페이지는 빨갛게 표시) |
| `edit.html`, `editor.js` | 편집 화면 |
| `app.js` | content.json을 화면으로 그리는 코드 |
| `diagrams.js` | 구조도 등 고정 다이어그램(SVG) |
| `style.css` | 디자인 |
| `img/`, `fonts/` | 이미지와 글꼴 |

글자 꾸미기: `**굵게**`, `~~취소선~~`, `_{아래첨자}`, Enter로 줄바꿈.
