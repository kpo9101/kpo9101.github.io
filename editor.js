/* 포트폴리오 편집기 — content.json을 폼으로 고치고, 미리보기로 확인한 뒤 GitHub에 저장합니다. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  };
  var KEY_DRAFT = 'pf-draft-v1', KEY_SET = 'pf-gh-settings-v1';
  var host = location.hostname;
  var DEFAULTS = {
    owner: /\.github\.io$/.test(host) ? host.split('.')[0] : 'kpo9101',
    repo: /\.github\.io$/.test(host) ? host : 'kpo9101.github.io',
    branch: 'main', token: ''
  };
  var settings = DEFAULTS;
  try { settings = Object.assign({}, DEFAULTS, JSON.parse(LS.get(KEY_SET) || '{}')); } catch (e) { settings = Object.assign({}, DEFAULTS); }

  var state = null, serverText = '', previewMode = 'web', images = {}, openSet = {}, dirty = false, uid = 0;
  var formEl = $('#form'), frame = $('#preview'), statusEl = $('#status'), overflowEl = $('#overflow');

  /* ---------- 이름표 ---------- */
  var PAGE_LABELS = { cover: '표지', about: '소개 (About)', contents: '목차', intro: '프로젝트 소개', gallery: '화면 모음', architecture: '구조도', trouble: '트러블슈팅', cards: '카드 3개', learnings: '배운 점', pair: '트러블슈팅 2개 (반반)', thanks: '마무리' };
  var BLOCK_LABELS = { image: '이미지', code: '코드', metrics: '숫자 카드', note: '작은 메모', example: '예시 상자', steps: '단계 칩', flow: '흐름도', compare: '수정 전·후 비교', sameEval: '공통 평가 그림', formula: '수식 상자', diagram: '고정 다이어그램' };
  var LABELS = {
    name: '이름', role: '표지 직무 문구', navRole: '상단 메뉴 직무', email: '이메일', phone: '전화번호 (비우면 숨김)', github: 'GitHub 주소', githubLabel: 'GitHub 표시 글자',
    title: '제목', description: '검색·공유 설명', eyebrow: '작은 머리글', lead: '소개 문단', desc: '설명', skills: '기술 스택', cards: '카드', text: '내용', note: '아래 메모',
    items: '항목', num: '번호', meta: '정보', topics: '주제 칩', image: '이미지', alt: '이미지 설명 (화면 낭독용)', anchor: '연결할 프로젝트 ID', id: '프로젝트 ID (영문)',
    section: '아래쪽 표시 이름', links: '링크 버튼', label: '버튼 글자', url: '주소', icon: '아이콘', roles: '담당 역할', value: '값', tabs: '상단 탭 묶음', tab: '현재 탭',
    link: '링크 버튼', points: '핵심 포인트', code: '코드', file: '파일 이름', diagram: '다이어그램', problem: '문제', solution: '해결', result: '결과', side: '오른쪽 자료',
    src: '이미지', caption: '사진 위 설명 (비우면 없음)', fit: '이미지 맞춤', height: '이미지 높이', size: '코드 글자 크기', steps: '단계', fail: '실패하면', undo: '실행 취소 설명',
    sources: '입력 두 개', core: '공통 처리', main: '수식', rows: '설명 줄', k: '이름', v: '내용', tags: '태그 줄', last: '마지막 단계', next: '다음 목표 (비우면 없음)',
    columns: '비교 열', tone: '색', top: '위 상자', topNote: '위 상자 보조 글', topGhost: '위 상자를 점선으로', arrow: '화살표 글', bottom: '아래 상자', pos: '결과 글', sub: '보조 설명'
  };
  var LONG = { lead: 1, desc: 1, text: 1, problem: 1, solution: 1, result: 1, code: 1, caption: 1, next: 1, main: 1, fail: 1, undo: 1, core: 1, v: 1, description: 1, pos: 1 };
  var SELECTS = {
    icon: [['gh', 'GitHub'], ['yt', '영상'], ['doc', '문서']],
    fit: [['cover', '꽉 채우기'], ['contain', '전체 보이기']],
    height: [['normal', '보통'], ['short', '낮게'], ['tall', '높게']],
    size: [['sm', '보통'], ['xs', '작게']],
    tone: [['bad', '빨강 (수정 전)'], ['ok', '초록 (수정 후)']],
    tab: [['OVERVIEW', 'OVERVIEW'], ['ARCHITECTURE', 'ARCHITECTURE'], ['TROUBLESHOOTING', 'TROUBLESHOOTING'], ['LEARNINGS', 'LEARNINGS']]
  };
  var STRING_LISTS = { skills: 1, topics: 1, roles: 1, sources: 1, steps: 1 };
  var IMAGE_KEYS = { image: 1, src: 1 };

  /* ---------- 틀 ---------- */
  var L = function (label, icon) { return { label: label || '코드 변경 보기', url: '', icon: icon || 'gh' }; };
  var BLOCKS = {
    image: function () { return { type: 'image', src: '', alt: '', caption: '', fit: 'cover', height: 'normal' }; },
    code: function () { return { type: 'code', file: '', code: '', size: 'sm' }; },
    metrics: function () { return { type: 'metrics', items: [{ value: '', label: '', sub: '' }, { value: '', label: '', sub: '' }] }; },
    note: function () { return { type: 'note', text: '' }; },
    example: function () { return { type: 'example', text: '' }; },
    steps: function () { return { type: 'steps', items: ['', ''], last: '' }; },
    flow: function () { return { type: 'flow', steps: ['', '', ''], fail: '', undo: '' }; },
    compare: function () {
      return { type: 'compare', columns: [
        { tone: 'bad', title: '수정 전', top: '', topNote: '', topGhost: true, arrow: '', bottom: '', pos: '' },
        { tone: 'ok', title: '수정 후', top: '', topNote: '', topGhost: false, arrow: '', bottom: '', pos: '' }] };
    },
    sameEval: function () { return { type: 'sameEval', sources: ['', ''], core: '' }; },
    formula: function () { return { type: 'formula', main: '', rows: [{ k: '', v: '' }], tags: '' }; },
    diagram: function () { return { type: 'diagram', id: Object.keys(window.PF_DIAGRAMS || { sat: 1 })[0] }; }
  };
  function base(at) {
    for (var i = at; i >= 0; i--) { var p = state.pages[i]; if (p && p.tabs) return { section: p.section || '', tabs: p.tabs }; }
    return { section: '', tabs: '' };
  }
  var PAGE_TPL = {
    trouble: function (b) { return Object.assign({ type: 'trouble' }, b, { tab: 'TROUBLESHOOTING', eyebrow: '', title: '새 트러블슈팅 제목', link: L(), problem: '', solution: '', result: '', side: [BLOCKS.image(), BLOCKS.code()] }); },
    cards: function (b) { var c = function () { return { title: '', problem: '', solution: '', result: '', link: L() }; }; return Object.assign({ type: 'cards' }, b, { tab: 'TROUBLESHOOTING', eyebrow: '', title: '새 카드 묶음', cards: [c(), c(), c()] }); },
    pair: function (b) { var h = function () { return { image: '', alt: '', title: '', link: L(), problem: '', solution: '', result: '', side: [] }; }; return Object.assign({ type: 'pair' }, b, { tab: 'TROUBLESHOOTING', eyebrow: '', items: [h(), h()] }); },
    learnings: function (b) { return Object.assign({ type: 'learnings' }, b, { tab: 'LEARNINGS', eyebrow: '', title: '배운 점', items: ['', ''], next: '' }); },
    gallery: function (b) { var g = function () { return { image: '', alt: '', title: '', caption: '' }; }; return Object.assign({ type: 'gallery' }, b, { tab: 'OVERVIEW', eyebrow: '', title: '', link: L('시연 영상', 'yt'), items: [g(), g(), g(), g()] }); },
    architecture: function (b) { return Object.assign({ type: 'architecture' }, b, { tab: 'ARCHITECTURE', eyebrow: '', title: '구조', link: L(), lead: '', points: [{ title: '', text: '' }], code: { file: '', code: '', size: 'xs' }, diagram: '' }); },
    intro: function () {
      var n = state.pages.filter(function (p) { return p.type === 'intro'; }).length + 1;
      return { type: 'intro', section: 'NEW PROJECT', tabs: '', id: 'project' + n, num: (n < 10 ? '0' : '') + n, title: '새 프로젝트', desc: '', links: [L('GitHub')], image: '', alt: '',
        meta: [{ label: '기간', value: '' }, { label: '팀 구성', value: '' }, { label: '개발 환경', value: '' }], roles: [''] };
    }
  };
  function itemTemplate(parent, key, arr) {
    if (STRING_LISTS[key]) return '';
    var t = parent && parent.type;
    if (key === 'items') {
      if (t === 'learnings' || t === 'steps') return '';
      if (t === 'gallery') return { image: '', alt: '', title: '', caption: '' };
      if (t === 'contents') return { num: '', title: '', anchor: '', meta: '', topics: [], image: '', alt: '' };
      if (t === 'metrics') return { value: '', label: '', sub: '' };
      if (t === 'pair') return { image: '', alt: '', title: '', link: L(), problem: '', solution: '', result: '', side: [] };
    }
    if (key === 'cards') return t === 'about' ? { title: '', text: '', note: '' } : { title: '', problem: '', solution: '', result: '', link: L() };
    if (key === 'points') return { title: '', text: '' };
    if (key === 'meta') return { label: '', value: '' };
    if (key === 'links') return L('링크');
    if (key === 'rows') return { k: '', v: '' };
    if (key === 'columns') return BLOCKS.compare().columns[1];
    if (arr && arr.length) return blank(arr[arr.length - 1]);
    return '';
  }
  function blank(v) {
    if (typeof v === 'string') return '';
    if (Array.isArray(v)) return v.length && typeof v[0] === 'string' ? [''] : [];
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { o[k] = ({ type: 1, tone: 1, fit: 1, size: 1, icon: 1, height: 1 })[k] ? v[k] : blank(v[k]); });
      return o;
    }
    return v;
  }
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };

  /* ---------- 상태 ---------- */
  function setStatus(msg, tone, linkHref, linkText) {
    statusEl.className = 'status ' + (tone || '');
    statusEl.textContent = msg;
    if (linkHref) { var a = document.createElement('a'); a.href = linkHref; a.target = '_blank'; a.rel = 'noopener'; a.textContent = linkText || '보기'; statusEl.append(' ', a); }
  }
  function changed(structural) {
    dirty = true;
    LS.set(KEY_DRAFT, JSON.stringify({ content: state, at: Date.now() }));
    setStatus('저장하지 않은 변경이 있습니다', 'warn');
    if (structural) buildForm();
    schedulePreview();
  }

  /* ---------- 미리보기 ---------- */
  var pvTimer = 0, previewReady = false, lastScroll = -1;
  function schedulePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(sendPreview, 250); }
  function sendPreview() {
    if (!previewReady || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'pf-content', content: state, images: images }, location.origin);
  }
  function loadPreview() {
    previewReady = false;
    frame.src = (previewMode === 'web' ? 'index.html' : 'pdf.html') + '?preview';
    overflowEl.textContent = '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-pv]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pv') === previewMode ? 'true' : 'false'); });
  }
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || !ev.data) return;
    if (ev.data.type === 'pf-ready') { previewReady = true; sendPreview(); if (lastScroll >= 0) scrollPreview(lastScroll, true); }
    if (ev.data.type === 'pf-overflow') {
      overflowEl.textContent = ev.data.pages && ev.data.pages.length ? 'PDF ' + ev.data.pages.join(', ') + '쪽: 내용이 한 장을 넘칩니다' : '';
    }
  });
  function scrollPreview(idx, force) {
    if (!force && idx === lastScroll) return;
    lastScroll = idx;
    if (previewReady) frame.contentWindow.postMessage({ type: 'pf-scroll', idx: idx }, location.origin);
  }

  /* ---------- 폼 만들기 ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.append(c); });
    return n;
  }
  function btn(text, onclick, cls, title) { return el('button', { type: 'button', class: 'mini ' + (cls || ''), text: text, onclick: onclick, title: title || text, 'aria-label': title || text }); }
  function label(key) { return LABELS[key] || key; }

  function details(path, summaryNodes, bodyNodes, cls) {
    var d = el('details', { class: cls || 'grp', 'data-path': path });
    if (openSet[path]) d.open = true;
    d.addEventListener('toggle', function () { if (d.open) openSet[path] = 1; else delete openSet[path]; });
    d.append(el('summary', null, summaryNodes), el('div', { class: 'grp-body' }, bodyNodes));
    return d;
  }

  function textField(obj, key, path) {
    var id = 'f' + (++uid);
    var v = obj[key] == null ? '' : String(obj[key]);
    var input;
    if (SELECTS[key] || key === 'tabs' || (key === 'id' && obj.type === 'diagram') || key === 'diagram') {
      var opts = SELECTS[key];
      if (key === 'tabs') opts = [['', '(탭 없음)']].concat(Object.keys(state.tabsets || {}).map(function (k) { return [k, k + ' — ' + state.tabsets[k].join(' · ')]; }));
      if (key === 'diagram' || key === 'id') {
        var lab = window.PF_DIAGRAM_LABELS || {};
        opts = [['', '(없음)']].concat(Object.keys(window.PF_DIAGRAMS || {}).map(function (k) { return [k, lab[k] || k]; }));
      }
      input = el('select', { id: id });
      opts.forEach(function (o) { var op = el('option', { value: o[0], text: o[1] }); if (o[0] === v) op.selected = true; input.append(op); });
      input.addEventListener('change', function () { obj[key] = input.value; changed(key === 'tabs'); });
    } else if (LONG[key] || v.length > 70) {
      input = el('textarea', { id: id, rows: String(Math.min(16, Math.max(key === 'code' ? 6 : 3, Math.ceil(v.length / 52) + (v.split('\n').length - 1)))) });
      if (key === 'code') input.className = 'mono';
      input.value = v;
      input.addEventListener('input', function () { obj[key] = input.value; changed(false); refreshSummary(input); });
    } else {
      input = el('input', { id: id, type: 'text' });
      input.value = v;
      input.addEventListener('input', function () { obj[key] = input.value; changed(false); refreshSummary(input); });
    }
    var wrap = el('div', { class: 'fld' }, [el('label', { for: id, text: label(key) }), input]);
    if (IMAGE_KEYS[key]) wrap.append(imageTools(obj, key, input));
    return wrap;
  }

  function imageTools(obj, key, input) {
    var thumb = el('img', { class: 'thumb', alt: '' });
    var setThumb = function () { var p = obj[key]; thumb.hidden = !p; if (p) thumb.src = images[p] || p; };
    setThumb();
    input.addEventListener('input', setThumb);
    var file = el('input', { type: 'file', accept: 'image/*', class: 'sr-only' });
    file.addEventListener('change', function () {
      if (!file.files || !file.files[0]) return;
      uploadImage(file.files[0]).then(function (path) {
        obj[key] = path; input.value = path; setThumb(); changed(false);
        setStatus('이미지를 올렸습니다. "GitHub에 저장"을 누르면 페이지에 반영됩니다.', 'warn');
      }).catch(function (err) { setStatus('이미지 올리기 실패: ' + err.message, 'bad'); });
      file.value = '';
    });
    return el('div', { class: 'imgrow' }, [thumb, btn('이미지 올리기', function () {
      if (!settings.token) { openSettings('이미지를 올리려면 먼저 GitHub 토큰을 설정해 주세요.'); return; }
      file.click();
    }, 'up'), file]);
  }

  function checkField(obj, key) {
    var id = 'f' + (++uid);
    var c = el('input', { id: id, type: 'checkbox' });
    c.checked = !!obj[key];
    c.addEventListener('change', function () { obj[key] = c.checked; changed(false); });
    return el('div', { class: 'fld chk' }, [c, el('label', { for: id, text: label(key) })]);
  }

  function listControls(arr, i) {
    return el('span', { class: 'ctl' }, [
      btn('↑', function (e) { e.preventDefault(); if (i > 0) { var t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; changed(true); } }, '', '위로'),
      btn('↓', function (e) { e.preventDefault(); if (i < arr.length - 1) { var t = arr[i + 1]; arr[i + 1] = arr[i]; arr[i] = t; changed(true); } }, '', '아래로'),
      btn('✕', function (e) { e.preventDefault(); arr.splice(i, 1); changed(true); }, 'del', '삭제')
    ]);
  }

  function stringList(parent, key, path) {
    var arr = parent[key];
    var box = el('div', { class: 'fld list' }, [el('div', { class: 'list-h', text: label(key) })]);
    arr.forEach(function (v, i) {
      var id = 'f' + (++uid);
      var long = String(v).length > 60 || (parent.type === 'learnings' && key === 'items');
      var input = long ? el('textarea', { id: id, rows: '2', 'aria-label': label(key) + ' ' + (i + 1) }) : el('input', { id: id, type: 'text', 'aria-label': label(key) + ' ' + (i + 1) });
      input.value = v;
      input.addEventListener('input', function () { arr[i] = input.value; changed(false); });
      box.append(el('div', { class: 'row' }, [input, listControls(arr, i)]));
    });
    box.append(btn('+ 추가', function () { arr.push(''); changed(true); }, 'add'));
    return box;
  }

  function objectList(parent, key, path) {
    var arr = parent[key];
    var box = el('div', { class: 'fld list' }, [el('div', { class: 'list-h', text: label(key) })]);
    arr.forEach(function (item, i) {
      var p = path + '.' + key + '.' + i;
      var name = item.type ? (BLOCK_LABELS[item.type] || item.type) : (item.title || item.label || item.value || item.k || item.image || (i + 1) + '번');
      box.append(details(p, [el('span', { class: 'sum-t', text: (i + 1) + '. ' + String(name).slice(0, 40) }), listControls(arr, i)], [objFields(item, p)], 'grp sub'));
    });
    if (key === 'side') {
      var sel = el('select', { 'aria-label': '추가할 자료 종류' });
      Object.keys(BLOCKS).forEach(function (k) { sel.append(el('option', { value: k, text: BLOCK_LABELS[k] })); });
      box.append(el('div', { class: 'row add-row' }, [sel, btn('+ 자료 추가', function () { arr.push(BLOCKS[sel.value]()); openSet[path + '.side.' + (arr.length - 1)] = 1; changed(true); }, 'add')]));
    } else {
      box.append(btn('+ 추가', function () { arr.push(clone(itemTemplate(parent, key, arr))); openSet[path + '.' + key + '.' + (arr.length - 1)] = 1; changed(true); }, 'add'));
    }
    return box;
  }

  function objFields(obj, path, skip) {
    var frag = document.createDocumentFragment();
    if (obj.type && BLOCK_LABELS[obj.type]) frag.append(el('p', { class: 'kind', text: '종류: ' + BLOCK_LABELS[obj.type] + (obj.type === 'diagram' ? ' (그림 안 글자는 diagrams.js에서만 바꿀 수 있습니다)' : '') }));
    Object.keys(obj).forEach(function (key) {
      if (key === 'type' || (skip && skip.indexOf(key) >= 0)) return;
      var v = obj[key];
      if (typeof v === 'string' || typeof v === 'number') frag.append(textField(obj, key, path));
      else if (typeof v === 'boolean') frag.append(checkField(obj, key));
      else if (Array.isArray(v)) {
        var strings = STRING_LISTS[key] || (key === 'items' && (obj.type === 'learnings' || obj.type === 'steps')) || (v.length && typeof v[0] === 'string');
        frag.append(strings ? stringList(obj, key, path) : objectList(obj, key, path));
      } else if (v && typeof v === 'object') {
        frag.append(el('fieldset', { class: 'nest' }, [el('legend', { text: label(key) }), objFields(v, path + '.' + key)]));
      }
    });
    return frag;
  }

  function pageSummary(p, i) {
    var t = p.title || p.eyebrow || (p.items && p.items[0] && p.items[0].title) || '';
    return (i + 1 < 10 ? '0' : '') + (i + 1) + '  ' + (PAGE_LABELS[p.type] || p.type) + (t ? ' · ' + String(t).replace(/\n/g, ' ').slice(0, 42) : '');
  }
  function refreshSummary(input) {
    var d = input.closest('details.page-card');
    if (!d) return;
    var i = +d.getAttribute('data-idx');
    var s = d.querySelector(':scope > summary .sum-t');
    if (s) s.textContent = pageSummary(state.pages[i], i);
  }

  function buildForm() {
    var sc = formEl.scrollTop;
    formEl.innerHTML = '';
    uid = 0;
    formEl.append(el('div', { class: 'help' }, [
      el('strong', { text: '사용 방법' }),
      el('ol', null, [
        el('li', { text: '아래에서 페이지를 펼쳐 글을 고치면 오른쪽 미리보기에 바로 보입니다.' }),
        el('li', { text: '굵게 쓰려면 **글자**처럼 별표 두 개로 감싸고, 줄을 바꾸려면 Enter를 누르세요.' }),
        el('li', { text: '다 고쳤으면 위의 "GitHub에 저장"을 누르세요. 1~2분 뒤 사이트에 반영됩니다.' }),
        el('li', { text: 'PDF는 PDF 미리보기에서 빨간 "넘침" 표시가 없는지 확인한 뒤, 사이트의 PDF 화면에서 저장하세요.' })
      ])
    ]));
    formEl.append(details('profile', [el('span', { class: 'sum-t', text: '기본 정보 (이름·연락처)' })], [objFields(state.profile, 'profile'), objFields(state.meta, 'meta')], 'grp top'));
    var tabBody = el('div');
    Object.keys(state.tabsets || {}).forEach(function (k) {
      tabBody.append(el('p', { class: 'kind', text: '탭 묶음: ' + k }), stringList(state.tabsets, k, 'tabsets'));
    });
    var newTab = el('input', { type: 'text', placeholder: '새 탭 묶음 이름 (영문, 예: project3)', 'aria-label': '새 탭 묶음 이름' });
    tabBody.append(el('div', { class: 'row add-row' }, [newTab, btn('+ 탭 묶음 추가', function () {
      var k = newTab.value.trim().replace(/[^A-Za-z0-9_-]/g, '');
      if (!k || state.tabsets[k]) return;
      state.tabsets[k] = ['ARCHITECTURE', 'TROUBLESHOOTING', 'LEARNINGS']; changed(true);
    }, 'add')]));
    formEl.append(details('tabsets', [el('span', { class: 'sum-t', text: '상단 탭 묶음' })], [tabBody], 'grp top'));

    formEl.append(el('h2', { class: 'pages-h', text: '페이지 (' + state.pages.length + '쪽)' }));
    state.pages.forEach(function (p, i) {
      var path = 'p' + i;
      var ctl = el('span', { class: 'ctl' }, [
        btn('↑', function (e) { e.preventDefault(); if (i > 0) { var t = state.pages[i - 1]; state.pages[i - 1] = p; state.pages[i] = t; changed(true); } }, '', '위로'),
        btn('↓', function (e) { e.preventDefault(); if (i < state.pages.length - 1) { var t = state.pages[i + 1]; state.pages[i + 1] = p; state.pages[i] = t; changed(true); } }, '', '아래로'),
        btn('복제', function (e) { e.preventDefault(); state.pages.splice(i + 1, 0, clone(p)); changed(true); }, '', '이 페이지 복제'),
        btn('✕', function (e) { e.preventDefault(); removePage(i); }, 'del', '이 페이지 삭제')
      ]);
      var d = details(path, [el('span', { class: 'sum-t', text: pageSummary(p, i) }), ctl], [objFields(p, path)], 'grp page-card');
      d.setAttribute('data-idx', String(i));
      d.addEventListener('toggle', function () { if (d.open) scrollPreview(i); });
      d.addEventListener('focusin', function () { scrollPreview(i); });
      formEl.append(d);
    });
    var sel = el('select', { 'aria-label': '추가할 페이지 종류' });
    Object.keys(PAGE_TPL).forEach(function (k) { sel.append(el('option', { value: k, text: PAGE_LABELS[k] })); });
    var pos = el('select', { 'aria-label': '추가할 위치' });
    state.pages.forEach(function (p, i) { pos.append(el('option', { value: String(i + 1), text: (i + 1) + '쪽 뒤' })); });
    pos.value = String(Math.max(1, state.pages.length - 1));
    formEl.append(el('div', { class: 'add-page' }, [el('strong', { text: '페이지 추가' }), el('div', { class: 'row' }, [sel, pos, btn('+ 추가', function () {
      var at = +pos.value;
      state.pages.splice(at, 0, PAGE_TPL[sel.value](base(at - 1)));
      openSet['p' + at] = 1;
      changed(true);
      scrollPreview(at, true);
    }, 'add primary')])]));
    formEl.scrollTop = sc;
  }

  function removePage(i) {
    var bar = $('#confirm');
    $('#confirm-text').textContent = (i + 1) + '쪽 "' + pageSummary(state.pages[i], i) + '"을(를) 삭제할까요?';
    bar.hidden = false;
    $('#confirm-yes').onclick = function () { bar.hidden = true; state.pages.splice(i, 1); changed(true); };
    $('#confirm-no').onclick = function () { bar.hidden = true; };
  }

  /* ---------- GitHub ---------- */
  function api(path, opts) {
    var o = opts || {};
    o.headers = Object.assign({ Authorization: 'Bearer ' + settings.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, o.headers || {});
    o.cache = 'no-store';
    return fetch('https://api.github.com/repos/' + encodeURIComponent(settings.owner) + '/' + encodeURIComponent(settings.repo) + '/' + path, o);
  }
  function apiError(r) {
    var m = { 401: '토큰이 올바르지 않거나 만료됐습니다. 설정에서 새 토큰을 넣어 주세요.', 403: '이 토큰에 저장소 쓰기 권한(Contents: Read and write)이 없습니다.', 404: '저장소를 찾지 못했습니다. 설정의 계정·저장소 이름과 토큰의 저장소 선택을 확인해 주세요.', 409: '다른 곳에서 먼저 바뀌었습니다. 새로고침 후 다시 저장해 주세요.', 422: '저장 요청이 거절됐습니다. 새로고침 후 다시 시도해 주세요.' }[r.status];
    return new Error(m || ('GitHub 응답 ' + r.status));
  }
  function getSha(file) {
    return api('contents/' + file.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(settings.branch)).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw apiError(r);
      return r.json().then(function (j) { return j.sha; });
    });
  }
  function putFile(file, b64, message, sha) {
    var body = { message: message, content: b64, branch: settings.branch };
    if (sha) body.sha = sha;
    return api('contents/' + file.split('/').map(encodeURIComponent).join('/'), { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }).then(function (r) {
      if (!r.ok) throw apiError(r);
      return r.json();
    });
  }
  function b64utf8(text) {
    var bytes = new TextEncoder().encode(text), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function save() {
    if (!settings.token) { openSettings('GitHub에 저장하려면 처음 한 번 토큰을 설정해야 합니다.'); return; }
    var text = JSON.stringify(state, null, 2) + '\n';
    var saveBtn = $('#save');
    saveBtn.disabled = true;
    setStatus('GitHub에 저장하는 중…', '');
    getSha('content.json').then(function (sha) {
      return putFile('content.json', b64utf8(text), '포트폴리오 내용 수정 (편집 화면)', sha);
    }).then(function () {
      serverText = text; dirty = false; LS.del(KEY_DRAFT);
      setStatus('저장했습니다. 1~2분 뒤 사이트에 반영됩니다.', 'ok', 'https://github.com/' + settings.owner + '/' + settings.repo + '/actions', '배포 상황 보기');
    }).catch(function (err) { setStatus('저장 실패: ' + err.message, 'bad'); })
      .then(function () { saveBtn.disabled = false; });
  }

  function uploadImage(f) {
    return new Promise(function (resolve, reject) {
      var name = (f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'image') + '-' + Date.now().toString(36);
      var finish = function (dataUrl, ext) {
        var path = 'img/' + name + '.' + ext;
        images[path] = dataUrl;
        setStatus('이미지 올리는 중…', '');
        putFile(path, dataUrl.split(',')[1], '이미지 추가: ' + name, null).then(function () {
          setStatus('이미지를 올렸습니다. "GitHub에 저장"을 눌러야 페이지에 반영됩니다.', 'ok');
          resolve(path);
        }).catch(reject);
      };
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('파일을 읽지 못했습니다')); };
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
        reader.onload = function () { finish(reader.result, (f.name.split('.').pop() || 'png').toLowerCase()); };
        reader.readAsDataURL(f); return;
      }
      reader.onload = function () {
        var im = new Image();
        im.onload = function () {
          var w = Math.min(1600, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth);
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(im, 0, 0, w, h);
          finish(cv.toDataURL('image/jpeg', 0.86), 'jpg');
        };
        im.onerror = function () { reject(new Error('이미지를 열지 못했습니다')); };
        im.src = reader.result;
      };
      reader.readAsDataURL(f);
    });
  }

  /* ---------- 설정 ---------- */
  function openSettings(msg) {
    $('#set-msg').textContent = msg || '';
    $('#set-owner').value = settings.owner; $('#set-repo').value = settings.repo; $('#set-branch').value = settings.branch; $('#set-token').value = settings.token;
    $('#settings').hidden = false;
    $('#set-token').focus();
  }
  function readSettings() {
    settings = { owner: $('#set-owner').value.trim(), repo: $('#set-repo').value.trim(), branch: $('#set-branch').value.trim() || 'main', token: $('#set-token').value.trim() };
    LS.set(KEY_SET, JSON.stringify(settings));
  }
  $('#set-save').addEventListener('click', function () { readSettings(); $('#settings').hidden = true; setStatus(settings.token ? '토큰을 이 브라우저에 저장했습니다.' : '토큰이 비어 있습니다.', settings.token ? 'ok' : 'warn'); });
  $('#set-test').addEventListener('click', function () {
    readSettings();
    var out = $('#set-msg');
    out.textContent = '확인하는 중…';
    fetch('https://api.github.com/repos/' + encodeURIComponent(settings.owner) + '/' + encodeURIComponent(settings.repo), { headers: { Authorization: 'Bearer ' + settings.token, Accept: 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw apiError(r); return r.json(); })
      .then(function (j) { out.textContent = j.permissions && j.permissions.push ? '연결됐습니다. 저장할 수 있습니다.' : '읽기만 가능한 토큰입니다. Contents 권한을 Read and write로 바꿔 주세요.'; })
      .catch(function (err) { out.textContent = err.message; });
  });
  $('#set-clear').addEventListener('click', function () { $('#set-token').value = ''; readSettings(); $('#set-msg').textContent = '이 브라우저에서 토큰을 지웠습니다.'; });
  $('#set-close').addEventListener('click', function () { $('#settings').hidden = true; });
  $('#open-settings').addEventListener('click', function () { openSettings(''); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#settings').hidden) $('#settings').hidden = true;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });

  /* ---------- 버튼 ---------- */
  $('#save').addEventListener('click', save);
  Array.prototype.forEach.call(document.querySelectorAll('[data-pv]'), function (b) {
    b.addEventListener('click', function () { previewMode = b.getAttribute('data-pv'); loadPreview(); });
  });
  $('#copy-json').addEventListener('click', function () {
    var text = JSON.stringify(state, null, 2) + '\n';
    var ok = function () { setStatus('내용을 복사했습니다. GitHub의 content.json 편집 화면에 붙여넣고 커밋하세요.', 'ok', 'https://github.com/' + settings.owner + '/' + settings.repo + '/edit/' + settings.branch + '/content.json', 'content.json 열기'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { setStatus('복사하지 못했습니다. 브라우저 권한을 확인해 주세요.', 'bad'); });
  });
  $('#reload').addEventListener('click', function () {
    if (dirty) { $('#confirm-text').textContent = '저장하지 않은 변경을 버리고 사이트의 현재 내용을 다시 불러올까요?'; $('#confirm').hidden = false; $('#confirm-yes').onclick = function () { $('#confirm').hidden = true; LS.del(KEY_DRAFT); start(true); }; $('#confirm-no').onclick = function () { $('#confirm').hidden = true; }; }
    else start(true);
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- 시작 ---------- */
  function start(ignoreDraft) {
    setStatus('불러오는 중…', '');
    fetch('content.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('content.json 응답 ' + r.status);
      return r.text();
    }).then(function (t) {
      serverText = t;
      state = JSON.parse(t);
      dirty = false;
      var draft = null;
      if (!ignoreDraft) { try { draft = JSON.parse(LS.get(KEY_DRAFT) || 'null'); } catch (e) { draft = null; } }
      if (draft && draft.content && JSON.stringify(draft.content) !== JSON.stringify(state)) {
        var bar = $('#draft');
        $('#draft-text').textContent = new Date(draft.at).toLocaleString('ko-KR') + '에 저장하지 않은 편집이 이 브라우저에 남아 있습니다.';
        bar.hidden = false;
        $('#draft-use').onclick = function () { bar.hidden = true; state = draft.content; dirty = true; buildForm(); sendPreview(); setStatus('이어서 편집합니다. 저장하지 않은 변경이 있습니다', 'warn'); };
        $('#draft-drop').onclick = function () { bar.hidden = true; LS.del(KEY_DRAFT); };
      }
      buildForm();
      loadPreview();
      setStatus(settings.token ? '불러왔습니다.' : '불러왔습니다. 저장하려면 오른쪽 위 "설정"에서 GitHub 토큰을 넣어 주세요.', settings.token ? 'ok' : 'warn');
    }).catch(function (err) { setStatus('불러오기 실패: ' + err.message, 'bad'); });
  }
  start(false);
})();
