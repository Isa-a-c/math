'use strict';
/* 문제 모델. 문제 = 방정식 × 영역 × 양 끝 조건 × 감쇠.
   무엇을 풀 수 있는지, 쓰는 개념, 입력 칸, 풀이 단계, 교재의 절은 주제(modules/*.js의 defineTopic)가 정합니다.
   이 파일은 방정식·영역의 이름, 주제 찾기, 문제를 고치는 규칙, 계산용 값 만들기(applyProblem), 예전 파일 읽기, 주제들이 함께 쓰는 단계 도우미입니다.
   표현(사인·코사인 급수, 적분)은 고르지 않고 영역과 양 끝 조건에서 정해집니다. */
const EQUATIONS = [
  { id: 'none', label: '없음 (함수 전개)', role: '함수 f(x)' },
  { id: 'wave', label: '파동 방정식', tex: 'u_{tt} = c^2 u_{xx}', role: '초기 변위 f(x) = u(x, 0)' },
  { id: 'heat', label: '열 방정식', tex: 'u_t = c^2 u_{xx}', role: '초기 온도 f(x) = u(x, 0)' },
];
const DOMAINS = [
  { id: 'periodic', label: '주기 (−L, L)', where: '한 주기 −L < x < L', lLabel: '반주기 L (주기 2L)', why: '주기 영역은 함수 전개(방정식 없음)에만 씁니다.' },
  { id: 'interval', label: '구간 (0, L)', where: '0 < x < L', lLabel: '길이 L' },
  { id: 'line', label: '직선 (−∞, ∞)', where: '−∞ < x < ∞' },
  { id: 'rect', label: '직사각형', where: '0 < x < a (a = L)', lLabel: '막의 가로 길이 a = L', why: '직사각형 영역은 파동 방정식(막의 진동)만 있습니다.' },
];
const topicFor = (eq, domain) => TOPICS.find(t => t.eq === eq && t.domain === domain);
const topicOf = cfg => topicFor(cfg.prob.eq, cfg.prob.domain);
const domainOk = (eq, domain) => !!topicFor(eq, domain);
const domainLabel = id => DOMAINS.find(d => d.id === id)?.label ?? id;
/** 전개 단계에서 그래프로 볼 것과 그때 쓰는 개념 모듈입니다. */
const LOOKS = [['partial', '부분합'], ['coef', '계수의 의미'], ['spectrum', '계수 크기'], ['gibbs', '수렴과 도약']];
const LOOK_USES = { partial: [], coef: ['coef'], spectrum: ['coef', 'spectrum'], gibbs: ['gibbs'] };
/** [장 또는 null(응용), 이름] */
const recipeOf = cfg => topicOf(cfg).name(cfg.prob);
/** '12장 · 현의 진동', '응용 · 현의 진동 (감쇠)'처럼 씁니다. */
const recipeText = cfg => { const [ch, name] = recipeOf(cfg); return `${ch ?? '응용'} · ${name}`; };
/** 입력한 f(x)의 뜻과 구간입니다. 문제를 바꾸면 화면에 함께 바뀝니다. */
const roleOf = cfg => topicOf(cfg).role?.(cfg.prob) ?? `${EQUATIONS.find(e => e.id === cfg.prob.eq).role}, ${DOMAINS.find(d => d.id === cfg.prob.domain).where}`;
/** 풀 수 없는 조합을 고칩니다: 방정식에 없는 영역은 구간으로, 양 끝·감쇠는 주제가 허락할 때만. 양 끝은 같은 조건(혼합 경계는 아직 없음). */
function normalizeProblem(p) {
  if (!EQUATIONS.some(e => e.id === p.eq)) p.eq = 'none';
  if (!domainOk(p.eq, p.domain)) p.domain = domainOk(p.eq, 'interval') ? 'interval' : TOPICS.find(t => t.eq === p.eq).domain;
  const t = topicFor(p.eq, p.domain);
  if (p.left !== 'free' || !t.ends) p.left = 'fixed';
  p.right = p.left;
  p.damp = !!p.damp && !!t.damp;
  return p;
}
/** 주제에서 계산에 쓰는 값(cfg.on = 쓰는 개념 모듈, halfMode·waveDomain·bc 같은 계산 값, damping)을 만듭니다. */
function applyProblem(cfg) {
  const p = normalizeProblem(cfg.prob), t = topicFor(p.eq, p.domain), on = cfg.on;
  for (const k of Object.keys(on)) on[k] = false;
  for (const id of [...t.uses(p), ...(t.look ? LOOK_USES[cfg.look] ?? [] : [])]) on[id] = true;
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
/** 구간 (0, L)의 파동·열: 변수분리와 고유값 문제 → 초기조건의 전개 → 해. */
function intervalStages(cfg, heat) {
  const p = cfg.prob, fixed = p.left === 'fixed', look = lookPanel(cfg), out = [];
  const phi = fixed ? String.raw`\sin\frac{n\pi x}{L}` : String.raw`\cos\frac{n\pi x}{L}`;
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
/** 문제의 풀이 단계: {id, title, md(교재 수식, $…$), panel(그래프), look(전개 단계), fields}. */
const stagesOf = cfg => topicOf(cfg).stages(cfg);
/** 고른 단계(없으면 마지막 단계 = 해)입니다. */
const stageOf = cfg => { const list = stagesOf(cfg); return list.find(s => s.id === cfg.stage) ?? list.at(-1); };
