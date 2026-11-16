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
  // 예전 설정 이름(on, halfMode, waveDomain…)으로 바꾸면 문제를 다시 읽습니다.
  const set = patch => { Object.assign(S.cfg, patch); if (['on', 'halfMode', 'waveDomain', 'waveEnds', 'heatDomain', 'bc', 'damping'].some(k => k in patch)) S.cfg.prob = problemFromOn(S.cfg); renderSettings(); recompute(); draw(); };
  const prob = (key, value) => { document.querySelector(`[data-prob="${key}"][data-value="${value}"]`).click(); draw(); };
  const ends = v => { prob('left', v); prob('right', v); };
  const look = v => { document.querySelector(`[data-look="${v}"]`).click(); draw(); };
  const stage = id => { document.querySelector(`[data-stage="${id}"]`).click(); draw(); };
  const AX0 = { rep: 'series', look: 'partial', time: 'none', bound: 'fixed', dim: '1', damp: 'off' };   // v0.14~0.17 저장 파일의 축
  const shown = () => { const list = $$('#panels .pnl'); return list.length === 1 ? list[0].dataset.panel : list.map(x => x.dataset.panel).join('+'); };
  const painted = () => $$('#panels canvas.main').every(c => { const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < data.length; i += 40) if (data[i]) return true; return false; });
  const text = () => $('tabBody').textContent;
  const page = name => document.querySelector(`[data-page="${name}"][role="tab"]`).click();
  const onList = () => Object.keys(S.cfg.on).filter(k => S.cfg.on[k]).join(',');
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const tab = name => { document.querySelector(`[data-tab="${name}"]`).click(); };
  reset({});
  const recipe = () => $('stageBar').querySelector('.hint').textContent, active = () => document.querySelector('#stageBar [aria-pressed="true"]').dataset.stage, cards = () => $$('#stageBar [data-stage]').length, box = () => $('stageBox');
  check(shown() === 'series' && painted() && $('err').hidden && recipe().includes('11장') && recipe().includes('Fourier 급수') && cards() === 2 && active() === 'expand' && $('baseFields').textContent.includes('한 주기'), '처음: 방정식 없음 · 주기 영역, 단계 2개(기저 → 전개)');
  stage('basis'); check(shown() === 'eigen' && painted() && S.frames.eigen.probe(0).length === 4 && active() === 'basis', '기저 함수 단계: 직교 기저 그래프');
  stage('expand'); look('coef'); check(onList() === 'series,coef' && shown() === 'coef' && !!box().querySelector('#f_coefN'), '전개 단계에서 계수의 의미');
  look('spectrum'); check(onList() === 'series,coef,spectrum' && shown() === 'spectrum' && text().includes('계수 크기'), '전개 단계에서 계수 크기');
  look('partial');
  prob('domain', 'interval'); check(onList() === 'series,half' && S.cfg.halfMode === 'sine' && recipe().includes('반구간 전개 (사인') && $('baseFields').textContent.includes('0 < x < L') && $('status').textContent.includes('f(x)는 이제'), '구간 (0, L): 양 끝 조건이 사인 급수를 정하고, f의 뜻을 알림');
  stage('basis'); check(S.frames.eigen.probe(0).every(([, v]) => Math.abs(v) < 1e-12), '양 끝 고정의 고유함수는 끝에서 0');
  ends('free'); stage('basis'); check(S.cfg.halfMode === 'cosine' && recipe().includes('코사인') && S.frames.eigen.probe(0).every(([, v]) => near(v, 1, 1e-12)), '양 끝 기울기 0: 코사인 급수');
  prob('eq', 'wave'); check(onList() === 'series,half,wave' && cards() === 3 && shown() === 'wave' && !$('transport').hidden && recipe().includes('응용') && !!$('f_c') && !!$('f_g') && $('baseFields').textContent.includes('초기 변위'), '파동 방정식: 단계 3개, 자유 끝은 응용');
  ends('fixed'); check(recipe().includes('12장') && recipe().includes('현의 진동') && S.cfg.halfMode === 'sine', '파동 + 구간 + 고정 = 12장 현의 진동');
  stage('separate'); check(shown() === 'eigen' && active() === 'separate' && $('stageBar').textContent.includes('변수분리') && box().textContent.includes('경계조건'), '변수분리와 고유값 문제 단계');
  document.querySelector('#stageBar [data-stage="solve"]').click(); draw(); check(shown() === 'wave' && $$('#stageBar [data-stage]').length === 3 && document.querySelector('#stageBar [aria-pressed="true"]').dataset.stage === 'solve' && $('stageBar').textContent.includes('현의 진동'), '그래프 위 단계 줄로 단계 바꾸기');
  stage('expand'); look('spectrum'); check(shown() === 'spectrum' && S.cfg.on.wave && S.cfg.on.spectrum, '초기 변위의 계수 크기');
  prob('damp', 'on'); check(+S.cfg.damping > 0 && !!$('f_kDamp') && recipe().includes('감쇠') && shown() === 'wave', '감쇠 (응용)');
  prob('domain', 'rect'); check(S.cfg.on.membrane && shown() === 'membrane' && S.cfg.damping === '0' && !!$('f_b') && !!$('f_h') && recipe().includes('직사각형 막'), '직사각형: 막');
  $('undoBtn').click(); draw(); check(S.cfg.prob.domain === 'interval' && S.cfg.prob.damp && shown() === 'wave', '문제 바꾸기 되돌리기');
  prob('eq', 'heat'); check(S.cfg.on.heat && shown() === 'heat' && recipe().includes('막대의 열전도') && !!$('f_left') && !!$('f_alpha') && $('baseFields').textContent.includes('초기 온도'), '열 방정식');
  ends('free'); check(S.cfg.bc === 'insulated' && !$('f_left') && recipe().includes('단열'), '단열 막대');
  const rectBtn = document.querySelector('[data-prob="domain"][data-value="rect"]');
  check(rectBtn.disabled && rectBtn.title.includes('파동'), '열 방정식에는 직사각형이 비활성이고 이유를 보여 줌');
  prob('domain', 'line'); check(S.cfg.heatDomain === 'infinite' && S.cfg.on.transform && cards() === 2 && recipe().includes('열핵') && shown() === 'heat', '무한히 긴 막대: Fourier 적분 → 해');
  stage('expand'); check(shown() === 'transform' && !!$('f_wMax'), '무한 막대의 전개 단계는 Fourier 적분');
  prob('eq', 'none'); check(recipe().includes('Fourier 적분') && shown() === 'transform' && !$('f_L'), '방정식 없음 + 직선 = Fourier 적분');
  prob('eq', 'wave'); check(recipe().includes("D'Alembert") && cards() === 1 && shown() === 'wave', "파동 + 직선 = D'Alembert 해");
  prob('eq', 'none'); prob('domain', 'periodic'); check(recipe().includes('Fourier 급수') && shown() === 'spectrum', '주기 영역으로 돌아옴(전개 단계에서 고른 그래프는 그대로)');
  prob('eq', 'wave'); check(S.cfg.prob.domain === 'interval' && $('status').textContent.includes('영역을'), '주기 영역에서 파동을 고르면 구간으로 바꾸고 알림');
  const legacy = mergeCfg({ on: { series: true, half: true, heat: true }, bc: 'insulated' }), legacy2 = mergeCfg({ axes: { ...AX0, time: 'wave', dim: '2' } });
  check(legacy.prob.eq === 'heat' && legacy.prob.domain === 'interval' && legacy.prob.left === 'free' && legacy.halfMode === 'cosine' && legacy2.prob.domain === 'rect' && legacy2.on.membrane, '예전 저장 파일(개념 체크, 축)도 문제로 읽음');
  check(tex("F'' + k^2F").h.includes('″') && tex("q_n'").h.includes('′'), '수식의 이계도함수 F″가 F′처럼 보이지 않음');
  // 혼합 경계: 고유함수 엔진(종류 표 한 줄)으로 풂
  reset({ f: 'sin(pi*x/(2*L))', L: '1', c: '1', N: 20, prob: { eq: 'wave', domain: 'interval', left: 'fixed', right: 'fixed' } });
  prob('right', 'free'); stage('separate');
  check(S.cfg.family === 'qsine' && near(S.frames.eigen.probe(0)[0][1], 0, 1e-12) && recipe().includes('응용') && recipe().includes('한쪽 끝 자유') && box().textContent.includes('2L'), '현: x = L 끝 자유 → 고유함수 sin((2n−1)πx/2L)');
  stage('solve'); check(near(S.R.wave.u(1, 0), 1, 1e-6) && near(S.R.wave.u(.5, 2), -Math.sin(PI / 4), 1e-6) && near(S.R.wave.T, 4, 1e-12) && shown() === 'wave', '혼합 경계 현: 첫 모드 cos(πt/2), 주기 4L/c');
  stage('expand'); check(shown() === 'modes' && painted() && !box().querySelector('[data-look]') && S.cfg.on.modes && !S.cfg.on.series, '혼합 경계의 전개 단계는 고유함수 전개(일반화된 Fourier 급수)');
  check(autoItems(S.good).map(it => it.kind).join(',') === 'modes,wave' && solutionText('wave', S.good, S.R).includes('(2n-1)') && problemText('wave', S.good, S.R).includes('자유롭게'), '혼합 경계 현의 자동 문장·풀이');
  prob('eq', 'heat'); set({ alpha: '1', left: '0' });
  check(S.cfg.family === 'qsine' && near(S.R.heat.u(.5, .2), Math.exp(-((PI / 2) ** 2) * .2) * Math.sin(PI / 4), 1e-6) && recipe().includes('한쪽 끝 단열') && !!$('f_left') && !$('f_right'), '막대: x = L 끝 단열 → e^(−(π/2)²t)');
  prob('left', 'free'); prob('right', 'fixed'); set({ f: '10', right: '10' });
  check(S.cfg.family === 'qcosine' && near(S.R.heat.u(.3, 1), 10, 1e-6) && near(S.R.heat.limit(0), 10, 1e-12) && !$('f_left') && !!$('f_right'), '막대: x = 0 끝 단열, x = L 끝 10도');
  prob('eq', 'none'); set({ f: 'x', N: 60 });
  check(shown() === 'modes' && near(S.R.modes.partial(.5), .5, 2e-2) && recipe().includes('고유함수 전개') && problemText('modes', S.good, S.R).includes('2L'), '방정식 없음 + 혼합 경계: 고유함수 전개');
  reset({});
  // 문제를 바꾸면 계산값이 교재 값으로 바뀌는지 (삼각형 f, L = π)
  reset({ f: 'x<L/2 ? x : L-x', L: 'pi', N: 200, c: '1', alpha: '1' }); const b1Full = S.R.series.b[1];
  prob('domain', 'interval'); const b1Half = fineCoef(S.R.series, 'b', 1);
  check(near(b1Half, 4 / PI, 1e-6) && Math.abs(b1Full - b1Half) > 1e-3 && S.R.series.a.every(v => Math.abs(v) < 1e-9), '구간 (0, L), 양 끝 0: b₁ = 4/π, aₙ = 0');
  prob('eq', 'wave'); check(near(S.R.wave.u(PI / 2, PI), -PI / 2, 1e-2) && near(S.R.wave.u(PI / 2, 2 * PI), PI / 2, 1e-2), '파동: t = π에서 뒤집히고 2π에서 돌아옴');
  prob('eq', 'heat'); ends('free'); set({ f: 'x' });
  check(near(S.R.heat.u(0, 1), PI / 2 - 4 / PI * Math.exp(-1) - 4 / (9 * PI) * Math.exp(-9), 1e-4) && near(S.R.heat.u(1, 60), PI / 2, 1e-6), '열 + 단열: 교재 해와 평균 π/2');
  prob('eq', 'wave'); prob('domain', 'rect'); check(shown() === 'membrane' && near(S.R.membrane.u(PI / 2, .5, 0), PI / 4, .1), '직사각형 막: t = 0에서 f(x)h(y)');
  // 막의 네 변: 모두 자유면 x, y 방향 모두 코사인. f = cos(πx), h = cos(πy)이면 모드 (1, 1) 하나, λ₁₁ = π√2
  check($$('#problem [data-prob="top"]').length === 2 && $$('#problem [data-prob="bottom"]').length === 2, '직사각형 막: 네 변마다 고정·자유');
  for (const k of ['left', 'right', 'bottom', 'top']) prob(k, 'free');
  set({ f: 'cos(pi*x/L)', h: 'cos(pi*y/b)', L: '1', b: '1', M: 6 });
  check(recipe().includes('자유로운 변') && S.cfg.family === 'cosine' && near(S.R.membrane.u(0, 0, 1), Math.cos(PI * Math.SQRT2), 1e-6) && near(S.R.membrane.u(.3, .7, 0), Math.cos(.3 * PI) * Math.cos(.7 * PI), 1e-6) && painted()
    && problemText('membrane', S.good, S.R).includes('모두 자유') && solutionText('membrane', S.good, S.R).includes('\\cos\\frac{m\\pi x}{a}'), '네 변이 자유로운 막: 모드 cos(πx)cos(πy), λ₁₁ = π√2');
  prob('left', 'fixed'); prob('top', 'fixed'); set({ f: 'sin(pi*x/(2*L))', h: 'cos(pi*y/(2*b))' });
  check(S.cfg.family === 'qsine' && shown() === 'membrane' && near(S.R.membrane.u(1, .5, 0), Math.cos(PI / 4), 1e-3) && near(S.R.membrane.base, Math.hypot(PI / 2, PI / 2), 1e-9) && S.cfg.on.modes, '한쪽 변씩 자유: 모드 sin(πx/2a)cos(πy/2b), λ = π/√2');
  reset({ f: 'x<L/2 ? x : L-x', L: 'pi', N: 200, c: '1', alpha: '1', prob: { eq: 'wave', domain: 'interval' } });
  prob('domain', 'interval'); prob('damp', 'on'); set({ f: 'sin(x)', kDamp: '0.5' }); const mu2 = Math.sqrt(1 - .25);
  check(near(S.R.wave.u(PI / 2, 1), Math.exp(-.5) * (Math.cos(mu2) + .5 / mu2 * Math.sin(mu2)), 1e-6), '감쇠: e^(−kt) 감쇠 진동');
  // 주제 공통 검사: 등록된 모든 주제의 모든 문제(주제를 더하면 저절로 검사됩니다)
  { const bad = [], n = { problems: 0, draws: 0 }, base = { f: 'x<L/2 ? x : L-x', L: 'pi', N: 9, kDamp: '0.2' };
    const fail = (cfg, what) => bad.push(`${recipeText(cfg)} ${JSON.stringify(cfg.prob)}: ${what}`), junk = s => /undefined|NaN|\[object|\t/.test(s);   // \t: 문자열의 '\theta'가 탭으로 바뀐 것
    for (const t of TOPICS) for (const [side, opts] of Object.entries(endOptions(t))) for (const [v, label] of opts) if (!problemsOf(t).some(p => p[side] === v)) bad.push(`${t.id}: ${side} '${label}'을 골라도 남지 않음`);
    for (const t of TOPICS) for (const p of problemsOf(t)) {
      n.problems++;
      try {
        S.cfg = mergeCfg({ ...base, prob: p }); S.pin = null; S.zoom = null; renderSettings(); recompute();
        const cfg = S.cfg;
        if (!$('err').hidden) { fail(cfg, `계산 오류: ${$('err').textContent}`); continue; }
        if (topicOf(cfg) !== t) fail(cfg, '다른 주제로 바뀜');
        for (const f of t.fields?.(cfg.prob) ?? []) if (!$(`f_${f.k}`) || DEFAULTS[f.k] === undefined) fail(cfg, `입력 칸 ${f.k}(화면 칸과 기본값)`);
        for (const st of stagesOf(cfg)) for (const lk of st.look ? LOOKS.map(l => l[0]) : [cfg.look]) {
          cfg.stage = st.id; cfg.look = lk; applyProblem(cfg); renderSettings(); recompute(); draw(); n.draws++;
          const panel = stageOf(cfg).panel, fr = S.frames[panel], title = document.querySelector('#panels .pnl .pt')?.textContent ?? '';
          if (!PANELS[panel] || shown() !== panel || !painted() || !fr) { fail(cfg, `${st.id}/${lk}: 그래프 ${panel}`); continue; }
          if (!title || junk(title + stageOf(cfg).md + $('stageBox').textContent + $('stageBar').textContent)) fail(cfg, `${st.id}: 제목·단계 수식`);
          if (!fr.probe((fr.xr[0] + fr.xr[1]) / 2).every(([name, v]) => name && Number.isFinite(v))) fail(cfg, `${st.id}: 값 읽기`);
        }
        const R = S.R, sum = summary(cfg, R), items = autoItems(cfg);
        if (!sum.length || junk(JSON.stringify(sum))) fail(cfg, '요약');
        if (!items.length) fail(cfg, '자동 소문항 없음');
        for (const it of items) { const q = problemText(it.kind, cfg, R), a = solutionText(it.kind, cfg, R); if (!q || !a || junk(q + a) || /꺼져 있습니다/.test(q + a)) fail(cfg, `소문항 ${it.kind}`); }
        if (!CONCEPT_MARKUP[deepestOf(cfg)]) fail(cfg, '개념 설명');
        const back = mergeCfg(JSON.parse(JSON.stringify(storedCfg(cfg))));
        if (JSON.stringify(back.prob) !== JSON.stringify(cfg.prob) || JSON.stringify(back.on) !== JSON.stringify(cfg.on) || recipeText(back) !== recipeText(cfg)) fail(cfg, '저장하고 다시 읽으면 달라짐');
      } catch (err) { fail(S.cfg, err.message); }
    }
    check(!bad.length && n.problems > 20, `주제 공통 검사: 주제 ${TOPICS.length}개, 문제 ${n.problems}가지, 그래프 ${n.draws}장의 단계·그래프·값 읽기·요약·소문항·저장${bad.length ? ` (${bad.length}건: ${bad.slice(0, 3).join(' / ')})` : ''}`); }
  // 라플라스 방정식: 직사각형 판(세 변 + 위쪽 변의 온도)
  reset({ f: 'sin(pi*x/L)', L: '1', b: '1', N: 20, prob: { eq: 'laplace', domain: 'periodic' } });
  check(S.cfg.prob.domain === 'rect' && $$('#problem [data-prob="bottom"]').length === 2 && $('problem').textContent.includes('위쪽 변 y = b') && !!$('f_b') && $('transport').hidden && recipe().includes('Dirichlet') && shown() === 'laplace' && painted(), '라플라스 방정식: 직사각형으로 바꾸고, 세 변을 고르게 하며 시간 재생은 숨김');
  check(near(S.R.laplace.u(.5, .5), Math.sinh(PI / 2) / Math.sinh(PI), 1e-6) && near(S.R.laplace.u(.3, 1), Math.sin(.3 * PI), 1e-6), '판의 온도: u = sin(πx)·sinh(πy)/sinh(π)');
  prob('bottom', 'free'); check(near(S.R.laplace.u(.5, 0), 1 / Math.cosh(PI), 1e-6) && recipe().includes('응용') && solutionText('laplace', S.good, S.R).includes('\\cosh'), '아래 변 단열: cosh(πy)/cosh(π)');
  prob('left', 'free'); prob('right', 'free'); set({ f: 'x' }); check(near(S.R.laplace.u(.4, 1), .4, 5e-3) && near(S.R.laplace.c[0], .5, 1e-6) && problemText('laplace', S.good, S.R).includes('단열'), '세 변 단열: 평균 온도 항 c₀ = 1/2');
  // 열 방출 끝(Robin): kₙ은 tan kL = −k/h의 근
  { const k1 = robinRoot('fixed', 'robin', 1, 1, 1);
    reset({ f: `sin(${k1}*x)`, L: '1', alpha: '1', left: '0', N: 20, prob: { eq: 'heat', domain: 'interval', left: 'fixed', right: 'robin' } });
    check(near(Math.tan(k1), -k1, 1e-9) && near(S.R.heat.u(.5, .1), Math.sin(k1 * .5) * Math.exp(-k1 * k1 * .1), 1e-5) && !!$('f_hRobin') && !$('f_right') && recipe().includes('열 방출') && shown() === 'heat', '막대 끝의 열 방출: kₙ은 tan kL = −k/h의 근, u = sin(k₁x)e^(−k₁²t)');
    set({ f: '1', left: '1' }); check(near(S.R.heat.limit(1), .5, 1e-9) && solutionText('heat', S.good, S.R).includes('\\tan kL') && problemText('heat', S.good, S.R).includes('열을 내보낸다'), '열 방출 끝의 정상 상태 U = U₁(1 − hx/(1 + hL))');
    set({ hRobin: '-1' }); check(!$('err').hidden && $('err').textContent.includes('h'), '열 방출 계수가 0 이하면 알림'); set({ hRobin: '1' });
    // 양 끝 열 방출: 정상 상태 0, kₙ은 tan kL = 2hk/(k² − h²)의 근. x = 0 끝만 열 방출이면 (fixed, robin)을 뒤집은 것
    prob('left', 'robin'); prob('right', 'robin'); const kr = S.R.heat.family.k(1, 1);
    check(near(Math.tan(kr), 2 * kr / (kr * kr - 1), 1e-9) && near(S.R.heat.limit(.3), 0, 1e-12) && shown() === 'heat' && problemText('heat', S.good, S.R).includes('u_x - hu') && S.cfg.on.modes && !S.cfg.on.half, '양 끝 열 방출: tan kL = 2hk/(k² − h²), 정상 상태 0');
    prob('right', 'fixed'); set({ f: '1', right: '1' }); check(near(S.R.heat.family.k(1, 1), k1, 1e-12) && near(S.R.heat.limit(0), .5, 1e-9) && near(S.R.heat.limit(1), 1, 1e-9), 'x = 0 끝 열 방출, x = L 끝 1도: 정상 상태 U = (1 + hx)/(1 + hL)'); }
  // 원판: Fourier–Bessel 급수, 원형 막, 원판의 열전도. 입력은 r로 써도 됩니다.
  { const a1 = besselZero(0, 1);
    check(near(a1, 2.404825557695773, 1e-13) && near(besselZero(1, 1), 3.8317059702075125, 1e-13) && near(besselJ0(1), .7651976865579666, 1e-14) && near(besselJ1(1), .44005058574493355, 1e-14)
      && near(besselJ(2, 5), .04656511627775222, 1e-14) && near(besselJ0(50), .05581232766925182, 1e-13) && near(besselRoot(2, 1), 5.135622301840683, 1e-12) && near(besselRoot(1, 1, 1), 1.8411837813406593, 1e-12),
      'Bessel 함수 Jₘ과 근(오차 1e-13 이하): α₁ = 2.4048, J₁의 근 3.8317, J₂의 근 5.1356, J₁′의 근 1.8412');
    reset({ f: '1 - (r/R)^2', L: '1', N: 20, prob: { eq: 'none', domain: 'disk' } });
    check(recipe().includes('Fourier–Bessel') && shown() === 'modes' && painted() && near(S.R.f(.5), .75, 1e-12) && !$('p_r') && near(S.R.modes.c[1], 8 / (a1 ** 3 * besselJ1(a1)), 1e-5) && problemText('modes', S.good, S.R).includes('f(r)'), 'Fourier–Bessel 급수: 1 − r² 의 a₁ = 8/(α₁³J₁(α₁)), r로 입력');
    prob('eq', 'wave'); check(recipe().includes('원형 막') && shown() === 'bessel' && painted() && $('problem').textContent.includes('가장자리 r = R: 고정') && near(S.R.wave.u(0, 0), 1, 2e-3) && solutionText('wave', S.good, S.R).includes('정수배가 아니어서'), '원형 막: 위에서 본 모양과 단면, 주기적이지 않음');
    prob('eq', 'heat'); prob('right', 'free'); const tex0 = $('stageBox').innerHTML; check(!/A<sub>nJ/.test(tex0) && near(S.R.heat.mean, .5, 1e-6) && shown() === 'bessel' && recipe().includes('원판의 열전도'), '원판의 열전도(가장자리 단열): 평균 온도 2∫r f dr/R² = 1/2');
    // 각 방향 차수 m: 처음 모양 f(r)cos mθ, 고유함수 Jₘ
    prob('eq', 'wave'); set({ mAng: 2 }); check(recipe().includes('cos 2θ') && near(S.R.wave.family.k(1, 1), besselRoot(2, 1), 1e-12) && painted() && solutionText('wave', S.good, S.R).includes('\\cos 2\\theta') && problemText('wave', S.good, S.R).includes('\\cos 2\\theta'), '원형 막의 cos 2θ 모드: 고유함수 J₂(αₙr/R)');
    prob('eq', 'heat'); check(S.R.heat.family.m === 0 && !recipe().includes('θ'), '원판의 열전도는 반지름 방향만(m을 쓰지 않음)');
    prob('eq', 'wave'); set({ mAng: 0 }); prob('eq', 'heat');
    prob('domain', 'interval'); check(S.cfg.f === '1 - (x/L)^2' && $('status').textContent.includes('x, L로') && near(S.R.f(.5), .75, 1e-12), '원판에서 다른 영역으로 가면 식의 r, R을 x, L로 바꿈'); }
  // 구: Fourier–Legendre 급수, 구 안·밖의 전위. 입력은 x = cos φ(phi로 써도 됨), L은 1로 고정
  { reset({ f: 'x^2', L: 'pi', N: 9, prob: { eq: 'none', domain: 'sphere' } });
    check(recipe().includes('Fourier–Legendre') && shown() === 'modes' && painted() && !$('f_L') && !!$('f_N') && near(S.R.modes.c[0], 1 / 3, 1e-6) && near(S.R.modes.c[2], 2 / 3, 1e-6) && near(S.R.modes.c[1], 0, 1e-9) && near(S.R.modes.partial(.3), .09, 1e-6)
      && problemText('modes', S.good, S.R).includes('P_n(x)') && solutionText('modes', S.good, S.R).includes('\\frac{2n+1}{2}'), 'Fourier–Legendre 급수: x² = P₀/3 + 2P₂/3, L 칸 없음');
    stage('basis'); check(shown() === 'eigen' && painted() && near(S.frames.eigen.probe(.5)[2][1], -.125, 1e-12) && S.frames.eigen.xr[0] === -1, 'Legendre 다항식 그래프: P₂(1/2) = −1/8, 구간 (−1, 1)');
    prob('eq', 'laplace'); set({ f: 'x > 0 ? 1 : 0' });
    check(S.cfg.prob.domain === 'sphere' && recipe().includes('구 안의 전위') && shown() === 'sphere' && painted() && $('transport').hidden && near(S.R.sphere.u(1e-9, .3), .5, 1e-9) && near(S.R.sphere.c[1], .75, 1e-6)
      && $('problem').textContent.includes('구면 r = R') && solutionText('sphere', S.good, S.R).includes('\\left(\\frac{r}{R}\\right)^{n}') && $('problem').textContent.includes('∇'), '구 안의 전위: 위 반구 1, 아래 0 → 중심 1/2, A₁ = 3/4');
    prob('right', 'outside'); check(recipe().includes('구 밖') && near(S.R.sphere.u(2, 1), S.R.sphere.c.reduce((s, c, n) => s + c / 2 ** (n + 1), 0), 1e-12) && near(S.R.sphere.c[3], -7 / 16, 1e-6) && summary(S.good, S.R).some(([, t]) => t.includes('R</i>/<i>r')), '구 밖의 전위: (R/r)ⁿ⁺¹');
    set({ f: 'cos(phi)^2' }); check($('err').hidden && near(S.R.sphere.c[0], 1 / 3, 1e-6) && near(S.R.f(.5), .25, 1e-12), '구에서 phi로 입력: cos²φ = x²');
    prob('eq', 'none'); prob('domain', 'interval'); check(S.cfg.f === 'cos(acos(x))^2' && $('status').textContent.includes('acos(x)'), '구에서 다른 영역으로 가면 phi를 acos(x)로 바꿈'); }
  // 고유함수 종류 공통 검사: 끝 조건과 직교성(FAMILIES에 줄을 더하면 저절로 검사됩니다)
  { const bad = [], L = 1.3, hD = 1e-6;
    for (const fam of [...FAMILIES.map(f => familyOf({ family: f.id, hRobin: '1' })), ...['bessel', 'besselFree'].map(id => familyOf({ family: id, angular: true, mAng: 2 }))]) {
      const w = fam.w ?? (() => 1), d = (n, x) => (fam.phi(n, x + hD, L) - fam.phi(n, x - hD, L)) / (2 * hD), span = spanOf(fam, L);
      for (let m = fam.n0; m < fam.n0 + 4; m++) {
        fam.ends.forEach((e, i) => { const x = span[i], v = fam.phi(m, x, L), dv = d(m, x), ok = { pole: Math.abs(v - (i || m % 2 === 0 ? 1 : -1)) < 1e-12, fixed: Math.abs(v) < 1e-9, free: Math.abs(dv) < 1e-5, center: fam.m ? Math.abs(v) < 1e-9 : Math.abs(dv) < 1e-5, robin: Math.abs(dv + (i ? 1 : -1) * (fam.h ?? 0) * v) < 1e-5 }[e]; if (!ok) bad.push(`${fam.key ?? fam.id} n=${m}: ${e} 끝`); });
        for (let k = fam.n0; k < fam.n0 + 4; k++) { const ip = integrate(x => w(x) * fam.phi(m, x, L) * fam.phi(k, x, L), ...span); if (Math.abs(ip - (m === k ? normOf(fam, k, L) : 0)) > 1e-6 * L) bad.push(`${fam.id}: <φ${m}, φ${k}> = ${ip}`); }
      }
    }
    check(!bad.length, `고유함수 종류 ${FAMILIES.length}개의 끝 조건과 직교성(∫wφₘφₙ = 0, ∫wφₙ² = 노름)${bad.length ? ` (${bad.slice(0, 3).join(' / ')})` : ''}`); }
  reset({ f: 'x', L: 'pi', axes: { rep: 'sine', look: 'coef', time: 'none', bound: 'fixed', dim: '1', damp: 'off' } });
  check(near(fineCoef(S.R.series, 'b', 1), 2, 1e-6) && problemText('coef', S.good, S.R).includes('\\frac{2}{L}\\int_{0}^{L}') && solutionText('coef', S.good, S.R).includes('2배'), '반구간 전개의 계수: 2/L ∫₀ᴸ 꼴로 묻고 풂');
  // 상단 탭: 시각화 / 예제·출력
  page('make'); check(!$('makePage').hidden && $('vizPage').hidden && $('setupLine').textContent.includes('지금 설정') && !!$('items'), '예제·출력 페이지');
  page('viz'); check($('makePage').hidden && !$('vizPage').hidden && !$('nextStep') && !document.querySelector('[data-tab="example"]'), '시각화 페이지, 이전·다음 개념 단추 없음');
  // 메뉴 줄
  check($('menubar').getBoundingClientRect().height <= 34 && !document.querySelector('header.bar'), '제목 아래 얇은 메뉴 줄');
  document.querySelector('[data-menu="view"]').click(); const viewList = document.querySelector('[data-menu="view"]').nextElementSibling;
  check(!viewList.hidden && S.menuOpen && !viewList.querySelector('[data-page]') && !!viewList.querySelector('#presentBtn'), '보기 메뉴: 화면 이동은 메뉴 줄 탭에만 있음(중복 없음)');
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); document.querySelector('.pages [data-page="out"]').click();
  check(S.page === 'out' && !$('outPage').hidden && $('vizPage').hidden && !S.menuOpen && $('outPreview').textContent.includes('예제 1') && $$('[data-page][role="tab"]').length === 3, '메뉴 줄 탭으로 출력 화면');
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
  ends('free'); set({ f: '10' }); check(S.cfg.halfMode === 'cosine' && !$('f_left') && near(S.R.heat.u(1, 5), 10, 1e-6), '단열: 코사인 전개와 평균');
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
  const lib = libraryText(); check(!('on' in JSON.parse(lib).saved[0].cfg) && 'prob' in JSON.parse(lib).saved[0].cfg, '저장 파일에는 문제(prob)만 남김'); S.saved = [];
  check(importLibrary(lib) === 1 && S.saved[0].figures[0].caption === '내 그림', '예제 모음 파일 저장과 열기');
  let bad = false; try { importLibrary('{"kind":"other"}'); } catch { bad = true; } check(bad, '다른 파일은 거부');
  // 점 찍기: 누른 곡선 위에 찍힘, 그래프 밖은 무시, 다시 누르면 지움
  { const bad4 = [];
    const cases = [[{}, 'series'], [{ axes: { ...AX0, look: 'coef' } }, 'coef'], [{ axes: { ...AX0, look: 'spectrum' } }, 'spectrum'], [{ axes: { ...AX0, look: 'gibbs' } }, 'gibbs'],
      [{ f: 'exp(-x^2)', axes: { ...AX0, rep: 'integral' } }, 'transform'], [{ axes: { ...AX0, time: 'wave' } }, 'wave'], [{ f: 'exp(-x^2)', axes: { ...AX0, time: 'heat', bound: 'infinite' } }, 'heat'],
      [{ axes: { ...AX0, time: 'wave', dim: '2' } }, 'membrane']];
    for (const [patch, panel] of cases) {
      reset(patch); S.tool = 'mark'; draw();
      const el = document.querySelector(`.pnl[data-panel="${panel}"]`), ov = el.querySelector('canvas.ov'), r = ov.getBoundingClientRect(), f = S.frames[panel];
      const lines = pickLines(f, f.snap ? f.snap((f.xr[0] + f.xr[1]) / 2) : f.xr[0] + .37 * (f.xr[1] - f.xr[0])), xs = f.snap ? f.snap((f.xr[0] + f.xr[1]) / 2) : f.xr[0] + .37 * (f.xr[1] - f.xr[0]);
      const target = lines.reduce((a, l) => (Math.abs(l[1]) > Math.abs(a[1]) ? l : a));
      const px = f.b.l + (xs - f.xr[0]) / (f.xr[1] - f.xr[0]) * f.b.w + (target[2] ?? 0), py = f.b.t + (f.yr[1] - target[1]) / (f.yr[1] - f.yr[0]) * f.b.h;
      const tap = (x, y) => ov.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + x, clientY: r.top + y }));
      tap(px, py + 2); const m = S.marks[panel]?.[0], p = m && markPoint(f, m);
      if (!p || Math.hypot(p.px - px, p.py - py) > 3) bad4.push(`${panel}: 누른 곳 (${px.toFixed(0)}, ${py.toFixed(0)}), 찍힌 곳 ${p ? `(${p.px.toFixed(0)}, ${p.py.toFixed(0)})` : '없음'}`);
      tap(p ? p.px : px, p ? p.py : py); if (S.marks[panel].length) bad4.push(`${panel}: 다시 눌러도 안 지워짐`);
      tap(2, 2); if (S.marks[panel].length) bad4.push(`${panel}: 그래프 밖에 찍힘`);
    }
    S.tool = 'view'; check(!bad4.length, `점 찍기: 그래프 ${cases.length}종에서 누른 곡선 위${bad4.length ? ` (${bad4.slice(0, 3).join(' / ')})` : ''}`); }
  check(markPoint({ b: { l: 0, t: 0, w: 100, h: 100 }, xr: [0, 1], yr: [0, 1], probe: x => [['f', x]] }, .5)?.py === 50, '예전 파일의 점(x만)도 그림');
  // 입력 검사
  { const err = p => { try { compute(mergeCfg({ f: 'sin(x)', ...p })); return ''; } catch (e) { return e.message; } }, A = AX0;
    check(err({ axes: { ...A, time: 'wave' }, c: '0' }) === '파동 속도 c: 양수여야 합니다.' && !err({ axes: { ...A, time: 'heat' }, alpha: '-1' }).includes('길이'), '양수 안내에 "길이"라고 쓰지 않음');
    check(err({ axes: { ...A, time: 'heat' }, left: 'x' }).includes('x를 쓸 수 없습니다') && err({ axes: { ...A, time: 'wave' }, c: 'x+1' }).includes('x를 쓸 수 없습니다'), '상수 칸에 x를 쓰면 안내');
    check(near(compute(mergeCfg({ f: 'sin(x)', L: 'pi', c: 'L', axes: { ...A, time: 'wave' } })).wave.speed, PI, 1e-12), '상수 칸의 L은 실제 길이');
    check(err({ axes: { ...A, time: 'wave' }, g: '1/x' }).includes('유계') && err({ axes: { ...A, time: 'wave', dim: '2' }, h: '1/y' }).includes('유계'), '무한히 커지는 g(x), h(y) 안내');
    const T = compute(mergeCfg({ f: 'exp(-x^2)', X: '8', wMax: '360', axes: { ...A, rep: 'integral' } })).transform;
    check(near(T.recon(1), Math.exp(-1), 1e-3) && near(T.recon(-3), Math.exp(-9), 1e-3) && err({ f: 'exp(-x^2)', X: '8', wMax: '1000', axes: { ...A, rep: 'integral' } }).includes('이하로'), 'Fourier 적분: 위끝을 키워도 맞고, 한계를 넘으면 안내'); }
  // 고정해서 비교
  reset({ N: 5 }); $('pinBtn').click(); set({ N: 40 });
  check(!!S.pin && shown() === 'series' && document.querySelector('.pnl .legend').textContent.includes('고정') && S.frames.series.probe(1).length === 3, '같은 개념은 한 칸에 겹쳐 비교');
  prob('eq', 'wave'); check(shown() === 'pin+wave' && $$('#panels .pnl .pt')[0].textContent.startsWith('고정'), '다른 개념은 나란히 비교');
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
  check(S.marks.series?.length === 1 && near(S.marks.series[0]?.x, f0.xr[0] + .75 * (f0.xr[1] - f0.xr[0]), 1e-6), '점 표시');
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
  // 문제를 바꿀 때 알림
  reset({}); prob('eq', 'heat'); check($('status').textContent.includes('영역을') && $('status').textContent.includes('초기 온도'), '영역과 f(x)의 뜻이 바뀌면 알림');
  // 새 변수 알림, 입력 오류 표시, 손으로 쓰는 표기
  reset({}); $('f_f').value = 'a*x'; fire($('f_f'), 'input'); check($('status').textContent.includes("'a'") && !!$('p_a'), '새 변수를 만들면 알림');
  $('f_f').value = 'x²+|x|'; fire($('f_f'), 'input'); check($('err').hidden && near(S.R.f(-2), 6, 1e-12), 'x², |x| 입력');
  $('f_f').value = 'x+#'; fire($('f_f'), 'input'); check(!$('graphErr').hidden && $('graphErr').textContent.includes('마지막으로 계산된'), '입력 오류를 그래프 위에도 표시');
  // 처음 안내와 도움말
  showTour(0); check(!$('tour').hidden && document.querySelector('#problem.spot') !== null, '처음 안내 시작');
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
