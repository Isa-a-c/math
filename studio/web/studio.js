'use strict';
/* 공업수학 시각화: 함수 하나를 입력하고 개념 나무에서 개념을 고르면 그래프가 그 개념으로 바뀝니다.
   예제(문제·풀이·그림)는 사용자가 직접 만들고 고치며, 개념 설명도 고칠 수 있습니다. 모두 Word로 출력하고 파일로 저장합니다.
   계산은 math.js, 그리기는 plot.js, 수식 표기와 Word 파일은 docx.js, 개념 나무와 설명은 concepts.js입니다. */
const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const DEFAULTS = {
  f: 'sign(x)', L: 'pi', N: 9, params: {},
  on: { series: true, coef: false, spectrum: false, gibbs: false, half: false, wave: false, heat: false },
  fMode: 'single', pieces: [],   // 구간별 입력이면 pieces로 f를 만듭니다.
  coefKind: 'b', coefN: 1, halfMode: 'sine',
  waveDomain: 'finite', g: '0', c: '1',
  heatDomain: 'finite', alpha: '0.1', bc: 'fixed', left: '0', right: '0',   // alpha는 교재의 c²(열확산계수)입니다.
  X: '8', s: 0,
  xMin: '', xMax: '', yMin: '', yMax: '', tEndWave: '', tEndHeat: '',      // 비우면 자동
};
const SHEET = { title: '공업수학 예제', subtitle: '', concept: true, graph: true, solution: true, student: false, space: '8' };
const copy = v => JSON.parse(JSON.stringify(v));
const mergeCfg = c => ({ ...copy(DEFAULTS), ...(c ?? {}), on: { ...DEFAULTS.on, ...(c?.on ?? {}) }, params: { ...(c?.params ?? {}) } });
const emptyDraft = () => ({ items: [], figures: [], editing: null, custom: false, dirty: false });
const S = {
  cfg: copy(DEFAULTS), good: null, R: null, dirty: true, playing: false, rate: 1, last: 0, paramKey: '', panelKey: '', tab: 'summary', lastTab: '',
  draft: emptyDraft(), saved: [], edits: {}, sheet: copy(SHEET), editingConcept: null,
  zoom: null, pin: null, tool: 'view', ink: {}, marks: {}, frames: {}, hover: null, drawingKey: '', noSave: false, fakeDownload: false,
  ready: false, knownParams: new Set(), statusAct: null, undoCfg: null, tourStep: -1,
};

/* ── 값 읽기 ───────────────────────────────────────── */
function positive(cfg, key, label) { try { return constant(cfg[key]); } catch (e) { throw new Error(`${label}: ${e.message}`); } }
function real(cfg, key, label, L = 1) {
  let c;
  try { c = compile(String(cfg[key])); } catch (e) { throw new Error(`${label}: ${e.message}`); }
  const value = c.params.length ? NaN : c.fn(0, { L });
  if (!isFinite(value)) throw new Error(`${label}: 숫자를 입력하십시오.`);
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
const anyInfinite = cfg => (cfg.on.wave && cfg.waveDomain === 'infinite') || (cfg.on.heat && cfg.heatDomain === 'infinite');

/* ── 계산 ─────────────────────────────────────────── */
function scanRange(fn, xr, times) {
  let lo = Infinity, hi = -Infinity;
  for (const t of times) for (let i = 0; i <= 120; i++) { const y = fn(xr[0] + i / 120 * (xr[1] - xr[0]), t); if (y < lo) lo = y; if (y > hi) hi = y; }
  if (!isFinite(lo) || !isFinite(hi)) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.');
  const pad = Math.max(.05, .15 * (hi - lo));
  return [lo - pad, hi + pad];
}
/** 설정 하나로 모든 개념의 결과를 계산합니다. */
function compute(cfg) {
  const L = positive(cfg, 'L', 'L'), f = fnOf(cfg, 'f', '함수 f(x)', L), N = cfg.N;
  const R = { L, f, N, series: buildSeries(f, L, cfg.on.half ? cfg.halfMode : 'full', 0) };
  R.view = { x: rangeOf(cfg, 'xMin', 'xMax', '그래프 가로 범위', L), y: rangeOf(cfg, 'yMin', 'yMax', '그래프 세로 범위', L) };
  const X = anyInfinite(cfg) ? positive(cfg, 'X', '범위 X') : 0;
  if (cfg.on.wave) {
    const speed = positive(cfg, 'c', '파동 속도 c'), g = fnOf(cfg, 'g', '초기 속도 g(x)', L), tSet = optionalPositive(cfg, 'tEndWave', '현 끝 시간', L);
    if (cfg.waveDomain === 'finite') {
      const model = buildPde('wave', 'fixed', f, g, { L, N, speed, alpha: 1 }), T = 2 * L / speed, times = [];
      for (let i = 0; i <= 40; i++) times.push(i / 40 * T);
      R.wave = { ...model, L, speed, T, g, tEnd: tSet ?? 2 * T, yr: scanRange(model.u, [0, L], times) };
    } else {
      const tEnd = tSet ?? X / speed, model = buildPde('wave', 'infinite', f, g, { speed, X, tEnd, alpha: 1 });
      R.wave = { ...model, X, speed, g, tEnd, restWave: String(cfg.g).trim() === '0', yr: scanRange(model.u, [-X, X], [0, tEnd / 4, tEnd / 2, tEnd]) };
    }
  }
  if (cfg.on.heat) {
    const alpha = positive(cfg, 'alpha', '열확산계수 c²'), tSet = optionalPositive(cfg, 'tEndHeat', '막대 끝 시간', L);
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
  const ternary = s.match(/^([^?]+)\?([^:]+):(.+)$/);
  if (ternary) return `${prettyExpr(ternary[2])} (${prettyExpr(ternary[1])}), ${prettyExpr(ternary[3])} (그 외)`;
  return s.replace(/\bpi\b/g, 'π').replace(/(\d)\s*\*\s*(\d)/g, '$1·$2').replace(/\s*\*\s*/g, '').replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/sqrt\(/g, '√(').replace(/-/g, '−').replace(/\s*([<>])\s*/g, ' $1 ');
}
const lengthText = cfg => prettyExpr(cfg.L);

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
  const pieces = piecesOf(cfg.f), pe = s => prettyExpr(s, cfg.params);
  if (!pieces || pieces.length === 1) return `$f(x) = ${pe(cfg.f)}$`;
  const bounds = [halfDomain(cfg) ? '0' : '−L', ...pieces.slice(0, -1).map(p => pe(p.until)), 'L'];
  return pieces.map((p, i) => `${i ? '' : '$f(x) = $ '}$${pe(p.expr)}$ ($${bounds[i]} \\le x < ${bounds[i + 1]}$)`).join(', ');
}

/* ── 그리기 ───────────────────────────────────────── */
const box = (w, h, C) => { const l = 42 * C.scale; return { l, t: 8, w: w - l - 22, h: h - 14 - 16 * C.scale }; };
const piTicks = (xr, L = PI, step = L / 2) => { const out = [], n = Math.ceil((xr[1] - xr[0]) / step); const st = n > 14 ? step * Math.ceil(n / 12) : step; for (let k = Math.ceil(xr[0] / st); k * st <= xr[1] + 1e-9; k++) out.push([k * st, piLabel(k * st, L)]); return out; };
const stacked = (w, h, C, share = .5) => { const gap = 6 + 16 * C.scale, full = box(w, h, C), top = (full.h - gap) * share; return [{ ...full, h: top }, { ...full, t: full.t + top + gap, h: full.h - top - gap }]; };
/** 가로 범위: 마우스로 확대·이동한 범위 → 설정의 가로 범위 → 기본 범위 순서입니다. */
const rangeX = (base, R) => S.zoom?.panel === S.drawingKey ? S.zoom.xr : R.view?.x ?? base;
const rangeY = (base, R) => R.view?.y ?? base;
const breaksOf = (model, xr) => { const out = [], p = 2 * model.L; for (const j of model.jumps) for (let k = -40; k <= 40; k++) { const v = j.x + k * p; if (v > xr[0] && v < xr[1]) out.push(v); } return out; };
function drawArea(ctx, b, C, xr, L, product, breaks) {
  let lo = 0, hi = 0;
  for (let i = 0; i <= 400; i++) { const y = product(xr[0] + i / 400 * (xr[1] - xr[0])); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const pad = Math.max(.08, .12 * (hi - lo)), M = axes(ctx, b, xr, [lo - pad, hi + pad], C, { xTicks: piTicks(xr, L) });
  const zero = M.Y(0), cols = Math.ceil(b.w);
  for (let i = 0; i < cols; i++) { const x = xr[0] + (i + .5) / cols * (xr[1] - xr[0]), y = product(x), py = M.Y(y); ctx.fillStyle = y >= 0 ? C.pos : C.neg; ctx.fillRect(b.l + i, Math.min(py, zero), 1.02, Math.abs(py - zero)); }
  curve(ctx, product, b, xr, M, C.ink2, 1.5, breaks);
  return M;
}
/** 차수별 막대입니다. N보다 큰 차수는 흐리게, 고정한 결과는 테두리만 그립니다. */
function bars(ctx, b, C, sets, N, refSets = []) {
  const top = Math.min(30, Math.max(12, N)), xr = [.4, top + .6], ticks = [], every = top > 20 ? 5 : 2;
  let peak = 1e-9;
  for (const [, value] of [...sets, ...refSets]) for (let n = 1; n <= top; n++) peak = Math.max(peak, Math.abs(value(n)));
  for (let n = every; n <= top; n += every) ticks.push([n, String(n)]);
  const yr = [-peak * 1.15, peak * 1.15], M = axes(ctx, b, xr, yr, C, { xTicks: ticks });
  const width = Math.max(1.5, b.w / top * .7 / sets.length);
  for (let n = 1; n <= top; n++) {
    sets.forEach(([color, value], i) => {
      const y = value(n), x = M.X(n) + (i - (sets.length - 1) / 2) * width;
      ctx.globalAlpha = n > N ? .25 : 1; ctx.fillStyle = color;
      ctx.fillRect(x - width / 2, Math.min(M.Y(y), M.Y(0)), width, Math.abs(M.Y(y) - M.Y(0)));
    });
    refSets.forEach(([color, value], i) => {
      const y = value(n), x = M.X(n) + (i - (refSets.length - 1) / 2) * width;
      ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
      ctx.strokeRect(x - width / 2, Math.min(M.Y(y), M.Y(0)), width, Math.abs(M.Y(y) - M.Y(0))); ctx.setLineDash([]);
    });
  }
  ctx.globalAlpha = 1;
  return { xr, yr };
}
const mix = (p, q, t) => p.map((v, i) => Math.round(v + (q[i] - v) * t));
/** 위치(가로)와 시간(세로)에 따른 온도를 색으로 그리고 현재 시간에 선을 긋습니다. */
function spacetime(ctx, b, C, model, t) {
  const xr = model.range, M = axes(ctx, b, xr, [0, model.tEnd], C, { xTicks: piTicks(xr, model.L, model.L / 4) });
  if (!model.map) {
    const W = 200, H = 80, off = document.createElement('canvas'); off.width = W; off.height = H;
    const c = off.getContext('2d'), image = c.createImageData(W, H), [lo, hi] = model.yr;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const y = model.u(xr[0] + (i + .5) / W * (xr[1] - xr[0]), (1 - (j + .5) / H) * model.tEnd), s = Math.max(0, Math.min(1, (y - lo) / (hi - lo || 1)));
      const rgb = s < .5 ? mix([31, 95, 208], [246, 246, 246], s * 2) : mix([246, 246, 246], [207, 74, 18], s * 2 - 1), k = 4 * (j * W + i);
      image.data[k] = rgb[0]; image.data[k + 1] = rgb[1]; image.data[k + 2] = rgb[2]; image.data[k + 3] = 255;
    }
    c.putImageData(image, 0, 0); model.map = off;
  }
  ctx.drawImage(model.map, b.l, b.t, b.w, b.h);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.l, M.Y(t)); ctx.lineTo(b.l + b.w, M.Y(t)); ctx.stroke();
}
const fx = '<i>f</i>(<i>x</i>)', uxt = '<i>u</i>(<i>x</i>, <i>t</i>)', pinLabel = t => ['--green', `고정: ${t}`, true];
/** 개념마다 그래프 한 칸입니다. ref는 고정한 결과(같은 칸이면 겹쳐 그림)입니다.
    draw는 제목, 범례, 좌표(frame: 마우스 위치 → x), 값 읽기(probe)를 돌려줍니다. */
