'use strict';
/* 주제 화면: 주제를 고르면 변수를 입력하고, 그래프와 짧은 요약을 봅니다. 자세한 내용은 Word 문서로 내보냅니다.
   계산은 math.js, 그리기는 plot.js를 씁니다. */
const $ = id => document.getElementById(id);
const DOCS = {
  fourier: ['concept_fourier.docx', 'Fourier 급수 개념 정리.docx'],
  pde: ['concept_pde.docx', '파동과 열 개념 정리.docx'],
};
/* 입력 형식 안내입니다. */
const HINT_PERIODIC = '입력 형식: x^2, sign(x), abs(x), x>0 ? x : 0';
const HINT_FINITE = '입력 형식: x*(L-x), sin(pi*x/L), x<L/2 ? x : L-x';
const HINT_INFINITE = '입력 형식: exp(-x^2), step(x+1)-step(x-1)';

const S = { topic: null, cfgs: {}, cfg: null, model: null, dirty: false, playing: false, rate: 1, zoom: 1, last: 0, paramKey: '' };

/* ── 값 읽기 ───────────────────────────────────────── */
function positive(cfg, key, label) { try { return constant(cfg[key]); } catch (e) { throw new Error(`${label}: ${e.message}`); } }
function real(cfg, key, label) {
  let c;
  try { c = compile(String(cfg[key])); } catch (e) { throw new Error(`${label}: ${e.message}`); }
  const value = c.params.length ? NaN : c.fn(0, { L: 1 });
  if (!isFinite(value)) throw new Error(`${label}: 숫자를 입력하십시오.`);
  return value;
}
function fnOf(cfg, key, label, L) {
  let c;
  try { c = compile(String(cfg[key])); } catch (e) { throw new Error(`${label}: ${e.message}`); }
  const P = { ...cfg.params, L };
  return x => c.fn(x, P);
}
const seriesModel = (cfg, key, label, L, mode) => buildSeries(fnOf(cfg, key, label, L), L, mode, 0);

/* ── 글자 ─────────────────────────────────────────── */
const m = s => `<span class="m">${s}</span>`;
/** 닫힌 꼴이 있으면 그 꼴로, 없으면 소수로 씁니다. π²의 유리수배도 찾습니다. */
function coefText(value) {
  const form = closedForm(value);
  if (form) return form;
  const u = Math.abs(value) / (PI * PI);
  for (let q = 1; q <= 40; q++) { const r = Math.round(u * q); if (r >= 1 && r <= 64 && Math.abs(u * q - r) < 2e-6 * q) return `${value < 0 ? '−' : ''}${r > 1 ? r : ''}π²${q > 1 ? `/${q}` : ''}`; }
  return fmt(value, 4);
}
/** kind는 'a0', 'a', 'b'입니다. 화면 계수(2048칸)보다 촘촘한 적분으로 구해 닫힌 꼴을 찾기 쉽게 합니다. */
function fineCoef(model, kind, n = 0) {
  model.fine ??= {};
  const key = `${kind}${n}`;
  if (key in model.fine) return model.fine[key];
  const q = 32768, L = model.L, h = 2 * L / q, w = n * PI / L;
  let s = 0;
  for (let j = 0; j < q; j++) { const x = -L + (j + .5) * h, y = model.ext(x); s += kind === 'a0' ? y : kind === 'a' ? y * Math.cos(w * x) : y * Math.sin(w * x); }
  return (model.fine[key] = kind === 'a0' ? s * h / (2 * L) : s * h / L);
}
const argOf = (n, L) => { const c = n === 1 ? '' : n; if (Math.abs(L - PI) < 1e-9) return `${c}x`; if (Math.abs(L - 1) < 1e-9) return `${c}πx`; return `${c}πx/${fmt(L, 3)}`; };
/** 급수의 앞 항을 글자로 씁니다. */
function seriesText(model, count = 4) {
  const tol = 1e-6 * Math.max(model.span, 1e-9), parts = [];
  const add = (rough, kind, n, tail) => {
    if (Math.abs(rough) < tol || parts.length >= count) return;
    const value = fineCoef(model, kind, n), size = coefText(Math.abs(value)), lead = tail && size === '1' ? '' : size;
    parts.push([value < 0, `${lead}${tail && lead ? ' ' : ''}${tail}`]);
  };
  add(model.a0, 'a0', 0, '');
  for (let n = 1; n <= NMAX && parts.length < count; n++) { add(model.a[n], 'a', n, `cos ${argOf(n, model.L)}`); add(model.b[n], 'b', n, `sin ${argOf(n, model.L)}`); }
  if (!parts.length) return '0';
  return parts.map(([neg, text], i) => (i ? (neg ? ' − ' : ' + ') : neg ? '−' : '') + text).join('') + ' + ⋯';
}
const symmetryLine = model => model.sym === 'odd' ? `기함수이므로 ${m('<i>a<sub>n</sub></i> = 0')}인 사인 급수입니다.` : model.sym === 'even' ? `우함수이므로 ${m('<i>b<sub>n</sub></i> = 0')}인 코사인 급수입니다.` : '대칭이 없어 사인 항과 코사인 항이 모두 나옵니다.';

