'use strict';
/* 자체 검사. 일반 실행에서는 불러오지 않고, app.py --self-test 때만 studio.html?selftest로 불러옵니다. */
/* ── 자체 검사 ─────────────────────────────────────── */
window.STUDIO_SELFTEST = () => {
  S.noSave = true;   // 검사가 사용자가 저장한 내용을 덮어쓰지 않게 합니다.
  S.fakeDownload = true;   // 검사 중에는 파일을 내려받지 않습니다.
  showTour(-1); $('help').hidden = true;
  const report = { passed: true, checks: [] };
  const check = (ok, label) => { report.checks.push(`${ok ? 'ok' : 'FAIL'} ${label}`); if (!ok) report.passed = false; };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const reset = patch => { S.cfg = mergeCfg(patch); S.saved = []; S.draft = emptyDraft(); S.pin = null; S.zoom = null; S.edits = {}; S.editingConcept = null; S.sheet = copy(SHEET); S.ink = {}; S.marks = {}; S.tab = 'summary'; S.lastTab = ''; S.lastMake = false; if (S.page !== 'viz') setPage('viz'); renderSaved(); renderSheet(); renderSettings(); recompute(); draw(); };
  // 예전 설정 이름(on, halfMode, waveDomain…)으로 바꾸면 조건을 다시 읽습니다.
  const set = patch => { Object.assign(S.cfg, patch); if (['on', 'halfMode', 'waveDomain', 'waveEnds', 'heatDomain', 'bc', 'damping'].some(k => k in patch)) S.cfg.axes = axesFromOn(S.cfg); renderSettings(); recompute(); draw(); };
  const pick = (axis, value) => { document.querySelector(`[data-axis="${axis}"][data-value="${value}"]`).click(); draw(); };
  const shown = () => { const list = $$('#panels .pnl'); return list.length === 1 ? list[0].dataset.panel : list.map(x => x.dataset.panel).join('+'); };
  const painted = () => $$('#panels canvas.main').every(c => { const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < data.length; i += 40) if (data[i]) return true; return false; });
  const text = () => $('tabBody').textContent;
  const page = name => document.querySelector(`[data-page="${name}"][role="tab"]`).click();
  const onList = () => Object.keys(S.cfg.on).filter(k => S.cfg.on[k]).join(',');
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const tab = name => { document.querySelector(`[data-tab="${name}"]`).click(); };
  reset({});
  const recipe = () => $('recipe').textContent, idle = k => document.querySelector(`#recipe [data-row="${k}"]`).classList.contains('idle');
  check(shown() === 'series' && painted() && $('err').hidden && recipe().includes('11장') && recipe().includes('Fourier 급수'), '처음: 대표 개념(Fourier 급수) 그래프 하나');
  check(!$('conceptList') && $$('#recipe .axis').length === 6 && idle('bound') && idle('dim') && idle('damp') && !idle('look'), '나무 대신 조건 여섯 줄, 쓰지 않는 줄은 흐림');
  pick('look', 'coef'); check(onList() === 'series,coef' && shown() === 'coef' && !!$('f_coefN'), '보기: 계수(넓이)');
  pick('look', 'spectrum'); check(onList() === 'series,coef,spectrum' && shown() === 'spectrum' && text().includes('계수 크기'), '보기: 계수 크기');
  pick('rep', 'sine'); check(onList() === 'series,coef,spectrum,half' && shown() === 'spectrum' && S.cfg.halfMode === 'sine' && recipe().includes('응용 조합'), '조건 겹치기: 반구간 사인 + 계수 크기는 응용 조합');
  pick('time', 'wave'); check(onList() === 'series,half,wave' && shown() === 'wave' && !$('transport').hidden && idle('look') && !idle('bound') && recipe().includes('12장') && recipe().includes('현의 진동'), '시간: 파동이면 12장 현의 진동, 보기 줄은 쉼');
  pick('bound', 'free'); check(S.cfg.waveEnds === 'free' && S.cfg.halfMode === 'cosine' && recipe().includes('응용 조합') && painted(), '경계: 자유 끝이면 코사인 전개');
  pick('dim', '2'); check(onList() === 'series,half,wave,membrane' && shown() === 'membrane' && S.cfg.axes.bound === 'fixed' && $('status').textContent.includes('경계 → 고정'), '공간: 2차원 막, 경계는 고정으로 함께 바뀜');
  pick('damp', 'on'); check(S.cfg.axes.dim === '1' && +S.cfg.damping > 0 && !!$('f_kDamp') && shown() === 'wave' && $('status').textContent.includes('공간'), '감쇠: 막은 1차원으로 돌아감');
  pick('time', 'heat'); check(onList() === 'series,half,heat' && shown() === 'heat' && S.cfg.axes.damp === 'off' && S.cfg.damping === '0' && recipe().includes('막대의 열전도'), '시간: 열');
  pick('bound', 'free'); check(S.cfg.bc === 'insulated' && S.cfg.halfMode === 'cosine' && recipe().includes('단열') && !$('f_left'), '경계: 단열 막대');
  pick('rep', 'integral'); check(S.cfg.heatDomain === 'infinite' && onList() === 'series,heat' && recipe().includes('열핵'), '표현: 적분이면 무한 막대');
  pick('look', 'gibbs'); check(S.cfg.axes.time === 'none' && S.cfg.axes.rep === 'series' && shown() === 'gibbs' && $('status').textContent.includes('시간 → 없음'), '보기를 누르면 시간 조건이 빠짐');
  pick('rep', 'integral'); check(shown() === 'transform' && onList() === 'series,transform' && idle('look') && recipe().includes('Fourier 적분'), '표현: 적분이면 Fourier 적분');
  pick('bound', 'infinite'); check(shown() === 'wave' && S.cfg.waveDomain === 'infinite' && onList() === 'series,wave' && recipe().includes("D'Alembert"), '경계만 눌러도 파동이 켜짐(무한히 긴 현)');
  const legacy = mergeCfg({ on: { series: true, half: true, heat: true }, bc: 'insulated' });
  check(legacy.axes.time === 'heat' && legacy.axes.bound === 'free' && legacy.halfMode === 'cosine' && legacy.on.heat, '예전 저장 파일(개념 체크)도 조건으로 읽음');
  // 상단 탭: 시각화 / 예제·출력
  page('make'); check(!$('makePage').hidden && $('vizPage').hidden && $('setupLine').textContent.includes('지금 설정') && !!$('items'), '예제·출력 페이지');
  page('viz'); check($('makePage').hidden && !$('vizPage').hidden && !$('nextStep') && !document.querySelector('[data-tab="example"]'), '시각화 페이지, 이전·다음 개념 단추 없음');
  // 메뉴 줄
  check($('menubar').getBoundingClientRect().height <= 34 && !document.querySelector('header.bar'), '제목 아래 얇은 메뉴 줄');
  document.querySelector('[data-menu="view"]').click(); check(!document.querySelector('[data-menu="view"]').nextElementSibling.hidden && S.menuOpen, '보기 메뉴 펼치기');
  document.querySelector('.menu-list [data-page="out"]').click();
  check(S.page === 'out' && !$('outPage').hidden && $('vizPage').hidden && !S.menuOpen && $$('.menu-list:not([hidden])').length === 0 && $('outPreview').textContent.includes('예제 1'), '메뉴에서 출력 화면으로');
  document.querySelector('[data-menu="file"]').click(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); check(!S.menuOpen, 'Esc로 메뉴 닫기');
  document.querySelector('[data-menu="edit"]').click(); document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); check(!S.menuOpen, '바깥을 누르면 메뉴 닫기');
  page('make'); check(!$('makePage').hidden && $('outPage').hidden, '예제 만들기 화면'); page('viz');
  check($('verLabel').textContent === `v${APP_VERSION}` && $('helpTitle').textContent.includes(APP_VERSION), '버전 표시');
  // 구간별 입력과 미리보기
  reset({ f: 'x<0 ? -1 : 1' }); document.querySelector('[data-seg="fMode"][data-value="pieces"]').click();
  check($$('.piece').length === 2 && near(S.R.series.b[1], 4 / PI, 1e-3) && $('fPreview').querySelectorAll('.rows > span').length === 2, '식을 구간별 표로 바꿈');
  $('addPiece').click(); check($$('.piece').length === 3 && $('err').hidden, '구간 추가');
  const until = document.querySelector('[data-piece="1"][data-part="until"]'); until.value = '2'; fire(until, 'input');
  const ex1 = document.querySelector('[data-piece="1"][data-part="expr"]'); ex1.value = 'sin x'; fire(ex1, 'input');
  check(S.cfg.f === 'x<0 ? -1 : x<2 ? sin x : 1' && $('err').hidden && near(S.R.f(1), Math.sin(1), 1e-12) && $('fPreview').textContent.includes('sin'), '구간 값과 식 입력');
  document.querySelector('[data-unpiece="1"]').click(); document.querySelector('[data-unpiece="0"]').click();
  check(S.cfg.fMode === 'single' && S.cfg.f === '1' && !!$('f_f'), '구간을 하나만 남기면 식 하나로');
  set({ f: 'k*x^2' }); check($('fPreview').textContent.replace(/\s/g, '').includes('kx²'), '식 미리보기');
  // 탭
  reset({ on: { coef: true } });
  for (const name of ['concept', 'summary']) { tab(name); check(text().length > 40 && !/NaN|undefined/.test(text()), `${name} 탭`); }
  // 값 대조
  reset({ f: 'sign(x)' }); check(near(S.R.series.b[1], 4 / PI, 1e-3) && text().includes('4/π') && text().includes('4/(3π)'), '사각파의 정확한 계수');
  set({ f: 'x^2' }); check(text().includes('π²/3') && text().includes('− 4 cos x') && text().includes('4/9'), 'x²의 정확한 계수');
  set({ f: 'k*x' }); check(!!$('p_k') && near(S.R.series.b[1], 2, 2e-3), '새 글자 k의 입력 칸');
  $('p_k').value = '3'; fire($('p_k'), 'input'); check(near(S.R.series.b[1], 6, 6e-3), '변수 k를 바꾸면 다시 계산');
  const before = S.R; $('f_f').value = 'sin('; fire($('f_f'), 'input');
  check(!$('err').hidden && S.R === before, '잘못된 수식은 안내하고 이전 결과 유지');
  reset({ f: 'x', on: { coef: true }, coefKind: 'b', coefN: 1 }); check(near(fineCoef(S.R.series, 'b', 1), 2, 1e-6) && text().includes('b1 = 2'), 'f = x의 b₁ = 2');
  set({ coefKind: 'a' }); check(text().includes('함수에 없습니다'), '기함수의 aₙ = 0 안내');
  reset({ f: 'sign(x)', N: 100, on: { gibbs: true } }); check(near(overshoot(S.R.series, S.R.series.jumps[0], 100), .0895, .01) && near(decayPower(S.R.series), 1, .15), 'Gibbs 약 9%, 계수 1/n');
  set({ f: 'abs(x)' }); check(near(decayPower(S.R.series), 2, .2) && text().includes('수렴합니다'), '삼각파 계수 1/n²');
  reset({ f: 'x', on: { half: true }, halfMode: 'cosine' }); check(S.R.series.b.every(v => Math.abs(v) < 1e-9), '우함수 확장은 bₙ = 0');
  set({ halfMode: 'sine' }); check(S.R.series.a.every(v => Math.abs(v) < 1e-9) && near(S.R.series.b[1], 2, 2e-3), '기함수 확장은 aₙ = 0');
  reset({ f: 'sin(pi*x/L)', L: '1', c: '2', N: 10, on: { wave: true } }); check(near(S.R.wave.T, 1, 1e-12) && near(S.R.wave.u(.5, 1), 1, 1e-6) && near(S.R.wave.u(.5, .5), -1, 1e-6), '현: 주기 2L/c');
  set({ f: 'x+1' }); check(text().includes('0이 아니어서'), '끝점 조건 안내');
  set({ f: 'sin(pi*x/L)', waveDomain: 'infinite', X: '8' }); set({ f: 'exp(-x^2)', c: '1' }); check(near(S.R.wave.u(5, 5), .5, 1e-6), '무한히 긴 현: 절반씩 나뉨');
  reset({ f: 'sin(pi*x/L)', L: 'pi', alpha: '1', N: 10, on: { heat: true } }); check(near(S.R.heat.u(PI / 2, 1), Math.exp(-1), 1e-4) && $('settings').textContent.includes('열확산계수 c²'), '막대: e^(−λ²t) 감쇠, c² 표기');
  set({ left: '10', right: '30' }); check(near(S.R.heat.u(PI / 2, 40), 20, 1e-3), '정상 상태는 직선');
  pick('bound', 'free'); set({ f: '10' }); check(S.cfg.halfMode === 'cosine' && !$('f_left') && near(S.R.heat.u(1, 5), 10, 1e-6), '단열: 코사인 전개와 평균');
  set({ f: 'x<L/2 ? x : L-x', bc: 'fixed', left: 'abc' }); check(!$('err').hidden && $('err').textContent.includes('왼쪽'), '잘못된 끝 온도 안내'); set({ left: '0', right: '0' });
  set({ heatDomain: 'infinite', f: 'exp(-x^2)', X: '6' }); check(near(S.R.heat.u(0, 1), 1 / Math.sqrt(5), 1e-3) && near(S.R.heat.total, Math.sqrt(PI), 1e-3) && text().includes('c²'), '무한 막대: 닫힌 해, 전체 열량, c² 표기');
  // 재생
  reset({ on: { wave: true } }); $('playBtn').click(); tick(.1); const moved = S.cfg.s; check(S.playing && moved > 0, '재생'); $('pauseBtn').click(); check(!S.playing && S.cfg.s === moved, '일시정지'); $('stopBtn').click(); check(S.cfg.s === 0, '정지');
  // 표기
  check(prettyExpr('k*x^2', { k: 3 }) === '3x²' && prettyExpr('2*pi') === '2π' && coefText(4 / (49 * PI * PI)) === '4/(49π²)' && coefText(-PI * PI / 3) === '−π²/3' && errText(2.13e-5) === '0.0000213', '읽기 좋은 식과 정확한 값');
  const t1 = tex(String.raw`a_0 = \frac{1}{2L}\int_{-L}^{L} f(x)\,dx`), t2 = tex(String.raw`\sum_{n=1}^{\infty} B_n\sin\frac{n\pi x}{L}e^{-\lambda_n^2 t}`);
  check(tex('E^*').o.includes('∗') && t1.o.includes('<m:f>') && t1.o.includes('<m:nary>') && t1.o.includes('<m:sSub>') && t2.o.includes('∑') && t2.o.includes('<m:sSup>') && t2.h.includes('sin'), '수식 표기($…$) 해석');
  const mb = markupBlocks('글 $x^2$ **굵게**\n\n$$y = 1$$\n\n> 강조');
  check(mb.map(b => b.k).join(',') === 'p,eq,key' && mb[0].seg.some(s => s.bold === '굵게'), '글 표기(문단, 수식, 강조)');
  // 개념 설명 고치기
  reset({ on: { coef: true } }); tab('concept');
  document.querySelector('[data-cedit="series"]').click(); $('conceptText').value = '고친 설명입니다. $a_n$'; document.querySelector('[data-csave="series"]').click();
  check(S.edits.series?.startsWith('고친') && text().includes('고친 설명입니다') && text().includes('고친 설명'), '개념 설명 고치기');
  document.querySelector('[data-cedit="series"]').click(); document.querySelector('[data-creset="series"]').click(); check(S.edits.series === undefined && text().includes('Euler 공식'), '기본값으로');
  // 예제 만들기
  reset({ f: 'sign(x)', on: { coef: true } }); page('make');
  check(S.draft.items.map(i => i.kind).join(',') === 'series,coef' && $$('#items .item').length === 2 && $('exampleEditor').textContent.includes('구하시오'), '자동 초안: 켠 개념마다 소문항');
  const ta0 = document.querySelector('[data-ifield="text"][data-i="0"]'); ta0.value = '함수 $f(x) = \\text{sign}(x)$의 계수를 구하라.'; fire(ta0, 'input');
  check(S.draft.items[0].edited && $('exPreview').textContent.includes('계수를 구하라'), '문장 직접 고치기');
  set({ coefN: 3 }); check(S.draft.items[0].text.includes('구하라') && S.draft.items[1].text.includes('b_{3}'), '설정을 바꾸면 고치지 않은 문장만 바뀜');
  const kindSel = $('addKind'); kindSel.value = 'inverse'; fire(kindSel, 'change');
  check(S.draft.items.length === 3 && S.draft.items[2].text.includes('Fourier 급수가') && S.draft.custom, '소문항 추가(역문제)');
  const kindSel2 = $('addKind'); kindSel2.value = 'free'; fire(kindSel2, 'change'); const ta3 = document.querySelector('[data-ifield="text"][data-i="3"]'); ta3.value = '자유 문항 $x$'; fire(ta3, 'input');
  document.querySelector('[data-imove="3"][data-dir="-1"]').click(); check(S.draft.items[2].kind === 'free', '소문항 순서 바꾸기');
  document.querySelector('[data-idel="2"]').click(); check(S.draft.items.length === 3 && !S.draft.items.some(i => i.kind === 'free'), '소문항 빼기');
  const pts = document.querySelector('[data-ifield="points"][data-i="1"]'); pts.value = '5'; fire(pts, 'input');
  const note = document.querySelector('[data-ifield="note"][data-i="1"]'); note.value = '교수 메모: 넓이로 설명할 것'; fire(note, 'input');
  check($('exPreview').textContent.includes('(5점)') && $('exPreview').textContent.includes('교수 메모'), '배점과 풀이 메모');
  document.querySelector('[data-ifield="auto"][data-i="1"]').click(); check(!S.draft.items[1].auto && !$('exPreview').textContent.includes('곱한 곡선의 넓이는'), '자동 풀이 끄기');
  // 그래프 담기
  $('captureBtn').click(); rerenderTab();
  check(S.draft.figures.length === 1 && S.draft.figures[0].panel === 'coef' && $$('.figrow').length === 1, '그래프 담기');
  const cap = document.querySelector('[data-ffield="caption"]'); cap.value = '내 그림'; fire(cap, 'input');
  const sz = document.querySelector('[data-ffield="size"]'); sz.value = 'small'; fire(sz, 'change');
  check(S.draft.figures[0].caption === '내 그림' && S.draft.figures[0].size === 'small', '그림 설명과 크기');
  $('saveExample').click(); check(S.saved.length === 1 && S.saved[0].items.length === 3 && S.saved[0].figures.length === 1 && !S.draft.custom && S.draft.items.length === 2, '이 예제 담기');
  document.querySelector('[data-edit="0"]').click();
  check(S.draft.editing === 0 && S.draft.items[0].edited && S.page === 'make' && $('saveExample').textContent.includes('예제 1'), '담은 예제 고치기');
  $('saveExample').click(); check(S.saved.length === 1 && S.draft.editing === null, '고친 예제 저장');
  // Word 출력
  const word = (opts = {}) => { Object.assign(S.sheet, opts); return buildDocx('검사', exportBlocks(), docOptions()); };
  let doc = word({ subtitle: '공업수학 2', student: true });
  check(doc.xml.includes('공업수학 2') && doc.xml.includes('학번') && doc.xml.includes('예제 1') && doc.xml.includes('직교성') && doc.xml.includes('계수를 구하라') && doc.xml.includes('(5점)') && doc.xml.includes('교수 메모') && doc.images === 1, 'Word: 직접 만든 문제, 배점, 메모, 담은 그림');
  check(doc.xml.includes('cx="3168000"'), 'Word: 그림 크기(작게)');
  doc = word({ solution: false, concept: false, space: '14' });
  check(!doc.xml.includes('>풀이<') && !doc.xml.includes('개념 정리') && (doc.xml.match(/<w:p\/>/g) ?? []).length >= 14, 'Word: 풀이를 빼면 답 쓰는 칸');
  S.sheet = copy(SHEET);
  // 저장과 불러오기
  const snap = JSON.stringify(stateData()); S.saved = []; S.cfg.f = 'x';
  check(applyState(JSON.parse(snap)) && S.saved.length === 1 && S.saved[0].items[0].edited && S.cfg.f === 'sign(x)', '프로그램 안 저장과 다시 열기');
  const lib = libraryText(); S.saved = [];
  check(importLibrary(lib) === 1 && S.saved[0].figures[0].caption === '내 그림', '예제 모음 파일 저장과 열기');
  let bad = false; try { importLibrary('{"kind":"other"}'); } catch { bad = true; } check(bad, '다른 파일은 거부');
  // 고정해서 비교
  reset({ N: 5 }); $('pinBtn').click(); set({ N: 40 });
  check(!!S.pin && shown() === 'series' && document.querySelector('.pnl .legend').textContent.includes('고정') && S.frames.series.probe(1).length === 3, '같은 개념은 한 칸에 겹쳐 비교');
  pick('time', 'wave'); check(shown() === 'pin+wave' && $$('#panels .pnl .pt')[0].textContent.startsWith('고정'), '다른 개념은 나란히 비교');
  $('pinBtn').click(); draw(); check(!S.pin && shown() === 'wave', '고정 해제');
  // 그래프 범위와 시간 범위
  reset({}); set({ xMin: '-1', xMax: '1' }); check(S.frames.series.xr[0] === -1 && S.frames.series.xr[1] === 1, '가로 범위 지정');
  set({ yMin: '-3', yMax: '3' }); check(S.frames.series.yr[1] === 3, '세로 범위 지정');
  set({ xMax: '-2' }); check(!$('err').hidden && $('err').textContent.includes('가로'), '잘못된 범위 안내');
  set({ xMin: '', xMax: '', yMin: '', yMax: '' }); select('wave'); set({ tEndWave: '5' }); check(S.R.wave.tEnd === 5, '현 끝 시간 지정');
  // 값 읽기, 확대, 펜, 점
  reset({}); const f0 = S.frames.series; check(near(f0.probe(1)[0][1], 1, 1e-12), '값 읽기');
  const ov = document.querySelector('.pnl canvas.ov'), rect = ov.getBoundingClientRect(), cx = rect.left + f0.b.l + f0.b.w * .75, cy = rect.top + rect.height / 2;
  ov.dispatchEvent(new PointerEvent('pointermove', { clientX: cx, clientY: cy, bubbles: true })); check(!$('probe').hidden && $('probe').textContent.includes('S9'), '마우스 위치의 값 표시');
  ov.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true })); draw();
  check(S.zoom?.panel === 'series' && S.frames.series.xr[1] - S.frames.series.xr[0] < f0.xr[1] - f0.xr[0], 'Ctrl+휠 확대(마우스 위치 기준)');
  const z = S.zoom.xr[0]; ov.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: cx, bubbles: true, cancelable: true })); check(S.zoom.xr[0] === z, '휠만으로는 확대되지 않음');
  ov.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); draw(); check(S.zoom === null && S.frames.series.xr[0] === f0.xr[0], '더블클릭 원래대로');
  document.querySelector('[data-tool="pen"]').click();
  ov.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true })); ov.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 30, clientY: cy + 10, bubbles: true })); ov.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  check(S.ink.series?.[0]?.length === 2, '펜으로 그리기');
  document.querySelector('[data-tool="mark"]').click(); ov.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }));
  check(S.marks.series?.length === 1 && near(S.marks.series[0], f0.xr[0] + .75 * (f0.xr[1] - f0.xr[0]), 1e-6), '점 표시');
  $('clearInk').click(); check(!S.ink.series && !S.marks.series, '지우기');
  document.querySelector('[data-tool="view"]').click();
  $('presentBtn').click(); check(getComputedStyle($('settings')).display === 'none', '발표 모드는 설정을 숨김'); $('presentBtn').click();
  // ── 처음 쓰는 사람을 위한 부분 ──
  // 정확한 값: 격자점에 있는 도약은 정확한 꼴, 격자점에 없는 도약은 근삿값(≈)
  reset({ f: 'sign(x)' }); check(exact(fineCoef(S.R.series, 'b', 3)).sure && exact(fineCoef(S.R.series, 'b', 3)).text === '4/(3π)', '정확한 값 확인(사각파 b₃)');
  reset({ f: 'x<1 ? 0 : 1', on: { coef: true } }); page('make'); check(!exact(fineCoef(S.R.series, 'b', 1)).sure && $('exPreview').textContent.includes('≈') && $('exPreview').textContent.includes('근삿값'), '확인되지 않은 값은 ≈로 표시');
  // 고친 문장 경고
  const w0 = document.querySelector('[data-ifield="text"][data-i="0"]'); w0.value = '함수 $f(x) = x^2$의 급수를 구하시오.'; fire(w0, 'input');
  check(!!document.querySelector('.item[data-i="0"] .warn'), '문장을 고치면 자동 풀이 경고');
  document.querySelector('[data-autooff="0"]').click(); check(!S.draft.items[0].auto && !document.querySelector('.item[data-i="0"] .warn'), '경고에서 자동 풀이 끄기');
  // 그림이 옛 설정이면 표시
  $('captureBtn').click(); rerenderTab(); set({ N: 30 }); refreshExample();
  check(!!document.querySelector('[data-frecap="0"]'), '그림을 담은 뒤 설정이 바뀌면 표시');
  document.querySelector('[data-frecap="0"]').click(); check(!document.querySelector('[data-frecap="0"]') && S.draft.figures[0].cfg.N === 30, '지금 설정으로 다시 담기');
  // 담지 않은 예제가 있으면 출력 전에 묻기
  saveExample(); set({ N: 12 });
  check(S.draft.dirty, '담은 뒤 설정을 바꾸면 담지 않은 예제로 봄');
  $('wordBtn').click(); check(!$('exportChoice').hidden && $('choiceAdd').textContent.includes('담고'), 'Word 출력 전에 담지 않은 예제를 물음');
  $('choiceAdd').click(); check(S.saved.length === 2 && $('exportChoice').hidden && !!S.lastDownload, '이 예제도 담고 출력');
  set({ N: 14 }); $('wordBtn').click(); $('choiceOnly').click(); check(S.saved.length === 2 && $('exportChoice').hidden, '담은 예제만 출력');
  // 처음 상태로와 되돌리기
  reset({ f: 'x^3' }); $('resetBtn').click(); check(S.cfg.f === DEFAULTS.f && $('status').textContent.includes('처음 상태'), '처음 상태로');
  $('statusAct').click(); check(S.cfg.f === 'x^3', '되돌리기');
  // 범위·확대 표시
  set({ xMin: '-1', xMax: '1' }); draw(); const badge = document.querySelector('[data-clearrange]');
  check(!!badge, '범위를 정하면 그래프에 표시'); badge.click(); draw(); check(!S.cfg.xMin && !document.querySelector('[data-clearrange]'), '표시를 눌러 범위 지우기');
  // 함께 바뀐 조건 알림
  reset({}); pick('dim', '2'); check($('status').textContent.includes('시간 → 파동') && $('status').textContent.includes('표현'), '함께 바뀐 조건을 알림');
  // 새 변수 알림, 입력 오류 표시, 손으로 쓰는 표기
  reset({}); $('f_f').value = 'a*x'; fire($('f_f'), 'input'); check($('status').textContent.includes("'a'") && !!$('p_a'), '새 변수를 만들면 알림');
  $('f_f').value = 'x²+|x|'; fire($('f_f'), 'input'); check($('err').hidden && near(S.R.f(-2), 6, 1e-12), 'x², |x| 입력');
  $('f_f').value = 'x+#'; fire($('f_f'), 'input'); check(!$('graphErr').hidden && $('graphErr').textContent.includes('마지막으로 계산된'), '입력 오류를 그래프 위에도 표시');
  // 처음 안내와 도움말
  showTour(0); check(!$('tour').hidden && document.querySelector('#baseFields.spot') !== null, '처음 안내 시작');
  for (let i = 0; i < TOUR.length; i++) $('tourNext').click(); check($('tour').hidden && !$$('.spot').length, '처음 안내 끝');
  $('helpBtn').click(); check(!$('help').hidden && $('help').textContent.includes('함수 입력'), '도움말 열기');
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); check($('help').hidden, 'Esc로 도움말 닫기');
  // 저장 알림, 아래 칸 높이 조절
  window.studioSaved('C:/문서/예제.docx', false); check($('status').textContent.includes('열 프로그램'), 'Word가 없을 때 저장 알림');
  const rz = $('resizer'), r0 = $('bottom').getBoundingClientRect().height;
  rz.dispatchEvent(new PointerEvent('pointerdown', { clientY: 500, bubbles: true })); rz.dispatchEvent(new PointerEvent('pointermove', { clientY: 400, bubbles: true })); rz.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  check($('bottom').getBoundingClientRect().height > r0 + 50, '아래 칸 높이 조절');
  rz.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  // ── v0.13 ──
  // 지운 것 되돌리기
  reset({ on: { coef: true } }); saveExample(); saveExample(); renderSaved();
  document.querySelector('[data-unsave="0"]').click(); check(S.saved.length === 1 && $('status').textContent.includes('되돌리기'), '예제를 지우면 되돌리기 알림');
  $('statusAct').click(); check(S.saved.length === 2, '알림의 되돌리기');
  document.querySelector('[data-unsave="1"]').click(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); check(S.saved.length === 2, 'Ctrl+Z로 되돌리기');
  page('make'); document.querySelector('[data-idel="0"]').click(); check(S.draft.items.length === 1, '소문항 지우기'); $('statusAct').click(); check(S.draft.items.length === 2, '소문항 되돌리기'); page('viz');
  // 키보드로 그래프 다루기, 값 표
  reset({}); const ovk = document.querySelector('.pnl canvas.ov'); ovk.focus();
  const key = k => ovk.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  key('ArrowRight'); check(S.hover?.key === 'series' && $('liveProbe').textContent.includes('S9'), '→ 키로 값 읽기(화면 낭독기에도)');
  key('+'); draw(); check(S.zoom?.panel === 'series', '+ 키로 확대'); key('0'); draw(); check(S.zoom === null, '0 키로 원래대로');
  key('Enter'); check(S.marks.series?.length === 1, 'Enter로 점 표시');
  tab('summary'); draw(); check(!!$('tabBody').querySelector('.vtable table tr td'), '요약의 그래프 값 표');
  // N 200, 도약점 고르기
  reset({ N: 200, on: { gibbs: true } }); check(+$('f_N').max === 200 && near(S.R.series.b[199], 4 / (199 * PI), 1e-4), 'N 최대 200');
  set({ jumpIndex: 2 }); check(S.R.series.jumps.length >= 2 && !!$('f_jumpIndex') && $$('#panels .pt')[0].textContent.includes(piLabel(S.R.series.jumps[1].x, S.R.series.L)), '확대할 도약점 고르기');
  // 기호 풀이(일반항)
  reset({ f: 'sign(x)' }); let sol = solutionText('series', S.good, S.R);
  check(sol.includes('\\frac{2}{n\\pi} - \\frac{2}{n\\pi}(-1)^{n}') && sol.includes('홀수이면 $b_n = \\frac{4}{n\\pi}$') && sol.includes('짝수이면 $b_n = 0$') && sol.includes('검산'), '사각파 일반항과 짝홀 정리');
  set({ f: 'x^2' }); sol = solutionText('series', S.good, S.R); check(sol.includes('\\frac{4}{n^{2}}(-1)^{n}') && sol.includes('a_0 = \\frac{\\pi^{2}}{3}') && sol.includes('부분적분'), 'x² 일반항과 부분적분 공식');
  reset({ f: 'x<L/2 ? x : L-x', L: '1', on: { half: true }, halfMode: 'sine' }); sol = solutionText('series', S.good, S.R); check(sol.includes('\\sin\\frac{n\\pi}{2}') && sol.includes('\\pi^{2}'), '삼각형 반구간 사인 일반항(sin nπ/2)');
  set({ f: 'x>0 ? sin(x) : 0', L: 'pi', on: { ...S.cfg.on, half: false } }); sol = solutionText('series', S.good, S.R); check(!sol.includes('검산') && sol.includes('근삿값'), '기호 계산을 못 하는 함수는 수치 풀이만');
  reset({ f: 'x<L/2 ? x : L-x', L: '1', on: { wave: true } }); sol = solutionText('wave', S.good, S.R); check(sol.includes('B_n = ') && sol.includes('\\sin\\frac{n\\pi}{2}'), '현의 Bₙ 일반항');
  // Fourier 적분, 막, 감쇠, 자유 끝
  reset({ f: 'exp(-x^2)', X: '8', wMax: '10', on: { transform: true } }); const T = S.R.transform, i1 = T.ws.findIndex(w => w >= 1 - 1e-9);
  check(shown() === 'transform' && near(T.A[i1], Math.exp(-.25) / Math.sqrt(PI), 1e-4) && Math.max(...T.B.map(Math.abs)) < 1e-6 && near(T.recon(0), 1, 1e-3) && painted(), 'Fourier 적분: A(w) = e^(−w²/4)/√π, 다시 만든 f(0) = 1');
  reset({ f: 'sin(pi*x/L)', L: '1', c: '1', b: '1', h: 'sin(pi*y/b)', M: 6, on: { membrane: true } });
  check(shown() === 'membrane' && S.cfg.on.wave && S.cfg.on.half && near(S.R.membrane.u(.5, .5, 1), Math.cos(PI * Math.SQRT2), 1e-6) && painted(), '막: 한 모드면 cos(λ₁₁t), λ₁₁ = cπ√2');
  reset({ f: 'sin(pi*x/L)', L: '1', c: '1', damping: '0.5', on: { wave: true } }); const mu = Math.sqrt(PI * PI - .25);
  check(near(S.R.wave.u(.5, 1), Math.exp(-.5) * (Math.cos(mu) + .5 / mu * Math.sin(mu)), 1e-6) && $('tabBody').textContent.includes('감쇠'), '감쇠 있는 현');
  set({ damping: '0', waveEnds: 'free', f: 'cos(pi*x/L)' }); check(near(S.R.wave.u(0, 1), -1, 1e-6) && near(S.R.wave.u(.3, 2), Math.cos(.3 * PI), 1e-6), '양 끝이 자유로운 현');
  // 속도: 같은 함수면 급수를 다시 계산하지 않음
  reset({ f: 'x^2' }); solutionText('series', S.good, S.R); const t0 = performance.now(); set({ N: 50 }); set({ N: 60 }); const ms = (performance.now() - t0) / 2;
  check(ms < 400, `N을 바꿀 때 다시 계산 ${ms.toFixed(0)}ms`);
  // 그림: 펜 표시와 SVG
  reset({}); S.ink.series = [[[0, 0], [1, .5]]]; $('captureBtn').click();
  check(S.draft.figures[0].ink.length === 1, '그래프 담기에 펜 표시 포함');
  const img = figureImage(S.draft.figures[0]); check(img.svg.startsWith('<svg') && img.svg.includes('<path') && img.svg.includes('<text') && /stroke="(#|rgb)/.test(img.svg), 'Word 그림 SVG(도형으로 고칠 수 있음)');
  const docSvg = buildDocx('검사', exportBlocks(), docOptions()); check(docSvg.xml.includes('svgBlip') && docSvg.images === 1, 'Word에 SVG와 PNG를 함께 넣음');
  check(prettyExpr('x>-1 ? (x<1 ? 1 : 0) : 0') === '1 (x < 1), 0 (그 외) (x > −1), 0 (그 외)' && !tex('\\int x\\,dx').o.includes('<m:sub><m:r>') || tex('\\int x\\,dx').o.includes('subHide'), '중첩 조건식 읽기, 끝 없는 적분');
  reset({ f: 'x>-1 ? (x<1 ? 1 : 0) : 0' }); check($('fPreview').querySelectorAll('.rows > span').length === 3 && $('fPreview').textContent.includes('−1 ≤ x < 1') && fMarkup(S.cfg).includes('-1 \\le x < 1'), '중첩 조건식을 실제 구간으로 보여 줌');
  // PDF(인쇄) 문서
  S.fakeDownload = true; exportPdf(); check($('printArea').textContent.includes('예제 1') && $('printArea').querySelectorAll('figure img').length === 1 && document.documentElement.dataset.theme === 'light' || !!S.lastDownload, 'PDF 인쇄 문서');
  // 프로그램 검사는 이 상태로 Word 단추를 누릅니다(예제 1개: 급수·계수 소문항, 자동 그림 2개).
  reset({ on: { coef: true } }); saveExample();
  S.fakeDownload = false;
  return report;
};
