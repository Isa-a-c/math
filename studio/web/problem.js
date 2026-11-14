'use strict';
/* 문제 정의와 풀이 단계.
   문제 = 방정식(없음·파동·열) × 영역(주기·구간·직선·직사각형) × 양 끝 조건 × 감쇠, 그리고 함수(f, g, h)와 상수(c, c², 끝 온도).
   표현(사인·코사인 급수, 적분)은 고르지 않고 영역과 양 끝 조건에서 정해집니다.
   풀이 단계 = 변수분리와 고유값 문제 → 초기조건(함수)의 전개 → 해. 단계마다 교재 수식과 그래프 하나가 있습니다.
   계산·요약·예제·Word는 문제에서 만든 cfg.on(개념별 켜짐)과 halfMode 같은 값을 씁니다(applyProblem이 만듦).
   새 장은 EQUATIONS·DOMAINS(무엇을 풀 수 있는지), SECTIONS(교재의 절), stagesOf(풀이 단계)에 더합니다. */
const EQUATIONS = [
  { id: 'none', label: '없음 (함수 전개)' },
  { id: 'wave', label: '파동 방정식', tex: 'u_{tt} = c^2 u_{xx}' },
  { id: 'heat', label: '열 방정식', tex: 'u_t = c^2 u_{xx}' },
];
const DOMAINS = [
  { id: 'periodic', label: '주기 (−L, L)', eqs: ['none'], why: '주기 영역은 함수 전개(방정식 없음)에만 씁니다.' },
  { id: 'interval', label: '구간 (0, L)', eqs: ['none', 'wave', 'heat'] },
  { id: 'line', label: '직선 (−∞, ∞)', eqs: ['none', 'wave', 'heat'] },
  { id: 'rect', label: '직사각형', eqs: ['wave'], why: '직사각형 영역은 파동 방정식(막의 진동)만 있습니다.' },
];
const domainOk = (eq, domain) => !!DOMAINS.find(d => d.id === domain)?.eqs.includes(eq);
const domainLabel = id => DOMAINS.find(d => d.id === id)?.label ?? id;
/** 전개 단계에서 그래프로 볼 것입니다. */
const LOOKS = [['partial', '부분합'], ['coef', '계수의 의미'], ['spectrum', '계수 크기'], ['gibbs', '수렴과 도약']];
/** 교재의 절: 처음으로 맞는 것의 이름을 씁니다. 목록에 없는 조합은 '응용'입니다. */
const SECTIONS = [
  { ch: '11장', name: 'Fourier 급수', when: p => p.eq === 'none' && p.domain === 'periodic' },
  { ch: '11장', name: p => `반구간 전개 (${p.left === 'fixed' ? '사인' : '코사인'} 급수)`, when: p => p.eq === 'none' && p.domain === 'interval' },
  { ch: '11장', name: 'Fourier 적분', when: p => p.eq === 'none' && p.domain === 'line' },
  { ch: '12장', name: '현의 진동', when: p => p.eq === 'wave' && p.domain === 'interval' && p.left === 'fixed' && !p.damp },
  { ch: '12장', name: "D'Alembert 해 (무한히 긴 현)", when: p => p.eq === 'wave' && p.domain === 'line' },
  { ch: '12장', name: '직사각형 막의 진동', when: p => p.eq === 'wave' && p.domain === 'rect' },
  { ch: '12장', name: p => p.left === 'fixed' ? '막대의 열전도' : '양 끝이 단열된 막대의 열전도', when: p => p.eq === 'heat' && p.domain === 'interval' },
  { ch: '12장', name: '무한히 긴 막대의 열전도 (열핵)', when: p => p.eq === 'heat' && p.domain === 'line' },
];
/** [장 또는 null(응용), 이름] */
function recipeOf(cfg) {
  const p = cfg.prob, s = SECTIONS.find(x => x.when(p));
  if (s) return [s.ch, typeof s.name === 'function' ? s.name(p) : s.name];
  const extra = [p.left === 'free' ? '양 끝 자유' : '', p.damp ? '감쇠' : ''].filter(Boolean).join(', ');
  return [null, `${p.eq === 'wave' ? '현의 진동' : EQUATIONS.find(e => e.id === p.eq).label}${extra ? ` (${extra})` : ''}`];
}
/** '12장 · 현의 진동', '응용 · 현의 진동 (감쇠)'처럼 씁니다. */
const recipeText = cfg => { const [ch, name] = recipeOf(cfg); return `${ch ?? '응용'} · ${name}`; };
/** 입력한 f(x)의 뜻과 구간입니다. 문제를 바꾸면 화면에 함께 바뀝니다. */
function roleOf(cfg) {
  const p = cfg.prob, where = { periodic: '한 주기 −L < x < L', interval: '0 < x < L', line: '−∞ < x < ∞', rect: '0 < x < a (a = L)' }[p.domain];
  const what = p.eq === 'wave' ? (p.domain === 'rect' ? '처음 모양의 x 방향 f(x)' : '초기 변위 f(x) = u(x, 0)') : p.eq === 'heat' ? '초기 온도 f(x) = u(x, 0)' : '함수 f(x)';
  return `${what}, ${where}`;
}
/** 풀 수 없는 조합을 고칩니다: 방정식에 없는 영역은 구간으로, 양 끝은 같은 조건(혼합 경계는 아직 없음), 감쇠는 구간의 현만. */
function normalizeProblem(p) {
  if (!EQUATIONS.some(e => e.id === p.eq)) p.eq = 'none';
  if (!domainOk(p.eq, p.domain)) p.domain = domainOk(p.eq, 'interval') ? 'interval' : DOMAINS.find(d => d.eqs.includes(p.eq)).id;
  if (p.left !== 'free' || p.domain === 'rect') p.left = 'fixed';
  p.right = p.left;
  p.damp = !!p.damp && p.eq === 'wave' && p.domain === 'interval';
  return p;
}
/** 문제에서 계산에 쓰는 값(cfg.on, halfMode, waveDomain, bc, damping…)을 만듭니다. */
function applyProblem(cfg) {
  const p = normalizeProblem(cfg.prob), on = cfg.on, look = p.domain === 'line' ? 'partial' : cfg.look;
  for (const k of Object.keys(on)) on[k] = false;
  on.series = true;
  if (p.domain === 'interval' || p.domain === 'rect') { on.half = true; cfg.halfMode = p.left === 'fixed' ? 'sine' : 'cosine'; }
  if (p.domain === 'line' && p.eq !== 'wave') on.transform = true;
  on.coef = look === 'coef' || look === 'spectrum'; on.spectrum = look === 'spectrum'; on.gibbs = look === 'gibbs';
  if (p.eq === 'wave') { on.wave = true; on.membrane = p.domain === 'rect'; cfg.waveDomain = p.domain === 'line' ? 'infinite' : 'finite'; cfg.waveEnds = p.left; }
  if (p.eq === 'heat') { on.heat = true; cfg.heatDomain = p.domain === 'line' ? 'infinite' : 'finite'; cfg.bc = p.left === 'free' ? 'insulated' : 'fixed'; }
  cfg.damping = p.damp ? String(cfg.kDamp) : '0';
  return cfg;
}
/** 예전 저장 파일(v0.13까지: 개념 체크)을 문제로 읽습니다. */
function problemFromOn(cfg) {
  const on = cfg.on, eq = on.wave || on.membrane ? 'wave' : on.heat ? 'heat' : 'none';
  let domain, end = 'fixed';
  if (on.membrane) domain = 'rect';
  else if (eq === 'wave') { domain = cfg.waveDomain === 'infinite' ? 'line' : 'interval'; end = cfg.waveEnds === 'free' ? 'free' : 'fixed'; }
  else if (eq === 'heat') { domain = cfg.heatDomain === 'infinite' ? 'line' : 'interval'; end = cfg.bc === 'insulated' ? 'free' : 'fixed'; }
  else if (on.transform) domain = 'line';
  else if (on.half) { domain = 'interval'; end = cfg.halfMode === 'cosine' ? 'free' : 'fixed'; }
  else domain = 'periodic';
  const damp = eq === 'wave' && domain === 'interval' && !['', '0', '0.0'].includes(String(cfg.damping ?? '0').trim());
  if (damp) cfg.kDamp = String(cfg.damping);
  cfg.look = on.gibbs ? 'gibbs' : on.spectrum ? 'spectrum' : on.coef ? 'coef' : 'partial';
  return normalizeProblem({ eq, domain, left: end, right: end, damp });
}
/** v0.14~v0.17 저장 파일(조건·개념 더하기 축)을 문제로 읽습니다. */
function problemFromAxes(ax, cfg) {
  const eq = ax.time === 'wave' || ax.time === 'heat' ? ax.time : 'none';
  let domain, end = 'fixed';
  if (eq === 'none') { domain = { sine: 'interval', cosine: 'interval', integral: 'line' }[ax.rep] ?? 'periodic'; end = ax.rep === 'cosine' ? 'free' : 'fixed'; }
  else if (eq === 'wave' && ax.dim === '2') domain = 'rect';
  else { domain = ax.bound === 'infinite' ? 'line' : 'interval'; end = ax.bound === 'free' ? 'free' : 'fixed'; }
  cfg.look = ['coef', 'spectrum', 'gibbs'].includes(ax.look) ? ax.look : 'partial';
  return normalizeProblem({ eq, domain, left: end, right: end, damp: eq === 'wave' && ax.damp === 'on' });
}