/* ── 그리기 도구 ───────────────────────────────────── */
const box = (w, h, C) => { const l = 42 * C.scale; return { l, t: 8, w: w - l - 22, h: h - 14 - 16 * C.scale }; };
const piTicks = (xr, L = PI, step = L / 2) => { const out = []; for (let k = Math.ceil(xr[0] / step); k * step <= xr[1] + 1e-9; k++) out.push([k * step, piLabel(k * step, L)]); return out; };
const stacked = (w, h, C, share = .66) => { const gap = 8 + 16 * C.scale, full = box(w, h, C), top = (full.h - gap) * share; return [{ ...full, h: top }, { ...full, t: full.t + top + gap, h: full.h - top - gap }]; };
const sideBySide = (w, h, C) => { const a = box(w / 2, h, C); return [a, { ...a, l: a.l + w / 2 }]; };
/** Ctrl+휠 확대: 가운데를 기준으로 가로축을 좁힙니다. */
const zoomed = xr => { const c = (xr[0] + xr[1]) / 2, half = (xr[1] - xr[0]) / 2 / S.zoom; return [c - half, c + half]; };
function legend(items) {
  const html = items.map(([c, t, dash]) => `<span><b class="sw ${dash === true ? 'dashed' : dash || ''}" style="--c:var(${c})"></b><span class="m lt">${t}</span></span>`).join('');
  if ($('legend').innerHTML !== html) $('legend').innerHTML = html;
}
function drawArea(ctx, b, C, xr, L, product, breaks) {
  let lo = 0, hi = 0;
  for (let i = 0; i <= 400; i++) { const y = product(xr[0] + i / 400 * (xr[1] - xr[0])); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const pad = Math.max(.08, .12 * (hi - lo)), M = axes(ctx, b, xr, [lo - pad, hi + pad], C, { xTicks: piTicks(xr, L) });
  const zero = M.Y(0), cols = Math.ceil(b.w);
  for (let i = 0; i < cols; i++) { const x = xr[0] + (i + .5) / cols * (xr[1] - xr[0]), y = product(x), py = M.Y(y); ctx.fillStyle = y >= 0 ? C.pos : C.neg; ctx.fillRect(b.l + i, Math.min(py, zero), 1.02, Math.abs(py - zero)); }
  curve(ctx, product, b, xr, M, C.ink2, 1.5, breaks);
}
/** 차수별 막대입니다. N보다 큰 차수는 흐리게 그립니다. sets는 [[색, n → 값], …]입니다. */
function bars(ctx, b, C, sets, N, title) {
  const top = Math.min(30, Math.max(12, N)), xr = [.4, top + .6];
  let peak = 1e-9;
  for (const [, value] of sets) for (let n = 1; n <= top; n++) peak = Math.max(peak, Math.abs(value(n)));
  const ticks = []; const every = top > 20 ? 5 : 2;
  for (let n = every; n <= top; n += every) ticks.push([n, String(n)]);
  const M = axes(ctx, b, xr, [-peak * 1.15, peak * 1.15], C, { xTicks: ticks });
  const width = Math.max(1.5, b.w / top * .7 / sets.length);
  for (let n = 1; n <= top; n++) sets.forEach(([color, value], i) => {
    const y = value(n), x = M.X(n) + (i - (sets.length - 1) / 2) * width;
    ctx.globalAlpha = n > N ? .25 : 1; ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, Math.min(M.Y(y), M.Y(0)), width, Math.abs(M.Y(y) - M.Y(0)));
  });
  ctx.globalAlpha = 1;
  panelText(ctx, title, b.l + b.w - 6, b.t + 2, C, 'right');
}
function coefBars(ctx, b, C, model, N) { bars(ctx, b, C, [[C.hot, n => model.a[n]], [C.blue, n => model.b[n]]], N, '차수별 계수'); }
function drawSeriesMain(ctx, b, C, model, N, band, extra = 1.5) {
  const L = model.L, xr = zoomed([-extra * L, extra * L]), pad = Math.max(.25, .2 * model.span);
  const M = axes(ctx, b, xr, [model.lo - pad, model.hi + pad], C, { band, xTicks: piTicks(xr, L) });
  curve(ctx, model.f, b, xr, M, C.ink, 2.5, SeriesConcept.breaks(model, xr));
  curve(ctx, x => partialSum(model, N, x), b, xr, M, C.blue, 3);
  return M;
}
function scanRange(fn, xr, times) {
  let lo = Infinity, hi = -Infinity;
  for (const t of times) for (let i = 0; i <= 120; i++) { const y = fn(xr[0] + i / 120 * (xr[1] - xr[0]), t); if (y < lo) lo = y; if (y > hi) hi = y; }
  if (!isFinite(lo) || !isFinite(hi)) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.');
  const pad = Math.max(.05, .15 * (hi - lo));
  return [lo - pad, hi + pad];
}
const mix = (p, q, t) => p.map((v, i) => Math.round(v + (q[i] - v) * t));
/** 위치(가로)와 시간(세로)에 따른 값을 색으로 나타냅니다. 현재 시간에 선을 긋습니다. */
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
  const note = '위치와 시간에 따른 온도 (파랑: 낮음, 주황: 높음)';
  ctx.font = `${C.fs}px ${C.font}`;
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(b.l + 2, b.t + 2, ctx.measureText(note).width + 10, C.fs + 8);
  panelText(ctx, note, b.l + 7, b.t + 5, { ...C, ink2: '#101a27' });
}

