'use strict';
/* 그래프 그리기: 개념마다 한 칸(PANELS)과 그리기 도구. */
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
  return { xr, yr, width };
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
      probe: x => [['f', model.f(x)], ['파동', basis(x)], ['곱', model.f(x) * basis(x)]], pick: x => [['f', model.f(x)], ['파동', basis(x)]] };
  },
  spectrum(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, b = box(w, h, C);
    const fr = bars(ctx, b, C, [[C.hot, n => model.a[n]], [C.blue, n => model.b[n]]], cfg.N, ref ? [[C.green, n => ref.R.series.a[n]], [C.green, n => ref.R.series.b[n]]] : []);
    const at = x => Math.max(1, Math.min(NMAX, Math.round(x)));
    return { title: '차수별 계수', frame: { b, xr: fr.xr, yr: fr.yr }, snap: at, pick: x => [[`a${at(x)}`, model.a[at(x)], -fr.width / 2], [`b${at(x)}`, model.b[at(x)], fr.width / 2]], legend: [['--hot', '<i>a<sub>n</sub></i>', 'fill'], ['--blue', '<i>b<sub>n</sub></i>', 'fill'], ...(ref ? [pinLabel('계수')] : [])],
      probe: x => [['n', at(x)], [`a${at(x)}`, model.a[at(x)]], [`b${at(x)}`, model.b[at(x)]]] };
  },
  gibbs(ctx, w, h, C, cfg, R, ref) {
    const model = R.series, J = model.jumps[(cfg.jumpIndex ?? 1) - 1] ?? model.jumps[0], b = box(w, h, C);
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
  transform(ctx, w, h, C, cfg, R, ref) {
    const T = R.transform, [p, q] = stacked(w, h, C, .55), xr = rangeX([-T.X, T.X], R), yr = rangeY(T.yr, R);
    const M = axes(ctx, p, xr, yr, C, {});
    curve(ctx, T.f, p, xr, M, C.ink, 2.5);
    const refT = ref?.R.transform;
    if (refT) curve(ctx, refT.recon, p, xr, M, C.green, 2.5, [], [7, 5], 2);
    curve(ctx, T.recon, p, xr, M, C.blue, 3, [], null, 2);
    let peak = 1e-9;
    for (const v of [...T.A, ...T.B]) peak = Math.max(peak, Math.abs(v));
    const wr = [0, T.wMax], M2 = axes(ctx, q, wr, [-peak * 1.15, peak * 1.15], C, {}), at = arr => w0 => arr[Math.max(0, Math.min(arr.length - 1, Math.round(w0 / T.wMax * (arr.length - 1))))];
    curve(ctx, at(T.A), q, wr, M2, C.hot, 2); curve(ctx, at(T.B), q, wr, M2, C.blue, 2, [], [6, 4]);
    panelText(ctx, '아래: 진동수 w에 따른 A(w), B(w)', q.l + q.w - 6, q.t + 2, C, 'right');
    return { title: `Fourier 적분 (위끝 a = ${fmt(T.wMax, 3)})`, frame: { b: p, xr, yr },
      legend: [['--ink', fx], ['--blue', '적분으로 다시 만든 f'], ['--hot', '<i>A</i>(<i>w</i>)'], ['--blue', '<i>B</i>(<i>w</i>)', true], ...(refT ? [pinLabel(`a = ${fmt(ref.R.transform.wMax, 3)}`)] : [])],
      probe: x => [['f', T.f(x)], ['적분', T.recon(x)]] };
  },
  membrane(ctx, w, h, C, cfg, R, ref) {
    const Mb = R.membrane, t = timeOf(Mb, cfg), [p, q] = stacked(w, h, C, .62), xr = [0, Mb.a], yb = [0, Mb.b];
    axes(ctx, p, xr, yb, C, { xTicks: piTicks(xr, Mb.a, Mb.a / 4), noXLabels: true });
    const W = 96, H = 64, off = document.createElement('canvas'); off.width = W; off.height = H;
    const c2 = off.getContext('2d'), img = c2.createImageData(W, H), field = new Float64Array(W * H);
    // 모드별 계수 C_mn(t)로 u(x, y) = Σ C_mn sin(mπx/a) sin(nπy/b)를 행렬처럼 계산합니다.
    Mb.sx ??= Array.from({ length: Mb.M + 1 }, (_, m) => Float64Array.from({ length: W }, (_, i) => Math.sin(m * PI * (i + .5) / W)));
    Mb.sy ??= Array.from({ length: Mb.M + 1 }, (_, n) => Float64Array.from({ length: H }, (_, j) => Math.sin(n * PI * (1 - (j + .5) / H))));
    for (const [m, n, B, l] of Mb.terms) { const cB = B * Math.cos(l * t), sx = Mb.sx[m], sy = Mb.sy[n]; for (let j = 0; j < H; j++) { const k = cB * sy[j]; for (let i = 0; i < W; i++) field[j * W + i] += k * sx[i]; } }
    for (let k = 0; k < W * H; k++) {
      const s = Math.max(-1, Math.min(1, field[k] / Mb.zmax)), rgb = s < 0 ? mix([246, 246, 246], [31, 95, 208], -s) : mix([246, 246, 246], [207, 74, 18], s);
      img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    ctx.drawImage(off, p.l, p.t, p.w, p.h);
    const cut = x => Mb.u(x, Mb.b / 2, t), cut0 = x => Mb.u(x, Mb.b / 2, 0);
    let top = 1e-9; for (let i = 0; i <= 60; i++) top = Math.max(top, Math.abs(cut0(i / 60 * Mb.a)));
    const yr2 = [-top * 1.3, top * 1.3], M2 = axes(ctx, q, xr, yr2, C, { xTicks: piTicks(xr, Mb.a, Mb.a / 4) });
    curve(ctx, cut0, q, xr, M2, C.muted, 1.5, [], [6, 5]); curve(ctx, cut, q, xr, M2, C.blue, 3);
    panelText(ctx, '아래: 가운데 줄(y = b/2)의 단면', q.l + q.w - 6, q.t + 2, C, 'right');
    return { title: `막의 진동  t = ${fmt(t, 3)} (위: 위에서 본 모양, 주황 위·파랑 아래)`, frame: { b: q, xr, yr: yr2 },
      legend: [['--blue', '<i>u</i>(<i>x</i>, <i>b</i>/2, <i>t</i>)'], ['--muted', '처음 단면', true]], probe: x => [['u(x, b/2)', cut(x)], ['처음', cut0(x)]] };
  },
  wave(ctx, w, h, C, cfg, R, ref) {
    const W = R.wave, t = timeOf(W, cfg), b = box(w, h, C), finite = cfg.waveDomain === 'finite', xr = rangeX(finite ? [0, W.L] : [-W.X, W.X], R), yr = rangeY(W.yr, R);
    const M = axes(ctx, b, xr, yr, C, finite ? { xTicks: piTicks(xr, W.L, W.L / 4) } : {});
    curve(ctx, R.f, b, xr, M, C.muted, 1.5, [], [6, 5]);
    if (!finite && W.restWave) { curve(ctx, x => W.right(x, t), b, xr, M, C.hot, 1.5, [], [3, 4]); curve(ctx, x => W.leftw(x, t), b, xr, M, C.green, 1.5, [], [3, 4]); }
    const refW = ref?.R.wave;
    if (refW) curve(ctx, x => refW.u(x, timeOf(refW, cfg)), b, xr, M, C.green, 2.5, [], [7, 5]);
    curve(ctx, x => W.u(x, t), b, xr, M, C.blue, 3, [], null, finite ? 1 : 2);
    return { title: finite ? `현의 진동${W.free ? '(자유 끝)' : ''}${W.damping > 0 ? `(감쇠 k = ${fmt(W.damping, 3)})` : ''}  t = ${fmt(t, 3)}` : `무한히 긴 현  t = ${fmt(t, 3)}`, frame: { b, xr, yr },
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
/** 점을 찍을 수 있는 곡선: [이름, 값, 가로 어긋남(px)]. 그래프 칸이 pick을 주지 않으면 값 읽기(probe) 중 숫자인 줄입니다. */
const pickLines = (f, x) => (f.pick ?? f.probe)(x).filter(l => isFinite(l[1]));
/** 그래프 위 (x, y)에 가장 가까운 곡선의 점입니다. 그래프 밖이면 null입니다. */
function markAt(f, x, y) {
  if (!f || x === null || x < f.xr[0] || x > f.xr[1] || y < f.yr[0] || y > f.yr[1]) return null;
  const sx = f.snap ? f.snap(x) : x, lines = pickLines(f, sx);
  if (!lines.length) return null;
  let i = 0;
  lines.forEach((l, k) => { if (Math.abs(l[1] - y) < Math.abs(lines[i][1] - y)) i = k; });
  return { x: sx, i };
}
/** 저장된 점(예전 파일은 x만)을 화면 좌표로 바꿉니다. */
function markPoint(f, m) {
  const { x, i = 0 } = typeof m === 'number' ? { x: m } : m, lines = pickLines(f, x), line = lines[Math.min(i, lines.length - 1)];
  if (!line || x < f.xr[0] || x > f.xr[1] || line[1] < f.yr[0] || line[1] > f.yr[1]) return null;
  return { x, y: line[1], name: line[0], px: f.b.l + (x - f.xr[0]) / (f.xr[1] - f.xr[0]) * f.b.w + (line[2] ?? 0), py: f.b.t + (f.yr[1] - line[1]) / (f.yr[1] - f.yr[0]) * f.b.h };
}
/** 체크한 개념 중 그래프가 있는 것입니다(그림을 담지 않은 예제의 Word 그림). */
const panelIds = cfg => ['series', 'coef', 'spectrum', 'gibbs', 'transform', 'wave', 'membrane', 'heat'].filter(id => cfg.on[id]);
const TIME_VIEW = cfg => cfg.on.membrane ? 'membrane' : cfg.on.wave ? 'wave' : cfg.on.heat ? 'heat' : null;
const LOOK_VIEW = cfg => ['gibbs', 'spectrum', 'coef'].find(k => cfg.on[k]) ?? null;
/** 개념 카드마다 보여 줄 그래프입니다. 카드가 없으면 null입니다. */
const layerView = (cfg, id) => ({ base: 'series', domain: cfg.on.transform ? 'transform' : cfg.on.half ? 'series' : null, look: LOOK_VIEW(cfg), time: TIME_VIEW(cfg),
  dim: cfg.on.membrane ? 'membrane' : null, damp: cfg.on.wave && cfg.axes?.damp === 'on' && cfg.waveDomain === 'finite' && !cfg.on.membrane ? 'wave' : null })[id] ?? null;
/** 화면의 그래프: 고른 개념 카드(cfg.focus)의 그래프이고, 고르지 않았으면 시간 변화, 적분, 급수 분석, 급수 순서입니다. */
const viewOf = cfg => (cfg.focus && layerView(cfg, cfg.focus)) || TIME_VIEW(cfg) || (cfg.on.transform ? 'transform' : null) || LOOK_VIEW(cfg) || 'series';
/** 지금 그래프에 해당하는 개념 설명입니다. */
const deepestOf = cfg => { const v = viewOf(cfg); return v === 'series' && cfg.on.half ? 'half' : v; };
const conceptOf = id => CONCEPTS.find(c => c.id === id);
function legendHtml(items) { return items.map(([c, t, kind]) => `<span><b class="sw ${kind === true ? 'dashed' : kind || ''}" style="--c:var(${c})"></b><span class="lt">${t}</span></span>`).join(''); }
