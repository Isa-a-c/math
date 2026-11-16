'use strict';
/* 공업수학 시각화의 상태, 값 읽기, 계산, 정확한 값, 구간별 함수. 화면(DOM)은 $ 외에 쓰지 않습니다. */
/* 공업수학 시각화: 문제(방정식·영역·양 끝 조건)와 함수를 정하면 풀이 단계(변수분리·고유값 문제 → 전개 → 해)마다 수식과 그래프를 보여 줍니다(문제 모델은 problem.js).
   예제(문제·풀이·그림)는 사용자가 직접 만들고 고치며, 개념 설명도 고칠 수 있습니다. 모두 Word로 출력하고 파일로 저장합니다.
   개념마다 계산·그래프·요약·소문항·설명은 modules/*.js, 등록부는 concepts.js, 공통 계산은 math.js와 이 파일입니다. */
const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const DEFAULTS = {
  f: 'sign(x)', L: 'pi', N: 9, params: {},
  prob: { eq: 'none', domain: 'periodic', left: 'fixed', right: 'fixed', bottom: 'fixed', top: 'fixed', damp: false },   // 문제(problem.js). on 등은 여기서 만들어집니다.
  look: 'partial', stage: null,   // 전개 단계에서 볼 그래프, 그래프로 보는 풀이 단계(null이면 마지막 단계)
  on: Object.fromEntries(CONCEPTS.map(c => [c.id, c.id === 'series'])),   // 쓰는 개념 모듈(주제가 정함)
  fMode: 'single', pieces: [],   // 구간별 입력이면 pieces로 f를 만듭니다.
  coefKind: 'b', coefN: 1, halfMode: 'sine', family: 'sine',   // family: 구간의 고유함수 종류(eigen.js)
  waveDomain: 'finite', g: '0', c: '1',
  heatDomain: 'finite', alpha: '0.1', bc: 'fixed', left: '0', right: '0',   // alpha는 교재의 c²(열확산계수)입니다.
  X: '8', s: 0,
  jumpIndex: 1, waveEnds: 'fixed', damping: '0', kDamp: '0.3',   // 도약점 선택, 현의 끝(고정/자유), 감쇠 k(문제에 감쇠가 있을 때 kDamp)
  wMax: '10',                                             // Fourier 적분의 위끝 a
  hRobin: '1',                                             // 열 방출(Robin) 끝: x = 0에서 u_x − hu = 0, x = L에서 u_x + hu = 0
  mAng: 0, angular: false,                                 // 원판의 각 방향 차수 m(처음 모양 f(r)cos mθ). angular는 주제가 정합니다.
  b: '1', h: 'y<b/2 ? y : b-y', M: 8,                     // 막: 세로 길이 b, 처음 모양의 y 방향 h(y), 모드 수
  xMin: '', xMax: '', yMin: '', yMax: '', tEndWave: '', tEndHeat: '',      // 비우면 자동
};
const SHEET = { title: '공업수학 예제', subtitle: '', concept: true, graph: true, solution: true, student: false, space: '8' };
const copy = v => JSON.parse(JSON.stringify(v));
/** 저장된 설정을 기본값과 합칩니다. 문제가 없는 예전 설정은 축(v0.14~0.17)이나 개념 체크(v0.13까지)에서 문제를 읽습니다. */
function mergeCfg(c) {
  const m = { ...copy(DEFAULTS), ...copy(c ?? {}), on: { ...DEFAULTS.on, ...(c?.on ?? {}) }, params: { ...(c?.params ?? {}) } };
  m.prob = c?.prob ? { ...DEFAULTS.prob, ...c.prob } : c?.axes ? problemFromAxes(c.axes, m) : problemFromOn(m);
  delete m.axes; delete m.focus; delete m.base;
  return applyProblem(m);
}
const emptyDraft = () => ({ items: [], figures: [], editing: null, custom: false, dirty: false });
const S = {
  cfg: copy(DEFAULTS), good: null, R: null, dirty: true, playing: false, rate: 1, last: 0, paramKey: '', panelKey: '', tab: 'summary', lastTab: '',
  draft: emptyDraft(), saved: [], edits: {}, sheet: copy(SHEET), editingConcept: null,
  zoom: null, pin: null, tool: 'view', ink: {}, marks: {}, frames: {}, hover: null, drawingKey: '', noSave: false, fakeDownload: false,
  ready: false, knownParams: new Set(), statusAct: null, undoCfg: null, tourStep: -1,
};

