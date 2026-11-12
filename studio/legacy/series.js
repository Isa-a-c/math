'use strict';
/* 개념: 함수 전개 (교재 11.1, 11.2, 11.4절). 설정 항목·패널·수식·풀이를 선언합니다. */

/** 입력(수식 또는 직접 그린 표본)을 함수로 만듭니다. 표본은 구간 [a, b]의 비율로 저장합니다. */
function makeSource(src, a, b, L) {
  if (src.samples) {
    const s = src.samples, n = s.length - 1;
    return { params: [], nodes: n, fn: x => { const t = (x - a) / (b - a) * n; if (t <= 0) return s[0]; if (t >= n) return s[n]; const i = Math.floor(t); return s[i] + (s[i + 1] - s[i]) * (t - i); } };
  }
  const c = compile(src.expr);
  for (const p of c.params) if (!(p in src.params)) src.params[p] = 1;
  const P = { ...src.params, L };
  return { params: c.params, nodes: 0, fn: x => c.fn(x, P) };
}
const escapeHTML = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sourceText = src => src.samples ? '직접 그린 함수' : `${src.expr}${Object.keys(src.params).length ? ` (${Object.entries(src.params).map(([k, v]) => `${k} = ${fmt(v, 2)}`).join(', ')})` : ''}`;

const SYM_TEXT = { odd: '기함수입니다. 코사인 계수와 상수항이 모두 0입니다.', even: '우함수입니다. 사인 계수가 모두 0입니다.', none: '우함수도 기함수도 아닙니다. 사인과 코사인 항이 모두 필요합니다.' };
const trigArg = (n, L) => { const c = n === 1 ? '' : n; if (Math.abs(L - PI) < 1e-9) return `${c}x`; return `${c}πx/${fmt(L, 3)}`; };