/* ── 주제 ─────────────────────────────────────────── */
const fieldF = (hint, label = '함수 f(x)') => ({ k: 'f', type: 'expr', label, hint });
const fieldL = { k: 'L', type: 'text', label: '반주기 L', hint: 'pi, 2, 1/2' };
const fieldN = (max = 100) => ({ k: 'N', type: 'range', label: '항의 개수 N', min: 1, max });
const TOPICS = [
  { id: 'series', group: 'Fourier 해석', title: 'Fourier 급수', sec: '11장', blurb: '함수를 삼각함수의 합으로 나타내고 부분합이 다가가는 모습을 봅니다.', doc: 'fourier',
    defaults: { f: 'sign(x)', L: 'pi', N: 9 }, fields: () => [fieldF(HINT_PERIODIC), fieldL, fieldN()],
    compute: c => seriesModel(c, 'f', '함수', positive(c, 'L', 'L'), 'full'),
    draw(ctx, w, h, C, c, model) {
      const [p, q] = stacked(w, h, C); drawSeriesMain(ctx, p, C, model, c.N, [-model.L, model.L]); coefBars(ctx, q, C, model, c.N);
      legend([['--ink', '<i>f</i>(<i>x</i>)'], ['--blue', `부분합 <i>S</i><sub>${c.N}</sub>`], ['--hot', '<i>a<sub>n</sub></i>'], ['--blue', '<i>b<sub>n</sub></i>']]);
    },
    summary: (c, model) => [symmetryLine(model), m(`<i>f</i>(<i>x</i>) ≈ ${seriesText(model)}`),
      `항 ${c.N}개까지의 제곱오차 ${m(`<i>E</i>* = ${fmt(squareError(model, c.N), 4)}`)}`,
      ...(model.jumps.length ? [`도약이 ${model.jumps.length}곳 있어 그 점의 합은 두 극한의 평균이 됩니다.`] : [])] },

  { id: 'ortho', group: 'Fourier 해석', title: '직교성', sec: '11장', blurb: '두 삼각함수를 곱해 적분하면 언제 0이 되는지 넓이로 봅니다.', doc: 'fourier',
    defaults: { pair: 'ss', n: 2, m: 3 },
    fields: () => [{ k: 'pair', type: 'seg', label: '곱하는 두 함수', options: [['ss', 'sin · sin'], ['cc', 'cos · cos'], ['sc', 'sin · cos']] }, { k: 'n', type: 'range', label: '첫째 함수의 차수 n', min: 1, max: 8 }, { k: 'm', type: 'range', label: '둘째 함수의 차수 m', min: 1, max: 8 }],
    compute(c) {
      const tr = k => k === 's' ? Math.sin : Math.cos, f1 = tr(c.pair[0]), f2 = tr(c.pair[1]), product = x => f1(c.n * x) * f2(c.m * x), q = 8000, h = 2 * PI / q;
      let integral = 0;
      for (let i = 0; i < q; i++) integral += product(-PI + (i + .5) * h) * h;
      return { f1, f2, product, integral };
    },
    draw(ctx, w, h, C, c, model) {
      const [p, q] = stacked(w, h, C, .45), xr = zoomed([-PI, PI]), M = axes(ctx, p, xr, [-1.3, 1.3], C, { xTicks: piTicks(xr) });
      curve(ctx, x => model.f2(c.m * x), p, xr, M, C.hot, 2.5, [], [8, 5]); curve(ctx, x => model.f1(c.n * x), p, xr, M, C.blue, 3);
      drawArea(ctx, q, C, xr, PI, model.product, []);
      const name = (k, n) => `${k === 's' ? 'sin' : 'cos'} ${n === 1 ? '' : n}<i>x</i>`;
      legend([['--blue', name(c.pair[0], c.n)], ['--hot', name(c.pair[1], c.m), true], ['--pos-fill', '양의 넓이', 'fill'], ['--neg-fill', '음의 넓이', 'fill']]);
    },
    summary(c, model) {
      const same = c.pair !== 'sc' && c.n === c.m;
      const identity = { ss: 'sin <i>nx</i> sin <i>mx</i> = ½[cos (<i>n</i>−<i>m</i>)<i>x</i> − cos (<i>n</i>+<i>m</i>)<i>x</i>]', cc: 'cos <i>nx</i> cos <i>mx</i> = ½[cos (<i>n</i>−<i>m</i>)<i>x</i> + cos (<i>n</i>+<i>m</i>)<i>x</i>]', sc: 'sin <i>nx</i> cos <i>mx</i> = ½[sin (<i>n</i>+<i>m</i>)<i>x</i> + sin (<i>n</i>−<i>m</i>)<i>x</i>]' }[c.pair];
      return [`−π부터 π까지 적분한 값은 ${m(coefText(model.integral))}입니다.`, same ? '같은 함수의 곱은 제곱이라 넓이가 모두 양수로 쌓입니다.' : '위아래 넓이가 정확히 상쇄됩니다. 이것이 직교성입니다.', m(identity)];
    } },

  { id: 'euler', group: 'Fourier 해석', title: '계수 구하기', sec: '11장', blurb: '함수와 파동을 곱한 곡선의 넓이에서 Fourier 계수가 나오는 과정을 봅니다.', doc: 'fourier',
    defaults: { f: 'x', L: 'pi', kind: 'b', n: 1 },
    fields: () => [fieldF(HINT_PERIODIC), fieldL, { k: 'kind', type: 'seg', label: '구할 계수', options: [['b', 'bₙ (사인)'], ['a', 'aₙ (코사인)']] }, { k: 'n', type: 'range', label: '차수 n', min: 1, max: 20 }],
    compute: c => seriesModel(c, 'f', '함수', positive(c, 'L', 'L'), 'full'),
    draw(ctx, w, h, C, c, model) {
      const L = model.L, xr = zoomed([-L, L]), basis = x => (c.kind === 'b' ? Math.sin : Math.cos)(c.n * PI / L * x), breaks = SeriesConcept.breaks(model, xr), [p, q] = stacked(w, h, C, .45), pad = Math.max(.25, .15 * model.span);
      const M = axes(ctx, p, xr, [Math.min(model.lo, -1) - pad, Math.max(model.hi, 1) + pad], C, { xTicks: piTicks(xr, L) });
      curve(ctx, basis, p, xr, M, C.blue, 2, [], [8, 5]); curve(ctx, model.f, p, xr, M, C.ink, 2.5, breaks);
      drawArea(ctx, q, C, xr, L, x => model.f(x) * basis(x), breaks);
      legend([['--ink', '<i>f</i>(<i>x</i>)'], ['--blue', `${c.kind === 'b' ? 'sin' : 'cos'} ${argOf(c.n, L).replace('x', '<i>x</i>')}`, true], ['--pos-fill', '더하는 넓이', 'fill'], ['--neg-fill', '빼는 넓이', 'fill']]);
    },
    summary(c, model) {
      const value = fineCoef(model, c.kind, c.n), name = `<i>${c.kind}</i><sub>${c.n}</sub>`;
      return [`곱한 곡선의 넓이는 ${m(fmt(value * model.L, 4))}입니다.`, `넓이를 ${m('<i>L</i>')}로 나누면 ${m(`${name} = ${coefText(value)}`)}입니다.`, Math.abs(value) < 1e-6 * Math.max(model.span, 1e-9) ? '넓이가 상쇄되어 이 파동은 함수에 들어 있지 않습니다.' : '넓이가 한쪽으로 쌓일수록 이 파동의 비중이 큽니다.', `상수항은 ${m(`<i>a</i><sub>0</sub> = ${coefText(fineCoef(model, 'a0'))}`)}입니다.`];
    } },

  { id: 'gibbs', group: 'Fourier 해석', title: '수렴과 도약', sec: '11장', blurb: '도약점에서 합이 평균으로 가는 것과 Gibbs 현상을 확대해 봅니다.', doc: 'fourier',
    defaults: { f: 'sign(x)', L: 'pi', N: 25 }, fields: () => [fieldF(HINT_PERIODIC), fieldL, fieldN()],
    compute: c => seriesModel(c, 'f', '함수', positive(c, 'L', 'L'), 'full'),
    draw(ctx, w, h, C, c, model) {
      const J = model.jumps[0];
      if (!J) { drawSeriesMain(ctx, box(w, h, C), C, model, c.N, [-model.L, model.L]); legend([['--ink', '<i>f</i>(<i>x</i>)'], ['--blue', `<i>S</i><sub>${c.N}</sub>`]]); return; }
      const [p, q] = sideBySide(w, h, C), reach = model.L / PI, xr = zoomed([J.x - reach, J.x + reach]), size = Math.abs(J.right - J.left);
      drawSeriesMain(ctx, p, C, model, c.N, null, 1);
      const M = axes(ctx, q, xr, [Math.min(J.left, J.right) - .25 * size, Math.max(J.left, J.right) + .25 * size], C, {});
      curve(ctx, model.f, q, xr, M, C.ink, 2.5, SeriesConcept.breaks(model, xr)); curve(ctx, x => partialSum(model, c.N, x), q, xr, M, C.blue, 3);
      vline(ctx, M.X(J.x), q, C.hot); dot(ctx, M.X(J.x), M.Y((J.left + J.right) / 2), C.hot, C, 6);
      panelText(ctx, '도약점 확대', q.l + 6, q.t + 2, C);
      legend([['--ink', '<i>f</i>(<i>x</i>)'], ['--blue', `<i>S</i><sub>${c.N}</sub>`], ['--hot', '두 극한의 평균']]);
    },
    summary(c, model) {
      const J = model.jumps[0];
      if (!J) return ['이 함수에는 도약이 없어 Gibbs 현상이 나타나지 않습니다. 사각파나 톱니파를 골라 보십시오.', `항 ${c.N}개까지의 제곱오차 ${m(`<i>E</i>* = ${fmt(squareError(model, c.N), 4)}`)}`];
      return [`${m(`<i>x</i> = ${piLabel(J.x, model.L)}`)}에서 ${m(fmt(J.left, 3))}에서 ${m(fmt(J.right, 3))}로 뜁니다. 두 극한의 평균은 ${m(fmt((J.left + J.right) / 2, 3))}입니다.`,
        `그 점의 합은 ${m(`<i>S</i><sub>${c.N}</sub> = ${fmt(partialSum(model, c.N, J.x), 4)}`)}입니다.`, `봉우리 초과량은 도약 크기의 ${m(`${(overshoot(model, J, c.N) * 100).toFixed(1)}%`)}입니다. ${m('<i>N</i>')}을 늘려도 폭만 좁아지고 약 9%에 머뭅니다.`];
    } },

  { id: 'half', group: 'Fourier 해석', title: '반구간 전개', sec: '11장', blurb: '(0, L)에서 주어진 함수를 코사인 또는 사인 급수로 확장합니다.', doc: 'fourier',
    defaults: { f: 'x<L/2 ? x : L-x', L: 'pi', mode: 'cosine', N: 7 },
    fields: () => [fieldF(HINT_FINITE, '(0, L)의 함수 f(x)'), { ...fieldL, label: '길이 L' }, { k: 'mode', type: 'seg', label: '확장 방법', options: [['cosine', '우함수 (코사인)'], ['sine', '기함수 (사인)']] }, fieldN()],
    compute: c => seriesModel(c, 'f', '함수', positive(c, 'L', 'L'), c.mode),
    draw(ctx, w, h, C, c, model) {
      const [p, q] = stacked(w, h, C); drawSeriesMain(ctx, p, C, model, c.N, [0, model.L]); coefBars(ctx, q, C, model, c.N);
      legend([['--ink', c.mode === 'cosine' ? '우함수 확장' : '기함수 확장'], ['--blue', `<i>S</i><sub>${c.N}</sub>`], ['--band', '주어진 구간', 'fill'], ['--hot', '<i>a<sub>n</sub></i>'], ['--blue', '<i>b<sub>n</sub></i>']]);
    },
    summary: (c, model) => [c.mode === 'cosine' ? `왼쪽을 우함수로 확장하여 코사인 항만 남습니다. ${m('<i>a<sub>n</sub></i> = (2/<i>L</i>) ∫<sub>0</sub><sup><i>L</i></sup> <i>f</i> cos (<i>nπx</i>/<i>L</i>) <i>dx</i>')}` : `왼쪽을 기함수로 확장하여 사인 항만 남습니다. ${m('<i>b<sub>n</sub></i> = (2/<i>L</i>) ∫<sub>0</sub><sup><i>L</i></sup> <i>f</i> sin (<i>nπx</i>/<i>L</i>) <i>dx</i>')}`,
      m(`<i>f</i>(<i>x</i>) ≈ ${seriesText(model)}`), `항 ${c.N}개까지의 제곱오차 ${m(`<i>E</i>* = ${fmt(squareError(model, c.N), 4)}`)}`] },

  { id: 'wave', group: '편미분방정식', title: '현의 진동', sec: '12장', blurb: '양 끝이 고정된 현의 시간 변화와 모드별 진폭을 봅니다.', doc: 'pde',
    defaults: { f: 'x<L/2 ? x : L-x', g: '0', L: '1', c: '1', N: 30, t: 0 }, time: true,
    fields: () => [fieldF(HINT_FINITE, '초기 변위 f(x)'), { k: 'g', type: 'expr', label: '초기 속도 g(x)', hint: '0이면 정지 상태에서 시작합니다.' }, { ...fieldL, label: '현의 길이 L' }, { k: 'c', type: 'text', label: '파동 속도 c', hint: 'c² = 장력/선밀도' }, fieldN(60)],
    compute(c) {
      const L = positive(c, 'L', 'L'), speed = positive(c, 'c', 'c'), f = fnOf(c, 'f', '초기 변위', L), g = fnOf(c, 'g', '초기 속도', L);
      const model = buildPde('wave', 'fixed', f, g, { L, N: c.N, speed, alpha: 1 }), T = 2 * L / speed, times = []; for (let i = 0; i <= 40; i++) times.push(i / 40 * T);
      return { ...model, L, speed, T, f0: f, tEnd: 2 * T, yr: scanRange(model.u, [0, L], times) };
    },
    draw(ctx, w, h, C, c, model) {
      const [p, q] = stacked(w, h, C), xr = zoomed([0, model.L]), M = axes(ctx, p, xr, model.yr, C, { xTicks: piTicks(xr, model.L, model.L / 4) });
      curve(ctx, model.f0, p, xr, M, C.muted, 1.5, [], [6, 5]); curve(ctx, x => model.u(x, c.t), p, xr, M, C.blue, 3);
      bars(ctx, q, C, [[C.blue, n => n <= c.N ? model.amp(n, c.t) : 0]], c.N, '모드별 진폭');
      legend([['--blue', '<i>u</i>(<i>x</i>, <i>t</i>)'], ['--muted', '처음 모양', true]]);
    },
    summary(c, model) {
      let big = 1; for (let n = 1; n <= c.N; n++) if (Math.abs(model.coef[n]) + Math.abs(model.velocity[n] / model.omega(n)) > Math.abs(model.coef[big]) + Math.abs(model.velocity[big] / model.omega(big))) big = n;
      const ends = Math.max(Math.abs(model.f0(0)), Math.abs(model.f0(model.L)));
      return [`주기는 ${m(`<i>T</i> = 2<i>L</i>/<i>c</i> = ${fmt(model.T, 4)}`)}이고, 기본 각진동수는 ${m(`<i>λ</i><sub>1</sub> = <i>cπ</i>/<i>L</i> = ${fmt(model.omega(1), 4)}`)}입니다.`, `가장 큰 모드는 ${m(`<i>n</i> = ${big}`)}이고, 모드가 합쳐져 모양이 만들어집니다. 에너지는 줄지 않습니다.`, `해: ${m('<i>u</i> = Σ (<i>B<sub>n</sub></i> cos <i>λ<sub>n</sub>t</i> + <i>B<sub>n</sub></i>* sin <i>λ<sub>n</sub>t</i>) sin (<i>nπx</i>/<i>L</i>)')}`, ...(ends > 1e-6 ? ['초기 변위가 양 끝에서 0이 아니어서 고정 조건과 맞지 않습니다. 끝점 부근에서 급수가 함수와 다릅니다.'] : [])];
    } },

  { id: 'heat', group: '편미분방정식', title: '막대의 열전도', sec: '12장', blurb: '유한한 막대의 온도가 시간에 따라 정상 상태로 가는 과정을 봅니다.', doc: 'pde',
    defaults: { f: 'sin(pi*x/L)', L: '1', alpha: '0.1', bc: 'fixed', left: '0', right: '0', N: 40, t: 0 }, time: true,
    fields: () => [fieldF(HINT_FINITE, '초기 온도 f(x)'), { ...fieldL, label: '막대의 길이 L' }, { k: 'alpha', type: 'text', label: '열확산계수 α', hint: '교재의 c²' }, { k: 'bc', type: 'seg', label: '양 끝 조건', options: [['fixed', '온도 고정'], ['insulated', '단열']] }, { k: 'left', type: 'text', label: '왼쪽 끝 온도', when: c => c.bc === 'fixed' }, { k: 'right', type: 'text', label: '오른쪽 끝 온도', when: c => c.bc === 'fixed' }, fieldN(60)],
    compute(c) {
      const L = positive(c, 'L', 'L'), alpha = positive(c, 'alpha', 'α'), f = fnOf(c, 'f', '초기 온도', L);
      const left = c.bc === 'fixed' ? real(c, 'left', '왼쪽 끝 온도') : 0, right = c.bc === 'fixed' ? real(c, 'right', '오른쪽 끝 온도') : 0;
      const model = buildPde('heat', c.bc, f, x => 0, { L, N: c.N, alpha, speed: 1, left, right }), tEnd = 3 / model.rate(1);
      return { ...model, L, alpha, left, right, f0: f, tEnd, range: [0, L], yr: scanRange(model.u, [0, L], [0, tEnd / 20, tEnd]) };
    },
    draw(ctx, w, h, C, c, model) {
      const [p, q] = stacked(w, h, C, .55), xr = zoomed([0, model.L]), M = axes(ctx, p, xr, model.yr, C, { xTicks: piTicks(xr, model.L, model.L / 4) });
      curve(ctx, model.f0, p, xr, M, C.muted, 1.5, [], [6, 5]);
      const end = c.bc === 'fixed' ? model.steady : () => model.mean;
      curve(ctx, end, p, xr, M, C.green, 2, [], [3, 4]); curve(ctx, x => model.u(x, c.t), p, xr, M, C.hot, 3);
      spacetime(ctx, q, C, model, c.t);
      legend([['--hot', '<i>u</i>(<i>x</i>, <i>t</i>)'], ['--muted', '처음 온도', true], ['--green', c.bc === 'fixed' ? '정상 상태' : '평균 온도', true]]);
    },
    summary(c, model) {
      const rate = model.rate(1), mid = model.u(model.L / 2, c.t);
      return [c.bc === 'fixed' ? (model.left === model.right ? `시간이 지나면 막대 전체가 양 끝 온도 ${m(fmt(model.left, 3))}로 고르게 됩니다.` : `시간이 지나면 양 끝 온도 ${m(fmt(model.left, 3))}와 ${m(fmt(model.right, 3))}을 잇는 직선 분포로 갑니다.`) : `열이 빠져나가지 못해 평균 온도 ${m(fmt(model.mean, 4))}로 고르게 됩니다.`,
        `첫 모드의 감쇠율은 ${m(`<i>απ</i>²/<i>L</i>² = ${fmt(rate, 4)}`)}이고, 차이가 절반이 되는 시간은 ${m(fmt(Math.LN2 / rate, 4))}입니다. 높은 모드일수록 ${m('<i>n</i>²')}배 빨리 사라집니다.`, `지금 막대 가운데 온도는 ${m(fmt(mid, 4))}입니다.`];
    } },

  { id: 'infinite', group: '편미분방정식', title: '무한 영역', sec: '12장', blurb: '무한히 긴 현과 막대에서 파동의 전파와 열의 퍼짐을 비교합니다.', doc: 'pde',
    defaults: { eq: 'wave', f: 'exp(-x^2)', g: '0', c: '1', alpha: '1', X: '8', tEnd: '6', t: 0 }, time: true,
    fields: () => [{ k: 'eq', type: 'seg', label: '방정식', options: [['wave', '파동'], ['heat', '열']] }, fieldF(HINT_INFINITE, '초기 모양 f(x)'), { k: 'g', type: 'expr', label: '초기 속도 g(x)', hint: '0이면 정지 상태에서 시작합니다.', when: c => c.eq === 'wave' }, { k: 'c', type: 'text', label: '파동 속도 c', when: c => c.eq === 'wave' }, { k: 'alpha', type: 'text', label: '열확산계수 α', hint: '교재의 c²', when: c => c.eq === 'heat' }, { k: 'X', type: 'text', label: '보이는 범위 X (−X ~ X)' }, { k: 'tEnd', type: 'text', label: '끝 시간' }],
    compute(c) {
      const X = positive(c, 'X', '범위'), tEnd = positive(c, 'tEnd', '끝 시간'), f = fnOf(c, 'f', '초기 모양', 1), wave = c.eq === 'wave';
      const speed = wave ? positive(c, 'c', 'c') : 1, alpha = wave ? 1 : positive(c, 'alpha', 'α'), g = wave ? fnOf(c, 'g', '초기 속도', 1) : () => 0;
      const model = buildPde(c.eq, 'infinite', f, g, { speed, alpha, X, tEnd }), times = wave ? [0, tEnd / 4, tEnd / 2, tEnd] : [0];
      let total = 0; const q = 4000, span = X + (wave ? 0 : 6 * Math.sqrt(alpha * tEnd)), h = 2 * span / q;
      for (let i = 0; i < q; i++) total += f(-span + (i + .5) * h) * h;
      return { ...model, X, speed, alpha, f0: f, tEnd, total, restWave: wave && String(c.g).trim() === '0', yr: scanRange(model.u, [-X, X], times) };
    },
    draw(ctx, w, h, C, c, model) {
      const b = box(w, h, C), xr = zoomed([-model.X, model.X]), M = axes(ctx, b, xr, model.yr, C, {});
      curve(ctx, model.f0, b, xr, M, C.muted, 1.5, [], [6, 5]);
      if (model.restWave) { curve(ctx, x => model.right(x, c.t), b, xr, M, C.hot, 1.5, [], [3, 4]); curve(ctx, x => model.leftw(x, c.t), b, xr, M, C.green, 1.5, [], [3, 4]); }
      curve(ctx, x => model.u(x, c.t), b, xr, M, c.eq === 'wave' ? C.blue : C.hot, 3, [], null, 2);
      legend([[c.eq === 'wave' ? '--blue' : '--hot', '<i>u</i>(<i>x</i>, <i>t</i>)'], ['--muted', '처음 모양', true], ...(model.restWave ? [['--hot', '오른쪽 파동', true], ['--green', '왼쪽 파동', true]] : [])]);
    },
    summary(c, model) {
      let peak = -Infinity; for (let i = 0; i <= 200; i++) peak = Math.max(peak, model.u(-model.X + i / 100 * model.X, c.t));
      if (c.eq === 'wave') return [`D’Alembert 해: ${m('<i>u</i> = ½[<i>f</i>(<i>x</i>−<i>ct</i>) + <i>f</i>(<i>x</i>+<i>ct</i>)] + (1/2<i>c</i>) ∫ <i>g</i>(<i>s</i>) <i>ds</i>')}`, `초기 모양이 절반씩 나뉘어 속도 ${m(fmt(model.speed, 3))}로 양쪽으로 갑니다. 모양은 그대로 유지됩니다.`, `지금 최고점은 ${m(fmt(peak, 4))}입니다.`];
      return [`해: ${m('<i>u</i> = (1/2√(<i>παt</i>)) ∫ <i>f</i>(<i>v</i>) exp(−(<i>x</i>−<i>v</i>)²/4<i>αt</i>) <i>dv</i>')}`, `퍼짐의 표준편차는 ${m(`√(2<i>αt</i>) = ${fmt(Math.sqrt(2 * model.alpha * c.t), 3)}`)}만큼 늘어나고, 끊어진 모양도 곧바로 매끄러워집니다.`, `지금 최고 온도는 ${m(fmt(peak, 4))}이고, 전체 열량 ${m(fmt(model.total, 4))}은 그대로입니다.`];
    } },
];