/* ── 풀이 단계 ─────────────────────────────────────── */
/** 문제의 풀이 단계: {id, title, md(교재 수식, $…$), panel(그래프), look(전개 단계), fields}. */
function stagesOf(cfg) {
  const p = cfg.prob, fixed = p.left === 'fixed', heat = p.eq === 'heat', out = [];
  const look = p.domain === 'line' ? 'series' : ({ coef: 'coef', spectrum: 'spectrum', gibbs: 'gibbs' }[cfg.look] ?? 'series');
  const phi = fixed ? String.raw`\sin\frac{n\pi x}{L}` : String.raw`\cos\frac{n\pi x}{L}`;
  const integral = String.raw`$f(x) = \int_0^{\infty}[A(w)\cos wx + B(w)\sin wx]\,dw$, $A(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\cos wv\,dv$, $B(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\sin wv\,dv$`;
  if (p.eq === 'none') {
    if (p.domain === 'periodic') {
      out.push({ id: 'basis', title: '기저 함수 (직교)', panel: 'eigen', md: String.raw`주기 $2L$인 함수는 $1$, $\cos\frac{n\pi x}{L}$, $\sin\frac{n\pi x}{L}$ ($n = 1, 2, \ldots$)의 합으로 나타냅니다. 이 함수들은 한 주기에서 서로 직교합니다.` });
      out.push({ id: 'expand', title: 'Fourier 급수 전개', panel: look, look: true, md: String.raw`$f(x) = a_0 + \sum_{n=1}^{\infty}(a_n\cos\frac{n\pi x}{L} + b_n\sin\frac{n\pi x}{L})$, $a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\frac{n\pi x}{L}\,dx$, $b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$` });
    } else if (p.domain === 'interval') {
      out.push({ id: 'basis', title: '고유함수 (양 끝 조건이 정함)', panel: 'eigen', md: fixed
        ? String.raw`$x = 0$과 $x = L$에서 $0$이 되는 $\sin\frac{n\pi x}{L}$로 전개합니다. $(-L, 0)$으로 기함수 확장한 함수의 Fourier 급수와 같습니다.`
        : String.raw`$x = 0$과 $x = L$에서 기울기가 $0$인 $1$, $\cos\frac{n\pi x}{L}$로 전개합니다. $(-L, 0)$으로 우함수 확장한 함수의 Fourier 급수와 같습니다.` });
      out.push({ id: 'expand', title: '반구간 전개', panel: look, look: true, md: fixed
        ? String.raw`$f(x) = \sum_{n=1}^{\infty} b_n\sin\frac{n\pi x}{L}$, $b_n = \frac{2}{L}\int_0^L f(x)\sin\frac{n\pi x}{L}\,dx$`
        : String.raw`$f(x) = a_0 + \sum_{n=1}^{\infty} a_n\cos\frac{n\pi x}{L}$, $a_0 = \frac{1}{L}\int_0^L f(x)\,dx$, $a_n = \frac{2}{L}\int_0^L f(x)\cos\frac{n\pi x}{L}\,dx$` });
    } else out.push({ id: 'expand', title: 'Fourier 적분', panel: 'transform', fields: ['wMax'], md: integral });
    return out;
  }
  if (p.domain === 'line') {
    if (p.eq === 'wave') out.push({ id: 'solve', title: "해 (D'Alembert)", panel: 'wave', md: String.raw`$u(x,t) = \frac{1}{2}[f(x+ct) + f(x-ct)] + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$. 처음 모양의 절반씩이 속도 $c$로 양쪽으로 갑니다.` });
    else {
      out.push({ id: 'expand', title: '초기 온도의 Fourier 적분', panel: 'transform', fields: ['wMax'], md: integral });
      out.push({ id: 'solve', title: '해', panel: 'heat', md: String.raw`$u(x,t) = \int_0^{\infty}[A(w)\cos wx + B(w)\sin wx]\,e^{-c^2w^2t}\,dw$. 열핵과의 합성곱과 같습니다.` });
    }
    return out;
  }
  if (p.domain === 'rect') {
    out.push({ id: 'separate', title: '변수분리와 고유값 문제', panel: 'eigen', md: String.raw`$u = F(x)G(y)H(t)$로 놓고 가장자리 고정 조건을 쓰면 $F_m = \sin\frac{m\pi x}{a}$, $G_n = \sin\frac{n\pi y}{b}$, $\lambda_{mn} = c\pi\sqrt{\frac{m^2}{a^2} + \frac{n^2}{b^2}}$입니다 ($a = L$). 그래프는 $x$ 방향 고유함수입니다.` });
    out.push({ id: 'expand', title: '처음 모양의 전개', panel: look, look: true, md: String.raw`$f(x)h(y) = \sum_{m}\sum_{n} B_{mn}\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b}$, $B_{mn}$은 $f$와 $h$의 사인 계수의 곱입니다. 그래프는 $x$ 방향 $f$의 전개입니다.` });
    out.push({ id: 'solve', title: '해', panel: 'membrane', fields: ['M'], md: String.raw`$u(x,y,t) = \sum_{m}\sum_{n} B_{mn}\cos(\lambda_{mn}t)\sin\frac{m\pi x}{a}\sin\frac{n\pi y}{b}$` });
    return out;
  }
  // 구간 (0, L)의 파동·열
  const bc = fixed ? (heat ? String.raw`u(0,t) = U_1,\ u(L,t) = U_2` : String.raw`u(0,t) = u(L,t) = 0`) : String.raw`u_x(0,t) = u_x(L,t) = 0`;
  out.push({ id: 'separate', title: '변수분리와 고유값 문제', panel: 'eigen', md: String.raw`$u = F(x)G(t)$로 놓으면 $F'' + k^2F = 0$, $${heat ? `G' + c^2k^2G = 0` : `G'' + c^2k^2G = 0`}$입니다. 경계조건 $${bc}$에서 $k_n = \frac{n\pi}{L}$, $F_n = ${phi}$${fixed ? '' : String.raw` ($n = 0, 1, 2, \ldots$)`}입니다.` });
  out.push({ id: 'expand', title: heat ? '초기 온도의 전개' : '초기 변위의 전개', panel: look, look: true, md: fixed
    ? String.raw`$f(x) = \sum_{n=1}^{\infty} B_n${phi}$, $B_n = \frac{2}{L}\int_0^L f(x)${phi}\,dx$${heat ? '. 끝 온도가 0이 아니면 정상 상태 $U(x)$를 뺀 $f - U$를 전개합니다.' : ''}`
    : String.raw`$f(x) = A_0 + \sum_{n=1}^{\infty} A_n${phi}$, $A_n = \frac{2}{L}\int_0^L f(x)${phi}\,dx$` });
  const lam = String.raw`$\lambda_n = \frac{cn\pi}{L}$`;
  out.push({ id: 'solve', title: '해', panel: heat ? 'heat' : 'wave', md: heat
    ? (fixed ? String.raw`$u(x,t) = U(x) + \sum_{n=1}^{\infty} B_n${phi}\,e^{-\lambda_n^2 t}$, ${lam}` : String.raw`$u(x,t) = A_0 + \sum_{n=1}^{\infty} A_n${phi}\,e^{-\lambda_n^2 t}$, ${lam}. 온도는 평균 $A_0$으로 갑니다.`)
    : String.raw`$u(x,t) = ${fixed ? '' : 'A_0 + '}\sum_{n=1}^{\infty}(B_n\cos\lambda_n t + B_n^*\sin\lambda_n t)${phi}$, ${lam}${p.damp ? String.raw`. 감쇠가 있으면($u_{tt} + 2ku_t = c^2u_{xx}$) 모드마다 $e^{-kt}$가 곱해지고 진동수는 $\sqrt{\lambda_n^2 - k^2}$로 줄어듭니다.` : ''}` });
  return out;
}
/** 고른 단계(없으면 마지막 단계 = 해)입니다. */
const stageOf = cfg => { const list = stagesOf(cfg); return list.find(s => s.id === cfg.stage) ?? list.at(-1); };
