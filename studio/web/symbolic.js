'use strict';
/* 손 풀이 수준의 일반항: 구간별 다항식 함수(sign, |x|, step 포함)의 Fourier 계수를 정확한 유리수 계산과 부분적분 공식으로 구합니다.
   구간의 끝은 L의 유리수배여야 합니다. 지원하지 않는 함수(sin, exp 등)이면 null을 돌려주며, 그때 풀이는 수치 계산만 씁니다.
   만든 일반항은 n = 1~8에서 수치 적분과 대조해 맞을 때만 씁니다(symbolicCoefficients). */

/* ── 유리수 ── */
const gcdInt = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
class Fr {
  constructor(n, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error('유리수가 아닙니다.');
    if (d < 0) { n = -n; d = -d; }
    const g = gcdInt(n, d) || 1;
    this.n = n / g; this.d = d / g;
    if (Math.abs(this.n) > 1e12 || this.d > 1e12) throw new Error('수가 너무 큽니다.');
  }
  add(o) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  neg() { return new Fr(-this.n, this.d); }
  sub(o) { return this.add(o.neg()); }
  mul(o) { return new Fr(this.n * o.n, this.d * o.d); }
  div(o) { if (!o.n) throw new Error('0으로 나눕니다.'); return new Fr(this.n * o.d, this.d * o.n); }
  pow(k) { let r = new Fr(1); for (let i = 0; i < k; i++) r = r.mul(this); return r; }
  get zero() { return this.n === 0; }
  get value() { return this.n / this.d; }
}
const FR0 = new Fr(0), FR1 = new Fr(1);
/** 입력한 수(0.25, 3)를 유리수로 바꿉니다. */
function frOf(v) {
  if (Number.isInteger(v)) return new Fr(v);
  for (let d = 2; d <= 1000; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-12 * Math.max(1, Math.abs(v))) return new Fr(n, d); }
  throw new Error('유리수가 아닌 값입니다.');
}

/* ── π의 다항식: Σ c·π^p (p는 음수도 됨) ── */
class Pi {
  constructor(m = new Map()) { this.m = m; }
  static of(fr, p = 0) { const m = new Map(); if (!fr.zero) m.set(p, fr); return new Pi(m); }
  add(o) { const m = new Map(this.m); for (const [p, c] of o.m) { const v = (m.get(p) ?? FR0).add(c); if (v.zero) m.delete(p); else m.set(p, v); } return new Pi(m); }
  neg() { return new Pi(new Map([...this.m].map(([p, c]) => [p, c.neg()]))); }
  sub(o) { return this.add(o.neg()); }
  mul(o) { let r = new Pi(); for (const [p, c] of this.m) for (const [q, e] of o.m) r = r.add(Pi.of(c.mul(e), p + q)); return r; }
  get zero() { return this.m.size === 0; }
  get value() { let s = 0; for (const [p, c] of this.m) s += c.value * PI ** p; return s; }
  /** 단항식이면 [π의 지수, 계수], 아니면 null입니다. */
  mono() { if (this.zero) return [0, FR0]; return this.m.size === 1 ? [...this.m][0] : null; }
  inv() { const mo = this.mono(); if (!mo || mo[1].zero) throw new Error('이 값으로는 나눌 수 없습니다.'); return Pi.of(FR1.div(mo[1]), -mo[0]); }
  same(o) { return this.sub(o).zero; }
}
const PI0 = new Pi(), PI1 = Pi.of(FR1);