/* ── 값 읽기 ───────────────────────────────────────── */
function positive(cfg, key, label, L = 1) { try { return constant(cfg[key], L); } catch (e) { throw new Error(`${label}: ${e.message}`); } }
function real(cfg, key, label, L = 1) {
  let c;
  try { c = compile(String(cfg[key])); } catch (e) { throw new Error(`${label}: ${e.message}`); }
  const value = c.params.length ? NaN : c.fn(0, { L });
  if (!isFinite(value)) throw new Error(`${label}: 숫자를 입력하십시오.`);
  if (c.fn(1.37, { L }) !== value) throw new Error(`${label}: x를 쓸 수 없습니다. 숫자를 입력하십시오.`);
  return value;
}
/** 비워 두면 null(자동)입니다. */
const optional = (cfg, key, label, L) => String(cfg[key] ?? '').trim() ? real(cfg, key, label, L) : null;
function optionalPositive(cfg, key, label, L) { const v = optional(cfg, key, label, L); if (v !== null && v <= 0) throw new Error(`${label}: 양수여야 합니다.`); return v; }
function rangeOf(cfg, a, b, label, L) {
  const lo = optional(cfg, a, label, L), hi = optional(cfg, b, label, L);
  if (lo === null || hi === null) return null;
  if (!(hi > lo)) throw new Error(`${label}: 끝값이 시작값보다 커야 합니다.`);
  return [lo, hi];
}
/** 영역이 정한 글자를 바꾼 식입니다(원판: r → x, R → L). */
const srcOf = (cfg, key) => { let s = String(cfg[key]); for (const [a, b] of DOMAINS.find(d => d.id === cfg.prob?.domain)?.vars ?? []) s = s.replace(new RegExp(`\\b${a}\\b`, 'g'), b); return s; };
function fnOf(cfg, key, label, L) {
  let c;
  try { c = compile(srcOf(cfg, key)); } catch (e) { throw new Error(`${label}: ${e.message} (예: x^2, sin x, |x|, x<0 ? -1 : 1)`); }
  const P = { ...cfg.params, L };
  return x => c.fn(x, P);
}
const finiteWave = cfg => cfg.on.wave && cfg.waveDomain === 'finite';
const finiteHeat = cfg => cfg.on.heat && cfg.heatDomain === 'finite';
/** 유한한 현과 막대는 반구간 전개 위에 만들어집니다. */
const needsHalf = cfg => finiteWave(cfg) || finiteHeat(cfg);
const anyInfinite = cfg => (cfg.on.wave && cfg.waveDomain === 'infinite') || (cfg.on.heat && cfg.heatDomain === 'infinite') || cfg.on.transform;

/* ── 계산 ─────────────────────────────────────────── */
function scanRange(fn, xr, times) {
  let lo = Infinity, hi = -Infinity;
  for (const t of times) for (let i = 0; i <= 120; i++) { const y = fn(xr[0] + i / 120 * (xr[1] - xr[0]), t); if (y < lo) lo = y; if (y > hi) hi = y; }
  if (!isFinite(lo) || !isFinite(hi)) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.');
  const pad = Math.max(.05, .15 * (hi - lo));
  return [lo - pad, hi + pad];
}
/** 급수 모델은 함수·L·전개 방식이 같으면 다시 쓰므로, N을 바꿀 때 다시 계산하지 않습니다(정밀 계수 캐시도 함께 남음). */
const SERIES_CACHE = new Map();
function seriesOf(cfg, f, L) {
  const key = JSON.stringify([srcOf(cfg, 'f'), L, cfg.params, cfg.on.half ? cfg.halfMode : 'full']);
  if (!SERIES_CACHE.has(key)) {
    if (SERIES_CACHE.size > 24) SERIES_CACHE.delete(SERIES_CACHE.keys().next().value);
    SERIES_CACHE.set(key, buildSeries(f, L, cfg.on.half ? cfg.halfMode : 'full', 0));
  }
  return SERIES_CACHE.get(key);
}
/** 감쇠 k가 있는 모드: q'' + 2kq' + λ²q = 0, q(0) = B, q'(0) = V. */
function dampedMode(B, V, lam, k) {
  if (k <= 0) return t => B * Math.cos(lam * t) + (lam ? V / lam * Math.sin(lam * t) : V * t);
  if (k < lam) { const mu = Math.sqrt(lam * lam - k * k); return t => Math.exp(-k * t) * (B * Math.cos(mu * t) + (V + k * B) / mu * Math.sin(mu * t)); }
  if (Math.abs(k - lam) < 1e-12) return t => Math.exp(-k * t) * (B + (V + k * B) * t);
  const d = Math.sqrt(k * k - lam * lam), r1 = -k + d, r2 = -k - d, c1 = (V - r2 * B) / (r1 - r2), c2 = B - c1;
  return t => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}
