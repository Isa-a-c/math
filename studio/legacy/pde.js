'use strict';
/* 개념: 파동과 열 (교재 12.2~12.7절). 두 방정식 모두 변수분리와 Fourier 급수로 푸는 공통 틀을 씁니다. */
const hexToRgb = h => { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const PdeConcept = {
  id: 'pde',
  title: '파동과 열',
  sections: '12.2 ~ 12.7절',
  blurb: '현의 진동과 막대의 열전도를 같은 틀(변수분리, Fourier 급수, 무한 영역의 해)로 비교하며 시간에 따른 변화를 봅니다.',
  defaults: () => ({
    eq: 'wave', bc: 'fixed', src: { expr: 'x<L/2 ? 2*k*x/L : 2*k*(L-x)/L', params: { k: 1 }, samples: null }, vel: '0',
    L: '1', speed: 1, alpha: .1, left: 0, right: 0, X: 5, N: 30, t: 0, tEnd: 2, rate: 1, example: 'w-tri',
    show: { t0: true, modes: false, travel: true, map: false, amps: false, spectrum: false, energy: false, compare: false, formula: true, note: true, solution: false, problem: false },
  }),
  presets: [
    { label: '움직임 보기', patch: { show: { t0: true, modes: false, travel: false, map: false, amps: false, spectrum: false, energy: false, compare: false, formula: true, note: true, solution: false, problem: false } } },
    { label: '모드로 나누기', patch: { show: { t0: true, modes: true, travel: false, map: false, amps: true, spectrum: true, energy: false, compare: false, formula: true, note: true, solution: false, problem: false } } },
    { label: '파동과 열 비교', patch: { bc: 'fixed', show: { t0: true, modes: false, travel: false, map: false, amps: false, spectrum: false, energy: false, compare: true, formula: true, note: true, solution: false, problem: false } } },
    { label: '시공간 그림', patch: { show: { t0: true, modes: false, travel: false, map: true, amps: false, spectrum: false, energy: true, compare: false, formula: false, note: true, solution: false, problem: false } } },
    { label: '내 예제 풀이', patch: { show: { t0: true, modes: false, travel: false, map: false, amps: false, spectrum: false, energy: false, compare: false, formula: true, note: false, solution: true, problem: false } } },
    { label: '연습문제', patch: { show: { t0: true, modes: false, travel: false, map: false, amps: false, spectrum: false, energy: false, compare: false, formula: false, note: false, solution: false, problem: true } } },
  ],
  examples: [
    { id: 'w-tri', label: '삼각형 현', note: '12.3 예제 1', apply: { eq: 'wave', bc: 'fixed', src: { expr: 'x<L/2 ? 2*k*x/L : 2*k*(L-x)/L', params: { k: 1 } }, vel: '0', L: '1', speed: 1, N: 30, tEnd: 2, t: 0 } },
    { id: 'w-two', label: '두 모드 현', note: '12.3', apply: { eq: 'wave', bc: 'fixed', src: { expr: 'sin(pi*x/L)+0.5*sin(3*pi*x/L)', params: {} }, vel: '0', L: '1', speed: 1, N: 10, tEnd: 2, t: 0 } },
    { id: 'w-inf', label: '무한 현', note: '12.4 D’Alembert', apply: { eq: 'wave', bc: 'infinite', src: { expr: 'exp(-x^2)', params: {} }, vel: '0', X: 8, speed: 1, tEnd: 6, t: 0 } },
    { id: 'h-cu', label: '구리 막대', note: '12.6 예제 1', apply: { eq: 'heat', bc: 'fixed', src: { expr: 'U*sin(pi*x/L)', params: { U: 100 } }, L: '80', alpha: 1.158, left: 0, right: 0, N: 10, tEnd: 800, t: 0 } },
    { id: 'h-tri', label: '삼각형 온도', note: '12.6 예제 3', apply: { eq: 'heat', bc: 'fixed', src: { expr: 'x<L/2 ? x : L-x', params: {} }, L: 'pi', alpha: 1, left: 0, right: 0, N: 40, tEnd: 2, t: 0 } },
    { id: 'h-ins', label: '단열 막대', note: '12.6 예제 5', apply: { eq: 'heat', bc: 'insulated', src: { expr: 'x<L/2 ? x : L-x', params: {} }, L: 'pi', alpha: 1, N: 40, tEnd: 3, t: 0 } },
    { id: 'h-inf', label: '무한 막대', note: '12.7 예제 1', apply: { eq: 'heat', bc: 'infinite', src: { expr: 'U*(step(x+1)-step(x-1))', params: { U: 100 } }, alpha: 1, X: 3, tEnd: 8, t: 0 } },
  ],
  schema(cfg) {
    const finite = cfg.bc !== 'infinite';
    return [
      { title: '방정식과 영역', items: [
        { type: 'seg', key: 'eq', label: '', options: [['wave', '파동 u_tt = c²u_xx'], ['heat', '열 u_t = αu_xx']] },
        { type: 'seg', key: 'bc', label: '', options: cfg.eq === 'wave' ? [['fixed', '양 끝 고정'], ['infinite', '무한']] : [['fixed', '양 끝 온도 고정'], ['insulated', '양 끝 단열'], ['infinite', '무한']] },
      ] },
      { title: cfg.eq === 'wave' ? '초기 변위' : '초기 온도', items: [{ type: 'source' }] },
      { title: '값', items: [
        { type: 'text', key: 'vel', label: '초기 속도 g(x)', hint: '0, sin(pi*x/L)', when: c => c.eq === 'wave' },
        { type: 'text', key: 'L', label: '길이 L', hint: 'pi, 80', when: () => finite },
        { type: 'slider', key: 'X', label: '보이는 반폭 X', min: 1, max: 20, step: .5, when: () => !finite },
        { type: 'slider', key: 'speed', label: '파동 속력 c', min: .1, max: 5, step: .1, when: c => c.eq === 'wave' || c.show.compare },
        { type: 'number', key: 'alpha', label: '열확산계수 α = c²', when: c => c.eq === 'heat' || c.show.compare },
        { type: 'number', key: 'left', label: '왼쪽 끝 온도', when: c => c.eq === 'heat' && c.bc === 'fixed' },
        { type: 'number', key: 'right', label: '오른쪽 끝 온도', when: c => c.eq === 'heat' && c.bc === 'fixed' },
        { type: 'slider', key: 'N', label: '급수 항의 개수 N', min: 1, max: 100, step: 1, when: () => finite },
        { type: 'number', key: 'tEnd', label: '마지막 시간' },
      ] },
      { title: '그래프에 표시', items: [
        { type: 'toggle', path: 'show.t0', label: '초기 모양(점선)' },
      ] },
      { title: '함께 볼 패널', items: [
        { type: 'toggle', path: 'show.modes', label: '모드별 곡선', when: () => finite },
        { type: 'toggle', path: 'show.travel', label: '두 진행파로 나누기', when: c => c.eq === 'wave' },
        { type: 'toggle', path: 'show.compare', label: c => c.eq === 'wave' ? '같은 초기값의 열과 비교' : '같은 초기값의 파동과 비교', when: c => c.bc !== 'insulated' },
        { type: 'toggle', path: 'show.map', label: '시공간 색 그림' },
        { type: 'toggle', path: 'show.amps', label: '모드 크기의 시간 변화', when: () => finite },
        { type: 'toggle', path: 'show.spectrum', label: '계수', when: () => finite },
        { type: 'toggle', path: 'show.energy', label: c => c.eq === 'wave' ? '에너지' : '∫u²dx의 감소', when: () => finite },
      ] },
      { title: '글', items: [
        { type: 'toggle', path: 'show.formula', label: '수식 줄' },
        { type: 'toggle', path: 'show.note', label: '설명 줄' },
        { type: 'toggle', path: 'show.solution', label: '내 예제 풀이', when: () => finite },
        { type: 'toggle', path: 'show.problem', label: '연습문제' },
      ] },
    ];
  },
  domain(cfg) { return cfg.bc === 'infinite' ? [-cfg.X, cfg.X] : [0, constant(cfg.L)]; },
  build(cfg) {
    if (cfg.eq === 'wave' && cfg.bc === 'insulated') cfg.bc = 'fixed';
    const [a, b] = this.domain(cfg);
    const L = cfg.bc === 'infinite' ? 1 : b;
    const source = makeSource(cfg.src, a, b, L);
    const velC = compile(cfg.vel || '0');
    if (velC.params.length) throw new Error('초기 속도에는 x, L, pi만 쓸 수 있습니다.');
    const vel = x => velC.fn(x, { L });
    if (cfg.t > cfg.tEnd) cfg.t = cfg.tEnd;
    const opts = { L, N: cfg.N, speed: cfg.speed, alpha: cfg.alpha, left: cfg.left, right: cfg.right, X: cfg.X, tEnd: cfg.tEnd };
    const model = buildPde(cfg.eq, cfg.bc, source.fn, vel, opts);
    model.f = source.fn; model.params = source.params; model.L = L; model.N = cfg.N;
    if (cfg.show.compare && cfg.bc !== 'insulated') model.other = buildPde(cfg.eq === 'wave' ? 'heat' : 'wave', cfg.bc, source.fn, cfg.eq === 'wave' ? vel : (() => 0), opts);
    let lo = Infinity, hi = -Infinity;
    const [x0, x1] = model.range;
    for (let i = 0; i <= 400; i++) { const y = source.fn(x0 + i / 400 * (x1 - x0)); if (!isFinite(y)) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.'); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    if (cfg.eq === 'heat' && cfg.bc === 'fixed') { lo = Math.min(lo, cfg.left, cfg.right); hi = Math.max(hi, cfg.left, cfg.right); }
    if (cfg.eq === 'wave' && cfg.bc !== 'infinite') {
      let top = Math.max(Math.abs(lo), Math.abs(hi));
      for (let k = 0; k <= 24; k++) for (let i = 0; i <= 40; i++) top = Math.max(top, Math.abs(model.u(x0 + i / 40 * (x1 - x0), cfg.tEnd * k / 24)));
      lo = -top; hi = top;
    }
    model.lo = lo; model.hi = hi; model.span = Math.max(hi - lo, 1e-9);
    return model;
  },
  transport: () => ({ key: 't', label: '시간 t', min: 0, max: null, step: null, play: '재생', text: c => fmt(c.t, 3), rate: true }),
  tick(cfg, dt) { cfg.t += dt * cfg.tEnd / 6 * cfg.rate; if (cfg.t >= cfg.tEnd) cfg.t = 0; return true; },
  panels(cfg, model) {
    const self = this, list = [];
    list.push({ id: 'main', title: `${cfg.eq === 'wave' ? '변위' : '온도'} u(x, t),  t = ${fmt(cfg.t, 3)}`, legend: [['--blue', 'u(x, t)'], ...(cfg.show.t0 ? [['--muted', '초기 모양']] : [])], draw: (ctx, w, h, C) => self.drawMain(ctx, w, h, C, cfg, model) });
    if (cfg.show.compare && model.other) list.push({ id: 'compare', title: cfg.eq === 'wave' ? '같은 초기값의 열' : '같은 초기값의 파동', draw: (ctx, w, h, C) => self.drawCompare(ctx, w, h, C, cfg, model) });
    if (cfg.show.modes && model.mode) list.push({ id: 'modes', title: '모드별 곡선', draw: (ctx, w, h, C) => self.drawModes(ctx, w, h, C, cfg, model) });
    if (cfg.show.travel && model.right) list.push({ id: 'travel', title: '두 진행파의 합', legend: [['--hot', '오른쪽으로'], ['--blue', '왼쪽으로'], ['--ink', '합']], draw: (ctx, w, h, C) => self.drawTravel(ctx, w, h, C, cfg, model) });
    if (cfg.show.map) list.push({ id: 'map', title: '시공간 그림 (가로 x, 세로 t)', draw: (ctx, w, h, C) => self.drawMap(ctx, w, h, C, cfg, model) });
    if (cfg.show.amps && model.amp) list.push({ id: 'amps', title: '모드 크기의 시간 변화', draw: (ctx, w, h, C) => self.drawAmps(ctx, w, h, C, cfg, model) });
    if (cfg.show.spectrum && model.coef) list.push({ id: 'spectrum', title: '계수', draw: (ctx, w, h, C) => self.drawCoef(ctx, w, h, C, cfg, model) });
    if (cfg.show.energy && model.coef) list.push({ id: 'energy', title: cfg.eq === 'wave' ? '에너지 E(t)' : '∫u²dx', draw: (ctx, w, h, C) => self.drawEnergy(ctx, w, h, C, cfg, model) });
    if (cfg.show.solution && model.coef) list.push({ id: 'solution', title: '내 예제 풀이', html: () => self.solutionHTML(cfg, model) });
    if (cfg.show.problem) list.push({ id: 'problem', title: '연습문제', html: () => problemPanel('pde') });
    return list;
  },
  box(w, h, C) { const m0 = 44 * C.scale; return { l: m0, t: 8, w: w - m0 - 22, h: h - 22 - 12 * C.scale }; },
  yRange(model) { const pad = Math.max(.15 * model.span, 1e-6); return [model.lo - pad, model.hi + pad]; },
  xTicks(model) { const [a, b] = model.range; if (model.bc === 'infinite') return null; const st = b / 4, out = []; for (let k = 0; k <= 4; k++) out.push([k * st, piLabel(k * st, Math.abs(b - PI) < 1e-9 ? PI : b + 1)]); return out; },
  drawMain(ctx, w, h, C, cfg, model) {
    const b = this.box(w, h, C), xr = model.range, yr = UI.drawRange ?? this.yRange(model);
    const mapper = axes(ctx, b, xr, yr, C, { xTicks: this.xTicks(model) });
    if (cfg.show.t0) curve(ctx, model.f, b, xr, mapper, C.muted, 1.5, [], [5, 5]);
    curve(ctx, x => model.u(x, cfg.t), b, xr, mapper, C.blue, 3, [], null, model.bc === 'infinite' && model.eq === 'heat' ? 3 : 1);
    UI.plot = { b, xr, yr, mapper };
    if (UI.hx !== null && !UI.drawing && UI.hx >= xr[0] && UI.hx <= xr[1]) {
      const y = model.u(UI.hx, cfg.t);
      vline(ctx, mapper.X(UI.hx), b, C.muted, [3, 3]);
      dot(ctx, mapper.X(UI.hx), mapper.Y(y), C.blue, C);
      setReadout(`x = ${fmt(UI.hx, 3)} &nbsp; t = ${fmt(cfg.t, 3)} &nbsp; u = ${fmt(y, 3)}`);
    } else setReadout(UI.drawing ? '구간 안에서 끌어 초기 모양을 그리십시오.' : '');
  },
  drawCompare(ctx, w, h, C, cfg, model) {
    const b = this.box(w, h, C), xr = model.range;
    const mapper = axes(ctx, b, xr, this.yRange(model), C, { xTicks: this.xTicks(model) });
    if (cfg.show.t0) curve(ctx, model.f, b, xr, mapper, C.muted, 1.5, [], [5, 5]);
    curve(ctx, x => model.other.u(x, cfg.t), b, xr, mapper, C.hot, 3, [], null, model.bc === 'infinite' ? 3 : 1);
    panelText(ctx, cfg.eq === 'wave' ? '열은 줄어들 뿐 되돌아오지 않습니다' : '파동은 진동하며 되돌아옵니다', b.l + 6, b.t + 2, C);
  },
  drawModes(ctx, w, h, C, cfg, model) {
    const b = this.box(w, h, C), xr = model.range;
    const mapper = axes(ctx, b, xr, this.yRange(model), C, { xTicks: this.xTicks(model) });
    const hues = [C.blue, C.hot, C.green, C.ink2];
    let used = 0;
    for (let n = 1; n <= cfg.N && used < 4; n++) {
      if (Math.abs(model.coef[n]) + Math.abs(model.velocity ? model.velocity[n] : 0) < 1e-3 * model.span) continue;
      curve(ctx, x => model.mode(n, x, cfg.t), b, xr, mapper, hues[used], 2);
      panelText(ctx, `n = ${n}`, b.l + 6 + used * 54 * C.scale, b.t + 2, { ...C, ink2: hues[used] });
      used++;
    }
  },
  drawTravel(ctx, w, h, C, cfg, model) {
    const b = this.box(w, h, C), xr = model.range;
    const mapper = axes(ctx, b, xr, this.yRange(model), C, { xTicks: this.xTicks(model) });
    curve(ctx, x => model.right(x, cfg.t), b, xr, mapper, C.hot, 2, [], [6, 4]);
    curve(ctx, x => model.leftw(x, cfg.t), b, xr, mapper, C.blue, 2, [], [6, 4]);
    curve(ctx, x => model.right(x, cfg.t) + model.leftw(x, cfg.t), b, xr, mapper, C.ink, 2.5);
  },
  drawMap(ctx, w, h, C, cfg, model) {
    const b = this.box(w, h, C), key = `${cfg.eq}|${cfg.bc}|${cfg.N}|${cfg.tEnd}|${model.lo}|${model.hi}|${cfg.speed}|${cfg.alpha}|${JSON.stringify(cfg.src.expr)}|${JSON.stringify(cfg.src.params)}|${C.blue}|${C.surface}|${Math.round(b.w)}x${Math.round(b.h)}`;
    if (!this.mapCache || this.mapCache.key !== key || cfg.src.samples) {
      const cols = Math.min(240, Math.ceil(b.w)), rows = Math.min(120, Math.ceil(b.h)), off = document.createElement('canvas');
      off.width = cols; off.height = rows;
      const oc = off.getContext('2d'), img = oc.createImageData(cols, rows), top = Math.max(Math.abs(model.lo), Math.abs(model.hi), 1e-9);
      const [pos, neg, mid] = [hexToRgb(C.hot), hexToRgb(C.blue), hexToRgb(C.surface)];
      for (let r = 0; r < rows; r++) {
        const t = cfg.tEnd * (1 - (r + .5) / rows);
        for (let c = 0; c < cols; c++) {
          const v = Math.max(-1, Math.min(1, model.u(model.range[0] + (c + .5) / cols * (model.range[1] - model.range[0]), t) / top)), to = v > 0 ? pos : neg, m = Math.abs(v), i = 4 * (r * cols + c);
          for (let k = 0; k < 3; k++) img.data[i + k] = mid[k] + (to[k] - mid[k]) * m;
          img.data[i + 3] = 255;
        }
      }
      oc.putImageData(img, 0, 0);
      this.mapCache = { key, off };
    }
    const mapper = axes(ctx, b, model.range, [0, cfg.tEnd], C, { xTicks: this.xTicks(model) });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapCache.off, b.l, b.t, b.w, b.h);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.l, mapper.Y(cfg.t)); ctx.lineTo(b.l + b.w, mapper.Y(cfg.t)); ctx.stroke();
    panelText(ctx, `t = ${fmt(cfg.t, 3)}`, b.l + b.w - 4, Math.max(b.t, mapper.Y(cfg.t) - 18 * C.scale), C, 'right');
  },
  drawAmps(ctx, w, h, C, cfg, model) {
    const b = this.box(w, h, C), hues = [C.blue, C.hot, C.green, C.ink2], modes = [];
    for (let n = 1; n <= cfg.N && modes.length < 4; n++) if (Math.abs(model.coef[n]) + Math.abs(model.velocity ? model.velocity[n] : 0) > 1e-3 * model.span) modes.push(n);
    const top = Math.max(...modes.map(n => Math.abs(model.coef[n]) + Math.abs(model.velocity ? model.velocity[n] / model.omega(n) : 0)), 1e-9);
    const mapper = axes(ctx, b, [0, cfg.tEnd], [-top * 1.1, top * 1.1], C, {});
    modes.forEach((n, i) => { curve(ctx, t => model.amp(n, t), b, [0, cfg.tEnd], mapper, hues[i], 2); panelText(ctx, `n = ${n}`, b.l + 6 + i * 54 * C.scale, b.t + 2, { ...C, ink2: hues[i] }); });
    vline(ctx, mapper.X(cfg.t), b, C.ink);
  },
  drawCoef(ctx, w, h, C, cfg, model) {
    const m0 = 44 * C.scale, count = Math.min(30, cfg.N), slot = (w - m0 - 16) / count;
    let big = 1e-9;
    for (let n = 1; n <= count; n++) big = Math.max(big, Math.abs(model.coef[n]));
    const t = 6, H = h - 14 - 12 * C.scale, zero = t + H / 2, scale = (H / 2 - 2) / big;
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m0, zero); ctx.lineTo(w - 16, zero); ctx.stroke();
    ctx.font = `${C.fs}px ${C.font}`;
    ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(fmt(big, 2), m0 - 6, t + 7);
    for (let n = 1; n <= count; n++) {
      const x = m0 + (n - 1) * slot + slot / 2, v = model.coef[n], bw = Math.max(2, Math.min(12, slot - 4));
      if (Math.abs(v) > big * 1e-3) { const len = Math.max(1.5, Math.abs(v) * scale), r = Math.min(3, bw / 2); ctx.fillStyle = C.blue; ctx.beginPath(); ctx.roundRect(x - bw / 2, v > 0 ? zero - len : zero, bw, len, v > 0 ? [r, r, 0, 0] : [0, 0, r, r]); ctx.fill(); }
      if (n === 1 || n % (slot < 18 ? 5 : 2) === 0) { ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(n, x, t + H + 3); }
    }
  },
  norm(model, t) { const [a, b] = model.range; let s = 0; for (let i = 0; i < 200; i++) { const y = model.u(a + (i + .5) * (b - a) / 200, t); s += y * y; } return s * (b - a) / 200; },
  drawEnergy(ctx, w, h, C, cfg, model) {
    const b = this.box(w, h, C), fn = model.energy ?? (t => this.norm(model, t));
    let top = 1e-9;
    for (let i = 0; i <= 60; i++) top = Math.max(top, fn(cfg.tEnd * i / 60));
    const mapper = axes(ctx, b, [0, cfg.tEnd], [0, top * 1.15], C, {});
    curve(ctx, fn, b, [0, cfg.tEnd], mapper, C.blue, 2.5, [], null, 4);
    dot(ctx, mapper.X(cfg.t), mapper.Y(fn(cfg.t)), C.hot, C);
    panelText(ctx, `${fmt(fn(cfg.t), 4)}`, b.l + b.w - 4, b.t + 2, C, 'right');
  },
  math(cfg, model) {
    if (cfg.bc === 'infinite') {
      if (cfg.eq === 'wave') return '<span class="m"><i>u</i>(<i>x</i>, <i>t</i>) = ½[<i>f</i>(<i>x</i> − <i>ct</i>) + <i>f</i>(<i>x</i> + <i>ct</i>)] + (1/2<i>c</i>)∫<sub><i>x−ct</i></sub><sup><i>x+ct</i></sup> <i>g</i>(<i>s</i>) <i>ds</i></span>';
      return '<span class="m"><i>u</i>(<i>x</i>, <i>t</i>) = (1/(2<i>c</i>√(π<i>t</i>))) ∫ <i>f</i>(<i>v</i>) exp(−(<i>x</i> − <i>v</i>)²/(4<i>c</i>²<i>t</i>)) <i>dv</i></span>';
    }
    if (cfg.bc === 'insulated') return '<span class="m"><i>u</i>(<i>x</i>, <i>t</i>) = <i>A</i><sub>0</sub> + Σ <i>A<sub>n</sub></i> cos(<i>nπx</i>/<i>L</i>) exp(−α(<i>nπ</i>/<i>L</i>)²<i>t</i>)</span>';
    if (cfg.eq === 'heat') return `<span class="m"><i>u</i>(<i>x</i>, <i>t</i>) = ${cfg.left || cfg.right ? 'g(x) + ' : ''}Σ <i>B<sub>n</sub></i> sin(<i>nπx</i>/<i>L</i>) exp(−α(<i>nπ</i>/<i>L</i>)²<i>t</i>)</span>`;
    return '<span class="m"><i>u</i>(<i>x</i>, <i>t</i>) = Σ (<i>B<sub>n</sub></i> cos λ<sub><i>n</i></sub><i>t</i> + <i>B<sub>n</sub></i>* sin λ<sub><i>n</i></sub><i>t</i>) sin(<i>nπx</i>/<i>L</i>), &nbsp; λ<sub><i>n</i></sub> = <i>cnπ</i>/<i>L</i></span>';
  },
  note(cfg, model) {
    if (cfg.bc === 'infinite') return cfg.eq === 'wave' ? '무한 현은 초기 모양이 절반씩 나뉘어 양쪽으로 속력 c로 이동합니다(12.4절 D’Alembert 해).' : '무한 막대는 초기 온도를 열핵과 합성곱합니다. 경계가 없어 온도가 퍼지며 낮아집니다(12.7절).';
    if (cfg.bc === 'insulated') return `단열 막대는 열이 빠져나가지 않아 온도가 초기 평균 ${fmt(model.mean, 3)}로 수렴합니다(12.6절 예제 4·5).`;
    if (cfg.eq === 'heat') { const half = Math.LN2 / model.rate(1); return `높은 차수일수록 exp(−α(nπ/L)²t)가 빨리 사라져 모양이 곧 사인 곡선이 됩니다. n = 1 모드의 크기가 절반이 되는 시간은 ${fmt(half, 3)}입니다(12.6절).`; }
    return `각 모드는 진동수 c·n/(2L)로 진동합니다. n = 1의 주기는 ${fmt(2 * model.L / cfg.speed, 3)}이고 이 시간이 지나면 처음 모양으로 돌아옵니다. 유한 급수이므로 N이 작으면 도약·꺾임이 매끈해집니다(12.3절).`;
  },
  solutionHTML(cfg, model) {
    const L = model.L, name = cfg.bc === 'insulated' ? 'A' : 'B';
    const rows = [1, 2, 3, 4, 5, 6].filter(n => n <= cfg.N).map(n => `<tr><td class="l m"><i>${name}</i><sub>${n}</sub></td><td>${fmt(model.coef[n])}</td><td>${closedForm(model.coef[n])}</td></tr>`).join('');
    const setup = cfg.eq === 'wave' ? `양 끝이 고정된 길이 ${fmt(L, 3)}의 현(c = ${fmt(cfg.speed, 3)})` : `${cfg.bc === 'insulated' ? '양 끝이 단열된' : `양 끝 온도가 ${fmt(cfg.left, 3)}, ${fmt(cfg.right, 3)}인`} 길이 ${fmt(L, 3)}의 막대(α = ${fmt(cfg.alpha, 4)})`;
    return `<p><b>문제.</b> ${setup}에서 ${cfg.eq === 'wave' ? '초기 변위' : '초기 온도'} <code>${escapeHTML(sourceText(cfg.src))}</code>일 때 u(x, t)를 구하십시오.</p>
      <ol class="solve"><li><b>변수분리.</b> u = F(x)G(t)로 놓으면 ${cfg.bc === 'insulated' ? 'F = cos(nπx/L)' : 'F = sin(nπx/L)'}이고 ${cfg.eq === 'wave' ? 'G = B cos λt + B* sin λt, λ = cnπ/L' : 'G = exp(−α(nπ/L)²t)'}입니다.</li>
      <li><b>초기조건.</b> ${cfg.bc === 'insulated' ? '코사인' : '사인'} 급수의 계수를 구합니다.${cfg.bc === 'insulated' ? ` A₀ = ${fmt(model.mean)}` : ''}<div class="tblwrap"><table><thead><tr><th class="l">계수</th><th>수치</th><th>닫힌 꼴(추정)</th></tr></thead><tbody>${rows}</tbody></table></div></li>
      <li><b>결론.</b> ${cfg.eq === 'wave' ? `n차 모드의 진동수는 ${fmt(cfg.speed / (2 * L), 4)}·n입니다.` : cfg.bc === 'insulated' ? `t → ∞이면 온도는 ${fmt(model.mean, 4)}로 수렴합니다.` : `t → ∞이면 온도는 ${cfg.left || cfg.right ? '양 끝 온도를 잇는 직선' : '0'}으로 수렴합니다.`}</li></ol>
      <p class="hint">계수는 수치 적분값이고, 닫힌 꼴은 수치에 맞는 간단한 분수를 찾은 추정입니다.</p>`;
  },
  newProblem: () => pdeProblem(),
  applyProblem(cfg, problem) {
    const a = problem.apply;
    cfg.eq = a.eq; cfg.bc = a.bc; cfg.L = a.L; cfg.src = { expr: a.expr, params: { ...a.params }, samples: null };
    cfg.vel = a.vel ?? '0'; if (a.speed) cfg.speed = a.speed; if (a.alpha) cfg.alpha = a.alpha;
    cfg.left = 0; cfg.right = 0; cfg.tEnd = a.tEnd; cfg.t = 0; cfg.N = 20; cfg.example = null;
  },
};