/* ── 구간별 다항식: cuts(오름차순 경계)로 나뉜 구간마다 x의 다항식(계수 배열) ── */
const padd = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? PI0).add(b[i] ?? PI0));
const pmul = (a, b) => { const r = Array.from({ length: a.length + b.length - 1 }, () => PI0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = r[i + j].add(x.mul(y)); })); return r; };
const ptrim = a => { const r = [...a]; while (r.length > 1 && r.at(-1).zero) r.pop(); return r; };
const pwConst = c => ({ cuts: [], polys: [[c]] });
const pwX = () => ({ cuts: [], polys: [[PI0, PI1]] });
const samplesOf = cuts => { const v = cuts.map(c => c.value); if (!v.length) return [0]; return [v[0] - 1, ...v.slice(1).map((x, i) => (v[i] + x) / 2), v.at(-1) + 1]; };
const polyAt = (pw, x) => pw.polys[pw.cuts.filter(c => c.value < x).length];
function mergeCuts(...lists) {
  const out = [];
  for (const c of lists.flat()) if (!out.some(o => Math.abs(o.value - c.value) < 1e-12)) out.push(c);
  return out.sort((a, b) => a.value - b.value);
}
function combine(a, b, op) { const cuts = mergeCuts(a.cuts, b.cuts); return { cuts, polys: samplesOf(cuts).map(x => ptrim(op(polyAt(a, x), polyAt(b, x)))) }; }
const single = pw => pw.cuts.length === 0 ? pw.polys[0] : null;
/** 상수(구간 없이 x를 포함하지 않는 값)이면 그 값을, 아니면 null을 돌려줍니다. */
const constOf = pw => { const p = single(pw); return p && ptrim(p).length === 1 ? p[0] : null; };