/* ── 첫 화면 ───────────────────────────────────────── */
function renderHome() {
  const groups = [...new Set(TOPICS.map(t => t.group))];
  $('homeGroups').innerHTML = groups.map(g => `<section class="homeGroup"><h2>${g}</h2><div class="grid">${TOPICS.filter(t => t.group === g).map(t => `<button type="button" class="card" data-open="${t.id}"><span class="sec">${t.sec}</span><strong>${t.title}</strong><span>${t.blurb}</span></button>`).join('')}</div></section>`).join('')
    + '<section class="homeGroup"><h2>문제 출제</h2><div class="grid"><a class="card linkcard" href="note.html"><span class="sec">11장</span><strong>문제지·해설지 만들기</strong><span>함수와 값을 골라 풀이가 딸린 문제를 만들고 PDF로 저장합니다.</span></a></div></section>';
}

/* ── 설정 ─────────────────────────────────────────── */
const inputId = k => `f_${k}`;
function fieldHtml(field, cfg) {
  const { k, label, hint } = field, id = inputId(k);
  if (field.type === 'seg') return `<div class="fld"><span class="flabel">${label}</span><div class="seg">${field.options.map(([value, text]) => `<button type="button" data-seg="${k}" data-value="${value}" aria-pressed="${cfg[k] === value}">${text}</button>`).join('')}</div></div>`;
  if (field.type === 'range') return `<div class="fld"><label class="flabel" for="${id}">${label}<output id="${id}_out">${cfg[k]}</output></label><input id="${id}" type="range" data-field="${k}" data-num="1" min="${field.min}" max="${field.max}" value="${cfg[k]}"></div>`;
  return `<div class="fld"><label class="flabel" for="${id}">${label}</label><input class="tf" id="${id}" type="text" spellcheck="false" autocomplete="off" data-field="${k}" value="${String(cfg[k]).replace(/"/g, '&quot;')}">${hint ? `<span class="hint">${hint.replace(/</g, '&lt;')}</span>` : ''}</div>`;
}
function renderFields() {
  const cfg = S.cfg, list = S.topic.fields(cfg).filter(f => !f.when || f.when(cfg));
  $('fields').innerHTML = `<h3>변수 입력</h3>${list.map(f => fieldHtml(f, cfg)).join('')}`;
  renderParams(true);
}
/** 수식에 새 글자를 쓰면 그 글자의 값을 넣는 칸이 생깁니다. */
function renderParams(force) {
  const cfg = S.cfg, names = new Set();
  for (const f of S.topic.fields(cfg)) if (f.type === 'expr' && (!f.when || f.when(cfg))) { try { compile(String(cfg[f.k])).params.forEach(p => names.add(p)); } catch { /* 입력 중인 수식 */ } }
  const list = [...names];
  for (const p of list) if (!(p in cfg.params)) cfg.params[p] = 1;
  const key = list.join(',');
  if (!force && key === S.paramKey) return;
  S.paramKey = key;
  $('paramFields').innerHTML = list.length ? `<h3>수식의 변수</h3>${list.map(p => `<div class="fld"><label class="flabel" for="p_${p}">${p}</label><input class="tf" id="p_${p}" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" data-param="${p}" value="${cfg.params[p]}"></div>`).join('')}` : '';
}
function showError(text) { $('err').textContent = text; $('err').hidden = !text; }
function recompute() {
  try {
    S.model = S.topic.compute(S.cfg);
    S.good = { ...S.cfg };   // 입력이 잘못되면 그래프는 마지막으로 계산된 설정으로 그립니다.
    showError('');
    if (S.topic.time) { S.cfg.t = Math.min(S.cfg.t, S.model.tEnd); syncTime(); }
  } catch (e) { showError(e.message); }
  S.dirty = true;
}