/** 감쇠가 있거나 양 끝이 자유로운 유한한 현입니다. 자유 끝이면 모드가 cos(nπx/L)이고 0번 모드(평행 이동)가 있습니다. */
function stringModel(f, g, L, N, speed, k, free) {
  const Bf = halfCoefficients(f, L, N, free), Vg = halfCoefficients(g, L, N, free), lam = n => speed * n * PI / L;
  const shape = free ? (n, x) => Math.cos(n * PI * x / L) : (n, x) => Math.sin(n * PI * x / L);
  const q = [free ? (k > 0 ? (t => Bf.mean + Vg.mean * (1 - Math.exp(-2 * k * t)) / (2 * k)) : (t => Bf.mean + Vg.mean * t)) : () => 0];
  for (let n = 1; n <= N; n++) q.push(dampedMode(Bf.c[n], Vg.c[n], lam(n), k));
  return { coef: Bf.c, velocity: Vg.c, mean: Bf.mean, omega: lam, damping: k, free,
    amp: (n, t) => q[n](t), mode: (n, x, t) => q[n](t) * (n ? shape(n, x) : 1),
    u: (x, t) => { let s = q[0](t); for (let n = 1; n <= N; n++) s += q[n](t) * shape(n, x); return s; } };
}
/** 직사각형 막(가로 a = L, 세로 b): 처음 모양 f(x)h(y), 처음 속도 0. x 방향 고유함수 종류 fx, y 방향 fy(변의 조건이 정함, eigen.js).
    모드 φₘ(x)ψₙ(y)의 각진동수는 λₘₙ = c√(kₘ² + k̃ₙ²)이고 계수는 Bₘₙ = (f의 계수)(h의 계수)입니다. */