/** 수식을 구간별 다항식으로 읽습니다. 지원하지 않는 식이면 예외를 던집니다. L은 Pi 값, params는 변수 값입니다. */
function parsePiecewise(text, L, params = {}) {
  const t = tokenize(text);
  let p = 0;
  const peek = () => t[p], eat = v => { if (t[p] !== v) throw new Error(`'${v}'가 필요합니다.`); p++; };
  const isNum = v => v !== undefined && /^[\d.]/.test(v), isId = v => v !== undefined && /^[A-Za-z_]/.test(v);
  /** l op r 꼴의 조건: x의 일차식이 0보다 작은지/큰지로 바꿉니다. */
  function condition(l, op, r) {
    const d = single(combine(l, r, (a, b) => padd(a, b.map(c => c.neg()))));
    if (!d || ptrim(d).length !== 2) throw new Error('조건은 x의 일차식이어야 합니다.');
    const [b0, a1] = d, cut = b0.neg().mul(a1.inv());
    return { cut, leftTrue: (op === '<' || op === '<=') !== (a1.value < 0) };
  }
  function ternary() {
    const c = compare();
    if (peek() !== '?') { if (c.cut) throw new Error('조건만 있는 식입니다.'); return c; }
    if (!c.cut) throw new Error('조건식이 필요합니다.');
    p++;
    const a = ternary(); eat(':');
    const b = ternary(), cuts = mergeCuts(a.cuts, b.cuts, [c.cut]);
    return { cuts, polys: samplesOf(cuts).map(x => polyAt((x < c.cut.value) === c.leftTrue ? a : b, x)) };
  }
  function compare() {
    const l = add(), op = peek();
    if (!['<', '>', '<=', '>='].includes(op)) return l;
    p++;
    return condition(l, op, add());
  }
  function add() {
    let l = mul();
    while (peek() === '+' || peek() === '-') { const op = t[p++], r = mul(); l = combine(l, r, op === '+' ? padd : (a, b) => padd(a, b.map(c => c.neg()))); }
    return l;
  }
  function mul() {
    let l = unary();
    for (;;) {
      const v = peek();
      if (v === '*') { p++; l = combine(l, unary(), pmul); }
      else if (v === '/') { p++; const r = constOf(unary()); if (!r) throw new Error('상수로만 나눌 수 있습니다.'); const inv = r.inv(); l = combine(l, pwConst(inv), pmul); }
      else if (isNum(v) || isId(v) || v === '(') l = combine(l, unary(), pmul);
      else return l;
    }
  }
  function unary() {
    if (peek() === '-') { p++; const a = unary(); return combine(a, pwConst(PI1.neg()), pmul); }
    if (peek() === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const b = primary();
    if (peek() !== '^') return b;
    p++;
    const e = constOf(unary())?.mono();
    if (!e || e[0] !== 0 || e[1].d !== 1 || e[1].n < 0 || e[1].n > 6) throw new Error('거듭제곱은 0~6의 정수만 됩니다.');
    let r = pwConst(PI1);
    for (let i = 0; i < e[1].n; i++) r = combine(r, b, pmul);
    return r;
  }
  /** abs, sign, step: 인수는 x의 일차식이어야 합니다. */
  function kink(name, arg) {
    const d = single(arg);
    if (!d || ptrim(d).length !== 2) throw new Error(`${name}의 인수는 x의 일차식이어야 합니다.`);
    const [b0, a1] = d, cut = b0.neg().mul(a1.inv()), up = a1.value > 0;   // up이면 cut 오른쪽에서 인수가 양수
    const signPw = { cuts: [cut], polys: [[up ? PI1.neg() : PI1], [up ? PI1 : PI1.neg()]] };
    if (name === 'sign') return signPw;
    if (name === 'step') return { cuts: [cut], polys: [[up ? PI0 : PI1], [up ? PI1 : PI0]] };
    return combine(signPw, arg, pmul);
  }
  function primary() {
    const v = t[p++];
    if (v === undefined) throw new Error('수식이 끝났습니다.');
    if (v === '(') { const e = ternary(); eat(')'); return e; }
    if (isNum(v)) return pwConst(Pi.of(frOf(parseFloat(v))));
    if (!isId(v)) throw new Error(`'${v}'를 쓸 수 없습니다.`);
    if (v === 'x') return pwX();
    if (v === 'pi') return pwConst(Pi.of(FR1, 1));
    if (v === 'L') return pwConst(L);
    if (['abs', 'sign', 'step'].includes(v)) { eat('('); const a = ternary(); eat(')'); return kink(v, a); }
    if (FUN[v] || v === 'e') throw new Error(`${v}는 기호 계산을 하지 않습니다.`);
    if (!(v in params)) throw new Error(`변수 ${v}의 값이 없습니다.`);
    return pwConst(Pi.of(frOf(params[v])));
  }
  const out = ternary();
  if (p < t.length || out.cut) throw new Error('수식을 끝까지 읽지 못했습니다.');
  return out;
}

/**
 * 함수를 정의역 안의 구간별 식으로 나눕니다: [{lo, hi, poly}](경계와 계수는 π의 다항식). 중첩된 조건식, sign, |x|도 실제 구간으로 풉니다.
 * 기호로 읽을 수 없으면 null입니다(미리보기와 문제 문장이 원래 식을 그대로 씁니다).
 */
function piecewiseRows(cfg, half) {
  try {
    const L = constOf(parsePiecewise(String(cfg.L), PI1, {}));
    if (!L || L.value <= 0) return null;
    const pw = parsePiecewise(String(cfg.f), L, cfg.params ?? {}), lo = half ? PI0 : L.neg(), hi = L;
    const inner = pw.cuts.filter(c => c.value > lo.value + 1e-12 && c.value < hi.value - 1e-12), edges = [lo, ...inner, hi], rows = [];
    for (let i = 0; i + 1 < edges.length; i++) {
      const poly = ptrim(polyAt(pw, (edges[i].value + edges[i + 1].value) / 2)), last = rows.at(-1);
      if (last && last.poly.length === poly.length && last.poly.every((c, k) => c.same(poly[k]))) last.hi = edges[i + 1];
      else rows.push({ lo: edges[i], hi: edges[i + 1], poly });
    }
    return rows;
  } catch { return null; }
}

/* ── 계수의 일반항: 항 = c · n^(−m) · [(−1)^n] · [cos 또는 sin(nπr)] ── */
/** fn(nπr)을 정리합니다: r을 [0, 2)로 줄이고, [1, 2)이면 (−1)^n을 떼어 냅니다. 0이면 null입니다. */
function trigAt(fn, r) {
  let t = r.sub(new Fr(2 * Math.floor(r.n / r.d / 2)));
  let sgn = false;
  if (t.value >= 1) { sgn = true; t = t.sub(FR1); }
  if (t.zero) return fn === 'cos' ? { sgn, trig: null } : null;
  return { sgn, trig: { fn, r: t } };
}
const fact = k => k <= 1 ? 1 : k * fact(k - 1);
const termKey = tm => `${tm.m}|${tm.sgn}|${tm.trig ? `${tm.trig.fn}${tm.trig.r.n}/${tm.trig.r.d}` : ''}`;
function addTerm(list, tm) {
  if (tm.c.zero) return;
  const same = list.find(o => termKey(o) === termKey(tm));
  if (same) same.c = same.c.add(tm.c); else list.push({ ...tm });
}
const cleanTerms = list => list.filter(tm => !tm.c.zero).sort((a, b) => a.m - b.m || (a.trig ? 1 : 0) - (b.trig ? 1 : 0));
/** ∫_α^β u^k · kernel(nπu) du를 항들로 더합니다. kernel은 'cos' 또는 'sin'이고 coef는 다항식의 계수입니다. */
function integrateMonomial(list, coef, k, alpha, beta, kernel, scale) {
  const forms = kernel === 'cos' ? [['sin', 1], ['cos', 1], ['sin', -1], ['cos', -1]] : [['cos', -1], ['sin', 1], ['cos', 1], ['sin', -1]];
  for (let j = 0; j <= k; j++) {
    const [fn, sg] = forms[j % 4], weight = fact(k) / fact(k - j);
    for (const [r, w] of [[beta, 1], [alpha, -1]]) {
      const tr = trigAt(fn, r);
      if (!tr) continue;
      const rp = k - j === 0 ? FR1 : r.pow(k - j);
      if (rp.zero) continue;
      addTerm(list, { c: coef.mul(Pi.of(new Fr(sg * w * weight).mul(rp).mul(scale), -(j + 1))), m: j + 1, sgn: tr.sgn, trig: tr.trig });
    }
  }
}
/** 일반항의 값입니다(검산용). */
const termsValue = (list, n) => list.reduce((s, tm) => s + tm.c.value * n ** -tm.m * (tm.sgn && n % 2 ? -1 : 1) * (tm.trig ? (tm.trig.fn === 'cos' ? Math.cos : Math.sin)(n * PI * tm.trig.r.value) : 1), 0);

/**
 * 설정의 함수로 a₀, aₙ, bₙ의 일반항을 구합니다. mode: 'full'(−L~L), 'cosine', 'sine'(0~L, 반구간).
 * shift는 함수에서 빼는 일차식 [상수, 기울기](막대의 정상 상태)입니다. 지원하지 않으면 null입니다.
 */
function symbolicCoefficients(cfg, mode, numeric, shift = null) {
  try {
    const Lp = parsePiecewise(String(cfg.L), PI1, {});
    const L = constOf(Lp);
    if (!L || !L.mono() || L.value <= 0) return null;
    let pw = parsePiecewise(String(cfg.f), L, cfg.params ?? {});
    if (shift) pw = combine(pw, { cuts: [], polys: [[Pi.of(frOf(shift[0])).neg(), Pi.of(frOf(shift[1])).neg().mul(L.inv())]] }, padd);
    const lo = mode === 'full' ? new Fr(-1) : FR0, hi = FR1, Linv = L.inv();
    const ratio = c => { const mo = c.mul(Linv).mono(); if (!mo || mo[0] !== 0) throw new Error('구간의 끝이 L의 유리수배가 아닙니다.'); return mo[1]; };
    const bounds = pw.cuts.map(ratio), edges = [lo, ...bounds.filter(r => r.value > lo.value && r.value < hi.value), hi];
    const a = [], b = [];
    let a0 = PI0, degree = 0;
    const pieces = [];
    const scale = mode === 'full' ? FR1 : new Fr(2);
    for (let i = 0; i + 1 < edges.length; i++) {
      const al = edges[i], be = edges[i + 1], poly = ptrim(polyAt(pw, L.value * (al.value + be.value) / 2));
      pieces.push({ lo: al, hi: be, poly });
      degree = Math.max(degree, poly.length - 1);
      poly.forEach((cx, k) => {
        const cu = cx.mul((() => { let r = PI1; for (let q = 0; q < k; q++) r = r.mul(L); return r; })());   // x^k = L^k u^k
        if (cu.zero) return;
        a0 = a0.add(cu.mul(Pi.of(be.pow(k + 1).sub(al.pow(k + 1)).div(new Fr(k + 1)))));
        if (mode !== 'sine') integrateMonomial(a, cu, k, al, be, 'cos', scale);
        if (mode !== 'cosine') integrateMonomial(b, cu, k, al, be, 'sin', scale);
      });
    }
    a0 = mode === 'full' ? a0.mul(Pi.of(new Fr(1, 2))) : a0;
    const res = { a0: mode === 'sine' ? PI0 : a0, a: cleanTerms(a), b: cleanTerms(b), pieces, degree, L };
    // 검산: 수치 계수(numeric(kind, n))와 n = 1~8에서 맞을 때만 씁니다.
    const ok = (val, num) => Math.abs(val - num) <= 1e-7 * Math.max(1, Math.abs(num));
    if (numeric && !ok(res.a0.value, numeric('a0', 0))) return null;
    for (let n = 1; n <= 8 && numeric; n++) {
      if (mode !== 'sine' && !ok(termsValue(res.a, n), numeric('a', n))) return null;
      if (mode !== 'cosine' && !ok(termsValue(res.b, n), numeric('b', n))) return null;
    }
    return res;
  } catch { return null; }
}

/* ── 글(수식 표기)로 쓰기 ── */
/** c·π^p를 [부호, 분자, 분모의 수, 분모의 π] 글로 나눕니다. 분모는 '수·n·π' 순서로 붙여 씁니다(예: 2nπ). */
function monoParts(p, fr) {
  const piText = k => (k === 1 ? '\\pi' : `\\pi^{${k}}`);
  const num = [Math.abs(fr.n) === 1 && p > 0 ? '' : String(Math.abs(fr.n)), p > 0 ? piText(p) : ''].join('');
  return [fr.n < 0, num || '1', fr.d === 1 ? '' : String(fr.d), p < 0 ? piText(-p) : ''];
}
/** π의 다항식을 글로 씁니다(예: \pi^{2}/3 - 1). */
function piTex(c) {
  const terms = [...c.m].sort((x, y) => y[0] - x[0]).map(([p, fr]) => { const [neg, num, dd, dp] = monoParts(p, fr); return [neg, dd + dp ? `\\frac{${num}}{${dd}${dp}}` : num]; });
  if (!terms.length) return '0';
  return terms.map(([neg, s], i) => (i ? (neg ? ' - ' : ' + ') : neg ? '-' : '') + s).join('');
}
const trigTex = tr => { if (!tr) return ''; const { n, d } = tr.r; return `\\${tr.fn}\\frac{${n === 1 ? '' : n}n\\pi}{${d}}`; };
/** 일반항을 글로 씁니다: 4/(nπ) − 4/(nπ)(−1)^n처럼 항마다 분수로 씁니다. */
function termsTex(list) {
  if (!list.length) return '0';
  return list.map((tm, i) => {
    const mo = tm.c.mono(), nPart = tm.m === 1 ? 'n' : `n^{${tm.m}}`, tail = `${tm.sgn ? '(-1)^{n}' : ''}${trigTex(tm.trig)}`;
    let neg, body;
    if (mo) { const [ng, num, dd, dp] = monoParts(mo[0], mo[1]); neg = ng; body = `\\frac{${num}}{${dd}${nPart}${dp}}${tail}`; }
    else { neg = false; body = `\\frac{${piTex(tm.c)}}{${nPart}}${tail}`; }
    return (i ? (neg ? ' - ' : ' + ') : neg ? '-' : '') + body;
  }).join('');
}
/** (−1)^n만 있고 cos·sin(nπr)이 없으면 n이 짝수일 때와 홀수일 때로 나눠 씁니다. */
function parityTex(list, name) {
  if (!list.length || list.some(tm => tm.trig)) return '';
  const sideOf = odd => { const out = []; for (const tm of list) addTerm(out, { c: tm.sgn && odd ? tm.c.neg() : tm.c, m: tm.m, sgn: false, trig: null }); return cleanTerms(out); };
  const even = sideOf(false), odd = sideOf(true);
  return `$n$이 홀수이면 $${name} = ${termsTex(odd)}$, 짝수이면 $${name} = ${termsTex(even)}$입니다.`;
}
/** x의 다항식을 글로 씁니다(예: \pi - x). */
function polyTex(poly) {
  const parts = [];
  poly.forEach((c, k) => {
    if (c.zero) return;
    const xs = k === 0 ? '' : k === 1 ? 'x' : `x^{${k}}`, mo = c.mono();
    if (mo && k > 0 && mo[0] === 0 && Math.abs(mo[1].n) === 1 && mo[1].d === 1) parts.push([mo[1].n < 0, xs]);
    else if (mo) { const [neg, num, dd, dp] = monoParts(mo[0], mo[1]); parts.push([neg, `${dd + dp ? `\\frac{${num}}{${dd}${dp}}` : num}${xs}`]); }
    else parts.push([false, `(${piTex(c)})${xs}`]);
  });
  if (!parts.length) return '0';
  return parts.reverse().map(([neg, s], i) => (i ? (neg ? ' - ' : ' + ') : neg ? '-' : '') + s).join('');
}
const frTex = (r, L) => { const v = Pi.of(r).mul(L); return piTex(v); };
/** 손 풀이 단계를 글(마크업)로 씁니다. name은 'a'/'b'/'B'/'A' 등 계수 이름입니다. */
function symbolicSteps(res, mode, names = { a0: 'a_0', a: 'a_n', b: 'b_n' }) {
  const out = [];
  const pieces = res.pieces.filter(pc => !pc.poly.every(c => c.zero) || res.pieces.length > 1);
  out.push(`**구간별 정리.** ${pieces.map(pc => `$${frTex(pc.lo, res.L)} < x < ${frTex(pc.hi, res.L)}$에서 $f(x) = ${polyTex(pc.poly)}$`).join(', ')}입니다.`);
  if (res.degree >= 1) {
    out.push('**부분적분.** $a = n\\pi/L$이라 하면 다음 공식을 씁니다.');
    out.push('$$\\int x\\cos ax\\,dx = \\frac{x\\sin ax}{a} + \\frac{\\cos ax}{a^2},\\quad \\int x\\sin ax\\,dx = -\\frac{x\\cos ax}{a} + \\frac{\\sin ax}{a^2}$$');
    if (res.degree >= 2) out.push('$$\\int x^2\\cos ax\\,dx = \\frac{x^2\\sin ax}{a} + \\frac{2x\\cos ax}{a^2} - \\frac{2\\sin ax}{a^3}$$');
    if (res.degree >= 3) out.push('차수가 더 높으면 같은 방법(표 적분)을 반복합니다.');
  }
  out.push('**대입하여 정리하면 일반항은 다음과 같습니다.**');
  if (mode !== 'sine') out.push(`$$${names.a0} = ${piTex(res.a0)}$$`);
  if (mode !== 'sine') { out.push(`$$${names.a} = ${termsTex(res.a)}$$`); const pa = parityTex(res.a, names.a); if (pa) out.push(pa); }
  if (mode !== 'cosine') { out.push(`$$${names.b} = ${termsTex(res.b)}$$`); const pb = parityTex(res.b, names.b); if (pb) out.push(pb); }
  out.push('검산: 이 일반항은 $n = 1, \\ldots, 8$에서 수치 적분 값과 일치합니다.');
  return out.join('\n\n');
}