/* ── 시간 재생 ─────────────────────────────────────── */
function syncTime() {
  $('tSlider').value = S.cfg.t / S.model.tEnd;
  $('tOut').textContent = fmt(S.cfg.t, 3);
  $('playBtn').setAttribute('aria-pressed', S.playing);
  $('pauseBtn').setAttribute('aria-pressed', !S.playing && S.cfg.t > 0);
}
function setPlaying(on) { S.playing = on; S.last = 0; if (S.model) syncTime(); }
function tick(dt) { const end = S.model.tEnd; S.cfg.t += dt * S.rate * end / 12; if (S.cfg.t > end) S.cfg.t = 0; syncTime(); S.dirty = true; }

/* ── 그리기 ───────────────────────────────────────── */
function draw() {
  const c = $('plot'), { ctx, w, h } = prepare(c), C = themeColors();
  ctx.clearRect(0, 0, w, h);
  if (w < 60 || h < 60 || !S.model) return;
  const cfg = { ...S.good, t: S.cfg.t };
  S.topic.draw(ctx, w, h, C, cfg, S.model);
  const lines = S.topic.summary(cfg, S.model).map(line => `<li>${line}</li>`).join('');
  if (lines !== S.lastSummary) { $('summary').innerHTML = lines; S.lastSummary = lines; }
  c.setAttribute('aria-label', `${S.topic.title} 그래프. ${$('summary').textContent}`);
}
function frame(now) {
  if (S.playing && S.model && S.topic?.time) { if (S.last) tick(Math.min(.1, (now - S.last) / 1000)); S.last = now; }
  if (S.dirty && S.topic) { S.dirty = false; draw(); }
  requestAnimationFrame(frame);
}

