'use strict';
/* 수식 해석과 수학 계산. 화면(DOM)을 전혀 쓰지 않으므로 test.js에서 그대로 검사합니다. */
const PI = Math.PI;
const NMAX = 100;
const QUAD = 2048;

const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, log: Math.log, ln: Math.log, sqrt: Math.sqrt,
  abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil,
  step: v => v > 0 ? 1 : v < 0 ? 0 : .5 };
const RESERVED = ['x', 'pi', 'e', 'L'];

function tokenize(text) {
  const s = text.replace(/−/g, '-').replace(/×/g, '*').replace(/π/g, 'pi');
  const re = /\s*(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|\*\*|<=|>=|==|[-+*/^()?:<>])/y;
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    if (!s.slice(i).trim()) break;
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw new Error(`'${s.slice(i).trim()[0]}' 문자는 수식에 쓸 수 없습니다.`);
    tokens.push(m[1] === '**' ? '^' : m[1]);
    i = re.lastIndex;
  }
  return tokens;
}

/** 수식을 eval 없이 해석합니다. x·pi·e·L과 함수 이름이 아닌 글자는 매개변수가 됩니다. */
function compile(text) {
  const t = tokenize(text);
  if (!t.length) throw new Error('수식을 입력하십시오.');
  let p = 0;
  const params = new Set();
  const peek = () => t[p];
  const eat = v => { if (t[p] !== v) throw new Error(`'${v}'가 필요한 자리입니다.`); p++; };
  const isNum = v => v !== undefined && /^[\d.]/.test(v);
  const isId = v => v !== undefined && /^[A-Za-z_]/.test(v);
  function ternary() {
    const c = compare();
    if (peek() !== '?') return c;
    p++;
    const a = ternary(); eat(':');
    const b = ternary();
    return (x, P) => c(x, P) ? a(x, P) : b(x, P);
  }
  function compare() {
    const l = add();
    const op = peek();
    if (!['<', '>', '<=', '>=', '=='].includes(op)) return l;
    p++;
    const r = add();
    return { '<': (x, P) => +(l(x, P) < r(x, P)), '>': (x, P) => +(l(x, P) > r(x, P)),
      '<=': (x, P) => +(l(x, P) <= r(x, P)), '>=': (x, P) => +(l(x, P) >= r(x, P)), '==': (x, P) => +(l(x, P) === r(x, P)) }[op];
  }
  function add() {
    let l = mul();
    while (peek() === '+' || peek() === '-') {
      const op = t[p++], a = l, b = mul();
      l = op === '+' ? (x, P) => a(x, P) + b(x, P) : (x, P) => a(x, P) - b(x, P);
    }
    return l;
  }
  function mul() {
    let l = unary();
    for (;;) {
      const v = peek();
      if (v === '*' || v === '/') {
        p++;
        const a = l, b = unary();
        l = v === '*' ? (x, P) => a(x, P) * b(x, P) : (x, P) => a(x, P) / b(x, P);
      } else if (isNum(v) || isId(v) || v === '(') {
        const a = l, b = unary();           // 2x, 2 sin(x), k(x+1)처럼 곱셈 기호를 생략한 경우
        l = (x, P) => a(x, P) * b(x, P);
      } else return l;
    }
  }
  function unary() {
    if (peek() === '-') { p++; const a = unary(); return (x, P) => -a(x, P); }
    if (peek() === '+') { p++; return unary(); }
    return pow();
  }
  function pow() {
    const b = primary();
    if (peek() !== '^') return b;
    p++;
    const e = unary();
    return (x, P) => Math.pow(b(x, P), e(x, P));
  }
  function primary() {
    const v = t[p++];
    if (v === undefined) throw new Error('수식이 중간에 끝났습니다.');
    if (v === '(') { const e = ternary(); eat(')'); return e; }
    if (isNum(v)) { const c = parseFloat(v); return () => c; }
    if (isId(v)) {
      if (FUN[v]) {
        const fn = FUN[v];
        if (peek() !== '(') {
          // sin x, sin 2x처럼 괄호 없이 쓴 인수: 다음 함수 이름이나 연산자(+, −, *, / 등) 앞까지입니다.
          const n = peek();
          if (!(isNum(n) || isId(n) || n === '-')) throw new Error(`${v} 뒤에 인수가 필요합니다. 예: ${v}(x) 또는 ${v} x`);
          let a = unary();
          while (isNum(peek()) || (isId(peek()) && !FUN[peek()])) { const l = a, r = pow(); a = (x, P) => l(x, P) * r(x, P); }
          return (x, P) => fn(a(x, P));
        }
        p++;
        const a = ternary(); eat(')');
        return (x, P) => fn(a(x, P));
      }
      if (v === 'x') return x => x;
      if (v === 'pi') return () => PI;
      if (v === 'e') return () => Math.E;
      if (v === 'L') return (x, P) => P.L;
      params.add(v);
      return (x, P) => P[v];
    }
    throw new Error(`'${v}'를 여기에 쓸 수 없습니다.`);
  }
  const fn = ternary();
  if (p < t.length) throw new Error(`'${t[p]}' 부근의 수식을 확인하십시오.`);
  if (params.size > 4) throw new Error('매개변수는 4개까지 쓸 수 있습니다.');
  return { fn, params: [...params] };
}