const SeriesConcept = {
  id: 'series',
  title: '함수 전개',
  sections: '11.1 · 11.2 · 11.4절',
  blurb: '주기함수를 사인과 코사인의 합으로 나타내고, 계수·반구간 전개·수렴·최소제곱 오차를 한 화면에서 다룹니다.',
  defaults: () => ({
    src: { expr: 'k*sign(x)', params: { k: 1 }, samples: null }, L: 'pi', mode: 'full', N: 5, n: 3, kind: 'b', jump: 0,
    example: 'square',
    show: { f: true, s: true, ext: true, terms: false, spectrum: true, error: false, area: false, gibbs: false, energy: false, formula: true, note: true, solution: false, problem: false },
  }),
  presets: [
    { label: '처음 설명', patch: { N: 3, show: { f: true, s: true, ext: true, terms: true, spectrum: false, error: false, area: false, gibbs: false, energy: false, formula: true, note: true, solution: false, problem: false } } },
    { label: '계수 유도', patch: { N: 5, n: 3, show: { f: true, s: true, ext: false, terms: false, spectrum: true, error: false, area: true, gibbs: false, energy: false, formula: true, note: true, solution: false, problem: false } } },
    { label: '수렴과 Gibbs', patch: { N: 30, show: { f: true, s: true, ext: true, terms: false, spectrum: false, error: false, area: false, gibbs: true, energy: false, formula: false, note: true, solution: false, problem: false } } },
    { label: '근사 오차', patch: { N: 8, show: { f: true, s: true, ext: false, terms: false, spectrum: false, error: true, area: false, gibbs: false, energy: true, formula: true, note: true, solution: false, problem: false } } },
    { label: '내 예제 풀이', patch: { N: 8, show: { f: true, s: true, ext: true, terms: false, spectrum: false, error: false, area: false, gibbs: false, energy: false, formula: true, note: false, solution: true, problem: false } } },
    { label: '연습문제', patch: { N: 8, show: { f: true, s: true, ext: true, terms: false, spectrum: false, error: false, area: false, gibbs: false, energy: false, formula: false, note: false, solution: false, problem: true } } },
  ],
  examples: [
    { id: 'square', label: '사각파', note: '11.1 예제 1', apply: { src: { expr: 'k*sign(x)', params: { k: 1 } }, L: 'pi', mode: 'full' } },
    { id: 'saw', label: '톱니파', note: '11.2 예제 5', apply: { src: { expr: 'x+pi', params: {} }, L: 'pi', mode: 'full' } },
    { id: 'rect', label: '반파정류', note: '11.2 예제 3', apply: { src: { expr: 'x>0 ? k*sin(x) : 0', params: { k: 1 } }, L: 'pi', mode: 'full' } },
    { id: 'pulse', label: '사각 펄스', note: '11.2 예제 1', apply: { src: { expr: 'k*(step(x+1)-step(x-1))', params: { k: 1 } }, L: '2', mode: 'full' } },
    { id: 'tri', label: '삼각파', note: '|x|', apply: { src: { expr: 'abs(x)', params: {} }, L: 'pi', mode: 'full' } },
    { id: 'hsin', label: '삼각형 사인', note: '11.2 예제 6', apply: { src: { expr: 'x<L/2 ? 2*k*x/L : 2*k*(L-x)/L', params: { k: 1 } }, L: 'pi', mode: 'sine' } },
    { id: 'hcos', label: '삼각형 코사인', note: '11.2 예제 6', apply: { src: { expr: 'x<L/2 ? 2*k*x/L : 2*k*(L-x)/L', params: { k: 1 } }, L: 'pi', mode: 'cosine' } },
  ],
  schema(cfg) {
    return [
      { title: '함수', items: [{ type: 'source' }] },
      { title: '전개 방식', items: [
        { type: 'seg', key: 'mode', label: '', options: [['full', '전체 Fourier'], ['cosine', '코사인(우함수 확장)'], ['sine', '사인(기함수 확장)']] },
        { type: 'text', key: 'L', label: '반주기 L', hint: 'pi, 2, 1/2 처럼 입력' },
      ] },
      { title: '그래프에 표시', items: [
        { type: 'toggle', path: 'show.f', label: '원함수 f(x)' },
        { type: 'toggle', path: 'show.s', label: '부분합 Sₙ' },
        { type: 'toggle', path: 'show.ext', label: '주기 확장 보기' },
        { type: 'toggle', path: 'show.terms', label: '마지막 항 강조' },
      ] },
      { title: '함께 볼 패널', items: [
        { type: 'toggle', path: 'show.spectrum', label: '계수 스펙트럼' },
        { type: 'toggle', path: 'show.area', label: '계수 = 곱의 넓이 (Euler 공식)' },
        { type: 'slider', key: 'n', label: '차수 n', min: 1, max: 20, step: 1, when: c => c.show.area },
        { type: 'seg', key: 'kind', label: '계수', options: [['b', 'bₙ (sin)'], ['a', 'aₙ (cos)']], when: c => c.show.area },
        { type: 'toggle', path: 'show.error', label: '오차 f − Sₙ' },
        { type: 'toggle', path: 'show.gibbs', label: '도약점 확대 (Gibbs)' },
        { type: 'toggle', path: 'show.energy', label: '최소제곱 오차 E*' },
      ] },
      { title: '글', items: [
        { type: 'toggle', path: 'show.formula', label: '수식 줄' },
        { type: 'toggle', path: 'show.note', label: '설명 줄' },
        { type: 'toggle', path: 'show.solution', label: '내 예제 풀이' },
        { type: 'toggle', path: 'show.problem', label: '연습문제' },
      ] },
    ];
  },
  domain: cfg => { const L = constant(cfg.L); return cfg.mode === 'full' ? [-L, L] : [0, L]; },
  build(cfg) {
    const L = constant(cfg.L);
    const src = cfg.src;
    const [a, b] = this.domain(cfg);
    const source = makeSource(src, a, b, L);
    const model = buildSeries(source.fn, L, cfg.mode, source.nodes);
    model.params = source.params;
    return model;
  },
  transport: () => ({ key: 'N', label: '항의 개수 N', min: 1, max: 100, step: 1, play: '하나씩 더하기', text: c => String(c.N) }),
  tick(cfg, dt, clock) { clock.acc += dt; if (clock.acc < .55) return false; clock.acc = 0; if (cfg.N >= 40) { cfg.N = 1; return true; } cfg.N++; return true; },
  breaks(model, xr) { const out = [], p = 2 * model.L; for (const j of model.jumps) for (let k = -3; k <= 3; k++) { const v = j.x + k * p; if (v > xr[0] && v < xr[1]) out.push(v); } return out; },
  xTicks(model, xr) { const st = model.L / 2, list = []; for (let k = Math.ceil(xr[0] / st); k * st <= xr[1] + 1e-9; k++) list.push([k * st, piLabel(k * st, model.L)]); return list; },
  panels(cfg, model) {
    const self = this, list = [];
    list.push({ id: 'main', title: `f(x)와 부분합 S${cfg.N}`, draw: (ctx, w, h, C) => self.drawMain(ctx, w, h, C, cfg, model), legend: self.mainLegend(cfg, model) });
    if (cfg.show.area) list.push({ id: 'area', title: self.areaTitle(cfg, model), draw: (ctx, w, h, C) => self.drawArea(ctx, w, h, C, cfg, model) });
    if (cfg.show.spectrum) list.push({ id: 'spectrum', title: '계수 스펙트럼', legend: [['--hot', 'aₙ'], ['--blue', 'bₙ']], draw: (ctx, w, h, C) => self.drawSpectrum(ctx, w, h, C, cfg, model) });
    if (cfg.show.error) list.push({ id: 'error', title: `오차 f − S${cfg.N}`, draw: (ctx, w, h, C) => self.drawError(ctx, w, h, C, cfg, model) });
    if (cfg.show.gibbs) list.push({ id: 'gibbs', title: '도약점 확대', legend: [['--ink', 'f'], ['--blue', 'S'], ['--hot', '평균']], draw: (ctx, w, h, C) => self.drawGibbs(ctx, w, h, C, cfg, model) });
    if (cfg.show.energy) list.push({ id: 'energy', title: '최소제곱 오차 E*(N)', draw: (ctx, w, h, C) => self.drawEnergy(ctx, w, h, C, cfg, model) });
    if (cfg.show.solution) list.push({ id: 'solution', title: '내 예제 풀이', html: () => self.solutionHTML(cfg, model) });
    if (cfg.show.problem) list.push({ id: 'problem', title: '연습문제', html: () => problemPanel('series') });
    return list;
  },
  areaTitle(cfg, model) {
    const L = model.L, tr = cfg.kind === 'b' ? Math.sin : Math.cos, h = 2 * L / model.xs.length;
    let pos = 0, neg = 0;
    for (let j = 0; j < model.xs.length; j++) { const y = model.v[j] * tr(cfg.n * PI / L * model.xs[j]) * h; if (y > 0) pos += y; else neg += y; }
    return `곱의 넓이: ${cfg.kind}${cfg.n} = (1/L)(${fmt(pos, 3)} − ${fmt(-neg, 3)}) = ${fmt((pos + neg) / L)}`;
  },
  mainLegend(cfg, model) {
    const items = [];
    if (cfg.show.f) items.push(['--ink', 'f(x)']);
    if (cfg.show.s) items.push(['--blue', `S${cfg.N}`]);
    if (cfg.show.terms) items.push(['--hot', '마지막 항']);
    return items;
  },
  drawMain(ctx, w, h, C, cfg, model) {
    const m0 = 44 * C.scale, b = { l: m0, t: 8, w: w - m0 - 22, h: h - 22 - 12 * C.scale };
    const L = model.L, full = cfg.show.ext;
    const domain = cfg.mode === 'full' ? [-L, L] : [0, L];
    const xr = UI.drawing ? domain : full ? [-1.5 * L, 1.5 * L] : domain;
    const pad = Math.max(.25, .2 * model.span);
    const yr = UI.drawRange ?? [model.lo - pad, model.hi + pad];
    const mapper = axes(ctx, b, xr, yr, C, { band: full ? domain : null, xTicks: this.xTicks(model, xr) });
    const breaks = this.breaks(model, xr);
    if (cfg.show.terms && cfg.N >= 1) {
      let n = cfg.N;
      while (n > 1 && Math.abs(model.a[n]) + Math.abs(model.b[n]) < 1e-3 * Math.max(model.span, 1e-9)) n--;
      const w0 = PI / L;
      curve(ctx, x => model.a[n] * Math.cos(n * w0 * x) + model.b[n] * Math.sin(n * w0 * x), b, xr, mapper, C.hot, 2.5);
    }
    if (cfg.show.s) curve(ctx, x => partialSum(model, cfg.N, x), b, xr, mapper, C.blue, 3);
    if (cfg.show.f) curve(ctx, model.f, b, xr, mapper, C.ink, 2.5, breaks);
    UI.plot = { b, xr, yr, mapper };
    if (UI.hx !== null && !UI.drawing && UI.hx >= xr[0] && UI.hx <= xr[1]) {
      vline(ctx, mapper.X(UI.hx), b, C.muted, [3, 3]);
      const fx = model.f(UI.hx), sx = partialSum(model, cfg.N, UI.hx);
      if (cfg.show.f) dot(ctx, mapper.X(UI.hx), mapper.Y(fx), C.ink, C);
      if (cfg.show.s) dot(ctx, mapper.X(UI.hx), mapper.Y(sx), C.blue, C);
      setReadout(`x = ${fmt(UI.hx, 3)} &nbsp; f = ${fmt(fx, 3)} &nbsp; S<sub>${cfg.N}</sub> = ${fmt(sx, 3)} &nbsp; 오차 = ${fmt(fx - sx, 3)}`);
    } else setReadout(UI.drawing ? '구간 안에서 끌어 곡선을 그리십시오. 계수와 부분합이 바로 바뀝니다.' : '');
  },
  drawError(ctx, w, h, C, cfg, model) {
    const m0 = 44 * C.scale, b = { l: m0, t: 8, w: w - m0 - 22, h: h - 22 - 12 * C.scale }, L = model.L, xr = [-L, L];
    let top = 1e-9;
    for (let i = 0; i < 300; i++) { const x = -L + (i + .5) * 2 * L / 300; top = Math.max(top, Math.abs(model.f(x) - partialSum(model, cfg.N, x))); }
    const mapper = axes(ctx, b, xr, [-top * 1.15, top * 1.15], C, { xTicks: this.xTicks(model, xr) });
    curve(ctx, x => model.f(x) - partialSum(model, cfg.N, x), b, xr, mapper, C.hot, 2, this.breaks(model, xr));
  },
  drawArea(ctx, w, h, C, cfg, model) {
    const m0 = 44 * C.scale, L = model.L, w0 = PI / L, tr = cfg.kind === 'b' ? Math.sin : Math.cos;
    const gap = 8, plot = h - 22 - 12 * C.scale - gap, top = plot * .45;
    const b1 = { l: m0, t: 6, w: w - m0 - 22, h: top }, b2 = { l: m0, t: 6 + top + gap, w: w - m0 - 22, h: plot - top };
    const xr = [-L, L], basis = x => tr(cfg.n * w0 * x);
    const pad = Math.max(.25, .15 * model.span);
    const m1 = axes(ctx, b1, xr, [Math.min(model.lo, -1) - pad, Math.max(model.hi, 1) + pad], C, { noXLabels: true, xTicks: this.xTicks(model, xr) });
    curve(ctx, basis, b1, xr, m1, C.blue, 2);
    curve(ctx, model.f, b1, xr, m1, C.ink, 2, this.breaks(model, xr));
    const prod = x => model.f(x) * basis(x);
    let lo = 0, hi = 0;
    for (let j = 0; j < model.xs.length; j++) { const y = model.v[j] * basis(model.xs[j]); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const p2 = Math.max(.1, .12 * (hi - lo));
    const m2 = axes(ctx, b2, xr, [lo - p2, hi + p2], C, { xTicks: this.xTicks(model, xr) });
    const zero = m2.Y(0), cols = Math.ceil(b2.w);
    for (let i = 0; i < cols; i++) {
      const x = xr[0] + (i + .5) / cols * (xr[1] - xr[0]), py = m2.Y(prod(x));
      ctx.fillStyle = prod(x) >= 0 ? C.pos : C.neg;
      ctx.fillRect(b2.l + i, Math.min(py, zero), 1.02, Math.abs(py - zero));
    }
    curve(ctx, prod, b2, xr, m2, C.ink2, 1.5, this.breaks(model, xr));
  },
  drawSpectrum(ctx, w, h, C, cfg, model) {
    const m0 = 44 * C.scale, count = Math.min(40, Math.max(12, cfg.N)), slot = (w - m0 - 16) / count;
    let big = 1e-9;
    for (let n = 1; n <= count; n++) big = Math.max(big, Math.abs(model.a[n]), Math.abs(model.b[n]));
    const t = 6, H = h - 14 - 12 * C.scale, zero = t + H / 2, scale = (H / 2 - 2) / big;
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m0, zero); ctx.lineTo(w - 16, zero); ctx.stroke();
    ctx.font = `${C.fs}px ${C.font}`;
    ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmt(big, 2), m0 - 6, t + 7); ctx.fillText('0', m0 - 6, zero);
    const barW = Math.max(2, Math.min(9, (slot - 4) / 2));
    const bar = (x, v, color, dim) => {
      if (Math.abs(v) < big * 1e-3) return;
      const len = Math.max(1.5, Math.abs(v) * scale), y = v > 0 ? zero - len : zero, r = Math.min(3, barW / 2);
      ctx.globalAlpha = dim ? .28 : 1; ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, barW, len, v > 0 ? [r, r, 0, 0] : [0, 0, r, r]); ctx.fill();
      ctx.globalAlpha = 1;
    };
    for (let n = 1; n <= count; n++) {
      const x = m0 + (n - 1) * slot + slot / 2;
      if (cfg.show.area && cfg.n === n) { ctx.fillStyle = C.band; ctx.fillRect(x - slot / 2, t, slot, H); }
      bar(x - barW - 1, model.a[n], C.hot, n > cfg.N);
      bar(x + 1, model.b[n], C.blue, n > cfg.N);
      if (n === 1 || n % (slot < 18 ? 5 : 2) === 0) { ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(n, x, t + H + 3); }
    }
  },
  drawGibbs(ctx, w, h, C, cfg, model) {
    if (!model.jumps.length) { panelText(ctx, '이 함수에는 도약이 없습니다.', 10, 10, C); return; }
    const J = model.jumps[Math.min(cfg.jump, model.jumps.length - 1)], half = model.L / PI, size = Math.abs(J.right - J.left) || 1;
    const xr = [J.x - half, J.x + half];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 80; i++) { const y = model.f(xr[0] + i / 80 * 2 * half); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const yr = [lo - .22 * size, hi + .22 * size], m0 = 44 * C.scale, b = { l: m0, t: 8, w: w - m0 - 22, h: h - 22 - 12 * C.scale };
    const mapper = axes(ctx, b, xr, yr, C, {});
    curve(ctx, model.f, b, xr, mapper, C.ink, 2, this.breaks(model, xr));
    curve(ctx, x => partialSum(model, cfg.N, x), b, xr, mapper, C.blue, 2.5);
    const mean = (J.left + J.right) / 2;
    vline(ctx, mapper.X(J.x), b, C.hot);
    dot(ctx, mapper.X(J.x), mapper.Y(mean), C.hot, C);
    panelText(ctx, `봉우리 초과 ${(overshoot(model, J, cfg.N) * 100).toFixed(1)}% · 평균 ${fmt(mean, 3)}`, b.l + 6, b.t + 2, C);
  },
  drawEnergy(ctx, w, h, C, cfg, model) {
    const m0 = 44 * C.scale, b = { l: m0, t: 8, w: w - m0 - 22, h: h - 22 - 12 * C.scale }, top = Math.max(squareError(model, 0), 1e-9), max = Math.max(cfg.N, 20);
    const mapper = axes(ctx, b, [0, max], [0, top * 1.1], C, {});
    curve(ctx, n => squareError(model, Math.round(n)), b, [0, max], mapper, C.blue, 2.5);
    dot(ctx, mapper.X(cfg.N), mapper.Y(squareError(model, cfg.N)), C.hot, C);
    panelText(ctx, `E*(${cfg.N}) = ${fmt(squareError(model, cfg.N))}`, b.l + b.w - 4, b.t + 2, C, 'right');
  },
  math(cfg, model) {
    const L = model.L;
    const parts = [];
    if (Math.abs(model.a0) > 5e-4) parts.push(fmt(model.a0, 3));
    let count = 0, more = 0;
    for (let n = 1; n <= cfg.N; n++) for (const [v, name] of [[model.a[n], 'cos'], [model.b[n], 'sin']]) {
      if (Math.abs(v) < 5e-4 * Math.max(model.span, 1e-9)) continue;
      if (count < 6) parts.push(`${parts.length ? (v < 0 ? ' − ' : ' + ') : (v < 0 ? '−' : '')}${fmt(Math.abs(v), 3)} ${name} ${trigArg(n, L)}`);
      else more++;
      count++;
    }
    return `<span class="m"><i>S</i><sub>${cfg.N}</sub>(<i>x</i>) = ${parts.join('') || '0'}${more ? ' + …' : ''}</span>`;
  },
  note(cfg, model) {
    const out = [`지금 함수는 ${SYM_TEXT[model.sym]}`];
    if (cfg.mode !== 'full') out.push(cfg.mode === 'sine' ? '반구간 (0, L)의 함수를 기함수로 확장하면 사인 급수만 남습니다(11.2절).' : '반구간 (0, L)의 함수를 우함수로 확장하면 코사인 급수만 남습니다(11.2절).');
    if (cfg.show.area) out.push('Euler 공식: 곱의 넓이를 L로 나누면 계수입니다. 다른 차수는 직교성 때문에 사라집니다. 파란 넓이는 더하고 주황 넓이는 뺍니다.');
    if (cfg.show.gibbs) out.push('정리 2: 도약점에서 급수의 합은 두 극한의 평균으로 수렴합니다. 봉우리는 좁아지지만 높이는 약 9%에서 줄지 않습니다(Gibbs).');
    if (cfg.show.energy) out.push('11.4절 정리 1: 같은 차수의 삼각다항식 중 Fourier 계수를 쓴 부분합의 제곱오차 E*가 가장 작습니다.');
    return out.join(' ');
  },
  solutionHTML(cfg, model) {
    const hi = cfg.src.samples ? model : coefficients(model.ext, model.L, 6, 32768);
    const cf = v => cfg.src.samples ? '' : closedForm(v);
    const showA = model.sym !== 'odd', showB = model.sym !== 'even';
    const row = (name, list) => `<div class="tblwrap"><table><thead><tr><th class="l">계수</th><th>수치</th><th>닫힌 꼴(추정)</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(n => `<tr><td class="l m"><i>${name}</i><sub>${n}</sub></td><td>${fmt(list[n])}</td><td>${cf(list[n])}</td></tr>`).join('')}</tbody></table></div>`;
    const jumps = model.jumps.length ? `도약점 ${model.jumps.map(j => `x = ${piLabel(j.x, model.L)}에서 합은 ${fmt((j.left + j.right) / 2)}`).join(', ')}로 수렴합니다.` : '도약이 없어 모든 점에서 f(x)로 수렴합니다.';
    const modeText = cfg.mode === 'full' ? `주기 ${fmt(2 * model.L, 4)}인 함수` : `구간 (0, ${fmt(model.L, 4)})의 함수를 ${cfg.mode === 'sine' ? '사인' : '코사인'} 급수로 전개할 때`;
    return `<p><b>문제.</b> ${modeText} <code>${escapeHTML(sourceText(cfg.src))}</code>의 Fourier 계수를 구하십시오.</p>
      <ol class="solve"><li><b>대칭.</b> ${SYM_TEXT[model.sym]}</li>
      <li><b>상수항.</b> <span class="m"><i>a</i><sub>0</sub></span> = ${fmt(hi.a0)}${cf(hi.a0) && cf(hi.a0) !== '0' ? ` ≈ ${cf(hi.a0)}` : ''}</li>
      ${showA ? `<li><b>코사인 계수.</b>${row('a', hi.a)}</li>` : ''}${showB ? `<li><b>사인 계수.</b>${row('b', hi.b)}</li>` : ''}
      <li><b>수렴.</b> ${jumps}</li></ol><p class="hint">계수는 수치 적분값이고, 닫힌 꼴은 수치에 맞는 간단한 분수를 찾은 추정입니다.</p>`;
  },
  newProblem: () => seriesProblem(),
  applyProblem(cfg, problem) {
    const a = problem.apply;
    cfg.src = { expr: a.expr, params: { ...a.params }, samples: null };
    cfg.L = a.L; cfg.mode = a.mode; cfg.example = null;
  },
};
