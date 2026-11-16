'use strict';
/* 고유함수 엔진. 구간 (0, L)의 고유값 문제 F'' + k²F = 0의 해(고유함수 종류)를 표 한 줄씩으로 두고,
   계수 계산(전개)과 시간 변화(파동·감쇠·열)는 종류와 상관없이 같은 코드가 합니다.
   새 경계조건이나 새 고유함수는 FAMILIES에 한 줄을 더하면 됩니다(∫φₙ² = L/2인 종류). */
const qk = n => 2 * n - 1;
const FAMILIES = [
  { id: 'sine', ends: ['fixed', 'fixed'], n0: 1, k: (n, L) => n * PI / L, phi: (n, x, L) => Math.sin(n * PI * x / L),
    tex: String.raw`\sin\frac{n\pi x}{L}`, kTex: String.raw`\frac{n\pi}{L}`, plain: 'sin(nπx/L)', title: '양 끝에서 값이 0 (고정)',
    label: n => `sin(${n > 1 ? n : ''}π<i>x</i>/<i>L</i>)` },
  { id: 'cosine', ends: ['free', 'free'], n0: 0, k: (n, L) => n * PI / L, phi: (n, x, L) => Math.cos(n * PI * x / L),
    tex: String.raw`\cos\frac{n\pi x}{L}`, kTex: String.raw`\frac{n\pi}{L}`, plain: 'cos(nπx/L)', title: '양 끝에서 기울기 0 (자유·단열)',
    label: n => n ? `cos(${n > 1 ? n : ''}π<i>x</i>/<i>L</i>)` : '1' },
  { id: 'qsine', ends: ['fixed', 'free'], n0: 1, k: (n, L) => qk(n) * PI / (2 * L), phi: (n, x, L) => Math.sin(qk(n) * PI * x / (2 * L)),
    tex: String.raw`\sin\frac{(2n-1)\pi x}{2L}`, kTex: String.raw`\frac{(2n-1)\pi}{2L}`, plain: 'sin((2n−1)πx/2L)', title: 'x = 0에서 값 0, x = L에서 기울기 0',
    label: n => `sin(${qk(n) > 1 ? qk(n) : ''}π<i>x</i>/2<i>L</i>)` },
  { id: 'qcosine', ends: ['free', 'fixed'], n0: 1, k: (n, L) => qk(n) * PI / (2 * L), phi: (n, x, L) => Math.cos(qk(n) * PI * x / (2 * L)),
    tex: String.raw`\cos\frac{(2n-1)\pi x}{2L}`, kTex: String.raw`\frac{(2n-1)\pi}{2L}`, plain: 'cos((2n−1)πx/2L)', title: 'x = 0에서 기울기 0, x = L에서 값 0',
    label: n => `cos(${qk(n) > 1 ? qk(n) : ''}π<i>x</i>/2<i>L</i>)` },
];
/** 양 끝 조건(고정·자유)에 맞는 고유함수 종류입니다. */
const familyFor = (left, right) => FAMILIES.find(f => f.ends[0] === left && f.ends[1] === right) ?? FAMILIES[0];
const familyOf = cfg => FAMILIES.find(f => f.id === cfg.family) ?? FAMILIES[0];
/** 계수 cₙ = ∫ f φₙ / ∫ φₙ² (n = 0, 상수 고유함수면 평균). 화면용 중점 적분입니다. */
function eigenCoefficients(fam, fn, L, N) {
  const m = QUAD, h = L / m, xs = new Float64Array(m), v = new Float64Array(m), c = new Float64Array(N + 1);
  for (let j = 0; j < m; j++) { xs[j] = (j + .5) * h; v[j] = fn(xs[j]); if (!isFinite(v[j])) throw new Error('구간 안에 값이 정의되지 않는 점이 있습니다.'); }
  for (let n = fam.n0; n <= N; n++) { let s = 0; for (let j = 0; j < m; j++) s += v[j] * fam.phi(n, xs[j], L); c[n] = s * h / (n === 0 ? L : L / 2); }
  return c;
}
const eigenCache = new WeakMap();
/** 풀이용 촘촘한 계수입니다(core.js의 integrate). */
function fineEigen(fam, fn, L, n) {
  const memo = eigenCache.get(fn) ?? new Map(), key = `${fam.id}|${L}|${n}`;
  eigenCache.set(fn, memo);
  if (!memo.has(key)) memo.set(key, integrate(x => fn(x) * fam.phi(n, x, L), 0, L) / (n === 0 ? L : L / 2));
  return memo.get(key);
}
/** 부분합 Σ cₙφₙ(x) (n0부터 N까지)입니다. */
function eigenSum(fam, c, L, N, x) { let s = 0; for (let n = fam.n0; n <= N; n++) s += c[n] * fam.phi(n, x, L); return s; }
/** 파동(감쇠 k 포함): 모드마다 q'' + 2kq' + (ckₙ)²q = 0, q(0) = Bₙ, q'(0) = Vₙ. */
function modalWave(fam, f, g, L, N, speed, k) {
  const B = eigenCoefficients(fam, f, L, N), V = eigenCoefficients(fam, g, L, N), om = n => speed * fam.k(n, L), q = [];
  for (let n = fam.n0; n <= N; n++) q[n] = n === 0 ? (k > 0 ? t => B[0] + V[0] * (1 - Math.exp(-2 * k * t)) / (2 * k) : t => B[0] + V[0] * t) : dampedMode(B[n], V[n], om(n), k);
  const u = (x, t) => { let s = 0; for (let n = fam.n0; n <= N; n++) s += q[n](t) * fam.phi(n, x, L); return s; };
  return { family: fam, coef: B, velocity: V, mean: fam.n0 === 0 ? B[0] : 0, omega: om, damping: k, range: [0, L],
    amp: (n, t) => q[n](t), mode: (n, x, t) => q[n](t) * fam.phi(n, x, L), u };
}
/** 열: 정상 상태 U(x)(고정된 끝의 온도로 정함)를 빼고 모드마다 e^(−c²kₙ²t)로 줄어듭니다. */
function modalHeat(fam, f, L, N, alpha, left, right) {
  const [fl, fr] = fam.ends.map(e => e === 'fixed');
  const steady = fl && fr ? x => left + (right - left) * x / L : fl ? () => left : fr ? () => right : () => 0;
  const c = eigenCoefficients(fam, x => f(x) - steady(x), L, N), rate = n => alpha * fam.k(n, L) ** 2;
  const mean = fam.n0 === 0 ? c[0] : undefined, limit = x => steady(x) + (mean ?? 0);
  return { family: fam, range: [0, L], coef: c, rate, steady, mean, limit, limitName: mean === undefined ? '정상 상태' : '평균 온도',
    u: (x, t) => { let s = steady(x); for (let n = fam.n0; n <= N; n++) s += c[n] * fam.phi(n, x, L) * Math.exp(-rate(n) * t); return s; },
    mode: (n, x, t) => c[n] * fam.phi(n, x, L) * Math.exp(-rate(n) * t), amp: (n, t) => c[n] * Math.exp(-rate(n) * t) };
}