function membraneModel(fx, fy, f, h, a, b, M, speed) {
  const Bx = eigenCoefficients(fx, f, a, M), By = eigenCoefficients(fy, h, b, M), lam = (m, n) => speed * Math.hypot(fx.k(m, a), fy.k(n, b));
  const terms = [];
  for (let m = fx.n0; m <= M; m++) for (let n = fy.n0; n <= M; n++) { const B = Bx[m] * By[n]; if (Math.abs(B) > 1e-12) terms.push([m, n, B, lam(m, n)]); }
  const u = (x, y, t) => { let s = 0; for (const [m, n, B, l] of terms) s += B * Math.cos(l * t) * fx.phi(m, x, a) * fy.phi(n, y, b); return s; };
  let zmax = 1e-9;
  for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) zmax = Math.max(zmax, Math.abs(u(i / 20 * a, j / 20 * b, 0)));
  let base = Infinity, baseMode = [1, 1];   // 0이 아닌 가장 낮은 각진동수
  for (let m = fx.n0; m <= fx.n0 + 2; m++) for (let n = fy.n0; n <= fy.n0 + 2; n++) { const l = lam(m, n); if (l > 1e-12 && l < base) { base = l; baseMode = [m, n]; } }
  return { a, b, M, fx, fy, Bx, By, terms, lam, u, zmax, base, baseMode };
}
/** Fourier 적분: A(w), B(w)를 [−X, X]에서 수치 적분하고, 위끝 a까지의 적분으로 f를 다시 만듭니다. */
/** 구간 [a, b]에서 유계인지 봅니다(촘촘히 볼수록 커지면 무한히 커지는 함수). */
function boundedOn(fn, a, b, label) {
  const peak = n => { let m = 0; for (let i = 0; i < n; i++) { const y = fn(a + (i + .5) / n * (b - a)); if (!isFinite(y)) throw new Error(`${label}: 구간 안에 값이 정의되지 않는 점이 있습니다.`); m = Math.max(m, Math.abs(y)); } return m; };
  const coarse = peak(500), fine = peak(4000);
  if (fine > 1e4 || (fine > 10 && fine > 2 * coarse)) throw new Error(`${label}: 구간에서 유계인 함수를 입력하십시오.`);
}
/** Fourier 적분. x는 2048점, w는 위끝에 맞춰 늘린 점으로 계산합니다. 위끝이 x 간격의 한계(나이퀴스트)를 넘으면 알립니다. */
function integralModel(f, X, wMax) {
  const q = 2048, h = 2 * X / q, vs = [], fs = [], limit = .9 * PI / h;
  if (wMax > limit) throw new Error(`적분의 위끝 a: 범위 X = ${fmt(X, 3)}에서는 ${Math.floor(limit)} 이하로 쓰십시오. 더 크게 하려면 범위 X를 줄이십시오.`);
  for (let i = 0; i < q; i++) { const v = -X + (i + .5) * h; vs.push(v); fs.push(f(v)); }
  if (fs.some(y => !isFinite(y))) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.');
  const K = Math.min(4000, Math.max(400, Math.ceil(2 * wMax * X / PI))), ws = Array.from({ length: K + 1 }, (_, i) => i / K * wMax), A = [], B = [];
  for (const w of ws) { let sa = 0, sb = 0; for (let i = 0; i < q; i++) { sa += fs[i] * Math.cos(w * vs[i]); sb += fs[i] * Math.sin(w * vs[i]); } A.push(sa * h / PI); B.push(sb * h / PI); }
  const dw = wMax / K, edge = Math.max(Math.abs(fs[0]), Math.abs(fs[q - 1]));
  const recon = x => { let s = 0; for (let i = 0; i <= K; i++) s += (i === 0 || i === K ? .5 : 1) * (A[i] * Math.cos(ws[i] * x) + B[i] * Math.sin(ws[i] * x)); return s * dw; };
  let lo = 0, hi = 0;
  for (const y of fs) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  return { X, wMax, ws, A, B, recon, f, edge, span: hi - lo, yr: [lo - .2 * (hi - lo || 1), hi + .2 * (hi - lo || 1)] };
}
function compute(cfg) {
  const L = domainL(cfg) ?? positive(cfg, 'L', 'L'), f = fnOf(cfg, 'f', '함수 f(x)', L), N = cfg.N;
  const R = { L, f, N, series: seriesOf(cfg, f, L) };
  R.view = { x: rangeOf(cfg, 'xMin', 'xMax', '그래프 가로 범위', L), y: rangeOf(cfg, 'yMin', 'yMax', '그래프 세로 범위', L) };
  const X = anyInfinite(cfg) ? positive(cfg, 'X', '범위 X', L) : 0;
  for (const mod of MODULES) if (cfg.on[mod.id] && mod.compute) mod.compute(cfg, R, { L, f, N, X });   // 등록 순서대로(막은 현 다음)
  return R;
}
const timeOf = (part, cfg) => part ? cfg.s * part.tEnd : 0;

