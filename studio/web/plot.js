'use strict';
/* 캔버스 그래프 공용 함수. 색은 style.css의 토큰에서 읽습니다. */
function themeColors() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  const scale = parseFloat(cs.fontSize) / 16;
  return { ink: g('--ink'), ink2: g('--ink2'), muted: g('--muted'), line: g('--line'), grid: g('--grid'), band: g('--band'),
    surface: g('--surface'), blue: g('--blue'), hot: g('--hot'), green: g('--green'), pos: g('--pos-fill'), neg: g('--neg-fill'),
    font: getComputedStyle(document.body).fontFamily, scale, fs: Math.round(13 * scale) };
}
function fmt(v, d = 4) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) < .5 * 10 ** -d) return '0';
  return v.toFixed(d).replace(/\.?0+$/, '').replace('-', '−');
}
function piLabel(x, L) {
  if (Math.abs(x) < 1e-9 * L) return '0';
  const isPi = Math.abs(L - PI) < 1e-9, unit = isPi ? PI : 1, k = x / unit;
  if (!isPi) return fmt(x, 2);
  for (const [q, t] of [[1, ''], [2, '/2'], [3, '/3'], [4, '/4'], [6, '/6']]) {
    const p = k * q;
    if (Math.abs(p - Math.round(p)) < 1e-6) { const r = Math.round(p), a = Math.abs(r); return `${r < 0 ? '−' : ''}${a > 1 ? a : ''}π${t}`; }
  }
  return fmt(x, 2);
}
function prepare(c) {
  const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  c.width = Math.max(1, Math.round(r.width * d)); c.height = Math.max(1, Math.round(r.height * d));
  const ctx = c.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return { ctx, w: r.width, h: r.height };
}
const niceStep = (range, count = 4) => { const raw = range / count, e = 10 ** Math.floor(Math.log10(raw)), f = raw / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };

const tickText = v => Math.abs(v) >= 1e4 ? `${fmt(v / 1000, 1)}k` : fmt(v, 3);

/** 격자와 눈금을 그리고 좌표 변환을 돌려줍니다. xTicks는 [[값, 글자], …]입니다. */
function axes(ctx, b, xr, yr, C, opt = {}) {
  const X = x => b.l + (x - xr[0]) / (xr[1] - xr[0]) * b.w, Y = y => b.t + (yr[1] - y) / (yr[1] - yr[0]) * b.h;
  if (opt.band) { ctx.fillStyle = C.band; const a = Math.max(b.l, X(opt.band[0])), z = Math.min(b.l + b.w, X(opt.band[1])); ctx.fillRect(a, b.t, z - a, b.h); }
  const size = opt.fontSize ?? C.fs ?? 13;
  ctx.font = `${size}px ${C.font}`;
  ctx.lineWidth = 1;
  const ys = niceStep(yr[1] - yr[0], Math.max(2, Math.min(6, Math.floor(b.h / (2.6 * size)))));
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = Math.ceil(yr[0] / ys) * ys; v <= yr[1] + 1e-9; v += ys) {
    ctx.strokeStyle = Math.abs(v) < ys * 1e-6 ? C.muted : C.grid;
    ctx.beginPath(); ctx.moveTo(b.l, Y(v)); ctx.lineTo(b.l + b.w, Y(v)); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillText(tickText(v), b.l - 6, Y(v));
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let ticks = opt.xTicks;
  if (!ticks) { const st = niceStep(xr[1] - xr[0], Math.max(2, Math.min(8, Math.floor(b.w / (5 * size))))); ticks = []; for (let v = Math.ceil(xr[0] / st) * st; v <= xr[1] + 1e-9; v += st) ticks.push([v, fmt(v, 2)]); }
  for (const [v, label] of ticks) {
    if (v < xr[0] - 1e-9 || v > xr[1] + 1e-9) continue;
    ctx.strokeStyle = Math.abs(v) < 1e-9 ? C.muted : C.grid;
    ctx.beginPath(); ctx.moveTo(X(v), b.t); ctx.lineTo(X(v), b.t + b.h); ctx.stroke();
    if (!opt.noXLabels) { ctx.fillStyle = C.muted; ctx.fillText(label, X(v), b.t + b.h + 5); }
  }
  if (opt.xLabel) { ctx.fillStyle = C.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(opt.xLabel, b.l + b.w, b.t + b.h - 2); }
  return { X, Y };
}
/** 도약(breaks)에서 선을 끊어 그립니다. */
function curve(ctx, fn, b, xr, m, color, width = 2.5, breaks = [], dash = null, stepPx = 1) {
  ctx.save();
  ctx.beginPath(); ctx.rect(b.l, b.t, b.w, b.h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  const steps = Math.ceil(b.w / stepPx), dx = (xr[1] - xr[0]) / steps;
  ctx.beginPath();
  let started = false, bi = 0;
  const sorted = breaks.filter(v => v > xr[0] && v < xr[1]).sort((p, q) => p - q);
  const eps = (xr[1] - xr[0]) * 1e-7;
  const clampY = y => Math.max(-1e4, Math.min(1e4, m.Y(y)));
  for (let i = 0; i <= steps; i++) {
    const x = i === steps ? xr[1] - eps : xr[0] + i * dx;
    while (bi < sorted.length && sorted[bi] <= x) {
      const c = sorted[bi++];
      if (started) ctx.lineTo(m.X(c), clampY(fn(c - eps)));
      ctx.moveTo(m.X(c), clampY(fn(c + eps)));
      started = true;
    }
    const y = clampY(fn(x));
    if (started) ctx.lineTo(m.X(x), y); else { ctx.moveTo(m.X(x), y); started = true; }
  }
  ctx.stroke();
  ctx.restore();
}
function dot(ctx, x, y, color, C, r = 5) {
  ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fillStyle = C.surface; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = color; ctx.fill();
}
function panelText(ctx, text, x, y, C, align = 'left') {
  ctx.fillStyle = C.ink2; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.font = `${C.fs ?? 13}px ${C.font}`;
  ctx.fillText(text, x, y);
}
function vline(ctx, x, b, color, dash = [4, 4]) {
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x, b.t); ctx.lineTo(x, b.t + b.h); ctx.stroke(); ctx.setLineDash([]);
}
