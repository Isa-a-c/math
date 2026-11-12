'use strict';
/* 공업수학 시각화의 상태, 값 읽기, 계산, 정확한 값, 구간별 함수. 화면(DOM)은 $ 외에 쓰지 않습니다. */
/* 공업수학 시각화: 함수 하나를 입력하고 기본 개념(Fourier 급수)에 개념(반구간 전개, 급수 분석, 시간 변화, 2차원 막, 감쇠…)을 더하면 그래프가 그 조합으로 바뀝니다.
   예제(문제·풀이·그림)는 사용자가 직접 만들고 고치며, 개념 설명도 고칠 수 있습니다. 모두 Word로 출력하고 파일로 저장합니다.
   계산은 math.js, 그리기는 plot.js, 수식 표기와 Word 파일은 docx.js, 개념 설명은 concepts.js입니다. */
const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const DEFAULTS = {
  f: 'sign(x)', L: 'pi', N: 9, params: {},
  base: 'fourier', focus: null,   // 기본 개념(BASES)과 그래프로 보는 개념 카드
  axes: { rep: 'series', look: 'partial', time: 'none', bound: 'fixed', dim: '1', damp: 'off' },   // 더한 개념(아래 AXES). on 등은 여기서 만들어집니다.
  on: { series: true, coef: false, spectrum: false, gibbs: false, transform: false, half: false, wave: false, membrane: false, heat: false },
  fMode: 'single', pieces: [],   // 구간별 입력이면 pieces로 f를 만듭니다.
  coefKind: 'b', coefN: 1, halfMode: 'sine',
  waveDomain: 'finite', g: '0', c: '1',
  heatDomain: 'finite', alpha: '0.1', bc: 'fixed', left: '0', right: '0',   // alpha는 교재의 c²(열확산계수)입니다.
  X: '8', s: 0,
  jumpIndex: 1, waveEnds: 'fixed', damping: '0', kDamp: '0.3',   // 도약점 선택, 현의 끝(고정/자유), 감쇠 k(개념 '감쇠'를 더했을 때 kDamp)
  wMax: '10',                                             // Fourier 적분의 위끝 a
  b: '1', h: 'y<b/2 ? y : b-y', M: 8,                     // 막: 세로 길이 b, 처음 모양의 y 방향 h(y), 모드 수
  xMin: '', xMax: '', yMin: '', yMax: '', tEndWave: '', tEndHeat: '',      // 비우면 자동
};
const SHEET = { title: '공업수학 예제', subtitle: '', concept: true, graph: true, solution: true, student: false, space: '8' };
const copy = v => JSON.parse(JSON.stringify(v));
/** 저장된 설정을 기본값과 합칩니다. 축이 없는 예전 설정은 개념 체크에서 축을 읽습니다. */
function mergeCfg(c) {
  const m = { ...copy(DEFAULTS), ...copy(c ?? {}), on: { ...DEFAULTS.on, ...(c?.on ?? {}) }, params: { ...(c?.params ?? {}) } };
  m.axes = c?.axes ? { ...DEFAULTS.axes, ...c.axes } : axesFromOn(m);
  return applyAxes(m);
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
function fnOf(cfg, key, label, L) {
  let c;
  try { c = compile(String(cfg[key])); } catch (e) { throw new Error(`${label}: ${e.message} (예: x^2, sin x, |x|, x<0 ? -1 : 1)`); }
  const P = { ...cfg.params, L };
  return x => c.fn(x, P);
}
const finiteWave = cfg => cfg.on.wave && cfg.waveDomain === 'finite';
const finiteHeat = cfg => cfg.on.heat && cfg.heatDomain === 'finite';
/** 유한한 현과 막대는 반구간 전개 위에 만들어집니다. */
const needsHalf = cfg => finiteWave(cfg) || finiteHeat(cfg);
const anyInfinite = cfg => (cfg.on.wave && cfg.waveDomain === 'infinite') || (cfg.on.heat && cfg.heatDomain === 'infinite') || cfg.on.transform;

/* ── 기본 개념 + 더하는 개념 ──────────────────────── */
/* 장의 대표 개념(기본 개념)에 개념을 하나씩 더해 다른 절로 넓힙니다. 교재의 절은 더한 개념의 조합입니다.
   더하는 개념은 서로 독립된 축(cfg.axes)의 값입니다. 장이 늘면 기본 개념(BASES)이나 축의 값을 더하므로 목록이 커지지 않습니다.
   cfg.on(개념별 켜짐)과 halfMode, waveDomain 같은 값은 축에서 만들어지며, 계산·요약·예제·Word는 그대로 cfg.on을 씁니다.
   저장할 때는 축만 남기고 만들어지는 값은 지웁니다(store.js의 storedCfg). */
const AXES = [
  { k: 'rep', label: '구간', none: 'series', options: [['series', '주기 급수'], ['sine', '반구간 사인'], ['cosine', '반구간 코사인'], ['integral', 'Fourier 적분']] },
  { k: 'look', label: '급수 분석', none: 'partial', options: [['partial', '없음'], ['coef', '계수의 의미'], ['spectrum', '계수 크기'], ['gibbs', '수렴과 도약']] },
  { k: 'time', label: '시간 변화', none: 'none', options: [['none', '없음'], ['wave', '파동 방정식'], ['heat', '열 방정식']] },
  { k: 'bound', label: '경계', none: 'fixed', options: [['fixed', '고정'], ['free', '자유(단열)'], ['infinite', '무한']] },
  { k: 'dim', label: '2차원 막', none: '1', options: [['1', '없음'], ['2', '있음']] },
  { k: 'damp', label: '감쇠', none: 'off', options: [['off', '없음'], ['on', '있음']] },
];
/** 기본 개념(장의 대표 개념)입니다. 다른 장을 넣을 때 여기에 기본 개념을 더하고, 그 개념에 더할 수 있는 축을 정합니다. */
const BASES = [{ id: 'fourier', ch: '11·12장', title: 'Fourier 급수', idea: '함수를 파동(sin, cos)들의 합으로 나타냅니다.' }];
/** 축마다 화면의 개념 카드입니다. */
const LAYER_OF = { rep: 'domain', look: 'look', time: 'time', bound: 'time', dim: 'dim', damp: 'damp' };
const BOUND_REP = { fixed: 'sine', free: 'cosine', infinite: 'integral' };
const axisText = (k, v) => AXES.find(a => a.k === k).options.find(o => o[0] === v)?.[1] ?? v;
/** 축마다 지금 쓰이는 값입니다. 시간 변화가 있으면 구간은 경계에서 정해지고, 쓰이지 않는 축은 used = false입니다. */
function axesView(ax) {
  const timed = ax.time !== 'none', rep = timed ? (ax.dim === '2' ? 'sine' : BOUND_REP[ax.bound]) : ax.rep;
  return {
    rep: { value: rep, used: true },
    look: { value: ax.look, used: rep !== 'integral' },
    time: { value: ax.time, used: true },
    bound: { value: ax.bound, used: timed },
    dim: { value: ax.dim, used: ax.time === 'wave' },
    damp: { value: ax.damp, used: ax.time === 'wave' && ax.dim === '1' && ax.bound !== 'infinite' },
  };
}
/** 함께 쓸 수 없는 값을 정리합니다: 막은 고정된 끝의 파동, 감쇠는 유한한 1차원 현, 적분에는 급수 분석이 없습니다. */
function normalizeAxes(ax) {
  if (ax.time !== 'wave' || ax.bound !== 'fixed') ax.dim = '1';
  if (ax.time !== 'wave' || ax.bound === 'infinite' || ax.dim === '2') ax.damp = 'off';
  if (axesView(ax).rep.value === 'integral') ax.look = 'partial';
  return ax;
}
/** 축에서 개념 켜짐(cfg.on)과 확장·경계 값을 만듭니다. */
function applyAxes(cfg) {
  const ax = normalizeAxes(cfg.axes), v = axesView(ax), on = cfg.on, rep = v.rep.value;
  for (const k of Object.keys(on)) on[k] = false;
  on.series = true;
  if (rep === 'sine' || rep === 'cosine') { on.half = true; cfg.halfMode = rep; }
  if (rep === 'integral' && ax.time === 'none') on.transform = true;
  if (v.look.used) { on.coef = ax.look === 'coef' || ax.look === 'spectrum'; on.spectrum = ax.look === 'spectrum'; on.gibbs = ax.look === 'gibbs'; }
  if (ax.time === 'wave') {
    on.wave = true; on.membrane = ax.dim === '2';
    cfg.waveDomain = ax.bound === 'infinite' ? 'infinite' : 'finite'; cfg.waveEnds = ax.bound === 'free' ? 'free' : 'fixed';
  } else if (ax.time === 'heat') {
    on.heat = true; cfg.heatDomain = ax.bound === 'infinite' ? 'infinite' : 'finite'; cfg.bc = ax.bound === 'free' ? 'insulated' : 'fixed';
  }
  cfg.damping = v.damp.used && ax.damp === 'on' ? String(cfg.kDamp) : '0';
  return cfg;
}
/** 예전 저장 파일(개념 체크 방식)의 설정을 축으로 읽습니다. */
function axesFromOn(cfg) {
  const on = cfg.on, time = on.wave || on.membrane ? 'wave' : on.heat ? 'heat' : 'none';
  const inf = time === 'wave' ? cfg.waveDomain === 'infinite' : time === 'heat' && cfg.heatDomain === 'infinite';
  const free = time === 'wave' ? cfg.waveEnds === 'free' : time === 'heat' && cfg.bc === 'insulated';
  const damp = time === 'wave' && !inf && !on.membrane && !['', '0', '0.0'].includes(String(cfg.damping ?? '0').trim());
  if (damp) cfg.kDamp = String(cfg.damping);
  return normalizeAxes({ rep: on.transform ? 'integral' : on.half ? (cfg.halfMode === 'cosine' ? 'cosine' : 'sine') : 'series',
    look: on.gibbs ? 'gibbs' : on.spectrum ? 'spectrum' : on.coef ? 'coef' : 'partial',
    time, dim: on.membrane ? '2' : '1', bound: inf ? 'infinite' : free ? 'free' : 'fixed', damp: damp ? 'on' : 'off' });
}
/** 축 하나를 바꿉니다. 함께 맞춰야 하는 다른 축도 바꾸고, 바뀐 것을 글로 돌려줍니다(마지막으로 고른 것이 이깁니다).
    그래프는 방금 더하거나 바꾼 개념으로 바뀝니다(cfg.focus). */
function setAxis(cfg, axis, value) {
  const ax = cfg.axes, before = axesView({ ...ax });
  if (axis === 'rep' && ax.time !== 'none') {
    if (value === 'series') { ax.time = 'none'; ax.rep = 'series'; }
    else { ax.bound = { sine: 'fixed', cosine: 'free', integral: 'infinite' }[value]; ax.rep = value; }
  } else ax[axis] = value;
  if (axis === 'look' && value !== 'partial' && axesView(ax).rep.value === 'integral') { if (ax.time === 'none') ax.rep = 'series'; else ax.bound = 'fixed'; }
  if (axis === 'time' && before.time.value === 'none' && value !== 'none') ax.bound = 'fixed';   // 시간 변화를 처음 더하면 교재처럼 양 끝 고정부터
  if (axis === 'bound' && ax.time === 'none') ax.time = 'wave';
  if (axis === 'dim' && value === '2') { ax.time = 'wave'; ax.bound = 'fixed'; ax.damp = 'off'; }
  if (axis === 'damp' && value === 'on') { ax.time = 'wave'; ax.dim = '1'; if (ax.bound === 'infinite') ax.bound = 'fixed'; }
  normalizeAxes(ax);
  cfg.focus = axis !== 'bound' && value === AXES.find(a => a.k === axis).none ? null : LAYER_OF[axis];
  const after = axesView(ax), changed = AXES.filter(a => a.k !== axis && !(axis === 'time' && a.k === 'bound') && before[a.k].used && (after[a.k].used ? after[a.k].value !== before[a.k].value : before[a.k].value !== a.none));
  return changed.length ? `함께 바뀐 개념: ${changed.map(a => `${a.label} → ${after[a.k].used ? axisText(a.k, after[a.k].value) : '뺌'}`).join(', ')}` : '';
}
/** 지금 조합이 교재의 어느 절인지 돌려줍니다: [장 또는 null(응용 조합), 이름]. */
function recipeOf(cfg) {
  const ax = cfg.axes, v = axesView(ax), rep = v.rep.value;
  const look = v.look.used ? { partial: null, coef: '계수의 의미 (직교성)', spectrum: '계수 크기와 제곱오차', gibbs: '수렴과 Gibbs 현상' }[ax.look] : null;
  let r;
  if (ax.time === 'wave') {
    if (ax.dim === '2') r = ['12장', '직사각형 막의 진동'];
    else if (ax.bound === 'infinite') r = ['12장', "D'Alembert 해 (무한히 긴 현)"];
    else if (ax.bound === 'free' || ax.damp === 'on') r = [null, `현의 진동${ax.bound === 'free' ? ' + 자유 끝' : ''}${ax.damp === 'on' ? ' + 감쇠' : ''}`];
    else r = ['12장', '현의 진동'];
  } else if (ax.time === 'heat') r = ['12장', ax.bound === 'infinite' ? '무한히 긴 막대의 열전도 (열핵)' : ax.bound === 'free' ? '양 끝이 단열된 막대의 열전도' : '막대의 열전도'];
  else if (rep === 'integral') r = ['11장', 'Fourier 적분'];
  else if (rep === 'series') return ['11장', look ?? 'Fourier 급수'];
  else return look ? [null, `반구간 전개 + ${look}`] : ['11장', `반구간 전개 (${rep === 'sine' ? '사인' : '코사인'} 급수)`];
  return look ? [null, `${r[1]} + 처음 모양의 ${look}`] : r;
}
/** '12장 · 현의 진동', '응용 조합 · 현의 진동 + 감쇠'처럼 씁니다. */
const recipeText = cfg => { const [ch, name] = recipeOf(cfg); return `${ch ?? '응용 조합'} · ${name}`; };

/* ── 계산 ─────────────────────────────────────────── */
function scanRange(fn, xr, times) {
  let lo = Infinity, hi = -Infinity;
  for (const t of times) for (let i = 0; i <= 120; i++) { const y = fn(xr[0] + i / 120 * (xr[1] - xr[0]), t); if (y < lo) lo = y; if (y > hi) hi = y; }
  if (!isFinite(lo) || !isFinite(hi)) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.');
  const pad = Math.max(.05, .15 * (hi - lo));
  return [lo - pad, hi + pad];
}
/** 설정 하나로 모든 개념의 결과를 계산합니다. */
/** 급수 모델은 함수·L·전개 방식이 같으면 다시 쓰므로, N을 바꿀 때 다시 계산하지 않습니다(정밀 계수 캐시도 함께 남음). */
const SERIES_CACHE = new Map();
function seriesOf(cfg, f, L) {
  const key = JSON.stringify([cfg.f, cfg.L, cfg.params, cfg.on.half ? cfg.halfMode : 'full']);
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
/** 직사각형 막(가로 a = L, 세로 b): 처음 모양 f(x)h(y), 처음 속도 0, 가장자리 고정. */
function membraneModel(f, h, a, b, M, speed) {
  const Bx = halfCoefficients(f, a, M, false).c, By = halfCoefficients(h, b, M, false).c, lam = (m, n) => speed * PI * Math.hypot(m / a, n / b);
  const terms = [];
  for (let m = 1; m <= M; m++) for (let n = 1; n <= M; n++) { const B = Bx[m] * By[n]; if (Math.abs(B) > 1e-12) terms.push([m, n, B, lam(m, n)]); }
  const u = (x, y, t) => { let s = 0; for (const [m, n, B, l] of terms) s += B * Math.cos(l * t) * Math.sin(m * PI * x / a) * Math.sin(n * PI * y / b); return s; };
  let zmax = 1e-9;
  for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++) zmax = Math.max(zmax, Math.abs(u(i / 20 * a, j / 20 * b, 0)));
  return { a, b, M, Bx, By, terms, lam, u, zmax, base: lam(1, 1) };
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
  const L = positive(cfg, 'L', 'L'), f = fnOf(cfg, 'f', '함수 f(x)', L), N = cfg.N;
  const R = { L, f, N, series: seriesOf(cfg, f, L) };
  R.view = { x: rangeOf(cfg, 'xMin', 'xMax', '그래프 가로 범위', L), y: rangeOf(cfg, 'yMin', 'yMax', '그래프 세로 범위', L) };
  const X = anyInfinite(cfg) ? positive(cfg, 'X', '범위 X', L) : 0;
  if (cfg.on.wave) {
    const speed = positive(cfg, 'c', '파동 속도 c', L), g = fnOf(cfg, 'g', '초기 속도 g(x)', L), tSet = optionalPositive(cfg, 'tEndWave', '현 끝 시간', L);
    const k = real(cfg, 'damping', '감쇠 k', L);
    if (k < 0) throw new Error('감쇠 k: 0 이상이어야 합니다.');
    if (cfg.waveDomain === 'finite') boundedOn(g, 0, L, '초기 속도 g(x)'); else boundedOn(g, -X, X, '초기 속도 g(x)');
    if (cfg.waveDomain === 'finite') {
      const free = cfg.waveEnds === 'free', T = 2 * L / speed, times = [];
      const model = free || k > 0 ? stringModel(f, g, L, N, speed, k, free) : buildPde('wave', 'fixed', f, g, { L, N, speed, alpha: 1 });
      const tEnd = tSet ?? 2 * T;
      for (let i = 0; i <= 40; i++) times.push(i / 40 * tEnd);
      R.wave = { ...model, L, speed, T, g, tEnd, damping: k, free, yr: scanRange(model.u, [0, L], times) };
    } else {
      const tEnd = tSet ?? X / speed, model = buildPde('wave', 'infinite', f, g, { speed, X, tEnd, alpha: 1 });
      R.wave = { ...model, X, speed, g, tEnd, restWave: String(cfg.g).trim() === '0', yr: scanRange(model.u, [-X, X], [0, tEnd / 4, tEnd / 2, tEnd]) };
    }
  }
  if (cfg.on.membrane) {
    const b = positive(cfg, 'b', '막의 세로 길이 b', L), h = (() => { let c; try { c = compile(String(cfg.h).replace(/\by\b/g, 'x').replace(/\bb\b/g, 'L')); } catch (e) { throw new Error(`처음 모양 h(y): ${e.message}`); } const P = { ...cfg.params, L: b }; return y => c.fn(y, P); })();
    boundedOn(h, 0, b, '처음 모양 h(y)');
    R.membrane = { ...membraneModel(f, h, L, b, Math.max(1, Math.min(20, cfg.M)), R.wave.speed), h };
    R.membrane.tEnd = 4 * L / R.wave.speed;
  }
  if (cfg.on.transform) R.transform = integralModel(f, positive(cfg, 'X', '범위 X', L), positive(cfg, 'wMax', '적분의 위끝 a', L));
  if (cfg.on.heat) {
    const alpha = positive(cfg, 'alpha', '열확산계수 c²', L), tSet = optionalPositive(cfg, 'tEndHeat', '막대 끝 시간', L);
    if (cfg.heatDomain === 'finite') {
      const left = cfg.bc === 'fixed' ? real(cfg, 'left', '왼쪽 끝 온도') : 0, right = cfg.bc === 'fixed' ? real(cfg, 'right', '오른쪽 끝 온도') : 0;
      const model = buildPde('heat', cfg.bc, f, () => 0, { L, N, alpha, speed: 1, left, right }), tEnd = tSet ?? 3 / model.rate(1);
      R.heat = { ...model, L, alpha, left, right, tEnd, range: [0, L], yr: scanRange(model.u, [0, L], [0, tEnd / 20, tEnd]) };
    } else {
      const tEnd = tSet ?? X * X / (18 * alpha), model = buildPde('heat', 'infinite', f, () => 0, { alpha, X, tEnd, speed: 1 });
      let total = 0; const q = 4000, span = X + 6 * Math.sqrt(alpha * tEnd), h = 2 * span / q;
      for (let i = 0; i < q; i++) total += f(-span + (i + .5) * h) * h;
      R.heat = { ...model, X, alpha, tEnd, total, yr: scanRange(model.u, [-X, X], [0]) };
    }
  }
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
const halfDomain = cfg => cfg.on.half || needsHalf(cfg);
const toPieces = (f, cfg) => { const p = piecesOf(f); return p && p.length > 1 ? p : [{ until: halfDomain(cfg) ? 'L/2' : '0', expr: f }, { until: null, expr: f }]; };
/** 함수를 문서용 글로 씁니다. 구간별이면 구간마다 식과 범위를 씁니다. */
function fMarkup(cfg) {
  const rows = piecewiseRows(cfg, halfDomain(cfg));
  if (rows && rows.length > 1) return rows.map((r, i) => `${i ? '' : '$f(x) = $ '}$${polyTex(r.poly)}$ ($${piTex(r.lo)} \\le x < ${piTex(r.hi)}$)`).join(', ');
  const pieces = piecesOf(cfg.f), pe = s => prettyExpr(s, cfg.params);
  if (!pieces || pieces.length === 1) return `$f(x) = ${pe(cfg.f)}$`;
  const bounds = [halfDomain(cfg) ? '0' : '−L', ...pieces.slice(0, -1).map(p => pe(p.until)), 'L'];
  return pieces.map((p, i) => `${i ? '' : '$f(x) = $ '}$${pe(p.expr)}$ ($${bounds[i]} \\le x < ${bounds[i + 1]}$)`).join(', ');
}