/* ── 정확한 값과 글자 ─────────────────────────────── */
const CLOSED_FORMS = [
  [1, (r, q) => `${r}${q > 1 ? `/${q}` : ''}`],
  [1 / PI, (r, q) => `${r}/${q > 1 ? `(${q}π)` : 'π'}`],
  [PI, (r, q) => `${r > 1 ? r : ''}π${q > 1 ? `/${q}` : ''}`],
  [1 / (PI * PI), (r, q) => `${r}/${q > 1 ? `(${q}π²)` : 'π²'}`],
  [PI * PI, (r, q) => `${r > 1 ? r : ''}π²${q > 1 ? `/${q}` : ''}`],
];
/** r/q, r/(qπ), rπ/q, r/(qπ²), rπ²/q 꼴의 후보를 찾습니다. {text, value} 또는 null입니다. */
function closedSearch(value) {
  if (Math.abs(value) < 1e-12) return { text: '0', value: 0 };
  const sign = value < 0 ? -1 : 1, u = Math.abs(value);
  for (const [scale, show] of CLOSED_FORMS) {
    const w = u / scale;
    for (let q = 1; q <= 100; q++) { const r = Math.round(w * q); if (r >= 1 && r <= 200 && Math.abs(w * q - r) < 2e-6 * q) return { text: (sign < 0 ? '−' : '') + show(r, q), value: sign * r / q * scale }; }
  }
  return null;
}
/** 화면용: 닫힌 꼴이 있으면 그 꼴로, 없으면 소수로 씁니다. */
const coefText = value => closedSearch(value)?.text ?? fmt(value, 4);
/** 계수 표기: 촘촘한 적분값이 닫힌 꼴과 1e-9 안에서 맞을 때만 정확한 값(sure)으로, 아니면 소수 근삿값으로 씁니다. */
function exact(value) {
  const c = closedSearch(value);
  return c && Math.abs(c.value - value) <= 1e-9 * Math.max(1, Math.abs(value)) ? { text: c.text, sure: true } : { text: fmt(value, 4), sure: false };
}
const rel = e => e.sure ? '=' : '\\approx';
/** 작은 오차도 0으로 보이지 않게 유효숫자 3자리로 씁니다. */
const errText = v => v >= .01 || v === 0 ? fmt(v, 4) : v.toPrecision(3);
/** 중점 적분을 두 격자(32768, 65536칸)로 하고 Richardson 외삽으로 오차를 줄입니다. 도약이 격자점에 있지 않으면 정확도가 떨어지며, 그때는 근삿값(≈)으로 표시됩니다. */
function integrate(fn, a, b) {
  const mid = q => { const h = (b - a) / q; let s = 0; for (let j = 0; j < q; j++) s += fn(a + (j + .5) * h); return s * h; };
  return (4 * mid(65536) - mid(32768)) / 3;
}
/** 계수를 촘촘한 적분으로 다시 구합니다. kind는 'a0', 'a', 'b'입니다. */
function fineCoef(model, kind, n = 0) {
  model.fine ??= {};
  const key = `${kind}${n}`;
  if (key in model.fine) return model.fine[key];
  const L = model.L, w = n * PI / L, g = kind === 'a0' ? model.ext : kind === 'a' ? x => model.ext(x) * Math.cos(w * x) : x => model.ext(x) * Math.sin(w * x);
  const s = integrate(g, -L, L);
  return (model.fine[key] = kind === 'a0' ? s / (2 * L) : s / L);
}
const halfCache = new WeakMap();
/** (0, L)에서의 반구간 계수입니다. n = 0이면 평균입니다. */
function fineHalf(fn, L, n, cosine) {
  const memo = halfCache.get(fn) ?? new Map(), key = `${L}|${n}|${cosine}`;
  halfCache.set(fn, memo);
  if (memo.has(key)) return memo.get(key);
  const w = n * PI / L, s = integrate(n === 0 ? fn : cosine ? x => fn(x) * Math.cos(w * x) : x => fn(x) * Math.sin(w * x), 0, L), v = n === 0 ? s / L : 2 * s / L;
  memo.set(key, v);
  return v;
}
const argOf = (n, L) => { const c = n === 1 ? '' : n; if (Math.abs(L - PI) < 1e-9) return `${c}x`; if (Math.abs(L - 1) < 1e-9) return `${c}πx`; return `${c}πx/${fmt(L, 3)}`; };
/** [[계수, 뒤에 붙는 글자], …]를 '4/π sin x − 1/2 cos 2x + ⋯'처럼 씁니다. */
function termsText(terms, more = true) {
  const parts = terms.map(([value, tail]) => { const size = exact(Math.abs(value)).text, lead = tail && size === '1' ? '' : size; return [value < 0, `${lead}${tail && lead ? ' ' : ''}${tail}`]; });
  if (!parts.length) return '0';
  return parts.map(([neg, text], i) => (i ? (neg ? ' − ' : ' + ') : neg ? '−' : '') + text).join('') + (more ? ' + ⋯' : '');
}
function seriesTerms(model, count = 4) {
  const tol = 1e-6 * Math.max(model.span, 1e-9), out = [];
  if (Math.abs(model.a0) >= tol) out.push([fineCoef(model, 'a0'), '']);
  for (let n = 1; n <= NMAX && out.length < count; n++) {
    if (Math.abs(model.a[n]) >= tol) out.push([fineCoef(model, 'a', n), `cos ${argOf(n, model.L)}`]);
    if (Math.abs(model.b[n]) >= tol && out.length < count) out.push([fineCoef(model, 'b', n), `sin ${argOf(n, model.L)}`]);
  }
  return out;
}
/** 계수가 n의 몇 제곱으로 줄어드는지 추정합니다(포락선의 로그 기울기). */
function decayPower(model) {
  const pts = [];
  for (let n = 4; n <= 60; n++) { const c = Math.hypot(model.a[n], model.b[n]); if (c > 1e-7 * Math.max(model.span, 1e-9)) pts.push([Math.log(n), Math.log(c)]); }
  if (pts.length < 6) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return -pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
}
const decayWords = p => p === null ? '계수가 몇 항 뒤에 0이 되어 유한한 합으로 끝납니다.' : p < 1.5 ? '도약이 있는 함수의 특징입니다.' : p < 2.5 ? '연속이지만 꺾인 점이 있는 함수의 특징입니다.' : '매끄러운 함수라 계수가 아주 빨리 줄어듭니다.';
/** 수식 입력을 읽기 좋은 글로 바꿉니다: 3*x^2 → 3x², pi → π, 조건식 → 구간별 표기. 변수 값을 넣습니다. */
function prettyExpr(text, params = {}) {
  let s = String(text).trim();
  for (const [k, v] of Object.entries(params)) s = s.replace(new RegExp(`\\b${k}\\b`, 'g'), v < 0 ? `(${v})` : String(v));
  while (/^\(.*\)$/.test(s) && wrapped(s)) s = s.slice(1, -1).trim();
  const ternary = splitTernary(s);
  if (ternary) return `${prettyExpr(ternary[1])} (${prettyExpr(ternary[0])}), ${prettyExpr(ternary[2])} (그 외)`;
  return s.replace(/\bpi\b/g, 'π').replace(/(\d)\s*\*\s*(\d)/g, '$1·$2').replace(/\s*\*\s*/g, '').replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/sqrt\(/g, '√(').replace(/-/g, '−').replace(/\s*([<>])\s*/g, ' $1 ');
}
const lengthText = cfg => prettyExpr(cfg.L);
/** 맨 앞 괄호가 맨 끝 괄호와 짝이면 참입니다: (a) ? b : (c)는 거짓. */
function wrapped(s) { let d = 0; for (let i = 0; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')') d--; if (d === 0 && i < s.length - 1) return false; } return true; }