/* ── 화면 전환 ─────────────────────────────────────── */
function open(id) {
  const topic = TOPICS.find(t => t.id === id);
  S.topic = topic; S.cfg = S.cfgs[id] ??= { ...topic.defaults, params: {} }; S.model = null; S.zoom = 1; S.lastSummary = ''; setPlaying(false);
  $('home').hidden = true; $('stage').hidden = false;
  $('topicTitle').textContent = topic.title; $('topicSec').textContent = topic.sec;
  const [href, name] = DOCS[topic.doc];
  $('docLink').href = href; $('docLink').download = name;
  $('transport').hidden = !topic.time;
  $('summary').innerHTML = '';
  renderFields(); recompute();
}
function goHome() { setPlaying(false); S.topic = null; if (document.body.classList.contains('present')) $('presentBtn').click(); $('stage').hidden = true; $('home').hidden = false; }

/* ── 입력 ─────────────────────────────────────────── */
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.open) return open(d.open);
  if (d.seg) { S.cfg[d.seg] = d.value; renderFields(); return recompute(); }
  switch (t.id) {
    case 'backBtn': return goHome();
    case 'playBtn': return setPlaying(true);
    case 'pauseBtn': return setPlaying(false);
    case 'stopBtn': setPlaying(false); S.cfg.t = 0; if (S.model) syncTime(); S.dirty = true; return undefined;
    case 'themeBtn': document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; t.textContent = document.documentElement.dataset.theme === 'dark' ? '밝게' : '어둡게'; S.dirty = true; return undefined;
    case 'bigger': return setSize(.1);
    case 'smaller': return setSize(-.1);
    case 'presentBtn': document.body.classList.toggle('present'); t.textContent = document.body.classList.contains('present') ? '발표 끝내기 (F)' : '발표 모드 (F)'; try { if (document.body.classList.contains('present')) document.documentElement.requestFullscreen?.()?.catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {}); } catch { /* 선택 사항 */ } S.dirty = true; return undefined;
    default: return undefined;
  }
});
let size = 1.15;
function setSize(d) { size = Math.max(.9, Math.min(1.8, +(size + d).toFixed(2))); document.documentElement.style.fontSize = `${16 * size}px`; S.dirty = true; }
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'tSlider') { S.cfg.t = +t.value * S.model.tEnd; syncTime(); S.dirty = true; return; }
  if (d.field) {
    S.cfg[d.field] = d.num ? +t.value : t.value;
    if (d.num) $(`${t.id}_out`).textContent = t.value;
    renderParams(false); recompute();
  } else if (d.param && t.value !== '' && isFinite(+t.value)) { S.cfg.params[d.param] = +t.value; recompute(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'rateSel') S.rate = +t.value;
});
document.addEventListener('keydown', e => {
  if (!S.topic) return;
  if (['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'range') return;
  if (e.key === 'f' || e.key === 'F' || e.key === 'ㄹ') $('presentBtn').click();
  else if (e.key === 'Escape' && document.body.classList.contains('present')) $('presentBtn').click();
  else if (e.key === ' ' && S.topic.time && e.target.tagName !== 'BUTTON') { e.preventDefault(); setPlaying(!S.playing); }
});
// 고른 목록 위에서 스크롤해도 값이 바뀌지 않게 합니다.
document.addEventListener('wheel', e => { if (e.target.tagName === 'SELECT' && document.activeElement === e.target) e.target.blur(); }, { passive: true });
$('plot').addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); S.zoom = Math.max(1, Math.min(20, S.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); S.dirty = true; }, { passive: false });
$('plot').addEventListener('dblclick', () => { S.zoom = 1; S.dirty = true; });
new ResizeObserver(() => { S.dirty = true; }).observe(document.body);

