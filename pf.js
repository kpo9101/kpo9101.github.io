/* 포트폴리오 웹 화면(portfolio.html) — content.json을 읽어 그리고, 모션을 붙입니다.
   글·숫자·이미지는 content.json(또는 edit.html)에서 고치고, 이 파일은 손대지 않아도 됩니다.
   16:9 PDF 화면(pdf.html)은 그대로 app.js + style.css가 그립니다. */
(function () {
  'use strict';
  var PARAMS = new URLSearchParams(location.search);
  var PREVIEW = PARAMS.has('preview');
  var app = document.getElementById('app');
  var root = document.documentElement;
  var pendingImages = {};
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var G = window.gsap;
  var ST = window.ScrollTrigger;
  var HAS_GSAP = !!(G && ST);
  var MOTION = HAS_GSAP && !PREVIEW && !mqReduce.matches;
  if (HAS_GSAP) {
    G.config({ nullTargetWarn: false });
    G.registerPlugin(ST);
    [window.SplitText, window.ScrambleTextPlugin, window.DrawSVGPlugin].forEach(function (p) { if (p) G.registerPlugin(p); });
  }
  var EASE = 'expo.out';
  var content = null;
  var ctx = null;          // gsap.context — 다시 그릴 때 한꺼번에 정리
  var io = null;           // 등장 애니메이션 관찰자
  var cleanups = [];       // 다시 그릴 때 정리할 리스너들

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
  function fmtB(s) { return fmt(s).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>'); }
  function src(path) { return pendingImages[path] || path; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* ---------- 코드 하이라이트 (줄 단위) ---------- */
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
  function codeLines(code) {
    return String(code).replace(/^\n+|\n+$/g, '').split('\n').map(function (line, i) {
      return '<span class="ln"><i aria-hidden="true">' + (i + 1) + '</i><span>' + (hl(line) || ' ') + '</span></span>';
    }).join('');
  }

  /* ---------- 공통 조각 ---------- */
  var ICONS = {
    gh: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    yt: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12a31 31 0 00.5 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.5-4.8 31 31 0 00-.5-4.8zM9.75 15.02V8.98L15.5 12z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8"/></svg>',
    file: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3"/></svg>',
    arrow: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M2 8h11M9 4l4 4-4 4"/></svg>',
    check: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3 8.5l3 3 7-7"/></svg>',
    mail: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="M1.5 3.5h13v9h-13zM1.5 4l6.5 5 6.5-5"/></svg>'
  };
  function pill(l, extra) {
    if (!l || !l.url) return '';
    return '<a class="pill mag' + (extra ? ' ' + extra : '') + '" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + (ICONS[l.icon] || ICONS.gh) + '<span>' + esc(l.label || '링크') + '</span></a>';
  }
  var DEFAULT_TAB = { gallery: 'OVERVIEW', architecture: 'ARCHITECTURE', trouble: 'TROUBLESHOOTING', cards: 'TROUBLESHOOTING', pair: 'TROUBLESHOOTING', learnings: 'LEARNINGS' };
  function crumbOf(text) {
    return String(text || '').split(/\s*·\s*/).filter(Boolean).map(esc).join('<i>/</i>');
  }
  function sh(p, n, c, label) {
    var set = (c.tabsets || {})[p.tabs];
    var on = p.tab || DEFAULT_TAB[p.type] || '';
    var tabsHtml = set ? '<ol class="sh-tabs" aria-hidden="true">' + set.map(function (t) { return '<li' + (t === on ? ' class="on"' : '') + '>' + esc(t) + '</li>'; }).join('') + '</ol>' : '';
    return '<div class="sh wrap"><span class="sh-idx">§' + pad2(n) + '</span><span class="sh-crumb">' + crumbOf(label) + '</span><span class="sh-fill" aria-hidden="true"></span>' + tabsHtml + '</div>';
  }
  function frame(path, alt, cls, capHtml, opts) {
    if (!path) return '';
    opts = opts || {};
    var lazy = opts.eager ? '' : ' loading="lazy"';
    var name = String(path).split('/').pop();
    var bar = opts.bar === false ? '' : '<span class="fr-bar" aria-hidden="true"><span>' + esc(name) + '</span><span data-dim></span></span>';
    return '<figure class="frame ' + (cls || '') + '" data-r="clip">' + bar + '<span class="fr-media"><img src="' + esc(src(path)) + '" alt="' + esc(alt || '') + '"' + lazy + ' decoding="async"></span>' + (capHtml || '') + '<i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i></figure>';
  }
  function playBtn(yt, title) {
    if (!yt) return '';
    return '<button type="button" class="play" data-yt="' + esc(yt.id) + '" data-yt-url="' + esc(yt.url) + '" data-yt-title="' + esc((title || '') + ' ' + yt.label) + '">' +
      '<span class="play-i" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M4 2.5v11l9.5-5.5z"/></svg></span>' +
      '<span class="play-t"><b>' + esc(yt.label) + ' 재생</b><small>페이지에서 바로 보기</small></span></button>';
  }
  function codeCard(b) {
    if (!b || !b.code) return '';
    return '<div class="code' + (b.size === 'xs' ? ' code-xs' : '') + '" data-r="code"><div class="code-bar"><span class="code-file">' + ICONS.file + esc(b.file || 'code') + '</span><span class="code-lang">C++</span></div><pre><code>' + codeLines(b.code) + '</code></pre><i class="code-scan" aria-hidden="true"></i></div>';
  }
  function steps3(p, cls) {
    var keys = [['problem', '문제', 'PROBLEM'], ['solution', '해결', 'SOLUTION'], ['result', '결과', 'RESULT']];
    return keys.map(function (k, i) {
      if (!p[k[0]]) return '';
      return '<div class="step s-' + k[0] + (cls ? ' ' + cls : '') + '"><p class="step-k"><i class="step-dot" aria-hidden="true"></i><b>' + k[1] + '</b><span>' + pad2(i + 1) + ' · ' + k[2] + '</span></p><p class="step-t">' + fmt(p[k[0]]) + '</p></div>';
    }).join('');
  }
  function metric(m) {
    return '<div class="metric"><strong class="num" data-count>' + esc(m.value) + '</strong><span>' + esc(m.label) + '</span>' + (m.sub ? '<small>' + esc(m.sub) + '</small>' : '') + '</div>';
  }
  // 링크 목록에서 YouTube 영상 찾기 → { id, url, label }
  function ytOf(links) {
    var out = null;
    (links || []).some(function (l) {
      var m = l && l.url && String(l.url).match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
      if (m) out = { id: m[1], url: l.url, label: l.label || '시연 영상' };
      return !!m;
    });
    return out;
  }
  // "TROUBLESHOOTING 07–09" → [7, 8, 9]
  function rangeOf(eyebrow, count) {
    var m = String(eyebrow || '').match(/(\d+)\s*[–\-~]\s*(\d+)/);
    if (!m) return null;
    var a = parseInt(m[1], 10), out = [];
    for (var i = 0; i < count; i++) out.push(pad2(a + i));
    return out;
  }

  /* ---------- 오른쪽 자료 블록 ---------- */
  var SIDE = {
    image: function (b) {
      if (!b.src) return '';
      var cap = '';
      if (b.caption) {
        var parts = fmt(b.caption).split('<br>');
        var head = parts.shift().replace(/<\/?em>/g, '');
        cap = '<figcaption><b>' + head + '</b>' + (parts.length ? '<span>' + parts.join('<br>') + '</span>' : '') + '</figcaption>';
      }
      var cls = 'shot' + (b.height === 'short' ? ' short' : '') + (b.height === 'tall' ? ' tall' : '') + (b.fit === 'contain' ? ' contain' : '') + (b.caption ? ' has-cap' : '');
      return frame(b.src, b.alt, cls, cap);
    },
    code: function (b) { return codeCard(b); },
    diagram: function (b) {
      if (b.id === 'sat') return satPanel();
      var svg = (window.PF_DIAGRAMS || {})[b.id] || '';
      return svg ? '<div class="viewport" data-r="diagram" data-diagram="' + esc(b.id) + '"><div class="vp-body diag-scroll">' + svg + '</div></div>' : '';
    },
    metrics: function (b) {
      var items = b.items || [];
      return '<div class="metrics n' + Math.min(items.length, 3) + '" data-r="up">' + items.map(metric).join('') + '</div>';
    },
    note: function (b) { return b.text ? '<p class="note">' + fmt(b.text) + '</p>' : ''; },
    example: function (b) { return b.text ? '<div class="example" data-r="up"><span class="tag">EXAMPLE</span><p>' + fmtB(b.text) + '</p></div>' : ''; },
    flow: function (b) {
      var st = (b.steps || []).map(function (s, i, a) {
        return '<li' + (i === a.length - 1 ? ' class="ok"' : '') + '><span class="fl-n">' + pad2(i + 1) + '</span><span class="fl-t">' + esc(s) + '</span></li>';
      }).join('');
      return '<div class="flow" data-r="flow"><p class="blk-h"><span>PIPELINE</span><span>' + (b.steps || []).length + ' STEPS</span></p><ol class="fl-row">' + st + '</ol>' +
        (b.fail ? '<p class="fl-back"><span class="tag">ROLLBACK</span><span>' + fmtB(b.fail) + '</span></p>' : '') +
        (b.undo ? '<p class="fl-undo"><span class="tag">UNDO</span><span>' + fmtB(b.undo) + '</span></p>' : '') + '</div>';
    },
    compare: function (b) {
      return '<div class="cmp" data-r="cmp">' + (b.columns || []).map(function (c) {
        return '<div class="cmp-col ' + (c.tone === 'ok' ? 'ok' : 'bad') + '"><p class="cmp-h"><i aria-hidden="true"></i>' + esc(c.title) + '</p>' +
          '<div class="node top' + (c.topGhost ? ' ghost' : '') + '"><b>' + esc(c.top) + '</b>' + (c.topNote ? '<small>' + esc(c.topNote) + '</small>' : '') + '</div>' +
          (c.arrow ? '<p class="link">' + esc(c.arrow) + '</p>' : '') +
          (c.bottom ? '<div class="node bottom"><b>' + esc(c.bottom) + '</b></div>' : '') +
          (c.pos ? '<p class="pos">' + fmtB(c.pos) + '</p>' : '') + '</div>';
      }).join('') + '</div>';
    },
    sameEval: function (b) {
      return '<div class="same" data-r="same"><div class="se-src">' + (b.sources || []).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') +
        '</div><svg class="se-join" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0 C50 24 100 14 100 40"/><path d="M150 0 C150 24 100 14 100 40"/></svg><div class="se-core">' + fmtB(b.core) + '</div></div>';
    },
    formula: function (b) {
      var main = fmtB(b.main).replace(/^([^=]+)=/, '<span class="fx-k">$1</span>=');
      return '<div class="formula" data-r="up"><div class="fx">' + main + '</div>' + (b.rows || []).map(function (r) {
        return '<div class="fx-row"><span>' + esc(r.k) + '</span><p>' + fmt(r.v) + '</p></div>';
      }).join('') + (b.tags ? '<div class="fx-tags">' + String(b.tags).split(/\s*·\s*/).map(function (t) { return '<span>' + ICONS.check + esc(t) + '</span>'; }).join('') + '</div>' : '') + '</div>';
    },
    steps: function (b) {
      var parts = (b.items || []).map(function (s) { return '<li>' + fmt(s) + '</li>'; });
      if (b.last) parts.push('<li class="ok">' + fmt(b.last) + '</li>');
      return '<ol class="pipe" data-r="pipe">' + parts.join('') + '</ol>';
    }
  };
  function side(list) { return (list || []).map(function (b) { return (SIDE[b.type] || function () { return ''; })(b); }).join(''); }

  /* ---------- 페이지 종류 ---------- */
  function hudLabel(p) {
    return ({ cover: 'VIEWPORT', about: 'ABOUT', contents: 'CONTENTS', thanks: 'CONTACT' })[p.type] || (p.type === 'intro' ? p.section : (p.eyebrow || p.section || ''));
  }
  var PAGES = {
    cover: function (p, n, c) {
      var pr = c.profile;
      var ct = (c.pages || []).filter(function (q) { return q.type === 'contents'; })[0];
      var items = ct ? ct.items || [] : [];
      var title = p.title || 'PORTFOLIO';
      return '<section class="hero" id="top">' +
        '<div class="hero-grid" aria-hidden="true"></div>' +
        '<div class="hero-inner wrap">' +
        '<p class="hero-role">' + esc(pr.role) + '</p>' +
        '<h1 class="hero-title" aria-label="' + esc(title) + '"><span>' + esc(title) + '</span></h1>' +
        '<div class="hero-meta"><p class="hero-id"><strong>' + esc(pr.name) + '</strong><span>' + esc(pr.navRole || '') + '</span></p><p class="hero-contact">' +
        (pr.email ? '<span>' + ICONS.mail + esc(pr.email) + '</span>' : '') +
        (pr.github ? '<a href="' + esc(pr.github) + '" target="_blank" rel="noopener">' + ICONS.gh + esc(pr.githubLabel || pr.github) + '</a>' : '') + '</p></div>' +
        (items.length ? '<ol class="hero-index">' + items.map(function (it) {
          return '<li><a href="#' + esc(it.anchor) + '"><span class="hi-n">' + esc(it.num) + '</span><span class="hi-b"><b>' + esc(it.title) + '</b><span>' + (it.topics || []).slice(0, 3).map(esc).join(' · ') + '</span></span><span class="hi-go">' + ICONS.arrow + '</span></a></li>';
        }).join('') + '</ol>' : '') +
        '</div><p class="scroll-cue" aria-hidden="true"><span>SCROLL</span><i></i></p></section>';
    },
    about: function (p, n, c) {
      return '<section class="sec about" id="about">' + sh(p, n, c, p.eyebrow || 'ABOUT ME') +
        '<div class="wrap ab-grid"><div class="ab-main"><h2 class="ab-title" data-r="lines">' + fmt(p.title) + '</h2><p class="ab-lead" data-r="up">' + fmt(p.lead) + '</p></div>' +
        '<aside class="ab-spec" data-r="up"><p class="lbl">SKILLS <span>' + (p.skills || []).length + '</span></p><ul class="skills">' + (p.skills || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></aside></div>' +
        '<div class="wrap mods"><p class="lbl">PROFICIENCY</p><div class="mods-grid">' + (p.cards || []).map(function (k) {
          return '<article class="mod-card spot" data-r="up"><h3>' + esc(k.title) + '</h3><p>' + fmt(k.text) + '</p>' + (k.note ? '<p class="mod-note">' + ICONS.check + '<span>' + esc(k.note) + '</span></p>' : '') + '<i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i></article>';
        }).join('') + '</div></div></section>';
    },
    contents: function (p, n, c) {
      return '<section class="sec contents" id="contents">' + sh(p, n, c, p.eyebrow || 'CONTENTS') + '<div class="wrap"><ol class="ct">' + (p.items || []).map(function (it) {
        return '<li data-r="up"><a class="ct-row" href="#' + esc(it.anchor) + '"><span class="ct-num">' + esc(it.num) + '</span><span class="ct-body"><b class="ct-title">' + esc(it.title) + '</b><span class="ct-meta">' + esc(it.meta) + '</span><span class="ct-tags">' +
          (it.topics || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</span></span>' +
          (it.image ? '<span class="ct-thumb"><img src="' + esc(src(it.image)) + '" alt="' + esc(it.alt || '') + '" loading="lazy" decoding="async"></span>' : '') + '<span class="ct-go">' + ICONS.arrow + '</span></a></li>';
      }).join('') + '</ol></div></section>';
    },
    intro: function (p, n, c) {
      var meta = p.meta || [];
      return '<section class="sec intro" id="' + esc(p.id) + '">' + sh(p, n, c, 'PROJECT ' + (p.num || '') + ' · ' + (p.section || '')) +
        '<div class="wrap in-head"><p class="in-num" aria-hidden="true"><span>' + esc(p.num) + '</span><i class="in-rule"></i><b>PROJECT</b></p><h2 class="in-title" data-r="chars">' + esc(p.title) + '</h2></div>' +
        '<div class="wrap in-grid"><div class="in-text"><p class="in-desc" data-r="up">' + fmt(p.desc) + '</p><div class="pills" data-r="up">' + (p.links || []).map(function (l) { return pill(l); }).join('') + '</div></div>' +
        frame(p.image, p.alt, 'in-img', playBtn(ytOf(p.links), p.title), {}) + '</div>' +
        '<div class="wrap in-meta" data-r="up"><dl>' + meta.map(function (m) { return '<div><dt>' + esc(m.label) + '</dt><dd>' + esc(m.value) + '</dd></div>'; }).join('') + '</dl>' +
        '<div class="in-roles"><p class="lbl">담당 역할</p><ul>' + (p.roles || []).map(function (r) { return '<li>' + ICONS.check + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul></div></div></section>';
    },
    gallery: function (p, n, c) {
      return '<section class="sec gallery">' + sh(p, n, c, p.eyebrow) + '<div class="wrap t-head"><h2 class="t-title" data-r="lines">' + esc(p.title) + '</h2>' + pill(p.link) + '</div>' +
        '<div class="wrap bento">' + (p.items || []).map(function (it, i) {
          return '<figure class="b-item b-' + i + '" data-r="clip"><button type="button" class="b-media" data-lb="' + i + '" aria-label="' + esc((it.title || '') + ' 크게 보기') + '"><img src="' + esc(src(it.image)) + '" alt="' + esc(it.alt || '') + '" loading="lazy" decoding="async"><span class="b-zoom" aria-hidden="true">+</span><i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i></button>' +
            '<figcaption><span class="fig">FIG.' + pad2(i + 1) + '</span><b>' + esc(it.title) + '</b><span>' + esc(it.caption) + '</span></figcaption></figure>';
        }).join('') + '</div></section>';
    },
    architecture: function (p, n, c) {
      var svg = (window.PF_DIAGRAMS || {})[p.diagram] || '';
      return '<section class="sec arch">' + sh(p, n, c, p.eyebrow) + '<div class="wrap t-head"><h2 class="t-title" data-r="lines">' + esc(p.title) + '</h2>' + pill(p.link) + '</div>' +
        '<div class="wrap ar-grid"><div class="ar-left">' + (p.lead ? '<p class="ar-lead" data-r="up">' + fmt(p.lead) + '</p>' : '') +
        '<ol class="pts">' + (p.points || []).map(function (pt) { return '<li data-r="up"><h3>' + esc(pt.title) + '</h3><p>' + fmt(pt.text) + '</p></li>'; }).join('') + '</ol>' + codeCard(p.code) + '</div>' +
        (svg ? '<div class="ar-right"><div class="viewport" data-r="diagram" data-diagram="' + esc(p.diagram) + '"><p class="vp-bar"><span>' + esc(p.diagram) + '.svg</span><span>CLASS DIAGRAM</span><span class="vp-hint">← 좌우로 밀어 보기 →</span></p><div class="vp-body diag-scroll">' + svg + '</div></div></div>' : '') +
        '</div></section>';
    },
    trouble: function (p, n, c) {
      var no = (String(p.eyebrow || '').match(/TROUBLESHOOTING\s*(\d+)/i) || [])[1];
      return '<section class="sec trouble">' + sh(p, n, c, p.eyebrow) +
        '<div class="wrap t-head">' + (no ? '<p class="tr-no" aria-hidden="true"><span>CASE</span><b>' + esc(no) + '</b></p>' : '') + '<h2 class="t-title" data-r="lines">' + esc(p.title) + '</h2>' + pill(p.link) + '</div>' +
        '<div class="wrap tr-grid"><div class="tr-flow"><div class="tr-col"><span class="tr-line" aria-hidden="true"><i></i></span>' + steps3(p) + '</div></div><div class="tr-side">' + side(p.side) + '</div></div></section>';
    },
    cards: function (p, n, c) {
      var nums = rangeOf(p.eyebrow, (p.cards || []).length);
      return '<section class="sec more">' + sh(p, n, c, p.eyebrow) + '<div class="wrap t-head"><h2 class="t-title" data-r="lines">' + esc(p.title) + '</h2></div><div class="wrap cards3">' + (p.cards || []).map(function (k, i) {
        return '<article class="mcard spot" data-r="up">' + (nums ? '<p class="mc-no">CASE ' + nums[i] + '</p>' : '') + '<h3>' + esc(k.title) + '</h3><dl>' +
          [['문제', k.problem, 'problem'], ['해결', k.solution, 'solution'], ['결과', k.result, 'result']].map(function (x) { return x[1] ? '<div class="mc-' + x[2] + '"><dt>' + x[0] + '</dt><dd>' + fmt(x[1]) + '</dd></div>' : ''; }).join('') +
          '</dl>' + pill(k.link, 'sm') + '<i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i></article>';
      }).join('') + '</div></section>';
    },
    learnings: function (p, n, c) {
      return '<section class="sec learn">' + sh(p, n, c, p.eyebrow) + '<div class="wrap ln-grid"><h2 class="ln-title" data-r="lines">' + esc(p.title || '배운 점') + '</h2><ol class="ln-list">' + (p.items || []).map(function (t, i) {
        return '<li data-r="up"><span class="ln-n">' + pad2(i + 1) + '</span><p>' + fmt(t) + '</p></li>';
      }).join('') + '</ol>' + (p.next ? '<div class="next" data-r="up"><p class="next-k">NEXT' + ICONS.arrow + '</p><p class="next-t">' + fmt(p.next) + '</p></div>' : '') + '</div></section>';
    },
    pair: function (p, n, c) {
      var nums = rangeOf(p.eyebrow, (p.items || []).length);
      return '<section class="sec pair">' + sh(p, n, c, p.eyebrow) + '<div class="wrap pair-grid">' + (p.items || []).map(function (h, i) {
        return '<article class="half">' + (h.image ? frame(h.image, h.alt, 'half-img', '') : '') +
          '<div class="half-head">' + (nums ? '<p class="tr-no sm" aria-hidden="true"><span>CASE</span><b>' + nums[i] + '</b></p>' : '') + '<h3 data-r="lines">' + esc(h.title) + '</h3>' + pill(h.link, 'sm') + '</div>' +
          '<div class="tr-col compact"><span class="tr-line" aria-hidden="true"><i></i></span>' + steps3(h) + '</div>' + '<div class="half-side">' + side(h.side) + '</div></article>';
      }).join('') + '</div></section>';
    },
    thanks: function (p, n, c) {
      var pr = c.profile;
      var about = (c.pages || []).filter(function (q) { return q.type === 'about'; })[0];
      var skills = about ? about.skills || [] : [];
      var mq = skills.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');
      return '<section class="sec thanks" id="contact">' + sh(p, n, c, 'CONTACT') +
        '<div class="wrap th"><p class="th-eyebrow">' + esc(p.eyebrow || 'THANK YOU') + '</p><h2 class="th-title" data-r="chars">' + esc(p.title || '감사합니다') + '</h2>' +
        '<p class="th-lead" data-r="up">' + fmt(p.lead) + '</p>' +
        '<div class="th-contact" data-r="up">' + (pr.email ? '<button type="button" class="copy mag" data-copy="' + esc(pr.email) + '">' + ICONS.mail + '<span class="copy-v">' + esc(pr.email) + '</span><span class="copy-s" aria-live="polite">복사</span></button>' : '') +
        (p.links || []).map(function (l) { return pill(l); }).join('') + '</div></div>' +
        (mq ? '<div class="marquee" aria-hidden="true"><div class="mq-track"><div class="mq-set">' + mq + '</div><div class="mq-set">' + mq + '</div></div></div>' : '') +
        '<footer class="foot wrap"><span>© ' + new Date().getFullYear() + ' ' + esc(pr.name) + ' · Built with HTML · CSS · JS</span><a href="#top">맨 위로 ↑</a></footer></section>';
    }
  };

  /* ---------- 그리기 ---------- */
  function navLinks(c) {
    return [['#about', 'About']].concat((c.pages || []).filter(function (p) { return p.type === 'intro' && p.id; }).map(function (p) { return ['#' + p.id, p.title]; }))
      .concat([['#contact', 'Contact'], ['pdf.html', 'PDF']]);
  }
  function render(c) {
    content = c;
    teardown();
    var sy = window.scrollY;
    var pages = c.pages || [];
    var html = pages.map(function (p, i) {
      var fn = PAGES[p.type];
      var h = fn ? fn(p, i + 1, c) : '';
      var hud = hudLabel(p);
      return h.replace(/^<section /, '<section data-idx="' + i + '" data-hud="' + esc(hud) + '" ');
    });
    var heroIdx = pages.findIndex ? pages.findIndex(function (p) { return p.type === 'cover'; }) : -1;
    var hero = heroIdx === 0 ? html.shift() : '';
    document.title = (c.meta && c.meta.title) || '포트폴리오';
    var links = navLinks(c);
    var total = pages.length;
    var rail = pages.map(function (p, i) {
      var id = p.id || (p.type === 'cover' ? 'top' : p.type === 'about' ? 'about' : p.type === 'thanks' ? 'contact' : p.type === 'contents' ? 'contents' : '');
      return '<li><a href="#' + (id || 's' + pad2(i + 1)) + '" data-rail="' + i + '" class="' + (p.type === 'intro' ? 'major' : '') + '"><i></i><span>' + pad2(i + 1) + ' · ' + esc(hudLabel(p)) + '</span></a></li>';
    }).join('');
    app.innerHTML =
      '<header class="topbar"><a href="#top" class="tb-brand"><span class="tb-mark" aria-hidden="true">H</span><b>' + esc(c.profile.name) + '</b><span class="tb-role">' + esc(c.profile.navRole || '') + '</span></a>' +
      '<p class="tb-hud" aria-hidden="true"><span class="tb-idx" data-hud-idx>01/' + pad2(total) + '</span><span class="tb-label" data-hud-label>VIEWPORT</span></p>' +
      '<nav class="tb-nav" aria-label="주요 메뉴">' + links.map(function (l) { return '<a href="' + esc(l[0]) + '">' + esc(l[1]) + '</a>'; }).join('') + '<a href="./" class="tb-resume">← 이력서</a></nav>' +
      '<button type="button" class="tb-menu" aria-expanded="false" aria-controls="menu"><span>MENU</span><i aria-hidden="true"></i></button><i class="tb-progress" aria-hidden="true"></i></header>' +
      '<div class="menu" id="menu" hidden><nav aria-label="전체 메뉴">' + links.map(function (l, i) { return '<a href="' + esc(l[0]) + '"><span>' + pad2(i + 1) + '</span>' + esc(l[1]) + '</a>'; }).join('') + '<a href="./" class="m-resume"><span>←</span>이력서로 돌아가기</a></nav></div>' +
      '<nav class="rail" aria-label="페이지 바로가기"><ol>' + rail + '</ol></nav>' +
      hero + '<main id="main" class="main">' + html.join('\n') + '</main>' +
      '<dialog class="lb" aria-label="크게 보기"><figure><img alt=""><figcaption></figcaption></figure><div class="lb-vbox" hidden><div class="lb-video"></div><a class="lb-ext" target="_blank" rel="noopener">YouTube에서 보기 ↗</a></div><button type="button" class="lb-x" aria-label="닫기">✕</button><button type="button" class="lb-p" aria-label="이전 이미지">←</button><button type="button" class="lb-n" aria-label="다음 이미지">→</button><p class="lb-c" aria-hidden="true"></p></dialog>';
    // id가 없는 섹션에는 레일용 id를 붙입니다
    Array.prototype.forEach.call(app.querySelectorAll('[data-idx]'), function (s) {
      if (!s.id) s.id = 's' + pad2(parseInt(s.getAttribute('data-idx'), 10) + 1);
    });
    setup();
    if (PREVIEW) window.scrollTo(0, sy);
  }

  /* ---------- 공통 동작 ---------- */
  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); cleanups.push(function () { el.removeEventListener(ev, fn, opt); }); }
  function teardown() {
    cleanups.forEach(function (f) { try { f(); } catch (e) { /* 무시 */ } });
    cleanups = [];
    if (io) { io.disconnect(); io = null; }
    if (ctx) { ctx.revert(); ctx = null; }
    demos.forEach(function (d) { d.destroy(); });
    demos = [];
  }

  function setup() {
    var topbar = app.querySelector('.topbar');
    var prog = app.querySelector('.tb-progress');
    var hudIdx = app.querySelector('[data-hud-idx]');
    var hudLbl = app.querySelector('[data-hud-label]');
    var railLinks = app.querySelectorAll('[data-rail]');
    var sections = app.querySelectorAll('[data-idx]');
    var total = sections.length;

    /* 스크롤 진행 막대 + 위쪽 막대 숨김/표시 */
    var lastY = window.scrollY, ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')';
        var menuOpen = topbar.classList.contains('open');
        if (!menuOpen && y > 240 && y > lastY + 4) topbar.classList.add('tuck');
        else if (y < lastY - 4 || y <= 240) topbar.classList.remove('tuck');
        topbar.classList.toggle('solid', y > 8);
        lastY = y;
      });
    }
    on(window, 'scroll', onScroll, { passive: true });
    onScroll();
    on(topbar, 'focusin', function () { topbar.classList.remove('tuck'); });

    /* 지금 보고 있는 섹션 → 위쪽 HUD·오른쪽 레일 */
    var current = -1;
    function setCurrent(i) {
      if (i === current || i < 0) return;
      current = i;
      var s = sections[i];
      var label = s.getAttribute('data-hud') || '';
      hudIdx.textContent = pad2(i + 1) + '/' + pad2(total);
      if (MOTION && G.plugins && window.ScrambleTextPlugin) {
        G.to(hudLbl, { duration: 0.6, scrambleText: { text: label, chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·', speed: 0.6 }, overwrite: true });
      } else hudLbl.textContent = label;
      Array.prototype.forEach.call(railLinks, function (a) { a.classList.toggle('on', a.getAttribute('data-rail') === String(i)); });
    }
    var bandIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setCurrent(parseInt(e.target.getAttribute('data-idx'), 10)); });
    }, { rootMargin: '-38% 0px -61% 0px' });
    Array.prototype.forEach.call(sections, function (s) { bandIO.observe(s); });
    cleanups.push(function () { bandIO.disconnect(); });
    setCurrent(0);

    /* 모바일 메뉴 */
    var menuBtn = app.querySelector('.tb-menu'), menu = app.querySelector('#menu');
    function setMenu(open) {
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      topbar.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      if (open) {
        menu.hidden = false;
        if (MOTION) G.fromTo(menu.querySelectorAll('a'), { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.05, ease: EASE });
        var first = menu.querySelector('a'); if (first) first.focus({ preventScroll: true });
      } else menu.hidden = true;
    }
    on(menuBtn, 'click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    on(menu, 'click', function (e) { if (e.target.closest('a')) setMenu(false); });
    on(document, 'keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

    /* 이미지 크기 표시 (프레임 위쪽 띠) */
    Array.prototype.forEach.call(app.querySelectorAll('.frame'), function (f) {
      var im = f.querySelector('img'), dim = f.querySelector('[data-dim]');
      if (!im || !dim) return;
      var put = function () { if (im.naturalWidth) dim.textContent = im.naturalWidth + ' × ' + im.naturalHeight; };
      if (im.complete) put(); else on(im, 'load', put);
    });

    /* 이메일 복사 */
    Array.prototype.forEach.call(app.querySelectorAll('[data-copy]'), function (b) {
      on(b, 'click', function () {
        var v = b.getAttribute('data-copy'), s = b.querySelector('.copy-s');
        var done = function (ok) { s.textContent = ok ? '복사됨' : '선택됨'; b.classList.add('done'); setTimeout(function () { s.textContent = '복사'; b.classList.remove('done'); }, 1800); };
        var fallback = function () {
          var r = document.createRange(); r.selectNodeContents(b.querySelector('.copy-v'));
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); done(false);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function () { done(true); }, fallback);
        else fallback();
      });
    });

    /* 같은 페이지 안 링크는 부드럽게 이동 */
    on(app, 'click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      var t = id ? document.getElementById(id) : null;
      if (!t) return;
      e.preventDefault();
      var y = id === 'top' ? 0 : t.getBoundingClientRect().top + window.scrollY - (t.classList.contains('sec') ? 0 : 64);
      window.scrollTo({ top: y, behavior: mqReduce.matches ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });

    setupLightbox();
    setupSpot();
    Array.prototype.forEach.call(app.querySelectorAll('.satx'), function (box) {
      var d = createSatDemo(box);
      if (d) { box.__demo = d; demos.push(d); }
    });
    if (MOTION) setupMotion();
    else {
      // 모션이 꺼져 있으면 끝난 상태로 바로 보여 줍니다
      Array.prototype.forEach.call(app.querySelectorAll('.step'), function (s) { s.classList.add('on'); });
      Array.prototype.forEach.call(app.querySelectorAll('.cmp'), function (s) { s.classList.add('cooked'); });
      root.classList.remove('mp');
    }
  }

  /* ---------- 화면 모음 크게 보기 ---------- */
  function setupLightbox() {
    var dlg = app.querySelector('.lb');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    var img = dlg.querySelector('img'), cap = dlg.querySelector('figcaption'), cnt = dlg.querySelector('.lb-c');
    var list = [], at = 0, opener = null;
    var vbox = dlg.querySelector('.lb-vbox'), vwrap = dlg.querySelector('.lb-video'), vext = dlg.querySelector('.lb-ext'), fig = dlg.querySelector('figure');
    function show(i) {
      at = (i + list.length) % list.length;
      var b = list[at], im = b.querySelector('img'), fig = b.closest('figure');
      img.src = im.currentSrc || im.src; img.alt = im.alt;
      var t = fig.querySelector('figcaption b'), d = fig.querySelector('figcaption > span:last-child');
      cap.innerHTML = '<b>' + esc(t ? t.textContent : '') + '</b>' + esc(d ? d.textContent : '');
      cnt.textContent = pad2(at + 1) + ' / ' + pad2(list.length);
    }
    on(app, 'click', function (e) {
      var v = e.target.closest('[data-yt]');
      if (v) {
        opener = v;
        var id = v.getAttribute('data-yt');
        dlg.classList.add('is-video'); fig.hidden = true; vbox.hidden = false;
        vwrap.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="' + esc(v.getAttribute('data-yt-title') || '시연 영상') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>';
        vext.href = v.getAttribute('data-yt-url');
        dlg.showModal();
        dlg.querySelector('.lb-x').focus(); // Esc로 바로 닫히도록 포커스를 닫기 버튼에
        if (MOTION) G.fromTo(vbox, { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: EASE });
        return;
      }
      var b = e.target.closest('[data-lb]');
      if (!b) return;
      dlg.classList.remove('is-video'); fig.hidden = false; vbox.hidden = true;
      list = Array.prototype.slice.call(b.closest('.bento').querySelectorAll('[data-lb]'));
      opener = b;
      show(list.indexOf(b));
      dlg.showModal();
      if (MOTION) G.fromTo(dlg.querySelector('figure'), { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: EASE });
    });
    on(dlg.querySelector('.lb-x'), 'click', function () { dlg.close(); });
    on(dlg.querySelector('.lb-p'), 'click', function () { show(at - 1); });
    on(dlg.querySelector('.lb-n'), 'click', function () { show(at + 1); });
    on(dlg, 'click', function (e) { if (e.target === dlg) dlg.close(); });
    on(dlg, 'keydown', function (e) {
      if (dlg.classList.contains('is-video')) return;
      if (e.key === 'ArrowLeft') show(at - 1); if (e.key === 'ArrowRight') show(at + 1);
    });
    on(dlg, 'close', function () {
      vwrap.innerHTML = ''; // 닫으면 영상도 멈춥니다
      if (opener) opener.focus({ preventScroll: true });
    });
  }

  /* ---------- 카드 위 커서 조명 + 버튼 자석 효과 ---------- */
  function setupSpot() {
    if (!mqFine.matches || PREVIEW) return;
    on(app, 'pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.spot');
      if (card) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
      if (!MOTION) return;
      var m = e.target.closest && e.target.closest('.mag');
      if (m) {
        var b = m.getBoundingClientRect();
        G.to(m, { x: (e.clientX - b.left - b.width / 2) * 0.22, y: (e.clientY - b.top - b.height / 2) * 0.3, duration: 0.4, ease: 'power3.out' });
      }
    }, { passive: true });
    if (MOTION) on(app, 'pointerout', function (e) {
      var m = e.target.closest && e.target.closest('.mag');
      if (m && !m.contains(e.relatedTarget)) G.to(m, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    });
  }

  /* =====================================================================
     트러블슈팅 01의 SAT 데모 — 두 시설 영역(OBB)을 분리축 정리(SAT)로 실시간 판정합니다.
     커서로 시설 B를 옮기고 클릭하면 45° 회전합니다(터치는 누른 곳으로 이동 + 회전 버튼).
     AABB(점선)는 겹치는데 OBB는 떨어져 있으면 '오탐 방지(FALSE POSITIVE FILTERED)'가 켜집니다.
     ===================================================================== */
  var demos = [];
  function satPanel() {
    return '<div class="satx" data-r="satx">' +
      '<p class="vp-bar satx-bar"><span>sat_demo</span><span class="satx-yaw">yaw A <b data-ya>4,500</b> · B <b data-yb>4,500</b> <small>×0.01°</small></span><span class="satx-btns">' +
      '<button type="button" data-sat-rot>↻ B 45° 회전</button><button type="button" data-sat-reset>오탐 상황으로</button></span></p>' +
      '<div class="satx-view"><div class="satx-stage"><canvas tabindex="0" role="img" aria-label="두 시설 영역의 AABB와 OBB·SAT 판정 비교 데모. 방향키로 시설 B를 옮기고 R 키로 45도 회전합니다."></canvas></div>' +
      '<div class="satx-hud" aria-hidden="true"><p class="hud-chip" data-aabb><i></i><span>AABB</span><b>HIT</b></p><p class="hud-chip" data-sat><i></i><span>OBB · SAT</span><b>CLEAR</b></p><p class="hud-chip fp" data-fp><i></i><b>FALSE POSITIVE FILTERED</b></p></div>' +
      '</div>' +
      '<p class="satx-cap"><span class="hint-fine">커서로 시설 B를 옮기고, 클릭하면 45° 회전합니다. </span><span class="hint-touch">화면을 눌러 시설 B를 옮기고, 회전 버튼으로 돌려 보세요. </span>점선 사각형(AABB)이 겹쳐도 분리축이 있으면 SAT는 설치를 허용합니다.</p></div>';
  }
  function createSatDemo(box) {
    var cv = box.querySelector('canvas'), stage = box.querySelector('.satx-stage');
    if (!cv || !cv.getContext) return null;
    var g = cv.getContext('2d');
    var el = {
      ya: box.querySelector('[data-ya]'), yb: box.querySelector('[data-yb]'),
      aabb: box.querySelector('[data-aabb]'), sat: box.querySelector('[data-sat]'), fp: box.querySelector('[data-fp]')
    };
    var css = getComputedStyle(root);
    var tok = function (n, d) { return css.getPropertyValue(n).trim() || d; };
    var C = { sel: tok('--sel', '#f5a524'), fg: tok('--fg', '#e9edf2'), muted: tok('--muted', '#7a8592'), ok: tok('--ok', '#6fd27c'), bad: tok('--bad', '#ff6b6b'), x: tok('--x', '#ff5f5f'), y: tok('--y', '#6fd27c') };
    // 논리 좌표 640×360 기준으로 그리고 화면 폭에 맞춰 늘립니다.
    // 시작 배치: 두 시설 모두 45° — AABB는 겹치지만 실제로는 14만큼 떨어져 있는 '오탐' 상황
    var LW = 640, LH = 360, Q45 = Math.PI / 4;
    var HOME = { x: 290.4, y: 256.2 };
    var st = { boot: 1, a: { x: 330, y: 160, yaw: Q45 }, b: { x: HOME.x, y: HOME.y, yaw: Q45 }, tb: { x: HOME.x, y: HOME.y, yaw: Q45 } };
    var W = 0, H = 0, DPR = 1, S = 1, OY = 0, raf = 0, running = false, last = 0, destroyed = false;
    function size() {
      var r = stage.getBoundingClientRect();
      if (!r.width) return;
      W = r.width; H = r.height; S = W / LW; OY = Math.max(0, (H / S - LH) / 2);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      draw();
    }
    function px(n) { return n / S; }
    function obb(x, y, hx, hy, a) {
      var c = Math.cos(a), s = Math.sin(a);
      return { x: x, y: y, ux: [c, s], uy: [-s, c],
        pts: [[x + c * hx - s * hy, y + s * hx + c * hy], [x - c * hx - s * hy, y - s * hx + c * hy], [x - c * hx + s * hy, y - s * hx - c * hy], [x + c * hx + s * hy, y + s * hx - c * hy]] };
    }
    function proj(b, ax) {
      var mn = Infinity, mx = -Infinity, pmn = null, pmx = null;
      b.pts.forEach(function (p) { var d = p[0] * ax[0] + p[1] * ax[1]; if (d < mn) { mn = d; pmn = p; } if (d > mx) { mx = d; pmx = p; } });
      return { mn: mn, mx: mx, pmn: pmn, pmx: pmx };
    }
    // 분리축 정리: 두 사각형의 변 법선 4개 중 하나라도 투영 구간이 떨어지면 겹치지 않음
    function test(A, B) {
      var best = null, mtv = null;
      [A.ux, A.uy, B.ux, B.uy].forEach(function (ax) {
        var pa = proj(A, ax), pb = proj(B, ax);
        var ov = Math.min(pa.mx, pb.mx) - Math.max(pa.mn, pb.mn);
        if (ov < 0) { if (!best || -ov > best.gap) best = { ax: ax, pa: pa, pb: pb, gap: -ov }; }
        else if (!mtv || ov < mtv.ov) mtv = { ax: ax, pa: pa, pb: pb, ov: ov };
      });
      return best ? { sep: true, r: best } : { sep: false, r: mtv };
    }
    function aabb(b) {
      var xs = b.pts.map(function (p) { return p[0]; }), ys = b.pts.map(function (p) { return p[1]; });
      return { x0: Math.min.apply(0, xs), x1: Math.max.apply(0, xs), y0: Math.min.apply(0, ys), y1: Math.max.apply(0, ys) };
    }
    function poly(pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
    function line(x0, y0, x1, y1) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    function alpha(hex, a) {
      var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function easeOutBack(t) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function centi(rad) { var d = ((rad * 180 / Math.PI) % 360 + 360) % 360; if (d >= 180) d -= 360; return Math.round(d * 100); }
    function fmtInt(n) { return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-US'); }
    function font(px0, w) { g.font = (w || 600) + ' ' + px(px0) + 'px JBMono, ui-monospace, monospace'; }
    function setChip(c, txt, tone) {
      if (!c) return;
      var b = c.querySelector('b');
      if (b.textContent !== txt) b.textContent = txt;
      c.classList.toggle('ok', tone === 'ok'); c.classList.toggle('bad', tone === 'bad');
    }
    function setText(n, v) { if (n && n.textContent !== v) n.textContent = v; }

    function draw() {
      if (!W) return;
      g.setTransform(DPR * S, 0, 0, DPR * S, 0, DPR * S * OY);
      g.clearRect(0, -OY, LW, LH + OY * 2);
      var k = st.boot, kb = easeOutBack(Math.min(1, k * 1.1));
      g.globalAlpha = Math.min(1, k * 1.4);
      var A = obb(st.a.x, st.a.y, 84 * kb, 48 * kb, st.a.yaw);
      var B = obb(st.b.x, st.b.y, 58 * kb, 34 * kb, st.b.yaw);
      var res = test(A, B), ba = aabb(A), bb = aabb(B);
      var hit = !(ba.x1 < bb.x0 || bb.x1 < ba.x0 || ba.y1 < bb.y0 || bb.y1 < ba.y0);

      // AABB(점선)과 겹친 영역
      g.lineWidth = px(1); g.setLineDash([px(4), px(4)]);
      [ba, bb].forEach(function (b) { g.strokeStyle = alpha(hit ? C.bad : C.muted, hit ? 0.6 : 0.45); g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); });
      if (hit) {
        var ix0 = Math.max(ba.x0, bb.x0), ix1 = Math.min(ba.x1, bb.x1), iy0 = Math.max(ba.y0, bb.y0), iy1 = Math.min(ba.y1, bb.y1);
        g.fillStyle = alpha(C.bad, res.sep ? 0.08 : 0.14); g.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
        g.save(); g.beginPath(); g.rect(ix0, iy0, ix1 - ix0, iy1 - iy0); g.clip();
        g.strokeStyle = alpha(C.bad, 0.22); g.setLineDash([]);
        for (var hx = ix0 - (iy1 - iy0); hx < ix1; hx += 7) line(hx, iy1, hx + (iy1 - iy0), iy0);
        g.restore();
      }

      // 분리축(또는 가장 적게 겹친 축)과 두 시설의 투영 구간
      var r = res.r;
      if (r) {
        var d = r.ax, n = [-d[1], d[0]];
        if (n[1] > 0) n = [-n[0], -n[1]];
        var kmax = -Infinity;
        A.pts.concat(B.pts).forEach(function (p) { var v = p[0] * n[0] + p[1] * n[1]; if (v > kmax) kmax = v; });
        var off = kmax + 30;
        var Q = function (t, o) { o = o || 0; return [n[0] * (off + o) + d[0] * t, n[1] * (off + o) + d[1] * t]; };
        var col = res.sep ? C.ok : C.bad;
        var p0 = Q(Math.min(r.pa.mn, r.pb.mn) - 1200), p1 = Q(Math.max(r.pa.mx, r.pb.mx) + 1200);
        g.setLineDash([px(6), px(6)]); g.lineWidth = px(1); g.strokeStyle = alpha(col, 0.45);
        line(p0[0], p0[1], p1[0], p1[1]);
        g.setLineDash([px(2), px(4)]); g.strokeStyle = alpha(C.fg, 0.2);
        [r.pa.pmn, r.pa.pmx, r.pb.pmn, r.pb.pmx].forEach(function (p) { var q = Q(p[0] * d[0] + p[1] * d[1]); line(p[0], p[1], q[0], q[1]); });
        g.setLineDash([]); g.lineCap = 'round'; g.lineWidth = px(3);
        var a0 = Q(r.pa.mn, -4), a1 = Q(r.pa.mx, -4); g.strokeStyle = alpha(C.sel, 0.95); line(a0[0], a0[1], a1[0], a1[1]);
        var b0 = Q(r.pb.mn, 4), b1 = Q(r.pb.mx, 4); g.strokeStyle = alpha(C.fg, 0.9); line(b0[0], b0[1], b1[0], b1[1]);
        var s0 = Math.min(r.pa.mx, r.pb.mx), s1 = Math.max(r.pa.mn, r.pb.mn);
        var g0 = Q(Math.min(s0, s1)), g1 = Q(Math.max(s0, s1));
        g.lineWidth = px(9); g.strokeStyle = alpha(col, 0.3); line(g0[0], g0[1], g1[0], g1[1]);
        g.lineCap = 'butt';
        var mid = Q((s0 + s1) / 2, 24);
        var txt = res.sep ? 'GAP ' + r.gap.toFixed(1) : 'PEN ' + r.ov.toFixed(1);
        font(10.5);
        var tw = g.measureText(txt).width + px(10), th = px(16);
        g.fillStyle = 'rgba(11,14,18,.85)'; g.fillRect(mid[0] - tw / 2, mid[1] - th / 2, tw, th);
        g.strokeStyle = alpha(col, 0.55); g.lineWidth = px(1); g.strokeRect(mid[0] - tw / 2, mid[1] - th / 2, tw, th);
        g.fillStyle = alpha(col, 0.95); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(txt, mid[0], mid[1] + px(0.5));
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      }

      // 시설 A(선택된 액터처럼 주황) · 시설 B
      poly(A.pts); g.fillStyle = alpha(C.sel, 0.1); g.fill();
      g.lineWidth = px(1.6); g.strokeStyle = alpha(C.sel, 0.95); g.stroke();
      poly(B.pts); g.fillStyle = alpha(res.sep ? C.fg : C.bad, res.sep ? 0.06 : 0.14); g.fill();
      g.strokeStyle = alpha(res.sep ? C.fg : C.bad, 0.92); g.stroke();
      // 로컬 축 기즈모 (X 빨강 / Y 초록)
      [A, B].forEach(function (b) {
        var L = 22 * kb;
        g.lineWidth = px(1.6);
        g.strokeStyle = C.x; line(b.x, b.y, b.x + b.ux[0] * L, b.y + b.ux[1] * L);
        g.strokeStyle = C.y; line(b.x, b.y, b.x + b.uy[0] * L, b.y + b.uy[1] * L);
        g.fillStyle = C.fg; g.beginPath(); g.arc(b.x, b.y, px(2.2), 0, Math.PI * 2); g.fill();
      });
      font(10.5);
      g.fillStyle = alpha(C.sel, 0.95); g.fillText('FACILITY_A', ba.x0, ba.y0 - px(7));
      g.fillStyle = alpha(res.sep ? C.fg : C.bad, 0.85); g.fillText('FACILITY_B', bb.x0, bb.y1 + px(15));
      g.globalAlpha = 1;

      setText(el.ya, fmtInt(centi(st.a.yaw)));
      setText(el.yb, fmtInt(centi(st.b.yaw)));
      setChip(el.aabb, hit ? 'HIT' : 'CLEAR', hit ? 'bad' : 'ok');
      setChip(el.sat, res.sep ? 'CLEAR' : 'HIT', res.sep ? 'ok' : 'bad');
      if (el.fp) el.fp.classList.toggle('on', hit && res.sep);
    }

    // 목표 위치·각도로 부드럽게 따라가고, 다 도착하면 그리기를 멈춥니다
    function step(dt) {
      var b = st.b, t = st.tb, kp = Math.min(1, dt * 12), kr = Math.min(1, dt * 10);
      b.x += (t.x - b.x) * kp; b.y += (t.y - b.y) * kp; b.yaw += (t.yaw - b.yaw) * kr;
      var moving = Math.abs(t.x - b.x) > 0.05 || Math.abs(t.y - b.y) > 0.05 || Math.abs(t.yaw - b.yaw) > 1e-4;
      if (!moving) { b.x = t.x; b.y = t.y; b.yaw = t.yaw; }
      return moving;
    }
    function loop(ts) {
      if (destroyed) return;
      var dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
      var moving = mqReduce.matches ? (st.b.x = st.tb.x, st.b.y = st.tb.y, st.b.yaw = st.tb.yaw, false) : step(dt);
      draw();
      if (moving) raf = requestAnimationFrame(loop); else running = false;
    }
    function kick() { if (running || destroyed) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
    function local(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / S, (e.clientY - r.top) / S - OY]; }
    function moveTo(x, y) { st.tb.x = Math.max(56, Math.min(LW - 56, x)); st.tb.y = Math.max(52 - OY, Math.min(LH - 70 + OY, y)); kick(); }
    function rotate() { st.tb.yaw += Q45; kick(); }
    function reset() { st.tb.x = HOME.x; st.tb.y = HOME.y; st.tb.yaw = Q45 + Math.round((st.b.yaw - Q45) / Math.PI) * Math.PI; kick(); }

    if (!PREVIEW) {
      on(cv, 'pointermove', function (e) { if (e.pointerType === 'mouse') { var p = local(e); moveTo(p[0], p[1]); } });
      on(cv, 'pointerdown', function (e) {
        var p = local(e);
        if (e.pointerType === 'mouse') rotate(); else moveTo(p[0], p[1]);
      });
      on(cv, 'keydown', function (e) {
        var k = e.key, step = e.shiftKey ? 30 : 10;
        if (k === 'ArrowLeft') moveTo(st.tb.x - step, st.tb.y);
        else if (k === 'ArrowRight') moveTo(st.tb.x + step, st.tb.y);
        else if (k === 'ArrowUp') moveTo(st.tb.x, st.tb.y - step);
        else if (k === 'ArrowDown') moveTo(st.tb.x, st.tb.y + step);
        else if (k === 'r' || k === 'R' || k === 'Enter' || k === ' ') rotate();
        else return;
        e.preventDefault();
      });
      var br = box.querySelector('[data-sat-rot]'), bs = box.querySelector('[data-sat-reset]');
      if (br) on(br, 'click', rotate);
      if (bs) on(bs, 'click', reset);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(size) : null;
    if (ro) ro.observe(stage); else on(window, 'resize', size);
    size();
    return {
      boot: function () {
        if (!MOTION) return;
        st.boot = 0;
        G.to(st, { boot: 1, duration: 1.4, ease: 'power3.out', delay: 0.2, onUpdate: draw });
      },
      destroy: function () { destroyed = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); }
    };
  }

  /* =====================================================================
     모션 — GSAP + ScrollTrigger. 화면에 들어온 요소만 짧게 등장시키고,
     '동작 줄이기' 설정·편집 미리보기에서는 모두 꺼집니다.
     ===================================================================== */
  function countUp(el) {
    var text = el.textContent;
    var parts = text.split(/(\d[\d,]*(?:\.\d+)?)/);
    if (parts.length < 2) return;
    el.innerHTML = parts.map(function (s, i) { return i % 2 ? '<span class="cu">' + s + '</span>' : esc(s); }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.cu'), function (s) {
      var raw = s.textContent, comma = raw.indexOf(',') >= 0, dec = (raw.split('.')[1] || '').length;
      var target = parseFloat(raw.replace(/,/g, '')), o = { v: 0 };
      s.textContent = comma ? (0).toLocaleString('en-US') : (0).toFixed(dec);
      G.to(o, { v: target, duration: 1.6, ease: 'expo.out', onUpdate: function () {
        s.textContent = comma ? Math.round(o.v).toLocaleString('en-US') : o.v.toFixed(dec);
      }, onComplete: function () { s.textContent = raw; } });
    });
  }

  var REVEAL = {
    up: function (el) { return G.fromTo(el, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: EASE, clearProps: 'transform' }); },
    clip: function (el) {
      var media = el.querySelector('.fr-media, .b-media') || el;
      var im = el.querySelector('img');
      var tl = G.timeline();
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 })
        .fromTo(media, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.15, ease: 'expo.inOut' }, 0)
        .fromTo(im, { scale: 1.22 }, { scale: el.classList.contains('in-img') ? 1.08 : 1, duration: 1.6, ease: EASE }, 0.1)
        .fromTo(el.querySelectorAll('.cn'), { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.05, ease: 'back.out(2)' }, 0.6)
        .fromTo(el.querySelectorAll('.fr-bar, figcaption, .play'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE, clearProps: 'transform' }, 0.55);
      return tl;
    },
    lines: function (el) {
      if (!window.SplitText) return REVEAL.up(el);
      G.set(el, { autoAlpha: 1 });
      var split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'sl' });
      return G.from(split.lines, { yPercent: 105, duration: 1.1, stagger: 0.09, ease: EASE, onComplete: function () { split.revert(); } });
    },
    chars: function (el) {
      if (!window.SplitText) return REVEAL.up(el);
      G.set(el, { autoAlpha: 1 });
      var split = new SplitText(el, { type: 'chars', mask: 'chars' });
      return G.from(split.chars, { yPercent: 110, duration: 1.15, stagger: 0.035, ease: EASE, onComplete: function () { split.revert(); } });
    },
    code: function (el) {
      var tl = G.timeline();
      tl.fromTo(el, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, clearProps: 'transform' })
        .from(el.querySelectorAll('.ln'), { autoAlpha: 0, x: -10, duration: 0.5, stagger: 0.035, ease: 'power3.out', clearProps: 'transform' }, 0.15)
        .fromTo(el.querySelector('.code-scan'), { yPercent: -100, autoAlpha: 1 }, { yPercent: 900, autoAlpha: 0, duration: 1.3, ease: 'power2.inOut' }, 0.2);
      return tl;
    },
    diagram: function (el) {
      var svg = el.querySelector('svg');
      var tl = G.timeline();
      tl.fromTo(el, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, clearProps: 'transform' });
      if (!svg) return tl;
      var id = el.getAttribute('data-diagram');
      var DS = !!window.DrawSVGPlugin;
      if (id === 'ff_arch' || id === 'lb_arch') {
        if (DS) tl.from(svg.querySelectorAll('rect.mod'), { drawSVG: '0%', duration: 1.2, ease: 'power2.inOut', stagger: 0.12 }, 0.1);
        tl.from(svg.querySelectorAll('.mod-t'), { autoAlpha: 0, duration: 0.5, stagger: 0.1 }, 0.3)
          .from(svg.querySelectorAll('g.bx-s, g.bx-w'), { autoAlpha: 0, y: 14, duration: 0.7, stagger: 0.06, ease: EASE }, 0.25);
        if (DS) tl.from(svg.querySelectorAll('line.ar, path.ar, polyline.ar'), { drawSVG: '0%', duration: 0.7, stagger: 0.04, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' }, 0.7);
        tl.from(svg.querySelectorAll('.ar-t, .lg-s, .lg-w, .lg-t'), { autoAlpha: 0, duration: 0.5, stagger: 0.03 }, 0.9)
          .add(function () { svg.classList.add('live'); });
      } else if (id === 'zone') {
        tl.from(svg.querySelectorAll('.sv-slab, .sv-nav'), { autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0.15)
          .from(svg.querySelectorAll('.sv-dot'), { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.4, stagger: { amount: 0.6, from: 'start' } }, 0.4)
          .from(svg.querySelectorAll('.sv-badg, .sv-bad'), { autoAlpha: 0, duration: 0.4 }, 0.9)
          .from(svg.querySelectorAll('.sv-dot2'), { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.35, stagger: { amount: 0.5, grid: 'auto' } }, 1.1)
          .from(svg.querySelectorAll('.sv-exit, .sv-exitt'), { autoAlpha: 0, duration: 0.4 }, 1.4);
        if (DS) tl.from(svg.querySelectorAll('.sv-path'), { drawSVG: '0%', duration: 0.8, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' }, 1.5);
        tl.from(svg.querySelectorAll('.sv-anchor, .sv-check'), { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(2.4)' }, 2.1)
          .from(svg.querySelectorAll('.sv-ok, .sv-t'), { autoAlpha: 0, duration: 0.5 }, 2.2);
      }
      return tl;
    },
    flow: function (el) {
      var tl = G.timeline();
      tl.fromTo(el, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, clearProps: 'transform' })
        .from(el.querySelectorAll('.fl-row li'), { autoAlpha: 0, x: -14, duration: 0.55, stagger: 0.09, ease: 'power3.out', clearProps: 'transform' }, 0.15)
        .from(el.querySelectorAll('.fl-back, .fl-undo'), { autoAlpha: 0, y: 10, duration: 0.6, stagger: 0.12, ease: EASE, clearProps: 'transform' }, 0.7)
        .add(function () { el.classList.add('live'); });
      return tl;
    },
    cmp: function (el) {
      var tl = G.timeline();
      tl.fromTo(el, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, clearProps: 'transform' })
        .from(el.querySelectorAll('.cmp-col'), { autoAlpha: 0, y: 10, duration: 0.6, stagger: 0.12, ease: 'power3.out', clearProps: 'transform' }, 0.15)
        .add(function () { el.classList.add('cooked'); }, 1.0);
      return tl;
    },
    same: function (el) {
      var tl = G.timeline();
      tl.fromTo(el, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, clearProps: 'transform' })
        .from(el.querySelectorAll('.se-src span'), { autoAlpha: 0, y: -10, duration: 0.5, stagger: 0.1, ease: 'power3.out', clearProps: 'transform' }, 0.15);
      if (window.DrawSVGPlugin) tl.from(el.querySelectorAll('.se-join path'), { drawSVG: '0%', duration: 0.6, ease: 'power2.inOut' }, 0.45);
      tl.from(el.querySelector('.se-core'), { autoAlpha: 0, scale: 0.94, duration: 0.6, ease: 'back.out(1.8)', clearProps: 'transform' }, 0.85);
      return tl;
    },
    satx: function (el) {
      var tl = REVEAL.up(el);
      if (el.__demo) el.__demo.boot();
      return tl;
    },
    pipe: function (el) {
      var tl = G.timeline();
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
        .from(el.querySelectorAll('li'), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.1, ease: EASE, clearProps: 'transform' }, 0);
      return tl;
    }
  };

  function setupMotion() {
    var SPLIT_OK = !!window.SplitText;
    ctx = G.context(function () {
      /* --- 첫 화면 등장 --- */
      var hero = app.querySelector('.hero');
      var tl = G.timeline({ defaults: { ease: EASE } });
      if (hero) {
        var title = hero.querySelector('.hero-title span');
        G.set(hero.querySelectorAll('.hero-title, .hero-role, .hero-meta, .hero-index, .scroll-cue'), { autoAlpha: 1 });
        if (SPLIT_OK && title) {
          var sp = new SplitText(title, { type: 'chars', mask: 'chars' });
          tl.from(sp.chars, { yPercent: 108, duration: 1.3, stagger: 0.045 }, 0.1);
        } else tl.from(title, { y: 40, autoAlpha: 0, duration: 1 }, 0.1);
        var role = hero.querySelector('.hero-role'), roleText = role.textContent;
        tl.from(hero.querySelector('.hero-grid'), { autoAlpha: 0, scale: 1.04, duration: 1.8, ease: 'power2.out' }, 0);
        if (window.ScrambleTextPlugin) { role.textContent = ''; tl.to(role, { duration: 1.2, scrambleText: { text: roleText, chars: 'XYZ01·', speed: 0.45 }, ease: 'none' }, 0.15); }
        tl
          .from(hero.querySelectorAll('.hero-meta > *'), { y: 18, autoAlpha: 0, duration: 0.9, stagger: 0.08, clearProps: 'transform' }, 0.55)
          .from(hero.querySelectorAll('.hero-index li'), { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.09, clearProps: 'transform' }, 0.65)
          .from(hero.querySelectorAll('.scroll-cue'), { autoAlpha: 0, duration: 0.8 }, 0.9);
      }
      // 첫 화면이 스크롤에 따라 살짝 물러남(격자는 느리게, 글은 조금 늦게 따라옴)
      if (hero) {
        G.to(hero.querySelector('.hero-grid'), { yPercent: 12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
        G.to(hero.querySelector('.hero-inner'), { y: 48, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      }
      var tb = app.querySelector('.topbar');
      tl.from(tb, { yPercent: -100, autoAlpha: 0, duration: 0.9, clearProps: 'transform' }, 0.2);
      root.classList.remove('mp');

      /* --- 화면에 들어올 때 한 번만 등장 --- */
      var targets = Array.prototype.slice.call(app.querySelectorAll('main [data-r]'));
      var vh = window.innerHeight;
      targets.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top > vh * 0.92) {
          var kind = el.getAttribute('data-r');
          if (kind === 'lines' || kind === 'chars') G.set(el, { autoAlpha: 0 });
          else G.set(el, { autoAlpha: 0 });
          el.setAttribute('data-wait', '');
        }
      });
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          io.unobserve(el);
          if (!el.hasAttribute('data-wait')) return;
          el.removeAttribute('data-wait');
          ctx.add(function () {
            var fn = REVEAL[el.getAttribute('data-r')] || REVEAL.up;
            fn(el);
            Array.prototype.forEach.call(el.querySelectorAll('[data-count]'), countUp);
          });
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      targets.forEach(function (el) { if (el.hasAttribute('data-wait')) io.observe(el); });

      /* --- 문제 → 해결 → 결과 진행선 (스크롤에 맞춰 차오름) --- */
      Array.prototype.forEach.call(app.querySelectorAll('.tr-col'), function (col) {
        var bar = col.querySelector('.tr-line i');
        G.fromTo(bar, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: col, start: 'top 72%', end: 'bottom 62%', scrub: 0.6 } });
        Array.prototype.forEach.call(col.querySelectorAll('.step'), function (s) {
          ST.create({ trigger: s, start: 'top 70%', onEnter: function () { s.classList.add('on'); }, onLeaveBack: function () { s.classList.remove('on'); } });
          if (s.getBoundingClientRect().top < vh * 0.7) s.classList.add('on');
        });
      });

      /* --- 프로젝트 소개: 번호 선 긋기 + 이미지 시차 --- */
      Array.prototype.forEach.call(app.querySelectorAll('.intro'), function (sec) {
        var rule = sec.querySelector('.in-rule');
        if (rule) G.fromTo(rule, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top 25%', scrub: 0.8 } });
        var im = sec.querySelector('.in-img img');
        if (im) G.fromTo(im, { yPercent: -3.5 }, { yPercent: 3.5, ease: 'none', scrollTrigger: { trigger: sec.querySelector('.in-img'), start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      /* --- 섹션 머리줄 선 긋기 --- */
      Array.prototype.forEach.call(app.querySelectorAll('main .sh-fill'), function (f) {
        G.fromTo(f, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.inOut', scrollTrigger: { trigger: f, start: 'top 92%', once: true } });
      });

      /* --- 마무리 제목 아래 그리드가 살짝 움직임 --- */
      var th = app.querySelector('.thanks');
      if (th) G.fromTo(th, { '--gy': '0px' }, { '--gy': '-80px', ease: 'none', scrollTrigger: { trigger: th, start: 'top bottom', end: 'bottom top', scrub: true } });
    }, app);

    // 글꼴이 늦게 와서 줄바꿈이 바뀌면 위치를 다시 계산합니다
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ST) ST.refresh(); });
    on(window, 'load', function () { if (ST) ST.refresh(); });
  }

  function showError(msg) {
    app.innerHTML = '<div style="padding:40px 20px;max-width:720px;margin:0 auto;font:16px/1.7 system-ui,sans-serif;color:#e9edf2"><h2>내용을 불러오지 못했습니다</h2><p>' + esc(msg) + '</p><p>content.json의 쉼표·따옴표를 확인하거나 편집 화면(edit.html)에서 다시 저장해 주세요.</p></div>';
    root.classList.remove('mp');
  }

  /* ---------- 시작 ---------- */
  if (PREVIEW) {
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || !ev.data) return;
      if (ev.data.type === 'pf-content') { pendingImages = ev.data.images || {}; render(ev.data.content); }
      if (ev.data.type === 'pf-scroll') {
        var el = app.querySelector('[data-idx="' + ev.data.idx + '"]');
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 56, behavior: 'smooth' });
      }
    });
    if (window.parent !== window) window.parent.postMessage({ type: 'pf-ready' }, location.origin);
  } else {
    if ('scrollRestoration' in history && location.hash) history.scrollRestoration = 'manual';
    fetch('content.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('content.json 응답 ' + r.status);
      return r.text();
    }).then(function (t) {
      var c;
      try { c = JSON.parse(t); } catch (err) { throw new Error('content.json 형식 오류: ' + err.message); }
      render(c);
      if (location.hash) {
        var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (el) requestAnimationFrame(function () { el.scrollIntoView(); });
      }
    }).catch(function (err) { showError(err.message); });
  }
  window.PF_RENDER = render;
})();