/** 길이 표현 입력(pi, 2*pi, 1/3 등)을 숫자로 바꿉니다. */
function constant(text) {
  const c = compile(String(text));
  if (c.params.length) throw new Error('길이에는 숫자나 pi만 쓸 수 있습니다.');
  const v = c.fn(0, { L: 1 });
  if (!isFinite(v) || v <= 0) throw new Error('길이는 양수여야 합니다.');
  return v;
}

function erf(x) {
  const z = Math.abs(x), t = 1 / (1 + .5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (.37409196 + t * (.09678418 + t * (-.18628806 +
    t * (.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-.82215223 + t * .17087277)))))))));
  return x >= 0 ? 1 - r : r - 1;
}

/* ── 급수 전개 ─────────────────────────────────────── */
/** 값이 p/q, p/(qπ), p/(qπ²), pπ/q 꼴로 보이면 그 글자를 돌려줍니다(수치에서 추정). */
function closedForm(v) {
  if (Math.abs(v) < 2e-6) return '0';
  const sign = v < 0 ? '−' : '', u = Math.abs(v);
  const gcd = (A, B) => B ? gcd(B, A % B) : A;
  for (const [w, kind] of [[u, ''], [u * PI, '/π'], [u * PI * PI, '/π²'], [u / PI, 'π']]) for (let q = 1; q <= 40; q++) {
    const pr = w * q, r = Math.round(pr);
    if (r < 1 || r > 64 || Math.abs(pr - r) > 2e-6 * q || gcd(r, q) !== 1) continue;
    if (kind === '') return `${sign}${r}${q > 1 ? `/${q}` : ''}`;
    if (kind === 'π') return `${sign}${r > 1 ? r : ''}π${q > 1 ? `/${q}` : ''}`;
    return `${sign}${r}/${q > 1 ? `(${q}${kind.slice(1)})` : kind.slice(1)}`;
  }
  return '';
}

function coefficients(ext, L, count, m) {
  const h = 2 * L / m, v = new Float64Array(m), xs = new Float64Array(m);
  let a0 = 0, energy = 0;
  for (let j = 0; j < m; j++) { xs[j] = -L + (j + .5) * h; v[j] = ext(xs[j]); a0 += v[j]; energy += v[j] * v[j]; }
  a0 *= h / (2 * L);
  const a = new Float64Array(count + 1), b = new Float64Array(count + 1), w = PI / L;
  for (let n = 1; n <= count; n++) {
    let sa = 0, sb = 0;
    for (let j = 0; j < m; j++) { sa += v[j] * Math.cos(n * w * xs[j]); sb += v[j] * Math.sin(n * w * xs[j]); }
    a[n] = sa * h / L; b[n] = sb * h / L;
  }
  return { a0, a, b, xs, v, energy: energy * h };
}

