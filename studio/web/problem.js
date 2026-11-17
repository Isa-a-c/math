'use strict';
/* 문제 모델. 문제 = 방정식 × 영역 × 경계 조건(영역이 정한 끝·변마다) × 감쇠.
   무엇을 풀 수 있는지, 쓰는 개념, 입력 칸, 풀이 단계, 교재의 절은 주제(modules/*.js의 defineTopic)가 정합니다.
   이 파일은 방정식·영역의 이름, 주제 찾기, 문제를 고치는 규칙, 계산용 값 만들기(applyProblem), 예전 파일 읽기, 주제들이 함께 쓰는 단계 도우미입니다.
   표현(사인·코사인 급수, 적분)은 고르지 않고 영역과 양 끝 조건에서 정해집니다. */
const EQUATIONS = [
  { id: 'none', label: '함수 전개', role: '함수 f(x)' },
  { id: 'wave', label: '파동 방정식', tex: 'u_{tt} = c^2 u_{xx}', role: '초기 변위 f(x) = u(x, 0)' },
  { id: 'heat', label: '열 방정식', tex: 'u_t = c^2 u_{xx}', role: '초기 온도 f(x) = u(x, 0)' },
  { id: 'laplace', label: '라플라스 (정상 상태)', tex: 'u_{xx} + u_{yy} = 0', role: '위쪽 변의 온도 f(x)' },
];
const DOMAINS = [
  { id: 'periodic', label: '주기 (−L, L)', where: '한 주기 −L < x < L', lLabel: '반주기 L (주기 2L)', why: '주기 영역은 함수 전개에만 씁니다.' },
  { id: 'interval', label: '구간 (0, L)', where: '0 < x < L', lLabel: '길이 L', sides: [['left', 'x = 0 끝'], ['right', 'x = L 끝']] },
  { id: 'line', label: '직선 (−∞, ∞)', where: '−∞ < x < ∞' },
  { id: 'rect', label: '직사각형', where: '0 < x < a (a = L)', lLabel: '가로 길이 a = L', why: '직사각형 영역은 파동(막의 진동)과 라플라스 방정식(정상 상태 온도)에 있습니다.',
    sides: [['left', 'x = 0 변'], ['right', 'x = a 변'], ['bottom', 'y = 0 변'], ['top', 'y = b 변']] },
  { id: 'disk', label: '원판 (반지름 r)', where: '0 ≤ r < R (R = L)', lLabel: '반지름 R = L', why: '원판은 Fourier–Bessel 급수, 원형 막, 원판의 열전도에 있습니다.',
    sides: [['right', '가장자리 r = R']], vars: [['r', 'x'], ['R', 'L']] },
  { id: 'sphere', label: '구 (Legendre)', where: '−1 < x < 1 (구에서는 x = cos φ)', fixedL: 1, why: '구는 Fourier–Legendre 급수와 구의 전위(라플라스 방정식)에 있습니다.',
    sides: [['right', '전위를 구할 곳']], vars: [['phi', 'acos(x)']] },
];
/** 경계 조건을 담는 문제의 칸입니다. 어느 칸을 고르게 할지는 영역(sides)과 주제(ends)가 정합니다. */
const SIDE_KEYS = ['left', 'right', 'bottom', 'top'];
const topicFor = (eq, domain) => TOPICS.find(t => t.eq === eq && t.domain === domain);
const topicOf = cfg => topicFor(cfg.prob.eq, cfg.prob.domain);
const domainOk = (eq, domain) => !!topicFor(eq, domain);
const domainLabel = id => DOMAINS.find(d => d.id === id)?.label ?? id;
/** 영역이 정한 L(구는 −1 < x < 1이므로 1)입니다. 없으면 undefined(입력한 L)입니다. */
const domainL = cfg => DOMAINS.find(d => d.id === cfg.prob?.domain)?.fixedL;
/** 함수를 입력하는 구간의 양 끝 글자입니다. */
const fEnds = cfg => cfg.prob?.domain === 'sphere' ? ['−1', '1'] : [halfDomain(cfg) ? '0' : '−L', 'L'];
/** 전개 단계에서 그래프로 볼 것과 그때 쓰는 개념 모듈입니다. */
const LOOKS = [['partial', '부분합'], ['coef', '계수의 의미'], ['spectrum', '계수 크기'], ['gibbs', '수렴과 도약']];
const LOOK_USES = { partial: [], coef: ['coef'], spectrum: ['coef', 'spectrum'], gibbs: ['gibbs'] };
/** [장 또는 null(응용), 이름] */
const recipeOf = cfg => topicOf(cfg).name(cfg.prob, cfg);
/** '12장 · 현의 진동', '응용 · 현의 진동 (감쇠)'처럼 씁니다. */
const recipeText = cfg => { const [ch, name] = recipeOf(cfg); return `${ch ?? '응용'} · ${name}`; };
/** 입력한 f(x)의 뜻과 구간입니다. 문제를 바꾸면 화면에 함께 바뀝니다. */
const roleOf = cfg => topicOf(cfg).role?.(cfg.prob) ?? `${EQUATIONS.find(e => e.id === cfg.prob.eq).role}, ${DOMAINS.find(d => d.id === cfg.prob.domain).where}`;
/** 풀 수 없는 조합을 고칩니다: 방정식에 없는 영역은 구간으로, 끝·변의 조건과 감쇠는 주제가 허락한 것만(양 끝이 다른 조건은 mixed인 주제만). */
function normalizeProblem(p) {
  if (!EQUATIONS.some(e => e.id === p.eq)) p.eq = 'none';
  if (!domainOk(p.eq, p.domain)) p.domain = domainOk(p.eq, 'interval') ? 'interval' : TOPICS.find(t => t.eq === p.eq).domain;
  const t = topicFor(p.eq, p.domain), opts = endOptions(t);
  for (const k of SIDE_KEYS) if (!(opts[k] ?? []).some(([v]) => v === p[k])) p[k] = opts[k]?.[0][0] ?? 'fixed';
  if (!t.mixed && opts.left) p.right = p.left;   // 양 끝을 고르는 주제만(원판은 가장자리 하나)
  p.damp = !!p.damp && !!t.damp;
  return p;
}
/** 주제가 고르게 하는 끝(변)과 그 선택지: {left: [[값, 이름], …], …}. 배열이면 x = 0 끝과 x = L 끝이 같은 선택지입니다. */
const endOptions = t => Array.isArray(t.ends) ? { left: t.ends, right: t.ends } : t.ends ?? {};
/** 주제가 풀 수 있는 모든 문제입니다(공통 검사가 씁니다). */
function problemsOf(t) {
  let list = [{ eq: t.eq, domain: t.domain, left: 'fixed', right: 'fixed', bottom: 'fixed', top: 'fixed', damp: false }];
  for (const [side, opts] of Object.entries(endOptions(t))) list = list.flatMap(p => opts.map(([v]) => ({ ...p, [side]: v })));
  if (t.damp) list = list.flatMap(p => [p, { ...p, damp: true }]);
  const seen = new Set();
  return list.map(normalizeProblem).filter(p => { const k = JSON.stringify(p); if (seen.has(k)) return false; seen.add(k); return true; });
}
/** 주제에서 계산에 쓰는 값(cfg.on = 쓰는 개념 모듈, halfMode·waveDomain·bc 같은 계산 값, damping)을 만듭니다. */
function applyProblem(cfg) {
  const p = normalizeProblem(cfg.prob), t = topicFor(p.eq, p.domain), on = cfg.on;
  for (const k of Object.keys(on)) on[k] = false;
  const look = typeof t.look === 'function' ? t.look(p) : t.look;
  for (const id of [...t.uses(p), ...(look ? LOOK_USES[cfg.look] ?? [] : [])]) on[id] = true;
  Object.assign(cfg, t.params(p));
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

/* ── 풀이 단계 도우미 (주제들이 함께 씀) ──────────── */
/** 전개 단계에서 고른 그래프입니다. */
const lookPanel = cfg => ({ coef: 'coef', spectrum: 'spectrum', gibbs: 'gibbs' }[cfg.look] ?? 'series');
const INTEGRAL_MD = String.raw`$f(x) = \int_0^{\infty}[A(w)\cos wx + B(w)\sin wx]\,dw$, $A(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\cos wv\,dv$, $B(w) = \frac{1}{\pi}\int_{-\infty}^{\infty} f(v)\sin wv\,dv$`;
/** 고유함수로 푸는 파동·열(구간, 원판): 변수분리와 고유값 문제 → 초기조건의 전개 → 해. 수식은 고유함수 종류(eigen.js)에서 만듭니다. */
function eigenStages(cfg, heat) {
  const p = cfg.prob, fam = familyOf(cfg), classic = fam.id === 'sine' || fam.id === 'cosine', c0 = fam.n0 === 0, A = c0 ? 'A' : 'B', phi = fam.tex;
  const v = fam.radial ? 'r' : 'x', E = fam.radial ? 'R' : 'L', ang = fam.m ? String.raw`\cos ${fam.m}\theta` : '', uv = fam.m ? String.raw`r,\theta` : v;
  let Lv = NaN; try { Lv = constant(cfg.L, 1); } catch { /* 입력 중 */ }
  const endTex = i => { const e = fam.ends[i], x = i ? E : '0'; return e === 'center' ? String.raw`|u(0,t)| < \infty` : e === 'fixed' ? (heat ? `u(${x},t) = U${fam.radial ? '' : `_${i + 1}`}` : `u(${x},t) = 0`) : e === 'robin' ? `u_${v}(${x},t) ${i ? '+' : '-'} hu(${x},t) = 0` : `u_${v}(${x},t) = 0`; };
  const steadyNote = heat && fam.ends.includes('fixed') ? `. 끝 온도가 0이 아니면 정상 상태 $U(${v})$를 뺀 $f - U$를 전개합니다.` : '';
  return [
    { id: 'separate', title: '변수분리와 고유값 문제', panel: 'eigen', md: `$u = F(${v})${ang ? ang : ''}G(t)$로 놓으면 $${fam.ode ?? "F'' + k^2F = 0"}$, $${heat ? "G' + c^2k^2G = 0" : "G'' + c^2k^2G = 0"}$입니다. 경계조건 $${endTex(0)},\\ ${endTex(1)}$에서 $F_n = ${phi}$${c0 ? String.raw` ($n = 0, 1, 2, \ldots$)` : ''}이고, ${fam.kMd ? fam.kMd(Lv) : `$k_n = ${fam.kTex}$입니다.`}` },
    { id: 'expand', title: heat ? '초기 온도의 전개' : '초기 변위의 전개', panel: classic ? lookPanel(cfg) : 'modes', look: classic,
      md: `${ang ? `처음 모양 $f(r)${ang}$의 반지름 방향 $f(r)$을 전개합니다. ` : ''}$f(${v}) = ${c0 ? 'A_0 + ' : ''}\\sum_{n=1}^{\\infty} ${A}_{n}${phi}$, $${coefTexOf(fam, A, `f(${v})`)}$${steadyNote}` },
    { id: 'solve', title: '해', panel: fam.radial ? 'bessel' : heat ? 'heat' : 'wave', md: heat
      ? `$u(${uv},t) = ${c0 ? 'A_0' : `U(${v})`} + \\sum_{n=1}^{\\infty} ${A}_{n}${phi}${ang}\\,e^{-\\lambda_n^2 t}$, $\\lambda_n = ck_n$${c0 ? '. 온도는 평균 $A_0$으로 갑니다.' : ''}`
      : `$u(${uv},t) = ${c0 ? 'A_0 + ' : ''}\\sum_{n=1}^{\\infty}(${A}_n\\cos\\lambda_n t + ${A}_n^*\\sin\\lambda_n t)${phi}${ang}$, $\\lambda_n = ck_n$${p.damp ? String.raw`. 감쇠가 있으면($u_{tt} + 2ku_t = c^2u_{xx}$) 모드마다 $e^{-kt}$가 곱해지고 진동수는 $\sqrt{\lambda_n^2 - k^2}$로 줄어듭니다.` : ''}${fam.harmonic ? '' : String.raw`. $\lambda_n$이 $\lambda_1$의 정수배가 아니어서 주기적이지 않습니다.`}` },
  ];
}
/** 문제의 풀이 단계: {id, title, md(교재 수식, $…$), panel(그래프), look(전개 단계), fields}. */
const stagesOf = cfg => topicOf(cfg).stages(cfg);
/** 고른 단계(없으면 마지막 단계 = 해)입니다. */
const stageOf = cfg => { const list = stagesOf(cfg); return list.find(s => s.id === cfg.stage) ?? list.at(-1); };
