/* 포트폴리오 렌더러 — content.json을 읽어 웹(index.html) 또는 16:9 PDF 화면(pdf.html)을 그립니다.
   글·숫자·이미지는 content.json(또는 edit.html)에서 고치고, 이 파일은 손대지 않아도 됩니다. */
(function () {
  'use strict';
  var MODE = document.body.getAttribute('data-mode') || 'web';
  var PARAMS = new URLSearchParams(location.search);
  var PREVIEW = PARAMS.has('preview');
  var app = document.getElementById('app');
  var pendingImages = {};

  /* ---------- 글자 처리 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // **굵게**, ~~취소선~~, _{아래첨자}, 줄바꿈
  function fmt(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/_\{(.+?)\}/g, '<sub>$1</sub>')
      .replace(/\n/g, '<br>');
  }
  function src(path) { return pendingImages[path] || path; }
  var LAZY = MODE === 'web' ? ' loading="lazy"' : '';

  /* ---------- 코드 하이라이트 ---------- */
  var KW = {};
  'const if else return for while bool double float void auto true false nullptr int32 int static class struct this new delete break continue'.split(' ').forEach(function (k) { KW[k] = 1; });
  function hl(code) {
    var re = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([\s\S])/g;
    var toks = [], m;
    while ((m = re.exec(code))) toks.push(m);
    var out = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t[1]) out.push('<span class="c-com">' + esc(t[1]) + '</span>');
      else if (t[2]) out.push('<span class="c-str">' + esc(t[2]) + '</span>');
      else if (t[3]) out.push('<span class="c-num">' + esc(t[3]) + '</span>');
      else if (t[4]) {
        var id = t[4], nxt = '';
        for (var j = i + 1; j < toks.length; j++) { if (toks[j][5]) continue; nxt = toks[j][0]; break; }
        if (KW[id]) out.push('<span class="c-kw">' + id + '</span>');
        else if (nxt === '(') out.push('<span class="c-fn">' + id + '</span>');
        else if (/^[FUAIET][A-Z]/.test(id) || id === 'Super') out.push('<span class="c-ty">' + id + '</span>');
        else if (/^[A-Z]/.test(id)) out.push('<span class="c-id">' + id + '</span>');
        else out.push(id);
      } else if (t[5]) out.push(t[5]);
      else out.push(esc(t[6]));
    }
    return out.join('');
  }

  /* ---------- 공통 조각 ---------- */
  var ICONS = {
    gh: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    yt: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12a31 31 0 00.5 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.5-4.8 31 31 0 00-.5-4.8zM9.75 15.02V8.98L15.5 12z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8"/></svg>'
  };
  function pill(l, dark) {
    if (!l || !l.url) return '';
    return '<a class="pill' + (dark ? ' pill-dark' : '') + '" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + (ICONS[l.icon] || ICONS.gh) + '<span>' + esc(l.label || '링크') + '</span></a>';
  }
  var DEFAULT_TAB = { gallery: 'OVERVIEW', architecture: 'ARCHITECTURE', trouble: 'TROUBLESHOOTING', cards: 'TROUBLESHOOTING', pair: 'TROUBLESHOOTING', learnings: 'LEARNINGS' };
  function tabs(c, p) {
    var set = (c.tabsets || {})[p.tabs];
    if (!set) return '';
    var on = p.tab || DEFAULT_TAB[p.type];
    return '<nav class="tabs" aria-hidden="true">' + set.map(function (t) { return '<span class="' + (t === on ? 'on' : '') + '">' + esc(t) + '</span>'; }).join('') + '</nav>';
  }
  function foot(c, label, n) {
    return '<div class="foot"><span>' + esc(c.profile.name) + ' · ' + esc(label || '') + '</span><span>' + (n < 10 ? '0' + n : n) + '</span></div>';
  }
  function eyebrow(p) { return p.eyebrow ? '<p class="eyebrow">' + esc(p.eyebrow) + '</p>' : ''; }
  function img(path, alt, cls) {
    if (!path) return '';
    return '<figure class="' + cls + '"><img src="' + esc(src(path)) + '" alt="' + esc(alt || '') + '"' + LAZY + '></figure>';
  }
  function codeCard(b, cls) {
    if (!b || !b.code) return '';
    var size = b.size === 'xs' ? 'code-xs' : 'code-sm';
    return '<div class="code ' + (cls || size) + '"><div class="code-head"><span>' + esc(b.file || 'code') + '</span></div><pre>' + hl(String(b.code).replace(/^\n+|\n+$/g, '')) + '</pre></div>';
  }
  function blocks(p) {
    return [['문제', p.problem], ['해결', p.solution], ['결과', p.result]].map(function (x, i) {
      if (!x[1]) return '';
      return '<div class="blk"><h4><b>0' + (i + 1) + '</b> ' + x[0] + '</h4><p>' + fmt(x[1]) + '</p></div>';
    }).join('');
  }
  function metric(m) {
    return '<div class="metric"><strong>' + esc(m.value) + '</strong><span>' + esc(m.label) + '</span>' + (m.sub ? '<small>' + esc(m.sub) + '</small>' : '') + '</div>';
  }

  /* ---------- 오른쪽 자료 블록 ---------- */
  var SIDE = {
    image: function (b) {
      if (!b.src) return '';
      var cls = 'shot side-img' + (b.height === 'short' ? ' short' : '') + (b.height === 'tall' ? ' tall' : '') + (b.fit === 'contain' ? ' contain' : '') + (b.caption ? ' pkg-shot' : '');
      var cap = b.caption ? '<figcaption>' + fmt(b.caption).replace(/<em>(.+?)<\/em>(<br>)?/, '<b>$1</b>') + '</figcaption>' : '';
      return '<figure class="' + cls + '"><img src="' + esc(src(b.src)) + '" alt="' + esc(b.alt || '') + '"' + LAZY + '>' + cap + '</figure>';
    },
    code: function (b) { return codeCard(b); },
    diagram: function (b) { return (window.PF_DIAGRAMS || {})[b.id] || ''; },
    metrics: function (b) {
      var items = b.items || [];
      return '<div class="metrics' + (items.length === 3 ? ' m3' : '') + '">' + items.map(metric).join('') + '</div>';
    },
    note: function (b) { return b.text ? '<p class="cmp-note">' + fmt(b.text) + '</p>' : ''; },
    example: function (b) { return b.text ? '<div class="example"><span>예시</span><p>' + fmt(b.text).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>') + '</p></div>' : ''; },
    flow: function (b) {
      var st = (b.steps || []).map(function (s, i, a) { return '<span' + (i === a.length - 1 ? ' class="fl-ok"' : '') + '>' + esc(s) + '</span>'; }).join('<i>→</i>');
      return '<div class="flow"><div class="fl-row">' + st + '</div>' +
        (b.fail ? '<div class="fl-back">' + fmt(b.fail).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>') + '</div>' : '') +
        (b.undo ? '<div class="fl-undo">' + fmt(b.undo).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>') + '</div>' : '') + '</div>';
    },
    compare: function (b) {
      return '<div class="cmp">' + (b.columns || []).map(function (c) {
        return '<div class="cmp-col ' + (c.tone === 'ok' ? 'ok' : 'bad') + '"><h5>' + esc(c.title) + '</h5>' +
          '<div class="node' + (c.topGhost ? ' ghost' : '') + '">' + esc(c.top) + (c.topNote ? '<small>' + esc(c.topNote) + '</small>' : '') + '</div>' +
          (c.arrow ? '<div class="link">' + esc(c.arrow) + '</div>' : '') +
          (c.bottom ? '<div class="node">' + esc(c.bottom) + '</div>' : '') +
          (c.pos ? '<p class="pos">' + fmt(c.pos).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>') + '</p>' : '') + '</div>';
      }).join('') + '</div>';
    },
    sameEval: function (b) {
      return '<div class="same-eval"><div class="se-src">' + (b.sources || []).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') +
        '</div><div class="se-arrow">↘ ↙</div><div class="se-core">' + fmt(b.core).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>') + '</div></div>';
    },
    formula: function (b) {
      var main = fmt(b.main).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>').replace(/^([^=]+)=/, '<span class="fx-k">$1</span>=');
      return '<div class="formula"><div class="fx">' + main + '</div>' + (b.rows || []).map(function (r) {
        return '<div class="fx-row"><span>' + esc(r.k) + '</span> ' + fmt(r.v) + '</div>';
      }).join('') + (b.tags ? '<div class="tags">' + esc(b.tags) + '</div>' : '') + '</div>';
    },
    steps: function (b) {
      var parts = (b.items || []).map(function (s) { return '<span>' + fmt(s) + '</span>'; });
      if (b.last) parts.push('<span class="ok">' + fmt(b.last) + '</span>');
      return '<div class="steps">' + parts.join('<i>→</i>') + '</div>';
    }
  };
  function side(list) { return (list || []).map(function (b) { return (SIDE[b.type] || function () { return ''; })(b); }).join(''); }

  /* ---------- 페이지 종류 ---------- */
  var PAGES = {
    cover: function (p, n, c) {
      var pr = c.profile;
      return '<section class="page dark cover" id="top"><p class="cv-eyebrow">' + esc(pr.role) + '</p><h1 class="cv-title">' + esc(p.title || 'PORTFOLIO') + '</h1>' +
        '<div class="cv-bottom"><span class="cv-name">' + esc(pr.name) + '</span><span class="cv-contact">' +
        (pr.phone ? '<span>' + esc(pr.phone) + '</span>' : '') + (pr.email ? '<span>' + esc(pr.email) + '</span>' : '') +
        (pr.github ? '<a href="' + esc(pr.github) + '" target="_blank" rel="noopener">' + esc(pr.githubLabel || pr.github) + '</a>' : '') + '</span></div></section>';
    },
    about: function (p, n, c) {
      return '<section class="page dark about" id="about">' + eyebrow(p) + '<h2 class="ab-title">' + fmt(p.title) + '</h2><p class="ab-lead">' + fmt(p.lead) + '</p>' +
        '<p class="mini-h">SKILLS</p><div class="chips">' + (p.skills || []).map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join('') + '</div>' +
        '<p class="mini-h">PROFICIENCY</p><div class="cards3">' + (p.cards || []).map(function (k) {
          return '<div class="pcard"><h3>' + esc(k.title) + '</h3><p>' + fmt(k.text) + '</p>' + (k.note ? '<small>' + esc(k.note) + '</small>' : '') + '</div>';
        }).join('') + '</div>' + foot(c, 'PROFILE', n) + '</section>';
    },
    contents: function (p, n, c) {
      return '<section class="page light contents">' + eyebrow(p) + '<div class="ct-list">' + (p.items || []).map(function (it) {
        return '<a class="ct-row" href="#' + esc(it.anchor) + '"><span class="ct-num">' + esc(it.num) + '</span><div class="ct-body"><h3>' + esc(it.title) + '</h3><p>' + esc(it.meta) + '</p><ul>' +
          (it.topics || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' + img(it.image, it.alt, 'ct-thumb') + '</a>';
      }).join('') + '</div>' + foot(c, 'CONTENTS', n) + '</section>';
    },
    intro: function (p, n, c) {
      var meta = p.meta || [];
      return '<section class="page dark intro" id="' + esc(p.id) + '"><div class="in-num"><span>' + esc(p.num) + '</span><i></i></div><div class="in-grid"><div>' +
        '<h2 class="in-title">' + esc(p.title) + '</h2><p class="in-desc">' + fmt(p.desc) + '</p><div class="pills">' + (p.links || []).map(function (l) { return pill(l, true); }).join('') + '</div></div>' +
        img(p.image, p.alt, 'shot in-img') + '</div><div class="in-meta"><div class="meta-l">' + meta.map(function (m) { return '<div><h5>' + esc(m.label) + '</h5><p>' + esc(m.value) + '</p></div>'; }).join('') +
        '</div><div class="meta-r"><h5>담당 역할</h5><ul>' + (p.roles || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div></div>' + foot(c, p.section, n) + '</section>';
    },
    gallery: function (p, n, c) {
      var pos = ['g-a', 'g-b', 'g-c', 'g-d'];
      return '<section class="page light gallery">' + tabs(c, p) + eyebrow(p) + '<div class="t-head"><h2 class="t-title">' + esc(p.title) + '</h2>' + pill(p.link) + '</div><div class="g-grid">' +
        (p.items || []).map(function (it, i) {
          return '<figure class="g-item ' + (pos[i] || '') + '"><img src="' + esc(src(it.image)) + '" alt="' + esc(it.alt || '') + '"' + LAZY + '><figcaption><b>' + esc(it.title) + '</b> ' + esc(it.caption) + '</figcaption></figure>';
        }).join('') + '</div>' + foot(c, p.section, n) + '</section>';
    },
    architecture: function (p, n, c) {
      return '<section class="page light arch-page">' + tabs(c, p) + eyebrow(p) + '<div class="t-head"><h2 class="t-title">' + esc(p.title) + '</h2>' + pill(p.link) + '</div><div class="ar-grid"><div class="ar-points">' +
        (p.lead ? '<p class="ar-lead">' + fmt(p.lead) + '</p>' : '') + (p.points || []).map(function (pt, i) {
          return '<div class="pt"><span>' + (i + 1) + '</span><div><h4>' + esc(pt.title) + '</h4><p>' + fmt(pt.text) + '</p></div></div>';
        }).join('') + codeCard(p.code, 'code-xs') + '</div><div class="ar-diag diag-scroll">' + ((window.PF_DIAGRAMS || {})[p.diagram] || '') + '</div></div>' + foot(c, p.section, n) + '</section>';
    },
    trouble: function (p, n, c) {
      return '<section class="page light trouble">' + tabs(c, p) + eyebrow(p) + '<div class="t-head"><h2 class="t-title">' + esc(p.title) + '</h2>' + pill(p.link) + '</div>' +
        '<div class="tr-grid"><div class="tr-text">' + blocks(p) + '</div><div class="tr-side">' + side(p.side) + '</div></div>' + foot(c, p.section, n) + '</section>';
    },
    cards: function (p, n, c) {
      return '<section class="page light more">' + tabs(c, p) + eyebrow(p) + '<div class="t-head"><h2 class="t-title">' + esc(p.title) + '</h2></div><div class="cards3">' + (p.cards || []).map(function (k) {
        return '<div class="mcard"><h3>' + esc(k.title) + '</h3><dl><dt>문제</dt><dd>' + fmt(k.problem) + '</dd><dt>해결</dt><dd>' + fmt(k.solution) + '</dd><dt>결과</dt><dd>' + fmt(k.result) + '</dd></dl>' + pill(k.link) + '</div>';
      }).join('') + '</div>' + foot(c, p.section, n) + '</section>';
    },
    learnings: function (p, n, c) {
      return '<section class="page light learn">' + tabs(c, p) + eyebrow(p) + '<h2 class="ln-title">' + esc(p.title || '배운 점') + '</h2><div class="lrn-grid">' + (p.items || []).map(function (t, i) {
        return '<div class="lrn"><span>LEARNING ' + (i < 9 ? '0' : '') + (i + 1) + '</span><p>' + fmt(t) + '</p></div>';
      }).join('') + '</div>' + (p.next ? '<div class="next"><span>NEXT</span><p>' + fmt(p.next) + '</p></div>' : '') + foot(c, p.section, n) + '</section>';
    },
    pair: function (p, n, c) {
      return '<section class="page light pair">' + tabs(c, p) + eyebrow(p) + '<div class="pair-grid">' + (p.items || []).map(function (h) {
        var bl = [['문제', h.problem], ['해결', h.solution], ['결과', h.result]].map(function (x) { return x[1] ? '<div class="hb"><b>' + x[0] + '</b><p>' + fmt(x[1]) + '</p></div>' : ''; }).join('');
        return '<div class="half">' + img(h.image, h.alt, 'shot half-img') + '<div class="half-head"><h3>' + esc(h.title) + '</h3>' + pill(h.link) + '</div>' + bl + side(h.side) + '</div>';
      }).join('') + '</div>' + foot(c, p.section, n) + '</section>';
    },
    thanks: function (p, n, c) {
      var pr = c.profile;
      var contact = [pr.name, pr.email, pr.phone].filter(Boolean).map(esc).join(' · ');
      return '<section class="page dark thanks" id="contact"><p class="eyebrow center">' + esc(p.eyebrow || 'THANK YOU') + '</p><h2 class="th-title">' + esc(p.title || '감사합니다') + '</h2>' +
        '<p class="th-lead">' + fmt(p.lead) + '</p><div class="th-links">' + (p.links || []).map(function (l) { return pill(l, true); }).join('') + '</div><p class="th-contact">' + contact + '</p></section>';
    }
  };

  /* ---------- 그리기 ---------- */
  function render(c) {
    var sy = window.scrollY;
    var pages = (c.pages || []).map(function (p, i) {
      var fn = PAGES[p.type];
      var html = fn ? fn(p, i + 1, c) : '';
      return html.replace('<section ', '<section data-idx="' + i + '" ');
    }).join('\n');
    document.title = (c.meta && c.meta.title) || '포트폴리오';
    if (MODE === 'web') {
      var links = '<a href="#about">About</a>' + (c.pages || []).filter(function (p) { return p.type === 'intro' && p.id; }).map(function (p) {
        return '<a href="#' + esc(p.id) + '">' + esc(p.title) + '</a>';
      }).join('') + '<a href="#contact">Contact</a><a href="pdf.html">PDF</a>';
      app.innerHTML = '<header class="topbar"><a href="#top" class="tb-name">' + esc(c.profile.name) + ' <span>' + esc(c.profile.navRole || '') + '</span></a><nav>' + links + '</nav></header><main>' + pages + '</main>';
    } else {
      app.innerHTML = pages;
      fitDeck();
      afterImages(checkOverflow);
    }
    if (PREVIEW) window.scrollTo(0, sy);
  }

  /* ---------- PDF 화면: 크기 맞추기·넘침 표시·인쇄 ---------- */
  function fitDeck() {
    var w = document.documentElement.clientWidth - 32;
    var z = Math.min(1, w / 1440);
    document.documentElement.style.setProperty('--deck-zoom', z.toFixed(4));
  }
  function afterImages(cb) {
    var imgs = Array.prototype.slice.call(app.querySelectorAll('img'));
    var left = imgs.length;
    var done = function () { if (--left <= 0) setTimeout(cb, 30); };
    if (!left) return setTimeout(cb, 30);
    imgs.forEach(function (im) { if (im.complete) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); } });
  }
  function checkOverflow() {
    var bad = [];
    Array.prototype.forEach.call(app.querySelectorAll('.page'), function (pg, i) {
      pg.classList.remove('overflow');
      var limit = pg.getBoundingClientRect().bottom - 46 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deck-zoom')) || 1);
      var over = false;
      Array.prototype.forEach.call(pg.querySelectorAll('*'), function (el) {
        if (over || el.closest('.foot') || el.closest('.cover') || el.closest('.thanks')) return;
        var r = el.getBoundingClientRect();
        if (r.height && r.bottom > limit + 1) over = true;
      });
      if (over) { pg.classList.add('overflow'); bad.push(i + 1); }
    });
    var st = document.getElementById('deck-status');
    if (st) st.textContent = bad.length ? '⚠ ' + bad.join(', ') + '쪽 내용이 페이지를 넘칩니다 — 글을 줄여 주세요' : '모든 페이지가 16:9 한 장 안에 들어갑니다';
    if (st) st.className = bad.length ? 'warn' : 'ok';
    if (PREVIEW && window.parent !== window) window.parent.postMessage({ type: 'pf-overflow', pages: bad }, location.origin);
  }
  if (MODE === 'deck' && PREVIEW) document.body.classList.add('is-preview');
  if (MODE === 'deck') {
    window.addEventListener('resize', function () { fitDeck(); });
    window.addEventListener('beforeprint', function () { document.documentElement.style.setProperty('--deck-zoom', '1'); });
    window.addEventListener('afterprint', fitDeck);
    var pb = document.getElementById('print-btn');
    if (pb) pb.addEventListener('click', function () { window.print(); });
  }

  function showError(msg) {
    app.innerHTML = '<div style="padding:40px 20px;max-width:720px;margin:0 auto;font:16px/1.7 system-ui,sans-serif"><h2>내용을 불러오지 못했습니다</h2><p>' + esc(msg) + '</p><p>content.json의 쉼표·따옴표를 확인하거나 편집 화면(edit.html)에서 다시 저장해 주세요.</p></div>';
  }

  /* ---------- 시작 ---------- */
  if (PREVIEW) {
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || !ev.data) return;
      if (ev.data.type === 'pf-content') { pendingImages = ev.data.images || {}; render(ev.data.content); }
      if (ev.data.type === 'pf-scroll') {
        var el = app.querySelector('[data-idx="' + ev.data.idx + '"]');
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (MODE === 'web' ? 52 : 12), behavior: 'smooth' });
      }
    });
    if (window.parent !== window) window.parent.postMessage({ type: 'pf-ready' }, location.origin);
  } else {
    fetch('content.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('content.json 응답 ' + r.status);
      return r.text();
    }).then(function (t) {
      var c;
      try { c = JSON.parse(t); } catch (err) { throw new Error('content.json 형식 오류: ' + err.message); }
      render(c);
      if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    }).catch(function (err) { showError(err.message); });
  }
  window.PF_RENDER = render;
})();