/* ── 구간별 함수 ─────────────────────────────────── */
/** 맨 바깥의 조건식 a ? b : c를 [a, b, c]로 나눕니다. */
function splitTernary(s) {
  let depth = 0, q = -1, nest = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && ch === '?') { if (q < 0) q = i; else nest++; }
    else if (depth === 0 && ch === ':' && q >= 0) { if (nest) nest--; else return [s.slice(0, q).trim(), s.slice(q + 1, i).trim(), s.slice(i + 1).trim()]; }
  }
  return null;
}
/** 'x<a ? f : x<b ? g : h'를 [{until: 'a', expr: 'f'}, …, {until: null, expr: 'h'}]로 나눕니다. 이 꼴이 아니면 null입니다. */
function piecesOf(text) {
  const out = [];
  let rest = String(text).trim(), part;
  while ((part = splitTernary(rest))) { const m = part[0].match(/^x\s*<(?!=)\s*(.+)$/); if (!m) return null; out.push({ until: m[1].trim(), expr: part[1] }); rest = part[2]; }
  out.push({ until: null, expr: rest });
  return out;
}
const piecesExpr = pieces => pieces.slice(0, -1).reduceRight((rest, p) => `x<${p.until} ? ${p.expr} : ${rest}`, pieces.at(-1).expr);
const halfDomain = cfg => cfg.prob?.domain !== 'sphere' && (cfg.on.half || cfg.on.modes || cfg.on.laplace || needsHalf(cfg));
const toPieces = (f, cfg) => { const p = piecesOf(f); return p && p.length > 1 ? p : [{ until: halfDomain(cfg) ? 'L/2' : '0', expr: f }, { until: null, expr: f }]; };
/** 함수를 문서용 글로 씁니다. 구간별이면 구간마다 식과 범위를 씁니다. */
/** 함수를 문서용 글로 씁니다. 원판이면 f(r)로 씁니다. */
const fMarkup = cfg => { const s = fMarkupX(cfg); return cfg.prob?.domain === 'disk' ? s.replace('$f(x) = ', '$f(r) = ') : s; };
function fMarkupX(cfg) {
  const rows = piecewiseRows(cfg, halfDomain(cfg));
  if (rows && rows.length > 1) return rows.map((r, i) => `${i ? '' : '$f(x) = $ '}$${polyTex(r.poly)}$ ($${piTex(r.lo)} \\le x < ${piTex(r.hi)}$)`).join(', ');
  const pieces = piecesOf(cfg.f), pe = s => prettyExpr(s, cfg.params);
  if (!pieces || pieces.length === 1) return `$f(x) = ${pe(cfg.f)}$`;
  const [e0, e1] = fEnds(cfg), bounds = [e0, ...pieces.slice(0, -1).map(p => pe(p.until)), e1];
  return pieces.map((p, i) => `${i ? '' : '$f(x) = $ '}$${pe(p.expr)}$ ($${bounds[i]} \\le x < ${bounds[i + 1]}$)`).join(', ');
}