function findJumps(ext, L, cells, span) {
  const h = 2 * L / cells, v = new Float64Array(cells), d = new Float64Array(cells);
  const per = x => ext(((x + L) % (2 * L) + 2 * L) % (2 * L) - L);
  for (let i = 0; i < cells; i++) v[i] = ext(-L + (i + .5) * h);
  for (let i = 0; i < cells; i++) d[i] = v[(i + 1) % cells] - v[i];
  const near = i => Math.max(Math.abs(d[(i + cells - 2) % cells]), Math.abs(d[(i + cells - 1) % cells]),
    Math.abs(d[(i + 1) % cells]), Math.abs(d[(i + 2) % cells]));
  const jumps = [];
  for (let i = 0; i < cells; i++) {
    if (Math.abs(d[i]) < Math.max(.03 * span, 1e-9) || Math.abs(d[i]) < 6 * near(i)) continue;
    let lo = -L + (i + .5) * h, hi = lo + h;
    const vl = v[i], vr = v[(i + 1) % cells];
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2, y = per(mid);
      if (Math.abs(y - vl) < Math.abs(y - vr)) lo = mid; else hi = mid;
    }
    let x = (lo + hi) / 2;
    const grid = L / 12;
    if (Math.abs(x - Math.round(x / grid) * grid) < 1e-6 * L) x = Math.round(x / grid) * grid;
    const e = 1e-7 * L;
    jumps.push({ x: x <= -L + 1e-6 * L ? L : x, left: per(x - e), right: per(x + e) });
  }
  return jumps;
}

/** 직접 그린 곡선의 도약: 표본 사이의 차이가 주변 기울기보다 훨씬 큰 곳입니다. */
function findDrawnJumps(ext, L, nodes, span) {
  const s = new Float64Array(nodes + 1);
  for (let i = 0; i <= nodes; i++) s[i] = ext(Math.min(L - 1e-9 * L, Math.max(-L + 1e-9 * L, -L + 2 * L * i / nodes)));
  const d = i => { const k = ((i % nodes) + nodes) % nodes; return s[k + 1] - s[k]; };
  const jumps = [];
  for (let i = 0; i < nodes; i++) {
    const near = Math.max(...[-2, -1, 1, 2].map(k => Math.abs(d(i + k))));
    if (Math.abs(d(i)) >= Math.max(.05 * span, 1e-9) && Math.abs(d(i)) > 6 * near) jumps.push({ x: -L + (i + .5) * 2 * L / nodes, left: s[i], right: s[i + 1] });
  }
  if (Math.abs(s[nodes] - s[0]) >= Math.max(.05 * span, 1e-9)) jumps.push({ x: L, left: s[nodes], right: s[0] });
  return jumps;
}

function symmetry(v, span, tol) {
  let even = 0, odd = 0;
  const m = v.length;
  for (let j = 0; j < m; j++) {
    even = Math.max(even, Math.abs(v[j] - v[m - 1 - j]));
    odd = Math.max(odd, Math.abs(v[j] + v[m - 1 - j]));
  }
  if (odd <= tol * Math.max(span, 1e-9)) return 'odd';
  if (even <= tol * Math.max(span, 1e-9)) return 'even';
  return 'none';
}

/** 전개 방식에 맞게 한 주기 (−L, L)로 확장한 함수입니다. 반구간 전개도 확장한 함수의 Fourier 급수와 같습니다. */
function extension(raw, mode) {
  if (mode === 'cosine') return x => raw(Math.abs(x));
  if (mode === 'sine') return x => x > 0 ? raw(x) : x < 0 ? -raw(-x) : 0;
  return raw;
}

