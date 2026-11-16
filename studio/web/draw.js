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
/** 개념 모듈(modules/*.js)이 PANELS에 자기 그래프를 넣고, 여기서는 여러 주제가 함께 쓰는 고유함수 그래프만 넣습니다. */
Object.assign(PANELS, {
  eigen(ctx, w, h, C, cfg, R) {
    const p = cfg.prob ?? { domain: 'periodic', left: 'fixed' }, fam = familyOf(cfg), L = R.L, b = box(w, h, C), periodic = p.domain === 'periodic', k = n => n * PI / L;
    const name = (fn, n) => `${fn}(${n > 1 ? n : ''}π<i>x</i>/<i>L</i>)`;
    const fns = periodic ? [[name('cos', 1), x => Math.cos(k(1) * x)], [name('sin', 1), x => Math.sin(k(1) * x)], [name('cos', 2), x => Math.cos(k(2) * x)], [name('sin', 2), x => Math.sin(k(2) * x)]]
      : [0, 1, 2, 3].map(i => fam.n0 + i).map(n => [fam.label(n), x => fam.phi(n, x, L)]);
    const span = spanOf(fam, L), xr = rangeX(periodic ? [-L, L] : span, R), yr = rangeY([-1.35, 1.35], R), M = axes(ctx, b, xr, yr, C, fam.span ? {} : { xTicks: piTicks(xr, L) });
    const colors = [C.blue, C.hot, C.green, C.muted], vars = ['--blue', '--hot', '--green', '--muted'];
    fns.forEach(([, fn], i) => curve(ctx, fn, b, xr, M, colors[i], i ? 2 : 3));
    if (!periodic) fam.ends.forEach((e, i) => { if (e === 'fixed') dot(ctx, M.X(span[i]), M.Y(0), C.ink, C, 5); });
    const title = periodic ? '기저 함수 (한 주기에서 직교)' : p.domain === 'rect' ? `x 방향 고유함수: ${fam.title.replace(/x = L/g, 'x = a')}` : `고유함수: ${fam.title}`;
    return { title, frame: { b, xr, yr }, legend: fns.map(([n], i) => [vars[i], n]), probe: x => fns.map(([n, fn]) => [n.replace(/<[^>]+>/g, ''), fn(x)]) };
  },
});
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
const panelIds = cfg => MODULES.flatMap(mod => cfg.on[mod.id] ? Object.keys(mod.panels ?? {}) : []);
/** 화면의 그래프: 고른 풀이 단계(없으면 마지막 단계)의 그래프입니다. */
const viewOf = cfg => cfg.prob ? stageOf(cfg).panel : 'series';
/** 지금 그래프에 해당하는 개념 설명입니다. */
const deepestOf = cfg => { const v = viewOf(cfg); return (v === 'series' || v === 'eigen') && cfg.on.half ? 'half' : v === 'eigen' ? 'series' : v; };
const conceptOf = id => CONCEPTS.find(c => c.id === id);
function legendHtml(items) { return items.map(([c, t, kind]) => `<span><b class="sw ${kind === true ? 'dashed' : kind || ''}" style="--c:var(${c})"></b><span class="lt">${t}</span></span>`).join(''); }
