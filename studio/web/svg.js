'use strict';
/* 그래프 그리기 함수(plot.js, draw.js)가 쓰는 캔버스 명령을 SVG로 옮겨 적습니다. Word에서 그림을 도형으로 바꿔 고칠 수 있게 합니다. */
const svgNum = v => Math.round(v * 100) / 100;
/** 'rgba(r,g,b,a)'는 색과 불투명도로 나눕니다(SVG 1.1과 Word에 맞춤). */
function svgColor(v) {
  const m = String(v).match(/rgba?\(([^)]+)\)/);
  if (!m) return [String(v), 1];
  const [r, g, b, a = 1] = m[1].split(',').map(x => parseFloat(x));
  return [`rgb(${r},${g},${b})`, a];
}
class SvgContext {
  constructor(w, h) {
    this.w = w; this.h = h; this.out = []; this.path = ''; this.stack = []; this.clips = 0;
    this.st = { stroke: '#000', fill: '#000', lw: 1, font: '13px sans-serif', align: 'start', base: 'alphabetic', dash: [], alpha: 1, clip: null, cap: 'butt', join: 'miter' };
  }
  set strokeStyle(v) { this.st.stroke = v; } get strokeStyle() { return this.st.stroke; }
  set fillStyle(v) { this.st.fill = v; } get fillStyle() { return this.st.fill; }
  set lineWidth(v) { this.st.lw = v; } get lineWidth() { return this.st.lw; }
  set font(v) { this.st.font = v; } get font() { return this.st.font; }
  set textAlign(v) { this.st.align = v; } get textAlign() { return this.st.align; }
  set textBaseline(v) { this.st.base = v; } get textBaseline() { return this.st.base; }
  set globalAlpha(v) { this.st.alpha = v; } get globalAlpha() { return this.st.alpha; }
  set lineCap(v) { this.st.cap = v; } set lineJoin(v) { this.st.join = v; }
  set imageSmoothingEnabled(_) { /* 무시 */ }
  save() { this.stack.push({ ...this.st, dash: [...this.st.dash] }); }
  restore() { if (this.stack.length) this.st = this.stack.pop(); }
  setTransform() { /* 크기는 그대로 씁니다 */ }
  clearRect() { /* 빈 그림에서 시작합니다 */ }
  setLineDash(d) { this.st.dash = [...d]; }
  beginPath() { this.path = ''; }
  moveTo(x, y) { this.path += `M${svgNum(x)} ${svgNum(y)}`; }
  lineTo(x, y) { this.path += `L${svgNum(x)} ${svgNum(y)}`; }
  closePath() { this.path += 'Z'; }
  rect(x, y, w, h) { this.path += `M${svgNum(x)} ${svgNum(y)}h${svgNum(w)}v${svgNum(h)}h${svgNum(-w)}Z`; }
  arc(x, y, r) { this.path += `M${svgNum(x + r)} ${svgNum(y)}A${svgNum(r)} ${svgNum(r)} 0 1 1 ${svgNum(x - r)} ${svgNum(y)}A${svgNum(r)} ${svgNum(r)} 0 1 1 ${svgNum(x + r)} ${svgNum(y)}Z`; }
  clip() { const id = `c${++this.clips}`; this.out.push(`<clipPath id="${id}"><path d="${this.path}"/></clipPath>`); this.st.clip = id; }
  common() { return `${this.st.clip ? ` clip-path="url(#${this.st.clip})"` : ''}${this.st.alpha < 1 ? ` opacity="${this.st.alpha}"` : ''}`; }
  strokeAttrs() { const [c, a] = svgColor(this.st.stroke); return ` fill="none" stroke="${c}"${a < 1 ? ` stroke-opacity="${a}"` : ''} stroke-width="${svgNum(this.st.lw)}" stroke-linecap="${this.st.cap}" stroke-linejoin="${this.st.join}"${this.st.dash.length ? ` stroke-dasharray="${this.st.dash.join(' ')}"` : ''}`; }
  fillAttrs() { const [c, a] = svgColor(this.st.fill); return ` fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}`; }
  stroke() { if (this.path) this.out.push(`<path d="${this.path}"${this.strokeAttrs()}${this.common()}/>`); }
  fill() { if (this.path) this.out.push(`<path d="${this.path}"${this.fillAttrs()}${this.common()}/>`); }
  fillRect(x, y, w, h) { this.out.push(`<rect x="${svgNum(x)}" y="${svgNum(y)}" width="${svgNum(w)}" height="${svgNum(h)}"${this.fillAttrs()}${this.common()}/>`); }
  strokeRect(x, y, w, h) { this.out.push(`<rect x="${svgNum(x)}" y="${svgNum(y)}" width="${svgNum(w)}" height="${svgNum(h)}"${this.strokeAttrs()}${this.common()}/>`); }
  measureText(t) { const c = SvgContext.ruler ??= document.createElement('canvas').getContext('2d'); c.font = this.st.font; return c.measureText(t); }
  fillText(t, x, y) {
    const size = parseFloat(this.st.font) || 13, family = this.st.font.replace(/^[^ ]+\s+/, '').replace(/"/g, "'");
    const anchor = { left: 'start', start: 'start', center: 'middle', right: 'end', end: 'end' }[this.st.align] ?? 'start';
    const dy = { top: .82, hanging: .82, middle: .35, bottom: -.22 }[this.st.base] ?? 0;
    this.out.push(`<text x="${svgNum(x)}" y="${svgNum(y + dy * size)}" font-size="${svgNum(size)}" font-family="${family}" text-anchor="${anchor}"${this.fillAttrs()}${this.common()}>${esc(t)}</text>`);
  }
  drawImage(img, x, y, w, h) { const href = img.toDataURL?.('image/png') ?? ''; this.out.push(`<image x="${svgNum(x)}" y="${svgNum(y)}" width="${svgNum(w)}" height="${svgNum(h)}" preserveAspectRatio="none" xlink:href="${href}" href="${href}"${this.common()}/>`); }
  toString() { return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}"><rect width="100%" height="100%" fill="#ffffff"/>${this.out.join('')}</svg>`; }
}