function buildSeries(raw, L, mode, drawnNodes) {
  const ext = extension(raw, mode);
  const f = x => ext(((x + L) % (2 * L) + 2 * L) % (2 * L) - L);
  const c = coefficients(ext, L, NMAX, QUAD);
  let lo = Infinity, hi = -Infinity;
  for (const y of c.v) {
    if (!isFinite(y)) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다. 수식이나 구간을 확인하십시오.');
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  const peak = Math.max(Math.abs(lo), Math.abs(hi));
  if (peak > 1e4) throw new Error('값이 너무 큽니다. 구간에서 유계인 함수를 입력하십시오.');
  let fine = 0;
  for (let j = 0; j < 4 * QUAD; j++) fine = Math.max(fine, Math.abs(ext(-L + (j + .5) * 2 * L / (4 * QUAD))));
  if (fine > 10 && fine > 2 * peak) throw new Error('구간 안에서 값이 무한히 커지는 함수입니다. 유계인 함수를 입력하십시오.');
  const span = hi - lo;
  const jumps = drawnNodes ? findDrawnJumps(ext, L, drawnNodes, span) : findJumps(ext, L, 4096, span);
  return { f, ext, raw, L, mode, ...c, lo, hi, span, jumps, sym: symmetry(c.v, span, drawnNodes ? 1e-3 : 1e-7) };
}

function partialSum(model, N, x) {
  let s = model.a0;
  const w = PI / model.L * x;
  for (let n = 1; n <= N; n++) s += model.a[n] * Math.cos(n * w) + model.b[n] * Math.sin(n * w);
  return s;
}

/** 최소제곱 오차 E* = ∫f² − L[2a₀² + Σ(aₙ²+bₙ²)] (교재 11.4절 식 6을 주기 2L로 쓴 것). */
function squareError(model, N) {
  let s = 2 * model.a0 * model.a0;
  for (let n = 1; n <= N; n++) s += model.a[n] * model.a[n] + model.b[n] * model.b[n];
  return Math.max(0, model.energy - model.L * s);
}

/** 도약 크기에 대한 부분합의 최대 초과량. 큰 N에서 약 9%(Gibbs)입니다. */
function overshoot(model, jump, N) {
  const J = Math.abs(jump.right - jump.left);
  if (!J) return 0;
  const highRight = jump.right > jump.left, reach = model.L / PI;
  let best = 0;
  for (let i = 1; i <= 400; i++) {
    const d = i / 400 * reach;
    const xr = jump.x + d, xl = jump.x - d;
    const fr = model.f(xr), fl = model.f(xl), sr = partialSum(model, N, xr), sl = partialSum(model, N, xl);
    best = Math.max(best, highRight ? sr - fr : fr - sr, highRight ? fl - sl : sl - fl);
  }
  return best / J;
}

/* ── 1차원 파동·열 ─────────────────────────────────── */
/** [0, L]의 사인·코사인 계수. 교재 12.3절 식 (14), 12.6절 식 (10), (13)입니다. */
function halfCoefficients(fn, L, count, cosine) {
  const m = QUAD, h = L / m, out = new Float64Array(count + 1);
  let mean = 0;
  const xs = new Float64Array(m), v = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    xs[j] = (j + .5) * h; v[j] = fn(xs[j]);
    if (!isFinite(v[j])) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.');
    mean += v[j];
  }
  for (let n = 1; n <= count; n++) {
    let s = 0;
    const w = n * PI / L;
    for (let j = 0; j < m; j++) s += v[j] * (cosine ? Math.cos(w * xs[j]) : Math.sin(w * xs[j]));
    out[n] = 2 * s * h / L;
  }
  return { c: out, mean: mean * h / L };
}

/**
 * 1차원 PDE 해.
 * eq: 'wave' u_tt=c²u_xx, 'heat' u_t=αu_xx. bc: 'fixed', 'insulated'(열), 'infinite'.
 * opts: {L, N, speed, alpha, left, right, X}
 */