/* ── 자체 검사 ─────────────────────────────────────── */
window.TOPICS_SELFTEST = () => {
  const report = { passed: true, checks: [] };
  const check = (ok, label) => { report.checks.push(`${ok ? 'ok' : 'FAIL'} ${label}`); if (!ok) report.passed = false; };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const set = patch => { Object.assign(S.cfg, patch); renderFields(); recompute(); draw(); };
  const painted = () => { const c = $('plot'), data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < data.length; i += 40) if (data[i]) return true; return false; };
  check(document.querySelectorAll('[data-open]').length === TOPICS.length && document.querySelector('a.linkcard')?.getAttribute('href') === 'note.html', `첫 화면 주제 ${TOPICS.length}개`);
  // 모든 주제: 설정, 그래프, 요약, Word 문서가 나옵니다. 여러 함수를 넣어도 계산됩니다.
  const periodic = ['sign(x)', 'abs(x)', 'x', 'x^2', 'x>0 ? sin(pi*x/L) : 0'], finite = ['x<L/2 ? x : L-x', 'sin(pi*x/L)', 'x*(L-x)', 'x<L/2 ? 1 : 0', 'sin(pi*x/L)+0.5*sin(3*pi*x/L)'];
  const samples = { series: periodic, euler: periodic, gibbs: periodic, half: finite, wave: finite, heat: finite, infinite: ['exp(-x^2)', 'step(x+1)-step(x-1)', 'abs(x)<1 ? 1-abs(x) : 0'] };
  for (const t of TOPICS) {
    document.querySelector(`[data-open="${t.id}"]`).click(); draw();
    check(!$('stage').hidden && $('fields').querySelectorAll('.fld').length > 0 && painted() && $('summary').children.length >= 2 && $('err').hidden, `${t.title} 화면`);
    check($('docLink').getAttribute('href') === DOCS[t.doc][0] && !!$('docLink').download, `${t.title} Word 연결`);
    for (const expr of samples[t.id] ?? []) { const old = S.cfg.f; set({ f: expr }); check($('err').hidden && !/NaN|undefined/.test($('summary').textContent), `${t.title} 함수 ${expr}`); set({ f: old }); }
    check(!$('fields').querySelector('select'), `${t.title} 예시 목록 없음`);
    $('backBtn').click(); check(!$('home').hidden && $('stage').hidden, `${t.title} 뒤로`);
  }
  // 값 대조
  open('series'); draw();
  check(near(S.model.b[1], 4 / PI, 1e-3) && $('summary').textContent.includes('4/π') && $('summary').textContent.includes('4/(3π)'), '사각파의 정확한 계수');
  set({ f: 'x^2' }); check($('summary').textContent.includes('π²/3') && $('summary').textContent.includes('− 4 cos x') && $('summary').textContent.includes('4/9'), 'x²의 정확한 계수'); set({ f: 'sign(x)' });
  const fi = $('f_f'); fi.value = 'k*x'; fi.dispatchEvent(new Event('input', { bubbles: true }));
  check(!!$('p_k') && near(S.model.b[1], 2, 2e-3), '새 글자 k의 입력 칸');
  $('p_k').value = '3'; $('p_k').dispatchEvent(new Event('input', { bubbles: true })); check(near(S.model.b[1], 6, 6e-3), '변수 k를 바꾸면 다시 계산');
  const before = S.model; fi.value = 'sin('; fi.dispatchEvent(new Event('input', { bubbles: true }));
  check(!$('err').hidden && S.model === before && document.activeElement !== null, '잘못된 수식은 안내하고 이전 결과 유지');
  set({ f: 'sign(x)', L: '0' }); check(!$('err').hidden, 'L = 0 안내');
  set({ L: '2' }); check($('err').hidden && near(S.model.L, 2, 1e-12), 'L 입력');
  S.zoom = 1; set({ L: 'pi' });
  open('ortho'); set({ n: 2, m: 3, pair: 'ss' }); check(near(S.model.integral, 0, 1e-6), '직교: 다른 차수는 0');
  set({ n: 2, m: 2, pair: 'cc' }); check(near(S.model.integral, PI, 1e-6), '직교: 같은 차수는 π');
  set({ n: 3, m: 3, pair: 'sc' }); check(near(S.model.integral, 0, 1e-6), '직교: sin과 cos은 0');
  open('euler'); set({ f: 'x', L: 'pi', kind: 'b', n: 1 }); check(near(S.model.b[1], 2, 2e-3) && $('summary').textContent.includes('b1 = 2'), 'f = x의 b₁ = 2');
  set({ kind: 'a' }); check($('summary').textContent.includes('들어 있지 않습니다'), '기함수의 aₙ은 0이라고 안내');
  open('gibbs'); set({ f: 'sign(x)', L: 'pi', N: 100 }); check(near(overshoot(S.model, S.model.jumps[0], 100), .0895, .01) && $('summary').textContent.includes('%'), 'Gibbs 약 9%');
  set({ f: 'abs(x)' }); check($('summary').textContent.includes('도약이 없어'), '도약 없는 함수 안내'); set({ f: 'sign(x)', N: 25 });
  open('half'); check($('fields').textContent.includes('x<L/2 ? x : L-x'), '입력 형식 안내가 잘리지 않음'); set({ f: 'x', L: 'pi', mode: 'cosine', N: 7 }); check(S.model.b.every(v => Math.abs(v) < 1e-9), '우함수 확장은 bₙ = 0');
  set({ mode: 'sine' }); check(Math.abs(S.model.a0) < 1e-9 && S.model.a.every(v => Math.abs(v) < 1e-9) && near(S.model.b[1], 2, 2e-3), '기함수 확장은 aₙ = 0');
  open('wave'); set({ f: 'sin(pi*x/L)', g: '0', L: '1', c: '2', N: 10, t: 0 });
  check(near(S.model.T, 1, 1e-12) && near(S.model.u(.5, 1), 1, 1e-6) && near(S.model.u(.5, .5), -1, 1e-6), '현: 주기 2L/c와 반주기의 반전');
  set({ f: 'x+1', g: '0', L: '1', c: '1', N: 30 }); check($('summary').textContent.includes('0이 아니어서'), '끝점 조건 안내');
  set({ f: 'x<L/2 ? x : L-x', c: '1', t: 0 });
  // 재생, 일시정지, 정지
  $('playBtn').click(); tick(.1); const moved = S.cfg.t; check(S.playing && moved > 0, '재생'); $('pauseBtn').click(); check(!S.playing && S.cfg.t === moved, '일시정지'); $('stopBtn').click(); check(!S.playing && S.cfg.t === 0, '정지');
  S.cfg.t = S.model.tEnd * .999; tick(1); check(S.cfg.t === 0, '끝나면 처음부터');
  open('heat'); set({ f: 'sin(pi*x/L)', L: 'pi', alpha: '1', bc: 'fixed', left: '0', right: '0', N: 10 });
  check(near(S.model.u(PI / 2, 1), Math.exp(-1), 1e-4), '열: e^(−αλ²t) 감쇠');
  set({ left: '10', right: '30' }); check(near(S.model.u(PI / 2, 40), 20, 1e-3) && $('fields').querySelector('#f_left'), '정상 상태는 직선');
  set({ f: '10', bc: 'insulated' }); check(!$('fields').querySelector('#f_left') && near(S.model.u(1, 5), 10, 1e-6), '단열이면 끝 온도 칸이 없고 평균 유지');
  set({ f: 'x<L/2 ? x : L-x', bc: 'fixed', left: 'abc' }); check(!$('err').hidden && $('err').textContent.includes('왼쪽'), '잘못된 끝 온도 안내'); set({ left: '0', right: '0', alpha: '1', L: '1' });
  open('infinite'); set({ eq: 'wave', f: 'exp(-x^2)', g: '0', c: '1', X: '8', tEnd: '6', t: 0 });
  check(near(S.model.u(5, 5), .5, 1e-6), '무한 현: 절반씩 나뉨');
  set({ eq: 'heat', f: 'exp(-x^2)', alpha: '1', tEnd: '6' });
  check(near(S.model.u(0, 1), 1 / Math.sqrt(5), 1e-3) && near(S.model.total, Math.sqrt(PI), 1e-3), '무한 막대: 닫힌 해와 전체 열량');
  set({ eq: 'wave', t: 0 });
  // 확대와 발표 모드
  open('series'); $('plot').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true })); check(S.zoom > 1, 'Ctrl+휠 확대');
  const z = S.zoom; $('plot').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })); check(z === S.zoom, '휠만으로는 확대되지 않음');
  $('plot').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); check(S.zoom === 1, '더블클릭 원래대로');
  $('presentBtn').click(); check(getComputedStyle($('settings')).display === 'none', '발표 모드는 설정을 숨김'); $('presentBtn').click();
  goHome();
  return report;
};

/* ── 시작 ─────────────────────────────────────────── */
document.documentElement.style.fontSize = `${16 * size}px`;
renderHome();
requestAnimationFrame(frame);