const PANELS = {
  series(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, L = model.L, half = cfg.on.half, xr = rangeX([-1.5 * L, 1.5 * L], R), pad = Math.max(.25, .2 * model.span), yr = rangeY([model.lo - pad, model.hi + pad], R), b = box(w, h, C);
    const M = axes(ctx, b, xr, yr, C, { band: half ? [0, L] : [-L, L], xTicks: piTicks(xr, L) });
    curve(ctx, model.f, b, xr, M, C.ink, 2.5, breaksOf(model, xr));
    if (ref) curve(ctx, x => partialSum(ref.R.series, ref.cfg.N, x), b, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => partialSum(model, cfg.N, x), b, xr, M, C.blue, 3);
    return { title: half ? `${cfg.halfMode === 'cosine' ? '우함수' : '기함수'} 확장과 부분합` : 'Fourier 급수의 부분합', frame: { b, xr, yr },
      legend: [['--ink', half ? `${fx}의 확장` : fx], ['--blue', `<i>S</i><sub>${cfg.N}</sub>`], ['--band', half ? '주어진 구간 (0, <i>L</i>)' : '한 주기', 'fill'], ...(ref ? [pinLabel(`<i>S</i><sub>${ref.cfg.N}</sub>`)] : [])],
      probe: x => [['f', model.f(x)], [`S${cfg.N}`, partialSum(model, cfg.N, x)], ...(ref ? [[`고정 S${ref.cfg.N}`, partialSum(ref.R.series, ref.cfg.N, x)]] : [])] };
  },
  coef(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, L = model.L, n = cfg.coefN, xr = rangeX([-L, L], R), trig = k => k === 'b' ? Math.sin : Math.cos, basis = x => trig(cfg.coefKind)(n * PI / L * x), breaks = breaksOf(model, xr), [p, q] = stacked(w, h, C), pad = Math.max(.25, .15 * model.span);
    const yr = rangeY([Math.min(model.lo, -1) - pad, Math.max(model.hi, 1) + pad], R), M = axes(ctx, p, xr, yr, C, { xTicks: piTicks(xr, L), noXLabels: true });
    curve(ctx, basis, p, xr, M, C.blue, 2, [], [8, 5]); curve(ctx, model.f, p, xr, M, C.ink, 2.5, breaks);
    const Mq = drawArea(ctx, q, C, xr, L, x => model.f(x) * basis(x), breaks);
    if (ref) { const rb = x => trig(ref.cfg.coefKind)(ref.cfg.coefN * PI / ref.R.L * x); curve(ctx, x => ref.R.series.f(x) * rb(x), q, xr, Mq, C.green, 2, [], [7, 5]); }
    return { title: `계수 ${cfg.coefKind}${n}: 곱한 곡선의 넓이`, frame: { b: p, xr, yr },
      legend: [['--ink', fx], ['--blue', `${cfg.coefKind === 'b' ? 'sin' : 'cos'} ${argOf(n, L).replace('x', '<i>x</i>')}`, true], ['--pos-fill', '더하는 넓이', 'fill'], ['--neg-fill', '빼는 넓이', 'fill'], ...(ref ? [pinLabel(`${ref.cfg.coefKind}${ref.cfg.coefN}의 곱`)] : [])],
      probe: x => [['f', model.f(x)], ['파동', basis(x)], ['곱', model.f(x) * basis(x)]] };
  },
  spectrum(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, b = box(w, h, C);
    const fr = bars(ctx, b, C, [[C.hot, n => model.a[n]], [C.blue, n => model.b[n]]], cfg.N, ref ? [[C.green, n => ref.R.series.a[n]], [C.green, n => ref.R.series.b[n]]] : []);
    const at = x => Math.max(1, Math.min(NMAX, Math.round(x)));
    return { title: '차수별 계수', frame: { b, ...fr }, legend: [['--hot', '<i>a<sub>n</sub></i>', 'fill'], ['--blue', '<i>b<sub>n</sub></i>', 'fill'], ...(ref ? [pinLabel('계수')] : [])],
      probe: x => [['n', at(x)], [`a${at(x)}`, model.a[at(x)]], [`b${at(x)}`, model.b[at(x)]]] };
  },
  gibbs(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, J = model.jumps[0], b = box(w, h, C);
    if (!J) { axes(ctx, b, [-1, 1], [-1, 1], C, { noXLabels: true }); panelText(ctx, '이 함수에는 도약이 없습니다.', b.l + b.w / 2, b.t + b.h / 2 - 8, C, 'center'); return { title: '도약점 확대', legend: [], frame: { b, xr: [-1, 1], yr: [-1, 1] }, probe: () => [] }; }
    const reach = model.L / PI, xr = rangeX([J.x - reach, J.x + reach], R), size = Math.abs(J.right - J.left), yr = rangeY([Math.min(J.left, J.right) - .25 * size, Math.max(J.left, J.right) + .25 * size], R);
    const M = axes(ctx, b, xr, yr, C, {});
    curve(ctx, model.f, b, xr, M, C.ink, 2.5, breaksOf(model, xr));
    if (ref) curve(ctx, x => partialSum(ref.R.series, ref.cfg.N, x), b, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => partialSum(model, cfg.N, x), b, xr, M, C.blue, 3);
    vline(ctx, M.X(J.x), b, C.hot); dot(ctx, M.X(J.x), M.Y((J.left + J.right) / 2), C.hot, C, 6);
    return { title: `도약점 x = ${piLabel(J.x, model.L)} 확대`, frame: { b, xr, yr }, legend: [['--ink', fx], ['--blue', `<i>S</i><sub>${cfg.N}</sub>`], ['--hot', '두 극한의 평균'], ...(ref ? [pinLabel(`<i>S</i><sub>${ref.cfg.N}</sub>`)] : [])],
      probe: x => [['f', model.f(x)], [`S${cfg.N}`, partialSum(model, cfg.N, x)]] };
  },
  wave(ctx, w, h, C, cfg, R, ref) {
    const W = R.wave, t = timeOf(W, cfg), b = box(w, h, C), finite = cfg.waveDomain === 'finite', xr = rangeX(finite ? [0, W.L] : [-W.X, W.X], R), yr = rangeY(W.yr, R);
    const M = axes(ctx, b, xr, yr, C, finite ? { xTicks: piTicks(xr, W.L, W.L / 4) } : {});
    curve(ctx, R.f, b, xr, M, C.muted, 1.5, [], [6, 5]);
    if (!finite && W.restWave) { curve(ctx, x => W.right(x, t), b, xr, M, C.hot, 1.5, [], [3, 4]); curve(ctx, x => W.leftw(x, t), b, xr, M, C.green, 1.5, [], [3, 4]); }
    const refW = ref?.R.wave;
    if (refW) curve(ctx, x => refW.u(x, timeOf(refW, cfg)), b, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => W.u(x, t), b, xr, M, C.blue, 3, [], null, finite ? 1 : 2);
    return { title: finite ? `현의 진동  t = ${fmt(t, 3)}` : `무한히 긴 현  t = ${fmt(t, 3)}`, frame: { b, xr, yr },
      legend: [['--blue', uxt], ['--muted', '처음 모양', true], ...(!finite && W.restWave ? [['--hot', '오른쪽 파동', true], ['--green', '왼쪽 파동', true]] : []), ...(refW ? [pinLabel(uxt)] : [])],
      probe: x => [['u', W.u(x, t)], ['처음', R.f(x)]] };
  },
  heat(ctx, w, h, C, cfg, R, ref) {
    const H = R.heat, t = timeOf(H, cfg), finite = cfg.heatDomain === 'finite', refH = ref?.R.heat;
    if (!finite) {
      const b = box(w, h, C), xr = rangeX([-H.X, H.X], R), yr = rangeY(H.yr, R), M = axes(ctx, b, xr, yr, C, {});
      curve(ctx, R.f, b, xr, M, C.muted, 1.5, [], [6, 5]);
      if (refH) curve(ctx, x => refH.u(x, timeOf(refH, cfg)), b, xr, M, C.green, 2.5, [], [7, 5], 2);
      curve(ctx, x => H.u(x, t), b, xr, M, C.hot, 3, [], null, S.playing ? 4 : 2);
      return { title: `무한 막대  t = ${fmt(t, 3)}`, frame: { b, xr, yr }, legend: [['--hot', uxt], ['--muted', '처음 온도', true], ...(refH ? [pinLabel(uxt)] : [])], probe: x => [['u', H.u(x, t)], ['처음', R.f(x)]] };
    }
    const [p, q] = stacked(w, h, C, .55), xr = rangeX([0, H.L], R), yr = rangeY(H.yr, R), M = axes(ctx, p, xr, yr, C, { xTicks: piTicks(xr, H.L, H.L / 4), noXLabels: true });
    curve(ctx, R.f, p, xr, M, C.muted, 1.5, [], [6, 5]);
    const end = cfg.bc === 'fixed' ? H.steady : () => H.mean;
    curve(ctx, end, p, xr, M, C.green, 2, [], [3, 4]);
    if (refH) curve(ctx, x => refH.u(x, timeOf(refH, cfg)), p, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => H.u(x, t), p, xr, M, C.hot, 3);
    spacetime(ctx, q, C, H, t);
    return { title: `막대의 온도  t = ${fmt(t, 3)} (아래: 위치·시간별 온도)`, frame: { b: p, xr, yr },
      legend: [['--hot', uxt], ['--muted', '처음 온도', true], ['--green', cfg.bc === 'fixed' ? '정상 상태' : '평균 온도', true], ...(refH ? [pinLabel(uxt)] : [])],
      probe: x => [['u', H.u(x, t)], [cfg.bc === 'fixed' ? '정상 상태' : '평균', end(x)]] };
  },
};
/** 체크한 개념 중 그래프가 있는 것입니다(그림을 담지 않은 예제의 Word 그림). */
const panelIds = cfg => ['series', 'coef', 'spectrum', 'gibbs', 'wave', 'heat'].filter(id => cfg.on[id]);
const deepestOf = cfg => [...CONCEPTS].reverse().find(c => cfg.on[c.id])?.id ?? 'series';
/** 화면의 그래프: 고른 개념(경로의 가장 깊은 개념)입니다. 반구간 전개는 급수 그래프를 확장으로 바꿉니다. */
const viewOf = cfg => { const d = deepestOf(cfg); return d === 'half' ? 'series' : d; };
const conceptOf = id => CONCEPTS.find(c => c.id === id);
function legendHtml(items) { return items.map(([c, t, kind]) => `<span><b class="sw ${kind === true ? 'dashed' : kind || ''}" style="--c:var(${c})"></b><span class="lt">${t}</span></span>`).join(''); }

/* ── 요약 ─────────────────────────────────────────── */
const m = s => `<span class="m">${s}</span>`;
const symHtml = model => model.sym === 'odd' ? '기함수이므로 aₙ = 0인 사인 급수입니다.' : model.sym === 'even' ? '우함수이므로 bₙ = 0인 코사인 급수입니다.' : '대칭이 없어 사인 항과 코사인 항이 모두 나옵니다.';
/** 화면 아래 '요약' 탭의 줄입니다. 시간이 있는 개념은 현재 시간의 값을 씁니다. */
function summary(cfg, R) {
  const out = [], model = R.series, J = model.jumps[0];
  out.push(['Fourier 급수', `${symHtml(model)} ${m(`<i>f</i>(<i>x</i>) ≈ ${termsText(seriesTerms(model))}`)}, 항 ${cfg.N}개의 제곱오차 ${m(`<i>E</i>* = ${errText(squareError(model, cfg.N))}`)}`]);
  if (cfg.on.coef) { const v = fineCoef(model, cfg.coefKind, cfg.coefN), e = exact(v); out.push(['계수의 의미', `곱한 곡선의 넓이 ${m(fmt(v * model.L, 4))}를 ${m('<i>L</i>')}로 나누면 ${m(`<i>${cfg.coefKind}</i><sub>${cfg.coefN}</sub> ${e.sure ? '=' : '≈'} ${e.text}`)}입니다.${Math.abs(v) < 1e-6 * Math.max(model.span, 1e-9) ? ' 넓이가 상쇄되어 이 파동은 함수에 없습니다.' : ''}`]); }
  if (cfg.on.spectrum) { const p = decayPower(model); out.push(['계수 크기', p === null ? decayWords(p) : `계수가 약 ${m(`1/<i>n</i><sup>${fmt(p, 1)}</sup>`)}로 줄어듭니다. ${decayWords(p)}`]); }
  if (cfg.on.gibbs) out.push(['수렴과 도약', J ? `${m(`<i>x</i> = ${piLabel(J.x, model.L)}`)}에서 합은 평균 ${m(fmt((J.left + J.right) / 2, 3))}, ${m(`<i>S</i><sub>${cfg.N}</sub> = ${fmt(partialSum(model, cfg.N, J.x), 4)}`)}입니다. 봉우리 초과량은 도약의 ${m(`${(overshoot(model, J, cfg.N) * 100).toFixed(1)}%`)}입니다.` : '도약이 없어 모든 점에서 f(x)로 수렴합니다.']);
  if (cfg.on.half) out.push(['반구간 전개', `(0, L)의 함수를 ${cfg.halfMode === 'cosine' ? '우함수로 확장해 코사인' : '기함수로 확장해 사인'} 항만 남겼습니다.${needsHalf(cfg) ? ' 현·막대의 해가 이 전개를 씁니다.' : ''}`]);
  if (cfg.on.wave) {
    const W = R.wave, t = timeOf(W, cfg);
    if (cfg.waveDomain === 'finite') {
      const ends = Math.max(Math.abs(R.f(0)), Math.abs(R.f(R.L)));
      out.push(['현의 진동', `주기 ${m(`2<i>L</i>/<i>c</i> = ${fmt(W.T, 4)}`)}, 기본 각진동수 ${m(`<i>λ</i><sub>1</sub> = ${coefText(W.omega(1))}`)}. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.${ends > 1e-6 ? ' 초기 변위가 양 끝에서 0이 아니어서 끝점 부근에서 급수가 함수와 다릅니다.' : ''}`]);
    } else out.push(['무한히 긴 현', `초기 모양이 절반씩 나뉘어 속도 ${m(fmt(W.speed, 3))}로 양쪽으로 갑니다. 지금 ${m(`<i>t</i> = ${fmt(t, 3)}`)}.`]);
  }
  if (cfg.on.heat) {
    const H = R.heat, t = timeOf(H, cfg);
    if (cfg.heatDomain === 'finite') out.push(['막대의 열전도', `${cfg.bc === 'fixed' ? (H.left === H.right ? `막대 전체가 ${m(fmt(H.left, 3))}으로 고르게 됩니다.` : `양 끝 ${m(fmt(H.left, 3))}, ${m(fmt(H.right, 3))}을 잇는 직선으로 갑니다.`) : `평균 온도 ${m(fmt(H.mean, 4))}로 고르게 됩니다.`} 첫 모드 감쇠율 ${m(`<i>λ</i><sub>1</sub>² = ${fmt(H.rate(1), 4)}`)}, 가운데 온도 ${m(fmt(H.u(H.L / 2, t), 4))} (${m(`<i>t</i> = ${fmt(t, 3)}`)}).`]);
    else { let peak = -Infinity; for (let i = 0; i <= 200; i++) peak = Math.max(peak, H.u(-H.X + i / 100 * H.X, t)); out.push(['무한 막대', `퍼짐의 표준편차 ${m(`√(2<i>c</i>²<i>t</i>) = ${fmt(Math.sqrt(2 * H.alpha * t), 3)}`)}, 최고 온도 ${m(fmt(peak, 4))}, 전체 열량 ${m(fmt(H.total, 4))}은 그대로입니다.`]); }
  }
  return out;
}