function buildPde(eq, bc, f, g, opts) {
  const { L, N, speed, alpha, left = 0, right = 0, X = 5 } = opts;
  if (bc === 'infinite') {
    if (eq === 'wave') {
      const span = X + speed * opts.tEnd + 1, cells = 4000, h = 2 * span / cells, cum = new Float64Array(cells + 1);
      for (let i = 0; i < cells; i++) cum[i + 1] = cum[i] + g(-span + (i + .5) * h) * h;
      const G = x => { const t = (x + span) / h, i = Math.max(0, Math.min(cells - 1, Math.floor(t))); return cum[i] + (cum[i + 1] - cum[i]) * (t - i); };
      return { eq, bc, range: [-X, X],
        u: (x, t) => .5 * (f(x - speed * t) + f(x + speed * t)) + (G(x + speed * t) - G(x - speed * t)) / (2 * speed),
        right: (x, t) => .5 * f(x - speed * t), leftw: (x, t) => .5 * f(x + speed * t), coef: null };
    }
    // 무한 막대: 열핵을 칸마다 정확히 적분한 가중치(erf 차이)와 칸의 평균값으로 합성곱합니다(12.7절 식 11).
    // f의 누적 적분표를 미리 만들어 두어, 도약이 칸 안에 있어도 칸의 평균이 정확합니다.
    const span = X + 6 * 2 * Math.sqrt(alpha * opts.tEnd) + 1, fine = 8192, hf = 2 * span / fine, cum = new Float64Array(fine + 1);
    for (let i = 0; i < fine; i++) cum[i + 1] = cum[i] + f(-span + (i + .5) * hf) * hf;
    const F = x => { const t = (x + span) / hf; if (t <= 0) return cum[0] + f(-span) * (x + span); if (t >= fine) return cum[fine] + f(span) * (x - span); const i = Math.floor(t); return cum[i] + (cum[i + 1] - cum[i]) * (t - i); };
    return { eq, bc, range: [-X, X], coef: null,
      u: (x, t) => {
        if (t <= 0) return f(x);
        const w = 2 * Math.sqrt(alpha * t), reach = 6 * w, cells = 240, h = 2 * reach / cells;
        let s = 0, Fa = F(x - reach), ea = erf(reach / w);
        for (let i = 1; i <= cells; i++) {
          const y = x - reach + i * h, Fb = F(y), eb = erf((x - y) / w);
          s += (Fb - Fa) / h * .5 * (ea - eb);
          Fa = Fb; ea = eb;
        }
        return s;
      } };
  }
  if (bc === 'insulated') {
    const { c, mean } = halfCoefficients(f, L, N, true);
    const rate = n => alpha * (n * PI / L) ** 2;
    return { eq, bc, range: [0, L], coef: c, mean, rate,
      u: (x, t) => { let s = mean; for (let n = 1; n <= N; n++) s += c[n] * Math.cos(n * PI * x / L) * Math.exp(-rate(n) * t); return s; },
      mode: (n, x, t) => n === 0 ? mean : c[n] * Math.cos(n * PI * x / L) * Math.exp(-rate(n) * t),
      amp: (n, t) => n === 0 ? mean : c[n] * Math.exp(-rate(n) * t) };
  }
  if (eq === 'heat') {
    const steady = x => left + (right - left) * x / L;
    const { c } = halfCoefficients(x => f(x) - steady(x), L, N, false);
    const rate = n => alpha * (n * PI / L) ** 2;
    return { eq, bc, range: [0, L], coef: c, rate, steady,
      u: (x, t) => { let s = steady(x); for (let n = 1; n <= N; n++) s += c[n] * Math.sin(n * PI * x / L) * Math.exp(-rate(n) * t); return s; },
      mode: (n, x, t) => c[n] * Math.sin(n * PI * x / L) * Math.exp(-rate(n) * t),
      amp: (n, t) => c[n] * Math.exp(-rate(n) * t) };
  }
  const B = halfCoefficients(f, L, N, false).c, V = halfCoefficients(g, L, N, false).c;
  const om = n => speed * n * PI / L;
  const q = (n, t) => B[n] * Math.cos(om(n) * t) + V[n] / om(n) * Math.sin(om(n) * t);
  const star = s => { let y = 0; for (let n = 1; n <= N; n++) y += B[n] * Math.sin(n * PI * s / L); return y; };
  return { eq, bc, range: [0, L], coef: B, omega: om, velocity: V,
    u: (x, t) => { let s = 0; for (let n = 1; n <= N; n++) s += q(n, t) * Math.sin(n * PI * x / L); return s; },
    mode: (n, x, t) => q(n, t) * Math.sin(n * PI * x / L), amp: q,
    right: (x, t) => .5 * star(x - speed * t), leftw: (x, t) => .5 * star(x + speed * t),
    energy: t => { let e = 0; for (let n = 1; n <= N; n++) { const dq = -om(n) * B[n] * Math.sin(om(n) * t) + V[n] * Math.cos(om(n) * t); e += dq * dq + (om(n) * q(n, t)) ** 2; } return e * L / 4; } };
}
