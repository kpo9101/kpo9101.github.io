"""index.html(웹 이력서)을 A4 PDF(resume.pdf)로 만듭니다.

- 브라우저 '인쇄 → PDF로 저장'과 같은 인쇄 스타일을 씁니다.
- 링크가 실제 주소를 가리키도록 https://kpo9101.github.io/ 로 열고, 파일은 저장소에서 바로 읽습니다.
- Pretendard 가변 글꼴을 굵기별 고정 글꼴로 풀어 넣어, PDF 안 글꼴이 TrueType으로 들어가게 합니다
  (용량이 작고 글자 복사·검색이 잘 됨).

사용: python .github/scripts/resume_pdf.py [저장소 경로] [출력 PDF]
"""
import asyncio, io, mimetypes, pathlib, re, shutil, subprocess, sys, tempfile

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from playwright.async_api import async_playwright
from pypdf import PdfWriter

SITE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else SITE / 'resume.pdf')
ORIGIN = 'https://kpo9101.github.io/'
VARFONT = SITE / 'fonts' / 'PretendardVariable.woff2'


def used_weights(html):
    ws = {400}
    ws.update(int(w) for w in re.findall(r'font-weight:\s*(\d{3})', html))
    ws.update(int(w) for w in re.findall(r'font:\s*(\d{3})\s', html))
    return sorted(w for w in ws if 100 <= w <= 900)


def make_instances(weights, outdir):
    src = TTFont(VARFONT)
    src.flavor = None
    buf = io.BytesIO(); src.save(buf); data = buf.getvalue()
    for w in weights:
        inst = instancer.instantiateVariableFont(TTFont(io.BytesIO(data)), {'wght': w})
        inst.save(outdir / f'Pretendard-{w}.ttf')
        print('font', w)


async def render(fontdir, raw_pdf):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()

        async def handle(route):
            rel = route.request.url.split('#')[0].split('?')[0][len(ORIGIN):] or 'index.html'
            f = (fontdir / rel[len('__pdffonts/'):]) if rel.startswith('__pdffonts/') else SITE / rel
            if f.is_file():
                await route.fulfill(body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
            else:
                await route.fulfill(status=404, body='')

        await pg.route(ORIGIN + '**', handle)
        await pg.route(lambda u: not u.startswith(ORIGIN), lambda r: r.abort())
        await pg.goto(ORIGIN, wait_until='networkidle')
        css = ''.join('@font-face{font-family:"PretendardPDF";font-weight:%s;src:url("/__pdffonts/%s") format("truetype")}'
                      % (f.stem.split('-')[1], f.name) for f in sorted(fontdir.glob('Pretendard-*.ttf')))
        css += 'body{font-family:"PretendardPDF","Pretendard",sans-serif !important}'
        await pg.add_style_tag(content=css)
        await pg.emulate_media(media='print')
        await pg.evaluate('document.fonts.ready.then(() => 1)')
        await pg.pdf(path=str(raw_pdf), format='A4', prefer_css_page_size=True, print_background=True, tagged=True, outline=True)
        await b.close()


def main():
    html = (SITE / 'index.html').read_text(encoding='utf-8')
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        fontdir = tmp / 'fonts'; fontdir.mkdir()
        make_instances(used_weights(html), fontdir)
        raw = tmp / 'raw.pdf'
        asyncio.run(render(fontdir, raw))
        w = PdfWriter(clone_from=str(raw))
        w.add_metadata({'/Title': '한광훈 이력서', '/Author': '한광훈',
                        '/Subject': 'Unreal C++ 게임 클라이언트 프로그래머 이력서',
                        '/Keywords': 'Unreal Engine, C++, 게임 클라이언트, OBB, SAT, 자동화 테스트',
                        '/Creator': 'kpo9101.github.io'})
        tagged = tmp / 'meta.pdf'
        with open(tagged, 'wb') as f:
            w.write(f)
        if shutil.which('qpdf'):  # 압축을 다시 해 용량을 줄임(약 25%)
            subprocess.run(['qpdf', '--object-streams=generate', '--recompress-flate', '--compression-level=9', str(tagged), str(OUT)], check=True)
        else:
            shutil.copyfile(tagged, OUT)
    print('saved', OUT, OUT.stat().st_size, 'bytes')


main()