/* ── 예제: 소문항의 종류, 자동 문장, 자동 풀이 (글은 $…$ 수식 표기) ── */
const KINDS = {
  series: { label: '급수 구하기', concept: 'series' },
  inverse: { label: '역문제 (급수 → 함수)', concept: 'series' },
  graph: { label: '그래프 읽기', concept: 'series' },
  coef: { label: '계수의 값과 의미', concept: 'coef' },
  spectrum: { label: '계수 크기', concept: 'spectrum' },
  gibbs: { label: '도약점과 Gibbs 현상', concept: 'gibbs' },
  wave: { label: '현의 해', concept: 'wave' },
  heat: { label: '막대의 해', concept: 'heat' },
  free: { label: '자유 문항', concept: null },
};
const newItem = kind => ({ kind, text: '', edited: false, auto: kind !== 'free', note: '', points: '' });
const autoItems = cfg => ['series', ...['coef', 'spectrum', 'gibbs', 'wave', 'heat'].filter(k => cfg.on[k])].map(newItem);
const missing = kind => { const c = KINDS[kind].concept; return `(이 소문항에 필요한 개념 '${conceptOf(c).title}'이 꺼져 있습니다. 개념을 켜거나 문장을 직접 쓰십시오.)`; };
const symMarkup = model => model.sym === 'odd' ? '기함수이므로 $a_n = 0$인 사인 급수입니다.' : model.sym === 'even' ? '우함수이므로 $b_n = 0$인 코사인 급수입니다.' : '대칭이 없어 사인 항과 코사인 항이 모두 나옵니다.';
const firstNonzero = (get, count, tol) => { const out = []; for (let n = 1; n <= NMAX && out.length < count; n++) if (Math.abs(get(n)) >= tol) out.push(n); return out; };
const valueEq = (name, pairs) => `$$${pairs.map(([n, v]) => { const e = exact(v); return `${name}_{${n}} ${rel(e)} ${e.text}`; }).join(',\\quad ')},\\ \\ldots$$`;
const EXACT_NOTE = '= 로 적은 값은 수치 적분 결과와 맞는 정확한 꼴이고, ≈ 로 적은 값은 근삿값입니다. 출제 전에 확인하십시오.';
/** 소문항의 자동 문장입니다. */
function problemText(kind, cfg, R) {
  const c = KINDS[kind].concept;
  if (c && c !== 'series' && !cfg.on[c]) return missing(kind);
  const model = R.series, Ls = lengthText(cfg), half = cfg.on.half, J = model.jumps[0];
  switch (kind) {
    case 'series': return half ? `${fMarkup(cfg)}를 반구간 ${cfg.halfMode === 'cosine' ? '코사인' : '사인'} 급수로 전개하시오. (길이 $L = ${Ls}$)` : `주기가 $2L$ ($L = ${Ls}$)인 함수 ${fMarkup(cfg)}의 Fourier 급수를 구하시오.`;
    case 'inverse': return `어떤 함수의 Fourier 급수가 $${termsText(seriesTerms(model, 4))}$일 때, 이 함수 $f(x)$를 구간 $${half ? '0' : '−L'} < x < L$에서 구하고 그래프를 그리시오. ($L = ${Ls}$)`;
    case 'graph': return `그림은 함수 $f(x)$와 Fourier 급수의 부분합 $S_N(x)$의 그래프이다. 그림에서 $N$의 값을 구하고, ${J ? '도약점에서 부분합이 지나는 값을 읽으시오.' : '부분합이 함수와 가장 크게 다른 곳을 찾으시오.'}`;
    case 'coef': return `계수 $${cfg.coefKind}_{${cfg.coefN}}$을 함수와 파동을 곱한 곡선의 넓이로 해석하고 그 값을 구하시오.`;
    case 'spectrum': return '계수의 크기가 $n$에 따라 줄어드는 빠르기를 구하고, 함수의 매끄러움과 연결하여 설명하시오.';
    case 'gibbs': return J ? `도약점 $x = ${piLabel(J.x, model.L)}$에서 급수의 합을 구하고, $N = ${cfg.N}$일 때 도약점 옆 봉우리의 초과량을 구하시오.` : '이 함수의 급수가 모든 점에서 $f(x)$로 수렴하는 이유를 설명하시오.';
    case 'wave': {
      const g = prettyExpr(cfg.g, cfg.params), cs = prettyExpr(cfg.c);
      return cfg.waveDomain === 'finite' ? `길이 $L = ${Ls}$, 파동 속도 $c = ${cs}$인 현의 양 끝이 고정되어 있다. 초기 변위가 $f(x)$, 초기 속도가 $g(x) = ${g}$일 때 변위 $u(x,t)$를 구하시오.`
        : `무한히 긴 현($c = ${cs}$)의 초기 변위가 $f(x)$, 초기 속도가 $g(x) = ${g}$일 때 $u(x,t)$를 구하시오.`;
    }
    case 'heat': {
      const a = prettyExpr(cfg.alpha);
      if (cfg.heatDomain === 'infinite') return `무한히 긴 막대($c^2 = ${a}$)의 초기 온도가 $f(x)$일 때 $u(x,t)$를 적분 꼴로 쓰고, 시간에 따른 변화를 설명하시오.`;
      if (cfg.bc === 'fixed') return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 양 끝 온도를 $U_1 = ${prettyExpr(cfg.left)}$, $U_2 = ${prettyExpr(cfg.right)}$로 유지한다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 정상 상태를 구하시오.`;
      return `길이 $L = ${Ls}$, $c^2 = ${a}$인 막대의 양 끝이 단열되어 있다. 초기 온도가 $f(x)$일 때 $u(x,t)$와 도달하는 온도를 구하시오.`;
    }
    default: return '';
  }
}
/** 소문항의 자동 풀이입니다. 계수는 촘촘한 적분으로 구한 값이며, 닫힌 꼴이 있으면 그 꼴로 씁니다. */
function solutionText(kind, cfg, R) {
  const c = KINDS[kind].concept;
  if (c && c !== 'series' && !cfg.on[c]) return missing(kind);
  const model = R.series, tol = 1e-6 * Math.max(model.span, 1e-9), Ls = lengthText(cfg), out = [], J = model.jumps[0];
  const coefLines = () => {
    if (Math.abs(model.a0) >= tol) { const e = exact(fineCoef(model, 'a0')); out.push(`$$a_0 ${rel(e)} ${e.text}$$`); }
    const an = firstNonzero(n => model.a[n], 5, tol), bn = firstNonzero(n => model.b[n], 5, tol);
    if (an.length) out.push(valueEq('a', an.map(n => [n, fineCoef(model, 'a', n)])));
    if (bn.length) out.push(valueEq('b', bn.map(n => [n, fineCoef(model, 'b', n)])));
    out.push(EXACT_NOTE);
  };
  switch (kind) {
    case 'series':
      out.push(symMarkup(model));
      if (cfg.on.half) out.push(cfg.halfMode === 'cosine' ? String.raw`$$a_0 = \frac{1}{L}\int_{0}^{L} f(x)\,dx,\quad a_n = \frac{2}{L}\int_{0}^{L} f(x)\cos\frac{n\pi x}{L}\,dx$$` : String.raw`$$b_n = \frac{2}{L}\int_{0}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$`);
      else out.push(String.raw`$$a_0 = \frac{1}{2L}\int_{-L}^{L} f(x)\,dx,\quad a_n = \frac{1}{L}\int_{-L}^{L} f(x)\cos\frac{n\pi x}{L}\,dx,\quad b_n = \frac{1}{L}\int_{-L}^{L} f(x)\sin\frac{n\pi x}{L}\,dx$$`);
      out.push(`$L = ${Ls}$을 넣어 계산하면 다음과 같습니다.`);
      coefLines();
      out.push(`$$f(x) \\approx ${termsText(seriesTerms(model, 5))}$$`);
      out.push(`항 ${cfg.N}개까지의 제곱오차는 $E^* = ${errText(squareError(model, cfg.N))}$입니다.`);
      break;
    case 'inverse':
      out.push(`주어진 계수는 ${fMarkup(cfg)}의 Fourier 계수입니다. ${symMarkup(model)}`);
      coefLines();
      break;
    case 'graph':
      out.push(`그림의 부분합은 $N = ${cfg.N}$입니다.`);
      out.push(J ? `도약점 $x = ${piLabel(J.x, model.L)}$에서 부분합은 두 극한 ${fmt(J.left, 4)}, ${fmt(J.right, 4)}의 평균인 ${fmt((J.left + J.right) / 2, 4)}을 지납니다.` : `제곱오차는 $E^* = ${errText(squareError(model, cfg.N))}$입니다.`);
      break;
    case 'coef': { const v = fineCoef(model, cfg.coefKind, cfg.coefN), e = exact(v); out.push(`곱한 곡선의 넓이는 ${fmt(v * model.L, 4)}이고, 이를 $L$로 나누면 $${cfg.coefKind}_{${cfg.coefN}} ${rel(e)} ${e.text}$입니다. ${Math.abs(v) < tol ? '넓이가 상쇄되어 이 파동은 함수에 들어 있지 않습니다.' : '넓이가 한쪽으로 쌓일수록 이 파동의 비중이 큽니다.'}`); break; }
    case 'spectrum': { const p = decayPower(model); out.push(p === null ? decayWords(p) : `계수의 포락선이 $1/n^{${fmt(p, 1)}}$처럼 줄어듭니다. ${decayWords(p)}`); break; }
    case 'gibbs':
      out.push(J ? `$x = ${piLabel(J.x, model.L)}$에서 왼쪽 극한 ${fmt(J.left, 4)}, 오른쪽 극한 ${fmt(J.right, 4)}이므로 급수의 합은 평균 ${fmt((J.left + J.right) / 2, 4)}입니다. $N = ${cfg.N}$일 때 봉우리 초과량은 도약 크기의 ${(overshoot(model, J, cfg.N) * 100).toFixed(1)}%이며, $N$을 늘려도 약 9%로 남습니다(Gibbs 현상).` : '함수가 연속이고 구분적으로 매끄러워 모든 점에서 $f(x)$로 수렴합니다.');
      break;
    case 'wave': {
      const W = R.wave;
      if (cfg.waveDomain !== 'finite') { out.push(String.raw`D’Alembert 해 $u = \frac{1}{2}[f(x+ct) + f(x-ct)] + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$` + `에 $c = ${fmt(W.speed, 3)}$을 넣습니다. 초기 모양의 절반이 속도 ${fmt(W.speed, 3)}로 오른쪽과 왼쪽으로 이동하며, 모양은 변하지 않습니다.`); break; }
      const Bn = firstNonzero(n => fineHalf(R.f, R.L, n, false), 4, tol), Vn = firstNonzero(n => fineHalf(W.g, R.L, n, false), 4, tol);
      out.push(`변수분리로 $\\lambda_n = cn\\pi/L = ${coefText(W.omega(1))}n$이고, 계수는 초기 변위와 초기 속도의 반구간 사인 계수에서 나옵니다.`);
      if (Bn.length) out.push(valueEq('B', Bn.map(n => [n, fineHalf(R.f, R.L, n, false)])));
      if (Vn.length) out.push(valueEq('B^*', Vn.map(n => [n, fineHalf(W.g, R.L, n, false) / W.omega(n)])));
      out.push(EXACT_NOTE);
      const terms = Bn.slice(0, 3).map(n => [fineHalf(R.f, R.L, n, false), `cos ${coefText(W.omega(n))}t · sin ${argOf(n, R.L)}`]);
      if (terms.length) out.push(`$$u(x,t) \\approx ${termsText(terms)}$$`);
      out.push(`현은 주기 $2L/c = ${fmt(W.T, 4)}$로 처음 모양으로 돌아옵니다.`);
      break;
    }
    case 'heat': {
      const H = R.heat;
      if (cfg.heatDomain !== 'finite') { out.push(String.raw`열핵과의 합성곱 $u(x,t) = \frac{1}{2c\sqrt{\pi t}}\int_{-\infty}^{\infty} f(v)\exp(-\frac{(x-v)^2}{4c^2 t})\,dv$` + `에 $c^2 = ${fmt(H.alpha, 4)}$를 넣습니다. 열은 표준편차 $\\sqrt{2c^2 t}$로 퍼지고, 전체 열량 ${fmt(H.total, 4)}은 변하지 않습니다.`); break; }
      if (cfg.bc === 'fixed') {
        const v = x => R.f(x) - H.steady(x), Bn = firstNonzero(n => fineHalf(v, R.L, n, false), 4, tol);
        out.push(`정상 상태는 $U(x) = ${fmt(H.left, 4)} + ${fmt(H.right - H.left, 4)}x/L$이고, $f - U$의 반구간 사인 계수가 $B_n$입니다. 감쇠율은 $\\lambda_n^2 = c^2(n\\pi/L)^2 = ${fmt(H.rate(1), 4)}n^2$입니다.`);
        if (Bn.length) out.push(valueEq('B', Bn.map(n => [n, fineHalf(v, R.L, n, false)])));
        out.push(`첫 모드가 절반으로 줄어드는 시간은 $\\ln 2/\\lambda_1^2 = ${fmt(Math.LN2 / H.rate(1), 4)}$입니다.`);
      } else {
        const An = firstNonzero(n => fineHalf(R.f, R.L, n, true), 4, tol);
        const e0 = exact(fineHalf(R.f, R.L, 0, true));
        out.push(`단열 조건에서는 코사인 급수가 나오고, 온도는 평균 $A_0 ${rel(e0)} ${e0.text}$으로 갑니다.`);
        if (An.length) out.push(valueEq('A', An.map(n => [n, fineHalf(R.f, R.L, n, true)])));
      }
      break;
    }
    default: break;
  }
  return out.join('\n\n');
}
const solutionOf = (it, cfg, R) => [it.auto && it.kind !== 'free' ? solutionText(it.kind, cfg, R) : '', it.note].filter(x => String(x ?? '').trim()).join('\n\n');
/** 소문항 글을 문서 조각으로 바꾸고 번호와 배점을 붙입니다. */
function itemBlocks(markup, k, points = '') {
  const blocks = markupBlocks(markup), label = B(`(${k + 1}) `), tail = String(points).trim() ? [` (${String(points).trim()}점)`] : [];
  if (blocks[0]?.k === 'p') blocks[0] = DOC.p(label, ...blocks[0].seg, ...tail);
  else blocks.unshift(DOC.p(label, ...tail));
  return blocks;
}
/** 자동 문장을 지금 설정에 맞춥니다. 사용자가 고친 문장은 그대로 둡니다. 소문항 구성을 바꾸지 않았으면 켠 개념에 맞춰 다시 짭니다. */
function syncDraft() {
  if (!S.good || !S.R) return;
  if (!S.draft.custom) {
    const kinds = autoItems(S.good).map(it => it.kind), old = S.draft.items;
    S.draft.items = kinds.map(kind => old.find(it => it.kind === kind) ?? newItem(kind));
  }
  for (const it of S.draft.items) if (!it.edited && it.kind !== 'free') it.text = problemText(it.kind, S.good, S.R);
}

/* ── 저장: 프로그램 안(자동)과 파일(예제 모음) ───────── */
const STORE = 'lectureStudio.v1';
const stateData = () => ({ v: 1, cfg: S.cfg, draft: S.draft, saved: S.saved, edits: S.edits, sheet: S.sheet });
const cleanExample = e => ({ cfg: mergeCfg(e?.cfg), items: Array.isArray(e?.items) ? e.items.map(it => ({ ...newItem(KINDS[it.kind] ? it.kind : 'free'), ...it })) : [], figures: Array.isArray(e?.figures) ? e.figures.filter(f => PANELS[f?.panel]).map(f => ({ size: 'mid', caption: '', zoom: null, ...f, cfg: mergeCfg(f.cfg) })) : [] });
function applyState(d) {
  if (!d || d.v !== 1) return false;
  S.cfg = mergeCfg(d.cfg);
  S.draft = { ...emptyDraft(), ...cleanExample(d.draft), editing: Number.isInteger(d.draft?.editing) ? d.draft.editing : null, custom: !!d.draft?.custom };
  S.saved = Array.isArray(d.saved) ? d.saved.map(cleanExample) : [];
  S.edits = d.edits && typeof d.edits === 'object' ? { ...d.edits } : {};
  S.sheet = { ...copy(SHEET), ...(d.sheet ?? {}) };
  if (S.draft.editing !== null && !S.saved[S.draft.editing]) S.draft.editing = null;
  return true;
}
let saveTimer = 0;
/** 바뀐 내용을 프로그램 안에 저장합니다(다음 실행에 그대로 열림). */
function persist() {
  if (S.noSave) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(stateData())); } catch { /* 저장 공간을 쓸 수 없으면 건너뜁니다 */ } }, 300);
}
function restore() { try { return applyState(JSON.parse(localStorage.getItem(STORE) ?? 'null')); } catch { return false; } }
const libraryText = () => JSON.stringify({ kind: 'lecture-studio-library', version: 1, saved: S.saved, edits: S.edits, sheet: S.sheet }, null, 1);
/** 예제 모음 파일을 읽어 담은 예제에 더하고, 고친 개념 설명과 문제지 양식을 가져옵니다. */
function importLibrary(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('예제 모음 파일을 읽을 수 없습니다.'); }
  if (d?.kind !== 'lecture-studio-library') throw new Error('예제 모음 파일이 아닙니다.');
  const list = (Array.isArray(d.saved) ? d.saved : []).map(cleanExample);
  S.saved.push(...list);
  if (d.edits && typeof d.edits === 'object') Object.assign(S.edits, d.edits);
  if (d.sheet && typeof d.sheet === 'object') S.sheet = { ...S.sheet, ...d.sheet };
  return list.length;
}
function download(blob, name) {
  if (S.fakeDownload) { S.lastDownload = name; return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
let statusTimer = 0;
/** 화면 아래 가운데에 알림을 띄웁니다. action({label, fn})을 주면 단추가 함께 나옵니다. */
function setStatus(text, action = null) {
  $('status').innerHTML = `${esc(text)}${action ? ` <button type="button" class="mini" id="statusAct">${esc(action.label)}</button>` : ''}`;
  S.statusAct = action?.fn ?? null;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { $('status').innerHTML = ''; S.statusAct = null; }, action ? 12000 : 7000);
}
/* 프로그램 창(app.py)이 파일을 저장한 뒤 부릅니다. */
window.studioSaved = (path, opened) => setStatus(opened === false ? `저장했습니다: ${path} (이 PC에서 Word 문서를 열 프로그램을 찾지 못했습니다. 파일은 저장되었습니다.)` : `저장했습니다: ${path}`);

/* ── Word 출력 ─────────────────────────────────────── */
const conceptMarkup = id => S.edits[id] ?? CONCEPT_MARKUP[id];
const FIG_WIDTH = { small: .55, mid: .8, large: 1 };
/** 그림 하나를 흰 배경으로 그립니다. 그림을 담을 때의 설정·시간·확대 범위를 그대로 씁니다. */
function figureImage(fig) {
  const cfg = mergeCfg(fig.cfg), R = compute(cfg), canvas = $('exportCanvas'), theme = document.documentElement.dataset.theme, zoom = S.zoom, key = S.drawingKey;
  document.documentElement.dataset.theme = 'light';
  S.drawingKey = 'export'; S.zoom = fig.zoom ? { panel: 'export', xr: fig.zoom } : null;
  try {
    const C = themeColors(), { ctx, w, h } = prepare(canvas);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const meta = PANELS[fig.panel](ctx, w, h, C, cfg, R, null);
    return { png: canvas.toDataURL('image/png'), caption: String(fig.caption ?? '').trim() || `${meta.title} (${meta.legend.map(([, t]) => t.replace(/<[^>]+>/g, '')).join(', ')})`, ratio: h / w, width: FIG_WIDTH[fig.size] ?? .8 };
  } finally { document.documentElement.dataset.theme = theme; S.zoom = zoom; S.drawingKey = key; }
}
const currentExample = () => ({ cfg: copy({ ...S.good, s: S.cfg.s }), items: copy(S.draft.items), figures: copy(S.draft.figures) });
/** 개념 설명, 문제, 그림, 풀이를 문서 조각으로 모읍니다. 담은 예제가 없으면 지금 만드는 예제를 씁니다. */
function exportBlocks() {
  const list = S.saved.length ? S.saved : [currentExample()], o = S.sheet, blocks = [];
  if (o.concept) {
    blocks.push(DOC.h1('개념 정리'));
    for (const c of CONCEPTS) if (list.some(e => e.cfg.on[c.id])) blocks.push(DOC.h2(`${c.title} (${c.ch})`), ...markupBlocks(conceptMarkup(c.id)));
  }
  list.forEach((e, i) => {
    const cfg = mergeCfg(e.cfg), R = compute(cfg), items = e.items.length ? e.items : autoItems(cfg).map(it => ({ ...it, text: problemText(it.kind, cfg, R) }));
    blocks.push(DOC.h1(`예제 ${i + 1}`));
    items.forEach((it, k) => blocks.push(...itemBlocks(it.text || (it.kind === 'free' ? '' : problemText(it.kind, cfg, R)), k, it.points)));
    if (o.graph) {
      const figs = e.figures.length ? e.figures : panelIds(cfg).map(panel => ({ panel, cfg, size: 'mid' }));
      for (const fig of figs) { const img = figureImage(fig); blocks.push(DOC.fig(img.png, img.caption, img.ratio, img.width)); }
    }
    if (o.solution) { blocks.push(DOC.h2('풀이')); items.forEach((it, k) => blocks.push(...itemBlocks(solutionOf(it, cfg, R) || '(풀이 없음)', k))); }
    else if (+o.space) blocks.push(DOC.gap(+o.space));
  });
  return blocks;
}
const docOptions = () => ({ subtitle: S.sheet.subtitle.trim(), student: !!S.sheet.student });
/** 담은 예제가 있는데 지금 예제를 담지 않았거나 고친 내용을 저장하지 않았으면 먼저 묻습니다. */
function exportWord(force = false) {
  if (!S.good) return;
  if (!force && S.saved.length && S.draft.dirty) {
    $('choiceMsg').textContent = S.draft.editing !== null ? `예제 ${S.draft.editing + 1}에서 고친 내용을 아직 저장하지 않았습니다.` : '지금 만드는 예제는 아직 담지 않아 Word에 들어가지 않습니다.';
    $('choiceAdd').textContent = S.draft.editing !== null ? '저장하고 출력' : '이 예제도 담고 출력';
    $('exportChoice').hidden = false;
    $('exportChoice').scrollIntoView({ block: 'nearest' });
    setStatus("Word로 출력하기 전에 확인할 것이 있습니다. 왼쪽 'Word로 출력' 아래를 보십시오.");
    return;
  }
  $('exportChoice').hidden = true;
  try {
    const title = S.sheet.title.trim() || '공업수학 예제', doc = buildDocx(title, exportBlocks(), docOptions());
    S.lastDoc = doc;
    download(doc.blob, `${title}.docx`);
  } catch (e) { setStatus(`Word로 출력하지 못했습니다: ${e.message}`); }
}

/* ── 개념 나무와 수업 흐름 ─────────────────────────── */
/** 바로 위 개념입니다. 유한한 현·막대는 반구간 전개 위에, 무한히 긴 현·막대는 Fourier 급수 바로 위에 있습니다. */
function parentOf(id, cfg) {
  if (id === 'wave' || id === 'heat') return (id === 'wave' ? cfg.waveDomain : cfg.heatDomain) === 'finite' ? 'half' : 'series';
  return conceptOf(id).parent ?? null;
}
const pathTo = (id, cfg) => { const out = []; for (let k = id; k; k = parentOf(k, cfg)) out.push(k); return out; };
const FLOW = CONCEPTS.map(c => c.id);   // 수업 순서
/** 개념 하나를 고릅니다. Fourier 급수에서 그 개념까지의 경로만 켜지고 다른 갈래는 해제됩니다. */
function select(id) {
  const cfg = S.cfg, path = new Set(pathTo(id, cfg));
  for (const k of Object.keys(cfg.on)) cfg.on[k] = path.has(k);
  if (id === 'wave' && cfg.waveDomain === 'finite') cfg.halfMode = 'sine';
  if (id === 'heat' && cfg.heatDomain === 'finite') cfg.halfMode = cfg.bc === 'insulated' ? 'cosine' : 'sine';
}
/** 체크하면 그 개념을 고르고, 해제하면 바로 위 개념으로 돌아갑니다(아래 개념도 함께 해제). */
function toggle(id, on) { if (id !== 'series') select(on ? id : parentOf(id, S.cfg)); }
/** 체크로 다른 개념이 함께 켜지거나 꺼졌으면 알려 줍니다. */
function noticeChanges(before, target) {
  const names = ids => ids.map(k => `'${conceptOf(k).title}'`).join(', ');
  const on = Object.keys(S.cfg.on).filter(k => S.cfg.on[k] && !before[k] && k !== target), off = Object.keys(S.cfg.on).filter(k => !S.cfg.on[k] && before[k] && k !== target);
  const text = [on.length ? `바탕 개념 ${names(on)}도 켰습니다.` : '', off.length ? `${names(off)}은(는) ${S.cfg.on[target] ? '다른 갈래라서' : '바탕 개념이 꺼져'} 껐습니다.` : ''].filter(Boolean).join(' ');
  if (text) setStatus(text);
}
function step(dir) {
  const i = FLOW.indexOf(deepestOf(S.cfg)), j = Math.max(0, Math.min(FLOW.length - 1, i + dir));
  if (j === i) return;
  select(FLOW[j]); S.tab = 'concept'; S.lastTab = '';
  renderSettings(); recompute();
}

/* ── 설정 화면 ─────────────────────────────────────── */
const hintOf = cfg => halfDomain(cfg) ? '(0, L)에서의 함수. 예: x*(L-x), sin(pi*x/L), sin x' : '예: x^2, sign(x), abs(x), 2 sin x + 1';
const SUB = {
  coef: () => [{ k: 'coefKind', type: 'seg', label: '구할 계수', options: [['b', 'bₙ (사인)'], ['a', 'aₙ (코사인)']] }, { k: 'coefN', type: 'range', label: '차수 n', min: 1, max: 20 }],
  half: () => [{ k: 'halfMode', type: 'seg', label: '확장', options: [['cosine', '우함수 (코사인)'], ['sine', '기함수 (사인)']] }],
  wave: () => [{ k: 'waveDomain', type: 'seg', label: '현', options: [['finite', '양 끝 고정'], ['infinite', '무한히 긴 현']] }, { k: 'g', type: 'text', label: '초기 속도 g(x)', hint: '0이면 정지 상태에서 시작합니다.' }, { k: 'c', type: 'text', label: '파동 속도 c' }],
  heat: cfg => [{ k: 'heatDomain', type: 'seg', label: '막대', options: [['finite', '유한 막대'], ['infinite', '무한 막대']] }, { k: 'alpha', type: 'text', label: '열확산계수 c²', hint: '열방정식 u_t = c² u_xx의 c² 값' },
    ...(cfg.heatDomain === 'finite' ? [{ k: 'bc', type: 'seg', label: '양 끝', options: [['fixed', '온도 고정'], ['insulated', '단열']] }] : []),
    ...(cfg.heatDomain === 'finite' && cfg.bc === 'fixed' ? [{ k: 'left', type: 'text', label: '왼쪽 끝 온도' }, { k: 'right', type: 'text', label: '오른쪽 끝 온도' }] : [])],
};
function fieldHtml(field, cfg) {
  const { k, label, hint } = field, id = `f_${k}`;
  if (field.type === 'seg') return `<div class="fld"><span class="flabel">${label}</span><div class="seg">${field.options.map(([value, text]) => `<button type="button" data-seg="${k}" data-value="${value}" aria-pressed="${cfg[k] === value}">${text}</button>`).join('')}</div></div>`;
  if (field.type === 'range') return `<div class="fld"><label class="flabel" for="${id}">${label}<output id="${id}_out">${cfg[k]}</output></label><input id="${id}" type="range" data-field="${k}" data-num="1" min="${field.min}" max="${field.max}" value="${cfg[k]}"></div>`;
  return `<div class="fld"><label class="flabel" for="${id}">${label}</label><input class="tf" id="${id}" type="text" spellcheck="false" autocomplete="off" data-field="${k}" value="${esc(cfg[k])}">${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
}
/** 입력한 함수를 교재처럼 보여 줍니다. 구간별이면 중괄호로 나눕니다. */
function previewHtml(cfg) {
  const pieces = piecesOf(cfg.f), node = s => tex(prettyExpr(s)).h;
  if (!pieces || pieces.length === 1) return `<span class="m"><i>f</i>(<i>x</i>) = ${node(cfg.f)}</span>`;
  const bounds = [halfDomain(cfg) ? '0' : '−L', ...pieces.slice(0, -1).map(p => p.until), 'L'];
  return `<span class="m"><i>f</i>(<i>x</i>) =</span><span class="cases"><span class="brace">{</span><span class="rows">${pieces.map((p, i) => `<span><span class="m">${node(p.expr)}</span><em class="m">${node(bounds[i])} ≤ <i>x</i> &lt; ${node(bounds[i + 1])}</em></span>`).join('')}</span></span>`;
}
function renderPreview() {
  const el = $('fPreview');
  if (!el) return;
  try { compile(S.cfg.f); el.innerHTML = previewHtml(S.cfg); } catch { el.innerHTML = '<span class="hint">식을 다 입력하면 여기에 보입니다.</span>'; }
}
function fHtml(cfg) {
  const mode = fieldHtml({ k: 'fMode', type: 'seg', label: '함수 f(x)', options: [['single', '식 하나'], ['pieces', '구간별']] }, cfg);
  if (cfg.fMode !== 'pieces') return `${mode}<div class="fld"><input class="tf" id="f_f" type="text" spellcheck="false" autocomplete="off" data-field="f" aria-label="함수 f(x)" value="${esc(cfg.f)}"><span class="hint">${esc(hintOf(cfg))}</span></div><div class="preview" id="fPreview"></div>`;
  const last = cfg.pieces.length - 1;
  const rows = cfg.pieces.map((p, i) => i < last
    ? `<div class="piece"><span>x &lt;</span><input class="tf until" type="text" spellcheck="false" autocomplete="off" data-piece="${i}" data-part="until" aria-label="${i + 1}번 구간의 끝" value="${esc(p.until)}"><span>이면</span><input class="tf" type="text" spellcheck="false" autocomplete="off" data-piece="${i}" data-part="expr" aria-label="${i + 1}번 구간의 식" value="${esc(p.expr)}"><button type="button" class="x" data-unpiece="${i}" aria-label="${i + 1}번 구간 빼기">×</button></div>`
    : `<div class="piece"><span>그 외</span><input class="tf" type="text" spellcheck="false" autocomplete="off" data-piece="${i}" data-part="expr" aria-label="마지막 구간의 식" value="${esc(p.expr)}"></div>`).join('');
  return `${mode}<div class="fld"><span class="hint">구간 ${halfDomain(cfg) ? '0' : '−L'} ~ L을 왼쪽부터 나눕니다. 식에는 sin x, 2x처럼 써도 됩니다.</span>${rows}<button type="button" class="btn" id="addPiece">+ 구간 추가</button></div><div class="preview" id="fPreview"></div>`;
}
function renderSettings() {
  const cfg = S.cfg, base = [{ k: 'L', type: 'text', label: halfDomain(cfg) ? '길이 L' : '반주기 L (주기의 절반)', hint: halfDomain(cfg) ? 'pi, 2, 1/2처럼 씁니다.' : 'pi, 2, 1/2처럼 씁니다. 주기가 2π이면 pi' }, { k: 'N', type: 'range', label: '항의 개수 N (부분합에 더할 항)', min: 1, max: 100 }, ...(anyInfinite(cfg) ? [{ k: 'X', type: 'text', label: '무한 영역에서 보이는 범위 X' }] : [])];
  $('baseFields').innerHTML = fHtml(cfg) + base.map(f => fieldHtml(f, cfg)).join('');
  renderPreview();
  S.panelKey = '';   // 목록을 다시 그렸으므로 '그래프에 보이는 개념' 표시도 다시 붙입니다.
  $('conceptList').innerHTML = CONCEPTS.map(c => {
    const depth = pathTo(c.id, cfg).length - 1, locked = c.id === 'series';
    return `<div class="concept ${cfg.on[c.id] ? 'on' : ''}" data-id="${c.id}" style="--d:${depth}"><label class="ck"><input type="checkbox" data-concept="${c.id}" ${cfg.on[c.id] ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${c.title}</span><small>${c.ch}${locked ? ' · 기본' : ''}</small></label>${cfg.on[c.id] && SUB[c.id] ? `<div class="sub">${SUB[c.id](cfg).map(f => fieldHtml(f, cfg)).join('')}</div>` : ''}</div>`;
  }).join('');
  for (const k of ['xMin', 'xMax', 'yMin', 'yMax', 'tEndWave', 'tEndHeat']) if (document.activeElement !== $(`f_${k}`)) $(`f_${k}`).value = cfg[k] ?? '';
  renderParams(true);
  const i = FLOW.indexOf(deepestOf(cfg));
  $('stepLabel').textContent = `${i + 1} / ${FLOW.length}  ${CONCEPTS[i].title}`;
  $('prevStep').disabled = i <= 0; $('nextStep').disabled = i >= FLOW.length - 1;
}
/** 수식에 새 글자를 쓰면 그 글자의 값을 넣는 칸이 생깁니다. */
function renderParams(force) {
  const cfg = S.cfg, names = new Set();
  for (const key of ['f', ...(cfg.on.wave ? ['g'] : [])]) { try { compile(String(cfg[key])).params.forEach(p => names.add(p)); } catch { /* 입력 중인 수식 */ } }
  const list = [...names], fresh = list.filter(p => !S.knownParams.has(p));
  for (const p of list) if (!(p in cfg.params)) cfg.params[p] = 1;
  if (!force && fresh.length) setStatus(`수식의 ${fresh.map(p => `'${p}'`).join(', ')}를 변수로 만들었습니다(값 ${fresh.map(p => cfg.params[p]).join(', ')}). 오타라면 수식을 고치십시오.`);
  S.knownParams = new Set(list);
  const key = list.join(',');
  if (!force && key === S.paramKey) return;
  S.paramKey = key;
  $('paramFields').innerHTML = list.map(p => `<div class="fld"><label class="flabel" for="p_${p}">수식의 변수 ${p}</label><input class="tf" id="p_${p}" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" data-param="${p}" value="${cfg.params[p]}"></div>`).join('');
}
function renderSheet() {
  for (const el of $$('[data-sheet]')) { const v = S.sheet[el.dataset.sheet]; if (el.type === 'checkbox') el.checked = !!v; else if (document.activeElement !== el) el.value = v ?? ''; }
}
function renderSaved() {
  $('savedList').innerHTML = S.saved.map((e, i) => `<li class="${S.draft.editing === i ? 'editing' : ''}"><span>${i + 1}. ${esc(prettyExpr(e.cfg.f, e.cfg.params))} · 소문항 ${e.items.length} · 그림 ${e.figures.length}</span><span class="acts"><button type="button" class="mini" data-edit="${i}">고치기</button><button type="button" class="x" data-smove="${i}" data-dir="-1" aria-label="${i + 1}번 위로">↑</button><button type="button" class="x" data-smove="${i}" data-dir="1" aria-label="${i + 1}번 아래로">↓</button><button type="button" class="x" data-unsave="${i}" aria-label="${i + 1}번 빼기">×</button></span></li>`).join('');
  $('savedCount').textContent = S.saved.length ? `담은 예제 ${S.saved.length}개 (Word에 이 순서로 들어갑니다). 다른 PC로 옮기려면 '예제 모음 저장'을 쓰십시오.` : "담은 예제가 없으면 '예제 만들기'에서 만드는 예제를 출력합니다.";
}
function setSeg(key, value) {
  const cfg = S.cfg;
  if (key === 'fMode') { if (value === 'pieces' && cfg.fMode !== 'pieces') cfg.pieces = toPieces(cfg.f, cfg); cfg.fMode = value; return; }
  cfg[key] = value;
  if (key === 'waveDomain' && cfg.on.wave) select('wave');
  if (key === 'heatDomain' && cfg.on.heat) select('heat');
  if (key === 'bc' && cfg.on.heat && cfg.heatDomain === 'finite') cfg.halfMode = value === 'insulated' ? 'cosine' : 'sine';
}
function showError(text) {
  $('err').textContent = text; $('err').hidden = !text;
  $('graphErr').textContent = text ? `입력을 확인하십시오: ${text} — 그래프는 마지막으로 계산된 결과입니다.` : ''; $('graphErr').hidden = !text;
}
function recompute() {
  try {
    S.R = compute(S.cfg);
    S.good = copy(S.cfg);   // 입력이 잘못되면 그래프는 마지막으로 계산된 설정으로 그립니다.
    showError('');
  } catch (e) { showError(e.message); }
  $('transport').hidden = !(S.good && (S.good.on.wave || S.good.on.heat));
  syncDraft();
  if (S.ready && S.saved.length) S.draft.dirty = true;   // 설정이 바뀌면 지금 예제는 담은 예제와 달라집니다.
  renderTabs(true);
  persist();
  S.dirty = true;
}

/* ── 그래프 칸 ─────────────────────────────────────── */
/** 고정한 결과가 다른 개념의 그래프이면 나란히 보여 줍니다. 같은 개념이면 한 칸에 겹칩니다. */
function panelKeys() { if (!S.good) return []; const v = viewOf(S.good); return S.pin && S.pin.panel !== v ? ['pin', v] : [v]; }
function renderPanels() {
  const keys = panelKeys(), key = keys.join(',');
  for (const el of $$('.concept')) el.classList.toggle('view', !!S.good && el.dataset.id === deepestOf(S.good));
  $('pinBtn').textContent = S.pin ? '고정 해제' : '고정(비교)';
  $('pinBtn').setAttribute('aria-pressed', !!S.pin);
  if (key === S.panelKey) return;
  S.panelKey = key;
  if (S.zoom && !keys.includes(S.zoom.panel)) S.zoom = null;
  $('panels').style.setProperty('--cols', keys.length);
  $('panels').style.setProperty('--rows', 1);
  $('panels').innerHTML = keys.map(k => `<section class="pnl" data-panel="${k}"><header><span class="pt"></span><span class="legend"></span><span class="badges"></span></header><div class="cw"><canvas class="main" role="img"></canvas><canvas class="ov" aria-hidden="true"></canvas></div></section>`).join('');
}
function draw() {
  renderPanels();
  if (!S.R) return;
  const cfg = { ...S.good, s: S.cfg.s }, C = themeColors();
  for (const el of $$('#panels .pnl')) {
    const key = el.dataset.panel, canvas = el.querySelector('canvas.main'), { ctx, w, h } = prepare(canvas);
    ctx.clearRect(0, 0, w, h);
    if (w < 60 || h < 50) continue;
    S.drawingKey = key;
    const meta = key === 'pin' ? PANELS[S.pin.panel](ctx, w, h, C, { ...S.pin.cfg, s: S.cfg.s }, S.pin.R, null) : PANELS[key](ctx, w, h, C, cfg, S.R, S.pin?.panel === key ? S.pin : null);
    if (key === 'pin') meta.title = `고정: ${meta.title}`;
    S.frames[key] = { ...meta.frame, probe: meta.probe };
    el.querySelector('.pt').textContent = meta.title;
    const html = legendHtml(meta.legend), lg = el.querySelector('.legend');
    if (lg.innerHTML !== html) lg.innerHTML = html;
    const badges = `${S.R.view?.x || S.R.view?.y ? '<button type="button" class="badge" data-clearrange title="왼쪽 \'그래프 범위\'에서 정한 범위를 지웁니다">범위 지정됨 ✕</button>' : ''}${S.zoom?.panel === key ? '<button type="button" class="badge" data-unzoom title="확대를 풉니다(더블클릭과 같음)">확대됨 ✕</button>' : ''}`, bg = el.querySelector('.badges');
    if (bg.innerHTML !== badges) bg.innerHTML = badges;
    canvas.setAttribute('aria-label', meta.title);
    drawOverlay(el);
  }
  S.drawingKey = '';
  if (S.tab === 'summary') renderTabs(false);
  $('tOut').textContent = ['wave', 'heat'].filter(id => cfg.on[id]).map(id => `${id === 'wave' ? '현' : '막대'} t = ${fmt(timeOf(S.R[id], cfg), 3)}`).join(' · ');
  $('tSlider').value = S.cfg.s;
}
/** 그래프 위의 펜 자국, 점 표시, 마우스 위치 세로선을 그립니다(그래프와 따로 지웁니다). */
function drawOverlay(el) {
  const key = el.dataset.panel, ov = el.querySelector('canvas.ov'), { ctx, w, h } = prepare(ov), C = themeColors(), f = S.frames[key];
  ctx.clearRect(0, 0, w, h);
  ov.style.pointerEvents = S.tool === 'view' ? 'auto' : 'auto';
  ov.style.cursor = S.tool === 'pen' ? 'crosshair' : S.tool === 'mark' ? 'cell' : S.zoom?.panel === key ? 'grab' : 'default';
  if (!f) return;
  const X = x => f.b.l + (x - f.xr[0]) / (f.xr[1] - f.xr[0]) * f.b.w, Y = y => f.b.t + (f.yr[1] - y) / (f.yr[1] - f.yr[0]) * f.b.h;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const stroke of S.ink[key] ?? []) {
    ctx.strokeStyle = C.hot; ctx.lineWidth = 3; ctx.beginPath();
    stroke.forEach(([px, py], i) => (i ? ctx.lineTo(px * w, py * h) : ctx.moveTo(px * w, py * h)));
    ctx.stroke();
  }
  for (const x of S.marks[key] ?? []) {
    const lines = f.probe(x);
    if (!lines.length) continue;
    const y = lines[0][1], px = X(x), py = Y(y);
    if (!isFinite(px) || !isFinite(py)) continue;
    dot(ctx, px, py, C.hot, C, 5);
    panelText(ctx, `x = ${fmt(x, 3)}, ${lines[0][0]} = ${fmt(y, 4)}`, px + 8, py - 20 * C.scale, C);
  }
  if (S.hover?.key === key && S.tool === 'view') vline(ctx, X(S.hover.x), f.b, C.muted, [2, 3]);
}
const redrawOverlays = () => $$('#panels .pnl').forEach(drawOverlay);
/** 마우스 위치를 그래프의 x로 바꿉니다. */
function xAt(el, clientX) {
  const f = S.frames[el.dataset.panel], r = el.querySelector('canvas.ov').getBoundingClientRect();
  if (!f) return null;
  return f.xr[0] + (clientX - r.left - f.b.l) / f.b.w * (f.xr[1] - f.xr[0]);
}
function showProbe(el, e) {
  const x = xAt(el, e.clientX), f = S.frames[el.dataset.panel], tip = $('probe');
  if (x === null || !f || x < f.xr[0] || x > f.xr[1]) { tip.hidden = true; S.hover = null; return; }
  S.hover = { key: el.dataset.panel, x };
  tip.innerHTML = [`x = ${fmt(x, 3)}`, ...f.probe(x).map(([k, v]) => `${esc(k)} = ${fmt(v, 4)}`)].join('<br>');
  const col = document.querySelector('.plotCol').getBoundingClientRect();
  tip.style.left = `${e.clientX - col.left + 14}px`; tip.style.top = `${e.clientY - col.top + 10}px`;
  tip.hidden = false;
}

/* ── 아래 탭: 요약, 개념, 예제 만들기 ──────────────── */
function conceptTabHtml(cfg) {
  return `<div class="doc">${CONCEPTS.filter(c => cfg.on[c.id]).map(c => {
    const head = `<h3>${c.title} <small>${c.ch}${S.edits[c.id] !== undefined ? ' · 고친 설명' : ''}</small>${S.editingConcept === c.id ? '' : ` <button type="button" class="mini" data-cedit="${c.id}">고치기</button>`}</h3>`;
    if (S.editingConcept === c.id) return `<section class="now">${head}<textarea id="conceptText" rows="12" spellcheck="false">${esc(conceptMarkup(c.id))}</textarea><div class="row"><button type="button" class="btn primary" data-csave="${c.id}">저장</button><button type="button" class="btn" data-creset="${c.id}">기본값으로</button><button type="button" class="btn" data-ccancel>취소</button></div><p class="hint tex">문단은 빈 줄로 나눕니다. $…$는 수식(예: $a_n$, $\\frac{1}{L}$, $\\int_0^L f\\,dx$), $$…$$ 문단은 가운데 수식, '&gt; '로 시작하면 강조 상자, **굵게**입니다.</p></section>`;
    return `<section class="${c.id === deepestOf(cfg) ? 'now' : ''}">${head}${blocksHtml(markupBlocks(conceptMarkup(c.id)))}</section>`;
  }).join('')}</div>`;
}
function exampleTabHtml() {
  const d = S.draft, kinds = Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  const items = d.items.map((it, i) => `<div class="item" data-i="${i}">
    <div class="item-top"><b>(${i + 1})</b><span class="kind">${KINDS[it.kind].label}${it.edited ? ' · 직접 고침' : ''}</span>
      <label class="pts">배점 <input class="tf" type="text" inputmode="numeric" data-ifield="points" data-i="${i}" value="${esc(it.points)}"></label>
      <button type="button" class="x" data-imove="${i}" data-dir="-1" aria-label="위로">↑</button><button type="button" class="x" data-imove="${i}" data-dir="1" aria-label="아래로">↓</button><button type="button" class="x" data-idel="${i}" aria-label="소문항 빼기">×</button></div>
    <textarea class="tf" rows="2" data-ifield="text" data-i="${i}" aria-label="${i + 1}번 문장" placeholder="문장을 쓰십시오. 수식은 $…$">${esc(it.text)}</textarea>
    <div class="item-sol">${it.kind === 'free' ? '' : `<label class="ck small"><input type="checkbox" data-ifield="auto" data-i="${i}" ${it.auto ? 'checked' : ''}>자동 풀이 넣기</label>`}${it.edited && it.kind !== 'free' ? `<button type="button" class="mini" data-irevert="${i}">자동 문장으로</button>` : ''}</div>
    <div class="warnslot">${itemWarn(it, i)}</div>
    <textarea class="tf" rows="1" data-ifield="note" data-i="${i}" aria-label="${i + 1}번 풀이 메모" placeholder="풀이에 덧붙일 설명 (선택)">${esc(it.note)}</textarea></div>`).join('');
  const figs = figuresHtml();
  return exampleBody(d, kinds, items, figs);
}
const SETUP_KEYS = ['f', 'L', 'N', 'params', 'on', 'halfMode', 'coefKind', 'coefN', 'waveDomain', 'g', 'c', 'heatDomain', 'alpha', 'bc', 'left', 'right', 'X'];
/** 그림을 담은 뒤 함수나 개념 설정이 바뀌었는지 봅니다(시간, 확대는 그림마다 다를 수 있어 보지 않습니다). */
const sameSetup = (a, b) => SETUP_KEYS.every(k => JSON.stringify(a?.[k]) === JSON.stringify(b?.[k]));
/** 문장을 직접 고쳤는데 자동 풀이가 켜져 있으면, 풀이가 설정의 함수 기준이라는 것을 알립니다. */
const itemWarn = (it, i) => it.edited && it.auto && it.kind !== 'free' ? `<p class="warn">문장을 직접 고쳤습니다. 자동 풀이는 설정의 함수 ${esc(prettyExpr(S.good?.f ?? '', S.good?.params ?? {}))}로 계산합니다. 문장의 함수나 값이 다르면 <button type="button" class="mini" data-autooff="${i}">자동 풀이 끄기</button> 후 풀이 메모를 쓰십시오.</p>` : '';
function figuresHtml() {
  return S.draft.figures.map((f, i) => `<div class="figrow"><span>그림 ${i + 1}</span><span class="hint">${esc(conceptOf(f.panel === 'series' && f.cfg.on.half ? 'half' : f.panel)?.title ?? f.panel)}</span>
    <input class="tf" type="text" data-ffield="caption" data-f="${i}" placeholder="그림 설명 (비우면 자동)" value="${esc(f.caption)}">
    <select data-ffield="size" data-f="${i}" aria-label="그림 ${i + 1} 크기">${[['small', '작게'], ['mid', '보통'], ['large', '크게']].map(([v, t]) => `<option value="${v}" ${f.size === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <button type="button" class="x" data-fdel="${i}" aria-label="그림 ${i + 1} 빼기">×</button>${S.good && !sameSetup(f.cfg, S.good) ? `<span class="warn">담은 뒤 설정이 바뀜</span><button type="button" class="mini" data-frecap="${i}">지금 설정으로 다시 담기</button>` : ''}</div>`).join('');
}
function exampleBody(d, kinds, items, figs) {
  return `<div class="editor">
    <div class="ed-head"><b>${d.editing === null ? '새 예제' : `예제 ${d.editing + 1} 고치는 중`}</b>
      <select id="addKind" aria-label="소문항 추가"><option value="">+ 소문항 추가</option>${kinds}</select>
      <button type="button" class="btn" id="draftReset">자동 초안으로</button>
      <span class="hint tex">수식은 $…$로 씁니다. 예: $a_n = \\frac{1}{L}\\int_{-L}^{L} f\\cos nx\\,dx$</span></div>
    <div id="items">${items || '<p class="hint">소문항이 없습니다. 위에서 추가하십시오.</p>'}</div>
    <div class="ed-figs"><b>그림</b> <span class="hint">${d.figures.length ? '' : "그래프 위 '그래프 담기'로 지금 장면을 담습니다. 담지 않으면 켠 개념의 그래프가 자동으로 들어갑니다."}</span><div id="edFigs">${figs}</div></div>
    <div class="row"><button type="button" class="btn primary" id="saveExample">${d.editing === null ? '이 예제 담기' : `예제 ${d.editing + 1}에 저장`}</button>${d.editing === null ? '' : '<button type="button" class="btn" id="newExample">새 예제 만들기</button>'}</div>
    <h4>미리보기</h4><div class="doc" id="exPreview"></div></div>`;
}
function renderExamplePreview() {
  const el = $('exPreview');
  if (!el || !S.R || !S.good) return;
  const cfg = S.good, items = S.draft.items;
  try {
    el.innerHTML = `<h3>문제</h3>${items.map((it, k) => blocksHtml(itemBlocks(it.text, k, it.points))).join('')}${S.draft.figures.map((f, i) => `<p class="hint">[그림 ${i + 1}] ${esc(f.caption || '그래프')}</p>`).join('')}<h3>풀이</h3>${items.map((it, k) => blocksHtml(itemBlocks(solutionOf(it, cfg, S.R) || '(풀이 없음)', k))).join('')}`;
  } catch (e) { el.textContent = e.message; }
}
/** 설정이 바뀌면 고치지 않은 문장을 새 값으로 바꿉니다. 입력 중인 칸은 건드리지 않습니다. */
function refreshExample() {
  if ($$('#items .item').length !== S.draft.items.length) { S.lastTab = ''; return renderTabs(true); }
  for (const ta of $$('#items textarea[data-ifield="text"]')) if (document.activeElement !== ta) ta.value = S.draft.items[+ta.dataset.i].text;
  for (const slot of $$('#items .warnslot')) { const i = +slot.closest('.item').dataset.i, html = itemWarn(S.draft.items[i], i); if (slot.innerHTML !== html) slot.innerHTML = html; }
  if ($('edFigs') && !$('edFigs').contains(document.activeElement)) { const html = figuresHtml(); if ($('edFigs').innerHTML !== html) $('edFigs').innerHTML = html; }
  renderExamplePreview();
}
function renderTabs(all) {
  for (const b of $$('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === S.tab);
  $('bottom').classList.toggle('tall', S.tab === 'example' || S.editingConcept !== null);
  if (!S.R || !S.good) { $('tabBody').innerHTML = ''; return; }
  const cfg = { ...S.good, s: S.cfg.s };
  let html;
  if (S.tab === 'summary') html = `<ul class="sumlist">${summary(cfg, S.R).map(([t, line]) => `<li><b>${t}</b> ${line}</li>`).join('')}</ul>`;
  else if (!all) return;
  else if (S.tab === 'concept') { if (S.editingConcept && document.activeElement === $('conceptText')) return; html = conceptTabHtml(cfg); }
  else {
    if (S.lastTab === 'example') return refreshExample();
    $('tabBody').innerHTML = exampleTabHtml(); S.lastTab = 'example'; renderExamplePreview(); return;
  }
  if (S.lastTab !== html) { $('tabBody').innerHTML = html; S.lastTab = html; $('tabBody').querySelector('.now')?.scrollIntoView({ block: 'start' }); }
}
const rerenderTab = () => { S.lastTab = ''; renderTabs(true); };
function saveExample() {
  if (!S.good) return;
  const ex = currentExample();
  if (S.draft.editing !== null && S.saved[S.draft.editing]) { S.saved[S.draft.editing] = ex; setStatus(`예제 ${S.draft.editing + 1}을 저장했습니다.`); }
  else { S.saved.push(ex); setStatus(`예제 ${S.saved.length}을 담았습니다.`); }
  S.draft = emptyDraft(); syncDraft();
  renderSaved(); rerenderTab(); persist();
}
/** 함수와 설정을 처음 상태로 돌립니다. 만든 예제와 고친 설명은 그대로이며, 되돌릴 수 있습니다. */
function resetAll() {
  S.undoCfg = copy(S.cfg);
  S.cfg = copy(DEFAULTS); S.zoom = null; S.pin = null; S.ink = {}; S.marks = {};
  renderSettings(); recompute();
  setStatus('함수와 설정을 처음 상태로 돌렸습니다. 만든 예제와 고친 설명은 그대로입니다.', { label: '되돌리기', fn: () => { S.cfg = S.undoCfg; renderSettings(); recompute(); } });
}
function editSaved(i) {
  const e = S.saved[i];
  S.cfg = mergeCfg(e.cfg);
  S.draft = { items: copy(e.items), figures: copy(e.figures), editing: i, custom: true, dirty: false };
  S.tab = 'example';
  renderSettings(); recompute(); S.draft.dirty = false; rerenderTab(); renderSaved();
}

/* ── 처음 안내와 도움말 ─────────────────────────────── */
const TOUR = [
  ['#baseFields', '함수를 입력합니다', '왼쪽 위에 x^2, sin x, |x|처럼 함수를 씁니다. 구간마다 식이 다르면 "구간별"을 고릅니다. 아래 미리보기로 제대로 들어갔는지 확인합니다.'],
  ['#conceptList', '개념을 고릅니다', '개념은 나무 모양입니다. 체크하면 Fourier 급수에서 그 개념까지 이어진 개념만 켜지고, 그래프가 그 개념으로 바뀝니다. 위쪽 "다음 개념 →"으로 수업 순서대로 진행해도 됩니다.'],
  ['.tools', '그래프를 살펴봅니다', '그래프 위에 마우스를 올리면 값이 보입니다. Ctrl+휠로 확대, 끌어서 이동, 더블클릭으로 원래대로 돌아갑니다. "고정(비교)"은 지금 결과를 남겨 비교하고, 펜과 점으로 수업 중 표시합니다.'],
  ['#bottom', '설명과 예제', '아래 탭에서 요약, 개념 설명, 예제 만들기를 봅니다. 예제 만들기에서 문제 문장, 배점, 풀이 메모를 직접 쓰고 "그래프 담기"로 그림을 넣습니다. 가운데 줄을 끌어 이 칸의 높이를 바꿉니다.'],
  ['#wordBtn', 'Word로 출력합니다', '"이 예제 담기"로 예제를 모은 뒤 "Word로 출력"을 누릅니다. 만든 내용은 자동 저장되며, 다른 PC로 옮길 때는 "예제 모음 저장"을 씁니다. 위쪽 "도움말"에서 언제든 다시 볼 수 있습니다.'],
];
const TOUR_KEY = 'lectureStudio.tourDone';
function showTour(i) {
  $$('.spot').forEach(el => el.classList.remove('spot'));
  if (i < 0 || i >= TOUR.length) { $('tour').hidden = true; S.tourStep = -1; if (!S.noSave) try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* 건너뜀 */ } return; }
  S.tourStep = i;
  const [sel, title, text] = TOUR[i], target = document.querySelector(sel);
  target?.classList.add('spot'); target?.scrollIntoView?.({ block: 'nearest' });
  $('tourStep').textContent = `처음 안내 ${i + 1} / ${TOUR.length}`; $('tourTitle').textContent = title; $('tourText').textContent = text;
  $('tourPrev').disabled = i === 0; $('tourNext').textContent = i === TOUR.length - 1 ? '시작하기' : '다음';
  $('tour').hidden = false;
}
const tourDone = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; } };

/* ── 재생 ─────────────────────────────────────────── */
function setPlaying(on) { S.playing = on; S.last = 0; $('playBtn').setAttribute('aria-pressed', on); $('pauseBtn').setAttribute('aria-pressed', !on && S.cfg.s > 0); }
function tick(dt) { S.cfg.s += dt * S.rate / 12; if (S.cfg.s > 1) S.cfg.s = 0; S.dirty = true; }
function frame(now) {
  if (S.playing && S.R) { if (S.last) tick(Math.min(.1, (now - S.last) / 1000)); S.last = now; }
  if (S.dirty) { S.dirty = false; draw(); }
  requestAnimationFrame(frame);
}

/* ── 입력 ─────────────────────────────────────────── */
const move = (list, i, dir) => { const j = i + dir; if (j < 0 || j >= list.length) return false; [list[i], list[j]] = [list[j], list[i]]; return true; };
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset, draft = S.draft;
  if (d.seg) { setSeg(d.seg, d.value); renderSettings(); return recompute(); }
  if (d.tab) { S.tab = d.tab; S.lastTab = ''; return renderTabs(true); }
  if (d.tool) { S.tool = d.tool; for (const b of $$('[data-tool]')) b.setAttribute('aria-pressed', b.dataset.tool === S.tool); $('probe').hidden = true; S.hover = null; return redrawOverlays(); }
  if (d.unsave !== undefined) { const i = +d.unsave; S.saved.splice(i, 1); if (draft.editing === i) draft.editing = null; else if (draft.editing > i) draft.editing--; renderSaved(); rerenderTab(); return persist(); }
  if (d.smove !== undefined) { const i = +d.smove; if (move(S.saved, i, +d.dir)) { if (draft.editing === i) draft.editing += +d.dir; else if (draft.editing === i + +d.dir) draft.editing = i; } renderSaved(); return persist(); }
  if (d.edit !== undefined) return editSaved(+d.edit);
  if (d.imove !== undefined) { move(draft.items, +d.imove, +d.dir); draft.custom = true; draft.dirty = true; rerenderTab(); return persist(); }
  if (d.idel !== undefined) { draft.items.splice(+d.idel, 1); draft.custom = true; draft.dirty = true; rerenderTab(); return persist(); }
  if (d.irevert !== undefined) { draft.items[+d.irevert].edited = false; draft.dirty = true; syncDraft(); rerenderTab(); return persist(); }
  if (d.fdel !== undefined) { draft.figures.splice(+d.fdel, 1); draft.dirty = true; rerenderTab(); return persist(); }
  if (d.frecap !== undefined) { const f = draft.figures[+d.frecap]; f.panel = S.good.on[f.panel] ? f.panel : viewOf(S.good); f.cfg = copy({ ...S.good, s: S.cfg.s }); f.zoom = null; draft.dirty = true; rerenderTab(); return persist(); }
  if (d.autooff !== undefined) { draft.items[+d.autooff].auto = false; draft.dirty = true; rerenderTab(); return persist(); }
  if (d.clearrange !== undefined) { for (const k of ['xMin', 'xMax', 'yMin', 'yMax']) S.cfg[k] = ''; renderSettings(); return recompute(); }
  if (d.unzoom !== undefined) { S.zoom = null; S.dirty = true; return undefined; }
  if (d.cedit) { S.editingConcept = d.cedit; S.tab = 'concept'; return rerenderTab(); }
  if (d.csave) { S.edits[d.csave] = $('conceptText').value; S.editingConcept = null; rerenderTab(); setStatus('개념 설명을 저장했습니다. Word 출력에도 이 글이 들어갑니다.'); return persist(); }
  if (d.creset) { delete S.edits[d.creset]; S.editingConcept = null; rerenderTab(); return persist(); }
  if (d.ccancel !== undefined) { S.editingConcept = null; return rerenderTab(); }
  if (d.unpiece !== undefined) {
    S.cfg.pieces.splice(+d.unpiece, 1);
    if (S.cfg.pieces.length < 2) { S.cfg.fMode = 'single'; S.cfg.f = S.cfg.pieces[0].expr; } else S.cfg.f = piecesExpr(S.cfg.pieces);
    renderSettings(); return recompute();
  }
  switch (t.id) {
    case 'statusAct': { const fn = S.statusAct; $('status').innerHTML = ''; S.statusAct = null; return fn?.(); }
    case 'choiceAdd': $('exportChoice').hidden = true; saveExample(); return exportWord(true);
    case 'choiceOnly': return exportWord(true);
    case 'choiceCancel': $('exportChoice').hidden = true; return undefined;
    case 'resetBtn': return resetAll();
    case 'helpBtn': $('help').hidden = false; return $('helpClose').focus();
    case 'helpClose': $('help').hidden = true; return undefined;
    case 'tourAgain': $('help').hidden = true; return showTour(0);
    case 'tourNext': return showTour(S.tourStep + 1 >= TOUR.length ? -1 : S.tourStep + 1);
    case 'tourPrev': return showTour(Math.max(0, S.tourStep - 1));
    case 'tourSkip': return showTour(-1);
    case 'addPiece': S.cfg.pieces.splice(S.cfg.pieces.length - 1, 0, { until: 'L/2', expr: '0' }); S.cfg.f = piecesExpr(S.cfg.pieces); renderSettings(); return recompute();
    case 'nextStep': return step(1);
    case 'prevStep': return step(-1);
    case 'playBtn': return setPlaying(true);
    case 'pauseBtn': return setPlaying(false);
    case 'stopBtn': setPlaying(false); S.cfg.s = 0; S.dirty = true; return undefined;
    case 'captureBtn': {
      if (!S.good) return undefined;
      const panel = viewOf(S.good);
      draft.figures.push({ panel, cfg: copy({ ...S.good, s: S.cfg.s }), zoom: S.zoom?.panel === panel ? [...S.zoom.xr] : null, caption: '', size: 'mid' });
      draft.dirty = true;
      setStatus(`그림 ${draft.figures.length}을 예제에 담았습니다. '예제 만들기' 탭에서 설명과 크기를 정합니다.`);
      if (S.tab === 'example') rerenderTab();
      return persist();
    }
    case 'pinBtn': S.pin = S.pin ? null : { cfg: copy(S.good), R: S.R, panel: viewOf(S.good) }; S.panelKey = ''; S.dirty = true; return undefined;
    case 'clearInk': S.ink = {}; S.marks = {}; return redrawOverlays();
    case 'draftReset': S.draft = { ...emptyDraft(), figures: draft.figures, editing: draft.editing, dirty: true }; syncDraft(); rerenderTab(); return persist();
    case 'saveExample': return saveExample();
    case 'newExample': S.draft = emptyDraft(); syncDraft(); rerenderTab(); renderSaved(); return persist();
    case 'wordBtn': return exportWord();
    case 'libSave': download(new Blob([libraryText()], { type: 'application/json' }), `${S.sheet.title.trim() || '공업수학 예제'} 예제 모음.json`); return undefined;
    case 'libOpen': $('libFile').value = ''; return $('libFile').click();
    case 'themeBtn': document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; t.textContent = document.documentElement.dataset.theme === 'dark' ? '밝게' : '어둡게'; S.dirty = true; return undefined;
    case 'bigger': return setSize(.1);
    case 'smaller': return setSize(-.1);
    case 'presentBtn': document.body.classList.toggle('present'); t.textContent = document.body.classList.contains('present') ? '발표 끝내기 (F)' : '발표 모드 (F)'; try { if (document.body.classList.contains('present')) document.documentElement.requestFullscreen?.()?.catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {}); } catch { /* 선택 사항 */ } S.dirty = true; return undefined;
    default: return undefined;
  }
});
let size = 1.1;
function setSize(d) { size = Math.max(.9, Math.min(1.8, +(size + d).toFixed(2))); document.documentElement.style.fontSize = `${16 * size}px`; S.dirty = true; }
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'tSlider') { S.cfg.s = +t.value; S.dirty = true; return; }
  if (d.field) {
    S.cfg[d.field] = d.num ? +t.value : t.value;
    if (d.num) $(`${t.id}_out`).textContent = t.value;
    renderParams(false); renderPreview(); recompute();
  } else if (d.piece !== undefined) {
    S.cfg.pieces[+d.piece][d.part] = t.value; S.cfg.f = piecesExpr(S.cfg.pieces);
    renderParams(false); renderPreview(); recompute();
  } else if (d.param && t.value !== '' && isFinite(+t.value)) { S.cfg.params[d.param] = +t.value; recompute(); }
  else if (d.ifield && t.type !== 'checkbox') {
    const it = S.draft.items[+d.i];
    it[d.ifield] = t.value;
    if (d.ifield === 'text') { it.edited = true; const slot = t.closest('.item')?.querySelector('.warnslot'); if (slot) slot.innerHTML = itemWarn(it, +d.i); }
    S.draft.dirty = true; renderExamplePreview(); persist();
  } else if (d.ffield === 'caption') { S.draft.figures[+d.f].caption = t.value; S.draft.dirty = true; renderExamplePreview(); persist(); }
  else if (d.sheet && t.type !== 'checkbox') { S.sheet[d.sheet] = t.value; persist(); }
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.concept) { const before = { ...S.cfg.on }; toggle(d.concept, t.checked); noticeChanges(before, d.concept); renderSettings(); recompute(); }
  else if (d.ifield === 'auto') { const it = S.draft.items[+d.i]; it.auto = t.checked; S.draft.dirty = true; const slot = t.closest('.item')?.querySelector('.warnslot'); if (slot) slot.innerHTML = itemWarn(it, +d.i); renderExamplePreview(); persist(); }
  else if (d.ffield === 'size') { S.draft.figures[+d.f].size = t.value; S.draft.dirty = true; persist(); }
  else if (d.sheet) { S.sheet[d.sheet] = t.type === 'checkbox' ? t.checked : t.value; persist(); }
  else if (t.id === 'addKind' && t.value) { const it = newItem(t.value); S.draft.items.push(it); S.draft.custom = true; S.draft.dirty = true; syncDraft(); rerenderTab(); persist(); }
  else if (t.id === 'rateSel') S.rate = +t.value;
  else if (t.id === 'libFile' && t.files[0]) {
    const reader = new FileReader();
    reader.onload = () => { try { const n = importLibrary(String(reader.result)); renderSaved(); renderSheet(); rerenderTab(); persist(); setStatus(`예제 ${n}개를 불러왔습니다.`); } catch (err) { setStatus(err.message); } };
    reader.readAsText(t.files[0], 'utf-8');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('help').hidden) { $('help').hidden = true; return; }
  if (e.key === 'Escape' && !$('tour').hidden) { showTour(-1); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && !['range', 'checkbox'].includes(e.target.type)) return;
  // ←/→로 개념을 넘기는 것은 화면 빈 곳, 그래프, 수업 순서 단추에 있을 때만입니다(체크박스·목록에서 실수로 넘어가지 않게).
  const nav = e.target === document.body || !!e.target.closest?.('#panels, .flow');
  if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') $('presentBtn').click();
  else if (e.key === 'Escape' && document.body.classList.contains('present')) $('presentBtn').click();
  else if (e.key === ' ' && !$('transport').hidden && e.target.tagName !== 'BUTTON') { e.preventDefault(); setPlaying(!S.playing); }
  else if ((e.key === 'ArrowRight' || e.key === 'PageDown') && nav) { e.preventDefault(); step(1); }
  else if ((e.key === 'ArrowLeft' || e.key === 'PageUp') && nav) { e.preventDefault(); step(-1); }
});
// 고른 목록 위에서 스크롤해도 값이 바뀌지 않게 합니다.
document.addEventListener('wheel', e => { if (e.target.tagName === 'SELECT' && document.activeElement === e.target) e.target.blur(); }, { passive: true });
/* 그래프 위 마우스: 보기(값 읽기, Ctrl+휠 확대, 끌어서 이동), 펜(그리기), 점(값 표시). */
let drag = null;
$('panels').addEventListener('pointerdown', e => {
  const el = e.target.closest('.pnl');
  if (!el || e.target.tagName !== 'CANVAS') return;
  const key = el.dataset.panel, r = el.querySelector('canvas.ov').getBoundingClientRect();
  if (S.tool === 'pen') { (S.ink[key] ??= []).push([[(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]]); drag = { kind: 'pen', key, el, r }; }
  else if (S.tool === 'mark') { const x = xAt(el, e.clientX); if (x !== null) (S.marks[key] ??= []).push(x); drawOverlay(el); return; }
  else if (S.zoom?.panel === key) drag = { kind: 'pan', key, el, x0: e.clientX, xr: [...S.zoom.xr], w: S.frames[key].b.w };
  if (drag) try { e.target.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트에는 포인터가 없습니다 */ }
});
$('panels').addEventListener('pointermove', e => {
  const el = e.target.closest('.pnl');
  if (drag?.kind === 'pen') { const s = S.ink[drag.key].at(-1); s.push([(e.clientX - drag.r.left) / drag.r.width, (e.clientY - drag.r.top) / drag.r.height]); return drawOverlay(drag.el); }
  if (drag?.kind === 'pan') { const shift = -(e.clientX - drag.x0) / drag.w * (drag.xr[1] - drag.xr[0]); S.zoom = { panel: drag.key, xr: [drag.xr[0] + shift, drag.xr[1] + shift] }; S.dirty = true; return undefined; }
  if (el && S.tool !== 'pen') { showProbe(el, e); drawOverlay(el); }
  return undefined;
});
const endDrag = () => { drag = null; };
$('panels').addEventListener('pointerup', endDrag);
$('panels').addEventListener('pointercancel', endDrag);
$('panels').addEventListener('pointerleave', () => { $('probe').hidden = true; S.hover = null; redrawOverlays(); });
$('panels').addEventListener('wheel', e => {
  const el = e.target.closest('.pnl');
  if (!e.ctrlKey || !el || e.target.tagName !== 'CANVAS') return;
  e.preventDefault();
  const key = el.dataset.panel, f = S.frames[key], x = xAt(el, e.clientX);
  if (!f || x === null) return;
  const k = e.deltaY < 0 ? 1 / 1.25 : 1.25, xr = S.zoom?.panel === key ? S.zoom.xr : f.xr;
  S.zoom = { panel: key, xr: [x - (x - xr[0]) * k, x + (xr[1] - x) * k] };
  S.dirty = true;
}, { passive: false });
$('panels').addEventListener('dblclick', e => { if (e.target.tagName === 'CANVAS' && S.tool === 'view') { S.zoom = null; S.dirty = true; } });
/* 그래프와 아래 칸 사이의 줄을 끌어 아래 칸의 높이를 바꿉니다. */
let sizing = null;
$('resizer').addEventListener('pointerdown', e => { sizing = { y: e.clientY, h: $('bottom').getBoundingClientRect().height }; try { $('resizer').setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 */ } });
$('resizer').addEventListener('pointermove', e => {
  if (!sizing) return;
  const h = Math.max(70, Math.min(window.innerHeight * .75, sizing.h - (e.clientY - sizing.y)));
  $('bottom').style.maxHeight = `${h}px`; $('bottom').style.height = `${h}px`; S.dirty = true;
});
$('resizer').addEventListener('pointerup', () => { sizing = null; });
$('resizer').addEventListener('dblclick', () => { $('bottom').style.maxHeight = ''; $('bottom').style.height = ''; S.dirty = true; });
new ResizeObserver(() => { S.dirty = true; }).observe(document.body);

/* ── 자체 검사 ─────────────────────────────────────── */
window.STUDIO_SELFTEST = () => {
  S.noSave = true;   // 검사가 사용자가 저장한 내용을 덮어쓰지 않게 합니다.
  S.fakeDownload = true;   // 검사 중에는 파일을 내려받지 않습니다.
  showTour(-1); $('help').hidden = true;
  const report = { passed: true, checks: [] };
  const check = (ok, label) => { report.checks.push(`${ok ? 'ok' : 'FAIL'} ${label}`); if (!ok) report.passed = false; };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const reset = patch => { const { on = {}, ...rest } = patch; S.cfg = mergeCfg(rest); for (const [id, v] of Object.entries(on)) if (v) select(id); S.saved = []; S.draft = emptyDraft(); S.pin = null; S.zoom = null; S.edits = {}; S.editingConcept = null; S.sheet = copy(SHEET); S.ink = {}; S.marks = {}; S.tab = 'summary'; S.lastTab = ''; renderSaved(); renderSheet(); renderSettings(); recompute(); draw(); };
  const set = patch => { Object.assign(S.cfg, patch); renderSettings(); recompute(); draw(); };
  const click = id => { document.querySelector(`[data-concept="${id}"]`).click(); draw(); };
  const shown = () => { const list = $$('#panels .pnl'); return list.length === 1 ? list[0].dataset.panel : list.map(x => x.dataset.panel).join('+'); };
  const painted = () => $$('#panels canvas.main').every(c => { const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < data.length; i += 40) if (data[i]) return true; return false; });
  const text = () => $('tabBody').textContent;
  const onList = () => Object.keys(S.cfg.on).filter(k => S.cfg.on[k]).join(',');
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const tab = name => { document.querySelector(`[data-tab="${name}"]`).click(); };
  reset({});
  check(shown() === 'series' && document.querySelector('[data-concept="series"]').disabled && painted() && $('err').hidden, '처음: Fourier 급수 그래프 하나');
  // 개념 나무
  click('coef'); check(onList() === 'series,coef' && shown() === 'coef', '계수의 의미');
  click('spectrum'); check(onList() === 'series,coef,spectrum' && shown() === 'spectrum' && text().includes('계수의') && text().includes('계수 크기'), '같은 갈래(계수)는 함께 켜짐');
  click('gibbs'); check(onList() === 'series,gibbs' && shown() === 'gibbs', '다른 갈래를 켜면 계수 갈래는 해제');
  click('spectrum'); check(onList() === 'series,coef,spectrum', '계수 크기를 켜면 계수의 의미도 켜짐');
  click('coef'); check(onList() === 'series' && shown() === 'series', '계수의 의미를 끄면 그 아래도 해제');
  click('wave'); check(onList() === 'series,half,wave' && S.cfg.halfMode === 'sine' && shown() === 'wave' && !$('transport').hidden, '현을 켜면 반구간 전개가 함께 켜짐');
  click('heat'); check(onList() === 'series,half,heat' && shown() === 'heat', '막대를 켜면 현은 해제되고 반구간은 남음');
  click('half'); check(onList() === 'series', '반구간을 끄면 그 위의 막대도 해제');
  click('wave'); document.querySelector('[data-seg="waveDomain"][data-value="infinite"]').click(); draw();
  check(onList() === 'series,wave' && getComputedStyle(document.querySelector('.concept[data-id="wave"]')).getPropertyValue('--d').trim() === '1', '무한히 긴 현은 Fourier 급수 바로 위');
  // 수업 흐름
  reset({}); const seen = [];
  for (let i = 0; i < 6; i++) { $('nextStep').click(); seen.push(deepestOf(S.cfg)); }
  check(seen.join(',') === 'coef,spectrum,gibbs,half,wave,heat' && $('nextStep').disabled && S.tab === 'concept' && $('tabBody').querySelector('.now h3')?.textContent.includes('막대'), '다음 개념 → 순서와 개념 탭');
  $('prevStep').click(); check(deepestOf(S.cfg) === 'wave' && $('stepLabel').textContent.startsWith('6 / 7'), '← 이전');
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); check(deepestOf(S.cfg) === 'heat', '→ 키로 다음 개념');
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
  for (const name of ['concept', 'example', 'summary']) { tab(name); check(text().length > 40 && !/NaN|undefined/.test(text()), `${name} 탭`); }
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
  document.querySelector('[data-seg="bc"][data-value="insulated"]').click(); set({ f: '10' }); check(S.cfg.halfMode === 'cosine' && !$('f_left') && near(S.R.heat.u(1, 5), 10, 1e-6), '단열: 코사인 전개와 평균');
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
  reset({ f: 'sign(x)', on: { coef: true } }); tab('example');
  check(S.draft.items.map(i => i.kind).join(',') === 'series,coef' && $$('#items .item').length === 2 && text().includes('구하시오'), '자동 초안: 켠 개념마다 소문항');
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
  check(S.draft.editing === 0 && S.draft.items[0].edited && S.tab === 'example' && $('saveExample').textContent.includes('예제 1'), '담은 예제 고치기');
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
  click('wave'); check(shown() === 'pin+wave' && $$('#panels .pnl .pt')[0].textContent.startsWith('고정'), '다른 개념은 나란히 비교');
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
  reset({ f: 'x<1 ? 0 : 1', on: { coef: true } }); tab('example'); check(!exact(fineCoef(S.R.series, 'b', 1)).sure && $('exPreview').textContent.includes('≈') && $('exPreview').textContent.includes('근삿값'), '확인되지 않은 값은 ≈로 표시');
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
  // 개념이 함께 켜지고 꺼질 때 알림
  reset({}); click('spectrum'); check($('status').textContent.includes('계수의 의미'), '바탕 개념을 함께 켜면 알림');
  click('gibbs'); check($('status').textContent.includes('다른 갈래'), '다른 갈래를 끄면 알림');
  // 방향키는 체크박스에서 개념을 넘기지 않음
  const before2 = deepestOf(S.cfg), box2 = document.querySelector('[data-concept="half"]');
  box2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); check(deepestOf(S.cfg) === before2, '체크박스에서 → 키는 개념을 넘기지 않음');
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
  // 프로그램 검사는 이 상태로 Word 단추를 누릅니다(예제 1개: 급수·계수 소문항, 자동 그림 2개).
  reset({ on: { coef: true } }); saveExample();
  S.fakeDownload = false;
  return report;
};

/* ── 시작 ─────────────────────────────────────────── */
if (window.innerHeight < 820) size = .95;   // 노트북·프로젝터처럼 낮은 화면은 글자를 조금 줄입니다.
document.documentElement.style.fontSize = `${16 * size}px`;
const restored = restore();
if (!restored) syncDraft();
renderSettings(); renderSaved(); renderSheet(); recompute();
S.ready = true; S.draft.dirty = false;
if (restored) setStatus('지난번 작업을 불러왔습니다.', { label: '처음 상태로', fn: resetAll });
if (!tourDone()) showTour(0);
requestAnimationFrame(frame);
